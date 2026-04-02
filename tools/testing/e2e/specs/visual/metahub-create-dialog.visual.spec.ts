import { test, expect } from '../../fixtures/test'
import { toolbarSelectors } from '../../support/selectors/contracts'

test('@visual metahub create dialog layout remains stable', async ({ page }) => {
    await page.goto('/metahubs')
    await page.getByTestId(toolbarSelectors.primaryAction).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toHaveScreenshot('metahub-create-dialog.png', {
        animations: 'disabled'
    })
})
