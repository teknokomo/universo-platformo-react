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
    layouts?: unknown
    layoutZoneWidgets?: unknown
    defaultLayoutId?: unknown
    layoutConfig?: unknown
}

export interface NormalizePublicationSnapshotForHashOptions {
    defaultVersionEnvelope?: MetahubSnapshotVersionEnvelope
}

const asArray = <Value>(value: unknown): Value[] => (Array.isArray(value) ? (value as Value[]) : [])
const asRecord = (value: unknown): SnapshotRecord => (value && typeof value === 'object' ? (value as SnapshotRecord) : {})

const normalizeField = (fieldValue: unknown): Record<string, unknown> => {
    const field = asRecord(fieldValue)
    const sortOrder = typeof field.sortOrder === 'number' ? field.sortOrder : 0

    return {
        id: typeof field.id === 'string' ? field.id : '',
        codename: typeof field.codename === 'string' ? field.codename : '',
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
                      if ((left.codename as string) !== (right.codename as string)) {
                          return (left.codename as string).localeCompare(right.codename as string)
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
                codename: typeof entity.codename === 'string' ? entity.codename : '',
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
                        if ((left.codename as string) !== (right.codename as string)) {
                            return (left.codename as string).localeCompare(right.codename as string)
                        }
                        return (left.id as string).localeCompare(right.id as string)
                    })
            }
        })
        .sort((left, right) => {
            if (left.kind !== right.kind) return left.kind.localeCompare(right.kind)
            if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
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
                    codename: typeof value.codename === 'string' ? value.codename : '',
                    presentation: value.presentation ?? {},
                    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
                    isDefault: Boolean(value.isDefault)
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
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
                    codename: typeof constant.codename === 'string' ? constant.codename : '',
                    dataType: constant.dataType,
                    presentation: constant.presentation ?? {},
                    validationRules: constant.validationRules ?? {},
                    uiConfig: constant.uiConfig ?? {},
                    value: constant.value ?? null,
                    sortOrder: typeof constant.sortOrder === 'number' ? constant.sortOrder : 0
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const layouts = asArray<SnapshotRecord>(snapshot.layouts)
        .map((layout) => ({
            id: typeof layout.id === 'string' ? layout.id : '',
            templateKey: layout.templateKey,
            name: layout.name ?? {},
            description: layout.description ?? null,
            config: layout.config ?? {},
            isDefault: Boolean(layout.isDefault),
            isActive: Boolean(layout.isActive),
            sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
        }))
        .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
            return left.id.localeCompare(right.id)
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
        layouts,
        layoutZoneWidgets,
        defaultLayoutId: snapshot.defaultLayoutId ?? null,
        layoutConfig: snapshot.layoutConfig ?? {}
    }
}
