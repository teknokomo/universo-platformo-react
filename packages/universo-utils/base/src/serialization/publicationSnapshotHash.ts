import { getCodenamePrimary } from '../vlc'
import type { ObjectSystemFieldsSnapshot, MetahubSnapshotVersionEnvelope } from '@universo/types'

type SnapshotRecord = Record<string, unknown>

export interface PublicationSnapshotHashInput {
    version?: unknown
    versionEnvelope?: MetahubSnapshotVersionEnvelope
    metahubId?: unknown
    entityTypeDefinitions?: Record<string, unknown>
    entities?: Record<string, unknown>
    elements?: Record<string, unknown>
    optionValues?: Record<string, unknown>
    constants?: Record<string, unknown>
    fixedValues?: Record<string, unknown>
    sharedComponents?: unknown
    sharedFixedValues?: unknown
    /** @deprecated use sharedFixedValues */
    sharedConstants?: unknown
    sharedOptionValues?: unknown
    /** @deprecated use sharedOptionValues */
    sharedEnumerationValues?: unknown
    sharedEntityOverrides?: unknown
    systemFields?: Record<string, ObjectSystemFieldsSnapshot | SnapshotRecord>
    scripts?: unknown
    layouts?: unknown
    scopedLayouts?: unknown
    layoutZoneWidgets?: unknown
    layoutWidgetOverrides?: unknown
    defaultLayoutId?: unknown
    layoutConfig?: unknown
    settings?: unknown
}

export interface NormalizePublicationSnapshotForHashOptions {
    defaultVersionEnvelope?: MetahubSnapshotVersionEnvelope
}

const asArray = <Value>(value: unknown): Value[] => (Array.isArray(value) ? (value as Value[]) : [])
const asRecord = (value: unknown): SnapshotRecord => (value && typeof value === 'object' ? (value as SnapshotRecord) : {})
const compareStrings = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

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
            .sort(compareStrings),
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
                    return compareStrings(left.target as string, right.target as string)
                }
                if ((left.eventName as string | null) !== (right.eventName as string | null)) {
                    return compareStrings(String(left.eventName ?? ''), String(right.eventName ?? ''))
                }
                return compareStrings(left.name as string, right.name as string)
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
        isDisplayComponent: Boolean(field.isDisplayComponent),
        targetEntityId: typeof field.targetEntityId === 'string' ? field.targetEntityId : null,
        targetEntityKind: typeof field.targetEntityKind === 'string' ? field.targetEntityKind : null,
        targetConstantId: typeof field.targetConstantId === 'string' ? field.targetConstantId : null,
        presentation: field.presentation ?? {},
        validationRules: field.validationRules ?? {},
        uiConfig: field.uiConfig ?? {},
        sortOrder,
        parentComponentId: typeof field.parentComponentId === 'string' ? field.parentComponentId : null,
        childFields: field.childFields
            ? asArray<unknown>(field.childFields)
                  .map((childFieldValue) => {
                      const childField = normalizeField(childFieldValue)
                      const { parentComponentId: _parentComponentId, childFields: _childFields, ...normalizedChildField } = childField
                      return normalizedChildField
                  })
                  .sort((left, right) => {
                      if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                          return (left.sortOrder as number) - (right.sortOrder as number)
                      }
                      if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                          return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
                      }
                      return compareStrings(left.id as string, right.id as string)
                  })
            : undefined
    }
}

const normalizeConstant = (constantValue: unknown): Record<string, unknown> => {
    const fixedValue = asRecord(constantValue)

    return {
        id: typeof fixedValue.id === 'string' ? fixedValue.id : '',
        codename: normalizeCodenameValue(fixedValue.codename),
        dataType: fixedValue.dataType,
        presentation: fixedValue.presentation ?? {},
        validationRules: fixedValue.validationRules ?? {},
        uiConfig: fixedValue.uiConfig ?? {},
        value: fixedValue.value ?? null,
        sortOrder: typeof fixedValue.sortOrder === 'number' ? fixedValue.sortOrder : 0
    }
}

