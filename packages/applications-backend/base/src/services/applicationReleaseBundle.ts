import { createHash } from 'crypto'
import stableStringify from 'json-stable-stringify'
import { buildSchemaSnapshot, calculateSchemaDiff, type EntityDefinition, type SchemaDiff, type SchemaSnapshot } from '@universo/schema-ddl'
import type { PublishedApplicationSnapshot } from './applicationSyncContracts'

export type ApplicationReleaseBundleSourceKind = 'publication' | 'application'
export type ApplicationReleaseInstallSourceKind = 'publication' | 'release_bundle'

export interface ApplicationReleaseBundleManifest {
    engineVersion: string
    structureVersion: string
    sourceKind: ApplicationReleaseBundleSourceKind
    generatedAt: string
    applicationId: string
    applicationKey: string
    publicationId?: string | null
    publicationVersionId?: string | null
    snapshotHash: string
}

export interface ApplicationReleaseBundleExecutablePayload {
    entities: EntityDefinition[]
    schemaSnapshot: SchemaSnapshot
}

export interface ApplicationReleaseBundleBootstrapArtifact {
    kind: 'baseline_sql'
    checksum: string
    payload: ApplicationReleaseBundleExecutablePayload
}

export interface ApplicationReleaseBundleIncrementalArtifact {
    fromVersion: string | null
    kind: 'ddl_plan'
    checksum: string
    baseSchemaSnapshot: SchemaSnapshot | null
    diff: SchemaDiff
    payload: ApplicationReleaseBundleExecutablePayload
}

export interface ApplicationReleaseBundle {
    kind: 'application_release_bundle'
    bundleVersion: 1
    applicationKey: string
    releaseVersion: string
    manifest: ApplicationReleaseBundleManifest
    snapshot: PublishedApplicationSnapshot
    bootstrap: ApplicationReleaseBundleBootstrapArtifact
    incrementalMigration: ApplicationReleaseBundleIncrementalArtifact
}

export interface InstalledApplicationReleaseMetadata {
    kind: 'application_release_installation'
    bundleVersion: 1
    sourceKind: ApplicationReleaseInstallSourceKind
    applicationKey: string
    releaseVersion: string
    previousReleaseVersion?: string | null
    installedAt: string
    snapshotHash: string
    bootstrapChecksum: string
    incrementalChecksum: string
    baseSchemaSnapshot: SchemaSnapshot | null
    releaseSchemaSnapshot: SchemaSnapshot
    publicationId?: string | null
    publicationVersionId?: string | null
}

export interface CreateApplicationReleaseBundleInput {
    applicationId: string
    applicationKey: string
    releaseVersion: string
    sourceKind: ApplicationReleaseBundleSourceKind
    snapshot: PublishedApplicationSnapshot
    snapshotHash?: string | null
    publicationId?: string | null
    publicationVersionId?: string | null
    previousReleaseVersion?: string | null
    previousSchemaSnapshot?: SchemaSnapshot | null
    generatedAt?: string
    structureVersion?: string | null
    engineVersion?: string | null
}

export interface ValidatedApplicationReleaseBundleArtifacts {
    snapshotHash: string
    bootstrapPayload: ApplicationReleaseBundleExecutablePayload
    incrementalPayload: ApplicationReleaseBundleExecutablePayload
    incrementalBaseSchemaSnapshot: SchemaSnapshot | null
    incrementalDiff: SchemaDiff
}

const stringifyForChecksum = (value: unknown): string => stableStringify(value) ?? JSON.stringify(value) ?? ''

const compareValues = (left: unknown, right: unknown): boolean => stringifyForChecksum(left) === stringifyForChecksum(right)

const asArray = <Value>(value: unknown): Value[] => (Array.isArray(value) ? (value as Value[]) : [])
const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' ? (value as Record<string, unknown>) : {})

const resolveReleaseBundleEntities = (snapshot: PublishedApplicationSnapshot): EntityDefinition[] =>
    Object.values(snapshot.entities ?? {}).sort((left, right) => left.id.localeCompare(right.id))

