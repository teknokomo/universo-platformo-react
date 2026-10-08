import { describe, expect, it } from 'vitest'
import { getLayoutWidgetDefinition, type ApplicationLayout, type ApplicationLayoutWidget } from '@universo-react/types'
import { canEditSourcePresentation, canUpdateSourcePresentation, getWidgetDropIndex } from '../applicationLayoutSupport'

const currentConfig = {
    structureMode: 'multiple',
    matrixMode: 'hierarchicalCells',
    allowedMatrixViews: ['table'],
    defaultMatrixView: 'table',
    splitPane: { enabled: false },
    moduleCodename: 'interpretation-network'
}

const layout = {
    templateKey: 'dashboard',
    sourceKind: 'metahub',
    syncState: 'clean',
    isSourceExcluded: false
} as ApplicationLayout

const widget = {
    id: '018f0000-0000-7000-8000-000000000001',
    layoutId: '018f0000-0000-7000-8000-000000000002',
    zone: 'center',
    widgetKey: 'interpretationNetworkWorkspace',
    instanceKey: 'interpretation-main',
    parentWidgetId: null,
    slotKey: null,
    sortOrder: 0,
    config: currentConfig,
    sourceConfig: currentConfig,
    sourceWidgetId: '018f0000-0000-7000-8000-000000000003',
    sourceBaseWidgetId: null,
    isCustomized: false,
    isActive: true,
    version: 1
} as ApplicationLayoutWidget

const definitions = [getLayoutWidgetDefinition(widget.widgetKey, widget.config)!]

describe('application layout source presentation policy', () => {
    it('recognizes specialized registry-owned presentation fields without generic editor fields', () => {
        expect(definitions[0]?.presentationFields).toHaveLength(0)
        expect(canEditSourcePresentation(layout, widget, definitions)).toBe(true)
    })

    it('allows a specialized presentation change while preserving unchanged runtime-owned fields', () => {
        expect(
            canUpdateSourcePresentation(
                layout,
                widget,
                {
                    ...currentConfig,
                    splitPane: { enabled: true }
                },
                definitions
            )
        ).toBe(true)
    })

    it('rejects changes to registry fields owned by the specialized runtime', () => {
        expect(
            canUpdateSourcePresentation(
                layout,
                widget,
                {
                    ...currentConfig,
                    moduleCodename: 'untrusted-module'
                },
                definitions
            )
        ).toBe(false)
    })
})

describe('application layout semantic header placement', () => {
    const headerWidget = (id: string, widgetKey: ApplicationLayoutWidget['widgetKey'], sortOrder: number, placement: 'start' | 'end') =>
        ({
            id,
            layoutId: '018f0000-0000-7000-8000-000000000010',
            zone: 'marketing-header',
            widgetKey,
            instanceKey: id,
            parentWidgetId: null,
            slotKey: null,
            sortOrder,
            config: {},
            placement,
            sourceConfig: {},
            sourceWidgetId: null,
            sourceBaseWidgetId: null,
            isCustomized: false,
            isActive: true,
            version: 1
        } as ApplicationLayoutWidget)

    it('preserves physical order when a widget crosses from End to Start', () => {
        const widgets = [
            headerWidget('brand', 'marketing.brand', 1, 'start'),
            headerWidget('auth', 'marketing.auth', 2, 'end'),
            headerWidget('language', 'languageSwitcher', 3, 'end'),
            headerWidget('color', 'colorModeSwitcher', 4, 'end'),
            headerWidget('navigation', 'marketing.navigation', 5, 'end')
        ]

        expect(getWidgetDropIndex(widgets, 'navigation', 'start')).toBe(4)
    })

    it('preserves physical order when a widget crosses from Start to End', () => {
        const widgets = [
            headerWidget('brand', 'marketing.brand', 1, 'start'),
            headerWidget('navigation', 'marketing.navigation', 2, 'start'),
            headerWidget('auth', 'marketing.auth', 3, 'end'),
            headerWidget('language', 'languageSwitcher', 4, 'end'),
            headerWidget('color', 'colorModeSwitcher', 5, 'end')
        ]

        expect(getWidgetDropIndex(widgets, 'navigation', 'end')).toBe(1)
    })

    it('keeps the existing group-relative drop behavior inside one semantic placement', () => {
        const widgets = [
            headerWidget('brand', 'marketing.brand', 1, 'start'),
            headerWidget('navigation', 'marketing.navigation', 2, 'start'),
            headerWidget('auth', 'marketing.auth', 3, 'end')
        ]

        expect(getWidgetDropIndex(widgets, 'navigation', 'start')).toBe(1)
    })
})
