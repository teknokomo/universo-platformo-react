import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const suitePaths = [
    'src/tests/controllers/runtimeInterpretationNetworkController.test.ts',
    'src/tests/controllers/runtimeInterpretationNetworkMatrixController.test.ts',
    'src/tests/controllers/runtimeWorkspaceController.test.ts',
    'src/tests/ddl/applicationWorkspacesSchema.conversion.test.ts',
    'src/tests/shared/runtimeSchemaResolver.test.ts',
    'src/tests/routes/applicationsRoutes.test.ts',
    'src/tests/routes/publicApplicationRuntimeRoutes.test.ts',
    'src/tests/services/applicationWorkspaces.test.ts',
    'src/tests/services/runtimeWorkspaceService.test.ts',
    'src/tests/services/runtimeWorkspaceLifecycleService.test.ts',
    'src/tests/services/publicApplicationRuntime.routing.test.ts',
    'src/tests/services/publicInterpretationNetworkRuntime.test.ts',
    'src/tests/services/runtimeInterpretationNetworkMatrixCreateCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkMatrixMoveCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkMatrixUpdateCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkMatrixMembershipCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkMatrixDeleteCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkAggregateDeleteCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkMaterialCommands.test.ts',
    'src/tests/persistence/workspaceSettingsCopyStore.test.ts',
    'src/tests/persistence/workspaceSettingsResolutionStore.test.ts',
    'src/tests/services/runtimeInterpretationNetworkService.test.ts',
    'src/tests/services/runtimeInterpretationNetworkStructureCommands.test.ts',
    'src/tests/services/runtimeInterpretationNetworkTemplateCommands.test.ts',
    'src/tests/services/runtimeWorkspaceCopyService.test.ts',
    'src/tests/services/runtimeWorkspaceCopyTransaction.test.ts',
    'src/tests/services/workspaceSettingsService.test.ts'
]

const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'universo-interpretation-network-unit-'))
const resultsPath = path.join(outputDirectory, 'jest-results.json')

const exitCode = await new Promise((resolve) => {
    const child = spawn(
        'pnpm',
        [
            '--filter',
            '@universo-react/applications-backend',
            'exec',
            'node',
            '../../tools/testing/backend/run-jest.cjs',
            '--config',
            './jest.config.js',
            '--runInBand',
            '--json',
            `--outputFile=${resultsPath}`,
            ...suitePaths
        ],
        { stdio: 'inherit', shell: process.platform === 'win32', env: process.env }
    )
    child.on('error', (error) => {
        console.error(`Failed to start Interpretation Network unit tests: ${error.message}`)
        resolve(1)
    })
    child.on('close', (code, signal) => {
        if (signal) console.error(`Interpretation Network unit tests stopped with signal ${signal}`)
        resolve(code ?? 1)
    })
})

try {
    if (exitCode !== 0) process.exitCode = exitCode

    let results
    try {
        results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
    } catch {
        throw new Error('Jest did not produce a result file for the required Interpretation Network unit tests')
    }

    const total = Number(results.numTotalTests ?? 0)
    const passed = Number(results.numPassedTests ?? 0)
    const pending = Number(results.numPendingTests ?? 0)
    const failed = Number(results.numFailedTests ?? 0)
    if (total === 0 || passed === 0 || pending > 0 || failed > 0 || results.success !== true) {
        throw new Error(
            `Required Interpretation Network unit tests did not fully pass (total=${total}, passed=${passed}, pending=${pending}, failed=${failed})`
        )
    }
    for (const suitePath of suitePaths) {
        const suiteResult = (results.testResults ?? []).find((result) => String(result.name ?? '').endsWith(suitePath))
        const assertions = Array.isArray(suiteResult?.assertionResults) ? suiteResult.assertionResults : []
        if (assertions.length === 0 || assertions.some((assertion) => assertion.status !== 'passed')) {
            throw new Error(`Required Interpretation Network unit suite did not pass without skipped tests: ${suitePath}`)
        }
    }
    console.log(`Interpretation Network backend unit tests passed: ${passed} tests, 0 skipped.`)
} catch (error) {
    process.exitCode = 1
    console.error(error instanceof Error ? error.message : String(error))
} finally {
    fs.rmSync(outputDirectory, { recursive: true, force: true })
}
