import type { VersionedLocalizedContent, MetahubTemplateManifest } from '@universo/types'

// Re-export canonical SqlQueryable from @universo/utils
export type { SqlQueryable } from '@universo/utils'

// ═══════════════════════════════════════════════════════════════════════════════
// Shared platform-level system fields (_upl_*)
// ═══════════════════════════════════════════════════════════════════════════════

export interface UplSystemFields {
    _uplCreatedAt: Date
    _uplCreatedBy: string | null
    _uplUpdatedAt: Date
    _uplUpdatedBy: string | null
    _uplVersion: number
    _uplArchived: boolean
    _uplArchivedAt: Date | null
    _uplArchivedBy: string | null
    _uplDeleted: boolean
    _uplDeletedAt: Date | null
    _uplDeletedBy: string | null
    _uplPurgeAfter: Date | null
    _uplLocked: boolean
    _uplLockedAt: Date | null
    _uplLockedBy: string | null
    _uplLockedReason: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared metahub-level system fields (_mhb_*)
// ═══════════════════════════════════════════════════════════════════════════════

export interface MhbSystemFields {
    _mhbPublished: boolean
    _mhbPublishedAt: Date | null
    _mhbPublishedBy: string | null
    _mhbArchived: boolean
    _mhbArchivedAt: Date | null
    _mhbArchivedBy: string | null
    _mhbDeleted: boolean
    _mhbDeletedAt: Date | null
    _mhbDeletedBy: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metahub row
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetahubRow extends UplSystemFields, MhbSystemFields {
    id: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    codename: string
    codenameLocalized: VersionedLocalizedContent<string> | null
    slug: string | null
    defaultBranchId: string | null
    lastBranchNumber: number
    isPublic: boolean
    templateId: string | null
    templateVersionId: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// MetahubBranch row
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetahubBranchRow extends UplSystemFields, MhbSystemFields {
    id: string
    metahubId: string
    sourceBranchId: string | null
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    codename: string
    codenameLocalized: VersionedLocalizedContent<string> | null
    branchNumber: number
    schemaName: string
    structureVersion: string
    lastTemplateVersionId: string | null
    lastTemplateVersionLabel: string | null
    lastTemplateSyncedAt: Date | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// MetahubUser row
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetahubUserRow extends UplSystemFields, MhbSystemFields {
    id: string
    metahubId: string
    userId: string
    activeBranchId: string | null
    role: string
    comment: VersionedLocalizedContent<string> | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// Publication row
// ═══════════════════════════════════════════════════════════════════════════════

export type PublicationAccessMode = 'full' | 'restricted'

export type PublicationSchemaStatus = 'draft' | 'pending' | 'synced' | 'outdated' | 'error'

export interface PublicationRow extends UplSystemFields, MhbSystemFields {
    id: string
    metahubId: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    accessMode: PublicationAccessMode
    accessConfig: Record<string, unknown> | null
    schemaName: string | null
    schemaStatus: PublicationSchemaStatus
    schemaError: string | null
    schemaSyncedAt: Date | null
    schemaSnapshot: Record<string, unknown> | null
    autoCreateApplication: boolean
    activeVersionId: string | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// PublicationVersion row
// ═══════════════════════════════════════════════════════════════════════════════

export interface PublicationVersionRow extends UplSystemFields, MhbSystemFields {
    id: string
    publicationId: string
    branchId: string | null
    versionNumber: number
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    snapshotJson: Record<string, unknown>
    snapshotHash: string
    isActive: boolean
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template row (platform-level only, no _mhb_* fields)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateRow extends UplSystemFields {
    id: string
    codename: string
    name: VersionedLocalizedContent<string>
    description: VersionedLocalizedContent<string> | null
    icon: string | null
    isSystem: boolean
    isActive: boolean
    sortOrder: number
    activeVersionId: string | null
    definitionType: string
}

// ═══════════════════════════════════════════════════════════════════════════════
// TemplateVersion row (platform-level only, no _mhb_* fields)
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateVersionRow extends UplSystemFields {
    id: string
    templateId: string
    versionNumber: number
    versionLabel: string
    minStructureVersion: string
    manifestJson: MetahubTemplateManifest
    manifestHash: string
    isActive: boolean
    changelog: Record<string, unknown> | null
}

// ═══════════════════════════════════════════════════════════════════════════════
// SQL helpers for column aliasing (snake_case → camelCase)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Common platform system field aliases for SELECT statements.
 * Use with a table alias prefix, e.g. `uplFieldAliases('m')`.
 */
export function uplFieldAliases(alias: string): string {
    return `
    ${alias}._upl_created_at AS "_uplCreatedAt",
    ${alias}._upl_created_by AS "_uplCreatedBy",
    ${alias}._upl_updated_at AS "_uplUpdatedAt",
    ${alias}._upl_updated_by AS "_uplUpdatedBy",
    ${alias}._upl_version AS "_uplVersion",
    ${alias}._upl_archived AS "_uplArchived",
    ${alias}._upl_archived_at AS "_uplArchivedAt",
    ${alias}._upl_archived_by AS "_uplArchivedBy",
    ${alias}._upl_deleted AS "_uplDeleted",
    ${alias}._upl_deleted_at AS "_uplDeletedAt",
    ${alias}._upl_deleted_by AS "_uplDeletedBy",
    ${alias}._upl_purge_after AS "_uplPurgeAfter",
    ${alias}._upl_locked AS "_uplLocked",
    ${alias}._upl_locked_at AS "_uplLockedAt",
    ${alias}._upl_locked_by AS "_uplLockedBy",
    ${alias}._upl_locked_reason AS "_uplLockedReason"`.trim()
}

/**
 * Common metahub-level system field aliases for SELECT statements.
 */
export function mhbFieldAliases(alias: string): string {
    return `
    ${alias}._mhb_published AS "_mhbPublished",
    ${alias}._mhb_published_at AS "_mhbPublishedAt",
    ${alias}._mhb_published_by AS "_mhbPublishedBy",
    ${alias}._mhb_archived AS "_mhbArchived",
    ${alias}._mhb_archived_at AS "_mhbArchivedAt",
    ${alias}._mhb_archived_by AS "_mhbArchivedBy",
    ${alias}._mhb_deleted AS "_mhbDeleted",
    ${alias}._mhb_deleted_at AS "_mhbDeletedAt",
    ${alias}._mhb_deleted_by AS "_mhbDeletedBy"`.trim()
}
