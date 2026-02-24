import { MetaEntityKind } from '@universo/types'
import type { EntityDefinition, SchemaSnapshot } from './types'
import { generateColumnName, generateTableName, generateTabularTableName } from './naming'

const ENUMERATION_KIND: MetaEntityKind = ((MetaEntityKind as unknown as { ENUMERATION?: MetaEntityKind }).ENUMERATION ??
    'enumeration') as MetaEntityKind

export enum ChangeType {
    ADD_TABLE = 'ADD_TABLE',
    DROP_TABLE = 'DROP_TABLE',
    RENAME_TABLE = 'RENAME_TABLE',
    ADD_COLUMN = 'ADD_COLUMN',
    DROP_COLUMN = 'DROP_COLUMN',
    ALTER_COLUMN = 'ALTER_COLUMN',
    MODIFY_FIELD = 'MODIFY_FIELD',
    ADD_FK = 'ADD_FK',
    DROP_FK = 'DROP_FK',
    // Tabular part (TABLE attribute) change types
    ADD_TABULAR_TABLE = 'ADD_TABULAR_TABLE',
    DROP_TABULAR_TABLE = 'DROP_TABULAR_TABLE',
    ADD_TABULAR_COLUMN = 'ADD_TABULAR_COLUMN',
    DROP_TABULAR_COLUMN = 'DROP_TABULAR_COLUMN',
    ALTER_TABULAR_COLUMN = 'ALTER_TABULAR_COLUMN'
}

export interface SchemaChange {
    type: ChangeType
    entityId?: string
    entityKind?: MetaEntityKind
    entityCodename?: string
    tableName?: string
    fieldId?: string
    fieldCodename?: string
    columnName?: string
    oldValue?: unknown
    newValue?: unknown
    isDestructive: boolean
    description: string
    /** ON DELETE action for FK constraints (default: SET NULL) */
    onDeleteAction?: 'SET NULL' | 'CASCADE'
}

export interface SchemaDiff {
    hasChanges: boolean
    additive: SchemaChange[]
    destructive: SchemaChange[]
    summary: string
}

const buildSummary = (diff: SchemaDiff): string => {
    const parts: string[] = []
    if (diff.additive.length > 0) {
        parts.push(`${diff.additive.length} additive change(s)`)
    }
    if (diff.destructive.length > 0) {
        parts.push(`${diff.destructive.length} DESTRUCTIVE change(s)`)
    }
    return parts.length === 0 ? 'No changes' : parts.join(', ')
}

