/**
 * Application Sync - Helper Functions
 *
 * Core utility functions for schema sync operations.
 * No database access - only data transformation and validation.
 */

import { type Request, type Response, type RequestHandler } from 'express'
import stableStringify from 'json-stable-stringify'
import { assertCanonicalIdentifier, assertCanonicalSchemaName, quoteIdentifier } from '@universo-react/migrations-core'
import type { EntityDefinition, SchemaSnapshot } from '@universo-react/schema-ddl'
import {
    ApplicationSchemaStatus,
    ComponentDefinitionDataType,
    type ApplicationLifecycleContract,
    type VersionedLocalizedContent
} from '@universo-react/types'
import {
    createCodenameVLC,
    getCodenamePrimary,
    resolveApplicationLifecycleContractFromConfig,
    resolvePlatformSystemFieldsContractFromConfig
} from '@universo-react/utils'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { withWorkspaceContract } from '../../services/applicationWorkspaces'
import type { ApplicationSyncQueryBuilder } from '../../ddl'
import { EMPTY_VLC, RUNTIME_ENTITY_KINDS, RUNTIME_ENTITY_KIND_PATTERN, type SyncableApplicationRecord } from './syncTypes'
import { isRecord } from './syncValueHelpers'

// --- Core utilities ---

export const asyncHandler = (fn: (req: Request, res: Response) => Promise<Response | void>): RequestHandler => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res)).catch(next)
    }
}

export const runtimeCodenameTextSql = (columnRef: string): string =>
    `COALESCE(${columnRef}->'locales'->(${columnRef}->>'_primary')->>'content', ${columnRef}->'locales'->'en'->>'content', ${columnRef} #>> '{}', '')`

export const buildDynamicRuntimeActiveRowSql = (contract: ApplicationLifecycleContract, platformConfig?: unknown): string => {
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)
    const clauses: string[] = []

    if (platformContract.delete.enabled) {
        clauses.push('_upl_deleted = false')
    }
    if (contract.delete.mode === 'soft') {
        clauses.push('_app_deleted = false')
    }

    return clauses.length > 0 ? clauses.join(' AND ') : 'TRUE'
}

export const applyDynamicRuntimeActiveRowFilter = (
    qb: ApplicationSyncQueryBuilder,
    contract: ApplicationLifecycleContract,
    platformConfig?: unknown
): ApplicationSyncQueryBuilder => {
    const platformContract = resolvePlatformSystemFieldsContractFromConfig(platformConfig)

    if (platformContract.delete.enabled) {
        qb.where('_upl_deleted', false)
    }
    if (contract.delete.mode === 'soft') {
        qb.where('_app_deleted', false)
    }
    return qb
}

export const resolveEntityLifecycleContract = (entity: EntityDefinition): ApplicationLifecycleContract => {
    return resolveApplicationLifecycleContractFromConfig(entity.config)
}

export const toWorkspaceAwareSnapshot = (schemaSnapshot: unknown, workspacesEnabled: boolean): Record<string, unknown> | null =>
    withWorkspaceContract(schemaSnapshot as Record<string, unknown> | null | undefined, workspacesEnabled)

export const toWorkspaceAwareSchemaSnapshot = (
    schemaSnapshot: SchemaSnapshot | null | undefined,
    workspacesEnabled: boolean
): SchemaSnapshot | null =>
    withWorkspaceContract(
        schemaSnapshot as unknown as Record<string, unknown> | null | undefined,
        workspacesEnabled
    ) as unknown as SchemaSnapshot | null

export function normalizeSnapshotCodenameValue(value: unknown, context: string): VersionedLocalizedContent<string> {
    const codename =
        typeof value === 'string'
            ? createCodenameVLC('en', value)
            : isRecord(value)
            ? (value as unknown as VersionedLocalizedContent<string>)
            : null
    if (!codename) {
        throw new Error(`[SchemaSync] Invalid ${context} codename in snapshot`)
    }

    if (getCodenamePrimary(codename).trim().length === 0) {
        throw new Error(`[SchemaSync] Empty ${context} codename in snapshot`)
    }

    return codename
}

export function compareStableValues(left: unknown, right: unknown): boolean {
    return stableStringify(left) === stableStringify(right)
}

