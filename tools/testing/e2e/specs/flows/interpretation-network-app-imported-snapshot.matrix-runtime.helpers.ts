// Focused helpers for the imported Interpretation Network snapshot flow.

import { expect } from '../../fixtures/test'

import type { Locator, Page } from '@playwright/test'

import { expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'

import {
    expectIndependentAxesMatrixTableRuntime,
    expectMatrixTableDefaultRuntime,
    getMatrixTable
} from '../../support/interpretationNetworkMatrixTableRuntime'

import { createdStructureName, firstChildCellTitle, escapeRegExp } from './interpretation-network-app-imported-snapshot.shared.helpers'

import {
    moveSelectedMatrixTableCellToEmptySlotByKeyboard,
    waitForMatrixMoveResponse,
    waitForMatrixCellCreateResponse
} from './interpretation-network-app-imported-snapshot.matrix.helpers'

import { saveApplicationMatrixViewSettings } from './interpretation-network-app-imported-snapshot.settings.helpers'

const structureRuntimePath = (applicationId: string, structureSectionId: string, structureId: string): string =>
    `/a/${applicationId}/${structureSectionId}/${structureId}?targetKind=object&entityTypeCodename=Structure`

export const selectHierarchicalRootIfPrompted = async (page: Page, rootName = 'Universe'): Promise<void> => {
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })

    const rootButton = matrixPane.getByRole('button', {
        name: new RegExp(`^(?:\\d+(?:/\\d+)?,\\s*)?${escapeRegExp(rootName)}$`)
    })
    await expect(getMatrixTable(page).or(rootButton).first()).toBeVisible({ timeout: 30_000 })

    if ((await rootButton.count()) > 0 && (await rootButton.first().isVisible())) {
        await rootButton.first().click()
    }
}

export const activateHierarchicalBreadcrumb = async (page: Page, name: string): Promise<void> => {
    const breadcrumb = page
        .getByTestId('interpretation-network-hierarchical-table')
        .getByRole('button', { name: new RegExp(`^(?:\\d+(?:/\\d+)?,\\s*)?${escapeRegExp(name)}$`) })
    await expect(breadcrumb).toBeVisible({ timeout: 30_000 })
    await breadcrumb.first().focus()
    await expect(breadcrumb.first()).toBeFocused()
    await page.keyboard.press('Enter')
}

export const expectHorizontalRowsOnlyMatrixRuntime = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await page.goto(structureRuntimePath(applicationId, structureSectionId, structureId))
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })
    await expect(matrixPane.getByRole('button', { name: 'Horizontal rows' })).toHaveCount(0)
    await expect(matrixPane.getByRole('button', { name: 'Table view' })).toHaveCount(0)
    await expect(matrixPane.getByRole('button', { name: 'Vertical tree' })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'Universe' }).first()).toBeVisible()
    await expect(page.getByTestId('interpretation-network-matrix-row')).toHaveCount(1)
    await expect(getMatrixTable(page)).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network Horizontal rows only runtime')
}

export const expectIndependentRowsTableDrop = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Independent rows',
        table: true,
        horizontalRows: true,
        verticalTree: false,
        defaultView: 'Table view',
        allowNewAxesInCellDialog: true
    })
    await page.goto(structureRuntimePath(applicationId, structureSectionId, structureId))
    await expectIndependentAxesMatrixTableRuntime(page, { locale: 'en', verticalTreeAvailable: false })

    const toolbar = page.getByTestId('interpretation-network-matrix-toolbar')
    await expect(toolbar.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true')
    const sourceCell = getMatrixTable(page).getByTestId('interpretation-network-table-cell').filter({ hasText: firstChildCellTitle })
    await expect(sourceCell).toBeVisible()
    await expect(getMatrixTable(page).getByRole('button', { name: 'Drag cell' }).first()).toBeEnabled()
    await expect(getMatrixTable(page).getByRole('button', { name: 'Add row' })).toBeEnabled()
    await getMatrixTable(page).getByRole('button', { name: 'Add row' }).click()
    const rowDialog = page.getByRole('dialog', { name: 'Add row' })
    await expect(rowDialog).toBeVisible()
    await rowDialog.getByRole('textbox', { name: 'Row name' }).fill('E2E independent target row')
    const addRowRequest = waitForMatrixCellCreateResponse(page, applicationId, 30_000)
    await rowDialog.getByRole('button', { name: 'Create' }).click()
    expect((await addRowRequest).ok()).toBe(true)
    await expect(rowDialog).toHaveCount(0)
    await expect(getMatrixTable(page).getByRole('rowheader', { name: 'E2E independent target row' })).toBeVisible({
        timeout: 30_000
    })

    const independentTarget = getMatrixTable(page)
        .getByTestId('interpretation-network-table-empty-cell')
        .filter({
            has: page.getByRole('button', { name: 'Move selected cell here: E2E independent target row, E2E primary column' })
        })
        .first()
    await expect(independentTarget).toBeVisible()
    await expect(independentTarget).toHaveAttribute('data-empty-drop-enabled', 'true')
    const moveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await moveSelectedMatrixTableCellToEmptySlotByKeyboard(sourceCell, independentTarget)
    const moveResponse = await moveRequest
    expect(moveResponse.ok()).toBe(true)
    const movePayload = moveResponse.request().postDataJSON() as {
        updates?: Array<{
            data?: Record<string, unknown>
            placement?: { rowKey?: string; colKey?: string; sortOrder?: number }
        }>
    }
    expect(movePayload.updates?.[0]?.placement).toEqual(
        expect.objectContaining({
            rowKey: expect.any(String),
            colKey: expect.any(String),
            sortOrder: expect.any(Number)
        })
    )
    expect(movePayload.updates?.[0]?.data ?? {}).not.toHaveProperty('RowKey')
    expect(movePayload.updates?.[0]?.data ?? {}).not.toHaveProperty('ColKey')
    expect(movePayload.updates?.[0]?.data ?? {}).not.toHaveProperty('_tp_sort_order')
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Hierarchical cells',
        table: true,
        horizontalRows: true,
        verticalTree: true,
        defaultView: 'Table view',
        tableProjection: 'Hierarchy path',
        breadcrumbDepth: { mode: 'Full path' },
        toolbarLayout: 'Horizontal'
    })
    await page.goto(structureRuntimePath(applicationId, structureSectionId, structureId))
    await selectHierarchicalRootIfPrompted(page)
    await expectMatrixTableDefaultRuntime(page, {
        locale: 'en',
        structureName: createdStructureName,
        expectedChildLabels: [firstChildCellTitle]
    })
}

