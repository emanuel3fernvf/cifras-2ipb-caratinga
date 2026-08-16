"""Operações de gerenciamento disponíveis somente no servidor local."""

from __future__ import annotations

import html
import json
import os
import re
import shutil
import tempfile
import unicodedata
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote


HIDDEN_FOLDERS = {"_referencia_evento", "_lixeira"}
WINDOWS_RESERVED = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
INVALID_FILENAME = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


class ManagerError(Exception):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


class _MetadataParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.artist = ""
        self.heading = ""
        self._capture = ""
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        classes = set((dict(attrs).get("class") or "").split())
        kind = ""
        if "holyrics-title" in classes: kind = "song-title"
        elif "holyrics-artist" in classes: kind = "artist"
        elif tag == "h1" and not self.heading: kind = "heading"
        elif tag == "title" and not self.title: kind = "title"
        if kind:
            self._capture, self._parts = kind, []

    def handle_data(self, data: str) -> None:
        if self._capture: self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        expected = {"song-title": "span", "artist": "span", "heading": "h1", "title": "title"}.get(self._capture)
        if tag != expected: return
        value = " ".join("".join(self._parts).split())
        if self._capture == "artist": self.artist = value
        elif self._capture == "heading": self.heading = value
        else: self.title = value
        self._capture, self._parts = "", []


def _read_metadata(path: Path) -> tuple[str, str]:
    parser = _MetadataParser()
    try: parser.feed(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError): return path.stem, ""
    return parser.title or path.stem, parser.artist


def _safe_folder(root: Path, folder: object) -> Path:
    if not isinstance(folder, str) or not folder or "/" in folder or "\\" in folder or folder in HIDDEN_FOLDERS:
        raise ManagerError(403, "path_forbidden", "A pasta informada não é permitida.")
    target = root / folder
    try:
        resolved = target.resolve(strict=True)
        resolved.relative_to(root)
    except FileNotFoundError as exc: raise ManagerError(404, "event_not_found", "O evento não foi encontrado.") from exc
    except (OSError, ValueError, RuntimeError) as exc: raise ManagerError(403, "path_forbidden", "A pasta informada não é permitida.") from exc
    if not resolved.is_dir() or not (resolved / "index.html").is_file():
        raise ManagerError(404, "event_not_found", "O evento não foi encontrado.")
    return resolved


def _safe_text(value: object, field: str, maximum: int) -> str:
    if not isinstance(value, str): raise ManagerError(400, "invalid_request", f"O campo {field} é obrigatório.")
    value = " ".join(value.strip().split())
    if not value or len(value) > maximum: raise ManagerError(422, "invalid_name", f"{field.capitalize()} deve ter entre 1 e {maximum} caracteres.")
    if INVALID_FILENAME.search(value) or value.endswith((".", " ")) or value.upper() in WINDOWS_RESERVED:
        raise ManagerError(422, "invalid_name", f"{field.capitalize()} contém caracteres incompatíveis.")
    return value


def slugify(value: str) -> str:
    plain = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", plain)).strip("-")


def _atomic_text(path: Path, content: str) -> None:
    fd, temporary = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as stream:
            stream.write(content); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        try: os.unlink(temporary)
        except FileNotFoundError: pass


def update_catalog(root: Path) -> None:
    from gerar_catalogo import build_catalog
    content = json.dumps(build_catalog(root), ensure_ascii=False, indent=2) + "\n"
    _atomic_text(root / "catalogo.json", content)


def list_events(root: Path) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for index in root.glob("*/index.html"):
        if index.parent.name in HIDDEN_FOLDERS: continue
        heading, _ = _read_metadata(index)
        source = index.read_text(encoding="utf-8")
        songs = []
        for page in sorted(index.parent.glob("*.html"), key=lambda p: p.name.casefold()):
            if page.name == "index.html": continue
            title, artist = _read_metadata(page)
            encoded = quote(page.name)
            frets = sorted({int(n) for n in re.findall(re.escape(encoded) + r"\?tr=-(\d+)", source) if 1 <= int(n) <= 11})
            songs.append({"title": title, "artist": artist, "path": f"{index.parent.name}/{page.name}", "filename": page.name, "capos": frets})
        events.append({"name": index.parent.name, "title": heading or index.parent.name, "path": f"{index.parent.name}/index.html", "songs": songs})
    return sorted(events, key=lambda item: str(item["name"]).casefold(), reverse=True)


