#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script COMPLETO para extração automática de TODOS os capítulos da Bíblia em Dari
Este script processa capítulos em sequência até o final, salvando o progresso continuamente.

Uso:
    python3 extract_all_chapters.py

O script pode ser interrompido (Ctrl+C) e retomado - ele continuará de onde parou.
"""

import os
import re
import json
import time
import sys
from pathlib import Path
from urllib.parse import urljoin, urlparse

# Verificar dependências
try:
    import requests
except ImportError:
    print("❌ Erro: Módulo 'requests' não encontrado")
    print("   Instale com: pip3 install requests beautifulsoup4")
    sys.exit(1)

try:
    from bs4 import BeautifulSoup
    HAS_BS4 = True
except ImportError:
    HAS_BS4 = False
    print("⚠️  Aviso: BeautifulSoup4 não encontrado, usando parser regex simples")
    print("   Para melhor precisão, instale com: pip3 install beautifulsoup4")
    print("   Continuando com parser alternativo...")

# Configurações
CHAPTERS_DIR = Path("dari-bible-chapters")
CHAPTERS_DIR.mkdir(exist_ok=True)
PROGRESS_FILE = Path("extraction_progress.json")
START_URL = "https://afghanbibles.org/eng/dari-bible/genesis/genesis-1"

# Headers para simular um navegador
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive',
}

def load_progress():
    """Carrega o progresso salvo"""
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

def get_filename_from_url(url):
    """Extrai o nome do arquivo da URL"""
    parts = url.rstrip('/').split('/')
    if parts:
        return f"{parts[-1]}.html"
    return "chapter.html"

def get_next_book_from_select(html_content, current_url):
    """
    Quando não há link nextchaptertop, usa o select para encontrar o próximo livro.
    Retorna a URL do primeiro capítulo do próximo livro.
    """
    # Lista completa dos livros da Bíblia em ordem (conforme URLs do site)
    BOOKS_ORDER = [
        'genesis', 'exodus', 'leviticus', 'numbers', 'deuteronomy',
        'joshua', 'judges', 'ruth', '1-samuel', '2-samuel',
        '1-kings', '2-kings', '1-chronicles', '2-chronicles',
        'ezra', 'nehemiah', 'esther', 'job', 'psalms', 'proverbs',
        'ecclesiastes', 'song-of-songs', 'isaiah', 'jeremiah',
        'lamentations', 'ezekiel', 'daniel', 'hosea', 'joel',
        'amos', 'obadiah', 'jonah', 'micah', 'nahum',
        'habakkuk', 'zephaniah', 'haggai', 'zechariah', 'malachi',
        'matthew', 'mark', 'luke', 'john', 'acts',
        'romans', '1-corinthians', '2-corinthians', 'galatians',
        'ephesians', 'philippians', 'colossians',
        '1-thessalonians', '2-thessalonians', '1-timothy', '2-timothy',
        'titus', 'philemon', 'hebrews', 'james',
        '1-peter', '2-peter', '1-john', '2-john', '3-john',
        'jude', 'revelation'
    ]
    
    # Extrair o livro atual da URL
    # Exemplo: https://afghanbibles.org/eng/dari-bible/genesis/genesis-50 -> genesis
    url_parts = current_url.rstrip('/').split('/')
    current_book = None
    
    # Procurar o livro na URL (geralmente está antes do último segmento)
    for i, part in enumerate(url_parts):
        if part in BOOKS_ORDER:
            current_book = part
            break
    
    # Se não encontrou exato, tentar normalizar (remover números do capítulo)
    if not current_book:
        # Tentar extrair do padrão: /livro/livro-capítulo
        if len(url_parts) >= 2:
            last_part = url_parts[-1]  # ex: genesis-50
            # Remover o número do capítulo
            book_candidate = re.sub(r'-\d+$', '', last_part)
            if book_candidate in BOOKS_ORDER:
                current_book = book_candidate
    
    if not current_book:
        print(f"  ⚠️  Não foi possível identificar o livro atual da URL: {current_url}")
        return None
    
    # Encontrar o índice do livro atual
    try:
        current_index = BOOKS_ORDER.index(current_book)
    except ValueError:
        print(f"  ⚠️  Livro '{current_book}' não encontrado na lista de livros")
        return None
    
    # Se não é o último livro, pegar o próximo
    if current_index < len(BOOKS_ORDER) - 1:
        next_book = BOOKS_ORDER[current_index + 1]
        # Construir URL do primeiro capítulo do próximo livro
        # Base: https://afghanbibles.org/eng/dari-bible/
        base_parts = url_parts[:5]  # Manter até /dari-bible/
        if len(base_parts) < 5:
            # Fallback: reconstruir base
            base_url = '/'.join(url_parts[:url_parts.index('dari-bible') + 1])
        else:
            base_url = '/'.join(base_parts)
        next_url = f"{base_url}/{next_book}/{next_book}-1"
        print(f"  📚 Mudando para próximo livro: {next_book}")
        return next_url
    
    # Se é o último livro, não há mais capítulos
    print(f"  ✅ Último livro da Bíblia alcançado: {current_book}")
    return None

def find_next_url(html_content, current_url, has_bs4):
    """
    Encontra a URL do próximo capítulo, usando nextchaptertop ou select se necessário.
    """
    if has_bs4:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Primeiro, tentar encontrar o link nextchaptertop
        next_link = soup.find('a', id='nextchaptertop')
        if next_link and next_link.get('href'):
            return urljoin(current_url, next_link['href'])
        
        # Se não encontrou, usar o select
        print(f"  🔄 Link nextchaptertop não encontrado, usando select para próximo livro...")
        return get_next_book_from_select(html_content, current_url)
    else:
        # Usar regex para encontrar nextchaptertop
        next_link_match = re.search(
            r'<a[^>]*id=["\']nextchaptertop["\'][^>]*href=["\']([^"\']+)["\']',
            html_content
        )
        if next_link_match:
            return urljoin(current_url, next_link_match.group(1))
        
        # Se não encontrou, usar o select
        print(f"  🔄 Link nextchaptertop não encontrado, usando select para próximo livro...")
        return get_next_book_from_select(html_content, current_url)

def extract_chapter(url, progress):
    """Extrai um capítulo da URL fornecida"""
    if url in progress["processed_urls"]:
        print(f"  ⏭️  Já processado: {url}")
        return None
    
    try:
        print(f"  📖 Processando: {url}")
        response = requests.get(url, headers=HEADERS, timeout=30)
        response.raise_for_status()
        response.encoding = 'utf-8'
        
        # Extrair conteúdo usando BeautifulSoup ou regex
        if HAS_BS4:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Encontrar o elemento scripture
            scripture = soup.find('div', id='scripture')
            if not scripture:
                print(f"  ❌ Elemento #scripture não encontrado em {url}")
                progress["failed_urls"].append(url)
                return None
            
            # Encontrar o link do próximo capítulo (pode usar select se necessário)
            next_url = find_next_url(response.text, url, True)
            
            scripture_html = str(scripture)
        else:
            # Usar regex como alternativa
            html_content = response.text
            
            # Extrair elemento scripture usando regex melhorado
            # Encontrar o início do div com id="scripture"
            start_match = re.search(
                r'<div[^>]*id=["\']scripture["\'][^>]*>',
                html_content
            )
            
            if not start_match:
                print(f"  ❌ Elemento #scripture não encontrado em {url}")
                progress["failed_urls"].append(url)
                return None
            
            # Encontrar o fechamento correspondente contando divs
            start_pos = start_match.start()
            content_after_start = html_content[start_pos:]
            
            # Contar divs abertas e fechadas
            div_count = 0
            end_pos = -1
            i = 0
            while i < len(content_after_start):
                if content_after_start[i:i+4] == '<div':
                    # Verificar se não é auto-fechado
                    if not re.match(r'<div[^>]*/>', content_after_start[i:i+100]):
                        div_count += 1
                elif content_after_start[i:i+6] == '</div>':
                    div_count -= 1
                    if div_count == 0:
                        end_pos = start_pos + i + 6
                        break
                i += 1
            
            if end_pos == -1:
                print(f"  ⚠️  Não foi possível encontrar o fechamento completo do elemento scripture")
                # Usar uma busca mais simples como fallback
                end_match = re.search(
                    r'</div>\s*</div>\s*</div>',
                    content_after_start
                )
                if end_match:
                    end_pos = start_pos + end_match.end()
                else:
                    print(f"  ❌ Elemento #scripture incompleto em {url}")
                    progress["failed_urls"].append(url)
                    return None
            
            scripture_html = html_content[start_pos:end_pos]
            
            # Encontrar o link do próximo capítulo (pode usar select se necessário)
            next_url = find_next_url(html_content, url, False)
        
        # Salvar o HTML do capítulo
        filename = get_filename_from_url(url)
        filepath = CHAPTERS_DIR / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(f"<!-- URL: {url} -->\n")
            f.write(scripture_html)
        
        progress["processed_urls"].append(url)
        progress["total_chapters"] += 1
        progress["last_url"] = url
        
        print(f"  ✅ Salvo: {filename} (Total: {progress['total_chapters']} capítulos)")
        
        return next_url
        
    except requests.exceptions.RequestException as e:
        print(f"  ❌ Erro ao acessar {url}: {e}")
        progress["failed_urls"].append(url)
        return None
    except Exception as e:
        print(f"  ❌ Erro ao processar {url}: {e}")
        progress["failed_urls"].append(url)
        return None

def main():
    """Função principal"""
    print("=" * 70)
    print("EXTRAÇÃO AUTOMÁTICA COMPLETA - BÍBLIA EM DARI")
    print("=" * 70)
    print()
    
    # Carregar progresso
    progress = load_progress()
    
    print(f"📊 Progresso atual:")
    print(f"   - Capítulos processados: {progress['total_chapters']}")
    print(f"   - URLs processadas: {len(progress['processed_urls'])}")
    print(f"   - URLs com falha: {len(progress['failed_urls'])}")
    print(f"   - Última URL: {progress['last_url']}")
    print()
    
    # Determinar URL inicial
    if progress["last_url"] and progress["last_url"] not in progress["processed_urls"]:
        # Continuar do último capítulo não processado
        current_url = progress["last_url"]
        # Tentar encontrar o próximo capítulo
        try:
            response = requests.get(current_url, headers=HEADERS, timeout=30)
            next_url = find_next_url(response.text, current_url, HAS_BS4)
            if next_url:
                current_url = next_url
        except:
            pass
    else:
        # Começar do início ou continuar do último processado
        current_url = progress["last_url"]
        # Tentar encontrar o próximo capítulo não processado
        try:
            response = requests.get(current_url, headers=HEADERS, timeout=30)
            next_url = find_next_url(response.text, current_url, HAS_BS4)
            if next_url:
                current_url = next_url
        except:
            pass
    
    print(f"🚀 Iniciando extração de: {current_url}")
    print(f"💡 Pressione Ctrl+C para interromper (o progresso será salvo)")
    print()
    
    # Contador de capítulos processados nesta execução
    chapters_this_run = 0
    
    try:
        while current_url:
            # Extrair capítulo
            next_url = extract_chapter(current_url, progress)
            
            # Salvar progresso a cada capítulo
            save_progress(progress)
            
            if next_url:
                current_url = next_url
                chapters_this_run += 1
                
                # Pequena pausa para não sobrecarregar o servidor
                time.sleep(1)
            else:
                print()
                print("✅ Não há mais capítulos para processar!")
                break
        
        print()
        print("=" * 70)
        print("EXTRAÇÃO CONCLUÍDA!")
        print("=" * 70)
        print(f"📊 Estatísticas finais:")
        print(f"   - Total de capítulos processados: {progress['total_chapters']}")
        print(f"   - Capítulos processados nesta execução: {chapters_this_run}")
        print(f"   - URLs com falha: {len(progress['failed_urls'])}")
        print(f"   - Arquivos salvos em: {CHAPTERS_DIR}")
        print()
        print("💡 Próximo passo: Execute 'python3 html_to_zefania.py' para gerar o XML Zefania")
        print("=" * 70)
        
    except KeyboardInterrupt:
        print()
        print()
        print("⚠️  Extração interrompida pelo usuário")
        print(f"📊 Progresso salvo:")
        print(f"   - Capítulos processados: {progress['total_chapters']}")
        print(f"   - Capítulos processados nesta execução: {chapters_this_run}")
        print(f"   - Última URL processada: {progress['last_url']}")
        print()
        print("💡 Execute o script novamente para continuar de onde parou")
        save_progress(progress)

if __name__ == "__main__":
    main()

