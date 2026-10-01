import { expect, type Locator } from '@playwright/test'
import { expectTextOnSingleLine } from '../browser/runtimeUx'

export const expectHeroDialogButtonTextOnOneLine = async (dialog: Locator, label: string): Promise<void> => {
    const buttons = dialog.locator('button.MuiButton-root')
    let measuredButtons = 0

    for (let index = 0; index < (await buttons.count()); index += 1) {
        const button = buttons.nth(index)
        if (!(await button.isVisible())) continue

        const text = (await button.innerText()).replace(/\s+/g, ' ').trim()
        if (!text) continue

        await expectTextOnSingleLine(button, `${label} button “${text}”`)
        measuredButtons += 1
    }

    expect(measuredButtons, `${label} must expose visible Hero action button text`).toBeGreaterThan(0)
}
