#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador de la Guía de uso por rol — KPSULA.
Construye el HTML completo a partir de estructuras de datos y lo renderiza a PDF
con weasyprint. Contenido en content.py para mantener separados datos y armado.
"""
import os
from weasyprint import HTML
from content import ROLES, MODULES, GLOSSARY, INTRO, FAQ, MATRIX

OUT = 'KPSULA-Guia-de-uso-por-rol.pdf'
HTML_OUT = 'guide.html'

# ---------- helpers de markup ----------

def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def chips(items):
    out = ['<div class="chips">']
    for label, on in items:
        cls = 'chip on' if on else 'chip'
        out.append(f'<span class="{cls}">{esc(label)}</span>')
    out.append('</div>')
    return ''.join(out)

def steps(items):
    out = ['<ol class="steps">']
    for st, sd in items:
        out.append(f'<li><span class="st">{esc(st)}</span> <span class="sd">{sd}</span></li>')
    out.append('</ol>')
    return ''.join(out)

def callout(kind, title, body):
    return f'<div class="callout {kind}"><span class="ct">{esc(title)}</span> {body}</div>'

def cando(can, cant):
    li_can = ''.join(f'<li>{esc(x)}</li>' for x in can)
    li_cant = ''.join(f'<li>{esc(x)}</li>' for x in cant)
    return (f'<div class="cando">'
            f'<div class="col can"><h5>Sí puede</h5><ul>{li_can}</ul></div>'
            f'<div class="col cant"><h5>No puede</h5><ul>{li_cant}</ul></div></div>')

def table(headers, rows):
    th = ''.join(f'<th>{esc(h)}</th>' for h in headers)
    body = ''
    for r in rows:
        tds = ''.join(f'<td>{c}</td>' for c in r)
        body += f'<tr>{tds}</tr>'
    return f'<table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'

def mock(title, rows):
    body = ''
    for row in rows:
        tiles = ''.join(
            f'<div class="tile{" accent" if acc else ""}">{esc(t)}</div>' for t, acc in row)
        body += f'<div class="row">{tiles}</div>'
    return (f'<div class="mock"><div class="bar"><span class="dot"></span>{esc(title)}</div>'
            f'<div class="body">{body}</div></div>')

# ---------- páginas estáticas ----------

def cover_page():
    return '''
<section class="cover">
  <div class="glow"></div>
  <div class="logo">
    <span class="mark"><span></span><span></span><span></span></span>
    <span class="word">K<b>P</b>SULA</span>
  </div>
  <div class="center">
    <div class="kicker coral-kicker">Manual operativo</div>
    <h1>Guía de uso<br><span class="accent">por rol</span></h1>
    <div class="sub">Cómo trabaja cada persona del equipo dentro del sistema KPSULA — paso a paso, desde el primer login hasta el cierre de caja.</div>
  </div>
  <div class="meta">
    <div class="item"><div class="l">Versión</div><div class="v">1.0 · Junio 2026</div></div>
    <div class="item"><div class="l">Alcance</div><div class="v">9 roles · 47 módulos</div></div>
    <div class="item"><div class="l">Confidencial</div><div class="v">Uso interno</div></div>
  </div>
</section>'''

def toc_page():
    rows = ['<div class="section-open"><div class="h2-band"><span class="num">—</span><h2>Contenido</h2></div>']
    rows.append('<div class="toc">')
    entries = [
        ('01', 'Cómo leer esta guía', 'Convenciones, íconos y estructura'),
        ('02', 'El sistema en 2 minutos', 'Qué es KPSULA, login y navegación'),
        ('03', 'Mapa de roles', 'Jerarquía y niveles de acceso'),
        ('04', 'Mapa de módulos', 'Los 47 módulos por categoría'),
        ('05', 'Glosario visual', 'Términos e íconos del día a día'),
    ]
    for n, t, s in entries:
        rows.append(f'<div class="row"><span class="n">{n}</span><span class="t">{esc(t)} <span class="sub">— {esc(s)}</span></span></div>')
    rows.append('<div class="row" style="border:none;padding-top:10pt"><span class="n" style="color:var(--ink-muted)">Roles</span><span class="t"></span></div>')
    for i, role in enumerate(ROLES, 1):
        rows.append(f'<div class="row"><span class="n">{i:02d}</span><span class="t">{esc(role["name"])} <span class="sub">— {esc(role["tagline"])}</span></span></div>')
    rows.append('<div class="row" style="border:none;padding-top:10pt"><span class="n" style="color:var(--ink-muted)">Anexos</span><span class="t"></span></div>')
    for n, t in [('A', 'Matriz rol × módulo'), ('B', 'Métodos de pago y reglas de cobro'), ('C', 'Preguntas frecuentes')]:
        rows.append(f'<div class="row"><span class="n">{n}</span><span class="t">{esc(t)}</span></div>')
    rows.append('</div></div>')
    return ''.join(rows)

def intro_pages():
    out = []
    # 01 Cómo leer
    out.append('<div class="section-open"><div class="h2-band"><span class="num">01</span><h2>Cómo leer esta guía</h2></div>')
    out.append(f'<p class="lead">{INTRO["how_to_read"]}</p>')
    out.append('<h3 class="with-rule">Las señales que vas a encontrar</h3>')
    out.append(callout('info', 'Dato', 'Un detalle del sistema que conviene saber.'))
    out.append(callout('ok', 'Buena práctica', 'La forma recomendada de hacer las cosas.'))
    out.append(callout('warn', 'Atención', 'Algo que requiere cuidado o un permiso especial.'))
    out.append(callout('danger', 'Cuidado', 'Una acción difícil de revertir o que pide autorización.'))
    out.append('<p class="small muted" style="margin-top:6pt">Los pasos numerados describen la secuencia exacta en pantalla. Las etiquetas como <span class="pill">Enviar a cocina</span> son botones o estados reales del sistema.</p>')
    out.append('</div>')

    # 02 Sistema en 2 minutos
    out.append('<div class="section-open"><div class="h2-band"><span class="num">02</span><h2>El sistema en 2 minutos</h2></div>')
    out.append(f'<p class="lead">{INTRO["system_2min"]}</p>')
    out.append('<h3 class="with-rule">Entrar al sistema</h3>')
    out.append(steps(INTRO['login_steps']))
    out.append(callout('warn', 'Atención', INTRO['login_note']))
    out.append('<h3 class="with-rule">Lo que ves al entrar depende de tu rol</h3>')
    out.append(f'<p>{INTRO["sidebar_note"]}</p>')
    out.append(mock('Sidebar — lo que ve cada quien', [
        [('Dashboard', False), ('POS', True), ('Inventario', False)],
        [('Producción', False), ('Reportes', False), ('Config', False)],
    ]))
    out.append('</div>')

    # 03 Mapa de roles
    out.append('<div class="section-open"><div class="h2-band"><span class="num">03</span><h2>Mapa de roles</h2></div>')
    out.append(f'<p class="lead">{INTRO["roles_map"]}</p>')
    rows = []
    for r in ROLES:
        rows.append([f'<strong>{esc(r["name"])}</strong>', esc(r['code']), f'<span class="num">{r["level"]}</span>', esc(r['tagline'])])
    out.append(table(['Rol', 'Código', 'Nivel', 'En una línea'], rows))
    out.append(callout('info', 'Niveles', INTRO['levels_note']))
    out.append('</div>')

    # 04 Mapa de módulos
    out.append('<div class="section-open"><div class="h2-band"><span class="num">04</span><h2>Mapa de módulos</h2></div>')
    out.append(f'<p class="lead">{INTRO["modules_map"]}</p>')
    for cat, items in MODULES:
        out.append(f'<h3 class="with-rule">{esc(cat)}</h3>')
        rows = [[f'<strong>{esc(n)}</strong>', d] for n, d in items]
        out.append(table(['Módulo', 'Para qué sirve'], rows))
    out.append('</div>')

    # 05 Glosario
    out.append('<div class="section-open"><div class="h2-band"><span class="num">05</span><h2>Glosario visual</h2></div>')
    out.append(f'<p class="lead">{INTRO["glossary"]}</p>')
    rows = [[f'<strong>{esc(t)}</strong>', d] for t, d in GLOSSARY]
    out.append(table(['Término', 'Qué significa'], rows))
    out.append('</div>')
    return ''.join(out)

def role_section(i, r):
    out = ['<div class="section-open">']
    # tarjeta de rol
    out.append('<div class="role-card">')
    out.append(f'<div class="rlevel"><div class="ll">Nivel</div><div class="lv">{r["level"]}</div></div>')
    out.append(f'<div class="rk">{esc(r["kicker"])}</div>')
    out.append(f'<div class="rname">{esc(r["name"])}</div>')
    out.append(f'<div class="rdesc">{esc(r["desc"])}</div>')
    out.append('</div>')
    # módulos
    out.append(chips(r['chips']))
    # un día típico
    if r.get('day'):
        out.append(callout('info', 'Un día típico', r['day']))
    # tareas
    for task in r['tasks']:
        out.append(f'<h3 class="with-rule">{esc(task["title"])}</h3>')
        if task.get('intro'):
            out.append(f'<p>{task["intro"]}</p>')
        if task.get('mock'):
            out.append(mock(task['mock'][0], task['mock'][1]))
        out.append(steps(task['steps']))
        for c in task.get('callouts', []):
            out.append(callout(*c))
    # puede / no puede
    out.append('<h3 class="with-rule">Alcance del rol</h3>')
    out.append(cando(r['can'], r['cant']))
    out.append('</div>')
    return ''.join(out)

def appendices():
    out = []
    # A — matriz
    out.append('<div class="section-open"><div class="h2-band"><span class="num">A</span><h2>Matriz rol × módulo</h2></div>')
    out.append('<p class="lead">Qué rol accede a qué área. <span class="yes">●</span> acceso · <span class="ro">◐</span> solo lectura · <span class="muted">—</span> sin acceso.</p>')
    out.append(MATRIX)
    out.append('</div>')
    # B — pagos
    out.append('<div class="section-open"><div class="h2-band"><span class="num">B</span><h2>Métodos de pago y reglas de cobro</h2></div>')
    out.append(f'<p class="lead">{INTRO["payments_intro"]}</p>')
    rows = [[f'<strong>{esc(n)}</strong>', d] for n, d in INTRO['payments']]
    out.append(table(['Método', 'Cómo se usa'], rows))
    for c in INTRO['payment_rules']:
        out.append(callout(*c))
    out.append('</div>')
    # C — FAQ
    out.append('<div class="section-open"><div class="h2-band"><span class="num">C</span><h2>Preguntas frecuentes</h2></div>')
    for q, a in FAQ:
        out.append(f'<h4>{esc(q)}</h4><p>{a}</p>')
    out.append('</div>')
    return ''.join(out)

def build_html():
    body = [cover_page(), toc_page(), intro_pages()]
    for i, r in enumerate(ROLES, 1):
        body.append(role_section(i, r))
    body.append(appendices())
    html = ('<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
            '<link rel="stylesheet" href="styles.css"></head><body>'
            + ''.join(body) + '</body></html>')
    return html

def main():
    html = build_html()
    with open(HTML_OUT, 'w', encoding='utf-8') as f:
        f.write(html)
    base = os.path.dirname(os.path.abspath(__file__))
    HTML(string=html, base_url=base).write_pdf(OUT)
    print(f'OK → {OUT} ({os.path.getsize(OUT)/1024:.0f} KB)')

if __name__ == '__main__':
    main()
