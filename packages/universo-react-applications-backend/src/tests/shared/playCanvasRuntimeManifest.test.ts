import { createHash } from 'node:crypto'
import { computePlayCanvasRuntimeManifestChecksum, parseAndValidatePlayCanvasRuntimeManifest } from '../../shared/playCanvasRuntimeManifest'
import { serialization } from '@universo-react/utils'

const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
const sceneId = '019e9147-16c4-738c-ab0f-b98c443ee676'

const manifestWithoutChecksum = {
    schemaVersion: '1',
    projectId,
    sceneId,
    assets: [
        {
            id: 'scene-asset',
            type: 'scene',
            name: 'Main scene',
            url: 'data:application/json;base64,eyJvayI6dHJ1ZX0=',
            hash: 'a'.repeat(64),
            mime: 'application/json',
            size: 10
        }
    ],
    scripts: [
        {
            id: 'flight-script',
            scriptName: 'FlightControl',
            scriptKind: 'esm',
            artifactUrl: 'data:text/javascript;base64,ZXhwb3J0IGNvbnN0IHJlYWR5PXRydWU=',
            artifactHash: 'b'.repeat(64),
            attributes: { speed: { type: 'number' } },
            attributeValues: { speed: 4 },
            sceneEntityStableId: 'ship'
        }
    ],
    metadata: { generatedFrom: 'test' }
}

describe('PlayCanvas runtime manifest checksum contract', () => {
    it('uses one stable canonical payload regardless of object insertion order', () => {
        const reordered = {
            scripts: manifestWithoutChecksum.scripts,
            metadata: manifestWithoutChecksum.metadata,
            projectId: manifestWithoutChecksum.projectId,
            assets: manifestWithoutChecksum.assets,
            sceneId: manifestWithoutChecksum.sceneId,
            schemaVersion: manifestWithoutChecksum.schemaVersion
        }

        expect(computePlayCanvasRuntimeManifestChecksum(manifestWithoutChecksum)).toBe(computePlayCanvasRuntimeManifestChecksum(reordered))
    })

    it('matches the shared stable serializer used by snapshot producers', () => {
        const expected = createHash('sha256').update(serialization.stableStringify(manifestWithoutChecksum)).digest('hex')

        expect(computePlayCanvasRuntimeManifestChecksum(manifestWithoutChecksum)).toBe(expected)
    })

    it('round-trips a producer checksum through the consumer validator and row identity check', () => {
        const manifest = {
            ...manifestWithoutChecksum,
            checksum: computePlayCanvasRuntimeManifestChecksum(manifestWithoutChecksum)
        }

        expect(
            parseAndValidatePlayCanvasRuntimeManifest(manifest, {
                sourceProjectId: projectId,
                sourceSceneId: sceneId,
                manifestChecksum: manifest.checksum
            })
        ).toEqual(manifest)
    })

    it('rejects a checksum calculated over the checksum-bearing object', () => {
        const manifest = {
            ...manifestWithoutChecksum,
            checksum: computePlayCanvasRuntimeManifestChecksum(manifestWithoutChecksum)
        }
        const tampered = {
            ...manifest,
            metadata: { generatedFrom: 'tampered' }
        }

        expect(() => parseAndValidatePlayCanvasRuntimeManifest(tampered)).toThrow(
            'Published PlayCanvas runtime manifest checksum is invalid'
        )
    })
})
