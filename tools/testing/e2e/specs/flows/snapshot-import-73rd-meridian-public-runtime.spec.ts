import fs from 'node:fs/promises'
import path from 'node:path'
import type { BrowserContext, Page } from '@playwright/test'
import { validateSnapshotEnvelope } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createPublicationLinkedApplication,
    disposeApiContext,
    getApplication,
    sendWithCsrf,
    syncApplicationSchema
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    expectAnswerUsesFullWidth,
    expectContentContainedInCards,
    expectGridFillsContainer,
    expectNoContentClipping,
    expectNoVerticalOverlap
} from '../../support/browser/marketingGeometry'
import { toolbarSelectors } from '../../support/selectors/contracts'
import { repoRoot } from '../../support/env/load-e2e-env.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import {
    MERIDIAN_73_ACTIVITIES,
    MERIDIAN_73_FAQ,
    MERIDIAN_73_FOOTER_LINKS,
    MERIDIAN_73_METAHUB,
    MERIDIAN_73_NAVIGATION,
    MERIDIAN_73_PRICING_TIERS,
    MERIDIAN_73_SITE_SETTINGS
} from '../generators/meridian73MarketingContent'
import { assertMeridian73FixtureEnvelopeContract } from '../../support/meridian73FixtureContract'

const fixturePath = path.resolve(repoRoot, 'tools', 'fixtures', 'metahubs-73rd-meridian-app-snapshot.json')

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>
type BootstrapApiContext = Awaited<ReturnType<typeof createBootstrapApiContext>>
type PublicRuntimeReference = {
    url: string
    headers: Record<string, string>
}

const readRunToken = (runId: string): string => {
    const token = runId
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(-36)
    return token || 'playwright'
}

const createAlias = async (api: BootstrapApiContext, applicationId: string, alias: string, makePrimary = false): Promise<void> => {
    const response = await sendWithCsrf(api, 'POST', '/api/v1/application-aliases', {
        applicationId,
        alias,
        makePrimary
    })
    if (!response.ok) {
        throw new Error('Creating public alias ' + alias + ' failed with HTTP ' + response.status + ': ' + (await response.text()))
    }
}

const setAliasRoutingMode = async (api: BootstrapApiContext, applicationId: string, routingMode: 'direct' | 'canonical'): Promise<void> => {
    const response = await sendWithCsrf(api, 'PATCH', '/api/v1/applications/' + applicationId + '/aliases/policy', {
        routingMode
    })
    if (!response.ok) {
        throw new Error(
            'Setting alias routing mode ' + routingMode + ' failed with HTTP ' + response.status + ': ' + (await response.text())
        )
    }
}

const importFixtureThroughUi = async (page: Page): Promise<{ metahubId: string; publicationId: string }> => {
    await page.goto('/metahubs')
    const primaryAction = page.getByTestId(toolbarSelectors.primaryAction)
    await expect(primaryAction).toBeVisible({ timeout: 30_000 })
    await page.getByTestId(toolbarSelectors.primaryAction + '-menu-trigger').click()

    const importOption = page.getByRole('menuitem', { name: /import|импорт/i })
    await expect(importOption).toBeVisible()
    await importOption.click()

    const dialog = page.getByRole('dialog', { name: /import|импорт/i })
    await expect(dialog).toBeVisible()
    await dialog.locator('input[type="file"]').setInputFiles(fixturePath)
    await expect(dialog.getByText(path.basename(fixturePath), { exact: true })).toBeVisible()

    const importResponsePromise = page.waitForResponse(
        (response) => response.request().method() === 'POST' && /\/api\/v1\/metahubs\/import(?:\?|$)/.test(response.url()),
        { timeout: 420_000 }
    )
    await dialog
        .getByRole('button', { name: /import|импорт/i })
        .last()
        .click()

    const importResponse = await importResponsePromise
    expect(importResponse.status()).toBe(201)
    const body = (await importResponse.json()) as {
        metahub?: { id?: unknown }
        publication?: { id?: unknown }
    }
    const metahubId = body.metahub?.id
    const publicationId = body.publication?.id
    expect(typeof metahubId).toBe('string')
    expect(typeof publicationId).toBe('string')
    await expect(dialog).toHaveCount(0)

    return { metahubId: metahubId as string, publicationId: publicationId as string }
}

