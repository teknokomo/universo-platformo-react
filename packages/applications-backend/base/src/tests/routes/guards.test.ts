jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import { resolveEffectiveRolePermissions } from '../../routes/guards'

describe('application access guards', () => {
    it('resolves default application permissions for existing roles', () => {
        expect(resolveEffectiveRolePermissions('member')).toMatchObject({
            manageMembers: false,
            manageApplication: false,
            createContent: false,
            editContent: false,
            deleteContent: false,
            readReports: false
        })

        expect(resolveEffectiveRolePermissions('editor')).toMatchObject({
            createContent: true,
            editContent: true,
            readReports: true
        })
    })

    it('applies generic role-policy capability rules from application settings', () => {
        const permissions = resolveEffectiveRolePermissions('member', {
            rolePolicies: {
                templates: [
                    {
                        codename: 'learner',
                        title: { en: 'Learner' },
                        baseRole: 'member',
                        rules: [
                            { capability: 'reports.read', effect: 'allow', scope: 'workspace' },
                            { capability: 'records.create', effect: 'allow', scope: 'workspace' },
                            { capability: 'content.delete', effect: 'deny', scope: 'workspace' }
                        ]
                    }
                ]
            }
        })

        expect(permissions).toMatchObject({
            createContent: true,
            deleteContent: false,
            readReports: true
        })
    })

    it('applies managed role-policy codenames even when baseRole is omitted', () => {
        const permissions = resolveEffectiveRolePermissions('member', {
            rolePolicies: {
                templates: [
                    {
                        codename: 'memberPolicy',
                        title: { en: 'Member permissions' },
                        rules: [{ capability: 'reports.read', effect: 'allow', scope: 'workspace' }]
                    }
                ]
            }
        })

        expect(permissions).toMatchObject({ readReports: true })
    })

    it('ignores invalid role-policy payloads and unsupported scoped rules', () => {
        expect(
            resolveEffectiveRolePermissions('member', {
                rolePolicies: {
                    templates: [{ codename: '', title: '', rules: [] }]
                }
            })
        ).toMatchObject({ createContent: false, readReports: false })

        expect(
            resolveEffectiveRolePermissions('member', {
                rolePolicies: {
                    templates: [
                        {
                            codename: 'department-reporter',
                            title: { en: 'Department reporter' },
                            baseRole: 'member',
                            rules: [{ capability: 'reports.read', effect: 'allow', scope: 'department' }]
                        }
                    ]
                }
            })
        ).toMatchObject({ readReports: false })
    })
})
