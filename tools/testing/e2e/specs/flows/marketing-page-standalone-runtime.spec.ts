import { expect, test } from '../../fixtures/test'

const standaloneBaseUrl = process.env.E2E_MARKETING_PAGE_STANDALONE_BASE_URL?.trim() || ''
const standaloneApplicationId = process.env.E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID?.trim() || ''

test('@flow @marketing-page @standalone proves the standalone marketing runtime path when a deployed shell is supplied', async ({
    page
}, testInfo) => {
    test.setTimeout(90_000)
    test.skip(
        !standaloneBaseUrl || !standaloneApplicationId,
        'Standalone proof requires E2E_MARKETING_PAGE_STANDALONE_BASE_URL with an /api/v1 proxy and E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID; the local runner owns only the hosted app.'
    )

    const runtimeUrl = new URL(standaloneBaseUrl)
    runtimeUrl.hash = `/a/${encodeURIComponent(standaloneApplicationId)}?locale=en`
    await page.goto(runtimeUrl.toString())

    const main = page.getByRole('main')
    await expect(main).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible()

    const widgetRegions = page.locator('[data-marketing-widget-instance]')
    await expect(widgetRegions.first()).toBeVisible()
    expect(await widgetRegions.count()).toBeGreaterThanOrEqual(1)

    const visualState = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth
        const scrollWidth = document.documentElement.scrollWidth
        const mainRect = document.querySelector('main')?.getBoundingClientRect()
        return {
            viewportWidth,
            scrollWidth,
            mainWidth: mainRect?.width ?? 0,
            mainRight: mainRect?.right ?? 0
        }
    })
    expect(visualState.scrollWidth, JSON.stringify(visualState)).toBeLessThanOrEqual(visualState.viewportWidth)
    expect(visualState.mainWidth).toBeGreaterThan(0)
    expect(visualState.mainRight).toBeLessThanOrEqual(visualState.viewportWidth + 1)

    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toContain('[object Object]')
    expect(bodyText).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i)

    await page.screenshot({
        path: testInfo.outputPath('marketing-page-standalone.png'),
        fullPage: true,
        animations: 'disabled'
    })
})
