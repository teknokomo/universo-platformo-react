import { createMetahubsSchemaMigrationDefinition, finalizeMetahubsSchemaSupportMigrationDefinition } from '../../platform/migrations'
import { metahubsSystemAppDefinition } from '../../platform/systemAppDefinition'

const normalizeSql = (value: string): string => value.replace(/\s+/g, ' ').trim()
const expectedSafePolicyDrop = (policyName: string, schemaName: string, tableName: string): string =>
    normalizeSql(`
DO $$
BEGIN
    IF to_regclass('${schemaName}.${tableName}') IS NOT NULL THEN
        BEGIN
            EXECUTE format(
                'DROP POLICY IF EXISTS %I ON %I.%I',
                '${policyName}',
                '${schemaName}',
                '${tableName}'
            );
        EXCEPTION
            WHEN undefined_table THEN NULL;
        END;
    END IF;
END $$;
    `)

describe('metahubs fixed-schema parity contract', () => {
    it('keeps the system-app manifest migration chain stable for metahubs bootstrap', () => {
        expect(metahubsSystemAppDefinition.key).toBe('metahubs')
        expect(metahubsSystemAppDefinition.schemaTarget).toEqual({
            kind: 'fixed',
            schemaName: 'metahubs'
        })
        expect(
            metahubsSystemAppDefinition.migrations.map((entry) => (entry.kind === 'file' ? entry.migration.id : entry.definition.id))
        ).toEqual([
            'PrepareMetahubsSchemaSupport1766351182000',
            'FinalizeMetahubsSchemaSupport1766351182001',
            'SeedBuiltinMetahubTemplates1800000000250'
        ])
        expect(metahubsSystemAppDefinition.currentBusinessTables).toEqual(metahubsSystemAppDefinition.targetBusinessTables)
    })

    it('declares field-level metadata for metahubs business tables used by fixed-schema runtime', () => {
        expect(metahubsSystemAppDefinition.targetBusinessTables).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    kind: 'catalog',
                    codename: 'metahubs',
                    tableName: 'cat_metahubs',
                    presentation: expect.objectContaining({
                        name: expect.objectContaining({
                            locales: expect.objectContaining({
                                en: expect.objectContaining({
                                    content: 'Metahubs'
                                })
                            })
                        })
                    }),
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'codename',
                            physicalColumnName: 'codename',
                            dataType: 'JSON',
                            isRequired: true
                        }),
                        expect.objectContaining({
                            codename: 'default_branch_id',
                            physicalColumnName: 'default_branch_id',
                            dataType: 'REF',
                            targetTableCodename: 'metahub_branches'
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'document',
                    codename: 'publications',
                    tableName: 'doc_publications',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'access_mode',
                            physicalColumnName: 'access_mode',
                            dataType: 'STRING',
                            isRequired: true,
                            uiConfig: {
                                control: 'select'
                            }
                        }),
                        expect.objectContaining({
                            codename: 'auto_create_application',
                            physicalColumnName: 'auto_create_application',
                            dataType: 'BOOLEAN',
                            isRequired: true
                        }),
                        expect.objectContaining({
                            codename: 'active_version_id',
                            physicalColumnName: 'active_version_id',
                            dataType: 'REF',
                            targetTableCodename: 'publication_versions'
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'document',
                    codename: 'publication_versions',
                    tableName: 'doc_publication_versions',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'snapshot_json',
                            physicalColumnName: 'snapshot_json',
                            dataType: 'JSON',
                            isRequired: true,
                            uiConfig: {
                                editor: 'json'
                            }
                        }),
                        expect.objectContaining({
                            codename: 'publication_id',
                            physicalColumnName: 'publication_id',
                            dataType: 'REF',
                            isRequired: true,
                            targetTableCodename: 'publications'
                        })
                    ])
                })
            ])
        )
    })

    it('preserves the required metahubs schema artifacts used by current runtime and UI packages', () => {
        const upSql = normalizeSql(createMetahubsSchemaMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        const requiredTypes = [
            'CREATE TYPE metahubs.attribute_data_type AS ENUM',
            'CREATE TYPE metahubs.publication_access_mode AS ENUM',
            'CREATE TYPE metahubs.publication_schema_status AS ENUM'
        ]
        const requiredTables = [
            'CREATE TABLE metahubs.cat_metahubs (',
            'CREATE TABLE metahubs.cat_metahub_branches (',
            'CREATE TABLE metahubs.cat_templates (',
            'CREATE TABLE metahubs.doc_template_versions (',
            'CREATE TABLE metahubs.rel_metahub_users (',
            'CREATE TABLE IF NOT EXISTS metahubs.doc_publications (',
            'CREATE TABLE metahubs.doc_publication_versions ('
        ]
        const requiredPolicies = [
            'CREATE POLICY "templates_read_all" ON metahubs.cat_templates',
            'CREATE POLICY "templates_write_superuser" ON metahubs.cat_templates',
            'CREATE POLICY "template_versions_read_all" ON metahubs.doc_template_versions',
            'CREATE POLICY "template_versions_write_superuser" ON metahubs.doc_template_versions',
            'CREATE POLICY "Allow users to manage their metahub memberships" ON metahubs.rel_metahub_users',
            'CREATE POLICY "Allow users to manage their own metahubs" ON metahubs.cat_metahubs',
            'CREATE POLICY "pub_access_via_metahub" ON metahubs.doc_publications',
            'CREATE POLICY "publications_versions_policy" ON metahubs.doc_publication_versions'
        ]
        const requiredPolicyDrops = [
            expectedSafePolicyDrop('templates_read_all', 'metahubs', 'cat_templates'),
            expectedSafePolicyDrop('templates_write_superuser', 'metahubs', 'cat_templates'),
            expectedSafePolicyDrop('template_versions_read_all', 'metahubs', 'doc_template_versions'),
            expectedSafePolicyDrop('template_versions_write_superuser', 'metahubs', 'doc_template_versions'),
            expectedSafePolicyDrop('Allow users to manage their metahub memberships', 'metahubs', 'rel_metahub_users'),
            expectedSafePolicyDrop('Allow users to manage their own metahubs', 'metahubs', 'cat_metahubs'),
            expectedSafePolicyDrop('branches_access_via_metahub', 'metahubs', 'cat_metahub_branches'),
            expectedSafePolicyDrop('pub_access_via_metahub', 'metahubs', 'doc_publications'),
            expectedSafePolicyDrop('publications_versions_policy', 'metahubs', 'doc_publication_versions')
        ]
        const requiredIndexes = [
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_metahubs_codename_active',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_branches_metahub_number_active',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_codename_active',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_template_versions_number',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_schema_name_active',
            'CREATE UNIQUE INDEX IF NOT EXISTS idx_publications_versions_number_active',
            'CREATE INDEX IF NOT EXISTS idx_pub_schema_name ON metahubs.doc_publications(schema_name)'
        ]
        const requiredRlsEnables = [
            'ALTER TABLE metahubs.cat_metahubs ENABLE ROW LEVEL SECURITY',
            'ALTER TABLE metahubs.cat_metahub_branches ENABLE ROW LEVEL SECURITY',
            'ALTER TABLE metahubs.rel_metahub_users ENABLE ROW LEVEL SECURITY',
            'ALTER TABLE metahubs.doc_publications ENABLE ROW LEVEL SECURITY',
            'ALTER TABLE metahubs.doc_publication_versions ENABLE ROW LEVEL SECURITY',
            'ALTER TABLE metahubs.cat_templates ENABLE ROW LEVEL SECURITY',
            'ALTER TABLE metahubs.doc_template_versions ENABLE ROW LEVEL SECURITY'
        ]

        for (const fragment of [
            ...requiredTypes,
            ...requiredTables,
            ...requiredPolicies,
            ...requiredPolicyDrops,
            ...requiredIndexes,
            ...requiredRlsEnables
        ]) {
            expect(upSql).toContain(normalizeSql(fragment))
        }

        expect(upSql).not.toMatch(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/)
        expect(upSql).not.toMatch(/CREATE INDEX(?! IF NOT EXISTS)/)
    })

    it('keeps post-generation auth-user FK creation idempotent', () => {
        const finalizeSql = normalizeSql(finalizeMetahubsSchemaSupportMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        expect(finalizeSql).toContain(
            normalizeSql(`
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_mu_auth_user'
    ) THEN
        ALTER TABLE metahubs.rel_metahub_users
        ADD CONSTRAINT fk_mu_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
            `)
        )
    })

    it('keeps destructive down contract explicit for metahubs schema reset on fresh test databases', () => {
        const downSql = normalizeSql(createMetahubsSchemaMigrationDefinition.down.map((statement) => statement.sql).join('\n'))

        for (const fragment of [
            'DROP TABLE IF EXISTS metahubs.doc_publication_versions',
            'DROP TABLE IF EXISTS metahubs.doc_publications',
            'DROP TABLE IF EXISTS metahubs.rel_metahub_users',
            'DROP TABLE IF EXISTS metahubs.doc_template_versions',
            'DROP TABLE IF EXISTS metahubs.cat_templates',
            'DROP TABLE IF EXISTS metahubs.cat_metahub_branches',
            'DROP TABLE IF EXISTS metahubs.cat_metahubs',
            'DROP TYPE IF EXISTS metahubs.attribute_data_type',
            'DROP TYPE IF EXISTS metahubs.publication_access_mode',
            'DROP TYPE IF EXISTS metahubs.publication_schema_status',
            'DROP SCHEMA IF EXISTS metahubs CASCADE'
        ]) {
            expect(downSql).toContain(normalizeSql(fragment))
        }
    })
})
