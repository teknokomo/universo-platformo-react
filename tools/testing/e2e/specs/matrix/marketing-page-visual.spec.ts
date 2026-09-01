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
    listPublicationApplications,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applyBrowserPreferences, calculateRelativeBrightness, parseRgbColor } from '../../support/browser/preferences'
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
        issues.push({
            source: 'requestfailed',
            text: request.failure()?.errorText ?? 'Request failed',
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
        id: applicationId,
        slug: typeof linkedApplication.slug === 'string' ? linkedApplication.slug : undefined
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

async function assertNoRuntimeLeakage(page: import('@playwright/test').Page) {
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('[object Object]')
    expect(bodyText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)
    expect(await page.locator('a[href^="javascript:"]').count()).toBe(0)
    expect(await page.locator('a[href="#"]').count()).toBe(0)

    const overflowDetails = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const offenders = Array.from(document.querySelectorAll<HTMLElement>('*'))
            .map((element) => {
                const rect = element.getBoundingClientRect()
                return {
                    tag: element.tagName,
                    id: element.id,
                    left: Math.round(rect.left * 100) / 100,
                    right: Math.round(rect.right * 100) / 100
                }
            })
            .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
            .slice(0, 20)

        return { viewportWidth, scrollWidth: document.documentElement.scrollWidth, offenders }
    })

    expect(overflowDetails.scrollWidth, JSON.stringify(overflowDetails)).toBeLessThanOrEqual(overflowDetails.viewportWidth)
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
                await expect(page.locator('#hero')).toBeVisible()
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
                    await page.keyboard.press('Escape')
                    await expect(closeMenu).toBeHidden()
                    await expect(openMenu).toBeFocused()
                    await openMenu.click()
                    const mobilePricingAnchor = page.locator('.MuiDrawer-root a[href="#pricing"]:visible')
                    await expect(mobilePricingAnchor).toBeVisible()
                    await mobilePricingAnchor.click()
                    await expect(page).toHaveURL(/#pricing$/)
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
                await assertNoRuntimeLeakage(page)
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

                await expect(page).toHaveScreenshot(`marketing-page-${project}-${viewport.name}.png`, {
                    fullPage: true,
                    animations: 'disabled',
                    caret: 'hide',
                    maxDiffPixelRatio: 0.02
                })
            } finally {
                await context.close()
            }
        }
    } finally {
        await disposeApiContext(api)
    }
})
