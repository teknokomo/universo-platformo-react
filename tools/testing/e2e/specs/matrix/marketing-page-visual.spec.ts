import { createLocalizedContent } from '@universo-react/utils'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplication,
    getApplicationLayout,
    listApplicationLayouts,
    listPublicationApplications,
    syncApplicationSchema,
    syncPublication,
    updateApplicationLayoutZoneSetting,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applyBrowserPreferences, calculateRelativeBrightness, parseRgbColor } from '../../support/browser/preferences'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'
import { storageStatePath } from '../../support/env/load-e2e-env.mjs'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const VIEWPORTS = [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
] as const

type BrowserIssue = {
    source: 'console' | 'pageerror' | 'requestfailed' | 'response'
    text: string
    status?: number
    url?: string
}

const languageMenuLabel = (menuLocale: string, targetLocale: string) => {
    const normalizedMenuLocale = menuLocale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const normalizedTargetLocale = targetLocale.split(/[-_]/)[0]?.toLowerCase() || 'en'

    if (normalizedMenuLocale === 'ru') {
        return normalizedTargetLocale === 'ru' ? /русский/i : /английский/i
    }

    return normalizedTargetLocale === 'ru' ? /russian/i : /english/i
}

/**
 * The private-application probe answers `204 No Content` and Chromium reports a
 * spurious `net::ERR_ABORTED` for that probe; the authenticated runtime then
 * loads normally. Only that exact, expected abort is ignored.
 */
const isExpectedPublicProbeAbort = (url: string, errorText: string | undefined): boolean =>
    errorText === 'net::ERR_ABORTED' && /\/api\/v1\/public\/applications\/[^/]+\/runtime(?:\?|$)/u.test(url)

function watchBrowserIssues(page: Page): BrowserIssue[] {
    const issues: BrowserIssue[] = []

    page.on('console', (message) => {
        if (message.type() === 'error') {
            issues.push({ source: 'console', text: message.text() })
        }
    })
    page.on('pageerror', (error) => {
        issues.push({ source: 'pageerror', text: error.message })
    })
    page.on('requestfailed', (request) => {
        const errorText = request.failure()?.errorText
        if (isExpectedPublicProbeAbort(request.url(), errorText)) return
        issues.push({
            source: 'requestfailed',
            text: errorText ?? 'Request failed',
            url: request.url()
        })
    })
    page.on('response', (response) => {
        if (response.url().includes('/api/') && response.status() >= 400) {
            issues.push({
                source: 'response',
                text: `${response.status()} ${response.request().method()}`,
                status: response.status(),
                url: response.url()
            })
        }
    })

    return issues
}

async function waitForLinkedApplication(api: ApiContext, metahubId: string, publicationId: string) {
    let application: Record<string, unknown> | null = null
    await expect
        .poll(async () => {
            const response = await listPublicationApplications(api, metahubId, publicationId)
            application = (response?.items ?? [])[0] ?? null
            return typeof application?.id === 'string'
        })
        .toBe(true)

    return application
}

async function provisionMarketingApplication(api: ApiContext, runId: string, attempt: number) {
    const metahubName = `E2E ${runId} marketing matrix`
    const metahubCodename = `${runId}-marketing-matrix-attempt-${attempt}`
    const metahub = await createMetahub(api, {
        name: { en: metahubName, ru: `Маркетинговая матрица ${runId}` },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', metahubCodename),
        templateCodename: 'marketing-page'
    })

    if (!metahub?.id) throw new Error('Marketing matrix metahub creation did not return an id')
    await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

    const publication = await createPublication(api, metahub.id, {
        name: { en: `E2E ${runId} Marketing Matrix Publication` },
        namePrimaryLocale: 'en',
        autoCreateApplication: true,
        applicationName: { en: `E2E ${runId} Marketing Matrix Application` },
        applicationNamePrimaryLocale: 'en',
        runtimePolicy: {
            workspaceMode: 'required',
            requiredWorkspaceModeAcknowledged: true
        }
    })

    if (!publication?.id) throw new Error('Marketing matrix publication did not return an id')
    await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
    await syncPublication(api, metahub.id, publication.id)
    await waitForPublicationReady(api, metahub.id, publication.id)

    const linkedApplication = await waitForLinkedApplication(api, metahub.id, publication.id)
    const applicationId = typeof linkedApplication?.id === 'string' ? linkedApplication.id : undefined
    if (!applicationId) throw new Error('Marketing matrix publication did not create an application')
    await recordCreatedApplication({
        id: applicationId
    })

    await syncApplicationSchema(api, applicationId, {
        schemaOptions: {
            workspaceModeRequested: 'enabled',
            acknowledgeIrreversibleWorkspaceEnablement: true
        }
    })
    await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus).toBe('synced')

    return applicationId
}

