import { createLocalizedContent } from '@universo-react/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createThemePreset,
    disposeApiContext,
    listLayouts
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { applyBrowserPreferences } from '../../support/browser/preferences'

/**
 * TH-33 authoring-surface visual states for the Theme Presets feature:
 * the metahub layout details Theme tab in its default state (Universo
 * Default selected + overrides section) and the strict-modal preset manager
 * dialog. The Playwright config runs `specs/visual/*.visual.spec.ts` in the
 * authenticated `chromium` project (en-US / light), matching the en locale
 * expectations below.
 */
test('@visual theme presets authoring surfaces remain stable', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} theme presets visual`
    const metahubCodename = `${runManifest.runId}-theme-presets-visual`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for theme presets visual coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        // The preset manager dialog must show both a file preset card and a DB
        // preset card, so seed one DB preset before navigating.
        // Fixed codename: the runner resets the E2E database every run, so a
        // run-id suffix would only make the dialog screenshot unstable.
        const presetCodename = 'visual-preset'
        const createResponse = await createThemePreset(
            api,
            { kind: 'metahub', id: metahub.id },
            {
                codename: presetCodename,
                name: { en: 'E2E Visual Preset' },
                tokens: {
                    shared: {
                        typography: { fontFamily: 'inter', baseSize: 16, scale: 1.2, weights: { regular: 400, medium: 500, bold: 700 } },
                        spacing: { base: 8, density: 'comfortable' },
                        shape: { borderRadius: 8, borderWidth: 1 },
                        shadows: { scale: 'default' }
                    },
                    modes: {
                        light: {
                            primary: { main: '#027af2', contrastText: '#e5f2ff' },
                            secondary: { main: '#9c27b0', contrastText: '#ffffff' },
                            background: { default: '#fcfcfc', paper: '#f5f6fa' },
                            text: { primary: '#0b0e14', secondary: '#47536b' },
                            divider: '#e5e8ec'
                        },
                        dark: {
                            primary: { main: '#027af2', contrastText: '#e5f2ff' },
                            secondary: { main: '#9c27b0', contrastText: '#ffffff' },
                            background: { default: '#05070a', paper: '#0c1017' },
                            text: { primary: '#ffffff', secondary: '#94a0b8' },
                            divider: '#202632'
                        }
                    }
                }
            }
        )
        expect(createResponse.ok, `Creating visual preset failed with ${createResponse.status}`).toBe(true)

        let layoutId: string | undefined
        await expect
            .poll(async () => {
                const response = (await listLayouts(api, metahub.id, { limit: 20, offset: 0 })) as {
                    items?: Array<{ id?: string }>
                }
                layoutId = response?.items?.[0]?.id
                return typeof layoutId === 'string'
            })
            .toBe(true)
        if (!layoutId) {
            throw new Error(`Metahub ${metahub.id} did not expose any layouts for theme presets visual coverage`)
        }

        await applyBrowserPreferences(page, { language: 'en' })
        const detailUrl = `/metahub/${metahub.id}/resources/layouts/${layoutId}`
        await page.goto(detailUrl)
        await page.waitForURL(`**${detailUrl}`)

        await page.getByTestId('metahub-layout-details-tab-appearance').click()
        const section = page.getByTestId('metahub-appearance-section')
        await expect(section).toBeVisible()
        // Default state: the panel mirrors the effective universo-default
        // theme (preset select + preview + overrides) with no contrast errors.
        const panel = page.getByTestId('metahub-appearance-panel')
        await expect(panel).toBeVisible()
        await expect(page.getByTestId('metahub-appearance-preset-select')).toBeVisible()
        await expect(page.getByTestId('metahub-appearance-preview-light')).toBeVisible()
        await expect(page.getByTestId('metahub-appearance-preview-dark')).toBeVisible()
        await expect(page.getByTestId('metahub-appearance-contrast-error')).toHaveCount(0)
        await expect(section.getByRole('progressbar')).toHaveCount(0)

        await expect(section).toHaveScreenshot('theme-presets-appearance-tab.png', {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixels: 160
        })

        const dialog = page.getByRole('dialog')
        await section.getByTestId('metahub-appearance-manage-presets').click()
        await expect(dialog.getByTestId('metahub-appearance-close')).toBeVisible()
        await expect(dialog.getByTestId('metahub-appearance-card-universo-default')).toBeVisible()
        await expect(dialog.getByTestId(`metahub-appearance-card-${presetCodename}`)).toBeVisible()
        await expect(dialog.getByRole('progressbar')).toHaveCount(0)

        // Fail fast with a clear message if the live usage caption ever drifts
        // (the preset is created but never applied, so the count must stay 0).
        await expect(dialog.getByText('0 layout(s)')).toBeVisible()

        await expect(dialog).toHaveScreenshot('theme-presets-preset-manager-dialog.png', {
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixels: 160
        })
    } finally {
        await disposeApiContext(api)
    }
})
