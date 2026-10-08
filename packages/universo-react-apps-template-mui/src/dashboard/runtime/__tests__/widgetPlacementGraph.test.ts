import { describe, expect, it } from 'vitest'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'
import { childrenForSlot, rootPlacements, runtimePlacementGraphSchema, runtimeWidgetDataSchema } from '../widgetPlacementGraph'

const root = {
    id: '018f0000-0000-7000-8000-000000000001',
    instanceKey: 'overview-columns',
    widgetKey: 'columnsContainer',
    zone: 'center' as const,
    sortOrder: 0,
    config: { columns: [{ slotKey: 'column:primary', width: 6 }] },
    isActive: true,
    parentInstanceKey: null,
    slotKey: null
}

const child = {
    id: '018f0000-0000-7000-8000-000000000002',
    instanceKey: 'records-table',
    widgetKey: 'detailsTable',
    zone: 'center' as const,
    sortOrder: 2,
    config: {},
    isActive: true,
    parentInstanceKey: 'overview-columns',
    slotKey: 'column:primary'
}

describe('Dashboard runtime placement graph', () => {
    it('uses strict registry config contracts and rejects embedded child definitions', () => {
        expect(dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse(root.config).success).toBe(true)
        expect(
            dashboardWidgetConfigSchemaByKey.columnsContainer.safeParse({
                columns: [{ slotKey: 'column:primary', width: 6, widgets: [{ widgetKey: 'detailsTable' }] }]
            }).success
        ).toBe(false)
    })

    it('validates children through the registry container slot and child capabilities', () => {
        expect(runtimePlacementGraphSchema.safeParse([root, child]).success).toBe(true)
        expect(runtimePlacementGraphSchema.safeParse([{ ...child, slotKey: 'column:unknown' }, root]).success).toBe(false)
        expect(runtimePlacementGraphSchema.safeParse([{ ...child, parentInstanceKey: 'missing-parent' }, root]).success).toBe(false)
        const nestedContainer = {
            ...child,
            id: '018f0000-0000-7000-8000-000000000003',
            instanceKey: 'nested-columns',
            widgetKey: 'columnsContainer',
            config: { columns: [{ slotKey: 'column:nested', width: 12 }] },
            parentInstanceKey: 'overview-columns',
            slotKey: 'column:primary'
        }
        expect(
            runtimePlacementGraphSchema.safeParse([
                root,
                nestedContainer,
                { ...child, instanceKey: 'nested-table', parentInstanceKey: 'nested-columns', slotKey: 'column:nested' }
            ]).success
        ).toBe(false)
        expect(
            runtimePlacementGraphSchema.safeParse([
                { ...root, parentInstanceKey: 'nested-columns', slotKey: 'column:nested' },
                nestedContainer,
                child
            ]).success
        ).toBe(false)
    })

    it('rejects duplicate placement instance keys', () => {
        expect(runtimePlacementGraphSchema.safeParse([root, child, { ...child, id: '018f0000-0000-7000-8000-000000000003' }]).success).toBe(
            false
        )
    })

    it('rejects a placement that parents itself', () => {
        const result = runtimePlacementGraphSchema.safeParse([{ ...root, parentInstanceKey: root.instanceKey, slotKey: 'column:primary' }])
        expect(result.success).toBe(false)
        expect(result.success ? [] : result.error.issues.map(({ message }) => message)).toContain('Placement graph cannot contain cycles.')
    })

    it('rejects root and child placements with mismatched parent-slot pairs', () => {
        expect(runtimePlacementGraphSchema.safeParse([{ ...root, slotKey: 'column:primary' }]).success).toBe(false)
        expect(runtimePlacementGraphSchema.safeParse([{ ...child, parentInstanceKey: null }]).success).toBe(false)
    })

    it('rejects placement ids that are not UUID v7', () => {
        expect(runtimePlacementGraphSchema.safeParse([{ ...root, id: '550e8400-e29b-41d4-a716-446655440000' }]).success).toBe(false)
    })

    it('orders semantic children by placement order and excludes them from the root composition', () => {
        const parsed = runtimePlacementGraphSchema.parse([child, root])
        expect(rootPlacements(parsed, 'center').map((placement) => placement.instanceKey)).toEqual(['overview-columns'])
        expect(childrenForSlot(parsed, 'overview-columns', 'column:primary').map((placement) => placement.instanceKey)).toEqual([
            'records-table'
        ])
    })

    it('renders at most one singleton widget across root zones and keeps repeatable placements', () => {
        const parsed = runtimePlacementGraphSchema.parse([
            {
                ...root,
                id: '018f0000-0000-7000-8000-000000000003',
                instanceKey: 'language-in-sidebar',
                widgetKey: 'languageSwitcher',
                zone: 'left',
                sortOrder: 0,
                config: {}
            },
            {
                ...root,
                id: '018f0000-0000-7000-8000-000000000004',
                instanceKey: 'language-in-header',
                widgetKey: 'languageSwitcher',
                zone: 'top',
                sortOrder: 10,
                config: {}
            },
            {
                ...root,
                id: '018f0000-0000-7000-8000-000000000005',
                instanceKey: 'theme-in-center',
                widgetKey: 'colorModeSwitcher',
                zone: 'center',
                sortOrder: 0,
                config: {}
            },
            {
                ...root,
                id: '018f0000-0000-7000-8000-000000000006',
                instanceKey: 'theme-in-header',
                widgetKey: 'colorModeSwitcher',
                zone: 'top',
                sortOrder: 11,
                config: {}
            },
            {
                ...root,
                id: '018f0000-0000-7000-8000-000000000007',
                instanceKey: 'first-menu',
                widgetKey: 'menuWidget',
                zone: 'left',
                sortOrder: 1,
                config: { variant: 'generated' }
            },
            {
                ...root,
                id: '018f0000-0000-7000-8000-000000000008',
                instanceKey: 'second-menu',
                widgetKey: 'menuWidget',
                zone: 'left',
                sortOrder: 2,
                config: { variant: 'generated' }
            }
        ])

        expect(rootPlacements(parsed, 'top').map((placement) => placement.instanceKey)).toEqual(['language-in-header', 'theme-in-header'])
        expect(rootPlacements(parsed, 'center').map((placement) => placement.instanceKey)).toEqual([])
        expect(rootPlacements(parsed, 'left').map((placement) => placement.instanceKey)).toEqual(['first-menu', 'second-menu'])
    })

    it('does not render a root placement in a zone rejected by its widget definition', () => {
        const parsed = runtimePlacementGraphSchema.parse([
            {
                ...root,
                widgetKey: 'languageSwitcher',
                zone: 'center',
                config: {}
            }
        ])

        expect(rootPlacements(parsed, 'center')).toEqual([])
    })

    it('keeps missing-source, stale, permission, malformed, network and empty states distinct', () => {
        const states = [
            'optional-unbound',
            'required-missing',
            'stale-source',
            'permission-denied',
            'malformed-config',
            'network-error',
            'server-error',
            'loading',
            'empty'
        ] as const
        expect(states.map((status) => runtimeWidgetDataSchema.parse({ status }).status)).toEqual(states)
    })

    it('accepts only bounded, strictly shaped runtime table and metric DTOs', () => {
        expect(
            runtimeWidgetDataSchema.safeParse({
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [{ key: 'title', label: 'Title' }],
                    rows: [{ key: 'row-1', cells: [{ key: 'title', value: 'Example' }] }]
                }
            }).success
        ).toBe(true)
        expect(
            runtimeWidgetDataSchema.safeParse({
                status: 'ready',
                data: {
                    kind: 'table',
                    columns: [{ key: 'title', label: 'Title' }],
                    rows: [{ key: 'row-1', cells: [{ key: 'secret', value: 'raw' }] }]
                }
            }).success
        ).toBe(false)
        expect(runtimeWidgetDataSchema.safeParse({ status: 'ready', data: { kind: 'metrics', cards: [], rows: [] } }).success).toBe(false)
    })
})
