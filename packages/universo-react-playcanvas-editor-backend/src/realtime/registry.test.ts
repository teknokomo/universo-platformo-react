import { describe, expect, it } from 'vitest'
import {
    captureRealtimeAssetDocumentGrantVersions,
    diffRealtimeAssetDocumentIds,
    grantRealtimeAssetDocuments,
    isRealtimeAssetDocumentGranted,
    isRealtimeAssetDocumentRevoked,
    revokeRealtimeAssetDocuments
} from './index'

const metahubId = 'realtime-generation-test'
const projectId = '019e9146-fd1b-7d1d-a858-d1e96485d901'
const documentId = 2_000_001

describe('realtime asset grant generations', () => {
    it('returns deterministic added and removed ids', () => {
        expect(diffRealtimeAssetDocumentIds(new Set([9, 2, 7]), [7, 11, 3])).toEqual({
            added: [3, 11],
            removed: [2, 9]
        })
    })

    it('reports only actual grant and revoke transitions', async () => {
        const transitionMetahubId = 'realtime-transition-test'
        const transitionProjectId = '019e9146-fd1b-7d1d-a858-d1e96485d902'
        const transitionDocumentId = 2_000_002

        await expect(grantRealtimeAssetDocuments(transitionMetahubId, transitionProjectId, [transitionDocumentId])).resolves.toEqual([
            transitionDocumentId
        ])
        await expect(grantRealtimeAssetDocuments(transitionMetahubId, transitionProjectId, [transitionDocumentId])).resolves.toEqual([])
        expect(revokeRealtimeAssetDocuments(transitionMetahubId, transitionProjectId, [transitionDocumentId])).toEqual([
            transitionDocumentId
        ])
        expect(revokeRealtimeAssetDocuments(transitionMetahubId, transitionProjectId, [transitionDocumentId])).toEqual([])
    })

    it('does not let a stale delete revoke a recreated document', async () => {
        await grantRealtimeAssetDocuments(metahubId, projectId, [documentId])
        const beforeDelete = captureRealtimeAssetDocumentGrantVersions(metahubId, projectId)

        // Model the durable delete completing before a new row is created. The
        // recreate receives a newer generation, so the delayed completion of
        // the old delete must not revoke the new grant.
        expect(revokeRealtimeAssetDocuments(metahubId, projectId, [documentId])).toEqual([documentId])
        await grantRealtimeAssetDocuments(metahubId, projectId, [documentId])
        expect(revokeRealtimeAssetDocuments(metahubId, projectId, [documentId], beforeDelete)).toEqual([])
        expect(isRealtimeAssetDocumentGranted(metahubId, projectId, documentId)).toBe(true)
        expect(isRealtimeAssetDocumentRevoked(metahubId, projectId, documentId)).toBe(false)

        const current = captureRealtimeAssetDocumentGrantVersions(metahubId, projectId)
        expect(revokeRealtimeAssetDocuments(metahubId, projectId, [documentId], current)).toEqual([documentId])
        expect(isRealtimeAssetDocumentGranted(metahubId, projectId, documentId)).toBe(false)
        expect(isRealtimeAssetDocumentRevoked(metahubId, projectId, documentId)).toBe(true)
    })
})
