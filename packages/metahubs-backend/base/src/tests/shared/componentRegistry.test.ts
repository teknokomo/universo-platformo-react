import { CAPABILITY_REGISTRY, getEnabledCapabilities } from '../../domains/shared/capabilityRegistry'

describe('capabilityRegistry', () => {
    it('maps the new ECAE action and event storage seams', () => {
        expect(CAPABILITY_REGISTRY.actions.tables).toEqual(['_mhb_actions'])
        expect(CAPABILITY_REGISTRY.events.tables).toEqual(['_mhb_event_bindings'])
        expect(CAPABILITY_REGISTRY.events.dependencies).toEqual(['actions'])
        expect(CAPABILITY_REGISTRY.ledgerSchema.supportedKinds).toBeNull()
    })

    it('collects only enabled components from a manifest', () => {
        const enabled = getEnabledCapabilities({
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
