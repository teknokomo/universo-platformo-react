import type { WidgetBindingSlotDefinition, WidgetBindingEntityKind } from '@universo-react/types'
import { qColumn, qSchema, qTable } from '@universo-react/database'
import type { SqlQueryable } from '@universo-react/utils/database'
import { queryMany, queryOne } from '@universo-react/utils/database'
import { listPersistedWidgetBindingReferences } from '../../persistence/widgetBindingReferencesStore'
import { codenamePrimaryTextSql } from '../shared/codename'
import { MetahubConflictError, MetahubNotFoundError } from '../shared/domainErrors'

const table = (schemaName: string, tableName: string): string => `${qSchema(schemaName)}.${qTable(tableName)}`
const column = (alias: string, name: string): string => `${alias}.${qColumn(name)}`
const active = (alias: string): string => `${column(alias, '_upl_deleted')} = false AND ${column(alias, '_mhb_deleted')} = false`
const codename = (alias: string): string => codenamePrimaryTextSql(column(alias, 'codename'))
const searchPattern = (search?: string): string | null => (search === undefined ? null : `%${search.replace(/[\\%_]/gu, '\\$&')}%`)

export const MAX_WIDGET_BINDING_SOURCE_OPTIONS = 250
export const MAX_WIDGET_BINDING_RECORD_OPTIONS = 100

export interface BindingWidgetRow {
    id: string
    layout_id: string
    template_key: string
    scope_entity_id: string | null
    base_layout_id: string | null
    widget_key: string
    zone: string
    config: unknown
    widget_version: number
}

export interface BindingLayoutRow {
    id: string
    template_key: string
    scope_entity_id: string | null
    base_layout_id: string | null
}

export interface BindingObjectRow {
    id: string
    kind: string
    codename: string
    presentation: unknown
    config: unknown
    capabilities: unknown
}

export interface BindingObjectRecordCount {
    readonly object_id: string
    readonly records_count: number
}

export interface BindingComponentRow {
    object_id: string
    codename: string
    data_type: string
    is_required: boolean
    validation_rules: unknown
    target_object_id: string | null
    target_object_kind: string | null
    target_object_codename: string | null
}

export interface BindingRecordRow {
    id: string
    data: unknown
    version: number
}

export interface BindingSourceRequirements {
    readonly entityKinds?: readonly WidgetBindingEntityKind[]
    readonly entityCodenames?: readonly string[]
    readonly entityCapabilities: readonly string[]
    readonly components: WidgetBindingSlotDefinition['requirements']['components']
}

/** Load a live binding-owning source-layout widget in the metahub's own schema. */
export const loadWidgetBindingWidget = async (
    db: SqlQueryable,
    schemaName: string,
    widgetId: string,
    lockForUpdate = false
): Promise<BindingWidgetRow> => {
    const widgetTable = table(schemaName, '_mhb_widgets')
    const layoutTable = table(schemaName, '_mhb_layouts')
    const lockClause = lockForUpdate ? 'FOR UPDATE OF widget' : ''
    const row = await queryOne<BindingWidgetRow>(
        db,
        `SELECT ${column('widget', 'id')} AS id,
                ${column('widget', 'layout_id')} AS layout_id,
                ${column('layout', 'template_key')} AS template_key,
                ${column('layout', 'scope_entity_id')} AS scope_entity_id,
                ${column('layout', 'base_layout_id')} AS base_layout_id,
                ${column('widget', 'widget_key')} AS widget_key,
                ${column('widget', 'zone')} AS zone,
                ${column('widget', 'config')} AS config,
                COALESCE(${column('widget', '_upl_version')}, 1)::int AS widget_version
           FROM ${widgetTable} AS widget
           JOIN ${layoutTable} AS layout ON ${column('layout', 'id')} = ${column('widget', 'layout_id')}
          WHERE ${column('widget', 'id')} = $1
            AND ${active('widget')}
            AND ${active('layout')}
            AND ${column('layout', 'base_layout_id')} IS NULL
          LIMIT 1
          ${lockClause}`,
        [widgetId]
    )
    if (!row) throw new MetahubNotFoundError('Source layout widget')
    return row
}

