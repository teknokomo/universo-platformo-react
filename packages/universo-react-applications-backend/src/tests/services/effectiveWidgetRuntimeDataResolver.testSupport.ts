import { getLayoutWidgetDefinition, resolveWidgetBindingSlotDefinition } from '@universo-react/types'
import { createMockDbExecutor } from '../utils/dbMocks'
import * as runtimeStore from '../../persistence/widgetBindingRuntimeStore'
import * as runtimeObjectMetadata from '../../services/runtimeRowSupport/objectMetadata'
import * as runtimeAccess from '../../services/runtimeRowSupport/access'
import * as runtimeObjectCatalog from '../../services/runtimeRowSupport/runtimeObjectCatalog'
import * as runtimeUnion from '../../services/runtimeRowSupport/union/execution'
import type { RuntimeReadableComponent } from '../../services/runtimeRowSupport/contracts'
import { resolveEffectiveWidgetRuntimeData } from '../../services/effectiveWidgetRuntimeDataResolver'

export {
    createMockDbExecutor,
    getLayoutWidgetDefinition,
    resolveWidgetBindingSlotDefinition,
    runtimeStore,
    runtimeObjectMetadata,
    runtimeAccess,
    runtimeObjectCatalog,
    runtimeUnion,
    resolveEffectiveWidgetRuntimeData
}

export const objectId = '0190a9b5-3cde-7abc-8def-0123456789b1'
export const recordId = '0190a9b5-3cde-7abc-8def-0123456789b2'
export const componentId = '0190a9b5-3cde-7abc-8def-0123456789b3'
export const applicationId = '0190a9b5-3cde-7abc-8def-0123456789b4'
export const workspaceId = '0190a9b5-3cde-7abc-8def-0123456789b5'
export const metricObjectId = '0190a9b5-3cde-7abc-8def-0123456789c1'
export const parentObjectId = '0190a9b5-3cde-7abc-8def-0123456789c2'
export const childObjectId = '0190a9b5-3cde-7abc-8def-0123456789c3'
export const parentRecordId = '0190a9b5-3cde-7abc-8def-0123456789c4'
export const childRecordId = '0190a9b5-3cde-7abc-8def-0123456789c5'
export const learnerTargetRecordId = '0190a9b5-3cde-7abc-8def-0123456789c6'

export const dashboardRowsRuntimeComponents: RuntimeReadableComponent[] = [
    {
        id: componentId,
        codename: 'Title',
        column_name: 'cmp_title',
        data_type: 'STRING',
        is_required: true,
        is_display_component: true,
        presentation: {
            name: {
                _primary: 'en',
                locales: { en: { content: 'Title' }, ru: { content: 'RU Title' } }
            }
        },
        validation_rules: { localized: true },
        sort_order: 0,
        ui_config: {}
    },
    {
        id: childRecordId,
        codename: 'SortOrder',
        column_name: 'cmp_order',
        data_type: 'NUMBER',
        is_required: true,
        is_display_component: false,
        presentation: {
            name: {
                _primary: 'en',
                locales: { en: { content: 'Sort order' }, ru: { content: 'RU SortOrder' } }
            }
        },
        validation_rules: {},
        sort_order: 1,
        ui_config: {}
    }
]
export const metadataComponents = [
    {
        objectId,
        codename: 'Key',
        columnName: 'cmp_key',
        dataType: 'TEXT',
        isRequired: true,
        validationRules: { unique: true, maxLength: 128, pattern: '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$' }
    },
    {
        objectId,
        codename: 'Title',
        columnName: 'cmp_title',
        dataType: 'TEXT',
        isRequired: true,
        validationRules: { localized: true, maxLength: 255 }
    },
    {
        objectId,
        codename: 'Label',
        columnName: 'cmp_label',
        dataType: 'TEXT',
        isRequired: true,
        validationRules: { localized: true }
    },
    { objectId, codename: 'Href', columnName: 'cmp_href', dataType: 'TEXT', isRequired: true, validationRules: {} },
    { objectId, codename: 'Order', columnName: 'cmp_order', dataType: 'NUMBER', isRequired: true, validationRules: {} }
]

