import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TFunction } from 'i18next'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { GeneralSettingsPanel } from '../SettingsPanels'
import { DEFAULT_APPLICATION_DIALOG_SETTINGS } from '../../../settings/dialogSettings'

const t = ((key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key)) as TFunction<'applications'>

const baseProps: ComponentProps<typeof GeneralSettingsPanel> = {
    t,
    effectiveVisibility: true,
    currentVisibility: true,
    effectiveCatalogVisibility: false,
    currentCatalogVisibility: false,
    workspacesEnabled: false,
    publicEntryWorkspaceSupported: false,
    publicEntryWorkspaceId: null,
    publicEntryWorkspaceOptions: [],
    publicEntryWorkspaceLoading: false,
    publicEntryWorkspaceError: false,
    publicEntryWorkspaceSaving: false,
    publicEntryWorkspaceHasMore: false,
    publicEntryWorkspaceLoadingMore: false,
    settings: DEFAULT_APPLICATION_DIALOG_SETTINGS,
    hasChanges: false,
    isSaving: false,
    onVisibilityChange: vi.fn(),
    onCatalogVisibilityChange: vi.fn(),
    onPublicEntryWorkspaceChange: vi.fn(),
    onPublicEntryWorkspaceLoadMore: vi.fn(),
    onPublicEntryWorkspaceRetry: vi.fn(),
    onSettingsChange: vi.fn(),
    onSave: vi.fn()
}

const renderPanel = (props: ComponentProps<typeof GeneralSettingsPanel>) =>
    render(
        <ThemeProvider theme={createTheme()}>
            <GeneralSettingsPanel {...props} />
        </ThemeProvider>
    )

describe('GeneralSettingsPanel catalog visibility', () => {
    it('changes catalog discovery without changing public access', async () => {
        const user = userEvent.setup()
        renderPanel(baseProps)

        expect(screen.getByText(/does not restrict direct access/i)).toBeInTheDocument()
        await user.click(screen.getByTestId('application-settings-catalog-visibility-switch'))

        expect(baseProps.onCatalogVisibilityChange).toHaveBeenCalledWith(true)
        expect(baseProps.onVisibilityChange).not.toHaveBeenCalled()
    })

    it('disables catalog visibility while the application is closed', () => {
        renderPanel({ ...baseProps, effectiveVisibility: false, effectiveCatalogVisibility: true })

        expect(screen.getByTestId('application-settings-catalog-visibility-switch')).toBeDisabled()
        expect(screen.getByText('Set the application to Public to enable catalog listing.')).toBeInTheDocument()
    })
})
