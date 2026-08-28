#!/usr/bin/env python3
"""Inicia o servidor local quando necessário e abre suas configurações."""

from __future__ import annotations

import argparse
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path


def is_running(url: str) -> bool:
    try:
        with urllib.request.urlopen(url + "/__chord_editor__/health", timeout=0.5) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def available_port(preferred_port: int, attempts: int = 100) -> int | None:
    """Retorna a primeira porta livre a partir da porta configurada."""
    last_port = min(65535, preferred_port + attempts - 1)
    for port in range(preferred_port, last_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
                probe.bind(("127.0.0.1", port))
        except OSError:
            continue
        return port
    return None


def background_process_options() -> dict[str, object]:
    """Opções para manter o servidor vivo sem uma janela de console."""
    if sys.platform == "win32":
        creation_flags = (
            getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0x00000200)
            | getattr(subprocess, "DETACHED_PROCESS", 0x00000008)
            | getattr(subprocess, "CREATE_NO_WINDOW", 0x08000000)
        )
        return {"creationflags": creation_flags, "close_fds": True}
    return {"start_new_session": True}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--port", required=True, type=int)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    url = f"http://127.0.0.1:{args.port}"

    if not is_running(url):
        port = available_port(args.port)
        if port is None:
            return 1
        url = f"http://127.0.0.1:{port}"
        log_path = Path(tempfile.gettempdir()) / "cifras-2ipb-servidor.log"
        with log_path.open("ab") as log:
            subprocess.Popen(
                [sys.executable, str(root / "local_editor_server.py"), "--root", str(root), "--port", str(port)],
                cwd=root,
                stdin=subprocess.DEVNULL,
                stdout=log,
                stderr=subprocess.STDOUT,
                **background_process_options(),
            )
        for _ in range(30):
            if is_running(url):
                break
            time.sleep(0.1)
        else:
            return 1

    webbrowser.open(url + "/configuracoes.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
