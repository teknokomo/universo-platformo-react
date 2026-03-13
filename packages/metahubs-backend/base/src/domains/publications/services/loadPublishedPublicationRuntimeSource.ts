import type { LoadPublishedPublicationRuntimeSource, PublishedApplicationSnapshot } from '@universo/applications-backend'
import { findPublicationById, findPublicationVersionById } from '../../../persistence'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubAttributesService } from '../../metahubs/services/MetahubAttributesService'
import { enrichDefinitionsWithSetConstants } from '../../shared/setConstantRefs'
import { SnapshotSerializer, type MetahubSnapshot } from './SnapshotSerializer'

export const loadPublishedPublicationRuntimeSource: LoadPublishedPublicationRuntimeSource = async (executor, publicationId) => {
    const publication = await findPublicationById(executor, publicationId)
    if (!publication?.activeVersionId) {
        return null
    }

    const activeVersion = await findPublicationVersionById(executor, publication.activeVersionId)
    if (!activeVersion) {
        return null
    }

    const snapshot = activeVersion.snapshotJson as unknown as MetahubSnapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
        return null
    }

    const schemaService = new MetahubSchemaService(executor)
    const objectsService = new MetahubObjectsService(schemaService)
    const attributesService = new MetahubAttributesService(schemaService)
    const serializer = new SnapshotSerializer(objectsService, attributesService)
    const rawCatalogDefs = serializer.deserializeSnapshot(snapshot)

    return {
        publicationId: publication.id,
        publicationVersionId: activeVersion.id,
        snapshotHash: activeVersion.snapshotHash || serializer.calculateHash(snapshot),
        snapshot: snapshot as unknown as PublishedApplicationSnapshot,
        entities: enrichDefinitionsWithSetConstants(rawCatalogDefs, snapshot),
        publicationSnapshot: snapshot as unknown as Record<string, unknown>
    }
}
