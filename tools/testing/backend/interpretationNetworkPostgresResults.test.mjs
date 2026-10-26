import assert from 'node:assert/strict'
import test from 'node:test'
import {
    createSafeInterpretationNetworkPostgresEvidence,
    inspectInterpretationNetworkPostgresResults
} from './interpretationNetworkPostgresResults.mjs'

const suitePaths = [
    'src/tests/persistence/first.integration.test.ts',
    'src/tests/persistence/publicInterpretationNetworkRuntimeStore.integration.test.ts'
]

const suiteResult = (name, statuses) => ({
    name: `/workspace/packages/universo-react-applications-backend/${name}`,
    status: statuses.every((status) => status === 'passed') ? 'passed' : 'failed',
    assertionResults: statuses.map((status) => ({ status }))
})

const jestResults = (testResults, counts = {}) => ({
    success: true,
    numTotalTests: counts.total ?? testResults.reduce((sum, suite) => sum + suite.assertionResults.length, 0),
    numPassedTests:
        counts.passed ?? testResults.flatMap((suite) => suite.assertionResults).filter(({ status }) => status === 'passed').length,
    numPendingTests:
        counts.pending ??
        testResults.flatMap((suite) => suite.assertionResults).filter(({ status }) => status === 'pending' || status === 'todo').length,
    numFailedTests:
        counts.failed ?? testResults.flatMap((suite) => suite.assertionResults).filter(({ status }) => status === 'failed').length,
    testResults
})

test('accepts a successful run only when every required PostgreSQL suite has non-skipped cases', () => {
    const results = jestResults([suiteResult(suitePaths[0], ['passed']), suiteResult(suitePaths[1], ['passed', 'passed'])])

    assert.deepEqual(inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 0 }), {
        totalCases: 3,
        passedCases: 3,
        skippedCases: 0,
        failedCases: 0,
        ok: true,
        errors: []
    })
})

test('rejects an apparently successful Jest result that executed zero cases', () => {
    const results = jestResults([suiteResult(suitePaths[0], []), suiteResult(suitePaths[1], [])])
    const validation = inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 0 })

    assert.equal(validation.ok, false)
    assert.equal(validation.passedCases, 0)
    assert.ok(validation.errors.some((message) => message.includes('zero non-skipped')))
    assert.ok(validation.errors.some((message) => message.includes('ran no cases')))
})

test('rejects pending or skipped PostgreSQL cases even when another case passes', () => {
    const testResults = [suiteResult(suitePaths[0], ['passed']), suiteResult(suitePaths[1], ['pending'])]
    const results = jestResults(testResults, { total: 2, passed: 1, pending: 1, failed: 0 })
    results.success = false
    const validation = inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 1 })

    assert.equal(validation.ok, false)
    assert.equal(validation.passedCases, 1)
    assert.equal(validation.skippedCases, 1)
    assert.ok(validation.errors.some((message) => message.includes('skipped or pending')))
    assert.ok(validation.errors.some((message) => message.includes('contains skipped cases')))
})

test('rejects a run that passes other PostgreSQL suites but omits the public runtime store suite', () => {
    const results = jestResults([suiteResult(suitePaths[0], ['passed'])])
    const validation = inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 0 })

    assert.equal(validation.ok, false)
    assert.ok(validation.errors.some((message) => message.includes(suitePaths[1])))
})

test('rejects unknown assertion statuses and summary mismatches', () => {
    const results = jestResults([suiteResult(suitePaths[0], ['passed']), suiteResult(suitePaths[1], ['disabled'])])
    results.numPassedTests += 1
    const validation = inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 0 })

    assert.equal(validation.ok, false)
    assert.ok(validation.errors.some((message) => message.includes('unrecognized case statuses')))
    assert.ok(validation.errors.some((message) => message.includes('summary does not match')))
})

test('rejects missing, duplicated, failed, or runtime-error suite results', () => {
    const results = jestResults([
        suiteResult(suitePaths[0], ['passed']),
        { ...suiteResult(suitePaths[1], ['passed']), testExecError: { message: 'runtime failure' } },
        suiteResult(suitePaths[1], ['passed'])
    ])
    const validation = inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 0 })

    assert.equal(validation.ok, false)
    assert.ok(validation.errors.some((message) => message.includes('more than once')))
    assert.ok(validation.errors.some((message) => message.includes('did not pass')))
})

test('fails closed when the Jest process exits unsuccessfully', () => {
    const results = jestResults([suiteResult(suitePaths[0], ['passed']), suiteResult(suitePaths[1], ['passed'])])

    assert.equal(inspectInterpretationNetworkPostgresResults({ results, suitePaths, exitCode: 1 }).ok, false)
})

test('keeps only allowlisted suite outcome metadata in persisted PostgreSQL evidence', () => {
    const rawResults = jestResults([
        {
            ...suiteResult(suitePaths[0], ['failed']),
            message: 'postgres://db-user:secret@127.0.0.1:5432/app failed',
            failureMessage: 'DATABASE_TEST_URL=postgres://db-user:secret@127.0.0.1:5432/app',
            assertionResults: [
                {
                    status: 'failed',
                    title: 'writes a record',
                    failureMessages: ['DATABASE_TEST_URL=postgres://db-user:secret@127.0.0.1:5432/app']
                }
            ],
            testExecError: { message: 'secret runtime detail' }
        },
        suiteResult(suitePaths[1], ['passed'])
    ])
    const evidence = createSafeInterpretationNetworkPostgresEvidence({ results: rawResults, suitePaths })
    const serialized = JSON.stringify(evidence)

    assert.equal(evidence.testResults[0].hasRuntimeError, true)
    assert.deepEqual(evidence.testResults[0].assertionResults, [{ status: 'failed' }])
    assert.equal(evidence.testResults[0].name, suitePaths[0])
    assert.equal(serialized.includes('secret'), false)
    assert.equal(serialized.includes('DATABASE_TEST_URL'), false)
    assert.equal(serialized.includes('postgres://'), false)
    assert.equal(serialized.includes('writes a record'), false)
})
