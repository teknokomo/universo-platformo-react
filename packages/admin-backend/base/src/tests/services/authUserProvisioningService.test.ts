const mockGetOrCreateProfile = jest.fn()

jest.mock('@universo/profile-backend', () => ({
    ProfileService: jest.fn().mockImplementation(() => ({
        getOrCreateProfile: mockGetOrCreateProfile
    }))
}))

import { createAuthUserProvisioningService } from '../../services/authUserProvisioningService'

const createMockExecutor = () => ({
    query: jest.fn(),
    transaction: jest.fn(),
    isReleased: jest.fn(() => false)
})

describe('createAuthUserProvisioningService', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetOrCreateProfile.mockResolvedValue({ id: 'profile-1' })
    })

    it('creates a real auth user, repairs the profile, and assigns roles', async () => {
        const executor = createMockExecutor()
        const globalAccessService = {
            findUserIdByEmail: jest.fn(),
            getGlobalAccessInfo: jest.fn(),
            setUserRoles: jest
                .fn()
                .mockResolvedValue([
                    { id: 'role-1', codename: 'editor', isSuperuser: false, isSystem: false, name: null, color: '#111111' }
                ])
        }
        const supabaseAdmin = {
            auth: {
                admin: {
                    createUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'user-1', email: 'Neo@Example.com' } },
                        error: null
                    }),
                    deleteUser: jest.fn()
                }
            }
        }

        const service = createAuthUserProvisioningService({
            getDbExecutor: () => executor as never,
            globalAccessService: globalAccessService as never,
            supabaseAdmin: supabaseAdmin as never
        })

        const result = await service.provisionAuthUserWithRoleIds({
            email: ' Neo@Example.com ',
            password: 'ChangeMe_123456!',
            roleIds: ['role-1'],
            grantedBy: 'admin-1',
            comment: 'created from admin panel'
        })

        expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith({
            email: 'neo@example.com',
            password: 'ChangeMe_123456!',
            email_confirm: true
        })
        expect(mockGetOrCreateProfile).toHaveBeenCalledWith('user-1', 'neo@example.com')
        expect(globalAccessService.setUserRoles).toHaveBeenCalledWith('user-1', ['role-1'], 'admin-1', 'created from admin panel')
        expect(result).toEqual(
            expect.objectContaining({
                userId: 'user-1',
                email: 'Neo@Example.com',
                createdAuthUser: true,
                profileEnsured: true
            })
        )
    })

    it('invites a user by email when no password is provided and still repairs profile and roles', async () => {
        const executor = createMockExecutor()
        const globalAccessService = {
            findUserIdByEmail: jest.fn(),
            getGlobalAccessInfo: jest.fn(),
            setUserRoles: jest
                .fn()
                .mockResolvedValue([
                    { id: 'role-1', codename: 'editor', isSuperuser: false, isSystem: false, name: null, color: '#111111' }
                ])
        }
        const supabaseAdmin = {
            auth: {
                admin: {
                    createUser: jest.fn(),
                    inviteUserByEmail: jest.fn().mockResolvedValue({
                        data: { user: { id: 'user-invite', email: 'invitee@example.com' } },
                        error: null
                    }),
                    deleteUser: jest.fn()
                }
            }
        }

        const service = createAuthUserProvisioningService({
            getDbExecutor: () => executor as never,
            globalAccessService: globalAccessService as never,
            supabaseAdmin: supabaseAdmin as never
        })

        const result = await service.provisionAuthUserWithRoleIds({
            email: ' Invitee@Example.com ',
            roleIds: ['role-1'],
            grantedBy: 'admin-1',
            comment: 'invited from admin panel'
        })

        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
        expect(supabaseAdmin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('invitee@example.com')
        expect(mockGetOrCreateProfile).toHaveBeenCalledWith('user-invite', 'invitee@example.com')
        expect(globalAccessService.setUserRoles).toHaveBeenCalledWith('user-invite', ['role-1'], 'admin-1', 'invited from admin panel')
        expect(result).toEqual(
            expect.objectContaining({
                userId: 'user-invite',
                email: 'invitee@example.com',
                createdAuthUser: true,
                profileEnsured: true
            })
        )
    })

    it('rolls back the new auth user when role synchronization fails', async () => {
        const executor = createMockExecutor()
        executor.query.mockResolvedValue([])

        const globalAccessService = {
            findUserIdByEmail: jest.fn(),
            getGlobalAccessInfo: jest.fn(),
            setUserRoles: jest.fn().mockRejectedValue(new Error('role sync failed'))
        }
        const deleteUser = jest.fn().mockResolvedValue({ data: { user: null }, error: null })
        const supabaseAdmin = {
            auth: {
                admin: {
                    createUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'user-1', email: 'neo@example.com' } },
                        error: null
                    }),
                    deleteUser
                }
            }
        }

        const service = createAuthUserProvisioningService({
            getDbExecutor: () => executor as never,
            globalAccessService: globalAccessService as never,
            supabaseAdmin: supabaseAdmin as never
        })

        await expect(
            service.provisionAuthUserWithRoleIds({
                email: 'neo@example.com',
                password: 'ChangeMe_123456!',
                roleIds: ['role-1'],
                grantedBy: 'admin-1'
            })
        ).rejects.toThrow('Failed to assign roles to the newly created user. Newly created auth account was rolled back.')

        expect(executor.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE profiles.cat_profiles'), ['user-1', null])
        expect(deleteUser).toHaveBeenCalledWith('user-1')
    })

    it('returns noop for an existing bootstrap superuser and ensures the profile exists', async () => {
        const executor = createMockExecutor()
        const globalAccessService = {
            findUserIdByEmail: jest.fn().mockResolvedValue('user-existing'),
            getGlobalAccessInfo: jest.fn().mockResolvedValue({
                isSuperuser: true,
                canAccessAdmin: true,
                globalRoles: []
            }),
            setUserRoles: jest.fn()
        }
        const supabaseAdmin = {
            auth: {
                admin: {
                    createUser: jest.fn(),
                    deleteUser: jest.fn()
                }
            }
        }

        const service = createAuthUserProvisioningService({
            getDbExecutor: () => executor as never,
            globalAccessService: globalAccessService as never,
            supabaseAdmin: supabaseAdmin as never
        })

        const result = await service.ensureBootstrapSuperuser({
            email: 'root@example.com',
            password: 'ChangeMe_123456!'
        })

        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
        expect(mockGetOrCreateProfile).toHaveBeenCalledWith('user-existing', 'root@example.com')
        expect(result).toEqual({
            userId: 'user-existing',
            email: 'root@example.com',
            createdAuthUser: false,
            profileEnsured: true,
            status: 'noop_existing_superuser'
        })
    })

    it('refuses bootstrap privilege escalation for an existing non-superuser account', async () => {
        const executor = createMockExecutor()
        const globalAccessService = {
            findUserIdByEmail: jest.fn().mockResolvedValue('user-existing'),
            getGlobalAccessInfo: jest.fn().mockResolvedValue({
                isSuperuser: false,
                canAccessAdmin: false,
                globalRoles: []
            }),
            setUserRoles: jest.fn()
        }
        const supabaseAdmin = {
            auth: {
                admin: {
                    createUser: jest.fn(),
                    deleteUser: jest.fn()
                }
            }
        }

        const service = createAuthUserProvisioningService({
            getDbExecutor: () => executor as never,
            globalAccessService: globalAccessService as never,
            supabaseAdmin: supabaseAdmin as never
        })

        await expect(
            service.ensureBootstrapSuperuser({
                email: 'root@example.com',
                password: 'ChangeMe_123456!'
            })
        ).rejects.toThrow('Refusing automatic privilege escalation.')

        expect(supabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled()
        expect(mockGetOrCreateProfile).not.toHaveBeenCalled()
    })

    it('creates a new bootstrap superuser with exclusive role synchronization', async () => {
        const executor = createMockExecutor()
        executor.query.mockResolvedValue([{ id: 'role-super', codename: 'Superuser' }])

        const globalAccessService = {
            findUserIdByEmail: jest.fn().mockResolvedValue(null),
            getGlobalAccessInfo: jest.fn(),
            setUserRoles: jest.fn().mockResolvedValue([
                {
                    id: 'role-super',
                    codename: 'Superuser',
                    isSuperuser: true,
                    isSystem: true,
                    name: null,
                    color: '#111111'
                }
            ])
        }
        const supabaseAdmin = {
            auth: {
                admin: {
                    createUser: jest.fn().mockResolvedValue({
                        data: { user: { id: 'user-created', email: 'root@example.com' } },
                        error: null
                    }),
                    deleteUser: jest.fn()
                }
            }
        }

        const service = createAuthUserProvisioningService({
            getDbExecutor: () => executor as never,
            globalAccessService: globalAccessService as never,
            supabaseAdmin: supabaseAdmin as never
        })

        const result = await service.ensureBootstrapSuperuser({
            email: 'root@example.com',
            password: 'ChangeMe_123456!'
        })

        expect(executor.query).toHaveBeenCalledWith(
            expect.stringContaining(
                "COALESCE(codename->'locales'->(codename->>'_primary')->>'content', codename->'locales'->'en'->>'content', '') = ANY($1::text[])"
            ),
            [['Superuser']]
        )
        expect(globalAccessService.setUserRoles).toHaveBeenCalledWith('user-created', ['role-super'], null, 'startup bootstrap superuser')
        expect(result).toEqual({
            userId: 'user-created',
            email: 'root@example.com',
            createdAuthUser: true,
            profileEnsured: true,
            status: 'created'
        })
    })
})
