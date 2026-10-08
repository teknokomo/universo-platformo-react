import { createLocalizedContent } from '@universo-react/utils'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import {
    addApplicationMember,
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getAssignableRoles,
    listObjectCollections,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    recordCreatedApplication,
    recordCreatedGlobalUser,
    recordCreatedMetahub,
    recordCreatedPublication
} from '../../support/backend/run-manifest.mjs'
import { waitForUser } from '../../support/appRuntimeViewsTestSupport'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeNavigationIconSemantics,
    waitForLayoutFrame
} from '../../support/browser/runtimeUx'

function readCodename(value: unknown): string {
    if (typeof value === 'string') return value
    if (!value || typeof value !== 'object' || Array.isArray(value)) return ''

    const record = value as { locales?: Record<string, { content?: unknown }>; _primary?: unknown }
    const primary = typeof record._primary === 'string' ? record._primary : 'en'
    const primaryContent = record.locales?.[primary]?.content
    if (typeof primaryContent === 'string') return primaryContent

    const englishContent = record.locales?.en?.content
    return typeof englishContent === 'string' ? englishContent : ''
}

async function expectDashboardHeaderControls(page: Page, label: string): Promise<void> {
    const header = page.getByTestId('runtime-header')
    const actions = page.getByTestId('runtime-header-actions')
    const language = page.getByTestId('runtime-language-switcher')
    const colorMode = page.getByRole('button', { name: /^(?:color mode|цветовая схема)$/iu })

    await waitForLayoutFrame(page)
    await expect(header, `${label}: runtime header must be visible`).toBeVisible()
    await expect(actions, `${label}: header actions must be visible`).toBeVisible()
    await expect(language, `${label}: language control must be visible`).toBeVisible()
    await expect(colorMode, `${label}: color-mode control must be visible`).toBeVisible()
    await expect(language, `${label}: render exactly one language control`).toHaveCount(1)
    await expect(colorMode, `${label}: render exactly one color-mode control`).toHaveCount(1)
    await expect(colorMode, `${label}: color-mode control must have an accessible name`).toHaveAttribute('aria-label', /\S/u)

    const viewport = page.viewportSize()
    const [headerBounds, actionsBounds, languageBounds, colorModeBounds] = await Promise.all([
        header.boundingBox(),
        actions.boundingBox(),
        language.boundingBox(),
        colorMode.boundingBox()
    ])
    expect(viewport, `${label}: viewport dimensions must be available`).not.toBeNull()
    expect(headerBounds, `${label}: header geometry must be available`).not.toBeNull()
    expect(actionsBounds, `${label}: header-action geometry must be available`).not.toBeNull()
    expect(languageBounds, `${label}: language-control geometry must be available`).not.toBeNull()
    expect(colorModeBounds, `${label}: color-mode geometry must be available`).not.toBeNull()

    if (!viewport || !headerBounds || !actionsBounds || !languageBounds || !colorModeBounds) return

    expect(actionsBounds.x + actionsBounds.width, `${label}: controls must remain at the right side of the header`).toBeGreaterThanOrEqual(
        viewport.width - 80
    )
    for (const bounds of [languageBounds, colorModeBounds]) {
        expect(bounds.x, `${label}: control must remain inside the header action group`).toBeGreaterThanOrEqual(actionsBounds.x)
        expect(bounds.x + bounds.width, `${label}: control must remain inside the header action group`).toBeLessThanOrEqual(
            actionsBounds.x + actionsBounds.width
        )
        expect(bounds.y, `${label}: control must remain inside the header`).toBeGreaterThanOrEqual(headerBounds.y)
        expect(bounds.y + bounds.height, `${label}: control must remain inside the header`).toBeLessThanOrEqual(
            headerBounds.y + headerBounds.height
        )
    }

    const controlsOverlap =
        languageBounds.x < colorModeBounds.x + colorModeBounds.width &&
        languageBounds.x + languageBounds.width > colorModeBounds.x &&
        languageBounds.y < colorModeBounds.y + colorModeBounds.height &&
        languageBounds.y + languageBounds.height > colorModeBounds.y
    expect(controlsOverlap, `${label}: language and color-mode controls must not overlap`).toBe(false)

    await colorMode.focus()
    await page.keyboard.press('Enter')
    const colorModeMenu = page.getByRole('menu').last()
    await expect(colorModeMenu, `${label}: keyboard activation must open the color-mode menu`).toBeVisible()
    await expect(colorModeMenu.getByRole('menuitem'), `${label}: color-mode menu must expose the three standard choices`).toHaveCount(3)
    await page.keyboard.press('Escape')
    await expect(colorModeMenu, `${label}: Escape must close the color-mode menu`).toBeHidden()
    await expect(colorMode, `${label}: closing the color-mode menu must restore keyboard focus`).toBeFocused()
}

