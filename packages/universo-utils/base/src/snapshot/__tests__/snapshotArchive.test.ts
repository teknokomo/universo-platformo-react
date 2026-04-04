import { describe, it, expect } from 'vitest'
import { computeSnapshotHash, buildSnapshotEnvelope, validateSnapshotEnvelope } from '../snapshotArchive'
import type { MetahubSnapshotTransportEnvelope } from '@universo/types'
import { SNAPSHOT_BUNDLE_CONSTRAINTS } from '@universo/types'

function makeMinimalSnapshot(): MetahubSnapshotTransportEnvelope['snapshot'] {
    return {
        version: '1.0.0',
        metahubId: '00000000-0000-0000-0000-000000000001',
        entities: {
            'ent-1': {
                id: 'ent-1',
                kind: 'catalog',
                codename: 'test_catalog',
                fields: []
            }
        },
        elements: {},
        enumerationValues: {},
        constants: {},
        systemFields: {},
        layouts: [],
        layoutZoneWidgets: [],
        defaultLayoutId: null,
        layoutConfig: {}
    }
}

function makeMinimalEnvelope(): MetahubSnapshotTransportEnvelope {
    const snapshot = makeMinimalSnapshot()
    return buildSnapshotEnvelope({
        snapshot,
        metahub: {
            id: '00000000-0000-0000-0000-000000000002',
            name: { en: 'Test Metahub' },
            codename: { en: 'test-metahub' }
        },
        publication: {
            id: '00000000-0000-0000-0000-000000000003',
            name: { en: 'Test Publication' },
            versionId: '00000000-0000-0000-0000-000000000004',
            versionNumber: 1
        }
    })
}