export const menuBindings = () => {
    const definition = getLayoutWidgetDefinition('menuWidget', { variant: 'manual' })
    const slot = definition?.bindingSlots?.find(({ key }) => key === 'items')
    if (!slot) throw new Error('Manual menu item binding is missing from the registry')
    return {
        version: 1,
        slots: [
            {
                slot: 'items',
                targets: [
                    {
                        entityKind: 'object',
                        entityCodename: 'MenuItems',
                        selector: { kind: 'record-set' },
                        projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                    }
                ]
            }
        ]
    }
}

export const menuHeadingBinding = () => {
    const definition = getLayoutWidgetDefinition('menuWidget', { variant: 'manual' })
    const slot = definition?.bindingSlots?.find(({ key }) => key === 'heading')
    if (!slot) throw new Error('Manual menu heading binding is missing from the registry')
    return {
        slot: 'heading',
        targets: [
            {
                entityKind: 'object',
                entityCodename: 'MenuItems',
                selector: { kind: 'semantic-key', field: 'key', value: 'main-navigation' },
                projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
            }
        ]
    }
}

export const candidateWithHeading = (overrides: Partial<Parameters<typeof resolveEffectiveWidgetRuntimeData>[2][number]> = {}) => ({
    ...candidate({ bindings: { ...menuBindings(), slots: [...menuBindings().slots, menuHeadingBinding()] } }),
    ...overrides
})

export const candidate = (overrides: Partial<Parameters<typeof resolveEffectiveWidgetRuntimeData>[2][number]> = {}) => ({
    id: 'placement-menu-1',
    widgetKey: 'menuWidget',
    config: { variant: 'manual' },
    isActive: true,
    bindings: menuBindings(),
    ...overrides
})

export const relationBuilderCandidate = (
    displayFields: Array<{ fieldCodename: string; valueType: 'string' | 'number' | 'boolean'; localized: boolean; required: boolean }> = []
) => {
    const config = {
        panels: [
            {
                slotKey: 'panel:materials',
                title: 'Materials',
                parentFieldCodename: 'Parent',
                ...(displayFields.length ? { displayFields } : {})
            }
        ]
    }
    const definition = getLayoutWidgetDefinition('relationBuilder', config)
    if (!definition) throw new Error('relationBuilder definition is missing from the registry')
    const parent = definition.bindingSlots?.find(({ key }) => key === 'parent')
    const panel = resolveWidgetBindingSlotDefinition(definition, 'panel:materials')
    if (!parent || !panel) throw new Error('relationBuilder binding contract is incomplete')
    const projection = (slot: typeof parent) =>
        slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
    return {
        id: 'placement-relation-1',
        widgetKey: 'relationBuilder',
        config,
        isActive: true,
        bindings: {
            version: 1,
            slots: [
                {
                    slot: 'parent',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'ParentRecords',
                            selector: { kind: 'record-set' },
                            projection: projection(parent)
                        }
                    ]
                },
                {
                    slot: 'panel:materials',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'MaterialRecords',
                            selector: { kind: 'relation-set', parentSlot: 'parent' },
                            projection: projection(panel)
                        }
                    ]
                }
            ]
        }
    }
}

export const recordSetCandidate = (
    widgetKey: 'overviewCards' | 'detailsTable',
    slotKey: 'metrics' | 'rows',
    entityCodename: string,
    configOverrides: Record<string, unknown> = {}
) => {
    const definition = getLayoutWidgetDefinition(widgetKey, {})
    const slot = definition?.bindingSlots?.find(({ key }) => key === slotKey)
    if (!slot) throw new Error(`${widgetKey} binding contract is incomplete`)
    return {
        id: `placement-${widgetKey}`,
        widgetKey,
        config: widgetKey === 'overviewCards' ? { maxCards: 4 } : { maxRows: 20, ...configOverrides },
        isActive: true,
        bindings: {
            version: 1,
            slots: [
                {
                    slot: slotKey,
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename,
                            selector: { kind: 'record-set' },
                            projection: slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
                        }
                    ]
                }
            ]
        }
    }
}

