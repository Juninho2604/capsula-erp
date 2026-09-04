'use client';

/**
 * §170 — Campo numérico que no pelea con quien escribe.
 *
 * Reemplaza el patrón repetido en 23 campos del sistema:
 *
 *     value={cantidad || ''}
 *     onChange={e => setCantidad(parseFloat(e.target.value) || 0)}
 *
 * …que hacía imposible teclear "0.5" de corrido (el cero se borraba solo).
 *
 * Cómo funciona: mientras se escribe, el campo guarda el TEXTO; el número se
 * avisa hacia afuera sólo cuando el texto ya es un número. Los pasos
 * intermedios (`0`, `0.`, `.`) quedan quietos en pantalla.
 *
 * Es `type="text"` con `inputMode="decimal"`, no `type="number"`. Tres razones:
 * acepta coma como decimal (que es como se teclea acá y lo que dan los teclados
 * táctiles), no cambia el valor si alguien rueda la ruedita del mouse por
 * encima, y no pinta las flechitas que en pantalla táctil sólo estorban.
 */

import { useEffect, useRef, useState } from 'react';
import {
    sanitizeNumericText,
    parseNumericText,
    formatNumericValue,
} from '@/lib/forms/numeric-input';

interface NumberInputProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'inputMode'
> {
    value: number | null | undefined;
    /** Se llama con el número, o con null cuando el campo queda vacío. */
    onValueChange: (value: number | null) => void;
    /** Mostrar el cero en vez de dejar el campo vacío. Default: false. */
    showZero?: boolean;
    allowNegative?: boolean;
}

export function NumberInput({
    value, onValueChange, showZero, allowNegative, ...rest
}: NumberInputProps) {
    const [text, setText] = useState(() => formatNumericValue(value, { showZero }));
    // Último número que este campo emitió: sirve para distinguir un cambio
    // venido de afuera (reset del formulario, carga) de uno que provocó el
    // propio tecleo — sin esto, escribir "0." se re-sincronizaba a "0" y el
    // punto se perdía, que es justo el bug que se está arreglando.
    const lastEmitted = useRef<number | null>(parseNumericText(text));

    useEffect(() => {
        const incoming = value ?? null;
        if (incoming === lastEmitted.current) return;
        lastEmitted.current = incoming;
        setText(formatNumericValue(incoming, { showZero }));
    }, [value, showZero]);

    return (
        <input
            {...rest}
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => {
                const clean = sanitizeNumericText(e.target.value, { allowNegative });
                setText(clean);
                const parsed = parseNumericText(clean);
                lastEmitted.current = parsed;
                onValueChange(parsed);
            }}
            onBlur={(e) => {
                // Al salir se normaliza lo que quedó a medias ("0." → "0").
                const parsed = parseNumericText(text);
                setText(formatNumericValue(parsed, { showZero }));
                rest.onBlur?.(e);
            }}
        />
    );
}
