import type { LoadPublishedPublicationRuntimeSource, PublishedApplicationSnapshot } from '@universo/applications-backend'
import { findPublicationById, findPublicationVersionById } from '../../../persistence'
import { MetahubSchemaService } from '../../metahubs/services/MetahubSchemaService'
import { MetahubObjectsService } from '../../metahubs/services/MetahubObjectsService'
import { MetahubComponentsService } from '../../metahubs/services/MetahubComponentsService'
import { enrichDefinitionsWithValueGroupFixedValues } from '../../shared/valueGroupFixedValueRefs'
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
    const componentsService = new MetahubComponentsService(executor, schemaService)
    const serializer = new SnapshotSerializer(objectsService, componentsService)
    const runtimeSnapshot = SnapshotSerializer.materializeSharedEntitiesForRuntime(snapshot)
    const rawObjectDefs = serializer.deserializeSnapshot(runtimeSnapshot)

    return {
        publicationId: publication.id,
        publicationVersionId: activeVersion.id,
        snapshotHash: serializer.calculateHash(runtimeSnapshot as MetahubSnapshot),
        snapshot: runtimeSnapshot as unknown as PublishedApplicationSnapshot,
        entities: enrichDefinitionsWithValueGroupFixedValues(rawObjectDefs, runtimeSnapshot),
        publicationSnapshot: snapshot as unknown as Record<string, unknown>
    }
}
