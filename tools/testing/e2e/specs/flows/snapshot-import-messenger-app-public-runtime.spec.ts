import fs from 'node:fs/promises'
import type { BrowserContext, Response } from '@playwright/test'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { effectiveLayoutResultSchema, publicMessengerApplicationRuntimeSchema } from '@universo-react/types'
import { expect, test } from '../../fixtures/test'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    getAssignableRoles,
    sendWithCsrf,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext, getBootstrapCredentials } from '../../support/backend/bootstrap.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    assertRuntimeMutationActionsUnavailable,
    expectNoClippedTextContent,
    expectLocalizedValidation,
    expectDataGridHorizontalScrollConstrained,
    expectSemanticFieldControls,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoVisibleTextPatterns
} from '../../support/browser/runtimeUx'
import { assertMessengerAppFixtureEnvelopeContract } from '../../support/messengerAppFixtureContract'
import { buildEntityMenuItemSelector, buildEntityMenuTriggerSelector } from '../../support/selectors/contracts'
import { verifyResponsiveMessengerRuntime } from './messenger-app-public-runtime/viewports'
import {
    assertNoAdministrativeRuntimeControls,
    assertNoPublicUserIdentityLeak,
    assertPublicRuntimeSurfaceIsReadOnly,
    captureBrowserJsonResponse,
    createActiveMessengerBinding,
    inspectPublicRuntimeMaterialization,
    importFixtureThroughUi,
    listMessengerBotBindings,
    makeAliasToken,
    sameOriginApiResponseMatcher,
    readAnonymousRuntime,
    resolveFixturePath,
    type ApiContext,
    type MessengerBotBinding
} from './messenger-app-public-runtime/support'

const MESSENGER_FALLBACK_VIEWPORTS = [
    { name: 'desktop-en', width: 1920, height: 1080, locale: 'en' },
    { name: 'tablet-en', width: 768, height: 1024, locale: 'en' },
    { name: 'mobile-en', width: 390, height: 844, locale: 'en' },
    { name: 'mobile-ru', width: 390, height: 844, locale: 'ru' }
] as const

const MESSENGER_RETRY_VIEWPORTS = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 },
    { name: 'mobile-narrow', width: 320, height: 740 }
] as const

const FORGED_MESSENGER_IDENTITY_MARKERS = [
    'Forged Telegram Identity',
    'forged_telegram_user',
    '9007199254740991',
    'Forged MAX Identity',
    'forged_max_user',
    '9007199254740990'
] as const
const FORGED_MESSENGER_IDENTITY_PATTERNS = FORGED_MESSENGER_IDENTITY_MARKERS.map((marker) => new RegExp(marker, 'iu'))

