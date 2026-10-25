#!/usr/bin/env python3
"""Servidor HTTP local e seguro para o editor de cifras.

O núcleo do servidor usa apenas a biblioteca padrão; a importação por imagem
carrega suas dependências opcionais sob demanda. Ele serve os arquivos estáticos do
repositório e expõe uma API pequena para ler e substituir o texto do único
elemento ``<pre>`` de uma página HTML.
"""

from __future__ import annotations

import argparse
import base64
import getpass
import hashlib
import html
import ipaddress
import json
import os
import re
import shlex
import socket
import stat
import subprocess
import sys
import tempfile
import threading
import secrets
from dataclasses import dataclass
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Any, Callable
from urllib.parse import parse_qs, urlsplit

import event_manager


LOOPBACK_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
AUTH_ITERATIONS = 310_000
MAX_REQUEST_BYTES = 4 * 1024 * 1024
API_PREFIX = "/__chord_editor__/"
HEALTH_ENDPOINT = f"{API_PREFIX}health"
DOCUMENT_ENDPOINT = f"{API_PREFIX}document"
IMPORT_ENDPOINT = f"{API_PREFIX}import-cifraclub"
SAVE_ENDPOINT = f"{API_PREFIX}save"
INDEXES_ENDPOINT = f"{API_PREFIX}indexes"
SHORTCUT_ENDPOINT = f"{API_PREFIX}shortcut"
SHUTDOWN_ENDPOINT = f"{API_PREFIX}shutdown"
EVENTS_ENDPOINT = f"{API_PREFIX}events"
SONGS_ENDPOINT = f"{API_PREFIX}songs"
CAPOS_ENDPOINT = f"{API_PREFIX}capos"
REVISION_RE = re.compile(r"[0-9a-fA-F]{64}\Z")


class LanAuthenticator:
    """Verifies an administrator password without storing it in plaintext."""

    def __init__(self, salt: bytes, password_hash: bytes) -> None:
        self.salt = salt
        self.password_hash = password_hash

    @classmethod
    def load_or_create(cls, path: Path) -> LanAuthenticator:
        try:
            if path.is_symlink():
                raise ValueError("O arquivo de autenticação não pode ser um link simbólico.")
            data = json.loads(path.read_text(encoding="utf-8"))
            salt = bytes.fromhex(data["salt"])
            password_hash = bytes.fromhex(data["hash"])
            iterations = data["iterations"]
            if iterations != AUTH_ITERATIONS or len(salt) < 16 or len(password_hash) != 32:
                raise ValueError("formato de credencial inválido")
            os.chmod(path, 0o600)
            os.chmod(path.parent, 0o700)
            return cls(salt, password_hash)
        except FileNotFoundError:
            pass
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise ValueError(f"Arquivo de autenticação inválido: {path}") from error

        password = getpass.getpass("Defina a senha administrativa do servidor LAN: ")
        confirmation = getpass.getpass("Confirme a senha: ")
        if len(password) < 12:
            raise ValueError("A senha deve ter pelo menos 12 caracteres.")
        if not secrets.compare_digest(password, confirmation):
            raise ValueError("As senhas não coincidem.")

        salt = secrets.token_bytes(16)
        password_hash = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, AUTH_ITERATIONS
        )
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(path.parent, 0o700)
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        except FileExistsError:
            raise ValueError("O arquivo de autenticação foi criado simultaneamente; reinicie o servidor.")
        try:
            with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
                json.dump(
                    {
                        "iterations": AUTH_ITERATIONS,
                        "salt": salt.hex(),
                        "hash": password_hash.hex(),
                    },
                    stream,
                )
                stream.write("\n")
        except OSError:
            path.unlink(missing_ok=True)
            raise
        return cls(salt, password_hash)

    def verify(self, password: str | None) -> bool:
        if password is None:
            return False
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), self.salt, AUTH_ITERATIONS
        )
        return secrets.compare_digest(candidate, self.password_hash)


