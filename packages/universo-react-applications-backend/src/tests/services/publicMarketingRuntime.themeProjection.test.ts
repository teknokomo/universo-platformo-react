import { findFileThemePreset } from '@universo-react/theme'

import { toPublicMarketingConfig } from '../../services/publicMarketingRuntime'

const preset = findFileThemePreset('universo-default')
const appearance = {
    mode: 'dark' as const,
    preset: { source: 'file' as const, id: preset!.id, version: 1 },
    overrides: {},
    resolved: { hash: `sha256:${'a'.repeat(64)}`, tokens: preset!.tokens }
}


describe('toPublicMarketingConfig', () => {
    it('projects the stored appearance to { mode, resolved } without preset/overrides', () => {
        const config = toPublicMarketingConfig({
            allowEmailActions: false,
            allowTelephoneActions: true,
            externalLinkTarget: 'same-tab',
            appearance
        })
        expect(config.appearance).toEqual({ mode: 'dark', resolved: appearance.resolved })
        expect(config.appearance).not.toHaveProperty('preset')
        expect(config.appearance).not.toHaveProperty('overrides')
        expect(config.allowEmailActions).toBe(false)
    })

    it('backfills the universo-default resolved snapshot when appearance is absent', () => {
        const config = toPublicMarketingConfig({})
        expect(config.appearance?.mode).toBe('system')
        expect(config.appearance?.resolved.hash).toMatch(/^sha256:[0-9a-f]{64}$/)
        expect(config.appearance?.resolved.tokens.shared.shape.borderRadius).toBe(8)
    })

    it('applies the themeVariant viewer override to the effective mode', () => {
        const config = toPublicMarketingConfig({ appearance }, 'light')
        expect(config.appearance?.mode).toBe('light')
        expect(config.appearance?.resolved).toEqual(appearance.resolved)
        expect(config.appearance).not.toHaveProperty('preset')
    })

    it('rejects an appearance with an invalid resolved hash (fail closed)', () => {
        expect(() =>
            toPublicMarketingConfig({
                allowEmailActions: true,
                allowTelephoneActions: true,
                externalLinkTarget: 'new-tab',
                appearance: { ...appearance, resolved: { ...appearance.resolved, hash: 'not-a-hash' } }
            })
        ).toThrow()
    })
})
