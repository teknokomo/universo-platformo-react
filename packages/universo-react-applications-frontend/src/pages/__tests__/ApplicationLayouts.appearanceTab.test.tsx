import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const flagHookMocks = vi.hoisted(() => ({ useThemePresetsFlag: vi.fn() }))
vi.mock('../../hooks/useThemePresetsFlag', () => flagHookMocks)

import { apiMocks, initializeApplicationLayouts, renderPage, resetApplicationLayoutsMocks } from './ApplicationLayouts.test-support'

const flagResult = (data: boolean | undefined) => ({
    data,
    isLoading: data === undefined,
    isError: false,
    refetch: vi.fn()
})

describe('ApplicationLayouts appearance tab gating', () => {
    beforeAll(initializeApplicationLayouts, 30_000)
    beforeEach(() => {
        resetApplicationLayoutsMocks()
        // Default mock state: the feature flag is confirmed enabled.
        flagHookMocks.useThemePresetsFlag.mockReturnValue(flagResult(true))
    })

    it('shows the Theme tab and mounts the appearance section when the feature flag is enabled', async () => {
        const user = userEvent.setup()
        apiMocks.listApplicationThemePresets.mockResolvedValue({ file: [], presets: [] })
        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        expect(screen.getByRole('tab', { name: 'Theme' })).toBeInTheDocument()

        await user.click(screen.getByRole('tab', { name: 'Theme' }))

        // Appearance tab: the appearance section replaces zone authoring and runs its preset query.
        expect(await screen.findByTestId('application-appearance-section')).toBeInTheDocument()
        expect(screen.queryByTestId('layout-authoring-details')).not.toBeInTheDocument()
        expect(apiMocks.listApplicationThemePresets).toHaveBeenCalled()
    })

    it('hides the Theme tab and skips the appearance section while the flag is unresolved', async () => {
        flagHookMocks.useThemePresetsFlag.mockReturnValue(flagResult(undefined))
        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        expect(screen.queryByRole('tab', { name: 'Theme' })).not.toBeInTheDocument()
        expect(screen.getByTestId('layout-authoring-details')).toBeInTheDocument()
        expect(apiMocks.listApplicationThemePresets).not.toHaveBeenCalled()
    })

    it('hides the Theme tab and keeps main authoring when the feature flag is disabled', async () => {
        flagHookMocks.useThemePresetsFlag.mockReturnValue(flagResult(false))
        renderPage()

        await waitFor(() => expect(screen.getByText('Homepage')).toBeInTheDocument())
        expect(screen.queryByRole('tab', { name: 'Theme' })).not.toBeInTheDocument()
        expect(screen.getByRole('tab', { name: 'Main' })).toBeInTheDocument()
        expect(screen.getByTestId('layout-authoring-details')).toBeInTheDocument()
        expect(apiMocks.listApplicationThemePresets).not.toHaveBeenCalled()
    })
})
