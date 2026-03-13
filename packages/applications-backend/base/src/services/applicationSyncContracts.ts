import type { DbExecutor } from '@universo/utils'
import type { EntityDefinition } from '@universo/schema-ddl'
import type { MetahubSnapshotVersionEnvelope } from '@universo/types'

export interface PublishedApplicationSnapshot {
    versionEnvelope?: MetahubSnapshotVersionEnvelope
    entities: Record<string, EntityDefinition>
    elements?: Record<string, unknown[]>
    enumerationValues?: Record<string, unknown[]>
    constants?: Record<string, unknown[]>
    layouts?: unknown[]
    layoutZoneWidgets?: unknown[]
    defaultLayoutId?: string | null
    layoutConfig?: unknown
    [key: string]: unknown
}

export interface PublishedApplicationSyncContext {
    publicationId: string
    publicationVersionId: string
    snapshotHash: string | null
    snapshot: PublishedApplicationSnapshot
    entities: EntityDefinition[]
    publicationSnapshot: Record<string, unknown>
}

export type PublishedApplicationRuntimeSource = PublishedApplicationSyncContext

export type LoadPublishedPublicationRuntimeSource = (
    executor: DbExecutor,
    publicationId: string
) => Promise<PublishedApplicationRuntimeSource | null>

export type LoadPublishedApplicationSyncContext = (
    executor: DbExecutor,
    publicationId: string
) => Promise<PublishedApplicationSyncContext | null>

export function createLoadPublishedApplicationSyncContext(
    loadPublishedPublicationRuntimeSource: LoadPublishedPublicationRuntimeSource
): LoadPublishedApplicationSyncContext {
    return async (executor, publicationId) => loadPublishedPublicationRuntimeSource(executor, publicationId)
}
