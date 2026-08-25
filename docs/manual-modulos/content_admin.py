# -*- coding: utf-8 -*-
"""Manual de módulos KPSULA — Sección 3: Administración y configuración.

Datos factuales verificados contra:
  - src/lib/constants/modules-registry.ts (labels y rutas)
  - src/app/dashboard/usuarios/users-view.tsx
  - src/app/dashboard/config/{roles,modules,tasa-cambio,branding,feature-flags,modulos-usuario}/
  - src/app/dashboard/{almacenes,anuncios,metas,reportes,delivery,conversaciones}/
  - src/lib/pin-roles.ts (§153), src/lib/inventory/count-permissions.ts (§150)
  - src/lib/constants/permissions-registry.ts (§158 MANAGE_WAITERS)
  - OPUS_CONTEXT_CAPSULA.md §3.5 (triple filtro), §7, §77, §150, §153, §158
"""

SECTION = {
    "id": "admin",
    "num": 3,
    "title": "Administración y configuración",
    "intro": "Los módulos de este grupo definen <strong>quién puede hacer qué</strong> en KPSULA y cómo "
             "se comporta la instalación completa: usuarios, roles, PIN y permisos; qué módulos están "
             "encendidos; la identidad que sale impresa en cada recibo; la tasa de cambio que usa el POS; "
             "las metas del negocio y los canales de delivery y WhatsApp. Casi todo lo que aquí se toca "
             "afecta a todo el equipo de inmediato, así que es territorio del dueño y las gerencias. "
             "Si alguien del equipo dice «no me aparece la pantalla X», la respuesta casi siempre está "
             "en esta sección: el triple filtro de visibilidad (módulo encendido + permiso del rol + "
             "lista personal del usuario).",
    "modules": [

        # ================================================================ REPORTES
        {
            "name": "Reportes",
            "route": "/dashboard/reportes",
            "kicker": "Reportes y control",
            "who": "Dueño, gerencias y auditoría (según permisos por familia)",
            "what": "El centro de reportes del negocio: un tablero ejecutivo con los KPIs del día en vivo "
                    "y seis familias de reportes — <strong>Ventas</strong> (por producto, categoría, mesonero, "
                    "área, canal y método de pago), <strong>Operativos</strong> (cierres X/Z, anulaciones con "
                    "motivo, descuentos y transferencias de mesa), <strong>Inventario</strong> (existencias "
                    "valorizadas, kardex y variación semanal), <strong>Compras</strong> (por proveedor, OC vs "
                    "recepción), <strong>Gerencial</strong> (ingeniería de menú: popularidad por margen, solo "
                    "roles administrativos) y <strong>Fiscal</strong>. Cada familia tiene su propio permiso, "
                    "así que dos gerentes pueden ver familias distintas.",
            "features": [
                ("KPIs del día en vivo", "Ventas, órdenes y desglose del día en el tablero de entrada (visible si tienes el permiso de ventas)."),
                ("Seis familias con permiso propio", "Ventas, Operativos, Inventario, Compras, Gerencial y Fiscal. Las que no tienes aparecen con candado."),
                ("Exportables", "Todos los reportes se descargan en Excel/PDF si tienes el permiso <span class='pill'>Reportes: exportar</span>."),
                ("Tasa histórica", "Los montos en Bs se calculan con la tasa de cada transacción, no con la de hoy — un reporte viejo no cambia si la tasa sube."),
            ],
            "tasks": [
                {
                    "title": "Abrir un reporte y exportarlo",
                    "steps": [
                        ("Entra al módulo Reportes.", "Ruta <span class='pill'>/dashboard/reportes</span>. Arriba ves los KPIs del día; abajo, las tarjetas de las familias."),
                        ("Toca la familia que necesitas.", "Por ejemplo <span class='pill'>Ventas</span> u <span class='pill'>Operativos</span>. Si una tarjeta tiene candado, tu usuario no tiene ese permiso."),
                        ("Elige el rango de fechas y revisa.", "Cada reporte se filtra por período."),
                        ("Exporta.", "La descarga a Excel/PDF requiere el permiso <span class='pill'>Reportes: exportar</span>."),
                    ],
                },
                {
                    "title": "Dar acceso a una familia de reportes",
                    "intro": "El acceso a Reportes no va solo por rol: se afina con permisos granulares por familia.",
                    "steps": [
                        ("Abre el usuario en <span class='pill'>Usuarios</span>.", "Baja hasta la sección <strong>Permisos granulares</strong>, grupo <strong>Reportes</strong>."),
                        ("Marca las familias que necesita.", "<span class='pill'>Reportes: ventas</span>, <span class='pill'>Reportes: inventario</span>, etc. Suma <span class='pill'>Reportes: exportar</span> si también va a descargar."),
                        ("Guarda los permisos.", "Si el módulo le sigue sin aparecer, la propia pantalla de Reportes le indica pedir los permisos a un administrador."),
                    ],
                },
            ],
        },

        # ==================================================== GESTIÓN DE DELIVERYS
        {
            "name": "Gestión de Deliverys",
            "route": "/dashboard/delivery",
            "kicker": "Canal delivery",
            "who": "Gerencias y cajeras del canal delivery",
            "what": "El centro de operaciones del delivery: un tablero con las órdenes agrupadas por estado "
                    "— <strong>Esperando pago → Pago por validar → En cocina → Lista → En camino → "
                    "Entregada</strong> (las canceladas se muestran como contador aparte). Las órdenes "
                    "entran solas: las carga el bot de WhatsApp. Desde el mismo módulo se gestionan "
                    "los motorizados, los productos agotados, las instrucciones del bot y los clientes "
                    "del canal, en las pestañas <span class='pill'>Tablero</span>, "
                    "<span class='pill'>Motorizados</span>, <span class='pill'>Agotados</span>, "
                    "<span class='pill'>Instrucciones</span>, <span class='pill'>Clientes</span> y "
                    "<span class='pill'>Config</span>. Es un módulo aislado de la contabilidad del POS.",
            "features": [
                ("Tablero por estados", "Seis columnas del flujo feliz. Cada orden avanza con un toque."),
                ("Alertas de pedidos nuevos", "Botón <span class='pill'>Activar alertas</span> para que suene cada pedido que entra, y contador de nuevos sin ver."),
                ("Filtro por sede", "Si el negocio tiene varias sedes, el tablero se filtra con el selector <span class='pill'>Todas las sedes</span>."),
                ("Motorizados", "Alta de repartidores y asignación por orden; el selector marca quién está en ruta."),
                ("Agotados", "Marcar productos sin stock para que el bot no los ofrezca."),
            ],
            "tasks": [
                {
                    "title": "Atender una orden nueva de punta a punta",
                    "steps": [
                        ("Mira la columna donde entró la orden.", "Si el cliente ya reportó el pago, la orden está en <strong>Pago por validar</strong>."),
                        ("Toca <span class='pill'>Validar pago</span>.", "Confirma el pago y manda la orden a cocina."),
                        ("Avanza el estado a medida que se prepara.", "El botón de cada tarjeta muestra el siguiente estado (por ejemplo <span class='pill'>Lista</span>)."),
                        ("Asigna el motorizado.", "Cuando está lista, elige el repartidor en el selector y toca <span class='pill'>Asignar</span> — la orden pasa a <strong>En camino</strong>."),
                        ("Marca <span class='pill'>Entregada</span> al confirmar la entrega.", "La orden sale del flujo activo."),
                    ],
                    "callouts": [
                        ("info", "Anular", "Cada tarjeta tiene su botón de anular. Las canceladas no ocupan columna: quedan como contador arriba del tablero."),
                    ],
                },
                {
                    "title": "Activar las alertas de sonido y filtrar por sede",
                    "steps": [
                        ("Toca <span class='pill'>Activar alertas</span> en el encabezado.", "El navegador exige ese toque para permitir el audio; después suena solo con cada pedido nuevo."),
                        ("Elige la sede en el selector si trabajas una sola.", "El tablero muestra solo las órdenes de esa sede."),
                        ("Usa <span class='pill'>Refrescar</span> si necesitas forzar la actualización.", "El tablero igual consulta órdenes nuevas solo, sin recargar la página."),
                    ],
                },
            ],
            "callouts": [
                ("info", "Se enciende con un feature flag", "Este módulo solo aparece si el dueño activó el flag de Gestión de Deliverys en <span class='pill'>Feature Flags</span>. Si el equipo no lo ve, ese es el primer lugar a revisar."),
            ],
        },

        # ============================================================ CONVERSACIONES
        {
            "name": "Conversaciones",
            "route": "/dashboard/conversaciones",
            "kicker": "WhatsApp",
            "who": "Dueño y gerencias (permiso Conversaciones WA)",
            "what": "La bandeja de WhatsApp del negocio: aquí se ven, casi en tiempo real, los chats que "
                    "atiende el bot (Fabiola). Cuando un cliente necesita atención humana, cualquier "
                    "persona con permiso toma el control de esa conversación — el bot se calla — y "
                    "responde directo desde KPSULA. Las reglas de WhatsApp (Meta) las hace cumplir el "
                    "servidor: fuera de la ventana de 24 horas solo se pueden enviar plantillas "
                    "aprobadas, y a un cliente que pidió la baja no se le puede escribir marketing.",
            "features": [
                ("Bandeja con filtros", "Todas / Bot / Humano / Por expirar, con búsqueda y contador de no leídos por chat."),
                ("Indicador de ventana", "Cada chat muestra cuánto queda de la ventana de 24 horas para responder con texto libre."),
                ("Tomar y devolver el control", "<span class='pill'>Tomar conversación</span> silencia al bot; al terminar, se le devuelve el chat a Fabiola."),
                ("Plantillas aprobadas", "Selector de plantillas de Meta para contactar fuera de ventana, con vista previa."),
                ("Vínculo con delivery", "Si el chat generó un pedido, la conversación muestra el chip del pedido."),
            ],
            "tasks": [
                {
                    "title": "Tomar una conversación y responder como humano",
                    "steps": [
                        ("Abre el chat en la bandeja.", "Ruta <span class='pill'>/dashboard/conversaciones</span>. Mientras el bot atiende, el cuadro de texto te avisa que Fabiola está en control."),
                        ("Toca <span class='pill'>Tomar conversación</span>.", "El bot se calla en ese chat y tu nombre queda como responsable. El cambio queda auditado."),
                        ("Escribe y envía tu respuesta.", "Como en WhatsApp: se ven los checks de entregado y leído."),
                        ("Devuelve el chat al bot al terminar.", "Con el botón de devolver la conversación, Fabiola retoma la atención automática."),
                    ],
                },
                {
                    "title": "Contactar a un cliente con la ventana cerrada",
                    "intro": "Si pasaron más de 24 horas desde el último mensaje del cliente, el texto libre está bloqueado — no es un error, es la regla de Meta.",
                    "steps": [
                        ("Mira el indicador de ventana del chat.", "Si la ventana expiró, el cuadro de texto queda deshabilitado y la pantalla lo explica."),
                        ("Abre el selector de plantillas.", "Solo se ofrecen plantillas aprobadas por Meta, con vista previa antes de enviar."),
                        ("Envía la plantilla.", "Si el cliente responde, la ventana se abre de nuevo y puedes escribir texto libre."),
                    ],
                    "callouts": [
                        ("warn", "Bloqueos que no se pueden saltar", "El servidor rechaza texto libre fuera de ventana y bloquea las plantillas de marketing a clientes sin opt-in o que pidieron la baja. La pantalla solo refleja esas reglas: no hay forma de forzarlas."),
                    ],
                },
            ],
            "callouts": [
                ("info", "Se enciende con un feature flag", "El módulo aparece solo con el flag de Conversaciones WhatsApp activo en <span class='pill'>Feature Flags</span>, y para usuarios con el permiso <span class='pill'>Conversaciones WA</span>."),
            ],
        },

        # ================================================================== USUARIOS
        {
            "name": "Usuarios",
            "route": "/dashboard/usuarios",
            "kicker": "Accesos del equipo",
            "who": "Dueño y Gerente Administrativo",
            "what": "El panel central de accesos: aquí se crean los usuarios, se les asigna rol, PIN, "
                    "contraseña, permisos individuales y la lista de módulos que ven. La pantalla es de "
                    "dos columnas: a la izquierda la lista de usuarios (activos e inactivos), a la "
                    "derecha la ficha completa del seleccionado. Todo lo que un usuario puede o no puede "
                    "hacer en KPSULA se resuelve desde aquí.",
            "features": [
                ("Alta de usuarios", "Botón <span class='pill'>Nuevo Usuario</span>: nombre, apellido, correo, contraseña inicial y rol."),
                ("PIN de acceso (POS)", "Clave numérica de 4 a 6 dígitos para identificarse o autorizar en el POS, con indicador <strong>Asignado</strong> / <strong>Sin PIN</strong>."),
                ("Permisos granulares", "Casillas en tres estados: <strong>del rol</strong> (base), <strong>extra</strong> (concedido) y <strong>revocado</strong> (quitado)."),
                ("Módulos visibles", "Marcar exactamente qué módulos ve ese usuario en su menú, o dejarlo <strong>según rol</strong>."),
                ("Reseteo de contraseña", "El dueño o el gerente administrativo cargan una contraseña nueva a cualquier usuario de rol inferior."),
                ("Activar / desactivar", "Un usuario que salió del equipo se desactiva — no se borra, su historial se conserva."),
            ],
            "tasks": [
                {
                    "title": "Crear un usuario nuevo",
                    "steps": [
                        ("Entra a Usuarios y toca <span class='pill'>Nuevo Usuario</span>.", "Ruta <span class='pill'>/dashboard/usuarios</span>. El botón está arriba a la derecha."),
                        ("Completa nombre, apellido y correo.", "El correo debe ser único: es con lo que la persona inicia sesión."),
                        ("Carga la contraseña inicial.", "Mínimo 6 caracteres. Se guarda cifrada; la persona puede cambiarla después."),
                        ("Elige el rol.", "El selector muestra la descripción de cada rol. Solo puedes asignar roles de nivel inferior al tuyo."),
                        ("Toca <span class='pill'>Crear Usuario</span>.", "El usuario aparece de una vez en la lista, seleccionado, listo para asignarle PIN, permisos y módulos."),
                    ],
                },
                {
                    "title": "Asignar o cambiar el PIN de un usuario",
                    "intro": "El PIN es la clave rápida del POS: identifica y autoriza sin correo ni contraseña.",
                    "steps": [
                        ("Selecciona el usuario y baja a <strong>PIN de acceso (POS)</strong>.", "El indicador te dice si ya tiene PIN (<strong>Asignado</strong>) o no (<strong>Sin PIN</strong>)."),
                        ("Escribe el PIN nuevo: numérico, de 4 a 6 dígitos.", "No se aceptan letras. El PIN nunca se muestra: solo se sabe si está asignado."),
                        ("Toca <span class='pill'>Guardar PIN</span> (o <span class='pill'>Cambiar PIN</span>).", "Para «resetear» un PIN olvidado simplemente cargas uno nuevo encima — no hay que borrar nada."),
                    ],
                    "callouts": [
                        ("warn", "El PIN autoriza según el ROL", "En el POS, el PIN autoriza <strong>cobros</strong> solo si el usuario es Dueño, Gerente Administrativo o Gerente Operativo; el Jefe de Área autoriza <strong>anulaciones pero no cobros</strong>; cualquier otro rol no autoriza nada. Al guardar un PIN sobre un rol que no autoriza, el sistema te lo avisa en el mismo mensaje de éxito — hacele caso y corrige el rol, o ese PIN va a fallar frente al cliente."),
                        ("info", "Nadie se toca su propio PIN", "El sistema bloquea modificar tu propio PIN desde este panel: siempre lo asigna otra persona con permiso."),
                    ],
                },
                {
                    "title": "Resetear la contraseña de otro usuario",
                    "steps": [
                        ("Selecciona el usuario y baja a <strong>Resetear Contraseña</strong>.", "La sección aparece solo para el Dueño y el Gerente Administrativo, y nunca sobre tu propio usuario."),
                        ("Escribe la contraseña nueva.", "Mínimo 6 caracteres."),
                        ("Toca <span class='pill'>Resetear</span>.", "El usuario entra con esa contraseña en su próximo inicio de sesión."),
                    ],
                    "callouts": [
                        ("info", "Nadie se resetea a sí mismo", "Si tú olvidaste tu contraseña, te la resetea otro administrador. Para cambiarla sabiéndola, cada usuario tiene su propio cambio de contraseña."),
                    ],
                },
                {
                    "title": "Conceder un permiso individual (ej.: Gestionar mesoneros)",
                    "intro": "Los permisos granulares afinan lo que el rol trae de base: se puede conceder un permiso extra o revocar uno del rol, persona por persona.",
                    "steps": [
                        ("Selecciona el usuario y baja a <strong>Permisos granulares</strong>.", "Los permisos están agrupados (POS/Ventas, Inventario, Financiero, Administración, Reportes)."),
                        ("Marca el permiso que quieres conceder.", "Ejemplo típico: <span class='pill'>Gestionar mesoneros</span>, para que un Jefe de Área pueda renombrar los usuarios de mesonero cuando rota el personal. Ese permiso <strong>no</strong> viene con el rol Jefe de Área: se concede a la persona puntual que lo necesita. No incluye asignar PIN."),
                        ("Toca <span class='pill'>Guardar permisos</span>.", "La etiqueta de cada casilla te confirma si quedó <strong>del rol</strong>, <strong>extra</strong> o <strong>revocado</strong>."),
                        ("Pedile al usuario que cierre sesión y vuelva a entrar.", "El cambio de permisos invalida su sesión: hasta que no vuelva a iniciar sesión, no le toma."),
                    ],
                },
                {
                    "title": "Limitar los módulos que ve un usuario",
                    "steps": [
                        ("Selecciona el usuario.", "En el centro de la ficha está la lista <strong>Módulos visibles</strong>, agrupada por sección, con la marca <strong>según rol</strong> o <strong>personalizado</strong>."),
                        ("Marca o desmarca módulos.", "Lo desmarcado desaparece del menú de esa persona aunque su rol lo permita."),
                        ("Toca <span class='pill'>Guardar</span>.", "El botón muestra cuántos módulos quedan habilitados. <span class='pill'>Restablecer al rol</span> borra la personalización y vuelve al acceso estándar del rol."),
                    ],
                },
            ],
            "callouts": [
                ("warn", "Jerarquía de roles", "Nadie puede crear, editar ni cambiar de rol a un usuario de nivel igual o superior al suyo. Un gerente no toca a otro gerente ni al dueño; solo el dueño toca a un dueño."),
            ],
        },

        # ====================================================== MÓDULOS POR USUARIO
        {
            "name": "Módulos por Usuario",
            "route": "/dashboard/config/modulos-usuario",
            "kicker": "Accesos del equipo",
            "who": "Dueño (las rutas de configuración están reservadas al OWNER)",
            "what": "La vista dedicada a la <strong>lista personal de módulos</strong> de cada usuario: el "
                    "tercer filtro de visibilidad. Es la misma personalización que ofrece la ficha de "
                    "<span class='pill'>Usuarios</span>, pero en pantalla completa y pensada para revisar "
                    "el menú de una persona de un vistazo. Además de recortar, sirve para <strong>ampliar</strong>: "
                    "se le puede marcar a un usuario un módulo que su rol no trae de base (queda "
                    "señalado como <strong>Extra al rol</strong>), y esa lista personal pasa a ser la "
                    "autoridad final de lo que ve.",
            "features": [
                ("Lista personal por usuario", "Checkboxes de todos los módulos habilitados en la instalación, agrupados por sección."),
                ("Por rol o personalizado", "Sin lista personal, aplican las reglas del rol; con lista, manda la lista. La insignia <strong>personalizado</strong> marca quién tiene lista propia."),
                ("Amplía o recorta", "Un módulo marcado que el rol no trae aparece como <strong>Extra al rol</strong>. Los módulos exclusivos del dueño nunca se pueden extender a otros."),
                ("Restablecer a rol", "Un toque borra la personalización y devuelve el menú estándar del rol."),
            ],
            "tasks": [
                {
                    "title": "Personalizar el menú de un usuario",
                    "steps": [
                        ("Entra a Módulos por Usuario.", "Ruta <span class='pill'>/dashboard/config/modulos-usuario</span>. A la izquierda, los usuarios activos; el que tiene lista propia lleva la insignia <strong>personalizado</strong>."),
                        ("Selecciona el usuario.", "Se cargan los checkboxes: marcados los que ve hoy."),
                        ("Marca o desmarca módulos.", "Puedes sumar un módulo fuera de su rol (queda con la etiqueta <strong>Extra al rol</strong>) o quitarle uno que el rol sí trae."),
                        ("Toca <span class='pill'>Guardar módulos</span>.", "El menú lateral del usuario cambia en su próximo acceso al dashboard."),
                    ],
                },
                {
                    "title": "Volver al acceso estándar del rol",
                    "steps": [
                        ("Selecciona el usuario personalizado.", "El encabezado muestra cuántos módulos personalizados tiene."),
                        ("Toca <span class='pill'>Restablecer a rol</span> y guarda.", "La lista personal se elimina y vuelven a aplicar las reglas predeterminadas del rol."),
                    ],
                },
            ],
        },

        # ========================================================= ROLES Y PERMISOS
        {
            "name": "Roles y Permisos",
            "route": "/dashboard/config/roles",
            "kicker": "Accesos del equipo",
            "who": "Dueño (las rutas de configuración están reservadas al OWNER)",
            "what": "La tabla de todos los usuarios con su <strong>rol base</strong>: aquí se reasigna el rol "
                    "y se activa o desactiva a cada persona. El rol es la pieza que más pesa en el "
                    "sistema — decide qué módulos trae de base, qué permisos hereda y qué autoriza su "
                    "PIN en el POS. Los permisos finos (conceder o revocar acciones puntuales) no viven "
                    "aquí: se manejan en la ficha de cada usuario dentro de <span class='pill'>Usuarios</span>.",
            "features": [
                ("Tabla completa del equipo", "Usuario, email, rol actual (selector), estado y acciones, en una sola vista."),
                ("Cambio de rol directo", "El selector de la columna <strong>Rol Actual</strong> aplica el cambio al confirmar."),
                ("Jerarquía respetada", "El sistema rechaza gestionar a un rol de nivel igual o superior al del que edita."),
                ("Activar / desactivar", "El acceso se corta sin borrar al usuario ni su historial."),
            ],
            "tasks": [
                {
                    "title": "Cambiar el rol de un usuario",
                    "steps": [
                        ("Entra a Roles y Permisos.", "Ruta <span class='pill'>/dashboard/config/roles</span>. También puedes cambiar el rol desde la ficha del usuario en <span class='pill'>Usuarios</span> — es el mismo cambio."),
                        ("Busca el usuario en la tabla.", "La columna <strong>Rol Actual</strong> muestra su rol en un selector."),
                        ("Elige el rol nuevo y confirma.", "El sistema pide confirmación antes de aplicar."),
                    ],
                    "callouts": [
                        ("warn", "Jerarquía", "Solo puedes asignar roles de nivel inferior al tuyo, y no puedes tocar a nadie de tu nivel o superior. Cambiar el rol cambia de una vez los módulos y permisos base de la persona: revisa después su lista personal de módulos si tenía una."),
                    ],
                },
                {
                    "title": "Activar o desactivar un usuario",
                    "steps": [
                        ("Ubica el usuario en la tabla.", "La columna <strong>Estado</strong> muestra <strong>Activo</strong> o <strong>Inactivo</strong>."),
                        ("Toca <span class='pill'>Desactivar</span> (o <span class='pill'>Activar</span>) y confirma.", "Un usuario inactivo no puede iniciar sesión, pero todo su historial se conserva. Es lo correcto cuando alguien deja el equipo: nunca borrar."),
                    ],
                },
                {
                    "title": "Saber qué autoriza cada rol con PIN en el POS",
                    "intro": "Cuando un PIN «no valida» en el POS, el problema casi nunca es el PIN: es el rol de quien lo tiene.",
                    "steps": [
                        ("Cobros, sesión de caja y descuentos de divisas.", "Los autorizan con PIN: <strong>Dueño</strong>, <strong>Gerente Administrativo</strong> y <strong>Gerente Operativo</strong>."),
                        ("Anulaciones.", "Las autorizan esos tres roles más el <strong>Jefe de Área</strong> (anula pero no cobra). Los capitanes de mesoneros también anulan, pero con su PIN de mesonero, no con el de usuario."),
                        ("Si un PIN no valida, revisa el rol aquí.", "Un PIN asignado a un rol fuera de esas listas no autoriza nada — el sistema lo avisa al momento de asignarlo. Corrige el rol y el mismo PIN empieza a funcionar."),
                    ],
                },
                {
                    "title": "Entender quién cuenta y quién aplica en el conteo de inventario",
                    "intro": "El conteo físico separa dos capacidades a propósito: quien cuenta no confirma su propio conteo.",
                    "steps": [
                        ("Contar (abrir sesión, cargar cantidades).", "Pueden: producción y cocina (Chef, Jefe de Cocina), los jefes de área, la gerencia, el dueño y auditoría."),
                        ("Aplicar el ajuste al stock (y cancelar sesiones).", "Solo gerencia, dueño y auditor. El ajuste se hace efectivo cuando gerencia o auditoría validan en el sistema."),
                    ],
                },
            ],
        },

        # =================================================================== MÓDULOS
        {
            "name": "Módulos",
            "route": "/dashboard/config/modules",
            "kicker": "Configuración de la instalación",
            "who": "Solo el Dueño",
            "what": "El interruptor maestro de la instalación: el catálogo completo de módulos de KPSULA, "
                    "agrupado por sección (Operaciones, Ventas, Entretenimiento, Administración), cada uno "
                    "con su switch de encendido. Un módulo apagado aquí <strong>no existe para nadie</strong>, "
                    "sin importar rol ni lista personal. Es el primer filtro de los tres que deciden qué "
                    "ve cada usuario en su menú.",
            "features": [
                ("Catálogo completo con switches", "Todos los módulos del sistema con contador de activos por sección."),
                ("Cambios al instante", "Al guardar, la selección aplica sin reiniciar; el menú lateral se actualiza en el próximo acceso al dashboard."),
                ("Este módulo no se apaga", "El propio módulo de configuración queda bloqueado para no dejar al dueño fuera."),
            ],
            "tasks": [
                {
                    "title": "Encender o apagar un módulo",
                    "steps": [
                        ("Entra a Módulos.", "Ruta <span class='pill'>/dashboard/config/modules</span>. Solo el dueño puede entrar."),
                        ("Activa o desactiva los switches que necesites.", "La barra superior te avisa si tienes cambios sin guardar y cuántos módulos quedan seleccionados."),
                        ("Toca <span class='pill'>Guardar cambios</span>.", "El cambio afecta a toda la instalación de inmediato."),
                    ],
                    "callouts": [
                        ("warn", "Con criterio", "Apagar un módulo lo oculta para todo el equipo a la vez. Antes de apagar, confirma que ningún flujo diario depende de él."),
                    ],
                },
                {
                    "title": "Diagnosticar «no me aparece la pantalla X»",
                    "intro": "Un módulo aparece en el menú de una persona solo si pasa el triple filtro, en este orden. Revisalo igual, paso a paso:",
                    "steps": [
                        ("1. ¿El módulo está encendido en la instalación?", "Revisa su switch aquí, en <span class='pill'>Módulos</span>. Apagado aquí, no lo ve nadie."),
                        ("2. ¿El rol del usuario tiene acceso?", "Cada módulo admite ciertos roles. Verifica el rol en <span class='pill'>Roles y Permisos</span> — quizás corresponde cambiarlo."),
                        ("3. ¿Está en su lista personal?", "Si el usuario tiene módulos personalizados, esa lista es la autoridad final. Revisala en <span class='pill'>Módulos por Usuario</span> o en su ficha de <span class='pill'>Usuarios</span>."),
                        ("Caso especial: módulos con feature flag.", "Gestión de Deliverys y Conversaciones necesitan además su flag activo en <span class='pill'>Feature Flags</span>."),
                    ],
                },
            ],
        },

        # ==================================================== IDENTIDAD DEL NEGOCIO
        {
            "name": "Identidad del Negocio",
            "route": "/dashboard/config/branding",
            "kicker": "Configuración de la instalación",
            "who": "Solo el Dueño",
            "what": "Los datos que identifican al negocio en los recibos impresos y en los encabezados "
                    "del sistema: nombre corto, razón social, RIF y logo. La pantalla incluye una "
                    "<strong>vista previa del recibo</strong> que se actualiza en vivo mientras editas, "
                    "así ves exactamente cómo va a salir impreso antes de guardar.",
            "features": [
                ("Nombre comercial", "El nombre principal de la instalación. No se edita desde aquí (está atado a la dirección web del negocio)."),
                ("Nombre corto", "Para encabezados compactos. Si queda vacío, se usa el nombre comercial."),
                ("Razón social y RIF", "El nombre legal se imprime en el recibo si no hay logo; el RIF sale en cada recibo (si queda vacío, esa línea no se imprime)."),
                ("Logo", "PNG o JPG de máximo 2 MB; se imprime arriba del recibo. Recomendado 240×120 px con fondo transparente."),
                ("Vista previa en vivo", "Un recibo de muestra a la derecha refleja cada cambio al momento."),
            ],
            "tasks": [
                {
                    "title": "Completar los datos del recibo",
                    "steps": [
                        ("Entra a Identidad del Negocio.", "Ruta <span class='pill'>/dashboard/config/branding</span>."),
                        ("Carga razón social y RIF.", "Formato de RIF tipo <span class='pill'>J-12345678-9</span>. Son los datos legales que ven los clientes en su recibo."),
                        ("Sube el logo.", "Con <span class='pill'>Subir desde archivo</span> o pegando la dirección de la imagen. La vista previa te muestra cómo queda."),
                        ("Revisa la vista previa y toca <span class='pill'>Guardar cambios</span>.", "Los cambios aplican a los recibos reales solo después de guardar."),
                    ],
                },
            ],
        },

        # ============================================================= FEATURE FLAGS
        {
            "name": "Feature Flags",
            "route": "/dashboard/config/feature-flags",
            "kicker": "Configuración de la instalación",
            "who": "Solo el Dueño",
            "what": "Interruptores de funciones especiales de la instalación: cada tarjeta describe una "
                    "función y se prende o apaga con un toque, sin reiniciar nada. Aquí se activan, por "
                    "ejemplo, el módulo de <strong>Gestión de Deliverys</strong>, las <strong>Conversaciones "
                    "de WhatsApp</strong>, las promociones por horario, las listas de precios por canal y "
                    "ajustes finos del cobro (ocultar el método de pago a la cajera, pedir confirmación "
                    "del método antes de cobrar, el manejo de propinas en el cierre). Funciona como "
                    "interruptor de emergencia: si una función nueva da problemas, se apaga aquí y el "
                    "sistema sigue operando.",
            "features": [
                ("Una tarjeta por función", "Nombre, descripción y estado <strong>Activo</strong> / <strong>Inactivo</strong> de cada flag."),
                ("Efecto inmediato", "El cambio aplica al toque; si algo falla al guardar, el switch vuelve solo a su estado anterior."),
                ("Gate maestro de módulos", "Los flags de Deliverys y Conversaciones controlan a la vez el módulo y su API: apagado el flag, no existe ni la pantalla ni el servicio."),
            ],
            "tasks": [
                {
                    "title": "Prender o apagar una función",
                    "steps": [
                        ("Entra a Feature Flags.", "Ruta <span class='pill'>/dashboard/config/feature-flags</span>. Solo el dueño la ve."),
                        ("Lee la descripción de la tarjeta.", "Cada flag explica exactamente qué cambia en el sistema."),
                        ("Toca el botón de estado.", "Pasa de <strong>Inactivo</strong> a <span class='pill'>Activo</span> (o al revés) de inmediato, sin botón de guardar aparte."),
                    ],
                    "callouts": [
                        ("info", "¿El equipo no ve Deliverys o Conversaciones?", "Esos módulos arrancan apagados en toda instalación. Prende su flag aquí y van a aparecer en el menú de los roles autorizados."),
                    ],
                },
            ],
        },

        # ================================================================= ALMACENES
        {
            "name": "Almacenes",
            "route": "/dashboard/almacenes",
            "kicker": "Estructura del inventario",
            "who": "Dueño y gerencias",
            "what": "El directorio de las áreas de almacenamiento del negocio (depósito, cocina, barra, "
                    "centro de producción…). Todo el inventario vive repartido en estas áreas: los "
                    "conteos, las transferencias y las entradas de mercancía siempre apuntan a un "
                    "almacén de esta lista. La tabla muestra cuántos registros de stock tiene cada uno "
                    "y permite activar, desactivar y detectar nombres duplicados.",
            "features": [
                ("Directorio de áreas", "Nombre, descripción, cantidad de registros de stock y estado de cada almacén."),
                ("Nombres en mayúsculas", "El nombre se guarda en mayúsculas automáticamente, para mantener el catálogo uniforme."),
                ("Detector de duplicados", "<span class='pill'>Analizar duplicados</span> busca nombres similares que probablemente son la misma área cargada dos veces."),
                ("Activar / desactivar", "Un área que ya no se usa se desactiva; su historial de movimientos se conserva."),
            ],
            "tasks": [
                {
                    "title": "Crear un almacén",
                    "steps": [
                        ("Entra a Almacenes y toca <span class='pill'>Nuevo almacén</span>.", "Ruta <span class='pill'>/dashboard/almacenes</span>."),
                        ("Carga el nombre (obligatorio) y una descripción.", "Ej.: <em>DEPOSITO PRINCIPAL</em> — el sistema lo pasa a mayúsculas solo."),
                        ("Toca <span class='pill'>Crear almacén</span>.", "El área queda disponible de inmediato para stock, conteos y transferencias."),
                    ],
                },
                {
                    "title": "Detectar y limpiar duplicados",
                    "steps": [
                        ("Toca <span class='pill'>Analizar duplicados</span>.", "El sistema agrupa los nombres similares y te muestra cada grupo."),
                        ("Decide cuál queda de cada grupo.", "Desactiva el repetido — no lo borres: sus movimientos históricos siguen consultables."),
                    ],
                },
                {
                    "title": "Desactivar un almacén",
                    "steps": [
                        ("Ubica el área en la tabla y toca <span class='pill'>Desactivar</span>.", "Deja de aparecer como destino en las operaciones nuevas."),
                        ("Antes, mueve el stock que tenga.", "Revisa la columna de registros: si el área todavía tiene existencias, transferilas a su nueva área con el módulo de Transferencias."),
                    ],
                },
            ],
        },

        # ============================================================ TASA DE CAMBIO
        {
            "name": "Tasa de Cambio",
            "route": "/dashboard/config/tasa-cambio",
            "kicker": "Configuración de la instalación",
            "who": "Solo el Dueño (ruta de configuración)",
            "what": "Donde se registra la tasa Bs/USD que usa todo el sistema: el POS convierte con ella "
                    "los cobros en bolívares (efectivo Bs, punto de venta, pago móvil), y los reportes la "
                    "usan para los equivalentes. La pantalla muestra la tasa vigente en grande, el "
                    "formulario para cargar la nueva y el historial reciente. Mantenerla al día es "
                    "crítico: una tasa vieja cobra mal cada venta en bolívares.",
            "features": [
                ("Tasa actual visible", "El valor vigente en Bs por 1 USD, con la fecha de su última actualización."),
                ("Carga en segundos", "Un solo campo — <strong>Tasa BCV (Bs por USD)</strong> — y guardar."),
                ("Historial reciente", "Las últimas tasas registradas, con su fecha."),
                ("Snapshot por venta", "Cada venta guarda la tasa con la que se cobró: los reportes viejos no cambian cuando la tasa sube."),
            ],
            "tasks": [
                {
                    "title": "Cargar la tasa del día",
                    "steps": [
                        ("Entra a Tasa de Cambio.", "Ruta <span class='pill'>/dashboard/config/tasa-cambio</span>."),
                        ("Escribe la tasa en <strong>Tasa BCV (Bs por USD)</strong>.", "Ej.: <span class='pill'>91.50</span>. Acepta coma o punto decimal; debe ser mayor a 0."),
                        ("Toca <span class='pill'>Guardar tasa de hoy</span>.", "Desde ese momento el POS convierte con la tasa nueva."),
                    ],
                    "callouts": [
                        ("ok", "Hacelo antes de abrir", "Carga la tasa cada día (o cada vez que cambie) antes de que caja empiece a cobrar. Si la cajera avisa que la tasa está vieja, este es el lugar."),
                        ("info", "Cada venta guarda su tasa", "El comprobante y los reportes usan la tasa vigente al momento del cobro, no la de hoy. Por eso el total en Bs de una venta de ayer no se altera al actualizar la tasa."),
                    ],
                },
                {
                    "title": "Revisar el historial de tasas",
                    "steps": [
                        ("Baja a <strong>Historial reciente</strong>.", "Lista fecha y valor de cada tasa registrada."),
                        ("Usalo para auditar cobros.", "Si un total en Bs de un día pasado genera dudas, compara contra la tasa que regía ese día."),
                    ],
                },
            ],
        },

        # ======================================================= ANUNCIOS A GERENCIA
        {
            "name": "Anuncios a Gerencia",
            "route": "/dashboard/anuncios",
            "kicker": "Comunicación interna",
            "who": "Dueño y gerencias",
            "what": "Comunicados internos del negocio: lo que se publica aquí aparece en la "
                    "<strong>campana</strong> de la barra superior del dashboard, con contador de no "
                    "leídos. Sirve para avisos operativos que todo el equipo (o ciertos roles) debe ver "
                    "al entrar al sistema: un cierre anticipado, un cambio de precio, una alerta de "
                    "inventario.",
            "features": [
                ("Publicación inmediata", "Título, mensaje y tipo — <strong>Info</strong>, <strong>Aviso</strong>, <strong>Alerta</strong> o <strong>Éxito</strong> — y ya está en la campana."),
                ("Segmentación y vigencia", "Un anuncio puede dirigirse a ciertos roles y llevar fecha de expiración; vencido, deja de mostrarse solo."),
                ("Activos e historial", "La pantalla separa los comunicados vigentes de los archivados."),
            ],
            "tasks": [
                {
                    "title": "Publicar un comunicado",
                    "steps": [
                        ("Entra a Anuncios a Gerencia.", "Ruta <span class='pill'>/dashboard/anuncios</span>."),
                        ("Completa <strong>Título</strong> y <strong>Mensaje</strong>.", "Los dos son obligatorios. Ej.: <em>Cierre de caja anticipado</em>."),
                        ("Elige el tipo.", "<strong>Info</strong>, <strong>Aviso</strong>, <strong>Alerta</strong> o <strong>Éxito</strong> — cambia el color con el que lo ve el equipo."),
                        ("Toca <span class='pill'>Publicar</span>.", "El anuncio queda en <strong>Activos</strong> y aparece en la campana de los usuarios."),
                    ],
                },
                {
                    "title": "Retirar un comunicado",
                    "steps": [
                        ("Ubica el anuncio en <strong>Activos</strong>.", "Cada uno muestra su fecha y, si la tiene, su expiración."),
                        ("Toca <span class='pill'>Archivar</span>.", "Pasa al <strong>Historial</strong> y desaparece de la campana."),
                    ],
                },
            ],
        },

        # ========================================================= OBJETIVOS Y METAS
        {
            "name": "Objetivos y Metas",
            "route": "/dashboard/metas",
            "kicker": "Rendimiento",
            "who": "Ver: gerencias, jefes de área y auditoría · Editar: dueño y gerentes",
            "what": "Las metas de venta del negocio — diaria, semanal y mensual, en USD — comparadas en "
                    "tiempo real contra las ventas reales, más el control de merma: qué porcentaje de "
                    "las ventas del mes es aceptable perder por merma y cuánto se lleva perdido. La "
                    "pantalla proyecta si el ritmo del día alcanza para la meta y avisa cuando la merma "
                    "supera el límite.",
            "features": [
                ("Proyección del día", "Con el ritmo actual, el sistema estima si vas a llegar a la meta diaria y cuánto falta."),
                ("Tres tarjetas de progreso", "Meta diaria, semanal y mensual, cada una con su porcentaje y sus órdenes."),
                ("Control de merma", "Merma registrada del mes vs el límite aceptable configurado; se alimenta de los ajustes de inventario por merma."),
                ("Edición protegida", "Configurar las metas está reservado al dueño y los gerentes; el resto solo consulta."),
            ],
            "tasks": [
                {
                    "title": "Configurar las metas",
                    "steps": [
                        ("Entra a Objetivos y Metas y toca <span class='pill'>Configurar metas</span>.", "Ruta <span class='pill'>/dashboard/metas</span>. El botón aparece solo si tu rol puede editar."),
                        ("Carga los montos en USD.", "<strong>Meta diaria</strong>, <strong>Meta semanal</strong> y <strong>Meta mensual</strong>."),
                        ("Define el <strong>% merma aceptable</strong>.", "El porcentaje de las ventas del mes que puede perderse por merma sin disparar la alerta."),
                        ("Guarda.", "La vista previa te muestra los cuatro valores antes de confirmar; el seguimiento arranca de inmediato."),
                    ],
                },
                {
                    "title": "Leer el tablero de seguimiento",
                    "steps": [
                        ("Mira la proyección del día.", "El sistema te dice si a este ritmo superas la meta diaria o cuánto te falta."),
                        ("Revisa el bloque de merma.", "Compara la merma registrada contra el límite; si el porcentaje real supera el aceptable, el bloque se marca en alerta."),
                    ],
                },
            ],
        },
    ],
}
