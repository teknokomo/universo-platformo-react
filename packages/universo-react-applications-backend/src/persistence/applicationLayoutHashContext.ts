import { qSchemaTable } from '@universo-react/database'
import { layoutHashSchema, decodeLayoutConfigEnvelope, type ApplicationTemplateKey } from '@universo-react/types'
import type { DbExecutor } from '@universo-react/utils'
import { runtimeLayoutCapableFilterSql, runtimeObjectFilterSql, runtimeCodenameTextSql } from '../shared/runtimeHelpers'
import { hashApplicationLayoutContent } from '../utils/applicationLayoutHash'
import type { ApplicationLayoutHashInput, SemanticLayoutScope } from '../utils/applicationLayoutHash'

interface HashContextLayout {
    templateKey: ApplicationTemplateKey
    scopeEntityId?: string | null
    config?: unknown
    sourceComposition?: { mode: 'independent' | 'overlay'; baseLayoutId: string | null }
    baseLayoutId?: string | null
    compositionMode?: 'independent' | 'overlay'
    neutral?: { composition?: { mode?: 'independent' | 'overlay'; baseLayoutId?: string | null } }
}

interface ScopeSemanticRow {
    kind: string | null
    codename: string | null
}

interface BaseContentRow {
    template_key: string
    scope_entity_id: string | null
    local_content_hash: string | null
    source_content_hash: string | null
}

export interface ApplicationLayoutHashContext {
    semanticScope: SemanticLayoutScope | null
    baseLayoutContentHash: string | null
}

/** Resolve portable hash context from trusted server-side Entity and layout rows. */
export const resolveApplicationLayoutHashContext = async (
    executor: DbExecutor,
    schemaName: string,
    layout: HashContextLayout
): Promise<ApplicationLayoutHashContext> => {
    const objectsTable = qSchemaTable(schemaName, '_app_objects')
    const layoutsTable = qSchemaTable(schemaName, '_app_layouts')
    let semanticScope: SemanticLayoutScope | null = null
    if (layout.scopeEntityId) {
        const rows = await executor.query<ScopeSemanticRow>(
            `SELECT COALESCE(kind, '') AS kind, ${runtimeCodenameTextSql('codename')} AS codename
             FROM ${objectsTable}
             WHERE id = $1
               AND _upl_deleted = false
               AND _app_deleted = false
               AND ${runtimeLayoutCapableFilterSql('config')}
               AND (COALESCE(kind, '') = 'page' OR ${runtimeObjectFilterSql('kind', 'config')})
             LIMIT 2`,
            [layout.scopeEntityId]
        )
        const row = rows.length === 1 ? rows[0] : undefined
        if (!row || !row.kind || !row.codename || !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/u.test(row.codename)) {
            throw new Error('APPLICATION_LAYOUT_HASH_SCOPE_UNAVAILABLE')
        }
        semanticScope = { entityKind: row.kind, codename: row.codename }
    }

    const decodedComposition =
        layout.config === undefined
            ? undefined
            : decodeLayoutConfigEnvelope(layout.config, { templateKey: layout.templateKey }).neutral.composition
    const composition = layout.sourceComposition ?? layout.neutral?.composition ?? decodedComposition
    const compositionMode = layout.compositionMode ?? composition?.mode
    const baseLayoutId = layout.baseLayoutId ?? composition?.baseLayoutId ?? null
    if (compositionMode === 'independent' || (!compositionMode && !baseLayoutId)) {
        if (baseLayoutId) throw new Error('APPLICATION_LAYOUT_HASH_COMPOSITION_INVALID')
        return { semanticScope, baseLayoutContentHash: null }
    }
    if (compositionMode !== 'overlay' || !baseLayoutId) {
        throw new Error('APPLICATION_LAYOUT_HASH_COMPOSITION_INVALID')
    }

    const baseRows = await executor.query<BaseContentRow>(
        `SELECT template_key, scope_entity_id, local_content_hash, source_content_hash
         FROM ${layoutsTable}
         WHERE id = $1
           AND scope_entity_id IS NULL
           AND is_active = true
           AND _upl_deleted = false
           AND _app_deleted = false
         LIMIT 2`,
        [baseLayoutId]
    )
    const base = baseRows.length === 1 ? baseRows[0] : undefined
    if (!base || base.template_key !== layout.templateKey) throw new Error('APPLICATION_LAYOUT_HASH_BASE_UNAVAILABLE')
    const baseContentHash = base.local_content_hash ?? base.source_content_hash
    const parsedBaseHash = layoutHashSchema.safeParse(baseContentHash)
    if (!parsedBaseHash.success) throw new Error('APPLICATION_LAYOUT_HASH_BASE_UNAVAILABLE')
    return { semanticScope, baseLayoutContentHash: parsedBaseHash.data }
}

export const hashApplicationLayoutContentFromStore = async (
    executor: DbExecutor,
    schemaName: string,
    input: ApplicationLayoutHashInput
): Promise<string> => {
    const context = await resolveApplicationLayoutHashContext(executor, schemaName, input.layout)
    return hashApplicationLayoutContent({
        ...input,
        layout: { ...input.layout, ...context }
    })
}
