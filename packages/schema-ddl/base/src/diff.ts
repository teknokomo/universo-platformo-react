import type { MetaEntityKind } from '@universo/types'
import type { EntityDefinition, SchemaSnapshot } from './types'
import { generateColumnName, generateTableName } from './naming'

export enum ChangeType {
    ADD_TABLE = 'ADD_TABLE',
    DROP_TABLE = 'DROP_TABLE',
    RENAME_TABLE = 'RENAME_TABLE',
    ADD_COLUMN = 'ADD_COLUMN',
    DROP_COLUMN = 'DROP_COLUMN',
    ALTER_COLUMN = 'ALTER_COLUMN',
    ADD_FK = 'ADD_FK',
    DROP_FK = 'DROP_FK'
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

    if (!oldSnapshot) {
        for (const entity of newEntities) {
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

    const oldEntityIds = new Set(Object.keys(oldSnapshot.entities))
    const newEntityIds = new Set(newEntities.map((entity) => entity.id))

    for (const entity of newEntities) {
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
            const oldEntity = oldSnapshot.entities[oldEntityId]
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

    for (const entity of newEntities) {
        if (!oldEntityIds.has(entity.id)) continue

        const oldEntity = oldSnapshot.entities[entity.id]
        const newFieldIds = new Set(entity.fields.map((field) => field.id))
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
            if (!oldFieldIds.has(field.id)) {
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

        for (const oldFieldId of oldFieldIds) {
            if (!newFieldIds.has(oldFieldId)) {
                const oldField = oldEntity.fields[oldFieldId]
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

        for (const field of entity.fields) {
            if (!oldFieldIds.has(field.id)) continue

            const oldField = oldEntity.fields[field.id]

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
        }
    }

    diff.hasChanges = diff.additive.length > 0 || diff.destructive.length > 0
    diff.summary = buildSummary(diff)
    return diff
}