export const resolveDetailsTable = async (
    config: Record<string, unknown>,
    runtimeScope: typeof scope,
    records: Array<{ recordId: string; version?: number; data: Record<string, unknown> }>,
    options: {
        locale?: string
        entityCodename?: string
        components?: RuntimeReadableComponent[]
        reorderFieldCodename?: string | null
    } = {}
) => {
    const { executor } = createMockDbExecutor()
    const definition = getLayoutWidgetDefinition('detailsTable', config)
    const rows = definition?.bindingSlots?.find(({ key }) => key === 'rows')
    if (!rows) throw new Error('detailsTable rows slot is missing')
    const entityCodename = options.entityCodename ?? 'DashboardRows'
    const components = options.components ?? dashboardRowsRuntimeComponents
    const registeredLimit = rows.maxResolvedRecords ?? 100
    const configuredLimit = typeof config.maxRows === 'number' ? config.maxRows : registeredLimit
    const limit = Math.max(1, Math.min(configuredLimit, registeredLimit))
    ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValueOnce(
        metadataEnvelope([metadataForSlot(objectId, entityCodename, rows)])
    )
    ;(runtimeObjectCatalog.loadRuntimeReadableComponents as jest.Mock).mockResolvedValueOnce(components)
    const visibleRows = records.slice(0, limit).map(({ recordId: sourceRecordId, version, data }) => ({
        id: sourceRecordId,
        __runtimeObjectCollectionCodename: entityCodename,
        __runtimeSourceRowId: sourceRecordId,
        ...(version === undefined ? {} : { _upl_version: version }),
        ...Object.fromEntries(
            components.map((component) => {
                const codename = String(component.codename)
                const legacyField = codename === 'Title' ? 'title' : codename === 'SortOrder' ? 'order' : codename
                return [codename, data[codename] ?? data[legacyField]]
            })
        )
    }))
    ;(runtimeUnion.executeRuntimeRecordsUnionQuery as jest.Mock).mockResolvedValueOnce({
        targetPayloads: [
            {
                objectCollection: {},
                columns: components.map((component) => ({
                    field: String(component.codename),
                    headerName:
                        options.locale === 'ru'
                            ? component.codename === 'Title'
                                ? 'RU Title'
                                : component.codename === 'SortOrder'
                                ? 'RU SortOrder'
                                : String(component.codename)
                            : component.codename === 'SortOrder'
                            ? 'Sort order'
                            : String(component.codename)
                })),
                reorderFieldCodename:
                    options.reorderFieldCodename !== undefined
                        ? options.reorderFieldCodename
                        : config.enableRowReordering === true
                        ? 'SortOrder'
                        : null
            }
        ],
        rows: visibleRows,
        total: records.length,
        limit,
        offset: 0
    })

    const result = await resolveEffectiveWidgetRuntimeData(
        executor,
        { ...runtimeScope, applicationId: runtimeScope.applicationId ?? applicationId },
        [recordSetCandidate('detailsTable', 'rows', entityCodename, config)],
        options.locale ?? 'en'
    )
    return result.get('placement-detailsTable')
}

export const learnerPlayerCandidate = () => {
    const definition = getLayoutWidgetDefinition('learnerPlayer', { variant: 'course' })
    const parent = definition?.bindingSlots?.find(({ key }) => key === 'parent')
    const items = definition?.bindingSlots?.find(({ key }) => key === 'items')
    if (!parent || !items) throw new Error('learnerPlayer binding contract is incomplete')
    const projection = (slot: typeof parent) =>
        slot.requirements.components.map(({ field, componentCodename }) => ({ field, componentCodename }))
    return {
        id: 'placement-learner-player',
        widgetKey: 'learnerPlayer',
        config: { variant: 'course', displayMode: 'player', sequenceMode: 'strict' },
        isActive: true,
        bindings: {
            version: 1,
            slots: [
                {
                    slot: 'parent',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'Courses',
                            selector: { kind: 'record-set' },
                            projection: projection(parent)
                        }
                    ]
                },
                {
                    slot: 'items',
                    targets: [
                        {
                            entityKind: 'object',
                            entityCodename: 'CourseItems',
                            selector: { kind: 'relation-set', parentSlot: 'parent' },
                            projection: projection(items)
                        }
                    ]
                }
            ]
        }
    }
}

