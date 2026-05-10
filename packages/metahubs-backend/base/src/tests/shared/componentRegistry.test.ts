import { COMPONENT_REGISTRY, getEnabledComponents } from '../../domains/shared/componentRegistry'

describe('componentRegistry', () => {
    it('maps the new ECAE action and event storage seams', () => {
        expect(COMPONENT_REGISTRY.actions.tables).toEqual(['_mhb_actions'])
        expect(COMPONENT_REGISTRY.events.tables).toEqual(['_mhb_event_bindings'])
        expect(COMPONENT_REGISTRY.events.dependencies).toEqual(['actions'])
        expect(COMPONENT_REGISTRY.ledgerSchema.supportedKinds).toBeNull()
    })

    it('collects only enabled components from a manifest', () => {
        const enabled = getEnabledComponents({
            dataSchema: { enabled: true },
            records: { enabled: true },
            treeAssignment: false,
            optionValues: false,
            fixedValues: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: { enabled: true },
            events: false,
            scripting: false,
            blockContent: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: false,
            identityFields: false,
            recordLifecycle: false,
            posting: false,
            ledgerSchema: false
        })

        expect(enabled).toEqual(['dataSchema', 'records', 'actions'])
    })
})
