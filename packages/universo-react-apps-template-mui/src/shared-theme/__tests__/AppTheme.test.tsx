import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createTheme } from '@mui/material/styles'
import { themeTokensSchema } from '@universo-react/types'
import { findFileThemePreset, themeTokensToMuiInput } from '@universo-react/theme'

import AppTheme from '../AppTheme'

const setModeMock = vi.hoisted(() => vi.fn())

vi.mock('@mui/material/styles', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@mui/material/styles')>()
    return {
        ...actual,
        // Spy wrapper: keeps real theme construction but records every call so
        // the tests can assert AppTheme's memoization contract.
        createTheme: vi.fn((...args: Parameters<typeof actual.createTheme>) => actual.createTheme(...args)),
        // The runtime-mode synchronizer is driven through this seam; the real
        // hook needs the full provider scheme the tests do not exercise.
        useColorScheme: (() => ({
            setMode: setModeMock,
            mode: 'light',
            systemMode: 'light',
            colorScheme: 'light',
            toggleColorMode: vi.fn(),
            setColorScheme: vi.fn()
        })) as unknown as typeof actual.useColorScheme
    }
})

const defaultPreset = findFileThemePreset('universo-default')!
const defaultTokens = themeTokensSchema.parse(defaultPreset.tokens)

/** A NEW object identity per call, with the caller-controlled canonical hash. */
const buildResolvedTokens = (hash: string) => ({ hash, input: themeTokensToMuiInput(defaultTokens) })

const renderAppTheme = (
    resolvedTokens?: { hash: string; input: ReturnType<typeof themeTokensToMuiInput> },
    runtimeMode?: 'light' | 'dark'
) =>
    render(
        <AppTheme defaultMode='light' resolvedTokens={resolvedTokens} runtimeMode={runtimeMode}>
            <div>content</div>
        </AppTheme>
    )

describe('AppTheme', () => {
    beforeEach(() => {
        // themePrimitives builds a baseline theme at import time; clear it so
        // every test counts only its own createTheme calls.
        vi.mocked(createTheme).mockClear()
        setModeMock.mockClear()
        window.localStorage.clear()
    })

    it('rebuilds the MUI theme only when the resolved token hash changes', () => {
        const hash = `sha256:${'a'.repeat(64)}`
        const { rerender } = renderAppTheme(buildResolvedTokens(hash))
        expect(vi.mocked(createTheme)).toHaveBeenCalledTimes(1)

        // A re-resolved snapshot with the same canonical hash but a new object
        // identity must not trigger another createTheme pass (brief goal:
        // rebuild only on hash change).
        rerender(
            <AppTheme defaultMode='light' resolvedTokens={buildResolvedTokens(hash)}>
                <div>content</div>
            </AppTheme>
        )
        expect(vi.mocked(createTheme)).toHaveBeenCalledTimes(1)

        rerender(
            <AppTheme defaultMode='light' resolvedTokens={buildResolvedTokens(`sha256:${'b'.repeat(64)}`)}>
                <div>content</div>
            </AppTheme>
        )
        expect(vi.mocked(createTheme)).toHaveBeenCalledTimes(2)
    })

    it('applies the token font weights to the MUI typography defaults', () => {
        renderAppTheme(buildResolvedTokens(`sha256:${'c'.repeat(64)}`))
        expect(vi.mocked(createTheme)).toHaveBeenCalledTimes(1)

        // The adapter's fontWeight passthrough must reach MUI's top-level
        // typography keys (previously `shared.typography.weights` was dropped).
        const typographyArg = vi.mocked(createTheme).mock.calls[0][0]?.typography as Record<string, unknown>
        expect(typographyArg.fontWeightRegular).toBe(400)
        expect(typographyArg.fontWeightMedium).toBe(500)
        expect(typographyArg.fontWeightBold).toBe(700)
    })

    it('applies the runtime mode when no explicit user choice is persisted', () => {
        renderAppTheme(undefined, 'dark')
        expect(setModeMock).toHaveBeenCalledWith('dark')
    })

    it('steps aside when the user already has an explicit persisted mode', () => {
        window.localStorage.setItem('mui-mode', 'dark')
        renderAppTheme(undefined, 'dark')
        expect(setModeMock).not.toHaveBeenCalled()
    })
})
