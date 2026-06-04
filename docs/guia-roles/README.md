# KPSULA — Guía de uso por rol (PDF)

Documento de capacitación: una guía paso a paso por cada uno de los 10 roles del
sistema, manteniendo la línea editorial Minimal Navy de KPSULA.

**Entregable:** `KPSULA-Guia-de-uso-por-rol.pdf` (27 páginas, A4).

## Estructura

| Archivo | Qué es |
|---|---|
| `content.py` | Todo el contenido como datos (roles, tareas, módulos, glosario, FAQ, matriz). **Editá aquí el texto.** |
| `generate.py` | Arma el HTML desde `content.py` y lo renderiza a PDF. |
| `styles.css` | Sistema de diseño de impresión (paleta Minimal Navy, componentes, portada). |
| `render.py` | Utilidad para renderizar cualquier HTML a PDF. |
| `fonts/` | Inter Tight (la fuente de marca) incrustada en el PDF. |
| `guide.html` | HTML generado (artefacto intermedio). |

## Regenerar el PDF

Requiere `weasyprint` (HTML/CSS → PDF) y, para previsualizar páginas, `pymupdf`:

```bash
pip3 install weasyprint pymupdf
cd docs/guia-roles
python3 generate.py        # → KPSULA-Guia-de-uso-por-rol.pdf
```

Las libs de sistema de weasyprint (pango, cairo, gdk-pixbuf) ya están presentes en
el VPS. El contenido es factual, extraído de `OPUS_CONTEXT_CAPSULA.md` (§3–§8, §18, §20).

## Editar contenido

Todo el texto vive en `content.py` en estructuras simples:

- `ROLES` — lista de roles; cada uno con `tasks` (tutoriales paso a paso), `chips`
  (módulos), `can` / `cant` (alcance).
- `MODULES`, `GLOSSARY`, `FAQ`, `INTRO` — secciones de apoyo.
- `MATRIX` — matriz rol × área (se arma en `_build_matrix()`).

Tras editar, corré `python3 generate.py` de nuevo.
