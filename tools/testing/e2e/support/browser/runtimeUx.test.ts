import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Locator, Page } from '@playwright/test'
import {
    expectNoDataGridTechnicalLeakage,
    expectNoTechnicalLeakage,
    isExpectedConflictResourceFailure,
    isExpectedValidationResourceFailure
} from './runtimeUx.ts'

const expectedUrl = 'http://127.0.0.1:3100/api/v1/applications/app-id/layouts/layout-id/zone-widget/widget-id/toggle-active'

describe('browser runtime issue filtering', () => {
    it('allows only an explicitly expected 409 resource error at its exact URL', () => {
        assert.equal(
            isExpectedConflictResourceFailure(
                {
                    source: 'console',
                    text: 'Failed to load resource: the server responded with a status of 409 (Conflict)',
                    url: expectedUrl
                },
                [expectedUrl]
            ),
            true
        )

        assert.equal(
            isExpectedConflictResourceFailure(
                {
                    source: 'console',
                    text: 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
                    url: expectedUrl
                },
                [expectedUrl]
            ),
            false
        )
        assert.equal(
            isExpectedConflictResourceFailure(
                {
                    source: 'console',
                    text: 'Failed to load resource: the server responded with a status of 409 (Conflict)',
                    url: `${expectedUrl}/unexpected`
                },
                [expectedUrl]
            ),
            false
        )
        assert.equal(
            isExpectedConflictResourceFailure({ source: 'pageerror', text: '409 Conflict', url: expectedUrl }, [expectedUrl]),
            false
        )
    })

    it('allows only an explicitly expected 400 validation response at its exact URL', () => {
        const expectedValidationUrl = 'http://127.0.0.1:3100/api/v1/metahub/metahub-id/entities/object/records'
        assert.equal(
            isExpectedValidationResourceFailure(
                {
                    source: 'console',
                    text: 'Failed to load resource: the server responded with a status of 400 (Bad Request)',
                    url: expectedValidationUrl
                },
                [expectedValidationUrl]
            ),
            true
        )
        assert.equal(
            isExpectedValidationResourceFailure(
                {
                    source: 'console',
                    text: 'Failed to load resource: the server responded with a status of 500 (Internal Server Error)',
                    url: expectedValidationUrl
                },
                [expectedValidationUrl]
            ),
            false
        )
        assert.equal(
            isExpectedValidationResourceFailure(
                {
                    source: 'console',
                    text: 'Failed to load resource: the server responded with a status of 400 (Bad Request)',
                    url: `${expectedValidationUrl}/unexpected`
                },
                [expectedValidationUrl]
            ),
            false
        )
        assert.equal(
            isExpectedValidationResourceFailure(
                {
                    source: 'pageerror',
                    text: 'Failed to load resource: the server responded with a status of 400 (Bad Request)',
                    url: expectedValidationUrl
                },
                [expectedValidationUrl]
            ),
            false
        )
    })
})

