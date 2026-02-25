import type { EntityDefinition, SchemaSnapshot } from './types'
import { generateColumnName, generateTableName, generateChildTableName } from './naming'

export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 2

export const buildSchemaSnapshot = (entities: EntityDefinition[]): SchemaSnapshot => {
    const snapshot: SchemaSnapshot = {
        version: CURRENT_SCHEMA_SNAPSHOT_VERSION,
        generatedAt: new Date().toISOString(),
        hasSystemTables: true,
        entities: {}
    }

    for (const entity of entities) {
        const entityTableName = generateTableName(entity.id, entity.kind)
        snapshot.entities[entity.id] = {
            kind: entity.kind,
            codename: entity.codename,
            tableName: entityTableName,
            fields: {}
        }

        for (const field of entity.fields) {
            // Skip child fields at top level — they are nested inside TABLE parent
            if (field.parentAttributeId) continue

            const isTable = field.dataType === 'TABLE'
            const columnName = isTable ? generateChildTableName(field.id) : generateColumnName(field.id)

            // Collect child fields for TABLE attributes
            const childFields = isTable
                ? Object.fromEntries(
                      entity.fields
                          .filter((f) => f.parentAttributeId === field.id)
                          .map((child) => [
                              child.id,
                              {
                                  codename: child.codename,
                                  columnName: generateColumnName(child.id),
                                  dataType: child.dataType,
                                  isRequired: child.isRequired,
                                  targetEntityId: child.targetEntityId ?? null,
                                  targetEntityKind: child.targetEntityKind ?? null
                              }
                          ])
                  )
                : undefined

            snapshot.entities[entity.id].fields[field.id] = {
                codename: field.codename,
                columnName,
                dataType: field.dataType,
                isRequired: field.isRequired,
                targetEntityId: field.targetEntityId ?? null,
                targetEntityKind: field.targetEntityKind ?? null,
                ...(childFields && Object.keys(childFields).length > 0 ? { childFields } : {})
            }
        }
    }

    return snapshot
}
