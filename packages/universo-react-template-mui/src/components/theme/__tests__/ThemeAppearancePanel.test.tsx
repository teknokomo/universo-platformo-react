import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { themeAppearanceSchema, themeTokensSchema } from '@universo-react/types'
import { findFileThemePreset } from '@universo-react/theme'

import { ThemeAppearancePanel, type AppearancePresetOption } from '../ThemeAppearancePanel'

const filePreset: AppearancePresetOption = {
    key: 'file:universo-default',
    label: 'Universo Default',
    source: 'file',
    version: 1
}

const dbPreset: AppearancePresetOption = {
    key: '0190a9b5-db-preset',
    label: 'Corp theme',
    source: 'metahub',
    version: 2
}

const baseProps = {
    testIdPrefix: 'appearance-test',
    presets: [filePreset, dbPreset],
    appearance: null,
    draft: null,
    onDraftChange: jest.fn(),
    onSave: jest.fn(),
    onReset: jest.fn(),
    onApplyLatest: jest.fn(),
    onManagePresets: jest.fn()
}

describe('ThemeAppearancePanel effective default selection', () => {
    it('displays the built-in universo-default as the effective selection when nothing is applied yet', () => {
        render(<ThemeAppearancePanel {...baseProps} />)

        // TZ §11.4: the layout renders the universo-default snapshot even
        // without a persisted appearance — the select mirrors that default
        // instead of an empty placeholder.
        const selectInput = screen.getByTestId('appearance-test-preset-select') as HTMLInputElement
        expect(selectInput.value).toBe('file:universo-default')
        expect(screen.getByText('appearance.preset.defaultHint')).toBeInTheDocument()

        // The effective theme's settings are visible, not just its name: the
        // light/dark preview and the override controls show real token values.
        expect(screen.getByTestId('appearance-test-preview-light')).toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-preview-dark')).toBeInTheDocument()
        const primaryColor = screen.getByTestId('appearance-test-color-modes-light-primary-main') as HTMLInputElement
        expect(primaryColor.value).toMatch(/^#[0-9a-f]{6}$/i)

        // Nothing is changed yet, so there is nothing to save and nothing to reset.
        expect(screen.getByTestId('appearance-test-save')).toBeDisabled()
        expect(screen.getByTestId('appearance-test-reset')).toBeDisabled()
    })

    it('seeds an explicit draft from the default theme when the color mode changes first', async () => {
        const user = userEvent.setup()
        const onDraftChange = jest.fn()
        render(<ThemeAppearancePanel {...baseProps} onDraftChange={onDraftChange} />)

        // Without a persisted appearance the mode select previously swallowed
        // the change; it must bootstrap a draft on the effective default theme.
        await user.click(screen.getByRole('combobox', { name: 'appearance.mode.label' }))
        await user.click(screen.getByRole('option', { name: 'appearance.mode.light' }))

        expect(onDraftChange).toHaveBeenCalledWith({
            mode: 'light',
            preset: { source: 'file', id: 'universo-default', version: 1 },
            overrides: {}
        })
    })

    it('creates an explicit draft when the user picks a different preset', async () => {
        const user = userEvent.setup()
        const onDraftChange = jest.fn()
        render(<ThemeAppearancePanel {...baseProps} onDraftChange={onDraftChange} />)

        // Picking the already-displayed default would be a no-op (MUI Select
        // skips onChange for the same value), so select the DB preset instead:
        // the draft must carry its metahub source and version.
        await user.click(screen.getByRole('combobox', { name: 'appearance.preset.label' }))
        await user.click(screen.getByRole('option', { name: /Corp theme/ }))

        expect(onDraftChange).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'system',
                preset: { source: 'metahub', id: '0190a9b5-db-preset', version: 2 },
                overrides: {}
            })
        )
    })

    it('hides the default hint and keeps the explicit selection while a draft exists', () => {
        render(
            <ThemeAppearancePanel
                {...baseProps}
                draft={{ mode: 'light', preset: { source: 'metahub', id: '0190a9b5-db-preset', version: 2 }, overrides: {} }}
            />
        )

        const selectInput = screen.getByTestId('appearance-test-preset-select') as HTMLInputElement
        expect(selectInput.value).toBe('0190a9b5-db-preset')
        expect(screen.queryByText('appearance.preset.defaultHint')).not.toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-save')).toBeEnabled()
    })
})

