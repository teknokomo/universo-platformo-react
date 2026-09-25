import { type Locator, type Page, type TestInfo } from '@playwright/test'
import { expectLocatorFullyFitsViewport, expectNoPageHorizontalOverflow } from '../browser/runtimeUx'
import { expectStandardDialogActionFooter } from '../marketingPageAuthoringHelpers'

/** Capture responsive layout and screenshot evidence for the copy dialog at supported viewport sizes. */
export async function verifyMarketingLayoutCopyDialogViewports(options: {
    page: Page
    testInfo: TestInfo
    dialog: Locator
}): Promise<void> {
    const { page, testInfo, dialog } = options

    for (const viewport of [
        { name: 'desktop-1920', width: 1920, height: 1080 },
        { name: 'tablet-768', width: 768, height: 1024 },
        { name: 'mobile-390', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectLocatorFullyFitsViewport(dialog, `Marketing layout copy dialog at ${viewport.name}`)
        await expectStandardDialogActionFooter(dialog, `Marketing layout copy dialog at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Marketing layout copy dialog at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-layout-copy-options-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
}
