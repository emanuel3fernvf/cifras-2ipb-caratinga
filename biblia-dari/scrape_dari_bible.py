#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair capítulos da Bíblia em Dari do site afghanbibles.org
Extrai o elemento #scripture de cada página e navega usando o link #nextchaptertop
"""

import os
import time
import re
from pathlib import Path

# Criar diretório para armazenar os capítulos HTML
CHAPTERS_DIR = Path("dari-bible-chapters")
CHAPTERS_DIR.mkdir(exist_ok=True)

def extract_scripture_content(html_content):
    """Extrai o conteúdo do elemento #scripture do HTML"""
    # Procura pelo elemento scripture usando regex
    pattern = r'<div[^>]*id=["\']scripture["\'][^>]*>(.*?)</div>'
    match = re.search(pattern, html_content, re.DOTALL | re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Tenta encontrar por classe ou outros atributos
    pattern2 = r'<div[^>]*class=["\'][^"\']*scripture[^"\']*["\'][^>]*>(.*?)</div>'
    match2 = re.search(pattern2, html_content, re.DOTALL | re.IGNORECASE)
    if match2:
        return match2.group(1)
    
    return None

def extract_next_chapter_link(html_content):
    """Extrai o link do próximo capítulo do elemento #nextchaptertop"""
    # Procura pelo link com id nextchaptertop
    pattern = r'<a[^>]*id=["\']nextchaptertop["\'][^>]*href=["\']([^"\']+)["\']'
    match = re.search(pattern, html_content, re.IGNORECASE)
    if match:
        return match.group(1)
    
    # Tenta encontrar por classe
    pattern2 = r'<a[^>]*class=["\'][^"\']*nextchapter[^"\']*["\'][^>]*href=["\']([^"\']+)["\']'
    match2 = re.search(pattern2, html_content, re.IGNORECASE)
    if match2:
        return match2.group(1)
    
    return None

def get_chapter_filename(url):
    """Gera um nome de arquivo baseado na URL"""
    # Exemplo: https://afghanbibles.org/eng/dari-bible/genesis/genesis-1
    # Retorna: genesis-1.html
    parts = url.rstrip('/').split('/')
    if parts:
        return f"{parts[-1]}.html"
    return "chapter.html"

def main():
    start_url = "https://afghanbibles.org/eng/dari-bible/genesis/genesis-1"
    current_url = start_url
    chapter_count = 0
    max_chapters = 1200  # Limite de segurança (66 livros * ~20 capítulos)
    
    print(f"Iniciando extração a partir de: {start_url}")
    print(f"Capítulos serão salvos em: {CHAPTERS_DIR}")
    
    while current_url and chapter_count < max_chapters:
        try:
            print(f"\n[{chapter_count + 1}] Processando: {current_url}")
            
            # Navegar para a página
            # Nota: Este script precisa ser executado em um ambiente com acesso ao browser
            # Por enquanto, vamos preparar a estrutura
            
            filename = get_chapter_filename(current_url)
            filepath = CHAPTERS_DIR / filename
            
            if filepath.exists():
                print(f"  Arquivo já existe: {filename}, pulando...")
                # Ler o arquivo para encontrar o próximo link
                with open(filepath, 'r', encoding='utf-8') as f:
                    html_content = f.read()
            else:
                print(f"  Aguardando extração manual ou automação do browser...")
                print(f"  Por favor, acesse: {current_url}")
                print(f"  Copie o elemento #scripture e salve em: {filepath}")
                # Por enquanto, vamos criar um placeholder
                html_content = f"<!-- Placeholder para {current_url} -->\n<!-- Elemento #scripture precisa ser copiado aqui -->"
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(html_content)
            
            # Extrair link do próximo capítulo
            next_link = extract_next_chapter_link(html_content)
            
            if next_link:
                # Se o link for relativo, converter para absoluto
                if next_link.startswith('/'):
                    from urllib.parse import urljoin
                    current_url = urljoin(current_url, next_link)
                elif not next_link.startswith('http'):
                    from urllib.parse import urljoin
                    current_url = urljoin(current_url, next_link)
                else:
                    current_url = next_link
                print(f"  Próximo capítulo: {current_url}")
            else:
                print(f"  Não encontrou link para próximo capítulo. Finalizando.")
                break
            
            chapter_count += 1
            time.sleep(1)  # Pausa entre requisições
            
        except Exception as e:
            print(f"  Erro ao processar {current_url}: {e}")
            break
    
    print(f"\nExtração concluída! Total de capítulos processados: {chapter_count}")

if __name__ == "__main__":
    main()

