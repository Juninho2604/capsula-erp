# Análisis del `OPUS_CONTEXT_CAPSULA.md`

El archivo (3262 líneas, raíz del repo) es la **radiografía completa del sistema Shanklish ERP / Cápsula SaaS**. Es documentación viva —última actualización 2026-04-14— que combina arquitectura, changelog y roadmap.

## Estructura (25 secciones + auditoría)

| Bloque | Secciones | Contenido |
|---|---|---|
| **Identidad** | §1 | Stack: Next.js 14 + Prisma + PostgreSQL + VPS Contabo. Dos instancias: `shanklish-erp` y `table-pong` |
| **Datos** | §2 | 66 modelos Prisma agrupados en 14 dominios (Core, Inventario, Producción, POS, Financiero, etc.) |
| **Seguridad** | §3 | Auth JWT con `jose`, 9 roles, RBAC en 4 capas (middleware → módulos → allowedModules → perms granulares) |
| **Navegación** | §4 | 47 módulos en 4 secciones (Operaciones, Ventas/POS, Entretenimiento, Administración) |
| **Módulos** | §5–§8 | Detalle de cada módulo: ruta, actions, modelos, lógica, estado |
| **API/Servicios** | §9–§10 | 4 API routes, 3 servicios (inventory/production/cost), 20 libs, 23 componentes |
| **Admin SaaS** | §11 | Panel Admin propuesto (métodos de pago, fees, descuentos) — P1–P4 |
| **Mapa/Gaps** | §12–§16 | Conexiones inter-módulo, restricciones inamovibles, gap analysis y roadmap |
| **Deploy** | §17, §19, §23 | VPS Contabo + PM2 + GitHub Actions SSH deploy |
| **SaaS** | §20–§21, §24 | Estrategia multi-tenant, go-to-market, tienda virtual |
| **Detalle UI** | §18 | 20 sub-secciones con bugfixes y convenciones (z-index, cards, propinas, subcuentas, PKs, etc.) |
| **Brand** | §25 | Paleta Coral/Navy, tipografía Nunito/Inter, CapsulaLogo |

## Hallazgos clave

- **Exhaustivo y actualizado**: incluye commit hashes, fechas, líneas específicas de código y notas de bugs resueltos.
- **Changelog cronológico** arriba (10 entradas del 13–14 abril 2026).
- **Gaps críticos identificados** (§16): métodos de pago hardcodeados en 3 archivos, delivery fees duplicados front/back, service charge detectado por string matching, JWT secret con fallback hardcodeado.
- **Restricciones inamovibles** (§13): BD solo aditiva, soft delete, AuditLog inmutable, correlativos nunca se resetean.
- **Pendiente explícito** (final): verificar si los `console.log` de debug de `getDailyPickupCountAction` (§18.20) fueron removidos de `pos.actions.ts`.

El documento funciona como fuente autoritativa de contexto para cualquier cambio — combina manual de arquitectura, bitácora de sesión y guía de onboarding.
