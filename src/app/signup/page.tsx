import { notFound } from 'next/navigation';
import SignupForm from './signup-form-client';

/**
 * Página /signup — registro self-service de tenants nuevos.
 *
 * Bajo feature flag `SIGNUPS_ENABLED=true`. Si la flag no está activada,
 * la página devuelve 404 (no expone la existencia del feature).
 *
 * El form delega al server action `signupTenantAction` que también
 * valida la flag. Doble check defensivo: el cliente no puede saltarse
 * el flag llamando al action directamente.
 */
export default function SignupPage() {
    if (process.env.SIGNUPS_ENABLED !== 'true') {
        notFound();
    }

    return (
        <div className="min-h-screen bg-capsula-ivory px-4 py-12">
            <div className="mx-auto max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-semibold tracking-[-0.02em] text-capsula-ink">
                        Crear cuenta de negocio
                    </h1>
                    <p className="mt-2 text-sm text-capsula-ink-soft">
                        En 1 minuto tenés tu propio sistema de gestión.
                    </p>
                </div>
                <SignupForm />
            </div>
        </div>
    );
}
