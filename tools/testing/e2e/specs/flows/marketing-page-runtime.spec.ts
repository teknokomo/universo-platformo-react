import { createLocalizedContent } from '@universo-react/utils'
import AxeBuilder from '@axe-core/playwright'
import { marketingPageTemplate } from '../../../../../packages/universo-react-metahubs-backend/dist/domains/templates/data/marketing-page.template.js'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    disposeApiContext,
    getApplication,
    getMarketingPageRuntime,
    listEntityInstances,
    listPublicationApplications,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { assertMarketingPageRuntimeMaterialization } from '../../support/marketingPageRuntimeMaterialization.ts'
import { installMarketingPageLocalMedia } from '../../support/marketingPageMedia'

const EXPECTED_ENTITY_CODENAMES = [
    'MarketingPage',
    'MarketingPageSiteSettings',
    'MarketingPageSection',
    'MarketingPageLogo',
    'MarketingPageFeature',
    'MarketingPageTestimonial',
    'MarketingPageHighlight',
    'MarketingPagePricing',
    'MarketingPagePricingBenefit',
    'MarketingPageFaq',
    'MarketingPageNavigation',
    'MarketingPageFooterLink'
]

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

async function waitForLinkedApplication(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    publicationId: string
) {
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

test('@flow @marketing-page publishes the data-driven MUI marketing page without runtime leakage', async ({
    page,
    runManifest
}, testInfo) => {
    test.setTimeout(240_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })
    const metahubName = `E2E ${runManifest.runId} marketing page`
    const metahubCodename = `${runManifest.runId}-marketing-page`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName, ru: `Маркетинговая страница ${runManifest.runId}` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })

        if (!metahub?.id) throw new Error('Marketing-page metahub creation did not return an id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubName, codename: metahubCodename })

        const [hubInstances, objectInstances] = await Promise.all([
            listEntityInstances(api, metahub.id, { kind: 'hub', limit: 100, offset: 0 }),
            listEntityInstances(api, metahub.id, { kind: 'object', limit: 100, offset: 0 })
        ])
        const entityCodenames = [...(hubInstances?.items ?? []), ...(objectInstances?.items ?? [])].map((item: Record<string, unknown>) =>
            readCodename(item.codename)
        )
        for (const expectedCodename of EXPECTED_ENTITY_CODENAMES) {
            expect(entityCodenames, `Seeded entity ${expectedCodename} is missing`).toContain(expectedCodename)
        }

        const publication = await createPublication(api, metahub.id, {
            name: { en: `E2E ${runManifest.runId} Marketing Publication` },
            namePrimaryLocale: 'en',
            autoCreateApplication: true,
            applicationName: { en: `E2E ${runManifest.runId} Marketing Application` },
            applicationNamePrimaryLocale: 'en',
            runtimePolicy: {
                workspaceMode: 'required',
                requiredWorkspaceModeAcknowledged: true
            }
        })
        if (!publication?.id) throw new Error('Marketing-page publication creation did not return an id')
        await recordCreatedPublication({ id: publication.id, metahubId: metahub.id, schemaName: publication.schemaName })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await waitForLinkedApplication(api, metahub.id, publication.id)
        const applicationId = typeof linkedApplication?.id === 'string' ? linkedApplication.id : undefined
        if (!applicationId) throw new Error('Marketing-page publication did not create a linked application')
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

        const runtimePayload = await getMarketingPageRuntime(api, applicationId, 'en')
        assertMarketingPageRuntimeMaterialization(runtimePayload, marketingPageTemplate)

        const localMedia = await installMarketingPageLocalMedia(page)
        await page.goto(`/a/${applicationId}`)
        await expect(page.locator('#marketing-page-main')).toBeVisible()
        await expect(page.locator('#hero')).toBeVisible()
        await expect(page.locator('#logoCollection')).toBeVisible()
        await expect(page.locator('#features')).toBeVisible()
        await expect(page.locator('#testimonials')).toBeVisible()
        await expect(page.locator('#highlights')).toBeVisible()
        await expect(page.locator('#pricing')).toBeVisible()
        await expect(page.locator('#faq')).toBeVisible()
        await expect(page.locator('#footer')).toBeVisible()

        await expect(page.getByRole('heading', { name: 'Our latest products' })).toBeVisible()
        await expect(page.getByRole('link', { name: 'Start now' }).first()).toBeVisible()
        await expect(page.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', '/sign-up')
        await expect(page.locator('#marketing-footer-email')).toHaveCount(0)
        await expect(page.locator('#email-hero')).toHaveCount(0)
        await expect(page.locator('#logoCollection img')).toHaveCount(6)
        await expect(page.locator('#features [aria-pressed]:visible')).toHaveCount(3)
        await expect(page.locator('#testimonials .MuiCard-root')).toHaveCount(6)
        await expect(page.locator('#highlights .MuiCard-root')).toHaveCount(6)
        await expect(page.locator('#pricing .MuiCard-root')).toHaveCount(3)
        await expect(page.locator('#faq .MuiAccordion-root')).toHaveCount(4)
        await localMedia.assertLoaded(page)

        const bodyText = await page.locator('body').innerText()
        expect(bodyText).not.toContain('[object Object]')
        expect(bodyText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)
        expect(await page.locator('a[href^="javascript:"]').count()).toBe(0)
        expect(await page.locator('a[href="#"]').count()).toBe(0)

        const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
        const accessibilityViolations = accessibility.violations.map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            description: violation.description,
            nodes: violation.nodes.map((node) => node.html)
        }))
        expect(accessibilityViolations, JSON.stringify(accessibilityViolations)).toEqual([])

        const featureSelectorBounds = await page.locator('#features button[aria-pressed]:visible').evaluateAll((buttons) =>
            buttons.map((button) => {
                const rect = button.getBoundingClientRect()
                return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right }
            })
        )
        for (let index = 1; index < featureSelectorBounds.length; index += 1) {
            expect(featureSelectorBounds[index].top, JSON.stringify(featureSelectorBounds)).toBeGreaterThanOrEqual(
                featureSelectorBounds[index - 1].bottom
            )
        }

        const overflowDetails = await page.evaluate(() => {
            const viewportWidth = document.documentElement.clientWidth
            const offenders = Array.from(document.querySelectorAll<HTMLElement>('*'))
                .map((element) => {
                    const rect = element.getBoundingClientRect()
                    return {
                        tag: element.tagName,
                        id: element.id,
                        className: typeof element.className === 'string' ? element.className : '',
                        left: Math.round(rect.left * 100) / 100,
                        right: Math.round(rect.right * 100) / 100,
                        width: Math.round(rect.width * 100) / 100
                    }
                })
                .filter(({ left, right }) => left < -1 || right > viewportWidth + 1)
                .slice(0, 20)

            return {
                viewportWidth,
                scrollWidth: document.documentElement.scrollWidth,
                offenders
            }
        })
        expect(overflowDetails.scrollWidth, JSON.stringify(overflowDetails)).toBeLessThanOrEqual(overflowDetails.viewportWidth)

        await page.evaluate(() => window.scrollTo(0, 0))
        await expect(page).toHaveScreenshot('marketing-page-en-light.png', {
            fullPage: true,
            animations: 'disabled',
            caret: 'hide',
            maxDiffPixelRatio: 0.02
        })

        await page.screenshot({
            path: testInfo.outputPath('marketing-page-en-light.png'),
            fullPage: true,
            animations: 'disabled'
        })
    } finally {
        await disposeApiContext(api)
    }
})
