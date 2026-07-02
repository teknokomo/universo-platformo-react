// Interpretation Network — smoke coverage for the published application runtime.
//
// Verifies that an imported Interpretation Network snapshot can create a published
// application, synchronize its schema, expose an intro Page plus an empty
// Structures workspace, and render without browser regressions.

import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    INTERPRETATION_NETWORK_CANONICAL_METAHUB,
    INTERPRETATION_NETWORK_FIXTURE_FILENAME
} from '../../support/interpretationNetworkFixtureContract'
import {
    expectNoInterpretationNetworkBrowserRegressionIssues,
    expectInterpretationNetworkRuntimeDataReady,
    watchInterpretationNetworkBrowserRegressionIssues
} from '../../support/interpretationNetworkRuntime'
import type { Locator, Page } from '@playwright/test'

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const getVisibleWorkspaceSwitcher = (page: Page): Locator =>
    page.getByTestId('runtime-workspace-switcher').filter({ visible: true }).first()

const getDockedRuntimeNavigation = (page: Page): Locator =>
    page.getByTestId('runtime-side-menu-docked').locator('nav[aria-label="Interpretation Network"]')

test.describe('Interpretation Network published application @smoke', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('imported interpretation-network snapshot renders the interpretation workspace', async ({ page, runManifest }) => {
        const browserIssues = watchInterpretationNetworkBrowserRegressionIssues(page)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const { applicationId, metahub } = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: 'smoke'
        })
        await recordCreatedMetahub({
            id: metahub.id,
            name: 'Interpretation Network smoke',
            codename: 'interpretation-network-smoke'
        })

        await expectInterpretationNetworkRuntimeDataReady(api, applicationId)

        await page.goto(`/metahub/${metahub.id}`)
        await expect(page.getByText(INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en, { exact: true }).first()).toBeVisible({
            timeout: 30_000
        })
        await page.goto(`/a/${applicationId}`)
        await expect(getVisibleWorkspaceSwitcher(page)).toBeVisible({ timeout: 30_000 })
        const menu = getDockedRuntimeNavigation(page)
        await expect(menu).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Start' })).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Structures' })).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Workspaces' })).toBeVisible()
        await expect(page.getByRole('main')).toContainText(/interpretation network/i)
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        await menu.getByRole('link', { name: 'Structures' }).click()
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('heading', { name: 'Structures' })).toBeVisible()
        await expect(
            page.getByTestId('interpretation-network-structure-pane').getByRole('textbox', { name: 'Filter by title' })
        ).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Table view' })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Card view' })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Create' })).toBeVisible()
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
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network interpretation workspace smoke',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network interpretation workspace smoke')
        expectNoInterpretationNetworkBrowserRegressionIssues(browserIssues, 'Interpretation Network smoke')
    })
})
