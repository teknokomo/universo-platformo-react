import { resolveLocalizedContent } from '@universo/utils'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { expectHorizontalEdgesAligned } from '../../support/browser/spacing'
import {
    createBootstrapApiContext,
    disposeBootstrapApiContext,
    getBootstrapCredentials,
    resolvePrimaryInstance
} from '../../support/backend/bootstrap.mjs'
import {
    deleteAdminSetting,
    getInstance,
    listAdminSettings,
    updateAdminSetting,
    updateInstance
} from '../../support/backend/api-session.mjs'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector, entityDialogSelectors, pageSpacingSelectors } from '../../support/selectors/contracts'

function extractWrappedValue(setting: { value?: Record<string, unknown> } | undefined): unknown {
    if (!setting?.value || typeof setting.value !== 'object') {
        return undefined
    }

    return '_value' in setting.value ? setting.value._value : setting.value
}

function resolveSettingValue(settings: Array<{ key?: string; value?: Record<string, unknown> }>, key: string) {
    return extractWrappedValue(settings.find((setting) => setting.key === key))
}

test('@flow @permission admin can edit instances and persist admin settings from browser UI', async ({ browser, runManifest }) => {
    const api = await createBootstrapApiContext()
    const instance = await resolvePrimaryInstance(api)
    const originalInstance = await getInstance(api, instance.id)
    const originalSettings = await listAdminSettings(api, 'metahubs')
    const originalAllowMixedAlphabets = resolveSettingValue(originalSettings, 'codenameAllowMixedAlphabets')

    const adminSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials(), {
        basePathAfterLogin: '/admin'
    })

    const nextInstanceName = `Local ${runManifest.runId.slice(-6)}`
    const nextInstanceDescription = `Playwright instance settings coverage ${runManifest.runId}`
    const nextAllowMixedAlphabets = !(originalAllowMixedAlphabets === true)

    try {
        const page = adminSession.page

        await page.goto('/admin')
        await expect(page.getByRole('heading', { name: 'Instances' })).toBeVisible()

        const menuTrigger = page.getByTestId(buildEntityMenuTriggerSelector('instance', instance.id))
        await expect(menuTrigger).toBeVisible()
        await menuTrigger.click()
        await page.getByTestId(buildEntityMenuItemSelector('instance', 'edit', instance.id)).click()

        const editDialog = page.getByRole('dialog')
        await expect(editDialog.getByText('Edit Instance')).toBeVisible()

        await editDialog.getByLabel('Name').fill(nextInstanceName)
        await editDialog.getByLabel('Description').fill(nextInstanceDescription)
        await expect(editDialog.getByTestId(entityDialogSelectors.deleteButton)).toBeDisabled()

        const updateInstanceRequest = page.waitForResponse(
            (response) => response.request().method() === 'PUT' && response.url().endsWith(`/api/v1/admin/instances/${instance.id}`)
        )

        await editDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const updateInstanceResponse = await updateInstanceRequest
        expect(updateInstanceResponse.ok()).toBe(true)
        await expect(editDialog).toHaveCount(0)

        await expect
            .poll(async () => {
                const updated = await getInstance(api, instance.id)
                return {
                    name: resolveLocalizedContent(updated.name, 'en', updated.codename),
                    description: resolveLocalizedContent(updated.description, 'en', '')
                }
            })
            .toEqual({
                name: nextInstanceName,
                description: nextInstanceDescription
            })

        await page.reload()
        await expect(page.getByText(nextInstanceName)).toBeVisible()

        await page.goto(`/admin/instance/${instance.id}`)
        await expect(page.getByRole('heading', { name: nextInstanceName })).toBeVisible()
        await expect(page.getByText('Overview')).toBeVisible()
        await expect(page.getByRole('button', { name: 'Manage Access' })).toBeVisible()

        await page.goto(`/admin/instance/${instance.id}/settings`)
        await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Save Changes' })).toHaveCount(0)

        const allowMixedAlphabetsRow = page.getByTestId('admin-setting-codenameAllowMixedAlphabets')
        const allowMixedAlphabetsSwitch = allowMixedAlphabetsRow.getByRole('switch')

        if (nextAllowMixedAlphabets) {
            await expect(allowMixedAlphabetsSwitch).not.toBeChecked()
        } else {
            await expect(allowMixedAlphabetsSwitch).toBeChecked()
        }
        await allowMixedAlphabetsSwitch.click()
        if (nextAllowMixedAlphabets) {
            await expect(allowMixedAlphabetsSwitch).toBeChecked()
        } else {
            await expect(allowMixedAlphabetsSwitch).not.toBeChecked()
        }

        const saveButton = page.getByRole('button', { name: 'Save Changes' })
        await expect(saveButton).toBeVisible()
        await expect(saveButton).toBeEnabled()

        const updateSettingsRequest = page.waitForResponse(
            (response) => response.request().method() === 'PUT' && response.url().endsWith('/api/v1/admin/settings/metahubs')
        )

        await saveButton.click()

        const updateSettingsResponse = await updateSettingsRequest
        expect(updateSettingsResponse.ok()).toBe(true)
        await expect(saveButton).toHaveCount(0)
        if (nextAllowMixedAlphabets) {
            await expect(allowMixedAlphabetsSwitch).toBeChecked()
        } else {
            await expect(allowMixedAlphabetsSwitch).not.toBeChecked()
        }

        await expect
            .poll(async () => {
                const settings = await listAdminSettings(api, 'metahubs')
                return resolveSettingValue(settings, 'codenameAllowMixedAlphabets')
            })
            .toBe(nextAllowMixedAlphabets)

        await page.goto(`/admin/instance/${instance.id}/settings`)
        await expect(page.getByTestId(pageSpacingSelectors.adminSettingsTabs)).toBeVisible()
        await expectHorizontalEdgesAligned(
            page.getByTestId(pageSpacingSelectors.adminSettingsTabs),
            page.getByTestId(pageSpacingSelectors.adminSettingsContent)
        )
    } finally {
        await updateInstance(api, instance.id, {
            name: originalInstance.name,
            description: originalInstance.description ?? null
        }).catch(() => undefined)

        if (originalAllowMixedAlphabets === undefined) {
            await deleteAdminSetting(api, 'metahubs', 'codenameAllowMixedAlphabets').catch(() => undefined)
        } else {
            await updateAdminSetting(api, 'metahubs', 'codenameAllowMixedAlphabets', originalAllowMixedAlphabets).catch(() => undefined)
        }

        await adminSession.context.close().catch(() => undefined)
        await disposeBootstrapApiContext(api)
    }
})