export const expectHierarchicalTableHasNoFreeSlotDrop = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Hierarchical cells',
        table: true,
        horizontalRows: true,
        verticalTree: true,
        defaultView: 'Table view',
        tableProjection: 'Hierarchy path'
    })
    await page.goto(structureRuntimePath(applicationId, structureSectionId, structureId))
    await expectMatrixTableDefaultRuntime(page, {
        locale: 'en',
        structureName: createdStructureName,
        expectedChildLabels: [firstChildCellTitle]
    })

    const table = getMatrixTable(page)
    const sourceCell = table.getByTestId('interpretation-network-table-cell').filter({ hasText: firstChildCellTitle }).first()
    await sourceCell.scrollIntoViewIfNeeded()
    await expect(sourceCell).toBeVisible({ timeout: 30_000 })
    await expect(table.getByRole('button', { name: 'Drag cell' }).first()).toBeEnabled()
    await expect(table.getByTestId('interpretation-network-table-empty-cell')).toHaveCount(0)
    await expect(table.getByTestId('interpretation-network-table-cell').filter({ hasText: firstChildCellTitle })).toBeVisible({
        timeout: 30_000
    })
}

export const expectVerticalToolbarAndFiniteBreadcrumbs = async (
    page: Page,
    applicationId: string,
    structureSectionId: string,
    structureId: string
): Promise<void> => {
    await saveApplicationMatrixViewSettings(page, applicationId, {
        matrixMode: 'Hierarchical cells',
        table: true,
        horizontalRows: true,
        verticalTree: true,
        defaultView: 'Table view',
        tableProjection: 'Hierarchy path',
        breadcrumbDepth: { mode: 'Last levels', count: '1' },
        toolbarLayout: 'Vertical'
    })
    await page.goto(structureRuntimePath(applicationId, structureSectionId, structureId))
    await expectMatrixTableDefaultRuntime(page, {
        locale: 'en',
        structureName: createdStructureName,
        expectedChildLabels: [firstChildCellTitle]
    })

    const toolbar = page.getByTestId('interpretation-network-matrix-toolbar')
    await expect(toolbar).toBeVisible()
    await expect
        .poll(() => toolbar.evaluate((element) => window.getComputedStyle(element).flexDirection), {
            message: 'vertical Matrix toolbar must use column direction'
        })
        .toBe('column')

    await expect(
        getMatrixTable(page).getByTestId('interpretation-network-table-cell').filter({ hasText: firstChildCellTitle })
    ).toBeVisible({
        timeout: 30_000
    })
}

export async function fillMaterialDialogFields(dialog: Locator, values: { title: string; description: string }) {
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(values.title)
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(values.description)
}

export async function fillMaterialBlockEditor(page: Page, surface: Locator, value: string) {
    const editorRoot = surface.getByTestId('editorjs-block-editor')
    await expect(editorRoot).toBeVisible({ timeout: 20_000 })
    await expect(surface.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
    const previousCommittedSequence = await editorRoot.getAttribute('data-editorjs-committed-sequence')
    await editorRoot.click({ position: { x: 24, y: 24 } })

    const editableBlock = editorRoot.locator('[contenteditable="true"]').first()
    await expect(editableBlock).toBeVisible({ timeout: 20_000 })
    await editableBlock.click()
    await editableBlock.press('ControlOrMeta+A')
    await editableBlock.pressSequentially(value)
    await expect(editorRoot.getByText(value)).toBeVisible()
    await expect(editableBlock).toContainText(value)
    await expect
        .poll(() => editorRoot.getAttribute('data-editorjs-committed-sequence'), {
            message: 'Editor.js material content must commit before saving',
            timeout: 20_000
        })
        .not.toBe(previousCommittedSequence)
}
