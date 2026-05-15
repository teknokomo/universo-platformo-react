import { expect, test } from '../../fixtures/test'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { expectLeftEdgeAligned, expectRightEdgeAligned } from '../../support/browser/spacing'
import { feedbackSelectors, viewHeaderSelectors } from '../../support/selectors/contracts'

const METAHUB_DISPLAY_STYLE_KEY = 'metahubsMetahubDisplayStyle'
const METAHUBS_LIST_REQUEST_PATTERN = /\/api\/v1\/metahubs(?:\?.*)?$/

test('@flow metahub shell breadcrumbs and loading skeletons stay aligned on the list route', async ({ page }) => {
    await applyBrowserPreferences(page, { language: 'en' })
    await page.addInitScript(
        ({ storageKey, viewMode }) => {
            window.localStorage.setItem(storageKey, viewMode)
        },
        {
            storageKey: METAHUB_DISPLAY_STYLE_KEY,
            viewMode: 'card'
        }
    )

    let delayedListRequestCount = 0
    await page.route(METAHUBS_LIST_REQUEST_PATTERN, async (route) => {
        delayedListRequestCount += 1
        const response = await route.fetch()
        await new Promise((resolve) => setTimeout(resolve, 800))
        await route.fulfill({ response })
    })

    await page.goto('/metahubs')

    const breadcrumbs = page.getByLabel('breadcrumb')
    const titleRegion = page.getByTestId(viewHeaderSelectors.titleRegion)
    const controlsRegion = page.getByTestId(viewHeaderSelectors.controlsRegion)
    const skeletonGrid = page.getByTestId(feedbackSelectors.skeletonGrid).first()

    await expect(page.getByRole('heading', { name: 'Metahubs' })).toBeVisible()
    await expect(breadcrumbs).toBeVisible()
    await expect(titleRegion).toBeVisible()
    await expect(controlsRegion).toBeVisible()
    await expect(skeletonGrid).toBeVisible()
    expect(delayedListRequestCount).toBeGreaterThan(0)

    await expectLeftEdgeAligned(titleRegion, breadcrumbs, 4)
    await expectLeftEdgeAligned(titleRegion, skeletonGrid, 4)
    await expectRightEdgeAligned(controlsRegion, skeletonGrid, 4)

    await expect(page.getByTestId(feedbackSelectors.skeletonGrid)).toHaveCount(0, { timeout: 5000 })
})
