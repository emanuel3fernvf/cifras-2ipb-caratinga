#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script automatizado para extrair TODOS os capítulos da Bíblia em Dari
Navega automaticamente pelas páginas, extrai o elemento #scripture e salva
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
        "total_chapters": 0,
        "failed_urls": []
    }

def save_progress(progress):
    """Salva o progresso da extração"""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)

def get_filename_from_url(url):
    """Extrai o nome do arquivo da URL"""
    parts = url.rstrip('/').split('/')
    return f"{parts[-1]}.html" if parts else "chapter.html"

# Este script será executado usando as ferramentas do browser
# Por enquanto, vamos preparar a estrutura

print("=" * 60)
print("EXTRAÇÃO AUTOMÁTICA DA BÍBLIA EM DARI")
print("=" * 60)
print("\nEste script irá:")
print("1. Navegar para cada capítulo")
print("2. Extrair o elemento #scripture")
print("3. Salvar o HTML em dari-bible-chapters/")
print("4. Encontrar o link #nextchaptertop")
print("5. Repetir até o final")
print("\nO progresso será salvo em extraction_progress.json")
print("=" * 60)

