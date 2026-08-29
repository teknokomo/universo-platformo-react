import { createHash } from 'node:crypto'
import {
    isPortablePlayCanvasRuntimeDataUrl,
    isPortablePlayCanvasScriptDataUrl,
    playCanvasRuntimeManifestSchema,
    type PlayCanvasRuntimeManifest
} from '@universo-react/types'
import { serialization } from '@universo-react/utils'

export interface PlayCanvasRuntimeManifestRowIdentity {
    /** Project UUID stored alongside the published manifest row. */
    sourceProjectId: string
    /** Optional scene UUID stored alongside the published manifest row. */
    sourceSceneId: string | null
    /** Lowercase hexadecimal checksum stored alongside the published manifest row. */
    manifestChecksum: string
}

/**
 * Return the manifest payload covered by the checksum.
 *
 * The checksum field is deliberately excluded so that a producer can compute
 * the value before attaching it and a consumer can recompute it from the
 * persisted object. Keep this normalization beside the validator and use the
 * shared stable serializer from `@universo-react/utils` for every producer.
 */
export const getPlayCanvasRuntimeManifestChecksumPayload = (manifest: unknown): Record<string, unknown> => {
    const record = manifest && typeof manifest === 'object' && !Array.isArray(manifest) ? (manifest as Record<string, unknown>) : {}
    const { checksum: _checksum, ...withoutChecksum } = record
    return withoutChecksum
}

/** Serialize a runtime manifest with the canonical key ordering used by SHA-256. */
export const canonicalizePlayCanvasRuntimeManifest = (manifest: unknown): string =>
    serialization.stableStringify(getPlayCanvasRuntimeManifestChecksumPayload(manifest))

/** Compute the lowercase hexadecimal SHA-256 checksum of a runtime manifest. */
export const computePlayCanvasRuntimeManifestChecksum = (manifest: unknown): string =>
    createHash('sha256').update(canonicalizePlayCanvasRuntimeManifest(manifest)).digest('hex')

/** Reject runtime URLs that could escape the portable data-URL contract. */
export const assertPlayCanvasRuntimeManifestUrls = (manifest: PlayCanvasRuntimeManifest): void => {
    for (const asset of manifest.assets) {
        if (asset.url && !isPortablePlayCanvasRuntimeDataUrl(asset.url)) {
            throw new Error('Published PlayCanvas runtime manifest contains an unapproved asset URL')
        }
    }
    for (const script of manifest.scripts) {
        if (script.artifactUrl && !isPortablePlayCanvasScriptDataUrl(script.artifactUrl)) {
            throw new Error('Published PlayCanvas runtime manifest contains an unapproved script artifact URL')
        }
    }
}

/** Parse, checksum-validate, identity-check, and URL-validate a published manifest. */
export const parseAndValidatePlayCanvasRuntimeManifest = (
    value: unknown,
    expectedIdentity?: PlayCanvasRuntimeManifestRowIdentity
): PlayCanvasRuntimeManifest => {
    const parsed = playCanvasRuntimeManifestSchema.safeParse(value)
    if (!parsed.success) {
        throw new Error('Published PlayCanvas runtime manifest is invalid')
    }

    const manifest = parsed.data
    const computedChecksum = computePlayCanvasRuntimeManifestChecksum(manifest)
    if (manifest.checksum !== computedChecksum) {
        throw new Error('Published PlayCanvas runtime manifest checksum is invalid')
    }
    if (
        expectedIdentity &&
        (expectedIdentity.manifestChecksum !== computedChecksum ||
            expectedIdentity.sourceProjectId !== manifest.projectId ||
            expectedIdentity.sourceSceneId !== (manifest.sceneId ?? null))
    ) {
        throw new Error('Published PlayCanvas runtime manifest row identity is invalid')
    }

    assertPlayCanvasRuntimeManifestUrls(manifest)
    return manifest
}
