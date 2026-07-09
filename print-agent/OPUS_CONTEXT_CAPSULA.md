
## §85 % de servicio editable al cobro (2026-07-09)

Pedido de Omar: poder "jugar" con el % de servicio en el POS; default 10%
pero editable a la hora del cobro. Antes el 10% estaba hardcodeado
(`0.10`/`1.1`) en server y cliente.

### Server (pos.actions.ts)
- Helper `normalizeServiceRate(percent)` → fracción, default 0.10, clamp 0–100.
- Input de pago: `serviceFeePercent?` en `registerOpenTabPaymentAction`
  (mesa principal) y `paySubAccountAction`. `serviceCharge = base *
  normalizeServiceRate(...)` en vez de `* 0.10`. Label de subcuenta ahora
  `+N% serv` (era `+10% serv` fijo).
- `recalcSubAccountTotals` (preview de subcuenta pre-cobro) sigue en 10%:
  es una estimación de display sin contexto de %; el cobro real usa el %
  elegido. paySubAccountAction sin serviceFeePercent → default 10%.

### divisas-settlement.ts
`serviceRate?` (default 0.10) → `1+rate` y `net*rate` en vez de 1.1/0.1.
Los tests viejos pasan (default). +2 tests (15% custom, default compat).

### Cliente restaurante (page.tsx)
- Estado `serviceFeePercentStr` (default "10", string mientras se tipea);
  `serviceRate = incluido ? %/100 : 0`. Reemplaza todos los `*1.1`/`*0.1`.
- UI de checkout: input editable `[ 10 ]%` + chips rápidos 10/12/15/20;
  "Quitar" (eximir con PIN, sin cambios) / "Restaurar servicio". Se pasa
  `serviceFeePercent` a la action y a `computeDivisasSettlement`.
- Parse tolerante del label de splits (`/\+(\d+)% serv/`) para mostrar
  "+N%".

### Impresión (label dinámico)
`serviceFeePercent?` en `ReceiptData` (print-command), `AgentReceiptPayload`
(print-via-agent) y `ReceiptPayload` (printer-adapter). El recibo imprime
"N% Servicio" / "Servicio (N%)" en vez de "10%" fijo. Restaurante pasa el %
en recibo y pre-cuenta.

Alcance: el % editable está en el cobro de MESA principal (restaurante). El
mesero mantiene su selector 10/15/20 (sugerencia de propina §49); subcuentas
usan 10% default. Sin migración (solo lógica/UI). Gates: tsc 0 · vitest 497.
