# -*- coding: utf-8 -*-
"""Sección 2 del manual de módulos — Ventas y POS.

Todo el contenido sale del código real (labels verificados en
src/app/dashboard/pos/*, src/app/dashboard/sales/*, src/app/kitchen/* y
src/app/dashboard/config/pos/*) y de OPUS_CONTEXT_CAPSULA.md
(§84, §96, §149, §149.2, §151, §152, §153, §157).
"""

SECTION = {
    "id": "ventas",
    "num": 2,
    "title": "Ventas y POS",
    "intro":
        "Todo lo que convierte un pedido en dinero cobrado: los puntos de venta "
        "(restaurante, mesero, delivery), los canales externos (PedidosYA, WINK), la carga "
        "manual de ventas, los reportes de lo vendido y las pantallas donde cocina y barra "
        "ven las comandas. El POS convierte a bolívares con la tasa del día, aplica el "
        "descuento por pago en divisas configurado y pide <strong>PIN de gerente</strong> para "
        "descuentos, cortesías y anulaciones.",
    "modules": [
        # ════════════════════════════════════════════════════════════════════
        # POS RESTAURANTE
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "POS Restaurante",
            "route": "/dashboard/pos/restaurante",
            "kicker": "Punto de venta",
            "who": "Cajera, líder de área y gerencia",
            "what":
                "El punto de venta completo del salón: mesas por zona, cuentas de mostrador "
                "(pickup), subcuentas, pre-cuenta y cobro con todos los métodos de pago. Es el "
                "módulo más importante del sistema — por aquí pasa cada bolívar y cada dólar que "
                "entra por consumo en el local. Trabaja en pareja con el "
                "<span class='pill'>POS Mesero</span> (los mesoneros toman el pedido, la caja "
                "cobra) y alimenta en vivo el <span class='pill'>Historial Ventas</span>, las "
                "comanderas de cocina y barra, y el inventario.",
            "features": [
                ("Mesas y pickups a la vez", "Mesas por zona y cuentas de mostrador numeradas (PK-01, PK-02…) desde el panel <span class='pill'>Pickup / Para llevar</span>. Varios pickups pueden estar abiertos al mismo tiempo."),
                ("Todos los métodos de pago", "Cash $, Cash €, Zelle, Efectivo Bs, PDV y Pago Móvil — con <span class='pill'>Pago único</span> o <span class='pill'>Pago mixto</span> combinando varios."),
                ("Descuento por divisas configurable", "El porcentaje no está fijo en el sistema: sale de <span class='pill'>Configuración POS</span> y hasta se puede ajustar para un cobro puntual con PIN de gerente."),
                ("Servicio editable al cobro", "El recargo de servicio (10% por defecto) se puede cambiar de porcentaje en el momento o eximir con PIN de capitán o gerente."),
                ("Subcuentas", "Una mesa se divide en cuentas separadas; cada una se cobra como una factura independiente con su propio método y su propio servicio."),
                ("Pre-cuenta", "Imprime el consumo para el cliente antes de cobrar, con o sin el descuento de divisas aplicado."),
                ("Anulaciones auditadas", "Anular un ítem o una comanda completa pide PIN y motivo; el inventario se reintegra y todo queda registrado."),
                ("Propina separada del vuelto", "Lo que el cliente deja de más se registra con <span class='pill'>Registrar como propina</span> — nunca se mezcla con la venta."),
            ],
            "tasks": [
                {
                    "title": "Abrir una cuenta de mesa o un pickup",
                    "intro": "Toda venta del salón empieza abriendo una cuenta: en una mesa física o como pickup de mostrador.",
                    "steps": [
                        ("Toca una mesa libre en el plano.", "Se abre el modal <span class='pill'>Abrir cuenta</span> con el nombre de la mesa."),
                        ("Carga el nombre del cliente (opcional) y el número de personas.", "También puedes elegir el <strong>mesonero asignado</strong> de la lista, o dejarlo en «— Ninguno —»."),
                        ("Confirma con <span class='pill'>Abrir cuenta</span>.", "La mesa pasa a ocupada, la cuenta recibe su código (tabCode) y ya puedes agregar productos."),
                        ("Para un pedido de mostrador, usa <span class='pill'>Nuevo Pickup</span>.", "Está en el panel <span class='pill'>Pickup / Para llevar</span>. Cada pickup recibe su número del día (PK-01, PK-02…) y puedes tener varios abiertos a la vez, cada uno con su carrito."),
                    ],
                    "callouts": [
                        ("info", "Cuentas del mesero", "Si la mesa la abrió un mesonero desde el POS Mesero, aquí la ves igual: con su consumo, su mesonero y sus subcuentas si las creó. La caja solo cobra."),
                    ],
                },
                {
                    "title": "Agregar productos, modificadores y notas — y mandar a cocina",
                    "intro": "El menú está a la izquierda por categorías; la cuenta activa a la derecha.",
                    "steps": [
                        ("Toca el producto en el menú.", "Si tiene modificadores (extras, opciones, «sin» ingredientes), se abre su ventana para elegirlos; los obligatorios no dejan continuar sin completar."),
                        ("Ajusta cantidad, <span class='pill'>Notas</span> y <span class='pill'>Para llevar</span> si aplica.", "La nota viaja a cocina tal como la escribes."),
                        ("Toca <span class='pill'>Agregar consumo a la cuenta →</span>.", "Los productos del carrito se suman a la cuenta abierta y la comanda sale hacia cocina y barra según la categoría de cada producto — la comida a cocina, las bebidas a barra."),
                    ],
                    "callouts": [
                        ("info", "Ruteo automático", "No eliges a dónde va cada ítem: el sistema lo decide por la categoría del producto, ya configurada en el menú."),
                    ],
                },
                {
                    "title": "Dividir la cuenta en subcuentas",
                    "intro": "Cuando la mesa quiere pagar por separado. Cada subcuenta es una factura independiente.",
                    "steps": [
                        ("Toca <span class='pill'>Dividir cuenta (subcuentas)</span> en la cuenta activa.", "Entra al panel de subcuentas. Si el mesonero ya las creó, el POS entra solo a este modo."),
                        ("Crea las subcuentas o usa <span class='pill'>División rápida</span>.", "Los botones 2 / 3 / 4 / 5 / 6 reparten los ítems en partes iguales; también puedes crear subcuentas con nombre y asignar ítem por ítem (incluso cantidades parciales)."),
                        ("Cobra cada subcuenta con su propio botón <span class='pill'>Cobrar</span>.", "Cada una con su método de pago, su servicio y su descuento. El panel muestra las <strong>subcuentas cobradas</strong> y el <strong>saldo restante</strong> de la mesa."),
                        ("La mesa se libera cuando todo está pagado.", "Lo que quede sin asignar se cobra por el flujo normal de la cuenta."),
                    ],
                },
                {
                    "title": "Imprimir la pre-cuenta",
                    "intro": "El cliente pide la cuenta antes de pagar: se le imprime el consumo sin cerrar nada.",
                    "steps": [
                        ("Toca <span class='pill'>Pre-cuenta</span> en la cuenta activa.", "Imprime el consumo a monto pleno, sin descuentos."),
                        ("Si el cliente va a pagar en divisas, usa <span class='pill'>Pre-cuenta c/ desc divisas</span>.", "Imprime la misma cuenta pero con el descuento por pago en divisas ya aplicado, para que el cliente vea cuánto pagaría en efectivo o Zelle."),
                    ],
                    "callouts": [
                        ("ok", "No compromete nada", "La pre-cuenta es solo informativa: la cuenta sigue abierta y el descuento real se decide al cobrar."),
                    ],
                },
                {
                    "title": "Cobrar con un solo método (pago simple)",
                    "intro": "El flujo de cobro va en orden: descuento, servicio, forma de pago, confirmación.",
                    "steps": [
                        ("En <span class='pill'>1. Descuento</span> elige cómo va la cuenta.", "<span class='pill'>Normal</span> (sin descuento), el botón de <strong>descuento por divisas</strong> (solo se habilita si el pago es en efectivo $ / € o Zelle) o <span class='pill'>Cortesía (PIN)</span> — total o parcial, siempre con PIN de gerente."),
                        ("Revisa el bloque <span class='pill'>Servicio</span>.", "Por defecto aplica 10%, editable en el momento (accesos rápidos 10 / 12 / 15 / 20%). <span class='pill'>Quitar</span> lo exime, pero pide <strong>PIN de capitán o gerente</strong>."),
                        ("En <span class='pill'>2. Forma de pago</span> elige el método con <span class='pill'>Pago único</span>.", "Cash $, Cash €, Zelle, Efectivo Bs, PDV o Pago Móvil. Los métodos en bolívares convierten con la tasa del día."),
                        ("Ingresa el monto recibido si es efectivo.", "El sistema calcula y muestra el vuelto. Si el cliente deja de más, usa <span class='pill'>Registrar como propina</span>."),
                        ("Toca <span class='pill'>Cobrar cuenta</span> e ingresa el <span class='pill'>PIN de cajera / gerente</span>.", "Se muestra el resumen y confirmas con <span class='pill'>Confirmar pago</span>. El PIN se valida al cobrar: si es inválido, el cobro se rechaza y vuelves a la pantalla."),
                        ("La cuenta se cierra y la mesa se libera.", "La venta queda en <span class='pill'>Historial Ventas</span> con su método, su tasa y su descuento."),
                    ],
                },
                {
                    "title": "Cobrar combinando métodos (pago mixto)",
                    "intro": "Para clientes que pagan una parte en un método y el resto en otro.",
                    "steps": [
                        ("Cambia el selector a <span class='pill'>Pago mixto</span>.", "Aparece la lista de líneas de pago: agregas cada método con su monto."),
                        ("Carga las líneas hasta cubrir el total.", "El panel marca <strong>Pendiente</strong> mientras falte y <strong>Completado</strong> al llegar al monto exacto; también calcula el vuelto si el efectivo se pasa."),
                        ("El descuento por divisas se aplica solo.", "Basta con que <strong>una</strong> línea sea en divisas (Cash $, Cash € o Zelle) para que el descuento aplique sobre esa porción. Zelle + cash, por ejemplo, suman las dos como divisas."),
                        ("Cobra igual que en pago simple.", "<span class='pill'>Cobrar cuenta</span>, PIN y <span class='pill'>Confirmar pago</span>. Cada línea queda registrada por separado en el arqueo."),
                    ],
                    "callouts": [
                        ("info", "Cómo reparte el descuento", "Si TODO el pago es en divisas, el descuento es el mismo que cobrando en una sola línea por el total. Si se combina divisas con bolívares, el descuento aplica solo sobre la parte cubierta con divisas — el resto se cobra a monto pleno."),
                    ],
                },
                {
                    "title": "Descuento por divisas: de dónde sale el % y cómo ajustarlo",
                    "intro": "El porcentaje NO está fijo en el sistema: es un valor configurado, y se puede cambiar para un cobro puntual.",
                    "steps": [
                        ("El % vigente se configura en <span class='pill'>Configuración POS</span>.", "Sección <span class='pill'>Descuento por pago en divisas</span>. Todos los POS y los reportes usan ese mismo valor — el rótulo y el cálculo salen de la misma fuente."),
                        ("Para un cobro puntual de subcuenta, toca <span class='pill'>Ajustar %</span>.", "Aparece en el aviso de descuento de la subcuenta. Se abre un modal con el porcentaje nuevo y el <strong>PIN de gerente</strong>; muestra en vivo cuánto queda el descuento y el neto antes de confirmar."),
                        ("El ajuste vale para ese cobro y nada más.", "Se limpia al cobrar y al cambiar de mesa. El recibo y la auditoría guardan el % realmente cobrado y quién lo autorizó."),
                    ],
                    "callouts": [
                        ("warn", "Quién puede autorizar", "El ajuste del % solo lo autoriza el PIN de un usuario activo con rol Dueño, Gerente Administrativo o Gerente de Operaciones. Sin esa autorización el cobro se rechaza — no cae en silencio al % configurado."),
                    ],
                },
                {
                    "title": "Anular un ítem o una comanda completa",
                    "intro": "Todo lo enviado a cocina se puede anular o corregir, siempre con PIN y motivo.",
                    "steps": [
                        ("Toca el ítem enviado que quieres corregir.", "Puedes elegir <span class='pill'>Anular ítem</span>, <span class='pill'>Ajustar cantidad</span> o cambiarlo por otro producto."),
                        ("Escribe el motivo e ingresa el PIN.", "Los dos campos son obligatorios — sin motivo y PIN el botón no se habilita."),
                        ("Para tirar toda la comanda, usa <span class='pill'>Anular comanda completa</span>.", "Anula TODOS los ítems de esa comanda de una vez con un solo <span class='pill'>PIN de capitán o gerente</span>. El inventario se reintegra automáticamente y la anulación se imprime en cocina/barra para que dejen de prepararla."),
                    ],
                    "callouts": [
                        ("danger", "Queda auditado", "Cada anulación guarda quién la autorizó, el motivo y el monto. El Reporte Z del día muestra el total anulado en su bloque de auditoría."),
                    ],
                },
            ],
            "callouts": [
                ("warn", "Quién autoriza qué (PIN)",
                 "Los PIN de <strong>cobros, descuentos, cortesías y ajuste del % de divisas</strong> solo validan si el usuario es Dueño, Gerente Administrativo o Gerente de Operaciones. Las <strong>anulaciones</strong> las autorizan esos mismos roles más el Jefe de Área — y los capitanes de mesoneros con su PIN de mesonero. Si un PIN «no valida», casi siempre el problema es el ROL del usuario, no el PIN: se corrige en Configuración → Roles."),
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # POS MESERO
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "POS Mesero",
            "route": "/dashboard/pos/mesero",
            "kicker": "Servicio en mesa",
            "who": "Mesoneros (con su PIN); también cajera y jefes de área",
            "what":
                "La vista simplificada del salón para tomar pedidos: el mesonero se identifica "
                "con su PIN, abre la mesa, carga los productos y los marcha a cocina. "
                "<strong>No cobra</strong> — el cobro y el cierre de la cuenta son de la caja, en "
                "el <span class='pill'>POS Restaurante</span>. Así se separan las "
                "responsabilidades sobre el dinero.",
            "features": [
                ("Identificación por PIN", "Sin correo ni contraseña: cada mesonero entra con su PIN numérico, rápido para el ritmo del salón."),
                ("Marchar por tiempos", "Si el pedido mezcla entradas y principales, se pueden enviar por separado: primero las entradas, después los principales — o todo junto."),
                ("Mostrar cuenta al cliente", "Enseña subtotal, servicio y total en USD y Bs sin pasar por caja."),
                ("Funciones de capitán", "Los capitanes pueden dividir la cuenta en subcuentas y transferir la mesa a otro mesonero."),
                ("Aguanta cortes de conexión", "Si se va la señal, el carrito queda guardado en la mesa y se envía cuando vuelve."),
            ],
            "tasks": [
                {
                    "title": "Identificarte con tu PIN",
                    "steps": [
                        ("Abre el POS Mesero.", "Ruta <span class='pill'>/dashboard/pos/mesero</span>. Aparece el teclado numérico con la lista de mesoneros activos."),
                        ("Ingresa tu PIN.", "El sistema te reconoce y tu nombre queda asociado a todo lo que hagas en el turno."),
                    ],
                    "callouts": [
                        ("info", "Sin PIN no hay pedido", "El sistema no deja abrir cuentas ni enviar a cocina sin identificarte primero: cada comanda lleva el nombre del mesonero que la marchó."),
                    ],
                },
                {
                    "title": "Abrir una cuenta en una mesa",
                    "steps": [
                        ("Toca una mesa libre.", "Se abre el modal <span class='pill'>Abrir cuenta</span> con el nombre de la mesa."),
                        ("Carga <strong>nombre del cliente</strong> y <strong>teléfono</strong>.", "Aquí los dos son obligatorios — sin ellos el botón no se habilita. También indicas el número de personas."),
                        ("Confirma con <span class='pill'>Abrir cuenta</span>.", "La mesa pasa a ocupada contigo como <strong>mesonero de la mesa</strong> y ya puedes cargar el pedido."),
                    ],
                },
                {
                    "title": "Agregar productos y enviar a cocina",
                    "steps": [
                        ("Elige los productos del menú por categorías.", "Con sus extras, modificadores y notas si el producto los tiene."),
                        ("Revisa el pedido en el panel de la derecha.", "Verifica cantidades y notas antes de marchar."),
                        ("Toca <span class='pill'>Enviar a cocina</span>.", "La comida va a la comandera de cocina y las bebidas a la de barra, automáticamente."),
                        ("Si hay entradas y principales, marcha por tiempos.", "Aparecen los botones <span class='pill'>Entradas</span> y <span class='pill'>Principales</span> para enviar cada tanda por separado, o <span class='pill'>Marchar todo</span> para enviar todo junto."),
                    ],
                    "callouts": [
                        ("info", "Sin conexión", "Si se cae la señal, la orden queda guardada en el carrito de la mesa — tocas <span class='pill'>Enviar a cocina</span> de nuevo cuando vuelva y sale sin duplicarse."),
                    ],
                },
                {
                    "title": "Mostrar la cuenta al cliente",
                    "steps": [
                        ("Toca <span class='pill'>Mostrar cuenta al cliente</span>.", "Muestra el consumo, el servicio y el total en USD con su equivalente en Bs a la tasa del día."),
                        ("Avisa a la caja para el cobro.", "El cobro y el cierre de la mesa los hace la cajera en el POS Restaurante, no el mesonero."),
                    ],
                },
                {
                    "title": "Dividir la cuenta o transferir la mesa (capitanes)",
                    "steps": [
                        ("Usa <span class='pill'>Dividir cuenta (subcuentas)</span>.", "Solo visible para capitanes. Reparte el consumo en subcuentas que después la caja cobra por separado."),
                        ("Usa <span class='pill'>Transferir mesa</span> para cambiar de mesonero.", "La transferencia pide <strong>PIN de capitán o gerente</strong> y queda registrada."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # POS DELIVERY
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "POS Delivery",
            "route": "/dashboard/pos/delivery",
            "kicker": "Despacho a domicilio",
            "who": "Cajera y gerencia",
            "what":
                "El punto de venta para pedidos a domicilio: cliente, dirección, pedido, costo de "
                "envío por zona y cobro en el mismo flujo. El costo del envío ya no depende de la "
                "moneda ni está fijo en el sistema: depende de la <strong>zona</strong> (normal o "
                "cercano) y se configura en <span class='pill'>Configuración POS</span>. Reconoce "
                "clientes recurrentes y puede leer pedidos pegados desde WhatsApp.",
            "features": [
                ("Clientes recurrentes", "Busca por cédula, nombre o teléfono y la ficha se completa sola con la dirección conocida."),
                ("Envío por zona", "<span class='pill'>Normal</span> y <span class='pill'>Cercano</span>, cada uno con su tarifa configurada (por defecto $3 y $1). La moneda solo decide en qué se cobra."),
                ("Pedidos programados", "Hora de entrega opcional que se imprime en grande en la comanda para que cocina priorice."),
                ("Lector de WhatsApp", "Pegas el mensaje del cliente y el sistema arma el pedido."),
                ("Descuento por divisas", "Aplica igual que en el restaurante, también en pago mixto — pero nunca toca el costo del envío."),
            ],
            "tasks": [
                {
                    "title": "Cargar el cliente y la dirección",
                    "steps": [
                        ("Busca primero si el cliente ya existe.", "Campo <span class='pill'>Buscar cliente recurrente por cédula, nombre o teléfono…</span> — si aparece, sus datos se cargan solos."),
                        ("Si es nuevo, completa <strong>nombre</strong>, <strong>teléfono</strong> y la <strong>dirección exacta de entrega</strong>.", "El teléfono enlaza el pedido a la ficha del cliente para la próxima vez."),
                        ("Si el cliente pidió una hora, cargala en el campo de hora de entrega.", "Es opcional. Se imprime en grande en la comanda de cocina/barra; si la hora ya pasó hoy, el sistema asume que es para mañana."),
                    ],
                },
                {
                    "title": "Armar el pedido y elegir la zona de envío",
                    "steps": [
                        ("Agrega los productos del menú.", "Igual que en los otros POS: categorías, modificadores y notas."),
                        ("En el bloque <span class='pill'>Envío</span> elige la zona.", "<span class='pill'>Normal</span> o <span class='pill'>Cercano</span> — cada botón muestra su tarifa vigente."),
                        ("En <span class='pill'>¿Cómo lo cobras?</span> elige la moneda del envío.", "<span class='pill'>Dólares</span> o <span class='pill'>Bolívares</span>. El monto es el mismo en los dos botones: la moneda solo decide en qué se cobra (en Bs se convierte con la tasa del día)."),
                    ],
                    "callouts": [
                        ("info", "El envío es del motorizado", "El descuento por pago en divisas nunca se aplica sobre el costo del envío — el fee siempre se cobra completo, en la zona que sea."),
                    ],
                },
                {
                    "title": "Cobrar el pedido",
                    "steps": [
                        ("Elige descuento y método de pago.", "<span class='pill'>Normal</span> o el descuento por divisas (solo con Cash $, Cash € o Zelle); cortesía con PIN de gerente. Puedes cobrar con un método o en pago mixto."),
                        ("En pago mixto, el descuento aplica sobre la porción en divisas.", "El panel muestra cuánto consumo cubren los dólares recibidos y cuánto se descuenta."),
                        ("Toca <span class='pill'>Confirmar orden</span>.", "Se muestra el resumen del pago, confirmas, y la comanda sale a cocina/barra con los datos del cliente y la hora si la hay."),
                    ],
                },
                {
                    "title": "Cargar un pedido pegado desde WhatsApp",
                    "steps": [
                        ("Abre el lector de pedidos de WhatsApp.", "Pegas el mensaje tal como lo mandó el cliente."),
                        ("Revisa lo que el sistema reconoció.", "Productos, cantidades y datos del cliente — corrige lo que haga falta antes de confirmar."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # PEDIDOSYA
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "PedidosYA",
            "route": "/dashboard/pos/pedidosya",
            "kicker": "Canales externos",
            "who": "Cajera y gerencia",
            "what":
                "Registro de las órdenes que entran por la plataforma PedidosYA. Aquí se carga el "
                "pedido para que salga la comanda a cocina y quede contado en las ventas del día — "
                "pero <strong>no se cobra</strong>: el cobro lo gestiona la plataforma. Por eso la "
                "pantalla muestra un <span class='pill'>Total estimado</span> en vez de un flujo "
                "de pago.",
            "features": [
                ("Sin cobro", "La pantalla lo dice tal cual: <em>«PedidosYA gestiona el cobro»</em>. El sistema solo registra la venta y descuenta inventario."),
                ("Comanda a cocina", "El pedido sale a cocina/barra con su propio contador del día, igual que cualquier otro canal."),
                ("Notas y cantidades", "Cada producto acepta cantidad y notas para cocina."),
            ],
            "tasks": [
                {
                    "title": "Registrar un pedido de la plataforma",
                    "steps": [
                        ("Agrega los productos del pedido.", "Menú por categorías, con cantidad y <span class='pill'>Notas</span> por producto."),
                        ("Revisa el <span class='pill'>Total estimado</span>.", "Es referencial — lo que la plataforma cobra al cliente lo maneja PedidosYA."),
                        ("Registra el pedido.", "La comanda sale a cocina/barra y la venta queda en el historial marcada con su canal."),
                    ],
                },
                {
                    "title": "Ver lo vendido por este canal",
                    "steps": [
                        ("Entra a <span class='pill'>Historial Ventas</span> y filtra por tipo PedidosYA.", "El Reporte Z y el resumen de cierre también separan este canal en su propio renglón."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # WINK
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "WINK",
            "route": "/dashboard/pos/wink",
            "kicker": "Canales externos",
            "who": "Cajera y gerencia (según módulos asignados)",
            "what":
                "Registro de las ventas del canal WINK. Funciona igual que PedidosYA — se carga "
                "el pedido, sale la comanda y <strong>el cobro lo gestiona la plataforma</strong> — "
                "con una diferencia: los productos pueden tener un <strong>precio propio para "
                "WINK</strong>, distinto al del menú, que carga la gerencia.",
            "features": [
                ("Precio propio por canal", "Si el producto tiene precio WINK cargado, se usa ese; si no, el precio base del menú."),
                ("Sin cobro", "La pantalla muestra <em>«WINK gestiona el cobro»</em> y un <span class='pill'>Total estimado</span>."),
                ("Reimpresión inmediata", "El último pedido registrado se puede reimprimir con un toque."),
            ],
            "tasks": [
                {
                    "title": "Registrar un pedido WINK",
                    "steps": [
                        ("Agrega los productos con su cantidad y notas.", "Los precios que ves ya son los del canal: el precio WINK si existe, el del menú si no."),
                        ("Toca <span class='pill'>Registrar pedido</span>.", "La comanda sale a cocina/barra con su número y la venta queda registrada en el canal WINK."),
                    ],
                },
                {
                    "title": "Reimprimir la última comanda",
                    "steps": [
                        ("Toca <span class='pill'>Reimprimir comanda</span>.", "Aparece debajo del botón de registro, con el número del último pedido. Útil si la impresora falló o cocina perdió el papel."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # CARGAR VENTAS
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "Cargar Ventas",
            "route": "/dashboard/ventas/cargar",
            "kicker": "Ventas manuales",
            "who": "Gerencia y auditoría",
            "what":
                "Carga manual de ventas que no pasaron por un POS: eventos, ventas externas o "
                "correcciones. La venta cargada aquí entra a los mismos reportes que las del POS, "
                "con su tipo (mesa, delivery, para llevar), su método de pago y su descuento — "
                "usando el mismo % de divisas configurado que usa el resto del sistema.",
            "features": [
                ("Resumen del día arriba", "Ventas de hoy, ingresos, y el reparto restaurante / delivery a la vista."),
                ("Mismos descuentos que el POS", "El descuento por divisas usa el porcentaje configurado — la misma venta da el mismo monto aquí y en el POS."),
                ("Listado editable del día", "La tabla de abajo muestra cada venta cargada hoy; las anuladas quedan marcadas <strong>ANULADA</strong>, no se borran."),
            ],
            "tasks": [
                {
                    "title": "Cargar una venta manual",
                    "steps": [
                        ("Arma el pedido desde el bloque <span class='pill'>Menú</span>.", "Agrega los productos con sus cantidades, como en un POS."),
                        ("Elige el tipo de venta.", "<span class='pill'>Mesa</span>, <span class='pill'>Delivery</span> o <span class='pill'>Para llevar</span>, con su método de pago y descuento si corresponde."),
                        ("Revisa subtotal, descuento y total, y toca <span class='pill'>Registrar Venta</span>.", "La venta queda en el historial del día y descuenta inventario igual que una venta de POS."),
                    ],
                },
                {
                    "title": "Revisar lo cargado hoy",
                    "steps": [
                        ("Mira la tabla del día.", "Columnas Orden, Tipo, Cliente, Items, Total, Hora y Acciones."),
                        ("Verifica contra los totales de arriba.", "Ventas Hoy e Ingresos Hoy deben cuadrar con lo que acabas de cargar."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # HISTORIAL VENTAS
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "Historial Ventas",
            "route": "/dashboard/sales",
            "kicker": "Reportes de venta",
            "who": "Gerencia, auditoría, cajera y chef",
            "what":
                "Todas las ventas del negocio en un solo listado: de los POS, de los canales "
                "externos y de la carga manual. De aquí salen el <strong>Reporte Z</strong> (cierre "
                "del día por método de pago), el <strong>arqueo de caja</strong> exportable a "
                "Excel y las <strong>anulaciones de ventas ya cobradas</strong>. Cada venta guarda "
                "la tasa con la que se cobró, así los reportes viejos no cambian cuando la tasa sube.",
            "features": [
                ("Filtros combinables", "Fecha, búsqueda libre, <span class='pill'>Método</span> (Cash $, Zelle, PDV, Pago Móvil, Efectivo Bs, Cortesía, Pago Mixto…), <span class='pill'>Tipo</span> (Mesa, Pickup, Delivery, PedidosYA), propinas y ventas con descuento."),
                ("Reporte Z", "Cierre del día agrupado por método de pago, con totales en USD y Bs, arqueo, pedidos por canal y bloque de auditoría de anulaciones."),
                ("Cierre del día", "Resumen ejecutivo: ventas por canal, descuentos, servicio, desglose divisas vs bolívares y facturas procesadas/anuladas."),
                ("Exportar Excel", "El arqueo completo se baja para cuadrar contra el efectivo y los puntos de venta."),
                ("Anulación con PIN", "Anular una venta cobrada pide PIN de autorización y deja el rastro completo."),
            ],
            "tasks": [
                {
                    "title": "Buscar y filtrar ventas",
                    "steps": [
                        ("Elige la fecha y usa <span class='pill'>Buscar</span>.", "Por número de orden, cliente o monto."),
                        ("Combina los filtros <span class='pill'>Método</span> y <span class='pill'>Tipo</span>.", "Por ejemplo: solo Zelle de delivery, o solo ventas <span class='pill'>Con descuento</span> del día."),
                    ],
                },
                {
                    "title": "Sacar el Reporte Z y el cierre del día",
                    "steps": [
                        ("Elige la fecha y toca <span class='pill'>Reporte Z</span>.", "Agrupa por método de pago, muestra el <strong>TOTAL COBRADO</strong>, el total en Bs con la tasa, el arqueo de caja y las anulaciones del día."),
                        ("Toca <span class='pill'>Cierre del día</span> para el resumen ejecutivo.", "Ventas por canal, descuentos, servicio y el desglose Divisas (Cash / Zelle) vs Bolívares (PDV / Móvil)."),
                        ("Usa <span class='pill'>Exportar Excel</span> para el arqueo.", "Es la base del cuadre de caja del turno."),
                    ],
                },
                {
                    "title": "Anular una venta cobrada",
                    "steps": [
                        ("Ubica la venta y abre <span class='pill'>Anular Venta</span>.", "El modal muestra cliente, cajera, ítems y total cobrado antes de confirmar."),
                        ("Ingresa el <span class='pill'>PIN de Autorización</span>.", "Solo autorizan los roles de gerencia (y Jefe de Área). La venta queda marcada como anulada — no se borra — y aparece en el bloque de auditoría del Reporte Z."),
                    ],
                    "callouts": [
                        ("danger", "La anulación es visible siempre", "Las órdenes anuladas y su monto quedan en el Reporte Z del día y en el historial. No hay forma de anular «en silencio»."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # PLATOS VENDIDOS
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "Platos Vendidos",
            "route": "/dashboard/sales/items",
            "kicker": "Reportes de venta",
            "who": "Gerencia, auditoría y chef",
            "what":
                "Cuántas unidades se vendieron de cada producto en un rango de fechas, con sus "
                "ingresos y su precio promedio. Es el reporte que usa el chef para planificar "
                "producción y la gerencia para decidir qué empujar o sacar del menú. Incluye los "
                "modificadores vendidos.",
            "features": [
                ("Rango de fechas libre", "Un día, una semana, el mes — lo que necesites comparar."),
                ("Filtro por canal", "Todos, Restaurante, Delivery o PedidosYa, y por categoría del menú."),
                ("Tabla ordenable", "Producto, Categoría, Unidades, Ingresos y Precio promedio."),
            ],
            "tasks": [
                {
                    "title": "Consultar lo vendido en un rango",
                    "steps": [
                        ("Elige el rango de fechas.", "El reporte se arma con las ventas cobradas del período."),
                        ("Filtra por canal y categoría si quieres afinar.", "Por ejemplo: solo Delivery, solo bebidas."),
                        ("Lee la tabla.", "Unidades e ingresos por producto, con su precio promedio real (ya con descuentos)."),
                    ],
                },
                {
                    "title": "Usarlo para producción y menú",
                    "steps": [
                        ("Compara semanas equivalentes.", "Las unidades por plato marcan qué producir y cuánto."),
                        ("Cruza con <span class='pill'>Margen por Plato</span>.", "Lo más vendido no siempre es lo más rentable — las dos vistas juntas cuentan la historia completa."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # COMANDERA COCINA
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "Comandera Cocina",
            "route": "/kitchen",
            "kicker": "Pantallas de cocina",
            "who": "Cocina (cuentas de comandera) y jefes de área",
            "what":
                "La pantalla de cocina: muestra las órdenes pendientes que llegan de todos los "
                "POS — <strong>sin las bebidas</strong>, que van a la Comandera Barra — y permite "
                "marcarlas como listas. Es pantalla completa, sin menú lateral, pensada para un "
                "monitor fijo en la cocina. Se actualiza sola, sin recargar.",
            "features": [
                ("Órdenes en tiempo real", "Las comandas aparecen solas al ser enviadas desde cualquier POS."),
                ("Solo comida", "Las bebidas no aparecen aquí: cada estación ve lo suyo."),
                ("Comanda impresa en paralelo", "Además de la pantalla, la comanda sale por la impresora de cocina si está configurado."),
            ],
            "tasks": [
                {
                    "title": "Ver y despachar comandas",
                    "steps": [
                        ("Abre la comandera.", "Ruta <span class='pill'>/kitchen</span>. El encabezado muestra las órdenes pendientes."),
                        ("Prepara lo que va llegando.", "Cada tarjeta trae los ítems con sus notas, el mesonero y la mesa o el canal."),
                        ("Marca la orden con <span class='pill'>LISTO PARA ENTREGAR</span> al terminarla.", "Desaparece de pendientes y el salón sabe que el plato salió."),
                    ],
                },
                {
                    "title": "Leer bien la comanda impresa",
                    "steps": [
                        ("El número grande dice <strong>PEDIDO N°</strong> — no es la mesa.", "Es el contador de pedidos del día. La mesa real viene en su propia línea («Mesa: …»)."),
                        ("En delivery, pickup y plataformas ese número sí es el identificador.", "Es el número con el que se canta y se entrega el pedido."),
                    ],
                    "callouts": [
                        ("info", "Por qué cambió", "Antes la comanda imprimía «MESA N° 13» cuando 13 era el pedido del día y la mesa real era otra. Ahora en las comandas de mesa ese contador ni aparece — la mesa real es la única que se lee."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # COMANDERA BARRA
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "Comandera Barra",
            "route": "/kitchen/barra",
            "kicker": "Pantallas de cocina",
            "who": "Barra (y cajera, para apoyar el despacho)",
            "what":
                "La misma comandera, pero <strong>solo con las bebidas</strong>. El encabezado lo "
                "dice: «Solo bebidas · Órdenes pendientes». Las órdenes llegan solas cuando "
                "cualquier POS envía un pedido con bebidas — el ruteo lo decide la categoría del "
                "producto en el menú, nadie tiene que elegir a mano.",
            "features": [
                ("Solo bebidas", "El resto del pedido va a la Comandera Cocina; barra ve únicamente lo suyo."),
                ("Actualización automática", "Las nuevas órdenes de barra aparecen sin recargar la pantalla."),
            ],
            "tasks": [
                {
                    "title": "Despachar las bebidas pendientes",
                    "steps": [
                        ("Abre la comandera de barra.", "Ruta <span class='pill'>/kitchen/barra</span>, pantalla completa."),
                        ("Prepara y marca cada orden como lista al salir.", "Desaparece de pendientes, igual que en cocina."),
                    ],
                },
                {
                    "title": "Si no aparece una bebida",
                    "steps": [
                        ("Verifica la categoría del producto en el <span class='pill'>Menú</span>.", "El ruteo a barra depende de la categoría: si el producto está en una categoría de comida, la orden salió por cocina."),
                    ],
                },
            ],
        },
        # ════════════════════════════════════════════════════════════════════
        # CONFIGURACIÓN POS
        # ════════════════════════════════════════════════════════════════════
        {
            "name": "Configuración POS",
            "route": "/dashboard/config/pos",
            "kicker": "Configuración",
            "who": "Gerencia (y cajera para consultar)",
            "what":
                "Los ajustes que gobiernan a todos los POS: cuándo se imprimen comandas y "
                "facturas, si se valida el stock antes de confirmar una orden, el "
                "<strong>porcentaje del descuento por pago en divisas</strong> y el "
                "<strong>costo de envío del delivery por zona</strong>. Lo que se cambia aquí "
                "aplica de inmediato en las pantallas de venta.",
            "features": [
                ("Descuento por divisas", "Sección <span class='pill'>Descuento por pago en divisas</span>: un solo número que usan todos los POS, la carga manual y los reportes."),
                ("Costo de envío por zona", "Sección <span class='pill'>Costo de envío del delivery</span>: <span class='pill'>Envío normal</span> y <span class='pill'>Envío cercano</span>, cada uno con su monto."),
                ("Impresión por evento", "Interruptores para imprimir comanda al confirmar o al enviar a mesa, y factura al registrar pago o automáticamente."),
                ("Control de inventario", "<span class='pill'>Validar stock antes de confirmar orden</span>: con esto activo, el POS no deja vender lo que no hay."),
            ],
            "tasks": [
                {
                    "title": "Cambiar el % del descuento por divisas",
                    "steps": [
                        ("Entra a Configuración POS.", "Ruta <span class='pill'>/dashboard/config/pos</span>."),
                        ("En <span class='pill'>Descuento por pago en divisas</span>, carga el <span class='pill'>Porcentaje de descuento</span>.", "La pantalla muestra el descuento actual. El valor aplica a todos los POS y a los rótulos de los reportes — nadie escribe el número a mano en ninguna pantalla."),
                    ],
                    "callouts": [
                        ("info", "Ajustes puntuales", "Para un cobro específico con un % distinto no hace falta tocar esta configuración: la subcuenta tiene <span class='pill'>Ajustar %</span> con PIN de gerente, de un solo uso."),
                    ],
                },
                {
                    "title": "Cambiar el costo de envío del delivery",
                    "steps": [
                        ("Ve a la sección <span class='pill'>Costo de envío del delivery</span>.", "Dos campos: <span class='pill'>Envío normal</span> y <span class='pill'>Envío cercano</span> (por defecto $3 y $1)."),
                        ("Guarda los montos.", "El POS Delivery muestra las nuevas tarifas de inmediato en su selector de zona. La moneda en que se cobra el envío no cambia el monto — solo lo convierte a Bs con la tasa del día."),
                    ],
                },
                {
                    "title": "Ajustar impresión y validación de stock",
                    "steps": [
                        ("Revisa los interruptores de impresión.", "<span class='pill'>Imprimir comanda cocina al confirmar</span>, <span class='pill'>Imprimir comanda cocina al enviar a mesa</span>, <span class='pill'>Imprimir factura al registrar pago (cerrar cuenta)</span> y la impresión por impresora de red (agente)."),
                        ("Activa <span class='pill'>Validar stock antes de confirmar orden</span> si quieres el candado.", "Con esto encendido, un producto sin existencias no se puede vender desde el POS."),
                    ],
                },
            ],
        },
    ],
}
