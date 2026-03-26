import { createGlobalAccessService } from '../../services/globalAccessService'

type MockTransaction = {
    query: jest.Mock
    transaction: jest.Mock
    isReleased: jest.Mock<boolean, []>
}

const createMockExecutor = (responses: unknown[][]) => {
    let callIndex = 0
    const executor = {
        query: jest.fn().mockImplementation(async () => responses[callIndex++] ?? []),
        transaction: jest.fn(async (callback: (trx: unknown) => Promise<unknown>) => callback(executor as never)),
        isReleased: jest.fn(() => false)
    }

    return executor
}

describe('createGlobalAccessService', () => {
    it('marks the superuser role in aggregated access info', async () => {
        const exec = createMockExecutor([
            [{ role_codename: 'Superuser', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#111111' }],
            [{ is_super: true }],
            [{ can_access: true }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.getGlobalAccessInfo('user-1')

        expect(result.isSuperuser).toBe(true)
        expect(result.canAccessAdmin).toBe(true)
        expect(result.globalRoles).toEqual([
            expect.objectContaining({
                codename: 'Superuser',
                metadata: expect.objectContaining({
                    color: '#111111',
                    isSuperuser: true
                })
            })
        ])
    })

    it('sorts aggregated access info so superuser stays the primary role', async () => {
        const exec = createMockExecutor([
            [
                { role_codename: 'editor', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#222222' },
                { role_codename: 'Superuser', name: { _schema: '1', _primary: 'en', locales: {} }, color: '#111111' }
            ],
            [{ is_super: true }],
            [{ can_access: true }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.getGlobalAccessInfo('user-1')

        expect(result.globalRoles[0]).toEqual(
            expect.objectContaining({
                codename: 'Superuser',
                metadata: expect.objectContaining({ isSuperuser: true })
            })
        )
    })

    it('updates an existing role assignment instead of inserting a duplicate', async () => {
        const txQuery = jest
            .fn()
            .mockResolvedValueOnce([{ is_super: false }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'assignment-1' }])
            .mockResolvedValueOnce([])

        const exec = {
            query: jest
                .fn()
                .mockResolvedValueOnce([
                    {
                        id: 'role-1',
                        name: { _schema: '1', _primary: 'en', locales: {} },
                        color: '#222222',
                        is_superuser: false,
                        is_system: false
                    }
                ])
                .mockResolvedValueOnce([{ id: 'user-1', email: 'neo@example.com' }])
                .mockResolvedValueOnce([
                    {
                        user_id: 'user-1',
                        nickname: 'neo',
                        onboarding_completed: false,
                        _upl_created_at: new Date('2026-03-18T00:00:00.000Z')
                    }
                ]),
            transaction: jest.fn(async (callback: (trx: MockTransaction) => Promise<unknown>) =>
                callback({ query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) })
            ),
            isReleased: jest.fn(() => false)
        }
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.grantRole('user-1', 'editor', 'admin-1', 'keep current assignment')

        const executedSql = [...txQuery.mock.calls, ...exec.query.mock.calls].map(([sql]) => String(sql))

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
                    sql.includes('SELECT user_id, nickname, onboarding_completed, _upl_created_at FROM profiles.cat_profiles') &&
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
                    user_id: 'user-1',
                    email: 'neo@example.com',
                    nickname: 'neo',
                    onboarding_completed: false,
                    registered_at: new Date('2026-03-13T00:00:00.000Z'),
                    first_assignment_at: new Date('2026-03-13T00:00:00.000Z'),
                    roles: [
                        {
                            id: 'role-1',
                            codename: 'editor',
                            name: { _schema: '1', _primary: 'en', locales: {} },
                            color: '#333333',
                            isSuperuser: false,
                            isSystem: false
                        }
                    ]
                }
            ]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.listGlobalUsers({ search: 'neo' })

        const executedSql = exec.query.mock.calls.map(([sql]) => String(sql))

        expect(result.users[0]).toEqual(
            expect.objectContaining({
                userId: 'user-1',
                email: 'neo@example.com',
                onboardingCompleted: false,
                roles: [expect.objectContaining({ codename: 'editor' })]
            })
        )
        expect(
            executedSql.some(
                (sql) =>
                    sql.includes('LEFT JOIN profiles.cat_profiles p ON p.user_id = u.id') &&
                    sql.includes('p._upl_deleted = false') &&
                    sql.includes('p._app_deleted = false')
            )
        ).toBe(true)
        expect(
            executedSql.some(
                (sql) => sql.includes("LOWER(COALESCE(p.nickname, '')) LIKE") && sql.includes("LOWER(COALESCE(u.email, '')) LIKE")
            )
        ).toBe(true)
    })

    it('enforces superuser exclusivity when replacing user roles', async () => {
        const txQuery = jest
            .fn()
            .mockResolvedValueOnce([
                {
                    id: 'role-super',
                    codename: 'Superuser',
                    name: { _schema: '1', _primary: 'en', locales: {} },
                    color: '#d32f2f',
                    is_superuser: true,
                    is_system: true
                },
                {
                    id: 'role-editor',
                    codename: 'editor',
                    name: { _schema: '1', _primary: 'en', locales: {} },
                    color: '#222222',
                    is_superuser: false,
                    is_system: false
                }
            ])
            .mockResolvedValueOnce([{ is_super: true }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 'role-super',
                    codename: 'Superuser',
                    name: { _schema: '1', _primary: 'en', locales: {} },
                    color: '#d32f2f',
                    is_superuser: true,
                    is_system: true
                }
            ])

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (trx: MockTransaction) => Promise<unknown>) =>
                callback({ query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) })
            ),
            isReleased: jest.fn(() => false)
        }

        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })
        const result = await service.setUserRoles('user-1', ['role-super', 'role-editor'], 'admin-1', 'exclusive assignment')

        expect(result).toEqual([expect.objectContaining({ codename: 'Superuser', isSuperuser: true })])
        expect(txQuery).toHaveBeenNthCalledWith(4, expect.stringContaining('INSERT INTO admin.rel_user_roles'), [
            'user-1',
            ['role-super'],
            'admin-1',
            'exclusive assignment'
        ])
    })

    it('blocks non-superusers from assigning protected roles through setUserRoles', async () => {
        const txQuery = jest
            .fn()
            .mockResolvedValueOnce([
                {
                    id: 'role-super',
                    codename: 'Superuser',
                    name: { _schema: '1', _primary: 'en', locales: {} },
                    color: '#d32f2f',
                    is_superuser: true,
                    is_system: true
                }
            ])
            .mockResolvedValueOnce([{ is_super: false }])
            .mockResolvedValueOnce([])

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (trx: MockTransaction) => Promise<unknown>) =>
                callback({ query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) })
            ),
            isReleased: jest.fn(() => false)
        }

        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        await expect(service.setUserRoles('user-1', ['role-super'], 'admin-editor', 'unauthorized promotion')).rejects.toThrow(
            'Only superusers can modify superuser or system-role assignments'
        )

        expect(txQuery).not.toHaveBeenCalledWith(expect.stringContaining('UPDATE admin.rel_user_roles'), expect.anything())
        expect(txQuery).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO admin.rel_user_roles'), expect.anything())
    })

    it('blocks non-superusers from revoking an existing protected role assignment', async () => {
        const txQuery = jest
            .fn()
            .mockResolvedValueOnce([{ is_super: false }])
            .mockResolvedValueOnce([
                {
                    id: 'role-super',
                    codename: 'Superuser',
                    is_superuser: true,
                    is_system: true
                }
            ])

        const exec = {
            query: jest.fn(),
            transaction: jest.fn(async (callback: (trx: MockTransaction) => Promise<unknown>) =>
                callback({ query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) })
            ),
            isReleased: jest.fn(() => false)
        }

        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        await expect(service.revokeGlobalAccess('user-1', 'admin-editor')).rejects.toThrow(
            'Only superusers can modify superuser or system-role assignments'
        )
    })

    it('keeps registered-only users outside shared workspace access even if they still retain profile visibility', async () => {
        const exec = createMockExecutor([
            [{ is_super: false }],
            [{ can_access: false }],
            [{ has_registered_role: true, has_non_registered_role: false }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        const result = await service.hasWorkspaceAccess('user-registered')

        expect(result).toBe(false)
        expect(exec.query).toHaveBeenCalledTimes(3)
    })

    it('soft-deletes role assignments when revoking access', async () => {
        const exec = createMockExecutor([
            [{ id: 'assignment-1' }],
            [{ user_id: 'user-1', role_id: 'role-1' }],
            [{ id: 'role-1', codename: 'editor', is_superuser: false, is_system: false }],
            [{ id: 'assignment-2' }]
        ])
        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        await service.revokeGlobalAccess('user-1')
        await service.revokeAssignment('assignment-2')

        const [[revokeAllSql, revokeAllParams], , , [revokeOneSql, revokeOneParams]] = exec.query.mock.calls

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

    it('replaces existing roles when legacy grant assigns superuser', async () => {
        const txQuery = jest
            .fn()
            .mockResolvedValueOnce([{ is_super: true }])
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ id: 'assignment-super' }])

        const exec = {
            query: jest
                .fn()
                .mockResolvedValueOnce([
                    {
                        id: 'role-super',
                        name: { _schema: '1', _primary: 'en', locales: {} },
                        color: '#111111',
                        is_superuser: true,
                        is_system: true
                    }
                ])
                .mockResolvedValueOnce([{ id: 'user-1', email: 'neo@example.com' }])
                .mockResolvedValueOnce([
                    {
                        user_id: 'user-1',
                        nickname: 'neo',
                        onboarding_completed: true,
                        _upl_created_at: new Date('2026-03-18T00:00:00.000Z')
                    }
                ]),
            transaction: jest.fn(async (callback: (trx: MockTransaction) => Promise<unknown>) =>
                callback({ query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) })
            ),
            isReleased: jest.fn(() => false)
        }

        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })
        const result = await service.grantRole('user-1', 'Superuser', 'admin-1', 'promoted')

        expect(result.roleCodename).toBe('Superuser')
        expect(result.roles[0]).toEqual(expect.objectContaining({ isSuperuser: true, isSystem: true }))
        expect(txQuery).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE admin.rel_user_roles'), ['user-1', 'admin-1'])
        expect(txQuery).toHaveBeenNthCalledWith(3, expect.stringContaining('INSERT INTO admin.rel_user_roles'), [
            'user-1',
            'role-super',
            'admin-1',
            'promoted'
        ])
    })

    it('blocks non-superusers from granting superuser through the legacy grant route', async () => {
        const txQuery = jest
            .fn()
            .mockResolvedValueOnce([{ is_super: false }])
            .mockResolvedValueOnce([])

        const exec = {
            query: jest.fn().mockResolvedValueOnce([
                {
                    id: 'role-super',
                    name: { _schema: '1', _primary: 'en', locales: {} },
                    color: '#111111',
                    is_superuser: true,
                    is_system: true
                }
            ]),
            transaction: jest.fn(async (callback: (trx: MockTransaction) => Promise<unknown>) =>
                callback({ query: txQuery, transaction: jest.fn(), isReleased: jest.fn(() => false) })
            ),
            isReleased: jest.fn(() => false)
        }

        const service = createGlobalAccessService({ getDbExecutor: () => exec as never })

        await expect(service.grantRole('user-1', 'Superuser', 'admin-editor', 'unauthorized')).rejects.toThrow(
            'Only superusers can modify superuser or system-role assignments'
        )
    })
})
