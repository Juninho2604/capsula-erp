# -*- coding: utf-8 -*-
"""Contenido de la Guía de uso por rol — KPSULA. Datos factuales (OPUS_CONTEXT)."""

# ============================================================================
# INTRO / TEXTOS GENERALES
# ============================================================================
INTRO = {
    "how_to_read":
        "Esta guía está organizada por rol: cada persona del equipo encuentra su propia sección "
        "con las tareas que hace todos los días, explicadas paso a paso. No necesitas leerla "
        "completa — ve directo a tu rol. Si quieres entender el sistema en general, empieza por "
        "“El sistema en 2 minutos”.",

    "system_2min":
        "KPSULA es el sistema que une todo el negocio en un solo lugar: el punto de venta (POS) "
        "donde se toman y cobran pedidos, el inventario y la producción de cocina, las compras, "
        "la caja y los reportes. Cada quien ve solo lo que le corresponde según su rol — la "
        "pantalla se adapta sola.",
    "login_steps": [
        ("Abre KPSULA en el navegador o la app instalada.", "Aparece la pantalla de inicio de sesión."),
        ("Ingresa tu correo y contraseña.", "Son los que te asignó el administrador. La contraseña tiene mínimo 6 caracteres."),
        ("Entras al sistema.", "Vas directo a tu pantalla principal. El menú lateral (sidebar) muestra solo tus módulos."),
    ],
    "login_note":
        "El POS Mesero y las cobranzas no usan correo y contraseña: usan un PIN numérico de "
        "4 a 6 dígitos. Es más rápido para el ritmo del salón y no expone tu cuenta.",
    "sidebar_note":
        "El sistema aplica un triple filtro antes de mostrarte un módulo: que esté activado en la "
        "instalación, que tu rol tenga permiso, y que esté dentro de tu lista personal (si tienes "
        "una asignada). Por eso dos personas con el mismo cargo pueden ver pantallas distintas.",

    "roles_map":
        "El sistema tiene 9 roles. El número de nivel indica el alcance de acceso: a mayor "
        "número, más amplio. Nadie puede gestionar a un rol de nivel igual o superior al suyo.",
    "levels_note":
        "Los niveles van de 100 (OWNER, acceso total) a 15 (Mesonero y Comandera, acceso muy "
        "acotado). El nivel no es un rango de jerarquía laboral: es cuánto del sistema toca cada rol.",

    "modules_map":
        "KPSULA agrupa sus 47 módulos en cuatro grandes áreas. No todos están activos en cada "
        "instalación: el OWNER decide cuáles se encienden. Esta es la lista completa de referencia.",

    "glossary":
        "Términos que vas a leer en toda la guía y en las pantallas del sistema. Tenlos a mano "
        "las primeras semanas.",

    # Anexo B — pagos
    "payments_intro":
        "El POS acepta varios métodos. Los que se cobran en bolívares se convierten con la tasa "
        "del día cargada en el sistema. La cajera puede cobrar con un solo método o combinar "
        "varios en un mismo pago (pago mixto).",
    "payments": [
        ("Cash $", "Efectivo en dólares (USD)."),
        ("Cash €", "Efectivo en euros (EUR)."),
        ("Zelle", "Transferencia Zelle en USD."),
        ("Efectivo Bs", "Efectivo en bolívares. Se convierte con la tasa del día."),
        ("PDV Shanklish", "Punto de venta (tarjeta) en bolívares."),
        ("PDV Superferro", "Punto de venta alterno en bolívares."),
        ("Pago Móvil NG", "Pago móvil en bolívares."),
        ("Cortesía", "Cuenta cubierta por la casa. Requiere PIN de gerente."),
    ],
    "payment_rules": [
        ("info", "Tasa del día", "Los métodos en bolívares (Efectivo Bs, PDV, Pago Móvil) usan la tasa cargada en <span class='pill'>Tasa de cambio</span>. Si la tasa no está actualizada, avisa a administración antes de cobrar."),
        ("warn", "Requiere autorización", "Los descuentos (divisas 33%, cortesía total o parcial) y las anulaciones piden <strong>PIN de gerente</strong>. La cajera sola no puede aplicarlos."),
        ("ok", "Redondeo", "El total se redondea al entero solo en Cash $, Zelle y Efectivo Bs. En PDV y Pago Móvil se cobra el monto exacto."),
        ("info", "Servicio 10%", "En restaurante hay un interruptor de <span class='pill'>+10% servicio</span> por cuenta. Cuando está activo, suma 10% al total. Cada subcuenta lo maneja por separado."),
    ],
}

