const normalizePath = (value) => String(value ?? '').replaceAll('\\', '/')

const readCount = (results, key, errors) => {
    const value = results?.[key]
    if (!Number.isSafeInteger(value) || value < 0) {
        errors.push(`Jest reported an invalid ${key} count`)
        return 0
    }
    return value
}

const safeCount = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : null)

const safeAssertionStatus = (status) =>
    status === 'passed' || status === 'failed' || status === 'pending' || status === 'todo' ? status : 'unknown'

/** Persist only static suite identifiers and outcome metadata, never Jest failure text or runtime payloads. */
export const createSafeInterpretationNetworkPostgresEvidence = ({ results, suitePaths }) => {
    const expectedSuites = Array.isArray(suitePaths) ? suitePaths : []
    const testResults = Array.isArray(results?.testResults) ? results.testResults : []

    return {
        success: results?.success === true,
        numTotalTests: safeCount(results?.numTotalTests),
        numPassedTests: safeCount(results?.numPassedTests),
        numPendingTests: safeCount(results?.numPendingTests),
        numFailedTests: safeCount(results?.numFailedTests),
        testResults: expectedSuites.map((suitePath) => {
            const normalizedPath = normalizePath(suitePath)
            const matches = testResults.filter((suite) => normalizePath(suite?.name).endsWith(normalizedPath))
            const suite = matches[0]
            const assertions = Array.isArray(suite?.assertionResults) ? suite.assertionResults : []

            return {
                name: suitePath,
                status: ['passed', 'failed', 'pending', 'running'].includes(suite?.status) ? suite.status : 'unknown',
                assertionResults: assertions.map((assertion) => ({ status: safeAssertionStatus(assertion?.status) })),
                hasRuntimeError: Boolean(suite?.testExecError),
                duplicateResults: matches.length > 1
            }
        })
    }
}

/** Validate Jest's machine-readable evidence for the required PostgreSQL suites. */
export const inspectInterpretationNetworkPostgresResults = ({ results, suitePaths, exitCode }) => {
    const errors = []
    const expectedSuites = Array.isArray(suitePaths) ? suitePaths : []
    if (expectedSuites.length === 0) errors.push('No required PostgreSQL integration suites were configured')
    if (new Set(expectedSuites).size !== expectedSuites.length) errors.push('Required PostgreSQL suite paths contain duplicates')

    const total = readCount(results, 'numTotalTests', errors)
    const passed = readCount(results, 'numPassedTests', errors)
    const pending = readCount(results, 'numPendingTests', errors)
    const failed = readCount(results, 'numFailedTests', errors)
    if (exitCode !== 0) errors.push(`Jest exited with status ${exitCode ?? 'unknown'}`)
    if (results?.success !== true) errors.push('Jest did not report a successful run')
    if (total === 0 || passed === 0) errors.push('Jest ran zero non-skipped PostgreSQL integration cases')
    if (pending > 0) errors.push(`Jest reported ${pending} skipped or pending PostgreSQL integration cases`)
    if (failed > 0) errors.push(`Jest reported ${failed} failed PostgreSQL integration cases`)

    const testResults = Array.isArray(results?.testResults) ? results.testResults : []
    const summary = { totalCases: 0, passedCases: 0, skippedCases: 0, failedCases: 0 }

    for (const suitePath of expectedSuites) {
        const normalizedPath = normalizePath(suitePath)
        const matches = testResults.filter((suite) => normalizePath(suite?.name).endsWith(normalizedPath))
        if (matches.length === 0) {
            errors.push(`Required PostgreSQL integration suite is missing: ${suitePath}`)
            continue
        }
        if (matches.length > 1) errors.push(`Required PostgreSQL integration suite was reported more than once: ${suitePath}`)

        const suite = matches[0]
        const assertions = Array.isArray(suite?.assertionResults) ? suite.assertionResults : []
        const counts = { passed: 0, skipped: 0, failed: 0, invalid: 0 }
        for (const assertion of assertions) {
            if (assertion?.status === 'passed') counts.passed += 1
            else if (assertion?.status === 'pending' || assertion?.status === 'todo') counts.skipped += 1
            else if (assertion?.status === 'failed') counts.failed += 1
            else counts.invalid += 1
        }

        summary.totalCases += assertions.length
        summary.passedCases += counts.passed
        summary.skippedCases += counts.skipped
        summary.failedCases += counts.failed

        if (suite?.status !== 'passed' || suite?.testExecError) {
            errors.push(`Required PostgreSQL integration suite did not pass: ${suitePath}`)
        }
        if (assertions.length === 0) errors.push(`Required PostgreSQL integration suite ran no cases: ${suitePath}`)
        if (counts.passed === 0) errors.push(`Required PostgreSQL integration suite has no passing cases: ${suitePath}`)
        if (counts.skipped > 0) errors.push(`Required PostgreSQL integration suite contains skipped cases: ${suitePath}`)
        if (counts.failed > 0) errors.push(`Required PostgreSQL integration suite contains failed cases: ${suitePath}`)
        if (counts.invalid > 0) errors.push(`Required PostgreSQL integration suite contains unrecognized case statuses: ${suitePath}`)
    }

    if (
        summary.passedCases !== passed ||
        summary.totalCases !== total ||
        summary.skippedCases !== pending ||
        summary.failedCases !== failed
    ) {
        errors.push(
            `Jest summary does not match required suite results ` +
                `(summary total=${total}, passed=${passed}, skipped=${pending}, failed=${failed}; ` +
                `suites total=${summary.totalCases}, passed=${summary.passedCases}, skipped=${summary.skippedCases}, failed=${summary.failedCases})`
        )
    }

    return { ...summary, ok: errors.length === 0, errors }
}
