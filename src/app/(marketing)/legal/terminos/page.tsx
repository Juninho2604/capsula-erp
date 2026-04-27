import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '@/components/marketing/LegalShell';

export const metadata: Metadata = {
    title: 'Términos y condiciones · CÁPSULA',
    description:
        'Términos y condiciones de uso de la plataforma CÁPSULA, incluyendo licencia, obligaciones del cliente y limitación de responsabilidad.',
};

const SECTIONS: LegalSection[] = [
    {
        id: 'aceptacion',
        title: 'Aceptación de los términos',
        body: (
            <>
                <p>
                    Al acceder y utilizar la plataforma CÁPSULA (en adelante, el "Servicio"), el cliente
                    acepta quedar vinculado por estos Términos y Condiciones. Si no está de acuerdo con
                    alguna parte de estos términos, no deberá utilizar el Servicio.
                </p>
                <p>
                    Estos términos aplican a todos los usuarios del Servicio, incluidos administradores,
                    operadores, gerentes y cualquier persona autorizada por el cliente para acceder a la
                    plataforma.
                </p>
            </>
        ),
    },
    {
        id: 'licencia',
        title: 'Licencia de uso',
        body: (
            <>
                <p>
                    CÁPSULA otorga al cliente una licencia limitada, no exclusiva, intransferible y
                    revocable para acceder y utilizar el Servicio durante la vigencia de la suscripción.
                </p>
                <p>
                    Esta licencia no incluye el derecho a revender, sublicenciar, copiar o redistribuir
                    el Servicio, ni a realizar ingeniería inversa sobre su código.
                </p>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: confirmar con asesoría legal el alcance exacto de la licencia y si se incluye API. */}
                    [Pendiente revisión legal — alcance exacto de la licencia]
                </p>
            </>
        ),
    },
    {
        id: 'cuentas',
        title: 'Cuentas de usuario',
        body: (
            <>
                <p>
                    El cliente es responsable de mantener la confidencialidad de las credenciales de
                    acceso y de toda actividad realizada bajo su cuenta. Debe notificar inmediatamente a
                    CÁPSULA cualquier uso no autorizado.
                </p>
                <p>
                    El cliente garantiza que la información proporcionada al registrarse es veraz,
                    precisa y actualizada.
                </p>
            </>
        ),
    },
    {
        id: 'pagos',
        title: 'Pagos y facturación',
        body: (
            <>
                <p>
                    Los planes de suscripción, precios y ciclos de facturación están publicados en el
                    sitio o acordados directamente con el equipo comercial. El cliente acepta pagar
                    todas las tarifas aplicables en los plazos acordados.
                </p>
                <p>
                    En caso de impago, CÁPSULA podrá suspender el acceso al Servicio previa
                    notificación.
                </p>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: definir política de reembolsos y prorrateos. */}
                    [Pendiente — política de reembolsos]
                </p>
            </>
        ),
    },
    {
        id: 'datos-cliente',
        title: 'Propiedad de los datos',
        body: (
            <>
                <p>
                    Toda la información cargada por el cliente al Servicio (inventarios, recetas,
                    ventas, datos de empleados, etc.) es propiedad exclusiva del cliente. CÁPSULA actúa
                    como custodio y procesador de esos datos según la Política de Privacidad.
                </p>
                <p>
                    El cliente puede exportar sus datos en cualquier momento desde el panel de
                    administración o solicitándolo al equipo de soporte.
                </p>
            </>
        ),
    },
    {
        id: 'usos-prohibidos',
        title: 'Usos prohibidos',
        body: (
            <>
                <p>El cliente se compromete a no:</p>
                <ul className="ml-5 list-disc space-y-2">
                    <li>Utilizar el Servicio para actividades ilegales o que infrinjan derechos de terceros.</li>
                    <li>Intentar acceder a áreas no autorizadas del sistema.</li>
                    <li>Sobrecargar la infraestructura mediante scripts automatizados o ataques.</li>
                    <li>Compartir credenciales con personas ajenas a la organización.</li>
                </ul>
            </>
        ),
    },
    {
        id: 'responsabilidad',
        title: 'Limitación de responsabilidad',
        body: (
            <>
                <p>
                    El Servicio se ofrece "tal cual". CÁPSULA realiza esfuerzos razonables para
                    garantizar disponibilidad y precisión, pero no garantiza que el Servicio esté libre
                    de errores o interrupciones.
                </p>
                <p>
                    En la máxima medida permitida por la ley, CÁPSULA no será responsable por daños
                    indirectos, lucro cesante o pérdida de datos derivados del uso del Servicio.
                </p>
            </>
        ),
    },
    {
        id: 'terminacion',
        title: 'Terminación',
        body: (
            <>
                <p>
                    Cualquiera de las partes puede dar por terminada la relación con notificación previa
                    según los plazos del contrato comercial. Tras la terminación, el cliente dispondrá
                    de un período razonable para exportar sus datos antes de su eliminación definitiva.
                </p>
            </>
        ),
    },
    {
        id: 'modificaciones',
        title: 'Modificaciones',
        body: (
            <>
                <p>
                    CÁPSULA podrá modificar estos términos en cualquier momento. Los cambios materiales
                    serán notificados con al menos 30 días de antelación a través del Servicio o por
                    correo electrónico.
                </p>
            </>
        ),
    },
    {
        id: 'jurisdiccion',
        title: 'Ley aplicable y jurisdicción',
        body: (
            <>
                <p>
                    Estos Términos se rigen por las leyes de la República Bolivariana de Venezuela.
                    Cualquier disputa se someterá a los tribunales competentes de Caracas, salvo
                    acuerdo en contrario.
                </p>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: confirmar jurisdicción definitiva si se opera bajo entidad distinta. */}
                    [Pendiente revisión legal — jurisdicción definitiva]
                </p>
            </>
        ),
    },
];

export default function TerminosPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Términos y condiciones"
            lastUpdated="27 de abril de 2026"
            intro={
                <p>
                    Estos términos regulan el acceso y uso de la plataforma CÁPSULA. Léelos con atención
                    antes de utilizar el Servicio. Si tienes dudas, escríbenos a{' '}
                    <a href="mailto:legal@capsula.app" className="cap-text-blue underline">
                        legal@capsula.app
                    </a>
                    .
                </p>
            }
            sections={SECTIONS}
        />
    );
}
