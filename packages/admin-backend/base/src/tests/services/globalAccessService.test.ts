import { createGlobalAccessService } from '../../services/globalAccessService'

const createMockExecutor = (responses: unknown[][]) => {
    let callIndex = 0

    return {
        query: jest.fn().mockImplementation(async () => responses[callIndex++] ?? []),
        transaction: jest.fn(),
        isReleased: jest.fn(() => false)
    }
}

describe('createGlobalAccessService', () => {
    it('marks the superuser role in aggregated access info', async () => {
        const exec = createMockExecutor([
            [{ role_codename: 'superuser', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#111111' }],
            [{ is_super: true }],
            [{ can_access: true }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.getGlobalAccessInfo('user-1')

        expect(result.isSuperuser).toBe(true)
        expect(result.canAccessAdmin).toBe(true)
        expect(result.globalRoles).toEqual([
            expect.objectContaining({
                codename: 'superuser',
                metadata: expect.objectContaining({
                    color: '#111111',
                    isSuperuser: true
                })
            })
        ])
    })

    it('updates an existing role assignment instead of inserting a duplicate', async () => {
        const exec = createMockExecutor([
            [{ id: 'role-1', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#222222', is_superuser: false }],
            [{ id: 'assignment-1' }],
            [],
            [{ id: 'user-1', email: 'neo@example.com' }],
            [{ user_id: 'user-1', nickname: 'neo' }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.grantRole('user-1', 'editor', 'admin-1', 'keep current assignment')

        const executedSql = exec.query.mock.calls.map(([sql]) => String(sql))

        expect(result).toEqual(
            expect.objectContaining({
                id: 'assignment-1',
                userId: 'user-1',
                email: 'neo@example.com',
                nickname: 'neo',
                roleCodename: 'editor',
                grantedBy: 'admin-1',
                comment: 'keep current assignment'
            })
        )
        expect(executedSql.some((sql) => sql.includes('UPDATE admin.rel_user_roles'))).toBe(true)
        expect(executedSql.some((sql) => sql.includes('INSERT INTO admin.rel_user_roles'))).toBe(false)
        expect(
            executedSql.some(
                (sql) =>
                    sql.includes('SELECT user_id, nickname FROM profiles.cat_profiles') &&
                    sql.includes('_upl_deleted = false') &&
                    sql.includes('_app_deleted = false')
            )
        ).toBe(true)
    })

    it('filters profile search and nickname hydration to active rows only', async () => {
        const exec = createMockExecutor([
            [{ count: '1' }],
            [
                {
                    id: 'assignment-1',
                    user_id: 'user-1',
                    role_id: 'role-1',
                    granted_by: 'admin-1',
                    comment: 'note',
                    _upl_created_at: new Date('2026-03-13T00:00:00.000Z'),
                    role_codename: 'editor',
                    name: { _schema: '1', _primary: 'en', locales: {} },
                    color: '#333333',
                    is_superuser: false
                }
            ],
            [{ id: 'user-1', email: 'neo@example.com' }],
            [{ user_id: 'user-1', nickname: 'neo' }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        await service.listGlobalUsers({ search: 'neo' })

        const executedSql = exec.query.mock.calls.map(([sql]) => String(sql))

        expect(
            executedSql.some(
                (sql) =>
                    sql.includes('EXISTS (SELECT 1 FROM profiles.cat_profiles p') &&
                    sql.includes('p._upl_deleted = false') &&
                    sql.includes('p._app_deleted = false')
            )
        ).toBe(true)
        expect(
            executedSql.some(
                (sql) =>
                    sql.includes('SELECT user_id, nickname FROM profiles.cat_profiles WHERE user_id = ANY($1::uuid[])') &&
                    sql.includes('_upl_deleted = false') &&
                    sql.includes('_app_deleted = false')
            )
        ).toBe(true)
    })

    it('soft-deletes role assignments when revoking access', async () => {
        const exec = createMockExecutor([[{ id: 'assignment-1' }], [{ id: 'assignment-2' }]])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        await service.revokeGlobalAccess('user-1')
        await service.revokeAssignment('assignment-2')

        const [[revokeAllSql, revokeAllParams], [revokeOneSql, revokeOneParams]] = exec.query.mock.calls

        expect(String(revokeAllSql)).toContain('UPDATE admin.rel_user_roles')
        expect(String(revokeAllSql)).toContain('_upl_deleted = true')
        expect(String(revokeAllSql)).toContain('_app_deleted = true')
        expect(String(revokeAllSql)).not.toContain('DELETE FROM admin.rel_user_roles')
        expect(revokeAllParams).toEqual(['user-1', null])

        expect(String(revokeOneSql)).toContain('UPDATE admin.rel_user_roles')
        expect(String(revokeOneSql)).toContain('_upl_deleted = true')
        expect(String(revokeOneSql)).toContain('_app_deleted = true')
        expect(String(revokeOneSql)).not.toContain('DELETE FROM admin.rel_user_roles')
        expect(revokeOneParams).toEqual(['assignment-2', null])
    })
})
