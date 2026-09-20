import type { Locator } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createApplication, sendWithCsrf } from '../../support/backend/api-session.mjs'
import {
    createBootstrapApiContext,
    disposeBootstrapApiContext,
    getBootstrapCredentials,
    resolvePrimaryInstance
} from '../../support/backend/bootstrap.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectTableHorizontalScrollConstrained
} from '../../support/browser/runtimeUx'
import { recordCreatedApplication } from '../../support/backend/run-manifest.mjs'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector } from '../../support/selectors/contracts'

const createAlias = async (api, applicationId: string, alias: string, makePrimary = false) => {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/application-aliases', {
        applicationId,
        alias,
        makePrimary
    })
    if (!response.ok) {
        const body = await response.text()
        throw new Error(`Creating alias ${JSON.stringify(alias)} failed with ${response.status}: ${body}`)
    }
    return response.json()
}

const readRunToken = (runId: string) => {
    const token = runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(-40)
    return token || 'playwright'
}

const expectSlugsSettingsFooter = async (dialog: Locator, label: string): Promise<void> => {
    const actions = dialog.getByTestId('page-settings-actions')
    await expect(actions, `${label} must use the shared dialog actions surface`).toHaveClass(/MuiDialogActions-root/)
    const spacing = await actions.evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
            right: Number.parseFloat(styles.paddingRight) || 0,
            bottom: Number.parseFloat(styles.paddingBottom) || 0
        }
    })
    expect(spacing.right, `${label} must preserve the standard right footer inset`).toBeGreaterThanOrEqual(23)
    expect(spacing.bottom, `${label} must preserve the standard bottom footer inset`).toBeGreaterThanOrEqual(23)
}

const ALIASES_ROUTE = (instanceId: string) => `/admin/instance/${instanceId}/aliases`

