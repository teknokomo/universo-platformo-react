import { expect, type Browser, type Page, type TestInfo } from '@playwright/test'
import { switchRuntimeLocale } from '../browser/preferences'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectTextOnSingleLine } from '../browser/runtimeUx'
import { installMarketingPageLocalMedia } from '../marketingPageMedia'
import {
    expectAnonymousMarketingImagePayload,
    expectNoFixedMarketingHeaderOverlap,
    expectRenderedMarketingImage,
    type MarketingImageAltText
} from './marketingAnonymousRuntimeAssertions'

type HeroCopy = { title: string; accent: string; titleRu: string; accentRu: string }

export async function verifyAnonymousMarketingHeroRuntime(options: {
    browser: Browser
    page: Page
    testInfo: TestInfo
    applicationId: string
    brandLogoUrl: string
    imageAltText: MarketingImageAltText
    firstHero: HeroCopy
    secondHero: HeroCopy
}): Promise<void> {
    const { browser, page, testInfo, applicationId, brandLogoUrl, imageAltText, firstHero, secondHero } = options
    const anonymousContext = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: 'en-US',
        colorScheme: 'light',
        hasTouch: true
    })

    try {
        const anonymousStorage = await anonymousContext.storageState()
        expect(anonymousStorage.cookies).toHaveLength(0)
        expect(anonymousStorage.origins).toHaveLength(0)

        const anonymousPage = await anonymousContext.newPage()
        const localMedia = await installMarketingPageLocalMedia(anonymousPage)
        const pageErrors: string[] = []
        anonymousPage.on('pageerror', (error) => pageErrors.push(error.message))
        const publishedUrl = new URL(`/a/${applicationId}?locale=en`, page.url())
        const waitForPublicRuntimeResponse = () =>
            anonymousPage.waitForResponse((response) => {
                const responseUrl = new URL(response.url())
                return (
                    response.request().method() === 'GET' && responseUrl.pathname === `/api/v1/public/applications/${applicationId}/runtime`
                )
            })
        const publicRuntimeResponsePromise = waitForPublicRuntimeResponse()
        await anonymousPage.goto(publishedUrl.toString())
        const publicRuntimeResponse = await publicRuntimeResponsePromise
        expect(publicRuntimeResponse.ok()).toBe(true)
        expectAnonymousMarketingImagePayload({
            payload: await publicRuntimeResponse.json(),
            locale: 'en',
            applicationId,
            brandLogoUrl,
            imageAltText
        })
        await expect(anonymousPage.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })
        expect(await anonymousPage.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0)
        const anonymousImage = anonymousPage.locator('#marketing-widget-hero-image').getByRole('img')
        await expectRenderedMarketingImage({
            page: anonymousPage,
            image: anonymousImage,
            alt: imageAltText.en,
            url: brandLogoUrl,
            requestedUrls: localMedia.requestedUrls
        })

        for (const hero of [firstHero, secondHero]) {
            const heading = anonymousPage.getByRole('heading', { name: `${hero.title} ${hero.accent}`, exact: true })
            await expect(heading, `Anonymous runtime must render Hero “${hero.title}”`).toHaveCount(1)
            await expect(heading).toBeVisible()
        }
        const independentHeroHeading = anonymousPage.getByRole('heading', {
            name: `${secondHero.title} ${secondHero.accent}`,
            exact: true
        })
        const independentHeroAction = () =>
            anonymousPage
                .locator('[id^="hero-"]')
                .filter({ has: independentHeroHeading })
                .getByRole('link', { name: 'Start now', exact: true })

        for (const viewport of [
            { name: 'desktop-1920', width: 1920, height: 1080 },
            { name: 'tablet-768', width: 768, height: 1024 },
            { name: 'mobile-390', width: 390, height: 844 }
        ]) {
            await anonymousPage.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectNoPageHorizontalOverflow(anonymousPage, `Anonymous published Hero runtime at ${viewport.name}`)
            await expectNoTechnicalLeakage(anonymousPage.locator('body'), {
                label: `Anonymous published Hero runtime at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            await expect(anonymousImage).toBeVisible()
            await expect(anonymousImage).toHaveAttribute('alt', imageAltText.en)
            await expect(anonymousImage).toHaveAttribute('src', brandLogoUrl)
            await expect(anonymousPage.locator('#marketing-page-main img[src=""]')).toHaveCount(0)

            const anonymousAction = independentHeroAction()
            await expect(anonymousAction).toBeVisible()
            await expectTextOnSingleLine(anonymousAction, `Anonymous published Hero action at ${viewport.name}`)
            await anonymousAction.scrollIntoViewIfNeeded()
            await expect(anonymousAction).toBeInViewport()
            const href = await anonymousAction.getAttribute('href')
            expect(href).toMatch(/^#hero-[A-Za-z0-9_-]+$/u)
            const target = anonymousPage.locator(`[id="${href!.slice(1)}"]`)
            await expect(
                target.getByRole('heading', {
                    name: `${secondHero.title} ${secondHero.accent}`,
                    exact: true
                })
            ).toBeVisible()
            await anonymousPage.screenshot({
                path: testInfo.outputPath(`marketing-page-anonymous-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }

        await anonymousPage.setViewportSize({ width: 390, height: 844 })
        const anonymousAction = independentHeroAction()
        const anonymousActionHref = await anonymousAction.getAttribute('href')
        expect(anonymousActionHref).toMatch(/^#hero-[A-Za-z0-9_-]+$/u)
        const anonymousTarget = anonymousPage.locator(`[id="${anonymousActionHref!.slice(1)}"]`)
        const anonymousTargetHeading = anonymousTarget.getByRole('heading', {
            name: `${secondHero.title} ${secondHero.accent}`,
            exact: true
        })
        await anonymousAction.tap()
        await expect.poll(() => new URL(anonymousPage.url()).hash).toBe(anonymousActionHref)
        await expect(anonymousTargetHeading).toBeInViewport()
        await anonymousPage.screenshot({
            path: testInfo.outputPath('marketing-page-anonymous-action-tap-target-mobile-390.png'),
            animations: 'disabled'
        })

        const russianRuntimeResponsePromise = waitForPublicRuntimeResponse()
        await switchRuntimeLocale(anonymousPage, 'ru')
        const russianRuntimeResponse = await russianRuntimeResponsePromise
        expect(russianRuntimeResponse.ok()).toBe(true)
        expectAnonymousMarketingImagePayload({
            payload: await russianRuntimeResponse.json(),
            locale: 'ru',
            applicationId,
            brandLogoUrl,
            imageAltText
        })
        await expect(anonymousPage.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })
        await expect(anonymousPage.locator('html')).toHaveAttribute('lang', 'ru')
        await expectRenderedMarketingImage({
            page: anonymousPage,
            image: anonymousImage,
            alt: imageAltText.ru,
            url: brandLogoUrl,
            requestedUrls: localMedia.requestedUrls
        })
        await expectNoPageHorizontalOverflow(anonymousPage, 'Anonymous published Russian Marketing Image runtime at mobile-390')
        await expectNoTechnicalLeakage(anonymousPage.locator('body'), {
            label: 'Anonymous published Russian Marketing Image runtime at mobile-390',
            checkUuidSubstrings: true
        })
        await localMedia.assertLoaded(anonymousPage)
        await anonymousPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await expect
            .poll(() => anonymousPage.evaluate(() => window.scrollY), {
                message: 'The anonymous Russian runtime screenshot must start at the top of the page'
            })
            .toBe(0)
        await anonymousPage.screenshot({
            path: testInfo.outputPath('marketing-page-anonymous-image-ru-mobile-390.png'),
            fullPage: true,
            animations: 'disabled'
        })

        const russianIndependentHeroHeading = anonymousPage.getByRole('heading', {
            name: `${secondHero.titleRu} ${secondHero.accentRu}`,
            exact: true
        })
        const russianIndependentHero = anonymousPage.locator('[id^="hero-"]').filter({ has: russianIndependentHeroHeading })
        const russianIndependentHeroAction = russianIndependentHero.getByRole('link', { name: 'Начать', exact: true })
        await expect(russianIndependentHeroHeading).toBeVisible()
        await expect(russianIndependentHeroAction).toBeVisible()
        await russianIndependentHeroHeading.scrollIntoViewIfNeeded()
        await expect(russianIndependentHeroHeading).toBeInViewport({ ratio: 1 })
        await expectNoFixedMarketingHeaderOverlap(anonymousPage, russianIndependentHeroHeading, 'The mobile Russian Hero heading')

        await russianIndependentHeroAction.evaluate((action: HTMLElement) => {
            action.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' })
        })
        await expect(russianIndependentHeroAction).toBeInViewport({ ratio: 1 })
        await expectNoFixedMarketingHeaderOverlap(anonymousPage, russianIndependentHeroAction, 'The mobile Russian Hero action')
        await anonymousPage.screenshot({
            path: testInfo.outputPath('marketing-page-anonymous-ru-cta-mobile-390.png'),
            animations: 'disabled'
        })
        expect(pageErrors).toEqual([])
    } finally {
        await anonymousContext.close().catch(() => undefined)
    }
}
