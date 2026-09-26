import type { SqlQueryable } from '@universo-react/utils/database'
import { queryOne } from '@universo-react/utils/database'
import { qSchemaTable } from '@universo-react/database'
import { MetahubNotFoundError } from '../shared/domainErrors'
import { codenamePrimaryTextSql } from '../shared/codename'
import { acquireMetahubLayoutGraphLock } from './layoutGraphLocks'

type LockedBindingObject = {
    id: string
    kind: string
    codename: string
    config: unknown
}

/**
 * Use the same lock order for binding writes and policy-protected record writes:
 * graph first, then the authoritative Object row, then the target record/widget.
 */
export const acquireWidgetBindingObjectLock = async (
    db: SqlQueryable,
    schemaName: string,
    objectId: string
): Promise<LockedBindingObject> => {
    await acquireMetahubLayoutGraphLock(db, schemaName)

    const objectTable = qSchemaTable(schemaName, '_mhb_objects')
    const object = await queryOne<LockedBindingObject>(
        db,
        `SELECT id, kind, ${codenamePrimaryTextSql('codename')} AS codename, config
           FROM ${objectTable}
          WHERE id = $1
            AND _upl_deleted = false
            AND _mhb_deleted = false
          FOR UPDATE`,
        [objectId]
    )
    if (!object) throw new MetahubNotFoundError('Object')
    return object
}

/** Lock an Entity Object by its stable codename after acquiring the binding graph lock. */
export const acquireWidgetBindingObjectLockByCodename = async (
    db: SqlQueryable,
    schemaName: string,
    kind: string,
    codename: string,
    layoutGraphLockAlreadyHeld = false
): Promise<LockedBindingObject> => {
    if (!layoutGraphLockAlreadyHeld) await acquireMetahubLayoutGraphLock(db, schemaName)

    const object = await queryOne<LockedBindingObject>(
        db,
        [
            'SELECT id, kind, ' + codenamePrimaryTextSql('codename') + ' AS codename, config',
            'FROM ' + qSchemaTable(schemaName, '_mhb_objects'),
            'WHERE kind = $1',
            'AND ' + codenamePrimaryTextSql('codename') + ' = $2',
            'AND _upl_deleted = false',
            'AND _mhb_deleted = false',
            'LIMIT 1',
            'FOR UPDATE'
        ].join(' '),
        [kind, codename]
    )
    if (!object) throw new MetahubNotFoundError('Object')
    return object
}

type BindingLookup =
    | { type: 'semantic-key'; entityCodename: string; semanticKey: string }
    | { type: 'entity'; entityKind: string; entityCodename: string }

/** Check base and scoped override bindings; inactive live placements still own their target. */
const hasLiveEntityBinding = async (db: SqlQueryable, schemaName: string, lookup: BindingLookup): Promise<boolean> => {
    const widgetsTable = qSchemaTable(schemaName, '_mhb_widgets')
    const overridesTable = qSchemaTable(schemaName, '_mhb_layout_widget_overrides')
    const layoutsTable = qSchemaTable(schemaName, '_mhb_layouts')
    const filter =
        lookup.type === 'semantic-key'
            ? `value->>'entityKind' = 'object'
                AND value->>'entityCodename' = $1
                AND value->'selector'->>'kind' = 'semantic-key'
                AND value->'selector'->>'value' = $2`
            : `value->>'entityKind' = $1
                AND value->>'entityCodename' = $2`
    const params = lookup.type === 'semantic-key' ? [lookup.entityCodename, lookup.semanticKey] : [lookup.entityKind, lookup.entityCodename]
    const result = await queryOne<{ bound: boolean }>(
        db,
        `WITH persisted_configs AS (
             SELECT widget.config
               FROM ${widgetsTable} widget
               JOIN ${layoutsTable} layout ON layout.id = widget.layout_id
              WHERE widget._upl_deleted = false
                AND widget._mhb_deleted = false
                AND layout._upl_deleted = false
                AND layout._mhb_deleted = false
             UNION ALL
             SELECT layout_override.config
               FROM ${overridesTable} layout_override
               JOIN ${layoutsTable} layout ON layout.id = layout_override.layout_id
              WHERE layout_override.config IS NOT NULL
                AND layout_override.is_deleted_override = false
                AND layout_override._upl_deleted = false
                AND layout_override._mhb_deleted = false
                AND layout._upl_deleted = false
                AND layout._mhb_deleted = false
         ), slots AS (
             SELECT slot.value AS value
               FROM persisted_configs config
               CROSS JOIN LATERAL jsonb_array_elements(
                   CASE
                       WHEN jsonb_typeof(config.config #> '{__layout,bindings,slots}') = 'array'
                       THEN config.config #> '{__layout,bindings,slots}'
                       ELSE '[]'::jsonb
                   END
               ) AS slot(value)
         ), targets AS (
             SELECT target.value AS value
               FROM slots slot
               CROSS JOIN LATERAL jsonb_array_elements(
                   CASE WHEN jsonb_typeof(slot.value->'targets') = 'array'
                        THEN slot.value->'targets' ELSE '[]'::jsonb END
               ) AS target(value)
         )
         SELECT EXISTS (
             SELECT 1 FROM targets
              WHERE ${filter}
         ) AS bound`,
        params
    )
    return result?.bound === true
}

/**
 * Check bindings in base widgets and scoped overrides. Inactive placements
 * still own their target; only soft-deleted graph rows are excluded.
 */
export const isEntityRecordBoundBySemanticKey = async (
    db: SqlQueryable,
    schemaName: string,
    entityCodename: string,
    semanticKey: string
): Promise<boolean> => hasLiveEntityBinding(db, schemaName, { type: 'semantic-key', entityCodename, semanticKey })

/** Prevent deleting an Entity whose codename is still referenced by a live layout binding. */
export const isEntityBoundByCodename = async (
    db: SqlQueryable,
    schemaName: string,
    entityKind: string,
    entityCodename: string
): Promise<boolean> => hasLiveEntityBinding(db, schemaName, { type: 'entity', entityKind, entityCodename })
