import type { VersionedLocalizedContent, MetahubTemplateManifest } from '@universo/types'
import type { SqlQueryable, TemplateRow, TemplateVersionRow } from './types'
import { uplFieldAliases } from './types'

// ═══════════════════════════════════════════════════════════════════════════════
// SELECT fragments (templates are platform-level — no _mhb_* fields)
// ═══════════════════════════════════════════════════════════════════════════════

const TEMPLATE_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.codename,
    ${alias}.name,
    ${alias}.description,
    ${alias}.icon,
    ${alias}.is_system AS "isSystem",
    ${alias}.is_active AS "isActive",
    ${alias}.sort_order AS "sortOrder",
    ${alias}.active_version_id AS "activeVersionId",
    ${alias}.definition_type AS "definitionType",
    ${uplFieldAliases(alias)}
`.trim()

const TEMPLATE_VERSION_SELECT = (alias: string) =>
    `
    ${alias}.id,
    ${alias}.template_id AS "templateId",
    ${alias}.version_number AS "versionNumber",
    ${alias}.version_label AS "versionLabel",
    ${alias}.min_structure_version AS "minStructureVersion",
    ${alias}.manifest_json AS "manifestJson",
    ${alias}.manifest_hash AS "manifestHash",
    ${alias}.is_active AS "isActive",
    ${alias}.changelog,
    ${uplFieldAliases(alias)}
`.trim()

// ═══════════════════════════════════════════════════════════════════════════════
// Template queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findTemplateById(exec: SqlQueryable, id: string): Promise<TemplateRow | null> {
    const rows = await exec.query<TemplateRow>(
        `SELECT ${TEMPLATE_SELECT('t')}
         FROM metahubs.cat_templates t
         WHERE t.id = $1
           AND t._upl_deleted = false AND t._app_deleted = false
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findTemplateByCodename(exec: SqlQueryable, codename: string): Promise<TemplateRow | null> {
    const rows = await exec.query<TemplateRow>(
        `SELECT ${TEMPLATE_SELECT('t')}
         FROM metahubs.cat_templates t
         WHERE t.codename = $1
           AND t._upl_deleted = false AND t._app_deleted = false
         LIMIT 1`,
        [codename]
    )
    return rows[0] ?? null
}

