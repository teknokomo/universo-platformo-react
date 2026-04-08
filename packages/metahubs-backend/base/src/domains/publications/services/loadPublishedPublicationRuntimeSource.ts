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
    const objectsService = new MetahubObjectsService(executor, schemaService)
    const attributesService = new MetahubAttributesService(executor, schemaService)
    const serializer = new SnapshotSerializer(objectsService, attributesService)
    const runtimeSnapshot = SnapshotSerializer.materializeSharedEntitiesForRuntime(snapshot)
    const rawCatalogDefs = serializer.deserializeSnapshot(runtimeSnapshot)

    return {
        publicationId: publication.id,
        publicationVersionId: activeVersion.id,
        snapshotHash: serializer.calculateHash(runtimeSnapshot as MetahubSnapshot),
        snapshot: runtimeSnapshot as unknown as PublishedApplicationSnapshot,
        entities: enrichDefinitionsWithSetConstants(rawCatalogDefs, runtimeSnapshot),
        publicationSnapshot: snapshot as unknown as Record<string, unknown>
    }
}
