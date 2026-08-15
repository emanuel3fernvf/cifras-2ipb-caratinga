#!/usr/bin/env python3
"""Inicia o servidor local quando necessário e abre suas configurações."""

from __future__ import annotations

import argparse
import subprocess
import sys
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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", required=True, type=Path)
    parser.add_argument("--port", required=True, type=int)
    args = parser.parse_args()
    root = args.root.resolve()
    url = f"http://127.0.0.1:{args.port}"

    if not is_running(url):
        log = Path("/tmp/cifras-2ipb-servidor.log").open("ab")
        subprocess.Popen(
            [sys.executable, str(root / "local_editor_server.py"), "--root", str(root), "--port", str(args.port)],
            cwd=root, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT,
            start_new_session=True,
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
