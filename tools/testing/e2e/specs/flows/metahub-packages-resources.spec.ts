import { createLocalizedContent } from '@universo-react/utils'

import { expect, test } from '../../fixtures/test'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    disposeApiContext,
    getAssignableRoles
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext } from '../../support/backend/personas.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'

const resolveUserRoleIds = (roles: Array<{ id?: string; codename?: string }>): string[] => {
    const userRole = roles.find((role) => String(role.codename ?? '').toLowerCase() === 'user') ?? roles[0]
    return userRole?.id ? [userRole.id] : []
}

const rawPackageTextPatterns = [/@universo-react\//, /@colyseus\//, /\bcolyseus\.js\b/i]

test('@flow @packages metahub resources packages tab is usable and localized', async ({ browser, page, runManifest }, testInfo) => {
    test.setTimeout(240_000)

    const metahubName = `E2E ${runManifest.runId} packages resources`
    const metahubCodename = `${runManifest.runId}-packages-resources`
    const memberEmail = `e2e+${runManifest.runId}-packages-reader@example.test`
    const memberPassword = 'ChangeMe_E2E-123456!'

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
    let memberContext: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        bootstrapApi = await createBootstrapApiContext()
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const memberUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: resolveUserRoleIds(assignableRoles),
            comment: `Playwright package read-only member ${runManifest.runId}`
        })
        await recordCreatedGlobalUser({
            userId: memberUser.userId,
            email: memberUser.email ?? memberEmail
        })

        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for packages resources coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })
        await addMetahubMember(api, metahub.id, { email: memberUser.email ?? memberEmail, role: 'member' })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto('/metahubs')
        const metahubEntry = page.getByText(metahubName, { exact: true }).first()
        await expect(metahubEntry).toBeVisible({ timeout: 30_000 })
        await page.locator(`a[href="/metahub/${metahub.id}"]`).first().click()
        await page.getByRole('link', { name: 'Resources' }).click()
        await page.waitForURL('**/resources')
        await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Packages', selected: true })).toBeVisible()

        const packagesTab = page.getByTestId('metahub-packages-tab')
        await expect(packagesTab).toBeVisible()
        await expect(page.getByRole('table', { name: 'Packages' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'PlayCanvas Engine' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'Colyseus Server' })).toBeVisible()
        await expect(packagesTab.getByRole('heading', { name: 'Colyseus Client' })).toBeVisible()
        await expectNoTechnicalLeakage(packagesTab, {
            label: 'Metahub packages tab',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(packagesTab, rawPackageTextPatterns, { label: 'Metahub packages tab' })
        await expectNoPageHorizontalOverflow(page, 'Metahub packages resources page desktop')
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-en.png'), fullPage: true })

        await page.getByRole('button', { name: 'Connect Colyseus Client' }).focus()
        await page.keyboard.press('Enter')
        const keyboardAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(keyboardAttachDialog).toBeVisible()
        await expect(keyboardAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await keyboardAttachDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(keyboardAttachDialog).toHaveCount(0)

        await page.getByRole('button', { name: 'Connect PlayCanvas Engine' }).click()
        const attachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(attachDialog).toBeVisible()
        await expect(attachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(attachDialog).toContainText('Connect PlayCanvas Engine version 0.1.0')
        await attachDialog.getByRole('button', { name: 'Connect package' }).click()
        const playCanvasRow = packagesTab.getByRole('row', { name: /PlayCanvas Engine/ })
        await expect(playCanvasRow.getByText('Connected')).toBeVisible()

        await page.getByRole('button', { name: 'Disconnect PlayCanvas Engine' }).click()
        const detachDialog = page.getByRole('dialog', { name: 'Disconnect package' })
        await expect(detachDialog).toBeVisible()
        await expect(detachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        await expect(detachDialog).toContainText('Modules that expect it')
        await detachDialog.getByRole('button', { name: 'Disconnect package' }).click()
        await expect(detachDialog).toHaveCount(0)
        await expect(playCanvasRow.getByText('Available')).toBeVisible()
        await expect(playCanvasRow.getByRole('button', { name: 'Connect PlayCanvas Engine' })).toBeEnabled()

        const colyseusClientRow = packagesTab.getByRole('row', { name: /Colyseus Client/ })
        await colyseusClientRow.getByRole('button', { name: 'Connect Colyseus Client' }).click()
        const colyseusAttachDialog = page.getByRole('dialog', { name: 'Connect package' })
        await expect(colyseusAttachDialog).toBeVisible()
        await colyseusAttachDialog.getByRole('button', { name: 'Connect package' }).click()
        await expect(colyseusAttachDialog).toHaveCount(0)
        await expect(colyseusClientRow.getByText('Connected')).toBeVisible()

        memberContext = await createLoggedInBrowserContext(browser, { email: memberUser.email ?? memberEmail, password: memberPassword })
        await applyBrowserPreferences(memberContext.page, { language: 'en' })
        await memberContext.page.goto(`/metahub/${metahub.id}/resources`)
        await expect(memberContext.page.getByRole('heading', { name: 'Resources' })).toBeVisible()
        await expect(memberContext.page.getByText('You can view connected packages, but cannot change them.')).toBeVisible()
        await expect(memberContext.page.getByRole('button', { name: 'Connect PlayCanvas Engine' })).toBeDisabled()
        const readOnlyPackagesTab = memberContext.page.getByTestId('metahub-packages-tab')
        const readOnlyColyseusClientRow = readOnlyPackagesTab.getByRole('row', { name: /Colyseus Client/ })
        await expect(readOnlyColyseusClientRow.getByRole('button', { name: 'Disconnect Colyseus Client' })).toBeDisabled()
        await expect(readOnlyColyseusClientRow.locator('[aria-label="Package version for Colyseus Client"]')).toHaveClass(/Mui-disabled/)
        await expectNoTechnicalLeakage(readOnlyPackagesTab, {
            label: 'Read-only metahub packages tab',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(readOnlyPackagesTab, rawPackageTextPatterns, { label: 'Read-only metahub packages tab' })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await expect(page.getByRole('heading', { name: 'Ресурсы' })).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Пакеты', selected: true })).toBeVisible()
        await expect(page.getByRole('table', { name: 'Пакеты' })).toBeVisible()
        await expect(page.getByRole('columnheader', { name: '#' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Подключить PlayCanvas Engine' })).toBeVisible()
        await expectNoTechnicalLeakage(page.getByTestId('metahub-packages-tab'), {
            label: 'Metahub packages tab ru',
            checkUuidSubstrings: true
        })
        await expectNoVisibleTextPatterns(page.getByTestId('metahub-packages-tab'), rawPackageTextPatterns, {
            label: 'Metahub packages tab ru'
        })
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-ru.png'), fullPage: true })

        const packagesEndpointPattern = /\/api\/v1\/metahub\/[^/]+\/packages$/
        await page.route(packagesEndpointPattern, async (route) => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Package from metahub snapshot is not registered' })
                })
                return
            }
            await route.continue()
        })
        await page.getByRole('button', { name: 'Подключить PlayCanvas Engine' }).click()
        const failedAttachDialog = page.getByRole('dialog', { name: 'Подключить пакет' })
        await expect(failedAttachDialog).toBeVisible()
        await expect(failedAttachDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
        const failedAttachResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' &&
                packagesEndpointPattern.test(new URL(response.url()).pathname) &&
                response.status() === 500
        )
        await failedAttachDialog.getByRole('button', { name: 'Подключить пакет' }).click()
        await failedAttachResponse
        await expect(page.getByText('Не удалось выполнить операцию с пакетом. Обновите страницу и попробуйте ещё раз.')).toBeVisible()
        await failedAttachDialog.getByRole('button', { name: 'Отмена' }).click()
        await page.unroute(packagesEndpointPattern)

        await expectRuntimeUxViewportMatrix(page, 'Metahub packages resources page', {
            beforeEachViewport: async () => {
                await page.goto(`/metahub/${metahub.id}/resources`)
                await expect(page.getByTestId('metahub-packages-tab')).toBeVisible()
            }
        })
        await page.setViewportSize({ width: 768, height: 900 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-tablet.png'), fullPage: true })
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`/metahub/${metahub.id}/resources`)
        await page.screenshot({ path: testInfo.outputPath('metahub-packages-mobile.png'), fullPage: true })
    } finally {
        if (memberContext) {
            await memberContext.context.close()
        }
        if (bootstrapApi) {
            await disposeApiContext(bootstrapApi)
        }
        await disposeApiContext(api)
    }
})
