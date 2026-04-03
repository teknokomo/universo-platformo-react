import { test, expect } from '../../fixtures/test'
import { toolbarSelectors } from '../../support/selectors/contracts'

test('@smoke authenticated user can open metahubs workspace', async ({ page }) => {
    await page.goto('/metahubs')

    await expect(page.getByTestId(toolbarSelectors.primaryAction)).toBeVisible()
})