# ============================================================================
# MAPA DE MÓDULOS (47)
# ============================================================================
MODULES = [
    ("Operaciones — 20 módulos", [
        ("Dashboard", "Resumen del día: ventas, cuentas abiertas, stock bajo y última actividad."),
        ("Estadísticas", "Análisis en tiempo real, adaptado a cada rol. Lo ven todos."),
        ("Inventario Diario", "Rutina diaria: abrir → contar → sincronizar ventas → comparar teórico vs real → cerrar."),
        ("Inventario", "Catálogo de insumos y stock por área."),
        ("Conteo Físico (Excel)", "Importar conteos desde Excel y generar ajustes."),
        ("Auditorías", "Foto del stock, conteo y, al aprobar, ajuste automático."),
        ("Transferencias", "Mover stock entre áreas: solicitud → despacho → aprobación → recepción."),
        ("Historial Mensual", "Movimientos de inventario filtrables por mes, área y tipo."),
        ("Préstamos", "Prestar stock y resolverlo con reposición o pago."),
        ("Mesoneros", "Alta y gestión de mesoneros, su PIN y si son capitanes."),
        ("Recetas", "Recetas con ingredientes y costo calculado (incluye sub-recetas)."),
        ("Producción", "Producir recetas: descuenta ingredientes y suma el resultado."),
        ("Costos", "Cargar y actualizar costos de insumos."),
        ("Margen por Plato", "Precio de venta menos costo = margen, ordenado por rentabilidad."),
        ("Compras", "Órdenes de compra, recepción, proveedores y alertas de bajo stock."),
        ("Proteínas", "Procesar proteínas en cadena (limpieza → maserado → distribución)."),
        ("Asistente de Nomenclatura", "Crear insumos estandarizados y sugerir SKU."),
        ("SKU Studio", "Familias y plantillas de SKU para crear productos en lote."),
        ("Menú", "Productos de venta, precios y vínculo con su receta."),
        ("Modificadores", "Grupos de modificadores (extras, opciones) y su descargo de inventario."),
    ]),
    ("Ventas / POS — 9 módulos", [
        ("POS Restaurante", "Punto de venta completo: mesas, pickup, subcuentas y cobro."),
        ("POS Mesero", "Vista simplificada para tomar pedidos y enviar a cocina. No cobra."),
        ("POS Delivery", "Venta directa para delivery, con tarifa de envío."),
        ("PedidosYA", "Órdenes de PedidosYA. No cobra (lo cobra la plataforma)."),
        ("Cargar Ventas", "Carga manual de ventas externas."),
        ("Historial de Ventas", "Listado de ventas, Reporte Z, arqueo y anulaciones."),
        ("Comandera Cocina", "Pantalla de cocina: comandas pendientes (sin bebidas)."),
        ("Comandera Barra", "Pantalla de barra: solo bebidas."),
        ("Configuración POS", "Ajustes por terminal: impresión y validación de stock."),
    ]),
    ("Administración — 14 módulos", [
        ("Usuarios", "Alta de usuarios, roles, PIN, permisos y reseteo de contraseña."),
        ("Módulos por Usuario", "Definir qué módulos ve cada usuario individual."),
        ("Roles y Permisos", "Reasignar el rol base respetando la jerarquía."),
        ("Módulos", "El OWNER enciende o apaga módulos de toda la instalación."),
        ("Almacenes", "Alta y gestión de áreas / almacenes."),
        ("Tasa de Cambio", "Registrar la tasa Bs/USD que usa el POS."),
        ("Objetivos y Metas", "Metas de venta diaria, semanal y mensual."),
        ("Anuncios a Gerencia", "Avisos por rol, con campana en la barra superior."),
        ("Dashboard Financiero", "Estado de resultados mensual, flujo de caja y exportación."),
        ("Gastos", "Registro de gastos por categoría, con exportación a Excel."),
        ("Control de Caja", "Apertura y cierre de caja, cuadre y desglose de billetes."),
        ("Cuentas por Pagar", "Deudas a proveedores, antigüedad y pagos parciales."),
        ("Intercompany", "Liquidación entre los negocios (Shanklish y Table Pong)."),
        ("Entrada de Mercancía", "Registrar compras recibidas que ingresan al stock."),
    ]),
    ("Entretenimiento (Table Pong) — 4 módulos", [
        ("Juegos", "Estaciones de juego, sesiones y facturación por hora o pulsera."),
        ("Reservaciones", "Reserva de estación, con estados de confirmación y check-in."),
        ("Pulseras", "Planes de pulsera: duración, precio y color."),
        ("Cola de Espera", "Turnos de espera: llamado, sentado o expirado."),
    ]),
]

# ============================================================================
# GLOSARIO
# ============================================================================
GLOSSARY = [
    ("Cuenta / Tab", "El consumo abierto de una mesa o cliente. Tiene un código único y se mantiene abierto hasta que se cobra."),
    ("Comanda", "El pedido que se envía a cocina o barra para preparar."),
    ("Comandera", "La pantalla donde cocina y barra ven las comandas pendientes y las marcan como listas."),
    ("Pickup Tab", "Cuenta de mostrador (para llevar), numerada PK-01, PK-02… sin mesa física."),
    ("Subcuenta", "División de una cuenta en partes que se cobran por separado. Cada una es una factura independiente."),
    ("Capitán", "Mesonero con permisos extra: puede dividir cuentas y transferir mesas."),
    ("Servicio 10%", "Cargo opcional del 10% sobre el consumo en restaurante."),
    ("PIN", "Clave numérica de 4 a 6 dígitos para identificarse o autorizar acciones rápidas en el POS."),
    ("Requisición / Transferencia", "Solicitud para mover stock de un área a otra (ej. de depósito a barra)."),
    ("Reporte Z", "Cierre de ventas del día agrupado por método de pago. Base del arqueo de caja."),
    ("Tasa del día", "El valor del dólar en bolívares cargado en el sistema, que usa el POS para convertir."),
    ("SKU", "Código único de cada insumo o producto en el inventario."),
]

