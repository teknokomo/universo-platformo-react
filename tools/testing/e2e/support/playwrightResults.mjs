import { existsSync, readFileSync } from 'node:fs'
import { PNG } from 'pngjs'

export const readPngAttachmentDimensions = (attachment) => {
    let bytes
    if (typeof attachment.body === 'string') {
        bytes = Buffer.from(attachment.body, 'base64')
    } else if (Buffer.isBuffer(attachment.body)) {
        bytes = attachment.body
    } else if (typeof attachment.path === 'string' && existsSync(attachment.path)) {
        bytes = readFileSync(attachment.path)
    } else {
        return null
    }

    try {
        const image = PNG.sync.read(bytes)
        return image.width > 0 && image.height > 0 ? { width: image.width, height: image.height } : null
    } catch {
        return null
    }
}

export const expectedScreenshotDimensions = (name) => {
    const encodedViewport = name.match(/(?:^|-)(\d{3,4})x(\d{3,4})$/u)
    if (encodedViewport) return { width: Number(encodedViewport[1]), height: Number(encodedViewport[2]) }
    if (/(?:^|-)wide-desktop(?:-|$)/u.test(name)) return { width: 1920, height: 1080 }
    if (/(?:^|-)tablet(?:-|$)/u.test(name)) return { width: 768, height: 1024 }
    if (/(?:^|-)mobile(?:-|$)/u.test(name)) return { width: 390, height: 844 }
    if (/(?:^|-)desktop(?:-|$)/u.test(name)) return { width: 1280, height: 900 }
    return null
}

export const collectPlaywrightTests = (suites, pathParts = []) => {
    const collected = []
    for (const suite of suites ?? []) {
        const nextPath = suite.title ? [...pathParts, suite.title] : pathParts
        for (const spec of suite.specs ?? []) {
            for (const test of spec.tests ?? []) {
                collected.push({
                    title: [...nextPath, spec.title].filter(Boolean).join(' > '),
                    projectName: test.projectName ?? test.projectId ?? 'unknown',
                    expectedStatus: test.expectedStatus ?? 'unknown',
                    annotations: test.annotations ?? [],
                    results: test.results ?? []
                })
            }
        }
        collected.push(...collectPlaywrightTests(suite.suites, nextPath))
    }
    return collected
}

export const assertPlaywrightScenarioGate = (suites, { projectName, requiredTitles, requiredScreenshotAttachments = {} }) => {
    if (!projectName) throw new Error('A Playwright project name is required')
    if (!Array.isArray(requiredTitles) || requiredTitles.some((title) => typeof title !== 'string' || !title)) {
        throw new Error('Playwright required titles must be a non-empty-title array')
    }
    if (new Set(requiredTitles).size !== requiredTitles.length) {
        throw new Error('Playwright required titles must be unique')
    }
    if (
        !requiredScreenshotAttachments ||
        typeof requiredScreenshotAttachments !== 'object' ||
        Array.isArray(requiredScreenshotAttachments)
    ) {
        throw new Error('Playwright required screenshot attachments must be a title-to-name map')
    }
    for (const [title, names] of Object.entries(requiredScreenshotAttachments)) {
        if (!requiredTitles.includes(title)) {
            throw new Error(`Playwright screenshot requirements must reference a required test title: "${title}"`)
        }
        if (!Array.isArray(names) || names.length === 0 || names.some((name) => typeof name !== 'string' || !name.trim())) {
            throw new Error(`Playwright screenshot requirements for "${title}" must contain non-empty attachment names`)
        }
        if (new Set(names).size !== names.length) {
            throw new Error(`Playwright screenshot requirements for "${title}" must use unique attachment names`)
        }
    }

    const allTests = collectPlaywrightTests(suites)
    const projectTests = allTests.filter((test) => test.projectName === projectName)
    const failures = []

    for (const title of requiredTitles) {
        const matches = projectTests.filter((test) => test.title === title)
        if (matches.length !== 1) {
            failures.push(`expected exactly one ${projectName} test titled "${title}", found ${matches.length}`)
            continue
        }

        const [test] = matches
        const attemptStatuses = test.results.map((result) => result.status)
        if (test.expectedStatus !== 'passed' || attemptStatuses.length === 0 || attemptStatuses.some((status) => status !== 'passed')) {
            failures.push(
                `expected "${title}" to have expected status passed and only passing attempts; found expected=${
                    test.expectedStatus
                }, attempts=${attemptStatuses.join(',') || 'none'}`
            )
        }

        const screenshotAttachments = test.results.flatMap((result) => result.attachments ?? [])
        for (const name of requiredScreenshotAttachments[title] ?? []) {
            const screenshot = screenshotAttachments.find(
                (attachment) => attachment.name === name && attachment.contentType === 'image/png'
            )
            if (!screenshot) {
                failures.push(`expected "${title}" to attach required PNG screenshot "${name}"`)
            } else {
                const dimensions = readPngAttachmentDimensions(screenshot)
                if (!dimensions) {
                    failures.push(`expected "${title}" to attach a decodable PNG screenshot "${name}"`)
                    continue
                }
                const expectedDimensions = expectedScreenshotDimensions(name)
                if (
                    expectedDimensions &&
                    (dimensions.width !== expectedDimensions.width || dimensions.height < expectedDimensions.height)
                ) {
                    failures.push(
                        `expected "${title}" screenshot "${name}" to have viewport width ${expectedDimensions.width}px and height at least ${expectedDimensions.height}px, found ${dimensions.width}x${dimensions.height}`
                    )
                }
            }
        }
    }

    const skippedOrUnrun = allTests.filter(
        (test) =>
            test.expectedStatus === 'skipped' || test.results.length === 0 || test.results.some((result) => result.status === 'skipped')
    )
    for (const test of skippedOrUnrun) {
        failures.push(`unexpected skipped or unrun ${test.projectName} test "${test.title}"`)
    }

    if (failures.length > 0) {
        throw new Error(`Playwright ${projectName} scenario gate failed:\n- ${failures.join('\n- ')}`)
    }

    return { projectName, passedRequiredScenarios: requiredTitles.length, skippedOrUnrun: 0 }
}