const normalizePublicationSnapshotForHash = (snapshot: PublishedApplicationSnapshot): Record<string, unknown> => {
    const entities = Object.values(snapshot.entities ?? {})
        .map((entity) => {
            const entityRecord = asRecord(entity)

            return {
                id: entity.id,
                kind: entity.kind,
                codename: entity.codename,
                tableName: entity.physicalTableName ?? entityRecord.tableName ?? null,
                presentation: entity.presentation ?? {},
                config: entity.config ?? {},
                hubs: asArray<string>(entityRecord.hubs).sort(),
                fields: [...entity.fields]
                    .map((field) => {
                        const fieldRecord = asRecord(field)
                        const fieldSortOrder = typeof fieldRecord.sortOrder === 'number' ? fieldRecord.sortOrder : 0

                        return {
                            id: field.id,
                            codename: field.codename,
                            dataType: field.dataType,
                            isRequired: field.isRequired,
                            isDisplayAttribute: field.isDisplayAttribute ?? false,
                            targetEntityId: field.targetEntityId ?? null,
                            targetEntityKind: field.targetEntityKind ?? null,
                            targetConstantId: field.targetConstantId ?? null,
                            presentation: field.presentation ?? {},
                            validationRules: field.validationRules ?? {},
                            uiConfig: field.uiConfig ?? {},
                            sortOrder: fieldSortOrder,
                            parentAttributeId: field.parentAttributeId ?? null,
                            childFields: field.childFields
                                ? [...field.childFields]
                                      .map((childField) => {
                                          const childFieldRecord = asRecord(childField)
                                          const childFieldSortOrder =
                                              typeof childFieldRecord.sortOrder === 'number' ? childFieldRecord.sortOrder : 0

                                          return {
                                              id: childField.id,
                                              codename: childField.codename,
                                              dataType: childField.dataType,
                                              isRequired: childField.isRequired,
                                              isDisplayAttribute: childField.isDisplayAttribute ?? false,
                                              targetEntityId: childField.targetEntityId ?? null,
                                              targetEntityKind: childField.targetEntityKind ?? null,
                                              targetConstantId: childField.targetConstantId ?? null,
                                              presentation: childField.presentation ?? {},
                                              validationRules: childField.validationRules ?? {},
                                              uiConfig: childField.uiConfig ?? {},
                                              sortOrder: childFieldSortOrder
                                          }
                                      })
                                      .sort((left, right) => {
                                          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                                          if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
                                          return left.id.localeCompare(right.id)
                                      })
                                : undefined
                        }
                    })
                    .sort((left, right) => {
                        if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                        if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
                        return left.id.localeCompare(right.id)
                    })
            }
        })
        .sort((left, right) => {
            if (left.kind !== right.kind) return left.kind.localeCompare(right.kind)
            if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
            return left.id.localeCompare(right.id)
        })

    const elements = Object.entries(snapshot.elements ?? {})
        .map(([objectId, list]) => ({
            objectId,
            elements: asArray<Record<string, unknown>>(list)
                .map((element) => ({
                    id: typeof element.id === 'string' ? element.id : '',
                    data: element.data ?? {},
                    sortOrder: typeof element.sortOrder === 'number' ? element.sortOrder : 0
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const enumerationValues = Object.entries(snapshot.enumerationValues ?? {})
        .map(([objectId, list]) => ({
            objectId,
            values: asArray<Record<string, unknown>>(list)
                .map((value) => ({
                    id: typeof value.id === 'string' ? value.id : '',
                    codename: typeof value.codename === 'string' ? value.codename : '',
                    presentation: value.presentation ?? {},
                    sortOrder: typeof value.sortOrder === 'number' ? value.sortOrder : 0,
                    isDefault: Boolean(value.isDefault)
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const constants = Object.entries(snapshot.constants ?? {})
        .map(([objectId, list]) => ({
            objectId,
            constants: asArray<Record<string, unknown>>(list)
                .map((constant) => ({
                    id: typeof constant.id === 'string' ? constant.id : '',
                    codename: typeof constant.codename === 'string' ? constant.codename : '',
                    dataType: constant.dataType ?? null,
                    presentation: constant.presentation ?? {},
                    validationRules: constant.validationRules ?? {},
                    uiConfig: constant.uiConfig ?? {},
                    value: constant.value ?? null,
                    sortOrder: typeof constant.sortOrder === 'number' ? constant.sortOrder : 0
                }))
                .sort((left, right) => {
                    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
                    if (left.codename !== right.codename) return left.codename.localeCompare(right.codename)
                    return left.id.localeCompare(right.id)
                })
        }))
        .sort((left, right) => left.objectId.localeCompare(right.objectId))

    const layouts = asArray<Record<string, unknown>>(snapshot.layouts)
        .map((layout) => ({
            id: typeof layout.id === 'string' ? layout.id : '',
            templateKey: layout.templateKey ?? null,
            name: layout.name ?? {},
            description: layout.description ?? null,
            config: layout.config ?? {},
            isDefault: Boolean(layout.isDefault),
            isActive: Boolean(layout.isActive),
            sortOrder: typeof layout.sortOrder === 'number' ? layout.sortOrder : 0
        }))
        .sort((left, right) => {
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
            return left.id.localeCompare(right.id)
        })

    const layoutZoneWidgets = asArray<Record<string, unknown>>(snapshot.layoutZoneWidgets)
        .map((item) => ({
            id: typeof item.id === 'string' ? item.id : '',
            layoutId: typeof item.layoutId === 'string' ? item.layoutId : '',
            zone: typeof item.zone === 'string' ? item.zone : '',
            widgetKey: item.widgetKey ?? null,
            sortOrder: typeof item.sortOrder === 'number' ? item.sortOrder : 0,
            config: item.config ?? {},
            isActive: Boolean(item.isActive)
        }))
        .sort((left, right) => {
            if (left.layoutId !== right.layoutId) return left.layoutId.localeCompare(right.layoutId)
            if (left.zone !== right.zone) return left.zone.localeCompare(right.zone)
            if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder
            return left.id.localeCompare(right.id)
        })

    return {
        version: snapshot.version ?? null,
        versionEnvelope: snapshot.versionEnvelope ?? null,
        metahubId: snapshot.metahubId ?? null,
        entities,
        elements,
        enumerationValues,
        constants,
        layouts,
        layoutZoneWidgets,
        defaultLayoutId: snapshot.defaultLayoutId ?? null,
        layoutConfig: snapshot.layoutConfig ?? {}
    }
}

const buildExecutablePayloadFromSnapshot = (
    snapshot: PublishedApplicationSnapshot,
    generatedAt: string
): ApplicationReleaseBundleExecutablePayload => {
    const entities = resolveReleaseBundleEntities(snapshot)
    const schemaSnapshot = buildSchemaSnapshot(entities)

    return {
        entities,
        schemaSnapshot: {
            ...schemaSnapshot,
            generatedAt
        }
    }
}

const buildBootstrapChecksumInput = (options: {
    applicationKey: string
    releaseVersion: string
    snapshotHash: string
    payload: ApplicationReleaseBundleExecutablePayload
}): Record<string, unknown> => ({
    applicationKey: options.applicationKey,
    releaseVersion: options.releaseVersion,
    snapshotHash: options.snapshotHash,
    bootstrap: options.payload
})

const buildIncrementalChecksumInput = (options: {
    applicationKey: string
    releaseVersion: string
    snapshotHash: string
    fromVersion: string | null
    baseSchemaSnapshot: SchemaSnapshot | null
    diff: SchemaDiff
    payload: ApplicationReleaseBundleExecutablePayload
}): Record<string, unknown> => ({
    applicationKey: options.applicationKey,
    fromVersion: options.fromVersion,
    toVersion: options.releaseVersion,
    snapshotHash: options.snapshotHash,
    baseSchemaSnapshot: options.baseSchemaSnapshot,
    diff: options.diff,
    incrementalMigration: options.payload
})

export const calculateApplicationReleaseChecksum = (value: unknown): string =>
    createHash('sha256').update(stringifyForChecksum(value)).digest('hex')

export const calculateCanonicalApplicationReleaseSnapshotHash = (
    snapshot: PublishedApplicationSnapshot,
    sourceKind: ApplicationReleaseBundleSourceKind
): string =>
    sourceKind === 'publication'
        ? calculateApplicationReleaseChecksum(normalizePublicationSnapshotForHash(snapshot))
        : calculateApplicationReleaseChecksum(snapshot)

export const resolveApplicationReleaseSnapshotHash = (
    snapshot: PublishedApplicationSnapshot,
    explicitSnapshotHash?: string | null,
    sourceKind: ApplicationReleaseBundleSourceKind = 'application'
): string => {
    const calculatedSnapshotHash = calculateCanonicalApplicationReleaseSnapshotHash(snapshot, sourceKind)

    if (typeof explicitSnapshotHash === 'string' && explicitSnapshotHash.trim().length > 0) {
        const normalizedSnapshotHash = explicitSnapshotHash.trim()
        if (normalizedSnapshotHash !== calculatedSnapshotHash) {
            throw new Error('Application release snapshot hash does not match the embedded snapshot state')
        }

        return normalizedSnapshotHash
    }

    return calculatedSnapshotHash
}

export const extractInstalledReleaseVersion = (installedReleaseMetadata?: Record<string, unknown> | null): string | null => {
    if (!installedReleaseMetadata) return null

    const releaseVersion = installedReleaseMetadata.releaseVersion
    return typeof releaseVersion === 'string' && releaseVersion.trim().length > 0 ? releaseVersion.trim() : null
}

const resolveIncrementalBundleBaseSnapshot = (
    previousReleaseVersion: string | null | undefined,
    previousSchemaSnapshot: SchemaSnapshot | null | undefined
): SchemaSnapshot | null => {
    if (!previousReleaseVersion) {
        return null
    }

    if (!previousSchemaSnapshot) {
        throw new Error('Application release bundles require previousSchemaSnapshot for incremental releases')
    }

    return previousSchemaSnapshot
}

export const createApplicationReleaseBundle = (input: CreateApplicationReleaseBundleInput): ApplicationReleaseBundle => {
    const applicationKey = input.applicationKey.trim().length > 0 ? input.applicationKey.trim() : input.applicationId
    const releaseVersion = input.releaseVersion.trim()

    if (releaseVersion.length === 0) {
        throw new Error('Application release bundles require a non-empty releaseVersion')
    }

    const snapshotHash = resolveApplicationReleaseSnapshotHash(input.snapshot, input.snapshotHash, input.sourceKind)
    const generatedAt = input.generatedAt ?? new Date().toISOString()
    const structureVersion = input.snapshot.versionEnvelope?.structureVersion ?? input.structureVersion ?? 'unknown'
    const engineVersion =
        input.engineVersion ??
        (input.snapshot.versionEnvelope ? `metahub-snapshot/v${input.snapshot.versionEnvelope.snapshotFormatVersion}` : 'unknown')
    const executablePayload = buildExecutablePayloadFromSnapshot(input.snapshot, generatedAt)
    const incrementalBaseSchemaSnapshot = resolveIncrementalBundleBaseSnapshot(
        input.previousReleaseVersion ?? null,
        input.previousSchemaSnapshot ?? null
    )
    const incrementalDiff = calculateSchemaDiff(incrementalBaseSchemaSnapshot, executablePayload.entities)

    return {
        kind: 'application_release_bundle',
        bundleVersion: 1,
        applicationKey,
        releaseVersion,
        manifest: {
            engineVersion,
            structureVersion,
            sourceKind: input.sourceKind,
            generatedAt,
            applicationId: input.applicationId,
            applicationKey,
            publicationId: input.publicationId ?? null,
            publicationVersionId: input.publicationVersionId ?? null,
            snapshotHash
        },
        snapshot: input.snapshot,
        bootstrap: {
            kind: 'baseline_sql',
            checksum: calculateApplicationReleaseChecksum(
                buildBootstrapChecksumInput({
                    applicationKey,
                    releaseVersion,
                    snapshotHash,
                    payload: executablePayload
                })
            ),
            payload: executablePayload
        },
        incrementalMigration: {
            fromVersion: input.previousReleaseVersion ?? null,
            kind: 'ddl_plan',
            baseSchemaSnapshot: incrementalBaseSchemaSnapshot,
            diff: incrementalDiff,
            checksum: calculateApplicationReleaseChecksum(
                buildIncrementalChecksumInput({
                    applicationKey,
                    releaseVersion,
                    snapshotHash,
                    fromVersion: input.previousReleaseVersion ?? null,
                    baseSchemaSnapshot: incrementalBaseSchemaSnapshot,
                    diff: incrementalDiff,
                    payload: executablePayload
                })
            ),
            payload: executablePayload
        }
    }
}

export const validateApplicationReleaseBundleArtifacts = (bundle: ApplicationReleaseBundle): ValidatedApplicationReleaseBundleArtifacts => {
    const snapshotHash = resolveApplicationReleaseSnapshotHash(bundle.snapshot, bundle.manifest.snapshotHash, bundle.manifest.sourceKind)
    const expectedPayload = buildExecutablePayloadFromSnapshot(bundle.snapshot, bundle.manifest.generatedAt)
    const expectedIncrementalDiff = calculateSchemaDiff(bundle.incrementalMigration.baseSchemaSnapshot ?? null, expectedPayload.entities)

    if (!compareValues(bundle.bootstrap.payload, expectedPayload)) {
        throw new Error('Release bundle bootstrap payload does not match the embedded snapshot state')
    }

    if (!compareValues(bundle.incrementalMigration.payload, expectedPayload)) {
        throw new Error('Release bundle incremental payload does not match the embedded snapshot state')
    }

    if (!compareValues(bundle.incrementalMigration.diff, expectedIncrementalDiff)) {
        throw new Error('Release bundle incremental diff does not match the embedded base snapshot and target payload')
    }

    const expectedBootstrapChecksum = calculateApplicationReleaseChecksum(
        buildBootstrapChecksumInput({
            applicationKey: bundle.applicationKey,
            releaseVersion: bundle.releaseVersion,
            snapshotHash,
            payload: expectedPayload
        })
    )

    if (expectedBootstrapChecksum !== bundle.bootstrap.checksum) {
        throw new Error('Release bundle bootstrap checksum does not match the embedded executable payload')
    }

    const expectedIncrementalChecksum = calculateApplicationReleaseChecksum(
        buildIncrementalChecksumInput({
            applicationKey: bundle.applicationKey,
            releaseVersion: bundle.releaseVersion,
            snapshotHash,
            fromVersion: bundle.incrementalMigration.fromVersion ?? null,
            baseSchemaSnapshot: bundle.incrementalMigration.baseSchemaSnapshot ?? null,
            diff: expectedIncrementalDiff,
            payload: expectedPayload
        })
    )

    if (expectedIncrementalChecksum !== bundle.incrementalMigration.checksum) {
        throw new Error('Release bundle incremental checksum does not match the embedded executable payload')
    }

    return {
        snapshotHash,
        bootstrapPayload: expectedPayload,
        incrementalPayload: expectedPayload,
        incrementalBaseSchemaSnapshot: bundle.incrementalMigration.baseSchemaSnapshot ?? null,
        incrementalDiff: expectedIncrementalDiff
    }
}

export const buildInstalledReleaseMetadataFromBundle = (
    bundle: ApplicationReleaseBundle,
    sourceKind: ApplicationReleaseInstallSourceKind,
    installedAt = new Date().toISOString()
): InstalledApplicationReleaseMetadata => ({
    kind: 'application_release_installation',
    bundleVersion: bundle.bundleVersion,
    sourceKind,
    applicationKey: bundle.applicationKey,
    releaseVersion: bundle.releaseVersion,
    previousReleaseVersion: bundle.incrementalMigration.fromVersion ?? null,
    installedAt,
    snapshotHash: resolveApplicationReleaseSnapshotHash(bundle.snapshot, bundle.manifest.snapshotHash, bundle.manifest.sourceKind),
    bootstrapChecksum: bundle.bootstrap.checksum,
    incrementalChecksum: bundle.incrementalMigration.checksum,
    baseSchemaSnapshot: bundle.incrementalMigration.baseSchemaSnapshot ?? null,
    releaseSchemaSnapshot: bundle.incrementalMigration.payload.schemaSnapshot,
    publicationId: bundle.manifest.publicationId ?? null,
    publicationVersionId: bundle.manifest.publicationVersionId ?? null
})
