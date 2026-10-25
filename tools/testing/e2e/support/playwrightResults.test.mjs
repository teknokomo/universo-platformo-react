import assert from 'node:assert/strict'
import test from 'node:test'
import { PNG } from 'pngjs'

import { assertPlaywrightScenarioGate, collectPlaywrightTests, readPngAttachmentDimensions } from './playwrightResults.mjs'

const createPlaywrightReport = (tests) => [
    {
        title: 'flows/core.spec.ts',
        specs: tests.map(({ title, ...testCase }) => ({
            title,
            tests: [
                {
                    projectName: 'chromium',
                    expectedStatus: 'passed',
                    results: [{ status: 'passed', retry: 0 }],
                    ...testCase
                }
            ]
        }))
    }
]

test('collectPlaywrightTests flattens nested suites and preserves retry evidence', () => {
    const annotations = [{ type: 'slow', description: 'large fixture' }]
    const results = [
        { status: 'failed', retry: 0 },
        { status: 'passed', retry: 1 }
    ]
    const suites = [
        {
            title: 'outer',
            specs: [
                {
                    title: 'public runtime',
                    tests: [
                        {
                            projectName: 'en-light',
                            projectId: 'project-1',
                            expectedStatus: 'passed',
                            annotations,
                            results
                        }
                    ]
                }
            ],
            suites: [
                {
                    title: 'nested',
                    specs: [
                        {
                            title: 'localized validation',
                            tests: [{ projectId: 'ru-light', expectedStatus: 'passed', results: [{ status: 'passed', retry: 0 }] }]
                        }
                    ]
                }
            ]
        }
    ]

    assert.deepEqual(collectPlaywrightTests(suites), [
        {
            title: 'outer > public runtime',
            projectName: 'en-light',
            expectedStatus: 'passed',
            annotations,
            results
        },
        {
            title: 'outer > nested > localized validation',
            projectName: 'ru-light',
            expectedStatus: 'passed',
            annotations: [],
            results: [{ status: 'passed', retry: 0 }]
        }
    ])
})

test('collectPlaywrightTests handles absent suites and applies report defaults', () => {
    assert.deepEqual(collectPlaywrightTests(), [])
    assert.deepEqual(collectPlaywrightTests([{ specs: [{ title: 'unscoped test', tests: [{}] }] }]), [
        {
            title: 'unscoped test',
            projectName: 'unknown',
            expectedStatus: 'unknown',
            annotations: [],
            results: []
        }
    ])
})

test('assertPlaywrightScenarioGate requires an exact title and PASS attempts', () => {
    const report = createPlaywrightReport([{ title: 'required scenario' }, { title: 'required scenario with extra text' }])

    assert.deepEqual(
        assertPlaywrightScenarioGate(report, {
            projectName: 'chromium',
            requiredTitles: ['flows/core.spec.ts > required scenario']
        }),
        { projectName: 'chromium', passedRequiredScenarios: 1, skippedOrUnrun: 0 }
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(report, {
                projectName: 'chromium',
                requiredTitles: ['flows/core.spec.ts > required']
            }),
        /found 0/
    )
})