# ============================================================================
# ROLES (10)
# ============================================================================
ROLES = [
    # ---------------------------------------------------------------- OWNER
    {
        "code": "OWNER", "level": 100, "name": "Dueño (Owner)", "kicker": "Acceso total",
        "tagline": "Control completo del sistema y la configuración",
        "desc": "Tiene acceso a todo sin excepción y es el único que enciende o apaga módulos para "
                "todo el negocio. Define la configuración global: tasa de cambio, roles y permisos.",
        "chips": [("Todos los módulos", True), ("Configuración global", True), ("Costos y finanzas", True)],
        "day": "Revisa el dashboard y las finanzas, ajusta la tasa del día si hace falta, y supervisa "
               "que cada quien tenga los accesos correctos. En el día a día casi no toca el POS, pero "
               "es quien habilita todo lo demás.",
        "tasks": [
            {"title": "Activar o desactivar un módulo",
             "intro": "Solo el OWNER puede cambiar qué módulos existen para todo el negocio. Es el "
                      "interruptor maestro: si un módulo está apagado aquí, nadie lo ve, sin importar su rol.",
             "steps": [
                ("Entra a Configuración → Módulos.", "Ruta <span class='pill'>/dashboard/config/modules</span>. Solo aparece para vos."),
                ("Revisa el catálogo de módulos.", "Cada módulo muestra su nombre, categoría y un interruptor de encendido."),
                ("Enciende o apaga los que quieras.", "El cambio afecta a toda la instalación de inmediato."),
                ("Guarda.", "La lista de módulos activos queda registrada en la configuración del sistema."),
             ],
             "callouts": [("warn", "Con criterio", "Apagar un módulo lo oculta para todos. Si una cajera “perdió” una pantalla, lo primero a revisar es si el módulo sigue encendido aquí.")]},
            {"title": "Cargar la tasa de cambio del día",
             "intro": "El POS convierte a bolívares con esta tasa. Cargarla cada día (o cuando cambie) es clave para que los cobros en Bs salgan correctos.",
             "steps": [
                ("Entra a Configuración → Tasa de cambio.", "Ruta <span class='pill'>/dashboard/config/tasa-cambio</span>."),
                ("Ingresa la tasa Bs/USD y la fecha de vigencia.", "Es el valor del dólar que usará el POS."),
                ("Guarda.", "Desde ese momento, cada venta toma esta tasa y la deja registrada en el comprobante."),
             ],
             "callouts": [("info", "Queda registrada", "Cada venta guarda la tasa con la que se cobró, así un reporte viejo no cambia si mañana la tasa sube.")]},
            {"title": "Ver costos y rentabilidad",
             "intro": "El OWNER ve los costos de cada plato y el margen, información que la mayoría de los roles no puede ver.",
             "steps": [
                ("Entra a Costos o Margen por Plato.", "Bajo Operaciones."),
                ("Revisa el margen.", "El sistema calcula precio de venta menos costo de receta, ordenado por rentabilidad."),
             ]},
        ],
        "can": ["Encender / apagar módulos del negocio", "Configuración global (tasa, roles, POS)",
                "Ver costos, márgenes y finanzas", "Gestionar usuarios, PIN y permisos", "Todo lo de los demás roles"],
        "cant": ["(No tiene restricciones en el sistema)"],
    },
    # ------------------------------------------------------------- AUDITOR
    {
        "code": "AUDITOR", "level": 90, "name": "Auditor", "kicker": "Solo lectura",
        "tagline": "Mira todo, controla el inventario, no modifica operaciones",
        "desc": "Ve todo el sistema en modo lectura y se especializa en auditorías de inventario y "
                "reportes. Es el rol de control: detecta diferencias sin alterar el día a día.",
        "chips": [("Inventario (lectura)", True), ("Auditorías", True), ("Reportes y finanzas (lectura)", True)],
        "day": "Recorre reportes de ventas y finanzas, y levanta auditorías de inventario para comparar "
               "lo que dice el sistema contra el conteo físico real.",
        "tasks": [
            {"title": "Hacer una auditoría de inventario",
             "intro": "Una auditoría congela el stock que el sistema cree tener, lo comparás con el conteo real y, al aprobar, el sistema ajusta solo las diferencias.",
             "steps": [
                ("Entra a Inventario → Auditorías y crea una nueva.", "El sistema toma una foto del stock actual por ítem."),
                ("Cuenta físicamente y carga las cantidades reales.", "Ítem por ítem; el sistema muestra la diferencia contra lo esperado."),
                ("Aprueba la auditoría.", "Por cada diferencia genera un ajuste automático (entrada o salida) y corrige el stock."),
             ],
             "callouts": [("info", "Trazable", "Cada ajuste queda registrado con su motivo, así siempre se sabe quién contó y cuándo.")]},
            {"title": "Revisar reportes",
             "intro": "El auditor consulta finanzas, gastos, caja, cuentas por pagar e historial de ventas, todo en lectura.",
             "steps": [
                ("Entra al módulo que quieras revisar.", "Finanzas, Historial de Ventas, Gastos, Caja…"),
                ("Filtra por fecha o período.", "Los datos son de solo consulta: puedes analizar y exportar, pero no editar."),
             ]},
        ],
        "can": ["Ver todo el sistema (lectura)", "Crear y aprobar auditorías de inventario",
                "Consultar reportes financieros y de ventas", "Exportar información"],
        "cant": ["Tomar pedidos o cobrar en el POS", "Crear o editar en operaciones",
                 "Gestionar usuarios", "Cambiar la configuración"],
    },
    # ------------------------------------------------------- ADMIN_MANAGER
    {
        "code": "ADMIN_MANAGER", "level": 80, "name": "Gerente Administrativo", "kicker": "Administración y finanzas",
        "tagline": "Gestiona usuarios, finanzas y reportes del negocio",
        "desc": "Lleva la administración y las finanzas: da de alta usuarios, asigna PIN y permisos, "
                "revisa el estado de resultados y arma los reportes de ventas.",
        "chips": [("Usuarios", True), ("Finanzas", True), ("Reportes de ventas", True), ("Operaciones", False)],
        "day": "Crea y ajusta usuarios, controla el P&L del mes, exporta reportes y revisa el cierre "
               "de ventas. Es el brazo derecho del OWNER en lo administrativo.",
        "tasks": [
            {"title": "Crear un usuario nuevo",
             "intro": "Cada persona del equipo necesita su propio acceso. El gerente administrativo los da de alta y les asigna su rol.",
             "steps": [
                ("Entra a Usuarios y toca “Nuevo Usuario”.", "Ruta <span class='pill'>/dashboard/usuarios</span>."),
                ("Completa nombre, apellido, correo y contraseña.", "La contraseña tiene mínimo 6 caracteres y se guarda cifrada."),
                ("Asígnale un rol.", "Solo puedes asignar roles de nivel inferior al tuyo."),
                ("Guarda.", "El usuario ya puede entrar con su correo y contraseña."),
             ],
             "callouts": [("warn", "Jerarquía", "No puedes crear ni editar a alguien de tu mismo nivel o superior. Un gerente no puede tocar a un OWNER.")]},
            {"title": "Asignar PIN y permisos a un usuario",
             "intro": "El PIN sirve para acciones rápidas en el POS. Los permisos granulares amplían o recortan lo que un rol puede hacer.",
             "steps": [
                ("Abre el usuario en Usuarios.", "Vas a ver sus secciones de módulos, PIN y permisos."),
                ("Asígnale un PIN numérico de 4 a 6 dígitos.", "Queda como “Asignado”. El usuario no puede cambiar su propio PIN desde aquí."),
                ("Ajusta permisos si hace falta.", "Las casillas muestran tres estados: base (gris), concedido (verde) o revocado (rojo)."),
             ],
             "callouts": [("info", "Permisos finos", "Hay 17 permisos puntuales (anular orden, aplicar descuento, abrir caja, ver costos…) que se conceden o quitan por persona.")]},
            {"title": "Ver finanzas y exportar",
             "intro": "El estado de resultados mensual resume ventas, costos, utilidad y gastos en una sola pantalla.",
             "steps": [
                ("Entra a Dashboard Financiero y elige mes y año.", "Ruta <span class='pill'>/dashboard/finanzas</span>."),
                ("Revisa el P&L, el flujo de caja y las alertas.", "Incluye comparación contra el mes anterior."),
                ("Toca “Exportar Excel”.", "Descarga el P&L completo para compartir o archivar."),
             ]},
            {"title": "Sacar el Reporte Z del día",
             "intro": "El Reporte Z es el cierre de ventas agrupado por método de pago: la base del arqueo.",
             "steps": [
                ("Entra a Historial de Ventas y elige la fecha.", "Ruta <span class='pill'>/dashboard/sales</span>."),
                ("Abre el Reporte Z.", "Agrupa por método, calcula Bs y USD, servicio, descuentos y anulaciones."),
                ("Usa el arqueo para exportar a Excel.", "Sirve para cuadrar contra el efectivo y los puntos de venta."),
             ]},
        ],
        "can": ["Crear y editar usuarios (roles inferiores)", "Asignar PIN y permisos",
                "Resetear contraseñas de otros", "Ver finanzas, costos y reportes", "Exportar"],
        "cant": ["Encender / apagar módulos (eso es del OWNER)", "Entrar a la configuración global",
                 "Gestionar roles iguales o superiores al suyo"],
    },
    # --------------------------------------------------------- OPS_MANAGER
    {
        "code": "OPS_MANAGER", "level": 70, "name": "Gerente de Operaciones", "kicker": "Operaciones e inventario",
        "tagline": "Dueño del inventario, la producción y las compras",
        "desc": "Maneja todo lo operativo: inventario diario, producción, transferencias entre áreas, "
                "compras y proteínas. Aprueba movimientos de stock y cierra el inventario del día.",
        "chips": [("Inventario", True), ("Producción", True), ("Compras", True), ("Transferencias", True)],
        "day": "Abre y cierra el inventario diario, aprueba requisiciones entre áreas, registra la "
               "mercancía que llega y coordina la producción de cocina.",
        "tasks": [
            {"title": "Llevar el inventario diario",
             "intro": "La rutina diaria asegura que el stock del sistema coincida con la realidad, comparando contra las ventas del POS.",
             "mock": ("Inventario Diario — flujo", [
                 [("Abrir día", False), ("Contar", False), ("Sincronizar ventas", True)],
                 [("Teórico vs real", False), ("Varianza", False), ("Cerrar", False)],
             ]),
             "steps": [
                ("Abre el día en Inventario Diario.", "Ruta <span class='pill'>/dashboard/inventario/diario</span>, elige fecha y área."),
                ("Cuenta los ítems y guarda las cantidades.", "El conteo físico de cada insumo."),
                ("Sincroniza las ventas del POS.", "El sistema descuenta lo vendido para calcular el stock teórico."),
                ("Revisa teórico vs real y cierra.", "La diferencia es la varianza (merma o faltante); al cerrar queda registrada."),
             ]},
            {"title": "Aprobar una transferencia entre áreas",
             "intro": "Cuando un área pide stock a otra (ej. barra pide a depósito), el movimiento pasa por varias etapas hasta completarse.",
             "steps": [
                ("Producción despacha lo solicitado.", "Sale del área de origen."),
                ("Vos aprobás con las cantidades realmente recibidas.", "Como gerente, confirmás lo que efectivamente llegó."),
                ("Se recibe y se completa.", "El stock se mueve de un área a la otra y queda registrado como transferencia."),
             ]},
            {"title": "Registrar entrada de mercancía",
             "intro": "Cuando llega una compra, se registra para que ingrese al stock y actualice el costo.",
             "steps": [
                ("Entra a Inventario → Entrada de mercancía.", "Ruta <span class='pill'>/dashboard/inventario/entrada</span>."),
                ("Carga los ítems recibidos y sus cantidades.", "Genera un movimiento de compra y actualiza el costo del insumo."),
             ]},
        ],
        "can": ["Gestionar inventario, producción y compras", "Aprobar transferencias y requisiciones",
                "Cerrar el inventario diario", "Asignar y cambiar PIN", "Registrar entrada de mercancía"],
        "cant": ["Gestionar usuarios (panel reservado a OWNER/Admin)", "Configuración global",
                 "Cobrar en el POS (salvo que tenga el módulo asignado)"],
    },
    # --------------------------------------------------------------- CHEF
    {
        "code": "CHEF", "level": 50, "name": "Chef", "kicker": "Cocina y producción",
        "tagline": "Crea recetas y ejecuta la producción de cocina",
        "desc": "Define las recetas con sus ingredientes y costos, y ejecuta la producción que "
                "descuenta insumos y genera los productos terminados. Ve el inventario y maneja proteínas.",
        "chips": [("Recetas", True), ("Producción", True), ("Inventario", False), ("Proteínas", True)],
        "day": "Crea y ajusta recetas, corre las producciones del día y procesa proteínas. Es quien "
               "traduce los insumos en platos listos para vender.",
        "tasks": [
            {"title": "Crear una receta",
             "intro": "Una receta lista sus ingredientes y deja que el sistema calcule el costo. Si un ingrediente es a su vez una sub-receta, el costo se calcula en cadena.",
             "steps": [
                ("Entra a Recetas → Nueva.", "Ruta <span class='pill'>/dashboard/recetas/nueva</span>."),
                ("Agrega los ingredientes y sus cantidades.", "El sistema suma el costo de cada uno automáticamente."),
                ("Guarda.", "La receta queda disponible para producir y para vincular a un producto del menú."),
             ],
             "callouts": [("info", "Costo automático", "Si un ingrediente tiene su propia receta, el sistema lo costea recursivamente: nunca tienes que calcular a mano.")]},
            {"title": "Hacer una producción",
             "intro": "Producir una receta descuenta los ingredientes del stock y suma el producto terminado.",
             "steps": [
                ("Entra a Producción y elige la receta.", "Ruta <span class='pill'>/dashboard/produccion</span>."),
                ("Indica la cantidad a producir.", "El sistema verifica que haya ingredientes suficientes."),
                ("Confirma.", "Descuenta los insumos y suma el resultado al inventario."),
             ]},
        ],
        "can": ["Crear y editar recetas", "Ejecutar producción", "Procesar proteínas",
                "Ver inventario, hacer conteos y transferencias", "Gestionar compras"],
        "cant": ["Tomar pedidos o cobrar en el POS", "Gestionar usuarios o finanzas", "Tocar la configuración"],
    },
    # ---------------------------------------------------------- AREA_LEAD
    {
        "code": "AREA_LEAD", "level": 40, "name": "Líder de Área", "kicker": "Gestión de área",
        "tagline": "Coordina su área y puede operar el POS Restaurante",
        "desc": "Responsable de un área específica. Maneja su inventario y operaciones, aprueba "
                "transferencias y, según la configuración, opera el POS Restaurante.",
        "chips": [("Inventario de área", True), ("Transferencias", True), ("POS Restaurante", True)],
        "day": "Supervisa su área, aprueba movimientos de stock y, cuando le toca, abre y opera el "
               "POS Restaurante como un punto de venta más.",
        "tasks": [
            {"title": "Aprobar transferencias de su área",
             "intro": "El líder de área tiene permiso base para aprobar el movimiento de stock que entra o sale de su área.",
             "steps": [
                ("Revisa las transferencias pendientes.", "En el módulo Transferencias."),
                ("Confirma las cantidades recibidas o despachadas.", "Tu aprobación mueve el stock entre áreas."),
             ]},
            {"title": "Operar el POS Restaurante",
             "intro": "Si tu usuario tiene el módulo asignado, puedes trabajar el POS completo: mesas, pedidos y cobro.",
             "steps": [
                ("Entra a POS Restaurante.", "Ruta <span class='pill'>/dashboard/pos/restaurante</span>."),
                ("Opera como punto de venta.", "Sigue el flujo de mesa, pedido y cobro descrito en la sección de Cajera."),
             ]},
        ],
        "can": ["Gestionar el inventario de su área", "Aprobar transferencias",
                "Operar el POS Restaurante (si lo tiene asignado)", "Producción, compras, conteos"],
        "cant": ["Administración, finanzas y usuarios", "Configuración global"],
    },
    # ------------------------------------------------------- KITCHEN_CHEF
    {
        "code": "KITCHEN_CHEF", "level": 15, "name": "Comandera de Cocina", "kicker": "Pantalla de cocina",
        "tagline": "Ve las comandas y las marca como listas",
        "desc": "Su pantalla es la comandera: muestra los pedidos que llegan de los mesoneros y le "
                "permite marcarlos como listos. Solo ve y despacha; no toma pedidos ni cobra.",
        "chips": [("Comandera Cocina", True), ("Comandera Barra", True)],
        "day": "Mira la pantalla de cocina (o barra), prepara lo que va llegando y marca cada comanda "
               "como lista cuando sale el plato.",
        "tasks": [
            {"title": "Ver y despachar comandas",
             "intro": "La comandera se actualiza sola con los pedidos enviados desde el POS Mesero. Cocina ve todo menos bebidas; barra ve solo bebidas.",
             "mock": ("Comandera — Cocina", [
                 [("Mesa 4 · 2 platos", True), ("Mesa 7 · 1 plato", False)],
                 [("Pickup PK-02", False), ("Mesa 1 · 3 platos", False)],
             ]),
             "steps": [
                ("Abre la comandera.", "Cocina en <span class='pill'>/kitchen</span>, barra en <span class='pill'>/kitchen/barra</span>. Es pantalla completa, sin menú lateral."),
                ("Mira las comandas pendientes.", "Llegan automáticamente; no hace falta recargar."),
                ("Marca la comanda como lista al terminar.", "Desaparece de pendientes; el salón sabe que el plato salió."),
             ],
             "callouts": [("info", "Reimprimir", "Si una comanda no se imprimió bien, se puede reimprimir desde la misma pantalla.")]},
        ],
        "can": ["Ver comandas de su estación", "Marcar comandas como listas", "Reimprimir comandas"],
        "cant": ["Tomar pedidos", "Cobrar", "Ver inventario o reportes", "Entrar al resto del sistema"],
    },
    # ------------------------------------------------------------ CASHIER
    {
        "code": "CASHIER", "level": 20, "name": "Cajera", "kicker": "Punto de venta y caja",
        "tagline": "Cobra las cuentas, abre y cierra la caja",
        "desc": "El corazón del cobro. Cobra las cuentas de mesa y mostrador con cualquier método de "
                "pago, divide cuentas, imprime pre-cuentas y maneja la apertura y el cierre de caja.",
        "chips": [("POS Restaurante", True), ("Control de Caja", True), ("Historial de Ventas", True)],
        "day": "Abre la caja al empezar el turno, cobra durante el servicio combinando métodos de "
               "pago, divide cuentas cuando lo piden, y al final cuadra y cierra la caja.",
        "tasks": [
            {"title": "Abrir la caja al empezar el turno",
             "intro": "Antes de cobrar, se abre la caja declarando el fondo inicial. Así, al cerrar, el sistema sabe con cuánto arrancaste.",
             "steps": [
                ("Entra a Control de Caja y abre la caja.", "Ruta <span class='pill'>/dashboard/caja</span>."),
                ("Carga el fondo inicial en USD y Bs.", "Con desglose de billetes, para un cuadre exacto."),
                ("Confirma las operadoras del turno.", "Queda registrado quién opera la caja."),
             ]},
            {"title": "Cobrar una cuenta de mesa",
             "intro": "El flujo va de elegir la mesa a registrar el pago. Puedes cobrar con un método o combinar varios (pago mixto).",
             "mock": ("POS Restaurante — cobro", [
                 [("Cash $", False), ("Zelle", False), ("Efectivo Bs", False)],
                 [("PDV", False), ("Pago Móvil", False), ("Cobrar", True)],
             ]),
             "steps": [
                ("Abre POS Restaurante y elige la mesa o el pickup.", "Ruta <span class='pill'>/dashboard/pos/restaurante</span>."),
                ("Activa el +10% de servicio si corresponde.", "Suma 10% al total de la cuenta."),
                ("Elige el método de pago.", "Uno solo, o pago mixto para combinar varios."),
                ("Registra el pago y entrega el vuelto.", "El sistema muestra el vuelto a devolver bien destacado."),
                ("Cierra la mesa.", "La cuenta queda saldada y la mesa se libera."),
             ],
             "callouts": [
                ("warn", "Descuentos con PIN", "Aplicar descuento de divisas, cortesía o anular una venta pide el <strong>PIN de gerente</strong>."),
                ("info", "Propina", "La propina voluntaria va en su propio campo (“solo si el cliente la deja”), separada del vuelto, para no confundir.")]},
            {"title": "Dividir una cuenta en subcuentas",
             "intro": "Cuando una mesa quiere pagar por separado, se divide en subcuentas. Cada una se cobra como una factura independiente.",
             "steps": [
                ("Toca “÷ Dividir cuenta” en la mesa activa.", "Entra al modo de subcuentas."),
                ("Crea las subcuentas o usa la división rápida.", "Botones 2 / 3 / 4 / 5 / 6 reparten los ítems en partes iguales."),
                ("Asigna los ítems y cobra cada subcuenta.", "Cada una con su método, su +10% y su monto."),
                ("La mesa se cierra cuando todas están pagadas.", "Lo que quede sin asignar se cobra con el botón principal."),
             ]},
            {"title": "Imprimir la pre-cuenta",
             "intro": "Antes de cobrar, el cliente suele pedir ver su cuenta. La pre-cuenta imprime el consumo sin aplicar descuentos.",
             "steps": [
                ("Toca el botón de Pre-cuenta en la mesa.", "Icono de impresora."),
                ("Entrega el impreso al cliente.", "Muestra el consumo real, sin descuentos de cobro."),
             ]},
            {"title": "Cerrar la caja al final del turno",
             "intro": "El cierre cuenta lo que hay en caja y lo compara con lo que el sistema esperaba según las ventas.",
             "steps": [
                ("Entra a Control de Caja y cierra la caja.", "Haz el conteo final de efectivo."),
                ("Revisa el cuadre.", "El sistema calcula lo esperado (fondo + ventas + propinas − gastos) y la diferencia."),
                ("Confirma el cierre.", "Queda el registro del turno, con las propinas detalladas."),
             ]},
        ],
        "can": ["Cobrar cuentas (todos los métodos)", "Abrir y cerrar caja", "Dividir cuentas en subcuentas",
                "Imprimir pre-cuentas", "Ver el historial de ventas"],
        "cant": ["Ver costos (salvo permiso especial)", "Aplicar descuentos sin PIN de gerente",
                 "Gestionar usuarios o configuración"],
    },
    # ------------------------------------------------------------- WAITER
    {
        "code": "WAITER", "level": 15, "name": "Mesonero", "kicker": "Servicio en mesa",
        "tagline": "Toma pedidos en mesa y los envía a cocina",
        "desc": "La cara del servicio. Se identifica con su PIN, abre la cuenta de la mesa, agrega los "
                "productos y los envía a cocina y barra. Deja la cuenta lista para que la caja cobre.",
        "chips": [("POS Mesero", True)],
        "day": "Llega, se identifica con su PIN, y durante el servicio abre mesas, toma pedidos y los "
               "manda a cocina. No cobra: eso es de la cajera.",
        "tasks": [
            {"title": "Identificarte con tu PIN",
             "intro": "El POS Mesero no pide correo ni contraseña: cada mesonero entra con su PIN, así es rápido en el ritmo del salón.",
             "steps": [
                ("Abre el POS Mesero.", "Aparece el teclado numérico y la lista de mesoneros activos."),
                ("Ingresa tu PIN.", "El sistema te reconoce y carga tu nombre para el turno."),
             ],
             "callouts": [("info", "Por turno", "Tu identificación dura mientras la pestaña esté abierta. Al cerrarla, el próximo mesonero entra con su propio PIN.")]},
            {"title": "Abrir una cuenta en una mesa",
             "intro": "Tocar una mesa libre abre la cuenta. Con datos mínimos ya puedes empezar a cargar el pedido.",
             "steps": [
                ("Toca una mesa libre.", "Se abre el cuadro “Abrir cuenta”."),
                ("Carga el nombre y el número de personas.", "El nombre es opcional (por defecto “Cliente”)."),
                ("Confirma “Abrir cuenta”.", "La mesa pasa a ocupada y ya puedes agregar productos."),
             ]},
            {"title": "Agregar productos y enviar a cocina",
             "intro": "Navegás el menú por categorías, sumás productos a la cuenta y los despachás. Cocina y barra los ven al instante.",
             "steps": [
                ("Selecciona los productos del menú.", "Por categorías; elige extras o modificadores si el producto los tiene."),
                ("Revisa el pedido en la cuenta.", "Verifica cantidades antes de enviar."),
                ("Envía a cocina.", "Cada producto va a su estación: cocina o barra, según esté configurado."),
             ],
             "callouts": [("info", "Ruteo automático", "Vos no elegís a dónde va cada cosa: la comida va a cocina y las bebidas a la barra, ya configurado en el menú.")]},
            {"title": "Mostrar la cuenta al cliente",
             "intro": "Cuando el cliente pide la cuenta, se la mostrás desde el POS Mesero antes de derivar el cobro a caja.",
             "steps": [
                ("Toca “Mostrar cuenta al cliente”.", "Muestra subtotal, servicio 10%, total en USD y el equivalente en Bs con la tasa."),
                ("Avisa a la caja para el cobro.", "El cobro y el cierre los hace la cajera, no el mesonero."),
             ]},
            {"title": "Dividir o transferir mesa (solo capitanes)",
             "intro": "Si sos capitán, puedes dividir la cuenta en partes o transferir la mesa a otro mesonero.",
             "steps": [
                ("Usa “÷ Dividir cuenta” para separar el consumo.", "Solo visible para capitanes."),
                ("Usa “↔ Transferir mesa” para cambiar de mesonero.", "La transferencia pide PIN de capitán o de gerente."),
             ]},
        ],
        "can": ["Identificarse con PIN", "Abrir y editar cuentas de mesa", "Enviar comandas a cocina",
                "Mostrar la cuenta al cliente", "Dividir y transferir mesa (capitán)"],
        "cant": ["Cobrar o cerrar la cuenta", "Aplicar descuentos", "Ver inventario, costos o reportes"],
    },
]

