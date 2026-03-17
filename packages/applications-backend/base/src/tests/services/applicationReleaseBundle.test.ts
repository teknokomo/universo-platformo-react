import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import {
    calculateCanonicalApplicationReleaseSnapshotHash,
    buildInstalledReleaseMetadataFromBundle,
    calculateApplicationReleaseChecksum,
    createApplicationReleaseBundle,
    extractInstalledReleaseVersion,
    resolveApplicationReleaseSnapshotHash,
    validateApplicationReleaseBundleArtifacts
} from '../../services/applicationReleaseBundle'

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
                codename: 'products',
                kind: 'catalog',
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
                    entities: [snapshot.entities.catalog_products],
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
                    entities: [snapshot.entities.catalog_products],
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

        const serializerCompatibleHash = createHash('sha256')
            .update(
                stableStringify({
                    version: 1,
                    versionEnvelope: {
                        structureVersion: '0.1.0',
                        templateVersion: null,
                        snapshotFormatVersion: 1
                    },
                    metahubId: 'metahub-1',
                    entities: [
                        {
                            id: 'catalog-products',
                            kind: 'catalog',
                            codename: 'products',
                            tableName: 'cat_products',
                            presentation: {},
                            config: {},
                            systemFields: null,
                            hubs: [],
                            fields: []
                        }
                    ],
                    elements: [],
                    enumerationValues: [],
                    constants: [],
                    systemFields: [],
                    layouts: [
                        {
                            id: 'layout-1',
                            name: { en: 'Default' },
                            description: null,
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
                    ],
                    defaultLayoutId: null,
                    layoutConfig: {}
                }) ?? ''
            )
            .digest('hex')

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
})
