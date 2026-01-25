#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para converter arquivos HTML dos capítulos da Bíblia em Dari para formato Zefania XML
Processa os arquivos HTML salvos em dari-bible-chapters/ e gera o XML Zefania
"""

import os
import re
from pathlib import Path
from html.parser import HTMLParser
from html import unescape
import xml.etree.ElementTree as ET
from xml.dom import minidom

# Mapeamento de números persas/dari para árabes
PERSIAN_TO_ARABIC = {
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
}

def persian_to_arabic(text):
    """Converte números persas para árabes"""
    result = ""
    for char in text:
        result += PERSIAN_TO_ARABIC.get(char, char)
    return result

def extract_book_name_from_filename(filename):
    """Extrai o nome do livro do nome do arquivo"""
    # Exemplo: genesis-1.html -> genesis
    # Exemplo: 1-chronicles-1.html -> 1-chronicles
    match = re.match(r'([a-z0-9-]+)-(\d+)\.html', filename)
    if match:
        return match.group(1)
    return None

def extract_chapter_number_from_filename(filename):
    """Extrai o número do capítulo do nome do arquivo"""
    # Exemplo: genesis-1.html -> 1
    # Exemplo: 1-chronicles-1.html -> 1
    # O número do capítulo é sempre o último número antes do .html
    match = re.search(r'-(\d+)\.html$', filename)
    if match:
        return int(match.group(1))
    return None

def parse_html_chapter(html_content):
    """Parseia o HTML de um capítulo e extrai versículos"""
    from bs4 import BeautifulSoup
    
    soup = BeautifulSoup(html_content, 'html.parser')
    
    # Encontrar o elemento scripture
    scripture = soup.find('div', id='scripture')
    if not scripture:
        return None
    
    # Extrair título do livro
    title_elem = scripture.find('h1', class_='title')
    book_title_dari = title_elem.text.strip() if title_elem else ""
    
    # Extrair número do capítulo
    chapter_elem = scripture.find('h2', class_='chapter')
    chapter_text = chapter_elem.text.strip() if chapter_elem else ""
    
    # Extrair versículos
    verses = {}
    verse_elements = scripture.find_all('span', class_='verseno')
    
    for verse_elem in verse_elements:
        verse_id = verse_elem.get('id', '')
        verse_num_text = verse_elem.text.strip()
        
        # Converter número persa para árabe
        verse_num = int(persian_to_arabic(verse_num_text)) if verse_num_text else 0
        
        if verse_num > 0:
            # Pegar o texto do versículo (até o próximo endverse ou próximo verseno)
            verse_text = ""
            current = verse_elem.next_sibling
            
            while current:
                if isinstance(current, str):
                    verse_text += current
                elif hasattr(current, 'name'):
                    if current.name == 'span' and 'endverse' in current.get('class', []):
                        break
                    if current.name == 'span' and 'verseno' in current.get('class', []):
                        break
                    if current.name == 'p' and 'swv' in current.get('class', []):
                        # Pegar texto dentro do parágrafo
                        for child in current.children:
                            if isinstance(child, str):
                                verse_text += child
                            elif hasattr(child, 'text'):
                                if 'verseno' not in child.get('class', []):
                                    verse_text += child.text
                        break
                    if hasattr(current, 'text'):
                        verse_text += current.text
                current = current.next_sibling
            
            # Limpar o texto
            verse_text = re.sub(r'\s+', ' ', verse_text).strip()
            if verse_text:
                verses[verse_num] = verse_text
    
    return {
        'book_title_dari': book_title_dari,
        'chapter_text': chapter_text,
        'verses': verses
    }

def parse_html_simple(html_content):
    """Versão simplificada do parser usando regex"""
    # Extrair título do livro
    title_match = re.search(r'<h1[^>]*class=["\']title["\'][^>]*>(.*?)</h1>', html_content, re.DOTALL)
    book_title_dari = title_match.group(1).strip() if title_match else ""
    book_title_dari = re.sub(r'<[^>]+>', '', book_title_dari)  # Remove tags HTML
    
    # Extrair versículos usando regex melhorado
    # Padrão: verseno pode ter classe "verseno" ou "verseno c" ou outras variações
    verses = {}
    
    # Encontrar todos os spans com classe verseno (pode ter outras classes também)
    # Padrão mais flexível: aceita verseno com outras classes e IDs compostos
    verse_pattern = r'<span[^>]*class=["\'][^"\']*verseno[^"\']*["\'][^>]*id=["\']v(\d+)(?:-(\d+))?["\'][^>]*>([۰-۹]+)(?:‏-([۰-۹]+))?</span>(.*?)(?=<span[^>]*class=["\'][^"\']*verseno[^"\']*["\']|<span[^>]*class=["\'][^"\']*endverse[^"\']*["\']|$)'
    
    for match in re.finditer(verse_pattern, html_content, re.DOTALL):
        verse_start_id = int(match.group(1))
        verse_end_id = int(match.group(2)) if match.group(2) else verse_start_id
        verse_num_persian_start = match.group(3)
        verse_num_persian_end = match.group(4) if match.group(4) else None
        
        # Converter número persa inicial para árabe
        verse_start = int(persian_to_arabic(verse_num_persian_start))
        
        # Se há número final persa, usar ele; senão usar o ID final
        if verse_num_persian_end:
            verse_end = int(persian_to_arabic(verse_num_persian_end))
        else:
            verse_end = verse_start_id if verse_start_id == verse_end_id else verse_end_id
        
        verse_content = match.group(5)
        
        # Limpar o conteúdo do versículo
        verse_text = re.sub(r'<[^>]+>', '', verse_content)  # Remove tags HTML
        verse_text = re.sub(r'\s+', ' ', verse_text).strip()
        verse_text = unescape(verse_text)  # Decodifica entidades HTML
        
        if verse_text:
            # Se é um range de versículos (ex: v1-4), atribuir o mesmo texto a todos
            for verse_num in range(verse_start, verse_end + 1):
                if verse_num not in verses:
                    verses[verse_num] = verse_text
                # Se já existe, não sobrescrever (manter o primeiro encontrado)
    
    return {
        'book_title_dari': book_title_dari,
        'verses': verses
    }

# Ordem canônica dos livros da Bíblia (conforme URLs do site)
BIBLE_BOOKS_ORDER = [
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

# Mapeamento de nomes de livros
BOOK_NAMES = {
    'genesis': ('Gênesis', 'پیدایش'),
    'exodus': ('Êxodo', 'خروج'),
    'leviticus': ('Levítico', 'لاویان'),
    'numbers': ('Números', 'اعداد'),
    'deuteronomy': ('Deuteronômio', 'تثنیه'),
    'joshua': ('Josué', 'یوشع'),
    'judges': ('Juízes', 'داوران'),
    'ruth': ('Rute', 'روت'),
    '1-samuel': ('1 Samuel', 'اول سموئیل'),
    '2-samuel': ('2 Samuel', 'دوم سموئیل'),
    '1-kings': ('1 Reis', 'اول پادشاهان'),
    '2-kings': ('2 Reis', 'دوم پادشاهان'),
    '1-chronicles': ('1 Crônicas', 'اول تواریخ'),
    '2-chronicles': ('2 Crônicas', 'دوم تواریخ'),
    'ezra': ('Esdras', 'عزرا'),
    'nehemiah': ('Neemias', 'نحمیا'),
    'esther': ('Ester', 'استر'),
    'job': ('Jó', 'ایوب'),
    'psalms': ('Salmos', 'مزامیر'),
    'proverbs': ('Provérbios', 'امثال'),
    'ecclesiastes': ('Eclesiastes', 'جامعه'),
    'song-of-songs': ('Cantares', 'غزل غزلهای سلیمان'),
    'isaiah': ('Isaías', 'اشعیا'),
    'jeremiah': ('Jeremias', 'ارمیا'),
    'lamentations': ('Lamentações', 'مراثی'),
    'ezekiel': ('Ezequiel', 'حزقیال'),
    'daniel': ('Daniel', 'دانیال'),
    'hosea': ('Oséias', 'هوشع'),
    'joel': ('Joel', 'یوئیل'),
    'amos': ('Amós', 'عاموس'),
    'obadiah': ('Obadias', 'عوبدیا'),
    'jonah': ('Jonas', 'یونس'),
    'micah': ('Miquéias', 'میکاه'),
    'nahum': ('Naum', 'ناحوم'),
    'habakkuk': ('Habacuque', 'حبقوق'),
    'zephaniah': ('Sofonias', 'صفنیا'),
    'haggai': ('Ageu', 'حجی'),
    'zechariah': ('Zacarias', 'زکریا'),
    'malachi': ('Malaquias', 'ملاکی'),
    'matthew': ('Mateus', 'متی'),
    'mark': ('Marcos', 'مرقس'),
    'luke': ('Lucas', 'لوقا'),
    'john': ('João', 'یوحنا'),
    'acts': ('Atos', 'اعمال'),
    'romans': ('Romanos', 'رومیان'),
    '1-corinthians': ('1 Coríntios', 'اول قرنتیان'),
    '2-corinthians': ('2 Coríntios', 'دوم قرنتیان'),
    'galatians': ('Gálatas', 'غلاطیان'),
    'ephesians': ('Efésios', 'افسسیان'),
    'philippians': ('Filipenses', 'فیلیپیان'),
    'colossians': ('Colossenses', 'کولسیان'),
    '1-thessalonians': ('1 Tessalonicenses', 'اول تسالونیکیان'),
    '2-thessalonians': ('2 Tessalonicenses', 'دوم تسالونیکیان'),
    '1-timothy': ('1 Timóteo', 'اول تیموتاوس'),
    '2-timothy': ('2 Timóteo', 'دوم تیموتاوس'),
    'titus': ('Tito', 'تیطس'),
    'philemon': ('Filemom', 'فلیمون'),
    'hebrews': ('Hebreus', 'عبرانیان'),
    'james': ('Tiago', 'یعقوب'),
    '1-peter': ('1 Pedro', 'اول پطرس'),
    '2-peter': ('2 Pedro', 'دوم پطرس'),
    '1-john': ('1 João', 'اول یوحنا'),
    '2-john': ('2 João', 'دوم یوحنا'),
    '3-john': ('3 João', 'سوم یوحنا'),
    'jude': ('Judas', 'یهودا'),
    'revelation': ('Apocalipse', 'مکاشفه')
}

def create_zefania_xml(chapters_data):
    """Cria o XML no formato Zefania a partir dos dados dos capítulos"""
    # Criar elemento raiz XMLBIBLE com atributos (formato esperado pelo Holyrics)
    xmf = ET.Element('XMLBIBLE')
    xmf.set('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    xmf.set('xsi:noNamespaceSchemaLocation', 'zef2005.xsd')
    xmf.set('biblename', 'Dari')
    xmf.set('status', 'v')
    xmf.set('version', '2.0.1.18')
    xmf.set('type', 'x-bible')
    xmf.set('revision', '0')
    
    # Informações (tags em minúsculas conforme formato Zefania)
    information = ET.SubElement(xmf, 'INFORMATION')
    title = ET.SubElement(information, 'title')
    title.text = 'Bíblia em Dari'
    format_elem = ET.SubElement(information, 'format')
    format_elem.text = 'Zefania XML Bible Markup Language'
    source = ET.SubElement(information, 'source')
    source.text = 'https://afghanbibles.org/'
    subject = ET.SubElement(information, 'subject')
    subject.text = 'holy bible'
    date_elem = ET.SubElement(information, 'date')
    from datetime import datetime
    date_elem.text = datetime.now().strftime('%Y-%m-%d')
    creator = ET.SubElement(information, 'creator')
    creator.text = 'Extracted from afghanbibles.org'
    publisher = ET.SubElement(information, 'publisher')
    publisher.text = 'Afghan Bibles'
    identifier = ET.SubElement(information, 'identifier')
    identifier.text = 'DARI'
    language = ET.SubElement(information, 'language')
    language.text = 'prs'  # Código ISO para Dari/Persa
    contributors = ET.SubElement(information, 'contributors')
    description = ET.SubElement(information, 'description')
    type_elem = ET.SubElement(information, 'type')
    coverage = ET.SubElement(information, 'coverage')
    rights = ET.SubElement(information, 'rights')
    
    # Organizar capítulos por livro
    books_dict = {}
    for chapter_data in chapters_data:
        book_key = chapter_data['book_key']
        chapter_num = chapter_data['chapter_num']
        
        if book_key not in books_dict:
            books_dict[book_key] = {}
        books_dict[book_key][chapter_num] = chapter_data
    
    # Criar elementos book na ordem canônica
    book_number = 1
    # Ordenar livros pela ordem canônica da Bíblia
    sorted_book_keys = sorted(books_dict.keys(), key=lambda x: BIBLE_BOOKS_ORDER.index(x) if x in BIBLE_BOOKS_ORDER else 999)
    
    for book_key in sorted_book_keys:
        book_name_pt, book_name_dari = BOOK_NAMES.get(book_key, (book_key.title(), ''))
        
        # BIBLEBOOK só tem bnumber, sem bname e sem NAMES
        book = ET.SubElement(xmf, 'BIBLEBOOK')
        book.set('bnumber', str(book_number))
        
        # Adicionar capítulos diretamente dentro de BIBLEBOOK
        for chapter_num in sorted(books_dict[book_key].keys()):
            chapter_data = books_dict[book_key][chapter_num]
            
            chapter = ET.SubElement(book, 'CHAPTER')
            chapter.set('cnumber', str(chapter_num))
            
            # Versículos diretamente dentro de CHAPTER (tag VERS, não VERSE)
            for verse_num in sorted(chapter_data['verses'].keys()):
                verse = ET.SubElement(chapter, 'VERS')
                verse.set('vnumber', str(verse_num))
                verse.text = chapter_data['verses'][verse_num]
        
        book_number += 1
    
    return xmf

def main():
    CHAPTERS_DIR = Path("dari-bible-chapters")
    
    if not CHAPTERS_DIR.exists():
        print(f"Diretório {CHAPTERS_DIR} não encontrado!")
        return
    
    print(f"Processando arquivos HTML em {CHAPTERS_DIR}...")
    
    chapters_data = []
    html_files = sorted(CHAPTERS_DIR.glob("*.html"))
    
    print(f"Encontrados {len(html_files)} arquivos HTML")
    
    for html_file in html_files:
        print(f"Processando: {html_file.name}")
        
        with open(html_file, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Parsear HTML
        chapter_data = parse_html_simple(html_content)
        
        if chapter_data and chapter_data['verses']:
            # Extrair informações do nome do arquivo
            book_key = extract_book_name_from_filename(html_file.name)
            chapter_num = extract_chapter_number_from_filename(html_file.name)
            
            if book_key and chapter_num:
                chapter_data['book_key'] = book_key
                chapter_data['chapter_num'] = chapter_num
                chapters_data.append(chapter_data)
                print(f"  ✓ Capítulo {chapter_num}: {len(chapter_data['verses'])} versículos")
            else:
                print(f"  ✗ Não foi possível extrair informações do nome do arquivo")
        else:
            print(f"  ✗ Nenhum versículo encontrado")
    
    if not chapters_data:
        print("Nenhum capítulo foi processado com sucesso!")
        return
    
    print(f"\nTotal de capítulos processados: {len(chapters_data)}")
    
    # Criar XML Zefania
    print("\nGerando XML Zefania...")
    xmf = create_zefania_xml(chapters_data)
    
    # Formatar e salvar XML
    xml_string = ET.tostring(xmf, encoding='unicode')
    dom = minidom.parseString(xml_string)
    pretty_xml = dom.toprettyxml(indent='  ', encoding='utf-8')
    
    output_file = Path("biblia-dari-zefania.xml")
    with open(output_file, 'wb') as f:
        f.write(pretty_xml)
    
    print(f"XML Zefania salvo em: {output_file}")
    print(f"Tamanho do arquivo: {output_file.stat().st_size / 1024 / 1024:.2f} MB")

if __name__ == "__main__":
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        print("BeautifulSoup4 não está instalado. Usando parser regex simples.")
        print("Para melhor precisão, instale: pip install beautifulsoup4")
    
    main()

