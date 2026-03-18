import { defineAbilitiesFor } from '@universo/types'
import { resolveShellAccess } from '../roleAccess'

describe('resolveShellAccess', () => {
    it('grants workspace access to capability-based custom roles without relying on the user codename', () => {
        const ability = defineAbilitiesFor('user-1', [{ subject: 'applications', action: 'read', conditions: {} }])

        const result = resolveShellAccess({
            globalRoles: [{ codename: 'catalog_operator' }],
            isSuperuser: false,
            ability
        })

        expect(result.hasWorkspaceAccess).toBe(true)
        expect(result.visibility.rootMenuIds).toEqual(['metapanel', 'applications', 'docs'])
        expect(result.visibility.showMetahubsSection).toBe(false)
    })

    it('shows the metahubs section for roles that can access metahubs without exposing unrelated root items', () => {
        const ability = defineAbilitiesFor('user-2', [{ subject: 'metahubs', action: 'read', conditions: {} }])

        const result = resolveShellAccess({
            globalRoles: [{ codename: 'metahub_operator' }],
            isSuperuser: false,
            ability
        })

        expect(result.hasWorkspaceAccess).toBe(true)
        expect(result.visibility.rootMenuIds).toEqual(['metapanel', 'docs'])
        expect(result.visibility.showMetahubsSection).toBe(true)
    })

    it('keeps registered-only users outside the workspace shell even if they still have profile visibility', () => {
        const ability = defineAbilitiesFor('user-3', [
            { subject: 'onboarding', action: 'read', conditions: {} },
            { subject: 'profile', action: 'read', conditions: {} }
        ])

        const result = resolveShellAccess({
            globalRoles: [{ codename: 'registered' }],
            isSuperuser: false,
            ability
        })

        expect(result.hasWorkspaceAccess).toBe(false)
        expect(result.isRegisteredOnly).toBe(true)
        expect(result.visibility.rootMenuIds).toEqual([])
    })
})
