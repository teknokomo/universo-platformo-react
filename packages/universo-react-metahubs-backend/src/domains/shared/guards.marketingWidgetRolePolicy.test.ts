import { describe, expect, it } from '@jest/globals'
import { hasPermission } from './guards'
import type { MetahubRole } from './guards'

const roleMembership = (role: MetahubRole): Parameters<typeof hasPermission>[0] => ({ role } as never)
const roleCapabilities: Array<[MetahubRole, boolean, boolean, boolean, boolean]> = [
    ['owner', true, true, true, true],
    ['admin', true, true, true, true],
    ['editor', false, true, true, false],
    ['member', false, false, false, false]
]

describe('Marketing widget authoring role policy', () => {
    it.each(roleCapabilities)('%s receives only its metahub capabilities', (role, manage, create, edit, remove) => {
        const membership = roleMembership(role)

        expect(hasPermission(membership, 'manageMetahub')).toBe(manage)
        expect(hasPermission(membership, 'createContent')).toBe(create)
        expect(hasPermission(membership, 'editContent')).toBe(edit)
        expect(hasPermission(membership, 'deleteContent')).toBe(remove)
    })
})
