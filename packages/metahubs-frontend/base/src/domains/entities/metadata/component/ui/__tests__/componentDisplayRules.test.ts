import { describe, expect, it } from 'vitest'
import { shouldForceFirstComponentDefaults, shouldLockDisplayComponentToggle } from '../componentDisplayRules'

describe('componentDisplayRules', () => {
    it('forces first-component defaults only for local objectCollections', () => {
        expect(shouldForceFirstComponentDefaults(0)).toBe(true)
        expect(shouldForceFirstComponentDefaults(1)).toBe(true)
        expect(shouldForceFirstComponentDefaults(1, true)).toBe(false)
        expect(shouldForceFirstComponentDefaults(2)).toBe(false)
    })

    it('keeps shared display-component toggles editable while preserving local fail-closed locks', () => {
        expect(
            shouldLockDisplayComponentToggle({
                componentCount: 1,
                sharedEntityMode: false,
                isCurrentDisplayComponent: false
            })
        ).toBe(true)

        expect(
            shouldLockDisplayComponentToggle({
                componentCount: 2,
                sharedEntityMode: false,
                isCurrentDisplayComponent: true
            })
        ).toBe(true)

        expect(
            shouldLockDisplayComponentToggle({
                componentCount: 1,
                sharedEntityMode: true,
                isCurrentDisplayComponent: true
            })
        ).toBe(false)
    })
})
