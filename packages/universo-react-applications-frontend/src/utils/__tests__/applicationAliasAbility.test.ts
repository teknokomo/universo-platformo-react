import type { AppAbility } from '@universo-react/types'
import { describe, expect, it, vi } from 'vitest'

import {
    APPLICATION_ALIAS_SUBJECT,
    canUseApplicationAliasAbility,
    resolveApplicationAliasPageAccess,
    type ApplicationAliasPageCapabilities
} from '../applicationAliasAbility'

const createAbility = (allowed: ReadonlySet<string>): AppAbility =>
    ({
        can: vi.fn((action: string, subject: string) => allowed.has(`${action}:${subject}`))
    } as unknown as AppAbility)

describe('application alias ability helper', () => {
    it('uses the ApplicationAlias capability instead of application ownership or role names', () => {
        const readOnly = createAbility(new Set([`read:${APPLICATION_ALIAS_SUBJECT}`]))

        expect(canUseApplicationAliasAbility(readOnly, false, 'read')).toBe(true)
        expect(canUseApplicationAliasAbility(readOnly, false, 'update')).toBe(false)
    })

    it('honors manage and superuser capability bypasses', () => {
        const manager = createAbility(new Set([`manage:${APPLICATION_ALIAS_SUBJECT}`]))

        expect(canUseApplicationAliasAbility(manager, false, 'create')).toBe(true)
        expect(canUseApplicationAliasAbility(manager, false, 'delete')).toBe(true)
        expect(canUseApplicationAliasAbility(undefined, true, 'update')).toBe(true)
        expect(canUseApplicationAliasAbility(undefined, false, 'read')).toBe(false)
    })
})

describe('application alias page access', () => {
    const capabilities = (granted: Partial<ApplicationAliasPageCapabilities>): ApplicationAliasPageCapabilities => ({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
        ...granted
    })

    it('renders the full page only when the alias registry is readable', () => {
        expect(resolveApplicationAliasPageAccess(capabilities({ canRead: true }))).toBe('full')
        expect(resolveApplicationAliasPageAccess(capabilities({ canRead: true, canCreate: true }))).toBe('full')
    })

    it('keeps the page reachable for independently granted alias actions without read', () => {
        expect(resolveApplicationAliasPageAccess(capabilities({ canCreate: true }))).toBe('read-required')
        expect(resolveApplicationAliasPageAccess(capabilities({ canUpdate: true }))).toBe('read-required')
        expect(resolveApplicationAliasPageAccess(capabilities({ canDelete: true }))).toBe('read-required')
    })

    it('denies the page only when no alias capability is held', () => {
        expect(resolveApplicationAliasPageAccess(capabilities({}))).toBe('denied')
    })
})