/** Load a live source layout before provisioning a widget binding source. */
export const loadWidgetBindingSourceLayout = async (
    db: SqlQueryable,
    schemaName: string,
    layoutId: string,
    lockForUpdate = false
): Promise<BindingLayoutRow> => {
    const layoutTable = table(schemaName, '_mhb_layouts')
    const lockClause = lockForUpdate ? 'FOR UPDATE' : ''
    const row = await queryOne<BindingLayoutRow>(
        db,
        `SELECT ${column('layout', 'id')} AS id,
                ${column('layout', 'template_key')} AS template_key,
                ${column('layout', 'scope_entity_id')} AS scope_entity_id,
                ${column('layout', 'base_layout_id')} AS base_layout_id
           FROM ${layoutTable} AS layout
          WHERE ${active('layout')}
            AND ${column('layout', 'id')} = $1
          LIMIT 1
          ${lockClause}`,
        [layoutId]
    )
    if (!row) throw new MetahubNotFoundError('Source layout')
    return row
}

/** Discover bounded candidate Objects; callers still validate capabilities and slot Components. */
export const listWidgetBindingObjectCandidates = async (
    db: SqlQueryable,
    schemaName: string,
    requirements: BindingSourceRequirements,
    offset: number,
    search?: string
): Promise<BindingObjectRow[]> => {
    const objectsTable = table(schemaName, '_mhb_objects')
    const definitionsTable = table(schemaName, '_mhb_entity_type_definitions')
    const rows = await queryMany<BindingObjectRow>(
        db,
        `SELECT ${column('object', 'id')} AS id,
                ${column('object', 'kind')} AS kind,
                ${codename('object')} AS codename,
                ${column('object', 'presentation')} AS presentation,
                ${column('object', 'config')} AS config,
                ${column('definition', 'capabilities')} AS capabilities
           FROM ${objectsTable} AS object
           JOIN ${definitionsTable} AS definition
             ON ${column('definition', 'kind_key')} = ${column('object', 'kind')}
            AND ${active('definition')}
          WHERE ${active('object')}
            AND ${column('object', 'kind')} = ANY($1::text[])
            AND ($5::text[] IS NULL OR ${codename('object')} = ANY($5::text[]))
            AND ($4::text IS NULL
                 OR ${codename('object')} ILIKE $4 ESCAPE E'\\\\'
                 OR COALESCE(${column('object', 'presentation')} -> 'name', 'null'::jsonb)::text ILIKE $4 ESCAPE E'\\\\')
          ORDER BY ${codename('object')} ASC, ${column('object', 'id')} ASC
          LIMIT $2 OFFSET $3`,
        [
            requirements.entityKinds?.length ? [...requirements.entityKinds] : ['object'],
            MAX_WIDGET_BINDING_SOURCE_OPTIONS + 1,
            offset,
            searchPattern(search),
            requirements.entityCodenames ? [...requirements.entityCodenames] : null
        ]
    )
    return rows
}

/** Count active records only after source compatibility has reduced the Object set. */
export const countWidgetBindingObjectRecords = async (
    db: SqlQueryable,
    schemaName: string,
    objectIds: readonly string[]
): Promise<BindingObjectRecordCount[]> => {
    if (objectIds.length === 0) return []
    return queryMany<BindingObjectRecordCount>(
        db,
        `SELECT ${column('record', 'object_id')} AS object_id,
                COUNT(*)::int AS records_count
           FROM ${table(schemaName, '_mhb_elements')} AS record
          WHERE ${column('record', 'object_id')} = ANY($1::uuid[])
            AND ${active('record')}
          GROUP BY ${column('record', 'object_id')}`,
        [[...objectIds]]
    )
}

/** Resolve one active Object by its stable codename inside the selected metahub schema. */
export const loadWidgetBindingObject = async (db: SqlQueryable, schemaName: string, objectId: string): Promise<BindingObjectRow> => {
    const object = await queryOne<BindingObjectRow>(
        db,
        `SELECT ${column('object', 'id')} AS id,
                ${column('object', 'kind')} AS kind,
                ${codename('object')} AS codename,
                ${column('object', 'presentation')} AS presentation,
                ${column('object', 'config')} AS config,
                ${column('definition', 'capabilities')} AS capabilities
           FROM ${table(schemaName, '_mhb_objects')} AS object
           JOIN ${table(schemaName, '_mhb_entity_type_definitions')} AS definition
             ON ${column('definition', 'kind_key')} = ${column('object', 'kind')}
            AND ${active('definition')}
          WHERE ${column('object', 'id')} = $1
            AND ${active('object')}
          LIMIT 1`,
        [objectId]
    )
    if (!object) throw new MetahubNotFoundError('Binding source Object')
    return object
}

