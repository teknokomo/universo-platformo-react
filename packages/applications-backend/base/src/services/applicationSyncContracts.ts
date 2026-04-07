import type { DbExecutor } from '@universo/utils'
import type { EntityDefinition, FieldDefinition } from '@universo/schema-ddl'
import type {
    ApplicationScriptDefinition,
    EnumerationValueDefinition,
    MetahubSnapshotVersionEnvelope,
    VersionedLocalizedContent
} from '@universo/types'

export type SnapshotCodenameValue = string | VersionedLocalizedContent<string>

export interface SnapshotFieldDefinition extends Omit<FieldDefinition, 'codename' | 'childFields'> {
    codename: SnapshotCodenameValue
    childFields?: SnapshotFieldDefinition[]
}

export interface SnapshotEntityDefinition extends Omit<EntityDefinition, 'codename' | 'fields'> {
    codename: SnapshotCodenameValue
    fields: SnapshotFieldDefinition[]
}

export interface SnapshotEnumerationValueDefinition extends Omit<EnumerationValueDefinition, 'codename'> {
    codename: SnapshotCodenameValue
}

export interface SnapshotScriptDefinition extends Omit<ApplicationScriptDefinition, 'codename'> {
    codename: SnapshotCodenameValue
    sourceCode?: string
}

export interface PublishedApplicationSnapshot {
    versionEnvelope?: MetahubSnapshotVersionEnvelope
    entities: Record<string, SnapshotEntityDefinition>
    elements?: Record<string, unknown[]>
    enumerationValues?: Record<string, SnapshotEnumerationValueDefinition[]>
    constants?: Record<string, unknown[]>
    scripts?: SnapshotScriptDefinition[]
    layouts?: unknown[]
    layoutZoneWidgets?: unknown[]
    catalogLayouts?: unknown[]
    catalogLayoutWidgetOverrides?: unknown[]
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
