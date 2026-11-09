import { describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { render, waitFor } from '@testing-library/react'
import { themeAppearanceSchema, themeTokensSchema } from '@universo-react/types'
import { findFileThemePreset } from '@universo-react/theme'
import { themeTokensToMuiInput } from '@universo-react/theme'

import { AppMainLayoutContext, type AppMainLayoutAppearance } from '../AppMainLayout'
import RuntimeAppearanceInjector from '../RuntimeAppearanceInjector'

const preset = findFileThemePreset('universo-default')!
const appearance = themeAppearanceSchema.parse({
    mode: 'dark',
    preset: { source: 'file', id: 'universo-default', version: 1 },
    overrides: {},
    resolved: { hash: `sha256:${'a'.repeat(64)}`, tokens: themeTokensSchema.parse(preset.tokens) }
})

describe('RuntimeAppearanceInjector', () => {
    it('injects the resolved hash and adapter input into the host layout', async () => {
        const setAppearance = vi.fn((_: AppMainLayoutAppearance | null) => {})
        render(
            <AppMainLayoutContext.Provider value={{ setAppearance }}>
                <RuntimeAppearanceInjector appearance={appearance} />
            </AppMainLayoutContext.Provider>
        )

        await waitFor(() => expect(setAppearance).toHaveBeenCalled())
        const injected = setAppearance.mock.calls[0][0] as AppMainLayoutAppearance
        expect(injected?.mode).toBe('dark')
        expect(injected?.resolvedTokens?.hash).toBe(appearance.resolved.hash)
        expect(injected?.resolvedTokens?.input.palettePerScheme.dark.primary.main).toBe(
            themeTokensToMuiInput(appearance.resolved.tokens).palettePerScheme.dark.primary.main
        )
    })

    it('clears the injected appearance on unmount', () => {
        const setAppearance = vi.fn((_: AppMainLayoutAppearance | null) => {})
        const { unmount } = render(
            <AppMainLayoutContext.Provider value={{ setAppearance }}>
                <RuntimeAppearanceInjector appearance={appearance} />
            </AppMainLayoutContext.Provider>
        )
        unmount()
        expect(setAppearance).toHaveBeenLastCalledWith(null)
    })

    it('does nothing without a host layout', () => {
        const setAppearance = vi.fn((_: AppMainLayoutAppearance | null) => {})
        render(<RuntimeAppearanceInjector appearance={null} />)
        expect(setAppearance).not.toHaveBeenCalled()
    })
})
