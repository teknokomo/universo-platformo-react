import { getPoolExecutor } from '@universo/database'
import { withAdvisoryLock, type DbExecutor } from '@universo/utils/database'
import { registeredSystemAppDefinitions } from '@universo/migrations-platform'
import logger from '../utils/logger'

const STARTUP_RESET_LOCK_KEY = 'universo:startup:full-database-reset'
const STARTUP_RESET_LOCK_TIMEOUT_MS = 30_000

const INFRASTRUCTURE_SCHEMAS = new Set(['public'])
const DYNAMIC_SCHEMA_PATTERN = /^(app|mhb)_[a-z0-9_]+$/
const FIXED_SCHEMA_NAME_PATTERN = /^[a-z_][a-z0-9_]*$/

// --- Config ---

const parseEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
    if (value === undefined || value === '') {
        return defaultValue
    }
    const normalized = value.trim().toLowerCase()
    return normalized === 'true' || normalized === '1'
}

// --- Production guard ---

function assertNotProduction(): void {
    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'FULL_DATABASE_RESET is not allowed in production environment. ' +
                'Set NODE_ENV to development or remove FULL_DATABASE_RESET=true.'
        )
    }
}

// --- Schema discovery ---

function loadFixedProjectSchemaNames(): string[] {
    const definitions = registeredSystemAppDefinitions ?? []
    const fixedSchemas = definitions
        .flatMap((def) =>
            def?.schemaTarget?.kind === 'fixed' && typeof def.schemaTarget.schemaName === 'string' ? [def.schemaTarget.schemaName] : []
        )
        .filter((name) => !INFRASTRUCTURE_SCHEMAS.has(name))
        .concat('upl_migrations')

    const unique = Array.from(new Set(fixedSchemas)).sort()
    for (const name of unique) {
        if (!FIXED_SCHEMA_NAME_PATTERN.test(name)) {
            throw new Error(`Unsafe fixed project schema name: ${name}`)
        }
    }
    return unique
}

// --- Schema safety ---

function assertSafeProjectOwnedSchemaName(schemaName: string, fixedProjectSchemas: string[]): void {
    if (fixedProjectSchemas.includes(schemaName)) {
        return
    }
    if (DYNAMIC_SCHEMA_PATTERN.test(schemaName)) {
        return
    }
    throw new Error(`Refusing to drop non-project-owned schema during startup reset: ${schemaName}`)
}

// --- Identifier quoting ---

function quoteIdentifier(value: string): string {
    if (!value) {
        throw new Error('Identifier must not be empty')
    }
    return `"${value.replace(/"/g, '""')}"`
}

// --- Database state inspection ---

interface DatabaseStateSnapshot {
    fixedProjectSchemasPresent: string[]
    dynamicApplicationSchemas: string[]
    dynamicMetahubSchemas: string[]
    ownedSchemas: string[]
    authUsers: { id: string; email: string }[]
}

async function readProjectSchemas(
    db: DbExecutor,
    fixedProjectSchemas: string[]
): Promise<
    Pick<DatabaseStateSnapshot, 'fixedProjectSchemasPresent' | 'dynamicApplicationSchemas' | 'dynamicMetahubSchemas' | 'ownedSchemas'>
> {
    const fixedRows = await db.query<{ schema_name: string }>(
        `SELECT schema_name
         FROM information_schema.schemata
         WHERE schema_name = ANY($1::text[])
         ORDER BY schema_name ASC`,
        [fixedProjectSchemas]
    )

    const dynamicRows = await db.query<{ schema_name: string }>(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'app\\_%' ESCAPE '\\'
           OR schema_name LIKE 'mhb\\_%' ESCAPE '\\'
        ORDER BY schema_name ASC
    `)

    const dynamicApplicationSchemas = dynamicRows.map((row) => row.schema_name).filter((name) => name.startsWith('app_'))

    const dynamicMetahubSchemas = dynamicRows.map((row) => row.schema_name).filter((name) => name.startsWith('mhb_'))

    const fixedProjectSchemasPresent = fixedRows.map((row) => row.schema_name)

    return {
        fixedProjectSchemasPresent,
        dynamicApplicationSchemas,
        dynamicMetahubSchemas,
        ownedSchemas: [...dynamicApplicationSchemas, ...dynamicMetahubSchemas, ...fixedProjectSchemasPresent]
    }
}

async function readAuthUsers(db: DbExecutor): Promise<{ id: string; email: string }[]> {
    const rows = await db.query<{ id: string; email: string }>(`
        SELECT id::text AS id, COALESCE(email, '') AS email
        FROM auth.users
        ORDER BY created_at ASC, id ASC
    `)
    return rows
}

async function inspectDatabaseState(db: DbExecutor, fixedProjectSchemas: string[]): Promise<DatabaseStateSnapshot> {
    const [schemaData, authUsers] = await Promise.all([readProjectSchemas(db, fixedProjectSchemas), readAuthUsers(db)])

    return { ...schemaData, authUsers }
}

// --- Drop order ---

function buildSchemaDropOrder(
    schemaState: Pick<DatabaseStateSnapshot, 'fixedProjectSchemasPresent' | 'dynamicApplicationSchemas' | 'dynamicMetahubSchemas'>
): string[] {
    const fixedWithoutCatalog = schemaState.fixedProjectSchemasPresent.filter((name) => name !== 'upl_migrations')
    const migrationCatalogSchemas = schemaState.fixedProjectSchemasPresent.filter((name) => name === 'upl_migrations')

    return [
        ...schemaState.dynamicApplicationSchemas,
        ...schemaState.dynamicMetahubSchemas,
        ...fixedWithoutCatalog,
        ...migrationCatalogSchemas
    ]
}

// --- Drop execution ---

interface SchemaDropResult {
    schemaName: string
    status: 'dropped' | 'failed'
    message?: string
}

async function dropProjectSchemas(db: DbExecutor, ownedSchemas: string[], fixedProjectSchemas: string[]): Promise<SchemaDropResult[]> {
    const dropOrder = buildSchemaDropOrder({
        fixedProjectSchemasPresent: ownedSchemas.filter((name) => fixedProjectSchemas.includes(name)),
        dynamicApplicationSchemas: ownedSchemas.filter((name) => name.startsWith('app_')),
        dynamicMetahubSchemas: ownedSchemas.filter((name) => name.startsWith('mhb_'))
    })

    const results: SchemaDropResult[] = []

    for (const schemaName of dropOrder) {
        assertSafeProjectOwnedSchemaName(schemaName, fixedProjectSchemas)

        try {
            await db.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`)
            results.push({ schemaName, status: 'dropped' })
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            results.push({ schemaName, status: 'failed', message })
            logger.error(`[startup-reset]: Failed to drop schema ${schemaName}`, { error: message })
        }
    }

    return results
}

