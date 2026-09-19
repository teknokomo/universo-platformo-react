/**
 * Applies the registered platform migrations to the local E2E Supabase database
 * before real-PostgreSQL integration suites run. The E2E runner resets schemas
 * after a browser run, so suites that rely on the `applications` schema must
 * re-create it deterministically instead of depending on a previously started
 * backend process.
 */
import { loadLocalSupabaseDatabaseUrl } from './localSupabaseEnv.mjs'

const { envFile } = loadLocalSupabaseDatabaseUrl()

for (const key of ['DATABASE_USER', 'DATABASE_PASSWORD', 'DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME']) {
    const value = process.env[key]?.trim() || envFile.get(key)?.trim() || ''
    if (value.length > 0 || key === 'DATABASE_PASSWORD') {
        process.env[key] = value
    }
}

const { getKnex, destroyKnex } = await import('@universo-react/database')
const {
    bootstrapRegisteredSystemAppStructureMetadata,
    ensureRegisteredSystemAppSchemaGenerationPlans,
    runRegisteredPlatformPostSchemaMigrations,
    runRegisteredPlatformPreludeMigrations
} = await import('@universo-react/migrations-platform')

const knex = getKnex()
try {
    // Mirror the backend bootstrap order so the schema state matches a started
    // application even after the E2E runner dropped every schema.
    const prelude = await runRegisteredPlatformPreludeMigrations(knex)
    const schemas = await ensureRegisteredSystemAppSchemaGenerationPlans(knex, { stage: 'target' })
    const postSchema = await runRegisteredPlatformPostSchemaMigrations(knex)
    const structure = await bootstrapRegisteredSystemAppStructureMetadata(knex, { stage: 'target' })
    console.log(
        `[ensure-platform-migrations] prelude ${prelude.applied.length}, schemas ${schemas.applied?.length ?? 0}, post-schema ${
            postSchema.applied.length
        }, structure ${structure.applied?.length ?? 0}`
    )
} finally {
    await destroyKnex()
}