# ============================================================================
# FAQ
# ============================================================================
FAQ = [
    ("¿Por qué no veo un módulo que un compañero sí ve?",
     "Por el triple filtro: el módulo debe estar encendido, tu rol debe tener permiso y debe estar "
     "en tu lista personal. Si te falta, pídele al administrador que revise tus módulos asignados."),
    ("Olvidé mi contraseña, ¿qué hago?",
     "Pídele al OWNER o al Gerente Administrativo que te la resetee desde Usuarios. Nadie puede "
     "resetear su propia contraseña."),
    ("¿Cuál es la diferencia entre PIN y contraseña?",
     "La contraseña (con tu correo) entra al sistema. El PIN es una clave numérica corta para "
     "acciones rápidas en el POS: identificarte como mesonero o autorizar un cobro o descuento."),
    ("Soy mesonero, ¿por qué no puedo cobrar?",
     "Por diseño. El mesonero toma y envía pedidos; el cobro y el cierre de mesa los hace la cajera. "
     "Así se separan responsabilidades sobre el dinero."),
    ("¿Por qué el total en bolívares cambió de ayer a hoy?",
     "Porque el POS usa la tasa del día. Cada venta guarda la tasa con la que se cobró, así los "
     "reportes viejos no se alteran cuando la tasa sube o baja."),
    ("¿Qué pasa si cuento el inventario y no coincide con el sistema?",
     "Esa diferencia es la varianza. Se registra al cerrar el inventario diario o al aprobar una "
     "auditoría, que genera el ajuste automático para corregir el stock."),
    ("¿Las subcuentas son facturas separadas?",
     "Sí. Cada subcuenta se cobra de forma independiente, con su propio método de pago y su 10% de "
     "servicio. La cocina, en cambio, ve una sola comanda normal."),
]

