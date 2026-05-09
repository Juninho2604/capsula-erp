-- ============================================================================
-- Add User.tokenVersion — para invalidar JWTs vivos al cambiar rol/permisos/password
--
-- ALTER simple con DEFAULT 0 desde el inicio. Cero riesgo de NULL race.
--
-- Comportamiento esperado:
--   - Filas existentes: obtienen tokenVersion = 0.
--   - JWTs ya emitidos: NO contienen tokenVersion → se aceptan por
--     compatibilidad (el campo es opcional en SessionPayload). Al próximo
--     login, el JWT nuevo incluye tokenVersion=0 y queda alineado con BD.
--   - Cuando se bumpea (cambio de rol/permisos/password en user.actions),
--     BD avanza a 1 y los JWT con tokenVersion=0 son rechazados por
--     action-guard.
-- ============================================================================

ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