const assertRuntimeLocation = async (page: Page, expectedPath: string, expectedSearch: string): Promise<void> => {
    await expect
        .poll(
            () => {
                const url = new URL(page.url())
                return { pathname: url.pathname, search: url.search }
            },
            { timeout: 30_000, message: 'Waiting for the public runtime location to settle' }
        )
        .toEqual({ pathname: expectedPath, search: expectedSearch })
}

type PublicRuntimeWidget = { widgetKey?: string; config?: Record<string, unknown>; instanceKey?: string; isActive?: boolean }
type PublicRuntimePayload = { marketingPage?: { widgets?: PublicRuntimeWidget[]; headerWidgets?: PublicRuntimeWidget[] } }

const gotoPublicRuntime = async (page: Page, url: string): Promise<PublicRuntimePayload> => {
    const responsePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'GET' && /\/api\/v1\/public\/applications\/[^/]+\/runtime(?:\?|$)/.test(response.url()),
        { timeout: 30_000 }
    )
    await page.goto(url)
    const response = await responsePromise
    expect(response.status(), `Public runtime request failed for ${url}`).toBe(200)
    return (await response.json()) as PublicRuntimePayload
}

/**
 * The browser DOM alone cannot prove that the persisted widget settings reached
 * the anonymous runtime payload, so the served widget configs are asserted too.
 */
const assertRuntimeWidgetSettings = (payload: PublicRuntimePayload, label: string): void => {
    const widgets = payload.marketingPage?.widgets ?? []
    const pricing = widgets.find((widget) => widget.widgetKey === 'marketing.pricing')
    expect(pricing?.config?.cardStyle, `${label}: pricing card style`).toBe('uniform')
    expect(pricing?.config?.cardWidth, `${label}: pricing card width`).toBe('auto')
    expect(pricing?.config?.showBenefits, `${label}: pricing benefits flag`).toBe(true)
    expect(pricing?.config?.maxItems, `${label}: pricing tier limit`).toBe(MERIDIAN_73_PRICING_TIERS.length)

    const features = widgets.find((widget) => widget.widgetKey === 'marketing.collection' && widget.config?.variant === 'features')
    expect(features?.config?.showItemDescriptions, `${label}: features descriptions flag`).toBe(true)
    expect(features?.config?.fixedItemsHeight, `${label}: features fixed-height flag`).toBe(true)

    // Disabled layout rows never reach the effective runtime layout, so the
    // anonymous header exposes the language and theme switchers only.
    const headerWidgets = payload.marketingPage?.headerWidgets ?? []
    const headerWidgetKeys = headerWidgets.map((widget) => widget.widgetKey)
    expect(headerWidgetKeys, `${label}: language switcher stays enabled`).toContain('languageSwitcher')
    expect(headerWidgets.find((widget) => widget.widgetKey === 'languageSwitcher')?.isActive, `${label}: language switcher active`).toBe(
        true
    )
    expect(headerWidgetKeys, `${label}: theme switcher stays enabled`).toContain('colorModeSwitcher')
    expect(headerWidgets.find((widget) => widget.widgetKey === 'colorModeSwitcher')?.isActive, `${label}: theme switcher active`).toBe(true)
    expect(headerWidgetKeys, `${label}: auth widget stays disabled`).not.toContain('marketing.auth')
}

/**
 * Real-browser geometry contracts for the published marketing page. The
 * features column renders from `sm` upwards, so callers gate this on viewport
 * width; the container-width floor only applies where the wide container is
 * actually reachable (>= xl breakpoint).
 */
