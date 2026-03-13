import { addProfileMigrationDefinition } from '../../platform/migrations'
import { profileSystemAppDefinition } from '../../platform/systemAppDefinition'

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

describe('profile system app definition contract', () => {
    it('declares explicit version and runtime metadata', () => {
        expect(profileSystemAppDefinition.manifestVersion).toBe(1)
        expect(profileSystemAppDefinition.engineVersion).toBe('0.1.0')
        expect(profileSystemAppDefinition.structureVersion).toBe('0.1.0')
        expect(profileSystemAppDefinition.configurationVersion).toBe('0.1.0')
        expect(profileSystemAppDefinition.runtimeCapabilities).toEqual({
            supportsPublicationSync: false,
            supportsTemplateVersions: false,
            usesCurrentUiShell: 'universo-template-mui'
        })
        expect(profileSystemAppDefinition.currentStorageModel).toBe('application_like')
        expect(profileSystemAppDefinition.targetStorageModel).toBe('application_like')
        expect(profileSystemAppDefinition.currentStructureCapabilities).toEqual({
            appCoreTables: true,
            catalogTables: true,
            documentTables: false,
            relationTables: false,
            settingsTables: true,
            layoutTables: false,
            widgetTables: false,
            attributeValueTables: false
        })
        expect(profileSystemAppDefinition.targetStructureCapabilities).toEqual({
            appCoreTables: true,
            catalogTables: true,
            documentTables: false,
            relationTables: false,
            settingsTables: true,
            layoutTables: false,
            widgetTables: false,
            attributeValueTables: false
        })
        expect(profileSystemAppDefinition.currentBusinessTables).toEqual([
            expect.objectContaining({
                kind: 'catalog',
                codename: 'profiles',
                tableName: 'cat_profiles',
                presentation: expect.objectContaining({
                    name: expect.objectContaining({
                        locales: expect.objectContaining({
                            en: expect.objectContaining({
                                content: 'Profiles'
                            })
                        })
                    })
                }),
                fields: expect.arrayContaining([
                    expect.objectContaining({
                        codename: 'nickname',
                        physicalColumnName: 'nickname',
                        dataType: 'STRING',
                        isRequired: true,
                        isDisplayAttribute: true,
                        presentation: expect.objectContaining({
                            name: expect.objectContaining({
                                locales: expect.objectContaining({
                                    en: expect.objectContaining({
                                        content: 'Nickname'
                                    })
                                })
                            })
                        }),
                        validationRules: {
                            minLength: 2,
                            maxLength: 50,
                            trim: true
                        }
                    }),
                    expect.objectContaining({
                        codename: 'settings',
                        physicalColumnName: 'settings',
                        dataType: 'JSON',
                        isRequired: true,
                        uiConfig: {
                            editor: 'json'
                        }
                    })
                ])
            })
        ])
        expect(profileSystemAppDefinition.targetBusinessTables).toEqual(profileSystemAppDefinition.currentBusinessTables)
        expect(profileSystemAppDefinition.repeatableSeeds).toEqual([])
    })

    it('pins the fixed schema target to profiles', () => {
        expect(profileSystemAppDefinition.schemaTarget).toEqual({
            kind: 'fixed',
            schemaName: 'profiles'
        })
    })

    it('keeps manifest validation limits aligned with the physical fixed-schema contract', () => {
        const nicknameField = profileSystemAppDefinition.currentBusinessTables[0]?.fields?.find((field) => field.codename === 'nickname')

        expect(nicknameField).toEqual(
            expect.objectContaining({
                physicalDataType: 'VARCHAR(50)',
                validationRules: expect.objectContaining({
                    maxLength: 50
                })
            })
        )
    })

    it('keeps migration chain order deterministic for profile bootstrap and reconciliation', () => {
        expect(
            profileSystemAppDefinition.migrations.map((entry) => (entry.kind === 'sql' ? entry.definition.id : entry.migration.id))
        ).toEqual(['PrepareProfileSchemaSupport1741277504477', 'FinalizeProfileSchemaSupport1741277504478'])
    })

    it('keeps profile index creation idempotent for restart-safe bootstrap', () => {
        const upSql = normalizeSql(addProfileMigrationDefinition.up.map((statement) => statement.sql).join('\n'))

        for (const fragment of [
            expectedSafePolicyDrop('Allow users to view own profile', 'profiles', 'cat_profiles'),
            expectedSafePolicyDrop('Allow users to update own profile', 'profiles', 'cat_profiles'),
            expectedSafePolicyDrop('Allow profile creation for existing users', 'profiles', 'cat_profiles')
        ]) {
            expect(upSql).toContain(fragment)
        }

        expect(upSql).not.toMatch(/CREATE UNIQUE INDEX(?! IF NOT EXISTS)/)
        expect(upSql).not.toMatch(/CREATE INDEX(?! IF NOT EXISTS)/)
    })
})
