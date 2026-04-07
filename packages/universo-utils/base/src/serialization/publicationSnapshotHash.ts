import { getCodenamePrimary } from '../vlc'
import type { CatalogSystemFieldsSnapshot, MetahubSnapshotVersionEnvelope } from '@universo/types'

type SnapshotRecord = Record<string, unknown>

export interface PublicationSnapshotHashInput {
    version?: unknown
    versionEnvelope?: MetahubSnapshotVersionEnvelope
    metahubId?: unknown
    entities?: Record<string, unknown>
    elements?: Record<string, unknown>
    enumerationValues?: Record<string, unknown>
    constants?: Record<string, unknown>
    systemFields?: Record<string, CatalogSystemFieldsSnapshot | SnapshotRecord>
    scripts?: unknown
    layouts?: unknown
    catalogLayouts?: unknown
    layoutZoneWidgets?: unknown
    catalogLayoutWidgetOverrides?: unknown
    defaultLayoutId?: unknown
    layoutConfig?: unknown
}

export interface NormalizePublicationSnapshotForHashOptions {
    defaultVersionEnvelope?: MetahubSnapshotVersionEnvelope
}

const asArray = <Value>(value: unknown): Value[] => (Array.isArray(value) ? (value as Value[]) : [])
const asRecord = (value: unknown): SnapshotRecord => (value && typeof value === 'object' ? (value as SnapshotRecord) : {})

const normalizeCodenameValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
        return value
    }

    return value && typeof value === 'object' ? value : ''
}

const resolveCodenameSortText = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
    }

    return value && typeof value === 'object' ? getCodenamePrimary(value as Parameters<typeof getCodenamePrimary>[0]) : ''
}

const normalizeLayout = (layoutValue: unknown): Record<string, unknown> => {
    const layout = asRecord(layoutValue)

    return {
        id: typeof layout.id === 'string' ? layout.id : '',
        templateKey: layout.templateKey,
        name: layout.name ?? {},
        description: layout.description ?? null,
        config: layout.config ?? {},
        isDefault: Boolean(layout.isDefault),
        isActive: Boolean(layout.isActive),
        sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
    }
}

const normalizeScriptManifest = (manifestValue: unknown): Record<string, unknown> => {
    const manifest = asRecord(manifestValue)

    return {
        className: typeof manifest.className === 'string' ? manifest.className : '',
        sdkApiVersion: typeof manifest.sdkApiVersion === 'string' ? manifest.sdkApiVersion : '',
        moduleRole: typeof manifest.moduleRole === 'string' ? manifest.moduleRole : '',
        sourceKind: typeof manifest.sourceKind === 'string' ? manifest.sourceKind : '',
        capabilities: asArray<unknown>(manifest.capabilities)
            .map((capability) => String(capability ?? ''))
            .sort((left, right) => left.localeCompare(right)),
        methods: asArray<unknown>(manifest.methods)
            .map((methodValue) => {
                const method = asRecord(methodValue)

                return {
                    name: typeof method.name === 'string' ? method.name : '',
                    target: typeof method.target === 'string' ? method.target : '',
                    eventName: typeof method.eventName === 'string' ? method.eventName : null
                }
            })
            .sort((left, right) => {
                if ((left.target as string) !== (right.target as string)) {
                    return (left.target as string).localeCompare(right.target as string)
                }
                if ((left.eventName as string | null) !== (right.eventName as string | null)) {
                    return String(left.eventName ?? '').localeCompare(String(right.eventName ?? ''))
                }
                return (left.name as string).localeCompare(right.name as string)
            }),
        checksum: typeof manifest.checksum === 'string' ? manifest.checksum : null
    }
}

const normalizeScript = (scriptValue: unknown): Record<string, unknown> => {
    const script = asRecord(scriptValue)

    return {
        id: typeof script.id === 'string' ? script.id : '',
        codename: normalizeCodenameValue(script.codename),
        presentation: script.presentation ?? {},
        attachedToKind: typeof script.attachedToKind === 'string' ? script.attachedToKind : '',
        attachedToId: typeof script.attachedToId === 'string' ? script.attachedToId : null,
        moduleRole: typeof script.moduleRole === 'string' ? script.moduleRole : '',
        sourceKind: typeof script.sourceKind === 'string' ? script.sourceKind : '',
        sdkApiVersion: typeof script.sdkApiVersion === 'string' ? script.sdkApiVersion : '',
        sourceCode: typeof script.sourceCode === 'string' ? script.sourceCode : null,
        manifest: normalizeScriptManifest(script.manifest),
        serverBundle: typeof script.serverBundle === 'string' ? script.serverBundle : null,
        clientBundle: typeof script.clientBundle === 'string' ? script.clientBundle : null,
        checksum: typeof script.checksum === 'string' ? script.checksum : '',
        isActive: script.isActive !== false,
        config: script.config ?? {}
    }
}

