import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '../../fixtures/test'
import {
    expectLocalizedValidation,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'

const standaloneBaseUrl = process.env.E2E_MARKETING_PAGE_STANDALONE_BASE_URL?.trim() || ''
const standaloneApplicationId = process.env.E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID?.trim() || ''

const requireStandaloneConfiguration = (): URL => {
    const missing: string[] = []
    if (!standaloneBaseUrl) missing.push('E2E_MARKETING_PAGE_STANDALONE_BASE_URL')
    if (!standaloneApplicationId) missing.push('E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID')
    if (missing.length > 0) {
        throw new Error(
            `BLOCKED: standalone acceptance requires ${missing.join(
                ' and '
            )}. The supplied host must serve a built standalone shell, provide a same-origin /api/v1 proxy to the E2E backend, and support the repository auth setup; the local apps-template-mui Vite shell does not provide that proxy or auth route.`
        )
    }

    try {
        return new URL(standaloneBaseUrl)
    } catch {
        throw new Error(`BLOCKED: E2E_MARKETING_PAGE_STANDALONE_BASE_URL is not a valid absolute URL: ${standaloneBaseUrl}`)
    }
}

test('@flow @marketing-page @standalone proves the standalone marketing runtime path when a deployed shell is supplied', async ({
    page
}, testInfo) => {
    test.setTimeout(90_000)

    if (!standaloneBaseUrl || !standaloneApplicationId) {
        testInfo.skip(
            true,
            'Standalone acceptance is opt-in: provide E2E_MARKETING_PAGE_STANDALONE_BASE_URL and E2E_MARKETING_PAGE_STANDALONE_APPLICATION_ID to run it.'
        )
        return
    }

    const runtimeUrl = requireStandaloneConfiguration()
    runtimeUrl.hash = `/a/${encodeURIComponent(standaloneApplicationId)}?locale=en`
    await page.goto(runtimeUrl.toString())

    const main = page.getByRole('main')
    await expect(main).toBeVisible()
    await expect(page.getByRole('heading').first()).toBeVisible()

    const widgetRegions = page.locator('[data-marketing-widget-instance]')
    await expect(widgetRegions.first()).toBeVisible()
    expect(await widgetRegions.count()).toBeGreaterThanOrEqual(1)

    await expectRuntimeUxViewportMatrix(page, 'Standalone marketing runtime', {
        beforeEachViewport: async () => {
            await expect(main).toBeVisible()
        }
    })
    await expectNoPageHorizontalOverflow(page, 'Standalone marketing runtime')
    await expectNoTechnicalLeakage(page.locator('body'), {
        label: 'Standalone marketing runtime',
        checkUuidSubstrings: true
    })
    await expectLocalizedValidation(page.locator('body'), 'en', { label: 'Standalone marketing runtime' })
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])

    await page.screenshot({
        path: testInfo.outputPath('marketing-page-standalone.png'),
        fullPage: true,
        animations: 'disabled'
    })
})