test('@flow @messenger-app @snapshot exercises catalog, authenticated member, and anonymous read-only runtimes', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(600_000)
    const fixturePath = await resolveFixturePath()
    const fixture = validateSnapshotEnvelope(JSON.parse(await fs.readFile(fixturePath, 'utf8')) as Record<string, unknown>)
    assertMessengerAppFixtureEnvelopeContract(fixture, { requireOverviewContent: true })

    let api: ApiContext | null = null
    let bootstrapSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let nonMemberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let anonymousContext: BrowserContext | null = null
    const testUserIds: string[] = []
    const testUserEmails: string[] = []
    const anonymousRuntimeRequests: Array<{
        method: string
        url: string
        hasAuthorizationHeader: boolean
        authenticationCookieNames: string[]
    }> = []
    const anonymousRequestPrivacyIssues: string[] = []
    const requestAuditTasks: Promise<void>[] = []

    try {
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const imported = await importFixtureThroughUi(page, fixturePath)
        await recordCreatedMetahub({ id: imported.metahubId, name: 'Messenger App Fixture', codename: 'messenger-app-fixture' })
        await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId })

        const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: 'Team Workspace', ru: 'Командное пространство' },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })
        const applicationId = linkedApplication?.application?.id
        expect(typeof applicationId).toBe('string')
        await recordCreatedApplication({ id: applicationId as string })

        const primaryAlias = `messenger-${makeAliasToken(runManifest.runId, testInfo.retry)}`.slice(0, 63)

        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
        const aliasesResponsePromise = page.waitForResponse(
            sameOriginApiResponseMatcher(page, 'GET', `/api/v1/applications/${applicationId}/aliases`)
        )
        await page.getByRole('tab', { name: 'Bots and connections' }).click()
        const aliasesResponse = await aliasesResponsePromise
        expect(aliasesResponse.status()).toBe(200)
        const aliasesPayload = (await aliasesResponse.json()) as { items?: unknown[] }
        expect(aliasesPayload.items ?? []).toHaveLength(0)
        await expect(
            page.getByText(
                'No primary public address is set. Ask a platform administrator to open this application’s Settings from the Applications list, choose Public addresses, and set a primary address. Then return here and retry.'
            )
        ).toBeVisible()
        await expect(page.getByRole('textbox', { name: 'Web application address' })).toHaveCount(0)
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Messenger settings without a primary public address',
            checkUuidSubstrings: true
        })
        await expect(page.getByRole('button', { name: 'Add bot connection' })).toBeEnabled()
        await page.getByRole('link', { name: 'Applications', exact: true }).click()
        await expect(page).toHaveURL(/\/applications(?:[?#]|$)/u)
        await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Team Workspace', { exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Messenger address management list handoff',
            checkUuidSubstrings: true
        })

        const ownerApplicationMenu = page.getByTestId(buildEntityMenuTriggerSelector('application', applicationId as string))
        await ownerApplicationMenu.click()
        await page.getByTestId(buildEntityMenuItemSelector('application', 'edit', applicationId as string)).click()
        const ownerApplicationDialog = page.getByRole('dialog', { name: 'Edit Application' })
        await expect(ownerApplicationDialog).toBeVisible()
        await expectSemanticFieldControls(ownerApplicationDialog, { longTextLabels: ['Description'] })
        await expect(ownerApplicationDialog.getByRole('tab', { name: 'Public addresses' })).toHaveCount(0)
        await expectNoTechnicalLeakage(ownerApplicationDialog, {
            label: 'Application owner address settings without platform alias permission',
            checkUuidSubstrings: true
        })
        await page.keyboard.press('Escape')
        await expect(ownerApplicationDialog).toHaveCount(0)

        bootstrapSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials())
        const addressManagementPage = bootstrapSession.page
        await addressManagementPage.goto('/applications')
        await expect(addressManagementPage.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible({ timeout: 30_000 })
        await addressManagementPage.getByTestId(buildEntityMenuTriggerSelector('application', applicationId as string)).click()
        await addressManagementPage.getByTestId(buildEntityMenuItemSelector('application', 'edit', applicationId as string)).click()

        const applicationDialog = addressManagementPage.getByRole('dialog', { name: 'Edit Application' })
        await expect(applicationDialog).toBeVisible({ timeout: 30_000 })
        await expectSemanticFieldControls(applicationDialog, { longTextLabels: ['Description'] })
        await applicationDialog.getByRole('tab', { name: 'Public addresses' }).click()
        await expect(applicationDialog.getByText('Technical address', { exact: true })).toBeVisible()
        const technicalAddress = applicationDialog.getByTestId('application-technical-address')
        const expectedTechnicalAddress = new URL(`/a/${applicationId}`, addressManagementPage.url()).toString()
        await expect(technicalAddress).toHaveText(expectedTechnicalAddress)
        const nonTechnicalDialogText = await applicationDialog.evaluate((dialog) => {
            const copy = dialog.cloneNode(true) as HTMLElement
            copy.querySelector('[data-testid="application-technical-address"]')?.remove()
            return copy.innerText
        })
        expect(nonTechnicalDialogText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu)
        await applicationDialog.getByRole('button', { name: 'Add', exact: true }).click()

        const aliasDialog = addressManagementPage.getByRole('dialog', { name: 'Add public address' })
        await expect(aliasDialog).toBeVisible()
        await expectNoTechnicalLeakage(aliasDialog, {
            label: 'Public address creation dialog',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await aliasDialog.getByLabel('Address name', { exact: false }).fill('api')
        const invalidAliasResponsePromise = addressManagementPage.waitForResponse(
            sameOriginApiResponseMatcher(addressManagementPage, 'POST', '/api/v1/application-aliases')
        )
        await aliasDialog.getByRole('button', { name: 'Add', exact: true }).click()
        expect((await invalidAliasResponsePromise).status()).toBe(400)
        await expect(aliasDialog.getByText('This address name is reserved by the platform.', { exact: true })).toBeVisible()
        await expectLocalizedValidation(aliasDialog, 'en', { label: 'Public address reserved-name validation' })
        await expectNoTechnicalLeakage(aliasDialog, {
            label: 'Public address validation state',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await aliasDialog.getByLabel('Address name', { exact: false }).fill(primaryAlias)
        await aliasDialog.getByRole('checkbox', { name: 'Make this the primary address' }).check()
        const createAliasResponsePromise = addressManagementPage.waitForResponse(
            sameOriginApiResponseMatcher(addressManagementPage, 'POST', '/api/v1/application-aliases')
        )
        await aliasDialog.getByRole('button', { name: 'Add', exact: true }).click()
        expect((await createAliasResponsePromise).ok()).toBe(true)
        await expect(aliasDialog).toBeHidden({ timeout: 15_000 })
        await expect(applicationDialog.getByText(`/a/${primaryAlias}`, { exact: false })).toBeVisible()

        const directRoutingRadio = applicationDialog.getByRole('radio', { name: 'Open the application at every address' })
        if (!(await directRoutingRadio.isChecked())) {
            const routingPolicyResponsePromise = addressManagementPage.waitForResponse(
                sameOriginApiResponseMatcher(addressManagementPage, 'PATCH', `/api/v1/applications/${applicationId}/aliases/policy`)
            )
            await directRoutingRadio.click()
            expect((await routingPolicyResponsePromise).ok()).toBe(true)
        }
        await expect(directRoutingRadio).toBeChecked()

        await applyBrowserPreferences(addressManagementPage, { language: 'ru' })
        await addressManagementPage.goto('/applications')
        await expect(addressManagementPage.getByRole('heading', { name: 'Приложения', exact: true })).toBeVisible()
        await addressManagementPage.getByTestId(buildEntityMenuTriggerSelector('application', applicationId as string)).click()
        await addressManagementPage.getByTestId(buildEntityMenuItemSelector('application', 'edit', applicationId as string)).click()
        const russianApplicationDialog = addressManagementPage.getByRole('dialog', { name: 'Редактировать приложение' })
        await expect(russianApplicationDialog).toBeVisible()
        await russianApplicationDialog.getByRole('tab', { name: 'Публичные адреса' }).click()
        await russianApplicationDialog.getByRole('button', { name: 'Добавить', exact: true }).click()
        const russianAliasDialog = addressManagementPage.getByRole('dialog', { name: 'Добавить публичный адрес' })
        await expect(russianAliasDialog).toBeVisible()
        await russianAliasDialog.getByLabel('Имя адреса', { exact: false }).fill('api')
        const russianInvalidAliasResponsePromise = addressManagementPage.waitForResponse(
            sameOriginApiResponseMatcher(addressManagementPage, 'POST', '/api/v1/application-aliases')
        )
        await russianAliasDialog.getByRole('button', { name: 'Добавить', exact: true }).click()
        expect((await russianInvalidAliasResponsePromise).status()).toBe(400)
        await expect(russianAliasDialog.getByText('Это имя адреса зарезервировано платформой.', { exact: true })).toBeVisible()
        await expectLocalizedValidation(russianAliasDialog, 'ru', { label: 'Russian public address reserved-name validation' })
        await expectNoTechnicalLeakage(russianAliasDialog, {
            label: 'Russian public address validation state',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await russianAliasDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
        await expect(russianAliasDialog).toHaveCount(0)

        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('tab', { name: 'Bots and connections' }).click()
        const expectedPublicApplicationAddress = new URL(`/a/${encodeURIComponent(primaryAlias)}`, page.url()).toString()
        await expect(page.getByRole('textbox', { name: 'Web application address' })).toHaveValue(expectedPublicApplicationAddress)
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Application owner returns after platform administrator sets the primary address',
            checkUuidSubstrings: true
        })

        const initialApplication = await getApplication(api, applicationId as string)
        const hideFromCatalogResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
            showInAppList: false,
            expectedVersion: initialApplication.version
        })
        expect(hideFromCatalogResponse.status).toBe(200)
        await expect.poll(async () => (await getApplication(api, applicationId as string))?.showInAppList).toBe(false)

        await syncApplicationSchema(api, applicationId as string)
        await expect
            .poll(async () => (await getApplication(api, applicationId as string))?.schemaStatus, { timeout: 120_000 })
            .toBe('synced')

        const bootstrapApi = await createBootstrapApiContext()
        const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        const emailDomain = process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
        const nonMemberEmail = `e2e+${runManifest.runId}.messenger-runtime-nonmember@${emailDomain}`
        const memberEmail = `e2e+${runManifest.runId}.messenger-runtime-member@${emailDomain}`
        try {
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const userRoleId = assignableRoles.find(
                (role: { id?: string; codename?: string }) => role.codename?.toLowerCase() === 'user'
            )?.id
            if (typeof userRoleId !== 'string') throw new Error('The assignable User role was not available for Messenger runtime coverage')

            const nonMember = await createAdminUser(bootstrapApi, {
                email: nonMemberEmail,
                password: memberPassword,
                roleIds: [userRoleId],
                comment: `Messenger runtime non-member coverage ${runManifest.runId}`
            })
            if (typeof nonMember?.userId !== 'string') throw new Error('The Messenger runtime non-member account was not created')
            await recordCreatedGlobalUser({ userId: nonMember.userId, email: nonMemberEmail })
            testUserIds.push(nonMember.userId)
            testUserEmails.push(nonMemberEmail)

            const member = await createAdminUser(bootstrapApi, {
                email: memberEmail,
                password: memberPassword,
                roleIds: [userRoleId],
                comment: `Messenger authenticated runtime coverage ${runManifest.runId}`
            })
            if (typeof member?.userId !== 'string') throw new Error('The Messenger runtime member account was not created')
            await recordCreatedGlobalUser({ userId: member.userId, email: memberEmail })
            testUserIds.push(member.userId)
            testUserEmails.push(memberEmail)
            await addApplicationMember(api, applicationId as string, { email: memberEmail, role: 'member' })
        } finally {
            await disposeBootstrapApiContext(bootstrapApi)
        }

        nonMemberSession = await createLoggedInBrowserContext(browser, { email: nonMemberEmail, password: memberPassword })
        memberSession = await createLoggedInBrowserContext(browser, { email: memberEmail, password: memberPassword })
        await applyBrowserPreferences(nonMemberSession.page, { language: 'en' })
        await nonMemberSession.page.goto('/applications')
        await expect(nonMemberSession.page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible()
        await expect(nonMemberSession.page.getByText('Team Workspace', { exact: true })).toHaveCount(0)
        const nonMemberLayoutResult = await nonMemberSession.page.evaluate(async (id) => {
            const response = await fetch(`/api/v1/applications/${id}/runtime/effective-layout`, {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' }
            })
            return { status: response.status, body: await response.json() }
        }, applicationId)
        expect(nonMemberLayoutResult.status, 'An authenticated application non-member must be denied the protected runtime endpoint').toBe(
            403
        )
        expect(nonMemberLayoutResult.body).toMatchObject({
            status: 'failed',
            error: { code: 'LAYOUT_TARGET_FORBIDDEN', httpStatus: 403 }
        })
        for (const viewport of MESSENGER_FALLBACK_VIEWPORTS) {
            await nonMemberSession.page.setViewportSize({ width: viewport.width, height: viewport.height })
            const { response: publicRuntimeResponse, payload: publicRuntimePayload } = await captureBrowserJsonResponse<unknown>(
                nonMemberSession.page,
                'GET',
                `/api/v1/public/applications/${applicationId}/runtime`,
                () => nonMemberSession!.page.goto(`/a/${applicationId}?locale=${viewport.locale}`)
            )
            expect(publicRuntimeResponse.status(), `A non-member must retain the public fallback at ${viewport.name}`).toBe(200)
            expect((publicRuntimePayload as { templateKey?: unknown }).templateKey).toBe('messenger-app')
            assertNoPublicUserIdentityLeak(
                publicRuntimePayload,
                testUserIds,
                testUserEmails,
                `Authenticated non-member public runtime response at ${viewport.name}`
            )
            const main = nonMemberSession.page.getByRole('main')
            await expect(
                main.getByRole('heading', {
                    name: viewport.locale === 'en' ? 'Team Workspace' : 'Командное пространство',
                    exact: true
                })
            ).toBeVisible()
            await expect(
                main.getByRole('heading', {
                    name: viewport.locale === 'en' ? 'Learning overview' : 'Обзор обучения',
                    exact: true
                })
            ).toBeVisible()
            await assertPublicRuntimeSurfaceIsReadOnly(
                nonMemberSession.page,
                testUserIds,
                testUserEmails,
                `Authenticated non-member Messenger fallback at ${viewport.name}`
            )
            if (viewport.name === 'mobile-ru') {
                const secondRelatedRecord = main.getByText(/Вторая связанная запись подтверждает отображение нескольких строк\./u)
                await expect(
                    secondRelatedRecord,
                    'The Russian relation card must expose the complete second-record description'
                ).toBeVisible()
                await secondRelatedRecord.scrollIntoViewIfNeeded()
                await expect(secondRelatedRecord).toBeInViewport({ ratio: 1 })
                await expectNoClippedTextContent(secondRelatedRecord, {
                    label: 'Russian mobile related-record description'
                })
                const relationCard = main.locator('.MuiCard-root').filter({
                    hasText: /Вторая связанная запись подтверждает отображение нескольких строк\./u
                })
                await expect(relationCard, 'The related record description must stay inside its shared ItemCard').toHaveCount(1)
                const relationCardLayout = await relationCard.evaluate((card) => {
                    const description = Array.from(card.querySelectorAll<HTMLElement>('p')).find((paragraph) =>
                        paragraph.textContent?.includes('Вторая связанная запись подтверждает отображение нескольких строк.')
                    )
                    if (!description) throw new Error('The related record ItemCard must render its description paragraph')
                    const style = window.getComputedStyle(description)
                    return {
                        lineClamp: style.webkitLineClamp,
                        scrollHeight: card.scrollHeight,
                        clientHeight: card.clientHeight
                    }
                })
                expect(relationCardLayout.lineClamp, 'The full relation-card description must not be line-clamped').toBe('none')
                expect(
                    relationCardLayout.scrollHeight,
                    'The related-record card must grow to fit the full description'
                ).toBeLessThanOrEqual(relationCardLayout.clientHeight + 1)
                await expectNoPageHorizontalOverflow(nonMemberSession.page, 'Russian mobile related-record card')
                const relatedRecordScreenshot = testInfo.outputPath('messenger-related-record-full-mobile-ru.png')
                await nonMemberSession.page.screenshot({ path: relatedRecordScreenshot, animations: 'disabled' })
                await testInfo.attach('messenger-related-record-full-mobile-ru', {
                    path: relatedRecordScreenshot,
                    contentType: 'image/png'
                })
                await main.evaluate((element) => {
                    element.scrollTop = 0
                })
            }
            await expectNoPageHorizontalOverflow(nonMemberSession.page, `Non-member Messenger fallback at ${viewport.name}`)
            const screenshotPath = testInfo.outputPath(`messenger-non-member-fallback-${viewport.name}.png`)
            await nonMemberSession.page.screenshot({ path: screenshotPath, animations: 'disabled' })
            await testInfo.attach(`messenger-non-member-fallback-${viewport.name}`, { path: screenshotPath, contentType: 'image/png' })
        }

        const memberPage = memberSession.page
        const memberPageErrors: string[] = []
        const memberConsoleErrors: string[] = []
        const memberRuntimeFailures: Array<{ url: string; status: number }> = []
        const publicRuntimeProbePath = `/api/v1/public/applications/${primaryAlias}/runtime`
        memberPage.on('pageerror', (error) => memberPageErrors.push(error.message))
        memberPage.on('console', (message) => {
            if (message.type() !== 'error') return
            const messageText = message.text()
            const consoleLocationUrl = message.location().url
            let consoleLocationPath: string | undefined
            let consoleLocationOrigin: string | undefined
            try {
                const consoleLocation = new URL(consoleLocationUrl)
                consoleLocationPath = consoleLocation.pathname
                consoleLocationOrigin = consoleLocation.origin
            } catch {
                // Console messages without a URL location remain unexpected and are reported below.
            }
            const isExpectedUnavailablePublicProbe =
                consoleLocationOrigin === new URL(memberPage.url()).origin &&
                consoleLocationPath === publicRuntimeProbePath &&
                /\b503\b/u.test(messageText)
            if (!isExpectedUnavailablePublicProbe) memberConsoleErrors.push(messageText)
        })
        memberPage.on('response', (response) => {
            let responseUrl: URL
            try {
                responseUrl = new URL(response.url())
            } catch {
                return
            }
            if (
                responseUrl.origin === new URL(memberPage.url()).origin &&
                responseUrl.pathname.startsWith(`/api/v1/applications/${applicationId}/runtime`) &&
                response.status() >= 400
            ) {
                memberRuntimeFailures.push({ url: responseUrl.href, status: response.status() })
            }
        })

        await applyBrowserPreferences(memberPage, { language: 'en' })
        await memberPage.goto('/applications')
        await expect(memberPage.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible()
        await expect(memberPage.getByText('Team Workspace', { exact: true })).toBeVisible()
        const memberCatalogLink = memberPage.getByRole('link', { name: 'Team Workspace', exact: true })
        await expect(memberCatalogLink, 'The visible Messenger catalog card must link to the application runtime').toHaveCount(1)
        await expect(memberCatalogLink).toBeVisible()
        const catalogLaunchLayoutResponsePromise = memberPage.waitForResponse(
            sameOriginApiResponseMatcher(memberPage, 'GET', `/api/v1/applications/${applicationId}/runtime/effective-layout`)
        )
        await memberCatalogLink.focus()
        await expect(memberCatalogLink, 'The Messenger catalog card must be keyboard focusable').toBeFocused()
        const memberCatalogFocusRing = await memberCatalogLink.evaluate(
            (link) => window.getComputedStyle(link.parentElement as HTMLElement).boxShadow
        )
        expect(memberCatalogFocusRing, 'Keyboard focus on the Messenger catalog card must be visible').toContain('inset')
        await memberCatalogLink.press('Enter')
        await expect(memberPage).toHaveURL(/\/a\/[^/?#]+(?:[?#]|$)/u)
        expect((await catalogLaunchLayoutResponsePromise).status(), 'Opening the catalog card must load the member runtime').toBe(200)
        await expect(memberPage.getByRole('main').getByRole('heading', { name: 'Learning overview' })).toBeVisible()
        expect(new URL(memberPage.url()).pathname, 'The applications catalog card opens its authenticated technical route').toBe(
            `/a/${applicationId}`
        )
        await assertNoAdministrativeRuntimeControls(memberPage, 'Authenticated member Messenger runtime')
        await assertRuntimeMutationActionsUnavailable(memberPage, 'Authenticated member Messenger runtime', { allowDisabled: true })
        await expectNoTechnicalLeakage(memberPage.getByRole('main'), {
            label: 'Unlisted Messenger application visible to its member',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })

        const memberOrigin = new URL(memberPage.url()).origin
        const isPublicProbeResponse = (response: Response) => {
            const responseUrl = new URL(response.url())
            return (
                response.request().method() === 'GET' &&
                responseUrl.origin === memberOrigin &&
                responseUrl.pathname === publicRuntimeProbePath
            )
        }
        const publicProbeRoute = (url: URL) => url.origin === memberOrigin && url.pathname === publicRuntimeProbePath
        await memberPage.route(publicProbeRoute, async (route) => {
            await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'E2E public bootstrap unavailable' })
            })
        })
        try {
            for (const viewport of MESSENGER_FALLBACK_VIEWPORTS) {
                await memberPage.setViewportSize({ width: viewport.width, height: viewport.height })
                const publicProbeResponsePromise = memberPage.waitForResponse(isPublicProbeResponse, { timeout: 15_000 })
                const [publicProbeResponse, protectedLayoutCapture] = await Promise.all([
                    publicProbeResponsePromise,
                    captureBrowserJsonResponse<unknown>(
                        memberPage,
                        'GET',
                        `/api/v1/applications/${applicationId}/runtime/effective-layout`,
                        () => memberPage.goto(`/a/${primaryAlias}?locale=${viewport.locale}`, { timeout: 60_000 })
                    )
                ])
                expect(publicProbeResponse.status(), `The injected public bootstrap failure at ${viewport.name} must be observed`).toBe(503)
                const aliasLayoutResponse = protectedLayoutCapture.response
                expect(aliasLayoutResponse.status(), `The protected member fallback at ${viewport.name} must load through its alias`).toBe(
                    200
                )
                const protectedLayout = effectiveLayoutResultSchema.parse(protectedLayoutCapture.payload)
                expect(protectedLayout.status, `The member effective-layout payload at ${viewport.name} must be a success`).toBe('ok')
                if (protectedLayout.status !== 'ok') throw new Error(`Protected member layout failed at ${viewport.name}`)
                expect(protectedLayout.layout.templateKey).toBe('messenger-app')
                const protectedDetailsTable = protectedLayout.widgets.find(({ widgetKey }) => widgetKey === 'detailsTable')
                expect(protectedDetailsTable?.runtimeData, `Source-bound details table data at ${viewport.name}`).toMatchObject({
                    status: 'ready',
                    data: { kind: 'table' }
                })
                const main = memberPage.getByRole('main')
                await expect(
                    main.getByRole('heading', {
                        name: viewport.locale === 'en' ? 'Learning overview' : 'Обзор обучения',
                        exact: true
                    })
                ).toBeVisible()
                await expect(main.getByText('A required content source is unavailable.', { exact: true })).toHaveCount(0)
                await expect(main.getByText('Обязательный источник содержимого недоступен.', { exact: true })).toHaveCount(0)
                expect(new URL(memberPage.url()).pathname, 'Protected fallback must preserve the public application alias').toBe(
                    `/a/${primaryAlias}`
                )
                expect(new URL(memberPage.url()).searchParams.get('locale')).toBe(viewport.locale)
                const label = `Authenticated member Messenger alias fallback at ${viewport.name}`
                await assertNoAdministrativeRuntimeControls(memberPage, label)
                await assertRuntimeMutationActionsUnavailable(memberPage, label, { allowDisabled: true })
                await expectNoTechnicalLeakage(main, {
                    label,
                    checkUuidSubstrings: true,
                    checkOpaqueRuntimeHandles: true
                })
                await expectNoClippedTextContent(main, { label })
                assertNoPublicUserIdentityLeak(await main.innerText(), testUserIds, testUserEmails, `${label} visible content`)
                await expectNoPageHorizontalOverflow(memberPage, label)
                const screenshotPath = testInfo.outputPath(`messenger-member-fallback-${viewport.name}.png`)
                await memberPage.screenshot({ path: screenshotPath, animations: 'disabled' })
                await testInfo.attach(`messenger-member-fallback-${viewport.name}`, { path: screenshotPath, contentType: 'image/png' })
            }
        } finally {
            await memberPage.unroute(publicProbeRoute)
        }

        const authenticatedViewports = [
            { name: 'desktop-en', width: 1920, height: 1080, locale: 'en', title: 'Learning overview', record: 'Platform foundations' },
            { name: 'tablet-en', width: 768, height: 1024, locale: 'en', title: 'Learning overview', record: 'Platform foundations' },
            { name: 'mobile-en', width: 390, height: 844, locale: 'en', title: 'Learning overview', record: 'Platform foundations' },
            { name: 'mobile-ru', width: 390, height: 844, locale: 'ru', title: 'Обзор обучения', record: 'Основы платформы' }
        ] as const
        for (const viewport of authenticatedViewports) {
            await memberPage.setViewportSize({ width: viewport.width, height: viewport.height })
            const protectedLayoutCapture = await captureBrowserJsonResponse<unknown>(
                memberPage,
                'GET',
                `/api/v1/applications/${applicationId}/runtime/effective-layout`,
                () => memberPage.goto(`/a/${applicationId}?locale=${viewport.locale}`, { timeout: 60_000 })
            )
            const layoutResponse = protectedLayoutCapture.response
            expect(layoutResponse.status(), `Authenticated effective layout at ${viewport.name}`).toBe(200)
            const protectedLayout = effectiveLayoutResultSchema.parse(protectedLayoutCapture.payload)
            expect(protectedLayout.status, `Authenticated effective-layout body at ${viewport.name}`).toBe('ok')
            if (protectedLayout.status !== 'ok') throw new Error(`Authenticated effective layout failed at ${viewport.name}`)
            expect(protectedLayout.layout.templateKey).toBe('messenger-app')
            expect(protectedLayout.widgets.find(({ widgetKey }) => widgetKey === 'detailsTable')?.runtimeData).toMatchObject({
                status: 'ready',
                data: { kind: 'table' }
            })
            const main = memberPage.getByRole('main')
            if (viewport.locale === 'ru') {
                const localizedOverviewTab = memberPage.getByRole('tab', { name: 'Обзор', exact: true })
                await expect(localizedOverviewTab, 'The Russian runtime shell must expose its localized Overview tab').toBeVisible()
                await expect(localizedOverviewTab).toHaveAttribute('aria-selected', 'true')
            }
            await expect(main.getByRole('heading', { name: viewport.title, exact: true })).toBeVisible()
            await expect(main.getByText(viewport.record, { exact: true })).toBeVisible()
            await expect(main.getByText('A required content source is unavailable.', { exact: true })).toHaveCount(0)
            await expect(main.getByText('Обязательный источник содержимого недоступен.', { exact: true })).toHaveCount(0)
            await expectNoDataGridTechnicalLeakage(main, {
                label: `Authenticated Messenger DataGrid at ${viewport.name}`,
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            // The protected member layout may intentionally project entities as cards; the public runtime below separately requires the DataGrid projection.
            await expectDataGridHorizontalScrollConstrained(memberPage, `Authenticated Messenger DataGrid at ${viewport.name}`, {
                requireVisibleGrid: false
            })
            await expectNoPageHorizontalOverflow(memberPage, `Authenticated Messenger runtime at ${viewport.name}`)
            await expectNoTechnicalLeakage(main, {
                label: `Authenticated Messenger runtime at ${viewport.name}`,
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            await expectNoClippedTextContent(main, { label: `Authenticated Messenger runtime at ${viewport.name}` })
            await assertRuntimeMutationActionsUnavailable(memberPage, `Authenticated member Messenger runtime at ${viewport.name}`, {
                allowDisabled: true
            })
            const screenshotPath = testInfo.outputPath(`messenger-member-runtime-${viewport.name}.png`)
            await memberPage.screenshot({
                path: screenshotPath,
                fullPage: true,
                animations: 'disabled'
            })
            await testInfo.attach(`messenger-member-runtime-${viewport.name}`, { path: screenshotPath, contentType: 'image/png' })
        }
        expect(memberRuntimeFailures, 'Authenticated Messenger runtime API requests must succeed').toEqual([])
        expect(memberPageErrors, 'Authenticated Messenger runtime must not throw browser errors').toEqual([])
        expect(memberConsoleErrors, 'Authenticated Messenger runtime must not log browser console errors').toEqual([])

        const publicRuntimeState = await inspectPublicRuntimeMaterialization(applicationId as string, primaryAlias)
        expect(publicRuntimeState.application, 'Messenger public runtime application materialization').toMatchObject({
            schema_status: 'synced',
            is_public: true,
            _app_published: true,
            _app_archived: false,
            _app_deleted: false,
            _upl_archived: false,
            _upl_deleted: false
        })
        expect(publicRuntimeState.materialization, 'Messenger installed publication lineage').toEqual({
            metadataRecordValid: true,
            kindValid: true,
            bundleVersionValid: true,
            sourceKindValid: true,
            snapshotHashValid: true,
            publicationIdValid: true,
            publicationVersionIdValid: true,
            lastSyncedPublicationVersionIdValid: true,
            publicationIdPairValid: true,
            publicationLineagePresent: true,
            publicationVersionMatches: true
        })
        expect(publicRuntimeState.aliases).toEqual([{ alias: primaryAlias, is_primary: true }])
        expect(
            publicRuntimeState.layouts
                .filter((layout) => layout.is_active && layout.is_default && layout._app_published)
                .map(({ template_key, is_active, is_default, _app_published }) => ({
                    template_key,
                    is_active,
                    is_default,
                    _app_published
                })),
            'Messenger must be the only active, published default layout for anonymous runtime'
        ).toEqual([{ template_key: 'messenger-app', is_active: true, is_default: true, _app_published: true }])
        expect(publicRuntimeState.layouts).toEqual(
            expect.arrayContaining([expect.objectContaining({ template_key: 'messenger-app', is_active: true, _app_published: true })])
        )
        expect(publicRuntimeState.widgets.length, 'Messenger runtime widgets are installed').toBeGreaterThan(0)

        const suffix =
            runManifest.runId
                .toLowerCase()
                .replace(/[^a-z0-9]/gu, '')
                .slice(-8) || 'playwright'
        const telegramBinding = await createActiveMessengerBinding(api, applicationId as string, 'telegram', `t${suffix}bot`)
        await createActiveMessengerBinding(api, applicationId as string, 'max', `m${suffix}testbot`)
        const bindingsBeforeAnonymousWrite = await listMessengerBotBindings(api, applicationId as string)
        const anonymousProbeUsername = `p${suffix}bot`

        anonymousContext = await browser.newContext({ baseURL: api.baseURL as string, storageState: { cookies: [], origins: [] } })
        expect(await anonymousContext.cookies()).toEqual([])
        const anonymousPage = await anonymousContext.newPage()
        const loadedBridgeScripts: string[] = []
        await anonymousPage.route(/^https:\/\/telegram\.org\/js\/telegram-web-app\.js\?64$/u, async (route) => {
            loadedBridgeScripts.push('telegram')
            await route.fulfill({
                status: 200,
                contentType: 'text/javascript',
                body: `
                    const backButton = { show() {}, hide() {}, onClick() {}, offClick() {} };
                    window.Telegram = {
                        WebApp: {
                            initDataUnsafe: {
                                start_param: new URLSearchParams(window.location.search).get('tgWebAppStartParam'),
                                user: { id: 9007199254740991, first_name: 'Forged Telegram Identity', username: 'forged_telegram_user' },
                                auth_date: 1790000000,
                                hash: 'f'.repeat(64)
                            },
                            BackButton: backButton,
                            close() {}
                        }
                    };
                `
            })
        })
        await anonymousPage.route(/^https:\/\/st\.max\.ru\/js\/max-web-app\.js$/u, async (route) => {
            loadedBridgeScripts.push('max')
            await route.fulfill({
                status: 200,
                contentType: 'text/javascript',
                body: `
                    const backButton = { show() {}, hide() {}, onClick() {}, offClick() {} };
                    window.WebApp = {
                        initDataUnsafe: {
                            start_param: new URLSearchParams(window.location.search).get('WebAppStartParam'),
                            user: { id: 9007199254740990, name: 'Forged MAX Identity', username: 'forged_max_user' },
                            auth_date: 1790000001,
                            hash: 'e'.repeat(64)
                        },
                        BackButton: backButton
                    };
                `
            })
        })
        anonymousPage.on('request', (request) => {
            const auditTask = (async () => {
                const headers = await request.allHeaders()
                const requestUrl = new URL(request.url())
                const cookieHeader = headers.cookie ?? ''
                const authenticationCookieNames = cookieHeader
                    .split(';')
                    .map((cookie) => cookie.split('=', 1)[0]?.trim() ?? '')
                    .filter((name) =>
                        /^(?:access[-_.]?token|refresh[-_.]?token|auth(?:entication)?(?:[-_.].*)?|authorization|jwt|sb-access-token|sb-refresh-token)$/iu.test(
                            name
                        )
                    )
                const hasAuthorizationHeader = Object.entries(headers).some(
                    ([name, value]) =>
                        /^(?:authorization|proxy-authorization|jwt|(?:x-)?(?:auth|access|refresh)[-_.]?token|sb-access-token|sb-refresh-token)$/iu.test(
                            name
                        ) && Boolean(value)
                )
                const requestContent = [request.url(), request.postData() ?? '', ...Object.values(headers)].join('\n').toLowerCase()
                const leakedIdentityMarkers = FORGED_MESSENGER_IDENTITY_MARKERS.filter((marker) =>
                    requestContent.includes(marker.toLowerCase())
                )

                if (requestUrl.pathname.includes('/api/v1/')) {
                    anonymousRuntimeRequests.push({
                        method: request.method(),
                        url: request.url(),
                        hasAuthorizationHeader,
                        authenticationCookieNames
                    })
                }
                if (hasAuthorizationHeader || authenticationCookieNames.length > 0 || leakedIdentityMarkers.length > 0) {
                    anonymousRequestPrivacyIssues.push(
                        `${request.method()} ${requestUrl.pathname}: ${[
                            ...(hasAuthorizationHeader ? ['authorization header'] : []),
                            ...(authenticationCookieNames.length > 0 ? ['authentication cookie'] : []),
                            ...leakedIdentityMarkers.map((marker) => `forged identity marker ${marker}`)
                        ].join(', ')}`
                    )
                }
            })().catch(() => {
                anonymousRequestPrivacyIssues.push('An outgoing request could not be inspected for privacy markers')
            })
            requestAuditTasks.push(auditTask)
        })

        await test.step('Recover from a temporary anonymous runtime outage', async () => {
            let runtimeFailureCount = 0
            let userTriggeredRetryRequestCount = 0
            const runtimeFailureStatuses: number[] = []
            const anonymousOrigin = new URL(api.baseURL as string).origin
            const runtimeRequestPath = `/api/v1/public/applications/${primaryAlias}/runtime`
            const runtimeRequestRoute = (url: URL) => url.origin === anonymousOrigin && url.pathname === runtimeRequestPath
            const recordRuntimeResponseStatus = (response: Response) => {
                try {
                    const responseUrl = new URL(response.url())
                    if (
                        response.request().method() === 'GET' &&
                        responseUrl.origin === anonymousOrigin &&
                        responseUrl.pathname === runtimeRequestPath
                    ) {
                        runtimeFailureStatuses.push(response.status())
                    }
                } catch {
                    // Ignore non-URL browser responses; only the exact runtime API response is relevant.
                }
            }
            anonymousPage.on('response', recordRuntimeResponseStatus)
            await anonymousPage.route(runtimeRequestRoute, async (route) => {
                if (route.request().method() !== 'GET') {
                    await route.continue()
                    return
                }
                const requestObservedAt = Date.now()
                const requestUrl = new URL(route.request().url())
                expect(requestUrl.origin).toBe(anonymousOrigin)
                expect(requestUrl.pathname).toBe(runtimeRequestPath)
                const retryClickAt = await route
                    .request()
                    .frame()
                    .evaluate(() => {
                        const value = document.documentElement.getAttribute('data-messenger-e2e-retry-click')
                        return value === null ? Number.NaN : Number(value)
                    })
                    .catch(() => Number.NaN)
                // Capture the route event time before awaiting page evaluation so an already-pending
                // background retry cannot inherit the user's later click marker.
                const userInitiatedRetry = retryClickAt > 0 && Number.isFinite(retryClickAt) && requestObservedAt > retryClickAt
                if (userInitiatedRetry) {
                    userTriggeredRetryRequestCount += 1
                    await route.continue()
                    return
                }
                runtimeFailureCount += 1
                await route.fulfill({
                    status: 503,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Temporary test outage' })
                })
            })
            try {
                for (const locale of ['en', 'ru'] as const) {
                    for (const viewport of MESSENGER_RETRY_VIEWPORTS) {
                        runtimeFailureCount = 0
                        userTriggeredRetryRequestCount = 0
                        runtimeFailureStatuses.length = 0
                        await anonymousPage.evaluate(() => document.documentElement.removeAttribute('data-messenger-e2e-retry-click'))
                        await anonymousPage.setViewportSize({ width: viewport.width, height: viewport.height })
                        await anonymousPage.goto(`/a/${primaryAlias}?locale=${locale}`)
                        await expect.poll(() => runtimeFailureCount, { timeout: 20_000 }).toBe(3)
                        await expect.poll(() => runtimeFailureStatuses.length, { timeout: 5_000 }).toBe(3)
                        expect(runtimeFailureStatuses).toEqual([503, 503, 503])
                        const label = `Messenger public runtime ${locale} error state at ${viewport.name}`
                        const runtimeLoadAlert = anonymousPage.getByRole('alert')
                        await expect(runtimeLoadAlert).toContainText(
                            locale === 'en' ? 'Failed to load runtime data' : 'Не удалось загрузить данные пользовательского интерфейса'
                        )
                        const retryLabel = locale === 'en' ? 'Retry' : 'Повторить'
                        await expect(runtimeLoadAlert.getByRole('button', { name: retryLabel, exact: true })).toBeVisible()
                        await expectLocalizedValidation(runtimeLoadAlert, locale, { label })
                        await assertPublicRuntimeSurfaceIsReadOnly(anonymousPage, testUserIds, testUserEmails, label)
                        await expectNoPageHorizontalOverflow(anonymousPage, label)
                        const screenshotPath = testInfo.outputPath(`messenger-runtime-retry-${locale}-${viewport.name}.png`)
                        await anonymousPage.screenshot({ path: screenshotPath, animations: 'disabled' })
                        await testInfo.attach(`messenger-runtime-retry-${locale}-${viewport.name}`, {
                            path: screenshotPath,
                            contentType: 'image/png'
                        })

                        const retryButton = runtimeLoadAlert.getByRole('button', { name: retryLabel, exact: true })
                        await expect(retryButton).toBeEnabled()
                        await expect
                            .poll(() => runtimeFailureStatuses.filter((status) => status === 503).length, { timeout: 5_000 })
                            .toBeGreaterThanOrEqual(3)
                        expect(runtimeFailureStatuses).not.toContain(200)
                        expect(runtimeFailureStatuses.every((status) => status === 503)).toBe(true)
                        await retryButton.evaluate((button) => {
                            button.addEventListener(
                                'click',
                                (event) => {
                                    if (event.isTrusted) {
                                        document.documentElement.setAttribute('data-messenger-e2e-retry-click', String(Date.now()))
                                    }
                                },
                                { capture: true, once: true }
                            )
                        })
                        const { response: retryResponse, payload: retryPayload } = await captureBrowserJsonResponse<unknown>(
                            anonymousPage,
                            'GET',
                            runtimeRequestPath,
                            () => retryButton.click()
                        )
                        expect(retryResponse.status()).toBe(200)
                        expect(userTriggeredRetryRequestCount, 'Exactly one runtime request must follow the Retry click').toBe(1)
                        await expect
                            .poll(() => runtimeFailureStatuses.filter((status) => status === 200).length, { timeout: 5_000 })
                            .toBe(1)
                        expect(runtimeFailureStatuses.filter((status) => status !== 503 && status !== 200)).toEqual([])
                        const publicRuntimePayload = publicMessengerApplicationRuntimeSchema.parse(retryPayload)
                        assertNoPublicUserIdentityLeak(
                            publicRuntimePayload,
                            testUserIds,
                            testUserEmails,
                            `${locale.toUpperCase()} anonymous Messenger runtime response`
                        )
                        await expect(
                            anonymousPage.getByRole('heading', {
                                name: locale === 'en' ? 'Team Workspace' : 'Командное пространство'
                            })
                        ).toBeVisible({ timeout: 30_000 })
                        await expect(
                            anonymousPage.getByRole('heading', { name: locale === 'en' ? 'Learning overview' : 'Обзор обучения' })
                        ).toBeVisible()
                        await assertPublicRuntimeSurfaceIsReadOnly(
                            anonymousPage,
                            testUserIds,
                            testUserEmails,
                            `${locale.toUpperCase()} anonymous Messenger runtime surface after Retry`
                        )
                        await expectNoPageHorizontalOverflow(
                            anonymousPage,
                            `Messenger public runtime after ${locale} Retry at ${viewport.width}px`
                        )
                        const recoveredScreenshotPath = testInfo.outputPath(`messenger-runtime-after-retry-${locale}-${viewport.name}.png`)
                        await anonymousPage.screenshot({ path: recoveredScreenshotPath, animations: 'disabled' })
                        await testInfo.attach(`messenger-runtime-after-retry-${locale}-${viewport.name}`, {
                            path: recoveredScreenshotPath,
                            contentType: 'image/png'
                        })
                    }
                }
            } finally {
                try {
                    await anonymousPage.unroute(runtimeRequestRoute)
                } finally {
                    anonymousPage.off('response', recordRuntimeResponseStatus)
                }
            }
        })

        await test.step('Verify localized responsive runtime and inspect browser screenshots', async () => {
            await verifyResponsiveMessengerRuntime({ anonymousPage, primaryAlias, testInfo })
            for (const viewport of ['desktop', 'tablet', 'mobile-en', 'mobile-narrow', 'mobile-ru']) {
                const screenshotPath = testInfo.outputPath(`messenger-app-runtime-${viewport}.png`)
                await testInfo.attach(`messenger-anonymous-runtime-${viewport}`, { path: screenshotPath, contentType: 'image/png' })
            }
        })

        await test.step('Render the selected published Page through public Messenger navigation', async () => {
            await anonymousPage.setViewportSize({ width: 1920, height: 1080 })
            const homeRuntime = await readAnonymousRuntime(anonymousPage, `/a/${primaryAlias}?locale=en`)
            const homeMenu = homeRuntime.messengerApp.placements.find((placement) => placement.widgetKey === 'menuWidget')
            if (homeMenu?.widgetKey !== 'menuWidget' || homeMenu.runtimeData.status !== 'ready') {
                throw new Error('The anonymous Messenger home page must expose its published Page destinations')
            }
            const welcomeItem = homeMenu.runtimeData.data.items.find(
                (item) => item.kind === 'section' && item.target?.kind === 'page' && item.target.codename === 'WelcomePage'
            )
            if (!welcomeItem) throw new Error('The anonymous Messenger menu must expose the Welcome Page destination')

            const main = anonymousPage.getByRole('main')
            const navigation = main.getByTestId('messenger-zone-center').getByRole('navigation')
            await expect(navigation, 'The home page must render the public Messenger menu').toBeVisible()
            const welcomeLink = navigation.getByRole('link', { name: welcomeItem.label, exact: true })
            await expect(welcomeLink).toBeVisible()
            await welcomeLink.click()
            await expect(anonymousPage).toHaveURL(`/a/${primaryAlias}?targetKind=page&entityTypeCodename=WelcomePage&locale=en`, {
                timeout: 30_000
            })
            await expect(main.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(navigation, 'Page mode must keep the Messenger menu available').toBeVisible()
            await expect(navigation.getByRole('link', { name: welcomeItem.label, exact: true })).toBeVisible()

            const runtime = await readAnonymousRuntime(
                anonymousPage,
                `/a/${primaryAlias}?targetKind=page&entityTypeCodename=WelcomePage&locale=en`
            )
            const pageMenu = runtime.messengerApp.placements.find((placement) => placement.widgetKey === 'menuWidget')
            if (pageMenu?.widgetKey !== 'menuWidget' || pageMenu.runtimeData.status !== 'ready') {
                throw new Error('The published Messenger Page response must keep its navigation data')
            }
            expect(pageMenu.runtimeData.data.items).toContainEqual(
                expect.objectContaining({
                    kind: 'section',
                    target: expect.objectContaining({ kind: 'page', codename: 'WelcomePage' })
                })
            )
            expect(homeMenu.runtimeData.data.items).toContainEqual(
                expect.objectContaining({
                    kind: 'section',
                    target: expect.objectContaining({ kind: 'page', codename: 'WelcomePage' })
                })
            )
            expect(runtime.messengerApp.pageBlocks).toMatchObject([
                { id: 'welcome-title', type: 'header', data: { text: 'Welcome', level: 2 } },
                {
                    id: 'welcome-body',
                    type: 'paragraph',
                    data: { text: 'Use this page to publish structured application content.' }
                }
            ])
            await expect(main.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible()
            await expect(main.getByText('Use this page to publish structured application content.', { exact: true })).toBeVisible()
            await expectNoPageHorizontalOverflow(anonymousPage, 'Anonymous Messenger published Page content')
            await expectNoTechnicalLeakage(main, {
                label: 'Anonymous Messenger published Page content',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            const screenshotPath = testInfo.outputPath('messenger-public-welcome-page-desktop-en.png')
            await anonymousPage.screenshot({ path: screenshotPath, animations: 'disabled' })
            await testInfo.attach('messenger-public-welcome-page-desktop-en', { path: screenshotPath, contentType: 'image/png' })
        })

        await test.step('Verify system dark theme behavior', async () => {
            await anonymousPage.emulateMedia({ colorScheme: 'dark' })
            await expect.poll(() => anonymousPage.locator('html').getAttribute('data-mui-color-scheme')).toBe('dark')
            const darkModeBackground = await anonymousPage.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
            expect(darkModeBackground).not.toBe('rgb(255, 255, 255)')
            await expectNoPageHorizontalOverflow(anonymousPage, 'Messenger public runtime system dark theme')
            await expectNoTechnicalLeakage(anonymousPage.locator('main'), {
                label: 'Messenger public runtime system dark theme',
                checkUuidSubstrings: true
            })
            const screenshotPath = testInfo.outputPath('messenger-app-runtime-system-dark.png')
            await anonymousPage.screenshot({
                path: screenshotPath,
                fullPage: true,
                animations: 'disabled'
            })
            await testInfo.attach('messenger-app-runtime-system-dark', { path: screenshotPath, contentType: 'image/png' })
        })

        await test.step('Verify anonymous access denial and Telegram/MAX launch attribution', async () => {
            const probeResponse = await anonymousPage.evaluate(
                async ({ applicationId, botUsername }) => {
                    const csrfResponse = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' })
                    if (!csrfResponse.ok) throw new Error(`Anonymous CSRF bootstrap failed with HTTP ${csrfResponse.status}`)
                    const csrfPayload = (await csrfResponse.json()) as { csrfToken?: unknown }
                    if (typeof csrfPayload.csrfToken !== 'string' || csrfPayload.csrfToken.length === 0) {
                        throw new Error('Anonymous CSRF bootstrap returned no token')
                    }
                    const response = await fetch(`/api/v1/applications/${applicationId}/bot-bindings`, {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: {
                            Accept: 'application/json',
                            'Content-Type': 'application/json',
                            'X-CSRF-Token': csrfPayload.csrfToken
                        },
                        body: JSON.stringify({ platform: 'telegram', botUsername })
                    })
                    return { status: response.status, body: await response.text() }
                },
                { applicationId: applicationId as string, botUsername: anonymousProbeUsername }
            )
            expect([401, 403], `Anonymous Messenger write was not denied: HTTP ${probeResponse.status} ${probeResponse.body}`).toContain(
                probeResponse.status
            )
            const bindingsAfterAnonymousWrite = await listMessengerBotBindings(api, applicationId as string)
            expect(
                bindingsAfterAnonymousWrite.map(({ id, platform, botUsername, status }) => ({ id, platform, botUsername, status }))
            ).toEqual(bindingsBeforeAnonymousWrite.map(({ id, platform, botUsername, status }) => ({ id, platform, botUsername, status })))
            expect(bindingsAfterAnonymousWrite.some(({ botUsername }) => botUsername === anonymousProbeUsername)).toBe(false)

            const readLaunchAttribution = async (
                shortId: string,
                queryKey: 'tgWebAppStartParam' | 'WebAppStartParam',
                expectedPlatform: MessengerBotBinding['platform'] | null
            ) => {
                const maxBridgeMarker = queryKey === 'WebAppStartParam' ? '#WebAppPlatform=web' : ''
                const attributionPath = `/api/v1/public/applications/${primaryAlias}/attribution/${shortId}`
                let launchPayload: Awaited<ReturnType<typeof readAnonymousRuntime>> | null = null
                const { response: attributionResponse, payload: attributionPayload } = await captureBrowserJsonResponse<{
                    platform: string | null
                }>(anonymousPage, 'GET', attributionPath, async () => {
                    launchPayload = await readAnonymousRuntime(
                        anonymousPage,
                        `/a/${primaryAlias}?locale=en&${queryKey}=${encodeURIComponent(shortId)}${maxBridgeMarker}`
                    )
                })
                if (!launchPayload) throw new Error(`${queryKey} launch did not return the Messenger runtime payload`)
                expect(launchPayload.templateKey).toBe('messenger-app')
                assertNoPublicUserIdentityLeak(launchPayload, testUserIds, testUserEmails, `${queryKey} launch runtime payload`)
                expect(attributionResponse.status()).toBe(200)
                expect(attributionPayload).toEqual({ platform: expectedPlatform })
                const main = anonymousPage.getByRole('main')
                await expect(main.getByRole('heading', { name: 'Team Workspace' })).toBeVisible()
                await expect(main.getByRole('heading', { name: 'Learning overview' })).toBeVisible()
                await expect(main.getByText('Platform foundations', { exact: true })).toBeVisible()
                await expect(main.getByText(/Forged (Telegram|MAX) Identity/u)).toHaveCount(0)
                await expectNoVisibleTextPatterns(main, [...FORGED_MESSENGER_IDENTITY_PATTERNS], {
                    label: `${queryKey} launch visible runtime content`
                })
                assertNoPublicUserIdentityLeak(
                    await main.innerText(),
                    testUserIds,
                    testUserEmails,
                    `${queryKey} launch visible runtime content`
                )
                expect(
                    await anonymousPage.evaluate(() => {
                        const bridgeWindow = window as Window & { Telegram?: { WebApp?: unknown }; WebApp?: unknown }
                        return { telegram: Boolean(bridgeWindow.Telegram?.WebApp), max: Boolean(bridgeWindow.WebApp) }
                    })
                ).toEqual({ telegram: queryKey === 'tgWebAppStartParam', max: queryKey === 'WebAppStartParam' })
                await expectNoPageHorizontalOverflow(anonymousPage, `Messenger ${queryKey} launch runtime`)
            }

            expect(loadedBridgeScripts).toEqual([])
            await readLaunchAttribution(telegramBinding.shortId, 'tgWebAppStartParam', 'telegram')
            const maxBinding = bindingsBeforeAnonymousWrite.find(({ platform }) => platform === 'max')
            expect(maxBinding).toBeDefined()
            if (!maxBinding) throw new Error('The active MAX binding was not persisted for launch coverage')
            await readLaunchAttribution(maxBinding.shortId, 'WebAppStartParam', 'max')
            expect(loadedBridgeScripts).toEqual(['telegram', 'max'])
            expect(
                (await anonymousContext.cookies()).filter((cookie) =>
                    /^(?:access[-_.]?token|refresh[-_.]?token|auth(?:entication)?(?:[-_.].*)?|authorization|jwt|sb-access-token|sb-refresh-token)$/iu.test(
                        cookie.name
                    )
                )
            ).toEqual([])
            await readLaunchAttribution('AAAAAAAAAAAAAAAAAAAAAA', 'tgWebAppStartParam', null)

            const disableTelegramResponse = await sendWithCsrf(
                api,
                'PATCH',
                `/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`,
                { status: 'disabled', expectedVersion: telegramBinding.version }
            )
            expect(disableTelegramResponse.status).toBe(200)
            await readLaunchAttribution(telegramBinding.shortId, 'tgWebAppStartParam', null)
            const releaseTelegramResponse = await sendWithCsrf(
                api,
                'DELETE',
                `/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`,
                { expectedVersion: telegramBinding.version + 1 }
            )
            expect(releaseTelegramResponse.status).toBe(200)
            await readLaunchAttribution(telegramBinding.shortId, 'tgWebAppStartParam', null)
        })

        await Promise.all(requestAuditTasks)
        expect(anonymousRequestPrivacyIssues).toEqual([])
        expect(anonymousRuntimeRequests.length).toBeGreaterThan(0)
        expect(anonymousRuntimeRequests.some(({ url }) => url.includes(`/public/applications/${primaryAlias}/runtime`))).toBe(true)
        expect(anonymousRuntimeRequests.filter(({ method }) => !['GET', 'HEAD', 'OPTIONS'].includes(method))).toHaveLength(1)
        expect(anonymousRuntimeRequests.some(({ method, url }) => method === 'POST' && url.includes('/bot-bindings'))).toBe(true)
        expect(
            anonymousRuntimeRequests.filter(
                ({ hasAuthorizationHeader, authenticationCookieNames }) => hasAuthorizationHeader || authenticationCookieNames.length > 0
            )
        ).toEqual([])
    } finally {
        const cleanupTasks: Array<{ label: string; close: () => Promise<unknown> }> = []
        if (anonymousContext) cleanupTasks.push({ label: 'anonymous browser context', close: () => anonymousContext!.close() })
        if (memberSession) cleanupTasks.push({ label: 'member browser context', close: () => memberSession!.context.close() })
        if (nonMemberSession) cleanupTasks.push({ label: 'non-member browser context', close: () => nonMemberSession!.context.close() })
        if (bootstrapSession) cleanupTasks.push({ label: 'bootstrap browser context', close: () => bootstrapSession!.context.close() })
        if (api) cleanupTasks.push({ label: 'API context', close: () => disposeApiContext(api!) })
        const cleanupResults = await Promise.allSettled(cleanupTasks.map(({ close }) => close()))
        const failedCleanupLabels = cleanupResults.flatMap((result, index) =>
            result.status === 'rejected' ? [cleanupTasks[index]?.label ?? 'unknown context'] : []
        )
        if (failedCleanupLabels.length > 0) {
            await testInfo.attach('messenger-runtime-cleanup-failures.txt', {
                body: `Best-effort cleanup could not close: ${failedCleanupLabels.join(', ')}`,
                contentType: 'text/plain'
            })
        }
    }
})
