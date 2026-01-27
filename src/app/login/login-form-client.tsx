'use client';

import { useState } from 'react';
import { loginAction } from '@/app/actions/auth.actions';
import { useFormStatus } from 'react-dom';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button
            type="submit"
            className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-[1.02] disabled:opacity-70 disabled:hover:scale-100"
            disabled={pending}
        >
            {pending ? (
                <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Validando...
                </span>
            ) : (
                'Iniciar Sesión'
            )}
        </button>
    );
}

export default function LoginForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState<string | null>(null);

    // Usamos el action directamente en el form, y capturamos errores si el action no redirige
    const handleSubmit = async (formData: FormData) => {
        setError(null);
        const result: any = await loginAction(null, formData);

        // Si el action retorna (no redirige), es que hubo error
        if (result?.success === false) {
            setError(result.message);
        }
        // Si redirige, este código no continúa
    };

    return (
        <form action={handleSubmit} className="space-y-6">
            <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Correo Electrónico
                </label>
                <div className="mt-1">
                    <input
                        id="email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="usuario@shanklish.com"
                        className="block w-full rounded-lg border border-gray-300 px-4 py-3 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-amber-500 sm:text-sm"
                    />
                </div>
            </div>

            <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Contraseña
                </label>
                <div className="mt-1">
                    <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        required
                        placeholder="••••••••"
                        className="block w-full rounded-lg border border-gray-300 px-4 py-3 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-amber-500 sm:text-sm"
                    />
                </div>
            </div>

            {error && (
                <div className="animate-in fade-in rounded-lg bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-200">
                    ⚠️ {error}
                </div>
            )}

            <SubmitButton />
        </form>
    );
}