// --- Auth user deletion ---

interface AuthUserDeleteResult {
    userId: string
    email: string
    status: 'deleted' | 'failed'
    message?: string
}

async function deleteAllAuthUsers(db: DbExecutor, authUsers: { id: string; email: string }[]): Promise<AuthUserDeleteResult[]> {
    if (authUsers.length === 0) {
        return []
    }

    const userIds = authUsers.map((u) => u.id)

    try {
        await db.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [userIds])

        return authUsers.map((user) => ({ userId: user.id, email: user.email, status: 'deleted' as const }))
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logger.error('[startup-reset]: Failed to delete auth users via SQL', { error: message })

        return authUsers.map((user) => ({ userId: user.id, email: user.email, status: 'failed' as const, message }))
    }
}

// --- Residue check ---

function hasProjectOwnedResidue(state: DatabaseStateSnapshot): boolean {
    return state.ownedSchemas.length > 0 || state.authUsers.length > 0
}

// --- Report ---

export interface StartupResetReport {
    enabled: true
    executedAt: string
    droppedSchemas: SchemaDropResult[]
    deletedAuthUsers: AuthUserDeleteResult[]
    before: { schemaCount: number; authUserCount: number }
    after: { schemaCount: number; authUserCount: number }
}

// --- Options ---

export interface StartupResetOptions {
    /**
     * When true, bypass the FULL_DATABASE_RESET environment variable check.
     * Production guard (NODE_ENV=production) is NEVER bypassed.
     */
    force?: boolean
}

// --- Main entry point ---

export async function executeStartupFullReset(
    options?: StartupResetOptions
): Promise<StartupResetReport | { enabled: false; status: 'disabled' }> {
    const envEnabled = parseEnvBoolean(process.env.FULL_DATABASE_RESET, false)
    const shouldExecute = options?.force === true || envEnabled

    if (!shouldExecute) {
        return { enabled: false, status: 'disabled' }
    }

    // Production guard is NEVER bypassed, even with force=true
    assertNotProduction()

    logger.warn('⚠️ [startup-reset]: FULL DATABASE RESET IS ENABLED — all platform data will be destroyed!')

    const fixedProjectSchemas = loadFixedProjectSchemaNames()

    return withAdvisoryLock(
        getPoolExecutor(),
        STARTUP_RESET_LOCK_KEY,
        async (tx) => {
            await tx.query('CREATE SCHEMA IF NOT EXISTS public')

            const beforeState = await inspectDatabaseState(tx, fixedProjectSchemas)

            const dropResults = await dropProjectSchemas(tx, beforeState.ownedSchemas, fixedProjectSchemas)

            const deleteResults = await deleteAllAuthUsers(tx, beforeState.authUsers)

            await tx.query('CREATE SCHEMA IF NOT EXISTS public')

            const afterState = await inspectDatabaseState(tx, fixedProjectSchemas)

            if (hasProjectOwnedResidue(afterState)) {
                throw new Error(
                    `Startup reset incomplete: residual schemas=${afterState.ownedSchemas.length}, ` +
                        `auth users=${afterState.authUsers.length}`
                )
            }

            const report: StartupResetReport = {
                enabled: true,
                executedAt: new Date().toISOString(),
                droppedSchemas: dropResults,
                deletedAuthUsers: deleteResults,
                before: { schemaCount: beforeState.ownedSchemas.length, authUserCount: beforeState.authUsers.length },
                after: { schemaCount: afterState.ownedSchemas.length, authUserCount: afterState.authUsers.length }
            }

            logger.info('[startup-reset]: Full reset completed', {
                droppedSchemas: dropResults.length,
                deletedAuthUsers: deleteResults.length
            })

            return report
        },
        { timeoutMs: STARTUP_RESET_LOCK_TIMEOUT_MS }
    )
}
