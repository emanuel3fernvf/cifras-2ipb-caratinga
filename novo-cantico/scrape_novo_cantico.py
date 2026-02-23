#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Baixa todos os hinos do Novo Cântico (https://novocantico.com.br/indice/assunto/),
extrai o primeiro .panel.panel-default de cada página, trata coro/estrofe e gera
um único JSON compatível com o formato do Holyrics (ex.: 2026-02-09_23-08-55.json).

Regras:
- Hinos com .coro.list-unstyled: coro extraído da primeira estrofe e repetido após cada estrofe.
- Antes da última estrofe (não do coro) insere parágrafo com '🎶🎵🎶🎵🎶🎵🎶'.
- artist = 'Hinário Novo Cântico' para todos.
"""

import json
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://novocantico.com.br"
INDEX_URL = "https://novocantico.com.br/indice/assunto/"
SOLO_STANZA = "🎶🎵🎶🎵🎶🎵🎶"
ARTIST = "Hinário Novo Cântico"
OUTPUT_DIR = Path(__file__).resolve().parent
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}


def get_index_links(session):
    """Obtém lista de (número, título, url) a partir do índice por assunto."""
    r = session.get(INDEX_URL, headers=HEADERS, timeout=30)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    soup = BeautifulSoup(r.text, "lxml")
    links = []
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if "/hino/" not in href:
            continue
        full_url = urljoin(INDEX_URL, href)
        # Preferir página HTML do hino (mesmo path sem .xml) para obter .panel.panel-default
        if full_url.endswith(".xml"):
            html_url = full_url[:-4]
            full_url = html_url
        text = (a.get_text() or "").strip()
        # Título no formato "001 · Doxologia" ou "110-A · Crer e Observar"
        match = re.match(r"^(\d+(?:-\w+)?)\s*[·\.]\s*(.+)$", text)
        if match:
            num, title = match.groups()
            links.append((num, title.strip(), full_url))
        elif text:
            links.append((href.split("/")[-2] if "/" in href else "?", text, full_url))
    # Remover duplicatas por URL mantendo ordem
    seen = set()
    unique = []
    for num, title, url in links:
        if url not in seen:
            seen.add(url)
            unique.append((num, title, url))
    return unique


def normalize_verse_text(s):
    if not s:
        return ""
    return "\n".join(line.strip() for line in s.splitlines() if line.strip()).strip()


def extract_from_html(html, hymn_url):
    """
    Extrai estrofes e coro do primeiro .panel.panel-default.
    Se existir .coro.list-unstyled, ele é extraído de dentro da primeira estrofe
    e será repetido após cada estrofe.
    Retorno: (lista de textos de estrofes, texto do coro ou None)
    """
    soup = BeautifulSoup(html, "lxml")
    panels = soup.select(".panel.panel-default")
    if not panels:
        return [], None
    first = panels[0]
    coro_el = first.select_one(".coro.list-unstyled")
    coro_text = None
    if coro_el:
        coro_text = normalize_verse_text(coro_el.get_text())
        coro_el.decompose()
    # Estrofes: comum usar .estrofe ou blocos de versos dentro do panel
    stanzas = []
    for block in first.select(".estrofe"):
        t = normalize_verse_text(block.get_text())
        if t:
            stanzas.append(t)
    if not stanzas:
        # Fallback: pegar blocos por parágrafos ou divs que pareçam estrofe
        for div in first.find_all(["div", "p"], class_=lambda c: c and "estrofe" in " ".join(c)):
            t = normalize_verse_text(div.get_text())
            if t and t != coro_text:
                stanzas.append(t)
    if not stanzas:
        # Último recurso: todo o texto do primeiro panel, dividido por dupla quebra
        raw = normalize_verse_text(first.get_text())
        if raw:
            for part in re.split(r"\n\s*\n", raw):
                part = part.strip()
                if part and part != coro_text:
                    stanzas.append(part)
    return stanzas, coro_text


def _local_tag(tag):
    """Remove namespace do nome da tag."""
    if tag and "}" in tag:
        return tag.split("}")[-1]
    return tag


def extract_from_xml(html, hymn_url):
    """
    Extrai estrofes e coro de XML (formato comum: estrofe, coro, verso).
    Retorno: (lista de textos de estrofes, texto do coro ou None)
    """
    try:
        import xml.etree.ElementTree as ET
    except ImportError:
        return [], None
    try:
        root = ET.fromstring(html)
    except ET.ParseError:
        return [], None
    stanzas = []
    coro_text = None
    for el in root.iter():
        if _local_tag(el.tag) == "coro":
            t = "".join(el.itertext()).strip()
            if t and not coro_text:
                coro_text = normalize_verse_text(t)
            break
    for el in root.iter():
        if _local_tag(el.tag) == "estrofe":
            lines = []
            for child in el:
                if _local_tag(child.tag) == "coro":
                    continue
                if _local_tag(child.tag) in ("verso", "v") and (child.text or list(child)):
                    lines.append("".join(child.itertext()).strip())
            if not lines:
                lines = [t.strip() for t in el.itertext() if t.strip()]
            if lines:
                stanzas.append("\n".join(lines))
    return stanzas, coro_text


def build_paragraphs(stanzas, has_coro, coro_text):
    """
    Constrói lista de textos de parágrafos:
    - Se tem coro: para cada estrofe, [estrofe, coro]; antes da última estrofe insere SOLO.
    - Se não tem coro: cada estrofe é um parágrafo; antes da última insere SOLO.
    - O coro não conta como última estrofe; a última é a última estrofe.
    """
    if not stanzas:
        return []
    paragraphs = []
    n = len(stanzas)
    for i, st in enumerate(stanzas):
        # Inserir solo antes da última estrofe (após a penúltima e seu coro)
        if i == n - 1 and n > 1:
            paragraphs.append(SOLO_STANZA)
        paragraphs.append(st)
        if has_coro and coro_text:
            paragraphs.append(coro_text)
    return paragraphs


def hymn_to_json_item(hymn_id, number, title, paragraphs):
    """Monta um item no formato do JSON de exemplo."""
    full_text = "\n\n".join(paragraphs) if paragraphs else ""
    return {
        "id": hymn_id,
        "title": f"{number} - {title}" if number else title,
        "artist": ARTIST,
        "author": "",
        "note": "",
        "copyright": "",
        "language": "",
        "key": "",
        "bpm": 0.0,
        "time_sig": "",
        "midi": None,
        "order": "",
        "arrangements": [],
        "lyrics": {
            "full_text": full_text,
            "full_text_with_comment": None,
            "paragraphs": [
                {
                    "number": i + 1,
                    "description": "",
                    "text": p,
                    "text_with_comment": None,
                    "translations": None,
                }
                for i, p in enumerate(paragraphs)
            ],
        },
        "streaming": {
            "audio": {"spotify": "", "youtube": "", "deezer": ""},
            "backing_track": {"spotify": "", "youtube": "", "deezer": ""},
        },
        "extras": {"extra": ""},
    }


def fetch_hymn(session, url):
    """Baixa a página do hino (HTML ou XML)."""
    r = session.get(url, headers=HEADERS, timeout=15)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def main():
    from datetime import datetime

    session = requests.Session()
    print("Obtendo índice em", INDEX_URL)
    links = get_index_links(session)
    print(f"Encontrados {len(links)} links de hinos.")

    output_name = datetime.now().strftime("%Y-%m-%d_%H-%M-%S") + ".json"
    output_path = OUTPUT_DIR / output_name
    result = []
    failed = []

    for idx, (num, title, url) in enumerate(links, 1):
        try:
            html = fetch_hymn(session, url)
        except Exception as e:
            # Tentar URL .xml se a página HTML não existir
            xml_url = url + ".xml" if not url.endswith(".xml") else url
            if xml_url != url:
                try:
                    html = fetch_hymn(session, xml_url)
                except Exception as e2:
                    failed.append((num, title, url, str(e)))
                    continue
            else:
                failed.append((num, title, url, str(e)))
                continue
        stanzas, coro_text = extract_from_html(html, url)
        if not stanzas and ("<?xml" in html or html.strip().startswith("<")):
            stanzas, coro_text = extract_from_xml(html, url)
        has_coro = bool(coro_text)
        paragraphs = build_paragraphs(stanzas, has_coro, coro_text)
        hymn_id = int(time.time() * 1000) + idx
        result.append(hymn_to_json_item(hymn_id, num, title, paragraphs))
        if idx % 50 == 0:
            print(f"Processados {idx}/{len(links)}")
        time.sleep(0.3)
    if failed:
        print(f"Falhas: {len(failed)}")
        for num, title, url, err in failed[:10]:
            print(f"  {num} {title}: {err}")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"Salvo: {output_path} ({len(result)} hinos).")
    return output_path


if __name__ == "__main__":
    main()
