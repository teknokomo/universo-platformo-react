import type { DbExecutor } from '@universo-react/utils'
import type { EntityDefinition, Component } from '@universo-react/schema-ddl'
import type {
    ApplicationModuleDefinition,
    ApplicationPackageDefinition,
    EnumerationValueDefinition,
    MetahubSnapshotVersionEnvelope,
    VersionedLocalizedContent
} from '@universo-react/types'
import { normalizePublishedApplicationRuntimeSource } from './publishedApplicationRuntimeSnapshot'

export type SnapshotCodenameValue = string | VersionedLocalizedContent<string>

export interface SnapshotComponent extends Omit<Component, 'codename' | 'childFields'> {
    codename: SnapshotCodenameValue
    childFields?: SnapshotComponent[]
}

export interface SnapshotEntityDefinition extends Omit<EntityDefinition, 'codename' | 'fields'> {
    codename: SnapshotCodenameValue
    tableName?: string
    fields: SnapshotComponent[]
}

export interface SnapshotEnumerationValueDefinition extends Omit<EnumerationValueDefinition, 'codename'> {
    codename: SnapshotCodenameValue
}

export interface SnapshotConstantDefinition {
    id: string
    objectId?: string | null
    codename: SnapshotCodenameValue
    dataType: string
    presentation?: Record<string, unknown>
    validationRules?: Record<string, unknown>
    uiConfig?: Record<string, unknown>
    value?: unknown
    sortOrder?: number | null
}

export interface SnapshotSharedEntityOverrideDefinition {
    id: string
    entityKind: 'component' | 'constant' | 'value'
    sharedEntityId: string
    targetObjectId: string
    isExcluded: boolean
    isActive: boolean | null
    sortOrder: number | null
}

export interface SnapshotModuleDefinition extends Omit<ApplicationModuleDefinition, 'codename'> {
    codename: SnapshotCodenameValue
    sourceCode?: string
}

export type SnapshotPackageDefinition = ApplicationPackageDefinition

export interface PublishedApplicationSnapshot {
    versionEnvelope?: MetahubSnapshotVersionEnvelope
    entities: Record<string, SnapshotEntityDefinition>
    elements?: Record<string, unknown[]>
    optionValues?: Record<string, SnapshotEnumerationValueDefinition[]>
    constants?: Record<string, unknown[]>
    sharedComponents?: SnapshotComponent[]
    sharedFixedValues?: SnapshotConstantDefinition[]
    sharedOptionValues?: SnapshotEnumerationValueDefinition[]
    sharedEntityOverrides?: SnapshotSharedEntityOverrideDefinition[]
    modules?: SnapshotModuleDefinition[]
    packages?: SnapshotPackageDefinition[]
    layouts?: unknown[]
    layoutZoneWidgets?: unknown[]
    scopedLayouts?: unknown[]
    layoutWidgetOverrides?: unknown[]
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
    return async (executor, publicationId) => {
        const source = await loadPublishedPublicationRuntimeSource(executor, publicationId)
        return source ? normalizePublishedApplicationRuntimeSource(source) : null
    }
}
