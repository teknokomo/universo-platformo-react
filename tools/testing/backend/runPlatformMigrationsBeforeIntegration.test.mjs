import assert from 'node:assert/strict'
import test from 'node:test'
import { runPlatformMigrationsBeforeIntegration } from './runPlatformMigrationsBeforeIntegration.mjs'

const databaseUrl = 'postgres://e2e-test'

test('runs the DDL integration test only after platform migrations complete', async () => {
    const calls = []

    await runPlatformMigrationsBeforeIntegration({
        databaseUrl,
        runMigrations: async (url) => {
            calls.push(['migrations', url])
            return 0
        },
        runIntegration: async (url) => calls.push(['integration', url])
    })

    assert.deepEqual(calls, [
        ['migrations', databaseUrl],
        ['integration', databaseUrl]
    ])
})

test('fails closed and skips DDL integration when platform migrations fail', async () => {
    let integrationCalled = false

    await assert.rejects(
        runPlatformMigrationsBeforeIntegration({
            databaseUrl,
            runMigrations: async () => 1,
            runIntegration: async () => {
                integrationCalled = true
            }
        }),
        /Local platform migrations failed before the widget placement DDL integration test/u
    )
    assert.equal(integrationCalled, false)
})
