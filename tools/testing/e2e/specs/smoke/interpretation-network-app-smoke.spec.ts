// Interpretation Network — smoke coverage for the published application runtime.
//
// Verifies that an imported Interpretation Network snapshot can create a published
// application, synchronize its schema, expose an intro Page plus the default
// multiple-Structures workspace, and render without browser regressions.

import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeNavigationIconSemantics
} from '../../support/browser/runtimeUx'
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

const getDockedRuntimeNavigation = (page: Page): Locator => page.getByTestId('runtime-side-menu-docked').getByRole('navigation').first()

test.describe('Interpretation Network published application @smoke', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('imported interpretation-network snapshot renders the interpretation workspace', async ({ page, runManifest }, testInfo) => {
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
        const welcomeLink = menu.getByRole('link', { name: 'Welcome', exact: true })
        const startLink = menu.getByRole('link', { name: 'Start', exact: true })
        const structuresLink = menu.getByRole('link', { name: 'Structures', exact: true })
        await expect(welcomeLink).toBeVisible()
        // The application root does not implicitly select a semantic target;
        // navigation becomes current only after the user opens a destination.
        await expect(welcomeLink).not.toHaveAttribute('aria-current')
        await expect(startLink).toBeVisible()
        await expect(startLink).not.toHaveAttribute('aria-current', 'page')
        await expect(structuresLink).toBeVisible()
        await expect(menu.getByRole('link', { name: 'Workspaces' })).toBeVisible()
        const mainGroup = menu.getByRole('heading', { name: 'Main', exact: true })
        await expect(mainGroup).toHaveCount(0)
        await expectRuntimeNavigationIconSemantics(menu, [
            { label: 'Welcome', family: 'home' },
            { label: 'Start', family: 'home' },
            { label: 'Structures', family: 'structures' }
        ])
        await expect(page.getByRole('main')).toContainText(/interpretation network/i)
        await structuresLink.click()
        await expect(structuresLink).toHaveAttribute('aria-current', 'page')
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        const structurePane = page.getByTestId('interpretation-network-structure-pane')
        await expect(page.getByTestId('interpretation-network-matrix-workspace')).toHaveCount(0)
        await expect(structurePane.getByRole('heading', { name: 'Structures' })).toBeVisible()
        await expect(structurePane.getByRole('textbox', { name: 'Filter by title' })).toBeVisible()
        await expect(structurePane.getByRole('button', { name: 'Create', exact: true })).toBeEnabled()
        await expect(structurePane.getByRole('tab', { name: 'Templates' })).toBeVisible()
        await expect(structurePane.getByText('Create a structure first.', { exact: true })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-header')).toHaveCount(0)
        await expect(structurePane.getByRole('button', { name: 'Create from template' })).toHaveCount(0)
        const detailsPane = page.getByTestId('interpretation-network-details-pane')
        await expect(detailsPane.getByRole('heading', { name: 'How to work with structures' })).toBeVisible()
        await expect(detailsPane).toContainText('Create or select a structure on the left.')
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
        await testInfo.attach('interpretation-network-default-structures-empty-state', {
            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
            contentType: 'image/png'
        })
        expectNoInterpretationNetworkBrowserRegressionIssues(browserIssues, 'Interpretation Network smoke')
    })
})
