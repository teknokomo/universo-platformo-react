import { expect, type Locator, type Page, type Response, type TestInfo } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { switchRuntimeLocale } from '../browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectNoUnexpectedBrowserRuntimeIssues,
    expectRuntimeUxViewportMatrix,
    expectTextOnSingleLine,
    expectStrictRuntimeUxSurface,
    watchBrowserRuntimeIssues
} from '../browser/runtimeUx'
import { verifyPublishedMarketingRuntimeFailureRecovery } from './verifyPublishedMarketingRuntimeFailureRecovery'

type HeroCopy = {
    title: string
    accent: string
    titleRu: string
    accentRu: string
}

type HeroViewport = {
    name: string
    width: number
}

const isAbilityPermissionsResponse = (response: Response): boolean =>
    response.request().method() === 'GET' && new URL(response.url()).pathname === '/api/v1/auth/permissions'

async function expectHeroHeadingGeometry(options: {
    heading: Locator
    label: string
    title: string
    accent: string
    viewport: HeroViewport
}): Promise<void> {
    const { heading, label, title, accent, viewport } = options
    const geometry = await heading.evaluate(
        (element, expectedCopies) => {
            const headingWidth = element.getBoundingClientRect().width
            const copyElements = Array.from(element.children).filter((child) => expectedCopies.includes((child.textContent ?? '').trim()))
            return {
                headingWidth,
                copies: copyElements.map((child) => {
                    const range = document.createRange()
                    range.selectNodeContents(child)
                    const copy = child as HTMLElement
                    const lineCharacterCounts = new Map<number, number>()
                    const textWalker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
                    let textNode = textWalker.nextNode()
                    while (textNode) {
                        const text = textNode.textContent ?? ''
                        let offset = 0
                        for (const character of Array.from(text)) {
                            if (!/\s/u.test(character)) {
                                const characterRange = document.createRange()
                                characterRange.setStart(textNode, offset)
                                characterRange.setEnd(textNode, offset + character.length)
                                const lineTop = Math.round(characterRange.getBoundingClientRect().top)
                                lineCharacterCounts.set(lineTop, (lineCharacterCounts.get(lineTop) ?? 0) + 1)
                            }
                            offset += character.length
                        }
                        textNode = textWalker.nextNode()
                    }
                    return {
                        text: copy.textContent?.trim() ?? '',
                        width: copy.getBoundingClientRect().width,
                        lineCount: range.getClientRects().length,
                        lineCharacterCounts: Array.from(lineCharacterCounts.values()),
                        scrollWidth: copy.scrollWidth,
                        clientWidth: copy.clientWidth
                    }
                })
            }
        },
        [title, accent]
    )

    expect(geometry.headingWidth, `${label} heading should use a usable width at ${viewport.name}`).toBeGreaterThanOrEqual(
        viewport.width * 0.45
    )
    expect(
        geometry.copies.map((copy) => copy.text),
        `${label} text should match the bound Entity record`
    ).toEqual([title, accent])
    for (const copy of geometry.copies) {
        const minimumWidthShare = viewport.name === 'mobile-390' ? 0.85 : 0.25
        expect(copy.width, `${label} copy should occupy a usable width at ${viewport.name}`).toBeGreaterThanOrEqual(
            geometry.headingWidth * minimumWidthShare
        )
        expect(copy.lineCount, `${label} copy should wrap at ${viewport.name}`).toBeGreaterThan(1)
        expect(
            copy.lineCharacterCounts,
            `${label} copy should not leave a single character stranded on its own line at ${viewport.name}`
        ).not.toContain(1)
        expect(copy.scrollWidth, `${label} copy should not overflow its own box at ${viewport.name}`).toBeLessThanOrEqual(
            copy.clientWidth + 1
        )
    }
}