def _lan_ipv4_network() -> tuple[str, ipaddress.IPv4Network]:
    """Find the private IPv4 address and subnet selected by the active route."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as route_probe:
        route_probe.connect(("192.0.2.1", 80))
        address = route_probe.getsockname()[0]

    parsed_address = ipaddress.ip_address(address)
    private_ranges = (
        ipaddress.ip_network("10.0.0.0/8"),
        ipaddress.ip_network("172.16.0.0/12"),
        ipaddress.ip_network("192.168.0.0/16"),
    )
    if not any(parsed_address in network for network in private_ranges):
        raise OSError("A rota ativa não usa um endereço IPv4 privado da rede local.")

    try:
        result = subprocess.run(
            ["ip", "-o", "-4", "addr", "show"],
            capture_output=True,
            check=True,
            text=True,
            timeout=5,
        )
    except FileNotFoundError as error:
        raise OSError("Instale a ferramenta de rede com `pkg install iproute2`.") from error
    except (OSError, subprocess.SubprocessError) as error:
        raise OSError("Não foi possível detectar a máscara da rede local (comando ip).") from error

    for line in result.stdout.splitlines():
        fields = line.split()
        for field in fields:
            if "/" not in field:
                continue
            try:
                interface = ipaddress.ip_interface(field)
            except ValueError:
                continue
            if interface.ip == parsed_address:
                interface_name = fields[1].split("@", 1)[0]
                if interface_name.startswith(("rmnet", "ccmni", "pdp", "wwan", "tun", "tap")):
                    raise OSError("A rota selecionada não é uma interface Wi-Fi/LAN apropriada.")
                if hasattr(sys, "getandroidapilevel") and not interface_name.startswith(("wlan", "wifi")):
                    raise OSError("Conecte o aparelho à rede Wi-Fi antes de iniciar o modo LAN.")
                return address, interface.network
    raise OSError("Não foi possível identificar a sub-rede da interface ativa.")


class EditorError(Exception):
    """Erro esperado, próprio para ser devolvido pela API."""

    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Document:
    path: str
    pre_text: str
    revision: str


@dataclass(frozen=True)
class SaveResult:
    revision: str


@dataclass(frozen=True)
class ApiResponse:
    status: int
    body: dict[str, Any]


@dataclass(frozen=True)
class _LoadedDocument:
    target: Path
    source: str
    pre_start: int
    pre_end: int
    pre_text: str
    revision: str


class _PreLocator(HTMLParser):
    """Localiza semanticamente tags PRE sem reformatar o HTML."""

    def __init__(self, source: str) -> None:
        super().__init__(convert_charrefs=False)
        self.source = source
        self.starts: list[tuple[int, int]] = []
        self.ends: list[int] = []
        self.self_closing_pre = False
        self._line_starts = [0]
        self._line_starts.extend(
            index + 1 for index, character in enumerate(source) if character == "\n"
        )

    def _offset(self) -> int:
        line, column = self.getpos()
        return self._line_starts[line - 1] + column

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag.lower() == "pre":
            raw_tag = self.get_starttag_text()
            start = self._offset()
            self.starts.append((start, start + len(raw_tag)))

    def handle_startendtag(
        self, tag: str, attrs: list[tuple[str, str | None]]
    ) -> None:
        del attrs
        if tag.lower() == "pre":
            self.self_closing_pre = True
            raw_tag = self.get_starttag_text()
            start = self._offset()
            self.starts.append((start, start + len(raw_tag)))

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "pre":
            self.ends.append(self._offset())


class _TextExtractor(HTMLParser):
    """Obtém o equivalente útil de textContent para o interior do PRE."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _locate_pre(source: str) -> tuple[int, int, str]:
    locator = _PreLocator(source)
    try:
        locator.feed(source)
        locator.close()
    except (AssertionError, ValueError) as exc:
        raise EditorError(
            422, "invalid_html", "O arquivo não contém HTML válido para edição."
        ) from exc

    if (
        locator.self_closing_pre
        or len(locator.starts) != 1
        or len(locator.ends) != 1
    ):
        raise EditorError(
            422,
            "invalid_html",
            "A página deve conter exatamente um elemento <pre> completo.",
        )

    _, content_start = locator.starts[0]
    content_end = locator.ends[0]
    if content_end < content_start:
        raise EditorError(
            422,
            "invalid_html",
            "A página deve conter exatamente um elemento <pre> completo.",
        )

    raw_content = source[content_start:content_end]
    extractor = _TextExtractor()
    try:
        extractor.feed(raw_content)
        extractor.close()
    except (AssertionError, ValueError) as exc:
        raise EditorError(
            422, "invalid_html", "O conteúdo do elemento <pre> é inválido."
        ) from exc
    return content_start, content_end, "".join(extractor.parts)


