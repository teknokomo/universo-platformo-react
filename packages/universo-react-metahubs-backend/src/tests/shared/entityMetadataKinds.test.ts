import { BuiltinEntityKinds, TEMPLATE_MANAGED_ENTITY_TYPE_CONFIG_KEY, type ResolvedEntityType } from '@universo-react/types'
import {
    isEntityMetadataEntityType,
    resolveEntityMetadataKindFromType,
    resolveEntityMetadataKinds,
    resolveRequestedEntityMetadataKind,
    resolveStoredEntityMetadataKind
} from '../../domains/shared/entityMetadataKinds'

const objectLikeCapabilities: ResolvedEntityType['capabilities'] = {
    dataSchema: { enabled: true },
    records: { enabled: true },
    treeAssignment: { enabled: true },
    optionValues: false,
    fixedValues: false,
    hierarchy: { enabled: true },
    nestedCollections: { enabled: true },
    relations: { enabled: true },
    actions: { enabled: true },
    events: { enabled: true },
    modules: { enabled: true },
    blockContent: false,
    layoutConfig: { enabled: true },
    runtimeBehavior: { enabled: true },
    physicalTable: { enabled: true, prefix: 'doc' },
    identityFields: { enabled: true },
    recordLifecycle: { enabled: true },
    posting: { enabled: true },
    ledgerSchema: false
}

const buildType = (patch: Partial<ResolvedEntityType>): ResolvedEntityType => ({
    kindKey: 'document',
    capabilities: objectLikeCapabilities,
    ui: {
        iconName: 'IconFile',
        tabs: ['general'],
        sidebarSection: 'objects',
        nameKey: 'Document'
    },
    config: {
        [TEMPLATE_MANAGED_ENTITY_TYPE_CONFIG_KEY]: {
            managed: true,
            presetCodename: 'one-c-document',
            source: 'entity_type_preset'
        }
    },
    ...patch
})

describe('entity metadata kind compatibility', () => {
    it('maps template-managed object-like preset kinds to the generic object metadata surface', () => {
        const documentType = buildType({ kindKey: 'document' })

        expect(resolveEntityMetadataKindFromType(documentType)).toBe(BuiltinEntityKinds.OBJECT)
        expect(isEntityMetadataEntityType(documentType, BuiltinEntityKinds.OBJECT)).toBe(true)
    })

    it('does not map unmanaged custom object-like types to standard metadata surfaces', () => {
        const unmanagedType = buildType({
            kindKey: 'custom-document',
            config: {}
        })

        expect(resolveEntityMetadataKindFromType(unmanagedType)).toBeNull()
        expect(isEntityMetadataEntityType(unmanagedType, BuiltinEntityKinds.OBJECT)).toBe(false)
    })

    it('does not map user-created types that spoof template-managed metadata', () => {
        const spoofedType = buildType({
            kindKey: 'custom-document'
        })

        expect(resolveEntityMetadataKindFromType(spoofedType)).toBeNull()
        expect(isEntityMetadataEntityType(spoofedType, BuiltinEntityKinds.OBJECT)).toBe(false)
    })

    it('resolves compatible template-managed kinds through entity type services', async () => {
        const documentType = buildType({ kindKey: 'document' })
        const catalogType = buildType({ kindKey: 'catalog' })
        const unmanagedType = buildType({ kindKey: 'custom-document', config: {} })
        const service = {
            listEditableTypes: jest.fn(async () => [documentType, catalogType, unmanagedType]),
            resolveType: jest.fn(async (_metahubId: string, kindKey: string) => {
                return [documentType, catalogType, unmanagedType].find((type) => type.kindKey === kindKey) ?? null
            })
        }

        await expect(resolveEntityMetadataKinds(service, 'metahub-1', BuiltinEntityKinds.OBJECT, 'user-1')).resolves.toEqual([
            'document',
            'catalog'
        ])
        await expect(
            resolveRequestedEntityMetadataKind(service, 'metahub-1', BuiltinEntityKinds.OBJECT, 'document', 'user-1')
        ).resolves.toBe('document')
        await expect(resolveStoredEntityMetadataKind(service, 'metahub-1', 'catalog', 'user-1')).resolves.toBe(BuiltinEntityKinds.OBJECT)
        await expect(
            resolveRequestedEntityMetadataKind(service, 'metahub-1', BuiltinEntityKinds.OBJECT, 'custom-document', 'user-1')
        ).rejects.toThrow('Requested kindKey is not compatible with the expected entity metadata surface')
    })
})