async function updateMarketingHeaderPosition(api: ApiContext, applicationId: string, position: 'fixed' | 'flow'): Promise<void> {
    const layouts = await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })
    const marketingLayout = layouts.items?.find((layout) => layout.templateKey === 'marketing-page')
    if (!marketingLayout?.id || typeof marketingLayout.version !== 'number') {
        throw new Error(`Application ${applicationId} did not expose a versioned marketing layout`)
    }
    const detail = await getApplicationLayout(api, applicationId, marketingLayout.id)
    await updateApplicationLayoutZoneSetting(
        api,
        applicationId,
        marketingLayout.id,
        'marketing-header',
        'position',
        position,
        detail.item.version
    )
}

async function assertMarketingPageAccessibility(page: Page, label: string) {
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        nodes: violation.nodes.map((node) => node.html)
    }))
    expect(violations, `${label} accessibility violations: ${JSON.stringify(violations)}`).toEqual([])
}

const readMarketingHeaderAnchorGeometry = async (page: Page) =>
    page.evaluate(() => {
        const header = document.querySelector<HTMLElement>('[data-testid="marketing-header-shell"]')
        const target = document.querySelector<HTMLElement>('#pricing')
        if (!header || !target) throw new Error('Marketing header anchor geometry was not rendered')

        const parsePixels = (value: string): number => {
            const parsed = Number.parseFloat(value)
            return Number.isFinite(parsed) ? parsed : 0
        }
        const headerRect = header.getBoundingClientRect()
        const rootStyles = window.getComputedStyle(document.documentElement)
        return {
            position: window.getComputedStyle(header).position,
            frameOffset: parsePixels(rootStyles.getPropertyValue('--template-frame-height')),
            visualOffset: parsePixels(header.dataset.marketingHeaderVisualOffset ?? ''),
            headerTop: headerRect.top,
            headerBottom: headerRect.bottom,
            headerHeight: headerRect.height,
            spacerHeight:
                document.querySelector<HTMLElement>('[data-testid="marketing-header-spacer"]')?.getBoundingClientRect().height ?? 0,
            occlusion: parsePixels(rootStyles.getPropertyValue('--marketing-header-occlusion')),
            scrollPadding: parsePixels(rootStyles.scrollPaddingBlockStart),
            targetTop: target.getBoundingClientRect().top
        }
    })

const expectMarketingHeaderAnchorGeometry = async (page: Page, label: string): Promise<void> => {
    const geometry = await readMarketingHeaderAnchorGeometry(page)
    expect(geometry.position, `${label} header position`).toBe('fixed')
    expect(geometry.visualOffset, `${label} original visual offset`).toBe(28)
    expect(Math.abs(geometry.headerTop - geometry.frameOffset - geometry.visualOffset), `${label} header top`).toBeLessThanOrEqual(1)
    expect(geometry.spacerHeight, `${label} must preserve the reference overlay contract without a document spacer`).toBe(0)
    expect(Math.abs(geometry.occlusion - geometry.headerBottom), `${label} occlusion`).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry.scrollPadding - geometry.occlusion), `${label} scroll padding`).toBeLessThanOrEqual(1)
    expect(geometry.targetTop, `${label} anchor must remain below the fixed header`).toBeGreaterThanOrEqual(geometry.headerBottom - 1)
}