class EditorService:
    """Camada de persistência, independente do transporte HTTP."""

    def __init__(self, root: str | os.PathLike[str]) -> None:
        resolved_root = Path(root).resolve(strict=True)
        if not resolved_root.is_dir():
            raise ValueError("A raiz do servidor precisa ser um diretório.")
        self.root = resolved_root
        self._write_lock = threading.RLock()

    def _resolve_html(self, requested_path: str) -> tuple[Path, str]:
        if not isinstance(requested_path, str) or not requested_path:
            raise EditorError(400, "invalid_request", "O campo path é obrigatório.")
        if "\x00" in requested_path or "\\" in requested_path:
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.")

        relative = PurePosixPath(requested_path)
        if (
            relative.is_absolute()
            or any(part == ".." for part in relative.parts)
            or relative.suffix.lower() != ".html"
        ):
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.")

        normalized_path = relative.as_posix()
        try:
            target = (self.root / Path(*relative.parts)).resolve(strict=True)
        except FileNotFoundError as exc:
            raise EditorError(404, "file_not_found", "O arquivo HTML não foi encontrado.") from exc
        except (OSError, RuntimeError) as exc:
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.") from exc

        try:
            target.relative_to(self.root)
        except ValueError as exc:
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.") from exc

        if target.suffix.lower() != ".html":
            raise EditorError(403, "path_forbidden", "O caminho solicitado não é permitido.")
        if not target.is_file():
            raise EditorError(404, "file_not_found", "O arquivo HTML não foi encontrado.")
        return target, normalized_path

    def _load(self, requested_path: str) -> _LoadedDocument:
        target, _ = self._resolve_html(requested_path)
        try:
            raw = target.read_bytes()
        except FileNotFoundError as exc:
            raise EditorError(404, "file_not_found", "O arquivo HTML não foi encontrado.") from exc
        except OSError as exc:
            raise EditorError(500, "read_failed", "Não foi possível ler o arquivo HTML.") from exc

        try:
            source = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise EditorError(
                422, "invalid_encoding", "O arquivo HTML precisa estar em UTF-8."
            ) from exc

        pre_start, pre_end, pre_text = _locate_pre(source)
        return _LoadedDocument(
            target=target,
            source=source,
            pre_start=pre_start,
            pre_end=pre_end,
            pre_text=pre_text,
            revision=_sha256(raw),
        )

    def load_document(self, requested_path: str) -> Document:
        loaded = self._load(requested_path)
        _, normalized_path = self._resolve_html(requested_path)
        return Document(
            path=normalized_path,
            pre_text=loaded.pre_text,
            revision=loaded.revision,
        )

    def list_indexes(self) -> list[dict[str, Any]]:
        """Lista pastas que possuem index.html sem expor links externos."""
        return event_manager.list_events(self.root)

    def manage(self, operation: str, payload: Any) -> dict[str, Any]:
        if not isinstance(payload, dict):
            raise EditorError(400, "invalid_request", "O corpo JSON deve ser um objeto.")
        actions: dict[str, Callable[[Path, dict[str, object]], Any]] = {
            "create_event": event_manager.create_event,
            "create_song": event_manager.create_song,
            "update_event": event_manager.update_event,
            "update_song": event_manager.update_song,
            "add_capo": event_manager.add_capo,
            "delete_event": event_manager.delete_event,
            "delete_song": event_manager.delete_song,
            "delete_capo": event_manager.delete_capo,
        }
        try:
            result = actions[operation](self.root, payload)
        except event_manager.ManagerError as error:
            raise EditorError(error.status, error.code, error.message) from error
        return result or {}

    def create_desktop_shortcut(self, port: int) -> Path:
        if _is_windows():
            return self._create_windows_shortcut(port)

        desktop = _desktop_directory()
        desktop.mkdir(parents=True, exist_ok=True)
        shortcut = desktop / "Cifras 2IPB Caratinga.desktop"
        launcher = self.root / "local_app_launcher.py"
        if not launcher.is_file():
            raise EditorError(500, "launcher_not_found", "O iniciador do aplicativo não foi encontrado.")
        python = self.root / "linux" / "venv" / "bin" / "python"
        if not python.is_file():
            python = Path(sys.executable)
        command = " ".join(shlex.quote(value) for value in (
            str(python), str(launcher), "--root", str(self.root), "--port", str(port)
        ))
        content = (
            "[Desktop Entry]\nType=Application\nVersion=1.0\n"
            "Name=Cifras 2IPB Caratinga\n"
            "Comment=Abrir o editor local de cifras\n"
            f"Exec={command}\nTerminal=false\nCategories=Utility;Music;\n"
        )
        try:
            shortcut.write_text(content, encoding="utf-8")
            shortcut.chmod(0o755)
        except OSError as exc:
            raise EditorError(500, "shortcut_failed", "Não foi possível criar o atalho na área de trabalho.") from exc
        # GNOME exige, além da permissão de execução, que lançadores criados
        # programaticamente sejam marcados como confiáveis. Outros ambientes
        # ignoram o atributo, portanto a tentativa pode falhar sem invalidar o
        # atalho recém-criado.
        try:
            subprocess.run(
                ["gio", "set", str(shortcut), "metadata::trusted", "true"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=5,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            pass
        return shortcut

    def _create_windows_shortcut(self, port: int) -> Path:
        launcher = self.root / "local_app_launcher.py"
        if not launcher.is_file():
            raise EditorError(500, "launcher_not_found", "O iniciador do aplicativo não foi encontrado.")

        python_executable = Path(sys.executable)
        pythonw = python_executable.with_name("pythonw.exe")
        if pythonw.is_file():
            python_executable = pythonw
        arguments = subprocess.list2cmdline([
            str(launcher), "--root", str(self.root), "--port", str(port)
        ])
        environment = os.environ.copy()
        environment.update({
            "CIFRAS_PYTHON": str(python_executable),
            "CIFRAS_ARGUMENTS": arguments,
            "CIFRAS_ROOT": str(self.root),
        })
        shortcut_script = self.root / "windows" / "criar_atalho.ps1"
        if not shortcut_script.is_file():
            raise EditorError(
                500, "launcher_not_found", "O criador de atalhos do Windows não foi encontrado."
            )
        try:
            result = subprocess.run(
                [
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(shortcut_script),
                ],
                env=environment,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=20,
                check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000),
            )
        except (OSError, subprocess.SubprocessError) as exc:
            raise EditorError(
                500, "shortcut_failed", "Não foi possível executar o criador de atalhos do Windows."
            ) from exc
        if result.returncode != 0:
            raise EditorError(
                500, "shortcut_failed", "O Windows não permitiu criar o atalho na Área de Trabalho."
            )
        output = result.stdout.strip().splitlines()
        if not output:
            raise EditorError(
                500, "shortcut_failed", "O Windows não informou onde o atalho foi criado."
            )
        return Path(output[-1])

    def _atomic_replace(
        self, target: Path, new_data: bytes, expected_revision: str
    ) -> None:
        temporary_path: Path | None = None
        try:
            original_mode = stat.S_IMODE(target.stat().st_mode)
            with tempfile.NamedTemporaryFile(
                mode="wb",
                dir=target.parent,
                prefix=f".{target.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                temporary_path = Path(temporary.name)
                temporary.write(new_data)
                temporary.flush()
                os.fsync(temporary.fileno())

            os.chmod(temporary_path, original_mode)

            # Uma segunda leitura reduz a janela entre a verificação otimista e
            # a troca atômica. A trava também serializa todas as gravações deste
            # processo.
            try:
                current_revision = _sha256(target.read_bytes())
            except OSError as exc:
                raise EditorError(
                    409,
                    "revision_conflict",
                    "O arquivo mudou durante a gravação; recarregue a página.",
                ) from exc
            if current_revision != expected_revision:
                raise EditorError(
                    409,
                    "revision_conflict",
                    "O arquivo foi alterado; recarregue antes de salvar novamente.",
                )

            os.replace(temporary_path, target)
            temporary_path = None

            if hasattr(os, "O_DIRECTORY"):
                try:
                    directory_fd = os.open(target.parent, os.O_RDONLY | os.O_DIRECTORY)
                    try:
                        os.fsync(directory_fd)
                    finally:
                        os.close(directory_fd)
                except OSError:
                    # A troca já ocorreu atomicamente. Alguns sistemas de
                    # arquivos não aceitam fsync no diretório.
                    pass
        except EditorError:
            raise
        except OSError as exc:
            raise EditorError(
                500, "write_failed", "Não foi possível gravar o arquivo HTML."
            ) from exc
        finally:
            if temporary_path is not None:
                try:
                    temporary_path.unlink(missing_ok=True)
                except OSError:
                    pass

    def save_document(
        self, requested_path: str, pre_text: str, expected_revision: str
    ) -> SaveResult:
        if not isinstance(pre_text, str):
            raise EditorError(400, "invalid_request", "O campo preText deve ser texto.")
        if not isinstance(expected_revision, str) or not REVISION_RE.fullmatch(
            expected_revision
        ):
            raise EditorError(
                400,
                "invalid_request",
                "O campo expectedRevision deve ser uma revisão SHA-256 válida.",
            )

        with self._write_lock:
            loaded = self._load(requested_path)
            expected_revision = expected_revision.lower()
            if loaded.revision != expected_revision:
                raise EditorError(
                    409,
                    "revision_conflict",
                    "O arquivo foi alterado; recarregue antes de salvar novamente.",
                )

            escaped_pre = html.escape(pre_text, quote=False)
            new_source = (
                loaded.source[: loaded.pre_start]
                + escaped_pre
                + loaded.source[loaded.pre_end :]
            )
            new_data = new_source.encode("utf-8")
            new_revision = _sha256(new_data)
            if new_revision != loaded.revision:
                self._atomic_replace(loaded.target, new_data, loaded.revision)
            return SaveResult(revision=new_revision)


def _is_windows() -> bool:
    return sys.platform == "win32"


def _desktop_directory() -> Path:
    home = Path.home()
    config = home / ".config" / "user-dirs.dirs"
    try:
        source = config.read_text(encoding="utf-8")
        match = re.search(r'^XDG_DESKTOP_DIR="([^"]+)"', source, re.MULTILINE)
        if match:
            candidate = Path(match.group(1).replace("$HOME", str(home))).expanduser()
            if candidate.is_absolute():
                return candidate
    except OSError:
        pass
    for name in ("Área de Trabalho", "Desktop"):
        candidate = home / name
        if candidate.is_dir():
            return candidate
    return home / "Desktop"


def _error_response(error: EditorError) -> ApiResponse:
    return ApiResponse(
        error.status,
        {
            "ok": False,
            "error": {"code": error.code, "message": error.message},
        },
    )


class EditorAPI:
    """Roteamento da API em uma forma testável sem abrir sockets."""

    def __init__(self, service: EditorService) -> None:
        self.service = service

    def get(self, request_target: str) -> ApiResponse | None:
        parsed = urlsplit(request_target)
        if parsed.path == HEALTH_ENDPOINT:
            if parsed.query:
                return _error_response(
                    EditorError(400, "invalid_request", "O endpoint health não aceita parâmetros.")
                )
            return ApiResponse(200, {"ok": True})

        if parsed.path == DOCUMENT_ENDPOINT:
            query = parse_qs(parsed.query, keep_blank_values=True)
            if set(query) != {"path"} or len(query["path"]) != 1:
                return _error_response(
                    EditorError(400, "invalid_request", "Informe um único parâmetro path.")
                )
            try:
                document = self.service.load_document(query["path"][0])
            except EditorError as error:
                return _error_response(error)
            return ApiResponse(
                200,
                {
                    "ok": True,
                    "path": document.path,
                    "preText": document.pre_text,
                    "revision": document.revision,
                },
            )

        if parsed.path == INDEXES_ENDPOINT:
            if parsed.query:
                return _error_response(EditorError(400, "invalid_request", "O endpoint indexes não aceita parâmetros."))
            return ApiResponse(200, {"ok": True, "indexes": self.service.list_indexes()})

        if parsed.path.startswith(API_PREFIX):
            return _error_response(
                EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado.")
            )
        return None

    def post(self, request_target: str, payload: Any, *, server_port: int = DEFAULT_PORT) -> ApiResponse:
        parsed = urlsplit(request_target)
        if parsed.query:
            return _error_response(
                EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado.")
            )
        if parsed.path == IMPORT_ENDPOINT:
            from extrator_cifraclub.extractor import import_cifra, ImportFailure
            if not isinstance(payload, dict) or not isinstance(payload.get("url"), str):
                return _error_response(EditorError(400, "invalid_request", "Informe o campo url."))
            try:
                result = import_cifra(payload["url"])
            except ImportFailure as error:
                return _error_response(EditorError(error.status, error.code, str(error)))
            return ApiResponse(200, {"ok": True, **result})
        if parsed.path == SHORTCUT_ENDPOINT:
            try:
                shortcut = self.service.create_desktop_shortcut(server_port)
            except EditorError as error:
                return _error_response(error)
            return ApiResponse(200, {"ok": True, "path": str(shortcut)})
        if parsed.path == SHUTDOWN_ENDPOINT:
            return ApiResponse(200, {"ok": True, "message": "Servidor encerrado."})
        operations = {
            EVENTS_ENDPOINT: "create_event",
            SONGS_ENDPOINT: "create_song",
            CAPOS_ENDPOINT: "add_capo",
        }
        if parsed.path in operations:
            try:
                result = self.service.manage(operations[parsed.path], payload)
            except EditorError as error:
                return _error_response(error)
            return ApiResponse(201, {"ok": True, **result})
        if parsed.path != SAVE_ENDPOINT:
            return _error_response(
                EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado.")
            )
        if not isinstance(payload, dict):
            return _error_response(
                EditorError(400, "invalid_request", "O corpo JSON deve ser um objeto.")
            )

        required = ("path", "preText", "expectedRevision")
        if any(field not in payload for field in required):
            return _error_response(
                EditorError(
                    400,
                    "invalid_request",
                    "Os campos path, preText e expectedRevision são obrigatórios.",
                )
            )
        try:
            result = self.service.save_document(
                payload["path"], payload["preText"], payload["expectedRevision"]
            )
        except EditorError as error:
            return _error_response(error)
        return ApiResponse(200, {"ok": True, "revision": result.revision})

    def delete(self, request_target: str, payload: Any) -> ApiResponse:
        parsed = urlsplit(request_target)
        operations = {
            EVENTS_ENDPOINT: "delete_event",
            SONGS_ENDPOINT: "delete_song",
            CAPOS_ENDPOINT: "delete_capo",
        }
        if parsed.query or parsed.path not in operations:
            return _error_response(EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado."))
        try:
            self.service.manage(operations[parsed.path], payload)
        except EditorError as error:
            return _error_response(error)
        return ApiResponse(200, {"ok": True})

    def put(self, request_target: str, payload: Any) -> ApiResponse:
        parsed = urlsplit(request_target)
        operations = {
            EVENTS_ENDPOINT: "update_event",
            SONGS_ENDPOINT: "update_song",
        }
        if parsed.query or parsed.path not in operations:
            return _error_response(EditorError(404, "endpoint_not_found", "Endpoint da API não encontrado."))
        try:
            result = self.service.manage(operations[parsed.path], payload)
        except EditorError as error:
            return _error_response(error)
        return ApiResponse(200, {"ok": True, **result})


def _allowed_host(
    host_header: str | None,
    *,
    bind_host: str = LOOPBACK_HOST,
    server_port: int = DEFAULT_PORT,
    lan_mode: bool = False,
) -> bool:
    if not host_header:
        return False
    try:
        parsed = urlsplit(f"//{host_header}")
        hostname = parsed.hostname
        port = parsed.port
    except ValueError:
        return False
    if lan_mode:
        return hostname == bind_host and port == server_port
    return hostname in {LOOPBACK_HOST, "localhost"}


def make_handler(
    root: str | os.PathLike[str],
    *,
    bind_host: str = LOOPBACK_HOST,
    allowed_network: ipaddress.IPv4Network | None = None,
    authenticator: LanAuthenticator | None = None,
) -> type[SimpleHTTPRequestHandler]:
    resolved_root = Path(root).resolve(strict=True)
    service = EditorService(resolved_root)
    api = EditorAPI(service)

    class ChordEditorRequestHandler(SimpleHTTPRequestHandler):
        server_version = "ChordEditor/1.0"
        sys_version = ""

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            super().__init__(*args, directory=str(resolved_root), **kwargs)

        def _send_api(self, response: ApiResponse, *, include_body: bool = True) -> None:
            encoded = json.dumps(
                response.body, ensure_ascii=False, separators=(",", ":")
            ).encode("utf-8")
            self.send_response(response.status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            if response.status == 401:
                self.send_header("Connection", "close")
                self.close_connection = True
            self.end_headers()
            if include_body:
                self.wfile.write(encoded)

        def _reject_nonlocal_host(self) -> bool:
            if not allowed_network:
                allowed = _allowed_host(self.headers.get("Host"))
            else:
                try:
                    client_ip = ipaddress.ip_address(self.client_address[0])
                    allowed = (
                        client_ip.version == 4
                        and client_ip in allowed_network
                        and _allowed_host(
                            self.headers.get("Host"),
                            bind_host=bind_host,
                            server_port=self.server.server_port,
                            lan_mode=True,
                        )
                    )
                except ValueError:
                    allowed = False
            if allowed:
                return False
            self._send_api(
                _error_response(
                    EditorError(
                        403,
                        "host_forbidden",
                        (
                            "Acesse pelo IP e pela porta anunciados pelo servidor."
                            if allowed_network
                            else "Abra o editor por http://127.0.0.1 para usar este servidor."
                        ),
                    )
                )
            )
            return True

        def _reject_private_static_path(self) -> bool:
            if not allowed_network:
                return False
            try:
                requested = Path(self.translate_path(urlsplit(self.path).path)).resolve()
                relative = requested.relative_to(resolved_root)
            except (OSError, ValueError, RuntimeError):
                self.send_error(404, "File not found")
                return True
            forbidden = {".git", ".github", "venv", ".venv", "node_modules", "__pycache__"}
            if any(part.startswith(".") or part in forbidden for part in relative.parts):
                self.send_error(404, "File not found")
                return True
            return False

        def list_directory(self, path: str):
            if allowed_network:
                self.send_error(403, "Directory listings are disabled on the LAN server")
                return None
            return super().list_directory(path)

        def _reject_cross_origin_write(self) -> bool:
            origin = self.headers.get("Origin")
            referer = self.headers.get("Referer")
            fetch_site = self.headers.get("Sec-Fetch-Site")
            if fetch_site == "cross-site":
                allowed = False
            elif origin:
                allowed = origin == f"http://{self.headers.get('Host', '')}"
            elif referer:
                try:
                    parsed_referer = urlsplit(referer)
                    allowed = (
                        parsed_referer.scheme == "http"
                        and parsed_referer.netloc == self.headers.get("Host")
                    )
                except ValueError:
                    allowed = False
            else:
                allowed = True
            if allowed:
                return False
            self._send_api(
                _error_response(
                    EditorError(403, "origin_forbidden", "A origem da requisição não é permitida.")
                )
            )
            return True

        def _require_write_authentication(self) -> bool:
            if not authenticator:
                return False
            if self._reject_cross_origin_write():
                return True
            encoded_password = self.headers.get("X-Editor-Password")
            try:
                password = (
                    base64.b64decode(encoded_password, validate=True).decode("utf-8")
                    if encoded_password is not None
                    else None
                )
            except (ValueError, UnicodeDecodeError):
                password = None
            if authenticator.verify(password):
                return False
            self._send_api(
                _error_response(
                    EditorError(401, "authentication_required", "Senha administrativa incorreta ou ausente.")
                )
            )
            return True

        def do_GET(self) -> None:
            if self._reject_nonlocal_host():
                return
            response = api.get(self.path)
            if response is None:
                if self._reject_private_static_path():
                    return
                super().do_GET()
                return
            if self.path == HEALTH_ENDPOINT and allowed_network:
                response = ApiResponse(200, {"ok": True, "mode": "lan", "adminAuth": True})
            self._send_api(response)

        def do_HEAD(self) -> None:
            if self._reject_nonlocal_host():
                return
            response = api.get(self.path)
            if response is None:
                if self._reject_private_static_path():
                    return
                super().do_HEAD()
                return
            if self.path == HEALTH_ENDPOINT and allowed_network:
                response = ApiResponse(200, {"ok": True, "mode": "lan", "adminAuth": True})
            self._send_api(response, include_body=False)

        def _read_json(self) -> Any:
            if self.headers.get("Transfer-Encoding"):
                raise EditorError(
                    400,
                    "invalid_request",
                    "Transfer-Encoding não é aceito neste endpoint.",
                )
            if self.headers.get_content_type() != "application/json":
                raise EditorError(
                    415,
                    "unsupported_media_type",
                    "Envie o corpo com Content-Type: application/json.",
                )

            raw_length = self.headers.get("Content-Length")
            try:
                content_length = int(raw_length) if raw_length is not None else -1
            except ValueError as exc:
                raise EditorError(
                    400, "invalid_request", "Content-Length inválido."
                ) from exc
            if content_length < 0:
                raise EditorError(
                    411, "length_required", "O cabeçalho Content-Length é obrigatório."
                )
            if content_length > MAX_REQUEST_BYTES:
                raise EditorError(
                    413,
                    "request_too_large",
                    "O conteúdo enviado ultrapassa o limite de 4 MiB.",
                )

            raw_body = self.rfile.read(content_length)
            if len(raw_body) != content_length:
                raise EditorError(400, "invalid_request", "O corpo da requisição está incompleto.")
            try:
                return json.loads(raw_body.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as exc:
                raise EditorError(400, "invalid_json", "O corpo não contém JSON UTF-8 válido.") from exc

        def do_POST(self) -> None:
            if self._reject_nonlocal_host():
                return
            if self._require_write_authentication():
                return
            parsed = urlsplit(self.path)
            if parsed.path not in {IMPORT_ENDPOINT, SAVE_ENDPOINT, SHORTCUT_ENDPOINT, SHUTDOWN_ENDPOINT, EVENTS_ENDPOINT, SONGS_ENDPOINT, CAPOS_ENDPOINT} or parsed.query:
                self._send_api(api.post(self.path, {}))
                return
            try:
                payload = self._read_json()
            except EditorError as error:
                self._send_api(_error_response(error))
                return
            response = api.post(self.path, payload, server_port=self.server.server_port)
            self._send_api(response)
            if parsed.path == SHUTDOWN_ENDPOINT and response.status == 200:
                threading.Thread(target=self.server.shutdown, daemon=True).start()

        def do_DELETE(self) -> None:
            if self._reject_nonlocal_host():
                return
            if self._require_write_authentication():
                return
            try:
                payload = self._read_json()
            except EditorError as error:
                self._send_api(_error_response(error))
                return
            self._send_api(api.delete(self.path, payload))

        def do_PUT(self) -> None:
            if self._reject_nonlocal_host():
                return
            if self._require_write_authentication():
                return
            try:
                payload = self._read_json()
            except EditorError as error:
                self._send_api(_error_response(error))
                return
            self._send_api(api.put(self.path, payload))

        def do_OPTIONS(self) -> None:
            # Não habilitar CORS impede páginas de outras origens de gravarem
            # arquivos por meio do servidor local.
            self._send_api(
                _error_response(
                    EditorError(405, "method_not_allowed", "Método HTTP não permitido.")
                )
            )

    return ChordEditorRequestHandler


def create_server(
    root: str | os.PathLike[str],
    port: int = DEFAULT_PORT,
    *,
    bind_host: str = LOOPBACK_HOST,
    allowed_network: ipaddress.IPv4Network | None = None,
    authenticator: LanAuthenticator | None = None,
) -> ThreadingHTTPServer:
    """Create a server bound to loopback by default or to an explicit LAN IP."""

    if not 0 <= port <= 65535:
        raise ValueError("A porta deve estar entre 0 e 65535.")
    if bind_host == LOOPBACK_HOST:
        if allowed_network is not None or authenticator is not None:
            raise ValueError("A autenticação e a sub-rede são exclusivas do modo LAN.")
    else:
        try:
            parsed_bind = ipaddress.ip_address(bind_host)
        except ValueError as error:
            raise ValueError("O modo LAN deve usar um endereço IPv4 privado explícito.") from error
        private_ranges = (
            ipaddress.ip_network("10.0.0.0/8"),
            ipaddress.ip_network("172.16.0.0/12"),
            ipaddress.ip_network("192.168.0.0/16"),
        )
        if (
            parsed_bind.version != 4
            or not any(parsed_bind in network for network in private_ranges)
            or allowed_network is None
            or parsed_bind not in allowed_network
            or authenticator is None
        ):
            raise ValueError("O modo LAN exige endereço privado, sub-rede correspondente e autenticação.")
    server = ThreadingHTTPServer(
        (bind_host, port),
        make_handler(
            root,
            bind_host=bind_host,
            allowed_network=allowed_network,
            authenticator=authenticator,
        ),
    )
    server.daemon_threads = True
    return server


def _cli_port(value: str) -> int:
    try:
        port = int(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("a porta precisa ser um número") from exc
    if not 1 <= port <= 65535:
        raise argparse.ArgumentTypeError("a porta precisa estar entre 1 e 65535")
    return port


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve e salva cifras HTML localmente.")
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parent,
        help="diretório raiz servido (padrão: diretório deste script)",
    )
    parser.add_argument(
        "--port",
        type=_cli_port,
        default=DEFAULT_PORT,
        help=f"porta HTTP local (padrão: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--lan",
        action="store_true",
        help="expõe o servidor somente no IPv4 privado da rota ativa e exige senha",
    )
    parser.add_argument(
        "--auth-file",
        type=Path,
        help="arquivo privado de autenticação do modo LAN (padrão: ~/.config/cifras-2ipb/server-auth.json)",
    )
    args = parser.parse_args(argv)
    repository_root = args.root.expanduser().resolve()
    bind_host = LOOPBACK_HOST
    allowed_network = None
    authenticator = None
    if args.lan:
        try:
            bind_host, allowed_network = _lan_ipv4_network()
            auth_path = (
                args.auth_file.expanduser()
                if args.auth_file
                else Path.home() / ".config" / "cifras-2ipb" / "server-auth.json"
            )
            if auth_path.resolve().is_relative_to(repository_root):
                raise ValueError("O arquivo de autenticação precisa ficar fora da cópia do projeto.")
            authenticator = LanAuthenticator.load_or_create(auth_path)
        except (OSError, ValueError) as exc:
            print(f"Não foi possível preparar o modo LAN: {exc}", file=sys.stderr)
            return 1

    try:
        if args.lan:
            server = create_server(
                repository_root,
                args.port,
                bind_host=bind_host,
                allowed_network=allowed_network,
                authenticator=authenticator,
            )
        else:
            server = create_server(repository_root, args.port)
    except OSError as exc:
        print(
            f"Não foi possível iniciar o servidor em {bind_host}:{args.port}: {exc}",
            file=sys.stderr,
        )
        return 1

    if args.lan:
        print(f"Editor disponível na rede local em http://{bind_host}:{args.port}/configuracoes.html")
        print(f"Exemplo de repertório: http://{bind_host}:{args.port}/2026_08_02/")
        print("A leitura está aberta à sub-rede local; alterações exigem senha.")
        print("HTTP não cifra o tráfego. Use somente uma rede Wi-Fi confiável.")
    else:
        print(f"Editor local disponível em http://{LOOPBACK_HOST}:{args.port}/configuracoes.html")
        print(f"Exemplo de repertório: http://{LOOPBACK_HOST}:{args.port}/2026_08_02/")
    print("Pressione Ctrl+C para encerrar.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor encerrado.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
