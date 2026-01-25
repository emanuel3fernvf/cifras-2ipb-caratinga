#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para extrair capítulos da Bíblia em Dari em lotes
Processa múltiplos capítulos de uma vez e salva o progresso
"""

import json
from pathlib import Path

# Este script será usado como guia para extração manual
# ou pode ser adaptado para usar ferramentas de automação do browser

CHAPTERS_DIR = Path("dari-bible-chapters")
CHAPTERS_DIR.mkdir(exist_ok=True)

def extract_batch(start_url, batch_size=10):
    """
    Extrai um lote de capítulos começando de start_url
    Retorna a URL do próximo capítulo após processar o lote
    """
    print(f"Processando lote começando de: {start_url}")
    print(f"Tamanho do lote: {batch_size}")
    print("\nPara cada capítulo:")
    print("1. Navegue para a URL")
    print("2. Extraia o elemento #scripture")
    print("3. Salve o HTML em dari-bible-chapters/[nome].html")
    print("4. Encontre o link #nextchaptertop")
    print("5. Repita para o próximo capítulo")
    
    return start_url

if __name__ == "__main__":
    # Começar do primeiro capítulo de Gênesis
    start_url = "https://afghanbibles.org/eng/dari-bible/genesis/genesis-1"
    extract_batch(start_url, batch_size=10)