test('@visual @marketing-page matrix preserves localized responsive visual contracts', async ({ browser, runManifest }, testInfo) => {
    test.setTimeout(300_000)

    const project = testInfo.project.name
    const isRussian = project.startsWith('ru-')
    const isDark = project.endsWith('-dark')
    const language = isRussian ? 'ru' : 'en'
    const locale = isRussian ? 'ru-RU' : 'en-US'
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const applicationId = await provisionMarketingApplication(api, `${runManifest.runId}-${project}`, testInfo.retry)

    try {
        for (const viewport of VIEWPORTS) {
            const context = await browser.newContext({
                storageState: storageStatePath,
                locale,
                colorScheme: isDark ? 'dark' : 'light',
                viewport: { width: viewport.width, height: viewport.height }
            })
            const page = await context.newPage()

            try {
                await applyBrowserPreferences(page, { language, isDarkMode: isDark })
                const localMedia = await installMarketingPageLocalMedia(page)
                const browserIssues = watchBrowserIssues(page)
                await page.goto(`/a/${applicationId}`)

                await expect(page.locator('html')).toHaveAttribute('lang', language)
                await expect(page.locator('#marketing-page-main')).toBeVisible()
                await expect(page.getByRole('link', { name: isRussian ? 'Перейти к содержимому' : 'Skip to content' })).toHaveCount(0)
                await expect(page.locator('#hero')).toBeVisible()
                const backgroundOwnership = await page.evaluate(() => {
                    const pageRoot = document.querySelector<HTMLElement>('[data-testid="marketing-page-root"]')
                    const hero = document.querySelector<HTMLElement>('#hero')
                    if (!pageRoot || !hero) throw new Error('Marketing page background ownership was not rendered')
                    return {
                        page: window.getComputedStyle(pageRoot).backgroundImage,
                        hero: window.getComputedStyle(hero).backgroundImage
                    }
                })
                expect(backgroundOwnership.page).toBe('none')
                expect(backgroundOwnership.hero).toContain('radial-gradient')
                await expect(page.locator('#logoCollection')).toBeVisible()
                await expect(page.locator('#features')).toBeVisible()
                await expect(page.locator('#testimonials')).toBeVisible()
                await expect(page.locator('#highlights')).toBeVisible()
                await expect(page.locator('#pricing')).toBeVisible()
                await expect(page.locator('#faq')).toBeVisible()
                await expect(page.locator('#footer')).toBeVisible()
                await expect(page.getByRole('heading', { name: isRussian ? 'Наши новые продукты' : 'Our latest products' })).toBeVisible()
                await expect(page.locator('#logoCollection img')).toHaveCount(6)
                await expect(page.locator('#features [aria-pressed]:visible')).toHaveCount(3)
                await expect(page.locator('#testimonials .MuiCard-root')).toHaveCount(6)
                await expect(page.locator('#highlights .MuiCard-root')).toHaveCount(6)
                await expect(page.locator('#pricing .MuiCard-root')).toHaveCount(3)
                await expect(page.locator('#faq .MuiAccordion-root')).toHaveCount(4)
                await localMedia.assertLoaded(page)

                if (viewport.width >= 900) {
                    const pricingAnchor = page.locator('a[href="#pricing"]').first()
                    await expect(pricingAnchor).toBeVisible()
                    await pricingAnchor.click()
                    await expect(page).toHaveURL(/#pricing$/)
                    await expectMarketingHeaderAnchorGeometry(page, `${project} ${viewport.name} desktop pricing anchor`)
                }

                const firstFaqSummary = page.locator('#faq .MuiAccordionSummary-root').first()
                await firstFaqSummary.focus()
                await page.keyboard.press('Enter')
                await expect(firstFaqSummary).toHaveAttribute('aria-expanded', 'true')
                const secondFaqSummary = page.locator('#faq .MuiAccordionSummary-root').nth(1)
                await secondFaqSummary.focus()
                await page.keyboard.press('Space')
                await expect(secondFaqSummary).toHaveAttribute('aria-expanded', 'true')

                if (viewport.width < 900) {
                    const openMenu = page.getByRole('button', { name: isRussian ? 'Открыть меню' : 'Open menu' })
                    await openMenu.click()
                    const closeMenu = page.getByRole('button', { name: isRussian ? 'Закрыть меню' : 'Close menu' })
                    await expect(closeMenu).toBeVisible()
                    const drawer = page.getByTestId('marketing-header-drawer')
                    await expect(drawer).toBeVisible()
                    await expect
                        .poll(async () =>
                            page.evaluate(() => {
                                const drawerElement = document.querySelector<HTMLElement>('[data-testid="marketing-header-drawer"]')
                                return Boolean(drawerElement?.contains(document.activeElement))
                            })
                        )
                        .toBe(true)
                    await closeMenu.focus()
                    await page.keyboard.press('Shift+Tab')
                    await expect
                        .poll(async () =>
                            page.evaluate(() => {
                                const drawerElement = document.querySelector<HTMLElement>('[data-testid="marketing-header-drawer"]')
                                return Boolean(drawerElement?.contains(document.activeElement))
                            })
                        )
                        .toBe(true)
                    const openDrawerAccessibility = await new AxeBuilder({ page })
                        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                        .analyze()
                    expect(openDrawerAccessibility.violations, JSON.stringify(openDrawerAccessibility.violations)).toEqual([])
                    await page.keyboard.press('Escape')
                    await expect(closeMenu).toBeHidden()
                    await expect(openMenu).toBeFocused()
                    await openMenu.click()
                    const mobilePricingAnchor = page.locator('.MuiDrawer-root a[href="#pricing"]:visible')
                    await expect(mobilePricingAnchor).toBeVisible()
                    await mobilePricingAnchor.click()
                    await expect(page).toHaveURL(/#pricing$/)
                    await expectMarketingHeaderAnchorGeometry(page, `${project} ${viewport.name} mobile pricing anchor`)
                }

                await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0)
                await expect(page.locator('a[href="#"]')).toHaveCount(0)
                await expect(page.locator('#footer a[target="_blank"][rel="noopener noreferrer"]')).toHaveCount(4)

                await expect
                    .poll(async () =>
                        page
                            .locator('img')
                            .evaluateAll((images) =>
                                images.every((image) => image.getAttribute('src')?.startsWith('data:') || image.naturalWidth > 0)
                            )
                    )
                    .toBe(true)
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `${project} ${viewport.name} marketing runtime`,
                    checkUuidSubstrings: true
                })
                await expectNoPageHorizontalOverflow(page, `${project} ${viewport.name} marketing runtime`)
                await assertMarketingPageAccessibility(page, `${project} ${viewport.name}`)
                expect(browserIssues, `${project} ${viewport.name} browser issues`).toEqual([])

                const backgroundColor = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor)
                const rgb = parseRgbColor(backgroundColor)
                expect(rgb, `Could not inspect body background: ${backgroundColor}`).not.toBeNull()
                const brightness = calculateRelativeBrightness(backgroundColor)
                expect(brightness).not.toBeNull()
                if (isDark) {
                    expect(brightness).toBeLessThan(140)
                } else {
                    expect(brightness).toBeGreaterThan(180)
                }

                await page.evaluate(() => window.scrollTo(0, 0))
                await expect(page).toHaveScreenshot(`marketing-page-${project}-${viewport.name}.png`, {
                    fullPage: true,
                    animations: 'disabled',
                    caret: 'hide',
                    maxDiffPixelRatio: 0.02
                })
                await expect(page).toHaveScreenshot(`marketing-page-${project}-${viewport.name}-header-band.png`, {
                    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(320, viewport.height) },
                    animations: 'disabled',
                    caret: 'hide',
                    maxDiffPixelRatio: 0.005
                })
            } finally {
                await context.close()
            }
        }

        const controlsContext = await browser.newContext({
            storageState: storageStatePath,
            locale,
            colorScheme: isDark ? 'dark' : 'light',
            viewport: { width: 1440, height: 1000 }
        })
        const controlsPage = await controlsContext.newPage()
        try {
            await applyBrowserPreferences(controlsPage, { language, isDarkMode: isDark })
            await controlsPage.goto(`/a/${applicationId}?locale=${language}&themeVariant=${isDark ? 'dark' : 'light'}`)
            await expect(controlsPage.locator('#marketing-page-main')).toBeVisible()

            const languageButton = controlsPage.getByRole('button', { name: /language|язык/i }).first()
            await expect(languageButton).toBeVisible()
            await languageButton.click()
            await expect(controlsPage.getByRole('menu')).toBeVisible()
            const switchedLanguage = isRussian ? 'en' : 'ru'
            await controlsPage.getByRole('menuitem', { name: languageMenuLabel(language, switchedLanguage), exact: true }).click()
            await expect(controlsPage.locator('html')).toHaveAttribute('lang', switchedLanguage)
            await expect(
                controlsPage.getByRole('heading', { name: switchedLanguage === 'ru' ? 'Наши новые продукты' : 'Our latest products' })
            ).toBeVisible()
            await controlsPage.reload()
            await expect(controlsPage.locator('html')).toHaveAttribute('lang', switchedLanguage)

            const restoredLanguageButton = controlsPage.getByRole('button', { name: /language|язык/i }).first()
            await restoredLanguageButton.click()
            await controlsPage.getByRole('menuitem', { name: languageMenuLabel(switchedLanguage, language), exact: true }).click()
            await expect(controlsPage.locator('html')).toHaveAttribute('lang', language)

            const colorModeButton = controlsPage.locator('button[data-screenshot="toggle-mode"]')
            await expect(colorModeButton).toHaveCount(1)
            await colorModeButton.click()
            const switchedTheme = isDark ? 'light' : 'dark'
            await controlsPage
                .getByRole('menuitem', { name: switchedTheme === 'dark' ? /dark|тёмная/i : /light|светлая/i, exact: true })
                .click()
            await expect(controlsPage.locator('html')).toHaveAttribute('data-mui-color-scheme', switchedTheme)
            await controlsPage.locator('button[data-screenshot="toggle-mode"]').click()
            await controlsPage.getByRole('menuitem', { name: isDark ? /dark|тёмная/i : /light|светлая/i, exact: true }).click()
            await expect(controlsPage.locator('html')).toHaveAttribute('data-mui-color-scheme', isDark ? 'dark' : 'light')
            await controlsPage.goto(`/a/${applicationId}?locale=${language}&themeVariant=${isDark ? 'dark' : 'light'}`)
            await expect(controlsPage.locator('html')).toHaveAttribute('data-mui-color-scheme', isDark ? 'dark' : 'light')
        } finally {
            await controlsContext.close()
        }

        await updateMarketingHeaderPosition(api, applicationId, 'flow')
        for (const viewport of VIEWPORTS) {
            const context = await browser.newContext({
                storageState: storageStatePath,
                locale,
                colorScheme: isDark ? 'dark' : 'light',
                viewport: { width: viewport.width, height: viewport.height }
            })
            const page = await context.newPage()
            try {
                await applyBrowserPreferences(page, { language, isDarkMode: isDark })
                await page.goto(`/a/${applicationId}?locale=${language}&themeVariant=${isDark ? 'dark' : 'light'}`)
                await expect(page.locator('#marketing-page-main')).toBeVisible()
                const header = page.getByTestId('marketing-header-shell')
                await expect(header).toHaveClass(/MuiAppBar-positionStatic/)
                await expect(page.getByTestId('marketing-header-spacer')).toHaveCount(0)
                const initialTop = await header.evaluate((element) => element.getBoundingClientRect().top)
                const baselineScrollPadding = await page.evaluate(() => ({
                    scrollPadding: window.getComputedStyle(document.documentElement).scrollPaddingBlockStart,
                    occlusion: document.documentElement.style.getPropertyValue('--marketing-header-occlusion')
                }))
                expect(baselineScrollPadding.occlusion).toBe('')
                await page.evaluate(() => window.scrollTo({ top: 640, behavior: 'instant' }))
                await page.waitForFunction(() => window.scrollY > 0)
                const scrolled = await header.evaluate((element) => {
                    const rect = element.getBoundingClientRect()
                    return { top: rect.top, bottom: rect.bottom }
                })
                expect(scrolled.top).toBeLessThan(initialTop - 100)
                expect(scrolled.bottom).toBeLessThanOrEqual(0)
                await expectNoTechnicalLeakage(page.locator('body'), {
                    label: `${project} ${viewport.name} flow marketing runtime`,
                    checkUuidSubstrings: true
                })
                await expectNoPageHorizontalOverflow(page, `${project} ${viewport.name} flow marketing runtime`)
                await page.screenshot({
                    path: testInfo.outputPath(`marketing-page-${project}-${viewport.name}-flow.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
            } finally {
                await context.close()
            }
        }
    } finally {
        await disposeApiContext(api)
    }
})
