import { describe, expect, it } from 'vitest'
import { applyObjectRuntimeNavigationConfig, getObjectRuntimeNavigationValues } from '../entityInstanceListHelpers'

describe('Object runtime navigation form values', () => {
    it('hydrates visibility and a supported semantic icon from Object config', () => {
        expect(getObjectRuntimeNavigationValues({ runtime: { menuVisibility: 'primary', icon: 'analytics' } })).toEqual({
            runtimeMenuVisible: true,
            runtimeMenuIcon: 'analytics'
        })
        expect(getObjectRuntimeNavigationValues({ runtime: { menuVisibility: 'primary', icon: 'unrecognized' } })).toEqual({
            runtimeMenuVisible: true,
            runtimeMenuIcon: 'apps'
        })
    })

    it('merges navigation into runtime config and persists explicit hidden state when disabled', () => {
        const config = { sortOrder: 7, runtime: { theme: 'dark', menuVisibility: 'primary', icon: 'apps' } }
        expect(applyObjectRuntimeNavigationConfig(config, true, 'analytics')).toEqual({
            sortOrder: 7,
            runtime: { theme: 'dark', menuVisibility: 'primary', icon: 'analytics' }
        })
        expect(applyObjectRuntimeNavigationConfig(config, false, 'analytics')).toEqual({
            sortOrder: 7,
            runtime: { theme: 'dark', menuVisibility: 'hidden' }
        })
        expect(applyObjectRuntimeNavigationConfig({ runtime: { menuVisibility: 'primary', icon: 'apps' } }, false, 'apps')).toEqual({
            runtime: { menuVisibility: 'hidden' }
        })
    })
})
