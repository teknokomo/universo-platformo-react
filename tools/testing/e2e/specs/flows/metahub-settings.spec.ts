import { createLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, createMetahub, disposeApiContext, listMetahubSettings } from '../../support/backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { expectHorizontalEdgesAligned } from '../../support/browser/spacing'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { pageSpacingSelectors } from '../../support/selectors/contracts'

function extractWrappedValue(setting: { value?: Record<string, unknown> } | undefined): unknown {
    if (!setting?.value || typeof setting.value !== 'object') {
        return undefined
    }

    return '_value' in setting.value ? setting.value._value : setting.value
}

test('@flow metahub settings persist codename style updates from the browser settings page', async ({ page, runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} settings metahub`
    const metahubCodename = `${runManifest.runId}-settings-metahub`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for settings coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await page.goto(`/metahub/${metahub.id}/settings`)
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0)
        await expectHorizontalEdgesAligned(
            page.getByTestId(pageSpacingSelectors.metahubSettingsTabs),
            page.getByTestId(pageSpacingSelectors.metahubSettingsContent)
        )

        await page.getByLabel('Codename Style').click()
        await page.getByRole('option', { name: 'kebab-case (my-catalog-name)' }).click()

        const saveButton = page.getByRole('button', { name: 'Save' })
        await expect(saveButton).toBeVisible()
        await expect(saveButton).toBeEnabled()

        const saveRequest = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'PUT' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/settings`),
            { label: 'Saving metahub settings' }
        )

        await saveButton.click()

        const saveResponse = await saveRequest
        expect(saveResponse.ok()).toBe(true)
        await expect(saveButton).toHaveCount(0)
        await expect(page.getByText('kebab-case (my-catalog-name)')).toBeVisible()

        const settingsResponse = await listMetahubSettings(api, metahub.id)
        const codenameStyleSetting = (settingsResponse?.settings ?? []).find(
            (setting: { key?: string }) => setting.key === 'general.codenameStyle'
        )

        expect(extractWrappedValue(codenameStyleSetting)).toBe('kebab-case')
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow metahub settings expose and persist common dialog preferences', async ({ page, runManifest }) => {
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} dialog settings metahub`
    const metahubCodename = `${runManifest.runId}-dialog-settings-metahub`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for common dialog settings coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await page.goto(`/metahub/${metahub.id}/settings`)
        await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

        await page.getByRole('tab', { name: 'Common' }).click()

        await expect(page.getByRole('heading', { name: 'Dialog size preset' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Allow fullscreen expansion' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Allow dialog resize' })).toBeVisible()
        await expect(page.getByRole('heading', { name: 'Dialog close behavior' })).toBeVisible()

        await page.getByLabel('Dialog size preset').click()
        await page.getByRole('option', { name: 'Large (about 800 px)' }).click()

        await page.getByLabel('Dialog close behavior').click()
        await page.getByRole('option', { name: 'Outside click closes the dialog' }).click()

        const saveButton = page.getByRole('button', { name: 'Save' })
        await expect(saveButton).toBeVisible()
        await expect(saveButton).toBeEnabled()

        const saveRequest = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'PUT' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/settings`),
            { label: 'Saving common dialog settings' }
        )

        await saveButton.click()

        const saveResponse = await saveRequest
        expect(saveResponse.ok()).toBe(true)
        await expect(saveButton).toHaveCount(0)

        const settingsResponse = await listMetahubSettings(api, metahub.id)
        const dialogSizeSetting = (settingsResponse?.settings ?? []).find(
            (setting: { key?: string }) => setting.key === 'common.dialogSizePreset'
        )
        const closeBehaviorSetting = (settingsResponse?.settings ?? []).find(
            (setting: { key?: string }) => setting.key === 'common.dialogCloseBehavior'
        )

        expect(extractWrappedValue(dialogSizeSetting)).toBe('large')
        expect(extractWrappedValue(closeBehaviorSetting)).toBe('backdrop-close')
    } finally {
        await disposeApiContext(api)
    }
})
