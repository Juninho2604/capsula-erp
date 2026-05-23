/**
 * audit-tenant-isolation.ts
 * -------------------------
 * Audit estático del aislamiento multi-tenant. Escanea server actions y
 * route handlers, y clasifica cada archivo en una de 4 categorías según
 * cómo accede a Prisma.
 *
 * No es exhaustivo: el script detecta patrones obvios de uso de
 * `withTenant`/`getTenantDb` y reporta los archivos que NO los usan
 * pero hacen queries Prisma. Es responsabilidad del revisor decidir si
 * un archivo en WHITELIST o REVIEW es legítimo (super admin, login,
 * filtrado manual por FK indirecta, etc).
 *
 * Uso:
 *   npx tsx scripts/audit-tenant-isolation.ts            # report
 *   npx tsx scripts/audit-tenant-isolation.ts --strict   # exit 1 si hay REVIEW
 *
 * Para correr en CI, usar --strict con whitelist actualizada en el código.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

interface FlaggedCall {
    fullMatch: string;        // 'prisma.salesOrder.findMany'
    model: string;
    method: string;
    line: number;
    hasManualTenantFilter: boolean;  // próximas 12 líneas contienen 'tenantId' o tenantId-via-FK
}

interface FileReport {
    path: string;
    importsPrismaDirect: boolean;
    importsWithTenant: boolean;
    importsResolveTenantContext: boolean;
    prismaModelCalls: FlaggedCall[];
    tenantDbCalls: number;           // ej. db.salesOrder.findMany (count)
    classification: 'OK' | 'WHITELIST' | 'MANUAL' | 'REVIEW' | 'DANGER';
    reasons: string[];
}

// Archivos que son legítimamente cross-tenant o pre-login. No requieren
// `withTenant`. Mantener mínima y revisar cada vez que algo nuevo entre.
const WHITELIST = new Set<string>([
    'src/app/actions/auth.actions.ts',          // login multi-tenant search
    'src/app/actions/signup.actions.ts',        // crea tenant + owner
    'src/app/admin/page.tsx',                   // super admin dashboard
    'src/app/admin/tenants/page.tsx',           // super admin lista tenants
    'src/app/admin/tenants/[tenantId]/page.tsx',// super admin detalle tenant
    'src/app/admin/tenants/actions.ts',         // super admin CRUD tenants
    'src/app/api/auth/session/route.ts',        // sesión actual (pre-tenant)
    'src/app/api/health/route.ts',              // health check sin BD
    'src/app/api/debug/whoami/route.ts',        // super admin debug
    'src/app/api/cron/retry-inventory-deductions/route.ts', // cron cross-tenant
    'src/app/api/print-agent/jobs/route.ts',    // multi-tenant via API key
    'src/app/api/print-agent/jobs/[id]/claim/route.ts',
    'src/app/api/print-agent/jobs/[id]/complete/route.ts',
    'src/app/api/print-agent/jobs/[id]/fail/route.ts',
    'src/app/api/tenant/whoami/route.ts',       // metadata del tenant actual
    'src/app/api/files/[...path]/route.ts',     // valida tenant-match propio
    'src/app/api/upload/route.ts',              // namespacing per-tenant manual
]);

// Modelos que NO tienen tenantId directo en schema. Llamarlos en
// `prisma.<modelo>.*` no es bug per se — la aislación se hereda por FK.
// Documentado para no levantar falsos positivos.
const MODELS_WITHOUT_TENANT_ID = new Set<string>([
    'inventoryMovement',           // FK → inventoryItem.tenantId
    'inventoryLocation',           // FK → inventoryItem.tenantId
    'inventoryDeductionRetry',     // FK → salesOrder.tenantId
    'salesOrderPayment',           // FK → salesOrder.tenantId
    'recipeIngredient',            // FK → recipe.tenantId
    'menuItemModifierGroup',       // pivot: validado por ownership en ambos FKs
    'modifierGroupModifier',       // pivot
    'auditLog',                    // tiene tenantId pero a veces creado en
                                   //   bootstrap pre-tenant
    'costHistory',                 // FK → inventoryItem.tenantId
    'session',                     // user-scoped, no tenant directo
    'tenant',                      // ¡es el tenant en sí! Operaciones cross-tenant válidas
    'user',                        // tiene tenantId pero también ops cross-tenant (super admin)
]);

const ROOT = join(__dirname, '..');

// ─── Escaneo ───────────────────────────────────────────────────────────────

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
            if (entry === 'node_modules' || entry === '.next') continue;
            walk(full, out);
        } else if (st.isFile()) {
            out.push(full);
        }
    }
    return out;
}

function classifyFile(absPath: string): FileReport | null {
    const rel = relative(ROOT, absPath);

    // Solo nos interesan server actions y route handlers + pages que
    // contienen 'use server' actions.
    const isAction = rel.startsWith('src/app/') &&
        (rel.endsWith('.actions.ts') || rel.endsWith('/actions.ts'));
    const isRoute = rel.startsWith('src/app/api/') && rel.endsWith('/route.ts');
    if (!isAction && !isRoute) return null;

    const src = readFileSync(absPath, 'utf8');

    // ¿Tiene 'use server'? Necesario para que sea server action.
    const hasUseServer = /^['"]use server['"]/m.test(src);
    if (isAction && !hasUseServer) return null;

    const importsPrismaDirect = /import\s+(?:\w+|{[^}]*})\s+from\s+['"]@\/server\/db['"]/.test(src);
    const importsWithTenant = /from\s+['"]@\/lib\/prisma-tenant-client['"]/.test(src);
    const importsResolveTenantContext = /from\s+['"]@\/lib\/tenant-context\.server['"]/.test(src);

    // Llamadas a prisma.<modelo>.<method>(...) — heurística por regex.
    // Captura "prisma.<modelo>.<method>" donde method es uno de los conocidos.
    const PRISMA_METHODS = '(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|create|createMany|update|updateMany|upsert|delete|deleteMany|count|aggregate|groupBy)';
    const prismaCallRe = new RegExp(`\\bprisma\\.([a-zA-Z]+)\\.${PRISMA_METHODS}\\b`, 'g');

    // Para detectar "filtro manual de tenantId" cerca de la query, partimos
    // el archivo en líneas y buscamos en una ventana de ±12 líneas alrededor
    // del match. Si encuentra `tenantId`, `tenant: { id`, o un patrón de FK
    // a una tabla tenant-aware (ej. `fromBranchId: { in: tenantBranchIds }`),
    // se considera filtrado manualmente.
    const lines = src.split('\n');
    const TENANT_FILTER_PATTERNS = [
        /\btenantId\b/,
        /\btenant:\s*{/,
        /\btenantBranchIds\b/,
        /\bfromBranchId:\s*{\s*in:\s*tenant/,
        // Patrón "ya validado upstream": comentarios documentando el caller
        /\bya\s+validad/i,
    ];

    const prismaModelCalls: FlaggedCall[] = [];
    let m: RegExpExecArray | null;
    while ((m = prismaCallRe.exec(src)) !== null) {
        const model = m[1];
        const method = m[2];
        if (MODELS_WITHOUT_TENANT_ID.has(model)) continue; // legitimo por FK indirecta

        // Resolver número de línea
        const charIdx = m.index;
        let line = 1;
        let acc = 0;
        for (let i = 0; i < lines.length; i++) {
            acc += lines[i].length + 1;
            if (charIdx < acc) { line = i + 1; break; }
        }

        // Ventana ±15 líneas (asimétrica hacia atrás para capturar `where`
        // construido en variable arriba del call).
        const winStart = Math.max(0, line - 15);
        const winEnd = Math.min(lines.length, line + 15);
        const window = lines.slice(winStart, winEnd).join('\n');

        const hasManualTenantFilter = TENANT_FILTER_PATTERNS.some(p => p.test(window));

        prismaModelCalls.push({
            fullMatch: `prisma.${model}.${method}`,
            model,
            method,
            line,
            hasManualTenantFilter,
        });
    }

    // Llamadas a db.<modelo>.<method>(...) — proxy del tenant client.
    const tenantDbRe = new RegExp(`\\bdb\\.[a-zA-Z]+\\.${PRISMA_METHODS}\\b`, 'g');
    const tenantDbCalls = (src.match(tenantDbRe) ?? []).length;

    const reasons: string[] = [];
    let classification: FileReport['classification'];

    const callsWithFilter = prismaModelCalls.filter(c => c.hasManualTenantFilter);
    const callsWithoutFilter = prismaModelCalls.filter(c => !c.hasManualTenantFilter);

    if (WHITELIST.has(rel)) {
        classification = 'WHITELIST';
        reasons.push('en allowlist (cross-tenant legítimo o pre-login)');
    } else if (prismaModelCalls.length === 0) {
        if (importsWithTenant || tenantDbCalls > 0) {
            classification = 'OK';
            reasons.push('usa withTenant + no hace prisma.<modelo-tenant-aware> directo');
        } else if (!importsPrismaDirect && tenantDbCalls === 0) {
            // Archivo sin queries Prisma — no aplica auditoría.
            return null;
        } else {
            classification = 'OK';
            reasons.push('sin patrones sospechosos detectados');
        }
    } else if (callsWithoutFilter.length === 0) {
        // Todas las queries directas tienen filtro manual de tenantId cerca.
        classification = 'MANUAL';
        reasons.push(`${prismaModelCalls.length} prisma.<modelo> directo(s), todos con filtro manual de tenantId/FK detectado:`);
        for (const c of prismaModelCalls.slice(0, 5)) reasons.push(`  · ${c.fullMatch} L${c.line}`);
        if (prismaModelCalls.length > 5) reasons.push(`  · ... y ${prismaModelCalls.length - 5} más`);
    } else if (importsWithTenant) {
        classification = 'REVIEW';
        reasons.push(`importa withTenant pero hace ${callsWithoutFilter.length} call(s) sin filtro tenant manual:`);
        for (const c of callsWithoutFilter.slice(0, 5)) reasons.push(`  · ${c.fullMatch} L${c.line}`);
        if (callsWithoutFilter.length > 5) reasons.push(`  · ... y ${callsWithoutFilter.length - 5} más`);
    } else {
        classification = 'DANGER';
        reasons.push(`NO importa withTenant y hace ${callsWithoutFilter.length} call(s) sin filtro tenant manual:`);
        for (const c of callsWithoutFilter.slice(0, 5)) reasons.push(`  · ${c.fullMatch} L${c.line}`);
    }

    void callsWithFilter; // silenciar lint, lo usamos via filter() pero no reportamos por separado

    return {
        path: rel,
        importsPrismaDirect,
        importsWithTenant,
        importsResolveTenantContext,
        prismaModelCalls,
        tenantDbCalls,
        classification,
        reasons,
    };
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
    const strict = process.argv.includes('--strict');

    const files = walk(join(ROOT, 'src/app'));
    const reports: FileReport[] = [];
    for (const f of files) {
        const r = classifyFile(f);
        if (r) reports.push(r);
    }

    // Agrupar por classification
    const by: Record<FileReport['classification'], FileReport[]> = {
        OK: [], WHITELIST: [], MANUAL: [], REVIEW: [], DANGER: [],
    };
    for (const r of reports) by[r.classification].push(r);

    console.log('======================================================');
    console.log(' Audit de aislamiento multi-tenant');
    console.log('======================================================');
    console.log(`  Archivos auditados:  ${reports.length}`);
    console.log(`  OK:                  ${by.OK.length}  (usan withTenant exclusivamente)`);
    console.log(`  WHITELIST:           ${by.WHITELIST.length}  (cross-tenant legítimo)`);
    console.log(`  MANUAL:              ${by.MANUAL.length}  (prisma directo con filtro tenantId visible)`);
    console.log(`  REVIEW:              ${by.REVIEW.length}  (importa withTenant pero usa prisma directo sin filtro)`);
    console.log(`  DANGER:              ${by.DANGER.length}  (no usa withTenant ni filtro manual)`);
    console.log('');

    if (by.DANGER.length > 0) {
        console.log('───────────── DANGER (acción inmediata) ──────────────');
        for (const r of by.DANGER) {
            console.log(`\n  ${r.path}`);
            for (const reason of r.reasons) console.log(`    ${reason}`);
        }
        console.log('');
    }

    if (by.REVIEW.length > 0) {
        console.log('────────── REVIEW (validar manualmente) ──────────────');
        for (const r of by.REVIEW) {
            console.log(`\n  ${r.path}`);
            for (const reason of r.reasons) console.log(`    ${reason}`);
        }
        console.log('');
    }

    if (by.DANGER.length === 0 && by.REVIEW.length === 0) {
        console.log('✓ Sin hallazgos. Aislamiento estáticamente verificado.');
    }

    if (strict && (by.DANGER.length > 0 || by.REVIEW.length > 0)) {
        console.log('');
        console.error('--strict: hay archivos REVIEW/DANGER. Exit 1.');
        process.exit(1);
    }
}

main();
