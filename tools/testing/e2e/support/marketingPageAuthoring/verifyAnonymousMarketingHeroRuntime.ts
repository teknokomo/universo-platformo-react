import { expect, type Browser, type Page, type TestInfo } from '@playwright/test'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectTextOnSingleLine } from '../browser/runtimeUx'

type HeroCopy = { title: string; accent: string }

export async function verifyAnonymousMarketingHeroRuntime(options: {
    browser: Browser
    page: Page
    testInfo: TestInfo
    applicationId: string
    firstHero: HeroCopy
    secondHero: HeroCopy
}): Promise<void> {
    const { browser, page, testInfo, applicationId, firstHero, secondHero } = options
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
        const pageErrors: string[] = []
        anonymousPage.on('pageerror', (error) => pageErrors.push(error.message))
        const publishedUrl = new URL(`/a/${applicationId}?locale=en`, page.url())
        const publicRuntimeResponsePromise = anonymousPage.waitForResponse((response) => {
            const responseUrl = new URL(response.url())
            return response.request().method() === 'GET' && responseUrl.pathname === `/api/v1/public/applications/${applicationId}/runtime`
        })
        await anonymousPage.goto(publishedUrl.toString())
        const publicRuntimeResponse = await publicRuntimeResponsePromise
        expect(publicRuntimeResponse.ok()).toBe(true)
        const publicRuntimePayload: unknown = await publicRuntimeResponse.json()
        expect(JSON.stringify(publicRuntimePayload)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/iu)
        await expect(anonymousPage.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })
        expect(await anonymousPage.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0)

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
        expect(pageErrors).toEqual([])
    } finally {
        await anonymousContext.close().catch(() => undefined)
    }
}
