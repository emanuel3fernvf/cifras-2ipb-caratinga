#!/usr/bin/env python3
"""Gera o catálogo estático usado pelo GitHub Pages."""

from __future__ import annotations

import argparse
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "catalogo.json"
IGNORED_DIRECTORIES = {"_referencia_evento", "_lixeira"}


class IndexParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self.heading = ""
        self.links: list[dict[str, str]] = []
        self._capture: str | None = None
        self._href: str | None = None
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        if tag in {"title", "h1"} and not (self.title if tag == "title" else self.heading):
            self._capture = tag
            self._parts = []
        elif tag == "a" and attributes.get("href"):
            self._capture = "a"
            self._href = attributes["href"]
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._capture != tag:
            return
        text = " ".join("".join(self._parts).split())
        if tag == "title":
            self.title = text
        elif tag == "h1":
            self.heading = text
        elif self._href:
            path = unquote(urlsplit(self._href).path)
            if path.lower().endswith(".html") and Path(path).name != "index.html":
                self.links.append({"title": text or Path(path).stem, "path": path})
        self._capture = None
        self._href = None
        self._parts = []


def build_catalog(root: Path = ROOT) -> dict[str, object]:
    folders: list[dict[str, object]] = []
    indexes = sorted(
        (path for path in root.glob("*/index.html") if path.parent.name not in IGNORED_DIRECTORIES),
        key=lambda path: path.parent.name.casefold(), reverse=True
    )
    for index in indexes:
        parser = IndexParser()
        parser.feed(index.read_text(encoding="utf-8"))
        parser.close()
        directory = index.parent
        all_songs = {page.name: page for page in directory.glob("*.html") if page.name != "index.html"}
        songs: list[dict[str, str]] = []
        seen: set[str] = set()
        for item in parser.links:
            filename = Path(item["path"]).name
            if filename in all_songs and filename not in seen:
                songs.append({"title": item["title"], "path": f"{directory.name}/{filename}"})
                seen.add(filename)
        for filename in sorted(set(all_songs) - seen, key=str.casefold):
            songs.append({"title": Path(filename).stem, "path": f"{directory.name}/{filename}"})
        folders.append({
            "name": parser.heading or parser.title or directory.name,
            "directory": directory.name,
            "index": f"{directory.name}/index.html",
            "songs": songs,
        })
    return {"folders": folders}


def serialized_catalog() -> str:
    return json.dumps(build_catalog(), ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="falha se catalogo.json estiver desatualizado")
    args = parser.parse_args()
    expected = serialized_catalog()
    if args.check:
        try:
            current = OUTPUT.read_text(encoding="utf-8")
        except OSError:
            current = ""
        if current != expected:
            print("catalogo.json está desatualizado; execute: python3 gerar_catalogo.py")
            return 1
        print("catalogo.json está atualizado.")
        return 0
    OUTPUT.write_text(expected, encoding="utf-8")
    print(f"Catálogo gerado em {OUTPUT.name}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
