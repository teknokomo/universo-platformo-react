import fs from 'fs/promises'
import { createRequire } from 'module'
import { deleteSupabaseAuthUser } from './api-session.mjs'
import { withE2eAdvisoryLock, withE2eDatabaseClient } from './e2eDatabase.mjs'
import { loadE2eEnvironment, manifestPath, storageStatePath } from '../env/load-e2e-env.mjs'
import { removeRunManifest } from './run-manifest.mjs'

const require = createRequire(import.meta.url)

const fullResetLockKey = 'universo:e2e:hosted-supabase-full-reset'
const fixedSchemaNamePattern = /^[a-z_][a-z0-9_]*$/
const managedDynamicSchemaPattern = /^(app|mhb)_[a-z0-9_]+$/
const nonDroppableInfrastructureSchemas = new Set(['public'])

const removeFileIfExists = async (filePath) => {
    try {
        await fs.rm(filePath, { force: true })
    } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
            throw error
        }
    }
}

const fileExists = async (filePath) => {
    try {
        await fs.access(filePath)
        return true
    } catch {
        return false
    }
}

const quoteIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`

const toErrorMessage = (error) => (error instanceof Error ? error.message : String(error))

async function ensureInfrastructureBase(client) {
    await client.query('CREATE SCHEMA IF NOT EXISTS public')
}

async function isServerReachable(baseURL) {
    try {
        const response = await fetch(`${baseURL}/api/v1/ping`, { method: 'GET' })
        return response.ok
    } catch {
        return false
    }
}

function loadFixedProjectSchemaNames() {
    let moduleExports

    try {
        moduleExports = require('@universo/migrations-platform')
    } catch (error) {
        throw new Error(
            `Unable to load @universo/migrations-platform for E2E reset. Run 'pnpm build' or 'pnpm build:e2e' first. ${toErrorMessage(error)}`
        )
    }

    const definitions = moduleExports.registeredSystemAppDefinitions ?? moduleExports.systemAppDefinitions
    if (!Array.isArray(definitions)) {
        throw new Error('Registered system app definitions are unavailable for E2E reset')
    }

    const fixedSchemas = definitions
        .flatMap((definition) =>
            definition?.schemaTarget?.kind === 'fixed' && typeof definition.schemaTarget.schemaName === 'string'
                ? [definition.schemaTarget.schemaName]
                : []
        )
        .filter((schemaName) => !nonDroppableInfrastructureSchemas.has(schemaName))
        .concat('upl_migrations')

    const uniqueSchemas = Array.from(new Set(fixedSchemas)).sort((left, right) => left.localeCompare(right))

    for (const schemaName of uniqueSchemas) {
        if (!fixedSchemaNamePattern.test(schemaName)) {
            throw new Error(`Unsafe fixed project schema name detected for E2E reset: ${schemaName}`)
        }
    }

    return uniqueSchemas
}

function assertSafeProjectOwnedSchemaName(schemaName, fixedProjectSchemas) {
    if (fixedProjectSchemas.includes(schemaName)) {
        return
    }

    if (managedDynamicSchemaPattern.test(schemaName)) {
        return
    }

    throw new Error(`Refusing to drop non-project-owned schema during E2E reset: ${schemaName}`)
}

async function readProjectSchemas(client, fixedProjectSchemas) {
    const fixedRows = await client.query(
        `
            SELECT schema_name
            FROM information_schema.schemata
            WHERE schema_name = ANY($1::text[])
            ORDER BY schema_name ASC
        `,
        [fixedProjectSchemas]
    )

    const dynamicRows = await client.query(`
        SELECT schema_name
        FROM information_schema.schemata
        WHERE schema_name LIKE 'app\\_%' ESCAPE '\\'
           OR schema_name LIKE 'mhb\\_%' ESCAPE '\\'
        ORDER BY schema_name ASC
    `)

    const dynamicApplicationSchemas = dynamicRows.rows
        .map((row) => row.schema_name)
        .filter((schemaName) => typeof schemaName === 'string' && schemaName.startsWith('app_'))

    const dynamicMetahubSchemas = dynamicRows.rows
        .map((row) => row.schema_name)
        .filter((schemaName) => typeof schemaName === 'string' && schemaName.startsWith('mhb_'))

    return {
        fixedProjectSchemasPresent: fixedRows.rows.map((row) => row.schema_name),
        dynamicApplicationSchemas,
        dynamicMetahubSchemas,
        ownedSchemas: [
            ...dynamicApplicationSchemas,
            ...dynamicMetahubSchemas,
            ...fixedRows.rows.map((row) => row.schema_name)
        ]
    }
}

async function readAuthUsers(client) {
    const result = await client.query(`
        SELECT id::text AS id, COALESCE(email, '') AS email
        FROM auth.users
        ORDER BY created_at ASC, id ASC
    `)

    return result.rows.map((row) => ({
        id: row.id,
        email: row.email
    }))
}

async function readLocalArtifactsState() {
    return {
        manifestExists: await fileExists(manifestPath),
        storageStateExists: await fileExists(storageStatePath)
    }
}

function buildInspectionResult({ fixedProjectSchemas, schemaState, authUsers, localArtifacts, inspectedAt, sampleAuthUsers }) {
    return {
        inspectedAt,
        fixedProjectSchemas,
        fixedProjectSchemasPresent: schemaState.fixedProjectSchemasPresent,
        dynamicApplicationSchemas: schemaState.dynamicApplicationSchemas,
        dynamicMetahubSchemas: schemaState.dynamicMetahubSchemas,
        ownedSchemas: schemaState.ownedSchemas,
        authUsersSample: authUsers.slice(0, sampleAuthUsers),
        counts: {
            fixedProjectSchemaCount: schemaState.fixedProjectSchemasPresent.length,
            dynamicApplicationSchemaCount: schemaState.dynamicApplicationSchemas.length,
            dynamicMetahubSchemaCount: schemaState.dynamicMetahubSchemas.length,
            projectOwnedSchemaCount: schemaState.ownedSchemas.length,
            authUserCount: authUsers.length
        },
        localArtifacts
    }
}

function buildSchemaDropOrder(schemaState) {
    const fixedWithoutCatalog = schemaState.fixedProjectSchemasPresent.filter((schemaName) => schemaName !== 'upl_migrations')
    const migrationCatalogSchemas = schemaState.fixedProjectSchemasPresent.filter((schemaName) => schemaName === 'upl_migrations')

    return [
        ...schemaState.dynamicApplicationSchemas,
        ...schemaState.dynamicMetahubSchemas,
        ...fixedWithoutCatalog,
        ...migrationCatalogSchemas
    ]
}

export function hasProjectOwnedResidue(inspection) {
    return (
        Number(inspection?.counts?.projectOwnedSchemaCount || 0) > 0 ||
        Number(inspection?.counts?.authUserCount || 0) > 0 ||
        Boolean(inspection?.localArtifacts?.manifestExists) ||
        Boolean(inspection?.localArtifacts?.storageStateExists)
    )
}

export async function inspectE2eProjectState({ sampleAuthUsers = 10 } = {}) {
    const env = loadE2eEnvironment()
    if (env.envTarget !== 'e2e') {
        throw new Error(`E2E inspection refused because UNIVERSO_ENV_TARGET=${env.envTarget}. Only the dedicated e2e environment is allowed.`)
    }

    const fixedProjectSchemas = loadFixedProjectSchemaNames()

    return withE2eDatabaseClient(async (client) => {
        await ensureInfrastructureBase(client)

        const [schemaState, authUsers, localArtifacts] = await Promise.all([
            readProjectSchemas(client, fixedProjectSchemas),
            readAuthUsers(client),
            readLocalArtifactsState()
        ])

        return buildInspectionResult({
            fixedProjectSchemas,
            schemaState,
            authUsers,
            localArtifacts,
            inspectedAt: new Date().toISOString(),
            sampleAuthUsers
        })
    })
}

export async function fullResetE2eProject({ dryRun = false, quiet = false, reason = 'manual', allowServerAlive = false } = {}) {
    const env = loadE2eEnvironment()
    if (env.envTarget !== 'e2e') {
        throw new Error(`Full E2E reset refused because UNIVERSO_ENV_TARGET=${env.envTarget}. Only the dedicated e2e environment is allowed.`)
    }

    if (!dryRun && !allowServerAlive && (await isServerReachable(env.baseURL))) {
        throw new Error(`Full E2E reset requires ${env.baseURL} to be stopped. Stop the running app server before performing the destructive reset.`)
    }

    const fixedProjectSchemas = loadFixedProjectSchemaNames()

    return withE2eDatabaseClient(async (client) => {
        return withE2eAdvisoryLock(client, fullResetLockKey, async () => {
            await ensureInfrastructureBase(client)

            const beforeInspectedAt = new Date().toISOString()
            const [beforeSchemaState, beforeAuthUsers, beforeLocalArtifacts] = await Promise.all([
                readProjectSchemas(client, fixedProjectSchemas),
                readAuthUsers(client),
                readLocalArtifactsState()
            ])

            const report = {
                executedAt: beforeInspectedAt,
                reason,
                mode: dryRun ? 'dry-run' : 'apply',
                fixedProjectSchemas,
                droppedSchemas: [],
                deletedAuthUsers: [],
                failures: [],
                before: buildInspectionResult({
                    fixedProjectSchemas,
                    schemaState: beforeSchemaState,
                    authUsers: beforeAuthUsers,
                    localArtifacts: beforeLocalArtifacts,
                    inspectedAt: beforeInspectedAt,
                    sampleAuthUsers: beforeAuthUsers.length
                }),
                after: null
            }

            const schemaDropOrder = buildSchemaDropOrder(beforeSchemaState)

            for (const schemaName of schemaDropOrder) {
                assertSafeProjectOwnedSchemaName(schemaName, fixedProjectSchemas)

                if (dryRun) {
                    report.droppedSchemas.push({ schemaName, status: 'planned' })
                    continue
                }

                try {
                    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schemaName)} CASCADE`)
                    report.droppedSchemas.push({ schemaName, status: 'dropped' })
                } catch (error) {
                    report.droppedSchemas.push({ schemaName, status: 'failed', message: toErrorMessage(error) })
                    report.failures.push({ phase: 'drop-schema', schemaName, message: toErrorMessage(error) })
                }
            }

            for (const authUser of beforeAuthUsers) {
                if (dryRun) {
                    report.deletedAuthUsers.push({ userId: authUser.id, email: authUser.email, status: 'planned' })
                    continue
                }

                try {
                    await deleteSupabaseAuthUser(authUser.id)
                    report.deletedAuthUsers.push({ userId: authUser.id, email: authUser.email, status: 'deleted' })
                } catch (error) {
                    report.deletedAuthUsers.push({
                        userId: authUser.id,
                        email: authUser.email,
                        status: 'failed',
                        message: toErrorMessage(error)
                    })
                    report.failures.push({ phase: 'delete-auth-user', userId: authUser.id, email: authUser.email, message: toErrorMessage(error) })
                }
            }

            if (!dryRun) {
                await Promise.all([removeRunManifest().catch(() => undefined), removeFileIfExists(storageStatePath)])
                await ensureInfrastructureBase(client)
            }

            const afterInspectedAt = new Date().toISOString()
            const [afterSchemaState, afterAuthUsers, afterLocalArtifacts] = await Promise.all([
                readProjectSchemas(client, fixedProjectSchemas),
                readAuthUsers(client),
                readLocalArtifactsState()
            ])

            report.after = buildInspectionResult({
                fixedProjectSchemas,
                schemaState: afterSchemaState,
                authUsers: afterAuthUsers,
                localArtifacts: afterLocalArtifacts,
                inspectedAt: afterInspectedAt,
                sampleAuthUsers: afterAuthUsers.length
            })

            if (!dryRun && hasProjectOwnedResidue(report.after)) {
                report.failures.push({
                    phase: 'post-reset-verification',
                    message: `Residual project state remains after full reset: schemas=${report.after.counts.projectOwnedSchemaCount}, authUsers=${report.after.counts.authUserCount}`
                })
            }

            if (report.failures.length > 0) {
                const error = new Error(
                    `E2E full reset ${dryRun ? 'dry-run ' : ''}reported failures: ${report.failures
                        .map((failure) => failure.phase)
                        .join(', ')}`
                )
                error.report = report
                throw error
            }

            if (!quiet) {
                process.stdout.write(
                    `[e2e-full-reset] ${dryRun ? 'Planned' : 'Completed'} reset for ${reason}: dropped ${report.droppedSchemas.length} schema(s), deleted ${report.deletedAuthUsers.length} auth user(s).\n`
                )
            }

            return report
        })
    })
}