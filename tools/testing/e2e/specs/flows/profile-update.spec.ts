import { test, expect } from '../../fixtures/test'
import { profileSelectors } from '../../support/selectors/contracts'

test('@flow profile data can be updated from the browser', async ({ page, runManifest }) => {
    const suffix = runManifest.runId.slice(-6)
    const nickname = `e2e_${suffix}`
    const firstName = `Auto${suffix}`
    const lastName = `Test${suffix}`

    await page.goto('/profile')

    await page.getByTestId(profileSelectors.nicknameInput).fill(nickname)
    await page.getByTestId(profileSelectors.firstNameInput).fill(firstName)
    await page.getByTestId(profileSelectors.lastNameInput).fill(lastName)
    await page.getByTestId(profileSelectors.submitButton).click()

    await page.waitForResponse(
        (response) => response.request().method() === 'PUT' && /\/api\/v1\/profile\//.test(response.url()) && response.ok()
    )

    await page.reload()

    await expect(page.getByTestId(profileSelectors.nicknameInput)).toHaveValue(nickname)
    await expect(page.getByTestId(profileSelectors.firstNameInput)).toHaveValue(firstName)
    await expect(page.getByTestId(profileSelectors.lastNameInput)).toHaveValue(lastName)
})
