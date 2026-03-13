import { createApplicationsSchemaMigrationDefinition } from '../../platform/migrations'
import { applicationsSystemAppDefinition } from '../../platform/systemAppDefinition'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

describe('applications system-app definition', () => {
    it('keeps the migration chain stable for applications fresh fixed-schema bootstrap', () => {
        expect(
            applicationsSystemAppDefinition.migrations.map((entry) => (entry.kind === 'file' ? entry.migration.id : entry.definition.id))
        ).toEqual(['PrepareApplicationsSchemaSupport1800000000000', 'FinalizeApplicationsSchemaSupport1800000000001'])
    })

    it('keeps current and target business tables aligned for the effective fresh-bootstrap state', () => {
        expect(applicationsSystemAppDefinition.currentBusinessTables).toEqual(applicationsSystemAppDefinition.targetBusinessTables)
    })

    it('declares field-level metadata for application-like fixed business tables', () => {
        expect(applicationsSystemAppDefinition.targetBusinessTables).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'catalog',
                    codename: 'applications',
                    tableName: 'cat_applications',
                    presentation: expect.objectContaining({
                        name: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'Applications'
                                })
                            })
                        })
                    }),
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'name',
                            physicalColumnName: 'name',
                            dataType: 'JSON',
                            isRequired: true,
                            isDisplayAttribute: true,
                            presentation: expect.objectContaining({
                                name: expect.objectContaining({
                                    locales: expect.objectContaining({
                                        en: expect.objectContaining({
                                            content: 'Application Name'
                                        })
                                    })
                                })
                            })
                        }),
                        expect.objectContaining({
                            codename: 'schema_status',
                            physicalColumnName: 'schema_status',
                            dataType: 'STRING',
                            uiConfig: {
                                readOnly: true
                            }
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'relation',
                    codename: 'application_users',
                    tableName: 'rel_application_users',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'application_id',
                            physicalColumnName: 'application_id',
                            dataType: 'REF',
                            isRequired: true,
                            targetTableCodename: 'applications'
                        }),
                        expect.objectContaining({
                            codename: 'user_id',
                            physicalColumnName: 'user_id',
                            dataType: 'REF',
                            isRequired: true
                        })
                    ])
                })
            ])
        )
    })

    it('creates application-like applications fixed-schema tables directly for fresh bootstrap', () => {
        const createSql = normalizeSql(createApplicationsSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        for (const fragment of [
            'CREATE TABLE IF NOT EXISTS applications.cat_applications',
            'CREATE TABLE IF NOT EXISTS applications.cat_connectors',
            'CREATE TABLE IF NOT EXISTS applications.rel_connector_publications',
            'CREATE TABLE IF NOT EXISTS applications.rel_application_users'
        ]) {
            expect(createSql).toContain(normalizeSql(fragment))
        }

        expect(createSql).not.toMatch(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/)
        expect(createSql).not.toMatch(/CREATE INDEX(?! IF NOT EXISTS)/)
    })
})