const assertMarketingPageGeometry = async (page: Page, label: string, options: { expectBaseContainer?: boolean } = {}): Promise<void> => {
    await expectGridFillsContainer(page, {
        containerSelector: '#pricing',
        gridSelector: '[data-testid="marketing-pricing-grid"]',
        label: `${label}: pricing grid`,
        // The Consortium uses the base layout width; the wide (`full`) setting
        // stays available in the widget dialog but must not widen this page.
        minContainerWidth: options.expectBaseContainer ? 1100 : undefined,
        maxContainerWidth: options.expectBaseContainer ? 1300 : undefined
    })
    await expectNoContentClipping(page, { selector: '[data-testid="marketing-feature-card"]', label: `${label}: features cards` })
    await expectContentContainedInCards(page, {
        cardSelector: '[data-testid="marketing-feature-card"]',
        contentSelector: '[data-testid="marketing-feature-card-content"]',
        label: `${label}: features cards`
    })
    await expectNoVerticalOverlap(page, { selector: '[data-testid="marketing-feature-card"]', label: `${label}: features cards` })
}

const expandFirstFaqAnswer = async (page: Page): Promise<void> => {
    const faqSummary = page.locator('[data-testid="marketing-faq-item"]').first().getByRole('button')
    if (
        (await page
            .getByTestId('marketing-faq-answer')
            .first()
            .isVisible()
            .catch(() => false)) === false
    ) {
        await faqSummary.click()
    }
    await expect(page.getByTestId('marketing-faq-answer').first()).toBeVisible()
}

const assertFaqAnswerGeometry = async (page: Page, label: string): Promise<void> => {
    await expectAnswerUsesFullWidth(page, {
        itemSelector: '[data-testid="marketing-faq-item"]',
        answerSelector: '[data-testid="marketing-faq-answer"]',
        label: `${label}: FAQ answers`
    })
}