const normalizeEnumerationValue = (valueValue: unknown): Record<string, unknown> => {
    const value = asRecord(valueValue)

    return {
        id: typeof value.id === 'string' ? value.id : '',
        codename: normalizeCodenameValue(value.codename),
        presentation: value.presentation ?? {},
        sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
        isDefault: Boolean(value.isDefault)
    }
}

const normalizeResourceSurface = (surfaceValue: unknown): Record<string, unknown> => {
    const surface = asRecord(surfaceValue)

    return {
        key: typeof surface.key === 'string' ? surface.key : '',
        capability: typeof surface.capability === 'string' ? surface.capability : '',
        routeSegment: typeof surface.routeSegment === 'string' ? surface.routeSegment : '',
        title: surface.title ?? null,
        titleKey: typeof surface.titleKey === 'string' ? surface.titleKey : null,
        fallbackTitle: typeof surface.fallbackTitle === 'string' ? surface.fallbackTitle : null
    }
}

const normalizeEntityTypeDefinition = (kindKey: string, definitionValue: unknown): Record<string, unknown> => {
    const definition = asRecord(definitionValue)
    const ui = asRecord(definition.ui)

    return {
        id: typeof definition.id === 'string' ? definition.id : '',
        kindKey: typeof definition.kindKey === 'string' ? definition.kindKey : kindKey,
        codename: normalizeCodenameValue(definition.codename),
        presentation: definition.presentation ?? {},
        components: definition.components ?? {},
        ui: {
            iconName: typeof ui.iconName === 'string' ? ui.iconName : '',
            tabs: asArray<string>(ui.tabs).sort(compareStrings),
            sidebarSection: typeof ui.sidebarSection === 'string' ? ui.sidebarSection : 'objects',
            sidebarOrder: typeof ui.sidebarOrder === 'number' ? ui.sidebarOrder : null,
            nameKey: typeof ui.nameKey === 'string' ? ui.nameKey : '',
            descriptionKey: typeof ui.descriptionKey === 'string' ? ui.descriptionKey : null,
            resourceSurfaces: asArray<unknown>(ui.resourceSurfaces)
                .map(normalizeResourceSurface)
                .sort((left, right) => {
                    if ((left.capability as string) !== (right.capability as string)) {
                        return compareStrings(left.capability as string, right.capability as string)
                    }
                    return compareStrings(left.key as string, right.key as string)
                })
        },
        config: definition.config ?? {},
        published: definition.published === true
    }
}

const compareBySortOrderCodenameAndId = (left: Record<string, unknown>, right: Record<string, unknown>): number => {
    if ((left.sortOrder as number) !== (right.sortOrder as number)) {
        return (left.sortOrder as number) - (right.sortOrder as number)
    }
    if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
        return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
    }
    return compareStrings(String(left.id ?? ''), String(right.id ?? ''))
}

