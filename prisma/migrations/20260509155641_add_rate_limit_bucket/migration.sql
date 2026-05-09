-- ============================================================================
-- PR 2 — Rate limiting tabla
--
-- Tabla independiente, agnóstica a tenant. Se usa antes de saber el tenant
-- (login, PIN). Cada bucket vive como mucho 1 ventana; se limpia con DELETE.
-- ============================================================================

CREATE TABLE "RateLimitBucket" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count"       INTEGER NOT NULL DEFAULT 1,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RateLimitBucket_key_windowStart_key" ON "RateLimitBucket"("key", "windowStart");
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
