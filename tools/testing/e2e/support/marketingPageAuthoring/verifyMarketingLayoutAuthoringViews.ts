import { expect, type Page, type TestInfo } from '@playwright/test'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectTableHorizontalScrollConstrained
} from '../browser/runtimeUx'
import { ensureListView } from '../marketingPageAuthoringHelpers'

export async function verifyMarketingLayoutAuthoringViews(options: {
    page: Page
    testInfo: TestInfo
    metahubId: string
    sourceLayoutName: string
}): Promise<void> {
    const { page, testInfo, metahubId, sourceLayoutName } = options
    await page.goto(`/metahub/${metahubId}/resources`)
    await page.getByRole('tab', { name: /^(?:Layouts|Макеты)$/ }).click()
    await expect(page.getByTestId('metahub-layouts-list-content')).toBeVisible()
    await ensureListView(page)

    const layoutList = page.getByTestId('metahub-layouts-list-content')
    const listViewButton = page.getByTitle(/^(?:List View|Списком)$/)
    const cardViewButton = page.getByTitle(/^(?:Card View|Карточками)$/)

    for (const mode of ['list', 'card'] as const) {
        if (mode === 'card') await cardViewButton.click()
        const selectedViewButton = mode === 'list' ? listViewButton : cardViewButton
        await expect(selectedViewButton).toHaveAttribute('aria-pressed', 'true')
        await expectRuntimeUxViewportMatrix(page, `Metahub layouts ${mode} view`, {
            beforeEachViewport: async (viewport) => {
                const sourceLayoutLabel = layoutList.getByText(sourceLayoutName, { exact: true }).first()
                await expect(sourceLayoutLabel).toBeVisible()
                if (mode === 'list') {
                    const sourceLayoutLink = layoutList.getByRole('link', { name: sourceLayoutName, exact: true }).first()
                    await expect(sourceLayoutLink).toBeVisible()
                    const table = layoutList.getByRole('table')
                    await expect(table, `Metahub layout list view must render a table at ${viewport.name}`).toBeVisible()
                    await expectTableHorizontalScrollConstrained(table.locator('xpath=..'), `Metahub layout list view at ${viewport.name}`)
                } else {
                    const sourceLayoutCard = layoutList.getByRole('button', { name: sourceLayoutName, exact: true }).first()
                    await expect(
                        sourceLayoutCard,
                        `Metahub layout card view must render the layout in a card at ${viewport.name}`
                    ).toBeVisible()
                }
                await expectNoTechnicalLeakage(layoutList, {
                    label: `Metahub layouts ${mode} view at ${viewport.name}`,
                    checkUuidSubstrings: true
                })
                await expectNoPageHorizontalOverflow(page, `Metahub layouts ${mode} view at ${viewport.name}`)
                await page.screenshot({
                    path: testInfo.outputPath(`marketing-layouts-${mode}-${viewport.name}.png`),
                    fullPage: true,
                    animations: 'disabled'
                })
            }
        })
        if (mode === 'card') await listViewButton.click()
    }
}
