// Interpretation Network — visual regression coverage.
//
// Captures the published Interpretation Network empty Structures workspace and proves that
// the canonical first-use surface is available after import.
//
// This spec attaches visual evidence without requiring a committed baseline.
// A pixel baseline can be added later after the runtime surface stabilizes.

import { expect, test } from '../../fixtures/test'
import { PNG } from 'pngjs'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    INTERPRETATION_NETWORK_CANONICAL_METAHUB,
    INTERPRETATION_NETWORK_FIXTURE_FILENAME
} from '../../support/interpretationNetworkFixtureContract'
import { expectInterpretationNetworkRuntimeDataReady } from '../../support/interpretationNetworkRuntime'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const expectMeaningfulScreenshot = (screenshot: Buffer, label: string): void => {
    const png = PNG.sync.read(screenshot)
    expect(png.width, `${label} screenshot width`).toBeGreaterThan(300)
    expect(png.height, `${label} screenshot height`).toBeGreaterThan(300)
    expect(new Set(screenshot).size, `${label} PNG bytes must not be uniform`).toBeGreaterThan(16)
}

test.describe('Interpretation Network workspace @visual', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('captures the interpretation workspace baseline', async ({ page, runManifest }, testInfo) => {
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const { applicationId, metahub } = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: `visual-workspace-${testInfo.project.name}`
        })
        await recordCreatedMetahub({
            id: metahub.id,
            name: `Interpretation Network visual workspace (${testInfo.project.name})`,
            codename: `interpretation-network-visual-workspace-${testInfo.project.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
        })

        await page.goto(`/metahub/${metahub.id}`)
        await expect(page.getByText(INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en, { exact: true }).first()).toBeVisible({
            timeout: 30_000
        })

        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId('runtime-workspace-switcher')).toBeVisible({ timeout: 30_000 })
        const menu = page.getByRole('navigation').first()
        await expect(menu).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Start' })).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Structures' })).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Workspaces' })).toBeVisible()
        await menu.getByRole('link', { name: 'Structures' }).click()
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText('Create structure')
        await expect(page.getByTestId('interpretation-network-structure-pane')).not.toContainText(
            'Create a structure to start working with the matrix.'
        )
        await expect(page.getByTestId('interpretation-network-details-pane')).toContainText('How to work with structures')
        await expect(page.getByTestId('interpretation-network-details-pane')).toContainText(
            'Create or select a structure on the left. After you open a structure, select a matrix cell to manage its materials here.'
        )
        await expect(page.getByTestId('interpretation-network-details-pane')).not.toContainText('Materials')
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Add material' })).toHaveCount(0)
        await expect(page.getByRole('main').getByRole('button', { name: 'Add page' })).toHaveCount(0)
        await expect(page.getByRole('main').getByText('Gravity', { exact: false })).toHaveCount(0)
        await expect(page.getByRole('main').getByText('Gravity material', { exact: false })).toHaveCount(0)
        await expect(page.getByRole('main').getByText('Attraction between masses', { exact: false })).toHaveCount(0)
        await expect(page.getByRole('main').getByText('Basic interpretation matrix', { exact: false })).toHaveCount(0)
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network workspace visual')
        const screenshot = await page.screenshot({
            fullPage: true,
            animations: 'disabled'
        })
        expectMeaningfulScreenshot(screenshot, 'Interpretation Network workspace visual')
        await testInfo.attach('interpretationNetwork-interpretation-workspace', {
            body: screenshot,
            contentType: 'image/png'
        })
        await expectInterpretationNetworkRuntimeDataReady(api, applicationId)
    })
})
