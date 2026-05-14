/**
 * inspect-neon-schema.ts
 * ----------------------
 * Compara columna-por-columna las tablas comunes entre la BD de Neon
 * (Table Pong / Sello Criollo originales) y la BD de kpsula-erp.
 *
 * Solo lectura — no modifica nada.
 *
 * Uso:
 *   set -a && source /var/www/capsula-erp/.env && set +a && \
 *   npx tsx scripts/inspect-neon-schema.ts \
 *     --neon-url="postgresql://..." \
 *     [--tables=Branch,Area,User]   # opcional: solo estas tablas
 *
 * Output:
 *   Para cada tabla en común:
 *     - filas en Neon
 *     - columnas comunes (se migran)
 *     - columnas solo en Neon (SE PIERDEN al migrar)
 *     - columnas solo en target (quedan con default/null al migrar)
 *
 *   Tablas en Neon ausentes en target → "TABLA SE IGNORA AL MIGRAR".
 *   Tablas en target ausentes en Neon → "QUEDA VACÍA en el tenant nuevo".
 */

import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';

interface Args {
    neonUrl: string;
    tables: string[] | null; // null = todas
}

function parseArgs(): Args {
    const args = process.argv.slice(2);
    const map: Record<string, string> = {};
    for (const arg of args) {
        if (!arg.startsWith('--')) continue;
        const [k, ...rest] = arg.slice(2).split('=');
        map[k] = rest.join('=');
    }
    if (!map['neon-url']) {
        console.error('Falta --neon-url=postgresql://...');
        process.exit(1);
    }
    return {
        neonUrl: map['neon-url'],
        tables: map['tables'] ? map['tables'].split(',').map((s) => s.trim()) : null,
    };
}

async function getTablesFromDB(client: { query: (sql: string) => Promise<{ rows: { table_name: string }[] }> }): Promise<Set<string>> {
    const res = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    return new Set(res.rows.map((r) => r.table_name));
}

async function getColumnsFromDB(
    client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { column_name: string; data_type: string; is_nullable: string; column_default: string | null }[] }> },
    tableName: string,
): Promise<Map<string, { type: string; nullable: boolean; default: string | null }>> {
    const res = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_name = $1 AND table_schema = 'public'
         ORDER BY ordinal_position`,
        [tableName],
    );
    const map = new Map<string, { type: string; nullable: boolean; default: string | null }>();
    for (const r of res.rows) {
        map.set(r.column_name, { type: r.data_type, nullable: r.is_nullable === 'YES', default: r.column_default });
    }
    return map;
}

async function getRowCount(client: { query: (sql: string) => Promise<{ rows: { count: string }[] }> }, tableName: string): Promise<number> {
    try {
        const res = await client.query(`SELECT COUNT(*)::text AS count FROM "${tableName}"`);
        return parseInt(res.rows[0].count, 10);
    } catch {
        return -1;
    }
}

async function main() {
    const args = parseArgs();

    console.log('==================================================');
    console.log(' Inspector de schema: Neon vs kpsula-erp');
    console.log('==================================================');
    console.log('');

    const neon = new Client({ connectionString: args.neonUrl });
    await neon.connect();
    const prisma = new PrismaClient();

    try {
        const neonTables = await getTablesFromDB({
            query: (sql, params?) => neon.query(sql, params as any) as any,
        });
        const targetTables = await prisma.$queryRaw<{ table_name: string }[]>`
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        `;
        const targetSet = new Set(targetTables.map((r) => r.table_name));

        // Tablas en común
        let commonTables = [...neonTables].filter((t) => targetSet.has(t)).sort();
        if (args.tables) {
            const filter = new Set(args.tables);
            commonTables = commonTables.filter((t) => filter.has(t));
        }

        // Tablas solo en Neon (no se migran porque no hay destino)
        const neonOnly = [...neonTables].filter((t) => !targetSet.has(t)).sort();
        // Tablas solo en target (quedan vacías para el tenant nuevo)
        const targetOnly = [...targetSet].filter((t) => !neonTables.has(t) && !t.startsWith('_')).sort();

        console.log('TABLAS SOLO EN NEON (NO se migran — datos quedan archivados):');
        for (const t of neonOnly) console.log(`  - ${t}`);
        console.log('');
        console.log('TABLAS SOLO EN TARGET (quedan vacías para Table Pong):');
        for (const t of targetOnly) console.log(`  - ${t}`);
        console.log('');
        console.log(`==== TABLAS EN COMÚN (${commonTables.length}) ====`);
        console.log('');

        let totalRowsToMigrate = 0;
        let totalColsLost = 0;
        let totalColsDefault = 0;
        const tablesWithDrift: string[] = [];

        for (const tableName of commonTables) {
            const neonCols = await getColumnsFromDB({ query: (sql, params?) => neon.query(sql, params as any) as any }, tableName);
            const targetCols = await prisma.$queryRaw<{ column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]>`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = ${tableName} AND table_schema = 'public'
                ORDER BY ordinal_position
            `;
            const targetMap = new Map(targetCols.map((c) => [c.column_name, c]));

            const neonNames = new Set(neonCols.keys());
            const targetNames = new Set(targetMap.keys());
            const common = [...neonNames].filter((c) => targetNames.has(c));
            const neonExtra = [...neonNames].filter((c) => !targetNames.has(c));
            const targetExtra = [...targetNames].filter((c) => !neonNames.has(c));

            const rowCount = await getRowCount({ query: (sql) => neon.query(sql) as any }, tableName);
            totalRowsToMigrate += Math.max(0, rowCount);

            const driftScore = neonExtra.length + targetExtra.length;
            if (driftScore > 0) tablesWithDrift.push(tableName);
            totalColsLost += neonExtra.length;
            totalColsDefault += targetExtra.length;

            const driftLabel = driftScore === 0 ? 'OK' : driftScore < 3 ? 'ligero' : driftScore < 8 ? 'medio' : 'ALTO';
            console.log(`[${tableName}] filas: ${rowCount}, drift: ${driftLabel}`);
            if (neonExtra.length > 0) {
                console.log(`  - Solo en Neon (se PIERDEN): ${neonExtra.join(', ')}`);
            }
            if (targetExtra.length > 0) {
                // Marcar cuáles son required sin default (problema potencial)
                const requiredNoDefault = targetExtra.filter((c) => {
                    const tc = targetMap.get(c)!;
                    return tc.is_nullable === 'NO' && tc.column_default === null;
                });
                console.log(`  - Solo en target: ${targetExtra.join(', ')}`);
                if (requiredNoDefault.length > 0) {
                    console.log(`    ⚠ REQUIRED sin default (necesitan handler manual): ${requiredNoDefault.join(', ')}`);
                }
            }
        }

        console.log('');
        console.log('==================================================');
        console.log(' Resumen');
        console.log('==================================================');
        console.log(`  Tablas en común:        ${commonTables.length}`);
        console.log(`  Tablas con drift:       ${tablesWithDrift.length}`);
        console.log(`  Total filas a migrar:   ${totalRowsToMigrate.toLocaleString()}`);
        console.log(`  Columnas que se pierden: ${totalColsLost}`);
        console.log(`  Columnas con default:    ${totalColsDefault}`);
        console.log('');
        if (tablesWithDrift.length > 0) {
            console.log('  Tablas con drift (revisar antes de migrar):');
            for (const t of tablesWithDrift) console.log(`    - ${t}`);
        }
    } finally {
        await neon.end();
        await prisma.$disconnect();
    }
}

main().catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exit(1);
});