export async function verifyPublishedMarketingHeroRuntime(options: {
    page: Page
    testInfo: TestInfo
    browserIssues: ReturnType<typeof watchBrowserRuntimeIssues>
    applicationId: string
    brandLogoUrl: string
    actionTargetId: string
    expectedConflictResourceUrls: string[]
    firstHero: HeroCopy
    secondHero: HeroCopy
}): Promise<void> {
    const {
        page,
        testInfo,
        browserIssues,
        applicationId,
        brandLogoUrl,
        actionTargetId,
        expectedConflictResourceUrls,
        firstHero,
        secondHero
    } = options
    const firstHeroHeadings: Locator = page.getByRole('heading', { name: `${firstHero.title} ${firstHero.accent}`, exact: true })
    const secondHeroHeadings: Locator = page.getByRole('heading', { name: `${secondHero.title} ${secondHero.accent}`, exact: true })
    const expectPublishedBrandLogo = async (logo: Locator, label: string): Promise<void> => {
        await expect(logo, `${label} must render the configured brand logo image`).toHaveCount(1)
        await expect
            .poll(async () => logo.evaluate((element) => (element as HTMLImageElement).naturalWidth), {
                message: `Waiting for ${label} to decode the configured brand logo`,
                timeout: 30_000
            })
            .toBeGreaterThan(0)
        await expect(logo, `${label} must be visible`).toBeVisible()
    }
    await expectPublishedBrandLogo(
        page.locator(`[data-testid="marketing-header-shell"] img[src="${brandLogoUrl}"]`),
        'Published marketing header'
    )
    await expectPublishedBrandLogo(page.locator(`#footer img[src="${brandLogoUrl}"]`), 'Published marketing footer')

    await page.waitForLoadState('networkidle')
    await page.reload()
    await expect(firstHeroHeadings).toHaveCount(1, {
        timeout: 120_000
    })
    await expect(firstHeroHeadings.first()).toBeVisible({
        timeout: 120_000
    })
    await expect(secondHeroHeadings).toHaveCount(1, {
        timeout: 120_000
    })
    await expect(secondHeroHeadings.first()).toBeVisible({
        timeout: 120_000
    })

    const expectedRuntimeFailurePattern = await verifyPublishedMarketingRuntimeFailureRecovery({
        page,
        testInfo,
        applicationId,
        firstHero: {
            en: `${firstHero.title} ${firstHero.accent}`,
            ru: `${firstHero.titleRu} ${firstHero.accentRu}`
        },
        secondHero: {
            en: `${secondHero.title} ${secondHero.accent}`,
            ru: `${secondHero.titleRu} ${secondHero.accentRu}`
        }
    })
    const englishPermissionsResponsePromise = page.waitForResponse(isAbilityPermissionsResponse)
    await switchRuntimeLocale(page, 'en')
    const englishPermissionsResponse = await englishPermissionsResponsePromise
    expect([200, 401]).toContain(englishPermissionsResponse.status())
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(firstHeroHeadings).toBeVisible({ timeout: 120_000 })
    await expect(secondHeroHeadings).toBeVisible({ timeout: 120_000 })
    await expect(page.locator('#marketing-widget-faq')).toHaveCount(0)

    await expectStrictRuntimeUxSurface(page.locator('body'), {
        label: 'Published marketing-page authoring flow',
        locale: 'en'
    })
    await expectRuntimeUxViewportMatrix(page, 'Published two-Hero marketing runtime', {
        beforeEachViewport: async (viewport) => {
            await expect(firstHeroHeadings).toHaveCount(1)
            await expect(secondHeroHeadings).toHaveCount(1)
            await expect(firstHeroHeadings.first()).toBeVisible()
            await expect(secondHeroHeadings.first()).toBeVisible()
            const secondHeroAction = page
                .locator('[id^="hero-"]')
                .filter({ has: secondHeroHeadings.first() })
                .getByRole('link', { name: 'Start now', exact: true })
            await expectTextOnSingleLine(secondHeroAction, `Published Hero action at ${viewport.name}`)
            if (viewport.name === 'desktop-1920') {
                const accessibility = await new AxeBuilder({ page })
                    .include('#marketing-page-main')
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                    .analyze()
                expect(
                    accessibility.violations,
                    `English published Hero accessibility: ${JSON.stringify(accessibility.violations)}`
                ).toEqual([])
            }
            if (viewport.name === 'mobile-390' || viewport.name === 'tablet-768') {
                await expectNoPageHorizontalOverflow(page, `Published unbroken Hero copy at ${viewport.name}`)
                const heroCopyCases = [
                    {
                        label: 'first bound Hero',
                        heading: firstHeroHeadings.first(),
                        title: firstHero.title,
                        accent: firstHero.accent
                    },
                    {
                        label: 'second bound Hero',
                        heading: secondHeroHeadings.first(),
                        title: secondHero.title,
                        accent: secondHero.accent
                    }
                ] as const
                for (const heroCopy of heroCopyCases) {
                    await expectHeroHeadingGeometry({ ...heroCopy, viewport })
                }
            }
            if (viewport.name === 'desktop-1920' || viewport.name === 'tablet-768' || viewport.name === 'mobile-390') {
                await page.screenshot({
                    path: testInfo.outputPath(`marketing-page-two-hero-${viewport.name}.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
        }
    })
    await page.screenshot({ path: testInfo.outputPath('marketing-page-authoring-runtime.png'), fullPage: true, animations: 'disabled' })

    const russianPermissionsResponsePromise = page.waitForResponse(isAbilityPermissionsResponse)
    await switchRuntimeLocale(page, 'ru')
    const russianPermissionsResponse = await russianPermissionsResponsePromise
    expect([200, 401]).toContain(russianPermissionsResponse.status())
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
    const firstHeroRussianHeading = page.getByRole('heading', {
        name: `${firstHero.titleRu} ${firstHero.accentRu}`,
        exact: true
    })
    const secondHeroRussianHeading = page.getByRole('heading', {
        name: `${secondHero.titleRu} ${secondHero.accentRu}`,
        exact: true
    })
    await expectStrictRuntimeUxSurface(page.locator('body'), {
        label: 'Published Russian marketing-page runtime',
        locale: 'ru'
    })
    await expectRuntimeUxViewportMatrix(page, 'Russian published two-Hero marketing runtime', {
        beforeEachViewport: async (viewport) => {
            await expect(firstHeroRussianHeading).toBeVisible()
            await expect(secondHeroRussianHeading).toBeVisible()
            if (viewport.name === 'desktop-1920') {
                const accessibility = await new AxeBuilder({ page })
                    .include('#marketing-page-main')
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                    .analyze()
                expect(
                    accessibility.violations,
                    `Russian published Hero accessibility: ${JSON.stringify(accessibility.violations)}`
                ).toEqual([])
            }
            await expectNoTechnicalLeakage(page.locator('body'), {
                label: `Russian published two-Hero runtime at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            const secondHeroRussianAction = page
                .locator('[id^="hero-"]')
                .filter({ has: secondHeroRussianHeading })
                .getByRole('link', { name: 'Начать', exact: true })
            await expectTextOnSingleLine(secondHeroRussianAction, `Russian published Hero action at ${viewport.name}`)
            await expect(secondHeroRussianAction).toHaveAttribute('href', `#${actionTargetId}`)
            await expectNoPageHorizontalOverflow(page, `Russian published two-Hero runtime at ${viewport.name}`)
            if (viewport.name === 'mobile-390' || viewport.name === 'tablet-768') {
                await expectHeroHeadingGeometry({
                    heading: firstHeroRussianHeading,
                    label: 'First Russian bound Hero',
                    title: firstHero.titleRu,
                    accent: firstHero.accentRu,
                    viewport
                })
                await expectHeroHeadingGeometry({
                    heading: secondHeroRussianHeading,
                    label: 'Second Russian bound Hero',
                    title: secondHero.titleRu,
                    accent: secondHero.accentRu,
                    viewport
                })
            }
            await page.screenshot({
                path: testInfo.outputPath(`marketing-page-two-hero-runtime-ru-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }
    })

    expectNoUnexpectedBrowserRuntimeIssues(browserIssues, 'Marketing-page authoring browser flow', {
        allowTextPatterns: [expectedRuntimeFailurePattern],
        allowExpectedConflictResourceUrls: expectedConflictResourceUrls
    })
}
