/**
 * Inferencia de propina (excedente) de una orden no-tab cobrada.
 *
 * La fórmula es la misma que usa el historial de ventas (`history.actions.ts`)
 * y cubre los 3 casos del flujo del POS:
 *
 *   A) Cliente paga justo  → amountPaid == total, change = 0 → tip = 0
 *   B) "Quedate con el vuelto" → keepChangeAsTip=true → amountPaid > total,
 *      change = 0 → tip = amountPaid - total
 *   C) Propina explícita + vuelto → la cajera marca tipAtCheckout = X y el
 *      sistema guarda change = (vuelto bruto − X). Entonces el excedente
 *      real (lo que se quedó la cajera) es amountPaid − change − total.
 *
 *  El bug que esto corrige: el Z report y el cierre del día venían
 *  exigiendo `change === 0` para detectar propina, así que el Caso C
 *  quedaba en cero — la propina explícita en delivery/pickup no aparecía
 *  en el cierre aunque sí estuviera físicamente en caja.
 *
 *  Misma fórmula sirve para pago mixto: `amountPaid` es la suma de las
 *  líneas mixtas, `change` se calcula igual que en pago simple. El
 *  excedente sobre `total` es propina.
 */
export function inferOrderTip(o: {
    total: number;
    amountPaid: number | null | undefined;
    change: number | null | undefined;
}): number {
    const total = o.total || 0;
    const amountPaid = o.amountPaid || 0;
    const change = o.change || 0;
    const tip = amountPaid - change - total;
    return tip > 0 ? tip : 0;
}