/** Locate an active source by registry-allowed kind and semantic codename. */
export const findWidgetBindingObjectByCodename = async (
    db: SqlQueryable,
    schemaName: string,
    requirements: BindingSourceRequirements,
    sourceKey: string
): Promise<BindingObjectRow | null> =>
    queryOne<BindingObjectRow>(
        db,
        `SELECT ${column('object', 'id')} AS id,
                ${column('object', 'kind')} AS kind,
                ${codename('object')} AS codename,
                ${column('object', 'presentation')} AS presentation,
                ${column('object', 'config')} AS config,
                ${column('definition', 'capabilities')} AS capabilities
           FROM ${table(schemaName, '_mhb_objects')} AS object
           JOIN ${table(schemaName, '_mhb_entity_type_definitions')} AS definition
             ON ${column('definition', 'kind_key')} = ${column('object', 'kind')}
            AND ${active('definition')}
          WHERE ${active('object')}
            AND ${column('object', 'kind')} = ANY($1::text[])
            AND ${codename('object')} = $2
            AND ($3::text[] IS NULL OR ${codename('object')} = ANY($3::text[]))
          ORDER BY ${column('object', 'kind')} ASC, ${column('object', 'id')} ASC
          LIMIT 1`,
        [
            requirements.entityKinds?.length ? [...requirements.entityKinds] : ['object'],
            sourceKey,
            requirements.entityCodenames ? [...requirements.entityCodenames] : null
        ]
    )

/** Read active root-Component metadata, including the declared REF target, for server-side matching. */
export const listWidgetBindingComponents = async (
    db: SqlQueryable,
    schemaName: string,
    objectIds: readonly string[]
): Promise<BindingComponentRow[]> => {
    if (objectIds.length === 0) return []
    return queryMany<BindingComponentRow>(
        db,
        `SELECT ${column('component', 'object_id')} AS object_id,
                ${codename('component')} AS codename,
                ${column('component', 'data_type')} AS data_type,
                ${column('component', 'is_required')} AS is_required,
                ${column('component', 'validation_rules')} AS validation_rules,
                ${column('component', 'target_object_id')} AS target_object_id,
                ${column('component', 'target_object_kind')} AS target_object_kind,
                ${codename('target_object')} AS target_object_codename
           FROM ${table(schemaName, '_mhb_components')} AS component
           LEFT JOIN ${table(schemaName, '_mhb_objects')} AS target_object
             ON ${column('target_object', 'id')} = ${column('component', 'target_object_id')}
            AND ${active('target_object')}
          WHERE ${column('component', 'object_id')} = ANY($1::uuid[])
            AND ${column('component', 'parent_component_id')} IS NULL
            AND ${active('component')}
          ORDER BY ${column('component', 'object_id')} ASC, ${codename('component')} ASC`,
        [[...objectIds]]
    )
}

/** Resolve a semantic-key record under the already-held Object policy lock. */
export const findWidgetBindingRecordBySemanticKey = async (
    db: SqlQueryable,
    schemaName: string,
    objectId: string,
    semanticKeyCodename: string,
    semanticKey: string
): Promise<BindingRecordRow[]> =>
    queryMany<BindingRecordRow>(
        db,
        `SELECT ${column('record', 'id')} AS id,
                ${column('record', 'data')} AS data,
                COALESCE(${column('record', '_upl_version')}, 1)::int AS version
           FROM ${table(schemaName, '_mhb_elements')} AS record
          WHERE ${column('record', 'object_id')} = $1
            AND ${active('record')}
            AND ${column('record', 'data')} ->> $2::text = $3
          ORDER BY ${column('record', 'id')} ASC
          LIMIT 2
          FOR SHARE`,
        [objectId, semanticKeyCodename, semanticKey]
    )

/** Return only records carrying the slot's registry-declared semantic key. */
export const listWidgetBindingSemanticRecords = async (
    db: SqlQueryable,
    schemaName: string,
    objectId: string,
    semanticKeyCodename: string,
    limit: number,
    offset: number,
    search?: string,
    searchableComponentCodenames: readonly string[] = []
): Promise<BindingRecordRow[]> =>
    queryMany<BindingRecordRow>(
        db,
        `SELECT ${column('record', 'id')} AS id,
                ${column('record', 'data')} AS data,
                COALESCE(${column('record', '_upl_version')}, 1)::int AS version
           FROM ${table(schemaName, '_mhb_elements')} AS record
          WHERE ${column('record', 'object_id')} = $1
            AND ${active('record')}
            AND NULLIF(${column('record', 'data')} ->> $2::text, '') IS NOT NULL
            AND ($5::text IS NULL OR EXISTS (
                SELECT 1
                  FROM unnest($6::text[]) AS searchable_component(codename)
                 WHERE COALESCE(${column('record', 'data')} ->> searchable_component.codename, '') ILIKE $5 ESCAPE E'\\\\'
            ))
          ORDER BY ${column('record', 'data')} ->> $2::text ASC, ${column('record', 'id')} ASC
          LIMIT $3 OFFSET $4`,
        [objectId, semanticKeyCodename, limit, offset, searchPattern(search), [...searchableComponentCodenames]]
    )