const normalizeField = (fieldValue: unknown): Record<string, unknown> => {
    const field = asRecord(fieldValue)
    const sortOrder = typeof field.sortOrder === 'number' ? field.sortOrder : 0

    return {
        id: typeof field.id === 'string' ? field.id : '',
        codename: normalizeCodenameValue(field.codename),
        dataType: field.dataType,
        isRequired: Boolean(field.isRequired),
        isDisplayAttribute: Boolean(field.isDisplayAttribute),
        targetEntityId: typeof field.targetEntityId === 'string' ? field.targetEntityId : null,
        targetEntityKind: typeof field.targetEntityKind === 'string' ? field.targetEntityKind : null,
        targetConstantId: typeof field.targetConstantId === 'string' ? field.targetConstantId : null,
        presentation: field.presentation ?? {},
        validationRules: field.validationRules ?? {},
        uiConfig: field.uiConfig ?? {},
        sortOrder,
        parentAttributeId: typeof field.parentAttributeId === 'string' ? field.parentAttributeId : null,
        childFields: field.childFields
            ? asArray<unknown>(field.childFields)
                  .map((childFieldValue) => {
                      const childField = normalizeField(childFieldValue)
                      const { parentAttributeId: _parentAttributeId, childFields: _childFields, ...normalizedChildField } = childField
                      return normalizedChildField
                  })
                  .sort((left, right) => {
                      if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                          return (left.sortOrder as number) - (right.sortOrder as number)
                      }
                      if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                          return resolveCodenameSortText(left.codename).localeCompare(resolveCodenameSortText(right.codename))
                      }
                      return (left.id as string).localeCompare(right.id as string)
                  })
            : undefined
    }
}