test('@flow @aliases manages deployment aliases and application public addresses in the browser', async ({
    browser,
    runManifest
}, testInfo) => {
    test.setTimeout(300_000)

    const api = await createBootstrapApiContext()
    const token = readRunToken(runManifest.runId)
    const applicationName = `E2E ${runManifest.runId} alias UI application`
    const secondaryApplicationName = `E2E ${runManifest.runId} alias UI second application`
    const primaryAlias = `e2e-${token}`
    const secondaryAlias = `e2e-secondary-${token}`
    const keyboardAlias = `e2e-kbd-${token}`
    const mutableAlias = `e2e-mutate-${token}`
    const secondaryApplicationAlias = `e2e-second-${token}`
    const instance = await resolvePrimaryInstance(api)
    let browserSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const application = await createApplication(api, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            isPublic: true
        })

        if (typeof application?.id !== 'string') {
            throw new Error('Alias browser coverage application creation did not return an id')
        }

        await recordCreatedApplication({ id: application.id })
        await createAlias(api, application.id, primaryAlias, true)
        await createAlias(api, application.id, secondaryAlias)

        // The localized Slugs management surface is deployment-global. The e2e
        // bootstrap exposes exactly one admin instance and the admin API only
        // supports list/get/update for instances, so the global-scope browser
        // proof shows aliases of two different applications under the same
        // shell plus the explicit localized global-scope description.
        const secondaryApplication = await createApplication(api, {
            name: { en: secondaryApplicationName },
            namePrimaryLocale: 'en',
            isPublic: true
        })
        if (typeof secondaryApplication?.id !== 'string') {
            throw new Error('Alias browser coverage second application creation did not return an id')
        }
        await recordCreatedApplication({ id: secondaryApplication.id })
        await createAlias(api, secondaryApplication.id, secondaryApplicationAlias)

        browserSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials(), {
            basePathAfterLogin: ALIASES_ROUTE(instance.id)
        })
        await browserSession.context.grantPermissions(['clipboard-read', 'clipboard-write'])
        const { page } = browserSession

        for (const viewport of [
            { name: 'desktop-1920', width: 1920, height: 1080 },
            { name: 'tablet-768', width: 768, height: 1024 },
            { name: 'mobile-390', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await page.goto(ALIASES_ROUTE(instance.id))
            await expect(page.getByRole('heading', { name: 'Slugs' })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
            await expect(page.getByText(`/a/${primaryAlias}`, { exact: false })).toBeVisible()
            // Deployment-global scope: aliases of two different applications
            // share one table under the Instance shell.
            const aliasTable = page.getByRole('table', { name: 'Application public addresses' })
            await expect(aliasTable.getByRole('row').filter({ hasText: applicationName })).toHaveCount(2)
            await expect(aliasTable.getByRole('row').filter({ hasText: secondaryApplicationName })).toHaveCount(1)
            await expectNoPageHorizontalOverflow(page, `Application aliases ${viewport.name}`)
            await expectTableHorizontalScrollConstrained(
                page.locator('table[aria-label="Application public addresses"]').locator('..'),
                `Application aliases table ${viewport.name}`
            )
            await expectNoTechnicalLeakage(page.locator('main'), {
                label: `Application aliases ${viewport.name}`
            })
            await page.screenshot({
                path: testInfo.outputPath(`application-aliases-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }

        await test.step('RU pass proves the localized Slugs surface and localized application labels', async () => {
            await applyBrowserPreferences(page, { language: 'ru' })
            await page.goto(ALIASES_ROUTE(instance.id))
            await expect(page.getByRole('heading', { name: 'Слаги' })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByRole('button', { name: 'Добавить', exact: true })).toBeVisible()
            const ruTable = page.getByRole('table', { name: 'Публичные адреса приложений' })
            await expect(ruTable.getByRole('row').filter({ hasText: applicationName })).toHaveCount(2)
            await expectNoTechnicalLeakage(page.locator('main'), {
                label: 'Application aliases RU'
            })
            await page.screenshot({
                path: testInfo.outputPath('application-aliases-ru.png'),
                fullPage: true,
                animations: 'disabled'
            })
        })

        await test.step('keyboard flow adds a public address and opens the row action dialog', async () => {
            await applyBrowserPreferences(page, { language: 'en' })
            await page.goto(ALIASES_ROUTE(instance.id))
            const addButton = page.getByRole('button', { name: 'Add', exact: true })
            await addButton.focus()
            await page.keyboard.press('Enter')
            const createDialog = page.getByRole('dialog', { name: 'Add public address' })
            await expect(createDialog).toBeVisible({ timeout: 30_000 })

            // MUI renders required markers inside the label text, so label
            // matching uses substring search on purpose. Autocomplete options
            // render in a body-level portal, so the option locator is
            // page-scoped rather than dialog-scoped.
            const applicationField = createDialog.getByLabel('Application', { exact: false })
            await applicationField.focus()
            await page.keyboard.type(applicationName)
            const applicationOption = page.getByRole('option', { name: applicationName })
            await expect(applicationOption).toBeVisible({ timeout: 15_000 })
            await page.keyboard.press('ArrowDown')
            await page.keyboard.press('Enter')

            const aliasField = createDialog.getByLabel('Address name', { exact: false })
            await aliasField.focus()
            await page.keyboard.type(keyboardAlias)
            const submitButton = createDialog.getByRole('button', { name: 'Add', exact: true })
            await submitButton.focus()
            await page.keyboard.press('Enter')
            await expect(createDialog).toBeHidden({ timeout: 15_000 })

            const aliasTable = page.getByRole('table', { name: 'Application public addresses' })
            const keyboardRow = aliasTable.getByRole('row').filter({ hasText: `/a/${keyboardAlias}` })
            await expect(keyboardRow).toHaveCount(1)

            // Central Slugs rows use the shared BaseEntityMenu action pattern.
            const rowMenuTrigger = keyboardRow.locator('[data-testid^="entity-menu-trigger-"]')
            await rowMenuTrigger.focus()
            await page.keyboard.press('Enter')
            const renameItem = page.getByRole('menuitem', { name: 'Rename' })
            await expect(renameItem).toBeVisible({ timeout: 15_000 })
            await renameItem.focus()
            await page.keyboard.press('Enter')
            const renameDialog = page.getByRole('dialog', { name: 'Rename public address' })
            await expect(renameDialog).toBeVisible({ timeout: 15_000 })
            await renameDialog.getByRole('button', { name: 'Cancel', exact: true }).focus()
            await page.keyboard.press('Enter')
            await expect(renameDialog).toBeHidden({ timeout: 15_000 })
        })

        await test.step('set-primary confirmation moves the primary state through a browser confirmation', async () => {
            const aliasTable = page.getByRole('table', { name: 'Application public addresses' })
            const secondaryRow = aliasTable.getByRole('row').filter({ hasText: `/a/${secondaryAlias}` })
            await secondaryRow.locator('[data-testid^="entity-menu-trigger-"]').click()
            await page.getByRole('menuitem', { name: 'Set as primary' }).click()
            const confirmDialog = page.getByRole('dialog', { name: 'Change primary address?' })
            await expect(confirmDialog).toBeVisible({ timeout: 15_000 })
            await expect(confirmDialog.getByText(`/a/${secondaryAlias}`, { exact: false })).toBeVisible()
            await confirmDialog.getByRole('button', { name: 'Confirm', exact: true }).click()
            await expect(confirmDialog).toBeHidden({ timeout: 15_000 })
            await expect(
                aliasTable
                    .getByRole('row')
                    .filter({ hasText: `/a/${secondaryAlias}` })
                    .getByText('Primary', { exact: true })
            ).toBeVisible({ timeout: 15_000 })
        })

        await test.step('release confirmation removes routing through a destructive confirmation', async () => {
            const aliasTable = page.getByRole('table', { name: 'Application public addresses' })
            const releasedRow = aliasTable.getByRole('row').filter({ hasText: `/a/${secondaryApplicationAlias}` })
            await releasedRow.locator('[data-testid^="entity-menu-trigger-"]').click()
            await page.getByRole('menuitem', { name: 'Release address' }).click()
            const releaseDialog = page.getByRole('dialog', { name: 'Release public address?' })
            await expect(releaseDialog).toBeVisible({ timeout: 15_000 })
            await expect(releaseDialog.getByText(`/a/${secondaryApplicationAlias}`, { exact: false })).toBeVisible()
            await releaseDialog.getByRole('button', { name: 'Confirm', exact: true }).click()
            await expect(releaseDialog).toBeHidden({ timeout: 15_000 })
            await expect(aliasTable.getByRole('row').filter({ hasText: `/a/${secondaryApplicationAlias}` })).toHaveCount(0, {
                timeout: 15_000
            })

            // Released lifecycle rows stay reachable through the page-scoped
            // settings dialog behind the gear button.
            await page.getByRole('button', { name: 'Settings' }).click()
            const settingsDialog = page.getByRole('dialog', { name: 'Settings' })
            await expect(settingsDialog).toBeVisible({ timeout: 15_000 })
            await expectSlugsSettingsFooter(settingsDialog, 'Slugs settings dialog')
            const releasedFilter = settingsDialog.getByLabel('Show released addresses')
            await releasedFilter.check()
            await settingsDialog.getByRole('button', { name: 'Close' }).click()
            await expect(settingsDialog).toBeHidden({ timeout: 15_000 })
            const releasedHistoryRow = aliasTable.getByRole('row').filter({ hasText: `/a/${secondaryApplicationAlias}` })
            await expect(releasedHistoryRow).toHaveCount(1, { timeout: 15_000 })
            await expect(releasedHistoryRow.getByText('Released', { exact: true })).toBeVisible()

            await page.getByRole('button', { name: 'Settings' }).click()
            const reopenedSettings = page.getByRole('dialog', { name: 'Settings' })
            await expect(reopenedSettings).toBeVisible({ timeout: 15_000 })
            await reopenedSettings.getByLabel('Show released addresses').uncheck()
            await reopenedSettings.getByRole('button', { name: 'Close' }).click()
            await expect(reopenedSettings).toBeHidden({ timeout: 15_000 })
            await expect(aliasTable.getByRole('row').filter({ hasText: `/a/${secondaryApplicationAlias}` })).toHaveCount(0, {
                timeout: 15_000
            })
        })

        await test.step('dirty-form discard confirmation protects unsaved application values while alias mutations persist', async () => {
            await applyBrowserPreferences(page, { language: 'en' })
            await page.goto('/applications')
            await expect(page.getByText(applicationName, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
            await page.getByTestId(buildEntityMenuTriggerSelector('application', application.id)).click()
            await page.getByTestId(buildEntityMenuItemSelector('application', 'edit', application.id)).click()

            const editDialog = page.getByRole('dialog', { name: 'Edit Application' })
            await expect(editDialog).toBeVisible({ timeout: 30_000 })

            const nameField = editDialog.getByLabel('Name', { exact: false })
            await nameField.fill(`${applicationName} dirty draft`)

            await editDialog.getByRole('tab', { name: 'Public addresses' }).click()
            await expect(editDialog.getByText('Technical address', { exact: true })).toBeVisible()

            const addButton = editDialog.getByRole('button', { name: 'Add', exact: true })
            await addButton.click()
            const aliasDialog = page.getByRole('dialog', { name: 'Add public address' })
            await expect(aliasDialog).toBeVisible({ timeout: 15_000 })
            await aliasDialog.getByLabel('Address name', { exact: false }).fill(mutableAlias)
            await aliasDialog.getByRole('button', { name: 'Add', exact: true }).click()
            await expect(aliasDialog).toBeHidden({ timeout: 15_000 })

            // Closing the outer dialog while the application form is dirty must
            // route through the discard confirmation and never submit the form.
            const closeButton = editDialog.getByRole('button', { name: 'Close', exact: true })
            await closeButton.click()
            const discardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?' })
            await expect(discardDialog).toBeVisible({ timeout: 15_000 })
            await discardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
            await expect(discardDialog).toBeHidden({ timeout: 15_000 })
            await expect(editDialog).toBeHidden({ timeout: 15_000 })

            // The completed alias mutation must stay persisted.
            await page.goto(ALIASES_ROUTE(instance.id))
            const aliasTable = page.getByRole('table', { name: 'Application public addresses' })
            await expect(aliasTable.getByRole('row').filter({ hasText: `/a/${mutableAlias}` })).toHaveCount(1, {
                timeout: 30_000
            })
        })

        await test.step('application Addresses tab keeps capability-gated controls and a copyable stable address', async () => {
            await page.goto('/applications')
            await expect(page.getByText(applicationName, { exact: true }).first()).toBeVisible({ timeout: 30_000 })
            await page.getByTestId(buildEntityMenuTriggerSelector('application', application.id)).click()
            await page.getByTestId(buildEntityMenuItemSelector('application', 'edit', application.id)).click()

            const editDialog = page.getByRole('dialog', { name: 'Edit Application' })
            await expect(editDialog).toBeVisible({ timeout: 30_000 })
            await editDialog.getByRole('tab', { name: 'Public addresses' }).click()
            await expect(editDialog.getByText('Technical address', { exact: true })).toBeVisible()
            await expect(editDialog.getByRole('button', { name: 'Copy stable application link' })).toBeVisible()
            // The labeled technical address is the single intentional raw-UUID
            // exception and stays copyable for system integrations.
            await expect(editDialog.getByTestId('application-technical-address')).toHaveText(new RegExp(application.id))
            await expect(editDialog.getByText(`/a/${primaryAlias}`, { exact: false })).toBeVisible()
            await expect(editDialog.getByText(`/a/${secondaryAlias}`, { exact: false })).toBeVisible()

            const canonicalRadio = editDialog.getByRole('radio', {
                name: 'Redirect secondary addresses to the primary address'
            })
            const policyResponse = page.waitForResponse(
                (response) =>
                    response.request().method() === 'PATCH' &&
                    response.url().includes(`/api/v1/applications/${application.id}/aliases/policy`)
            )
            // The radio group is controlled by async server state, so a plain
            // click plus explicit response/state assertions replace the strict
            // auto-verification built into Playwright's check().
            await canonicalRadio.click()
            expect((await policyResponse).ok()).toBe(true)
            await expect(canonicalRadio).toBeChecked({ timeout: 15_000 })

            await editDialog.getByRole('button', { name: 'Copy stable application link', exact: true }).click()
            await expect(page.getByText('Stable application link copied')).toBeVisible({ timeout: 5_000 })
            await expectNoTechnicalLeakage(editDialog, {
                label: 'Application Addresses dialog'
            })
        })
    } finally {
        if (browserSession) await browserSession.context.close()
        await disposeBootstrapApiContext(api)
    }
})