export function toStructuralSchemaSnapshot(snapshot: SchemaSnapshot | null): Pick<SchemaSnapshot, 'hasSystemTables' | 'entities'> | null {
    if (!snapshot) {
        return null
    }

    return {
        hasSystemTables: snapshot.hasSystemTables,
        entities: snapshot.entities
    }
}

export function quoteSchemaName(schemaName: string): string {
    assertCanonicalSchemaName(schemaName)
    return quoteIdentifier(schemaName)
}

export function quoteObjectName(identifier: string): string {
    assertCanonicalIdentifier(identifier)
    return quoteIdentifier(identifier)
}

// --- Normalization ---

export function normalizeRuntimeEntityKind(value: unknown): EntityDefinition['kind'] | null {
    if (typeof value !== 'string') {
        return null
    }

    if (RUNTIME_ENTITY_KINDS.has(value as EntityDefinition['kind'])) {
        return value as EntityDefinition['kind']
    }

    return RUNTIME_ENTITY_KIND_PATTERN.test(value) ? (value as EntityDefinition['kind']) : null
}

export function normalizeRuntimePresentation(value: unknown): EntityDefinition['presentation'] {
    if (isRecord(value) && isRecord(value.name)) {
        return value as unknown as EntityDefinition['presentation']
    }

    return {
        name: { ...EMPTY_VLC }
    }
}

export function normalizeRuntimeSnapshotValue(value: unknown, field: EntityDefinition['fields'][number]): unknown {
    if (value === undefined || value === null) {
        return null
    }

    if (field.dataType === ComponentDefinitionDataType.NUMBER && typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : value
    }

    if (field.dataType === ComponentDefinitionDataType.DATE && value instanceof Date) {
        return value.toISOString()
    }

    return value
}

// --- Application state ---

export function applyApplicationSyncState(
    application: SyncableApplicationRecord,
    state: {
        schemaStatus: ApplicationSchemaStatus
        schemaError: string | null
        schemaSyncedAt: Date | null
        schemaSnapshot: Record<string, unknown> | null
        lastSyncedPublicationVersionId: string | null
        appStructureVersion: number | null
        installedReleaseMetadata?: Record<string, unknown> | null
    }
): void {
    application.schemaStatus = state.schemaStatus
    application.schemaError = state.schemaError
    application.schemaSyncedAt = state.schemaSyncedAt
    application.schemaSnapshot = state.schemaSnapshot
    application.lastSyncedPublicationVersionId = state.lastSyncedPublicationVersionId
    application.appStructureVersion = state.appStructureVersion
    application.installedReleaseMetadata = state.installedReleaseMetadata ?? application.installedReleaseMetadata ?? null
}

export function resolveApplicationReleaseVersion(input: {
    publicationVersionId?: string | null
    snapshot: PublishedApplicationSnapshot
    snapshotHash?: string | null
}): string {
    const candidates = [input.publicationVersionId, input.snapshot.versionEnvelope?.templateVersion, input.snapshotHash]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim()
        }
    }

    return 'unversioned-release'
}

export function extractInstalledReleaseMetadataString(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: string
): string | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export function extractInstalledReleaseMetadataSchemaSnapshot(
    installedReleaseMetadata: Record<string, unknown> | null | undefined,
    key: 'baseSchemaSnapshot' | 'releaseSchemaSnapshot'
): SchemaSnapshot | null {
    if (!installedReleaseMetadata) {
        return null
    }

    const value = installedReleaseMetadata[key]
    if (!isRecord(value) || typeof value.version !== 'number' || !isRecord(value.entities)) {
        return null
    }

    return value as unknown as SchemaSnapshot
}

export * from './syncValueHelpers'
export * from './syncEntityValueHelpers'
export { remapSnapshotLayoutScopeEntityIds, buildMergedDashboardLayoutConfig } from './syncLayoutSnapshot'
export {
    withWorkspaceRuntimeLayoutWidgets,
    materializeSnapshotLayoutsAndWidgets,
    normalizeSnapshotLayouts,
    normalizeSnapshotLayoutZoneWidgets
} from './syncLayoutMaterialization'
