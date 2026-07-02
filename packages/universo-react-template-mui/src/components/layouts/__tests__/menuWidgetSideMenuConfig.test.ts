import { normalizeSideMenuConfig } from '../menuWidgetSideMenuConfig'

describe('normalizeSideMenuConfig', () => {
    it('falls back from malformed imported values', () => {
        const normalized = normalizeSideMenuConfig({
            availableModes: ['wide', 'wide', 'invalid'],
            primaryMode: 'invalid',
            rememberUserChoice: 'false'
        } as never)

        expect(normalized).toEqual({
            availableModes: ['wide'],
            primaryMode: 'wide',
            rememberUserChoice: true
        })
    })

    it('preserves explicit boolean remember user choice', () => {
        expect(normalizeSideMenuConfig({ rememberUserChoice: false }).rememberUserChoice).toBe(false)
    })
})