describe('DataGrid technical leakage checks', () => {
    const createSurface = (
        options: {
            scrollerCount?: number
            failScrollerMeasurement?: boolean
            failScrollerWrite?: boolean
            failGridText?: boolean
            scrollPoints?: number[]
            delayedScrollReads?: number
            onGridTextRead?: (scrollLeft: number) => void
        } = {}
    ) => {
        const page = { evaluate: async () => undefined } as unknown as Page
        let scrollerEvaluationCount = 0
        let pendingScrollLeft = 0
        let scrollReadsAfterWrite = 0
        const scroller = {
            count: async () => options.scrollerCount ?? 1,
            first: () => scroller,
            evaluate: async (_callback: unknown, nextScrollLeft?: unknown) => {
                scrollerEvaluationCount += 1
                if (options.failScrollerMeasurement && scrollerEvaluationCount === 1) {
                    throw new Error('forced DataGrid scroller measurement failure')
                }
                if (options.failScrollerWrite && scrollerEvaluationCount === 2) {
                    throw new Error('forced DataGrid scroll failure')
                }
                if (scrollerEvaluationCount === 1) return options.scrollPoints ?? [0]
                if (typeof nextScrollLeft === 'number') {
                    pendingScrollLeft = nextScrollLeft
                    scrollReadsAfterWrite = 0
                    return undefined
                }
                scrollReadsAfterWrite += 1
                if (pendingScrollLeft > 0 && scrollReadsAfterWrite <= (options.delayedScrollReads ?? 0)) return 0
                return pendingScrollLeft
            }
        } as unknown as Locator
        let gridEvaluationCount = 0
        const grid = {
            evaluate: async () => {
                gridEvaluationCount += 1
                if (gridEvaluationCount === 1) return true
                const isScrollSettled = pendingScrollLeft === 0 || scrollReadsAfterWrite > (options.delayedScrollReads ?? 0)
                options.onGridTextRead?.(pendingScrollLeft)
                if (!isScrollSettled) throw new Error('DataGrid text was read before horizontal scrolling settled')
                if (options.failGridText) throw new Error('forced DataGrid text read failure')
                return ''
            },
            locator: (selector: string) => {
                assert.equal(selector, '.MuiDataGrid-virtualScroller')
                return scroller
            }
        } as unknown as Locator
        const grids = {
            count: async () => 1,
            nth: (index: number) => {
                assert.equal(index, 0)
                return grid
            }
        } as unknown as Locator
        const surface = {
            locator: (selector: string) => {
                assert.equal(selector, '.MuiDataGrid-root')
                return grids
            },
            page: () => page
        } as unknown as Locator

        return surface
    }

    it('fails when a visible DataGrid does not expose a virtual scroller', async () => {
        await assert.rejects(expectNoDataGridTechnicalLeakage(createSurface({ scrollerCount: 0 })))
    })

    it('fails when horizontal scrolling cannot be applied', async () => {
        await assert.rejects(expectNoDataGridTechnicalLeakage(createSurface({ failScrollerWrite: true })), /forced DataGrid scroll failure/)
    })

    it('waits for a DataGrid horizontal scroll position to settle before checking visible cells', async () => {
        const scrollPositionsWhenTextIsRead: number[] = []

        await assert.doesNotReject(
            expectNoDataGridTechnicalLeakage(
                createSurface({
                    scrollPoints: [0, 7, 14],
                    delayedScrollReads: 1,
                    onGridTextRead: (scrollLeft) => scrollPositionsWhenTextIsRead.push(scrollLeft)
                })
            )
        )

        assert.deepEqual(scrollPositionsWhenTextIsRead, [0, 7, 14])
    })

    it('fails when virtual scroller measurements cannot be read', async () => {
        await assert.rejects(
            expectNoDataGridTechnicalLeakage(createSurface({ failScrollerMeasurement: true })),
            /forced DataGrid scroller measurement failure/
        )
    })

    it('fails when visible grid text cannot be read', async () => {
        await assert.rejects(expectNoDataGridTechnicalLeakage(createSurface({ failGridText: true })), /forced DataGrid text read failure/)
    })
})

describe('runtime technical leakage oracle canaries', () => {
    const createTextSurface = (text: string): Locator => ({ evaluate: async () => text } as unknown as Locator)

    it('detects UUIDs embedded in normal user-facing text', async () => {
        await assert.rejects(
            expectNoTechnicalLeakage(createTextSurface('Record 018f0000-0000-7000-8000-000000000001'), {
                checkUuidSubstrings: true
            }),
            /visible raw UUID value/
        )
    })

    it('detects raw JSON and object stringification', async () => {
        for (const text of ['Source {"name":"Revenue"}', 'Source [object Object]']) {
            await assert.rejects(expectNoTechnicalLeakage(createTextSurface(text)), /visible raw JSON\/object text/)
        }
    })

    it('allows ordinary semantic labels', async () => {
        await assert.doesNotReject(expectNoTechnicalLeakage(createTextSurface('Revenue by month')))
    })
})
