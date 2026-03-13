import { updateInstance } from '../../persistence/instancesStore'
import { createLocale, updateLocale } from '../../persistence/localesStore'
import { countUsersByRoleId, createRole, listRoleUsers, replacePermissions, updateRole } from '../../persistence/rolesStore'
import { upsertSetting } from '../../persistence/settingsStore'

const createExec = () => ({
    query: jest.fn(async () => [{}]),
    transaction: jest.fn(),
    isReleased: jest.fn(() => false)
})

const createTransactionalExec = () => {
    const txQuery = jest.fn(async () => [{}])
    const tx = { query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) }
    const exec = {
        query: jest.fn(async () => [{}]),
        transaction: jest.fn(async (callback: (input: typeof tx) => unknown) => callback(tx)),
        isReleased: jest.fn(() => false)
    }

    return { exec, txQuery }
}

describe('admin persistence explicit RETURNING regression', () => {
    it('uses explicit columns for role create and update', async () => {
        const exec = createExec()

        await createRole(exec as never, { codename: 'editor', name: { en: 'Editor' } })
        await updateRole(exec as never, 'role-1', { color: '#111111' })

        expect(String(exec.query.mock.calls[0][0])).toContain(
            'RETURNING id, codename, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at'
        )
        expect(String(exec.query.mock.calls[0][0])).not.toContain('RETURNING *')
        expect(String(exec.query.mock.calls[1][0])).toContain(
            'RETURNING id, codename, description, name, color, is_superuser, is_system, _upl_created_at, _upl_updated_at'
        )
        expect(String(exec.query.mock.calls[1][0])).not.toContain('RETURNING *')
    })

    it('uses explicit columns for role permission replacement', async () => {
        const exec = createExec()

        await replacePermissions(exec as never, 'role-1', [{ subject: 'admin', action: 'read', fields: ['id'] }])

        expect(String(exec.query.mock.calls[1][0])).toContain('RETURNING id, role_id, subject, action, conditions, fields, _upl_created_at')
        expect(String(exec.query.mock.calls[1][0])).not.toContain('RETURNING *')
    })

    it('uses explicit columns for locale create and update', async () => {
        const { exec, txQuery } = createTransactionalExec()

        await createLocale(exec as never, {
            code: 'en',
            name: { en: 'English' },
            isEnabledContent: true,
            isEnabledUi: true,
            isDefaultContent: false,
            isDefaultUi: false,
            sortOrder: 1
        })
        await updateLocale(exec as never, 'locale-1', { sortOrder: 2 })

        expect(String(txQuery.mock.calls[0][0])).toContain(
            'RETURNING id, code, name, native_name, is_enabled_content, is_enabled_ui, is_default_content, is_default_ui, is_system, sort_order, _upl_created_at, _upl_updated_at'
        )
        expect(String(txQuery.mock.calls[0][0])).not.toContain('RETURNING *')
        expect(String(txQuery.mock.calls[1][0])).toContain(
            'RETURNING id, code, name, native_name, is_enabled_content, is_enabled_ui, is_default_content, is_default_ui, is_system, sort_order, _upl_created_at, _upl_updated_at'
        )
        expect(String(txQuery.mock.calls[1][0])).not.toContain('RETURNING *')
    })

    it('uses explicit columns for settings upsert', async () => {
        const exec = createExec()

        await upsertSetting(exec as never, 'metahubs', 'codenameStyle', 'pascal-case')

        expect(String(exec.query.mock.calls[0][0])).toContain('RETURNING id, category, key, value, _upl_created_at, _upl_updated_at')
        expect(String(exec.query.mock.calls[0][0])).not.toContain('RETURNING *')
    })

    it('uses explicit columns for instances update', async () => {
        const exec = createExec()

        await updateInstance(exec as never, 'instance-1', { status: 'maintenance' })

        expect(String(exec.query.mock.calls[0][0])).toContain(
            'RETURNING id, codename, name, description, url, status, is_local, _upl_created_at, _upl_updated_at'
        )
        expect(String(exec.query.mock.calls[0][0])).not.toContain('RETURNING *')
    })
})

describe('admin persistence dual-flag active-row predicates', () => {
    it('countUsersByRoleId includes dual-flag predicate', async () => {
        const exec = createExec()

        await countUsersByRoleId(exec as never, 'role-1')

        const sql = String(exec.query.mock.calls[0][0])
        expect(sql).toContain('_upl_deleted = false')
        expect(sql).toContain('_app_deleted = false')
    })

    it('listRoleUsers includes dual-flag predicate in both count and items queries', async () => {
        const exec = createExec()
        exec.query.mockResolvedValueOnce([{ count: '0' }])

        await listRoleUsers(exec as never, 'role-1', { limit: 10, offset: 0 })

        const countSql = String(exec.query.mock.calls[0][0])
        expect(countSql).toContain('_upl_deleted = false')
        expect(countSql).toContain('_app_deleted = false')
    })

    it('listRoleUsers includes dual-flag predicate in items query when results exist', async () => {
        const exec = createExec()
        exec.query
            .mockResolvedValueOnce([{ count: '1' }])
            .mockResolvedValueOnce([{ id: 'ur-1', user_id: 'u-1', role_id: 'role-1', email: null, full_name: null, status: 'active' }])

        await listRoleUsers(exec as never, 'role-1', { limit: 10, offset: 0 })

        const itemsSql = String(exec.query.mock.calls[1][0])
        expect(itemsSql).toContain('_upl_deleted = false')
        expect(itemsSql).toContain('_app_deleted = false')
    })
})
