import { ComponentDefinitionDataType } from '@universo-react/types'
import { isUuidV7 } from '@universo-react/utils'
import type { PublishedApplicationRuntimeSource, PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import {
    normalizePublishedApplicationRuntimeSnapshot,
    normalizePublishedApplicationRuntimeSource
} from '../../services/publishedApplicationRuntimeSnapshot'

const createSnapshot = (): PublishedApplicationSnapshot =>
    ({
        entities: {
            'enumeration-first': {
                id: 'enumeration-first',
                kind: 'enumeration',
                codename: 'firstStatus',
                fields: []
            },
            'enumeration-second': {
                id: 'enumeration-second',
                kind: 'enumeration',
                codename: 'secondStatus',
                fields: []
            },
            'object-first': {
                id: 'object-first',
                kind: 'object',
                codename: 'firstRecord',
                fields: [
                    {
                        id: 'shared-status-field',
                        codename: 'status',
                        dataType: ComponentDefinitionDataType.REF,
                        targetEntityId: 'enumeration-first',
                        targetEntityKind: 'enumeration'
                    }
                ]
            },
            'object-second': {
                id: 'object-second',
                kind: 'object',
                codename: 'secondRecord',
                fields: [
                    {
                        id: 'shared-status-field',
                        codename: 'status',
                        dataType: ComponentDefinitionDataType.REF,
                        targetEntityId: 'enumeration-second',
                        targetEntityKind: 'enumeration'
                    }
                ]
            }
        },
        optionValues: {
            'enumeration-first': [{ id: 'shared-status-value', codename: 'draft' }],
            'enumeration-second': [{ id: 'shared-status-value', codename: 'draft' }]
        },
        elements: {
            'object-first': [{ id: 'first-row', data: { status: 'shared-status-value' } }],
            'object-second': [{ id: 'second-row', data: { status: 'shared-status-value' } }]
        }
    } as unknown as PublishedApplicationSnapshot)

const createSource = (snapshot: PublishedApplicationSnapshot): PublishedApplicationRuntimeSource => ({
    publicationId: 'publication-identity-remediation',
    publicationVersionId: 'publication-version-identity-remediation',
    snapshotHash: 'raw-source-snapshot-hash',
    snapshot,
    entities: [],
    publicationSnapshot: {}
})

describe('published application runtime snapshot identity normalization', () => {
    it('uses UUID v7 for duplicate enumeration values and fields and rewrites references', () => {
        const normalized = normalizePublishedApplicationRuntimeSnapshot(createSnapshot())
        const firstValueId = normalized.optionValues?.['enumeration-first']?.[0]?.id
        const secondValueId = normalized.optionValues?.['enumeration-second']?.[0]?.id
        const firstFieldId = normalized.entities['object-first']?.fields[0]?.id
        const secondFieldId = normalized.entities['object-second']?.fields[0]?.id

        expect(firstValueId).toEqual(expect.any(String))
        expect(secondValueId).toEqual(expect.any(String))
        expect(firstValueId).not.toBe(secondValueId)
        expect(isUuidV7(firstValueId)).toBe(true)
        expect(isUuidV7(secondValueId)).toBe(true)
        expect(isUuidV7(firstFieldId)).toBe(true)
        expect(isUuidV7(secondFieldId)).toBe(true)
        expect(normalized.elements?.['object-first']?.[0]).toMatchObject({
            data: { status: firstValueId }
        })
        expect(normalized.elements?.['object-second']?.[0]).toMatchObject({
            data: { status: secondValueId }
        })
    })

    it('keeps same-source resync physical identities stable across fresh source objects', () => {
        const first = normalizePublishedApplicationRuntimeSource(createSource(createSnapshot()))
        const second = normalizePublishedApplicationRuntimeSource(createSource(createSnapshot()))

        expect(second.snapshot).toEqual(first.snapshot)
        expect(second.snapshotHash).toBe(first.snapshotHash)
        expect(second.entities).toEqual(first.entities)
    })

    it('does not allocate again after a snapshot has already been normalized', () => {
        const normalized = normalizePublishedApplicationRuntimeSnapshot(createSnapshot())

        expect(normalizePublishedApplicationRuntimeSnapshot(normalized)).toBe(normalized)
    })
})
