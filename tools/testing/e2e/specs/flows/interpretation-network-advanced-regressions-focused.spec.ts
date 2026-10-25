import { expect, test } from '../../fixtures/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { createLocalizedContent } from '@universo-react/utils'
import {
    addApplicationMember,
    createAdminUser,
    createApplicationWorkspace,
    createLoggedInApiContext,
    disposeApiContext,
    getAssignableRoles,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { createBootstrapApiContext, disposeBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { switchRuntimeLocale } from '../../support/browser/preferences'
import {
    expectDataGridHorizontalScrollConstrained,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage
} from '../../support/browser/runtimeUx'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    attachDialogViewportEvidence,
    attachViewportEvidence,
    ensureSystemStructure,
    expectSingleSystemMatrix,
    findMatrixRowByTitle,
    getMatrixRows,
    getMaterialRows,
    getTemplateDetail,
    getTemplateMatrixRows,
    listTemplates,
    openStructures,
    readLocalizedText,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig,
    type InterpretationNetworkApi
} from '../../support/interpretationNetworkFocused'

const tabUntilFocused = async (page: Page, target: Locator, label: string, maxTabPresses = 40): Promise<void> => {
    for (let index = 0; index <= maxTabPresses; index += 1) {
        if (await target.evaluate((element) => element === document.activeElement)) return
        if (index < maxTabPresses) await page.keyboard.press('Tab')
    }
    throw new Error(`Keyboard Tab navigation did not reach ${label} within ${maxTabPresses} steps`)
}

const getMatrixCell = (page: Page, title: string) =>
    page.getByTestId('interpretation-network-matrix-workspace').getByRole('button').filter({ hasText: title }).first()

const favoritesRowsFitTheirContent = async (favoritesPanel: Locator, expectStackedStatus: boolean): Promise<boolean> =>
    favoritesPanel.getByRole('row').evaluateAll((rows, shouldStackStatus) => {
        const dataRows = rows
            .map((row) => {
                const openButton = row.querySelector<HTMLButtonElement>('button[aria-label^="Открыть:"]')
                const status = row.querySelector<HTMLElement>('[aria-label^="Статус:"]')
                if (!openButton || !status) return null

                const rowRect = row.getBoundingClientRect()
                const openRect = openButton.getBoundingClientRect()
                const statusRect = status.getBoundingClientRect()
                const locationRange = document.createRange()
                locationRange.selectNodeContents(openButton)
                const locationRects = Array.from(locationRange.getClientRects()).map((rect) => ({ top: rect.top, bottom: rect.bottom }))
                if (locationRects.length === 0) return null

                return {
                    top: rowRect.top,
                    bottom: rowRect.bottom,
                    openTop: openRect.top,
                    openBottom: openRect.bottom,
                    locationRects,
                    statusTop: statusRect.top,
                    statusBottom: statusRect.bottom
                }
            })
            .filter((row): row is NonNullable<typeof row> => row !== null)

        if (dataRows.length === 0) return false

        return dataRows.every((row, index) => {
            const previousRow = dataRows[index - 1]
            return (
                (previousRow === undefined || row.top >= previousRow.bottom - 1) &&
                row.openTop >= row.top - 1 &&
                row.openBottom <= row.bottom + 1 &&
                row.locationRects.every(
                    (rect) =>
                        rect.top >= row.openTop - 1 &&
                        rect.bottom <= row.openBottom + 1 &&
                        rect.top >= row.top - 1 &&
                        rect.bottom <= row.bottom + 1
                ) &&
                (!shouldStackStatus || row.statusTop >= Math.max(...row.locationRects.map((rect) => rect.bottom)) - 1) &&
                (!shouldStackStatus || row.statusTop >= row.openBottom - 1) &&
                row.statusBottom <= row.bottom + 1
            )
        })
    }, expectStackedStatus)

const favoriteRowFitsWithinScroller = async (row: Locator): Promise<boolean> =>
    row.evaluate((element) => {
        const scroller = element.closest<HTMLElement>('.MuiDataGrid-virtualScroller')
        if (!scroller) return false

        const scrollerBounds = scroller.getBoundingClientRect()
        const rowBounds = element.getBoundingClientRect()
        const openButton = element.querySelector<HTMLButtonElement>('button[aria-label^="Открыть:"]')
        if (!openButton) return false
        const locationRange = document.createRange()
        locationRange.selectNodeContents(openButton)
        const locationRects = Array.from(locationRange.getClientRects())
        const contentBounds = [
            openButton.getBoundingClientRect(),
            element.querySelector<HTMLElement>('[aria-label^="Статус:"]')?.getBoundingClientRect()
        ].filter((bounds): bounds is DOMRect => bounds !== undefined)

        return (
            contentBounds.length === 2 &&
            locationRects.length > 0 &&
            rowBounds.top >= scrollerBounds.top - 1 &&
            rowBounds.bottom <= scrollerBounds.bottom + 1 &&
            contentBounds.every((bounds) => bounds.top >= scrollerBounds.top - 1 && bounds.bottom <= scrollerBounds.bottom + 1) &&
            locationRects.every(
                (rect) =>
                    rect.top >= openButton.getBoundingClientRect().top - 1 &&
                    rect.bottom <= openButton.getBoundingClientRect().bottom + 1 &&
                    rect.top >= rowBounds.top - 1 &&
                    rect.bottom <= rowBounds.bottom + 1
            )
        )
    })

const prepareSingleSystem = async (api: InterpretationNetworkApi, runId: string, scenario: string) => {
    const imported = await importInterpretationNetworkSnapshot(api, {
        snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
        label: `advanced-${scenario}-${runId}`
    })
    await recordCreatedMetahub({
        id: imported.metahub.id,
        name: `Interpretation Network ${scenario} regression`,
        codename: `interpretation-network-${scenario}-${runId}`
    })
    await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })
    const runtimeIds = await resolveRuntimeIds(api, imported.applicationId)
    const system = await ensureSystemStructure(api, imported.applicationId, runtimeIds.workspaceId)

    return { imported, runtimeIds, system }
}

