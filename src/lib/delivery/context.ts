/**
 * Shaper PURO del payload de `GET /contexto` que n8n inyecta en el prompt del
 * bot (reemplaza las variables manuales {AGOTADOS_HOY}, {TASA_BS_DIA},
 * {NOTAS_GERENTE}).
 *
 * En Fase 1 solo se llenan `sedes` y `tasa_bs`; `agotados`, `notas_gerente` y
 * `reglas_ruteo` salen como arrays vacíos hasta que sus submódulos existan
 * (Fase 4 / 4.5). El shape ya queda estable para que el prompt no cambie.
 */

export interface ContextSede {
    id: string;
    nombre: string;
    zonas: string[];
    lat: number | null;
    lon: number | null;
}

export interface ContextAgotado {
    sede_id: string;
    item: string;
}

export interface ContextNota {
    sede_id: string | null;
    texto: string;
    vigencia: string | null;
}

export interface ContextReglaRuteo {
    si_incluye_producto: string;
    enviar_a_sede_id: string;
}

export interface DeliveryContext {
    sedes: ContextSede[];
    agotados: ContextAgotado[];
    tasa_bs: number | null;
    notas_gerente: ContextNota[];
    reglas_ruteo: ContextReglaRuteo[];
}

export interface BuildContextInput {
    sedes: ContextSede[];
    tasaBs?: number | null;
    agotados?: ContextAgotado[];
    notas?: ContextNota[];
    reglasRuteo?: ContextReglaRuteo[];
}

export function buildDeliveryContext(input: BuildContextInput): DeliveryContext {
    return {
        sedes: input.sedes,
        agotados: input.agotados ?? [],
        tasa_bs: input.tasaBs ?? null,
        notas_gerente: input.notas ?? [],
        reglas_ruteo: input.reglasRuteo ?? [],
    };
}
