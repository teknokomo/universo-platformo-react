// Interpretation Network — flow coverage for the imported snapshot runtime.
//
// Verifies:
//   1. The published app opens the Interpretation Network start Page and menu.
//   2. The Structures workspace opens the single-system Matrix directly after schema sync.
//   3. Browser runtime surfaces do not leak raw UUIDs/JSON and do not
//      throw console/page/API 500 regressions.

import { expect, test } from '../../fixtures/test'
import {
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    listApplicationWorkspaces,
    sendWithCsrf,
    updateMetahub
} from '../../support/backend/api-session.mjs'
import { createLocalizedContent } from '@universo-react/utils'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { switchRuntimeLocale } from '../../support/browser/preferences'
import {
    expectDataGridHorizontalScrollConstrained,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectLocatorFullyFitsViewport,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls,
    expectRuntimeNavigationIconSemantics
} from '../../support/browser/runtimeUx'
import { recordCreatedApplication, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import {
    expectNoInterpretationNetworkBrowserRegressionIssues,
    expectInterpretationNetworkRuntimeDataReady,
    watchInterpretationNetworkBrowserRegressionIssues
} from '../../support/interpretationNetworkRuntime'
import {
    expectMatrixTableDefaultRuntime,
    expectMatrixTableHorizontalScrollConstrained,
    getMatrixTable
} from '../../support/interpretationNetworkMatrixTableRuntime'
import { resolveRuntimeIds } from '../../support/interpretationNetworkFocused'
import type { ApiContext } from './interpretation-network-app-imported-snapshot.shared.helpers'
import {
    createdStructureName,
    createdStructureDescription,
    createdMaterialTitle,
    createdMaterialDescription,
    updatedMaterialTitle,
    updatedMaterialDescription,
    materialBodyText,
    firstChildCellTitle,
    codenameVlc,
    matchesInterpretationNetworkStructureCreate,
    matchesInterpretationNetworkMaterialCreate,
    matchesInterpretationNetworkMaterialUpdate,
    matchesTemplateSave,
    matchesTemplateInstantiate,
    escapeRegExp,
    getMaterialOpenButton,
    hasLocalizedPayloadValue,
    setInterpretationNetworkStructureMode
} from './interpretation-network-app-imported-snapshot.shared.helpers'
import {
    expectInterpretationNetworkStartPage,
    expectSingleSystemMatrixWorkspace,
    expectMultipleStructuresWorkspace,
    expectEqualDesktopPaneWidths,
    getVisibleWorkspaceSwitcher,
    getDockedRuntimeNavigation,
    getVisibleRuntimeNavigation,
    expectSameSelectedToggleTheme,
    attachRuntimeScreenshot,
    expectRuntimeSideMenuModes,
    expectStructuresOverlayUsesFullRail
} from './interpretation-network-app-imported-snapshot.navigation.helpers'
import {
    fillOptionalStructureDialogFields,
    expectRuHiddenPlacementChildCellCreate,
    expectMatrixCellMoveNotSwapWithNewAxesCellDialog
} from './interpretation-network-app-imported-snapshot.matrix.helpers'
import {
    expectInterpretationNetworkMatrixSettings,
    expectMetahubAggregateWidgetSettings,
    expectApplicationLayoutWidgetSettings,
    expectWorkspaceSettingsLocalized,
    saveApplicationMatrixViewSettings
} from './interpretation-network-app-imported-snapshot.settings.helpers'
import {
    activateHierarchicalBreadcrumb,
    expectHorizontalRowsOnlyMatrixRuntime,
    expectIndependentRowsTableDrop,
    expectHierarchicalTableHasNoFreeSlotDrop,
    expectVerticalToolbarAndFiniteBreadcrumbs,
    fillMaterialDialogFields,
    fillMaterialBlockEditor
} from './interpretation-network-app-imported-snapshot.matrix-runtime.helpers'
import { expectRuntimeHeaderPreferences } from './interpretation-network-app-imported-snapshot.header.helpers'

test.describe('Interpretation Network imported snapshot @flow', () => {
    let api: ApiContext

    test.afterEach(async () => {
        if (api) {
            await disposeApiContext(api)
        }
    })

    test('imported interpretation-network snapshot renders the interpretation workspace', async ({ page, runManifest }, testInfo) => {
        test.setTimeout(240_000)
        const browserIssues = watchInterpretationNetworkBrowserRegressionIssues(page)
        api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })
        const { applicationId, metahub } = await importInterpretationNetworkSnapshot(api, {
            snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
            label: 'flow'
        })
        await recordCreatedMetahub({
            id: metahub.id,
            name: 'Interpretation Network flow',
            codename: 'interpretation-network-flow'
        })
        await recordCreatedApplication({ id: applicationId })
        await updateMetahub(api, metahub.id, {
            name: { en: 'Renamed Interpretation Network flow' },
            description: {
                en: 'Renamed during E2E to verify runtime menu targets are UUID-backed.'
            },
            namePrimaryLocale: 'en',
            descriptionPrimaryLocale: 'en',
            codename: codenameVlc('RenamedInterpretationNetworkFlow')
        })

        await page.goto(`/metahub/${metahub.id}`)
        await expect(page.getByText('Renamed Interpretation Network flow', { exact: true }).first()).toBeVisible({
            timeout: 30_000
        })

        await page.goto(`/a/${applicationId}`)
        await expect(getVisibleWorkspaceSwitcher(page)).toBeVisible({ timeout: 30_000 })
        await expectInterpretationNetworkStartPage(page)
        const initialStructuresLink = getVisibleRuntimeNavigation(page).getByRole('link', { name: 'Structures', exact: true })
        await initialStructuresLink.click()
        await expect(page).toHaveURL(/targetKind=object/)
        await expect(page).toHaveURL(/entityTypeCodename=Structure/)
        await expectMultipleStructuresWorkspace(page)
        await expectRuntimeUxViewportMatrix(page, 'Default multiple-Structures workspace', {
            beforeEachViewport: async () => {
                await expectMultipleStructuresWorkspace(page)
            }
        })
        await page.setViewportSize({ width: 1280, height: 900 })
        await expectMultipleStructuresWorkspace(page)
        await attachRuntimeScreenshot(page, testInfo, 'default-multiple-structures-workspace-desktop-1280')
        await page.goto(`/a/${applicationId}`)
        await expect(getVisibleWorkspaceSwitcher(page)).toBeVisible({ timeout: 30_000 })
        await expectInterpretationNetworkStartPage(page)
        await expect(page.getByRole('main')).not.toContainText('Users')
        await expect(page.getByRole('main')).not.toContainText('Conversions')
        await expect(page.getByRole('main')).not.toContainText('Event count')
        await expectRuntimeHeaderPreferences(page, testInfo)
        await expectRuntimeSideMenuModes(page, testInfo)
        await expectMetahubAggregateWidgetSettings(page, metahub.id, testInfo)
        await expectApplicationLayoutWidgetSettings(page, applicationId, testInfo)
        await expectInterpretationNetworkMatrixSettings(page, applicationId, testInfo)
        await expectWorkspaceSettingsLocalized(page, api, applicationId, testInfo)
        await page.goto(`/a/${applicationId}`)
        await expect(getVisibleWorkspaceSwitcher(page)).toBeVisible({ timeout: 30_000 })
        await expectInterpretationNetworkStartPage(page)
        await setInterpretationNetworkStructureMode(api, applicationId, 'singleSystem')
        await page.reload()
        await expectSingleSystemMatrixWorkspace(page)

        const menu = getDockedRuntimeNavigation(page)
        await expect(menu.getByRole('link', { name: 'Workspaces', exact: true })).toHaveCount(0)
        const workspaceSwitcher = page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')
        await expect(workspaceSwitcher).toBeVisible()
        await workspaceSwitcher.click()
        const manageWorkspacesOption = page.getByRole('option', { name: /Manage workspaces/ })
        await expect(manageWorkspacesOption).toBeVisible()
        await manageWorkspacesOption.click()
        await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible({ timeout: 30_000 })
        await expect(page).toHaveURL(new RegExp(`/a/${applicationId}/workspaces(?:[/?#]|$)`))
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        await expect(getVisibleRuntimeNavigation(page).getByRole('link', { name: 'Workspaces', exact: true })).toHaveCount(0)
        await expectRuntimeUxViewportMatrix(page, 'Dashboard Workspaces route', {
            beforeEachViewport: async (viewport) => {
                await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible()
                await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
                const headerActions = page.getByTestId('runtime-header-actions')
                const languageButton = page.getByTestId('runtime-language-switcher')
                const themeButton = page.locator('button[data-screenshot="toggle-mode"]')
                await expect(headerActions).toHaveCount(1)
                await expect(languageButton).toHaveCount(1)
                await expect(themeButton).toHaveCount(1)
                await expect(headerActions).toBeVisible()
                await expect(languageButton).toBeVisible()
                await expect(themeButton).toBeVisible()

                const narrowViewport = viewport.width < 900
                const openMenuButton = narrowViewport ? page.getByRole('button', { name: 'Open menu', exact: true }) : null
                if (openMenuButton) {
                    await expect(openMenuButton).toBeVisible()
                    await openMenuButton.focus()
                    await page.keyboard.press('Enter')
                }
                const workspaceNavigation = narrowViewport ? getVisibleRuntimeNavigation(page) : getDockedRuntimeNavigation(page)
                const workspaceLinks = [
                    { label: 'Dashboard', icon: 'DashboardRoundedIcon' },
                    { label: 'Access', icon: 'PeopleRoundedIcon' },
                    { label: 'Settings', icon: 'SettingsRoundedIcon' }
                ]
                for (const { label } of workspaceLinks) {
                    const link = workspaceNavigation.getByRole('link', { name: label, exact: true })
                    await expect(link, `Workspace management must keep the ${label} link`).toBeVisible()
                }
                await expectRuntimeNavigationIconSemantics(
                    workspaceNavigation,
                    workspaceLinks.map(({ label, icon }) => ({ label, family: icon }))
                )
                if (openMenuButton) {
                    if (viewport.name === 'mobile') {
                        await testInfo.attach('dashboard-workspaces-route-mobile-390.png', {
                            body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
                            contentType: 'image/png'
                        })
                    }
                    await page.keyboard.press('Escape')
                    await expect(workspaceNavigation).toBeHidden()
                    await expect(openMenuButton).toBeFocused()
                }
            }
        })
        await page.screenshot({
            path: testInfo.outputPath('dashboard-workspaces-route-desktop-1280.png'),
            fullPage: true,
            animations: 'disabled'
        })
        const workspaceMenu = getVisibleRuntimeNavigation(page)
        const interpretationPage = workspaceMenu.getByRole('link', { name: 'Start', exact: true })
        await expect(interpretationPage).toBeVisible()
        await expect(interpretationPage).not.toHaveAttribute('aria-current', 'page')
        await interpretationPage.click()
        await expect(page).toHaveURL(/targetKind=page/)
        await expect(page).toHaveURL(/entityTypeCodename=InterpretationNetworkIntro/)
        await expect(page.getByRole('main')).toContainText('helps build a hierarchy')
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        const structuresPage = workspaceMenu.getByRole('link', { name: 'Structures', exact: true })
        await structuresPage.click()
        await expect(page).toHaveURL(/targetKind=object/)
        await expect(page).toHaveURL(/entityTypeCodename=Structure/)
        await expect(structuresPage).toHaveAttribute('aria-current', 'page')
        await expectSingleSystemMatrixWorkspace(page)
        await interpretationPage.click()
        await expect(interpretationPage).toHaveAttribute('aria-current', 'page')
        await expect(page.getByRole('main')).toContainText('helps build a hierarchy')
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        await structuresPage.click()
        await expect(structuresPage).toHaveAttribute('aria-current', 'page')
        await expectSingleSystemMatrixWorkspace(page)
        await expectStructuresOverlayUsesFullRail(page, testInfo)
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network workspace shell')
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network workspace shell', {
            beforeEachViewport: async () => {
                await expectSingleSystemMatrixWorkspace(page)
            }
        })

        const runtimeSections = await expectInterpretationNetworkRuntimeDataReady(api, applicationId)
        await page.setViewportSize({ width: 1280, height: 900 })
        await expectSingleSystemMatrixWorkspace(page)
        await expectEqualDesktopPaneWidths(page, 'Empty Interpretation Network workspace')
        await switchRuntimeLocale(page, 'ru')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expectSingleSystemMatrixWorkspace(page, 'ru')
        await expect(
            page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Сохранить как шаблон' })
        ).toBeVisible()
        await expectRuHiddenPlacementChildCellCreate(page, applicationId)
        await expectEqualDesktopPaneWidths(page, 'RU single-system Interpretation Network workspace')
        await switchRuntimeLocale(page, 'en')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await expectSingleSystemMatrixWorkspace(page)
        const workspaceResponse = await listApplicationWorkspaces(api, applicationId)
        const workspaceItems = Array.isArray(workspaceResponse?.items) ? workspaceResponse.items : []
        const activeWorkspaceId = workspaceItems.find((workspace: { id?: string; isDefault?: boolean }) => workspace.isDefault === true)?.id
        if (typeof activeWorkspaceId !== 'string') {
            throw new Error('Interpretation Network workspace mutation checks require a default workspace id from the API')
        }
        expect(activeWorkspaceId, 'Interpretation Network workspace mutation checks need the active workspace id').toMatch(
            /^[0-9a-f-]{36}$/i
        )
        const saveTemplateButton = page
            .getByTestId('interpretation-network-structure-pane')
            .getByRole('button', { name: 'Save as template' })
        await saveTemplateButton.click()
        const saveTemplateDialog = page.getByRole('dialog', { name: 'Save structure as template' })
        await expect(saveTemplateDialog).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(saveTemplateDialog, {
            label: 'Save structure as template dialog',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expect(saveTemplateDialog.getByRole('textbox', { name: /\b(?:id|uuid|identifier)\b/iu })).toHaveCount(0)
        await expect(saveTemplateDialog.getByRole('button', { name: 'Save' })).toBeDisabled()
        await expectSemanticFieldControls(saveTemplateDialog, { longTextLabels: ['Description'] })
        const originalViewport = page.viewportSize() ?? { width: 1280, height: 900 }
        for (const viewport of [
            { name: 'wide-desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expect(saveTemplateDialog, `Save as template remains visible at ${viewport.width}px`).toBeVisible()
            await expectLocatorFullyFitsViewport(saveTemplateDialog, `Save as template dialog at ${viewport.width}px`)
            await expect(saveTemplateDialog.getByRole('button', { name: 'Save' })).toBeVisible()
            await expectNoPageHorizontalOverflow(page, `Save as template dialog at ${viewport.width}px`)
            await attachRuntimeScreenshot(page, testInfo, `interpretation-network-save-template-dialog-${viewport.name}`)
        }
        await page.setViewportSize(originalViewport)
        await saveTemplateDialog.getByRole('textbox', { name: 'Template name' }).fill('Reusable E2E template')
        await saveTemplateDialog.getByRole('textbox', { name: 'Description' }).fill('Template created by the browser flow.')
        await saveTemplateDialog.getByRole('radio', { name: 'Structure and materials' }).check()
        const saveTemplateRequest = waitForSettledMutationResponse(page, (response) => matchesTemplateSave(response, applicationId), {
            label: 'Saving Interpretation Network structure template'
        })
        await saveTemplateDialog.getByRole('button', { name: 'Save' }).click()
        expect((await saveTemplateRequest).ok()).toBe(true)
        await expect(saveTemplateDialog).toHaveCount(0)

        await setInterpretationNetworkStructureMode(api, applicationId, 'multiple')
        await page.reload()
        const structurePane = page.getByTestId('interpretation-network-structure-pane')
        await expect(structurePane.getByRole('heading', { name: 'Structures' })).toBeVisible({ timeout: 30_000 })
        await expect(structurePane.getByRole('button', { name: 'Create from template' })).toHaveCount(0)
        await structurePane.getByRole('button', { name: 'Create', exact: true }).click()
        const createStructureDialog = page.getByRole('dialog', { name: 'Create structure' })
        await expect(createStructureDialog).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(createStructureDialog, {
            label: 'Create structure from template dialog',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expect(createStructureDialog.getByRole('textbox', { name: /\b(?:id|uuid|identifier)\b/iu })).toHaveCount(0)
        await createStructureDialog.getByRole('tab', { name: 'Templates' }).click()
        await expect(createStructureDialog.getByRole('button', { name: 'Create' })).toBeDisabled()
        await expectSemanticFieldControls(createStructureDialog, { longTextLabels: ['Description'] })
        await expect(createStructureDialog.getByRole('combobox', { name: 'Template' })).toContainText('Reusable E2E template')
        await createStructureDialog.getByRole('textbox', { name: 'Name', exact: true }).fill('E2E structure from template')
        await createStructureDialog.getByRole('textbox', { name: 'Description' }).fill('Created from a saved template.')
        const instantiateTemplateRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesTemplateInstantiate(response, applicationId),
            {
                label: 'Instantiating Interpretation Network structure template'
            }
        )
        await createStructureDialog.getByRole('button', { name: 'Create' }).click()
        const instantiateTemplateResponse = await instantiateTemplateRequest
        expect(instantiateTemplateResponse.ok()).toBe(true)
        await expect(createStructureDialog).toHaveCount(0)
        await expect(page.getByTestId('interpretation-network-structure-header')).toContainText('E2E structure from template', {
            timeout: 30_000
        })
        await page.getByTestId('interpretation-network-structure-header').getByRole('button', { name: 'Structures' }).click()
        await expect(structurePane.getByRole('button', { name: 'E2E structure from template', exact: true })).toBeVisible({
            timeout: 30_000
        })
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network template browser flow',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })

        await page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Create', exact: true }).click()
        const structureDialog = page.getByRole('dialog', { name: 'Create structure' })
        await expect(structureDialog).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(structureDialog, {
            label: 'Create structure dialog',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expect(structureDialog.getByRole('textbox', { name: /\b(?:id|uuid|identifier)\b/iu })).toHaveCount(0)
        if ((await structureDialog.getByRole('textbox', { name: 'Description', exact: true }).count()) > 0) {
            await expectSemanticFieldControls(structureDialog, { longTextLabels: ['Description'] })
        }
        await fillOptionalStructureDialogFields(structureDialog, {
            name: createdStructureName,
            description: createdStructureDescription
        })
        const createStructureRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesInterpretationNetworkStructureCreate(response, applicationId, activeWorkspaceId),
            { label: 'Creating Interpretation Network structure' }
        )
        await structureDialog.getByRole('button', { name: 'Create' }).click()
        const createStructureResponse = await createStructureRequest
        expect(createStructureResponse.ok()).toBe(true)
        const createdStructure = (await createStructureResponse.json()) as {
            structureId?: string
            interpretationId?: string
            rootCellId?: string
        }
        expect(createdStructure.structureId, 'created structure id must be returned by the aggregate command').toMatch(/^[0-9a-f-]{36}$/i)
        expect(createdStructure.interpretationId, 'created interpretation id must be returned by the aggregate command').toMatch(
            /^[0-9a-f-]{36}$/i
        )
        expect(createdStructure.rootCellId, 'created root CellId must be returned by the aggregate command').toMatch(/^[0-9a-f-]{36}$/i)
        const createStructurePayload = createStructureResponse.request().postDataJSON() as Record<string, unknown>
        expect(createStructurePayload).toEqual(
            expect.objectContaining({
                name: expect.any(Object),
                locale: expect.any(String)
            })
        )
        expect(createStructurePayload).not.toHaveProperty('SystemKey')
        expect(createStructurePayload).not.toHaveProperty('ParentStructure')
        expect(createStructurePayload).not.toHaveProperty('CellId')
        await expect(structureDialog).toHaveCount(0)
        await expect(page.getByTestId('interpretation-network-structure-header')).toContainText(createdStructureName, { timeout: 30_000 })
        await page.getByTestId('interpretation-network-structure-header').getByRole('button', { name: 'Structures' }).click()
        await structurePane.getByRole('button', { name: `Structure actions: ${createdStructureName}` }).click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()
        const editStructureDialog = page.getByRole('dialog', { name: 'Edit structure' })
        await expect(editStructureDialog).toBeVisible({ timeout: 30_000 })
        await expect(editStructureDialog.getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(createdStructureName)
        await expect(editStructureDialog.getByRole('textbox', { name: 'Description', exact: true })).toHaveValue(
            createdStructureDescription
        )
        await editStructureDialog.getByRole('button', { name: 'Cancel' }).click()
        await structurePane.getByRole('button', { name: createdStructureName, exact: true }).click()
        await expect(page.getByTestId('interpretation-network-structure-header')).toContainText(createdStructureName, { timeout: 30_000 })
        const matrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
        const structureSections = matrixWorkspace.getByRole('tablist', { name: 'Workspace sections', exact: true })
        const structureMatrixTab = structureSections.getByRole('tab', { name: 'Matrix', exact: true })
        await expect(structureMatrixTab).toBeVisible()
        await expect(structureSections.getByRole('tab', { name: 'Favorites', exact: true })).toBeVisible()
        await expect(structureSections.getByRole('tab', { name: 'Templates', exact: true })).toBeVisible()
        await expect(structureSections.getByRole('tab')).toHaveCount(3)
        const structureMatrixPanelId = await structureMatrixTab.getAttribute('aria-controls')
        expect(structureMatrixPanelId).toBeTruthy()
        await expect(matrixWorkspace.locator(`[id="${structureMatrixPanelId}"]`)).toBeVisible()
        await expect(page).toHaveURL(
            new RegExp(
                `/a/${escapeRegExp(applicationId)}/${escapeRegExp(runtimeSections.structureSectionId)}/${escapeRegExp(
                    createdStructure.structureId ?? ''
                )}(?:[?#].*)?$`
            )
        )
        await expectMatrixTableDefaultRuntime(page, {
            locale: 'en',
            structureName: createdStructureName,
            assertAxisDialogs: true,
            assertDefaultCellDialog: true,
            rootOnly: true
        })
        await saveApplicationMatrixViewSettings(page, applicationId, {
            table: false,
            horizontalRows: true,
            verticalTree: false,
            defaultView: 'Horizontal rows'
        })
        await expectHorizontalRowsOnlyMatrixRuntime(
            page,
            applicationId,
            runtimeSections.structureSectionId,
            createdStructure.structureId ?? ''
        )
        await saveApplicationMatrixViewSettings(page, applicationId, {
            table: true,
            horizontalRows: true,
            verticalTree: true,
            defaultView: 'Table view'
        })
        await page.goto(
            `/a/${applicationId}/${runtimeSections.structureSectionId}/${
                createdStructure.structureId ?? ''
            }?targetKind=object&entityTypeCodename=Structure`
        )
        await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName, rootOnly: true })
        const matrixDisplayToggle = page
            .getByTestId('interpretation-network-matrix-toolbar')
            .getByRole('button', { name: 'Horizontal rows' })
        const matrixTableSurfaceBox = await page.getByTestId('interpretation-network-hierarchical-table').boundingBox()
        expect(matrixTableSurfaceBox?.width, 'Matrix Table surface must render inside its scroll container').toBeGreaterThan(0)

        const firstMenuLink = getDockedRuntimeNavigation(page).getByRole('link').first()
        const menuGap = await firstMenuLink.evaluate((link) => {
            const icon = link.querySelector('.MuiListItemIcon-root')?.getBoundingClientRect()
            const label = link.querySelector('.MuiListItemText-root')?.getBoundingClientRect()
            return icon && label ? label.left - icon.right : null
        })
        expect(menuGap, 'published SideMenu icon-label gap').not.toBeNull()
        expect(menuGap ?? 0).toBeGreaterThanOrEqual(7)
        expect(menuGap ?? 0).toBeLessThanOrEqual(9)
        await page.reload()
        await expect(page).toHaveURL(
            new RegExp(
                `/a/${escapeRegExp(applicationId)}/${escapeRegExp(runtimeSections.structureSectionId)}/${escapeRegExp(
                    createdStructure.structureId ?? ''
                )}(?:[?#].*)?$`
            )
        )
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-header')).toContainText(createdStructureName, { timeout: 30_000 })
        const reloadedMatrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
        const reloadedStructureSections = reloadedMatrixWorkspace.getByRole('tablist', { name: 'Workspace sections', exact: true })
        const reloadedStructureMatrixTab = reloadedStructureSections.getByRole('tab', { name: 'Matrix', exact: true })
        await expect(reloadedStructureMatrixTab).toBeVisible()
        await expect(reloadedStructureSections.getByRole('tab', { name: 'Favorites', exact: true })).toBeVisible()
        await expect(reloadedStructureSections.getByRole('tab', { name: 'Templates', exact: true })).toBeVisible()
        await expect(reloadedStructureSections.getByRole('tab')).toHaveCount(3)
        const reloadedStructureMatrixPanelId = await reloadedStructureMatrixTab.getAttribute('aria-controls')
        expect(reloadedStructureMatrixPanelId).toBeTruthy()
        await expect(reloadedMatrixWorkspace.locator(`[id="${reloadedStructureMatrixPanelId}"]`)).toBeVisible()
        await expectMatrixTableDefaultRuntime(page, { locale: 'en', structureName: createdStructureName, rootOnly: true })
        await matrixDisplayToggle.click()
        const cells = page.getByTestId('interpretation-network-cell')
        await expect(cells.first()).toBeVisible({ timeout: 30_000 })
        await expect(cells.first()).toContainText('Universe')
        await expect(cells.first()).not.toContainText('Empty cell')
        const matrixHorizontalToggle = page.getByRole('button', { name: 'Horizontal rows' })
        await expect(matrixHorizontalToggle).toHaveAttribute('aria-pressed', 'true')
        const matrixToggleBox = await matrixHorizontalToggle.boundingBox()
        expect(matrixToggleBox?.width, 'Matrix view toggle width').toBeCloseTo(40, 0)
        expect(matrixToggleBox?.height, 'Matrix view toggle height').toBeCloseTo(40, 0)
        await saveApplicationMatrixViewSettings(page, applicationId, {
            table: true,
            horizontalRows: true,
            verticalTree: true,
            defaultView: 'Table view',
            allowNewAxesInCellDialog: true
        })
        await page.goto(
            `/a/${applicationId}/${runtimeSections.structureSectionId}/${
                createdStructure.structureId ?? ''
            }?targetKind=object&entityTypeCodename=Structure`
        )
        await expectMatrixCellMoveNotSwapWithNewAxesCellDialog(page, applicationId)
        await expectHierarchicalTableHasNoFreeSlotDrop(
            page,
            applicationId,
            runtimeSections.structureSectionId,
            createdStructure.structureId ?? ''
        )
        await expectVerticalToolbarAndFiniteBreadcrumbs(
            page,
            applicationId,
            runtimeSections.structureSectionId,
            createdStructure.structureId ?? ''
        )
        await expectIndependentRowsTableDrop(page, applicationId, runtimeSections.structureSectionId, createdStructure.structureId ?? '')
        await page.getByRole('button', { name: 'Horizontal rows' }).click()
        await cells.first().click()
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
        const materialTableToggle = page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Table view' })
        await expect(matrixDisplayToggle).toHaveAttribute('aria-pressed', 'true')
        await expect(materialTableToggle).toHaveAttribute('aria-pressed', 'true')
        const [matrixToggleColors, materialToggleColors] = await Promise.all(
            [matrixDisplayToggle, materialTableToggle].map((toggle) =>
                toggle.evaluate((element) => {
                    const style = getComputedStyle(element)
                    return { color: style.color, backgroundColor: style.backgroundColor }
                })
            )
        )
        expectSameSelectedToggleTheme(
            matrixToggleColors,
            materialToggleColors,
            'Matrix display toggle must reuse the Material selected theme state'
        )
        await expect(
            page.getByTestId('interpretation-network-details-pane').getByRole('textbox', { name: 'Filter by title' })
        ).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Relations' })).toHaveCount(0)
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('tab', { name: 'Templates' })).toHaveCount(0)

        await page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' }).click()
        const materialDialog = page.getByRole('dialog', { name: 'Add material' })
        await expect(materialDialog).toBeVisible({ timeout: 30_000 })
        await expectNoTechnicalLeakage(materialDialog, {
            label: 'Add material dialog',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expect(materialDialog.getByRole('textbox', { name: /\b(?:id|uuid|identifier)\b/iu })).toHaveCount(0)
        await expectSemanticFieldControls(materialDialog, { longTextLabels: ['Description'] })
        await fillMaterialDialogFields(materialDialog, {
            title: createdMaterialTitle,
            description: createdMaterialDescription
        })
        const createMaterialRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesInterpretationNetworkMaterialCreate(response, applicationId, activeWorkspaceId),
            { label: 'Creating Interpretation Network material' }
        )
        await materialDialog.getByRole('button', { name: 'Create' }).click()
        expect((await createMaterialRequest).ok()).toBe(true)
        await expect(materialDialog).toHaveCount(0)
        const detailsPane = page.getByTestId('interpretation-network-details-pane')
        await expect(detailsPane.getByRole('button', { name: 'Back to materials' })).toBeVisible({ timeout: 30_000 })
        await detailsPane.getByRole('button', { name: 'Back to materials' }).click()
        await expect(detailsPane.getByTestId('interpretation-network-material-table')).toBeVisible({ timeout: 30_000 })
        await expect(detailsPane.locator('.MuiDataGrid-root')).toBeVisible()
        await expect(detailsPane.getByRole('columnheader', { name: 'Title' })).toBeVisible()
        await expect(detailsPane.getByRole('columnheader', { name: 'Description' })).toBeVisible()
        await expect(detailsPane.getByRole('columnheader', { name: 'Body' })).toHaveCount(0)
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await expect(detailsPane.getByText(createdMaterialDescription)).toBeVisible()
        await expectDataGridHorizontalScrollConstrained(page, 'Interpretation Network material table')
        await expectNoDataGridTechnicalLeakage(detailsPane, {
            label: 'Interpretation Network material table',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true,
            forbiddenVisibleTextPatterns: [/Body/i, /\[object Object\]/i, /"blocks"/i]
        })
        await detailsPane.getByRole('columnheader', { name: 'Title' }).click()
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await detailsPane.getByRole('textbox', { name: 'Filter by title' }).fill('source')
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await expect(detailsPane.getByText(/For cell/i)).toHaveCount(0)
        await detailsPane.getByRole('button', { name: 'Card view' }).click()
        await expect(detailsPane.getByTestId('interpretation-network-material-cards')).toBeVisible()
        await expect(getMaterialOpenButton(detailsPane, createdMaterialTitle)).toBeVisible()
        await expectNoTechnicalLeakage(detailsPane.getByTestId('interpretation-network-material-cards'), {
            label: 'Interpretation Network material cards',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true,
            forbiddenVisibleTextPatterns: [/Body/i, /\[object Object\]/i, /"blocks"/i]
        })
        await detailsPane.getByRole('button', { name: `Material actions: ${createdMaterialTitle}` }).click()
        await page.getByRole('menuitem', { name: 'Edit material' }).click()
        const editMaterialDialog = page.getByRole('dialog', { name: 'Edit material' })
        await expect(editMaterialDialog).toBeVisible({ timeout: 30_000 })
        await expect(editMaterialDialog.getByLabel('Body')).toHaveCount(0)
        await fillMaterialDialogFields(editMaterialDialog, {
            title: updatedMaterialTitle,
            description: updatedMaterialDescription
        })
        const editMaterialRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesInterpretationNetworkMaterialUpdate(response, applicationId, activeWorkspaceId),
            { label: 'Editing Interpretation Network material metadata' }
        )
        await editMaterialDialog.getByRole('button', { name: 'Save' }).click()
        const editMaterialResponse = await editMaterialRequest
        expect(editMaterialResponse.ok()).toBe(true)
        const editPayload = editMaterialResponse.request().postDataJSON() as { data?: unknown }
        expect(hasLocalizedPayloadValue(editPayload.data, updatedMaterialTitle)).toBe(true)
        expect(hasLocalizedPayloadValue(editPayload.data, updatedMaterialDescription)).toBe(true)
        await expect(editMaterialDialog).toHaveCount(0)
        await expect(detailsPane.getByTestId('interpretation-network-material-editor')).toBeVisible({ timeout: 30_000 })
        await expect(detailsPane.getByLabel('Title')).toHaveCount(0)
        await expect(detailsPane.getByLabel('Description')).toHaveCount(0)
        await expect(detailsPane.getByRole('tab', { name: 'English' })).toBeVisible()
        await detailsPane.getByRole('button', { name: 'Add language' }).click()
        await page.getByRole('menuitem', { name: 'Russian' }).click()
        await expect(detailsPane.getByRole('tab', { name: 'Russian' })).toBeVisible()
        await fillMaterialBlockEditor(page, detailsPane, materialBodyText)
        const saveMaterialBodyRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesInterpretationNetworkMaterialUpdate(response, applicationId, activeWorkspaceId),
            { label: 'Saving Interpretation Network material body' }
        )
        await detailsPane.getByRole('button', { name: 'Save' }).click()
        expect((await saveMaterialBodyRequest).ok()).toBe(true)
        await expectNoTechnicalLeakage(detailsPane, {
            label: 'Interpretation Network material authoring pane',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true,
            forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i]
        })
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network created structure runtime',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true,
            forbiddenVisibleTextPatterns: [/Cell ID/i]
        })
        await detailsPane.getByRole('button', { name: 'Back to materials' }).click()
        await expect(detailsPane.getByRole('button', { name: 'Create' })).toBeVisible({ timeout: 30_000 })
        await expect(getMaterialOpenButton(detailsPane, updatedMaterialTitle)).toBeVisible()
        await switchRuntimeLocale(page, 'ru')
        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await page.getByRole('button', { name: 'Действия ячейки: E2E first child cell' }).click()
        await page.getByRole('menuitem', { name: 'Редактировать' }).click()
        const ruCellDialog = page.getByRole('dialog', { name: 'Редактировать ячейку' })
        await expect(ruCellDialog).toBeVisible({ timeout: 30_000 })
        await expectSemanticFieldControls(ruCellDialog, { longTextLabels: ['Описание'] })
        await ruCellDialog.getByRole('textbox', { name: 'Название', exact: true }).fill('')
        await ruCellDialog.getByRole('button', { name: 'Сохранить' }).click()
        await expect(ruCellDialog.getByText('Заполните это поле.')).toBeVisible()
        await expectLocalizedValidation(ruCellDialog, 'ru', { label: 'RU Interpretation Network cell validation' })
        await page.keyboard.press('Escape')
        await expect(ruCellDialog).toHaveCount(0)
        await detailsPane.getByRole('button', { name: 'Создать' }).click()
        const ruMaterialDialog = page.getByRole('dialog').first()
        await expect(ruMaterialDialog).toBeVisible({ timeout: 30_000 })
        const ruMaterialTitleField = ruMaterialDialog.getByRole('textbox', { name: 'Название' })
        await ruMaterialTitleField.fill('А'.repeat(260))
        await expect(ruMaterialTitleField).toHaveValue('А'.repeat(255))
        await expect(ruMaterialDialog.getByText('Максимальная длина: 255')).toBeVisible()
        await expect(ruMaterialDialog.getByRole('button', { name: 'Создать' })).toBeEnabled()
        await expectLocalizedValidation(ruMaterialDialog, 'ru', { label: 'RU Interpretation Network material validation' })
        await page.keyboard.press('Escape')
        await expect(ruMaterialDialog).toHaveCount(0)
        await activateHierarchicalBreadcrumb(page, 'Universe')
        await page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', { name: 'Табличный вид' }).click()
        await expectMatrixTableDefaultRuntime(page, {
            locale: 'ru',
            structureName: createdStructureName,
            rootTitle: 'Universe',
            expectedChildLabels: [firstChildCellTitle]
        })
        const ruMatrixCellButton = getMatrixTable(page)
            .getByTestId('interpretation-network-table-cell')
            .filter({ hasText: firstChildCellTitle })
            .getByRole('button', { name: new RegExp(escapeRegExp(firstChildCellTitle)) })
            .first()
        await ruMatrixCellButton.focus()
        await expect(ruMatrixCellButton).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Создать' })).toBeVisible()
        await activateHierarchicalBreadcrumb(page, 'Universe')
        const ruMatrixCellActions = page.getByRole('button', { name: `Действия ячейки: ${firstChildCellTitle}` }).first()
        await ruMatrixCellActions.focus()
        await expect(ruMatrixCellActions).toBeFocused()
        await page.keyboard.press('Enter')
        await expect(page.getByRole('menuitem', { name: 'Редактировать' })).toBeVisible()
        await page.keyboard.press('Escape')
        await activateHierarchicalBreadcrumb(page, 'Universe')
        await switchRuntimeLocale(page, 'en')
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await expectMatrixTableDefaultRuntime(page, {
            locale: 'en',
            structureName: createdStructureName,
            expectedChildLabels: [firstChildCellTitle]
        })
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network created structure runtime', {
            beforeEachViewport: async () => {
                await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
                await expect(page.getByTestId('interpretation-network-structure-header')).toContainText(createdStructureName)
                await expectMatrixTableDefaultRuntime(page, {
                    locale: 'en',
                    structureName: createdStructureName,
                    expectedChildLabels: [firstChildCellTitle]
                })
                await expectMatrixTableHorizontalScrollConstrained(page, 'Interpretation Network created structure runtime viewport')
                await getMatrixTable(page)
                    .getByTestId('interpretation-network-table-cell')
                    .filter({ hasText: firstChildCellTitle })
                    .getByRole('button', { name: new RegExp(escapeRegExp(firstChildCellTitle)) })
                    .first()
                    .click()
                await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
                await activateHierarchicalBreadcrumb(page, 'Universe')
                const viewport = page.viewportSize()
                await attachRuntimeScreenshot(page, testInfo, `matrix-table-${viewport?.width ?? 0}x${viewport?.height ?? 0}`)
            }
        })

        await page.setViewportSize({ width: 1280, height: 900 })
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
        await expect(getMaterialOpenButton(page.getByTestId('interpretation-network-details-pane'), updatedMaterialTitle)).toBeVisible()
        await getMatrixTable(page).evaluate((node) => {
            ;(node as HTMLElement).scrollLeft = 0
        })
        await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
        const matrixScreenshot = await page.getByTestId('interpretation-network-matrix-workspace').screenshot({
            animations: 'disabled'
        })
        await testInfo.attach('interpretation-network-matrix-runtime-polish', {
            body: matrixScreenshot,
            contentType: 'image/png'
        })
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network Materials workspace tab',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network Material workspace tab')
        await expectMatrixTableHorizontalScrollConstrained(page, 'Interpretation Network Materials workspace tab')
        await expectNoDataGridTechnicalLeakage(page.getByTestId('interpretation-network-details-pane'), {
            label: 'Interpretation Network Materials workspace tab',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network Materials workspace tab', {
            beforeEachViewport: async () => {
                await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible({
                    timeout: 30_000
                })
                await page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Table view' }).click()
                await expect(page.getByTestId('interpretation-network-details-pane').locator('.MuiDataGrid-root')).toBeVisible()
            }
        })

        await expectNoTechnicalLeakage(page.locator('body'), {
            label: 'Interpretation Network complete runtime shell',
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })

        const switchTargetWorkspaceName = `Workspace switch target ${runManifest.runId}`
        const switchTargetWorkspace = (await createApplicationWorkspace(api, applicationId, {
            name: createLocalizedContent('en', switchTargetWorkspaceName),
            description: createLocalizedContent('en', 'Created to verify workspace switching from the runtime UI.')
        })) as { id?: string }
        if (typeof switchTargetWorkspace.id !== 'string') {
            throw new Error('The workspace switcher E2E flow could not create a target workspace')
        }
        const switchTargetStructureName = `Switch target ${runManifest.runId}`
        const switchTargetRuntimeIds = await resolveRuntimeIds(api, applicationId, switchTargetWorkspace.id)
        const switchTargetWidgetContext = new URLSearchParams({
            workspaceId: switchTargetWorkspace.id,
            layoutId: switchTargetRuntimeIds.layoutId,
            widgetId: switchTargetRuntimeIds.widgetId
        })
        const switchTargetStructureResponse = await sendWithCsrf(
            api,
            'POST',
            `/api/v1/applications/${applicationId}/runtime/interpretation-network/structures?${switchTargetWidgetContext}`,
            {
                name: createLocalizedContent('en', switchTargetStructureName),
                description: createLocalizedContent('en', 'This marker proves the selected workspace data finished loading.'),
                locale: 'en'
            }
        )
        expect(switchTargetStructureResponse.ok, 'The target workspace receives its own visible structure marker').toBe(true)
        const restoreDefaultWorkspaceResponse = await sendWithCsrf(
            api,
            'PATCH',
            `/api/v1/applications/${applicationId}/runtime/workspaces/${activeWorkspaceId}/default`,
            {}
        )
        expect(restoreDefaultWorkspaceResponse.ok, 'The workspace-switcher flow starts from the previously selected workspace').toBe(true)

        await page.setViewportSize({ width: 1280, height: 900 })
        await page.goto(`/a/${applicationId}?workspaceId=${encodeURIComponent(activeWorkspaceId)}`)
        const runtimeWorkspaceSwitcher = getVisibleWorkspaceSwitcher(page)
        await expect(runtimeWorkspaceSwitcher).toBeVisible({ timeout: 30_000 })
        const workspaceCombobox = runtimeWorkspaceSwitcher.getByRole('combobox', { name: 'Switch workspace' })
        await workspaceCombobox.click()
        const switchTargetOption = page.getByRole('option').filter({ hasText: switchTargetWorkspaceName })
        await expect(switchTargetOption).toBeVisible()
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-workspace-switcher-options')

        const switchWorkspaceResponsePromise = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                new URL(response.url()).pathname ===
                    `/api/v1/applications/${applicationId}/runtime/workspaces/${switchTargetWorkspace.id}/default`,
            { label: 'Selecting a workspace from the Interpretation Network runtime switcher' }
        )
        await switchTargetOption.click()
        const switchWorkspaceResponse = await switchWorkspaceResponsePromise
        expect(switchWorkspaceResponse.status(), 'The runtime workspace switcher persists the selected workspace').toBe(200)
        await expect.poll(() => new URL(page.url()).searchParams.get('workspaceId')).toBe(switchTargetWorkspace.id)
        await expect(runtimeWorkspaceSwitcher).toContainText(switchTargetWorkspaceName)
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network after switching workspaces')
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-workspace-switcher-selected')
        await getVisibleRuntimeNavigation(page).getByRole('link', { name: 'Structures', exact: true }).click()
        const targetWorkspaceStructure = page
            .getByTestId('interpretation-network-structure-pane')
            .getByRole('button', { name: switchTargetStructureName, exact: true })
        await expect(targetWorkspaceStructure, 'Workspace content must finish loading after the switch').toBeVisible({ timeout: 30_000 })
        await attachRuntimeScreenshot(page, testInfo, 'interpretation-network-workspace-switcher-loaded-target-content')

        const selectedWorkspaceSwitcher = page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')
        await expect(selectedWorkspaceSwitcher.locator('input')).toHaveValue(/^\d+$/)
        expect(await selectedWorkspaceSwitcher.ariaSnapshot()).not.toMatch(
            /[0-9a-f]{8}-[0-9a-f]{4}-[7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/iu
        )
        expectNoInterpretationNetworkBrowserRegressionIssues(browserIssues, 'Interpretation Network imported snapshot flow')
    })
})
