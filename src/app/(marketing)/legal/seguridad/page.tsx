import type { Metadata } from 'next';
import LegalShell, { type LegalSection } from '@/components/marketing/LegalShell';

export const metadata: Metadata = {
    title: 'Seguridad · CÁPSULA',
    description:
        'Medidas técnicas y organizativas que CÁPSULA aplica para proteger la información de sus clientes.',
};

const SECTIONS: LegalSection[] = [
    {
        id: 'enfoque',
        title: 'Enfoque general',
        body: (
            <>
                <p>
                    La seguridad de los datos del cliente es una prioridad operativa, no un complemento.
                    Diseñamos cada feature pensando en el principio de menor privilegio y en
                    trazabilidad completa de las acciones críticas.
                </p>
            </>
        ),
    },
    {
        id: 'cifrado',
        title: 'Cifrado',
        body: (
            <>
                <p>
                    Todo el tráfico entre el navegador del cliente y nuestra infraestructura viaja sobre
                    TLS 1.3. Los datos en reposo (base de datos y backups) se cifran con AES-256.
                </p>
                <p>
                    Las contraseñas de usuarios se almacenan con bcrypt; nunca en texto plano. Los
                    secretos del sistema (claves de API, tokens) se gestionan en variables de entorno
                    cifradas a nivel de proveedor.
                </p>
            </>
        ),
    },
    {
        id: 'control-de-accesos',
        title: 'Control de accesos',
        body: (
            <>
                <p>
                    El sistema implementa un modelo de permisos en cuatro capas: rol del usuario,
                    permiso por módulo, permiso por sección y permiso por acción específica. Esto
                    permite restringir incluso acciones sensibles dentro de un mismo módulo.
                </p>
                <p>
                    Las sesiones expiran tras un período de inactividad configurable y todos los
                    intentos de inicio de sesión fallidos quedan registrados.
                </p>
            </>
        ),
    },
    {
        id: 'auditoria',
        title: 'Auditoría y trazabilidad',
        body: (
            <>
                <p>
                    Cada operación crítica (creación, modificación o eliminación de datos sensibles) se
                    registra en una bitácora inmutable que captura usuario, timestamp, módulo, acción y
                    estado anterior.
                </p>
                <p>
                    La bitácora es accesible para el administrador del cliente y se conserva durante el
                    tiempo de retención del plan contratado.
                </p>
            </>
        ),
    },
    {
        id: 'infraestructura',
        title: 'Infraestructura',
        body: (
            <>
                <p>
                    Operamos sobre proveedores cloud con certificaciones reconocidas (ISO 27001,
                    SOC 2). La aplicación se despliega de forma automatizada desde nuestro repositorio
                    principal con verificaciones de tipo y suite de tests previas al deploy.
                </p>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: especificar proveedor cloud y región para publicación final. */}
                    [Pendiente — confirmar proveedor cloud y región]
                </p>
            </>
        ),
    },
    {
        id: 'backups',
        title: 'Backups y continuidad',
        body: (
            <>
                <p>
                    Realizamos copias de seguridad automáticas diarias de la base de datos. Las copias
                    se mantienen durante un período mínimo de 30 días, con replicación geográfica para
                    minimizar el riesgo ante incidentes regionales.
                </p>
                <p>
                    Realizamos pruebas periódicas de restauración para garantizar que las copias son
                    funcionales.
                </p>
            </>
        ),
    },
    {
        id: 'desarrollo-seguro',
        title: 'Desarrollo seguro',
        body: (
            <>
                <p>
                    El proceso de desarrollo sigue prácticas estándar de la industria: revisión de
                    código obligatoria, suite de tests automatizada, escaneo continuo de
                    vulnerabilidades en dependencias y separación estricta entre entornos de
                    desarrollo, staging y producción.
                </p>
                <p>
                    Los principios del OWASP Top 10 son referencia constante en el desarrollo.
                </p>
            </>
        ),
    },
    {
        id: 'incidentes',
        title: 'Gestión de incidentes',
        body: (
            <>
                <p>
                    En caso de incidente de seguridad, notificamos al administrador del cliente afectado
                    en un plazo razonable, junto con un informe inicial de impacto y plan de
                    remediación. Una vez resuelto, publicamos el post-mortem correspondiente.
                </p>
            </>
        ),
    },
    {
        id: 'reporte-vulnerabilidades',
        title: 'Reporte responsable de vulnerabilidades',
        body: (
            <>
                <p>
                    Si detectaste una vulnerabilidad, agradecemos el reporte responsable a{' '}
                    <a href="mailto:security@capsula.app" className="cap-text-blue underline">
                        security@capsula.app
                    </a>
                    . Pedimos no divulgarla públicamente hasta que el equipo confirme que el problema
                    está mitigado.
                </p>
                <p className="cap-text-soft text-[13px]">
                    {/* TODO: definir programa formal de bug bounty y rango de recompensas si aplica. */}
                    [Pendiente — política formal de bug bounty]
                </p>
            </>
        ),
    },
];

export default function SeguridadPage() {
    return (
        <LegalShell
            eyebrow="Legal"
            title="Seguridad"
            lastUpdated="27 de abril de 2026"
            intro={
                <p>
                    Esta página resume las medidas técnicas y organizativas con las que protegemos la
                    información del cliente. Para detalles específicos del SLA o para preguntas
                    contractuales, escríbenos a{' '}
                    <a href="mailto:security@capsula.app" className="cap-text-blue underline">
                        security@capsula.app
                    </a>
                    .
                </p>
            }
            sections={SECTIONS}
        />
    );
}
