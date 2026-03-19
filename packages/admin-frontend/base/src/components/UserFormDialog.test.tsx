import { describe, expect, it } from 'vitest'

import { validateUserFormDialog } from './UserFormDialog'

const translate = (key: string, fallback: string) => fallback || key

describe('validateUserFormDialog', () => {
    it('routes missing-role create validation to the roles tab', () => {
        const result = validateUserFormDialog({
            mode: 'create',
            email: 'neo@example.com',
            initialEmail: '',
            password: '',
            comment: '',
            selectedRoleIds: [],
            t: translate
        })

        expect(result).toEqual({
            ok: false,
            error: 'Select at least one role',
            nextTab: 'roles'
        })
    })

    it('keeps short-password validation on the main tab', () => {
        const result = validateUserFormDialog({
            mode: 'create',
            email: 'neo@example.com',
            initialEmail: '',
            password: 'short',
            comment: '',
            selectedRoleIds: ['role-1'],
            t: translate
        })

        expect(result).toEqual({
            ok: false,
            error: 'Password must contain at least 8 characters',
            nextTab: 'main'
        })
    })

    it('trims create-mode values and returns a submit payload', () => {
        const result = validateUserFormDialog({
            mode: 'create',
            email: ' neo@example.com ',
            initialEmail: '',
            password: 'password123',
            comment: ' Provisioned from test ',
            selectedRoleIds: ['role-1'],
            t: translate
        })

        expect(result).toEqual({
            ok: true,
            data: {
                email: 'neo@example.com',
                password: 'password123',
                roleIds: ['role-1'],
                comment: 'Provisioned from test'
            }
        })
    })

    it('preserves the initial email for edit-mode submissions when the field stays blank', () => {
        const result = validateUserFormDialog({
            mode: 'edit',
            email: '   ',
            initialEmail: 'neo@example.com',
            password: '',
            comment: ' Updated note ',
            selectedRoleIds: ['role-1', 'role-2'],
            t: translate
        })

        expect(result).toEqual({
            ok: true,
            data: {
                email: 'neo@example.com',
                password: undefined,
                roleIds: ['role-1', 'role-2'],
                comment: 'Updated note'
            }
        })
    })
})
