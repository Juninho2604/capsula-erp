# -*- coding: utf-8 -*-
"""Sección 4 — Finanzas. Manual de uso por módulo · KPSULA.

Todo factual: labels verificados contra los views en src/app/dashboard/
(caja, gastos, cuentas-pagar, proveedores, finanzas, conciliacion,
cuentas-bancarias, cambio-divisas, cuentas-cobrar, compras/documentos,
intercompany) y OPUS_CONTEXT_CAPSULA.md (§56, §107, §108, §115, §141, §160).
"""

SECTION = {
    "id": "finanzas",
    "num": 4,
    "title": "Finanzas",
    "intro": "Todo el dinero del negocio pasa por esta sección: el pulso diario en el "
             "<span class='pill'>Dashboard Financiero</span>, los egresos en <span class='pill'>Gastos</span>, "
             "el efectivo físico en <span class='pill'>Control de Caja</span>, y el circuito completo con "
             "proveedores — <span class='pill'>Proveedores</span> → <span class='pill'>Facturas y Notas</span> → "
             "<span class='pill'>Cuentas por Pagar</span>. La tesorería (cuentas bancarias, cambio de divisas, "
             "conciliación y cuentas por cobrar) cierra el círculo: lo que el sistema dice que hay debe "
             "coincidir con lo que hay de verdad en el banco y en la gaveta.",
    "modules": [

        # ══════════════════════════════════════════════════════════════════
        # 1. Dashboard Financiero
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Dashboard Financiero",
            "route": "/dashboard/finanzas",
            "kicker": "Finanzas",
            "who": "Dueño, administración y auditoría",
            "what": "El estado de resultados del negocio en una sola pantalla: ventas, gastos, "
                    "flujo de caja y deudas pendientes, por mes o por día. Se alimenta solo de lo que "
                    "el resto del sistema ya registró — las ventas del POS, los gastos, los pagos a "
                    "proveedores — así que no hay nada que cargar acá: es la pantalla de lectura.",
            "features": [
                ("Vista Mensual / Diaria", "Un interruptor cambia entre el mes completo y un día puntual. En diario ves además ventas por hora, por tipo y por método de pago."),
                ("Flujo de caja", "Ingresos (ventas cobradas), egresos (gastos + pagos a proveedores) y flujo neto del período."),
                ("Estado de resultados", "El P&amp;L del mes con ventas diarias, gastos por categoría, tendencia de 6 meses y top 5 gastos."),
                ("Deudas pendientes", "Resumen de Cuentas por Pagar: total, vencido y envejecimiento — sin salir del dashboard."),
                ("Exportar Excel", "El botón <span class='pill'>Exportar Excel</span> descarga el P&amp;L del período para trabajarlo afuera."),
            ],
            "tasks": [
                {
                    "title": "Revisar el mes",
                    "steps": [
                        ("Entrá al módulo.", "Ruta <span class='pill'>/dashboard/finanzas</span>. Abre en vista <span class='pill'>Mensual</span> con el mes actual."),
                        ("Navegá entre meses con las flechas.", "El período visible aparece al centro (ej. <em>Agosto 2026</em>). Mientras recalcula ves «Calculando…»."),
                        ("Leé de arriba hacia abajo.", "Primero las tarjetas de resumen, después <strong>Flujo neto</strong> (ingresos menos egresos), y al final el estado de resultados con gastos por categoría y deudas pendientes."),
                    ],
                },
                {
                    "title": "Ver un día puntual",
                    "steps": [
                        ("Tocá <span class='pill'>Diario</span> en el interruptor de arriba.", "El navegador de período cambia a un selector de fecha con flechas de día anterior / siguiente."),
                        ("Elegí la fecha.", "Ves las ventas del día (facturado y cobrado), ticket promedio, ventas por hora, por tipo y por método de pago, y el flujo del día."),
                    ],
                    "callouts": [
                        ("info", "Facturado vs cobrado", "«Ventas del día (facturado)» es lo vendido; «Cobrado» es lo que ya entró. Si hay diferencia, aparece como «por cobrar»."),
                    ],
                },
                {
                    "title": "Exportar el P&L a Excel",
                    "steps": [
                        ("Con el período que querés en pantalla, tocá <span class='pill'>Exportar Excel</span>.", "Está arriba a la derecha. Descarga el archivo con el estado de resultados del período visible."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 2. Gastos
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Gastos",
            "route": "/dashboard/gastos",
            "kicker": "Finanzas",
            "who": "Administración, gerencia de operaciones y auditoría",
            "what": "Acá se registra cada egreso operativo del negocio: alquiler, servicios, nómina, "
                    "mantenimiento, compras menores. Cada gasto lleva categoría, método de pago y quién "
                    "lo registró, y alimenta directo el Dashboard Financiero y el cuadre de "
                    "<span class='pill'>Control de Caja</span> (los gastos pagados del turno se descuentan "
                    "del efectivo esperado). Desde acá también se le abona a proveedores, incluso antes de "
                    "que llegue la factura.",
            "features": [
                ("Registro por categoría", "Cada gasto pertenece a una categoría con color e icono. Las categorías las crea administración con <span class='pill'>+ Categoría</span>."),
                ("Métodos de pago", "Efectivo USD, Efectivo Bs, Zelle, Transferencia Bancaria, Pago Móvil, Cheque u Otro."),
                ("Abonar a proveedor", "Pago a una factura pendiente o anticipo sin factura, sin salir del módulo — conectado con Cuentas por Pagar."),
                ("Análisis del período", "Distribución por categoría y por método, tendencia de 6 meses y navegador por mes."),
                ("Anulación con motivo", "Un gasto mal cargado se anula (no se borra) y queda marcado ANULADO con su motivo."),
                ("Exportar Excel", "Botón <span class='pill'>Exportar Excel</span> con el detalle del período."),
            ],
            "tasks": [
                {
                    "title": "Registrar un gasto",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/gastos</span> y tocá <span class='pill'>+ Registrar Gasto</span>.", "El botón está arriba a la derecha. Se abre el formulario."),
                        ("Completá <strong>Descripción</strong>, <strong>Categoría</strong>, <strong>Fecha</strong> y <strong>Monto USD</strong>.", "Son los campos obligatorios. Ej.: <em>Pago alquiler local enero</em>."),
                        ("Elegí el <strong>Método de Pago</strong>.", "Si pagaste en bolívares podés anotar también el <strong>Monto Bs</strong> (opcional) y la referencia de la transferencia o cheque."),
                        ("Guardá con <span class='pill'>Registrar Gasto</span>.", "El gasto aparece de una vez en la tabla <strong>Detalle de Gastos</strong> con tu nombre en «Registrado por»."),
                    ],
                },
                {
                    "title": "Abonar a un proveedor (con o sin factura)",
                    "intro": "Para cuando pagás hoy y la factura llega después — o para abonar a una factura que ya está en Cuentas por Pagar.",
                    "steps": [
                        ("Tocá <span class='pill'>Abonar a proveedor</span>.", "Se abre el modal. Elegí el proveedor — al lado de cada uno ves cuánto debe."),
                        ("Elegí el modo: <span class='pill'>A una factura</span> o <span class='pill'>Anticipo (sin factura)</span>.", "«A una factura» lista las facturas pendientes del proveedor con su saldo. Si no tiene facturas pendientes, el sistema te sugiere usar Anticipo."),
                        ("Completá monto, fecha, método y referencia.", "En modo anticipo el efectivo sale ahora; cuando llegue la factura, el anticipo se aplica desde <span class='pill'>Cuentas por Pagar</span> sin contarse dos veces."),
                    ],
                    "callouts": [
                        ("info", "Regla anti-duplicado", "El egreso cuenta UNA sola vez: al salir el efectivo. Aplicar después un anticipo a una factura baja el saldo de la deuda pero no vuelve a contar como gasto."),
                    ],
                },
                {
                    "title": "Crear una categoría de gasto",
                    "steps": [
                        ("Tocá <span class='pill'>+ Categoría</span>.", "Solo lo ven dueño y administración. Se abre el modal <strong>Nueva Categoría</strong>."),
                        ("Poné el <strong>Nombre</strong> y, si querés, icono, color y descripción.", "Ej.: <em>Alquiler</em>, <em>Servicios Públicos</em>. El color identifica la categoría en los gráficos."),
                        ("Guardá con <span class='pill'>Crear Categoría</span>.", "Queda disponible de inmediato al registrar gastos."),
                    ],
                },
                {
                    "title": "Anular un gasto",
                    "steps": [
                        ("Buscá el gasto en la tabla y tocá <span class='pill'>Anular</span>.", "La acción solo aparece para dueño y administración."),
                        ("Escribí el <strong>Motivo de anulación</strong>.", "Es obligatorio: queda registrado junto al gasto."),
                        ("Confirmá con <span class='pill'>Confirmar Anulación</span>.", "El gasto no se borra — queda en la tabla marcado <strong>ANULADO</strong> y deja de sumar en los totales."),
                    ],
                    "callouts": [
                        ("danger", "Se anula, no se borra", "Ningún gasto desaparece del historial. Si el monto estaba malo, anulá y registrá el gasto correcto."),
                    ],
                },
                {
                    "title": "Revisar y exportar el período",
                    "steps": [
                        ("Navegá el mes con las flechas ‹ ›.", "Los indicadores, la distribución por categoría y por método se recalculan para el mes visible."),
                        ("Filtrá por categoría o método si buscás algo puntual.", "Con <span class='pill'>Limpiar filtros</span> volvés a ver todo."),
                        ("Tocá <span class='pill'>Exportar Excel</span> para bajar el detalle.", "Descarga los gastos del período con todos sus datos."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 3. Control de Caja
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Control de Caja",
            "route": "/dashboard/caja",
            "kicker": "Finanzas",
            "who": "Cajera, administración, gerencia y auditoría",
            "what": "La rutina del efectivo físico: se abre la caja al empezar el turno con su fondo "
                    "inicial, se registran las responsables, y al cerrar el sistema calcula solo cuánto "
                    "efectivo debería haber (fondo + ventas + propinas − gastos del turno) y lo compara "
                    "con lo contado. La diferencia queda registrada turno por turno. El "
                    "<strong>Reporte Z</strong> de <span class='pill'>Historial Ventas</span> es el "
                    "complemento: ahí está el detalle de las ventas del día por método de pago para "
                    "el arqueo.",
            "features": [
                ("Apertura por turno", "Cada caja se abre con nombre, turno (Mañana / Día / Noche) y fondo inicial en USD y Bs."),
                ("Desglose de billetes", "Al abrir o cerrar podés contar billete por billete ($100, $50, $20, $10, $5, $1) y el sistema suma el total."),
                ("Responsables del turno", "Cada caja abierta muestra las cajeras a cargo; se pueden agregar o reemplazar en cambio de turno."),
                ("Cuadre automático", "Al cerrar, el sistema calcula el efectivo <strong>Esperado</strong> y la <strong>Diferencia</strong> contra lo <strong>Contado</strong>."),
                ("Resumen del mes", "Ventas, gastos descontados de caja, diferencia acumulada y <strong>Precisión de Cuadre</strong> (% de turnos sin diferencia)."),
                ("Historial de Cierres", "Tabla por turno con Ventas, Gastos, Esperado, Contado y Diferencia, más la tendencia de diferencias del mes."),
            ],
            "tasks": [
                {
                    "title": "Abrir la caja del turno",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/caja</span> y tocá <span class='pill'>+ Abrir Caja</span>.", "Se abre el formulario de apertura."),
                        ("Poné el <strong>Nombre de Caja</strong> y elegí el <strong>Turno</strong>.", "Ej.: <em>Caja Restaurante</em>, turno Mañana, Día o Noche."),
                        ("Cargá el <strong>Fondo Inicial USD</strong>.", "Podés tipear el total directo o activar <span class='pill'>Desglosar billetes</span> y contar billete por billete — el sistema suma solo."),
                        ("Cargá el <strong>Fondo Inicial Bs</strong> si hay, y guardá con <span class='pill'>Abrir Caja</span>.", "La caja aparece en <strong>Cajas abiertas</strong> con la hora de apertura y las responsables."),
                    ],
                    "callouts": [
                        ("ok", "Contá antes de abrir", "El fondo inicial es la base de todo el cuadre del turno. Contalo con calma: un fondo mal anotado aparece después como «diferencia» que no existe."),
                    ],
                },
                {
                    "title": "Agregar cajera o hacer cambio de turno",
                    "steps": [
                        ("En la tarjeta de la caja abierta, tocá <span class='pill'>+ Cajera</span> o <span class='pill'>Cambio Turno</span>.", "«+ Cajera» suma una responsable más; «Cambio Turno» reemplaza a todas las actuales por la nueva."),
                        ("Escribí el nombre completo y confirmá.", "Las responsables quedan visibles en la tarjeta de la caja y en el historial de cierres — así siempre se sabe quién estuvo a cargo."),
                    ],
                },
                {
                    "title": "Cerrar la caja y cuadrar",
                    "steps": [
                        ("Tocá <span class='pill'>Cerrar Caja</span> en la tarjeta de la caja abierta.", "El modal muestra el fondo de apertura, la hora, y las propinas del turno si las hubo."),
                        ("Contá el efectivo y cargá <strong>Efectivo Contado USD</strong> y <strong>Efectivo Contado Bs</strong>.", "Igual que en la apertura, podés activar <span class='pill'>Desglosar billetes</span> para contar por denominación."),
                        ("Anotá <strong>Observaciones</strong> si algo pasó en el turno.", "Ej.: un vuelto grande, un billete dudoso, un retiro autorizado."),
                        ("Confirmá con <span class='pill'>Cerrar Caja</span>.", "El sistema calcula el esperado (fondo + ventas + propinas − gastos del turno) y guarda la <strong>Diferencia</strong> en el <strong>Historial de Cierres</strong>."),
                    ],
                    "callouts": [
                        ("info", "El cuadre fino se hace con el Reporte Z", "Para revisar método por método (PDV, pago móvil, Zelle, efectivo), abrí el <strong>Reporte Z</strong> del día en <span class='pill'>Historial Ventas</span> — es la referencia del arqueo."),
                        ("warn", "Diferencia grande", "Si la diferencia no cuadra, no cierres «para salir del paso»: recontá y avisá a gerencia. El cierre queda registrado con tu turno y la diferencia acumulada del mes se ve en el resumen."),
                    ],
                },
                {
                    "title": "Revisar el mes y el desglose de billetes",
                    "steps": [
                        ("Navegá el mes con las flechas ‹ ›.", "El <strong>Resumen del mes</strong> muestra ventas, gastos, diferencia acumulada y la <strong>Precisión de Cuadre</strong>."),
                        ("Revisá el <strong>Historial de Cierres</strong>.", "Cada fila trae Ventas, Gastos, Esperado, Contado y Diferencia, con las responsables del turno."),
                        ("Abrí el desglose de billetes de un cierre.", "Si el turno se contó por denominación, el detalle de apertura y cierre queda guardado y se consulta desde la fila."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 4. Proveedores (módulo ejemplar del SPEC, ampliado)
        # ══════════════════════════════════════════════════════════════════
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
                ("Deuda y anticipos a la vista", "Cada fila muestra cuánto se le debe (<strong>Por pagar</strong>) y cuánto tiene a favor (<strong>Anticipo</strong>)."),
                ("Activar / desactivar", "Un proveedor con el que ya no se trabaja se desactiva — su historial de compras y deudas se conserva."),
            ],
            "tasks": [
                {
                    "title": "Crear un proveedor",
                    "steps": [
                        ("Entrá al módulo Proveedores.", "Ruta <span class='pill'>/dashboard/proveedores</span>, en la sección <strong>Finanzas</strong> del menú lateral. Si no lo ves, escribí <em>proveedores</em> en el buscador de arriba del menú."),
                        ("Tocá <span class='pill'>Nuevo proveedor</span>.", "El botón está arriba a la derecha. Se abre la ficha vacía."),
                        ("Completá el nombre.", "Es el único campo obligatorio. Ej.: <em>Distribuidora X</em>."),
                        ("Agregá RIF, contacto, teléfono y correo si los tenés.", "El RIF con formato <span class='pill'>J-12345678-9</span>. Todo esto se puede completar después."),
                        ("Guardá.", "El proveedor aparece de inmediato en el directorio y ya se le pueden registrar documentos de compra."),
                    ],
                    "callouts": [
                        ("info", "¿Y la deuda?", "La deuda no se carga acá: nace sola al registrar un documento de compra a crédito en <span class='pill'>Compras</span>, y se paga desde <span class='pill'>Cuentas por Pagar</span>."),
                    ],
                },
                {
                    "title": "Editar la ficha de un proveedor",
                    "steps": [
                        ("Buscá el proveedor.", "Usá el buscador de arriba: acepta nombre, RIF o código interno."),
                        ("Tocá el botón del lápiz en su fila.", "Se abre la misma ficha, ahora con los datos cargados."),
                        ("Corregí lo que haga falta y tocá <span class='pill'>Guardar</span>.", "Los cambios se reflejan al instante en Documentos y Cuentas por Pagar, que leen de este directorio."),
                    ],
                },
                {
                    "title": "Desactivar (o reactivar) un proveedor",
                    "steps": [
                        ("Buscá el proveedor y tocá <span class='pill'>Desactivar</span> en su fila.", "La fila queda atenuada y marcada <em>inactivo</em>. No se borra nada: compras, deudas y anticipos siguen en el historial."),
                        ("Para volver a trabajar con él, tocá <span class='pill'>Activar</span>.", "Recupera su lugar en el directorio y vuelve a aparecer al registrar documentos."),
                    ],
                    "callouts": [
                        ("ok", "Desactivar, nunca borrar", "Si un proveedor tiene deuda pendiente o anticipos a favor, desactivarlo no los toca — se siguen viendo y cobrando desde Cuentas por Pagar."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 5. Cuentas por Pagar
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Cuentas por Pagar",
            "route": "/dashboard/cuentas-pagar",
            "kicker": "Compras y pagos",
            "who": "Administración, gerencia de operaciones y auditoría (el auditor ve pero no paga ni anula)",
            "what": "El control de todo lo que el negocio debe: facturas de proveedores y otras deudas, "
                    "con su estado (Pendiente, Parcial, Pagado, Vencido, Disputado, Anulado), su "
                    "vencimiento y su historial de pagos. La deuda normalmente <strong>nace sola</strong> "
                    "desde un documento a crédito cargado en <span class='pill'>Facturas y Notas</span> o "
                    "desde una orden de compra a crédito — acá se administra y se paga. Los abonos en "
                    "bolívares guardan el equivalente y la tasa del día para auditoría.",
            "features": [
                ("Tablero de deuda", "KPIs de Total pendiente, Vencido, Total pagado y Acreedores, con filtros Activas / Todas / Pagadas."),
                ("Envejecimiento de deudas", "Al día, 0-30, 31-60, 61-90 y 90+ días — para ver qué se está poniendo viejo."),
                ("Próximos vencimientos", "Las deudas que vencen en los próximos 14 días, marcadas HOY / MAÑANA / en días."),
                ("Pagos parciales con historial", "Cada abono queda con monto, método, referencia, fecha y quién lo registró. Los pagos en Bs guardan tasa y equivalente."),
                ("Retenciones IVA / ISLR", "Cierran el saldo de una factura sin salida de efectivo — lo retenido se entera al fisco, no al proveedor."),
                ("Anulación auditable", "Una deuda mal cargada se anula con motivo obligatorio; nunca se borra."),
            ],
            "tasks": [
                {
                    "title": "Registrar una cuenta por pagar",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/cuentas-pagar</span> y tocá <span class='pill'>Nueva cuenta</span>.", "Se abre el formulario <strong>Nueva cuenta por pagar</strong>."),
                        ("Si la deuda viene de una compra, usá <strong>Desde orden de compra (crédito)</strong>.", "El selector lista las compras a crédito recibidas; al elegir una se llenan solos descripción, proveedor y monto, y la deuda queda vinculada a la orden."),
                        ("Si es manual, completá <strong>Descripción</strong> y <strong>Monto total USD</strong>.", "Elegí el <strong>Proveedor (sistema)</strong> del directorio, o escribí el nombre del acreedor si no está registrado."),
                        ("Agregá Nº de factura, fecha de factura y fecha de vencimiento.", "El vencimiento alimenta el envejecimiento y las alertas de próximos vencimientos."),
                        ("Guardá con <span class='pill'>Registrar cuenta</span>.", "La deuda entra como <strong>Pendiente</strong> y suma al total del acreedor."),
                    ],
                },
                {
                    "title": "Registrar un pago (total o abono)",
                    "steps": [
                        ("Tocá <span class='pill'>Registrar pago</span> en la fila de la deuda.", "El modal muestra el saldo pendiente y, si hay tasa del día cargada, su equivalente en Bs."),
                        ("Confirmá o ajustá el <strong>Monto USD</strong>.", "Viene precargado con el saldo completo; para un abono parcial escribí el monto que estás pagando. Si el método es en Bs, el sistema muestra y guarda el equivalente a la tasa del día."),
                        ("Elegí el <strong>Método</strong> y anotá la <strong>Referencia</strong>.", "Efectivo USD, Efectivo Bs, Zelle, Transferencia Bancaria, Pago Móvil o Cheque."),
                        ("Confirmá con <span class='pill'>Confirmar pago</span>.", "El estado pasa a <strong>Parcial</strong> o <strong>Pagado</strong> según el saldo. Tocando la fila ves el historial de <strong>Pagos realizados</strong>."),
                    ],
                    "callouts": [
                        ("info", "Tasa del día", "Si no hay tasa cargada en <span class='pill'>Tasa de Cambio</span>, el modal lo avisa y las conversiones a Bs no están disponibles."),
                    ],
                },
                {
                    "title": "Aplicar retención IVA / ISLR",
                    "intro": "Para cerrar el saldo que el pago no cubre porque la ley obliga a retener parte de la factura.",
                    "steps": [
                        ("Tocá <span class='pill'>Retención</span> en la fila de la deuda.", "Se abre el modal <strong>Retención IVA / ISLR</strong> con el total, lo pagado y el saldo actual."),
                        ("Cargá los montos en <strong>Retención IVA (USD)</strong> y/o <strong>Retención ISLR (USD)</strong>.", "El modal muestra en vivo el <strong>Saldo tras retención</strong> y avisa si la factura queda cerrada."),
                        ("Guardá con <span class='pill'>Guardar retención</span>.", "Lo retenido NO sale al proveedor (se entera al fisco): cierra el saldo sin salida de efectivo y nunca cuenta como gasto."),
                    ],
                },
                {
                    "title": "Anular una cuenta por pagar",
                    "intro": "Para una deuda cargada por error: factura duplicada, monto malo, proveedor equivocado.",
                    "steps": [
                        ("Tocá <span class='pill'>Anular</span> en la fila.", "El botón solo aparece cuando la deuda se puede anular. Se abre el modal <strong>Anular cuenta por pagar</strong>."),
                        ("Escribí el <strong>Motivo de la anulación</strong>.", "Es obligatorio y queda en la auditoría junto con tu nombre. Ej.: <em>factura duplicada</em>, <em>monto mal cargado</em>."),
                        ("Confirmá con <span class='pill'>Anular cuenta</span>.", "La cuenta queda como <strong>Anulado</strong>: sigue visible en «Todas» pero deja de sumar a la deuda."),
                    ],
                    "callouts": [
                        ("danger", "Una deuda con dinero encima no se anula", "Si la cuenta ya tiene abonos registrados o retenciones aplicadas, el sistema bloquea la anulación: esos movimientos son reales y quedarían apuntando a la nada. Primero se revierten los pagos, después se anula."),
                        ("info", "El documento queda libre", "Si la deuda venía de un documento de <span class='pill'>Facturas y Notas</span>, al anularla el documento queda liberado: se corrige y se vuelve a generar la deuda con el monto correcto. Y al revés: anular el documento anula en cascada su cuenta por pagar — salvo que tenga abonos, en cuyo caso se bloquean las dos anulaciones."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 6. Cuentas Bancarias
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Cuentas Bancarias",
            "route": "/dashboard/cuentas-bancarias",
            "kicker": "Tesorería",
            "who": "Dueño, administración y auditoría",
            "what": "El mapa de dónde vive el dinero: cuentas de banco, cajas de efectivo y billeteras "
                    "digitales (Zelle), con sus terminales de punto de venta (PDV) colgando de cada "
                    "cuenta. Cada cuenta es el <strong>eje</strong> de la conciliación: por ella entra la "
                    "venta de sus terminales y sale el gasto o pago. Las comisiones de cada terminal "
                    "(distintas para persona natural y jurídica) se calculan por cada cobro.",
            "features": [
                ("Cuentas por tipo y moneda", "Banco, Efectivo o Digital (Zelle); en Bolívares (Bs) o Dólares ($). La moneda decide si aplica conversión Bs→$."),
                ("Terminales (PDV) por cuenta", "Cada terminal con su etiqueta, método POS asociado y comisiones % para natural y jurídica."),
                ("Comisiones de la cuenta", "Porcentajes de ingreso y egreso, separados por natural / jurídica."),
                ("Pestaña Comisiones", "Reporte de lo que los terminales se comieron en comisiones."),
            ],
            "tasks": [
                {
                    "title": "Crear una cuenta",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/cuentas-bancarias</span> y tocá <span class='pill'>Nueva cuenta</span>.", "Se abre la ficha de la cuenta."),
                        ("Poné el <strong>Nombre</strong>, la <strong>Moneda</strong> y el <strong>Tipo</strong>.", "Ej.: <em>PROVINCIAL NOUR</em>, Bolívares (Bs), tipo Banco. Los tipos son Banco, Efectivo o Digital (Zelle)."),
                        ("Completá banco, RIF y las comisiones si aplican.", "Ingreso y egreso, cada uno con % para persona natural y jurídica."),
                        ("Guardá.", "La cuenta aparece en la lista y ya puede recibir terminales, cambios de divisas y conciliación."),
                    ],
                },
                {
                    "title": "Agregar un terminal (PDV) a una cuenta",
                    "steps": [
                        ("En la tarjeta de la cuenta, tocá <span class='pill'>Agregar terminal</span>.", "Se abre la ficha del terminal."),
                        ("Poné la <strong>Etiqueta</strong> y el <strong>Método POS</strong>.", "Ej.: <em>PDV Superferro</em>. El método POS conecta el terminal con el botón de cobro correspondiente del punto de venta."),
                        ("Cargá la <strong>Comisión %</strong> para persona natural y jurídica, y guardá.", "Desde ese momento cada cobro por ese terminal calcula su comisión, que después se revisa en la pestaña <span class='pill'>Comisiones</span> y en <span class='pill'>Conciliación</span>."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 7. Cambio de Divisas
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Cambio de Divisas",
            "route": "/dashboard/cambio-divisas",
            "kicker": "Tesorería",
            "who": "Dueño, administración y auditoría",
            "what": "El registro de cada cambio de moneda del negocio: sale una moneda (dólares o "
                    "bolívares) y entra la otra, repartida en una o varias cuentas bancarias destino. "
                    "El sistema calcula la tasa implícita de cada operación y acumula los totales del "
                    "mes, para que el movimiento entre monedas no quede en un cuaderno.",
            "features": [
                ("Salida y destinos", "Indicás qué moneda entregás, de qué cuenta sale (opcional) y a qué cuentas entra, con monto y referencia por destino."),
                ("Tasa implícita", "El sistema divide lo que entró entre lo que salió y muestra la tasa real del cambio."),
                ("KPIs del mes", "$ cambiados este mes, Bs recibidos este mes y la tasa del día cargada en el sistema."),
                ("Anulación con motivo", "Un cambio mal tecleado se anula (no se borra) y queda marcado con su motivo."),
            ],
            "tasks": [
                {
                    "title": "Registrar un cambio",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/cambio-divisas</span> y tocá <span class='pill'>Registrar cambio</span>.", "Se abre el modal <strong>Registrar cambio de divisas</strong>."),
                        ("Elegí <strong>¿Qué moneda entregas?</strong> y el monto que sale.", "USD o Bs. Opcionalmente indicá de qué cuenta sale (<strong>Sale de</strong>)."),
                        ("Cargá los destinos: cuenta, monto recibido y referencia.", "Podés repartir lo recibido en varias cuentas. El resumen muestra <strong>Sale</strong>, <strong>Entra (suma destinos)</strong> y la <strong>Tasa implícita del cambio</strong>."),
                        ("Anotá una nota si ayuda y confirmá.", "Ej.: <em>cambio con casa de cambio X para pagar proveedores</em>. La operación queda en la lista con fecha, cuentas y quién la registró."),
                    ],
                },
                {
                    "title": "Anular un cambio",
                    "steps": [
                        ("Tocá <span class='pill'>Anular</span> en la tarjeta de la operación.", "Se abre el modal <strong>Anular cambio</strong>."),
                        ("Escribí el <strong>Motivo</strong> y confirmá.", "Ej.: <em>monto mal tecleado</em>. La operación queda marcada <strong>Anulado</strong> con su motivo visible y deja de sumar en los totales del mes."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 8. Conciliación
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Conciliación",
            "route": "/dashboard/conciliacion",
            "kicker": "Tesorería",
            "who": "Dueño, administración y auditoría",
            "what": "La verificación de que lo que el sistema dice coincide con lo que el banco dice. "
                    "Tiene dos caras: <strong>Realizar conciliación</strong>, donde se revisa movimiento "
                    "por movimiento contra el estado de cuenta, y el <strong>Reporte de conciliación</strong>, "
                    "que compara el saldo según sistema con el saldo real del banco y muestra la "
                    "diferencia. Necesita que las cuentas y terminales ya estén cargados en "
                    "<span class='pill'>Cuentas Bancarias</span>.",
            "features": [
                ("Movimiento por movimiento", "Cada movimiento del mes, agrupado por día, con entrada/salida, montos en Bs y $, y su comisión."),
                ("Contraparte natural / jurídica", "Ajustable por movimiento — cambia la comisión que aplica el terminal."),
                ("Quitar comisión", "Si el banco no cobró la comisión de un movimiento, se quita de ese movimiento sin tocar los demás."),
                ("Contador de avance", "Movimientos conciliados X/Y por mes y por día — se ve de un vistazo qué falta."),
                ("Reporte con diferencial", "Saldo según sistema vs saldo real en banco, diferencia, movimientos sin conciliar y fecha de última conciliación por cuenta."),
            ],
            "tasks": [
                {
                    "title": "Realizar la conciliación del mes",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/conciliacion</span> y tocá <span class='pill'>Realizar conciliación</span>.", "Elegí la cuenta y navegá al mes que vas a conciliar."),
                        ("Abrí un día y compará cada movimiento con el estado de cuenta.", "Por movimiento podés ajustar la contraparte (Natural / Jurídica) y quitar o restaurar la comisión si el banco cobró distinto."),
                        ("Marcá el visto de <strong>Conciliado</strong> cuando el movimiento coincide con el banco.", "El contador de <strong>Movimientos conciliados</strong> avanza por día y por mes."),
                    ],
                    "callouts": [
                        ("ok", "Mejor semanal que trimestral", "Conciliar poco y seguido hace que cualquier descuadre aparezca cuando todavía es fácil rastrearlo."),
                    ],
                },
                {
                    "title": "Sacar el reporte de conciliación",
                    "steps": [
                        ("Desde el menú del módulo, tocá <span class='pill'>Reporte de conciliación</span>.", "Elegí <strong>Todas las cuentas</strong> o una en particular, y el mes."),
                        ("Ingresá el <strong>Saldo real en banco</strong> de cada cuenta.", "El saldo según sistema es el neto de movimientos del período (ingresos − egresos − comisiones)."),
                        ("Leé la <strong>Diferencia</strong> y los movimientos <strong>Sin conciliar</strong>.", "Una diferencia distinta de cero con movimientos sin conciliar te dice exactamente dónde buscar."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 9. Cuentas por Cobrar
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Cuentas por Cobrar",
            "route": "/dashboard/cuentas-cobrar",
            "kicker": "Tesorería",
            "who": "Administración, gerencia de operaciones y auditoría",
            "what": "El espejo de Cuentas por Pagar: lo que terceros le deben <strong>al negocio</strong> "
                    "(el «nos deben»). Se registra la deuda a favor y se van cargando los cobros "
                    "parciales; cada cobro se puede vincular a la cuenta bancaria que lo recibió, para "
                    "que la conciliación cierre.",
            "features": [
                ("Tablero de cobranza", "KPIs de Por cobrar, Vencido, Cobrado y Deudores, con filtros Activas / Todas / Cobradas."),
                ("Estados claros", "Pendiente, Parcial, Cobrado, Vencido, Anulado — con el vencimiento visible en cada deuda."),
                ("Cobros parciales", "Cada cobro con monto, forma, fecha, referencia y cuenta destino. El historial se despliega en la misma fila."),
                ("Protección contra sobrecobro", "Si el monto supera el saldo pendiente, el sistema lo avisa."),
            ],
            "tasks": [
                {
                    "title": "Registrar una deuda a favor",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/cuentas-cobrar</span> y tocá <span class='pill'>Nueva</span>.", "Se abre el modal <strong>Nueva cuenta por cobrar</strong>."),
                        ("Completá <strong>¿Quién debe?</strong>, la <strong>Descripción</strong> y el <strong>Monto $</strong>.", "Ej.: un cliente corporativo, un préstamo a otro negocio, un consumo a crédito."),
                        ("Agregá referencia y fecha de vencimiento si las tenés, y confirmá.", "La deuda entra como <strong>Pendiente</strong> y suma al KPI <strong>Por cobrar</strong>."),
                    ],
                },
                {
                    "title": "Registrar un cobro",
                    "steps": [
                        ("Tocá <span class='pill'>Registrar cobro</span> en la deuda.", "El modal muestra el deudor y el saldo pendiente; el monto viene precargado con el saldo completo."),
                        ("Ajustá el <strong>Monto $</strong> si es un cobro parcial y elegí la <strong>Forma de cobro</strong>.", "Si el monto supera el saldo, el sistema lo advierte."),
                        ("Vinculá la <strong>Cuenta que recibió</strong> (opcional) y confirmá.", "El estado pasa a <strong>Parcial</strong> o <strong>Cobrado</strong>, y el cobro queda en el historial desplegable de la deuda."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 10. Facturas y Notas
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Facturas y Notas",
            "route": "/dashboard/compras/documentos",
            "kicker": "Compras y pagos",
            "who": "Administración, gerencia de operaciones y auditoría",
            "what": "El punto de entrada del papel del proveedor al sistema: acá se carga cada factura o "
                    "nota de entrega tal como llegó, con sus líneas (bultos, unidades por bulto, costo). "
                    "Desde el documento salen tres acciones que se pueden hacer en cualquier momento y "
                    "en cualquier orden: <strong>dar entrada al inventario</strong>, <strong>vincularlo a "
                    "una orden de compra</strong> ya recibida, y — si es a crédito — <strong>generar la "
                    "deuda</strong> en <span class='pill'>Cuentas por Pagar</span>.",
            "features": [
                ("Factura o Nota de entrega", "Cada documento con su número, proveedor (o «Sin proveedor»), fecha y condición Contado / Crédito."),
                ("Moneda del documento", "Se carga en la moneda en que vino la factura; si es Bs, con su tasa Bs/USD."),
                ("Líneas por presentación", "Bultos × unidades por bulto × costo por bulto — el sistema calcula unidades y total por línea."),
                ("Estado a la vista", "Etiquetas de En inventario / Sin entrada, OC vinculada, Deuda y Anulado en cada fila."),
                ("Pestaña Conciliación", "Descalces entre documentos y compras: documentos sin compra ni entrada, y compras recibidas sin documento."),
            ],
            "tasks": [
                {
                    "title": "Cargar un documento de proveedor",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/compras/documentos</span> y tocá <span class='pill'>Nuevo documento</span>.", "Elegí el tipo: <strong>Factura</strong> o <strong>Nota de entrega</strong>."),
                        ("Completá número, proveedor y condición de pago.", "Si el proveedor no está en el sistema podés escribir su nombre; la condición es <strong>Contado</strong> o <strong>Crédito</strong>."),
                        ("Elegí la moneda de la factura.", "Si está en Bs, cargá la <strong>Tasa Bs/USD</strong> con la que se convierte."),
                        ("Cargá las líneas: insumo, bultos, unidades por bulto y costo.", "Ej.: 5 bultos × 12 unidades. Si comprás por unidad, dejá las unidades por bulto vacías. El total por línea y el total del documento se calculan solos."),
                        ("Guardá.", "El documento queda en la lista, marcado <strong>Sin entrada</strong> hasta que ingreses la mercancía."),
                    ],
                },
                {
                    "title": "Dar entrada, vincular la OC y generar la deuda",
                    "steps": [
                        ("Tocá <span class='pill'>Dar entrada</span> para ingresar la mercancía al inventario.", "Elegís el almacén destino y el stock sube con las cantidades exactas del documento. La etiqueta pasa a <strong>En inventario</strong>."),
                        ("Tocá <span class='pill'>Vincular OC</span> si la compra ya existía como orden.", "Deja el documento y la orden de compra amarrados, y la pestaña <span class='pill'>Conciliación</span> deja de mostrarlos como descalce."),
                        ("Si es a crédito, tocá <span class='pill'>Generar deuda</span>.", "Crea la cuenta por pagar vinculada al documento — de ahí en adelante la deuda se administra desde <span class='pill'>Cuentas por Pagar</span>."),
                    ],
                    "callouts": [
                        ("info", "Editar tiene ventana", "El botón <span class='pill'>Editar</span> solo aparece mientras el documento no propagó números: sin entrada a inventario y sin deuda generada."),
                    ],
                },
                {
                    "title": "Anular un documento",
                    "steps": [
                        ("Tocá <span class='pill'>Anular</span> en la fila del documento.", "Solo está disponible si el documento aún no entró a inventario."),
                        ("Confirmá la anulación.", "El documento queda marcado <strong>Anulado</strong>. Si ya había generado deuda, la cuenta por pagar se anula en cascada en el mismo acto."),
                    ],
                    "callouts": [
                        ("danger", "La cascada se frena si hay abonos", "Si la deuda del documento ya tiene pagos registrados, el sistema bloquea la anulación del documento completo: primero se revierten los pagos en Cuentas por Pagar. Así nunca quedan las dos piezas inconsistentes."),
                    ],
                },
            ],
        },

        # ══════════════════════════════════════════════════════════════════
        # 11. Intercompany
        # ══════════════════════════════════════════════════════════════════
        {
            "name": "Intercompany",
            "route": "/dashboard/intercompany",
            "kicker": "Multi-negocio",
            "who": "Dueño, administración y auditoría",
            "what": "Para grupos con más de un negocio: el registro de las liquidaciones entre "
                    "empresas — lo que un negocio le debe al otro por préstamos de mercancía, servicios "
                    "compartidos o transferencias. Cada liquidación agrupa un período con sus líneas y "
                    "avanza por estados hasta quedar pagada. Es un módulo apagado por defecto: el OWNER "
                    "lo enciende solo en instalaciones multi-negocio.",
            "features": [
                ("Liquidaciones por período", "Cada liquidación con su código, rango de fechas, total y cantidad de líneas."),
                ("Estados de aprobación", "Borrador → Pendiente aprobación → Aprobado → Pagado, con Disputado para los desacuerdos."),
                ("Trazabilidad", "El historial de liquidaciones queda como registro permanente entre los negocios del grupo."),
            ],
            "tasks": [
                {
                    "title": "Consultar las liquidaciones",
                    "steps": [
                        ("Entrá a <span class='pill'>/dashboard/intercompany</span>.", "Solo lo ven dueño, administración y auditoría, y solo si el módulo está activado en la instalación."),
                        ("Revisá la tabla.", "Cada fila muestra Código, Período, Estado, Total y Líneas de la liquidación."),
                    ],
                },
                {
                    "title": "Leer los estados",
                    "steps": [
                        ("Ubicá la etiqueta de estado de la liquidación.", "<strong>Borrador</strong>: en preparación. <strong>Pendiente aprobación</strong>: esperando el visto del otro negocio. <strong>Aprobado</strong>: lista para pagarse. <strong>Pagado</strong>: cerrada. <strong>Disputado</strong>: hay un desacuerdo que resolver antes de seguir."),
                    ],
                    "callouts": [
                        ("info", "Los préstamos nacen en Operaciones", "El movimiento de mercancía entre negocios se registra en <span class='pill'>Notas de Entrega</span>; Intercompany es donde esa cuenta entre empresas se liquida."),
                    ],
                },
            ],
        },
    ],
}
