import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { type ReactNode } from 'react'
import { themeAppearanceSchema, themeTokensSchema } from '@universo-react/types'
import { findFileThemePreset } from '@universo-react/theme'

import Dashboard from '../Dashboard'
import { AppMainLayoutContext } from '../../layouts/AppMainLayout'

const injectorMocks = vi.hoisted(() => ({
    appearances: [] as unknown[]
}))

// Spy on the injector so the tests assert on the appearance handed to the host
// layout instead of relying on rendered theme output.
vi.mock('../../layouts/RuntimeAppearanceInjector', () => ({
    default: ({ appearance }: { appearance: unknown }) => {
        injectorMocks.appearances.push(appearance)
        return <div data-testid='runtime-appearance-injector' />
    }
}))

// Keep the real AppMainLayoutContext (the standalone/hosted switch reads it)
// but replace the themed shell with a passthrough to keep the test light.
vi.mock('../../layouts/AppMainLayout', async () => {
    const actual = await vi.importActual<typeof import('../../layouts/AppMainLayout')>('../../layouts/AppMainLayout')
    return {
        ...actual,
        default: ({ children }: { children?: ReactNode }) => <div data-testid='app-main-layout'>{children}</div>
    }
})

vi.mock('../components/MainGrid', () => ({
    default: () => <main data-testid='dashboard-main-grid' />
}))

const preset = findFileThemePreset('universo-default')!
const appearance = themeAppearanceSchema.parse({
    mode: 'dark',
    preset: { source: 'file', id: 'universo-default', version: 1 },
    overrides: {},
    resolved: { hash: `sha256:${'a'.repeat(64)}`, tokens: themeTokensSchema.parse(preset.tokens) }
})

const renderDashboard = (layoutConfig?: Record<string, unknown>) =>
    render(<Dashboard layoutConfig={layoutConfig as never} details={{ title: 'Hosted runtime' }} />)

describe('Dashboard appearance injection', () => {
    beforeEach(() => {
        injectorMocks.appearances.length = 0
        window.localStorage.clear()
    })

    it('wraps itself in AppMainLayout and injects the persisted appearance on hosted surfaces', () => {
        renderDashboard({ appearance })

        expect(screen.getByTestId('app-main-layout')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-appearance-injector')).toBeInTheDocument()
        expect(injectorMocks.appearances).toHaveLength(1)
        expect(injectorMocks.appearances[0]).toEqual(appearance)
    })

    it('still mounts the injector with a null appearance when the layout has none', () => {
        renderDashboard({})

        expect(screen.getByTestId('app-main-layout')).toBeInTheDocument()
        expect(screen.getByTestId('runtime-appearance-injector')).toBeInTheDocument()
        expect(injectorMocks.appearances).toHaveLength(1)
        expect(injectorMocks.appearances[0]).toBeNull()
    })

    it('does not inject or re-wrap when a host AppMainLayout already exists (standalone)', () => {
        const setAppearance = vi.fn()

        render(
            <AppMainLayoutContext.Provider value={{ setAppearance }}>
                <Dashboard layoutConfig={{ appearance } as never} details={{ title: 'Standalone runtime' }} />
            </AppMainLayoutContext.Provider>
        )

        expect(screen.queryByTestId('app-main-layout')).not.toBeInTheDocument()
        expect(screen.queryByTestId('runtime-appearance-injector')).not.toBeInTheDocument()
        expect(injectorMocks.appearances).toHaveLength(0)
        expect(setAppearance).not.toHaveBeenCalled()
    })
})
