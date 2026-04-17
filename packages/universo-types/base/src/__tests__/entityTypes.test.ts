import { describe, expect, it } from 'vitest'

import {
    MetaEntityKind,
    BuiltinEntityKinds,
    getEnabledComponentKeys,
    isBuiltinEntityKind,
    validateComponentDependencies,
    type ComponentManifest,
    type MetahubSnapshotFormatVersion
} from '../index'

describe('entity type contracts', () => {
    it('recognizes only the promoted entity metadata kinds', () => {
        expect(isBuiltinEntityKind(MetaEntityKind.CATALOG)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.SET)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.ENUMERATION)).toBe(true)
        expect(isBuiltinEntityKind(MetaEntityKind.HUB)).toBe(true)
        expect(isBuiltinEntityKind('custom_registry')).toBe(false)
        expect(Object.values(BuiltinEntityKinds)).toEqual(['catalog', 'set', 'enumeration', 'hub'])
        expect(Object.values(BuiltinEntityKinds)).not.toContain('document')
    })

    it('widens metahub snapshot format version to v3', () => {
        const version: MetahubSnapshotFormatVersion = 3

        expect(version).toBe(3)
    })

    it('reports missing component dependencies and lists enabled manifest keys', () => {
        const manifest: ComponentManifest = {
            dataSchema: { enabled: true },
            records: { enabled: true },
            treeAssignment: false,
            optionValues: false,
            constants: false,
            hierarchy: false,
            nestedCollections: false,
            relations: false,
            actions: { enabled: true },
            events: { enabled: true },
            scripting: false,
            layoutConfig: false,
            runtimeBehavior: false,
            physicalTable: false
        }

        expect(validateComponentDependencies(manifest)).toEqual([])
        expect(getEnabledComponentKeys(manifest)).toEqual(expect.arrayContaining(['dataSchema', 'records', 'actions', 'events']))
    })
})
