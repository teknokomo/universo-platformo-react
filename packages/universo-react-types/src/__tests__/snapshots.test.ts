import { describe, expect, it } from 'vitest'
import { MetahubSnapshotTransportEnvelopeSchema } from '../common/snapshots'

const makeEnvelope = (module?: Record<string, unknown>) => ({
    kind: 'metahub_snapshot_bundle',
    bundleVersion: 1,
    exportedAt: '2026-10-25T00:00:00.000Z',
    metahub: {
        id: '019a1a10-0000-7000-8000-000000000001',
        name: { en: 'Example' },
        codename: { en: 'example' }
    },
    snapshot: {
        version: 1,
        metahubId: '019a1a10-0000-7000-8000-000000000001',
        versionEnvelope: {
            structureVersion: '0.1.0',
            templateVersion: null,
            snapshotFormatVersion: 1
        },
        entities: {},
        ...(module ? { modules: [module] } : {})
    },
    snapshotHash: 'a'.repeat(64)
})

const moduleMetadata = {
    id: '019a1a10-0000-7000-8000-000000000002',
    codename: 'example-module',
    sdkApiVersion: '0.1.0',
    manifest: {
        sdkApiVersion: '0.1.0',
        className: 'ExampleModule',
        capabilities: []
    },
    sourceCode: 'export default class ExampleModule {}'
}

describe('MetahubSnapshotTransportEnvelopeSchema module contract', () => {
    it('accepts a current snapshot module with explicit matching SDK API versions', () => {
        expect(MetahubSnapshotTransportEnvelopeSchema.safeParse(makeEnvelope(moduleMetadata)).success).toBe(true)
    })

    it.each([
        ['missing module SDK API version', { ...moduleMetadata, sdkApiVersion: undefined }],
        ['blank module SDK API version', { ...moduleMetadata, sdkApiVersion: ' ' }],
        ['missing manifest SDK API version', { ...moduleMetadata, manifest: { className: 'ExampleModule' } }],
        ['blank manifest SDK API version', { ...moduleMetadata, manifest: { ...moduleMetadata.manifest, sdkApiVersion: ' ' } }],
        ['unsupported module SDK API version', { ...moduleMetadata, sdkApiVersion: '9.0.0' }],
        ['unsupported manifest SDK API version', { ...moduleMetadata, manifest: { ...moduleMetadata.manifest, sdkApiVersion: '9.0.0' } }],
        [
            'mismatched module and manifest SDK API versions',
            { ...moduleMetadata, manifest: { ...moduleMetadata.manifest, sdkApiVersion: '0.2.0' } }
        ]
    ])('rejects %s', (_caseName, module) => {
        expect(MetahubSnapshotTransportEnvelopeSchema.safeParse(makeEnvelope(module as Record<string, unknown>)).success).toBe(false)
    })

    it('still accepts snapshots without modules', () => {
        expect(MetahubSnapshotTransportEnvelopeSchema.safeParse(makeEnvelope()).success).toBe(true)
    })
})