# ============================================================================
# MATRIZ ROL × ÁREA
# ============================================================================
def _build_matrix():
    cols = ["Dashboard", "Inventario", "Producción", "POS / Ventas", "Caja / Finanzas", "Usuarios / Config"]
    # ● acceso · ◐ solo lectura · — sin acceso
    Y = '<span class="yes">●</span>'
    R = '<span class="ro">◐</span>'
    N = '<span class="muted">—</span>'
    data = [
        ("Owner",                [Y, Y, Y, Y, Y, Y]),
        ("Auditor",              [Y, R, R, R, R, R]),
        ("Gerente Administrativo", [Y, Y, Y, R, Y, Y]),
        ("Gerente de Operaciones", [Y, Y, Y, R, N, N]),
        ("Chef",                 [Y, Y, Y, N, N, N]),
        ("Líder de Área",        [Y, Y, Y, R, N, N]),
        ("Comandera de Cocina",  [N, N, N, R, N, N]),
        ("Cajera",               [N, N, N, Y, Y, N]),
        ("Mesonero",             [N, N, N, R, N, N]),
    ]
    th = '<th>Rol</th>' + ''.join(f'<th class="num">{c}</th>' for c in cols)
    body = ''
    for name, cells in data:
        tds = f'<td><strong>{name}</strong></td>' + ''.join(f'<td class="num">{c}</td>' for c in cells)
        body += f'<tr>{tds}</tr>'
    return f'<table><thead><tr>{th}</tr></thead><tbody>{body}</tbody></table>'

MATRIX = _build_matrix()
