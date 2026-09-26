import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Locator, Page } from '@playwright/test'
import { expectNoDataGridTechnicalLeakage, isExpectedConflictResourceFailure } from './runtimeUx.ts'

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
})

describe('DataGrid technical leakage checks', () => {
    const createSurface = (
        options: { scrollerCount?: number; failScrollerMeasurement?: boolean; failScrollerWrite?: boolean; failGridText?: boolean } = {}
    ) => {
        const page = { evaluate: async () => undefined } as unknown as Page
        let scrollerEvaluationCount = 0
        const scroller = {
            count: async () => options.scrollerCount ?? 1,
            first: () => scroller,
            evaluate: async () => {
                scrollerEvaluationCount += 1
                if (options.failScrollerMeasurement && scrollerEvaluationCount === 1) {
                    throw new Error('forced DataGrid scroller measurement failure')
                }
                if (options.failScrollerWrite && scrollerEvaluationCount === 2) {
                    throw new Error('forced DataGrid scroll failure')
                }
                return scrollerEvaluationCount === 1 ? [0] : 0
            }
        } as unknown as Locator
        let gridEvaluationCount = 0
        const grid = {
            evaluate: async () => {
                gridEvaluationCount += 1
                if (gridEvaluationCount === 1) return true
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
