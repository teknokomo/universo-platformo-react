import { describe, expect, it, vi } from 'vitest'

import type { GlobalUserMember, GlobalUserRoleAssignment } from '../types'
import userActions from './UserActions'

const buildLocalizedValue = (content: string) => ({
    _schema: '1',
    _primary: 'en',
    locales: {
        en: {
            content,
            version: 1,
            isActive: true,
            createdAt: '2026-03-18T00:00:00.000Z',
            updatedAt: '2026-03-18T00:00:00.000Z'
        }
    }
})

const buildRole = (): GlobalUserRoleAssignment => ({
    id: 'role-1',
    codename: 'editor',
    name: buildLocalizedValue('Editor'),
    color: '#3366FF',
    isSuperuser: false,
    isSystem: false
})

const buildMember = (): GlobalUserMember => ({
    id: 'member-1',
    userId: 'user-42',
    email: 'neo@example.com',
    nickname: 'Neo',
    roles: [buildRole()],
    roleCodename: 'editor',
    roleMetadata: null,
    comment: 'Existing note',
    grantedBy: 'admin-1',
    createdAt: '2026-03-18T00:00:00.000Z',
    registeredAt: '2026-03-18T00:00:00.000Z',
    onboardingCompleted: true
})

const translate = (key: string, params?: Record<string, unknown>) => {
    if (typeof params?.defaultValue === 'string') {
        return Object.entries(params).reduce((message, [paramKey, paramValue]) => {
            if (paramKey === 'defaultValue') {
                return message
            }

            return message.replace(`{{${paramKey}}}`, String(paramValue))
        }, params.defaultValue)
    }

    return key
}

describe('userActions', () => {
    it('routes edit dialog submissions through entity.userId and refreshes the list', async () => {
        const updateEntity = vi.fn().mockResolvedValue(undefined)
        const refreshList = vi.fn().mockResolvedValue(undefined)
        const editAction = userActions.find((descriptor) => descriptor.id === 'edit')

        const props = editAction?.dialog?.buildProps({
            entity: buildMember(),
            t: translate,
            meta: {
                roles: [buildRole()],
                loading: false,
                error: null
            },
            api: { updateEntity },
            helpers: { refreshList }
        } as Parameters<NonNullable<(typeof editAction)['dialog']>['buildProps']>[0])

        expect(props).toEqual(
            expect.objectContaining({
                initialEmail: 'neo@example.com',
                initialComment: 'Existing note',
                initialRoleIds: ['role-1']
            })
        )

        await props?.onSubmit({
            email: 'neo@example.com',
            roleIds: ['role-2'],
            comment: 'Updated by dialog'
        })

        expect(updateEntity).toHaveBeenCalledWith('user-42', {
            email: 'neo@example.com',
            roleIds: ['role-2'],
            comment: 'Updated by dialog'
        })
        expect(refreshList).toHaveBeenCalledTimes(1)
    })

    it('routes clear-roles confirmation through entity.userId and refreshes the list', async () => {
        const deleteEntity = vi.fn().mockResolvedValue(undefined)
        const refreshList = vi.fn().mockResolvedValue(undefined)
        const clearAction = userActions.find((descriptor) => descriptor.id === 'clearRoles')

        const props = clearAction?.dialog?.buildProps({
            entity: buildMember(),
            t: translate,
            api: { deleteEntity },
            helpers: { refreshList }
        } as Parameters<NonNullable<(typeof clearAction)['dialog']>['buildProps']>[0])

        expect(props?.description).toContain('neo@example.com')

        await props?.onConfirm()

        expect(deleteEntity).toHaveBeenCalledWith('user-42')
        expect(refreshList).toHaveBeenCalledTimes(1)
    })
})
