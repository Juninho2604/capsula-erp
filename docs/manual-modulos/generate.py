#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador del Manual de uso por módulo — KPSULA.
Importa las secciones (content_*.py), arma el HTML y lo renderiza a PDF con
weasyprint. Mismo sistema de diseño que docs/guia-roles (Minimal Navy).
"""
import os
from datetime import date
from weasyprint import HTML

from content_operaciones import SECTION as OPERACIONES
from content_ventas import SECTION as VENTAS
from content_admin import SECTION as ADMIN_CORE
from content_finanzas import SECTION as FINANZAS
from content_juegos import SECTION as JUEGOS

SECTIONS = [OPERACIONES, VENTAS, ADMIN_CORE, FINANZAS, JUEGOS]

OUT = 'KPSULA-Manual-de-uso-por-modulo.pdf'
HTML_OUT = 'manual.html'


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def steps(items):
    out = ['<ol class="steps">']
    for st, sd in items:
        out.append(f'<li><span class="st">{st}</span> <span class="sd">{sd}</span></li>')
    out.append('</ol>')
    return ''.join(out)


def callout(kind, title, body):
    return f'<div class="callout {kind}"><span class="ct">{esc(title)}</span> {body}</div>'


def features_table(feats):
    rows = ''.join(
        f'<tr><td style="width:34%"><strong>{esc(t)}</strong></td><td>{d}</td></tr>'
        for t, d in feats)
    return ('<table><thead><tr><th>Funcionalidad</th><th>Qué hace</th></tr></thead>'
            f'<tbody>{rows}</tbody></table>')


# ---------- páginas ----------

def cover_page():
    today = date.today().strftime('%d · %m · %Y')
    n_mods = sum(len(s['modules']) for s in SECTIONS)
    return f'''
<div class="cover">
  <div class="glow"></div>
  <div class="logo">
    <span class="mark"><span></span><span></span><span></span></span>
    <span class="word">KPSU<b>LA</b></span>
  </div>
  <div class="center">
    <h1>Manual de uso<br><span class="accent">por módulo</span></h1>
    <p class="sub">Los {n_mods} módulos del sistema explicados uno por uno: qué hace cada
    pantalla, sus funcionalidades y las tareas del día a día paso a paso.
    Busca el módulo que necesitas en el índice y ve directo.</p>
  </div>
  <div class="meta">
    <div class="item"><div class="l">Documento</div><div class="v">Manual de referencia</div></div>
    <div class="item"><div class="l">Secciones</div><div class="v">{len(SECTIONS)}</div></div>
    <div class="item"><div class="l">Módulos</div><div class="v">{n_mods}</div></div>
    <div class="item"><div class="l">Edición</div><div class="v">{today}</div></div>
  </div>
</div>'''


def toc_pages():
    out = ['<div class="section-open"><div class="h2-band"><span class="num">·</span><h2>Índice</h2></div>']
    for s in SECTIONS:
        out.append(f'<h3 class="with-rule">{s["num"]}. {esc(s["title"])}</h3><div class="toc">')
        for i, m in enumerate(s['modules'], 1):
            out.append(
                f'<div class="row"><span class="n">{s["num"]}.{i}</span>'
                f'<span class="t">{esc(m["name"])} '
                f'<span class="sub">— {esc(m.get("kicker", ""))}</span></span></div>')
        out.append('</div>')
    out.append(callout('info', 'Cómo leer este manual',
        'No hace falta leerlo completo. Busca el módulo en este índice, ve a su página y '
        'sigue la tarea que necesites. Cada módulo dice arriba <strong>quién lo usa</strong> y '
        '<strong>su ruta</strong> en el sistema. Los módulos que no veas en tu menú lateral '
        'están apagados en tu instalación o fuera de tu rol — eso es normal.'))
    out.append('</div>')
    return ''.join(out)


def section_opener(s):
    return f'''
<div class="section-open">
  <div class="role-card">
    <div class="rk">Sección {s["num"]}</div>
    <div class="rname">{esc(s["title"])}</div>
    <div class="rdesc">{s["intro"]}</div>
    <div class="rlevel"><div class="ll">Módulos</div><div class="lv">{len(s["modules"])}</div></div>
  </div>
</div>'''


def module_chapter(s, i, m):
    out = [f'''
<div class="section-open">
  <p class="kicker coral-kicker">{s["num"]}.{i} · {esc(m.get("kicker", s["title"]))}</p>
  <div class="h2-band"><span class="num">{s["num"]}.{i}</span><h2>{esc(m["name"])}</h2></div>
  <div class="chips">
    <span class="chip on">{esc(m["route"])}</span>
    <span class="chip">{esc(m.get("who", ""))}</span>
  </div>
  <p class="lead">{m["what"]}</p>''']

    if m.get('features'):
        out.append('<h3 class="with-rule">Funcionalidades</h3>')
        out.append(features_table(m['features']))

    for t in m.get('tasks', []):
        out.append(f'<h3 class="with-rule">{esc(t["title"])}</h3>')
        if t.get('intro'):
            out.append(f'<p class="muted">{t["intro"]}</p>')
        out.append(steps(t['steps']))
        for c in t.get('callouts', []):
            out.append(callout(*c))

    for c in m.get('callouts', []):
        out.append(callout(*c))

    out.append('</div>')
    return ''.join(out)


def build_html():
    body = [cover_page(), toc_pages()]
    for s in SECTIONS:
        body.append(section_opener(s))
        for i, m in enumerate(s['modules'], 1):
            body.append(module_chapter(s, i, m))
    return ('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="styles.css"></head><body>'
            + ''.join(body) + '</body></html>')


def main():
    html = build_html()
    with open(HTML_OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    base = os.path.dirname(os.path.abspath(__file__))
    HTML(string=html, base_url=base).write_pdf(OUT)
    print(f'OK → {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)')


if __name__ == '__main__':
    main()