export const calculateSchemaDiff = (oldSnapshot: SchemaSnapshot | null, newEntities: EntityDefinition[]): SchemaDiff => {
    const diff: SchemaDiff = {
        hasChanges: false,
        additive: [],
        destructive: [],
        summary: ''
    }
    const newPhysicalEntities = newEntities.filter((entity) => entity.kind !== ENUMERATION_KIND)
    const oldPhysicalEntities = oldSnapshot?.entities
        ? Object.entries(oldSnapshot.entities)
              .filter(([, entity]) => entity.kind !== ENUMERATION_KIND)
              .map(([entityId, entity]) => ({
                  ...entity,
                  id: entityId
              }))
        : []

    if (!oldSnapshot) {
        for (const entity of newPhysicalEntities) {
            diff.additive.push({
                type: ChangeType.ADD_TABLE,
                entityId: entity.id,
                entityKind: entity.kind,
                entityCodename: entity.codename,
                tableName: generateTableName(entity.id, entity.kind),
                isDestructive: false,
                description: `Create table "${entity.codename}"`
            })
        }
        diff.hasChanges = diff.additive.length > 0
        diff.summary = `${diff.additive.length} new table(s)`
        return diff
    }

    const oldEntityIds = new Set(oldPhysicalEntities.map((entity) => entity.id))
    const newEntityIds = new Set(newPhysicalEntities.map((entity) => entity.id))
    const oldEntitiesById = new Map(oldPhysicalEntities.map((entity) => [entity.id, entity]))

    for (const entity of newPhysicalEntities) {
        if (!oldEntityIds.has(entity.id)) {
            diff.additive.push({
                type: ChangeType.ADD_TABLE,
                entityId: entity.id,
                entityKind: entity.kind,
                entityCodename: entity.codename,
                tableName: generateTableName(entity.id, entity.kind),
                isDestructive: false,
                description: `Create table "${entity.codename}"`
            })
        }
    }

    for (const oldEntityId of oldEntityIds) {
        if (!newEntityIds.has(oldEntityId)) {
            const oldEntity = oldEntitiesById.get(oldEntityId)
            if (!oldEntity) continue
            diff.destructive.push({
                type: ChangeType.DROP_TABLE,
                entityId: oldEntityId,
                entityKind: oldEntity.kind,
                entityCodename: oldEntity.codename,
                tableName: oldEntity.tableName,
                isDestructive: true,
                description: `Drop table "${oldEntity.codename}" (DATA WILL BE LOST)`
            })
        }
    }

    for (const entity of newPhysicalEntities) {
        if (!oldEntityIds.has(entity.id)) continue

        const oldEntity = oldEntitiesById.get(entity.id)
        if (!oldEntity) continue
        const newFieldIds = new Set(entity.fields.filter((f) => !f.parentAttributeId).map((field) => field.id))
        const oldFieldIds = new Set(Object.keys(oldEntity.fields))
        const tableName = generateTableName(entity.id, entity.kind)

        if (oldEntity.kind !== entity.kind) {
            diff.destructive.push({
                type: ChangeType.DROP_TABLE,
                entityId: entity.id,
                entityKind: oldEntity.kind,
                entityCodename: oldEntity.codename,
                tableName: oldEntity.tableName,
                isDestructive: true,
                description: `Drop table "${oldEntity.codename}" (kind changed)`
            })
            diff.additive.push({
                type: ChangeType.ADD_TABLE,
                entityId: entity.id,
                entityKind: entity.kind,
                entityCodename: entity.codename,
                tableName,
                isDestructive: true,
                description: `Create table "${entity.codename}" (kind changed)`
            })
            continue
        }

        if (oldEntity.codename !== entity.codename) {
            console.info(
                `[SchemaDiff] Entity codename changed from "${oldEntity.codename}" to "${entity.codename}". ` +
                    `Table name "${tableName}" remains unchanged (UUID-based naming).`
            )
        }

        for (const field of entity.fields) {
            // Skip child fields — they are diffed through their TABLE parent
            if (field.parentAttributeId) continue

            if (!oldFieldIds.has(field.id)) {
                if (field.dataType === 'TABLE') {
                    // New TABLE attribute → create tabular table
                    const tabularTableName = generateTabularTableName(tableName, field.id)
                    diff.additive.push({
                        type: ChangeType.ADD_TABULAR_TABLE,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName: tabularTableName,
                        fieldId: field.id,
                        fieldCodename: field.codename,
                        isDestructive: false,
                        description: `Create tabular table for "${field.codename}" in "${entity.codename}"`
                    })

                    const newChildFields = entity.fields.filter((childField) => childField.parentAttributeId === field.id)
                    for (const childField of newChildFields) {
                        if (childField.dataType !== 'REF' || !childField.targetEntityId) continue

                        diff.additive.push({
                            type: ChangeType.ADD_FK,
                            entityId: entity.id,
                            entityKind: entity.kind,
                            entityCodename: entity.codename,
                            tableName: tabularTableName,
                            fieldId: childField.id,
                            fieldCodename: childField.codename,
                            columnName: generateColumnName(childField.id),
                            newValue: childField.targetEntityId,
                            isDestructive: false,
                            description: `Add FK on tabular field "${field.codename}.${childField.codename}"`
                        })
                    }
                } else {
                    diff.additive.push({
                        type: ChangeType.ADD_COLUMN,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName,
                        fieldId: field.id,
                        fieldCodename: field.codename,
                        columnName: generateColumnName(field.id),
                        newValue: field.dataType,
                        isDestructive: false,
                        description: `Add column "${field.codename}" (${field.dataType}) to "${entity.codename}"`
                    })
                }
            }
        }

        for (const oldFieldId of oldFieldIds) {
            if (!newFieldIds.has(oldFieldId)) {
                const oldField = oldEntity.fields[oldFieldId]
                if (oldField.dataType === 'TABLE') {
                    // Removed TABLE attribute → drop tabular table
                    diff.destructive.push({
                        type: ChangeType.DROP_TABULAR_TABLE,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName: oldField.columnName, // columnName stores tabular table name
                        fieldId: oldFieldId,
                        fieldCodename: oldField.codename,
                        isDestructive: true,
                        description: `Drop tabular table "${oldField.codename}" from "${entity.codename}" (DATA WILL BE LOST)`
                    })
                } else {
                    diff.destructive.push({
                        type: ChangeType.DROP_COLUMN,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName,
                        fieldId: oldFieldId,
                        fieldCodename: oldField.codename,
                        columnName: oldField.columnName,
                        isDestructive: true,
                        description: `Drop column "${oldField.codename}" from "${entity.codename}" (DATA WILL BE LOST)`
                    })
                }
            }
        }

        // ─── TABLE child field diffs ─────────────────────────────────────
        for (const field of entity.fields) {
            if (field.dataType !== 'TABLE' || field.parentAttributeId) continue
            if (!oldFieldIds.has(field.id)) continue // new TABLE — handled above

            const oldField = oldEntity.fields[field.id]
            if (!oldField || oldField.dataType !== 'TABLE') continue // type changed — handled by ALTER

            const tabularTableName = generateTabularTableName(tableName, field.id)
            const oldChildFields = oldField.childFields ?? {}
            const oldChildIds = new Set(Object.keys(oldChildFields))
            const newChildFields = entity.fields.filter((f) => f.parentAttributeId === field.id)
            const newChildIds = new Set(newChildFields.map((f) => f.id))

            // New child fields
            for (const child of newChildFields) {
                if (!oldChildIds.has(child.id)) {
                    diff.additive.push({
                        type: ChangeType.ADD_TABULAR_COLUMN,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName: tabularTableName,
                        fieldId: child.id,
                        fieldCodename: child.codename,
                        columnName: generateColumnName(child.id),
                        newValue: child.dataType,
                        isDestructive: false,
                        description: `Add column "${child.codename}" (${child.dataType}) to tabular "${field.codename}"`
                    })

                    if (child.dataType === 'REF' && child.targetEntityId) {
                        diff.additive.push({
                            type: ChangeType.ADD_FK,
                            entityId: entity.id,
                            entityKind: entity.kind,
                            entityCodename: entity.codename,
                            tableName: tabularTableName,
                            fieldId: child.id,
                            fieldCodename: child.codename,
                            columnName: generateColumnName(child.id),
                            newValue: child.targetEntityId,
                            isDestructive: false,
                            description: `Add FK on tabular field "${field.codename}.${child.codename}"`
                        })
                    }
                }
            }

            // Removed child fields
            for (const oldChildId of oldChildIds) {
                if (!newChildIds.has(oldChildId)) {
                    const oldChild = oldChildFields[oldChildId]

                    if (oldChild.targetEntityId) {
                        diff.destructive.push({
                            type: ChangeType.DROP_FK,
                            entityId: entity.id,
                            entityKind: entity.kind,
                            entityCodename: entity.codename,
                            tableName: tabularTableName,
                            fieldId: oldChildId,
                            fieldCodename: oldChild.codename,
                            columnName: oldChild.columnName,
                            oldValue: oldChild.targetEntityId,
                            isDestructive: true,
                            description: `Drop FK on tabular field "${field.codename}.${oldChild.codename}"`
                        })
                    }

                    diff.destructive.push({
                        type: ChangeType.DROP_TABULAR_COLUMN,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName: tabularTableName,
                        fieldId: oldChildId,
                        fieldCodename: oldChild.codename,
                        columnName: oldChild.columnName,
                        isDestructive: true,
                        description: `Drop column "${oldChild.codename}" from tabular "${field.codename}" (DATA WILL BE LOST)`
                    })
                }
            }

            // Changed child fields (type change)
            for (const child of newChildFields) {
                if (!oldChildIds.has(child.id)) continue
                const oldChild = oldChildFields[child.id]

                if (oldChild.targetEntityId !== child.targetEntityId || oldChild.targetEntityKind !== child.targetEntityKind) {
                    if (oldChild.targetEntityId) {
                        diff.destructive.push({
                            type: ChangeType.DROP_FK,
                            entityId: entity.id,
                            entityKind: entity.kind,
                            entityCodename: entity.codename,
                            tableName: tabularTableName,
                            fieldId: child.id,
                            fieldCodename: child.codename,
                            columnName: oldChild.columnName,
                            oldValue: oldChild.targetEntityId,
                            isDestructive: true,
                            description: `Drop FK on tabular field "${field.codename}.${child.codename}"`
                        })
                    }

                    if (child.targetEntityId) {
                        diff.additive.push({
                            type: ChangeType.ADD_FK,
                            entityId: entity.id,
                            entityKind: entity.kind,
                            entityCodename: entity.codename,
                            tableName: tabularTableName,
                            fieldId: child.id,
                            fieldCodename: child.codename,
                            columnName: generateColumnName(child.id),
                            newValue: child.targetEntityId,
                            isDestructive: false,
                            description: `Add FK on tabular field "${field.codename}.${child.codename}"`
                        })
                    }
                }

                if (oldChild.dataType !== child.dataType) {
                    diff.destructive.push({
                        type: ChangeType.ALTER_TABULAR_COLUMN,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName: tabularTableName,
                        fieldId: child.id,
                        fieldCodename: child.codename,
                        columnName: oldChild.columnName,
                        oldValue: oldChild.dataType,
                        newValue: child.dataType,
                        isDestructive: true,
                        description: `Change type of "${child.codename}" in tabular "${field.codename}" from ${oldChild.dataType} to ${child.dataType}`
                    })
                }
            }
        }

        for (const field of entity.fields) {
            // Skip child fields and TABLE fields — handled separately
            if (field.parentAttributeId) continue
            if (field.dataType === 'TABLE') continue
            if (!oldFieldIds.has(field.id)) continue

            const oldField = oldEntity.fields[field.id]
            // Skip if old field was TABLE (type change TABLE→non-TABLE)
            if (oldField.dataType === 'TABLE') continue

            if (oldField.dataType !== field.dataType) {
                diff.destructive.push({
                    type: ChangeType.ALTER_COLUMN,
                    entityId: entity.id,
                    entityKind: entity.kind,
                    entityCodename: entity.codename,
                    tableName,
                    fieldId: field.id,
                    fieldCodename: field.codename,
                    columnName: oldField.columnName,
                    oldValue: oldField.dataType,
                    newValue: field.dataType,
                    isDestructive: true,
                    description: `Change type of "${field.codename}" from ${oldField.dataType} to ${field.dataType}`
                })
            }

            if (!oldField.isRequired && field.isRequired) {
                diff.destructive.push({
                    type: ChangeType.ALTER_COLUMN,
                    entityId: entity.id,
                    entityKind: entity.kind,
                    entityCodename: entity.codename,
                    tableName,
                    fieldId: field.id,
                    fieldCodename: field.codename,
                    columnName: oldField.columnName,
                    oldValue: 'nullable',
                    newValue: 'required',
                    isDestructive: true,
                    description: `Make "${field.codename}" required (may fail if NULLs exist)`
                })
            } else if (oldField.isRequired && !field.isRequired) {
                diff.additive.push({
                    type: ChangeType.ALTER_COLUMN,
                    entityId: entity.id,
                    entityKind: entity.kind,
                    entityCodename: entity.codename,
                    tableName,
                    fieldId: field.id,
                    fieldCodename: field.codename,
                    columnName: oldField.columnName,
                    oldValue: 'required',
                    newValue: 'nullable',
                    isDestructive: false,
                    description: `Make "${field.codename}" optional`
                })
            }

            if (oldField.targetEntityId !== field.targetEntityId) {
                if (oldField.targetEntityId) {
                    diff.destructive.push({
                        type: ChangeType.DROP_FK,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName,
                        fieldId: field.id,
                        columnName: oldField.columnName,
                        oldValue: oldField.targetEntityId,
                        isDestructive: true,
                        description: `Drop FK on "${field.codename}"`
                    })
                }
                if (field.targetEntityId) {
                    diff.additive.push({
                        type: ChangeType.ADD_FK,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName,
                        fieldId: field.id,
                        columnName: generateColumnName(field.id),
                        newValue: field.targetEntityId,
                        isDestructive: false,
                        description: `Add FK on "${field.codename}"`
                    })
                }
            }

            // Track target entity kind changes for polymorphic references
            if (oldField.targetEntityKind !== field.targetEntityKind) {
                if (oldField.targetEntityKind && !field.targetEntityKind) {
                    diff.additive.push({
                        type: ChangeType.MODIFY_FIELD,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName,
                        fieldId: field.id,
                        columnName: oldField.columnName,
                        oldValue: oldField.targetEntityKind,
                        newValue: null,
                        isDestructive: false,
                        description: `Remove target entity kind from "${field.codename}"`
                    })
                }
                if (field.targetEntityKind) {
                    diff.additive.push({
                        type: ChangeType.MODIFY_FIELD,
                        entityId: entity.id,
                        entityKind: entity.kind,
                        entityCodename: entity.codename,
                        tableName,
                        fieldId: field.id,
                        columnName: generateColumnName(field.id),
                        oldValue: oldField.targetEntityKind ?? null,
                        newValue: field.targetEntityKind,
                        isDestructive: false,
                        description: `Set target entity kind to "${field.targetEntityKind}" on "${field.codename}"`
                    })
                }
            }
        }
    }

    diff.hasChanges = diff.additive.length > 0 || diff.destructive.length > 0
    diff.summary = buildSummary(diff)
    return diff
}
