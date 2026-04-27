import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '@/components/marketing/LegalShell';

export const metadata: Metadata = {
    title: 'Política de privacidad · CÁPSULA',
    description:
        'Cómo CÁPSULA recolecta, almacena y protege los datos de sus clientes y de los usuarios finales.',
};

const SECTIONS: LegalSection[] = [
    {
        id: 'introduccion',
        title: 'Introducción',
        body: (
            <>
                <p>
                    En CÁPSULA tomamos la privacidad de los datos en serio. Esta política explica qué
                    información recolectamos, cómo la usamos y bajo qué condiciones la compartimos.
                </p>
                <p>
                    Aplica a todos los datos procesados a través de la plataforma, sus integraciones y
                    el sitio web público.
                </p>
            </>
        ),
    },
    {
        id: 'datos-recolectados',
        title: 'Datos que recolectamos',
        body: (
            <>
                <p>Recolectamos dos tipos de datos:</p>
                <ul className="ml-5 list-disc space-y-2">
                    <li>
                        <strong className="text-[color:var(--cap-ink)]">Datos del cliente</strong>: razón
                        social, contacto del administrador, información de facturación.
                    </li>
                    <li>
                        <strong className="text-[color:var(--cap-ink)]">Datos operativos</strong>:
                        inventarios, recetas, ventas, transacciones, información de empleados y todo lo
                        que el cliente cargue al Servicio.
                    </li>
                </ul>
                <p>
                    También registramos datos técnicos mínimos (IP, navegador, timestamp de acciones)
                    con fines de seguridad y auditoría.
                </p>
            </>
        ),
    },
    {
        id: 'uso-de-datos',
        title: 'Uso de los datos',
        body: (
            <>
                <p>Usamos los datos exclusivamente para:</p>
                <ul className="ml-5 list-disc space-y-2">
                    <li>Operar, mantener y mejorar el Servicio.</li>
                    <li>Procesar pagos y emitir facturación.</li>
                    <li>Brindar soporte técnico cuando el cliente lo solicita.</li>
                    <li>Cumplir con obligaciones legales o requerimientos de autoridades competentes.</li>
                </ul>
                <p>
                    No vendemos ni cedemos datos a terceros con fines comerciales bajo ninguna
                    circunstancia.
                </p>
            </>
        ),
    },
    {
        id: 'almacenamiento',
        title: 'Almacenamiento y ubicación',
        body: (
            <>
                <p>
                    Los datos se almacenan en infraestructura cloud con cifrado en tránsito (TLS 1.3) y
                    en reposo (AES-256). Las copias de seguridad se realizan diariamente y se retienen
                    según el plan contratado.
                </p>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: detallar región exacta de los servidores y proveedor cloud (Render / AWS). */}
                    [Pendiente — confirmar región y proveedor cloud específico para publicación]
                </p>
            </>
        ),
    },
    {
        id: 'subprocesadores',
        title: 'Subprocesadores',
        body: (
            <>
                <p>
                    Para operar el Servicio utilizamos los siguientes subprocesadores, cada uno con sus
                    propias políticas de privacidad y compromisos de seguridad:
                </p>
                <ul className="ml-5 list-disc space-y-2">
                    <li>Proveedor de infraestructura cloud (hosting de la aplicación).</li>
                    <li>Proveedor de base de datos gestionada (PostgreSQL).</li>
                    <li>Proveedor de envío de correos transaccionales.</li>
                    <li>Proveedor de procesamiento de pagos (cuando aplique).</li>
                </ul>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: listar nombres concretos de cada proveedor con sus URLs de privacidad. */}
                    [Pendiente — listado público de subprocesadores con sus enlaces]
                </p>
            </>
        ),
    },
    {
        id: 'derechos',
        title: 'Derechos del titular de los datos',
        body: (
            <>
                <p>El cliente y sus usuarios finales tienen derecho a:</p>
                <ul className="ml-5 list-disc space-y-2">
                    <li>Acceder a sus datos en cualquier momento.</li>
                    <li>Solicitar rectificación o actualización.</li>
                    <li>Solicitar eliminación, sujeto a obligaciones legales de retención.</li>
                    <li>Exportar sus datos en formatos estándar (CSV, JSON, Excel).</li>
                </ul>
                <p>
                    Para ejercer cualquiera de estos derechos, escribir a{' '}
                    <a href="mailto:privacidad@capsula.app" className="cap-text-blue underline">
                        privacidad@capsula.app
                    </a>
                    .
                </p>
            </>
        ),
    },
    {
        id: 'retencion',
        title: 'Retención de datos',
        body: (
            <>
                <p>
                    Mientras la suscripción esté activa, conservamos los datos del cliente íntegros.
                    Tras la terminación, ofrecemos un período de gracia para exportación; transcurrido
                    ese plazo, los datos se eliminan de forma segura.
                </p>
                <p>
                    Algunos registros de auditoría y facturación se conservan por períodos más largos
                    cuando la ley lo exige.
                </p>
            </>
        ),
    },
    {
        id: 'cookies',
        title: 'Cookies y trazas',
        body: (
            <>
                <p>
                    Usamos cookies estrictamente necesarias para mantener la sesión del usuario
                    autenticado. No utilizamos cookies de marketing ni de seguimiento de terceros.
                </p>
            </>
        ),
    },
    {
        id: 'cambios-politica',
        title: 'Cambios a esta política',
        body: (
            <>
                <p>
                    Podemos actualizar esta política periódicamente. Los cambios materiales se
                    notificarán por correo electrónico al administrador de la cuenta con al menos 30
                    días de antelación.
                </p>
            </>
        ),
    },
    {
        id: 'contacto-privacidad',
        title: 'Contacto',
        body: (
            <>
                <p>
                    Para preguntas sobre esta política o sobre el tratamiento de datos, contactar a{' '}
                    <a href="mailto:privacidad@capsula.app" className="cap-text-blue underline">
                        privacidad@capsula.app
                    </a>
                    .
                </p>
            </>
        ),
    },
];

export default function PrivacidadPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Política de privacidad"
            lastUpdated="27 de abril de 2026"
            intro={
                <p>
                    En CÁPSULA tomamos la privacidad de los datos en serio. Esta política describe cómo
                    los recolectamos, almacenamos y protegemos.
                </p>
            }
            sections={SECTIONS}
        />
    );
}
