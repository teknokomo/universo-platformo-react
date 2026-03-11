import type { SqlMigrationDefinition } from './1766351182000-CreateMetahubsSchema.sql'

export const addTemplateDefinitionTypeMigrationDefinition: SqlMigrationDefinition = {
    id: 'AddTemplateDefinitionType1800000000100',
    version: '1800000000100',
    summary: 'Add definition_type column to metahubs.templates for application-definition model support',
    up: [
        {
            sql: `
                ALTER TABLE metahubs.templates
                ADD COLUMN IF NOT EXISTS definition_type TEXT NOT NULL DEFAULT 'metahub_template'
            `
        },
        {
            sql: `
                COMMENT ON COLUMN metahubs.templates.definition_type IS
                'Distinguishes template kind: metahub_template, application_template, or custom. Supports the unified application-definition model where Metahubs are a specialization.'
            `
        }
    ],
    down: [
        {
            sql: `
                ALTER TABLE metahubs.templates
                DROP COLUMN IF EXISTS definition_type
            `
        }
    ]
}
