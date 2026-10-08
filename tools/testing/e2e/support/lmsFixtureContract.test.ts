import assert from 'node:assert/strict'
import test from 'node:test'
import { assertLmsDashboardFixtureContract } from './lmsDashboardFixtureContract.ts'

test('rejects retired widget config.cards and datasource locators', () => {
    const errors: string[] = []
    const readRecord = (value: unknown): Record<string, unknown> | null =>
        value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

    assertLmsDashboardFixtureContract({
        envelope: {
            snapshot: {
                layoutZoneWidgets: [
                    {
                        widgetKey: 'detailsTable',
                        config: {
                            cards: [{ source: 'legacy' }],
                            nested: { datasource: { objectCodename: 'CourseItems' } }
                        }
                    }
                ]
            }
        },
        entityByCodename: new Map(),
        modules: [],
        errors,
        readRecord,
        readWidgetConfig: (value) => readRecord(value) ?? {},
        readLocalizedText: (value) => (typeof value === 'string' ? value : undefined),
        assertLocalizedFixtureValue: () => undefined
    })

    assert.ok(errors.some((error) => error.includes('retired config.cards')))
    assert.ok(errors.some((error) => error.includes('retired config.nested.datasource')))
})
