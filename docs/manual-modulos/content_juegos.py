# -*- coding: utf-8 -*-
"""Sección 5 — Entretenimiento (Table Pong). Datos factuales de
src/app/dashboard/games|reservations|wristbands|queue, games.actions.ts,
modules-registry.ts y OPUS_CONTEXT_CAPSULA.md (§8, §153)."""

SECTION = {
    "id": "juegos",
    "num": 5,
    "title": "Entretenimiento (Table Pong)",
    "intro":
        "Los módulos de esta sección son los del negocio de juegos hermano del restaurante: "
        "<strong>Table Pong</strong>. Manejan las estaciones de juego (billar, PS y similares), "
        "las sesiones que se facturan por hora o con pulsera, las reservas con depósito y la "
        "cola de espera cuando el local está lleno. Vienen apagados por defecto y se encienden "
        "solo en la instalación de Table Pong — el resto del sistema (usuarios, PIN, caja, tasa "
        "del día) es el mismo KPSULA que usa el restaurante.",
    "modules": [
        # ====================================================================
        # JUEGOS
        # ====================================================================
        {
            "name": "Juegos",
            "route": "/dashboard/games",
            "kicker": "Estaciones y sesiones",
            "who": "Dueño y gerentes de Table Pong; la cajera opera las sesiones",
            "what":
                "El tablero central de Table Pong: la pantalla <strong>Juegos y Entretenimiento</strong> "
                "muestra todas las estaciones de juego con su estado en vivo — "
                "<span class='pill'>Disponible</span>, <span class='pill'>En Uso</span>, "
                "<span class='pill'>Reservado</span> o <span class='pill'>Mantenimiento</span> — "
                "cuántas están libres u ocupadas, las reservas del día, cuánta gente hay en cola y el "
                "total <strong>Facturado hoy</strong>. Cada sesión de juego nace aquí, corre su tiempo "
                "y al cerrarse calcula sola el monto a cobrar.",
            "features": [
                ("Grilla de estaciones en vivo", "Cada estación muestra su nombre, código, estado y tarifa por hora (<span class='pill'>$/hora</span>)."),
                ("Sesiones activas", "El panel <strong>Sesiones activas</strong> lista cada mesa en juego con el cliente y los minutos transcurridos."),
                ("Monto estimado en vivo", "Mientras la sesión corre, la estación ocupada muestra el monto aproximado acumulado según su tarifa por hora."),
                ("Tres modos de facturación", "Por hora (según la tarifa de la estación), por pulsera (plan prepagado) o monto fijo."),
                ("Pausar y reanudar", "Una sesión se puede pausar (el cliente sale un momento) y reanudar sin cerrarla."),
                ("Código correlativo", "Cada sesión recibe un código <span class='pill'>GSN</span> correlativo que nunca se reinicia — sirve para auditar."),
            ],
            "tasks": [
                {
                    "title": "Iniciar una sesión de juego",
                    "intro": "La sesión arranca sobre una estación libre. Desde ese momento el tiempo corre y el sistema lo registra todo.",
                    "steps": [
                        ("Entrá al módulo Juegos.", "Ruta <span class='pill'>/dashboard/games</span>, en el grupo de Entretenimiento del menú lateral."),
                        ("Elegí una estación en estado <span class='pill'>Disponible</span>.", "Si la estación está en uso, reservada o en mantenimiento, el sistema no deja abrir la sesión y te dice el estado."),
                        ("Cargá los datos del cliente.", "Nombre (opcional — por defecto <em>Cliente</em>) y cantidad de personas."),
                        ("Elegí cómo se factura.", "Por hora, por pulsera o monto fijo. Por hora es el modo por defecto."),
                        ("Confirmá el inicio.", "La estación pasa a <span class='pill'>En Uso</span>, la sesión aparece en <strong>Sesiones activas</strong> con su tiempo corriendo, y queda registrado quién la abrió."),
                    ],
                },
                {
                    "title": "Cerrar y cobrar una sesión por hora",
                    "intro": "Al cerrar, el sistema calcula el tiempo jugado y el monto según la tarifa de la estación — no hay que sacar cuentas a mano.",
                    "steps": [
                        ("Ubicá la sesión activa de la estación.", "En la grilla de Juegos o en el panel <strong>Sesiones activas</strong>. La tarjeta ya muestra el tiempo transcurrido y el monto aproximado."),
                        ("Cerrá la sesión.", "El sistema toma la hora de cierre y cuenta los minutos jugados (el minuto empezado se cuenta completo)."),
                        ("Revisá el monto calculado.", "Minutos jugados ÷ 60 × tarifa por hora de la estación. Ese es el total a cobrar."),
                        ("Cobrá al cliente.", "El monto entra en el <strong>Facturado hoy</strong> del módulo y la sesión queda en el historial con quién la abrió y quién la cerró."),
                        ("La estación se libera sola.", "Vuelve a <span class='pill'>Disponible</span> y queda lista para el siguiente cliente."),
                    ],
                    "callouts": [
                        ("warn", "Descuento o anulación: con PIN", "Si el cobro lleva un descuento o hay que anular, el sistema pide <strong>PIN de gerente</strong>. Autorizan cobros y descuentos: Dueño, Gerente Administrativo y Gerente de Operaciones; las anulaciones también el Jefe de Área."),
                    ],
                },
                {
                    "title": "Vender una pulsera",
                    "intro": "La pulsera es un plan prepagado: el cliente paga una vez el precio del plan y juega el tiempo que ese plan incluye, sin contador por hora.",
                    "steps": [
                        ("Consultá los planes en Pulseras.", "Ruta <span class='pill'>/dashboard/wristbands</span>. Cada plan tiene precio y duración definidos — eso es lo que se le cobra al cliente."),
                        ("Cobrá el precio del plan y entregá la pulsera.", "El color del plan ayuda a distinguir de un vistazo qué pulsera lleva cada cliente."),
                        ("Iniciá la sesión con facturación por pulsera.", "Al abrir la sesión en Juegos, elegí el modo pulsera y registrá el código de la pulsera entregada."),
                        ("Al cerrar, no se cobra tiempo.", "La sesión con pulsera no genera monto por hora: el cliente ya pagó el plan por adelantado."),
                    ],
                    "callouts": [
                        ("info", "También por reserva", "Si la reserva del cliente ya tiene un plan de pulsera vinculado, el check-in abre la sesión directamente en modo pulsera — no hay que elegir nada."),
                    ],
                },
                {
                    "title": "Pausar y reanudar una sesión",
                    "intro": "Para cuando el cliente interrumpe el juego un momento y no corresponde cerrarle la cuenta.",
                    "steps": [
                        ("Pausá la sesión activa.", "La sesión queda en pausa pero sigue viva: no se cierra ni se cobra nada todavía."),
                        ("Reanudá cuando el cliente vuelva.", "La sesión vuelve a estado activo y se cierra después de la forma normal."),
                    ],
                },
            ],
            "callouts": [
                ("warn", "Gerentes de Table Pong: PIN asignado en Usuarios", "Para autorizar descuentos o anulaciones, el gerente necesita su <strong>PIN</strong> asignado en <span class='pill'>Usuarios</span> <strong>y</strong> un rol que autorice (Dueño, Gerente Adm. o Gerente Ops.). Un PIN sobre un rol que no autoriza no valida nunca en el cobro — el sistema avisa al momento de asignarlo si el rol no sirve."),
                ("info", "Quién ve el módulo", "El tablero de Juegos es de gerencia (Dueño, Gerente Adm. y Gerente Ops.). La cajera puede operar sesiones, reservas y cola, pero no crear estaciones ni tipos de juego."),
            ],
        },
        # ====================================================================
        # RESERVACIONES
        # ====================================================================
        {
            "name": "Reservaciones",
            "route": "/dashboard/reservations",
            "kicker": "Reservas de estación",
            "who": "Gerencia y cajera de Table Pong",
            "what":
                "El calendario del día: quién reservó qué estación, a qué hora y con cuántas personas. "
                "Cada reserva pasa por estados — <span class='pill'>Pendiente</span>, "
                "<span class='pill'>Confirmada</span>, <span class='pill'>Check-in</span>, "
                "<span class='pill'>No se presentó</span> o <span class='pill'>Cancelada</span> — y puede "
                "llevar depósito y un plan de pulsera vinculado. Al hacer el check-in, la sesión de juego "
                "arranca sola en <span class='pill'>Juegos</span>.",
            "features": [
                ("Vista del día", "Lista las reservas de hoy con hora de inicio y fin, cliente, teléfono, estación y personas."),
                ("Sin choques de horario", "El sistema no deja crear dos reservas que se pisen en la misma estación: avisa con quién choca y a qué hora."),
                ("Depósito", "La reserva puede llevar un monto de depósito, marcado como pagado o <em>(pendiente)</em>."),
                ("Plan de pulsera vinculado", "Si el cliente reservó con pulsera, la reserva lo muestra y el check-in lo respeta."),
                ("Código propio", "Cada reserva recibe un código <span class='pill'>RES</span> con año y correlativo."),
            ],
            "tasks": [
                {
                    "title": "Crear una reserva",
                    "steps": [
                        ("Entrá a Reservaciones.", "Ruta <span class='pill'>/dashboard/reservations</span>."),
                        ("Cargá el cliente y la estación.", "Nombre (obligatorio), teléfono si lo tenés, cantidad de personas y la estación que quiere."),
                        ("Definí el horario.", "Hora de inicio y de fin. Si otra reserva ocupa ese rango en la misma estación, el sistema lo rechaza y te dice con cuál choca."),
                        ("Agregá depósito o plan de pulsera si aplica.", "El depósito queda marcado como pagado o pendiente; el plan de pulsera define cómo se facturará la sesión."),
                        ("Guardá.", "La reserva nace en <span class='pill'>Pendiente</span> y aparece en la lista del día."),
                    ],
                },
                {
                    "title": "Confirmar o cancelar una reserva",
                    "steps": [
                        ("Confirmá cuando el cliente ratifica.", "La reserva pasa de <span class='pill'>Pendiente</span> a <span class='pill'>Confirmada</span>."),
                        ("Cancelá si el cliente desiste.", "Podés dejar anotado el motivo. La reserva queda <span class='pill'>Cancelada</span> y libera el horario de la estación."),
                    ],
                },
                {
                    "title": "Hacer el check-in cuando llega el cliente",
                    "intro": "El check-in es el puente entre la reserva y el juego: un solo paso deja todo andando.",
                    "steps": [
                        ("Ubicá la reserva del cliente en la lista de hoy.", "Debe estar en <span class='pill'>Pendiente</span> o <span class='pill'>Confirmada</span>."),
                        ("Hacé el check-in.", "La reserva pasa a <span class='pill'>Check-in</span> y el sistema abre la sesión de juego automáticamente en la estación reservada."),
                        ("La sesión ya corre en Juegos.", "Con pulsera si la reserva tenía plan vinculado; por hora si no. La estación pasa a <span class='pill'>En Uso</span>."),
                    ],
                    "callouts": [
                        ("info", "No se presentó", "Si el cliente nunca llega, la reserva se marca como <span class='pill'>No se presentó</span> y queda en el registro del día, aparte de las activas."),
                    ],
                },
            ],
        },
        # ====================================================================
        # PULSERAS
        # ====================================================================
        {
            "name": "Pulseras",
            "route": "/dashboard/wristbands",
            "kicker": "Planes prepagados",
            "who": "Dueño y gerentes de Table Pong",
            "what":
                "El catálogo de <strong>planes de pulsera</strong>: cada plan define un tiempo de juego "
                "prepagado con su precio, su duración y un color para reconocer la pulsera física de un "
                "vistazo. Los planes creados acá se vinculan a las reservas y a las sesiones de "
                "<span class='pill'>Juegos</span> — cuando una sesión se abre con pulsera, no se le "
                "cobra tiempo por hora.",
            "features": [
                ("Ficha del plan", "Nombre, código, descripción, <strong>Duración</strong> (horas y minutos), <strong>Precio</strong> y color distintivo."),
                ("Máximo de estaciones", "Un plan puede limitar en cuántas estaciones se usa a la vez (<strong>Máx. estaciones</strong>)."),
                ("Uso a la vista", "Cada plan muestra sus <strong>Reservas usadas</strong>, para saber cuáles se venden y cuáles no."),
                ("Activar / desactivar", "Un plan que ya no se ofrece se desactiva sin perder su historial."),
            ],
            "tasks": [
                {
                    "title": "Crear un plan de pulsera",
                    "steps": [
                        ("Entrá a Pulseras.", "Ruta <span class='pill'>/dashboard/wristbands</span>. Es un módulo de gerencia: la cajera no crea planes."),
                        ("Definí código, nombre y duración.", "La duración va en minutos de juego (la pantalla la muestra como horas y minutos)."),
                        ("Poné el precio y el color.", "El precio es lo que se cobra al vender la pulsera; el color identifica la pulsera física."),
                        ("Limitá las estaciones si hace falta.", "El máximo de sesiones simultáneas del plan es opcional."),
                        ("Guardá.", "El plan queda disponible para vincular en reservas y sesiones."),
                    ],
                },
                {
                    "title": "Editar o retirar un plan",
                    "steps": [
                        ("Abrí el plan y cambiá lo que necesites.", "Nombre, duración, precio, color o máximo de estaciones."),
                        ("Desactivalo si ya no se vende.", "Deja de ofrecerse pero su historial de reservas se conserva."),
                    ],
                },
            ],
        },
        # ====================================================================
        # COLA DE ESPERA
        # ====================================================================
        {
            "name": "Cola de Espera",
            "route": "/dashboard/queue",
            "kicker": "Turnos cuando el local está lleno",
            "who": "Gerencia y cajera de Table Pong",
            "what":
                "Cuando no hay estaciones libres, el cliente no se va: toma un turno. Cada ticket lleva "
                "un número que se reinicia cada día, una espera estimada y el estado del turno: "
                "<strong>En Espera</strong>, <strong>Llamado</strong> y de ahí sentado, expirado o "
                "cancelado. La pantalla separa los <strong>Llamados — pasen a su estación</strong> de "
                "los que siguen esperando, en orden de llegada.",
            "features": [
                ("Número de turno diario", "Los tickets se numeran <span class='pill'>#1</span>, <span class='pill'>#2</span>… y el contador arranca de nuevo cada día."),
                ("Espera estimada", "El sistema estima la espera según cuánta gente hay delante en la cola."),
                ("Estación preferida", "El ticket puede pedir una estación específica o quedar como <em>Cualquier estación</em>."),
                ("Llamado visible", "El turno llamado se destaca con la etiqueta <span class='pill'>LLAMADO</span> y la hora del llamado."),
            ],
            "tasks": [
                {
                    "title": "Dar un turno de espera",
                    "steps": [
                        ("Entrá a Cola de Espera.", "Ruta <span class='pill'>/dashboard/queue</span>."),
                        ("Cargá el cliente.", "Nombre, teléfono si lo da, cantidad de personas y — si la pide — la estación o tipo de juego que quiere."),
                        ("Entregá el número de turno.", "El sistema asigna el siguiente número del día y calcula la espera estimada. El cliente queda <strong>En Espera</strong>."),
                    ],
                },
                {
                    "title": "Llamar al siguiente y sentarlo",
                    "steps": [
                        ("Cuando se libera una estación, llamá al primer turno.", "El ticket pasa a <strong>Llamado</strong> y sube al bloque destacado de la pantalla con la hora del llamado."),
                        ("Cuando el cliente se presenta, marcá el turno como sentado.", "El turno sale de la cola y el cliente arranca su sesión en <span class='pill'>Juegos</span>."),
                    ],
                },
                {
                    "title": "Expirar o cancelar un turno",
                    "steps": [
                        ("Si el llamado no se presenta, marcá el turno como expirado.", "Libera el lugar para el siguiente en la cola."),
                        ("Si el cliente desiste antes del llamado, cancelá el turno.", "El ticket sale de la cola sin afectar a los demás."),
                    ],
                },
            ],
        },
    ],
}
