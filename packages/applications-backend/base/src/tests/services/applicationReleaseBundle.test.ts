import {
    calculateCanonicalApplicationReleaseSnapshotHash,
    buildInstalledReleaseMetadataFromBundle,
    calculateApplicationReleaseChecksum,
    createApplicationReleaseBundle,
    extractInstalledReleaseVersion,
    resolveApplicationReleaseSnapshotHash,
    validateApplicationReleaseBundleArtifacts
} from '../../services/applicationReleaseBundle'
import { createLoadPublishedApplicationSyncContext } from '../../services/applicationSyncContracts'

const createCodenameVlc = (primary: string, secondary?: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: { content: primary, version: 1, isActive: true },
        ...(secondary ? { ru: { content: secondary, version: 1, isActive: true } } : {})
    }
})

describe('applicationReleaseBundle', () => {
    const snapshot = {
        versionEnvelope: {
            structureVersion: '53.0.0',
            templateVersion: null,
            snapshotFormatVersion: 1 as const
        },
        entities: {
            catalog_products: {
                id: 'catalog-products',
                codename: createCodenameVlc('products', 'продукты'),
                kind: 'catalog',
                physicalTableEnabled: true,
                fields: []
            }
        },
        elements: {},
        layouts: []
    }
    const previousSchemaSnapshot = {
        version: 1,
        generatedAt: '2026-03-13T09:00:00.000Z',
        hasSystemTables: true,
        entities: {}
    }
    const publicationSnapshotHash = calculateCanonicalApplicationReleaseSnapshotHash(snapshot, 'publication')
    const applicationSnapshotHash = calculateCanonicalApplicationReleaseSnapshotHash(snapshot, 'application')

    it('creates a deterministic release bundle contract from a publication snapshot', () => {
        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot,
            snapshotHash: publicationSnapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            previousReleaseVersion: 'publication-version-0',
            previousSchemaSnapshot,
            generatedAt: '2026-03-13T10:00:00.000Z'
        })

        expect(bundle).toEqual({
            kind: 'application_release_bundle',
            bundleVersion: 1,
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            manifest: expect.objectContaining({
                engineVersion: 'metahub-snapshot/v1',
                structureVersion: '53.0.0',
                sourceKind: 'publication',
                generatedAt: '2026-03-13T10:00:00.000Z',
                applicationId: 'application-1',
                applicationKey: 'products-app',
                publicationId: 'publication-1',
                publicationVersionId: 'publication-version-1',
                snapshotHash: publicationSnapshotHash
            }),
            snapshot,
            bootstrap: {
                kind: 'baseline_sql',
                checksum: expect.any(String),
                payload: {
                    entities: [
                        expect.objectContaining({
                            id: 'catalog-products',
                            codename: 'products',
                            kind: 'catalog',
                            config: {}
                        })
                    ],
                    schemaSnapshot: expect.objectContaining({
                        hasSystemTables: expect.any(Boolean),
                        entities: expect.any(Object)
                    })
                }
            },
            incrementalMigration: {
                fromVersion: 'publication-version-0',
                baseSchemaSnapshot: previousSchemaSnapshot,
                kind: 'ddl_plan',
                checksum: expect.any(String),
                diff: expect.objectContaining({
                    hasChanges: true,
                    additive: expect.any(Array),
                    destructive: expect.any(Array)
                }),
                payload: {
                    entities: [
                        expect.objectContaining({
                            id: 'catalog-products',
                            codename: 'products',
                            kind: 'catalog',
                            config: {}
                        })
                    ],
                    schemaSnapshot: expect.objectContaining({
                        hasSystemTables: expect.any(Boolean),
                        entities: expect.any(Object)
                    })
                }
            }
        })
        expect(bundle.bootstrap.checksum).toHaveLength(64)
        expect(bundle.incrementalMigration.checksum).toHaveLength(64)
    })

    it('preserves entity type resource labels as metadata without changing executable schema payload', () => {
        const snapshotWithResourceLabel = {
            ...snapshot,
            entityTypeDefinitions: {
                catalog: {
                    id: 'standard-type-catalog',
                    kindKey: 'catalog',
                    codename: createCodenameVlc('catalog'),
                    presentation: {},
                    components: { dataSchema: { enabled: true } },
                    ui: {
                        iconName: 'IconDatabase',
                        tabs: ['general'],
                        sidebarSection: 'objects',
                        nameKey: 'metahubs:catalogs.title',
                        resourceSurfaces: [
                            {
                                key: 'fieldDefinitions',
                                capability: 'dataSchema',
                                routeSegment: 'field-definitions',
                                title: createCodenameVlc('Properties', 'Свойства'),
                                fallbackTitle: 'Properties'
                            }
                        ]
                    },
                    config: {},
                    published: true
                }
            }
        }
        const snapshotWithRenamedResourceLabel = {
            ...snapshotWithResourceLabel,
            entityTypeDefinitions: {
                catalog: {
                    ...snapshotWithResourceLabel.entityTypeDefinitions.catalog,
                    ui: {
                        ...snapshotWithResourceLabel.entityTypeDefinitions.catalog.ui,
                        resourceSurfaces: [
                            {
                                ...snapshotWithResourceLabel.entityTypeDefinitions.catalog.ui.resourceSurfaces[0],
                                title: createCodenameVlc('Attributes', 'Атрибуты'),
                                fallbackTitle: 'Attributes'
                            }
                        ]
                    }
                }
            }
        }

        const firstHash = calculateCanonicalApplicationReleaseSnapshotHash(snapshotWithResourceLabel, 'publication')
        const secondHash = calculateCanonicalApplicationReleaseSnapshotHash(snapshotWithRenamedResourceLabel, 'publication')
        const firstBundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-label-1',
            sourceKind: 'publication',
            snapshot: snapshotWithResourceLabel,
            snapshotHash: firstHash,
            generatedAt: '2026-03-13T10:00:00.000Z'
        })
        const secondBundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-label-2',
            sourceKind: 'publication',
            snapshot: snapshotWithRenamedResourceLabel,
            snapshotHash: secondHash,
            generatedAt: '2026-03-13T10:00:00.000Z'
        })

        expect(firstHash).not.toBe(secondHash)
        expect(firstBundle.snapshot.entityTypeDefinitions?.catalog?.ui?.resourceSurfaces?.[0]?.title).toEqual(
            createCodenameVlc('Properties', 'Свойства')
        )
        expect(firstBundle.bootstrap.payload.entities).toEqual(secondBundle.bootstrap.payload.entities)
        expect(firstBundle.bootstrap.payload.schemaSnapshot.entities).toEqual(secondBundle.bootstrap.payload.schemaSnapshot.entities)
    })

    it('validates executable release bundle artifacts against the embedded snapshot and checksums', () => {
        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot,
            snapshotHash: publicationSnapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            previousReleaseVersion: 'publication-version-0',
            previousSchemaSnapshot,
            generatedAt: '2026-03-13T10:00:00.000Z'
        })

        expect(validateApplicationReleaseBundleArtifacts(bundle)).toEqual({
            snapshotHash: publicationSnapshotHash,
            bootstrapPayload: bundle.bootstrap.payload,
            incrementalPayload: bundle.incrementalMigration.payload,
            incrementalBaseSchemaSnapshot: previousSchemaSnapshot,
            incrementalDiff: bundle.incrementalMigration.diff
        })
    })

    it('rejects incremental bundle creation when a previous release version is provided without a base schema snapshot', () => {
        expect(() =>
            createApplicationReleaseBundle({
                applicationId: 'application-1',
                applicationKey: 'products-app',
                releaseVersion: 'publication-version-1',
                sourceKind: 'publication',
                snapshot,
                snapshotHash: publicationSnapshotHash,
                previousReleaseVersion: 'publication-version-0'
            })
        ).toThrow('Application release bundles require previousSchemaSnapshot for incremental releases')
    })

    it('rejects executable artifacts when the checksum no longer matches the embedded payload', () => {
        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot,
            snapshotHash: publicationSnapshotHash
        })

        const tamperedBundle = {
            ...bundle,
            incrementalMigration: {
                ...bundle.incrementalMigration,
                checksum: 'bad-checksum'
            }
        }

        expect(() => validateApplicationReleaseBundleArtifacts(tamperedBundle)).toThrow(
            'Release bundle incremental checksum does not match the embedded executable payload'
        )
    })

    it('rejects a bundle when the manifest snapshot hash is tampered even if artifact checksums are recomputed', () => {
        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot,
            snapshotHash: publicationSnapshotHash,
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1'
        })

        const tamperedSnapshotHash = 'f'.repeat(64)
        const tamperedBundle = {
            ...bundle,
            manifest: {
                ...bundle.manifest,
                snapshotHash: tamperedSnapshotHash
            },
            bootstrap: {
                ...bundle.bootstrap,
                checksum: calculateApplicationReleaseChecksum({
                    applicationKey: bundle.applicationKey,
                    releaseVersion: bundle.releaseVersion,
                    snapshotHash: tamperedSnapshotHash,
                    bootstrap: bundle.bootstrap.payload
                })
            },
            incrementalMigration: {
                ...bundle.incrementalMigration,
                checksum: calculateApplicationReleaseChecksum({
                    applicationKey: bundle.applicationKey,
                    fromVersion: bundle.incrementalMigration.fromVersion,
                    toVersion: bundle.releaseVersion,
                    snapshotHash: tamperedSnapshotHash,
                    incrementalMigration: bundle.incrementalMigration.payload
                })
            }
        }

        expect(() => validateApplicationReleaseBundleArtifacts(tamperedBundle)).toThrow(
            'Application release snapshot hash does not match the embedded snapshot state'
        )
    })

    it('builds installed release metadata from a release bundle', () => {
        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'application',
            snapshot,
            snapshotHash: applicationSnapshotHash
        })

        const metadata = buildInstalledReleaseMetadataFromBundle(bundle, 'release_bundle', '2026-03-13T10:30:00.000Z')

        expect(metadata).toEqual({
            kind: 'application_release_installation',
            bundleVersion: 1,
            sourceKind: 'release_bundle',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            previousReleaseVersion: null,
            installedAt: '2026-03-13T10:30:00.000Z',
            snapshotHash: applicationSnapshotHash,
            bootstrapChecksum: bundle.bootstrap.checksum,
            incrementalChecksum: bundle.incrementalMigration.checksum,
            baseSchemaSnapshot: null,
            releaseSchemaSnapshot: bundle.incrementalMigration.payload.schemaSnapshot,
            publicationId: null,
            publicationVersionId: null
        })
        expect(extractInstalledReleaseVersion(metadata as unknown as Record<string, unknown>)).toBe('publication-version-1')
    })

    it('preserves the prior installed release version inside stored installation metadata', () => {
        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'application-runtime-v53-abcdef123456',
            sourceKind: 'application',
            snapshot,
            snapshotHash: applicationSnapshotHash,
            previousReleaseVersion: 'publication-version-1',
            previousSchemaSnapshot
        })

        const metadata = buildInstalledReleaseMetadataFromBundle(bundle, 'release_bundle', '2026-03-13T10:45:00.000Z')

        expect(metadata.previousReleaseVersion).toBe('publication-version-1')
        expect(metadata.baseSchemaSnapshot).toEqual(previousSchemaSnapshot)
        expect(metadata.releaseSchemaSnapshot).toEqual(bundle.incrementalMigration.payload.schemaSnapshot)
    })

    it('falls back to a stable checksum when no explicit snapshot hash is provided', () => {
        const calculated = calculateApplicationReleaseChecksum(snapshot)

        expect(resolveApplicationReleaseSnapshotHash(snapshot)).toBe(calculated)
        expect(resolveApplicationReleaseSnapshotHash(snapshot, applicationSnapshotHash)).toBe(applicationSnapshotHash)
        expect(() => resolveApplicationReleaseSnapshotHash(snapshot, 'explicit-hash')).toThrow(
            'Application release snapshot hash does not match the embedded snapshot state'
        )
    })

    it('includes systemFields in publication snapshot hash so it matches SnapshotSerializer output', () => {
        const snapshotWithSystemFields = {
            ...snapshot,
            systemFields: {
                'catalog-products': {
                    fields: [
                        { key: '_upl_deleted', isEnabled: true },
                        { key: '_upl_deleted_at', isEnabled: false },
                        { key: '_upl_deleted_by', isEnabled: false }
                    ],
                    lifecycleContract: { softDelete: true }
                }
            }
        }

        const hashWithSystemFields = calculateCanonicalApplicationReleaseSnapshotHash(snapshotWithSystemFields, 'publication')
        const hashWithoutSystemFields = calculateCanonicalApplicationReleaseSnapshotHash(snapshot, 'publication')

        expect(hashWithSystemFields).not.toBe(hashWithoutSystemFields)
        expect(resolveApplicationReleaseSnapshotHash(snapshotWithSystemFields, hashWithSystemFields, 'publication')).toBe(
            hashWithSystemFields
        )
    })

    it('matches serializer-compatible hashes when layout optional keys are omitted', () => {
        const snapshotWithOmittedLayoutKeys = {
            version: 1 as const,
            versionEnvelope: {
                structureVersion: '0.1.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            metahubId: 'metahub-1',
            entities: {
                catalog_products: {
                    id: 'catalog-products',
                    codename: 'products',
                    kind: 'catalog',
                    tableName: 'cat_products',
                    fields: []
                }
            },
            elements: {},
            layouts: [
                {
                    id: 'layout-1',
                    name: { en: 'Default' },
                    config: {},
                    isDefault: true,
                    isActive: true,
                    sortOrder: 0
                }
            ],
            layoutZoneWidgets: [
                {
                    id: 'widget-1',
                    layoutId: 'layout-1',
                    zone: 'main',
                    sortOrder: 0,
                    config: {},
                    isActive: true
                }
            ]
        }

        const serializerCompatibleHash = calculateCanonicalApplicationReleaseSnapshotHash(snapshotWithOmittedLayoutKeys, 'publication')

        expect(resolveApplicationReleaseSnapshotHash(snapshotWithOmittedLayoutKeys, serializerCompatibleHash, 'publication')).toBe(
            serializerCompatibleHash
        )
    })

    it('hydrates publication systemFields into executable payload entities', () => {
        const publicationSnapshotWithLifecycleContract = {
            ...snapshot,
            systemFields: {
                'catalog-products': {
                    fields: [
                        { key: 'app.published', enabled: false },
                        { key: 'app.published_at', enabled: false },
                        { key: 'app.published_by', enabled: false },
                        { key: 'app.archived', enabled: false },
                        { key: 'app.archived_at', enabled: false },
                        { key: 'app.archived_by', enabled: false },
                        { key: 'app.deleted', enabled: false },
                        { key: 'app.deleted_at', enabled: false },
                        { key: 'app.deleted_by', enabled: false }
                    ],
                    lifecycleContract: {
                        publish: { enabled: false, trackAt: false, trackBy: false },
                        archive: { enabled: false, trackAt: false, trackBy: false },
                        delete: { mode: 'hard', trackAt: false, trackBy: false }
                    }
                }
            }
        }

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: publicationSnapshotWithLifecycleContract,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(publicationSnapshotWithLifecycleContract, 'publication')
        })

        const expectedSystemFields = publicationSnapshotWithLifecycleContract.systemFields['catalog-products']

        expect(bundle.bootstrap.payload.entities).toEqual([
            expect.objectContaining({
                id: 'catalog-products',
                config: expect.objectContaining({
                    systemFields: expectedSystemFields
                })
            })
        ])
        expect(bundle.incrementalMigration.payload.entities).toEqual([
            expect.objectContaining({
                id: 'catalog-products',
                config: expect.objectContaining({
                    systemFields: expectedSystemFields
                })
            })
        ])
    })

    it('preserves compatibility metadata and explicit table names inside executable release bundle payloads', () => {
        const compatibilitySnapshot = {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-compatible': {
                    id: 'catalog-compatible',
                    codename: createCodenameVlc('products_legacy', 'продукты_legacy'),
                    kind: 'custom.product-registry',
                    tableName: 'cat_products_legacy',
                    presentation: { name: {} },
                    config: {
                        compatibility: { legacyObjectKind: 'catalog' },
                        viewMode: 'grid'
                    },
                    fields: []
                },
                'value-group-compatible': {
                    id: 'value-group-compatible',
                    codename: createCodenameVlc('tags_legacy', 'теги_legacy'),
                    kind: 'custom.value-group',
                    tableName: 'set_tags_legacy',
                    presentation: { name: {} },
                    config: {
                        compatibility: { legacyObjectKind: 'set', scope: 'workspace' },
                        displayMode: 'chips'
                    },
                    fields: []
                }
            },
            elements: {},
            layouts: []
        }

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: compatibilitySnapshot,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(compatibilitySnapshot, 'publication')
        })

        const bootstrapCatalogEntity = bundle.bootstrap.payload.entities.find((entity) => entity.id === 'catalog-compatible')
        const bootstrapSetEntity = bundle.bootstrap.payload.entities.find((entity) => entity.id === 'value-group-compatible')

        expect(bootstrapCatalogEntity).toMatchObject({
            physicalTableName: 'cat_products_legacy',
            config: {
                compatibility: { legacyObjectKind: 'catalog' },
                viewMode: 'grid'
            }
        })
        expect(bootstrapSetEntity).toMatchObject({
            physicalTableName: 'set_tags_legacy',
            config: {
                compatibility: { legacyObjectKind: 'set', scope: 'workspace' },
                displayMode: 'chips'
            }
        })
        expect(bundle.bootstrap.payload.schemaSnapshot.entities['catalog-compatible']?.tableName).toBe('cat_products_legacy')
        expect(bundle.bootstrap.payload.schemaSnapshot.entities['value-group-compatible']?.tableName).toBe('set_tags_legacy')
        expect(bundle.incrementalMigration.payload.schemaSnapshot.entities['catalog-compatible']?.tableName).toBe('cat_products_legacy')
        expect(bundle.incrementalMigration.payload.schemaSnapshot.entities['value-group-compatible']?.tableName).toBe('set_tags_legacy')
    })

    it('scopes repeated publication field ids per entity inside executable payloads', () => {
        const repeatedFieldId = '019d69aa-f50d-77ca-988f-619e9d46670c'
        const sharedField = {
            id: repeatedFieldId,
            codename: createCodenameVlc('SharedTitle', 'ОбщийЗаголовок'),
            dataType: 'STRING',
            isRequired: false,
            isDisplayAttribute: false,
            presentation: { name: {} },
            validationRules: {},
            uiConfig: {},
            sortOrder: 1
        }

        const repeatedFieldSnapshot = {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-alpha': {
                    id: 'catalog-alpha',
                    codename: createCodenameVlc('alpha', 'альфа'),
                    kind: 'catalog',
                    presentation: { name: {} },
                    config: {},
                    fields: [sharedField]
                },
                'catalog-beta': {
                    id: 'catalog-beta',
                    codename: createCodenameVlc('beta', 'бета'),
                    kind: 'catalog',
                    presentation: { name: {} },
                    config: {},
                    fields: [sharedField]
                }
            },
            elements: {},
            layouts: []
        }

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'products-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: repeatedFieldSnapshot,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(repeatedFieldSnapshot, 'publication')
        })

        const bootstrapEntities = bundle.bootstrap.payload.entities
        const bootstrapFieldIds = bootstrapEntities.flatMap((entity) => entity.fields.map((field) => field.id))
        const incrementalFieldIds = bundle.incrementalMigration.payload.entities.flatMap((entity) => entity.fields.map((field) => field.id))

        expect(new Set(bootstrapFieldIds).size).toBe(bootstrapFieldIds.length)
        expect(new Set(incrementalFieldIds).size).toBe(incrementalFieldIds.length)

        expect(bootstrapEntities).toEqual([
            expect.objectContaining({
                id: 'catalog-alpha',
                fields: [expect.objectContaining({ codename: 'SharedTitle' })]
            }),
            expect.objectContaining({
                id: 'catalog-beta',
                fields: [expect.objectContaining({ codename: 'SharedTitle' })]
            })
        ])
        expect(bootstrapEntities[0]?.fields[0]?.id).not.toBe(repeatedFieldId)
        expect(bootstrapEntities[1]?.fields[0]?.id).not.toBe(repeatedFieldId)
        expect(bootstrapEntities[0]?.fields[0]?.id).not.toBe(bootstrapEntities[1]?.fields[0]?.id)
    })

    it('scopes repeated shared enumeration value ids per target object and rewrites element refs', async () => {
        const duplicateValueId = '019d6a25-9427-72a1-856b-56205dffad46'
        const loadSyncContext = createLoadPublishedApplicationSyncContext(async () => ({
            publicationId: 'publication-1',
            publicationVersionId: 'publication-version-1',
            snapshotHash: 'stale-runtime-hash',
            publicationSnapshot: {},
            entities: [],
            snapshot: {
                versionEnvelope: {
                    structureVersion: '53.0.0',
                    templateVersion: null,
                    snapshotFormatVersion: 1
                },
                entities: {
                    'catalog-main': {
                        id: 'catalog-main',
                        codename: createCodenameVlc('Main', 'Главная'),
                        kind: 'catalog',
                        presentation: { name: {} },
                        config: {},
                        fields: [
                            {
                                id: 'field-status-a',
                                codename: createCodenameVlc('StatusA', 'СтатусА'),
                                dataType: 'REF',
                                isRequired: false,
                                targetEntityId: 'enum-a',
                                targetEntityKind: 'enumeration',
                                presentation: { name: {} },
                                validationRules: {},
                                uiConfig: {},
                                sortOrder: 1
                            },
                            {
                                id: 'field-status-b',
                                codename: createCodenameVlc('StatusB', 'СтатусБ'),
                                dataType: 'REF',
                                isRequired: false,
                                targetEntityId: 'enum-b',
                                targetEntityKind: 'enumeration',
                                presentation: { name: {} },
                                validationRules: {},
                                uiConfig: {},
                                sortOrder: 2
                            }
                        ]
                    },
                    'enum-a': {
                        id: 'enum-a',
                        codename: createCodenameVlc('EnumA', 'ПеречислениеА'),
                        kind: 'enumeration',
                        presentation: { name: {} },
                        config: { compatibility: { legacyObjectKind: 'enumeration' } },
                        fields: []
                    },
                    'enum-b': {
                        id: 'enum-b',
                        codename: createCodenameVlc('EnumB', 'ПеречислениеБ'),
                        kind: 'enumeration',
                        presentation: { name: {} },
                        config: { compatibility: { legacyObjectKind: 'enumeration' } },
                        fields: []
                    }
                },
                optionValues: {
                    'enum-a': [
                        {
                            id: duplicateValueId,
                            codename: createCodenameVlc('Open', 'Открыто'),
                            presentation: { name: {} },
                            sortOrder: 1,
                            isDefault: true
                        }
                    ],
                    'enum-b': [
                        {
                            id: duplicateValueId,
                            codename: createCodenameVlc('Open', 'Открыто'),
                            presentation: { name: {} },
                            sortOrder: 1,
                            isDefault: true
                        }
                    ]
                },
                elements: {
                    'catalog-main': [
                        {
                            id: 'row-1',
                            sortOrder: 1,
                            data: {
                                StatusA: duplicateValueId,
                                StatusB: { id: duplicateValueId }
                            }
                        }
                    ]
                }
            }
        }))

        const syncContext = await loadSyncContext({} as never, 'publication-1')
        if (!syncContext) {
            throw new Error('Expected normalized sync context to be available')
        }

        const enumAId = syncContext.snapshot.optionValues?.['enum-a']?.[0]?.id
        const enumBId = syncContext.snapshot.optionValues?.['enum-b']?.[0]?.id
        const elementData = syncContext.snapshot.elements?.['catalog-main']?.[0] as { data?: Record<string, unknown> } | undefined

        expect(enumAId).toBeDefined()
        expect(enumBId).toBeDefined()
        expect(enumAId).not.toBe(duplicateValueId)
        expect(enumBId).not.toBe(duplicateValueId)
        expect(enumAId).not.toBe(enumBId)
        expect(elementData?.data?.StatusA).toBe(enumAId)
        expect((elementData?.data?.StatusB as { id?: string } | undefined)?.id).toBe(enumBId)
        expect(syncContext.snapshotHash).not.toBe('stale-runtime-hash')
    })

    it('flattens TABLE child fields and enriches set constants inside executable payload entities', () => {
        const tableFieldId = '019d1104-1add-7a40-974a-bd58f6f5e6b2'
        const childFieldId = '019d1105-0d7b-73ea-ab5c-8c513518e0c3'
        const setFieldId = '019d10e2-8c41-7725-813e-598731237ab2'
        const valueGroupId = '019d0d8e-ddb0-7c8f-93f4-11048896d993'
        const constantId = '019d10d1-79ec-78bf-a0d9-1768ee647b33'

        const complexSnapshot = {
            versionEnvelope: {
                structureVersion: '53.0.0',
                templateVersion: null,
                snapshotFormatVersion: 1 as const
            },
            entities: {
                'catalog-resources': {
                    id: 'catalog-resources',
                    codename: createCodenameVlc('resources', 'ресурсы'),
                    kind: 'catalog',
                    presentation: { name: {} },
                    config: {},
                    fields: [
                        {
                            id: tableFieldId,
                            codename: createCodenameVlc('NestedResources', 'ВложенныеРесурсы'),
                            dataType: 'TABLE',
                            isRequired: false,
                            isDisplayAttribute: false,
                            presentation: { name: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 1,
                            childFields: [
                                {
                                    id: childFieldId,
                                    codename: createCodenameVlc('NestedTitle', 'ВложенныйЗаголовок'),
                                    dataType: 'STRING',
                                    isRequired: true,
                                    isDisplayAttribute: true,
                                    presentation: { name: {} },
                                    validationRules: { localized: true, versioned: true },
                                    uiConfig: {},
                                    sortOrder: 1,
                                    parentAttributeId: tableFieldId
                                }
                            ]
                        },
                        {
                            id: setFieldId,
                            codename: createCodenameVlc('Motto', 'Девиз'),
                            dataType: 'REF',
                            isRequired: false,
                            isDisplayAttribute: false,
                            targetEntityId: valueGroupId,
                            targetEntityKind: 'set',
                            targetConstantId: constantId,
                            presentation: { name: {} },
                            validationRules: {},
                            uiConfig: {},
                            sortOrder: 2
                        }
                    ]
                }
            },
            constants: {
                [valueGroupId]: [
                    {
                        id: constantId,
                        objectId: valueGroupId,
                        codename: createCodenameVlc('MottoConstant', 'КонстантаДевиз'),
                        dataType: 'STRING',
                        presentation: {
                            name: {
                                _schema: '1',
                                _primary: 'ru',
                                locales: {
                                    ru: { content: 'Девиз', version: 1, isActive: true }
                                }
                            }
                        },
                        validationRules: {},
                        uiConfig: {},
                        value: {
                            _schema: '1',
                            _primary: 'ru',
                            locales: {
                                ru: { content: 'Все миры будут нашими!', version: 1, isActive: true }
                            }
                        },
                        sortOrder: 0
                    }
                ]
            }
        }

        const bundle = createApplicationReleaseBundle({
            applicationId: 'application-1',
            applicationKey: 'resources-app',
            releaseVersion: 'publication-version-1',
            sourceKind: 'publication',
            snapshot: complexSnapshot,
            snapshotHash: calculateCanonicalApplicationReleaseSnapshotHash(complexSnapshot, 'publication')
        })

        const [catalogEntity] = bundle.bootstrap.payload.entities
        const rootTableField = catalogEntity.fields.find((field) => field.id === tableFieldId)
        const flatChildField = catalogEntity.fields.find((field) => field.id === childFieldId)
        const setField = catalogEntity.fields.find((field) => field.id === setFieldId)

        expect(rootTableField).toEqual(
            expect.objectContaining({
                id: tableFieldId,
                codename: 'NestedResources',
                dataType: 'TABLE',
                childFields: [
                    expect.objectContaining({
                        id: childFieldId,
                        codename: 'NestedTitle',
                        parentAttributeId: tableFieldId
                    })
                ]
            })
        )
        expect(flatChildField).toEqual(
            expect.objectContaining({
                id: childFieldId,
                codename: 'NestedTitle',
                parentAttributeId: tableFieldId,
                dataType: 'STRING'
            })
        )
        expect(setField).toEqual(
            expect.objectContaining({
                id: setFieldId,
                codename: 'Motto',
                targetConstantId: constantId,
                uiConfig: expect.objectContaining({
                    targetConstantId: constantId,
                    setConstantRef: expect.objectContaining({
                        id: constantId,
                        codename: 'MottoConstant',
                        dataType: 'STRING',
                        value: expect.objectContaining({
                            _primary: 'ru'
                        }),
                        name: expect.objectContaining({
                            _primary: 'ru'
                        })
                    })
                })
            })
        )
    })
})
