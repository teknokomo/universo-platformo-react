import { expect, test } from '../../fixtures/test'
import type { Locator, Response } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationVersion,
    addApplicationMember,
    disposeApiContext,
    getAssignableRoles,
    getApplication,
    getApplicationLayout,
    listApplicationLayouts,
    listApplications,
    listPublicationApplications,
    requestApi,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    updateApplicationMember,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext, getBootstrapCredentials } from '../../support/backend/bootstrap.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import {
    expectLocalizedValidation,
    expectLocatorHasNoInlineOverflow,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { buildEntityMenuTriggerSelector, toolbarSelectors } from '../../support/selectors/contracts'

const readAttribution = async (baseUrl: string, applicationRef: string, shortId: string) => {
    const response = await fetch(
        new URL(`/api/v1/public/applications/${encodeURIComponent(applicationRef)}/attribution/${encodeURIComponent(shortId)}`, baseUrl)
    )
    const body = await response.text()
    expect(response.ok, `Attribution endpoint returned HTTP ${response.status}: ${body}`).toBe(true)
    return JSON.parse(body) as { platform: string | null }
}

const expectMessengerBindingCardNotClipped = async (card: Locator, width: number) => {
    const cardRoot = card.locator('.MuiCard-root')
    const measurements = await cardRoot.evaluate((root) => ({
        clientHeight: root.clientHeight,
        scrollHeight: root.scrollHeight,
        clientWidth: root.clientWidth,
        scrollWidth: root.scrollWidth
    }))
    expect(measurements.scrollHeight, `Messenger binding card height at ${width}px`).toBeLessThanOrEqual(measurements.clientHeight + 1)
    expect(measurements.scrollWidth, `Messenger binding card width at ${width}px`).toBeLessThanOrEqual(measurements.clientWidth + 1)
    await expectMessengerTextNotClipped(cardRoot, 'Messenger binding card text', width)
}

const expectMessengerTextNotClipped = async (text: Locator, label: string, width: number) => {
    const measurements = await text.evaluate((element) => {
        const textRects: DOMRect[] = []
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let node = walker.nextNode()
        while (node) {
            if (node.textContent?.trim()) {
                const range = document.createRange()
                range.selectNodeContents(node)
                textRects.push(...Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0))
            }
            node = walker.nextNode()
        }

        const clippingAncestors = new Map<Element, { rect: DOMRect; overflowX: string; overflowY: string; label: string }>()
        let ancestor: Element | null = element
        while (ancestor && ancestor !== document.body) {
            const style = window.getComputedStyle(ancestor)
            if (style.overflowX === 'hidden' || style.overflowX === 'clip' || style.overflowY === 'hidden' || style.overflowY === 'clip') {
                clippingAncestors.set(ancestor, {
                    rect: ancestor.getBoundingClientRect(),
                    overflowX: style.overflowX,
                    overflowY: style.overflowY,
                    label: `${ancestor.tagName.toLowerCase()}.${typeof ancestor.className === 'string' ? ancestor.className : ''}`
                })
            }
            ancestor = ancestor.parentElement
        }

        const clippedBy = new Set<string>()
        for (const textRect of textRects) {
            for (const [, clipping] of clippingAncestors) {
                const clippedHorizontally =
                    (clipping.overflowX === 'hidden' || clipping.overflowX === 'clip') &&
                    (textRect.left < clipping.rect.left - 1 || textRect.right > clipping.rect.right + 1)
                const clippedVertically =
                    (clipping.overflowY === 'hidden' || clipping.overflowY === 'clip') &&
                    (textRect.top < clipping.rect.top - 1 || textRect.bottom > clipping.rect.bottom + 1)
                if (clippedHorizontally || clippedVertically) clippedBy.add(clipping.label)
            }
        }

        return {
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            textRectCount: textRects.length,
            clippedBy: Array.from(clippedBy)
        }
    })
    expect(measurements.textRectCount, `${label} must have measurable visible text at ${width}px`).toBeGreaterThan(0)
    expect(measurements.clippedBy, `${label} text must fit every clipping ancestor at ${width}px`).toEqual([])
    expect(measurements.scrollHeight, `${label} height at ${width}px`).toBeLessThanOrEqual(measurements.clientHeight + 1)
    expect(measurements.scrollWidth, `${label} width at ${width}px`).toBeLessThanOrEqual(measurements.clientWidth + 1)
}

