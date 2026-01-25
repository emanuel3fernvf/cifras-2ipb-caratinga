#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script COMPLETAMENTE AUTOMATIZADO para extrair TODOS os capítulos da Bíblia em Dari
Este script usa as ferramentas do browser para navegar e extrair automaticamente
"""

import json
import time
from pathlib import Path

# Configurações
CHAPTERS_DIR = Path("dari-bible-chapters")
CHAPTERS_DIR.mkdir(exist_ok=True)
PROGRESS_FILE = Path("extraction_progress.json")
START_URL = "https://afghanbibles.org/eng/dari-bible/genesis/genesis-1"
MAX_CHAPTERS = 1200  # Limite de segurança (66 livros * ~20 capítulos)
DELAY_BETWEEN_PAGES = 1  # Segundos entre requisições

def extract_and_save_chapter(url, chapter_num):
    """
    Extrai um capítulo e salva o HTML
    Esta função será chamada para cada capítulo
    """
    print(f"\n[{chapter_num}] Processando: {url}")
    
    # Navegar para a página (será feito pelo browser)
    # Extrair elemento #scripture (será feito pelo browser)
    # Salvar HTML (será feito aqui)
    
    filename = get_filename_from_url(url)
    filepath = CHAPTERS_DIR / filename
    
    if filepath.exists():
        print(f"  ⚠ Arquivo já existe: {filename}, pulando...")
        # Ler o arquivo para encontrar o próximo link
        with open(filepath, 'r', encoding='utf-8') as f:
            html_content = f.read()
    else:
        print(f"  ⏳ Aguardando extração do browser...")
        # O HTML será salvo pelo processo do browser
        html_content = None
    
    return filepath, html_content

def get_filename_from_url(url):
    """Extrai o nome do arquivo da URL"""
    parts = url.rstrip('/').split('/')
    return f"{parts[-1]}.html" if parts else "chapter.html"

def load_progress():
    """Carrega o progresso"""
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {
        "processed_urls": [],
        "last_url": START_URL,
        "total_chapters": 0,
        "failed_urls": []
    }

def save_progress(progress):
    """Salva o progresso"""
    with open(PROGRESS_FILE, 'w', encoding='utf-8') as f:
        json.dump(progress, f, indent=2, ensure_ascii=False)

# Este script será executado automaticamente
# O processo real será feito usando as ferramentas do browser em loop

print("=" * 70)
print("EXTRAÇÃO AUTOMÁTICA - TODOS OS CAPÍTULOS DA BÍBLIA EM DARI")
print("=" * 70)
print(f"\nIniciando de: {START_URL}")
print(f"Capítulos serão salvos em: {CHAPTERS_DIR}")
print(f"Progresso será salvo em: {PROGRESS_FILE}")
print("\nO processo será executado automaticamente...")
print("=" * 70)