def create_event(root: Path, payload: dict[str, object]) -> dict[str, object]:
    mode = payload.get("mode")
    if mode == "name":
        title = _safe_text(payload.get("name"), "nome", 30); folder = slugify(title)
        if not folder: raise ManagerError(422, "invalid_name", "O nome não forma uma pasta válida.")
        subtitle = title
    elif mode == "date":
        raw = payload.get("date")
        if not isinstance(raw, str): raise ManagerError(400, "invalid_request", "A data é obrigatória.")
        try: date = datetime.strptime(raw, "%Y-%m-%d")
        except ValueError as exc: raise ManagerError(422, "invalid_date", "Informe uma data válida.") from exc
        folder, subtitle, title = date.strftime("%Y_%m_%d"), date.strftime("%d/%m/%Y"), "Evento"
    else: raise ManagerError(400, "invalid_request", "O modo deve ser name ou date.")
    target, reference = root / folder, root / "_referencia_evento"
    if target.exists(): raise ManagerError(409, "event_exists", "Já existe um evento com essa pasta.")
    if not reference.is_dir(): raise ManagerError(500, "reference_missing", "A pasta de referência não foi encontrada.")
    temporary = Path(tempfile.mkdtemp(prefix=".novo-evento-", dir=root))
    try:
        for name in ("index.html", "index.css", "index.js"):
            source = (reference / name).read_text(encoding="utf-8").replace("{{EVENT_TITLE}}", html.escape(title)).replace("{{EVENT_SUBTITLE}}", html.escape(subtitle))
            (temporary / name).write_text(source, encoding="utf-8")
        os.replace(temporary, target)
        try: update_catalog(root)
        except Exception:
            shutil.rmtree(target); raise
    except ManagerError: raise
    except Exception as exc:
        shutil.rmtree(temporary, ignore_errors=True)
        raise ManagerError(500, "create_failed", "Não foi possível criar o evento.") from exc
    return {"name": folder, "path": f"{folder}/index.html"}


def _song_target(root: Path, folder: object, filename: object) -> tuple[Path, Path]:
    event = _safe_folder(root, folder)
    if not isinstance(filename, str) or Path(filename).name != filename or not filename.lower().endswith(".html") or filename == "index.html":
        raise ManagerError(403, "path_forbidden", "A cifra informada não é permitida.")
    song = event / filename
    try: resolved = song.resolve(strict=True); resolved.relative_to(event)
    except FileNotFoundError as exc: raise ManagerError(404, "song_not_found", "A cifra não foi encontrada.") from exc
    except (OSError, ValueError) as exc: raise ManagerError(403, "path_forbidden", "A cifra informada não é permitida.") from exc
    return event, resolved


def _managed_link(filename: str, label: str) -> str:
    return f'\n<div class="managed-song-row" data-song="{html.escape(filename, quote=True)}"><a href="{quote(filename)}">{html.escape(label)}</a></div>\n'


def create_song(root: Path, payload: dict[str, object]) -> dict[str, object]:
    event = _safe_folder(root, payload.get("folder"))
    title = _safe_text(payload.get("title"), "título", 100); artist = _safe_text(payload.get("artist"), "artista", 100)
    filename = f"{title} - {artist}.html"; target = event / filename
    if target.exists(): raise ManagerError(409, "song_exists", "Essa cifra já existe no evento.")
    template = root / "_referencia_evento" / "cifra.html.template"
    try:
        song_source = template.read_text(encoding="utf-8").replace("{{SONG_TITLE}}", html.escape(title)).replace("{{SONG_ARTIST}}", html.escape(artist))
        index = event / "index.html"; original_index = index.read_text(encoding="utf-8"); old_index = original_index
        marker = "<!-- MANAGED_SONGS -->"
        if marker not in old_index:
            closing = old_index.lower().rfind("</body>")
            if closing < 0:
                raise ManagerError(422, "invalid_index", "O índice não possui uma área segura para novas cifras.")
            managed_area = (
                '\n<style id="managed-songs-style">.managed-song-row{display:flex;gap:8px;margin:10px auto;max-width:460px}'
                '.managed-song-row a{display:flex;flex:1;align-items:center;justify-content:center;padding:10px 14px;'
                'border-radius:10px;background:#0068ff;color:#fff;font-weight:bold;text-align:center;text-decoration:none}'
                '.managed-song-row a.capo-btn{flex:0 0 auto;background:#ff7700}</style>\n'
                '<div id="managed-songs">' + marker + '</div>\n'
            )
            old_index = old_index[:closing] + managed_area + old_index[closing:]
        new_index = old_index.replace(marker, _managed_link(filename, f"{title} — {artist}") + marker, 1)
        target.write_text(song_source, encoding="utf-8")
        try:
            _atomic_text(index, new_index); update_catalog(root)
        except Exception:
            target.unlink(missing_ok=True); _atomic_text(index, original_index); raise
    except ManagerError: raise
    except Exception as exc: raise ManagerError(500, "create_failed", "Não foi possível criar a cifra.") from exc
    return {"path": f"{event.name}/{filename}", "filename": filename}


