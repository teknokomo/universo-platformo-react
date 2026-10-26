import { expect, test } from '../../fixtures/test'
import type { Locator, Page } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext, sendWithCsrf } from '../../support/backend/api-session.mjs'
import { withE2eDatabaseClient } from '../../support/backend/e2eDatabase.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { switchRuntimeLocale } from '../../support/browser/preferences'
import {
    expectLocatorFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls,
    expectTableHorizontalScrollConstrained
} from '../../support/browser/runtimeUx'
import { generateUuidV7 } from '@universo-react/utils'
import {
    attachDialogViewportEvidence,
    attachViewportEvidence,
    createMaterialForCell,
    findMatrixRowByTitle,
    getMaterialRows,
    getMatrixRows,
    getTemplateDetail,
    getTemplateMatrixRows,
    listTemplates,
    readLocalizedText,
    setPrimaryMaterialForCell,
    setInterpretationNetworkWidgetConfig,
    toMatrixRowSnapshot
} from '../../support/interpretationNetworkFocused'
import {
    uuidV7Pattern,
    getMatrixCell,
    prepareSingleSystem,
    openMatrixInTreeView,
    expectNoRuntimeLeakage
} from './interpretation-network-browser-gaps.helpers'

const WIDE_DESKTOP_VIEWPORT = { width: 1920, height: 1080 }

const getHierarchicalCellButton = (matrix: Locator, title: string, position?: string) => {
    const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const accessibleName = position ? `${position}, ${title}` : new RegExp(`,\\s*${escapedTitle}$`, 'u')
    return matrix.getByTestId('interpretation-network-matrix-table').getByRole('button', { name: accessibleName })
}

