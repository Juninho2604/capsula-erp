#!/usr/bin/env python3
"""Renderiza un HTML a PDF con weasyprint, resolviendo fuentes/assets relativos."""
import sys, os
from weasyprint import HTML

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'guide.html'
    out = sys.argv[2] if len(sys.argv) > 2 else 'KPSULA-Guia-de-uso-por-rol.pdf'
    base = os.path.dirname(os.path.abspath(src)) or '.'
    HTML(filename=src, base_url=base).write_pdf(out)
    size = os.path.getsize(out)
    print(f'OK → {out} ({size/1024:.0f} KB)')

if __name__ == '__main__':
    main()
