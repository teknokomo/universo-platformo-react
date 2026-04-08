import { describe, expect, it } from 'vitest'
import { shouldForceFirstAttributeDefaults, shouldLockDisplayAttributeToggle } from '../attributeDisplayRules'

describe('attributeDisplayRules', () => {
    it('forces first-attribute defaults only for local catalogs', () => {
        expect(shouldForceFirstAttributeDefaults(0)).toBe(true)
        expect(shouldForceFirstAttributeDefaults(1)).toBe(true)
        expect(shouldForceFirstAttributeDefaults(1, true)).toBe(false)
        expect(shouldForceFirstAttributeDefaults(2)).toBe(false)
    })

    it('keeps shared display-attribute toggles editable while preserving local fail-closed locks', () => {
        expect(
            shouldLockDisplayAttributeToggle({
                attributeCount: 1,
                sharedEntityMode: false,
                isCurrentDisplayAttribute: false
            })
        ).toBe(true)

        expect(
            shouldLockDisplayAttributeToggle({
                attributeCount: 2,
                sharedEntityMode: false,
                isCurrentDisplayAttribute: true
            })
        ).toBe(true)

        expect(
            shouldLockDisplayAttributeToggle({
                attributeCount: 1,
                sharedEntityMode: true,
                isCurrentDisplayAttribute: true
            })
        ).toBe(false)
    })
})
