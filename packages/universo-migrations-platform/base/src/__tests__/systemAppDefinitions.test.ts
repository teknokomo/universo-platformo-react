import {
    buildRegisteredSystemAppSchemaGenerationPlan,
    buildSystemAppSchemaGenerationPlan,
    exportRegisteredSystemAppSchemaGenerationPlans,
    findRegisteredSystemAppDefinition,
    resolveRegisteredSystemAppSystemTableCapabilities,
    resolveSystemAppSystemTableCapabilities,
    systemAppDefinitions,
    validateRegisteredSystemAppDefinitions,
    validateRegisteredSystemAppSchemaGenerationPlans
} from '../systemAppDefinitions'

describe('systemAppDefinitions compiler capability bridge', () => {
    it('resolves target compiler system tables for profile as a minimal application-like fixed schema', () => {
        const profileDefinition = findRegisteredSystemAppDefinition('profiles')

        expect(profileDefinition).not.toBeNull()
        expect(resolveSystemAppSystemTableCapabilities(profileDefinition!)).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('resolves target compiler system tables for metahubs as metadata-aware application-like fixed schema', () => {
        const metahubsDefinition = findRegisteredSystemAppDefinition('metahubs')

        expect(metahubsDefinition).not.toBeNull()
        expect(resolveSystemAppSystemTableCapabilities(metahubsDefinition!)).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('preserves explicit profile manifest metadata in schema generation plans', () => {
        expect(buildRegisteredSystemAppSchemaGenerationPlan('profiles')).toEqual(
            expect.objectContaining({
                definitionKey: 'profiles',
                businessTables: expect.arrayContaining([
                    expect.objectContaining({
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
                                uiConfig: {
                                    editor: 'json'
                                }
                            })
                        ])
                    })
                ])
            })
        )
    })

    it('preserves field-level metadata for admin business tables in schema generation plans', () => {
        expect(buildRegisteredSystemAppSchemaGenerationPlan('admin')).toEqual(
            expect.objectContaining({
                definitionKey: 'admin',
                businessTables: expect.arrayContaining([
                    expect.objectContaining({
                        kind: 'catalog',
                        codename: 'roles',
                        tableName: 'cat_roles',
                        presentation: expect.objectContaining({
                            name: expect.objectContaining({
                                locales: expect.objectContaining({
                                    en: expect.objectContaining({
                                        content: 'Roles'
                                    })
                                })
                            })
                        }),
                        fields: expect.arrayContaining([
                            expect.objectContaining({
                                codename: 'codename',
                                physicalColumnName: 'codename',
                                dataType: 'STRING',
                                isRequired: true,
                                validationRules: {
                                    maxLength: 50,
                                    pattern: '^[a-z0-9:_-]+$'
                                }
                            }),
                            expect.objectContaining({
                                codename: 'name',
                                physicalColumnName: 'name',
                                dataType: 'JSON',
                                isDisplayAttribute: true,
                                presentation: expect.objectContaining({
                                    name: expect.objectContaining({
                                        locales: expect.objectContaining({
                                            en: expect.objectContaining({
                                                content: 'Role Name'
                                            })
                                        })
                                    })
                                })
                            })
                        ])
                    }),
                    expect.objectContaining({
                        kind: 'settings',
                        codename: 'settings',
                        tableName: 'cfg_settings',
                        fields: expect.arrayContaining([
                            expect.objectContaining({
                                codename: 'value',
                                physicalColumnName: 'value',
                                dataType: 'JSON',
                                isRequired: true,
                                uiConfig: {
                                    editor: 'json'
                                }
                            })
                        ])
                    }),
                    expect.objectContaining({
                        kind: 'relation',
                        codename: 'role_permissions',
                        tableName: 'rel_role_permissions',
                        fields: expect.arrayContaining([
                            expect.objectContaining({
                                codename: 'role_id',
                                physicalColumnName: 'role_id',
                                dataType: 'REF',
                                isRequired: true,
                                targetTableCodename: 'roles'
                            })
                        ])
                    })
                ])
            })
        )
    })

    it('preserves field-level metadata for applications business tables in schema generation plans', () => {
        expect(buildRegisteredSystemAppSchemaGenerationPlan('applications')).toEqual(
            expect.objectContaining({
                definitionKey: 'applications',
                businessTables: expect.arrayContaining([
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
            })
        )
    })

    it('preserves field-level metadata for metahubs business tables in schema generation plans', () => {
        expect(buildRegisteredSystemAppSchemaGenerationPlan('metahubs')).toEqual(
            expect.objectContaining({
                definitionKey: 'metahubs',
                businessTables: expect.arrayContaining([
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
                                dataType: 'STRING',
                                isRequired: true
                            }),
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
                                                content: 'Metahub Name'
                                            })
                                        })
                                    })
                                })
                            })
                        ])
                    }),
                    expect.objectContaining({
                        kind: 'document',
                        codename: 'publication_versions',
                        tableName: 'doc_publication_versions',
                        fields: expect.arrayContaining([
                            expect.objectContaining({
                                codename: 'publication_id',
                                physicalColumnName: 'publication_id',
                                dataType: 'REF',
                                isRequired: true,
                                targetTableCodename: 'publications'
                            }),
                            expect.objectContaining({
                                codename: 'snapshot_json',
                                physicalColumnName: 'snapshot_json',
                                dataType: 'JSON',
                                isRequired: true,
                                uiConfig: {
                                    editor: 'json'
                                }
                            })
                        ])
                    })
                ])
            })
        )
    })

    it('keeps string validation limits within the declared VARCHAR length for registered fixed system apps', () => {
        const varcharLengthPattern = /^VARCHAR\((\d+)\)$/i

        for (const definition of systemAppDefinitions) {
            for (const table of definition.targetBusinessTables) {
                for (const field of table.fields ?? []) {
                    if (!field.validationRules?.maxLength || !field.physicalDataType) {
                        continue
                    }

                    const match = field.physicalDataType.match(varcharLengthPattern)
                    if (!match) {
                        continue
                    }

                    expect(field.validationRules.maxLength).toBeLessThanOrEqual(Number(match[1]))
                }
            }
        }
    })

    it('resolves current-stage compiler contract to the effective fresh-bootstrap application-like state', () => {
        expect(resolveRegisteredSystemAppSystemTableCapabilities('profiles', 'current')).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })

        expect(resolveRegisteredSystemAppSystemTableCapabilities('applications', 'target')).toEqual({
            includeAttributes: true,
            includeValues: false,
            includeLayouts: false,
            includeWidgets: false
        })
    })

    it('rejects unknown registered system app keys', () => {
        expect(() => resolveRegisteredSystemAppSystemTableCapabilities('unknown-system-app')).toThrow(
            'Unknown registered system app definition key: unknown-system-app'
        )
    })

    it('keeps registered system app order deterministic for fixed-schema bootstrap', () => {
        expect(systemAppDefinitions.map((definition) => definition.key)).toEqual([
            'public',
            'admin',
            'profiles',
            'metahubs',
            'applications'
        ])
    })

    it('keeps the registered system app manifest set valid as a startup contract', () => {
        expect(validateRegisteredSystemAppDefinitions()).toEqual({
            ok: true,
            issues: []
        })
    })

    it('builds deterministic target schema generation plans for fixed system apps', () => {
        expect(buildRegisteredSystemAppSchemaGenerationPlan('profiles')).toEqual({
            definitionKey: 'profiles',
            displayName: 'Profiles',
            schemaName: 'profiles',
            stage: 'target',
            storageModel: 'application_like',
            structureVersion: '0.1.0',
            configurationVersion: '0.1.0',
            structureCapabilities: {
                appCoreTables: true,
                catalogTables: true,
                documentTables: false,
                relationTables: false,
                settingsTables: true,
                layoutTables: false,
                widgetTables: false,
                attributeValueTables: false
            },
            systemTableCapabilities: {
                includeAttributes: true,
                includeValues: false,
                includeLayouts: false,
                includeWidgets: false
            },
            businessTables: [
                expect.objectContaining({
                    kind: 'catalog',
                    codename: 'profiles',
                    tableName: 'cat_profiles',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'nickname',
                            physicalColumnName: 'nickname',
                            dataType: 'STRING',
                            isDisplayAttribute: true
                        })
                    ])
                })
            ]
        })
    })

    it('can build current-stage schema generation plans for the effective fixed-schema application-like state', () => {
        const metahubsDefinition = findRegisteredSystemAppDefinition('metahubs')

        expect(metahubsDefinition).not.toBeNull()
        expect(buildSystemAppSchemaGenerationPlan(metahubsDefinition!, 'current')).toEqual({
            definitionKey: 'metahubs',
            displayName: 'Metahubs',
            schemaName: 'metahubs',
            stage: 'current',
            storageModel: 'application_like',
            structureVersion: '0.1.0',
            configurationVersion: '0.1.0',
            structureCapabilities: {
                appCoreTables: true,
                catalogTables: true,
                documentTables: true,
                relationTables: true,
                settingsTables: true,
                layoutTables: false,
                widgetTables: false,
                attributeValueTables: false
            },
            systemTableCapabilities: {
                includeAttributes: true,
                includeValues: false,
                includeLayouts: false,
                includeWidgets: false
            },
            businessTables: [
                expect.objectContaining({
                    kind: 'catalog',
                    codename: 'metahubs',
                    tableName: 'cat_metahubs',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'codename',
                            physicalColumnName: 'codename',
                            dataType: 'STRING',
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'catalog',
                    codename: 'metahub_branches',
                    tableName: 'cat_metahub_branches',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'schema_name',
                            physicalColumnName: 'schema_name',
                            dataType: 'STRING',
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'relation',
                    codename: 'metahub_users',
                    tableName: 'rel_metahub_users',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'user_id',
                            physicalColumnName: 'user_id',
                            dataType: 'REF',
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'catalog',
                    codename: 'templates',
                    tableName: 'cat_templates',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'is_active',
                            physicalColumnName: 'is_active',
                            dataType: 'BOOLEAN',
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'document',
                    codename: 'template_versions',
                    tableName: 'doc_template_versions',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'manifest_json',
                            physicalColumnName: 'manifest_json',
                            dataType: 'JSON',
                            isRequired: true
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
                            isRequired: true
                        })
                    ])
                }),
                expect.objectContaining({
                    kind: 'document',
                    codename: 'publication_versions',
                    tableName: 'doc_publication_versions',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            codename: 'snapshot_hash',
                            physicalColumnName: 'snapshot_hash',
                            dataType: 'STRING',
                            isRequired: true
                        })
                    ])
                })
            ]
        })
    })

    it('validates registered target schema generation plans as a future cutover contract', () => {
        const validation = validateRegisteredSystemAppSchemaGenerationPlans()

        expect(validation.ok).toBe(true)
        expect(validation.issues).toEqual([])
        expect(validation.plans).toHaveLength(systemAppDefinitions.length)
    })

    it('exports deterministic registered target schema generation plans', () => {
        const plans = exportRegisteredSystemAppSchemaGenerationPlans()

        expect(plans).toHaveLength(systemAppDefinitions.length)
        expect(plans[0]).toEqual({
            definitionKey: 'public',
            displayName: 'Public',
            schemaName: 'public',
            stage: 'target',
            storageModel: 'legacy_fixed',
            structureVersion: '0.1.0',
            configurationVersion: '0.1.0',
            structureCapabilities: {
                appCoreTables: false,
                catalogTables: false,
                documentTables: false,
                relationTables: false,
                settingsTables: false,
                layoutTables: false,
                widgetTables: false,
                attributeValueTables: false
            },
            systemTableCapabilities: {
                includeAttributes: false,
                includeValues: false,
                includeLayouts: false,
                includeWidgets: false
            },
            businessTables: []
        })
    })
})
