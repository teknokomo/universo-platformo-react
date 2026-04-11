import { describe, expect, it } from 'vitest'

import {
    BUILTIN_ENTITY_TYPE_REGISTRY,
    BUILTIN_ENTITY_TYPES,
    MetaEntityKind,
    getEnabledComponentKeys,
    isBuiltinKind,
    validateComponentDependencies,
    type ComponentManifest,
    type MetahubSnapshotFormatVersion
} from '../index'

describe('entity type contracts', () => {
    it('recognizes built-in entity kinds without changing the legacy constants', () => {
        expect(isBuiltinKind(MetaEntityKind.CATALOG)).toBe(true)
        expect(isBuiltinKind(MetaEntityKind.SET)).toBe(true)
        expect(isBuiltinKind('custom_registry')).toBe(false)
    })

    it('reports missing component dependencies', () => {
        const manifest: ComponentManifest = {
            dataSchema: false,
            predefinedElements: { enabled: true },
            hubAssignment: false,
            enumerationValues: false,
            constants: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: false,
            events: false,
            scripting: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: false
        }

        expect(validateComponentDependencies(manifest)).toEqual(['Component "predefinedElements" requires "dataSchema" to be enabled'])
    })

    it('lists enabled components for a manifest', () => {
        const catalogType = BUILTIN_ENTITY_TYPE_REGISTRY.get(MetaEntityKind.CATALOG)

        expect(catalogType).toBeDefined()
        expect(getEnabledComponentKeys(catalogType!.components)).toEqual(
            expect.arrayContaining(['dataSchema', 'predefinedElements', 'hubAssignment', 'actions', 'events'])
        )
    })

    it('keeps all built-in entity definitions dependency-valid', () => {
        for (const definition of BUILTIN_ENTITY_TYPES) {
            expect(validateComponentDependencies(definition.components)).toEqual([])
        }
    })

    it('widens metahub snapshot format version to v3', () => {
        const version: MetahubSnapshotFormatVersion = 3

        expect(version).toBe(3)
    })
})