test('@flow @messenger-app manages catalog visibility and MAX/Telegram launch bindings', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(360_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const suffix =
        runManifest.runId
            .toLowerCase()
            .replace(/[^a-z0-9]/gu, '')
            .slice(-8) || 'playwright'
    const applicationName = `E2E ${runManifest.runId} Messenger bindings`
    const metahubName = `E2E ${runManifest.runId} Messenger bindings metahub`
    const metahubCodename = `${runManifest.runId}-messenger-bindings-metahub`
    const publicationName = `E2E ${runManifest.runId} Messenger bindings publication`
    const telegramUsername = `tg${suffix}${'x'.repeat(18)}bot`
    const maxUsername = `m${suffix}${'a'.repeat(38)}_bot`
    const displayName = `Messenger support team ${'for public application users '.repeat(3)}`.slice(0, 120)
    const alias = `messenger-${suffix}`
    let applicationId: string | null = null
    let nonMemberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
    let privilegedSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'basic-demo'
        })
        if (typeof metahub?.id !== 'string') {
            throw new Error('Metahub creation did not return an id for Messenger bindings coverage')
        }
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        const publication = await createPublication(api, metahub.id, {
            name: { en: applicationName, ru: `E2E ${runManifest.runId} подключения Messenger` },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })
        if (typeof publication?.id !== 'string') {
            throw new Error('Publication creation did not return an id for Messenger bindings coverage')
        }
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        await page.goto(`/metahub/${metahub.id}/publication/${publication.id}/applications`)
        await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible()
        const linkedApplicationResponsePromise = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/publication/${publication.id}/applications`),
            { label: 'Create linked Messenger Application' }
        )
        await page.getByTestId(toolbarSelectors.primaryAction).click()
        const linkedApplicationDialog = page.getByRole('dialog', { name: 'Create Application' })
        await expectSemanticFieldControls(linkedApplicationDialog, { longTextLabels: ['Description'] })
        await linkedApplicationDialog.getByRole('textbox', { name: 'Name' }).fill(applicationName)
        await linkedApplicationDialog.getByLabel('Public').check()
        await expectNoTechnicalLeakage(linkedApplicationDialog, {
            label: 'Create public Messenger application from its publication',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('messenger-create-linked-application-en.png'),
            animations: 'disabled'
        })
        await linkedApplicationDialog.getByRole('button', { name: 'Create', exact: true }).click()
        const linkedApplicationResponse = await linkedApplicationResponsePromise
        expect(linkedApplicationResponse.status()).toBe(201)
        const linkedApplicationBody = (await linkedApplicationResponse.json()) as {
            application?: { id?: string }
            id?: string
        }
        applicationId =
            typeof linkedApplicationBody.application?.id === 'string'
                ? linkedApplicationBody.application.id
                : typeof linkedApplicationBody.id === 'string'
                ? linkedApplicationBody.id
                : null
        expect(applicationId).toBeTruthy()
        await recordCreatedApplication({ id: applicationId as string })
        await expect
            .poll(async () => {
                const applications = await listPublicationApplications(api, metahub.id, publication.id)
                return applications.items?.some((application: { id?: string }) => application.id === applicationId) ?? false
            })
            .toBe(true)
        await syncApplicationSchema(api, applicationId as string)

        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.goto(`/a/${applicationId}/admin/layouts`)
        await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Create layout' }).click()
        const createLayoutDialog = page.getByRole('dialog', { name: 'Create layout' })
        await expect(createLayoutDialog).toBeVisible()
        await createLayoutDialog.getByRole('textbox', { name: 'Name' }).fill('Messenger home')
        await createLayoutDialog.getByRole('combobox', { name: 'Template' }).click()
        await page.getByRole('option', { name: 'Messenger app', exact: true }).click()
        const createLayoutResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/layouts`),
            { label: 'Create Messenger layout' }
        )
        await createLayoutDialog.getByRole('button', { name: 'Create layout' }).click()
        const layoutResponse = await createLayoutResponse
        expect(layoutResponse.status()).toBe(201)
        const createdLayoutBody = (await layoutResponse.json()) as { item?: { id?: string }; id?: string }
        const messengerLayoutId = createdLayoutBody.item?.id ?? createdLayoutBody.id
        expect(messengerLayoutId).toBeTruthy()
        await expect(page.getByText('Messenger home', { exact: true })).toBeVisible()
        const messengerLayoutDetail = (await getApplicationLayout(api, applicationId as string, messengerLayoutId as string)) as {
            widgets?: Array<{ zone: string; widgetKey: string }>
        }
        expect(messengerLayoutDetail.widgets).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ zone: 'top', widgetKey: 'header' }),
                expect.objectContaining({ zone: 'center', widgetKey: 'detailsTabs' })
            ])
        )
        const applicationLayouts = (await listApplicationLayouts(api, applicationId as string, { limit: 100, offset: 0 })) as {
            items?: Array<{ templateKey: string; scopeEntityId: string | null }>
        }
        expect(applicationLayouts.items?.some((layout) => layout.templateKey === 'messenger-app' && layout.scopeEntityId === null)).toBe(
            true
        )
        await page.screenshot({
            path: testInfo.outputPath('messenger-first-global-layout-en.png'),
            animations: 'disabled'
        })

        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('tab', { name: 'Bots and connections' }).click()
        await expect(
            page.getByText(
                'No primary public address is set. Ask a platform administrator to open this application’s Settings from the Applications list, choose Public addresses, and set a primary address. Then return here and retry.'
            )
        ).toBeVisible()
        await expect(page.getByRole('textbox', { name: 'Web application address' })).toHaveCount(0)
        await expect(page.getByRole('button', { name: 'Add bot connection' })).toBeEnabled()
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Messenger settings without a public alias',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('messenger-settings-no-primary-address-en.png'),
            animations: 'disabled'
        })

        let releaseBindingsResponse: () => void = () => undefined
        const holdBindingsResponse = new Promise<void>((resolve) => {
            releaseBindingsResponse = resolve
        })
        const bindingsRoute = `**/api/v1/applications/${applicationId}/bot-bindings**`
        const pendingBindingsResponses: Promise<void>[] = []
        await page.route(bindingsRoute, async (route) => {
            const responseTask = (async () => {
                await holdBindingsResponse
                try {
                    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
                } catch (error) {
                    const requestFailure = route.request().failure()
                    const routeAlreadyHandled =
                        error instanceof Error && /Route is already handled|page, context or browser has been closed/iu.test(error.message)
                    if (!requestFailure && !routeAlreadyHandled) throw error
                }
            })()
            pendingBindingsResponses.push(responseTask)
            await responseTask
        })
        const bindingsRequestPromise = page.waitForRequest(
            (request) =>
                request.method() === 'GET' && new URL(request.url()).pathname === `/api/v1/applications/${applicationId}/bot-bindings`,
            { timeout: 15_000 }
        )
        try {
            await page.reload()
            await expect(page.getByRole('heading', { name: 'Application Settings', exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(page.getByRole('tab', { name: 'Bots and connections', exact: true })).toBeVisible()
            await page.getByRole('tab', { name: 'Bots and connections' }).click()
            await bindingsRequestPromise
            await expect(page.getByLabel('Loading bot connections')).toBeVisible()
            await page.screenshot({
                path: testInfo.outputPath('messenger-settings-loading-en.png'),
                animations: 'disabled'
            })
        } finally {
            releaseBindingsResponse()
            await Promise.allSettled(pendingBindingsResponses)
            await page.unroute(bindingsRoute)
        }
        await expect(page.getByText('No bot connections yet.', { exact: true })).toBeVisible()

        await page.route(bindingsRoute, (route) =>
            route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'E2E service unavailable' }) })
        )
        await page.reload()
        await expect(page.getByRole('heading', { name: 'Application Settings', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('tab', { name: 'Bots and connections', exact: true })).toBeVisible()
        await page.getByRole('tab', { name: 'Bots and connections' }).click()
        const bindingsLoadAlert = page.getByText('Bot connections could not be loaded.', { exact: true })
        await expect(bindingsLoadAlert).toContainText('Bot connections could not be loaded.', { timeout: 30_000 })
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Messenger settings after binding-list failure',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('messenger-settings-error-en.png'),
            animations: 'disabled'
        })
        await page.unroute(bindingsRoute)
        await page
            .getByRole('alert')
            .filter({ hasText: 'Bot connections could not be loaded.' })
            .getByRole('button', { name: 'Retry', exact: true })
            .click()
        await expect(page.getByText('No bot connections yet.', { exact: true })).toBeVisible()

        const nonMemberEmail = `e2e+${runManifest.runId}.messenger-catalog-nonmember@${
            process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
        }`
        const nonMemberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        const nonMemberBootstrapApi = await createBootstrapApiContext()
        try {
            const assignableRoles = await getAssignableRoles(nonMemberBootstrapApi)
            const userRoleId = assignableRoles.find(
                (role: { codename?: string; id?: string }) => role.codename?.toLowerCase() === 'user'
            )?.id
            if (typeof userRoleId !== 'string')
                throw new Error('The assignable User role was not available for non-member catalog coverage')
            const nonMember = await createAdminUser(nonMemberBootstrapApi, {
                email: nonMemberEmail,
                password: nonMemberPassword,
                roleIds: [userRoleId],
                comment: `Messenger catalog non-member coverage ${runManifest.runId}`
            })
            if (typeof nonMember?.userId !== 'string') throw new Error('The Messenger catalog non-member account was not created')
            await recordCreatedGlobalUser({ userId: nonMember.userId, email: nonMemberEmail })
        } finally {
            await disposeBootstrapApiContext(nonMemberBootstrapApi)
        }

        nonMemberSession = await createLoggedInBrowserContext(browser, { email: nonMemberEmail, password: nonMemberPassword })
        privilegedSession = await createLoggedInBrowserContext(browser, getBootstrapCredentials())
        await nonMemberSession.page.goto(new URL('/applications', api.baseURL as string).toString())
        await expect(nonMemberSession.page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(nonMemberSession.page.getByText(applicationName, { exact: true })).toBeVisible()
        await expectNoTechnicalLeakage(nonMemberSession.page.locator('main'), {
            label: 'Listed public Messenger catalog entry',
            checkUuidSubstrings: true
        })

        const initiallyPublic = await getApplication(api, applicationId as string)
        if (!initiallyPublic) throw new Error('The listed Messenger Application was not available for catalog visibility coverage')
        expect(initiallyPublic.isPublic).toBe(true)
        expect(initiallyPublic.showInAppList).toBe(true)
        const closeResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
            isPublic: false,
            expectedVersion: initiallyPublic.version
        })
        expect(closeResponse.status).toBe(200)
        await expect.poll(async () => (await getApplication(api, applicationId as string))?.isPublic).toBe(false)
        await nonMemberSession.page.reload()
        await expect(nonMemberSession.page.getByText(applicationName, { exact: true })).toHaveCount(0)

        const closedApplication = await getApplication(api, applicationId as string)
        if (!closedApplication) throw new Error('The closed Messenger Application disappeared before it could be reopened')
        const reopenResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
            isPublic: true,
            expectedVersion: closedApplication.version
        })
        expect(reopenResponse.status).toBe(200)
        await expect.poll(async () => (await getApplication(api, applicationId as string))?.isPublic).toBe(true)
        await nonMemberSession.page.reload()
        await expect(nonMemberSession.page.getByText(applicationName, { exact: true })).toBeVisible()

        const bootstrapApi = await createBootstrapApiContext()
        try {
            const aliasResponse = await sendWithCsrf(bootstrapApi, 'POST', '/api/v1/application-aliases', {
                applicationId,
                alias,
                makePrimary: true
            })
            expect(aliasResponse.ok, `Creating Messenger public alias failed with ${aliasResponse.status}`).toBe(true)
            const secondaryAliasResponse = await sendWithCsrf(bootstrapApi, 'POST', '/api/v1/application-aliases', {
                applicationId,
                alias: `${alias}-secondary`,
                makePrimary: false
            })
            expect(
                secondaryAliasResponse.ok,
                `Creating secondary Messenger public alias failed with ${secondaryAliasResponse.status}`
            ).toBe(true)
        } finally {
            await disposeBootstrapApiContext(bootstrapApi)
        }

        const staleAliasesRoute = `**/api/v1/applications/${applicationId}/aliases*`
        await page.route(staleAliasesRoute, (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
        )
        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
        await page.getByRole('tab', { name: 'Bots and connections' }).click()
        const missingPrimaryAlert = page.getByRole('alert').filter({ hasText: 'No primary public address is set.' })
        await expect(missingPrimaryAlert).toBeVisible()
        await expect(page.getByRole('textbox', { name: 'Web application address' })).toHaveCount(0)
        await page.unroute(staleAliasesRoute)
        const refreshedAliasesResponse = page.waitForResponse(
            (response) => response.request().method() === 'GET' && response.url().endsWith(`/api/v1/applications/${applicationId}/aliases`)
        )
        await missingPrimaryAlert.getByRole('button', { name: 'Retry', exact: true }).click()
        const aliasesAfterRetry = await refreshedAliasesResponse
        expect(aliasesAfterRetry.status()).toBe(200)
        const aliasesAfterRetryBody = (await aliasesAfterRetry.json()) as {
            items?: Array<{ alias: string; isPrimary: boolean; status?: string }>
        }
        expect(aliasesAfterRetryBody.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ alias, isPrimary: true }),
                expect.objectContaining({ alias: `${alias}-secondary`, isPrimary: false })
            ])
        )
        const retriedPublicAddress = page.getByRole('textbox', { name: 'Web application address' })
        await expect(retriedPublicAddress).toHaveValue(new RegExp(`/a/${alias}$`, 'u'))
        await expect(retriedPublicAddress).not.toHaveValue(new RegExp(`${alias}-secondary`, 'u'))
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Messenger primary-address retry with secondary address present',
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath('messenger-settings-primary-address-retry-en.png'),
            animations: 'disabled'
        })

        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })

        const catalogSwitch = page.getByTestId('application-settings-catalog-visibility-switch')
        await expect(catalogSwitch).toBeChecked()
        await catalogSwitch.click()
        await expect(catalogSwitch).not.toBeChecked()
        const catalogVisibilitySave = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/v1/applications/${applicationId}`,
            { label: 'Save Messenger application catalog visibility' }
        )
        await page.getByTestId('application-settings-general-save').click()
        expect((await catalogVisibilitySave).ok(), 'Saving catalog visibility through Application Settings must succeed').toBe(true)
        await expect.poll(async () => (await getApplication(api, applicationId as string))?.showInAppList).toBe(false)

        await nonMemberSession.page.reload()
        await expect(nonMemberSession.page.getByText(applicationName, { exact: true })).toHaveCount(0)
        const privilegedSettingsApi = await createBootstrapApiContext()
        try {
            const settingsResponse = await sendWithCsrf(privilegedSettingsApi, 'PUT', '/api/v1/profile/settings', {
                settings: { admin: { showAllItems: true } }
            })
            expect(settingsResponse.status).toBe(200)
            const settingsPayload = (await settingsResponse.json()) as { data?: { admin?: { showAllItems?: boolean } } }
            expect(settingsPayload.data?.admin?.showAllItems).toBe(true)
        } finally {
            await disposeBootstrapApiContext(privilegedSettingsApi)
        }
        const privilegedApplicationListResponse = privilegedSession.page.waitForResponse((response) => {
            const url = new URL(response.url())
            return (
                url.pathname === '/api/v1/applications' &&
                response.request().method() === 'GET' &&
                url.searchParams.get('showAll') === 'true'
            )
        })
        await privilegedSession.page.goto(new URL('/applications', api.baseURL as string).toString())
        await expect(privilegedSession.page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible({ timeout: 30_000 })
        const listResponse = await privilegedApplicationListResponse
        expect(listResponse.ok()).toBe(true)
        const privilegedListPayload = (await listResponse.json()) as { items?: Array<{ id: string }> }
        expect(privilegedListPayload.items?.some(({ id }) => id === applicationId)).toBe(true)
        await privilegedSession.page.screenshot({
            path: testInfo.outputPath('messenger-admin-show-all-catalog-en.png'),
            animations: 'disabled'
        })
        await expect(privilegedSession.page.getByText(applicationName, { exact: true })).toBeVisible()
        await expect(privilegedSession.page.getByText('Unlisted', { exact: true })).toBeVisible()

        await page.goto('/applications')
        await expect(page.getByText(applicationName, { exact: true })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Unlisted', { exact: true })).toBeVisible()
        await page.setViewportSize({ width: 390, height: 844 })
        await expectNoPageHorizontalOverflow(page, 'Application list with Messenger catalog badge at 390px')
        await page.screenshot({
            path: testInfo.outputPath('messenger-hidden-catalog-badge-mobile-en.png'),
            animations: 'disabled'
        })

        await expectNoTechnicalLeakage(nonMemberSession.page.locator('main'), {
            label: 'Messenger catalog for a non-member',
            checkUuidSubstrings: true
        })

        for (const width of [1920, 768, 390]) {
            await page.setViewportSize({ width, height: width === 1920 ? 1080 : width === 768 ? 1024 : 844 })
            await page.goto(`/a/${applicationId}/admin/settings`)
            await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
            const aliasesResponsePromise = page.waitForResponse(
                (response) =>
                    response.request().method() === 'GET' && response.url().endsWith(`/api/v1/applications/${applicationId}/aliases`)
            )
            await page.getByRole('tab', { name: 'Bots and connections' }).click()
            await expect(page.getByTestId('application-messenger-bindings')).toBeVisible()
            const aliasesResponse = await aliasesResponsePromise
            expect(aliasesResponse.status()).toBe(200)
            const aliasesBody = (await aliasesResponse.json()) as { items?: Array<{ alias: string; isPrimary: boolean; status?: string }> }
            const accessiblePrimaryAlias = aliasesBody.items?.find((item) => item.isPrimary && item.status !== 'released')?.alias
            expect(accessiblePrimaryAlias).toBe(alias)
            await expectNoPageHorizontalOverflow(page, `Messenger settings at ${width}px`)
            await page.screenshot({
                path: testInfo.outputPath(`messenger-settings-${width}-en.png`),
                animations: 'disabled'
            })
        }
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
        await page.setViewportSize({ width: 390, height: 844 })

        const publicAddress = page.getByRole('textbox', { name: 'Web application address' })
        await expect(publicAddress).toHaveValue(new RegExp(`/a/${alias}$`, 'u'))
        await page.getByRole('button', { name: 'Copy URL' }).click()
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(await publicAddress.inputValue())

        const createBinding = async (platform: 'Telegram' | 'MAX', username: string) => {
            const addButton = page.getByRole('button', { name: 'Add bot connection' })
            if (platform === 'Telegram') {
                await addButton.focus()
                await page.keyboard.press('Enter')
            } else {
                await addButton.click()
            }
            const dialog = page.getByRole('dialog', { name: 'Add bot connection' })
            await expect(dialog).toBeVisible()
            await expectNoTechnicalLeakage(dialog, {
                label: `${platform} add-binding dialog`,
                checkUuidSubstrings: true
            })
            if (platform === 'Telegram') {
                await dialog.getByRole('button', { name: 'Cancel' }).focus()
                await page.keyboard.press('Enter')
                await expect(dialog).toHaveCount(0)
                await expect(addButton).toBeFocused()
                await page.keyboard.press('Enter')
                await expect(dialog).toBeVisible()
                await expectNoPageHorizontalOverflow(page, 'Messenger add-binding dialog at mobile width')
                await page.screenshot({
                    path: testInfo.outputPath('messenger-add-binding-mobile-en.png'),
                    animations: 'disabled'
                })
            }
            if (platform === 'MAX') {
                await dialog.getByRole('combobox', { name: 'Platform' }).click()
                await page.getByRole('option', { name: 'MAX', exact: true }).click()
            }
            await dialog.getByRole('textbox', { name: 'Bot username' }).fill(username)
            if (platform === 'Telegram') await dialog.getByRole('textbox', { name: 'Display name (optional)' }).fill(displayName)
            const submitBinding = async (): Promise<Response> => {
                const createResponse = waitForSettledMutationResponse(
                    page,
                    (response) =>
                        response.request().method() === 'POST' &&
                        response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings`),
                    { label: `Create ${platform} bot connection` }
                )
                const saveButton = dialog.getByRole('button', { name: 'Save connection' })
                if (platform === 'Telegram') {
                    await saveButton.focus()
                    await page.keyboard.press('Enter')
                } else {
                    await saveButton.click()
                }
                return createResponse
            }

            let response: Response
            if (platform === 'Telegram') {
                const bindingCollectionUrl = new URL(`/api/v1/applications/${applicationId}/bot-bindings`, api.baseURL as string)
                const bindingRouteMatcher = (url: URL) =>
                    url.origin === bindingCollectionUrl.origin && url.pathname === bindingCollectionUrl.pathname
                let injectedCsrfFailureCount = 0
                const injectCsrfFailureOnce = async (route: import('@playwright/test').Route) => {
                    if (route.request().method() === 'POST' && injectedCsrfFailureCount === 0) {
                        injectedCsrfFailureCount += 1
                        await route.fulfill({
                            status: 419,
                            contentType: 'application/json',
                            body: JSON.stringify({ error: 'E2E transient CSRF rejection' })
                        })
                        return
                    }
                    await route.continue()
                }
                await page.route(bindingRouteMatcher, injectCsrfFailureOnce)
                try {
                    response = await submitBinding()
                } finally {
                    await page.unroute(bindingRouteMatcher, injectCsrfFailureOnce)
                }
                expect(injectedCsrfFailureCount, 'The first Telegram create must exercise the auth client CSRF refresh path').toBe(1)
            } else {
                response = await submitBinding()
            }
            expect(response.status()).toBe(201)
            const createdBinding = (await response.json()) as { id: string; shortId: string; version: number }
            if (platform === 'Telegram') await expect(addButton).toBeFocused()
            const platformLabel = platform
            const copyButton = page.getByRole('button', { name: `Copy ${platformLabel} launch link for ${username}` })
            await expect(copyButton).toBeVisible()
            await copyButton.click()
            const expectedLaunchUrl =
                platform === 'Telegram'
                    ? `https://t.me/${username}?startapp=${createdBinding.shortId}`
                    : `https://max.ru/${username}?startapp=${createdBinding.shortId}`
            await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(expectedLaunchUrl)
            return createdBinding
        }

        const telegramBinding = await createBinding('Telegram', telegramUsername)
        await createBinding('MAX', maxUsername)
        await expect(page.getByLabel(displayName)).toBeVisible()
        await expect(page.getByText(displayName, { exact: true })).toBeVisible()

        for (const width of [1920, 768, 390, 320]) {
            await page.setViewportSize({ width, height: width === 1920 ? 1080 : width === 768 ? 1024 : width === 320 ? 740 : 844 })
            await page.getByTestId('messenger-binding-card').first().scrollIntoViewIfNeeded()
            await expectNoPageHorizontalOverflow(page, `Messenger bot bindings at ${width}px`)
            for (const card of await page.getByTestId('messenger-binding-card').all()) {
                await expectLocatorHasNoInlineOverflow(card, `Messenger bot binding card at ${width}px`)
                if (width <= 390) await expectMessengerBindingCardNotClipped(card, width)
            }
            if (width <= 390) {
                await expectMessengerTextNotClipped(page.getByText(displayName, { exact: true }), 'Long display name', width)
                await expectMessengerTextNotClipped(
                    page.getByText(`Telegram · @${telegramUsername}`, { exact: true }),
                    'Telegram username',
                    width
                )
                await expectMessengerTextNotClipped(page.getByText(`MAX · @${maxUsername}`, { exact: true }), 'Long MAX username', width)
            }
            await page.screenshot({
                path: testInfo.outputPath(`messenger-bindings-${width}-en.png`),
                animations: 'disabled'
            })
        }
        await expectNoTechnicalLeakage(page.locator('main'), {
            label: 'Messenger bot bindings settings',
            checkUuidSubstrings: true
        })
        for (const actionName of [
            `Copy Telegram launch link for ${telegramUsername}`,
            `Edit ${telegramUsername} connection`,
            `Release ${telegramUsername} connection`
        ]) {
            const box = await page.getByRole('button', { name: actionName }).boundingBox()
            expect(box?.width ?? 0, `${actionName} touch target width`).toBeGreaterThanOrEqual(44)
            expect(box?.height ?? 0, `${actionName} touch target height`).toBeGreaterThanOrEqual(44)
        }

        const editBindingButton = page.getByRole('button', { name: `Edit ${telegramUsername} connection` })
        await editBindingButton.focus()
        await page.keyboard.press('Enter')
        const editDialog = page.getByRole('dialog', { name: 'Edit bot connection' })
        await expect(editDialog).toBeVisible()
        await expectNoTechnicalLeakage(editDialog, { label: 'Messenger edit-binding dialog', checkUuidSubstrings: true })
        await editDialog.getByRole('button', { name: 'Cancel' }).focus()
        await page.keyboard.press('Enter')
        await expect(editDialog).toHaveCount(0)
        await expect(editBindingButton).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(editDialog).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Messenger edit-binding dialog at mobile width')
        await page.screenshot({
            path: testInfo.outputPath('messenger-edit-binding-mobile-en.png'),
            animations: 'disabled'
        })
        const editStatus = editDialog.getByRole('combobox', { name: 'Connection status' })
        await editStatus.focus()
        await page.keyboard.press('Enter')
        await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
        const activateResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`),
            { label: 'Activate Telegram connection' }
        )
        await editDialog.getByRole('button', { name: 'Save connection' }).focus()
        await page.keyboard.press('Enter')
        expect((await activateResponse).ok()).toBe(true)
        await expect(editBindingButton).toBeFocused()
        await expect(page.getByTestId('application-messenger-bindings').getByText('Enabled', { exact: true })).toBeVisible()
        await expect(await readAttribution(api.baseURL as string, alias, telegramBinding.shortId)).toEqual({ platform: 'telegram' })

        for (const [method, path, body] of [
            [
                'PATCH',
                `/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`,
                { expectedVersion: telegramBinding.version, status: 'disabled' }
            ],
            [
                'DELETE',
                `/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`,
                { expectedVersion: telegramBinding.version }
            ]
        ] as const) {
            const staleResponse = await sendWithCsrf(api, method, path, body)
            expect(staleResponse.status).toBe(409)
            const staleBody = (await staleResponse.json()) as {
                conflict?: { entityId?: string; entityType?: string; expectedVersion?: number; actualVersion?: number }
            }
            expect(staleBody.conflict).toMatchObject({
                entityId: telegramBinding.id,
                entityType: 'application_bot_binding',
                expectedVersion: telegramBinding.version,
                actualVersion: telegramBinding.version + 1
            })
        }
        const bindingListResponse = await sendWithCsrf(api, 'GET', `/api/v1/applications/${applicationId}/bot-bindings`)
        expect(bindingListResponse.status).toBe(200)
        const bindingListBody = (await bindingListResponse.json()) as {
            items?: Array<{ id: string; status: string; version: number }>
        }
        expect(bindingListBody.items?.find(({ id }) => id === telegramBinding.id)).toMatchObject({ status: 'active', version: 2 })

        await page.getByRole('button', { name: `Edit ${telegramUsername} connection` }).click()
        const staleEditDialog = page.getByRole('dialog', { name: 'Edit bot connection' })
        await staleEditDialog.getByRole('textbox', { name: 'Display name (optional)' }).fill('A stale browser edit')
        const concurrentUpdate = await sendWithCsrf(
            api,
            'PATCH',
            `/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`,
            {
                displayName: 'Updated in another session',
                expectedVersion: 2
            }
        )
        expect(concurrentUpdate.status).toBe(200)
        const staleSaveResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`),
            { label: 'Submit stale Telegram connection edit' }
        )
        await staleEditDialog.getByRole('button', { name: 'Save connection' }).click()
        expect((await staleSaveResponse).status()).toBe(409)
        await expect(staleEditDialog.getByRole('alert')).toContainText('This connection changed elsewhere. Reload it and try again.')
        await staleEditDialog.getByRole('button', { name: 'Cancel' }).click()
        await page.reload()
        await page.getByRole('tab', { name: 'Bots and connections' }).click()
        await expect(page.getByText('Updated in another session', { exact: true })).toBeVisible()

        await page.getByRole('button', { name: `Edit ${telegramUsername} connection` }).click()
        const disableDialog = page.getByRole('dialog', { name: 'Edit bot connection' })
        await disableDialog.getByRole('combobox', { name: 'Connection status' }).click()
        await page.getByRole('option', { name: 'Disabled', exact: true }).click()
        const disableResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`),
            { label: 'Disable Telegram connection' }
        )
        await disableDialog.getByRole('button', { name: 'Save connection' }).click()
        expect((await disableResponse).ok()).toBe(true)
        await expect(await readAttribution(api.baseURL as string, alias, telegramBinding.shortId)).toEqual({ platform: null })

        await page.getByRole('button', { name: `Edit ${telegramUsername} connection` }).click()
        const reactivateDialog = page.getByRole('dialog', { name: 'Edit bot connection' })
        await reactivateDialog.getByRole('combobox', { name: 'Connection status' }).click()
        await page.getByRole('option', { name: 'Enabled', exact: true }).click()
        const reactivateResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`),
            { label: 'Reactivate Telegram connection' }
        )
        await reactivateDialog.getByRole('button', { name: 'Save connection' }).click()
        expect((await reactivateResponse).ok()).toBe(true)
        await expect(await readAttribution(api.baseURL as string, alias, telegramBinding.shortId)).toEqual({ platform: 'telegram' })

        const releaseBindingButton = page.getByRole('button', { name: `Release ${telegramUsername} connection` })
        await releaseBindingButton.focus()
        await page.keyboard.press('Enter')
        const releaseDialog = page.getByRole('dialog', { name: 'Release this bot connection?' })
        await expect(releaseDialog).toBeVisible()
        await expectNoTechnicalLeakage(releaseDialog, { label: 'Messenger release-binding dialog', checkUuidSubstrings: true })
        const releaseConfirmButton = releaseDialog.getByRole('button', { name: 'Release', exact: true })
        await expectMessengerTextNotClipped(releaseConfirmButton, 'Release confirmation action', 320)
        await releaseDialog.getByRole('button', { name: 'Cancel' }).focus()
        await page.keyboard.press('Enter')
        await expect(releaseDialog).toHaveCount(0)
        await expect(releaseBindingButton).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(releaseDialog).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Messenger release-binding dialog at mobile width')
        await page.screenshot({
            path: testInfo.outputPath('messenger-release-binding-mobile-en.png'),
            animations: 'disabled'
        })
        const releaseResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' &&
                response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings/${telegramBinding.id}`),
            { label: 'Release Telegram connection' }
        )
        await releaseConfirmButton.focus()
        await page.keyboard.press('Enter')
        expect((await releaseResponse).ok()).toBe(true)
        await expect(page.getByRole('button', { name: `Copy Telegram launch link for ${telegramUsername}` })).toHaveCount(0)
        await expect(await readAttribution(api.baseURL as string, alias, telegramBinding.shortId)).toEqual({ platform: null })

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.setViewportSize({ width: 320, height: 740 })
        await page.goto(`/a/${applicationId}/admin/settings`)
        await expect(page.getByRole('heading', { name: 'Настройки приложения' })).toBeVisible()
        await page.getByRole('tab', { name: 'Боты и подключения' }).click()
        await expect(page.getByText('Подключите бота Telegram или MAX к этому публичному приложению.')).toBeVisible()
        await expectNoPageHorizontalOverflow(page, 'Messenger application settings at mobile width')
        await page.screenshot({
            path: testInfo.outputPath('messenger-settings-mobile-ru.png'),
            animations: 'disabled'
        })
        await page.getByRole('button', { name: 'Добавить подключение бота' }).click()
        const russianBindingDialog = page.getByRole('dialog', { name: 'Добавить подключение бота' })
        await expectNoPageHorizontalOverflow(page, 'Messenger add-binding dialog at Russian mobile width')
        await page.screenshot({
            path: testInfo.outputPath('messenger-add-binding-mobile-ru.png'),
            animations: 'disabled'
        })
        await russianBindingDialog.getByRole('combobox', { name: 'Платформа' }).click()
        await page.getByRole('option', { name: 'MAX', exact: true }).click()
        await russianBindingDialog.getByRole('textbox', { name: 'Имя пользователя бота' }).fill('@invalidbot')
        await russianBindingDialog.getByRole('button', { name: 'Сохранить подключение' }).click()
        await expect(russianBindingDialog.getByText('Имя пользователя MAX не должно содержать @.', { exact: true })).toBeVisible()
        await expectLocalizedValidation(russianBindingDialog, 'ru', { label: 'Messenger Russian MAX binding validation' })
        await expectNoPageHorizontalOverflow(page, 'Messenger add-binding validation at Russian mobile width')

        const invitedMember = await addApplicationMember(api, applicationId as string, {
            email: nonMemberEmail,
            role: 'member'
        })
        expect(invitedMember).toMatchObject({ role: 'member' })
        const memberBindingsResponse = await nonMemberSession.page.request.get(
            new URL(`/api/v1/applications/${applicationId}/bot-bindings`, api.baseURL as string).toString()
        )
        expect(memberBindingsResponse.status()).toBe(403)

        await applyBrowserPreferences(nonMemberSession.page, { language: 'en' })
        await nonMemberSession.page.goto(`/a/${applicationId}/admin/settings`)
        await expect.poll(() => new URL(nonMemberSession!.page.url()).pathname).toBe(`/a/${applicationId}`)
        await expect(nonMemberSession.page.getByRole('heading', { name: 'Application Settings' })).toHaveCount(0)
        await expect(nonMemberSession.page.getByRole('tab', { name: 'Bots and connections' })).toHaveCount(0)
        await expect(nonMemberSession.page.getByRole('button', { name: 'Add bot connection' })).toHaveCount(0)
        await expectNoTechnicalLeakage(nonMemberSession.page.locator('main'), {
            label: 'Messenger application settings denied to a member',
            checkUuidSubstrings: true
        })

        await updateApplicationMember(api, applicationId as string, invitedMember.id, { role: 'admin' })
        await applyBrowserPreferences(nonMemberSession.page, { language: 'en' })
        await nonMemberSession.page.goto(`/a/${applicationId}/admin/settings`)
        await expect(nonMemberSession.page.getByRole('heading', { name: 'Application Settings' })).toBeVisible()
        const administratorBindingsResponse = nonMemberSession.page.waitForResponse(
            (response) =>
                response.request().method() === 'GET' && response.url().endsWith(`/api/v1/applications/${applicationId}/bot-bindings`)
        )
        await nonMemberSession.page.getByRole('tab', { name: 'Bots and connections' }).click()
        expect((await administratorBindingsResponse).status()).toBe(200)
        await expect(nonMemberSession.page.getByTestId('application-messenger-bindings')).toBeVisible()
        await expectNoTechnicalLeakage(nonMemberSession.page.locator('main'), {
            label: 'Messenger application admin settings',
            checkUuidSubstrings: true
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto('/applications')
        await expect(page.getByRole('heading', { name: 'Applications', exact: true })).toBeVisible()
        await expect(page.getByText(applicationName, { exact: true })).toBeVisible()
        await page.getByTestId(buildEntityMenuTriggerSelector('application', applicationId as string)).click()
        await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
        const copyApplicationDialog = page.getByRole('dialog', { name: 'Copying Application' })
        await expect(copyApplicationDialog).toBeVisible()
        await expectNoTechnicalLeakage(copyApplicationDialog, { label: 'Messenger application copy dialog', checkUuidSubstrings: true })
        const copiedApplicationName = `E2E ${runManifest.runId} Messenger bindings copy`
        await copyApplicationDialog.getByRole('textbox', { name: 'Name' }).fill(copiedApplicationName)
        const copyResponsePromise = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/applications/${applicationId}/copy`),
            { label: 'Copy Messenger Application' }
        )
        await copyApplicationDialog.getByRole('button', { name: 'Copy', exact: true }).click()
        const copyResponse = await copyResponsePromise
        expect(copyResponse.status()).toBe(201)
        const copiedApplication = (await copyResponse.json()) as { id: string }
        expect(copiedApplication.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu)
        await recordCreatedApplication({ id: copiedApplication.id })
        await expect(page.getByText(copiedApplicationName, { exact: true })).toBeVisible({ timeout: 30_000 })
        expect(await getApplication(api, copiedApplication.id)).toMatchObject({ isPublic: true, showInAppList: false })
        const copiedBindingsResponse = await requestApi(api, `/api/v1/applications/${copiedApplication.id}/bot-bindings`)
        expect(copiedBindingsResponse.status).toBe(200)
        expect(await copiedBindingsResponse.json()).toEqual({ items: [] })

        await page.getByTestId(buildEntityMenuTriggerSelector('application', copiedApplication.id)).click()
        await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
        const deleteCopiedDialog = page.getByRole('dialog', { name: 'Delete Application?' })
        await expect(deleteCopiedDialog).toBeVisible()
        await expectNoTechnicalLeakage(deleteCopiedDialog, {
            label: 'Copied Messenger application delete confirmation',
            checkUuidSubstrings: true
        })
        const deleteCopiedResponsePromise = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'DELETE' && response.url().endsWith(`/api/v1/applications/${copiedApplication.id}`),
            { label: 'Delete copied Messenger Application' }
        )
        await deleteCopiedDialog.getByRole('button', { name: 'Delete', exact: true }).click()
        expect((await deleteCopiedResponsePromise).status()).toBe(204)
        await expect(page.getByText(copiedApplicationName, { exact: true })).toHaveCount(0)
        expect((await requestApi(api, `/api/v1/applications/${copiedApplication.id}`)).status).toBe(403)
        const remainingApplications = await listApplications(api, { limit: 100, offset: 0, search: copiedApplicationName })
        expect(remainingApplications.items).not.toContainEqual(expect.objectContaining({ id: copiedApplication.id }))
    } finally {
        const cleanupTasks: Array<{ label: string; close: () => Promise<unknown> }> = []
        if (nonMemberSession) cleanupTasks.push({ label: 'non-member browser context', close: () => nonMemberSession!.context.close() })
        if (privilegedSession) cleanupTasks.push({ label: 'privileged browser context', close: () => privilegedSession!.context.close() })
        cleanupTasks.push({ label: 'API context', close: () => disposeApiContext(api) })
        const cleanupResults = await Promise.allSettled(cleanupTasks.map(({ close }) => close()))
        const failedCleanupLabels = cleanupResults.flatMap((result, index) =>
            result.status === 'rejected' ? [cleanupTasks[index]?.label ?? 'unknown context'] : []
        )
        if (failedCleanupLabels.length > 0) {
            await testInfo.attach('messenger-bindings-cleanup-failures.txt', {
                body: `Best-effort cleanup could not close: ${failedCleanupLabels.join(', ')}`,
                contentType: 'text/plain'
            })
        }
    }
})
