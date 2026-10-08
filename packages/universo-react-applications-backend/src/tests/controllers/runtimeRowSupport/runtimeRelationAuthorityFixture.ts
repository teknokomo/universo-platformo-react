import { getLayoutWidgetDefinition, validateWidgetBindings } from '@universo-react/types'
import { attachApplicationLayoutWidgetSourceBindingState } from '../../../persistence/applicationLayoutStoreSupport'
import type { EffectiveLayoutWidget } from '../../../services/effectiveLayoutContract'
import { dashboardWidgetConfigSchemaByKey } from '@universo-react/types'

export const createRelationBuilderEffectiveWidget = (
    options: {
        parentEntityCodename?: string
        childEntityCodename?: string
        parentFieldCodename?: string
        sortOrderFieldCodename?: string
        enableRowReordering?: boolean
        isActive?: boolean
    } = {}
): EffectiveLayoutWidget => {
    const config = {
        panels: [
            {
                slotKey: 'panel:items',
                title: { en: 'Items', ru: 'Элементы' },
                parentFieldCodename: options.parentFieldCodename ?? 'CourseId',
                sortOrderFieldCodename: options.sortOrderFieldCodename ?? 'SortOrder',
                enableRowReordering: options.enableRowReordering ?? true
            }
        ]
    }
    const definition = getLayoutWidgetDefinition('relationBuilder', config)
    if (!definition?.bindingSlots) throw new Error('Expected relationBuilder binding slots')

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: definition.bindingSlots.map((slot) => ({
            slot: slot.key,
            targets: [
                {
                    entityKind: 'object',
                    entityCodename:
                        slot.key === 'parent' ? options.parentEntityCodename ?? 'Courses' : options.childEntityCodename ?? 'CourseItems',
                    selector: slot.key === 'parent' ? { kind: 'record-set' } : { kind: 'relation-set', parentSlot: 'parent' },
                    projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                }
            ]
        }))
    })
    const widget = {
        id: '019f2000-0000-7000-8000-000000000005',
        instanceKey: 'relation-items',
        parentInstanceKey: null,
        slotKey: null,
        zone: 'center',
        semanticRegion: 'main',
        widgetKey: 'relationBuilder',
        sortOrder: 0,
        config,
        isActive: options.isActive ?? true
    } satisfies EffectiveLayoutWidget

    return attachApplicationLayoutWidgetSourceBindingState(widget, { persistedApplicationRow: true, bindings })
}

export const createDetailsTableEffectiveWidget = (
    options: {
        entityCodename?: string
        enableRowReordering?: boolean
        isActive?: boolean
    } = {}
): EffectiveLayoutWidget => {
    const config = dashboardWidgetConfigSchemaByKey.detailsTable.parse({
        variant: 'records',
        enableRowReordering: options.enableRowReordering ?? true
    })
    const definition = getLayoutWidgetDefinition('detailsTable', config)
    if (!definition?.bindingSlots) throw new Error('Expected detailsTable binding slots')

    const bindings = validateWidgetBindings(definition, {
        version: 1,
        slots: definition.bindingSlots.map((slot) => ({
            slot: slot.key,
            targets: [
                {
                    entityKind: 'object',
                    entityCodename: options.entityCodename ?? 'Courses',
                    selector: { kind: 'record-set' },
                    projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                }
            ]
        }))
    })
    const widget = {
        id: '019f2000-0000-7000-8000-000000000008',
        instanceKey: 'course-records',
        parentInstanceKey: null,
        slotKey: null,
        zone: 'center',
        semanticRegion: 'main',
        widgetKey: 'detailsTable',
        sortOrder: 0,
        config,
        isActive: options.isActive ?? true
    } satisfies EffectiveLayoutWidget

    return attachApplicationLayoutWidgetSourceBindingState(widget, { persistedApplicationRow: true, bindings })
}