describe('computeSnapshotHash', () => {
    it('returns a 64-char hex SHA-256 hash', () => {
        const hash = computeSnapshotHash(makeMinimalSnapshot())
        expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('produces deterministic hashes for identical snapshots', () => {
        const snap = makeMinimalSnapshot()
        const hash1 = computeSnapshotHash(snap)
        const hash2 = computeSnapshotHash(snap)
        expect(hash1).toBe(hash2)
    })

    it('produces different hashes for different snapshots', () => {
        const snap1 = makeMinimalSnapshot()
        const snap2 = { ...makeMinimalSnapshot(), version: '2.0.0' }
        expect(computeSnapshotHash(snap1)).not.toBe(computeSnapshotHash(snap2))
    })
})

describe('buildSnapshotEnvelope', () => {
    it('creates a valid envelope with correct fields', () => {
        const envelope = makeMinimalEnvelope()
        expect(envelope.kind).toBe('metahub_snapshot_bundle')
        expect(envelope.bundleVersion).toBe(1)
        expect(envelope.exportedAt).toBeTruthy()
        expect(envelope.snapshotHash).toMatch(/^[a-f0-9]{64}$/)
        expect(envelope.metahub.id).toBe('00000000-0000-0000-0000-000000000002')
        expect(envelope.publication?.versionNumber).toBe(1)
    })

    it('envelope hash matches recomputed hash', () => {
        const envelope = makeMinimalEnvelope()
        const recomputedHash = computeSnapshotHash(envelope.snapshot)
        expect(envelope.snapshotHash).toBe(recomputedHash)
    })
})

describe('validateSnapshotEnvelope', () => {
    it('accepts a valid envelope', () => {
        const envelope = makeMinimalEnvelope()
        const result = validateSnapshotEnvelope(envelope)
        expect(result.kind).toBe('metahub_snapshot_bundle')
        expect(result.metahub.id).toBe('00000000-0000-0000-0000-000000000002')
    })

    it('rejects non-object input', () => {
        expect(() => validateSnapshotEnvelope('not an object')).toThrow('Expected a JSON object')
        expect(() => validateSnapshotEnvelope(null)).toThrow('Expected a JSON object')
        expect(() => validateSnapshotEnvelope(42)).toThrow('Expected a JSON object')
    })

    it('rejects tampered hash', () => {
        const envelope = makeMinimalEnvelope()
        envelope.snapshotHash = 'a'.repeat(64)
        expect(() => validateSnapshotEnvelope(envelope)).toThrow('hash mismatch')
    })

    it('rejects missing required snapshot fields', () => {
        const envelope = makeMinimalEnvelope() as Record<string, unknown>
        envelope.snapshot = { someField: 'no version or metahubId' }
        expect(() => validateSnapshotEnvelope(envelope)).toThrow()
    })

    it('rejects too many entities', () => {
        const snapshot = makeMinimalSnapshot()
        const entities: Record<string, unknown> = {}
        for (let i = 0; i < SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ENTITIES + 1; i++) {
            entities[`ent-${i}`] = { id: `ent-${i}`, kind: 'catalog', codename: `c${i}`, fields: [] }
        }
        snapshot.entities = entities

        const envelope = buildSnapshotEnvelope({
            snapshot,
            metahub: {
                id: '00000000-0000-0000-0000-000000000002',
                name: { en: 'Test' },
                codename: { en: 'test' }
            }
        })
        expect(() => validateSnapshotEnvelope(envelope)).toThrow('Too many entities')
    })

    it('rejects entity with too many fields', () => {
        const snapshot = makeMinimalSnapshot()
        const fields = Array.from({ length: SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_FIELDS_PER_ENTITY + 1 }, (_, i) => ({
            id: `field-${i}`,
            codename: `f${i}`,
            type: 'text'
        }))
        ;(snapshot.entities as Record<string, unknown>)['ent-1'] = {
            id: 'ent-1',
            kind: 'catalog',
            codename: 'test_catalog',
            fields
        }

        const envelope = buildSnapshotEnvelope({
            snapshot,
            metahub: {
                id: '00000000-0000-0000-0000-000000000002',
                name: { en: 'Test' },
                codename: { en: 'test' }
            }
        })
        expect(() => validateSnapshotEnvelope(envelope)).toThrow('too many fields')
    })

    it('rejects entity with too many elements', () => {
        const snapshot = makeMinimalSnapshot()
        const elements = Array.from({ length: SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_ELEMENTS_PER_ENTITY + 1 }, (_, i) => ({
            id: `elem-${i}`,
            data: {}
        }))
        ;(snapshot as Record<string, unknown>).elements = { 'ent-1': elements }

        const envelope = buildSnapshotEnvelope({
            snapshot,
            metahub: {
                id: '00000000-0000-0000-0000-000000000002',
                name: { en: 'Test' },
                codename: { en: 'test' }
            }
        })
        expect(() => validateSnapshotEnvelope(envelope)).toThrow('too many elements')
    })

    it('strips prototype pollution keys', () => {
        const envelope = makeMinimalEnvelope()
        const pollutedLayoutConfig: Record<string, unknown> = {
            safe: true,
            constructor: { polluted: true }
        }

        Object.defineProperty(pollutedLayoutConfig, '__proto__', {
            value: { polluted: true },
            enumerable: true,
            configurable: true
        })

        envelope.snapshot.layoutConfig = pollutedLayoutConfig
        envelope.snapshotHash = computeSnapshotHash({
            ...envelope.snapshot,
            layoutConfig: { safe: true }
        } as Record<string, unknown>)

        const result = validateSnapshotEnvelope(envelope)
        const sanitizedLayoutConfig = result.snapshot.layoutConfig as Record<string, unknown>

        expect(sanitizedLayoutConfig.safe).toBe(true)
        expect(Object.prototype.hasOwnProperty.call(sanitizedLayoutConfig, 'constructor')).toBe(false)
        expect(Object.prototype.hasOwnProperty.call(sanitizedLayoutConfig, '__proto__')).toBe(false)
    })

    it('rejects deeply nested JSON', () => {
        let deep: Record<string, unknown> = { leaf: true }
        for (let i = 0; i < SNAPSHOT_BUNDLE_CONSTRAINTS.MAX_JSON_NESTING_DEPTH + 5; i++) {
            deep = { nested: deep }
        }
        const envelope = { ...makeMinimalEnvelope(), extraDeep: deep }
        expect(() => validateSnapshotEnvelope(envelope)).toThrow('nesting depth exceeds')
    })

    it('accepts envelope without publication (direct metahub export)', () => {
        const snapshot = makeMinimalSnapshot()
        const envelope = buildSnapshotEnvelope({
            snapshot,
            metahub: {
                id: '00000000-0000-0000-0000-000000000002',
                name: { en: 'Test' },
                codename: { en: 'test' }
            }
        })
        const result = validateSnapshotEnvelope(envelope)
        expect(result.publication).toBeUndefined()
    })
})