describe('ThemeAppearancePanel contrast gate', () => {
    // Failing fixture per the types-package contrast checker: page-surface
    // text pairs far below the 4.5:1 blocking minimum in both modes.
    const validTokens = themeTokensSchema.parse(findFileThemePreset('universo-default')!.tokens)

    const failingTokens = themeTokensSchema.parse({
        shared: {
            typography: { fontFamily: 'inter', baseSize: 16, scale: 1.2, weights: { regular: 400, medium: 500, bold: 700 } },
            spacing: { base: 8, density: 'comfortable' },
            shape: { borderRadius: 8, borderWidth: 1 },
            shadows: { scale: 'default' }
        },
        modes: {
            light: {
                primary: { main: '#1976d2', contrastText: '#ffffff' },
                secondary: { main: '#00838f', contrastText: '#ffffff' },
                background: { default: '#f7f8fa', paper: '#ffffff' },
                text: { primary: '#959595', secondary: '#9a9a9a' },
                divider: '#e0e0e0'
            },
            dark: {
                primary: { main: '#1976d2', contrastText: '#ffffff' },
                secondary: { main: '#00838f', contrastText: '#ffffff' },
                background: { default: '#f7f8fa', paper: '#ffffff' },
                text: { primary: '#959595', secondary: '#9a9a9a' },
                divider: '#e0e0e0'
            }
        }
    })

    const failingAppearance = themeAppearanceSchema.parse({
        mode: 'system',
        preset: { source: 'file', id: 'universo-default', version: 1 },
        overrides: {},
        resolved: { hash: `sha256:${'a'.repeat(64)}`, tokens: failingTokens }
    })

    // Persisted appearance is CLEAN (universo-default) — no alerts initially.
    const cleanAppearance = themeAppearanceSchema.parse({
        mode: 'system',
        preset: { source: 'file', id: 'universo-default', version: 1 },
        overrides: {},
        resolved: { hash: `sha256:${'b'.repeat(64)}`, tokens: validTokens }
    })

    it('surfaces draft-time contrast issues before saving and keeps the server gate authoritative', () => {
        const onDraftChange = jest.fn()
        // Persisted appearance is CLEAN (universo-default) — no alerts initially.
        const firstView = render(
            <ThemeAppearancePanel
                {...baseProps}
                appearance={cleanAppearance}
                draft={{ mode: 'system', preset: { source: 'file', id: 'universo-default', version: 1 }, overrides: {} }}
                onDraftChange={onDraftChange}
            />
        )

        expect(screen.queryByTestId('appearance-test-contrast-error')).not.toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-save')).toBeEnabled()
        firstView.unmount()

        // The user types a failing text color into the overrides editor: the
        // panel merges draft overrides over the effective base (display-only,
        // TZ Appendix A #7 — never persisted) and warns BEFORE saving.
        const editingView = render(
            <ThemeAppearancePanel
                {...baseProps}
                appearance={cleanAppearance}
                draft={{ mode: 'system', preset: { source: 'file', id: 'universo-default', version: 1 }, overrides: {} }}
                onDraftChange={onDraftChange}
            />
        )
        fireEvent.change(screen.getByTestId('appearance-test-color-modes-light-text-primary'), {
            target: { value: '#959595' }
        })

        expect(onDraftChange).toHaveBeenCalledTimes(1)
        const warnedDraft = onDraftChange.mock.calls[0][0] as {
            overrides: { modes?: { light?: { text?: { primary?: unknown } } } }
        }
        expect(warnedDraft.overrides.modes?.light?.text?.primary).toBe('#959595')
        editingView.unmount()

        // Re-render with the warned draft: the draft-time error alert shows
        // and Save is gated client-side (the server would 422 the same body).
        render(<ThemeAppearancePanel {...baseProps} appearance={cleanAppearance} draft={warnedDraft} onDraftChange={onDraftChange} />)
        expect(screen.getByTestId('appearance-test-contrast-error')).toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-save')).toBeDisabled()
    })

    it('clears persisted contrast feedback once the draft targets a clean preset (the repair path)', () => {
        render(
            <ThemeAppearancePanel
                {...baseProps}
                appearance={failingAppearance}
                draft={{ mode: 'system', preset: { source: 'file', id: 'universo-default', version: 1 }, overrides: {} }}
            />
        )

        // The draft resolves to clean universo-default tokens, so saving would
        // repair the theme — no draft-time error, save enabled.
        expect(screen.queryByTestId('appearance-test-contrast-error')).not.toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-save')).toBeEnabled()
    })

    it('skips draft issues for an unverified DB preset base and keeps Save enabled (server gate authoritative)', () => {
        // The draft targets a DIFFERENT metahub preset whose resolved tokens
        // are unknown client-side, and carries an override that WOULD fail
        // contrast if merged over the previously applied theme (#959595 on the
        // universo-default light surface). The base is untrustworthy, so the
        // panel must not compute draft issues from it: no draft-issues
        // override of the persisted (clean) feedback, the preview keeps the
        // effective tokens, and Save stays enabled — the server 422 gate
        // remains authoritative (TZ Appendix A #7).
        render(
            <ThemeAppearancePanel
                {...baseProps}
                appearance={cleanAppearance}
                draft={{
                    mode: 'system',
                    preset: { source: 'metahub', id: '0190a9b5-other-preset', version: 2 },
                    overrides: { modes: { light: { text: { primary: '#959595' } } } }
                }}
            />
        )

        expect(screen.queryByTestId('appearance-test-contrast-error')).not.toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-preview-light')).toBeInTheDocument()
        expect(screen.getByTestId('appearance-test-save')).toBeEnabled()
    })
})