test('assertPlaywrightScenarioGate requires named PNG evidence for selected UI scenarios', () => {
    const requiredTitle = 'flows/core.spec.ts > required scenario'
    const requiredScreenshotAttachments = {
        [requiredTitle]: ['runtime-mobile-390x844']
    }
    const pngPayload = PNG.sync.write({ width: 390, height: 844, data: Buffer.alloc(390 * 844 * 4) })
    const report = createPlaywrightReport([
        {
            title: 'required scenario',
            results: [
                {
                    status: 'passed',
                    retry: 0,
                    attachments: [{ name: 'runtime-mobile-390x844', contentType: 'image/png', body: pngPayload.toString('base64') }]
                }
            ]
        }
    ])

    assert.deepEqual(
        assertPlaywrightScenarioGate(report, {
            projectName: 'chromium',
            requiredTitles: [requiredTitle],
            requiredScreenshotAttachments
        }),
        { projectName: 'chromium', passedRequiredScenarios: 1, skippedOrUnrun: 0 }
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(createPlaywrightReport([{ title: 'required scenario' }]), {
                projectName: 'chromium',
                requiredTitles: [requiredTitle],
                requiredScreenshotAttachments
            }),
        /required PNG screenshot "runtime-mobile-390x844"/
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(
                createPlaywrightReport([
                    {
                        title: 'required scenario',
                        results: [
                            { status: 'passed', retry: 0, attachments: [{ name: 'runtime-mobile-390x844', contentType: 'image/png' }] }
                        ]
                    }
                ]),
                { projectName: 'chromium', requiredTitles: [requiredTitle], requiredScreenshotAttachments }
            ),
        /decodable PNG screenshot/
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(
                createPlaywrightReport([
                    {
                        title: 'required scenario',
                        results: [
                            {
                                status: 'passed',
                                retry: 0,
                                attachments: [
                                    { name: 'runtime-mobile-390x844', contentType: 'image/png', body: Buffer.alloc(24).toString('base64') }
                                ]
                            }
                        ]
                    }
                ]),
                { projectName: 'chromium', requiredTitles: [requiredTitle], requiredScreenshotAttachments }
            ),
        /decodable PNG screenshot/
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(report, {
                projectName: 'chromium',
                requiredTitles: [requiredTitle],
                requiredScreenshotAttachments: { 'another test': ['runtime-mobile-390x844'] }
            }),
        /must reference a required test title/
    )
})

test('readPngAttachmentDimensions decodes payloads and rejects incorrect viewport dimensions', () => {
    const screenshot = {
        name: 'runtime-mobile-390x844',
        contentType: 'image/png',
        body: PNG.sync.write({ width: 320, height: 240, data: Buffer.alloc(320 * 240 * 4) }).toString('base64')
    }
    assert.deepEqual(readPngAttachmentDimensions(screenshot), { width: 320, height: 240 })

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(
                createPlaywrightReport([
                    {
                        title: 'required scenario',
                        results: [{ status: 'passed', retry: 0, attachments: [screenshot] }]
                    }
                ]),
                {
                    projectName: 'chromium',
                    requiredTitles: ['flows/core.spec.ts > required scenario'],
                    requiredScreenshotAttachments: { 'flows/core.spec.ts > required scenario': ['runtime-mobile-390x844'] }
                }
            ),
        /viewport width 390px and height at least 844px, found 320x240/
    )
})

test('assertPlaywrightScenarioGate rejects missing, skipped, unrun, and flaky scenarios', () => {
    assert.throws(
        () =>
            assertPlaywrightScenarioGate(createPlaywrightReport([{ title: 'required scenario', results: [] }]), {
                projectName: 'chromium',
                requiredTitles: ['flows/core.spec.ts > required scenario']
            }),
        /only passing attempts/
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(
                createPlaywrightReport([
                    { title: 'required scenario' },
                    { title: 'optional scenario', expectedStatus: 'skipped', results: [{ status: 'skipped' }] }
                ]),
                { projectName: 'chromium', requiredTitles: ['flows/core.spec.ts > required scenario'] }
            ),
        /unexpected skipped or unrun chromium test/
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(
                createPlaywrightReport([
                    { title: 'required scenario' },
                    { title: 'auth setup', projectName: 'setup', expectedStatus: 'skipped', results: [{ status: 'skipped' }] }
                ]),
                { projectName: 'chromium', requiredTitles: ['flows/core.spec.ts > required scenario'] }
            ),
        /unexpected skipped or unrun setup test/
    )

    assert.throws(
        () =>
            assertPlaywrightScenarioGate(
                createPlaywrightReport([{ title: 'required scenario', results: [{ status: 'failed' }, { status: 'passed', retry: 1 }] }]),
                { projectName: 'chromium', requiredTitles: ['flows/core.spec.ts > required scenario'] }
            ),
        /only passing attempts/
    )
})