export const validationRulesFor = (requirement: {
    localized?: boolean
    maxLength?: number
    semanticKey?: boolean
    pattern?: string
    format?: string
}) => ({
    ...(requirement.localized === true ? { localized: true } : {}),
    ...(requirement.maxLength !== undefined ? { maxLength: requirement.maxLength } : {}),
    ...(requirement.semanticKey === true ? { unique: true } : {}),
    ...(requirement.pattern !== undefined ? { pattern: requirement.pattern } : {}),
    ...(requirement.format !== undefined ? { format: requirement.format } : {})
})

export const dataTypeFor = (valueType: string) =>
    ({ string: 'STRING', number: 'NUMBER', boolean: 'BOOLEAN', json: 'JSONB', ref: 'REF' }[valueType] ?? 'STRING')

export type RuntimeBindingSlot = NonNullable<NonNullable<ReturnType<typeof getLayoutWidgetDefinition>>['bindingSlots']>[number]

export const metadataForSlot = (objectIdValue: string, codename: string, slot: RuntimeBindingSlot, refTargetObjectId?: string) => ({
    id: objectIdValue,
    codename,
    kind: 'object',
    tableName: `app_${codename.toLowerCase()}`,
    config: { capabilities: { dataSchema: { enabled: true }, records: { enabled: true } } },
    components: slot.requirements.components.map((requirement, index) => ({
        objectId: objectIdValue,
        codename: requirement.componentCodename,
        columnName: `cmp_${index}`,
        dataType: dataTypeFor(requirement.valueType),
        isRequired: requirement.required,
        presentation: {
            name: {
                _primary: 'en',
                locales: { en: { content: requirement.componentCodename }, ru: { content: `RU ${requirement.componentCodename}` } }
            }
        },
        validationRules: validationRulesFor(requirement),
        ...(requirement.valueType === 'ref' && refTargetObjectId ? { targetObjectId: refTargetObjectId } : {})
    }))
})

export const metadataEnvelope = (entries: Array<ReturnType<typeof metadataForSlot>>) => ({
    objectsByCodename: new Map(entries.map(({ components: _components, ...object }) => [String(object.codename), object])),
    componentsByObjectId: new Map(entries.map(({ id, components }) => [String(id), components]))
})

export const scope = {
    applicationId: '019a10e5-0000-7000-8000-000000000001',
    schemaName: 'tenant_app',
    workspaceId,
    workspacesEnabled: true,
    currentUserId: 'authenticated-widget-reader',
    permissions: {
        manageMembers: false,
        manageApplication: false,
        createContent: false,
        editContent: false,
        deleteContent: false,
        readReports: false
    }
}

export const compatibleMetadata = () => ({
    objectsByCodename: new Map([
        [
            'MenuItems',
            {
                id: objectId,
                codename: 'MenuItems',
                kind: 'object',
                tableName: 'app_menu_items',
                config: { capabilities: { dataSchema: { enabled: true }, records: { enabled: true } } }
            }
        ]
    ]),
    componentsByObjectId: new Map([[objectId, metadataComponents]])
})

export const resetEffectiveWidgetRuntimeDataResolverMocks = () => {
    jest.clearAllMocks()
    ;(runtimeStore.loadPublishedDashboardMenuEntities as jest.Mock).mockResolvedValue([])
    ;(runtimeStore.loadRuntimeWidgetBindingMetadata as jest.Mock).mockResolvedValue(compatibleMetadata())
    ;(runtimeObjectCatalog.loadRuntimeReadableComponents as jest.Mock).mockResolvedValue(dashboardRowsRuntimeComponents)
    ;(runtimeStore.loadWidgetBindingRuntimeRecords as jest.Mock).mockResolvedValue([
        {
            recordId,
            data: {
                key: 'main-navigation',
                title: {
                    _primary: 'en',
                    locales: { en: { content: 'Main navigation' }, ru: { content: 'Основная навигация' } }
                },
                label: { locales: { en: { content: 'Course catalogue' } } },
                href: '/catalogue',
                order: 1,
                entityId: objectId,
                componentId,
                privateJson: { applicationId }
            }
        }
    ])
}
