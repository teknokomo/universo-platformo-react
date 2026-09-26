import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { applyBrowserPreferences } from '../browser/preferences'
import { getMarketingPageRuntime } from '../backend/api-session.mjs'
import { installMarketingPageLocalMedia } from '../marketingPageMedia'
import { flattenMarketingPageRecords, type RuntimePayload } from '../marketingPageRuntimeMaterialization'
import { escapeRegExp } from '../marketingPageAuthoringHelpers'
import { readLocalizedText } from '../entityRuntimeParsing'
import { verifyPublishedMarketingHeroRuntime } from './verifyPublishedMarketingHeroRuntime'

export type MarketingHeroCopy = {
    title: string
    accent: string
    titleRu: string
    accentRu: string
}

export async function verifyPublishedMarketingHeroJourney(options: {
    api: APIRequestContext
    page: Page
    testInfo: TestInfo
    browserIssues: Parameters<typeof verifyPublishedMarketingHeroRuntime>[0]['browserIssues']
    applicationId: string
    brandLogoUrl: string
    expectedConflictResourceUrls: string[]
    firstHero: MarketingHeroCopy
    secondHero: MarketingHeroCopy
}): Promise<void> {
    const { api, page, testInfo, browserIssues, applicationId, brandLogoUrl, expectedConflictResourceUrls, firstHero, secondHero } = options
    await applyBrowserPreferences(page, { language: 'en' })

    const runtimePayload = (await getMarketingPageRuntime(api, applicationId, 'en')) as RuntimePayload & {
        marketingPage?: RuntimePayload['marketingPage'] & { templateKey?: unknown }
    }
    expect(runtimePayload.templateKey).toBe('marketing-page')
    expect(runtimePayload.marketingPage?.templateKey).toBe('marketing-page')
    const settings = flattenMarketingPageRecords(runtimePayload).find((record) => record.kind === 'siteSettings')
    expect(settings).not.toHaveProperty('heroTitle')
    const publishedHeroWidgets = (runtimePayload.marketingPage?.widgets ?? []).filter((widget) => widget.widgetKey === 'marketing.hero')
    expect(publishedHeroWidgets).toHaveLength(2)
    expect(new Set(publishedHeroWidgets.map((widget) => widget.instanceKey)).size).toBe(2)
    const publishedHeroCopies = publishedHeroWidgets.map((widget) => {
        const rawContent = widget.data?.records?.[0]?.content
        if (!rawContent || typeof rawContent !== 'object' || Array.isArray(rawContent)) {
            throw new Error('Published Hero placement did not expose its bound Entity content')
        }
        const content = rawContent as Record<string, unknown>
        return {
            title: readLocalizedText(content.title, 'en'),
            accent: readLocalizedText(content.accent, 'en')
        }
    })
    expect(publishedHeroCopies).toEqual(
        expect.arrayContaining([
            { title: firstHero.title, accent: firstHero.accent },
            { title: secondHero.title, accent: secondHero.accent }
        ])
    )
    for (const widget of publishedHeroWidgets) expect(widget.data).not.toHaveProperty('id')
    const publishedFaqWidget = runtimePayload.marketingPage?.widgets?.find((widget) => widget.instanceKey === 'faq')
    // Inactive widgets are filtered from the published runtime envelope;
    // authoring keeps the inactive row, while runtime never exposes it.
    expect(publishedFaqWidget).toBeUndefined()

    // Reload the published app and assert the semantic value rendered by
    // the MUI marketing template, not an implementation detail or ID.
    await installMarketingPageLocalMedia(page)
    await page.goto(`/a/${applicationId}`)
    await expect(page.locator('#marketing-page-main')).toBeVisible({ timeout: 120_000 })
    const publishedHeroHeadings = page.getByRole('heading', {
        name: new RegExp(`${escapeRegExp(firstHero.title)}\\s+${escapeRegExp(firstHero.accent)}`)
    })
    const independentHeroHeadings = page.getByRole('heading', {
        name: new RegExp(`${escapeRegExp(secondHero.title)}\\s+${escapeRegExp(secondHero.accent)}`)
    })
    await expect(publishedHeroHeadings).toHaveCount(1)
    await expect(independentHeroHeadings).toHaveCount(1)
    await expect(publishedHeroHeadings.first()).toBeVisible()
    await expect(independentHeroHeadings.first()).toBeVisible()
    await expect(page.locator('#marketing-widget-faq')).toHaveCount(0)

    const publishedHeroAction = page
        .locator('[id^="hero-"]')
        .filter({ has: independentHeroHeadings })
        .getByRole('link', { name: 'Start now', exact: true })
    await expect(publishedHeroAction).toBeVisible()
    const publishedHeroActionHref = await publishedHeroAction.getAttribute('href')
    expect(publishedHeroActionHref).toMatch(/^#hero-/)
    const publishedHeroActionTargetId = publishedHeroActionHref!.slice(1)
    const publishedHeroActionTarget = page.locator(`[id="${publishedHeroActionTargetId}"]`)
    const publishedHeroActionTargetHeading = publishedHeroActionTarget.getByRole('heading', {
        name: new RegExp(`${escapeRegExp(secondHero.title)}\\s+${escapeRegExp(secondHero.accent)}`)
    })
    await expect(publishedHeroActionTargetHeading).toBeVisible()
    await publishedHeroAction.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`#${escapeRegExp(publishedHeroActionTargetId)}$`))
    await expect(publishedHeroActionTarget).toBeVisible()
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))

    await verifyPublishedMarketingHeroRuntime({
        page,
        testInfo,
        browserIssues,
        applicationId,
        brandLogoUrl,
        actionTargetId: publishedHeroActionTargetId,
        expectedConflictResourceUrls: expectedConflictResourceUrls,
        firstHero: {
            title: firstHero.title,
            accent: firstHero.accent,
            titleRu: firstHero.titleRu,
            accentRu: firstHero.accentRu
        },
        secondHero: {
            title: secondHero.title,
            accent: secondHero.accent,
            titleRu: secondHero.titleRu,
            accentRu: secondHero.accentRu
        }
    })
}
