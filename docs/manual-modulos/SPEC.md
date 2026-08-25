# KPSULA — Manual de uso por módulo · Especificación de contenido

Cada sección del manual vive en un archivo `content_<seccion>.py` que exporta un
dict `SECTION`. `generate.py` los importa en orden y arma el PDF.

## Esquema

```python
SECTION = {
    "id": "operaciones",          # slug
    "num": 1,                     # número de sección (1–5)
    "title": "Operaciones",       # título visible
    "intro": "…",                 # 1 párrafo HTML: qué agrupa esta sección
    "modules": [MODULE, ...],     # en el MISMO orden que modules-registry.ts
}
```

Cada `MODULE`:

```python
{
    "name": "Proveedores",               # label EXACTO de modules-registry.ts
    "route": "/dashboard/proveedores",   # href del registry
    "kicker": "Compras y pagos",         # agrupador corto (aparece sobre el título)
    "who": "Administración, gerencia y auditoría",  # quién lo usa, texto corto
    "what": "…",                         # 1–2 párrafos HTML: qué es, cuándo se usa,
                                         # cómo se conecta con otros módulos
    "features": [                        # funcionalidades clave (4–8)
        ("Título corto", "descripción de una línea, HTML permitido"),
    ],
    "tasks": [                           # tareas paso a paso (2–6 según el módulo)
        {
            "title": "Crear un proveedor",
            "intro": "opcional, 1 línea HTML",
            "steps": [
                ("Frase corta del paso.", "Detalle: qué se ve, qué botón, qué pasa después."),
            ],
            "callouts": [                # opcional
                ("warn", "Título corto", "cuerpo HTML"),
            ],
        },
    ],
    "callouts": [                        # opcional: avisos a nivel de módulo
        ("info", "Título", "cuerpo HTML"),
    ],
}
```

## Reglas de contenido (no negociables)

1. **Todo factual.** Cada paso sale del código real (labels de botones, campos,
   rutas) o de `OPUS_CONTEXT_CAPSULA.md`. Si no estás seguro de un label, andá a
   leer el archivo del módulo en `src/app/dashboard/...`. **Nunca inventes**
   nombres de botones, campos ni comportamientos.
2. **Español neutro-venezolano, tono de la guía por rol** (`docs/guia-roles/content.py`):
   directo, segunda persona, sin tecnicismos. La cajera y el chef lo leen sin ayuda.
3. Botones y rutas van en `<span class='pill'>…</span>`. Negritas con `<strong>`.
4. Callouts: `ok` (buena práctica), `warn` (requiere cuidado/PIN), `danger`
   (irreversible), `info` (contexto).
5. Los caracteres `&`, `<`, `>` literales van escapados en los campos que
   permiten HTML.
6. Profundidad proporcional al uso: POS Restaurante o Inventario merecen 5–6
   tareas; Comandera Barra con 1–2 alcanza.
7. Si un módulo pide PIN o autorización en algún paso, SIEMPRE decirlo en el paso
   o en un callout `warn`.
8. Sin emojis.

## Módulo ejemplar (usar como referencia de tono y densidad)

```python
{
    "name": "Proveedores",
    "route": "/dashboard/proveedores",
    "kicker": "Compras y pagos",
    "who": "Administración, gerencia y auditoría",
    "what": "El directorio de todas las empresas y personas a las que el negocio le compra. "
            "Cada proveedor creado acá queda disponible en <span class='pill'>Compras</span> para "
            "registrar documentos (facturas, notas de entrega) y en "
            "<span class='pill'>Cuentas por Pagar</span> para llevar la deuda. Si un proveedor no "
            "existe en este directorio, no se le puede registrar una compra.",
    "features": [
        ("Directorio con búsqueda", "Buscá por nombre, RIF o código. Los inactivos quedan marcados pero no se pierden."),
        ("Ficha completa", "Nombre, RIF, código interno, persona de contacto, teléfono y correo."),
        ("Activar / desactivar", "Un proveedor con el que ya no se trabaja se desactiva — su historial de compras y deudas se conserva."),
    ],
    "tasks": [
        {
            "title": "Crear un proveedor",
            "steps": [
                ("Entrá al módulo Proveedores.", "Ruta <span class='pill'>/dashboard/proveedores</span>, en el grupo de Administración del menú lateral."),
                ("Tocá <span class='pill'>Nuevo proveedor</span>.", "El botón está arriba a la derecha. Se abre la ficha vacía."),
                ("Completá el nombre.", "Es el único campo obligatorio. Ej.: <em>Distribuidora X</em>."),
                ("Agregá RIF, contacto, teléfono y correo si los tenés.", "El RIF con formato <span class='pill'>J-12345678-9</span>. Todo esto se puede completar después."),
                ("Guardá.", "El proveedor aparece de inmediato en el directorio y ya se le pueden registrar documentos de compra."),
            ],
            "callouts": [
                ("info", "¿Y la deuda?", "La deuda no se carga acá: nace sola al registrar un documento de compra a crédito en <span class='pill'>Compras</span>, y se paga desde <span class='pill'>Cuentas por Pagar</span>."),
            ],
        },
    ],
}
```
