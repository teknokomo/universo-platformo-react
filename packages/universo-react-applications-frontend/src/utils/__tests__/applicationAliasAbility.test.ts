import type { AppAbility } from '@universo-react/types'
import { describe, expect, it, vi } from 'vitest'

import { APPLICATION_ALIAS_SUBJECT, canUseApplicationAliasAbility } from '../applicationAliasAbility'

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
