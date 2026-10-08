import type { EntityDefinition, SchemaSnapshot } from '@universo-react/schema-ddl'
import { validateMarketingSnapshotTransportLayouts, validateSnapshotLayoutIdentities } from '@universo-react/utils'
import {
    createApplicationReleaseBundle,
    extractInstalledReleaseVersion,
    validateApplicationReleaseBundleArtifacts,
    type ApplicationReleaseBundle
} from '../../services/applicationReleaseBundle'
import type { PublishedApplicationSnapshot } from '../../services/applicationSyncContracts'
import { TARGET_APP_STRUCTURE_VERSION } from '../../constants'
import {
    extractInstalledReleaseMetadataSchemaSnapshot,
    extractInstalledReleaseMetadataString,
    resolveApplicationReleaseVersion
} from './syncHelpers'
import type { ApplicationSchemaSyncSource, SyncableApplicationRecord } from './syncTypes'

export function resolveRuntimeApplicationReleaseLineage(
    application: SyncableApplicationRecord,
    snapshotHash: string
): { releaseVersion: string; previousReleaseVersion: string | null } {
    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const installedSourceKind = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'sourceKind')
    const installedSnapshotHash = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'snapshotHash')
    const previousReleaseVersion = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'previousReleaseVersion')

    if (installedSourceKind === 'release_bundle' && installedReleaseVersion && installedSnapshotHash === snapshotHash) {
        return {
            releaseVersion: installedReleaseVersion,
            previousReleaseVersion
        }
    }

    const structureVersion =
        typeof application.appStructureVersion === 'number' && Number.isFinite(application.appStructureVersion)
            ? application.appStructureVersion
            : TARGET_APP_STRUCTURE_VERSION

    return {
        releaseVersion: `application-runtime-v${structureVersion}-${snapshotHash.slice(0, 12)}`,
        previousReleaseVersion: installedReleaseVersion
    }
}

export function resolveRuntimeApplicationReleaseBaseSnapshot(options: {
    application: SyncableApplicationRecord
    releaseLineage: { releaseVersion: string; previousReleaseVersion: string | null }
    snapshotHash: string
}): { snapshot: SchemaSnapshot | null; expectedKey: 'baseSchemaSnapshot' | 'releaseSchemaSnapshot' | null } {
    const { application, releaseLineage, snapshotHash } = options

    if (!releaseLineage.previousReleaseVersion) {
        return {
            snapshot: null,
            expectedKey: null
        }
    }

    const installedReleaseVersion = extractInstalledReleaseVersion(application.installedReleaseMetadata)
    const installedSourceKind = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'sourceKind')
    const installedSnapshotHash = extractInstalledReleaseMetadataString(application.installedReleaseMetadata, 'snapshotHash')
    const reusesStoredBundleLineage =
        installedSourceKind === 'release_bundle' &&
        installedReleaseVersion === releaseLineage.releaseVersion &&
        installedSnapshotHash === snapshotHash

    const expectedKey = reusesStoredBundleLineage ? 'baseSchemaSnapshot' : 'releaseSchemaSnapshot'

    return {
        snapshot: extractInstalledReleaseMetadataSchemaSnapshot(application.installedReleaseMetadata, expectedKey),
        expectedKey
    }
}

export function createPublicationApplicationReleaseBundle(options: {
    application: SyncableApplicationRecord
    syncContext: {
        publicationId: string
        publicationVersionId: string
        snapshotHash: string | null
        snapshot: PublishedApplicationSnapshot
    }
}): ApplicationReleaseBundle {
    const previousReleaseVersion = extractInstalledReleaseVersion(options.application.installedReleaseMetadata)

    return createApplicationReleaseBundle({
        applicationId: options.application.id,
        applicationKey: options.application.id,
        releaseVersion: resolveApplicationReleaseVersion({
            publicationVersionId: options.syncContext.publicationVersionId,
            snapshot: options.syncContext.snapshot,
            snapshotHash: options.syncContext.snapshotHash
        }),
        sourceKind: 'publication',
        snapshot: options.syncContext.snapshot,
        snapshotHash: options.syncContext.snapshotHash,
        publicationId: options.syncContext.publicationId,
        publicationVersionId: options.syncContext.publicationVersionId,
        previousReleaseVersion,
        previousSchemaSnapshot: (options.application.schemaSnapshot as SchemaSnapshot | null) ?? null
    })
}

export function buildApplicationSyncSourceFromPublication(options: {
    application: SyncableApplicationRecord
    syncContext: {
        publicationId: string
        publicationVersionId: string
        snapshotHash: string | null
        snapshot: PublishedApplicationSnapshot
        entities: EntityDefinition[]
        publicationSnapshot: Record<string, unknown>
    }
}): ApplicationSchemaSyncSource {
    validateMarketingSnapshotTransportLayouts(options.syncContext.snapshot)
    validateSnapshotLayoutIdentities(options.syncContext.snapshot)
    const bundle = createPublicationApplicationReleaseBundle({
        application: options.application,
        syncContext: options.syncContext
    })
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)

    return {
        bundle,
        bootstrapPayload: artifacts.bootstrapPayload,
        incrementalPayload: artifacts.incrementalPayload,
        incrementalBaseSchemaSnapshot: artifacts.incrementalBaseSchemaSnapshot,
        incrementalDiff: artifacts.incrementalDiff,
        installSourceKind: 'publication',
        snapshotHash: artifacts.snapshotHash,
        snapshot: options.syncContext.snapshot,
        entities: artifacts.incrementalPayload.entities,
        publicationSnapshot: options.syncContext.publicationSnapshot,
        publicationId: options.syncContext.publicationId,
        publicationVersionId: options.syncContext.publicationVersionId
    }
}

export function buildApplicationSyncSourceFromBundle(bundle: ApplicationReleaseBundle): ApplicationSchemaSyncSource {
    const snapshot = bundle.snapshot
    if (!snapshot || typeof snapshot !== 'object' || !snapshot.entities || typeof snapshot.entities !== 'object') {
        throw new Error('Invalid application release bundle snapshot')
    }
    validateMarketingSnapshotTransportLayouts(snapshot)
    validateSnapshotLayoutIdentities(snapshot)
    const artifacts = validateApplicationReleaseBundleArtifacts(bundle)

    return {
        bundle,
        bootstrapPayload: artifacts.bootstrapPayload,
        incrementalPayload: artifacts.incrementalPayload,
        incrementalBaseSchemaSnapshot: artifacts.incrementalBaseSchemaSnapshot,
        incrementalDiff: artifacts.incrementalDiff,
        installSourceKind: 'release_bundle',
        snapshotHash: artifacts.snapshotHash,
        snapshot,
        entities: artifacts.incrementalPayload.entities,
        publicationSnapshot: snapshot as unknown as Record<string, unknown>,
        publicationId: bundle.manifest.publicationId ?? null,
        publicationVersionId: bundle.manifest.publicationVersionId ?? null
    }
}
