import { qSchemaTable } from '@universo-react/database'
import { queryOne, type SqlQueryable } from '@universo-react/utils/database'
import { getLayoutWidgetDefinition, type WidgetBindingSlotDefinition } from '@universo-react/types'
import { listPersistedWidgetBindingReferences } from '../../../persistence/widgetBindingReferencesStore'
import { getCodenameText } from '../../shared/codename'
import { MetahubConflictError } from '../../shared/domainErrors'
import {
    assertWidgetBindingComponentMutation,
    isMarketingTemplateEntityMetadata,
    isWidgetBindingEntityMetadata
} from '../../shared/entityMetadataMutationPolicy'

const ACTIVE = '_upl_deleted = false AND _mhb_deleted = false'
const MAX_BINDING_CONTRACT_REFERENCES = 256

type WidgetBindingComponentState = {
    readonly codename: string
    readonly dataType: string
    readonly isRequired: boolean
    readonly validationRules: unknown
    readonly parentComponentId: string | null
    readonly targetEntityId: string | null
    readonly targetEntityKind: string | null
}

type WidgetBindingComponentMutationOperation = 'update' | 'delete' | 'set-display' | 'move'

type WidgetBindingComponentMutationPatch = {
    codename?: unknown
    dataType?: string
    isRequired?: boolean
    isDisplayComponent?: boolean
    validationRules?: unknown
    parentComponentId?: string | null
    targetEntityId?: string | null
    targetEntityKind?: string | null
}

const parseJsonObject = (value: unknown): Record<string, unknown> => {
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
    if (typeof value !== 'string') return {}
    try {
        const parsed: unknown = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {}
    } catch {
        return {}
    }
}

const listBoundWidgetBindingSlotsForEntity = async (
    schemaName: string,
    entityCodename: string,
    runner: SqlQueryable
): Promise<WidgetBindingSlotDefinition[]> => {
    const rows = await listPersistedWidgetBindingReferences(runner, schemaName, {
        entityKind: 'object',
        entityCodename,
        limit: MAX_BINDING_CONTRACT_REFERENCES + 1
    })

    if (rows.length > MAX_BINDING_CONTRACT_REFERENCES) {
        throw new MetahubConflictError('The Entity is used by too many layout bindings to validate a Component schema mutation safely.')
    }

    const slotsByIdentity = new Map<string, WidgetBindingSlotDefinition>()
    for (const row of rows) {
        const rendererConfig = parseJsonObject(row.config)
        const slot = getLayoutWidgetDefinition(row.widget_key, rendererConfig)?.bindingSlots?.find(({ key }) => key === row.slot_key)
        if (!slot) {
            throw new MetahubConflictError(
                'A live layout binding uses an unregistered source contract; Component schema changes are blocked.'
            )
        }
        const identity = `${row.widget_key}:${slot.key}:${String(rendererConfig.variant ?? '')}`
        slotsByIdentity.set(identity, slot)
    }
    return Array.from(slotsByIdentity.values())
}

export const assertWidgetBindingComponentMutationAllowed = async ({
    schemaName,
    objectCollectionId,
    componentId,
    runner,
    operation,
    patch,
    mapRowToComponent
}: {
    schemaName: string
    objectCollectionId: string
    componentId: string
    runner: SqlQueryable
    operation: WidgetBindingComponentMutationOperation
    patch?: WidgetBindingComponentMutationPatch
    mapRowToComponent: (row: Record<string, unknown>) => WidgetBindingComponentState
}): Promise<void> => {
    const objectsTable = qSchemaTable(schemaName, '_mhb_objects')
    const componentsTable = qSchemaTable(schemaName, '_mhb_components')
    const object = await queryOne<{ codename: unknown; config: unknown }>(
        runner,
        `SELECT codename, config FROM ${objectsTable}
         WHERE id = $1 AND kind = $2 AND ${ACTIVE}
         LIMIT 1 FOR SHARE`,
        [objectCollectionId, 'object']
    )
    if (!object) return
    const entityCodename = getCodenameText(object.codename)
    const templateEntity = isMarketingTemplateEntityMetadata(entityCodename, object.config)
    const managedEntity = isWidgetBindingEntityMetadata(entityCodename, object.config)
    const bindingSlots = templateEntity ? [] : await listBoundWidgetBindingSlotsForEntity(schemaName, entityCodename, runner)
    const isBound = templateEntity || managedEntity || bindingSlots.length > 0
    if (!isBound) return

    const componentRow = await queryOne<Record<string, unknown>>(
        runner,
        `SELECT * FROM ${componentsTable}
         WHERE id = $1 AND object_id = $2 AND ${ACTIVE}
         LIMIT 1 FOR UPDATE`,
        [componentId, objectCollectionId]
    )
    if (!componentRow) return

    const current = mapRowToComponent(componentRow)
    const nextCodename = patch?.codename === undefined ? current.codename : getCodenameText(patch.codename)
    const next =
        operation === 'delete'
            ? undefined
            : {
                  codename: nextCodename,
                  dataType: patch?.dataType ?? current.dataType,
                  isRequired:
                      operation === 'set-display' || patch?.isDisplayComponent === true ? true : patch?.isRequired ?? current.isRequired,
                  validationRules: patch?.validationRules ?? current.validationRules,
                  parentComponentId: patch?.parentComponentId === undefined ? current.parentComponentId : patch.parentComponentId,
                  targetEntityId: patch?.targetEntityId === undefined ? current.targetEntityId : patch.targetEntityId,
                  targetEntityKind: patch?.targetEntityKind === undefined ? current.targetEntityKind : patch.targetEntityKind
              }

    assertWidgetBindingComponentMutation({
        entityCodename,
        entityConfig: object.config,
        isBound,
        bindingSlots,
        current,
        next,
        operation
    })
}
