jest.mock('@universo/admin-backend', () => ({
    __esModule: true,
    isSuperuser: jest.fn(async () => false),
    getGlobalRoleCodename: jest.fn(async () => null),
    hasSubjectPermission: jest.fn(async () => false)
}))

import { resolveEffectiveRoleCapabilities, resolveEffectiveRolePermissions } from '../../routes/guards'

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

    it('exposes exact workflow capabilities from supported application and workspace role-policy scopes only', () => {
        const capabilities = resolveEffectiveRoleCapabilities('member', {
            rolePolicies: {
                templates: [
                    {
                        codename: 'memberPolicy',
                        title: { en: 'Member permissions' },
                        rules: [
                            { capability: 'records.edit', effect: 'allow', scope: 'workspace' },
                            { capability: 'assignment.review', effect: 'allow', scope: 'workspace' },
                            { capability: 'certificate.issue', effect: 'allow', scope: 'application' },
                            { capability: 'department:assignment.review', effect: 'allow', scope: 'department' }
                        ]
                    }
                ]
            }
        })

        expect(capabilities).toMatchObject({
            editContent: true,
            'records.edit': true,
            'assignment.review': true,
            'certificate.issue': true
        })
        expect(capabilities['workflow.execute']).toBeUndefined()
        expect((capabilities as Record<string, boolean>)['department:assignment.review']).toBeUndefined()
    })

    it('allows exact workflow capabilities without granting broad edit content permission', () => {
        const settings = {
            rolePolicies: {
                templates: [
                    {
                        codename: 'memberPolicy',
                        title: { en: 'Member permissions' },
                        rules: [{ capability: 'assignment.review', effect: 'allow', scope: 'workspace' }]
                    }
                ]
            }
        }

        expect(resolveEffectiveRolePermissions('member', settings)).toMatchObject({ editContent: false })
        expect(resolveEffectiveRoleCapabilities('member', settings)).toMatchObject({
            editContent: false,
            'records.edit': false,
            'assignment.review': true
        })
        expect(resolveEffectiveRoleCapabilities('member', settings)['workflow.execute']).toBeUndefined()
    })

    it('lets deny role-policy rules revoke exact workflow capabilities', () => {
        const capabilities = resolveEffectiveRoleCapabilities('editor', {
            rolePolicies: {
                templates: [
                    {
                        codename: 'editorPolicy',
                        title: { en: 'Editor permissions' },
                        rules: [
                            { capability: 'workflow.execute', effect: 'deny', scope: 'workspace' },
                            { capability: 'records.edit', effect: 'deny', scope: 'workspace' },
                            { capability: 'assignment.review', effect: 'deny', scope: 'workspace' }
                        ]
                    }
                ]
            }
        })

        expect(capabilities).toMatchObject({
            editContent: false,
            'records.edit': false,
            'workflow.execute': false,
            'assignment.review': false
        })
    })
})
