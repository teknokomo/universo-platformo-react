import { CreateRoleSchema, UpdateRoleSchema } from '../../schemas'
import { createCodenameVLC } from '@universo-react/utils'

const baseRole = {
    codename: createCodenameVLC('en', 'AliasManager'),
    name: createCodenameVLC('en', 'Alias Manager'),
    color: '#336699',
    isSuperuser: false
}

describe('applicationAliases permission validation', () => {
    it('accepts ordinary application alias CRUD permissions', () => {
        const result = CreateRoleSchema.safeParse({
            ...baseRole,
            permissions: [{ subject: 'applicationAliases', action: 'read', conditions: {}, fields: [] }]
        })

        expect(result.success).toBe(true)
    })

    it.each([
        { permissions: [{ subject: 'applicationAliases', action: 'read', conditions: { owner: true } }] },
        { permissions: [{ subject: 'applicationAliases', action: 'read', fields: ['applicationId'] }] },
        { permissions: [{ subject: '*', action: '*', conditions: { owner: true } }] }
    ])('rejects alias-affecting restricted permission rules: $permissions', ({ permissions }) => {
        const result = UpdateRoleSchema.safeParse({ permissions })
        expect(result.success).toBe(false)
    })
})
