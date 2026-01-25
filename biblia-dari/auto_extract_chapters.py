#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script automatizado para extrair todos os capítulos da Bíblia em Dari
Usa as ferramentas do browser para navegar e extrair o elemento #scripture
"""

import json
import time
from pathlib import Path

CHAPTERS_DIR = Path("dari-bible-chapters")
CHAPTERS_DIR.mkdir(exist_ok=True)

PROGRESS_FILE = Path("extraction_progress.json")

def load_progress():
    """Carrega o progresso da extração"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "processed_urls": [],
        "last_url": None,
        "total_chapters": 0
    }

def save_progress(progress):
    """Salva o progresso da extração"""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)

def get_filename_from_url(url):
    """Extrai o nome do arquivo da URL"""
    parts = url.rstrip('/').split('/')
    return f"{parts[-1]}.html" if parts else "chapter.html"

# Este script será executado passo a passo usando as ferramentas do browser
# Por enquanto, vamos preparar a estrutura

print("Script de extração preparado.")
print("Execute este script passo a passo usando as ferramentas do browser.")
print(f"Capítulos serão salvos em: {CHAPTERS_DIR}")