const openMatrixInTreeView = async (page: Page, applicationId: string): Promise<void> => {
    await page.goto(`/a/${applicationId}?locale=en`)
    await expect(page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible({
        timeout: 30_000
    })
    await openStructures(page)
    await expectSingleSystemMatrix(page)

    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    const treeView = matrix.getByRole('button', { name: 'Vertical tree', exact: true })
    await expect(treeView).toBeVisible()
    if ((await treeView.getAttribute('aria-pressed')) !== 'true') {
        await treeView.click()
    }
    await expect(treeView).toHaveAttribute('aria-pressed', 'true')
    await expect(getMatrixCell(page, 'Universe')).toBeVisible({ timeout: 30_000 })
}

const createChildCell = async (page: Page, applicationId: string, parentTitle: string, title: string): Promise<void> => {
    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    const parentCell = getMatrixCell(page, parentTitle)
    await expect(parentCell).toBeVisible({ timeout: 30_000 })
    await parentCell.click()

    await matrix.getByRole('button', { name: 'Add', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add cell' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(`Created for the ${title} regression path.`)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells`,
        { label: `Creating Interpretation Network cell ${title}`, timeout: 30_000 }
    )
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    expect((await createResponse).status()).toBe(201)
    await expect(dialog).toHaveCount(0)
    await expect(getMatrixCell(page, title)).toBeVisible({ timeout: 30_000 })
}

const createMaterialFromDetails = async (page: Page, applicationId: string, title: string, description: string): Promise<void> => {
    const details = page.getByTestId('interpretation-network-details-pane')
    await details.getByRole('button', { name: 'Create', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Add material' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(description)

    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/materials`,
        { label: `Creating Interpretation Network material ${title}`, timeout: 30_000 }
    )
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    expect((await createResponse).ok()).toBe(true)
    await expect(dialog).toHaveCount(0)
    await expect(details.getByRole('button', { name: 'Back to materials', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(details).toContainText(title)
    await details.getByRole('button', { name: 'Back to materials', exact: true }).click()
    await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible({ timeout: 30_000 })
}

const expectNoVisibleRuntimeIdentifiers = async (page: Page, label: string): Promise<void> => {
    const main = page.getByRole('main')
    const idLabelPattern =
        /\b(?:(?:owner|user|assigned[\s_-]*user|created[\s_-]*by|updated[\s_-]*by|workspace|application|metahub|record|row|cell|entity|relation)[\s_-]*)?id\b/iu
    await expectNoTechnicalLeakage(main, {
        label,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/\[object Object\]/i, idLabelPattern]
    })
    await expect(
        main.getByRole('columnheader').filter({ hasText: idLabelPattern }),
        `${label} must not expose raw identifier columns or numeric ID cells`
    ).toHaveCount(0)
}

const waitForApiLogin = async (credentials: { email: string; password: string }): Promise<void> => {
    await expect
        .poll(
            async () => {
                try {
                    const userApi = await createLoggedInApiContext(credentials)
                    await disposeApiContext(userApi)
                    return true
                } catch {
                    return false
                }
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBe(true)
}

test.describe('Interpretation Network advanced workspace regressions @flow @interpretation-network-focused', () => {
    test('saves only the selected branch as a template', async ({ page, runManifest }, testInfo: TestInfo) => {
        test.setTimeout(180_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const { imported, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'branch-template')
            await openMatrixInTreeView(page, imported.applicationId)

            await createChildCell(page, imported.applicationId, 'Universe', 'Selected branch E2E')
            await createChildCell(page, imported.applicationId, 'Selected branch E2E', 'Included descendant E2E')
            await createChildCell(page, imported.applicationId, 'Universe', 'Outside branch E2E')

            await getMatrixCell(page, 'Selected branch E2E').click()
            const matrix = page.getByTestId('interpretation-network-matrix-workspace')
            await matrix.getByRole('button', { name: 'Save as template', exact: true }).click()

            const dialog = page.getByRole('dialog', { name: 'Save structure as template' })
            await expect(dialog).toBeVisible()
            await expect(dialog.getByRole('radio', { name: 'Whole structure', exact: true })).toBeChecked()
            await expect(dialog.getByRole('radio', { name: 'Selected branch', exact: true })).not.toBeChecked()
            await dialog.getByRole('radio', { name: 'Selected branch', exact: true }).check()
            await expect(dialog.getByRole('radio', { name: 'Selected branch', exact: true })).toBeChecked()
            await expect(dialog).toContainText('Selected path: Universe › Selected branch E2E')
            await attachDialogViewportEvidence(
                page,
                testInfo,
                dialog,
                'interpretation-network-selected-branch-template-dialog-tablet',
                { width: 768, height: 1024 },
                ['Cancel', 'Save']
            )
            await attachDialogViewportEvidence(
                page,
                testInfo,
                dialog,
                'interpretation-network-selected-branch-template-dialog-mobile',
                { width: 390, height: 844 },
                ['Cancel', 'Save']
            )
            await page.setViewportSize({ width: 1280, height: 900 })
            await expect(dialog).toBeVisible()

            await dialog.getByRole('textbox', { name: 'Template name' }).first().fill('Selected branch regression template')
            await dialog
                .getByRole('textbox', { name: 'Description' })
                .first()
                .fill('Only the selected branch and its descendant belong here.')
            await dialog.getByRole('button', { name: 'Save', exact: true }).click()
            await expect(dialog).toHaveCount(0)

            const template = (await listTemplates(api, imported.applicationId, runtimeIds.workspaceId)).find(
                (item) => readLocalizedText(item.name) === 'Selected branch regression template'
            )
            expect(template).toBeDefined()
            const [sourceRows, templateDetail, templateRows] = await Promise.all([
                getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId),
                getTemplateDetail(api, imported.applicationId, runtimeIds.workspaceId, template!.id),
                getTemplateMatrixRows(api, imported.applicationId, runtimeIds, template!.id)
            ])
            expect(sourceRows).toHaveLength(4)
            expect(templateDetail.matrix).toMatchObject({ cellCount: 2, rootCount: 1, maxDepth: 2 })
            expect(templateRows).toHaveLength(2)

            const savedBranchRoot = findMatrixRowByTitle(templateRows, 'Selected branch E2E')
            const savedDescendant = findMatrixRowByTitle(templateRows, 'Included descendant E2E')
            expect(savedBranchRoot.parentCellId).toBeNull()
            expect(savedDescendant.parentCellId).toBe(savedBranchRoot.cellId)
            expect(templateRows.some((row) => readLocalizedText(row.CellValue) === 'Universe')).toBe(false)
            expect(templateRows.some((row) => readLocalizedText(row.CellValue) === 'Outside branch E2E')).toBe(false)

            const structurePane = page.getByTestId('interpretation-network-structure-pane')
            await structurePane.getByRole('tab', { name: 'Templates', exact: true }).click()
            await expect(structurePane.getByTestId('interpretation-network-template-table')).toContainText(
                'Selected branch regression template'
            )
            await expectNoVisibleRuntimeIdentifiers(page, 'selected-branch template flow')
            await expectNoPageHorizontalOverflow(page, 'selected-branch template flow')
        } finally {
            await disposeApiContext(api)
        }
    })

    test('opens the selected cell primary material first and returns to its full list', async ({ page, runManifest }, testInfo) => {
        test.setTimeout(180_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const { imported, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'primary-material')
            await openMatrixInTreeView(page, imported.applicationId)
            await getMatrixCell(page, 'Universe').click()

            await createMaterialFromDetails(
                page,
                imported.applicationId,
                'Featured material E2E',
                'This material should open directly when its cell is selected.'
            )
            await createMaterialFromDetails(
                page,
                imported.applicationId,
                'Secondary material E2E',
                'This material remains available from the full list.'
            )

            const details = page.getByTestId('interpretation-network-details-pane')
            await details.getByRole('button', { name: 'Material actions: Featured material E2E', exact: true }).click()
            await page.getByRole('menuitem', { name: 'Set as Primary Material', exact: true }).click()
            await expect(details.getByText('Primary Material', { exact: true })).toBeVisible({ timeout: 30_000 })

            const savedPrimary = await getMaterialRows(api, imported.applicationId, runtimeIds).then((materials) =>
                materials.find((material) => material.title === 'Featured material E2E')
            )
            expect(savedPrimary).toBeDefined()
            await expect
                .poll(async () => {
                    const rows = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
                    return findMatrixRowByTitle(rows, 'Universe').materialRef
                })
                .toBe(savedPrimary!.rowId)

            await createChildCell(page, imported.applicationId, 'Universe', 'Other cell E2E')
            await getMatrixCell(page, 'Other cell E2E').click()
            await getMatrixCell(page, 'Universe').click()

            await expect(details.getByRole('button', { name: 'Back to materials', exact: true })).toBeVisible()
            await expect(details.getByText('Featured material E2E', { exact: true })).toBeVisible()
            await expect(details.getByText('Primary Material', { exact: true })).toBeVisible()
            await expect(details.getByTestId('interpretation-network-material-table')).toHaveCount(0)
            await expect(details.getByText('Secondary material E2E', { exact: true })).toHaveCount(0)
            await expectNoVisibleRuntimeIdentifiers(page, 'primary material detail-first view')
            await attachViewportEvidence(page, testInfo, 'interpretation-network-primary-material-detail', { width: 1280, height: 900 })

            await page.reload()
            await openMatrixInTreeView(page, imported.applicationId)
            await getMatrixCell(page, 'Universe').click()
            await expect(details.getByText('Featured material E2E', { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(details.getByText('Primary Material', { exact: true })).toBeVisible()
            await expect(details.getByTestId('interpretation-network-material-table')).toHaveCount(0)

            await details.getByRole('button', { name: 'Back to materials', exact: true }).click()
            await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible()
            await expect(details.getByRole('button', { name: 'Featured material E2E', exact: true })).toBeVisible()
            await expect(details.getByRole('button', { name: 'Secondary material E2E', exact: true })).toBeVisible()
            await expect(details).toContainText('Primary Material')
            await expectNoVisibleRuntimeIdentifiers(page, 'primary material list view')
            await expectNoPageHorizontalOverflow(page, 'primary material list view')
        } finally {
            await disposeApiContext(api)
        }
    })

    test('isolates Favorites by user and workspace and keeps the populated grid responsive', async ({
        browser,
        page,
        runManifest
    }, testInfo: TestInfo) => {
        test.setTimeout(300_000)
        const api = await createLoggedInApiContext(runManifest.testUser)
        const bootstrapApi = await createBootstrapApiContext()
        let ownerSharedWorkspaceSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null
        let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

        try {
            const { imported, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'favorites')
            await openMatrixInTreeView(page, imported.applicationId)
            await createChildCell(page, imported.applicationId, 'Universe', 'Favorite target E2E')
            const longFavoriteTitles = Array.from(
                { length: 12 },
                (_, index) => `Scrollable favorite ${String(index + 1).padStart(2, '0')} ${'long-path-'.repeat(7)}`
            )
            for (const title of longFavoriteTitles) {
                await createChildCell(page, imported.applicationId, 'Universe', title)
            }
            const stressRows = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
            for (const title of longFavoriteTitles) {
                const cell = findMatrixRowByTitle(stressRows, title)
                const favoriteResponse = await sendWithCsrf(
                    api,
                    'POST',
                    `/api/v1/applications/${
                        imported.applicationId
                    }/runtime/interpretation-network/favorites?workspaceId=${encodeURIComponent(runtimeIds.workspaceId)}`,
                    { interpretationId: system.interpretationId, cellId: cell.cellId }
                )
                expect(favoriteResponse.status, `Favorite fixture ${title} is created through the runtime API`).toBe(201)
            }
            await switchRuntimeLocale(page, 'ru')
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })

            const favoriteCell = getMatrixCell(page, 'Favorite target E2E')
            await expect(favoriteCell).toBeVisible()
            const favoriteCellActions = page.getByRole('button', { name: 'Действия ячейки: Favorite target E2E', exact: true })
            await expect(favoriteCellActions).toBeEnabled()
            await favoriteCell.click()
            await expect(favoriteCell).toBeFocused()
            await page.keyboard.press('Tab')
            await expect(favoriteCellActions).toBeFocused()
            await page.keyboard.press('Enter')
            const addFavorite = page.getByRole('menuitem', { name: 'Добавить в избранное', exact: true })
            await expect(addFavorite).toBeVisible()
            await page.keyboard.press('ArrowDown')
            await page.keyboard.press('ArrowDown')
            await page.keyboard.press('ArrowDown')
            await expect(addFavorite).toBeFocused()
            await page.keyboard.press('Enter')
            await expect(page.getByRole('alert').filter({ hasText: 'Добавлено в избранное.' })).toBeVisible({ timeout: 30_000 })
            await page.reload()
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')

            const matrix = page.getByTestId('interpretation-network-matrix-workspace')
            await expect(matrix).toBeVisible({ timeout: 30_000 })
            await page.setViewportSize({ width: 390, height: 844 })
            const favoritesTabList = matrix.getByRole('tablist', { name: 'Разделы рабочего пространства', exact: true })
            const matrixTab = favoritesTabList.getByRole('tab', { name: 'Матрица', exact: true })
            const favoritesTab = favoritesTabList.getByRole('tab', { name: 'Избранное', exact: true })
            await matrixTab.click()
            await expect(matrixTab).toBeFocused()
            await page.keyboard.press('ArrowRight')
            await expect(favoritesTab).toBeFocused()
            await page.keyboard.press('Enter')
            const favoritesPanel = matrix.getByRole('tabpanel', { name: 'Избранное', exact: true })
            await expect(favoritesPanel).toBeVisible()
            const favoriteGridScroller = favoritesPanel.locator('.MuiDataGrid-virtualScroller')
            const targetFavoriteRow = favoritesPanel.getByRole('row').filter({ hasText: 'Favorite target E2E' })
            await expect(targetFavoriteRow, 'The persisted target appears in exactly one Favorites row').toHaveCount(1)
            const openFavorite = targetFavoriteRow.getByRole('button', { name: /Открыть:/ })
            await expect(openFavorite).toBeVisible({ timeout: 30_000 })
            await expect(openFavorite).toHaveText('Universe › Favorite target E2E')
            await expect(favoritesPanel).toContainText('Доступна')
            await expectNoVisibleRuntimeIdentifiers(page, 'Russian Favorites list')
            const actionsHeader = favoritesPanel.getByRole('columnheader', { name: 'Действия', exact: true })
            const removeFavorite = favoritesPanel.getByRole('button', { name: /Убрать .* из избранного/ }).first()
            const favoriteViewports = [
                { name: 'mobile', width: 390, height: 844 },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'desktop', width: 1280, height: 900 },
                { name: 'wide-desktop', width: 1920, height: 1080 }
            ] as const
            for (const viewport of favoriteViewports) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await expect(openFavorite).toBeVisible()
                await expect(openFavorite).toBeInViewport()
                await expect
                    .poll(() => favoriteRowFitsWithinScroller(targetFavoriteRow), {
                        message: `The selected Favorites row and its content are fully visible inside the grid at ${viewport.name}`
                    })
                    .toBe(true)
                await expect
                    .poll(() => favoritesRowsFitTheirContent(favoritesPanel, viewport.name === 'mobile'), {
                        message: `Favorites rows and their wrapped content do not overlap at ${viewport.name}`
                    })
                    .toBe(true)
                const expectedLocationText =
                    viewport.name === 'mobile' || viewport.name === 'wide-desktop'
                        ? 'Universe › Favorite target E2E'
                        : 'Системная структура · Universe › Favorite target E2E'
                await expect(openFavorite).toHaveText(expectedLocationText)
                if (viewport.name === 'wide-desktop') {
                    await expect(favoritesPanel.getByRole('columnheader', { name: 'Структура', exact: true })).toBeVisible()
                    await expect(targetFavoriteRow.getByRole('button', { name: /Открыть:.*Favorite target E2E/ })).toHaveText(
                        expectedLocationText
                    )
                    await expect(targetFavoriteRow.getByRole('gridcell').filter({ hasText: 'Системная структура' })).toHaveCount(1)
                }
                if (viewport.name === 'mobile') {
                    await expect
                        .poll(() =>
                            openFavorite.evaluate((button) => {
                                const cell = button.closest('[role="gridcell"]')
                                if (!cell) return false
                                const buttonBounds = button.getBoundingClientRect()
                                const cellBounds = cell.getBoundingClientRect()
                                return (
                                    cell.scrollHeight <= cell.clientHeight + 1 &&
                                    buttonBounds.top >= cellBounds.top - 1 &&
                                    buttonBounds.bottom <= cellBounds.bottom + 1
                                )
                            })
                        )
                        .toBe(true)
                }
                await expect(actionsHeader).toBeVisible()
                await expect(actionsHeader).toBeInViewport()
                await expect(removeFavorite).toBeVisible()
                await expect(removeFavorite).toBeInViewport()
                const favoriteStatus = targetFavoriteRow.getByText('Доступна', { exact: true })
                await expect(favoriteStatus).toBeVisible()
                await expect(favoriteStatus).toBeInViewport()
                await expectNoPageHorizontalOverflow(page, `Populated Favorites at ${viewport.width}px`)
                await expectDataGridHorizontalScrollConstrained(page, `Populated Favorites at ${viewport.width}px`)
                await attachViewportEvidence(page, testInfo, `interpretation-network-favorites-list-${viewport.name}`, viewport)
            }

            const favoriteListResponse = await sendWithCsrf(
                api,
                'GET',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/favorites?workspaceId=${encodeURIComponent(
                    runtimeIds.workspaceId
                )}&locale=ru&limit=200`
            )
            expect(favoriteListResponse.status).toBe(200)
            const favoriteList = (await favoriteListResponse.json()) as {
                items: Array<{
                    favoriteId: string
                    target: { cellId: string } | null
                    cellPath: Array<{ cellValue: string | null }>
                }>
            }
            expect(favoriteList.items).toHaveLength(longFavoriteTitles.length + 1)
            const finalFavorite = favoriteList.items.at(-1)
            expect(finalFavorite?.target?.cellId).toBeDefined()
            const finalFavoriteTitle = finalFavorite?.cellPath.at(-1)?.cellValue
            if (typeof finalFavoriteTitle !== 'string') {
                throw new Error('The last persisted Favorite does not include a visible Matrix cell path')
            }

            const lastFavoriteRow = favoritesPanel.getByRole('row').filter({ hasText: finalFavoriteTitle })
            const lastFavoriteOpen = lastFavoriteRow.getByRole('button', { name: /^Открыть:/u })
            const isFavoriteButtonFullyVisible = async (button: Locator) => {
                return button.evaluateAll((elements) => {
                    const element = elements[0]
                    if (!element) return false
                    const buttonRect = element.getBoundingClientRect()
                    const scrollerRect = element.closest('.MuiDataGrid-virtualScroller')?.getBoundingClientRect()
                    if (!scrollerRect) return false

                    const visibleTop = Math.max(scrollerRect.top, 0)
                    const visibleBottom = Math.min(scrollerRect.bottom, window.innerHeight)
                    const visibleLeft = Math.max(scrollerRect.left, 0)
                    const visibleRight = Math.min(scrollerRect.right, window.innerWidth)
                    return (
                        buttonRect.top >= visibleTop &&
                        buttonRect.bottom <= visibleBottom &&
                        buttonRect.left >= visibleLeft &&
                        buttonRect.right <= visibleRight
                    )
                })
            }
            const scrollFavoriteIntoViewport = async (button: Locator, deltaY: number) => {
                await favoriteGridScroller.hover()
                for (let attempt = 0; attempt < 24; attempt += 1) {
                    if (await isFavoriteButtonFullyVisible(button)) return

                    const previousMetrics = await favoriteGridScroller.evaluate((element) => {
                        const scroller = element as HTMLElement
                        return { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight }
                    })
                    await page.mouse.wheel(0, deltaY)
                    await expect
                        .poll(
                            async () => {
                                if (await isFavoriteButtonFullyVisible(button)) return true
                                const nextMetrics = await favoriteGridScroller.evaluate((element) => {
                                    const scroller = element as HTMLElement
                                    return { scrollTop: scroller.scrollTop, scrollHeight: scroller.scrollHeight }
                                })
                                return (
                                    nextMetrics.scrollTop !== previousMetrics.scrollTop ||
                                    nextMetrics.scrollHeight !== previousMetrics.scrollHeight
                                )
                            },
                            { timeout: 1500, message: 'A real wheel gesture advances or measures the Favorites grid' }
                        )
                        .toBe(true)
                }

                await expect(button).toBeInViewport()
            }
            for (const viewport of favoriteViewports) {
                await page.setViewportSize({ width: viewport.width, height: viewport.height })
                await scrollFavoriteIntoViewport(openFavorite, -400)
                await expect(openFavorite).toBeInViewport()
                await expect
                    .poll(() =>
                        favoriteGridScroller.evaluate((element) => {
                            const scroller = element as HTMLElement
                            return scroller.scrollHeight - scroller.clientHeight
                        })
                    )
                    .toBeGreaterThan(1)
                await scrollFavoriteIntoViewport(lastFavoriteOpen, 400)
                await expect(lastFavoriteOpen).toBeVisible()
                await expect(lastFavoriteOpen).toBeInViewport()
                await expect.poll(() => favoriteRowFitsWithinScroller(lastFavoriteRow)).toBe(true)
                await expect(lastFavoriteRow, 'The last row remains reachable by scrolling inside the Favorites grid').toBeVisible()
                await expect
                    .poll(() => favoritesRowsFitTheirContent(favoritesPanel, viewport.name === 'mobile'), {
                        message: `Scrolled Favorites rows and wrapped content do not overlap at ${viewport.name}`
                    })
                    .toBe(true)
                await expectNoVisibleRuntimeIdentifiers(page, `Scrolled Russian Favorites at ${viewport.width}px`)
                await expectNoPageHorizontalOverflow(page, `Scrolled Russian Favorites at ${viewport.width}px`)
                if (viewport.name === 'mobile') {
                    await expect
                        .poll(() =>
                            favoriteGridScroller.evaluate((element) => {
                                const scroller = element as HTMLElement
                                return (
                                    scroller.scrollHeight > scroller.clientHeight &&
                                    scroller.scrollTop >= scroller.scrollHeight - scroller.clientHeight - 1
                                )
                            })
                        )
                        .toBe(true)
                    await attachViewportEvidence(page, testInfo, 'interpretation-network-favorites-list-scroll-bottom-mobile', viewport, {
                        fullPage: false
                    })
                }
            }

            await page.setViewportSize({ width: 390, height: 844 })
            await scrollFavoriteIntoViewport(openFavorite, -400)
            await scrollFavoriteIntoViewport(lastFavoriteOpen, 400)
            await lastFavoriteOpen.click()
            await expect(matrixTab).toHaveAttribute('aria-selected', 'true')
            await expect(getMatrixCell(page, finalFavoriteTitle)).toHaveAttribute('aria-pressed', 'true')
            await favoritesTab.click()
            await scrollFavoriteIntoViewport(openFavorite, -400)
            await expect(openFavorite).toBeInViewport()

            const stressCellIds = new Set(longFavoriteTitles.map((title) => findMatrixRowByTitle(stressRows, title).cellId))
            expect(stressCellIds.size, 'Every long-path Matrix row resolves to a distinct server-owned CellId').toBe(
                longFavoriteTitles.length
            )
            const stressFavorites = favoriteList.items.filter((favorite) => favorite.target && stressCellIds.has(favorite.target.cellId))
            expect(stressFavorites, 'Every long-path stress cell has one persisted Favorite').toHaveLength(longFavoriteTitles.length)
            for (const item of stressFavorites) {
                const removeResponse = await sendWithCsrf(
                    api,
                    'DELETE',
                    `/api/v1/applications/${
                        imported.applicationId
                    }/runtime/interpretation-network/favorites?workspaceId=${encodeURIComponent(runtimeIds.workspaceId)}`,
                    { favoriteId: item.favoriteId }
                )
                expect(removeResponse.status).toBe(200)
                expect(await removeResponse.json()).toMatchObject({ favoriteId: item.favoriteId, removed: true, status: 'removed' })
            }
            const remainingFavoritesResponse = await sendWithCsrf(
                api,
                'GET',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/favorites?workspaceId=${encodeURIComponent(
                    runtimeIds.workspaceId
                )}&locale=ru&limit=200`
            )
            expect(remainingFavoritesResponse.status).toBe(200)
            const remainingFavorites = (await remainingFavoritesResponse.json()) as typeof favoriteList
            expect(remainingFavorites.items).toHaveLength(1)
            expect(remainingFavorites.items[0]?.target?.cellId).toBe(findMatrixRowByTitle(stressRows, 'Favorite target E2E').cellId)

            await page.reload()
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            const persistedFavoritesTab = page
                .getByTestId('interpretation-network-matrix-workspace')
                .getByRole('tab', { name: 'Избранное', exact: true })
            await persistedFavoritesTab.click()
            await expect(
                page
                    .getByRole('tabpanel', { name: 'Избранное', exact: true })
                    .getByRole('button', { name: /Открыть:.*Favorite target E2E/u })
            ).toBeVisible({ timeout: 30_000 })

            await openFavorite.click()
            await expect(matrixTab).toHaveAttribute('aria-selected', 'true')
            await expect(favoritesTab).toHaveAttribute('aria-selected', 'false')
            const navigatedFavoriteCell = getMatrixCell(page, 'Favorite target E2E')
            await expect(navigatedFavoriteCell).toHaveAttribute('aria-pressed', 'true')

            await favoritesTab.click()
            await expect(openFavorite).toBeVisible()

            const assignableRoles = (await getAssignableRoles(bootstrapApi)) as Array<{ id?: string; codename?: string }>
            const userRole = assignableRoles.find((role) => role.codename?.toLowerCase() === 'user')
            expect(userRole?.id, 'assignable User role id').toEqual(expect.any(String))
            const memberEmail = `e2e+${runManifest.runId}.interpretation-favorites@${
                process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'
            }`
            const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
            const createdMember = await createAdminUser(bootstrapApi, {
                email: memberEmail,
                password: memberPassword,
                roleIds: [userRole!.id!],
                comment: 'Interpretation Network Favorites isolation acceptance'
            })
            expect(createdMember?.userId).toEqual(expect.any(String))
            await recordCreatedGlobalUser({ userId: createdMember.userId, email: memberEmail })
            await waitForApiLogin({ email: memberEmail, password: memberPassword })
            await addApplicationMember(api, imported.applicationId, { email: memberEmail, role: 'member' })

            const sharedWorkspaceName = `Favorites isolation ${runManifest.runId}`
            const sharedWorkspace = (await createApplicationWorkspace(api, imported.applicationId, {
                name: createLocalizedContent('en', sharedWorkspaceName)
            })) as { id?: string }
            expect(sharedWorkspace.id).toMatch(/^[0-9a-f-]{36}$/iu)
            expect(sharedWorkspace.id).not.toBe(runtimeIds.workspaceId)
            const inviteResponse = await sendWithCsrf(
                api,
                'POST',
                `/api/v1/applications/${imported.applicationId}/runtime/workspaces/${sharedWorkspace.id}/members`,
                { email: memberEmail, roleCodename: 'member' }
            )
            expect(inviteResponse.status).toBe(201)
            await ensureSystemStructure(api, imported.applicationId, sharedWorkspace.id!)

            ownerSharedWorkspaceSession = await createLoggedInBrowserContext(browser, runManifest.testUser)
            const sharedWorkspacePage = ownerSharedWorkspaceSession.page
            await sharedWorkspacePage.goto(`/a/${imported.applicationId}?locale=en&workspaceId=${encodeURIComponent(sharedWorkspace.id!)}`)
            await expect(sharedWorkspacePage.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible(
                {
                    timeout: 30_000
                }
            )
            await expect.poll(() => new URL(sharedWorkspacePage.url()).pathname).toBe(`/a/${imported.applicationId}`)
            await expect.poll(() => new URL(sharedWorkspacePage.url()).searchParams.get('workspaceId')).toBe(sharedWorkspace.id!)
            await openStructures(sharedWorkspacePage)
            await expectSingleSystemMatrix(sharedWorkspacePage)
            await expect(
                sharedWorkspacePage.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')
            ).toContainText(sharedWorkspaceName)
            await createChildCell(sharedWorkspacePage, imported.applicationId, 'Universe', 'Shared workspace favorite E2E')
            await switchRuntimeLocale(sharedWorkspacePage, 'ru')
            const sharedFavoriteCell = getMatrixCell(sharedWorkspacePage, 'Shared workspace favorite E2E')
            await sharedFavoriteCell.click()
            await sharedWorkspacePage.getByRole('button', { name: 'Действия ячейки: Shared workspace favorite E2E', exact: true }).click()
            await sharedWorkspacePage.getByRole('menuitem', { name: 'Добавить в избранное', exact: true }).click()
            await expect(sharedWorkspacePage.getByRole('alert').filter({ hasText: 'Добавлено в избранное.' })).toBeVisible({
                timeout: 30_000
            })
            const ownerSharedFavorites = sharedWorkspacePage
                .getByTestId('interpretation-network-matrix-workspace')
                .getByRole('tablist', { name: 'Разделы рабочего пространства', exact: true })
            await ownerSharedFavorites.getByRole('tab', { name: 'Избранное', exact: true }).click()
            const ownerSharedPanel = sharedWorkspacePage
                .getByTestId('interpretation-network-matrix-workspace')
                .getByRole('tabpanel', { name: 'Избранное' })
            await expect(ownerSharedPanel.getByRole('button', { name: /Открыть:.*Shared workspace favorite E2E/ })).toBeVisible()
            await expect(ownerSharedPanel.getByRole('button', { name: /Открыть:.*Favorite target E2E/ })).toHaveCount(0)

            memberSession = await createLoggedInBrowserContext(browser, { email: memberEmail, password: memberPassword })
            await memberSession.page.goto(`/a/${imported.applicationId}?locale=en&workspaceId=${encodeURIComponent(sharedWorkspace.id!)}`)
            await expect(memberSession.page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')).toBeVisible({
                timeout: 30_000
            })
            await expect.poll(() => new URL(memberSession!.page.url()).pathname).toBe(`/a/${imported.applicationId}`)
            await expect.poll(() => new URL(memberSession!.page.url()).searchParams.get('workspaceId')).toBe(sharedWorkspace.id!)
            await expect(
                memberSession.page.getByTestId('runtime-side-menu-docked').getByTestId('runtime-workspace-switcher')
            ).toContainText(sharedWorkspaceName)
            await openStructures(memberSession.page)
            await expectSingleSystemMatrix(memberSession.page)
            await switchRuntimeLocale(memberSession.page, 'ru')
            const memberMatrix = memberSession.page.getByTestId('interpretation-network-matrix-workspace')
            const memberFavorites = memberMatrix.getByRole('tablist', { name: 'Разделы рабочего пространства', exact: true })
            await memberFavorites.getByRole('tab', { name: 'Избранное', exact: true }).click()
            const memberFavoritesPanel = memberMatrix.getByRole('tabpanel', { name: 'Избранное', exact: true })
            await expect(memberFavoritesPanel.getByText('Пока нет избранных ячеек.', { exact: false })).toBeVisible()
            await expect(memberFavoritesPanel.getByRole('button', { name: /Открыть:.*Shared workspace favorite E2E/ })).toHaveCount(0)
            await expectNoTechnicalLeakage(memberSession.page.getByRole('main'), {
                label: 'Member Favorites in a shared workspace',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })

            await expect(openFavorite).toBeVisible()
            await expect(favoritesPanel.getByRole('button', { name: /Открыть:.*Shared workspace favorite E2E/ })).toHaveCount(0)
            await page.setViewportSize({ width: 390, height: 844 })
            await expect(favoritesTab).toBeFocused()
            await tabUntilFocused(page, favoritesPanel, 'Russian Favorites panel')
            await expect(favoritesPanel).toBeFocused()
            const locationHeader = favoritesPanel.getByRole('columnheader', { name: 'Путь к ячейке', exact: true })
            await tabUntilFocused(page, locationHeader, 'Russian Favorites Location column header')
            await expect(locationHeader).toBeFocused()
            await page.keyboard.press('ArrowDown')
            await expect(openFavorite).toBeFocused()
            await page.keyboard.press('ArrowRight')
            await expect(removeFavorite).toBeFocused()
            const removeFavoriteResponsePromise = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'DELETE' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/favorites`,
                { label: 'Removing the owner Favorites entry through the runtime UI' }
            )
            await page.keyboard.press('Enter')
            const removeFavoriteResponse = await removeFavoriteResponsePromise
            expect(removeFavoriteResponse.status()).toBe(200)
            await expect(page.getByRole('alert').filter({ hasText: 'Удалено из избранного.' })).toBeVisible({ timeout: 30_000 })
            await expect(favoritesPanel.getByText('Пока нет избранных ячеек.', { exact: false })).toBeVisible()
            await expect(favoritesPanel.getByRole('button', { name: /Открыть:.*Favorite target E2E/ })).toHaveCount(0)
            const persistedFavoritesResponse = await sendWithCsrf(
                api,
                'GET',
                `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/favorites?workspaceId=${encodeURIComponent(
                    runtimeIds.workspaceId
                )}&locale=ru&limit=200`
            )
            expect(persistedFavoritesResponse.status).toBe(200)
            expect((await persistedFavoritesResponse.json()).items).toHaveLength(0)
            await expectNoVisibleRuntimeIdentifiers(page, 'empty Russian Favorites list')
            await expectNoPageHorizontalOverflow(page, 'empty Russian Favorites list')
            await page.reload()
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            const reloadedFavoritesTab = page
                .getByTestId('interpretation-network-matrix-workspace')
                .getByRole('tab', { name: 'Избранное', exact: true })
            await reloadedFavoritesTab.click()
            await expect(
                page.getByRole('tabpanel', { name: 'Избранное' }).getByText('Пока нет избранных ячеек.', { exact: false })
            ).toBeVisible()
            await attachViewportEvidence(page, testInfo, 'interpretation-network-favorites-removed-mobile', {
                width: 390,
                height: 844
            })
        } finally {
            if (ownerSharedWorkspaceSession) await ownerSharedWorkspaceSession.context.close()
            if (memberSession) await memberSession.context.close()
            await disposeBootstrapApiContext(bootstrapApi)
            await disposeApiContext(api)
        }
    })
})
