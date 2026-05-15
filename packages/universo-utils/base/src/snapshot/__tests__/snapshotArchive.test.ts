import { describe, it, expect } from 'vitest'
import { computeSnapshotHash, buildSnapshotEnvelope, validateSnapshotEnvelope } from '../snapshotArchive'
import type { MetahubSnapshotTransportEnvelope } from '@universo/types'
import { SNAPSHOT_BUNDLE_CONSTRAINTS } from '@universo/types'

const createCodenameVlc = (primary: string, secondary?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: primary, version: 1, isActive: true },
        ...(secondary ? { ru: { content: secondary, version: 1, isActive: true } } : {})
    }
})

function makeMinimalSnapshot(): MetahubSnapshotTransportEnvelope['snapshot'] {
    return {
        version: '1.0.0',
        metahubId: '00000000-0000-0000-0000-000000000001',
        entities: {
            'ent-1': {
                id: 'ent-1',
                kind: 'object',
                codename: createCodenameVlc('test_object', 'тестовый_каталог'),
                fields: []
            }
        },
        elements: {},
        optionValues: {},
        constants: {},
        systemFields: {},
        layouts: [],
        layoutZoneWidgets: [],
        defaultLayoutId: null,
        layoutConfig: {}
    }
}

function makeSnapshotWithExtendedSections(): Record<string, unknown> {
    return {
        ...makeMinimalSnapshot(),
        scripts: [
            {
                id: 'script-1',
                codename: createCodenameVlc('quiz_script', 'скрипт_викторины'),
                presentation: { name: { en: 'Quiz Script' } },
                attachedToKind: 'metahub',
                attachedToId: null,
                moduleRole: 'shared',
                sourceKind: 'embedded',
                sdkApiVersion: '1.0.0',
                sourceCode: 'export const value = 1',
                manifest: {
                    className: 'QuizModule',
                    sdkApiVersion: '1.0.0',
                    moduleRole: 'shared',
                    sourceKind: 'embedded',
                    capabilities: ['rpc.server', 'rpc.client'],
                    methods: [{ name: 'publish', target: 'server' }],
                    checksum: 'manifest-1'
                },
                serverBundle: 'server-bundle-1',
                clientBundle: 'client-bundle-1',
                checksum: 'checksum-1',
                isActive: true,
                config: { scope: 'global' }
            }
        ],
        layouts: [
            {
                id: 'layout-1',
                templateKey: 'dashboard',
                name: { en: 'Default Layout' },
                description: null,
                config: { sections: ['hero'] },
                isDefault: true,
                isActive: true,
                sortOrder: 1
            }
        ],
        layoutZoneWidgets: [
            {
                id: 'widget-1',
                layoutId: 'layout-1',
                zone: 'main',
                widgetKey: 'hero',
                sortOrder: 1,
                config: { title: 'Hero' },
                isActive: true
            }
        ],
        scopedLayouts: [
            {
                id: 'entity-layout-1',
                scopeEntityId: 'ent-1',
                baseLayoutId: 'layout-1',
                templateKey: 'dashboard',
                name: { en: 'Object Layout' },
                description: null,
                config: { searchMode: 'advanced' },
                isDefault: true,
                isActive: true,
                sortOrder: 1
            }
        ],
        layoutWidgetOverrides: [
            {
                id: 'override-1',
                layoutId: 'entity-layout-1',
                baseWidgetId: 'widget-1',
                zone: 'aside',
                sortOrder: 3,
                config: null,
                isActive: true,
                isDeletedOverride: false
            }
        ]
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

    it('produces different hashes when scripts change', () => {
        const snap1 = makeSnapshotWithExtendedSections()
        const snap2 = makeSnapshotWithExtendedSections()

        ;((snap2.scripts as Array<Record<string, unknown>>)[0] as Record<string, unknown>).sourceCode = 'export const value = 2'

        expect(computeSnapshotHash(snap1)).not.toBe(computeSnapshotHash(snap2))
    })

    it('produces different hashes when scoped layouts change', () => {
        const snap1 = makeSnapshotWithExtendedSections()
        const snap2 = makeSnapshotWithExtendedSections()

        ;((snap2.scopedLayouts as Array<Record<string, unknown>>)[0] as Record<string, unknown>).config = { searchMode: 'simple' }

        expect(computeSnapshotHash(snap1)).not.toBe(computeSnapshotHash(snap2))
    })

    it('produces different hashes when object widget overrides change', () => {
        const snap1 = makeSnapshotWithExtendedSections()
        const snap2 = makeSnapshotWithExtendedSections()

        ;((snap2.layoutWidgetOverrides as Array<Record<string, unknown>>)[0] as Record<string, unknown>).sortOrder = 4

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

    it('rejects tampered scripts in extended snapshot sections', () => {
        const snapshot = makeSnapshotWithExtendedSections()
        const envelope = buildSnapshotEnvelope({
            snapshot: snapshot as MetahubSnapshotTransportEnvelope['snapshot'],
            metahub: {
                id: '00000000-0000-0000-0000-000000000002',
                name: { en: 'Test Metahub' },
                codename: { en: 'test-metahub' }
            }
        })

        ;(
            ((envelope.snapshot as Record<string, unknown>).scripts as Array<Record<string, unknown>>)[0] as Record<string, unknown>
        ).checksum = 'checksum-2'

        expect(() => validateSnapshotEnvelope(envelope)).toThrow('hash mismatch')
    })

    it('rejects tampered object overlay sections', () => {
        const snapshot = makeSnapshotWithExtendedSections()
        const envelope = buildSnapshotEnvelope({
            snapshot: snapshot as MetahubSnapshotTransportEnvelope['snapshot'],
            metahub: {
                id: '00000000-0000-0000-0000-000000000002',
                name: { en: 'Test Metahub' },
                codename: { en: 'test-metahub' }
            }
        })

        ;(
            ((envelope.snapshot as Record<string, unknown>).layoutWidgetOverrides as Array<Record<string, unknown>>)[0] as Record<
                string,
                unknown
            >
        ).zone = 'footer'

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
            entities[`ent-${i}`] = { id: `ent-${i}`, kind: 'object', codename: `c${i}`, fields: [] }
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
            kind: 'object',
            codename: 'test_object',
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
