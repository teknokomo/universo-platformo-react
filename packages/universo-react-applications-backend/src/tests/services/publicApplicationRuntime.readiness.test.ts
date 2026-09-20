import { classifyPublicApplicationReadiness } from '../../services/publicApplicationRuntime'

const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'

const publicationId = '0190a9b5-3cde-7abc-8def-0123456789ac'

const publicationVersionId = '0190a9b5-3cde-7abc-8def-0123456789ad'

const readyApplication = (overrides: Partial<PublicRuntimeApplicationRow> = {}): PublicRuntimeApplicationRow => ({
    id: applicationId,
    schemaName: 'app_0190a9b53cde7abc8def0123456789ab',
    schemaStatus: 'synced',
    isPublic: true,
    workspacesEnabled: false,
    aliasRoutingMode: 'direct',
    installedReleaseMetadata: {
        kind: 'application_release_installation',
        bundleVersion: 1,
        sourceKind: 'publication',
        snapshotHash: 'a'.repeat(64),
        publicationId,
        publicationVersionId
    },
    lastSyncedPublicationVersionId: publicationVersionId,
    uplArchived: false,
    uplDeleted: false,
    appPublished: true,
    appArchived: false,
    appDeleted: false,
    hasActiveAlias: false,
    matchedAlias: null,
    primaryAlias: null,
    ...overrides
})

describe('public application runtime readiness', () => {
    it.each(['synced', 'outdated', 'update_available'])('accepts %s only with a coherent installed materialization', (schemaStatus) => {
        expect(classifyPublicApplicationReadiness(readyApplication({ schemaStatus }))).toEqual({ ready: true })
        expect(
            classifyPublicApplicationReadiness(
                readyApplication({ schemaStatus, installedReleaseMetadata: null, lastSyncedPublicationVersionId: null })
            )
        ).toEqual({ ready: false, reason: 'materialization_invalid' })
    })

    it.each(['draft', 'pending', 'maintenance', 'error', null])('fails closed for schema status %s', (schemaStatus) => {
        expect(classifyPublicApplicationReadiness(readyApplication({ schemaStatus }))).toEqual({
            ready: false,
            reason: 'schema_status_unavailable'
        })
    })

    it.each([
        ['upl deleted', { uplDeleted: true }, 'application_deleted'],
        ['app deleted', { appDeleted: true }, 'application_deleted'],
        ['upl archived', { uplArchived: true }, 'application_archived'],
        ['app archived', { appArchived: true }, 'application_archived'],
        ['private', { isPublic: false }, 'application_private'],
        ['unpublished', { appPublished: false }, 'application_unpublished'],
        ['missing schema', { schemaName: null }, 'schema_invalid']
    ] as const)('rejects %s applications', (_label, overrides, reason) => {
        expect(classifyPublicApplicationReadiness(readyApplication(overrides))).toEqual({ ready: false, reason })
    })

    it('rejects inconsistent publication lineage', () => {
        expect(
            classifyPublicApplicationReadiness(readyApplication({ lastSyncedPublicationVersionId: '0190a9b5-3cde-7abc-8def-0123456789ae' }))
        ).toEqual({ ready: false, reason: 'materialization_invalid' })
    })
})
