import { describe, expect, it } from 'vitest'

import { ABILITY_MODULE_TO_SUBJECT, PERMISSION_SUBJECTS, ROLE_MENU_VISIBILITY, defineAbilitiesFor } from '../index'

describe('shared ability and admin contracts', () => {
    it('maps new onboarding and product modules to canonical CASL subjects', () => {
        expect(ABILITY_MODULE_TO_SUBJECT.applications).toBe('Application')
        expect(ABILITY_MODULE_TO_SUBJECT.metahubs).toBe('Metahub')
        expect(ABILITY_MODULE_TO_SUBJECT.profile).toBe('Profile')
        expect(ABILITY_MODULE_TO_SUBJECT.onboarding).toBe('Onboarding')
    })

    it('builds abilities for the new shared subject map', () => {
        const ability = defineAbilitiesFor('user-1', [
            { subject: 'applications', action: 'read', conditions: {} },
            { subject: 'onboarding', action: 'read', conditions: {} }
        ])

        expect(ability.can('read', 'Application')).toBe(true)
        expect(ability.can('read', 'Onboarding')).toBe(true)
        expect(ability.can('read', 'Metahub')).toBe(false)
    })

    it('exposes permission subjects and menu visibility for registered and user roles', () => {
        expect(PERMISSION_SUBJECTS).toEqual(expect.arrayContaining(['applications', 'metahubs', 'profile', 'onboarding']))
        expect(ROLE_MENU_VISIBILITY.Registered.rootMenuIds).toEqual([])
        expect(ROLE_MENU_VISIBILITY.User.rootMenuIds).toContain('metapanel')
    })
})