const createChildCell = async (page: Page, applicationId: string, parentTitle: string, title: string): Promise<void> => {
    const matrix = page.getByTestId('interpretation-network-matrix-workspace')
    const parentCell = getMatrixCell(page, parentTitle)
    await parentCell.click()
    await matrix.getByRole('button', { name: 'Add', exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Add cell' })
    await expect(dialog).toBeVisible()
    await expectSemanticFieldControls(dialog, { longTextLabels: ['Description'] })
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(title)
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(`Browser gap proof for ${title}.`)
    const createResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells`,
        { label: `Creating ${title}`, timeout: 30_000 }
    )
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    expect((await createResponse).status()).toBe(201)
    await expect(dialog).toHaveCount(0)
    await expect(getMatrixCell(page, title)).toBeVisible({ timeout: 30_000 })
}

const scrollMatrixCellIntoViewWithKeyboard = async (matrix: Locator, cell: Locator, label: string): Promise<void> => {
    const scroller = matrix.getByTestId('interpretation-network-matrix-table')
    await expectTableHorizontalScrollConstrained(scroller, label)
    await expect(scroller).toHaveAttribute('tabindex', '0')

    const initialMetrics = await scroller.evaluate((node) => {
        const element = node as HTMLElement
        return { clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }
    })
    expect(initialMetrics.scrollWidth, `${label} has horizontally scrollable matrix content`).toBeGreaterThan(
        initialMetrics.clientWidth + 1
    )

    const isCellFullyInsideScroller = async (): Promise<boolean> => {
        const [scrollerBox, cellBox] = await Promise.all([scroller.boundingBox(), cell.boundingBox()])
        return Boolean(
            scrollerBox && cellBox && cellBox.x >= scrollerBox.x - 1 && cellBox.x + cellBox.width <= scrollerBox.x + scrollerBox.width + 1
        )
    }

    for (let attempt = 0; attempt < 16 && !(await isCellFullyInsideScroller()); attempt += 1) {
        await scroller.press('ArrowRight')
    }

    expect(await isCellFullyInsideScroller(), `${label} reaches the complete selected cell with keyboard horizontal scrolling`).toBe(true)
}

const expectNoVisibleRuntimeIdentifiers = async (page: Page, label: string): Promise<void> => {
    await expectNoTechnicalLeakage(page.getByRole('main'), {
        label,
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true,
        forbiddenVisibleTextPatterns: [/\[object Object\]/i]
    })
}

const markFavoriteTargetUnavailable = async (
    applicationId: string,
    interpretationId: string,
    cellId: string,
    unavailableCellId: string
): Promise<void> => {
    const quoteIdentifier = (value: unknown, label: string): string => {
        if (typeof value !== 'string' || !/^[a-z_][a-z0-9_]*$/u.test(value)) {
            throw new Error(`E2E could not safely resolve the ${label} Favorite identifier`)
        }
        return `"${value}"`
    }
    const normalizeCodename = (value: unknown): string => readLocalizedText(value).replace(/\s+/gu, '').toLowerCase()

    await withE2eDatabaseClient(async (client) => {
        const applicationResult = await client.query(
            `SELECT schema_name AS "schemaName"
             FROM applications.obj_applications
             WHERE id = $1 AND _upl_deleted = false AND _app_deleted = false`,
            [applicationId]
        )
        const schemaName = applicationResult.rows[0]?.schemaName
        const schemaSql = quoteIdentifier(schemaName, 'application schema')
        const objectsResult = await client.query(
            `SELECT id, table_name AS "tableName", codename
             FROM ${schemaSql}."_app_objects"
             WHERE _upl_deleted = false AND _app_deleted = false`,
            []
        )
        const favoriteObject = objectsResult.rows.find((row: { codename?: unknown }) => normalizeCodename(row.codename) === 'favorite')
        if (!favoriteObject) throw new Error('E2E could not resolve the Favorite object metadata')

        const componentsResult = await client.query(
            `SELECT codename, column_name AS "columnName"
             FROM ${schemaSql}."_app_components"
             WHERE object_id = $1
               AND parent_component_id IS NULL
               AND _upl_deleted = false
               AND _app_deleted = false`,
            [favoriteObject.id]
        )
        const resolveColumn = (codename: string): string => {
            const component = componentsResult.rows.find(
                (row: { codename?: unknown }) => normalizeCodename(row.codename) === codename.toLowerCase()
            )
            return quoteIdentifier(component?.columnName, `Favorite ${codename} column`)
        }
        const tableSql = `${schemaSql}.${quoteIdentifier(favoriteObject.tableName, 'Favorite table')}`
        const interpretationColumn = resolveColumn('TargetInterpretationId')
        const cellColumn = resolveColumn('TargetCellId')
        const updateResult = await client.query(
            `UPDATE ${tableSql}
             SET ${cellColumn} = $1
             WHERE ${interpretationColumn} = $2
               AND ${cellColumn} = $3
               AND _upl_deleted = false
               AND _app_deleted = false
             RETURNING id`,
            [unavailableCellId, interpretationId, cellId]
        )
        if (updateResult.rowCount !== 1) {
            throw new Error(`E2E expected to update one Favorite reference, but updated ${updateResult.rowCount ?? 0}`)
        }
    })
}

test.describe('Interpretation Network browser gap coverage @flow @interpretation-network-focused', () => {
    test('page overflow oracle catches a body min-width beyond the browser viewport', async ({ page }) => {
        const label = 'Synthetic body min-width overflow canary'
        await page.setViewportSize({ width: 390, height: 844 })
        await page.setContent(`
            <!doctype html>
            <html>
                <head><style>body { min-width: 640px; }</style></head>
                <body><main>Viewport overflow canary</main></body>
            </html>
        `)

        await expect(page.getByRole('main')).toBeVisible()
        await expect(expectNoPageHorizontalOverflow(page, label)).rejects.toThrow(`${label} must not create horizontal page overflow`)
    })

    test('removes an unavailable Favorite through the Russian interface without exposing its UUID', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(180_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const { applicationId, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'stale-favorite-ru')
            await openMatrixInTreeView(page, applicationId)
            const rootCell = getMatrixCell(page, 'Universe')
            await rootCell.click()
            await page.getByRole('button', { name: 'Cell actions: Universe', exact: true }).click()
            await page.getByRole('menuitem', { name: 'Add to favorites', exact: true }).click()
            await expect(page.getByRole('alert').filter({ hasText: 'Added to favorites.' })).toBeVisible({ timeout: 30_000 })

            const savedCell = findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe')
            const unavailableCellId = generateUuidV7()
            expect(unavailableCellId).not.toBe(savedCell.cellId)
            await markFavoriteTargetUnavailable(applicationId, system.interpretationId, savedCell.cellId, unavailableCellId)

            await switchRuntimeLocale(page, 'ru')
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            const favoritesTab = page.getByRole('tab', { name: 'Избранное', exact: true })
            await favoritesTab.click()
            const favoritesPanel = page.getByRole('tabpanel', { name: 'Избранное', exact: true })
            await expect(favoritesPanel.getByText('Недоступная ячейка', { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(favoritesPanel.getByText('Недоступна', { exact: true })).toBeVisible()
            await expect(favoritesPanel.getByRole('button', { name: /Открыть:/u })).toHaveCount(0)
            await expectNoTechnicalLeakage(page.getByRole('main'), {
                label: 'Unavailable Russian Favorite',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })

            const removeFavoriteResponsePromise = page.waitForResponse((response) => {
                const url = new URL(response.url())
                return response.request().method() === 'DELETE' && url.pathname.endsWith('/runtime/interpretation-network/favorites')
            })
            await favoritesPanel.getByRole('button', { name: 'Удалить недоступную ячейку из избранного', exact: true }).click()
            const removeFavoriteResponse = await removeFavoriteResponsePromise
            expect(removeFavoriteResponse.status()).toBe(200)
            await expect(page.getByRole('alert').filter({ hasText: 'Удалено из избранного.' })).toBeVisible({ timeout: 30_000 })
            await expect(favoritesPanel.getByText('Пока нет избранных ячеек.', { exact: false })).toBeVisible({ timeout: 30_000 })
            const persistedFavoritesResponse = await sendWithCsrf(
                api,
                'GET',
                `/api/v1/applications/${applicationId}/runtime/interpretation-network/favorites?workspaceId=${encodeURIComponent(
                    runtimeIds.workspaceId
                )}&locale=ru&limit=200`
            )
            expect(persistedFavoritesResponse.status).toBe(200)
            expect((await persistedFavoritesResponse.json()).items).toHaveLength(0)
            await expectNoTechnicalLeakage(page.getByRole('main'), {
                label: 'Removed unavailable Russian Favorite',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            await expectNoPageHorizontalOverflow(page, 'Removed unavailable Russian Favorite')
            await page.reload()
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            const reloadedFavoritesTab = page.getByRole('tab', { name: 'Избранное', exact: true })
            await reloadedFavoritesTab.click()
            await expect(
                page.getByRole('tabpanel', { name: 'Избранное' }).getByText('Пока нет избранных ячеек.', { exact: false })
            ).toBeVisible()
            await attachViewportEvidence(page, testInfo, 'interpretation-network-unavailable-favorite-removed-mobile', {
                width: 390,
                height: 844
            })
        } finally {
            await disposeApiContext(api)
        }
    })

    test('saves and inserts the selected branch across viewports and in Russian without changing its source', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(180_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const { applicationId, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'selected-branch-wide')
            const branchTitle = 'Wide selected branch E2E'
            const descendantTitle = 'Wide selected descendant E2E'
            const siblingTitle = 'Wide outside sibling E2E'
            await page.setViewportSize(WIDE_DESKTOP_VIEWPORT)
            await openMatrixInTreeView(page, applicationId)
            await createChildCell(page, applicationId, 'Universe', branchTitle)
            await createChildCell(page, applicationId, branchTitle, descendantTitle)
            await createChildCell(page, applicationId, 'Universe', siblingTitle)
            const sourceRowsBeforeTemplate = await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId)
            const sourceBranchBeforeTemplate = findMatrixRowByTitle(sourceRowsBeforeTemplate, branchTitle)
            const expectedBranchVersion = sourceBranchBeforeTemplate.row._upl_version
            expect(typeof expectedBranchVersion).toBe('number')
            const authoredMaterialBody = {
                format: 'editorjs' as const,
                data: {
                    time: 0,
                    version: '2.30.8',
                    blocks: [
                        {
                            id: 'selected-branch-material-paragraph',
                            type: 'paragraph',
                            data: { text: 'A material copied through selected-branch template insertion.' }
                        }
                    ]
                }
            }
            const sourceMaterial = await createMaterialForCell(api, applicationId, runtimeIds, {
                interpretationId: system.interpretationId,
                cellId: sourceBranchBeforeTemplate.cellId,
                title: 'Selected branch material E2E',
                description: 'Material used to verify selected branch template copies.',
                body: authoredMaterialBody
            })
            await setPrimaryMaterialForCell(api, applicationId, runtimeIds, {
                interpretationId: system.interpretationId,
                cellId: sourceBranchBeforeTemplate.cellId,
                materialId: sourceMaterial.id,
                expectedCellVersion: expectedBranchVersion as number
            })
            await getMatrixCell(page, branchTitle).click()

            const matrix = page.getByTestId('interpretation-network-matrix-workspace')
            await matrix.getByRole('button', { name: 'Save as template', exact: true }).click()
            const dialog = page.getByRole('dialog', { name: 'Save structure as template' })
            await expect(dialog).toBeVisible()
            await expectSemanticFieldControls(dialog, { longTextLabels: ['Description'] })
            await dialog.getByRole('radio', { name: 'Selected branch', exact: true }).check()
            await dialog.getByRole('radio', { name: 'Structure and materials', exact: true }).check()
            await expect(dialog).toContainText(`Selected path: Universe › ${branchTitle}`)
            await dialog.getByRole('textbox', { name: 'Template name' }).first().fill('Wide selected branch template')
            await dialog.getByRole('textbox', { name: 'Description' }).first().fill('Wide-screen selected branch browser proof.')
            await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()

            await attachDialogViewportEvidence(
                page,
                testInfo,
                dialog,
                'interpretation-network-selected-branch-template-dialog-wide-desktop',
                WIDE_DESKTOP_VIEWPORT,
                ['Cancel', 'Save']
            )
            await expectLocatorFitsViewport(dialog, 'Selected branch dialog at 1920x1080')
            await expectNoRuntimeLeakage(dialog, 'selected branch 1920x1080 dialog')
            await expectNoPageHorizontalOverflow(page, 'selected branch 1920x1080 dialog')

            const templateName = 'Wide selected branch template'
            await dialog.getByRole('textbox', { name: 'Template name' }).first().fill(templateName)
            await dialog.getByRole('textbox', { name: 'Description' }).first().fill('Saved from the 1920x1080 selected-branch flow.')
            const saveResponse = waitForSettledMutationResponse(
                page,
                (response) => response.request().method() === 'POST' && /\/templates(?:\/[^/]+)?$/.test(new URL(response.url()).pathname),
                { label: 'Saving the selected branch from the wide-screen dialog', timeout: 30_000 }
            )
            await dialog.getByRole('button', { name: 'Save', exact: true }).click()
            expect((await saveResponse).ok()).toBe(true)
            await expect(dialog).toHaveCount(0)

            const template = (await listTemplates(api, applicationId, runtimeIds.workspaceId)).find(
                (item) => readLocalizedText(item.name) === templateName
            )
            expect(template).toBeDefined()
            const [sourceRows, templateDetail, templateRows] = await Promise.all([
                getMatrixRows(api, applicationId, runtimeIds, system.interpretationId),
                getTemplateDetail(api, applicationId, runtimeIds.workspaceId, template!.id),
                getTemplateMatrixRows(api, applicationId, runtimeIds, template!.id)
            ])
            expect(sourceRows).toHaveLength(4)
            expect(templateDetail.matrix).toMatchObject({ cellCount: 2, rootCount: 1, maxDepth: 2 })
            expect(templateDetail.includesMaterials).toBe(true)
            expect(templateDetail.materialCount).toBe(1)
            expect(templateRows).toHaveLength(2)
            const sourceAncestor = findMatrixRowByTitle(sourceRows, 'Universe')
            const sourceBranch = findMatrixRowByTitle(sourceRows, branchTitle)
            const sourceDescendant = findMatrixRowByTitle(sourceRows, descendantTitle)
            const sourceSibling = findMatrixRowByTitle(sourceRows, siblingTitle)
            expect(sourceBranch.parentCellId).toBe(sourceAncestor.cellId)
            expect(sourceDescendant.parentCellId).toBe(sourceBranch.cellId)
            expect(sourceSibling.parentCellId).toBe(sourceAncestor.cellId)
            const savedRoot = findMatrixRowByTitle(templateRows, branchTitle)
            const savedDescendant = findMatrixRowByTitle(templateRows, descendantTitle)
            expect(savedRoot.materialRef).toMatch(uuidV7Pattern)
            expect(savedRoot.materialRef).not.toBe(sourceMaterial.id)
            expect(savedRoot.parentCellId).toBeNull()
            expect(savedDescendant.parentCellId).toBe(savedRoot.cellId)
            expect(templateRows.some((row) => readLocalizedText(row.CellValue) === 'Universe')).toBe(false)
            expect(templateRows.some((row) => readLocalizedText(row.CellValue) === siblingTitle)).toBe(false)
            const savedTemplateMaterial = (await getMaterialRows(api, applicationId, runtimeIds)).find(
                (material) => material.rowId === savedRoot.materialRef
            )
            expect(savedTemplateMaterial).toMatchObject({
                title: 'Selected branch material E2E',
                description: 'Material used to verify selected branch template copies.',
                body: authoredMaterialBody
            })

            const sourceSnapshots = [sourceAncestor, sourceBranch, sourceDescendant, sourceSibling]
            const sourceIdentities = new Set(sourceSnapshots.flatMap(({ cellId, rowId }) => [cellId, rowId]))
            const templateIdentities = [savedRoot.cellId, savedRoot.rowId, savedDescendant.cellId, savedDescendant.rowId]
            const preInstantiationIdentities = new Set([
                system.structureId,
                system.interpretationId,
                system.rootCellId,
                template!.id,
                sourceMaterial.id,
                savedTemplateMaterial!.rowId,
                ...sourceIdentities,
                ...templateIdentities
            ])
            expect(new Set(templateIdentities).size, 'Every saved branch cell and row must have a unique identity').toBe(
                templateIdentities.length
            )
            for (const identity of templateIdentities) {
                expect(identity, 'Every saved branch cell and row identity must be UUID v7').toMatch(uuidV7Pattern)
                expect(sourceIdentities.has(identity), 'Saving a selected branch must not reuse source identities').toBe(false)
            }

            await setInterpretationNetworkWidgetConfig(api, applicationId, { structureMode: 'multiple' })
            await page.reload()
            const structurePane = page.getByTestId('interpretation-network-structure-pane')
            await expect(structurePane.getByRole('heading', { name: 'Structures', exact: true })).toBeVisible({ timeout: 30_000 })
            await structurePane.getByRole('button', { name: 'Create', exact: true }).click()
            const createStructureDialog = page.getByRole('dialog', { name: 'Create structure' })
            await expect(createStructureDialog).toBeVisible()
            await expectSemanticFieldControls(createStructureDialog, { longTextLabels: ['Description'] })
            await createStructureDialog.getByRole('tab', { name: 'Templates', exact: true }).click()
            await expect(createStructureDialog.getByRole('combobox', { name: 'Template', exact: true })).toContainText(templateName)
            await createStructureDialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Wide branch copy E2E')
            await createStructureDialog
                .getByRole('textbox', { name: 'Description', exact: true })
                .fill('Created from the selected branch template.')
            const instantiateTemplateRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname.startsWith(
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/`
                    ) &&
                    new URL(response.url()).pathname.endsWith('/instantiate'),
                { label: 'Instantiating the selected branch template through the UI', timeout: 30_000 }
            )
            await createStructureDialog.getByRole('button', { name: 'Create', exact: true }).click()
            const instantiateTemplateResponse = await instantiateTemplateRequest
            expect(instantiateTemplateResponse.status()).toBe(201)
            const instantiated = (await instantiateTemplateResponse.json()) as { structureId: string; interpretationId: string }
            expect(instantiated.structureId).toMatch(uuidV7Pattern)
            expect(instantiated.interpretationId).toMatch(uuidV7Pattern)
            expect(instantiated.structureId).not.toBe(system.structureId)
            expect(instantiated.interpretationId).not.toBe(system.interpretationId)
            expect(instantiated.structureId).not.toBe(instantiated.interpretationId)
            await expect(createStructureDialog).toHaveCount(0)
            await expect(page.getByTestId('interpretation-network-structure-header')).toContainText('Wide branch copy E2E')
            const [instantiatedRows, sourceRowsAfter, templateRowsAfter, templateDetailAfter] = await Promise.all([
                getMatrixRows(api, applicationId, runtimeIds, instantiated.interpretationId),
                getMatrixRows(api, applicationId, runtimeIds, system.interpretationId),
                getTemplateMatrixRows(api, applicationId, runtimeIds, template!.id),
                getTemplateDetail(api, applicationId, runtimeIds.workspaceId, template!.id)
            ])
            expect(instantiatedRows).toHaveLength(2)
            const copiedRoot = findMatrixRowByTitle(instantiatedRows, branchTitle)
            const copiedDescendant = findMatrixRowByTitle(instantiatedRows, descendantTitle)
            expect(copiedRoot.parentCellId).toBeNull()
            expect(copiedDescendant.parentCellId).toBe(copiedRoot.cellId)
            expect(copiedRoot.materialRef).toMatch(uuidV7Pattern)
            expect(copiedRoot.materialRef).not.toBe(sourceMaterial.id)
            expect(copiedRoot.materialRef).not.toBe(savedTemplateMaterial!.rowId)
            expect(sourceRowsAfter).toEqual(sourceRows)
            expect(templateRowsAfter).toEqual(templateRows)
            expect(templateDetailAfter, 'Instantiating a template must not modify its persisted metadata').toEqual(templateDetail)
            const copiedIdentities = [
                copiedRoot.cellId,
                copiedRoot.rowId,
                copiedDescendant.cellId,
                copiedDescendant.rowId,
                copiedRoot.materialRef!
            ]
            expect(new Set(copiedIdentities).size, 'Every instantiated branch cell and row must have a unique identity').toBe(
                copiedIdentities.length
            )
            for (const identity of copiedIdentities) {
                expect(identity, 'Every instantiated branch cell and row identity must be UUID v7').toMatch(uuidV7Pattern)
                expect(preInstantiationIdentities.has(identity), 'Instantiating a selected branch must use fresh identities').toBe(false)
            }
            const instantiatedIdentitySet = new Set([instantiated.structureId, instantiated.interpretationId, ...copiedIdentities])
            expect(
                instantiatedIdentitySet.size,
                'Instantiated Structure, Interpretation, cell, row, and material identities must all be unique'
            ).toBe(7)
            for (const identity of [instantiated.structureId, instantiated.interpretationId]) {
                expect(preInstantiationIdentities.has(identity), 'Instantiated Structure identities must be fresh').toBe(false)
            }

            const nestedTargetCell = getHierarchicalCellButton(matrix, descendantTitle)
            await expect(nestedTargetCell, 'The template can be inserted beneath a non-root Matrix cell').toBeVisible()
            await expect(nestedTargetCell).toHaveAttribute('aria-pressed', 'false')
            await nestedTargetCell.click()
            await page.getByRole('button', { name: `Cell actions: ${descendantTitle}`, exact: true }).click()
            const cellActions = page.getByRole('menu')
            const insertSavedTemplate = cellActions.getByRole('menuitem', {
                name: 'Insert template structure under this cell',
                exact: true
            })
            await expect(insertSavedTemplate).toBeEnabled()
            await insertSavedTemplate.click()
            const templatesTab = structurePane.getByRole('tab', { name: 'Templates', exact: true })
            await expect(templatesTab).toHaveAttribute('aria-selected', 'true')
            const templateTable = structurePane.getByTestId('interpretation-network-template-table')
            await expect(templateTable).toContainText(templateName)
            await expectNoTechnicalLeakage(templateTable, {
                label: 'English saved-template list',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            await templateTable.getByRole('button', { name: templateName, exact: true }).click()
            const applyTemplateDialog = page.getByRole('dialog', { name: templateName })
            await expect(page.locator('html')).toHaveAttribute('lang', 'en')
            await expectNoTechnicalLeakage(applyTemplateDialog, {
                label: 'English saved-template details dialog',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            const insertTemplateButtonName = `Insert into “${descendantTitle}”`
            const insertTemplateButton = applyTemplateDialog.getByRole('button', { name: insertTemplateButtonName, exact: true })
            await expect(insertTemplateButton).toBeEnabled()
            for (const viewport of [
                { name: 'wide-desktop', ...WIDE_DESKTOP_VIEWPORT },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await attachDialogViewportEvidence(
                    page,
                    testInfo,
                    applyTemplateDialog,
                    `interpretation-network-apply-template-to-existing-cell-${viewport.name}`,
                    viewport,
                    [insertTemplateButtonName, 'Close']
                )
            }
            await page.setViewportSize(WIDE_DESKTOP_VIEWPORT)
            const applyTemplateRoute = `**/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/${
                template!.id
            }/apply**`
            await page.route(applyTemplateRoute, async (route) => {
                if (route.request().method() !== 'POST') {
                    await route.continue()
                    return
                }
                await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_CONFLICT' }) })
            })
            const rejectedApplyRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/${template!.id}/apply`,
                { label: 'Keeping the template dialog open after a rejected insertion', timeout: 30_000 }
            )
            await insertTemplateButton.click()
            expect((await rejectedApplyRequest).status()).toBe(409)
            await expect(applyTemplateDialog, 'A failed insertion keeps the selected template details open').toBeVisible()
            await expect(applyTemplateDialog.getByRole('alert')).toHaveText('Failed to insert the template into this cell.')
            await expect(insertTemplateButton).toBeEnabled()
            await expect(await getMatrixRows(api, applicationId, runtimeIds, instantiated.interpretationId)).toEqual(instantiatedRows)
            await attachDialogViewportEvidence(
                page,
                testInfo,
                applyTemplateDialog,
                'interpretation-network-apply-template-conflict-wide-desktop',
                WIDE_DESKTOP_VIEWPORT,
                [insertTemplateButtonName, 'Close']
            )
            await page.unroute(applyTemplateRoute)

            const applyTemplateRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/${template!.id}/apply`,
                { label: 'Applying a saved structure below the selected Matrix cell', timeout: 30_000 }
            )
            await insertTemplateButton.click()
            const applyTemplateResponse = await applyTemplateRequest
            expect(applyTemplateResponse.status()).toBe(201)
            const applied = (await applyTemplateResponse.json()) as {
                templateId: string
                templateVersion: number
                interpretationId: string
                targetCellId: string
                targetCellVersion: number
                insertedRootCellId: string
                insertedCellCount: number
                insertedMaterialCount: number
            }
            expect(applied).toMatchObject({
                templateId: template!.id,
                interpretationId: instantiated.interpretationId,
                targetCellId: copiedDescendant.cellId,
                insertedCellCount: templateRows.length,
                insertedMaterialCount: templateDetail.materialCount
            })
            expect(applied.insertedRootCellId).toMatch(uuidV7Pattern)
            await expect(applyTemplateDialog).toHaveCount(0)

            const [rowsAfterApplyRaw, sourceRowsAfterApply, templateRowsAfterApply, templateDetailAfterApply] = await Promise.all([
                getMatrixRows(api, applicationId, runtimeIds, instantiated.interpretationId),
                getMatrixRows(api, applicationId, runtimeIds, system.interpretationId),
                getTemplateMatrixRows(api, applicationId, runtimeIds, template!.id),
                getTemplateDetail(api, applicationId, runtimeIds.workspaceId, template!.id)
            ])
            const rowsAfterApply = rowsAfterApplyRaw.map(toMatrixRowSnapshot)
            expect(rowsAfterApply).toHaveLength(instantiatedRows.length + templateRows.length)
            const appliedRoot = rowsAfterApply.find((row) => row.cellId === applied.insertedRootCellId)
            expect(appliedRoot?.parentCellId).toBe(copiedDescendant.cellId)
            expect(appliedRoot?.materialRef).toMatch(uuidV7Pattern)
            expect(appliedRoot?.materialRef).not.toBe(sourceMaterial.id)
            expect(appliedRoot?.materialRef).not.toBe(savedTemplateMaterial!.rowId)
            expect(appliedRoot?.materialRef).not.toBe(copiedRoot.materialRef)
            const appliedDescendant = rowsAfterApply.find((row) => row.parentCellId === applied.insertedRootCellId)
            expect(appliedDescendant).toBeDefined()
            expect(sourceRowsAfterApply).toEqual(sourceRows)
            expect(templateRowsAfterApply).toEqual(templateRows)
            expect(templateDetailAfterApply, 'Applying a template must not change any persisted template metadata').toEqual(templateDetail)
            const preApplyIdentitySet = new Set([...preInstantiationIdentities, ...instantiatedIdentitySet])
            const appliedRows = rowsAfterApply.filter(
                (row) => row.cellId === applied.insertedRootCellId || row.parentCellId === applied.insertedRootCellId
            )
            expect(appliedRows).toHaveLength(templateRows.length)
            const appliedIdentities = appliedRows.flatMap((row) => [row.cellId, row.rowId, ...(row.materialRef ? [row.materialRef] : [])])
            expect(new Set(appliedIdentities).size, 'Inserted cell, row, and cloned material identities must all be unique').toBe(
                appliedIdentities.length
            )
            for (const row of appliedRows) {
                expect(row.cellId).toMatch(uuidV7Pattern)
                expect(row.rowId).toMatch(uuidV7Pattern)
                expect(preApplyIdentitySet.has(row.cellId), 'Inserted cell IDs must be fresh across the source, template, and target').toBe(
                    false
                )
                expect(preApplyIdentitySet.has(row.rowId), 'Inserted row IDs must be fresh across the source, template, and target').toBe(
                    false
                )
                if (row.materialRef) {
                    expect(row.materialRef).toMatch(uuidV7Pattern)
                    expect(
                        preApplyIdentitySet.has(row.materialRef),
                        'Inserted material IDs must be fresh across the source, template, and target'
                    ).toBe(false)
                }
            }
            const materialsAfterApply = await getMaterialRows(api, applicationId, runtimeIds)
            const appliedMaterial = materialsAfterApply.find((material) => material.rowId === appliedRoot?.materialRef)
            expect(appliedMaterial).toMatchObject({
                title: 'Selected branch material E2E',
                description: 'Material used to verify selected branch template copies.',
                body: authoredMaterialBody
            })
            expect(materialsAfterApply.find((material) => material.rowId === sourceMaterial.id)).toMatchObject({
                title: 'Selected branch material E2E',
                description: 'Material used to verify selected branch template copies.',
                body: authoredMaterialBody
            })
            expect(materialsAfterApply.find((material) => material.rowId === savedTemplateMaterial!.rowId)).toEqual(savedTemplateMaterial)

            const insertedRootCell = getHierarchicalCellButton(matrix, branchTitle, '1/1/1')
            await expect(insertedRootCell, 'The new branch can be located by its visible cell name').toHaveCount(1)
            await expect(insertedRootCell, 'The inserted template root is immediately visible in the existing Matrix').toBeVisible()
            await expect(insertedRootCell).toContainText(branchTitle)
            await expect(page.getByRole('heading', { name: 'Selected branch material E2E', exact: true })).toBeVisible()
            await expect(page.getByText('A material copied through selected-branch template insertion.', { exact: true })).toBeVisible()
            await insertedRootCell.click()
            await expect(insertedRootCell).toHaveAttribute('aria-pressed', 'true')
            const insertedDescendantCell = getHierarchicalCellButton(matrix, descendantTitle, '1/1/1/1')
            await expect(insertedDescendantCell, 'The inserted child is identified by its visible cell name').toHaveCount(1)
            await expect(insertedDescendantCell, 'The inserted template descendant is visible after opening its parent cell').toBeVisible()
            await expect(insertedDescendantCell).toContainText(descendantTitle)
            await expectNoVisibleRuntimeIdentifiers(page, 'template inserted below an existing cell')
            await expectNoPageHorizontalOverflow(page, 'template inserted below an existing cell')
            for (const viewport of [
                { name: 'wide-desktop', ...WIDE_DESKTOP_VIEWPORT },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize(viewport)
                await expect(insertedDescendantCell, `Inserted Matrix content remains visible at ${viewport.width}px`).toBeVisible()
                await expectNoPageHorizontalOverflow(page, `Nested template result at ${viewport.width}px`)
                if (viewport.name === 'mobile') {
                    await scrollMatrixCellIntoViewWithKeyboard(matrix, insertedDescendantCell, 'English mobile nested-template Matrix')
                }
                await attachViewportEvidence(
                    page,
                    testInfo,
                    `interpretation-network-template-inserted-below-existing-cell-${viewport.name}`,
                    viewport
                )
            }
            await page.setViewportSize(WIDE_DESKTOP_VIEWPORT)

            await structurePane.getByRole('tab', { name: 'Templates', exact: true }).click()
            await expect(structurePane.getByTestId('interpretation-network-template-table')).toContainText(templateName)
            await expectNoVisibleRuntimeIdentifiers(page, 'selected-branch 1920x1080 save flow')
            await expectNoPageHorizontalOverflow(page, 'selected-branch 1920x1080 saved state')
            await page.setViewportSize(WIDE_DESKTOP_VIEWPORT)
            await expect(structurePane.getByTestId('interpretation-network-template-table')).toContainText(templateName)
            await attachViewportEvidence(
                page,
                testInfo,
                'interpretation-network-selected-branch-instantiated-wide-desktop',
                WIDE_DESKTOP_VIEWPORT
            )

            await switchRuntimeLocale(page, 'ru')
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            const russianMatrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
            await expect(russianMatrixWorkspace).toBeVisible({ timeout: 30_000 })
            const russianWorkspaceTabs = russianMatrixWorkspace.getByRole('tablist', {
                name: 'Разделы рабочего пространства',
                exact: true
            })
            const russianMatrixTab = russianWorkspaceTabs.getByRole('tab', { name: 'Матрица', exact: true })
            await expect(russianWorkspaceTabs.getByRole('tab', { name: 'Избранное', exact: true })).toBeVisible()
            const russianTemplatesTab = russianWorkspaceTabs.getByRole('tab', { name: 'Шаблоны', exact: true })
            await expect(russianTemplatesTab).toBeVisible()
            await russianMatrixTab.click()
            await expect(russianMatrixTab).toHaveAttribute('aria-selected', 'true')

            const russianRootBreadcrumb = russianMatrixWorkspace
                .getByRole('navigation', { name: 'Путь матрицы', exact: true })
                .getByRole('button', { name: branchTitle, exact: true })
            await expect(russianRootBreadcrumb).toBeVisible()
            await russianRootBreadcrumb.click()
            const russianTargetCell = getHierarchicalCellButton(russianMatrixWorkspace, descendantTitle)
            await expect(russianTargetCell, 'The Russian flow targets an existing cell in the copied structure').toHaveCount(1)
            await expect(russianTargetCell).toBeVisible()
            await russianTargetCell.click()
            await page.getByRole('button', { name: `Действия ячейки: ${descendantTitle}`, exact: true }).click()
            const russianCellActions = page.getByRole('menu')
            const russianInsertSavedTemplate = russianCellActions.getByRole('menuitem', {
                name: 'Вставить структуру из шаблона под выбранную ячейку',
                exact: true
            })
            await expect(russianInsertSavedTemplate).toBeEnabled()
            await russianInsertSavedTemplate.click()
            await expect(russianTemplatesTab).toHaveAttribute('aria-selected', 'true')
            const russianTemplateTable = russianMatrixWorkspace.getByTestId('interpretation-network-template-table')
            await expect(russianTemplateTable).toContainText(templateName)
            await expectNoTechnicalLeakage(russianTemplateTable, {
                label: 'Russian saved-template list',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            await russianTemplateTable.getByRole('button', { name: templateName, exact: true }).click()

            const russianApplyDialog = page.getByRole('dialog', { name: templateName, exact: true })
            await expect(russianApplyDialog).toBeVisible()
            await expectNoTechnicalLeakage(russianApplyDialog, {
                label: 'Russian saved-template details dialog',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            const russianInsertButtonName = `Вставить в «${descendantTitle}»`
            const russianInsertTemplateButton = russianApplyDialog.getByRole('button', {
                name: russianInsertButtonName,
                exact: true
            })
            await expect(russianInsertTemplateButton).toBeEnabled()

            const [
                targetRowsBeforeRussianApply,
                sourceRowsBeforeRussianApply,
                templateRowsBeforeRussianApply,
                templateDetailBeforeRussianApply,
                materialsBeforeRussianApply
            ] = await Promise.all([
                getMatrixRows(api, applicationId, runtimeIds, instantiated.interpretationId),
                getMatrixRows(api, applicationId, runtimeIds, system.interpretationId),
                getTemplateMatrixRows(api, applicationId, runtimeIds, template!.id),
                getTemplateDetail(api, applicationId, runtimeIds.workspaceId, template!.id),
                getMaterialRows(api, applicationId, runtimeIds)
            ])
            expect(targetRowsBeforeRussianApply.map(toMatrixRowSnapshot)).toEqual(rowsAfterApply)
            expect(sourceRowsBeforeRussianApply.map(toMatrixRowSnapshot)).toEqual(sourceRows.map(toMatrixRowSnapshot))
            expect(templateRowsBeforeRussianApply).toEqual(templateRows)
            expect(templateDetailBeforeRussianApply).toEqual(templateDetail)

            const russianApplyRoute = `**/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/${
                template!.id
            }/apply**`
            await page.route(russianApplyRoute, async (route) => {
                if (route.request().method() !== 'POST') {
                    await route.continue()
                    return
                }
                await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_CONFLICT' }) })
            })
            const rejectedRussianApplyRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/${template!.id}/apply`,
                { label: 'Keeping the Russian template dialog open after a rejected insertion', timeout: 30_000 }
            )
            await russianInsertTemplateButton.click()
            expect((await rejectedRussianApplyRequest).status()).toBe(409)
            await expect(russianApplyDialog, 'A failed Russian insertion keeps template details open').toBeVisible()
            await expect(russianApplyDialog.getByRole('alert')).toHaveText('Не удалось вставить шаблон в эту ячейку.')
            await expect(russianInsertTemplateButton).toBeEnabled()
            expect((await getMatrixRows(api, applicationId, runtimeIds, instantiated.interpretationId)).map(toMatrixRowSnapshot)).toEqual(
                targetRowsBeforeRussianApply.map(toMatrixRowSnapshot)
            )
            expect(await getTemplateMatrixRows(api, applicationId, runtimeIds, template!.id)).toEqual(templateRowsBeforeRussianApply)
            expect(await getTemplateDetail(api, applicationId, runtimeIds.workspaceId, template!.id)).toEqual(
                templateDetailBeforeRussianApply
            )
            expect(await getMaterialRows(api, applicationId, runtimeIds)).toEqual(materialsBeforeRussianApply)
            await attachDialogViewportEvidence(
                page,
                testInfo,
                russianApplyDialog,
                'interpretation-network-russian-template-insert-conflict-desktop',
                WIDE_DESKTOP_VIEWPORT,
                [russianInsertButtonName, 'Закрыть']
            )
            await page.unroute(russianApplyRoute)

            const russianApplyRequest = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/templates/${template!.id}/apply`,
                { label: 'Applying a saved structure below an existing cell in Russian', timeout: 30_000 }
            )
            await russianInsertTemplateButton.click()
            const russianApplyResponse = await russianApplyRequest
            expect(russianApplyResponse.status()).toBe(201)
            const russianApplied = (await russianApplyResponse.json()) as {
                templateId: string
                interpretationId: string
                targetCellId: string
                insertedRootCellId: string
                insertedCellCount: number
                insertedMaterialCount: number
            }
            expect(russianApplied).toMatchObject({
                templateId: template!.id,
                interpretationId: instantiated.interpretationId,
                targetCellId: copiedDescendant.cellId,
                insertedCellCount: templateRows.length,
                insertedMaterialCount: templateDetail.materialCount
            })
            expect(russianApplied.insertedRootCellId).toMatch(uuidV7Pattern)
            await expect(russianApplyDialog).toHaveCount(0)

            const [
                targetRowsAfterRussianApplyRaw,
                sourceRowsAfterRussianApply,
                templateRowsAfterRussianApply,
                templateDetailAfterRussianApply,
                materialsAfterRussianApply
            ] = await Promise.all([
                getMatrixRows(api, applicationId, runtimeIds, instantiated.interpretationId),
                getMatrixRows(api, applicationId, runtimeIds, system.interpretationId),
                getTemplateMatrixRows(api, applicationId, runtimeIds, template!.id),
                getTemplateDetail(api, applicationId, runtimeIds.workspaceId, template!.id),
                getMaterialRows(api, applicationId, runtimeIds)
            ])
            const targetRowsAfterRussianApply = targetRowsAfterRussianApplyRaw.map(toMatrixRowSnapshot)
            expect(targetRowsAfterRussianApply).toHaveLength(targetRowsBeforeRussianApply.length + templateRows.length)
            const russianAppliedRoot = targetRowsAfterRussianApply.find((row) => row.cellId === russianApplied.insertedRootCellId)
            expect(russianAppliedRoot?.parentCellId).toBe(copiedDescendant.cellId)
            expect(russianAppliedRoot?.materialRef).toMatch(uuidV7Pattern)
            const russianAppliedDescendant = targetRowsAfterRussianApply.find(
                (row) => row.parentCellId === russianApplied.insertedRootCellId
            )
            expect(russianAppliedDescendant).toBeDefined()
            expect(sourceRowsAfterRussianApply.map(toMatrixRowSnapshot)).toEqual(sourceRowsBeforeRussianApply.map(toMatrixRowSnapshot))
            expect(templateRowsAfterRussianApply).toEqual(templateRowsBeforeRussianApply)
            expect(templateDetailAfterRussianApply).toEqual(templateDetailBeforeRussianApply)

            const russianInsertedRows = targetRowsAfterRussianApply.filter(
                (row) => row.cellId === russianApplied.insertedRootCellId || row.parentCellId === russianApplied.insertedRootCellId
            )
            expect(russianInsertedRows).toHaveLength(templateRows.length)
            const russianPreApplyIdentitySet = new Set([
                ...targetRowsBeforeRussianApply.flatMap((row) => {
                    const snapshot = toMatrixRowSnapshot(row)
                    return [snapshot.cellId, snapshot.rowId, ...(snapshot.materialRef ? [snapshot.materialRef] : [])]
                }),
                ...sourceRowsBeforeRussianApply.flatMap((row) => {
                    const snapshot = toMatrixRowSnapshot(row)
                    return [snapshot.cellId, snapshot.rowId, ...(snapshot.materialRef ? [snapshot.materialRef] : [])]
                }),
                ...templateRowsBeforeRussianApply.flatMap((row) => {
                    const snapshot = toMatrixRowSnapshot(row)
                    return [snapshot.cellId, snapshot.rowId, ...(snapshot.materialRef ? [snapshot.materialRef] : [])]
                }),
                ...materialsBeforeRussianApply.map((material) => material.rowId)
            ])
            const russianInsertedIdentities = russianInsertedRows.flatMap((row) => [
                row.cellId,
                row.rowId,
                ...(row.materialRef ? [row.materialRef] : [])
            ])
            expect(new Set(russianInsertedIdentities).size).toBe(russianInsertedIdentities.length)
            for (const identity of russianInsertedIdentities) {
                expect(identity).toMatch(uuidV7Pattern)
                expect(russianPreApplyIdentitySet.has(identity), 'Russian template insertion must allocate fresh UUID v7 identities').toBe(
                    false
                )
            }

            const russianNewMaterials = materialsAfterRussianApply.filter(
                (material) => !materialsBeforeRussianApply.some((before) => before.rowId === material.rowId)
            )
            expect(russianNewMaterials).toHaveLength(templateDetail.materialCount)
            const russianAppliedMaterial = russianNewMaterials.find((material) => material.rowId === russianAppliedRoot?.materialRef)
            expect(russianAppliedMaterial).toMatchObject({
                title: 'Selected branch material E2E',
                description: 'Material used to verify selected branch template copies.',
                body: authoredMaterialBody
            })
            const existingMaterialsAfterRussianApply = materialsAfterRussianApply
                .filter((after) => materialsBeforeRussianApply.some((before) => before.rowId === after.rowId))
                .sort((left, right) => left.rowId.localeCompare(right.rowId))
            expect(existingMaterialsAfterRussianApply).toEqual(
                [...materialsBeforeRussianApply].sort((left, right) => left.rowId.localeCompare(right.rowId))
            )

            await russianMatrixTab.click()
            const russianInsertedRootCell = getHierarchicalCellButton(russianMatrixWorkspace, branchTitle, '1/1/1')
            await expect(russianInsertedRootCell, 'Russian users can find the inserted branch by its visible cell name').toHaveCount(1)
            await expect(
                russianInsertedRootCell,
                'The Russian insertion is rendered immediately under the selected existing cell'
            ).toBeVisible({ timeout: 30_000 })
            await expect(russianInsertedRootCell).toContainText(branchTitle)
            await russianInsertedRootCell.click()
            await expect(russianInsertedRootCell).toHaveAttribute('aria-pressed', 'true')
            const russianInsertedDescendantCell = getHierarchicalCellButton(russianMatrixWorkspace, descendantTitle, '1/1/1/1')
            await expect(russianInsertedDescendantCell, 'The Russian inserted child is identified by its visible cell name').toHaveCount(1)
            await expect(russianInsertedDescendantCell).toBeVisible()
            await expect(russianInsertedDescendantCell).toContainText(descendantTitle)
            await expectNoVisibleRuntimeIdentifiers(page, 'Russian nested template insertion')
            await expectNoPageHorizontalOverflow(page, 'Russian nested template insertion')

            await page.reload()
            await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
            const reloadedRussianMatrixWorkspace = page.getByTestId('interpretation-network-matrix-workspace')
            await expect(reloadedRussianMatrixWorkspace).toBeVisible({ timeout: 30_000 })
            const reloadedRussianTabs = reloadedRussianMatrixWorkspace.getByRole('tablist', {
                name: 'Разделы рабочего пространства',
                exact: true
            })
            await reloadedRussianTabs.getByRole('tab', { name: 'Матрица', exact: true }).click()
            const reloadedRussianRootBreadcrumb = reloadedRussianMatrixWorkspace
                .getByRole('navigation', { name: 'Путь матрицы', exact: true })
                .getByRole('button', { name: branchTitle, exact: true })
            await expect(reloadedRussianRootBreadcrumb).toBeVisible()
            await reloadedRussianRootBreadcrumb.click()
            const reloadedRussianTargetCell = getHierarchicalCellButton(reloadedRussianMatrixWorkspace, descendantTitle, '1/1')
            await expect(reloadedRussianTargetCell).toBeVisible({ timeout: 30_000 })
            await reloadedRussianTargetCell.click()
            const reloadedRussianInsertedRoot = getHierarchicalCellButton(reloadedRussianMatrixWorkspace, branchTitle, '1/1/1')
            await expect(reloadedRussianInsertedRoot).toHaveCount(1)
            await expect(
                reloadedRussianInsertedRoot,
                'The Russian insertion remains visible after reloading and reopening its parent cell'
            ).toBeVisible({ timeout: 30_000 })
            await reloadedRussianInsertedRoot.click()
            await expect(getHierarchicalCellButton(reloadedRussianMatrixWorkspace, descendantTitle, '1/1/1/1')).toBeVisible()
            await expectNoVisibleRuntimeIdentifiers(page, 'Persisted Russian nested template insertion')
            await expectNoPageHorizontalOverflow(page, 'Persisted Russian nested template insertion')
            const reloadedRussianInsertedDescendant = getHierarchicalCellButton(reloadedRussianMatrixWorkspace, descendantTitle, '1/1/1/1')
            for (const viewport of [
                { name: 'wide-desktop', ...WIDE_DESKTOP_VIEWPORT },
                { name: 'tablet', width: 768, height: 1024 },
                { name: 'mobile', width: 390, height: 844 }
            ]) {
                await page.setViewportSize(viewport)
                await expect(reloadedRussianInsertedRoot, `Russian inserted root remains visible at ${viewport.width}px`).toBeVisible()
                await expect(
                    reloadedRussianInsertedDescendant,
                    `Russian inserted descendant remains visible at ${viewport.width}px`
                ).toBeVisible()
                await expectNoPageHorizontalOverflow(page, `Russian nested template insertion at ${viewport.width}px`)
                if (viewport.name === 'mobile') {
                    await scrollMatrixCellIntoViewWithKeyboard(
                        reloadedRussianMatrixWorkspace,
                        reloadedRussianInsertedDescendant,
                        'Russian mobile nested-template Matrix'
                    )
                }
                await attachViewportEvidence(page, testInfo, `interpretation-network-russian-template-inserted-${viewport.name}`, viewport)
            }
        } finally {
            await disposeApiContext(api)
        }
    })
})
