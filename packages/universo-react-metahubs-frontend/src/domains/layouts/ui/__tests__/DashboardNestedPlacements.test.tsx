import { fireEvent, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import type { TFunction } from 'i18next'
import { describe, expect, it, vi } from 'vitest'
import { DASHBOARD_LAYOUT_ZONES, getLayoutWidgetDefinition } from '@universo-react/types'
import commonEn from '@universo-react/i18n/locales/en/common.json'
import commonRu from '@universo-react/i18n/locales/ru/common.json'

import type { MetahubLayout, MetahubLayoutZoneWidget } from '../../../../types'
import DashboardNestedPlacements, { countNestedPlacementDescendants } from '../DashboardNestedPlacements'
import type { DashboardNestedPlacementRow } from '../useLayoutAuthoringZones'

const layout: MetahubLayout = {
    id: 'layout-dashboard',
    templateKey: 'dashboard',
    name: { _schema: '1', _primary: 'en', locales: {} },
    config: {},
    isActive: true,
    isDefault: true,
    sortOrder: 0,
    version: 1,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z'
}

const makePlacement = (overrides: Partial<MetahubLayoutZoneWidget> = {}): MetahubLayoutZoneWidget => ({
    id: 'container-id',
    layoutId: layout.id,
    zone: 'center',
    widgetKey: 'columnsContainer',
    instanceKey: 'container-instance',
    parentInstanceKey: null,
    slotKey: null,
    sortOrder: 0,
    config: { columns: [{ slotKey: 'column:main', width: 12 }] },
    isActive: true,
    version: 1,
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
    ...overrides
})

const translate = ((key: string, options?: { number?: number; slot?: string; defaultValue?: string }) => {
    if (key === 'nesting.column') return `Column ${options?.number ?? ''}`.trim()
    if (key === 'nesting.tab') return `Tab ${options?.number ?? ''}`.trim()
    if (key === 'nesting.moveToSlot') return `Move to ${options?.slot ?? ''}`.trim()
    if (key === 'nesting.addChild') return 'Add content'
    if (key === 'nesting.children') return 'Nested content'
    if (key === 'nesting.emptySlot') return 'No content in this section yet.'
    if (key === 'nesting.applicationLocal') return 'Application content'
    if (key === 'nesting.sourceManaged') return 'Managed by the source layout'
    if (key === 'nesting.duplicateSubtree') return 'Duplicate section and its content'
    if (key === 'nesting.moveUp') return 'Move up'
    if (key === 'nesting.moveDown') return 'Move down'
    return options?.defaultValue ?? key
}) as unknown as TFunction

const rowFor = (placement: MetahubLayoutZoneWidget, overrides: Record<string, unknown> = {}) =>
    ({
        id: placement.id,
        label: 'Overview title',
        isActive: true,
        draggable: true,
        moveActions: [],
        ...overrides
    } as DashboardNestedPlacementRow['row'])

const createProps = (
    placements: MetahubLayoutZoneWidget[],
    nestedPlacements: DashboardNestedPlacementRow[],
    locale = 'en',
    tc: TFunction = translate
) => {
    const overviewDefinition = getLayoutWidgetDefinition('overviewTitle')
    if (!overviewDefinition) throw new Error('Dashboard content widget metadata is missing')
    return {
        layout,
        placements,
        nestedPlacements,
        zoneLabels: Object.fromEntries(DASHBOARD_LAYOUT_ZONES.map((zone) => [zone, zone])) as Record<
            (typeof DASHBOARD_LAYOUT_ZONES)[number],
            string
        >,
        canManageLayouts: true,
        locale,
        tc,
        widgetLabelByKey: { overviewTitle: 'Overview title' },
        getWidgetChipLabel: () => 'Columns',
        getAvailableWidgetsForZone: () => [overviewDefinition],
        onAddWidget: vi.fn(),
        onMove: vi.fn()
    }
}

describe('DashboardNestedPlacements', () => {
    it.each([
        {
            locale: 'en',
            childrenLabel: 'Nested content',
            slotLabel: 'Column 1',
            invalidNestingLabel: 'This content cannot be placed in that section.',
            reloadLabel: 'Reload',
            retryLabel: 'Retry',
            cancelLabel: 'Cancel'
        },
        {
            locale: 'ru',
            childrenLabel: 'Вложенное содержимое',
            slotLabel: 'Колонка 1',
            invalidNestingLabel: 'Это содержимое нельзя разместить в выбранном разделе.',
            reloadLabel: 'Обновить',
            retryLabel: 'Повторить',
            cancelLabel: 'Отмена'
        }
    ])(
        'renders top-level nesting labels from the real $locale common resources',
        async ({ locale, childrenLabel, slotLabel, invalidNestingLabel, reloadLabel, retryLabel, cancelLabel }) => {
            const i18n = createInstance()
            await i18n.init({
                lng: locale,
                fallbackLng: false,
                resources: {
                    en: { common: commonEn.common },
                    ru: { common: commonRu.common }
                },
                ns: ['common'],
                defaultNS: 'common',
                interpolation: { escapeValue: false }
            })
            const translate = i18n.getFixedT(locale, 'common') as TFunction
            expect(translate('nesting.invalidNesting')).toBe(invalidNestingLabel)
            expect(translate('nesting.reload')).toBe(reloadLabel)
            expect(translate('nesting.retry')).toBe(retryLabel)
            expect(translate('nesting.cancel')).toBe(cancelLabel)

            const props = createProps([makePlacement()], [], locale, translate)
            render(<DashboardNestedPlacements {...props} />)

            expect(screen.getByRole('region', { name: childrenLabel })).toBeInTheDocument()
            expect(screen.getByRole('heading', { name: childrenLabel })).toBeInTheDocument()
            expect(screen.getByText(slotLabel, { exact: true })).toBeInTheDocument()
            expect(screen.queryByText('nesting.children')).not.toBeInTheDocument()
            expect(screen.queryByText('column:main')).not.toBeInTheDocument()
        }
    )

    it('shows localized slot labels and adds a registry-compatible child with semantic parentage', async () => {
        const container = makePlacement()
        const props = createProps([container], [])
        render(<DashboardNestedPlacements {...props} />)

        expect(screen.getByText('Column 1')).toBeInTheDocument()
        expect(screen.queryByText('column:main')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Add content: Columns · Column 1' }))
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Overview title' }))

        expect(props.onAddWidget).toHaveBeenCalledWith('center', 'overviewTitle', {
            parentInstanceKey: container.instanceKey,
            slotKey: 'column:main'
        })
    })

    it('moves a nested sibling by its slot index and reports complete descendant counts', () => {
        const container = makePlacement()
        const first = makePlacement({
            id: 'first-id',
            widgetKey: 'overviewTitle',
            instanceKey: 'first-instance',
            parentInstanceKey: container.instanceKey,
            slotKey: 'column:main',
            sortOrder: 1,
            config: { align: 'left', level: 'h2' }
        })
        const second = makePlacement({
            id: 'second-id',
            widgetKey: 'overviewTitle',
            instanceKey: 'second-instance',
            parentInstanceKey: container.instanceKey,
            slotKey: 'column:main',
            sortOrder: 2,
            config: { align: 'right', level: 'h3' }
        })
        const grandchild = makePlacement({
            id: 'grandchild-id',
            widgetKey: 'detailsTable',
            instanceKey: 'grandchild-instance',
            parentInstanceKey: first.instanceKey,
            slotKey: 'column:nested',
            sortOrder: 3,
            config: { variant: 'records' }
        })
        const props = createProps(
            [container, first, second, grandchild],
            [
                { placement: first, row: rowFor(first) },
                { placement: second, row: rowFor(second) },
                { placement: grandchild, row: rowFor(grandchild) }
            ]
        )
        render(<DashboardNestedPlacements {...props} />)

        fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0])

        expect(props.onMove).toHaveBeenCalledWith(first, { targetIndex: 1 })
        expect(countNestedPlacementDescendants(container.id, [container, first, second, grandchild])).toBe(3)
        expect(countNestedPlacementDescendants(first.id, [container, first, second, grandchild])).toBe(1)
    })
})
