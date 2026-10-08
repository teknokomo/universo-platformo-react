import {
    decodePlacementWidgetConfigEnvelope,
    resolvePlacementBindingPolicy,
    resolvePlacementRegistryDefinition,
    resolvePlacementBindingValidation,
    validatePlacementGraph,
    type PlacementGraphNode
} from '../../persistence/applicationLayoutWidgetPlacement'

const uuid = (suffix: number) => `019f3100-0000-7000-8000-${String(suffix).padStart(12, '0')}`

const nestedDashboardPlacements = (): PlacementGraphNode[] => {
    const containerId = uuid(1)
    return [
        {
            id: containerId,
            layoutId: 'layout-a',
            instanceKey: 'product-grid',
            parentWidgetId: null,
            slotKey: null,
            templateKey: 'dashboard',
            widgetKey: 'columnsContainer',
            zone: 'center',
            rendererConfig: { columns: [{ slotKey: 'column:main', width: 12 }] }
        },
        {
            id: uuid(2),
            layoutId: 'layout-a',
            instanceKey: 'product-table',
            parentWidgetId: containerId,
            slotKey: 'column:main',
            templateKey: 'dashboard',
            widgetKey: 'detailsTable',
            zone: 'center',
            rendererConfig: {}
        }
    ]
}

describe('application layout widget placement contract', () => {
    it('resolves Dashboard binding policy from the selected widget variant', () => {
        expect(resolvePlacementBindingPolicy('detailsTable', { variant: 'report' })).toEqual({
            sourceMode: 'specialized',
            inheritBindings: false,
            sourceAuthority: 'metahub-source'
        })
        expect(resolvePlacementBindingValidation('detailsTable', { variant: 'report' }, true)).toEqual({
            requireBindings: false,
            rejectBindings: true
        })
        expect(resolvePlacementBindingPolicy('detailsTable', { variant: 'records' }).sourceMode).toBe('required')
    })

    it('rejects missing placement identity and identity inside renderer config', () => {
        const missingIdentity = nestedDashboardPlacements()
        missingIdentity[0]!.instanceKey = undefined as never
        expect(() => validatePlacementGraph(missingIdentity, { resolveRegistryDefinition: resolvePlacementRegistryDefinition })).toThrow()

        expect(() =>
            decodePlacementWidgetConfigEnvelope(
                { instanceKey: 'forged', columns: [{ slotKey: 'column:main', width: 12 }] },
                {
                    templateKey: 'dashboard',
                    widgetKey: 'columnsContainer',
                    zone: 'center',
                    instanceKey: 'product-grid'
                }
            )
        ).toThrow('APPLICATION_LAYOUT_WIDGET_CONFIG_IDENTITY_FORBIDDEN')
    })

    it('uses registry container, slot, and child capability policy for nested placements', () => {
        const nodes = nestedDashboardPlacements()
        expect(() => validatePlacementGraph(nodes, { resolveRegistryDefinition: resolvePlacementRegistryDefinition })).not.toThrow()

        expect(() =>
            validatePlacementGraph(
                nodes.map((node) => (node.widgetKey === 'detailsTable' ? { ...node, slotKey: 'column:missing' } : node)),
                { resolveRegistryDefinition: resolvePlacementRegistryDefinition }
            )
        ).toThrow('APPLICATION_LAYOUT_WIDGET_SLOT_INVALID')

        expect(() =>
            validatePlacementGraph([...nodes, { ...nodes[1]!, id: uuid(3) }], {
                resolveRegistryDefinition: resolvePlacementRegistryDefinition,
                effectiveGraph: true
            })
        ).toThrow('APPLICATION_LAYOUT_WIDGET_DUPLICATE_INSTANCE')
    })

    it('rejects effective parent and child placements in different zones', () => {
        const nodes = nestedDashboardPlacements()
        const crossZoneChild: PlacementGraphNode = {
            ...nodes[1]!,
            id: uuid(3),
            instanceKey: 'left-menu',
            widgetKey: 'menuWidget',
            zone: 'left',
            rendererConfig: {}
        }

        expect(() =>
            validatePlacementGraph([...nodes, crossZoneChild], {
                resolveRegistryDefinition: resolvePlacementRegistryDefinition,
                effectiveGraph: true
            })
        ).toThrow('APPLICATION_LAYOUT_WIDGET_GRAPH_INVALID')
    })
})