export const normalizePublicationSnapshotForHash = (
    snapshot: PublicationSnapshotHashInput,
    options: NormalizePublicationSnapshotForHashOptions = {}
): Record<string, unknown> => {
    const snapshotSystemFields =
        snapshot.systemFields && typeof snapshot.systemFields === 'object'
            ? (snapshot.systemFields as Record<string, ObjectSystemFieldsSnapshot | SnapshotRecord>)
            : null

    const entityTypeDefinitions = Object.entries(snapshot.entityTypeDefinitions ?? {})
        .map(([kindKey, definition]) => normalizeEntityTypeDefinition(kindKey, definition))
        .sort((left, right) => compareStrings(String(left.kindKey ?? ''), String(right.kindKey ?? '')))

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
                hubs: asArray<string>(entity.hubs).sort(compareStrings),
                fields: asArray<unknown>(entity.fields)
                    .map(normalizeField)
                    .sort((left, right) => {
                        if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                            return (left.sortOrder as number) - (right.sortOrder as number)
                        }
                        if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                            return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
                        }
                        return compareStrings(left.id as string, right.id as string)
                    })
            }
        })
        .sort((left, right) => {
            if (left.kind !== right.kind) return compareStrings(left.kind, right.kind)
            if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
            }
            return compareStrings(left.id, right.id)
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
                    return compareStrings(left.id, right.id)
                })
        }))
        .sort((left, right) => compareStrings(left.objectId, right.objectId))

    const optionValues = Object.entries(snapshot.optionValues ?? {})
        .map(([objectId, list]) => ({
            objectId,
            values: asArray<SnapshotRecord>(list).map(normalizeEnumerationValue).sort(compareBySortOrderCodenameAndId)
        }))
        .sort((left, right) => compareStrings(left.objectId, right.objectId))

    const fixedValues = Object.entries(snapshot.fixedValues ?? snapshot.constants ?? {})
        .map(([objectId, list]) => ({
            objectId,
            constants: asArray<SnapshotRecord>(list).map(normalizeConstant).sort(compareBySortOrderCodenameAndId)
        }))
        .sort((left, right) => compareStrings(left.objectId, right.objectId))

    const sharedComponents = asArray<unknown>(snapshot.sharedComponents)
        .map(normalizeField)
        .sort(compareBySortOrderCodenameAndId)

    const sharedConstants = asArray<unknown>(snapshot.sharedFixedValues ?? snapshot.sharedConstants)
        .map(normalizeConstant)
        .sort(compareBySortOrderCodenameAndId)

    const sharedEnumerationValues = asArray<unknown>(snapshot.sharedOptionValues ?? snapshot.sharedEnumerationValues)
        .map(normalizeEnumerationValue)
        .sort(compareBySortOrderCodenameAndId)

    const sharedEntityOverrides = asArray<SnapshotRecord>(snapshot.sharedEntityOverrides)
        .map((override) => ({
            id: typeof override.id === 'string' ? override.id : '',
            entityKind: typeof override.entityKind === 'string' ? override.entityKind : '',
            sharedEntityId: typeof override.sharedEntityId === 'string' ? override.sharedEntityId : '',
            targetObjectId: typeof override.targetObjectId === 'string' ? override.targetObjectId : '',
            isExcluded: override.isExcluded === true,
            isActive: typeof override.isActive === 'boolean' ? override.isActive : null,
            sortOrder: typeof override.sortOrder === 'number' ? override.sortOrder : null
        }))
        .sort((left, right) => {
            if ((left.entityKind as string) !== (right.entityKind as string)) {
                return compareStrings(left.entityKind as string, right.entityKind as string)
            }
            if ((left.targetObjectId as string) !== (right.targetObjectId as string)) {
                return compareStrings(left.targetObjectId as string, right.targetObjectId as string)
            }
            if ((left.sortOrder as number | null) !== (right.sortOrder as number | null)) {
                return Number(left.sortOrder ?? Number.MAX_SAFE_INTEGER) - Number(right.sortOrder ?? Number.MAX_SAFE_INTEGER)
            }
            if ((left.sharedEntityId as string) !== (right.sharedEntityId as string)) {
                return compareStrings(left.sharedEntityId as string, right.sharedEntityId as string)
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const scripts = asArray<unknown>(snapshot.scripts)
        .map(normalizeScript)
        .sort((left, right) => {
            if ((left.attachedToKind as string) !== (right.attachedToKind as string)) {
                return compareStrings(left.attachedToKind as string, right.attachedToKind as string)
            }
            if ((left.attachedToId as string | null) !== (right.attachedToId as string | null)) {
                return compareStrings(String(left.attachedToId ?? ''), String(right.attachedToId ?? ''))
            }
            if ((left.moduleRole as string) !== (right.moduleRole as string)) {
                return compareStrings(left.moduleRole as string, right.moduleRole as string)
            }
            if (resolveCodenameSortText(left.codename) !== resolveCodenameSortText(right.codename)) {
                return compareStrings(resolveCodenameSortText(left.codename), resolveCodenameSortText(right.codename))
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const layouts = asArray<unknown>(snapshot.layouts)
        .map(normalizeLayout)
        .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
            return compareStrings(left.id, right.id)
        })

    const scopedLayouts = asArray<unknown>(snapshot.scopedLayouts)
        .map((layoutValue) => {
            const layout = asRecord(layoutValue)

            return {
                ...normalizeLayout(layout),
                scopeEntityId: typeof layout.scopeEntityId === 'string' ? layout.scopeEntityId : '',
                scopeEntityKind: typeof layout.scopeEntityKind === 'string' ? layout.scopeEntityKind : null,
                baseLayoutId: typeof layout.baseLayoutId === 'string' ? layout.baseLayoutId : ''
            }
        })
        .sort((left, right) => {
            if ((left.scopeEntityId as string) !== (right.scopeEntityId as string)) {
                return compareStrings(left.scopeEntityId as string, right.scopeEntityId as string)
            }
            if ((left.scopeEntityKind as string | null) !== (right.scopeEntityKind as string | null)) {
                return compareStrings(String(left.scopeEntityKind ?? ''), String(right.scopeEntityKind ?? ''))
            }
            if ((left.sortOrder as number) !== (right.sortOrder as number)) {
                return (left.sortOrder as number) - (right.sortOrder as number)
            }
            if ((left.isDefault as boolean) !== (right.isDefault as boolean)) {
                return left.isDefault ? -1 : 1
            }
            return compareStrings(left.id as string, right.id as string)
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
            if (left.layoutId !== right.layoutId) return compareStrings(left.layoutId, right.layoutId)
            if (left.zone !== right.zone) return compareStrings(left.zone, right.zone)
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            return compareStrings(left.id, right.id)
        })

    const layoutWidgetOverrides = asArray<unknown>(snapshot.layoutWidgetOverrides)
        .map((itemValue) => {
            const item = asRecord(itemValue)

            return {
                id: typeof item.id === 'string' ? item.id : '',
                layoutId: typeof item.layoutId === 'string' ? item.layoutId : '',
                baseWidgetId: typeof item.baseWidgetId === 'string' ? item.baseWidgetId : '',
                zone: typeof item.zone === 'string' ? item.zone : null,
                sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : null,
                config: item.config && typeof item.config === 'object' ? item.config : null,
                isActive: typeof item.isActive === 'boolean' ? item.isActive : null,
                isDeletedOverride: item.isDeletedOverride === true
            }
        })
        .sort((left, right) => {
            if ((left.layoutId as string) !== (right.layoutId as string)) {
                return compareStrings(left.layoutId as string, right.layoutId as string)
            }
            if ((left.baseWidgetId as string) !== (right.baseWidgetId as string)) {
                return compareStrings(left.baseWidgetId as string, right.baseWidgetId as string)
            }
            return compareStrings(left.id as string, right.id as string)
        })

    const systemFields = snapshotSystemFields
        ? Object.entries(snapshotSystemFields)
              .map(([entityId, value]) => {
                  const record = asRecord(value)
                  const fields = asArray<SnapshotRecord>(record.fields)
                      .map((field) => ({ ...field }))
                      .sort((left, right) => compareStrings(String(left.key ?? ''), String(right.key ?? '')))

                  return {
                      entityId,
                      fields,
                      lifecycleContract: record.lifecycleContract
                  }
              })
              .sort((left, right) => compareStrings(left.entityId, right.entityId))
        : []
    const settings = asArray<SnapshotRecord>(snapshot.settings)
        .map((setting) => ({
            key: typeof setting.key === 'string' ? setting.key : '',
            value: setting.value && typeof setting.value === 'object' ? setting.value : {}
        }))
        .filter((setting) => setting.key.length > 0)
        .sort((left, right) => compareStrings(left.key, right.key))

    return {
        version: snapshot.version,
        versionEnvelope: snapshot.versionEnvelope ?? options.defaultVersionEnvelope,
        metahubId: snapshot.metahubId,
        entityTypeDefinitions,
        entities,
        elements,
        optionValues,
        fixedValues,
        sharedComponents,
        sharedConstants,
        sharedEnumerationValues,
        sharedEntityOverrides,
        systemFields,
        scripts,
        layouts,
        scopedLayouts,
        layoutZoneWidgets,
        layoutWidgetOverrides,
        defaultLayoutId: snapshot.defaultLayoutId ?? null,
        layoutConfig: snapshot.layoutConfig ?? {},
        settings
    }
}
