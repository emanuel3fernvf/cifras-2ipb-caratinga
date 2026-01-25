#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair todos os capítulos da Bíblia em Dari do site afghanbibles.org
Usa as ferramentas do browser para navegar e extrair o elemento #scripture de cada página
"""

import os
import json
from pathlib import Path

# Criar diretório para armazenar os capítulos HTML
CHAPTERS_DIR = Path("dari-bible-chapters")
CHAPTERS_DIR.mkdir(exist_ok=True)

def save_chapter_html(url, html_content):
    """Salva o HTML do capítulo em um arquivo"""
    # Extrair nome do arquivo da URL
    # Exemplo: https://afghanbibles.org/eng/dari-bible/genesis/genesis-1
    parts = url.rstrip('/').split('/')
    filename = f"{parts[-1]}.html" if parts else "chapter.html"
    filepath = CHAPTERS_DIR / filename
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(f"<!-- URL: {url} -->\n")
        f.write(html_content)
    
    return filepath

def get_next_chapter_url():
    """Obtém a URL do próximo capítulo usando JavaScript"""
    js_code = """
    () => {
        const nextLink = document.getElementById('nextchaptertop');
        if (nextLink && nextLink.href) {
            return nextLink.href;
        }
        // Tenta encontrar por classe também
        const nextByClass = document.querySelector('a.nextchapter, a[class*="next"]');
        if (nextByClass && nextByClass.href) {
            return nextByClass.href;
        }
        return null;
    }
    """
    return js_code

# Este script será usado como referência
# A extração real será feita usando as ferramentas do browser diretamente

print("Script de referência criado.")
print("A extração será feita usando as ferramentas do browser diretamente.")