const assertPublicMarketingContent = async (
    page: Page,
    expectedTitle: string,
    expectedActivity: string,
    expectedFaq: string,
    label: string,
    payload: PublicRuntimePayload,
    locale: 'en' | 'ru' = 'en'
): Promise<void> => {
    assertRuntimeWidgetSettings(payload, label)
    await expect(page.locator('#marketing-page-main')).toBeVisible({ timeout: 60_000 })
    await expect(page.getByRole('heading', { name: expectedTitle, exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: expectedActivity, exact: true })).toBeVisible()
    await expect(page.getByText(expectedFaq, { exact: true })).toBeVisible()
    const pricingSection = page.locator('#pricing')
    for (const tier of MERIDIAN_73_PRICING_TIERS) {
        await expect(page.getByRole('heading', { name: tier.title[locale], exact: true })).toBeVisible()
        await expect(page.getByText(tier.description[locale], { exact: true })).toBeVisible()
        await expect(pricingSection.getByText(tier.price, { exact: true }).first()).toBeVisible()
        await expect(pricingSection.getByText(tier.period[locale], { exact: true }).first()).toBeVisible()
        // Every stage keeps its full benefit list: child collections must not be
        // clipped by the tier `maxItems` bound.
        for (const benefit of tier.benefits) {
            await expect(
                pricingSection.getByText(benefit[locale], { exact: true }).first(),
                `${label}: pricing benefit "${benefit[locale]}"`
            ).toBeVisible()
        }
    }
    // Scaled NUMERIC prices must render without fake precision.
    await expect(pricingSection.getByText('1.00', { exact: true })).toHaveCount(0)
    // Uniform pricing cards must not render the template "Recommended" badge.
    await expect(page.getByText('Recommended', { exact: true })).toHaveCount(0)
    // Verified Consortium destinations render as real footer links, while the
    // removed demo destinations stay absent.
    for (const link of MERIDIAN_73_FOOTER_LINKS) {
        await expect(page.locator(`a[href="${link.href}"]`).first(), `${label}: footer link ${link.key}`).toBeVisible()
        await expect(page.getByText(link.label[locale], { exact: true }).first(), `${label}: footer label ${link.key}`).toBeVisible()
    }
    for (const groupTitle of new Set(MERIDIAN_73_FOOTER_LINKS.map((link) => link.groupTitle[locale]))) {
        await expect(page.getByText(groupTitle, { exact: true }).first(), `${label}: footer group ${groupTitle}`).toBeVisible()
    }
    for (const forbiddenHref of ['vk.com/', 'max.ru/', '2gis.ru/', 'tel:+73812000000']) {
        await expect(page.locator(`a[href*="${forbiddenHref}"]`), `${label}: forbidden footer link ${forbiddenHref}`).toHaveCount(0)
    }
    // The disabled auth capability must stay absent while the theme control
    // is part of the inherited layout and stays rendered on every locale/viewport.
    await expect(page.getByTestId('marketing-header-auth')).toHaveCount(0)
    await expect(page.getByTestId('marketing-color-mode-switcher')).toBeVisible()
    // The configured brand identity is visible text in the header/footer when no
    // logo asset is set; the template demo wordmark must never replace it.
    await expect(
        page.getByTestId('marketing-header-shell').getByText(MERIDIAN_73_SITE_SETTINGS.brandName[locale], { exact: true })
    ).toBeVisible()
    // Activity cards have no authored media: an icon-only placeholder renders
    // instead of the original MUI template screenshots.
    await expect(page.getByTestId('marketing-feature-demo-image')).toHaveCount(0)
    await expect(page.getByTestId('marketing-feature-placeholder-icon').first()).toBeVisible()
    await assertMarketingPageGeometry(page, label, { expectBaseContainer: true })
    await expandFirstFaqAnswer(page)
    await assertFaqAnswerGeometry(page, label)
    await expectNoTechnicalLeakage(page.locator('#marketing-page-main'), {
        label,
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, label)
}

test('@flow @marketing-page @snapshot imports the committed 73rd Meridian fixture into anonymous public runtime', async ({
    browser,
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(600_000)

    const fixture = validateSnapshotEnvelope(JSON.parse(await fs.readFile(fixturePath, 'utf8')) as Record<string, unknown>)
    assertMeridian73FixtureEnvelopeContract(fixture)

    let api: ApiContext | null = null
    let bootstrapApi: BootstrapApiContext | null = null
    let anonymousContext: BrowserContext | null = null
    const publicRuntimeRequests: PublicRuntimeReference[] = []

    try {
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const imported = await importFixtureThroughUi(page)
        await recordCreatedMetahub({
            id: imported.metahubId,
            name: MERIDIAN_73_METAHUB.name.en,
            codename: MERIDIAN_73_METAHUB.codename
        })
        await recordCreatedPublication({ id: imported.publicationId, metahubId: imported.metahubId })

        const linkedApplication = await createPublicationLinkedApplication(api, imported.metahubId, imported.publicationId, {
            name: { en: '73rd Meridian public runtime' },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            isPublic: true
        })
        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Imported 73rd Meridian publication did not create a public application')
        }
        await recordCreatedApplication({ id: applicationId })

        await syncApplicationSchema(api, applicationId)
        await expect.poll(async () => (await getApplication(api, applicationId))?.schemaStatus, { timeout: 120_000 }).toBe('synced')

        bootstrapApi = await createBootstrapApiContext()
        const aliasToken = readRunToken(runManifest.runId)
        const primaryAlias = 'meridian-' + aliasToken
        const secondaryAlias = 'meridian-alt-' + aliasToken
        await createAlias(bootstrapApi, applicationId, primaryAlias, true)
        await createAlias(bootstrapApi, applicationId, secondaryAlias)

        anonymousContext = await browser.newContext({
            storageState: { cookies: [], origins: [] }
        })
        expect(await anonymousContext.cookies()).toEqual([])
        const anonymousPage = await anonymousContext.newPage()
        anonymousPage.on('request', (request) => {
            if (request.method() !== 'GET' || !/\/api\/v1\/public\/applications\/[^/]+\/runtime(?:\?|$)/.test(request.url())) return
            publicRuntimeRequests.push({
                url: request.url(),
                headers: request.headers()
            })
        })
        const localMedia = await installMarketingPageLocalMedia(anonymousPage)

        await test.step('UUID route keeps the suffix and query in direct mode', async () => {
            await setAliasRoutingMode(bootstrapApi, applicationId, 'direct')
            const suffix = '/campaign/overview'
            const search = '?locale=en&step=uuid'
            const payload = await gotoPublicRuntime(anonymousPage, '/a/' + applicationId + suffix + search)
            await assertRuntimeLocation(anonymousPage, '/a/' + applicationId + suffix, search)
            await assertPublicMarketingContent(
                anonymousPage,
                MERIDIAN_73_SITE_SETTINGS.heroTitle.en,
                MERIDIAN_73_ACTIVITIES[0].title.en,
                MERIDIAN_73_FAQ[0].question.en,
                '73rd Meridian UUID public runtime',
                payload
            )
        })

        await test.step('secondary alias stays direct and preserves the suffix and query', async () => {
            const suffix = '/campaign/overview'
            const search = '?locale=en&step=direct'
            const payload = await gotoPublicRuntime(anonymousPage, '/a/' + secondaryAlias + suffix + search)
            await assertRuntimeLocation(anonymousPage, '/a/' + secondaryAlias + suffix, search)
            await assertPublicMarketingContent(
                anonymousPage,
                MERIDIAN_73_SITE_SETTINGS.heroTitle.en,
                MERIDIAN_73_ACTIVITIES[0].title.en,
                MERIDIAN_73_FAQ[0].question.en,
                '73rd Meridian direct alias public runtime',
                payload
            )
        })

        await test.step('UUID remains addressable under canonical alias policy and preserves the suffix and query', async () => {
            const suffix = '/campaign/overview'
            const search = '?locale=en&step=canonical-uuid'
            const payload = await gotoPublicRuntime(anonymousPage, '/a/' + applicationId + suffix + search)
            await assertRuntimeLocation(anonymousPage, '/a/' + applicationId + suffix, search)
            await assertPublicMarketingContent(
                anonymousPage,
                MERIDIAN_73_SITE_SETTINGS.heroTitle.en,
                MERIDIAN_73_ACTIVITIES[0].title.en,
                MERIDIAN_73_FAQ[0].question.en,
                '73rd Meridian canonical UUID public runtime',
                payload
            )
        })

        await test.step('secondary alias redirects canonically while preserving the suffix, query, and Russian content', async () => {
            await setAliasRoutingMode(bootstrapApi, applicationId, 'canonical')
            const suffix = '/campaign/overview'
            const search = '?locale=ru&step=canonical'
            const payload = await gotoPublicRuntime(anonymousPage, '/a/' + secondaryAlias + suffix + search)
            await assertRuntimeLocation(anonymousPage, '/a/' + primaryAlias + suffix, search)
            await assertPublicMarketingContent(
                anonymousPage,
                MERIDIAN_73_SITE_SETTINGS.heroTitle.ru,
                MERIDIAN_73_ACTIVITIES[0].title.ru,
                MERIDIAN_73_FAQ[0].question.ru,
                '73rd Meridian canonical Russian alias public runtime',
                payload,
                'ru'
            )
        })

        const heroImage = anonymousPage.locator('img[src*="dashboard.jpg"]')
        await expect(heroImage).toHaveCount(1)
        await expect(heroImage).toBeVisible()
        await expect.poll(() => heroImage.evaluate((element) => element.complete && element.naturalWidth > 0)).toBe(true)

        await test.step('every emitted Consortium navigation anchor resolves to a rendered section', async () => {
            await anonymousPage.goto('/a/' + applicationId + '?locale=en')
            await expect(anonymousPage.locator('#marketing-page-main')).toBeVisible({ timeout: 60_000 })

            for (const navigation of MERIDIAN_73_NAVIGATION) {
                const link = anonymousPage.getByRole('link', { name: navigation.label.en, exact: true }).first()
                await expect(link, `Consortium navigation item ${navigation.key} must be rendered`).toBeVisible()
                const href = await link.getAttribute('href')
                expect(href, `Consortium navigation item ${navigation.key} must keep an in-page anchor`).toMatch(/^#/)
                const targetExists = await anonymousPage.evaluate((selector) => Boolean(document.querySelector(selector)), href)
                expect(targetExists, `Consortium navigation anchor ${href} must resolve to a rendered section`).toBe(true)
            }
        })
        expect(localMedia.requestedUrls.size).toBeGreaterThan(0)

        expect(publicRuntimeRequests.length).toBeGreaterThanOrEqual(3)
        for (const request of publicRuntimeRequests) {
            expect(request.headers.cookie ?? '').toBe('')
            expect(request.headers.authorization ?? '').toBe('')
        }
        expect(publicRuntimeRequests.some((request) => request.url.includes('/public/applications/' + applicationId + '/runtime'))).toBe(
            true
        )
        expect(publicRuntimeRequests.some((request) => request.url.includes('/public/applications/' + secondaryAlias + '/runtime'))).toBe(
            true
        )

        await test.step('anonymous Consortium landing page stays overflow-free across the responsive matrix', async () => {
            for (const viewport of [
                { name: 'desktop-1920', width: 1920, height: 1080 },
                { name: 'tablet-768', width: 768, height: 1024 },
                { name: 'mobile-390', width: 390, height: 844 }
            ]) {
                await anonymousPage.setViewportSize({ width: viewport.width, height: viewport.height })
                await anonymousPage.goto('/a/' + applicationId + '?locale=en')
                await expect(anonymousPage.getByRole('heading', { name: MERIDIAN_73_SITE_SETTINGS.heroTitle.en, exact: true })).toBeVisible(
                    { timeout: 30_000 }
                )
                await expectNoPageHorizontalOverflow(anonymousPage, '73rd Meridian anonymous landing page ' + viewport.name)
                await expectNoTechnicalLeakage(anonymousPage.locator('#marketing-page-main'), {
                    label: '73rd Meridian anonymous landing page ' + viewport.name
                })
                // The features column and the pricing grid only render from sm
                // upwards; the original overlap defect reproduced at 768 too.
                if (viewport.width >= 768) {
                    await assertMarketingPageGeometry(anonymousPage, '73rd Meridian ' + viewport.name, {
                        expectBaseContainer: viewport.width >= 1536
                    })
                    await expandFirstFaqAnswer(anonymousPage)
                    await assertFaqAnswerGeometry(anonymousPage, '73rd Meridian ' + viewport.name)
                }
                await anonymousPage.screenshot({
                    path: testInfo.outputPath('meridian-73-public-' + viewport.name + '.png'),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
        })

        await test.step('anonymous landing keeps the language and theme switchers and hides the disabled auth widget', async () => {
            await anonymousPage.setViewportSize({ width: 1280, height: 900 })
            await anonymousPage.goto('/a/' + applicationId + '?locale=en')
            await expect(anonymousPage.getByRole('heading', { name: MERIDIAN_73_SITE_SETTINGS.heroTitle.en, exact: true })).toBeVisible({
                timeout: 30_000
            })

            // The disabled auth capability stays in the layout but never renders.
            await expect(anonymousPage.getByTestId('marketing-header-auth')).toHaveCount(0)

            const colorModeSwitcher = anonymousPage.getByTestId('marketing-color-mode-switcher')
            await expect(colorModeSwitcher).toBeVisible()
            await colorModeSwitcher.click()
            await anonymousPage.getByRole('menuitem', { name: 'Dark', exact: true }).click()
            await expect(anonymousPage.locator('html')).toHaveAttribute('data-mui-color-scheme', 'dark')
            await anonymousPage.reload()
            await expect(anonymousPage.getByRole('heading', { name: MERIDIAN_73_SITE_SETTINGS.heroTitle.en, exact: true })).toBeVisible({
                timeout: 30_000
            })
            await expect(anonymousPage.locator('html')).toHaveAttribute('data-mui-color-scheme', 'dark')
            await expectNoPageHorizontalOverflow(anonymousPage, '73rd Meridian dark theme')

            const languageSwitcher = anonymousPage.getByTestId('runtime-language-switcher')
            await expect(languageSwitcher).toBeVisible()
            await languageSwitcher.click()
            await anonymousPage.getByRole('menuitem', { name: 'Russian' }).click()
            await expect(anonymousPage).toHaveURL(/locale=ru/)
            await expect(anonymousPage.getByRole('heading', { name: MERIDIAN_73_SITE_SETTINGS.heroTitle.ru, exact: true })).toBeVisible({
                timeout: 30_000
            })
            await expectNoPageHorizontalOverflow(anonymousPage, '73rd Meridian language switch RU')
        })

        await test.step('anonymous unavailable references redirect to the login page without enumerating', async () => {
            for (const unavailableRef of ['0198dead-0000-7000-8000-000000000001', 'this-ref-does-not-exist', 'admin']) {
                await anonymousPage.goto('/a/' + unavailableRef + '?locale=en')
                // Closed, unknown and reserved references share one uniform
                // redirect target, so the login page never discloses which
                // private resource exists.
                await anonymousPage.waitForURL(/\/auth/, { timeout: 30_000 })
                await expect(anonymousPage.getByTestId('auth-email-input')).toBeVisible({ timeout: 30_000 })
                await expect(anonymousPage.getByRole('button', { name: 'Retry' })).toHaveCount(0)
                await expectNoTechnicalLeakage(anonymousPage.locator('body'), {
                    label: 'Login redirect for unavailable ' + unavailableRef
                })
            }

            // Russian visitors share the same redirect behavior.
            await anonymousPage.goto('/a/this-ref-does-not-exist?locale=ru')
            await anonymousPage.waitForURL(/\/auth/, { timeout: 30_000 })

            // The retryable network-failure state stays distinct from the
            // resource-unavailable outcome, so retrying infrastructure errors
            // does not confirm that a private application exists.
            await anonymousPage.route('**/api/v1/public/applications/*/runtime**', (route) => route.abort('failed'))
            await anonymousPage.goto('/a/' + applicationId + '?locale=en')
            const retryAlert = anonymousPage.getByRole('alert').filter({ hasText: 'Failed to load runtime data' })
            await expect(retryAlert).toBeVisible({ timeout: 30_000 })
            await expect(anonymousPage.getByRole('button', { name: 'Retry' })).toHaveCount(1)
            await anonymousPage.unroute('**/api/v1/public/applications/*/runtime**')
            await assertRuntimeLocation(anonymousPage, '/a/' + applicationId, '?locale=en')
        })

        await test.step('closing a public application redirects anonymous visitors to the login page', async () => {
            if (!api) throw new Error('API context is unavailable for the visibility check')
            await sendWithCsrf(api, 'PATCH', '/api/v1/applications/' + applicationId, { isPublic: false })
            await anonymousPage.goto('/a/' + applicationId + '?locale=en')
            await anonymousPage.waitForURL(/\/auth/, { timeout: 30_000 })
            await expect(anonymousPage.getByTestId('auth-email-input')).toBeVisible({ timeout: 30_000 })
        })
    } finally {
        if (anonymousContext) await anonymousContext.close()
        if (bootstrapApi) await disposeBootstrapApiContext(bootstrapApi)
        if (api) await disposeApiContext(api)
    }
})
