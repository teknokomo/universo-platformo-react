import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { marketingWidgetUnitGateCommands, runMarketingWidgetUnitGate } from './runMarketingWidgetUnitGate.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const requiredMarketingWidgetRegressionTests = [
    ['@universo-react/metahubs-frontend', 'src/domains/layouts/ui/__tests__/MarketingWidgetBindingDialogView.test.tsx'],
    ['@universo-react/metahubs-frontend', 'src/domains/layouts/ui/__tests__/useLayoutWidgetAuthoring.test.tsx'],
    ['@universo-react/metahubs-frontend', 'src/i18n/__tests__/index.test.ts'],
    ['@universo-react/metahubs-backend', 'src/tests/services/marketingWidgetRecordDuplicate.test.ts'],
    ['@universo-react/metahubs-backend', 'src/tests/services/copyMetahubLayout.test.ts'],
    ['@universo-react/metahubs-backend', 'src/tests/services/recordCopy.test.ts'],
    ['@universo-react/core-frontend', 'src/__tests__/AbilityContextProvider.permissionsRace.test.tsx'],
    ['@universo-react/schema-ddl', 'src/__tests__/SchemaMigrator.test.ts'],
    ['@universo-react/applications-backend', 'src/tests/services/syncDataLoader.test.ts']
]

test('runs gate commands in order and stops at the first failed command', async () => {
    const received = []
    const exitCode = await runMarketingWidgetUnitGate(
        [
            ['pnpm', ['first']],
            ['pnpm', ['second']],
            ['pnpm', ['third']]
        ],
        async (executable, args) => {
            received.push([executable, args])
            return received.length === 2 ? 7 : 0
        }
    )

    assert.equal(exitCode, 7)
    assert.deepEqual(received, [
        ['pnpm', ['first']],
        ['pnpm', ['second']]
    ])
})

test('returns success after every gate command passes', async () => {
    const exitCode = await runMarketingWidgetUnitGate(
        [
            ['node', ['one']],
            ['node', ['two']]
        ],
        async () => 0
    )
    assert.equal(exitCode, 0)
})

test('every registered unit gate test path exists in its workspace package', () => {
    const registeredTestPaths = []

    for (const [executable, args] of marketingWidgetUnitGateCommands) {
        const packageFilterIndex = args.indexOf('--filter')
        const packageName = packageFilterIndex >= 0 ? args[packageFilterIndex + 1] : undefined
        const packageDirectory = packageName ? packageName.replace('@universo-react/', 'universo-react-') : ''
        const workingDirectory = packageDirectory ? resolve(repositoryRoot, 'packages', packageDirectory) : repositoryRoot

        for (const path of args.filter((entry) => /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u.test(entry))) {
            registeredTestPaths.push({ executable, path })
            assert.ok(existsSync(resolve(workingDirectory, path)), `${executable} gate references missing test file: ${path}`)
        }
    }

    assert.ok(registeredTestPaths.length > 0)
})

test('the focused unit gate includes all critical Marketing widget regressions', () => {
    const registeredTestPaths = new Set()

    for (const [, args] of marketingWidgetUnitGateCommands) {
        const packageFilterIndex = args.indexOf('--filter')
        const packageName = packageFilterIndex >= 0 ? args[packageFilterIndex + 1] : undefined
        if (!packageName) continue

        for (const path of args.filter((entry) => /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/u.test(entry))) {
            registeredTestPaths.add(`${packageName}:${path}`)
        }
    }

    for (const [packageName, path] of requiredMarketingWidgetRegressionTests) {
        assert.ok(registeredTestPaths.has(`${packageName}:${path}`), `Marketing widget unit gate omits ${packageName}:${path}`)
    }
})

test('the focused unit gate includes the shared dialog runtime contract tests', () => {
    assert.ok(
        marketingWidgetUnitGateCommands.some(
            ([executable, args]) =>
                executable === 'pnpm' && args.includes('@universo-react/template-mui') && args.includes('StandardDialog')
        )
    )
    assert.ok(
        marketingWidgetUnitGateCommands.some(
            ([executable, args]) =>
                executable === 'pnpm' && args.includes('@universo-react/template-mui') && args.includes('dynamicEntityFormValidation')
        )
    )
})
