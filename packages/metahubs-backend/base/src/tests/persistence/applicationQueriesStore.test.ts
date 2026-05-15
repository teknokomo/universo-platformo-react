import {
    findApplicationById,
    updateApplicationFields,
    findApplicationUser,
    findConnectorsByApplicationId,
    findFirstConnectorByApplicationId,
    findConnectorPublications,
    findFirstConnectorPublication,
    notifyLinkedAppsUpdateAvailable,
    resetLinkedAppsToSynced
} from '../../persistence/applicationQueriesStore'

const createExec = () => ({
    query: jest.fn().mockResolvedValue([{ id: 'row-1', version: 1 }])
})

describe('applicationQueriesStore dual-flag active-row predicates', () => {
    it('findApplicationById includes dual-flag predicate', async () => {
        const exec = createExec()
        await findApplicationById(exec as never, 'app-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('updateApplicationFields includes dual-flag predicate in WHERE', async () => {
        const exec = createExec()
        await updateApplicationFields(exec as never, 'app-1', { slug: 'test-slug' })
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('UPDATE applications.obj_applications')
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('findApplicationUser includes dual-flag predicate', async () => {
        const exec = createExec()
        await findApplicationUser(exec as never, 'app-1', 'user-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('findConnectorsByApplicationId includes dual-flag predicate', async () => {
        const exec = createExec()
        await findConnectorsByApplicationId(exec as never, 'app-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('findFirstConnectorByApplicationId includes dual-flag predicate', async () => {
        const exec = createExec()
        await findFirstConnectorByApplicationId(exec as never, 'app-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('findConnectorPublications includes dual-flag predicate', async () => {
        const exec = createExec()
        await findConnectorPublications(exec as never, 'connector-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('findFirstConnectorPublication includes dual-flag predicate', async () => {
        const exec = createExec()
        await findFirstConnectorPublication(exec as never, 'connector-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('notifyLinkedAppsUpdateAvailable includes dual-flag on outer and sub-select', async () => {
        const exec = createExec()
        await notifyLinkedAppsUpdateAvailable(exec as never, 'pub-1')
        const sql = String(exec.query.mock.calls[0][0])
        // Outer WHERE on obj_applications alias 'a'
        expect(sql).toContain('a._upl_deleted = false')
        expect(sql).toContain('a._app_deleted = false')
        // Sub-select on obj_connectors 'c' and rel_connector_publications 'cp'
        expect(sql).toContain('c._upl_deleted = false')
        expect(sql).toContain('cp._upl_deleted = false')
    })

    it('resetLinkedAppsToSynced includes dual-flag on outer and sub-select', async () => {
        const exec = createExec()
        await resetLinkedAppsToSynced(exec as never, 'pub-1')
        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('a._upl_deleted = false')
        expect(sql).toContain('a._app_deleted = false')
        expect(sql).toContain('c._upl_deleted = false')
        expect(sql).toContain('cp._upl_deleted = false')
    })
})