test.describe('Published Dashboard navigation', () => {
    test('@flow keeps navigation curated, permission-gates authoring, and renders semantic LMS icons', async ({
        page,
        browser,
        runManifest
    }, testInfo) => {
        test.setTimeout(240_000)

        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const metahubName = `E2E ${runManifest.runId} generated LMS navigation`
        const metahubCodename = `${runManifest.runId}-generated-lms-navigation`
        const publicationName = `E2E ${runManifest.runId} Generated LMS Navigation Publication`
        const applicationName = `E2E ${runManifest.runId} Generated LMS Navigation Application`
        const waitForRuntimeResponse = (targetPage: Page, runtimeApplicationId: string) =>
            targetPage.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'GET' && url.pathname === `/api/v1/applications/${runtimeApplicationId}/runtime`
            })
        const memberCredentials = {
            email: `e2e+${runManifest.runId}.lms-navigation-member@example.test`,
            password: process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
        }
        let bootstrapApi: Awaited<ReturnType<typeof createBootstrapApiContext>> | null = null
        let memberBrowser: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename),
                templateCodename: 'lms'
            })
            if (typeof metahub?.id !== 'string') throw new Error('LMS navigation coverage did not create its metahub')
            await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

            const objectPayload = await listObjectCollections(api, metahub.id, { limit: 500, offset: 0 })
            const objectCodenames = (objectPayload?.items ?? [])
                .map((item: Record<string, unknown>) => readCodename(item.codename))
                .filter(Boolean)
            expect(objectCodenames).toEqual(expect.arrayContaining(['ProgressLedger', 'ScoreLedger']))

            const publication = await createPublication(api, metahub.id, {
                name: { en: publicationName },
                namePrimaryLocale: 'en',
                autoCreateApplication: false
            })
            if (!publication?.id) throw new Error('LMS navigation publication creation did not return an id')
            await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })

            await createPublicationVersion(api, metahub.id, publication.id, {
                name: { en: `E2E ${runManifest.runId} Generated LMS Navigation Version` },
                namePrimaryLocale: 'en'
            })
            await syncPublication(api, metahub.id, publication.id)
            await waitForPublicationReady(api, metahub.id, publication.id)

            const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
                name: { en: applicationName },
                namePrimaryLocale: 'en',
                createApplicationSchema: false
            })
            const applicationId = linkedApplication?.application?.id
            if (typeof applicationId !== 'string') throw new Error('LMS navigation coverage did not create an application')
            await recordCreatedApplication({ id: applicationId })
            await syncApplicationSchema(api, applicationId)

            bootstrapApi = await createBootstrapApiContext()
            const assignableRoles = await getAssignableRoles(bootstrapApi)
            const requiredRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
                .split(',')
                .map((codename) => codename.trim().toLowerCase())
                .filter(Boolean)
            const roleIds = requiredRoleCodenames.map((codename) => {
                const roleId = assignableRoles.find((role: { codename?: unknown }) => String(role.codename).toLowerCase() === codename)?.id
                if (typeof roleId !== 'string') throw new Error(`Assignable global role ${codename} was not found`)
                return roleId
            })
            const createdMember = await createAdminUser(bootstrapApi, {
                ...memberCredentials,
                roleIds,
                comment: `LMS navigation permission coverage ${runManifest.runId}`
            })
            if (!createdMember?.userId) throw new Error('LMS navigation member account was not created')
            await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberCredentials.email })
            await waitForUser(memberCredentials)
            await addApplicationMember(api, applicationId, { email: memberCredentials.email, role: 'member' })
            memberBrowser = await createLoggedInBrowserContext(browser, memberCredentials)
            const memberRuntimeResponsePromise = waitForRuntimeResponse(memberBrowser.page, applicationId)
            await memberBrowser.page.goto(`/a/${applicationId}`)
            const memberRuntimeResponse = await memberRuntimeResponsePromise
            expect(memberRuntimeResponse.ok(), 'Member published application runtime response').toBe(true)
            const memberNavigation = memberBrowser.page.getByRole('navigation', { name: 'Application navigation', exact: true })
            await expect(memberNavigation).toBeVisible()
            await expect(memberNavigation.getByRole('link', { name: 'Reports', exact: true })).toHaveCount(0)
            await expect(memberNavigation.getByRole('link', { name: 'Knowledge Articles', exact: true })).toHaveCount(0)
            await expect(memberNavigation.getByRole('link', { name: 'Courses', exact: true })).toBeVisible()
            await expectNoTechnicalLeakage(memberNavigation, {
                label: 'Published LMS Dashboard member navigation',
                checkUuidSubstrings: true
            })
            await testInfo.attach('published-lms-generated-navigation-member.png', {
                body: await memberBrowser.page.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })

            const effectiveLayoutResponsePromise = page.waitForResponse((response) => {
                const url = new URL(response.url())
                return (
                    response.request().method() === 'GET' &&
                    url.pathname === `/api/v1/applications/${applicationId}/runtime/effective-layout`
                )
            })
            const initialRuntimeResponsePromise = waitForRuntimeResponse(page, applicationId)
            await page.goto(`/a/${applicationId}`)
            const [effectiveLayoutResponse, initialRuntimeResponse] = await Promise.all([
                effectiveLayoutResponsePromise,
                initialRuntimeResponsePromise
            ])
            expect(effectiveLayoutResponse.ok()).toBe(true)
            expect(initialRuntimeResponse.ok(), 'Initial published application runtime response').toBe(true)
            const effectiveLayout = (await effectiveLayoutResponse.json()) as {
                widgets?: Array<{ widgetKey?: string; runtimeData?: { status?: string; data?: unknown } }>
            }
            const generatedMenuState = effectiveLayout.widgets?.find((widget) => widget.widgetKey === 'menuWidget')?.runtimeData
            expect(generatedMenuState?.status).toBe('ready')
            const generatedMenu = generatedMenuState?.data as
                | {
                      items?: Array<{
                          kind?: string
                          target?: { kind?: string; codename?: string }
                          icon?: string | null
                      }>
                  }
                | undefined
            expect(generatedMenu).toBeDefined()
            const menuItems = generatedMenu?.items ?? []
            const pageTargets = menuItems.filter((item) => item.target?.kind === 'page')
            expect(pageTargets.map((item) => item.target?.codename).sort()).toEqual(
                [
                    'AssignmentInstructions',
                    'CertificatePolicy',
                    'CourseOverview',
                    'DevelopmentHome',
                    'KnowledgeArticle',
                    'KnowledgeHome',
                    'LearnerHome'
                ].sort()
            )
            const objectTargets = menuItems.filter((item) => item.target?.kind === 'object')
            const primaryObjectCodenames = ['ContentProjects', 'Courses', 'KnowledgeArticles', 'LearningTracks', 'Reports', 'TrashEntries']
            expect(objectTargets.map((item) => item.target?.codename).sort()).toEqual([...primaryObjectCodenames].sort())
            for (const codename of objectCodenames.filter((value) => !primaryObjectCodenames.includes(value))) {
                expect(JSON.stringify(generatedMenu), `Generated navigation must not expose Object ${codename}`).not.toContain(codename)
            }

            const navigation = page.getByRole('navigation', { name: 'Application navigation', exact: true })
            await expect(navigation).toHaveCount(1)
            await expect(navigation).toBeVisible()
            const pageIconContracts = [
                { label: 'Welcome', icon: 'HomeRoundedIcon' },
                { label: 'Course Overview', icon: 'AnalyticsRoundedIcon' },
                { label: 'Knowledge Home', icon: 'AppsRoundedIcon' },
                { label: 'Knowledge Article Guide', icon: 'ArticleRoundedIcon' },
                { label: 'Development Home', icon: 'AssignmentRoundedIcon' },
                { label: 'Assignment Instructions', icon: 'SchoolRoundedIcon' },
                { label: 'Certificate Policy', icon: 'StarRoundedIcon' }
            ]
            const objectIconContracts = [
                { label: 'Content Projects', codename: 'ContentProjects', icon: 'FolderRoundedIcon' },
                { label: 'Courses', codename: 'Courses', icon: 'SchoolRoundedIcon' },
                { label: 'Knowledge Articles', codename: 'KnowledgeArticles', icon: 'ArticleRoundedIcon' },
                { label: 'Learning Tracks', codename: 'LearningTracks', icon: 'AssignmentRoundedIcon' },
                { label: 'Reports', codename: 'Reports', icon: 'AnalyticsRoundedIcon' },
                { label: 'Trash', codename: 'TrashEntries', icon: 'DeleteRoundedIcon' }
            ]
            await expect(navigation.locator('a[href*="targetKind=page"]')).toHaveCount(pageIconContracts.length)
            for (const { label } of pageIconContracts) {
                const pageLink = navigation.getByRole('link', { name: label, exact: true })
                await expect(pageLink, `LMS navigation must include the ${label} page`).toBeVisible()
            }
            await expectRuntimeNavigationIconSemantics(navigation, [
                ...pageIconContracts.map(({ label, icon }) => ({ label, family: icon })),
                ...objectIconContracts.map(({ label, icon }) => ({ label, family: icon }))
            ])
            for (const { label, codename } of objectIconContracts) {
                const objectLink = navigation.getByRole('link', { name: label, exact: true })
                await expect(objectLink, `Curated Object ${label} must be visible`).toBeVisible()
                await expect(objectLink).toHaveAttribute('href', new RegExp(`targetKind=object&entityTypeCodename=${codename}`, 'u'))
            }
            await expect(navigation.locator('a[href*="targetKind=object"]')).toHaveCount(primaryObjectCodenames.length)
            await expect(navigation.getByRole('heading', { name: 'Learning', exact: true })).toBeVisible()
            await expect(navigation.getByRole('button', { name: 'Learning', exact: true })).toHaveCount(0)
            const contentProjectsLink = navigation.getByRole('link', { name: 'Content Projects', exact: true })
            await expect(contentProjectsLink).toBeVisible()
            const contentProjectsRuntimeResponsePromise = waitForRuntimeResponse(page, applicationId)
            await contentProjectsLink.click()
            await expect(page).toHaveURL(/targetKind=object&entityTypeCodename=ContentProjects/u)
            const contentProjectsRuntimeResponse = await contentProjectsRuntimeResponsePromise
            expect(contentProjectsRuntimeResponse.ok(), 'Content Projects runtime response').toBe(true)
            await expect(page.getByTestId('runtime-main-content')).toBeVisible()
            const returnHomeRuntimeResponsePromise = waitForRuntimeResponse(page, applicationId)
            await page.goto(`/a/${applicationId}`)
            const returnHomeRuntimeResponse = await returnHomeRuntimeResponsePromise
            expect(returnHomeRuntimeResponse.ok(), 'Return-to-home runtime response').toBe(true)
            await expect(navigation.getByRole('link', { name: 'Welcome', exact: true })).toBeVisible()
            await expectNoTechnicalLeakage(navigation, {
                label: 'Published LMS Dashboard desktop navigation',
                checkUuidSubstrings: true
            })
            for (const viewport of [
                { name: 'desktop-wide', width: 1920, height: 1080, openDrawer: false },
                { name: 'tablet', width: 768, height: 1024, openDrawer: true }
            ]) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                const viewportRuntimeResponsePromise = waitForRuntimeResponse(page, applicationId)
                await page.goto(`/a/${applicationId}`)
                const viewportRuntimeResponse = await viewportRuntimeResponsePromise
                expect(viewportRuntimeResponse.ok(), `Published LMS Dashboard ${viewport.name} runtime response`).toBe(true)
                await expectDashboardHeaderControls(page, `Published LMS Dashboard ${viewport.name}`)
                let viewportNavigation = page.getByRole('navigation', { name: 'Application navigation', exact: true })
                if (viewport.openDrawer) {
                    const menuButton = page.getByRole('button', { name: 'Open menu', exact: true })
                    await expect(menuButton).toBeVisible()
                    await menuButton.focus()
                    await page.keyboard.press('Enter')
                    viewportNavigation = page.getByRole('navigation', { name: 'Application navigation', exact: true })
                }
                await expect(viewportNavigation).toBeVisible()
                await expect(viewportNavigation.locator('a[href*="targetKind=page"]')).toHaveCount(pageIconContracts.length)
                await expect(viewportNavigation.locator('a[href*="targetKind=object"]')).toHaveCount(primaryObjectCodenames.length)
                for (const { label } of [...pageIconContracts, ...objectIconContracts]) {
                    const link = viewportNavigation.getByRole('link', { name: label, exact: true })
                    await expect(link).toBeVisible()
                }
                await expectRuntimeNavigationIconSemantics(viewportNavigation, [
                    ...pageIconContracts.map(({ label, icon }) => ({ label, family: icon })),
                    ...objectIconContracts.map(({ label, icon }) => ({ label, family: icon }))
                ])
                await expectNoPageHorizontalOverflow(page, `Published LMS Dashboard ${viewport.name} navigation`)
                await testInfo.attach(`published-lms-generated-navigation-${viewport.name}.png`, {
                    body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
                    contentType: 'image/png'
                })
                if (viewport.openDrawer) {
                    await page.keyboard.press('Escape')
                    await expect(viewportNavigation).toBeHidden()
                    await expect(page.getByRole('button', { name: 'Open menu', exact: true })).toBeFocused()
                }
            }

            await expect(navigation.getByText('Progress Ledger', { exact: true })).toHaveCount(0)
            await expect(navigation.getByText('Score Ledger', { exact: true })).toHaveCount(0)
            await expectNoPageHorizontalOverflow(page, 'Published LMS Dashboard navigation')
            await testInfo.attach('published-lms-generated-navigation.png', {
                body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                contentType: 'image/png'
            })

            await page.setViewportSize({ width: 390, height: 844 })
            await expectDashboardHeaderControls(page, 'Published LMS Dashboard mobile')
            await expectNoPageHorizontalOverflow(page, 'Published LMS Dashboard mobile navigation before opening the drawer')
            const openMenuButton = page.getByRole('button', { name: 'Open menu', exact: true })
            await expect(openMenuButton).toBeVisible()
            await openMenuButton.focus()
            await expect(openMenuButton).toBeFocused()
            await page.keyboard.press('Enter')
            const mobileNavigation = page.getByRole('navigation', { name: 'Application navigation', exact: true })
            await expect(mobileNavigation).toHaveCount(1)
            await expect(mobileNavigation).toBeVisible()
            await expect(mobileNavigation.locator('a[href*="targetKind=page"]')).toHaveCount(pageIconContracts.length)
            for (const { label } of pageIconContracts) {
                const pageLink = mobileNavigation.getByRole('link', { name: label, exact: true })
                await expect(pageLink).toBeVisible()
            }
            for (const { label, codename } of objectIconContracts) {
                const objectLink = mobileNavigation.getByRole('link', { name: label, exact: true })
                await expect(objectLink, `Mobile navigation must include curated Object ${label}`).toBeVisible()
                await expect(objectLink).toHaveAttribute('href', new RegExp(`targetKind=object&entityTypeCodename=${codename}`, 'u'))
            }
            await expectRuntimeNavigationIconSemantics(mobileNavigation, [
                ...pageIconContracts.map(({ label, icon }) => ({ label, family: icon })),
                ...objectIconContracts.map(({ label, icon }) => ({ label, family: icon }))
            ])
            await expect(mobileNavigation.locator('a[href*="targetKind=object"]')).toHaveCount(primaryObjectCodenames.length)
            await expect(mobileNavigation.getByRole('link', { name: 'Content Projects', exact: true })).toBeVisible()
            await expectNoTechnicalLeakage(mobileNavigation, {
                label: 'Published LMS Dashboard mobile navigation',
                checkUuidSubstrings: true
            })
            await expectNoPageHorizontalOverflow(page, 'Published LMS Dashboard mobile navigation with drawer open')
            await testInfo.attach('published-lms-generated-navigation-mobile.png', {
                body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
                contentType: 'image/png'
            })
            await page.keyboard.press('Escape')
            await expect(mobileNavigation).toBeHidden()
            await expect(openMenuButton).toBeFocused()
            await expectNoPageHorizontalOverflow(page, 'Published LMS Dashboard mobile navigation after closing the drawer')

            await page.getByTestId('runtime-language-switcher').click()
            const russianRuntimeResponsePromise = waitForRuntimeResponse(page, applicationId)
            await page.getByRole('menuitem', { name: 'Russian', exact: true }).click()
            await expect(page).toHaveURL(/(?:\?|&)locale=ru(?:&|$)/u)
            const russianRuntimeResponse = await russianRuntimeResponsePromise
            expect(russianRuntimeResponse.ok(), 'Russian locale runtime response').toBe(true)
            const russianOpenMenuButton = page.getByRole('button', { name: 'Открыть меню', exact: true })
            await expect(russianOpenMenuButton).toBeVisible()
            await russianOpenMenuButton.focus()
            await page.keyboard.press('Enter')
            const russianNavigation = page.getByRole('navigation', { name: 'Навигация приложения', exact: true })
            await expect(russianNavigation).toBeVisible()
            const russianPageIconContracts = [
                { label: 'Добро пожаловать', icon: 'HomeRoundedIcon' },
                { label: 'Обзор курса', icon: 'AnalyticsRoundedIcon' },
                { label: 'Раздел знаний', icon: 'AppsRoundedIcon' },
                { label: 'Руководство по статьям базы знаний', icon: 'ArticleRoundedIcon' },
                { label: 'Раздел развития', icon: 'AssignmentRoundedIcon' },
                { label: 'Инструкции к заданию', icon: 'SchoolRoundedIcon' },
                { label: 'Правила сертификатов', icon: 'StarRoundedIcon' }
            ]
            const russianObjectIconContracts = [
                { label: 'Проекты контента', codename: 'ContentProjects', icon: 'FolderRoundedIcon' },
                { label: 'Курсы', codename: 'Courses', icon: 'SchoolRoundedIcon' },
                { label: 'Статьи базы знаний', codename: 'KnowledgeArticles', icon: 'ArticleRoundedIcon' },
                { label: 'Учебные треки', codename: 'LearningTracks', icon: 'AssignmentRoundedIcon' },
                { label: 'Отчёты', codename: 'Reports', icon: 'AnalyticsRoundedIcon' },
                { label: 'Корзина', codename: 'TrashEntries', icon: 'DeleteRoundedIcon' }
            ]
            await expect(russianNavigation.locator('a[href*="targetKind=page"]')).toHaveCount(russianPageIconContracts.length)
            await expect(russianNavigation.locator('a[href*="targetKind=object"]')).toHaveCount(russianObjectIconContracts.length)
            for (const { label } of [...russianPageIconContracts, ...russianObjectIconContracts]) {
                const link = russianNavigation.getByRole('link', { name: label, exact: true })
                await expect(link, `Russian LMS navigation must include ${label}`).toBeVisible()
            }
            await expectRuntimeNavigationIconSemantics(russianNavigation, [
                ...russianPageIconContracts.map(({ label, icon }) => ({ label, family: icon })),
                ...russianObjectIconContracts.map(({ label, icon }) => ({ label, family: icon }))
            ])
            for (const { label, codename } of russianObjectIconContracts) {
                await expect(russianNavigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
                    'href',
                    new RegExp(`targetKind=object&entityTypeCodename=${codename}`, 'u')
                )
            }
            await expectNoTechnicalLeakage(russianNavigation, {
                label: 'Published LMS Dashboard mobile Russian navigation',
                checkUuidSubstrings: true
            })
            await testInfo.attach('published-lms-generated-navigation-mobile-ru-drawer.png', {
                body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
                contentType: 'image/png'
            })
            await page.keyboard.press('Escape')
            await expect(russianNavigation).toBeHidden()
            await expect(russianOpenMenuButton).toBeFocused()
            await expectDashboardHeaderControls(page, 'Published LMS Dashboard mobile in Russian')
            await expectNoPageHorizontalOverflow(page, 'Published LMS Dashboard mobile header in Russian')
            await testInfo.attach('published-lms-generated-navigation-mobile-ru-header.png', {
                body: await page.screenshot({ fullPage: false, animations: 'disabled' }),
                contentType: 'image/png'
            })
        } finally {
            await memberBrowser?.context.close()
            if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
            await disposeApiContext(api)
        }
    })
})
