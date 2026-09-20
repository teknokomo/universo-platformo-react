import { type DbExecutor } from '@universo-react/utils'
import {
    parsePublicApplicationRef,
    PublicApplicationUnavailableError,
    resolvePublicApplication
} from '../../services/publicApplicationRuntime'

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

describe('public application reference parsing and routing', () => {
    it('accepts canonical UUID v7 and lowercase aliases only', () => {
        expect(parsePublicApplicationRef(applicationId)).toEqual({ kind: 'uuid', value: applicationId })
        expect(parsePublicApplicationRef('seventy-third-meridian')).toEqual({ kind: 'alias', value: 'seventy-third-meridian' })

        for (const invalid of ['Seventy-Third-Meridian', ' alias', 'alias ', 'admin', 'bad/alias', 'bad%2Falias', 'a'.repeat(64)]) {
            expect(() => parsePublicApplicationRef(invalid)).toThrow(PublicApplicationUnavailableError)
        }
    })

    it('does not touch the database for malformed references', async () => {
        const query = jest.fn()
        const executor = { query } as unknown as DbExecutor

        await expect(resolvePublicApplication(executor, 'bad%2Falias')).rejects.toBeInstanceOf(PublicApplicationUnavailableError)
        expect(query).not.toHaveBeenCalled()
    })

    it('canonicalizes a secondary alias to the current primary alias', async () => {
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'canonical',
                hasActiveAlias: true,
                matchedAlias: 'om73',
                primaryAlias: '73rd-meridian'
            })
        ])
        const executor = { query } as unknown as DbExecutor

        const resolved = await resolvePublicApplication(executor, 'om73')
        const [sql, params] = query.mock.calls[0]
        expect(sql).toContain('AND aa._upl_archived = false')
        expect(sql).toContain('AND aa._app_archived = false')
        expect(params).toEqual(['om73'])
        expect(resolved.route).toEqual({
            applicationId,
            matchedBy: 'alias',
            matchedAlias: 'om73',
            routingMode: 'canonical',
            primaryAlias: '73rd-meridian',
            canonicalAlias: '73rd-meridian'
        })
    })

    it('keeps UUID routes stable in canonical mode', async () => {
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'canonical',
                hasActiveAlias: true,
                primaryAlias: '73rd-meridian'
            })
        ])
        const executor = { query } as unknown as DbExecutor

        const resolved = await resolvePublicApplication(executor, applicationId)
        expect(resolved.route.matchedBy).toBe('uuid')
        expect(resolved.route.primaryAlias).toBe('73rd-meridian')
        expect(resolved.route.canonicalAlias).toBeNull()
    })

    it('fails closed when canonical mode has aliases but no primary', async () => {
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'canonical',
                hasActiveAlias: true,
                matchedAlias: 'om73',
                primaryAlias: null
            })
        ])
        const executor = { query } as unknown as DbExecutor

        await expect(resolvePublicApplication(executor, 'om73')).rejects.toMatchObject({ reason: 'primary_alias_invalid' })
    })

    it('fails closed with the unavailable outcome when persisted route data violates the shared route schema', async () => {
        // A persisted alias that bypassed the shared validation contract (for
        // example a reserved route word) must never escape as a ZodError/503;
        // the anonymous boundary maps it to the single unavailable outcome.
        const query = jest.fn().mockResolvedValue([
            readyApplication({
                aliasRoutingMode: 'direct',
                hasActiveAlias: true,
                primaryAlias: 'api'
            })
        ])
        const executor = { query } as unknown as DbExecutor

        await expect(resolvePublicApplication(executor, applicationId)).rejects.toMatchObject({ reason: 'routing_policy_invalid' })
    })
})
