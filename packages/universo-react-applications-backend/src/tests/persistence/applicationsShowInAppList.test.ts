import { copyApplicationWithOptions } from '../../persistence/applicationCopyStore'
import { createApplicationWithOwner, updateApplication } from '../../persistence/applicationMutationStore'
import { listApplications, type ApplicationCopySourceRecord, type ApplicationRecord } from '../../persistence/applicationsStore'
import { createMockDbExecutor } from '../utils/dbMocks'

const applicationId = '019ccefc-2f7b-7b36-82f4-85cdb1312268'
const localizedName = { _schema: '1', _primary: 'en', locales: { en: { content: 'Application' } } }

const buildApplication = (showInAppList: boolean): ApplicationRecord => ({
    id: applicationId,
    name: localizedName,
    description: null,
    settings: {},
    isPublic: true,
    showInAppList,
    workspacesEnabled: false,
    schemaName: 'app_019ccefc2f7b7b3682f485cdb1312268',
    schemaStatus: 'draft',
    schemaSyncedAt: null,
    schemaError: null,
    version: 1,
    createdAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedAt: new Date('2026-10-31T00:00:00.000Z'),
    updatedBy: 'actor-1'
})

const buildCopySource = (showInAppList: boolean): ApplicationCopySourceRecord => ({
    ...buildApplication(showInAppList),
    schemaSnapshot: null,
    appStructureVersion: null,
    lastSyncedPublicationVersionId: null
})

describe('Application showInAppList persistence', () => {
    it('filters public catalog rows by visibility before window totals and pagination', async () => {
        const { executor } = createMockDbExecutor()
        executor.query.mockResolvedValueOnce([
            { ...buildApplication(false), connectorsCount: 0, membersCount: 0, membershipRole: null, windowTotal: '1' }
        ])

        const result = await listApplications(executor, {
            userId: 'actor-1',
            showAll: false,
            limit: 10,
            offset: 0,
            sortBy: 'name',
            sortOrder: 'asc'
        })

        const sql = executor.query.mock.calls[0]?.[0] as string
        expect(sql).toContain('a.show_in_app_list = true')
        expect(sql).toContain('$2::boolean = true OR membership.user_id IS NOT NULL')
        expect(sql).toContain('COUNT(*) OVER() AS "windowTotal"')
        expect(sql).toContain(
            "ORDER BY COALESCE(a.name->'locales'->(a.name->>'_primary')->>'content', a.name->'locales'->'en'->>'content', a.name #>> '{}', '') ASC, a.id ASC"
        )
        expect(sql).toContain('LIMIT $3')
        expect(result.items[0]?.showInAppList).toBe(false)
    })

    it('defaults new Applications to listed and audits the initialized preference in the create transaction', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([{ id: applicationId }])
            .mockResolvedValueOnce([buildApplication(true)])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312299' }])

        await createApplicationWithOwner(executor, {
            name: localizedName,
            description: null,
            isPublic: true,
            workspacesEnabled: false,
            userId: 'actor-1',
            resolveSchemaName: () => 'app_019ccefc2f7b7b3682f485cdb1312268'
        })

        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('show_in_app_list')
        expect(txExecutor.query.mock.calls[1]?.[1]?.[4]).toBe(true)
        expect(txExecutor.query.mock.calls[3]?.[0]).toContain('applications.record_application_catalog_visibility_audit')
        expect(txExecutor.query.mock.calls[3]?.[1]?.[3]).toBe(true)
    })

    it('copies the stored source preference and allows an explicit copy override', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ version: 1 }])
            .mockResolvedValueOnce([buildApplication(false)])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312299' }])

        await copyApplicationWithOptions(executor, {
            newApplicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312298',
            sourceApplicationId: applicationId,
            sourceApplication: buildCopySource(false),
            copiedName: localizedName,
            copiedDescription: null,
            settings: {},
            isPublic: true,
            showInAppList: true,
            workspacesEnabled: false,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312298',
            schemaStatus: 'draft',
            copyAccess: false,
            copyConnector: false,
            actorUserId: 'actor-1'
        })

        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('pg_advisory_xact_lock(hashtextextended($1::text, 0))')
        expect(txExecutor.query.mock.calls[1]?.[0]).toContain('FOR UPDATE')
        expect(txExecutor.query.mock.calls[2]?.[0]).toContain('show_in_app_list')
        expect(txExecutor.query.mock.calls[2]?.[1]?.[5]).toBe(true)
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('applications.record_application_catalog_visibility_audit')
        expect(txExecutor.query.mock.calls[4]?.[1]?.[3]).toBe(true)
        expect(txExecutor.query.mock.calls[2]?.[0]).not.toContain('rel_application_bot_bindings')
    })

    it('preserves the source catalog visibility when no copy override is supplied', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ version: 1 }])
            .mockResolvedValueOnce([buildApplication(false)])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: '019ccefc-2f7b-7b36-82f4-85cdb1312299' }])

        await copyApplicationWithOptions(executor, {
            newApplicationId: '019ccefc-2f7b-7b36-82f4-85cdb1312297',
            sourceApplicationId: applicationId,
            sourceApplication: buildCopySource(false),
            copiedName: localizedName,
            copiedDescription: null,
            settings: {},
            isPublic: true,
            workspacesEnabled: false,
            schemaName: 'app_019ccefc2f7b7b3682f485cdb1312297',
            schemaStatus: 'draft',
            copyAccess: false,
            copyConnector: false,
            actorUserId: 'actor-1'
        })

        expect(txExecutor.query.mock.calls[2]?.[1]?.[5]).toBe(false)
        expect(txExecutor.query.mock.calls[4]?.[0]).toContain('applications.record_application_catalog_visibility_audit')
        expect(txExecutor.query.mock.calls[4]?.[1]?.[3]).toBe(false)
    })

    it('updates visibility with expectedVersion and leaves durable auditing to the database trigger', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([buildApplication(true)])

        const saved = await updateApplication(executor, {
            applicationId,
            showInAppList: true,
            userId: 'actor-1',
            expectedVersion: 7
        })

        expect(saved?.showInAppList).toBe(true)
        expect(executor.transaction).toHaveBeenCalledTimes(1)
        expect(txExecutor.query).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('show_in_app_list = $1')
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('COALESCE(_upl_version, 1) = $4')
        expect(txExecutor.query.mock.calls[0]?.[0]).not.toContain('record_application_catalog_visibility_audit')
    })

    it('rejects a stale visibility version without changing or auditing the Application', async () => {
        const { executor, txExecutor } = createMockDbExecutor()
        txExecutor.query.mockResolvedValueOnce([])

        const result = await updateApplication(executor, {
            applicationId,
            showInAppList: true,
            userId: 'actor-1',
            expectedVersion: 7
        })

        expect(result).toBeNull()
        expect(txExecutor.query).toHaveBeenCalledTimes(1)
        expect(txExecutor.query.mock.calls[0]?.[0]).toContain('COALESCE(_upl_version, 1) = $4')
    })
})
