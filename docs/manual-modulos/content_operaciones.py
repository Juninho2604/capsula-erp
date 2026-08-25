# -*- coding: utf-8 -*-
"""Sección 1 — Operaciones. Manual de uso por módulo de KPSULA.

Todo el contenido sale del código real (labels de los view.tsx) y de
OPUS_CONTEXT_CAPSULA.md (§150, §154, §155, §156, §156.1, §158, §159).
"""

SECTION = {
    "id": "operaciones",
    "num": 1,
    "title": "Operaciones",
    "intro": (
        "Aquí vive el día a día del negocio fuera del punto de venta: el inventario y sus "
        "conteos, las recetas y la producción de cocina, las compras, los costos y el menú "
        "que ve el POS. Todo está conectado: lo que se compra entra al inventario, lo que "
        "se produce descuenta insumos, lo que se vende descuenta por receta, y los costos "
        "alimentan el margen de cada plato. Esta sección explica cada módulo en el mismo "
        "orden en que aparece en el menú lateral."
    ),
    "modules": [

        # ================================================================
        # DASHBOARD
        # ================================================================
        {
            "name": "Dashboard",
            "route": "/dashboard",
            "kicker": "Panorama del día",
            "who": "Gerencia, dueño, chef, líderes de área y auditoría",
            "what": (
                "La primera pantalla al entrar al sistema: un resumen del día con las ventas, "
                "las órdenes, las propinas y las anulaciones de hoy, más las alertas de stock "
                "y un resumen financiero del mes. Cada rol ve las secciones que le tocan — "
                "la cajera y el mesonero no pasan por aquí: el sistema los manda directo a su "
                "POS."
            ),
            "features": [
                ("Órdenes y ticket del día", "Cuántas órdenes van hoy, el ticket promedio, las propinas y las anuladas."),
                ("Alertas Críticas de Stock", "Los insumos que cayeron por debajo de su mínimo, para actuar antes de que falten en cocina."),
                ("Resumen Financiero del Mes", "Ventas cobradas, costo de lo vendido, utilidad y gastos del mes en curso, en tarjetas simples."),
                ("Secciones por rol", "El panel se adapta: gerencia ve finanzas, cocina ve producción y pedidos pendientes."),
                ("Accesos directos", "Desde las tarjetas se salta al módulo que corresponde (inventario, ventas, producción)."),
            ],
            "tasks": [
                {
                    "title": "Revisar el arranque del día",
                    "steps": [
                        ("Entrá al sistema.", "El Dashboard es la pantalla inicial en <span class='pill'>/dashboard</span> para todos los roles de gestión."),
                        ("Mirá las tarjetas de hoy.", "<strong>Órdenes hoy</strong>, <strong>Ticket promedio</strong>, <strong>Propinas hoy</strong> y <strong>Anuladas hoy</strong> — si algo se sale de lo normal, ahí se nota primero."),
                        ("Bajá al <span class='pill'>Resumen Financiero del Mes</span>.", "Ventas, costo y utilidad del mes acumulado, para saber cómo viene el negocio sin abrir Finanzas."),
                    ],
                },
                {
                    "title": "Atender una alerta de stock",
                    "steps": [
                        ("Revisá <span class='pill'>Alertas Críticas de Stock</span>.", "Lista los insumos que quedaron por debajo del mínimo configurado en Inventario."),
                        ("Decidí la acción.", "Si hay que comprar, andá a <span class='pill'>Compras</span> (la pestaña Auto-Generar arma la orden con estos mismos ítems). Si el stock está en otra área, pedí una transferencia."),
                    ],
                },
            ],
        },

        # ================================================================
        # INVENTARIO FÍSICO (diario)
        # ================================================================
        {
            "name": "Inventario Físico",
            "route": "/dashboard/inventario/diario",
            "kicker": "Inventario",
            "who": "Gerencia de operaciones, chef, líderes de área y auditoría",
            "what": (
                "La rutina de conteo físico por día y por área: se cuenta lo que hay, se suman "
                "las ventas del POS y el sistema calcula el cierre teórico con la fórmula "
                "<strong>APERTURA + ENTRADAS − VENTAS − MERMA = TEÓRICO</strong>. La diferencia "
                "entre el cierre teórico y el cierre real es la varianza — la merma o el "
                "faltante del día. Es el control cruzado entre lo que dice el POS y lo que "
                "hay en los estantes."
            ),
            "features": [
                ("Conteo por fecha y área", "Se elige el día y el almacén; cada ítem tiene su columna de apertura real y cierre real."),
                ("Sumar Ventas POS", "Trae lo vendido en el POS del día para descontarlo del teórico, sin cargar nada a mano."),
                ("Resumen pre-cierre", "Antes de finalizar, muestra las varianzas grandes para revisarlas: si todo cierra, dice que no hay varianzas significativas."),
                ("Productos Críticos", "Lista aparte con los ítems sensibles, en el orden recomendado para el cierre."),
                ("Reporte por rango", "La vista <span class='pill'>Variaciones al final del día — rango de fechas</span> junta las varianzas de varios días: total, faltantes y top de varianzas negativas."),
            ],
            "tasks": [
                {
                    "title": "Hacer el cierre del día",
                    "steps": [
                        ("Entrá a Inventario Físico y elegí fecha y área.", "Ruta <span class='pill'>/dashboard/inventario/diario</span>."),
                        ("Cargá el conteo físico de cada ítem.", "Las cantidades reales contadas. Tocá <span class='pill'>Guardar</span> para no perder el avance."),
                        ("Tocá <span class='pill'>Sumar Ventas POS</span>.", "El sistema descuenta lo vendido y calcula el <strong>Cierre Teórico</strong>."),
                        ("Revisá el <span class='pill'>Resumen pre-cierre</span>.", "Compara cierre teórico contra cierre real. Si hay ítems marcados, revisalos antes de seguir."),
                        ("Tocá <span class='pill'>Finalizar día</span>.", "La varianza del día queda registrada y el cierre pasa a ser la apertura de mañana."),
                    ],
                    "callouts": [
                        ("info", "¿Contaste mal?", "Un día finalizado se puede reabrir para corregir el conteo; al reabrirlo el sistema avisa <em>Inventario reabierto</em> y podés guardar de nuevo."),
                    ],
                },
                {
                    "title": "Ver las variaciones de un período",
                    "steps": [
                        ("Cambiá a la vista de rango.", "En el mismo módulo, la vista <span class='pill'>Variaciones al final del día — rango de fechas</span>."),
                        ("Elegí desde y hasta, y el área.", "El reporte muestra la variación total, los ítems con faltante y el top de varianzas negativas del período."),
                    ],
                },
            ],
        },

        # ================================================================
        # INVENTARIO
        # ================================================================
        {
            "name": "Inventario",
            "route": "/dashboard/inventario",
            "kicker": "Inventario",
            "who": "Gerencia de operaciones, chef, líderes de área y auditoría",
            "what": (
                "El catálogo maestro de todo lo que el negocio tiene: insumos, sub-recetas y "
                "productos, con su stock por almacén, su unidad, su stock mínimo y su punto de "
                "reorden. Desde el encabezado salen las herramientas que mueven stock: "
                "<span class='pill'>Entrada de Mercancía</span>, <span class='pill'>Kardex</span> "
                "(el historial de movimientos de cada ítem), <span class='pill'>Descargo</span> "
                "(salidas que la venta no descuenta sola) e <span class='pill'>Importar Excel</span>. "
                "Todo lo que pasa en Compras, Producción, Transferencias y el POS termina "
                "reflejado aquí."
            ),
            "features": [
                ("Catálogo con búsqueda y filtros", "Buscá por nombre, SKU o categoría; filtrá por almacén y por tipo: Insumos, Sub-recetas o Productos."),
                ("Stock por almacén", "Cada ítem muestra cuánto hay en cada área, con su stock mínimo y punto de reorden."),
                ("Kardex", "El historial completo de movimientos de un ítem: entradas, salidas, producciones, ajustes y descargos, con fecha y motivo."),
                ("Descargo manual de consumo", "Registra salidas que la venta no descuenta: platos sin receta (como Arma tu Shawarma), mermas y consumo interno."),
                ("Banner de stock negativo", "Si algún insumo quedó en negativo (se produjo o descargó antes de cargar la compra), un aviso lo lista arriba con acceso directo a cargar la entrada."),
                ("Entrada de Mercancía e Importar Excel", "Ingreso de compras al stock y carga masiva del catálogo desde Excel."),
                ("Imprimir lista", "Hoja de conteo impresa para contar en físico y tipear después en Conteo Rápido."),
            ],
            "tasks": [
                {
                    "title": "Buscar un ítem y revisar su stock",
                    "steps": [
                        ("Entrá a Inventario.", "Ruta <span class='pill'>/dashboard/inventario</span>."),
                        ("Usá el buscador.", "Por nombre, SKU o categoría. Los filtros de arriba cambian entre <strong>Insumos</strong>, <strong>Sub-recetas</strong> y <strong>Productos</strong>, y entre almacenes."),
                        ("Abrí el <span class='pill'>Kardex</span> si algo no cuadra.", "Ahí está cada movimiento del ítem con fecha, tipo y motivo — la forma de saber a dónde se fue el stock."),
                    ],
                },
                {
                    "title": "Registrar un Descargo manual de consumo",
                    "intro": "Para platos que se venden sin receta (el caso Arma tu Shawarma), mermas o consumo interno: la venta no descuenta nada, así que el consumo real se registra aquí, agregado por período.",
                    "steps": [
                        ("Tocá <span class='pill'>Descargo</span> en el encabezado de Inventario.", "Abre la pantalla <strong>Descargo manual de consumo</strong> en <span class='pill'>/dashboard/inventario/descargo</span>."),
                        ("Elegí el <span class='pill'>Almacén</span> y, si aplica, el <span class='pill'>Plato vinculado (opcional)</span>.", "Al vincular un plato, el sistema muestra cuántas <strong>unidades se vendieron desde el último descargo</strong> de ese plato y desde cuándo. Este descargo debería cubrir ese consumo."),
                        ("Abrí el panel <span class='pill'>Con qué se despachó</span>.", "Agrupa las notas que los mesoneros escribieron en cada unidad vendida (ej. <em>12 u. de «kibe + pollo»</em>). Multiplicá cada combinación por sus unidades para saber cuánto descargar de cada insumo."),
                        ("Cargá los <span class='pill'>Insumos a descargar</span>.", "Buscá el insumo, poné la cantidad en su unidad base y tocá <span class='pill'>Agregar</span>. Repetí por cada insumo consumido."),
                        ("Escribí el <span class='pill'>Motivo</span>.", "Es obligatorio. Ej.: <em>Consumo Arma tu Shawarma, semana 10–16 de agosto</em>."),
                        ("Tocá <span class='pill'>Registrar descargo</span>.", "El stock baja y cada movimiento queda en el Kardex. Si vinculaste un plato, el contador se reinicia: este descargo pasa a ser «el último»."),
                    ],
                    "callouts": [
                        ("warn", "Unidades sin nota", "Si el panel avisa que algunas unidades se vendieron <strong>sin nota</strong>, no hay registro de qué llevaron: estimalas aparte. Y si ese número crece, el problema está en la toma de pedidos, no en el descargo."),
                        ("info", "¿No alcanza el stock?", "Si el sistema dice <em>Stock insuficiente</em>, muestra en cuánto quedaría cada insumo. Si el consumo fue real y solo falta cargar la compra, tocá <span class='pill'>Registrar igual y dejar en negativo</span>: el saldo se acomoda al cargar la entrada."),
                    ],
                },
                {
                    "title": "Atender el banner de stock negativo",
                    "intro": "Un insumo queda en negativo cuando se produjo o descargó antes de cargar su compra. El negativo es una deuda visible que se salda sola al registrar la entrada — pero alguien tiene que mirarla.",
                    "steps": [
                        ("Mirá el aviso al entrar a Inventario.", "El banner dice cuántos insumos están en negativo y lista los más hundidos, con su almacén y cuánto deben."),
                        ("Cargá la entrada pendiente.", "El propio banner lleva a <span class='pill'>Entrada de Mercancía</span> (<span class='pill'>/dashboard/inventario/entrada</span>). Al registrar la compra, el saldo se acomoda solo."),
                    ],
                    "callouts": [
                        ("warn", "No lo dejes crecer", "Un negativo que nadie mira deja de ser transitorio y se vuelve el descuadre que nadie sabe explicar. Si el banner sigue ahí después de cargar las compras del día, algo más está pasando: revisá el Kardex del insumo."),
                    ],
                },
                {
                    "title": "Editar un ítem del catálogo",
                    "steps": [
                        ("Tocá <span class='pill'>Editar ítem</span> en la fila del producto.", "Se abre la ficha con nombre, SKU, categoría y unidad de medida."),
                        ("Ajustá <span class='pill'>Stock Mínimo</span> y <span class='pill'>Punto de Reorden</span>.", "Con estos valores se disparan las alertas de stock bajo y la pestaña Auto-Generar de Compras."),
                        ("Guardá.", "Eliminar un ítem es solo para gerentes — y solo si no tiene historial que lo necesite."),
                    ],
                },
                {
                    "title": "Dar entrada de mercancía",
                    "steps": [
                        ("Tocá <span class='pill'>Entrada de Mercancía</span> en el encabezado.", "Ruta <span class='pill'>/dashboard/inventario/entrada</span>."),
                        ("Cargá los ítems recibidos y sus cantidades.", "Cada línea genera un movimiento de compra que suma al stock del almacén elegido y actualiza el costo del insumo."),
                    ],
                    "callouts": [
                        ("info", "¿Vino con factura?", "Si la mercancía llega con un documento de proveedor, conviene registrarla desde <span class='pill'>Compras</span> / Facturas y Notas: la entrada queda vinculada al documento y a la deuda en Cuentas por Pagar."),
                    ],
                },
            ],
        },

        # ================================================================
        # CONTEO RÁPIDO
        # ================================================================
        {
            "name": "Conteo Rápido",
            "route": "/dashboard/inventario/conteo-rapido",
            "kicker": "Inventario",
            "who": "Cuentan: producción, cocina, jefes de área, gerencia y auditoría. Aplican el ajuste: solo gerencia, dueño y auditor",
            "what": (
                "Para pasar el conteo físico de la hoja impresa al sistema, rápido: una persona "
                "dicta y otra escribe, y Tab o Enter salta al siguiente ítem. El conteo queda en "
                "revisión con las diferencias contra el sistema a la vista, y el ajuste final lo "
                "confirma otra persona. La regla de fondo: <strong>quien cuenta no confirma su "
                "propio conteo</strong> — así el conteo sirve de control y no solo de carga."
            ),
            "features": [
                ("Conteo por almacenes", "Al abrir un conteo se eligen los almacenes a contar; se puede contar más de uno en la misma sesión."),
                ("Tipeo veloz", "Buscá por SKU, nombre o categoría; Tab/Enter avanza al siguiente. El filtro <span class='pill'>Solo pendientes</span> esconde lo ya contado."),
                ("Revisión con diferencias", "Antes de aplicar, una tabla muestra Producto, Almacén, Sistema, Contado y la diferencia — con las varianzas grandes destacadas."),
                ("Aplicación en dos manos", "El que contó envía a revisión; el ajuste al inventario lo aplica gerencia, dueño o auditor."),
                ("Estados claros", "Contando → En revisión → Aplicado (o Cancelado). Un conteo aplicado es solo lectura."),
            ],
            "tasks": [
                {
                    "title": "Contar y enviar a revisión",
                    "steps": [
                        ("Tocá <span class='pill'>Nuevo conteo</span> y elegí los almacenes.", "Ruta <span class='pill'>/dashboard/inventario/conteo-rapido</span>. Luego <span class='pill'>Comenzar conteo</span>."),
                        ("Tipeá las cantidades de la hoja.", "Buscá cada producto por SKU o nombre y cargá lo contado; Tab o Enter pasa al siguiente. Con <span class='pill'>Solo pendientes</span> ves solo lo que falta."),
                        ("Tocá <span class='pill'>Revisar diferencias</span>.", "El conteo pasa a revisión y muestra las diferencias contra el sistema. Si te faltó algo, <span class='pill'>Seguir contando</span> lo reabre."),
                    ],
                },
                {
                    "title": "Aplicar el ajuste (gerencia o auditoría)",
                    "steps": [
                        ("Abrí el conteo en revisión.", "La tabla marca las diferencias grandes; si no hay ninguna, el sistema lo dice."),
                        ("Tocá <span class='pill'>Aplicar y ajustar el inventario</span>.", "Pide confirmación: indica cuántos productos quedarán con una cantidad distinta y avisa que no se puede deshacer."),
                        ("Confirmá.", "El stock de los almacenes contados se ajusta a lo contado y el conteo queda como Aplicado, solo lectura."),
                    ],
                    "callouts": [
                        ("warn", "Quién puede qué", "Contar pueden producción, cocina, jefes de área, gerencia y auditoría. <strong>Aplicar el ajuste (o cancelar el conteo) solo gerencia, dueño o auditor.</strong> Si contaste vos, otra persona confirma: es el control del módulo, no un trámite."),
                    ],
                },
            ],
        },

        # ================================================================
        # TRANSFERENCIAS
        # ================================================================
        {
            "name": "Transferencias",
            "route": "/dashboard/transferencias",
            "kicker": "Inventario",
            "who": "Gerencia de operaciones, chef, líderes de área y auditoría",
            "what": (
                "Mueve stock entre áreas con registro: la barra le pide al depósito, el depósito "
                "despacha, y quien recibe confirma lo que efectivamente llegó. Cada paso queda "
                "asentado (quién pidió, quién despachó, quién recibió), y el stock recién se "
                "mueve cuando se confirma la recepción. Para movimientos internos sin tanto "
                "trámite existe la <span class='pill'>Transferencia Rápida</span>."
            ),
            "features": [
                ("Requisiciones entre áreas", "Un área solicita ítems a otra: origen, destino y cantidades por línea."),
                ("Despacho ajustable", "Quien despacha puede enviar menos de lo pedido — el detalle dice <em>Ajusta si despachas menos</em>."),
                ("Confirmación de recepción", "El receptor verifica las cantidades recibidas y confirma; recién ahí el stock cambia de área."),
                ("Aprobar Directo y Rechazar", "Una solicitud se puede aprobar de una o rechazar, según el caso."),
                ("Transferencia Rápida", "Movimiento en lote de un área a otra en un solo paso, para el trajín del día."),
            ],
            "tasks": [
                {
                    "title": "Pedir stock a otra área",
                    "steps": [
                        ("Tocá <span class='pill'>Nueva requisición</span>.", "Ruta <span class='pill'>/dashboard/transferencias</span>."),
                        ("Elegí origen y destino, y cargá los ítems.", "Buscá cada ítem y poné la cantidad solicitada."),
                        ("Enviá la solicitud.", "Queda como Pendiente en la bandeja del área de origen, con vos como solicitante."),
                    ],
                },
                {
                    "title": "Despachar y recibir una transferencia",
                    "steps": [
                        ("El área de origen tocá <span class='pill'>Despachar</span>.", "En el detalle de la solicitud se ajustan las cantidades si se despacha menos de lo pedido."),
                        ("El receptor verifica los items despachados.", "La pantalla lista los ítems despachados para verificar las cantidades recibidas, con espacio para notas de recepción."),
                        ("Tocá <span class='pill'>Confirmar Recepción</span>.", "El stock sale del área de origen y entra al destino. La transferencia queda cerrada y trazable."),
                    ],
                },
                {
                    "title": "Mover stock en un paso (Transferencia Rápida)",
                    "steps": [
                        ("Abrí <span class='pill'>Transferencia Rápida</span>.", "Elegí el área origen y el área destino."),
                        ("Cargá los ítems y confirmá el movimiento.", "El stock se mueve al instante, sin pasar por solicitud y despacho. Úsala para movimientos internos de confianza; para pedidos entre áreas, la requisición deja mejor rastro."),
                    ],
                },
            ],
        },

        # ================================================================
        # NOTAS DE ENTREGA (préstamos)
        # ================================================================
        {
            "name": "Notas de Entrega",
            "route": "/dashboard/prestamos",
            "kicker": "Inventario",
            "who": "Gerencia, administración y auditoría",
            "what": (
                "Registra mercancía que sale del inventario hacia otro negocio o un tercero "
                "— un préstamo o una venta informal entre locales — y controla cómo se "
                "resuelve: o devuelven el producto (reposición) o lo pagan (pago). Mientras "
                "no se resuelva, la nota queda abierta como recordatorio de que ese stock "
                "está afuera."
            ),
            "features": [
                ("Registro de salida", "Se elige el almacén, el producto, la cantidad y a quién se le entrega (ej. <em>Restaurant Vecino A</em>)."),
                ("Dos formas de resolver", "<strong>Reposición</strong> (devuelven el producto y vuelve al inventario) o <strong>Pago</strong> (compran el producto a un precio acordado)."),
                ("Precio acordado", "En la resolución por pago se registra el monto; el cobro pasa a Cuentas por Cobrar."),
                ("Listado de pendientes", "Las notas abiertas quedan a la vista hasta confirmarse su resolución."),
            ],
            "tasks": [
                {
                    "title": "Registrar una nota de entrega",
                    "steps": [
                        ("Tocá <span class='pill'>Registrar Nota de Entrega</span>.", "Ruta <span class='pill'>/dashboard/prestamos</span>."),
                        ("Elegí almacén, producto y cantidad.", "Y anotá a quién se le entrega. El stock sale del inventario y la nota queda abierta."),
                    ],
                },
                {
                    "title": "Resolver una nota pendiente",
                    "steps": [
                        ("Abrí la nota y elegí el tipo de resolución.", "<span class='pill'>Reposición (Devuelven producto)</span> — el producto vuelve al inventario — o <span class='pill'>Pago (Compran producto)</span> con su precio acordado."),
                        ("Tocá <span class='pill'>Confirmar Resolución</span>.", "Con reposición, el stock reingresa. Con pago, queda registrado que el dinero se recibió (o pasa a Cuentas por Cobrar)."),
                    ],
                },
            ],
        },

        # ================================================================
        # RECETAS
        # ================================================================
        {
            "name": "Recetas",
            "route": "/dashboard/recetas",
            "kicker": "Cocina y producción",
            "who": "Gerencia, chef y auditoría",
            "what": (
                "La ficha técnica de cada preparación: sus ingredientes con cantidades, la "
                "merma de cada uno, el rendimiento del lote y el costo calculado por el "
                "sistema. Una receta puede ser un <strong>Producto Final (Venta)</strong> — lo "
                "que se vincula a un plato del Menú para que la venta descuente inventario — o "
                "una <strong>Sub-Receta</strong> (un intermedio, como una salsa) que a su vez "
                "es ingrediente de otras. El costo se calcula en cadena: si un ingrediente "
                "tiene su propia receta, el sistema lo costea solo."
            ),
            "features": [
                ("Ingredientes con merma", "Cada línea lleva cantidad bruta, merma y cantidad neta, en la unidad fija del insumo."),
                ("Costo automático", "El sistema suma el costo de cada ingrediente (recursivo si es sub-receta) y muestra el costo total del lote y el unitario."),
                ("Rendimiento (Yield)", "Cantidad base que rinde el lote — de ahí sale el costo por unidad producida."),
                ("Armado en Servicio", "Marca para recetas que no se producen aparte: se descargan directo en la venta, sin pasar por Producción."),
                ("Recalcular costos", "Cuando cambian los precios de los insumos, un botón actualiza el costo de las recetas."),
                ("Búsqueda y categorías", "Buscá por nombre, categoría o unidad; filtrá por tipo y categoría."),
            ],
            "tasks": [
                {
                    "title": "Crear una receta",
                    "steps": [
                        ("Tocá <span class='pill'>Nueva receta</span>.", "Ruta <span class='pill'>/dashboard/recetas</span>; el formulario abre en <span class='pill'>/dashboard/recetas/nueva</span>."),
                        ("Completá la <span class='pill'>Información Básica</span>.", "Nombre, categoría y tipo: <strong>Producto Final (Venta)</strong> o <strong>Sub-Receta</strong>. Definí la <span class='pill'>Cantidad Base</span> y el <span class='pill'>Rendimiento (Yield)</span> del lote."),
                        ("Agregá los ingredientes.", "Con <span class='pill'>Agregar ingrediente</span>: buscá el insumo y cargá <span class='pill'>Cant. Bruta</span> y <span class='pill'>Merma</span>; el sistema calcula la neta y el costo de la línea."),
                        ("Revisá el <span class='pill'>Análisis de Costos</span>.", "Costo de ingredientes, costo total del lote y costo unitario, calculados en vivo."),
                        ("Guardá.", "La receta queda lista para producir y para vincular a un plato del Menú."),
                    ],
                    "callouts": [
                        ("info", "Costo en cadena", "Si un ingrediente es una sub-receta, su costo se calcula recursivamente desde sus propios insumos. Nunca se calcula a mano."),
                    ],
                },
                {
                    "title": "Marcar una receta como Armado en Servicio",
                    "intro": "Para preparaciones que se arman al momento de vender (no se producen por lote): la venta descuenta los ingredientes directamente.",
                    "steps": [
                        ("Abrí la receta y activá <span class='pill'>Armado en Servicio</span>.", "La opción dice <em>Descarga directa en venta (sin producción)</em>."),
                        ("Guardá.", "Cada venta del plato vinculado descuenta los ingredientes de la receta, sin orden de producción de por medio."),
                    ],
                },
                {
                    "title": "Recalcular los costos",
                    "steps": [
                        ("Tocá <span class='pill'>Recalcular costos</span> en el listado.", "También existe por receta (<span class='pill'>Recalcular costo</span>)."),
                        ("Revisá el resultado.", "Los costos se actualizan con los precios vigentes del módulo Costos — el módulo de Margen por Plato lee estos números."),
                    ],
                },
                {
                    "title": "Editar o eliminar una receta",
                    "steps": [
                        ("Tocá <span class='pill'>Editar receta</span> en la fila.", "Podés cambiar ingredientes, cantidades, mermas y rendimiento; el costo se recalcula."),
                        ("Para borrarla, <span class='pill'>Eliminar receta</span>.", "Solo si ya no se usa: un plato del menú vinculado a esa receta quedaría sin descargo de inventario."),
                    ],
                    "callouts": [
                        ("warn", "Platos sin receta", "El módulo avisa cuando hay platos del menú sin receta o con receta vacía: esos platos se venden sin error, pero no descuentan inventario. Para el caso a propósito (Arma tu Shawarma), el consumo se registra con el Descargo manual de Inventario."),
                    ],
                },
            ],
        },

        # ================================================================
        # SUB-RECETAS
        # ================================================================
        {
            "name": "Sub-recetas",
            "route": "/dashboard/subrecetas",
            "kicker": "Cocina y producción",
            "who": "Gerencia, chef y auditoría",
            "what": (
                "La misma pantalla de Recetas, pero filtrada a las preparaciones intermedias: "
                "salsas, masas, aderezos, cremas. Una sub-receta se produce por lote en "
                "<span class='pill'>Producción</span> y después se usa como ingrediente de "
                "otras recetas — su costo viaja en cadena hasta el plato final."
            ),
            "features": [
                ("Vista dedicada a intermedios", "Solo las recetas de tipo Sub-Receta, sin mezclarse con los productos de venta."),
                ("Mismo formulario que Recetas", "Ingredientes, mermas, rendimiento y costo calculado."),
                ("Costo que viaja en cadena", "Al actualizar el costo de una sub-receta, cambia el costo de todas las recetas que la usan."),
            ],
            "tasks": [
                {
                    "title": "Crear una sub-receta",
                    "steps": [
                        ("Tocá <span class='pill'>Nueva sub-receta</span>.", "Ruta <span class='pill'>/dashboard/subrecetas</span>. Ej.: <em>Salsa de Ajo de la Casa</em>."),
                        ("Cargá ingredientes, rendimiento y guardá.", "Igual que una receta normal; el tipo ya viene como Sub-Receta."),
                    ],
                },
                {
                    "title": "Usarla como ingrediente",
                    "steps": [
                        ("En cualquier receta, agregala como un insumo más.", "Aparece en el buscador de ingredientes; su costo se toma del cálculo de la sub-receta."),
                        ("Producila cuando haga falta stock.", "Desde <span class='pill'>Producción</span>: el lote descuenta sus insumos y suma la sub-receta al inventario."),
                    ],
                },
            ],
        },

        # ================================================================
        # PRODUCCIÓN
        # ================================================================
        {
            "name": "Producción",
            "route": "/dashboard/produccion",
            "kicker": "Cocina y producción",
            "who": "Gerencia, chef y líderes de área",
            "what": (
                "Donde la cocina registra lo que produjo: cada orden descuenta los ingredientes "
                "del inventario y suma el producto terminado. Hay dos caminos: "
                "<strong>Producción desde Receta</strong> (el sistema trae los ingredientes de "
                "la receta y calcula lo necesario) y <strong>Producción Manual</strong> (se "
                "elige el producto de salida y se cargan los ingredientes a mano, para casos "
                "fuera de receta). Todo queda como una orden con responsable, notas y sus "
                "movimientos en el Kardex."
            ),
            "features": [
                ("Producción desde Receta", "Elegís la receta y la cantidad; el sistema calcula lo necesario, muestra lo disponible y descuenta al registrar."),
                ("Producción Manual", "Producto de salida + ingredientes cargados a mano, para producciones fuera de receta o ajustes."),
                ("Auto-consumo permitido", "Una receta puede llevar su propio producto como ingrediente (yogurt con cultivo, masa madre): el sistema muestra el neto — cuánto varía el stock de verdad."),
                ("Producir con faltante", "Si no alcanza la materia prima, se puede registrar igual dejando el insumo en negativo — con confirmación explícita viendo la lista."),
                ("Órdenes con historial", "Cada orden guarda responsable, estado, ingredientes consumidos y notas editables; una orden se puede cancelar."),
            ],
            "tasks": [
                {
                    "title": "Producir desde una receta",
                    "steps": [
                        ("Entrá a Producción y elegí <span class='pill'>Producción desde Receta</span>.", "Ruta <span class='pill'>/dashboard/produccion</span>."),
                        ("Buscá la receta e indicá la cantidad.", "El sistema lista cada ingrediente con lo <strong>Necesario</strong> y lo <strong>Disponible</strong>."),
                        ("Tocá <span class='pill'>Registrar Producción</span>.", "Descuenta los ingredientes y suma el producto terminado. La orden queda registrada con vos como responsable."),
                    ],
                },
                {
                    "title": "Hacer una Producción Manual",
                    "steps": [
                        ("Elegí <span class='pill'>Producción Manual</span>.", "Para producciones sin receta o con ingredientes distintos a los de la ficha."),
                        ("Seleccioná el producto de salida y su cantidad.", "Con <span class='pill'>Seleccionar producto de salida...</span>."),
                        ("Agregá los ingredientes consumidos.", "Uno por uno, con sus cantidades reales."),
                        ("Tocá <span class='pill'>Registrar Producción Manual</span>.", "Los insumos bajan y el producto sube, con movimientos separados en el Kardex."),
                    ],
                    "callouts": [
                        ("info", "Producto que se consume a sí mismo", "Es válido usar el producto de salida como ingrediente (el yogurt arranca con yogurt). La pantalla muestra el aviso de <em>Producción con auto-consumo</em> con el neto: se producen 10 KG y se consumen 2 KG → el stock varía +8 KG. Leé ese número — es lo que delata un decimal mal puesto antes de tocar el inventario."),
                    ],
                },
                {
                    "title": "Registrar una producción sin materia prima suficiente",
                    "intro": "Una producción real que no se registra es peor que un saldo negativo: rompe el costo, el Kardex y el conteo siguiente. Por eso el sistema deja registrarla dejando el insumo en negativo — pero nunca en silencio.",
                    "steps": [
                        ("Intentá registrar la producción normal.", "Si el stock no alcanza, el sistema muestra en cuánto quedaría cada insumo (ej. <em>Aceite de oliva: quedaría en −4.5 L</em>)."),
                        ("Leé la lista con calma.", "Ese detalle es el control: litros donde iban mililitros se ven ahí, antes de tocar el inventario."),
                        ("Tocá <span class='pill'>Registrar igual y dejar en negativo</span>.", "La producción se registra, los insumos quedan en negativo y el movimiento queda anotado como faltante de inventario, visible en el Kardex."),
                        ("Cargá la entrada de la materia prima apenas puedas.", "El banner de stock negativo en Inventario te lo va a recordar; al registrar la compra, el saldo se acomoda solo."),
                    ],
                    "callouts": [
                        ("warn", "Es una excepción, no la rutina", "El paso existe para que la operación no se frene cuando la compra todavía no se cargó. Si los negativos se vuelven costumbre, el problema es el orden de carga de las compras."),
                    ],
                },
                {
                    "title": "Corregir o cancelar una orden",
                    "steps": [
                        ("Abrí la orden en el listado.", "Cada orden muestra producto, cantidad, responsable, estado e ingredientes consumidos."),
                        ("Usá <span class='pill'>Editar notas</span> o <span class='pill'>Cancelar orden</span>.", "Las notas documentan el lote; cancelar revierte la orden cuando se cargó por error."),
                    ],
                },
            ],
        },

        # ================================================================
        # COSTOS
        # ================================================================
        {
            "name": "Costos",
            "route": "/dashboard/costos",
            "kicker": "Cocina y producción",
            "who": "Gerencia y auditoría",
            "what": (
                "El precio de cada insumo del inventario, en un solo lugar. De estos números "
                "sale el costo de las recetas y, de ahí, el margen de cada plato: un insumo "
                "sin costo deja ciega toda la cadena. El módulo muestra cuántos ítems tienen "
                "costo, cuáles no, y cuáles requieren actualización."
            ),
            "features": [
                ("Tabla de costos actuales", "Cada insumo con su costo en USD, unidad, proveedor y fecha del último cambio."),
                ("Edición con motivo", "Se edita el costo, se elige la moneda y se puede dejar el motivo del cambio."),
                ("Importar Costos desde Excel", "Carga masiva: el sistema marca coincidentes, no encontrados e inválidos antes de aplicar."),
                ("Estados de cobertura", "Con Costo / Sin Costo / Requieren actualización — el termómetro de qué tan confiable es el costeo."),
            ],
            "tasks": [
                {
                    "title": "Actualizar el costo de un insumo",
                    "steps": [
                        ("Buscá el insumo y tocá <span class='pill'>Editar costo</span>.", "Ruta <span class='pill'>/dashboard/costos</span>."),
                        ("Cargá el nuevo costo y la moneda.", "Con el motivo si aplica (ej. <em>subió el proveedor</em>)."),
                        ("Tocá <span class='pill'>Guardar costo</span>.", "Después conviene pasar por Recetas → <span class='pill'>Recalcular costos</span> para que el cambio llegue a los platos."),
                    ],
                },
                {
                    "title": "Importar costos desde Excel",
                    "steps": [
                        ("Tocá <span class='pill'>Importar Costos desde Excel</span>.", "Subí el archivo con SKU y costo."),
                        ("Revisá el resumen antes de aplicar.", "El importador separa <strong>Coincidentes</strong>, <strong>No Encontrados</strong> e <strong>Inválidos</strong> — solo se aplican los que matchean."),
                    ],
                },
            ],
        },

        # ================================================================
        # MARGEN POR PLATO
        # ================================================================
        {
            "name": "Margen por Plato",
            "route": "/dashboard/costos/margen",
            "kicker": "Cocina y producción",
            "who": "Gerencia y auditoría",
            "what": (
                "Costo de receta contra precio de venta, plato por plato y en tiempo real. "
                "El sistema clasifica cada plato por su margen — rentables (50% o más), y en "
                "riesgo (menos de 30%) — y calcula el margen promedio de la carta. Es la "
                "pantalla para decidir precios y detectar platos que se venden a pérdida "
                "de contribución."
            ),
            "features": [
                ("Margen en vivo", "Precio, costo de receta, margen en dólares y en porcentaje, por plato."),
                ("Semáforo de rentabilidad", "Rentables (≥50%), margen insuficiente y En riesgo (&lt;30%), con el total de platos y el margen promedio arriba."),
                ("Búsqueda y filtros", "Por plato o categoría, para revisar una familia completa de una vez."),
                ("Depende de Costos y Recetas", "Los costos requieren insumos con precio registrado en el Módulo Costos y platos vinculados a su receta."),
            ],
            "tasks": [
                {
                    "title": "Revisar la rentabilidad de la carta",
                    "steps": [
                        ("Entrá a Margen por Plato.", "Ruta <span class='pill'>/dashboard/costos/margen</span>."),
                        ("Mirá los totales de arriba.", "Total de platos, margen promedio, rentables y en riesgo."),
                        ("Ordená o filtrá para encontrar los problemas.", "Los platos en riesgo primero: o suben de precio, o baja su costo, o se revisa su receta."),
                    ],
                },
                {
                    "title": "Arreglar un plato con margen malo",
                    "steps": [
                        ("Verificá que el costo sea real.", "Un margen absurdo suele ser un costo desactualizado o una receta con cantidades mal cargadas — revisá Costos y la receta antes de tocar el precio."),
                        ("Ajustá precio o receta.", "El precio se cambia en <span class='pill'>Menú</span>; la receta en <span class='pill'>Recetas</span>. El margen se recalcula solo."),
                    ],
                    "callouts": [
                        ("info", "Platos sin receta", "Un plato sin receta aparece con costo 0 y margen ciego. Si es a propósito (Arma tu Shawarma), su costo real entra por el Descargo manual — los números globales cierran, aunque el plato no reporte margen propio."),
                    ],
                },
            ],
        },

        # ================================================================
        # COMPRAS
        # ================================================================
        {
            "name": "Compras",
            "route": "/dashboard/compras",
            "kicker": "Compras",
            "who": "Gerencia, chef y líderes de área",
            "what": (
                "El ciclo completo de abastecimiento: órdenes de compra (manuales o generadas "
                "desde el stock bajo), el envío al proveedor por WhatsApp, la recepción de la "
                "mercancía que ingresa al inventario, y la configuración de stock mínimo y "
                "punto de reorden que dispara las alertas. Se conecta con "
                "<span class='pill'>Proveedores</span> (el directorio), con "
                "<span class='pill'>Facturas y Notas</span> (los documentos del proveedor) y "
                "con <span class='pill'>Cuentas por Pagar</span> (la deuda)."
            ),
            "features": [
                ("Órdenes de compra con estados", "Borrador → Enviada → Parcial → Recibida (o Cancelada), organizadas en la pestaña Órdenes."),
                ("Auto-Generar", "Arma la orden con los ítems bajo stock mínimo, agrupados por proveedor — la lista de <em>Items con Stock Bajo</em> hecha pedido."),
                ("Pedido por WhatsApp", "Analiza el texto del chat con el proveedor para cargar ítems, y <span class='pill'>Copiar para WhatsApp</span> exporta la orden lista para pegar."),
                ("Recepción contra orden", "Se recibe la mercancía indicando cantidades por línea; lo recibido entra al stock y la orden pasa a Parcial o Recibida."),
                ("Stock Mín. y Punto de Reorden", "Pestaña propia para configurar los umbrales de alerta por ítem."),
                ("Entrada por documento multi-almacén", "Al dar entrada a una factura de proveedor, cada línea puede ir a un almacén distinto."),
            ],
            "tasks": [
                {
                    "title": "Crear una orden de compra manual",
                    "steps": [
                        ("Entrá a Compras y abrí la pestaña <span class='pill'>Manual</span>.", "Ruta <span class='pill'>/dashboard/compras</span>."),
                        ("Completá proveedor y fecha.", "El proveedor es opcional (se puede dejar <em>Sin proveedor específico</em>) y hay campo de fecha de entrega esperada y notas."),
                        ("Agregá los ítems desde el panel izquierdo.", "Buscá cada ítem y cargá la cantidad pedida."),
                        ("Creá la orden.", "Nace en Borrador; cuando se manda al proveedor, tocá <span class='pill'>Marcar como enviada</span>."),
                    ],
                },
                {
                    "title": "Generar la orden desde el stock bajo",
                    "steps": [
                        ("Abrí la pestaña <span class='pill'>Auto-Generar</span>.", "Lista los <strong>Items con Stock Bajo</strong>: los que están por debajo de su mínimo, con stock actual, mínimo y cuánto falta para el punto de reorden."),
                        ("Revisá y ajustá cantidades.", "El sistema propone; vos decidís."),
                        ("Generá la orden.", "Queda como una orden normal, lista para enviar y recibir."),
                    ],
                },
                {
                    "title": "Enviar el pedido por WhatsApp",
                    "steps": [
                        ("Abrí la orden y tocá <span class='pill'>Copiar para WhatsApp</span>.", "La orden se copia al portapapeles con formato de chat."),
                        ("Pegala en el chat del proveedor y marcá la orden como enviada.", "La pestaña <span class='pill'>WhatsApp</span> también funciona al revés: pegás el texto del chat, tocás <span class='pill'>Analizar Orden</span>, corregís los ítems reconocidos y los cargás a la orden."),
                    ],
                },
                {
                    "title": "Recibir la mercancía",
                    "steps": [
                        ("Abrí la pestaña <span class='pill'>Recibir</span>.", "La pantalla <strong>Recibir Mercancía desde Orden de Compra</strong>."),
                        ("Seleccioná la orden y el área de almacenamiento.", "Con <span class='pill'>Seleccionar orden…</span>."),
                        ("Cargá las cantidades realmente recibidas, línea por línea.", "Si llegó menos, la orden queda Parcial y el resto pendiente."),
                        ("Tocá <span class='pill'>Recibir mercancía</span>.", "Lo recibido entra al stock del área elegida y actualiza el costo del insumo."),
                    ],
                },
                {
                    "title": "Dar entrada a un documento repartiendo en varios almacenes",
                    "intro": "Una factura real trae mercancía para varios destinos: la carne al centro de producción, las bebidas al restaurante. Ya no hace falta darle entrada a todo en un almacén y transferir después.",
                    "steps": [
                        ("Abrí el documento del proveedor y tocá <span class='pill'>Dar entrada</span>.", "En Facturas y Notas (<span class='pill'>/dashboard/compras/documentos</span>). Se abre el modal <strong>Dar entrada al inventario</strong>."),
                        ("Camino rápido: elegí un almacén y confirmá.", "Si toda la factura va al mismo destino, no hay nada más que hacer."),
                        ("Para repartir, abrí <span class='pill'>Repartir en varios almacenes</span>.", "Cada línea muestra su propio selector; las que quedan en <span class='pill'>— destino general —</span> van al almacén principal elegido."),
                        ("Tocá <span class='pill'>Dar entrada</span>.", "Cada línea suma al stock de su almacén. El registro de auditoría lista los almacenes usados."),
                    ],
                },
                {
                    "title": "Configurar stock mínimo y punto de reorden",
                    "steps": [
                        ("Abrí la pestaña <span class='pill'>Stock Mín.</span>", "La pantalla <strong>Configurar Stock Mínimo y Punto de Reorden</strong>."),
                        ("Cargá mínimo y reorden por ítem.", "Con estos umbrales se arman las alertas del Dashboard y la pestaña Auto-Generar."),
                    ],
                },
            ],
        },

        # ================================================================
        # PROTEÍNAS
        # ================================================================
        {
            "name": "Proteínas",
            "route": "/dashboard/proteinas",
            "kicker": "Cocina y producción",
            "who": "Gerencia, chef y líderes de área",
            "what": (
                "El procesamiento de proteínas en cadena: de la pieza que llega del proveedor "
                "a los cortes y subproductos que usa la cocina (limpieza → maserado → "
                "distribución), registrando el desperdicio real de cada etapa. Las "
                "<strong>plantillas de procesamiento</strong> estandarizan la cadena para no "
                "armarla de cero cada vez, y al completar un procesamiento el inventario se "
                "actualiza solo."
            ),
            "features": [
                ("Plantillas de procesamiento", "Definen los cortes y subproductos esperados de cada proteína, con su orden en la cadena."),
                ("Registro por etapa", "Cada procesamiento asienta la entrada, los subproductos obtenidos y el desperdicio reportado en kilos."),
                ("Desperdicio controlado", "El desperdicio real se compara contra el promedio esperado — ahí se ve si un lote vino malo o si se está perdiendo de más."),
                ("Actualización de inventario", "Al completar, la materia prima baja y los cortes suben, cada uno con su movimiento."),
            ],
            "tasks": [
                {
                    "title": "Crear una plantilla de procesamiento",
                    "steps": [
                        ("Tocá <span class='pill'>Nueva Plantilla de Procesamiento</span>.", "Ruta <span class='pill'>/dashboard/proteinas</span>."),
                        ("Nombrá la plantilla y agregá los subproductos.", "Con <span class='pill'>Agregar subproducto</span> — cada corte con su nombre (ej. <em>Huesos de Pollo</em>) y su orden en la cadena."),
                        ("Guardá.", "La plantilla queda disponible para todos los procesamientos de esa proteína."),
                    ],
                },
                {
                    "title": "Registrar un procesamiento",
                    "steps": [
                        ("Tocá <span class='pill'>Nuevo Procesamiento</span>.", "Elegí la proteína, el proveedor si aplica y los datos del lote."),
                        ("Cargá los subproductos obtenidos y el desperdicio.", "Los pesos reales de cada corte y el <span class='pill'>Desperdicio Reportado (kg)</span>."),
                        ("Tocá <span class='pill'>Completar y Actualizar Inventario</span>.", "La materia prima se descuenta y los cortes entran al stock, con el desperdicio registrado."),
                    ],
                },
            ],
        },

        # ================================================================
        # MESONEROS
        # ================================================================
        {
            "name": "Mesoneros",
            "route": "/dashboard/mesoneros",
            "kicker": "Equipo de salón",
            "who": "Gerencia, RRHH y jefes de área (editar requiere el permiso Gestionar mesoneros)",
            "what": (
                "El listado de mesoneros del restaurante: nombre, apellido, estado activo, su "
                "PIN para identificarse en el POS Mesero y la marca de <strong>Capitán</strong> "
                "(que habilita dividir cuentas y transferir mesas). Los usuarios de mesonero "
                "rotan con el personal, así que quien supervisa el salón necesita poder "
                "renombrarlos para saber quién está usando cada usuario."
            ),
            "features": [
                ("Alta y edición", "Nombre, apellido y estado Activo/Inactivo por mesonero."),
                ("PIN de identificación", "PIN numérico de 4 a 6 dígitos para entrar al POS Mesero. Asignarlo o borrarlo es solo de gerencia."),
                ("Capitanes", "La marca de Capitán da permisos extra en el POS: dividir cuentas y transferir mesas."),
                ("Ver no es editar", "El módulo se puede ver con el rol; crear, renombrar o desactivar exige el permiso <strong>Gestionar mesoneros</strong>, concedido por persona."),
            ],
            "tasks": [
                {
                    "title": "Crear un mesonero",
                    "steps": [
                        ("Entrá a Mesoneros y creá uno nuevo.", "Ruta <span class='pill'>/dashboard/mesoneros</span>. La ficha pide nombre y apellido (ej. <em>Carlos López</em>)."),
                        ("Marcá <span class='pill'>Capitán</span> si corresponde.", "Solo los capitanes dividen cuentas y transfieren mesas en el POS."),
                        ("Guardá.", "El mesonero aparece en la lista del POS Mesero; sin PIN todavía no puede identificarse."),
                    ],
                },
                {
                    "title": "Renombrar un mesonero por rotación de personal",
                    "intro": "Cuando entra gente nueva al salón, el usuario de mesonero se renombra en vez de crear uno por persona — así el jefe de área siempre sabe quién está detrás de cada usuario.",
                    "steps": [
                        ("Tocá <span class='pill'>Editar</span> en la fila del mesonero.", "Se abre la ficha <strong>Editar mesonero</strong>."),
                        ("Cambiá nombre y apellido, y guardá.", "El historial de ventas y comandas del usuario se conserva; solo cambia a quién representa."),
                    ],
                    "callouts": [
                        ("warn", "Requiere el permiso Gestionar mesoneros", "Ver el módulo no alcanza para editar: las acciones exigen el permiso <strong>Gestionar mesoneros</strong>, que se concede por persona en <span class='pill'>Usuarios → Permisos</span> (gerencia y RRHH lo traen de base; a un jefe de área hay que concedérselo). Tras recibirlo, la persona debe cerrar sesión y volver a entrar."),
                    ],
                },
                {
                    "title": "Asignar o cambiar el PIN",
                    "steps": [
                        ("Abrí la ficha del mesonero.", "El campo <span class='pill'>PIN</span> acepta 4 a 6 dígitos numéricos; también existe <span class='pill'>Borrar PIN</span>."),
                        ("Guardá.", "El PIN permite al mesonero identificarse en el POS Mesero. Asignar o borrar PIN es exclusivo de gerencia (dueño, gerente administrativo o de operaciones)."),
                    ],
                    "callouts": [
                        ("info", "Este PIN no autoriza cobros", "El PIN de mesonero identifica en el POS Mesero (y el de capitán autoriza anulaciones); no habilita cobros ni descuentos — eso es del PIN de gerente."),
                    ],
                },
            ],
        },

        # ================================================================
        # SKU STUDIO
        # ================================================================
        {
            "name": "SKU Studio",
            "route": "/dashboard/sku-studio",
            "kicker": "Catálogo y SKU",
            "who": "Gerencia y chef",
            "what": (
                "La fábrica de códigos del inventario: define <strong>familias</strong> "
                "(ej. Carnes y proteínas, con su código corto) y <strong>plantillas</strong> "
                "que pre-rellenan los chips de tipo, unidad y seguimiento al crear ítems "
                "nuevos. Sirve para que los SKU salgan consistentes cuando se crean productos "
                "en lote, en vez de inventar códigos a mano."
            ),
            "features": [
                ("Familias con código", "Cada familia lleva nombre, código (ej. <em>CARN</em>), subcategoría opcional e ícono."),
                ("Plantillas de creación", "Pre-rellenan tipo de inventario, unidad base y seguimiento de stock para los SKU nuevos."),
                ("Chips guiados", "Tipo, unidad (KG, LT, UND…) y rol operativo se eligen con chips, no tipeando."),
                ("Catálogo a la vista", "La pestaña Catálogo muestra lo ya creado, para mantener la nomenclatura pareja."),
            ],
            "tasks": [
                {
                    "title": "Crear una familia",
                    "steps": [
                        ("Tocá <span class='pill'>Nueva familia</span>.", "Ruta <span class='pill'>/dashboard/sku-studio</span>."),
                        ("Cargá nombre y código.", "Ej. familia <em>Carnes y proteínas</em>, código <em>CARN</em>; subcategoría e ícono opcionales."),
                        ("Guardá.", "Los SKU de esa familia van a compartir el prefijo y la clasificación."),
                    ],
                },
                {
                    "title": "Crear productos usando una plantilla",
                    "steps": [
                        ("Elegí la familia y la plantilla.", "La plantilla trae pre-cargados el tipo de inventario, la unidad base y el seguimiento de stock."),
                        ("Completá nombre y formato de cada ítem.", "Ej. <em>Pechuga deshuesada MAP</em>, formato <em>KG</em>. El código se arma con el patrón de la familia."),
                        ("Guardá.", "Los ítems nacen en el inventario ya estandarizados, listos para costos y recetas."),
                    ],
                },
            ],
        },

        # ================================================================
        # ASISTENTE DE NOMENCLATURA
        # ================================================================
        {
            "name": "Asistente de Nomenclatura",
            "route": "/dashboard/asistente",
            "kicker": "Catálogo y SKU",
            "who": "Gerencia y chef",
            "what": (
                "Un asistente guiado para crear insumos con nombres y unidades estandarizadas "
                "(ej. <em>Pollo Pechuga Fresca</em>, <em>Pan de Pita 22cm</em>) siguiendo los "
                "estándares de nomenclatura de la casa, con sugerencia de SKU incluida. "
                "Además audita la conexión <strong>ventas → inventario</strong>: qué platos "
                "del menú tienen receta completa, cuáles la tienen vacía y cuáles no "
                "descuentan nada al vender."
            ),
            "features": [
                ("Creación guiada de insumos", "Nombre estandarizado, unidad correcta (las recetas de cócteles usan ML, por ejemplo) y SKU sugerido."),
                ("Registrar stock inicial", "El insumo recién creado puede arrancar con su stock cargado, sin pasar por Entrada."),
                ("Agregar a recetas", "Desde el mismo flujo se lleva el insumo nuevo a las recetas que lo necesitan."),
                ("Estado de conexión ventas → inventario", "Panel que separa platos con receta completa, receta vacía y sin receta — los dos últimos no descuentan inventario al vender."),
            ],
            "tasks": [
                {
                    "title": "Crear un insumo estandarizado",
                    "steps": [
                        ("Entrá al Asistente.", "Ruta <span class='pill'>/dashboard/asistente</span>."),
                        ("Seguí la guía: nombre, unidad y SKU.", "El asistente propone el formato estándar; podés registrar el stock inicial y el punto de alerta en el mismo paso."),
                        ("Usá <span class='pill'>Agregar a recetas</span> si aplica.", "El insumo queda creado en el inventario y conectado a las recetas que lo usan."),
                    ],
                },
                {
                    "title": "Auditar la conexión ventas → inventario",
                    "steps": [
                        ("Revisá el panel <span class='pill'>Estado de conexión ventas → inventario</span>.", "Separa los platos en <strong>Receta completa</strong>, <strong>Receta vacía</strong> y <strong>Sin receta</strong>."),
                        ("Completá lo que falte.", "Un plato sin receta (o con receta vacía) se vende sin descontar inventario. La meta es que el panel diga <em>¡Todos los platos tienen receta completa!</em> — salvo los platos sin receta a propósito, cuyo consumo entra por el Descargo manual."),
                    ],
                },
            ],
        },

        # ================================================================
        # MENÚ
        # ================================================================
        {
            "name": "Menú",
            "route": "/dashboard/menu",
            "kicker": "Menú y precios",
            "who": "Gerencia",
            "what": (
                "La carta que ve el POS: categorías, productos, precios y disponibilidad. "
                "Cada plato puede vincularse a su receta para que la venta descuente "
                "inventario, y hay dos formas de crear productos: el <strong>plato "
                "preparado</strong> (con receta multi-ingrediente que se completa después) y "
                "el <strong>producto de reventa</strong> (Pepsi, agua: vender 1 descuenta 1 "
                "del stock, sin receta que completar). También se administran los precios por "
                "canal (PedidosYA, WINK)."
            ),
            "features": [
                ("Categorías del menú", "Crear, renombrar y eliminar las categorías de la carta (Entradas, Cócteles, Postres…)."),
                ("Plato preparado", "Producto con receta multi-ingrediente; el sistema crea la receta y la marca para completar."),
                ("Producto de reventa", "Alta en un solo paso: crea el producto del menú, su ítem de inventario y la receta técnica 1:1 que descuenta al vender."),
                ("Estado de receta a la vista", "Cada plato indica si su receta está completa, sin ingredientes o si no existe — con acceso directo a crearla o completarla."),
                ("Precios por canal", "Columnas PYA $ y WINK $ para PedidosYA y WINK; vacío usa el precio base. Solo gerentes."),
                ("Búsqueda", "Buscá por plato para editar precio, nombre o disponibilidad sin recorrer la carta."),
            ],
            "tasks": [
                {
                    "title": "Crear una categoría",
                    "steps": [
                        ("Andá a <span class='pill'>Categorías del menú</span> y tocá <span class='pill'>Nueva categoría</span>.", "Ruta <span class='pill'>/dashboard/menu</span>."),
                        ("Nombrala y guardá.", "Ej.: <em>Entradas</em>, <em>Cócteles</em>. Las categorías ordenan el menú del POS."),
                    ],
                },
                {
                    "title": "Crear un plato preparado",
                    "steps": [
                        ("Tocá <span class='pill'>Nuevo plato preparado</span>.", "Para productos con receta multi-ingrediente (ej. <em>Shawarma Mixto</em>)."),
                        ("Completá nombre, categoría y precio.", "El sistema indica qué se va a crear automáticamente, incluida la receta vacía."),
                        ("Completá la receta.", "El plato queda marcado <em>Receta sin ingredientes — complétala</em>; el enlace lleva a Recetas y al guardar volvés al Menú. Hasta completarla, el plato se vende pero no descuenta inventario."),
                    ],
                },
                {
                    "title": "Crear un producto de reventa",
                    "steps": [
                        ("Tocá <span class='pill'>Producto de reventa</span>.", "Para productos que se compran y se venden tal cual: Pepsi 355ml, agua, cervezas."),
                        ("Completá nombre, precio, almacén y stock.", "En un solo paso se crean el producto del menú, el ítem de inventario con su stock y la receta técnica 1:1."),
                        ("Guardá.", "Vender 1 descuenta 1 del stock automáticamente. No hay receta que completar."),
                    ],
                },
                {
                    "title": "Cargar precios por canal (PedidosYA / WINK)",
                    "steps": [
                        ("Buscá el plato y editá las columnas <span class='pill'>PYA $</span> y <span class='pill'>WINK $</span>.", "Son los precios que usan los POS de PedidosYA y WINK."),
                        ("Dejá vacío para usar el precio base.", "El precio WINK es editable solo por gerentes."),
                    ],
                    "callouts": [
                        ("info", "¿Muchos precios distintos?", "Si el negocio maneja precios por canal de forma sistemática, el módulo <span class='pill'>Listas de precios</span> lo resuelve por lista completa en vez de plato por plato."),
                    ],
                },
            ],
        },

        # ================================================================
        # MODIFICADORES
        # ================================================================
        {
            "name": "Modificadores",
            "route": "/dashboard/menu/modificadores",
            "kicker": "Menú y precios",
            "who": "Gerencia",
            "what": (
                "Los grupos de opciones que el POS despliega al vender un plato: acompañantes, "
                "salsas, extras. Cada grupo define cuántas opciones se eligen (mínimo y "
                "máximo), cada opción puede sumar o restar precio, y — la parte que protege el "
                "inventario — cada opción puede descontar insumos propios al venderse. Un "
                "grupo se vincula a los platos donde debe aparecer."
            ),
            "features": [
                ("Grupos con mín/máx", "Ej. <em>Acompañante</em>: mínimo 1, máximo 2. Con 99 como máximo no hay límite."),
                ("Opciones con precio", "Cada modificador lleva su ajuste de precio (+/−$): <em>Extra queso +2</em>."),
                ("Descargo de inventario por opción", "A cada opción se le agregan insumos con su cantidad — al venderse, descuenta por unidad."),
                ("Vínculo a platos", "El grupo aparece en el POS solo en los platos a los que se aplica."),
                ("Aviso de opciones sin insumos", "El módulo señala los modificadores vinculados sin receta, que se venden sin descontar nada."),
            ],
            "tasks": [
                {
                    "title": "Crear un grupo de modificadores",
                    "steps": [
                        ("Tocá <span class='pill'>Crear Grupo de Modificadores</span>.", "Ruta <span class='pill'>/dashboard/menu/modificadores</span>."),
                        ("Nombrá el grupo y definí <span class='pill'>Mín.</span> y <span class='pill'>Máx.</span>", "Ej.: <em>Acompañante</em>, <em>Salsa</em>, <em>Extras</em>. El máximo 99 significa sin límite."),
                        ("Vinculalo a los platos.", "En <span class='pill'>Aplica a platos del POS</span>: sin el vínculo, el grupo no aparece al vender."),
                    ],
                },
                {
                    "title": "Agregar una opción que descuenta inventario",
                    "steps": [
                        ("Tocá <span class='pill'>Nuevo Modificador</span> dentro del grupo.", "Nombre (ej. <em>Tabule</em>, <em>Extra queso</em>) y su <span class='pill'>Precio (+/-$)</span>."),
                        ("En <span class='pill'>Descarga inventario de</span>, tocá <span class='pill'>Agregar insumo</span>.", "Buscá el insumo por nombre o SKU y cargá la cantidad que descuenta por unidad vendida."),
                        ("Guardá.", "Cada vez que el POS venda esa opción, el insumo baja del stock."),
                    ],
                    "callouts": [
                        ("warn", "Opciones sin insumos", "Un modificador vinculado sin insumos se vende sin descontar nada. El módulo los lista — revisá ese aviso al terminar. La excepción válida son los modificadores solo de precio (ej. <em>+Kibe $2</em> en un plato sin receta cuyo consumo entra por el Descargo manual)."),
                    ],
                },
            ],
        },

        # ================================================================
        # PROMOCIONES
        # ================================================================
        {
            "name": "Promociones",
            "route": "/dashboard/promociones",
            "kicker": "Menú y precios",
            "who": "Gerencia (activar y desactivar: solo el dueño)",
            "what": (
                "Descuentos automáticos por día y horario — el clásico happy hour. Se define "
                "a qué aplica, el tipo de descuento (porcentaje o monto fijo por unidad), los "
                "días y el rango de horas, y el POS lo aplica solo mientras la promoción está "
                "activa y dentro de su ventana. Si dos promociones se solapan, gana la de "
                "mayor prioridad."
            ),
            "features": [
                ("Descuento por porcentaje o fijo", "<span class='pill'>Porcentaje (%)</span> con tope opcional de descuento por unidad, o <span class='pill'>Monto por unidad ($)</span>."),
                ("Ventana de días y horas", "Días de la semana (vacío = todos), hora desde/hasta y fechas de vigencia opcionales."),
                ("Alcance configurable", "La promoción aplica a los productos o categorías que se elijan."),
                ("Prioridad ante solapes", "Si dos promociones alcanzan el mismo producto a la misma hora, gana la de prioridad mayor."),
                ("Interruptor solo del dueño", "Crear y editar es de gerencia; activar o desactivar una promoción es exclusivo del OWNER."),
            ],
            "tasks": [
                {
                    "title": "Crear un happy hour",
                    "steps": [
                        ("Tocá <span class='pill'>Nueva promoción</span>.", "Ruta <span class='pill'>/dashboard/promociones</span>. Ej.: <em>Happy Hour Cervezas</em>."),
                        ("Elegí el tipo de descuento y el valor.", "<span class='pill'>Porcentaje (%)</span> — con su tope por unidad si querés — o <span class='pill'>Fijo</span> con el monto por unidad."),
                        ("Definí a qué aplica y cuándo.", "Productos o categorías, días de la semana, horario (HH:MM) y fechas de vigencia opcionales."),
                        ("Guardá.", "La promoción queda creada; falta que el dueño la encienda."),
                    ],
                },
                {
                    "title": "Activar o desactivar una promoción",
                    "steps": [
                        ("Pedile al dueño que use el interruptor de la promoción.", "<strong>Solo el OWNER puede activar/desactivar</strong> — así los descuentos automáticos no se prenden sin la última firma."),
                        ("Verificá en el POS dentro de la ventana.", "El descuento se aplica solo en los días y horas configurados."),
                    ],
                },
            ],
        },

        # ================================================================
        # LISTAS DE PRECIOS
        # ================================================================
        {
            "name": "Listas de precios",
            "route": "/dashboard/menu/listas-precios",
            "kicker": "Menú y precios",
            "who": "Gerencia (el módulo aparece solo si el dueño activó la función)",
            "what": (
                "Precios distintos por canal de venta — delivery, WINK, restaurante — sin "
                "tocar el precio base del menú. Se crea una lista, se cargan los precios de "
                "los productos que difieren, y se activa para uno o más canales: la lista "
                "activa de cada canal define el precio de sus productos en ese canal. Sin "
                "listas activadas, el POS usa el precio base."
            ),
            "features": [
                ("Listas con nombre", "Ej.: <em>Precios Delivery</em>, <em>Precios Temporada Alta</em>."),
                ("Precio por producto", "Dentro de la lista se edita el precio de cada producto; lo no cargado sigue al precio base."),
                ("Canales donde aplica", "Cada lista declara sus canales; al activarla, esos canales la usan."),
                ("Apagado seguro", "Se puede desactivar o eliminar una lista y el canal vuelve al precio base."),
            ],
            "tasks": [
                {
                    "title": "Crear una lista y cargar precios",
                    "steps": [
                        ("Tocá <span class='pill'>Crear lista de precios</span>.", "Ruta <span class='pill'>/dashboard/menu/listas-precios</span>. Nombrala y elegí los canales donde aplica."),
                        ("Cargá los precios de los productos.", "Buscá cada producto y poné su precio para esta lista; los demás siguen con el precio base."),
                    ],
                },
                {
                    "title": "Activar la lista de un canal",
                    "steps": [
                        ("Tocá <span class='pill'>Activar</span> en la lista.", "La lista activa de cada canal define el precio de sus productos en ese canal."),
                        ("Verificá en el POS del canal.", "Sin listas activadas, el POS usa el precio base del menú."),
                    ],
                    "callouts": [
                        ("info", "¿No ves el módulo?", "Listas de precios está detrás de una función que el dueño activa por instalación. Si no aparece en el menú, no está encendida."),
                    ],
                },
            ],
        },

        # ================================================================
        # CLIENTES
        # ================================================================
        {
            "name": "Clientes",
            "route": "/dashboard/clientes",
            "kicker": "Clientes",
            "who": "Gerencia, cajera y chef",
            "what": (
                "La cartera de clientes del negocio: la ficha de cada uno (cédula o RIF, "
                "teléfono, dirección de delivery, notas de preferencias) y su historial de "
                "compras con total gastado, ticket promedio y última visita. Sirve para el "
                "delivery — la dirección ya cargada — y para conocer a los habituales."
            ),
            "features": [
                ("Ficha completa", "Nombre completo, cédula/RIF (V-, E-, J-), teléfono, email, dirección de delivery y notas (ej. <em>sin cebolla</em>)."),
                ("Búsqueda", "Por nombre, cédula, teléfono o email."),
                ("Historial de compras", "Cada pedido con fecha, ítems y total; arriba, el total gastado, el ticket promedio y la última visita."),
                ("Cédula opcional", "Si el cliente no tiene cédula, el campo se deja vacío — no inventar números."),
            ],
            "tasks": [
                {
                    "title": "Crear un cliente",
                    "steps": [
                        ("Tocá <span class='pill'>Nuevo cliente</span>.", "Ruta <span class='pill'>/dashboard/clientes</span>."),
                        ("Completá la ficha.", "El nombre completo es lo único obligatorio; cédula/RIF, teléfono, email y la dirección de delivery ayudan después."),
                        ("Tocá <span class='pill'>Guardar</span>.", "El cliente queda disponible para asociarlo a pedidos."),
                    ],
                },
                {
                    "title": "Consultar el historial de un cliente",
                    "steps": [
                        ("Buscalo por nombre, cédula o teléfono.", "Y abrí su ficha."),
                        ("Revisá el historial de compras.", "Pedidos con fecha e ítems, total gastado, ticket promedio y última visita — la foto de qué tan habitual es."),
                    ],
                },
            ],
        },

        # ================================================================
        # SATISFACCIÓN
        # ================================================================
        {
            "name": "Satisfacción",
            "route": "/dashboard/encuestas",
            "kicker": "Clientes",
            "who": "Gerencia y auditoría",
            "what": (
                "Los resultados de las encuestas de satisfacción que se llenan en el POS al "
                "cerrar cada mesa. El módulo arma el reporte del día: promedio, distribución "
                "de respuestas (cuántas Excelente y Buena), el detalle de cada respuesta y el "
                "corte <strong>por mesonero</strong> — la forma más directa de saber cómo "
                "atendió cada uno."
            ),
            "features": [
                ("Reporte por día", "Se elige la fecha y se ven las encuestas registradas ese día."),
                ("Promedio y distribución", "Calificación promedio y cuánto pesa Excelente + Buena sobre el total."),
                ("Corte por mesonero", "Las respuestas agrupadas por quién atendió la mesa."),
                ("Detalle de respuestas", "Cada encuesta individual, con su calificación por aspecto (ej. calidad)."),
            ],
            "tasks": [
                {
                    "title": "Revisar los resultados del día",
                    "steps": [
                        ("Entrá a Satisfacción y elegí la fecha.", "Ruta <span class='pill'>/dashboard/encuestas</span>."),
                        ("Mirá promedio y distribución.", "Si un día no tiene encuestas, la pantalla lo dice — puede ser señal de que en el POS no se están llenando."),
                    ],
                },
                {
                    "title": "Comparar el desempeño por mesonero",
                    "steps": [
                        ("Bajá a la sección <span class='pill'>Por mesonero</span>.", "Respuestas y promedio de cada uno."),
                        ("Cruzá con el detalle.", "El <span class='pill'>Detalle de respuestas</span> muestra cada encuesta individual, para entender qué hay detrás de un promedio bajo."),
                    ],
                },
            ],
        },
    ],
}