export async function findTemplateByIdNotDeleted(exec: SqlQueryable, id: string): Promise<TemplateRow | null> {
    const rows = await exec.query<TemplateRow>(
        `SELECT ${TEMPLATE_SELECT('t')}
         FROM metahubs.cat_templates t
         WHERE t.id = $1
           AND t._upl_deleted = false AND t._app_deleted = false
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

/**
 * List active, non-deleted templates with their active version info.
 * Used by the read-only templates catalog API.
 */
export interface TemplateCatalogItem extends TemplateRow {
    activeVersionData: {
        id: string
        versionNumber: number
        versionLabel: string
        changelog: VersionedLocalizedContent<string> | null
    } | null
}

export async function listActiveTemplatesForCatalog(exec: SqlQueryable): Promise<TemplateCatalogItem[]> {
    const rows = await exec.query<
        TemplateRow & {
            avId: string | null
            avVersionNumber: number | null
            avVersionLabel: string | null
            avChangelog: VersionedLocalizedContent<string> | null
        }
    >(
        `SELECT
            ${TEMPLATE_SELECT('t')},
            av.id AS "avId",
            av.version_number AS "avVersionNumber",
            av.version_label AS "avVersionLabel",
            av.changelog AS "avChangelog"
         FROM metahubs.cat_templates t
         LEFT JOIN metahubs.doc_template_versions av ON av.id = t.active_version_id
         WHERE t.is_active = true AND t._upl_deleted = false AND t._app_deleted = false
         ORDER BY t.sort_order ASC, t._upl_created_at ASC`,
        []
    )
    return rows.map((r) => ({
        ...r,
        activeVersionData: r.avId
            ? {
                  id: r.avId,
                  versionNumber: r.avVersionNumber!,
                  versionLabel: r.avVersionLabel!,
                  changelog: r.avChangelog
              }
            : null
    }))
}

export interface TemplateListItem extends TemplateRow {
    versionsCount: number
    activeVersionLabel: string | null
}

interface TemplateListRow extends TemplateListItem {
    windowTotal: string
}

export async function listTemplates(
    exec: SqlQueryable,
    input: {
        limit: number
        offset: number
        activeOnly?: boolean
        sortBy?: 'name' | 'sortOrder' | 'created'
        sortOrder?: 'asc' | 'desc'
    }
): Promise<{ items: TemplateListItem[]; total: number }> {
    const params: unknown[] = []
    const conditions: string[] = ['t._upl_deleted = false AND t._app_deleted = false']

    if (input.activeOnly) {
        conditions.push('t.is_active = true')
    }

    params.push(input.limit, input.offset)
    const limitIdx = params.length - 1
    const offsetIdx = params.length

    const orderCol =
        input.sortBy === 'name'
            ? `COALESCE(t.name->>(t.name->>'_primary'), t.name->>'en', '')`
            : input.sortBy === 'sortOrder'
            ? 't.sort_order'
            : 't._upl_created_at'
    const orderDir = (input.sortOrder ?? 'asc').toUpperCase() === 'DESC' ? 'DESC' : 'ASC'

    const rows = await exec.query<TemplateListRow>(
        `SELECT
            ${TEMPLATE_SELECT('t')},
            COALESCE(vc.count, 0)::int AS "versionsCount",
            av.version_label AS "activeVersionLabel",
            COUNT(*) OVER() AS "windowTotal"
         FROM metahubs.cat_templates t
         LEFT JOIN (
             SELECT template_id, COUNT(*)::int AS count
             FROM metahubs.doc_template_versions
             GROUP BY template_id
         ) vc ON vc.template_id = t.id
         LEFT JOIN metahubs.doc_template_versions av
             ON av.id = t.active_version_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${orderCol} ${orderDir}
         LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
        params
    )

    const total = rows.length > 0 ? parseInt(String(rows[0].windowTotal), 10) : 0
    const items: TemplateListItem[] = rows.map(({ windowTotal: _wt, ...row }) => row)
    return { items, total }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Template create / update
// ═══════════════════════════════════════════════════════════════════════════════

export interface CreateTemplateInput {
    codename: string
    name: VersionedLocalizedContent<string>
    description?: VersionedLocalizedContent<string> | null
    icon?: string | null
    isSystem?: boolean
    isActive?: boolean
    sortOrder?: number
    userId: string
}

const normalizeAuditUserId = (userId: string): string | null => {
    const trimmed = userId.trim()
    return trimmed.length > 0 ? trimmed : null
}

export async function createTemplate(exec: SqlQueryable, input: CreateTemplateInput): Promise<TemplateRow> {
    const auditUserId = normalizeAuditUserId(input.userId)
    const rows = await exec.query<TemplateRow>(
        `INSERT INTO metahubs.cat_templates (
            codename, name, description, icon,
            is_system, is_active, sort_order,
            _upl_created_by, _upl_updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING ${TEMPLATE_SELECT('metahubs.cat_templates')}`,
        [
            input.codename,
            JSON.stringify(input.name),
            input.description ? JSON.stringify(input.description) : null,
            input.icon ?? null,
            input.isSystem ?? false,
            input.isActive ?? true,
            input.sortOrder ?? 0,
            auditUserId
        ]
    )
    return rows[0]
}

export async function updateTemplate(
    exec: SqlQueryable,
    id: string,
    input: {
        name?: VersionedLocalizedContent<string>
        description?: VersionedLocalizedContent<string> | null
        icon?: string | null
        isActive?: boolean
        sortOrder?: number
        activeVersionId?: string | null
        userId?: string
    }
): Promise<TemplateRow | null> {
    const setClauses: string[] = []
    const params: unknown[] = []
    let idx = 1

    const push = (col: string, val: unknown) => {
        setClauses.push(`${col} = $${idx}`)
        params.push(val)
        idx++
    }

    if (input.name !== undefined) push('name', JSON.stringify(input.name))
    if (input.description !== undefined) push('description', input.description ? JSON.stringify(input.description) : null)
    if (input.icon !== undefined) push('icon', input.icon)
    if (input.isActive !== undefined) push('is_active', input.isActive)
    if (input.sortOrder !== undefined) push('sort_order', input.sortOrder)
    if (input.activeVersionId !== undefined) push('active_version_id', input.activeVersionId)
    if (input.userId) push('_upl_updated_by', input.userId)

    setClauses.push('_upl_updated_at = NOW()')
    setClauses.push('_upl_version = _upl_version + 1')

    params.push(id)

    const rows = await exec.query<TemplateRow>(
        `UPDATE metahubs.cat_templates
         SET ${setClauses.join(', ')}
         WHERE id = $${params.length}
         RETURNING ${TEMPLATE_SELECT('metahubs.cat_templates')}`,
        params
    )
    return rows[0] ?? null
}

// ═══════════════════════════════════════════════════════════════════════════════
// TemplateVersion queries
// ═══════════════════════════════════════════════════════════════════════════════

export async function findTemplateVersionById(exec: SqlQueryable, id: string): Promise<TemplateVersionRow | null> {
    const rows = await exec.query<TemplateVersionRow>(
        `SELECT ${TEMPLATE_VERSION_SELECT('tv')}
         FROM metahubs.doc_template_versions tv
         WHERE tv.id = $1
         LIMIT 1`,
        [id]
    )
    return rows[0] ?? null
}

export async function findActiveTemplateVersion(exec: SqlQueryable, templateId: string): Promise<TemplateVersionRow | null> {
    const rows = await exec.query<TemplateVersionRow>(
        `SELECT ${TEMPLATE_VERSION_SELECT('tv')}
         FROM metahubs.doc_template_versions tv
         WHERE tv.template_id = $1
           AND tv.is_active = true
         LIMIT 1`,
        [templateId]
    )
    return rows[0] ?? null
}

export async function listTemplateVersions(exec: SqlQueryable, templateId: string): Promise<TemplateVersionRow[]> {
    return exec.query<TemplateVersionRow>(
        `SELECT ${TEMPLATE_VERSION_SELECT('tv')}
         FROM metahubs.doc_template_versions tv
         WHERE tv.template_id = $1
         ORDER BY tv.version_number DESC`,
        [templateId]
    )
}

export async function getMaxTemplateVersionNumber(exec: SqlQueryable, templateId: string): Promise<number> {
    const rows = await exec.query<{ max: string | null }>(
        `SELECT MAX(version_number)::text AS max
         FROM metahubs.doc_template_versions
         WHERE template_id = $1`,
        [templateId]
    )
    return parseInt(rows[0]?.max ?? '0', 10)
}

export interface CreateTemplateVersionInput {
    templateId: string
    versionNumber: number
    versionLabel: string
    minStructureVersion?: string
    manifestJson: MetahubTemplateManifest
    manifestHash: string
    isActive?: boolean
    changelog?: Record<string, unknown> | null
    userId: string
}

export async function createTemplateVersion(exec: SqlQueryable, input: CreateTemplateVersionInput): Promise<TemplateVersionRow> {
    const auditUserId = normalizeAuditUserId(input.userId)
    const rows = await exec.query<TemplateVersionRow>(
        `INSERT INTO metahubs.doc_template_versions (
            template_id, version_number, version_label,
            min_structure_version, manifest_json, manifest_hash,
            is_active, changelog,
            _upl_created_by, _upl_updated_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
         RETURNING ${TEMPLATE_VERSION_SELECT('metahubs.doc_template_versions')}`,
        [
            input.templateId,
            input.versionNumber,
            input.versionLabel,
            input.minStructureVersion ?? '0.1.0',
            JSON.stringify(input.manifestJson),
            input.manifestHash,
            input.isActive ?? false,
            input.changelog ? JSON.stringify(input.changelog) : null,
            auditUserId
        ]
    )
    return rows[0]
}

export async function deactivateTemplateVersions(exec: SqlQueryable, templateId: string): Promise<void> {
    await exec.query(
        `UPDATE metahubs.doc_template_versions
         SET is_active = false
         WHERE template_id = $1 AND is_active = true`,
        [templateId]
    )
}
