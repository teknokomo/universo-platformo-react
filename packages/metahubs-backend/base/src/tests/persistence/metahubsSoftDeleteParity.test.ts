jest.mock('@universo/admin-backend', () => ({
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import { getMetahubMembership } from '../../domains/shared/guards'
import { findBranchBySchemaName } from '../../persistence/branchesStore'
import { listMetahubs, listMetahubMembers } from '../../persistence/metahubsStore'
import { softDelete, softDeleteCondition } from '../../persistence/metahubsQueryHelpers'
import { findPublicationVersionById, listPublications } from '../../persistence/publicationsStore'

function createExec() {
    return { query: jest.fn().mockResolvedValue([]) }
}

describe('metahubs soft-delete parity', () => {
    it('builds the active-row condition with both delete flags', () => {
        expect(softDeleteCondition({ alias: 'm' })).toBe('m._upl_deleted = false AND m._app_deleted = false')
        expect(softDeleteCondition({ alias: 'm', onlyDeleted: true })).toBe('m._upl_deleted = true AND m._app_deleted = true')
    })

    it('soft-deletes metahub-domain rows through both lifecycle columns', async () => {
        const exec = createExec()
        exec.query.mockResolvedValue([{ id: 'row-1' }])

        await softDelete(exec as never, 'metahubs', 'doc_publications', 'row-1', 'user-1')

        const [sql, params] = exec.query.mock.calls[0]
        expect(sql).toContain('_upl_deleted = true')
        expect(sql).toContain('_app_deleted = true')
        expect(sql).toContain('_app_deleted_at = NOW()')
        expect(sql).toContain('AND _upl_deleted = false')
        expect(sql).toContain('AND _app_deleted = false')
        expect(params).toEqual(['row-1', 'user-1'])
    })

    it('filters deleted metahubs, memberships, and branches in listMetahubs', async () => {
        const exec = createExec()

        await listMetahubs(exec as never, {
            userId: 'user-1',
            showAll: false,
            limit: 20,
            offset: 0,
            sortBy: 'updated',
            sortOrder: 'desc'
        })

        const [sql] = exec.query.mock.calls[0]
        expect(sql).toContain('membership._upl_deleted = false AND membership._app_deleted = false')
        expect(sql).toContain('m._upl_deleted = false AND m._app_deleted = false')
        expect(sql).toContain('FROM metahubs.rel_metahub_users')
        expect(sql).toContain('FROM metahubs.obj_metahub_branches')
        expect(sql).toContain('WHERE _upl_deleted = false AND _app_deleted = false')
    })

    it('filters deleted membership rows in listMetahubMembers', async () => {
        const exec = createExec()

        await listMetahubMembers(exec as never, {
            metahubId: 'metahub-1',
            limit: 20,
            offset: 0
        })

        const [sql] = exec.query.mock.calls[0]
        expect(sql).toContain('mu._upl_deleted = false AND mu._app_deleted = false')
    })

    it('filters deleted branches when resolving schema-name collisions', async () => {
        const exec = createExec()

        await findBranchBySchemaName(exec as never, 'mhb_example')

        const [sql] = exec.query.mock.calls[0]
        expect(sql).toContain('b._upl_deleted = false AND b._app_deleted = false')
    })

    it('filters deleted publications and publication versions in publication reads', async () => {
        const exec = createExec()

        await listPublications(exec as never, {
            metahubId: 'metahub-1',
            limit: 20,
            offset: 0
        })
        await findPublicationVersionById(exec as never, 'version-1')

        const [listSql] = exec.query.mock.calls[0]
        const [versionSql] = exec.query.mock.calls[1]
        expect(listSql).toContain('p._upl_deleted = false AND p._app_deleted = false')
        expect(listSql).toContain('FROM metahubs.doc_publication_versions')
        expect(listSql).toContain('WHERE _upl_deleted = false AND _app_deleted = false')
        expect(versionSql).toContain('pv._upl_deleted = false AND pv._app_deleted = false')
    })

    it('filters deleted memberships and deleted parent metahubs in guard lookups', async () => {
        const exec = createExec()
        exec.query.mockResolvedValue([
            {
                id: 'membership-1',
                metahubId: 'metahub-1',
                userId: 'user-1',
                activeBranchId: null,
                role: 'owner',
                comment: null
            }
        ])

        await getMetahubMembership(exec as never, 'user-1', 'metahub-1')

        const [sql, params] = exec.query.mock.calls[0]
        expect(sql).toContain('JOIN metahubs.obj_metahubs m ON m.id = mu.metahub_id')
        expect(sql).toContain('mu._upl_deleted = false AND mu._app_deleted = false')
        expect(sql).toContain('m._upl_deleted = false AND m._app_deleted = false')
        expect(params).toEqual(['metahub-1', 'user-1'])
    })
})
