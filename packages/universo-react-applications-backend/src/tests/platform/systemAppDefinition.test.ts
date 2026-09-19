import {
    addApplicationAliasesMigrationDefinition,
    createApplicationsSchemaMigrationDefinition,
    finalizeApplicationsSchemaSupportMigrationDefinition
} from '../../platform/migrations'
import { applicationsSystemAppDefinition } from '../../platform/systemAppDefinition'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()

describe('applications system-app definition', () => {
    it('keeps the migration chain stable for applications fresh fixed-schema bootstrap', () => {
        expect(
            applicationsSystemAppDefinition.migrations.map((entry) => (entry.kind === 'file' ? entry.migration.id : entry.definition.id))
        ).toEqual([
            'PrepareApplicationsSchemaSupport1800000000000',
            'FinalizeApplicationsSchemaSupport1800000000001',
            'AddApplicationSettings1800000000100',
            'AddApplicationAliases1800000000101'
        ])
    })

    it('keeps current and target business tables aligned for the effective fresh-bootstrap state', () => {
        expect(applicationsSystemAppDefinition.currentBusinessTables).toEqual(applicationsSystemAppDefinition.targetBusinessTables)
    })

    it('declares field-level metadata for application-like fixed business tables', () => {
        expect(applicationsSystemAppDefinition.targetBusinessTables).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'object',
                    codename: 'applications',
                    tableName: 'obj_applications',
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
                            isDisplayComponent: true,
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
                        }),
                        expect.objectContaining({
                            codename: 'alias_routing_mode',
                            physicalColumnName: 'alias_routing_mode',
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

    it('keeps the applied finalize baseline byte-stable while the manifest retains the legacy slug column', () => {
        const finalizeSql = normalizeSql(
            finalizeApplicationsSchemaSupportMigrationDefinition.up.map((statement) => statement.sql).join('\n')
        )
        const slugField = applicationsSystemAppDefinition.targetBusinessTables
            .find((table) => table.codename === 'applications')
            ?.fields?.find((field) => field.codename === 'slug')

        // The frozen post-schema baseline still creates the slug indexes, so the
        // manifest must keep the physical column until a future migration retires it.
        expect(finalizeSql).toContain('applications.obj_applications (slug)')
        expect(finalizeSql).not.toContain('obj_application_aliases')
        expect(slugField).toEqual(
            expect.objectContaining({
                physicalColumnName: 'slug',
                dataType: 'STRING',
                uiConfig: expect.objectContaining({
                    hidden: true,
                    formHidden: true,
                    readOnly: true
                })
            })
        )
    })

    it('creates application-like fixed-schema tables in the clean baseline', () => {
        const createSql = normalizeSql(createApplicationsSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        for (const fragment of [
            'CREATE TABLE IF NOT EXISTS applications.obj_applications',
            'CREATE TABLE IF NOT EXISTS applications.obj_connectors',
            'CREATE TABLE IF NOT EXISTS applications.rel_connector_publications',
            'CREATE TABLE IF NOT EXISTS applications.rel_application_users'
        ]) {
            expect(createSql).toContain(normalizeSql(fragment))
        }

        expect(createSql).not.toMatch(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/)
        expect(createSql).not.toMatch(/CREATE INDEX(?! IF NOT EXISTS)/)
    })

    it('declares the alias support only through the dedicated post-schema alias migration', () => {
        const finalizeSql = normalizeSql(
            finalizeApplicationsSchemaSupportMigrationDefinition.up.map((statement) => statement.sql).join('\n')
        )
        const aliasSql = normalizeSql(addApplicationAliasesMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        expect(finalizeSql).not.toContain('CREATE TABLE IF NOT EXISTS applications.obj_application_aliases')
        expect(aliasSql).toContain('CREATE TABLE IF NOT EXISTS applications.obj_application_aliases')
        expect(aliasSql).toContain('alias_routing_mode VARCHAR(20) NOT NULL DEFAULT')
        expect(aliasSql).toContain('ON DELETE RESTRICT')
        expect(aliasSql).toContain('WHERE released_at IS NULL')
        expect(aliasSql).toContain('applications_alias_routing_mode_ck')
        expect(aliasSql).toContain('CREATE OR REPLACE FUNCTION applications.resolve_application_alias')
        expect(aliasSql).toContain('GRANT EXECUTE ON FUNCTION applications.resolve_application_alias(TEXT) TO authenticated')
    })

    it('keeps applications RLS policies decomposed by operation for public join and membership management', () => {
        const createSql = normalizeSql(createApplicationsSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        for (const fragment of [
            'CREATE POLICY "Allow users to read visible applications" ON applications.obj_applications FOR SELECT',
            'CREATE POLICY "Allow users to create applications" ON applications.obj_applications FOR INSERT',
            'CREATE POLICY "Allow application creators to bootstrap owner memberships" ON applications.rel_application_users FOR INSERT',
            'CREATE POLICY "Allow users to join public applications" ON applications.rel_application_users FOR INSERT',
            'CREATE POLICY "Allow app owners and admins to update memberships" ON applications.rel_application_users FOR UPDATE',
            'CREATE POLICY "Allow users to leave applications" ON applications.rel_application_users FOR UPDATE'
        ]) {
            expect(createSql).toContain(normalizeSql(fragment))
        }

        expect(createSql).not.toContain(normalizeSql('CREATE POLICY "Allow users to manage their own applications"'))
        expect(createSql).not.toContain(normalizeSql('CREATE POLICY "Allow users to manage their application memberships"'))
    })

    it('keeps alias create-only access out of arbitrary alias UPDATE and uses an atomic primary transition function', () => {
        const aliasSql = normalizeSql(addApplicationAliasesMigrationDefinition.up.map((statement) => statement.sql).join('\n'))
        const updatePolicyStart = aliasSql.indexOf('CREATE POLICY "Allow application alias managers to update aliases"')
        const nextPolicyStart = aliasSql.indexOf('CREATE POLICY', updatePolicyStart + 1)
        const updatePolicy = aliasSql.slice(updatePolicyStart, nextPolicyStart === -1 ? undefined : nextPolicyStart)

        expect(updatePolicyStart).toBeGreaterThanOrEqual(0)
        expect(updatePolicy).not.toContain("'create'")
        expect(updatePolicy).toContain("'update'")
        expect(aliasSql).toContain('CREATE OR REPLACE FUNCTION applications.create_application_alias')
        expect(aliasSql).toContain("admin.has_permission(p_user_id, 'applicationAliases', 'update', '{}'::jsonb)")
        expect(aliasSql).toContain('Application alias primary permission denied')
        expect(aliasSql).toContain('pg_advisory_xact_lock(hashtext')
        expect(aliasSql).toContain('REVOKE ALL ON FUNCTION applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID) FROM PUBLIC')
        expect(normalizeSql(addApplicationAliasesMigrationDefinition.down.map((statement) => statement.sql).join('\n'))).toContain(
            'DROP FUNCTION IF EXISTS applications.create_application_alias(UUID, TEXT, BOOLEAN, UUID)'
        )
    })
})
