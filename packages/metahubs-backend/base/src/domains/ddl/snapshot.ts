import type { EntityDefinition, SchemaSnapshot } from './types'
import { generateColumnName, generateTableName } from './naming'

export const CURRENT_SCHEMA_SNAPSHOT_VERSION = 2

export const buildSchemaSnapshot = (entities: EntityDefinition[]): SchemaSnapshot => {
    const snapshot: SchemaSnapshot = {
        version: CURRENT_SCHEMA_SNAPSHOT_VERSION,
        generatedAt: new Date().toISOString(),
        entities: {},
    }

    for (const entity of entities) {
        snapshot.entities[entity.id] = {
            kind: entity.kind,
            codename: entity.codename,
            tableName: generateTableName(entity.id, entity.kind),
            fields: {},
        }

        for (const field of entity.fields) {
            snapshot.entities[entity.id].fields[field.id] = {
                codename: field.codename,
                columnName: generateColumnName(field.id),
                dataType: field.dataType,
                isRequired: field.isRequired,
                targetEntityId: field.targetEntityId ?? null,
            }
        }
    }

    return snapshot
}