/** Return candidate child Objects whose required relation values all belong to the chosen parent Object. */
export const listWidgetBindingRelationCompatibleObjectIds = async (
    db: SqlQueryable,
    schemaName: string,
    childObjectIds: readonly string[],
    parentObjectId: string,
    relationComponentCodename: string,
    relationRequired: boolean
): Promise<string[]> => {
    if (childObjectIds.length === 0) return []
    const rows = await queryMany<{ object_id: string }>(
        db,
        `SELECT candidate.object_id
           FROM unnest($1::uuid[]) AS candidate(object_id)
          WHERE NOT EXISTS (
                SELECT 1
                  FROM ${table(schemaName, '_mhb_elements')} AS child_record
                 WHERE ${column('child_record', 'object_id')} = candidate.object_id
                   AND ${active('child_record')}
                   AND (
                       ($4::boolean AND NULLIF(${column('child_record', 'data')} ->> $3::text, '') IS NULL)
                       OR (
                           NULLIF(${column('child_record', 'data')} ->> $3::text, '') IS NOT NULL
                           AND NOT EXISTS (
                               SELECT 1
                                 FROM ${table(schemaName, '_mhb_elements')} AS parent_record
                                WHERE ${column('parent_record', 'object_id')} = $2::uuid
                                  AND ${active('parent_record')}
                                  AND ${column('parent_record', 'id')}::text = ${column('child_record', 'data')} ->> $3::text
                           )
                       )
                   )
          )
          ORDER BY candidate.object_id ASC`,
        [[...childObjectIds], parentObjectId, relationComponentCodename, relationRequired]
    )
    return rows.map(({ object_id }) => object_id)
}

/** Check source usage across live widgets and scoped overrides in this schema. */
export const hasWidgetBindingUsage = async (
    db: SqlQueryable,
    schemaName: string,
    input: {
        entityKind: string
        entityCodename: string
        semanticKey?: string
        excludeWidgetId?: string
    }
): Promise<boolean> => {
    const references = await listPersistedWidgetBindingReferences(db, schemaName, {
        entityKind: input.entityKind,
        entityCodename: input.entityCodename,
        semanticKey: input.semanticKey,
        excludeWidgetId: input.excludeWidgetId,
        limit: 1
    })
    return references.length > 0
}

/** Persist one registry-validated envelope and enforce optimistic concurrency. */
export const updateWidgetBindingConfig = async (
    db: SqlQueryable,
    schemaName: string,
    input: {
        widgetId: string
        layoutId: string
        expectedVersion: number
        config: Record<string, unknown>
        userId?: string | null
    }
): Promise<number> => {
    const layoutTable = table(schemaName, '_mhb_layouts')
    const updated = await queryMany<{ widget_version: number }>(
        db,
        `UPDATE ${table(schemaName, '_mhb_widgets')} AS widget
            SET ${qColumn('config')} = $1::jsonb,
                ${qColumn('_upl_updated_at')} = $2,
                ${qColumn('_upl_updated_by')} = $3,
                ${qColumn('_upl_version')} = COALESCE(${column('widget', '_upl_version')}, 1) + 1
          WHERE ${column('widget', 'id')} = $4
            AND ${column('widget', 'layout_id')} = $5
            AND ${active('widget')}
            AND COALESCE(${column('widget', '_upl_version')}, 1) = $6
            AND EXISTS (
                SELECT 1
                  FROM ${layoutTable} AS layout
                 WHERE ${column('layout', 'id')} = ${column('widget', 'layout_id')}
                   AND ${active('layout')}
                   AND ${column('layout', 'base_layout_id')} IS NULL
            )
          RETURNING COALESCE(${column('widget', '_upl_version')}, 1)::int AS widget_version`,
        [JSON.stringify(input.config), new Date(), input.userId ?? null, input.widgetId, input.layoutId, input.expectedVersion]
    )
    const version = updated[0]?.widget_version
    if (typeof version !== 'number') throw new MetahubConflictError('Widget bindings changed while they were being updated')
    return version
}
