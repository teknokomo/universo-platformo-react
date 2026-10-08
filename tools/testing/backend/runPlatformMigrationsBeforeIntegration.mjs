export async function runPlatformMigrationsBeforeIntegration({ databaseUrl, runMigrations, runIntegration }) {
    const migrationExitCode = await runMigrations(databaseUrl)
    if (migrationExitCode !== 0) {
        throw new Error('Local platform migrations failed before the widget placement DDL integration test')
    }
    await runIntegration(databaseUrl)
}