def _first_song_anchor(source: str, filename: str) -> re.Match[str] | None:
    encoded, raw = re.escape(quote(filename)), re.escape(filename)
    return re.search(r'<a\b[^>]*href=["\'](?:' + encoded + '|' + raw + r')["\'][^>]*>.*?</a>', source, re.I | re.S)


def add_capo(root: Path, payload: dict[str, object]) -> dict[str, object]:
    event, song = _song_target(root, payload.get("folder"), payload.get("filename"))
    fret = payload.get("fret")
    if not isinstance(fret, int) or isinstance(fret, bool) or not 1 <= fret <= 11: raise ManagerError(422, "invalid_fret", "A casa deve estar entre 1 e 11.")
    index = event / "index.html"; source = index.read_text(encoding="utf-8"); encoded = quote(song.name)
    if re.search(re.escape(encoded) + rf"\?tr=-{fret}(?:[\"'])", source): raise ManagerError(409, "capo_exists", "Esse link de capotraste já existe.")
    match = _first_song_anchor(source, song.name)
    if not match: raise ManagerError(422, "song_link_missing", "A música não possui link no índice.")
    capo = f'<a class="capo-btn" data-capo-song="{html.escape(song.name, quote=True)}" data-capo-fret="{fret}" href="{encoded}?tr=-{fret}">Capo na {fret}ª</a>'
    replacement = match.group(0) + capo
    _atomic_text(index, source[:match.start()] + replacement + source[match.end():])
    return {"fret": fret, "href": f"{encoded}?tr=-{fret}"}


def delete_capo(root: Path, payload: dict[str, object]) -> None:
    event, song = _song_target(root, payload.get("folder"), payload.get("filename")); fret = payload.get("fret")
    if not isinstance(fret, int) or not 1 <= fret <= 11: raise ManagerError(422, "invalid_fret", "A casa deve estar entre 1 e 11.")
    index = event / "index.html"; source = index.read_text(encoding="utf-8")
    encoded = re.escape(quote(song.name))
    pattern = re.compile(
        r'<a\b(?=[^>]*(?:data-capo-fret=["\']' + str(fret) + r'["\']|href=["\']' + encoded
        + r'\?tr=-' + str(fret) + r'["\']))[^>]*>.*?</a>', re.I | re.S
    )
    updated, count = pattern.subn("", source, count=1)
    if not count: raise ManagerError(404, "capo_not_found", "O link de capotraste não foi encontrado.")
    _atomic_text(index, updated)


def _trash_destination(root: Path, relative: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
    target = root / "_lixeira" / stamp / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def delete_song(root: Path, payload: dict[str, object]) -> None:
    event, song = _song_target(root, payload.get("folder"), payload.get("filename")); index = event / "index.html"
    source = index.read_text(encoding="utf-8"); encoded, raw = re.escape(quote(song.name)), re.escape(song.name)
    pattern = re.compile(r'<a\b[^>]*href=["\'](?:' + encoded + '|' + raw + r')(?:\?tr=-\d+)?["\'][^>]*>.*?</a>', re.I | re.S)
    updated = pattern.sub("", source)
    updated = re.sub(r'<div class="managed-song-row"[^>]*>\s*</div>', "", updated)
    destination = _trash_destination(root, Path(event.name) / song.name)
    shutil.move(str(song), destination)
    try: _atomic_text(index, updated); update_catalog(root)
    except Exception:
        shutil.move(str(destination), song); _atomic_text(index, source); raise ManagerError(500, "delete_failed", "Não foi possível excluir a cifra.")


def delete_event(root: Path, payload: dict[str, object]) -> None:
    event = _safe_folder(root, payload.get("folder")); destination = _trash_destination(root, Path(event.name))
    shutil.move(str(event), destination)
    try: update_catalog(root)
    except Exception:
        shutil.move(str(destination), event); raise ManagerError(500, "delete_failed", "Não foi possível excluir o evento.")
