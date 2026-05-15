import type { EntityDefinition, SchemaSnapshot } from './types'
import { resolveFieldColumnName, resolveEntityTableName, generateChildTableName } from './naming'
import { hasPhysicalRuntimeTable } from './builtinEntityKinds'

export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 2

export const buildSchemaSnapshot = (entities: EntityDefinition[]): SchemaSnapshot => {
    const snapshot: SchemaSnapshot = {
        version: CURRENT_SCHEMA_SNAPSHOT_VERSION,
        generatedAt: new Date().toISOString(),
        hasSystemTables: true,
        entities: {}
    }

    for (const entity of entities) {
        const physicalTableEnabled = hasPhysicalRuntimeTable(entity)
        const entityTableName = physicalTableEnabled ? resolveEntityTableName(entity) : null
        snapshot.entities[entity.id] = {
            kind: entity.kind,
            codename: entity.codename,
            tableName: entityTableName,
            physicalTableEnabled,
            fields: {}
        }

        for (const field of entity.fields) {
            // Skip child fields at top level — they are nested inside TABLE parent
            if (field.parentComponentId) continue

            const isTable = field.dataType === 'TABLE'
            const columnName = isTable ? generateChildTableName(field.id) : resolveFieldColumnName(field)

            // Collect child fields for TABLE components
            const childFields = isTable
                ? Object.fromEntries(
                      entity.fields
                          .filter((f) => f.parentComponentId === field.id)
                          .map((child) => [
                              child.id,
                              {
                                  codename: child.codename,
                                  columnName: resolveFieldColumnName(child),
                                  dataType: child.dataType,
                                  isRequired: child.isRequired,
                                  isDisplayComponent: child.isDisplayComponent ?? false,
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
                isDisplayComponent: field.isDisplayComponent ?? false,
                targetEntityId: field.targetEntityId ?? null,
                targetEntityKind: field.targetEntityKind ?? null,
                ...(childFields && Object.keys(childFields).length > 0 ? { childFields } : {})
            }
        }
    }

    return snapshot
}
