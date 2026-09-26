import { expect, type Page, type TestInfo } from '@playwright/test'
import { waitForSettledMutationResponse } from '../browser/network'
import { expectLocatorFullyFitsViewport, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../browser/runtimeUx'
import { responseIsMutation } from '../marketingPageAuthoringHelpers'

export async function enablePublicApplicationAndVerifySettings(options: {
    page: Page
    testInfo: TestInfo
    applicationId: string
}): Promise<void> {
    const { page, testInfo, applicationId } = options
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings', exact: true })).toBeVisible()

    const visibilityToggle = page.getByTestId('application-settings-visibility-toggle')
    const closedSwitch = visibilityToggle.getByRole('switch', { name: 'Closed', exact: true })
    await expect(closedSwitch).toBeVisible()
    await expect(closedSwitch).not.toBeChecked()

    await closedSwitch.click()
    const publicSwitch = visibilityToggle.getByRole('switch', { name: 'Public', exact: true })
    await expect(publicSwitch).toBeChecked()
    const saveSettingsButton = page.getByTestId('application-settings-general-save')
    await expect(saveSettingsButton).toBeVisible()
    for (const viewport of [
        { name: 'desktop-1920', width: 1920, height: 1080 },
        { name: 'tablet-768', width: 768, height: 1024 },
        { name: 'mobile-390', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(publicSwitch).toBeChecked()
        await expectLocatorFullyFitsViewport(visibilityToggle, `Application visibility setting at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Application Settings at ${viewport.name}`)
        await expectNoTechnicalLeakage(page.locator('[data-testid="application-settings-content"]'), {
            label: `Application Settings at ${viewport.name}`,
            checkUuidSubstrings: true
        })
        await page.screenshot({
            path: testInfo.outputPath(`application-settings-public-visibility-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }

    await page.setViewportSize({ width: 390, height: 844 })
    const popupSizeSetting = page.getByTestId('application-setting-dialogSizePreset')
    await popupSizeSetting.scrollIntoViewIfNeeded()
    await expectLocatorFullyFitsViewport(popupSizeSetting, 'Popup window size setting at mobile-390')
    const popupSizeControl = popupSizeSetting.getByRole('combobox', { name: 'Popup window size', exact: true })
    await expect(popupSizeControl).toBeVisible()
    expect(await popupSizeControl.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(300)

    await popupSizeControl.click()
    const largePopupSizeOption = page.getByRole('option', { name: 'Large (about 800 px)', exact: true })
    await expect(largePopupSizeOption).toBeVisible()
    await expectLocatorFullyFitsViewport(largePopupSizeOption, 'Large popup size option at mobile-390')
    await page.screenshot({
        path: testInfo.outputPath('application-settings-popup-size-options-mobile-390.png'),
        animations: 'disabled'
    })
    await largePopupSizeOption.click()
    await expect(popupSizeControl).toContainText('Large (about 800 px)')

    await saveSettingsButton.scrollIntoViewIfNeeded()
    await expectLocatorFullyFitsViewport(saveSettingsButton, 'Application Settings save control at mobile-390')

    const visibilityUpdate = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', new RegExp(`/api/v1/applications/${applicationId}$`)),
        { label: 'Enabling public application visibility in its existing settings screen' }
    )
    await saveSettingsButton.click()

    const response = await visibilityUpdate
    expect(response.ok()).toBe(true)
    await expect(publicSwitch).toBeChecked()
    await expect(popupSizeControl).toContainText('Large (about 800 px)')

    await page.reload()
    await expect(publicSwitch).toBeChecked()
    await expect(popupSizeControl).toContainText('Large (about 800 px)')
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
    await page.screenshot({
        path: testInfo.outputPath('application-settings-mobile-390-saved.png'),
        animations: 'disabled'
    })
}