export const normalizePublicationSnapshotForHash = (
    snapshot: PublicationSnapshotHashInput,
    options: NormalizePublicationSnapshotForHashOptions = {}
): Record<string, unknown> => {
    const snapshotSystemFields =
        snapshot.systemFields && typeof snapshot.systemFields === 'object'
            ? (snapshot.systemFields as Record<string, CatalogSystemFieldsSnapshot | SnapshotRecord>)
            : null

    const entities = Object.values(snapshot.entities ?? {})
        .map((entityValue) => {
            const entity = asRecord(entityValue)
            const entityId = typeof entity.id === 'string' ? entity.id : ''

            return {
                id: entityId,
                kind: typeof entity.kind === 'string' ? entity.kind : '',
                codename: normalizeCodenameValue(entity.codename),
                tableName:
                    typeof entity.physicalTableName === 'string'
                        ? entity.physicalTableName
                        : typeof entity.tableName === 'string'
                        ? entity.tableName
                        : undefined,
                presentation: entity.presentation ?? {},
                config: entity.config ?? {},
                systemFields: snapshotSystemFields?.[entityId] ?? null,
                hubs: asArray<string>(entity.hubs).sort(),
                fields: asArray<unknown>(entity.fields)
                    .map(normalizeField)
                    .sort((left, right) => {
                        if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                            return (left.sortOrder as number) - (right.sortOrder as number)
                        }
                        if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                            return resolveCodenameSortText(left.codename).localeCompare(resolveCodenameSortText(right.codename))
                        }
                        return (left.id as string).localeCompare(right.id as string)
                    })
            }
        })
        .sort((left, right) => {
            if (left.kind !== right.kind) return left.kind.localeCompare(right.kind)
                if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                    return resolveCodenameSortText(left.codename).localeCompare(resolveCodenameSortText(right.codename))
                }
            return left.id.localeCompare(right.id)
        })

    const elements = Object.entries(snapshot.elements ?? {})
        .map(([objectId, list]) => ({
            objectId,
            elements: asArray<SnapshotRecord>(list)
                .map((element) => ({
                    id: typeof element.id === 'string' ? element.id : '',
                    data: element.data ?? {},
                    sortOrder: typeof element.sortOrder === 'number' ? element.sortOrder : 0
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const enumerationValues = Object.entries(snapshot.enumerationValues ?? {})
        .map(([objectId, list]) => ({
            objectId,
            values: asArray<SnapshotRecord>(list)
                .map((value) => ({
                    id: typeof value.id === 'string' ? value.id : '',
                    codename: normalizeCodenameValue(value.codename),
                    presentation: value.presentation ?? {},
                    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
                    isDefault: Boolean(value.isDefault)
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                        return resolveCodenameSortText(left.codename).localeCompare(resolveCodenameSortText(right.codename))
                    }
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const constants = Object.entries(snapshot.constants ?? {})
        .map(([objectId, list]) => ({
            objectId,
            constants: asArray<SnapshotRecord>(list)
                .map((constant) => ({
                    id: typeof constant.id === 'string' ? constant.id : '',
                    codename: normalizeCodenameValue(constant.codename),
                    dataType: constant.dataType,
                    presentation: constant.presentation ?? {},
                    validationRules: constant.validationRules ?? {},
                    uiConfig: constant.uiConfig ?? {},
                    value: constant.value ?? null,
                    sortOrder: typeof constant.sortOrder === 'number' ? constant.sortOrder : 0
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                        return resolveCodenameSortText(left.codename).localeCompare(resolveCodenameSortText(right.codename))
                    }
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const scripts = asArray<unknown>(snapshot.scripts)
        .map(normalizeScript)
        .sort((left, right) => {
            if ((left.attachedToKind as string) !== (right.attachedToKind as string)) {
                return (left.attachedToKind as string).localeCompare(right.attachedToKind as string)
            }
            if ((left.attachedToId as string | null) !== (right.attachedToId as string | null)) {
                return String(left.attachedToId ?? '').localeCompare(String(right.attachedToId ?? ''))
            }
            if ((left.moduleRole as string) !== (right.moduleRole as string)) {
                return (left.moduleRole as string).localeCompare(right.moduleRole as string)
            }
            if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                return resolveCodenameSortText(left.codename).localeCompare(resolveCodenameSortText(right.codename))
            }
            return (left.id as string).localeCompare(right.id as string)
        })

    const layouts = asArray<unknown>(snapshot.layouts)
        .map(normalizeLayout)
        .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
            return left.id.localeCompare(right.id)
        })

    const catalogLayouts = asArray<unknown>(snapshot.catalogLayouts)
        .map((layoutValue) => {
            const layout = asRecord(layoutValue)

            return {
                ...normalizeLayout(layout),
                catalogId: typeof layout.catalogId === 'string' ? layout.catalogId : '',
                baseLayoutId: typeof layout.baseLayoutId === 'string' ? layout.baseLayoutId : ''
            }
        })
        .sort((left, right) => {
            if ((left.catalogId as string) !== (right.catalogId as string)) {
                return (left.catalogId as string).localeCompare(right.catalogId as string)
            }
            if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                return (left.sortOrder as number) - (right.sortOrder as number)
            }
            if ((left.isDefault as boolean) !== (right.isDefault as boolean)) {
                return left.isDefault ? -1 : 1
            }
            return (left.id as string).localeCompare(right.id as string)
        })

    const layoutZoneWidgets = asArray<SnapshotRecord>(snapshot.layoutZoneWidgets)
        .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            layoutId: typeof item.layoutId === 'string' ? item.layoutId : '',
            zone: typeof item.zone === 'string' ? item.zone : '',
            widgetKey: item.widgetKey,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            config: item.config ?? {},
            isActive: Boolean(item.isActive)
        }))
        .sort((left, right) => {
            if (left.layoutId !== right.layoutId) return left.layoutId.localeCompare(right.layoutId)
            if (left.zone !== right.zone) return left.zone.localeCompare(right.zone)
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            return left.id.localeCompare(right.id)
        })

    const catalogLayoutWidgetOverrides = asArray<unknown>(snapshot.catalogLayoutWidgetOverrides)
        .map((itemValue) => {
            const item = asRecord(itemValue)

            return {
                id: typeof item.id === 'string' ? item.id : '',
                catalogLayoutId: typeof item.catalogLayoutId === 'string' ? item.catalogLayoutId : '',
                baseWidgetId: typeof item.baseWidgetId === 'string' ? item.baseWidgetId : '',
                zone: typeof item.zone === 'string' ? item.zone : null,
                sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : null,
                config: item.config && typeof item.config === 'object' ? item.config : null,
                isActive: typeof item.isActive === 'boolean' ? item.isActive : null,
                isDeletedOverride: item.isDeletedOverride === true
            }
        })
        .sort((left, right) => {
            if ((left.catalogLayoutId as string) !== (right.catalogLayoutId as string)) {
                return (left.catalogLayoutId as string).localeCompare(right.catalogLayoutId as string)
            }
            if ((left.baseWidgetId as string) !== (right.baseWidgetId as string)) {
                return (left.baseWidgetId as string).localeCompare(right.baseWidgetId as string)
            }
            return (left.id as string).localeCompare(right.id as string)
        })

    const systemFields = snapshotSystemFields
        ? Object.entries(snapshotSystemFields)
              .map(([entityId, value]) => {
                  const record = asRecord(value)
                  const fields = asArray<SnapshotRecord>(record.fields)
                      .map((field) => ({ ...field }))
                      .sort((left, right) => String(left.key ?? '').localeCompare(String(right.key ?? '')))

                  return {
                      entityId,
                      fields,
                      lifecycleContract: record.lifecycleContract
                  }
              })
              .sort((left, right) => left.entityId.localeCompare(right.entityId))
        : []

    return {
        version: snapshot.version,
        versionEnvelope: snapshot.versionEnvelope ?? options.defaultVersionEnvelope,
        metahubId: snapshot.metahubId,
        entities,
        elements,
        enumerationValues,
        constants,
        systemFields,
        scripts,
        layouts,
        catalogLayouts,
        layoutZoneWidgets,
        catalogLayoutWidgetOverrides,
        defaultLayoutId: snapshot.defaultLayoutId ?? null,
        layoutConfig: snapshot.layoutConfig ?? {}
    }
}
