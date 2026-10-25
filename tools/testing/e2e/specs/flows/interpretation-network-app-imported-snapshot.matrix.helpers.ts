// Focused helpers for the imported Interpretation Network snapshot flow.

import { expect } from '../../fixtures/test'

import type { Locator, Page } from '@playwright/test'

import { waitForSettledMutationResponse } from '../../support/browser/network'

import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, expectSemanticFieldControls } from '../../support/browser/runtimeUx'

import { uuidV7Pattern } from './interpretation-network-app-imported-snapshot.shared.helpers'

export const fillOptionalStructureDialogFields = async (dialog: Locator, values: { name: string; description: string }): Promise<void> => {
    const nameField = dialog.getByRole('textbox', { name: 'Name', exact: true })
    if ((await nameField.count()) > 0) {
        await nameField.first().fill(values.name)
    }

    const descriptionField = dialog.getByRole('textbox', { name: 'Description', exact: true })
    if ((await descriptionField.count()) > 0) {
        await descriptionField.first().fill(values.description)
    }
}

export const readMatrixRowCellTexts = async (page: Page): Promise<string[][]> =>
    page
        .getByTestId('interpretation-network-matrix-row')
        .evaluateAll((rows) =>
            rows.map((row) =>
                Array.from(row.querySelectorAll('[data-testid="interpretation-network-cell"]')).map((cell) =>
                    (cell as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
                )
            )
        )

export const dragMatrixCellByPointer = async (
    source: Locator,
    target: Locator,
    placement: 'before' | 'child' | 'after',
    options: { targetIsHigherLevel?: boolean; axis?: 'horizontal' | 'vertical' } = {}
): Promise<void> => {
    const sourceHandle = source.getByLabel('Drag cell')
    await expect(sourceHandle).toBeVisible()
    const sourceCellBox = await source.boundingBox()
    const sourceBox = await sourceHandle.boundingBox()
    const targetBox = await target.boundingBox()
    expect(sourceCellBox, 'matrix drag source cell box').toBeTruthy()
    expect(sourceBox, 'matrix drag source handle box').toBeTruthy()
    expect(targetBox, 'matrix drag target cell box').toBeTruthy()
    if (!sourceCellBox || !sourceBox || !targetBox) return
    const targetCellId = await target.getAttribute('data-cell-id')
    expect(targetCellId, 'matrix drag target stable cell id').toBeTruthy()
    if (!targetCellId) return

    const sourceStartX = sourceBox.x + sourceBox.width / 2
    const sourceStartY = sourceBox.y + sourceBox.height / 2
    const sourceHandleToCellCenterX = sourceCellBox.x + sourceCellBox.width / 2 - sourceStartX
    const sourceHandleToCellCenterY = sourceCellBox.y + sourceCellBox.height / 2 - sourceStartY
    await sourceHandle.hover()
    await source.page().mouse.move(sourceStartX, sourceStartY)
    await source.page().mouse.down()
    const sourceApproachesFromRight = sourceCellBox.x >= targetBox.x
    const moveSourceCenterTo = async (sourceCenterX: number, sourceCenterY = targetBox.y + targetBox.height / 2) => {
        await source.page().mouse.move(sourceCenterX - sourceHandleToCellCenterX, sourceCenterY - sourceHandleToCellCenterY, { steps: 12 })
    }
    const currentTarget = source.page().locator(`[data-testid="interpretation-network-cell"][data-cell-id="${targetCellId}"]`)

    if (options.targetIsHigherLevel) {
        const targetProgress = placement === 'before' ? 0.125 : placement === 'after' ? 0.875 : 0.5
        await moveSourceCenterTo(targetBox.x + targetBox.width * targetProgress)
        await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
    } else if (placement === 'child' && options.axis === 'vertical') {
        for (const targetProgress of [0.5, 0.55, 0.45, 0.6, 0.4]) {
            await moveSourceCenterTo(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height * targetProgress)
            await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
            const matchedChildPlacement = await expect
                .poll(async () => currentTarget.first().getAttribute('data-drop-placement'), {
                    timeout: 1_500
                })
                .toBe('child')
                .then(
                    () => true,
                    () => false
                )
            if (matchedChildPlacement) break
        }
    } else if (placement === 'child') {
        const overlapBaseWidth = Math.min(sourceCellBox.width, targetBox.width)
        for (const overlapRatio of [0.45, 0.35, 0.25, 0.15]) {
            const childOverlapWidth = overlapBaseWidth * overlapRatio
            const candidateCenters = [
                targetBox.x + childOverlapWidth - sourceCellBox.width / 2,
                targetBox.x + targetBox.width - childOverlapWidth + sourceCellBox.width / 2
            ]
            let matchedChildPlacement = false
            for (const sourceCenterX of candidateCenters) {
                await moveSourceCenterTo(sourceCenterX, targetBox.y + targetBox.height * 0.72)
                await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
                matchedChildPlacement = await expect
                    .poll(async () => currentTarget.first().getAttribute('data-drop-placement'), {
                        timeout: 1_500
                    })
                    .toBe('child')
                    .then(
                        () => true,
                        () => false
                    )
                if (matchedChildPlacement) break
            }
            if (matchedChildPlacement) break
        }
    } else {
        const sourceCenterX =
            placement === 'before'
                ? sourceApproachesFromRight
                    ? targetBox.x + targetBox.width * 0.25 + sourceCellBox.width / 2
                    : targetBox.x + targetBox.width * 0.25
                : sourceApproachesFromRight
                ? targetBox.x + targetBox.width * 0.75
                : targetBox.x + targetBox.width * 0.75 - sourceCellBox.width / 2
        await moveSourceCenterTo(sourceCenterX)
        await expect(source.page().getByTestId('interpretation-network-cell-drag-overlay')).toBeVisible({ timeout: 10_000 })
    }
    await expect
        .poll(async () => currentTarget.first().getAttribute('data-drop-placement'), {
            message: `matrix drop placement should be ${placement}`
        })
        .toBe(placement)
    await expect(currentTarget.first().getByTestId('interpretation-network-drop-indicator')).toBeVisible({ timeout: 10_000 })
    if (placement === 'child' || placement === 'before' || placement === 'after') {
        const placeholder = source.page().getByTestId('interpretation-network-drop-placeholder')
        await expect(placeholder).toBeVisible({ timeout: 10_000 })
        await expect(placeholder).toHaveAttribute('data-drop-placement', placement)
    }
    await source.page().mouse.up()
}

export const moveSelectedMatrixTableCellToEmptySlotByKeyboard = async (source: Locator, target: Locator): Promise<void> => {
    await source.click()
    const targetAccessibleName = await target.getAttribute('aria-label')
    expect(targetAccessibleName, 'Matrix Table empty drop target must be user-labeled').toMatch(/^Empty intersection:/)
    const moveButton = target.getByRole('button', { name: /^Move selected cell here:/ })
    await moveButton.focus()
    await expect(moveButton).toBeFocused()
    await source.page().keyboard.press('Enter')
}

export const waitForMatrixMoveResponse = (page: Page, applicationId: string, timeout = 15_000) =>
    waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells/move`,
        { label: 'Moving matrix cell by drag and drop', timeout }
    )

export const waitForMatrixCellCreateResponse = (page: Page, applicationId: string, timeout = 15_000) =>
    waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells`,
        { label: 'Creating an Interpretation Network Matrix cell', timeout }
    )

export const expectRuHiddenPlacementChildCellCreate = async (page: Page, applicationId: string): Promise<void> => {
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })

    const rootButton = matrixPane.getByRole('button', { name: /Universe|Вселенная/ }).first()
    await expect(rootButton).toBeVisible({ timeout: 30_000 })
    const rootContainer = rootButton.locator('xpath=ancestor::*[@data-cell-id][1]')
    await expect(rootContainer).toHaveAttribute('data-cell-id', /.+/)
    const rootCellId = await rootContainer.getAttribute('data-cell-id')
    expect(rootCellId, 'RU root cell must expose its stable CellId for child placement assertions').toMatch(uuidV7Pattern)
    await rootButton.click()
    await expect(rootButton).toHaveAttribute('aria-pressed', 'true')

    const addButton = matrixPane.getByRole('button', { name: 'Добавить', exact: true }).first()
    await expect(addButton).toBeEnabled({ timeout: 30_000 })
    await addButton.click()

    const dialog = page.getByRole('dialog', { name: 'Добавить ячейку' })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expect(dialog.getByText('Размещение')).toHaveCount(0)
    await expect(dialog.getByRole('radio', { name: 'Новая строка' })).toHaveCount(0)
    await expect(dialog.getByRole('radio', { name: 'Новая колонка' })).toHaveCount(0)
    await expect(dialog.getByRole('textbox', { name: 'Название строки' })).toHaveCount(0)
    await expect(dialog.getByRole('textbox', { name: 'Название колонки' })).toHaveCount(0)
    await expectSemanticFieldControls(dialog, { longTextLabels: ['Описание'] })

    await dialog.getByRole('textbox', { name: 'Название', exact: true }).fill('Дочерняя ячейка E2E')
    await dialog.getByRole('textbox', { name: 'Описание' }).fill('Создано из русской формы без полей размещения.')
    const createRequest = waitForMatrixCellCreateResponse(page, applicationId, 30_000)
    await dialog.getByRole('button', { name: 'Создать' }).click()
    const createResponse = await createRequest
    expect(createResponse.status()).toBe(201)
    const createPayload = createResponse.request().postDataJSON() as {
        data?: Record<string, unknown>
        placement?: { parentCellId?: string | null; sortOrder?: number }
    }
    expect(createPayload.data).not.toHaveProperty('CellId')
    expect(createPayload.data).not.toHaveProperty('ParentCellId')
    expect(createPayload.data).not.toHaveProperty('RowKey')
    expect(createPayload.data).not.toHaveProperty('ColKey')
    expect(createPayload.data).not.toHaveProperty('MaterialRef')
    expect(createPayload.data).not.toHaveProperty('_tp_sort_order')
    expect(Object.keys(createPayload.data ?? {}).some((key) => /material/i.test(key))).toBe(false)
    expect(createPayload.placement?.parentCellId).toBe(rootCellId)
    expect(createPayload.placement?.sortOrder).toBeGreaterThanOrEqual(0)
    const createResult = (await createResponse.json()) as { id?: string; status?: string; item?: unknown }
    expect(createResult.id).toMatch(uuidV7Pattern)
    expect(createResult.status).toBe('created')
    expect(createResult.item).toBeTruthy()

    await expect(dialog).toHaveCount(0)
    await expect(page.getByText('Данные или расположение ячейки некорректны')).toHaveCount(0)
    await expect(page.getByText('INTERPRETATION_NETWORK_INVALID_CELL')).toHaveCount(0)
    await expect(matrixPane.getByRole('button', { name: /^(?:\d+\/\d+,\s*)?Дочерняя ячейка E2E$/ })).toBeVisible({
        timeout: 30_000
    })
    await expectNoTechnicalLeakage(page.getByRole('main'), {
        label: 'RU imported snapshot child-cell create',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true,
        forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i]
    })
    await expectNoPageHorizontalOverflow(page, 'RU Interpretation Network child-cell create')
}

export const expectMatrixCellMoveNotSwapWithNewAxesCellDialog = async (page: Page, applicationId: string): Promise<void> => {
    const horizontalRowsButton = page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', {
        name: 'Horizontal rows'
    })
    await expect(horizontalRowsButton).toBeVisible({ timeout: 30_000 })
    if ((await horizontalRowsButton.getAttribute('aria-pressed')) !== 'true') {
        await horizontalRowsButton.click()
        await expect(horizontalRowsButton).toHaveAttribute('aria-pressed', 'true')
    }

    const rootCell = page.getByTestId('interpretation-network-cell').first()
    await expect(rootCell).toHaveAttribute('data-cell-id', /.+/)
    const rootCellId = await rootCell.getAttribute('data-cell-id')
    expect(rootCellId, 'root Universe cell must expose its stable CellId for hierarchy assertions').toBeTruthy()
    await rootCell.click()
    await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled({ timeout: 30_000 })

    await page.getByRole('button', { name: 'Add' }).click()
    const firstChildDialog = page.getByRole('dialog', { name: 'Add cell' })
    await expect(firstChildDialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(firstChildDialog, { longTextLabels: ['Description'] })
    await expect(
        firstChildDialog.getByRole('radio', { name: 'New row' }),
        'This move oracle intentionally runs after opt-in inline row creation is enabled'
    ).toBeVisible()
    await expect(firstChildDialog.getByRole('radio', { name: 'New row' })).toBeChecked()
    await expect(firstChildDialog.getByRole('radio', { name: 'New column' })).toBeChecked()
    await firstChildDialog.getByRole('textbox', { name: 'New row name' }).fill('E2E concepts row')
    await firstChildDialog.getByRole('textbox', { name: 'New column name' }).fill('E2E primary column')
    await firstChildDialog.getByRole('textbox', { name: 'Title' }).fill('E2E first child cell')
    await firstChildDialog.getByRole('textbox', { name: 'Description' }).fill('E2E first child description')
    const addFirstChildRequest = waitForMatrixCellCreateResponse(page, applicationId, 30_000)
    await firstChildDialog.getByRole('button', { name: 'Create' }).click()
    const addFirstChildResponse = await addFirstChildRequest
    expect(addFirstChildResponse.ok()).toBe(true)
    const addFirstChildPayload = addFirstChildResponse.request().postDataJSON() as {
        data?: Record<string, unknown>
        placement?: { parentCellId?: string | null; rowKey?: string; colKey?: string; sortOrder?: number }
    }
    expect(addFirstChildPayload.data).not.toHaveProperty('CellId')
    expect(addFirstChildPayload.data).not.toHaveProperty('ParentCellId')
    expect(addFirstChildPayload.data).not.toHaveProperty('RowKey')
    expect(addFirstChildPayload.data).not.toHaveProperty('ColKey')
    expect(addFirstChildPayload.placement?.parentCellId).toBe(rootCellId)
    expect(addFirstChildPayload.placement?.sortOrder).toBeGreaterThanOrEqual(0)
    const addFirstChildResult = (await addFirstChildResponse.json()) as { id?: string; status?: string; item?: unknown }
    expect(addFirstChildResult.id).toMatch(/^[0-9a-f-]{36}$/i)
    expect(addFirstChildResult.status).toBe('created')
    expect(addFirstChildResult.item).toBeTruthy()
    await expect(firstChildDialog).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' })).toBeVisible({
        timeout: 30_000
    })

    await rootCell.click()
    await page.getByRole('button', { name: 'Add' }).click()
    const secondChildDialog = page.getByRole('dialog', { name: 'Add cell' })
    await expect(secondChildDialog).toBeVisible({ timeout: 30_000 })
    await secondChildDialog.getByRole('radio', { name: 'Existing row' }).check()
    await expect(secondChildDialog.getByRole('radio', { name: 'Existing row' })).toBeChecked()
    const secondChildRowSelect = secondChildDialog.getByRole('combobox', { name: 'Select row' })
    await secondChildRowSelect.fill('E2E concepts row')
    await page.getByRole('option', { name: 'E2E concepts row' }).click()
    await expect(secondChildRowSelect).toHaveValue('E2E concepts row')
    await expect(secondChildDialog.getByRole('radio', { name: 'New column' })).toBeChecked()
    await secondChildDialog.getByRole('textbox', { name: 'New column name' }).fill('E2E secondary column')
    await secondChildDialog.getByRole('textbox', { name: 'Title' }).fill('E2E second child cell')
    await secondChildDialog.getByRole('textbox', { name: 'Description' }).fill('E2E second child description')
    const addSecondChildRequest = waitForMatrixCellCreateResponse(page, applicationId, 30_000)
    await secondChildDialog.getByRole('button', { name: 'Create' }).click()
    const addSecondChildResponse = await addSecondChildRequest
    expect(addSecondChildResponse.ok()).toBe(true)
    const addSecondChildPayload = addSecondChildResponse.request().postDataJSON() as {
        data?: Record<string, unknown>
        placement?: { parentCellId?: string | null; rowKey?: string; colKey?: string; sortOrder?: number }
    }
    expect(addSecondChildPayload.data).not.toHaveProperty('CellId')
    expect(addSecondChildPayload.data).not.toHaveProperty('ParentCellId')
    expect(addSecondChildPayload.data).not.toHaveProperty('RowKey')
    expect(addSecondChildPayload.data).not.toHaveProperty('ColKey')
    expect(addSecondChildPayload.placement?.parentCellId).toBe(rootCellId)
    await expect(secondChildDialog).toHaveCount(0)
    await expect(page.getByRole('main')).not.toContainText(/New row|New cell/)
    await expect(page.getByTestId('interpretation-network-matrix-row')).toHaveCount(2, { timeout: 30_000 })

    const beforeRows = await readMatrixRowCellTexts(page)
    expect(beforeRows).toEqual([
        [expect.stringContaining('Universe')],
        [expect.stringContaining('E2E first child cell'), expect.stringContaining('E2E second child cell')]
    ])

    const sourceCell = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E second child cell' }).first()
    const targetCell = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' }).first()
    await expect(sourceCell).toHaveAttribute('data-cell-id', /.+/)
    await expect(targetCell).toHaveAttribute('data-cell-id', /.+/)
    const moveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await dragMatrixCellByPointer(sourceCell, targetCell, 'before')
    const moveResponse = await moveRequest
    expect(moveResponse.ok()).toBe(true)
    const movePayload = moveResponse.request().postDataJSON() as {
        updates?: Array<{
            cellId?: string
            expectedVersion?: number
            placement?: { parentCellId?: string | null; sortOrder?: number }
            data?: Record<string, unknown>
        }>
    }
    expect(
        Array.isArray(movePayload.updates) ? movePayload.updates.length : 0,
        'drag/drop move must update moved cell without swapping'
    ).toBeGreaterThanOrEqual(1)
    for (const update of movePayload.updates ?? []) {
        expect(update.cellId, 'every drag/drop update uses the semantic cell UUID v7').toMatch(uuidV7Pattern)
        expect(update.expectedVersion, 'every drag/drop update carries its read version').toEqual(expect.any(Number))
        expect(update.expectedVersion).toBeGreaterThan(0)
    }
    expect(movePayload.updates?.[0]?.data ?? {}, 'Matrix move command must not send server-owned parent data').not.toHaveProperty(
        'ParentCellId'
    )
    expect(movePayload.updates?.[0]?.data ?? {}, 'Matrix move command must not send server-owned order data').not.toHaveProperty(
        '_tp_sort_order'
    )
    expect(movePayload.updates?.[0]?.placement, 'dragged sibling reorder must not reparent the moved cell').not.toHaveProperty(
        'parentCellId'
    )
    expect(movePayload.updates?.[0]?.placement?.sortOrder, 'dragged sibling reorder must persist the new sibling order').toBe(0)

    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            [expect.stringContaining('Universe')],
            [expect.stringContaining('E2E second child cell'), expect.stringContaining('E2E first child cell')]
        ])

    const keyboardMoveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    const firstChildActions = page.getByRole('button', { name: 'Cell actions: E2E first child cell' })
    await firstChildActions.focus()
    await page.keyboard.press('Enter')
    const moveUpMenuItem = page.getByRole('menuitem', { name: 'Up' })
    await expect(moveUpMenuItem).toBeVisible()
    await moveUpMenuItem.focus()
    await page.keyboard.press('Enter')
    const keyboardMoveResponse = await keyboardMoveRequest
    expect(keyboardMoveResponse.ok()).toBe(true)
    const keyboardMovePayload = keyboardMoveResponse.request().postDataJSON() as {
        updates?: Array<{
            cellId?: string
            expectedVersion?: number
            placement?: { parentCellId?: string | null }
            data?: Record<string, unknown>
        }>
    }
    for (const update of keyboardMovePayload.updates ?? []) {
        expect(update.cellId, 'every keyboard move update uses the semantic cell UUID v7').toMatch(uuidV7Pattern)
        expect(update.expectedVersion, 'every keyboard move update carries its read version').toEqual(expect.any(Number))
        expect(update.expectedVersion).toBeGreaterThan(0)
    }
    expect(keyboardMovePayload.updates?.[0]?.data ?? {}, 'Matrix move command must not send server-owned parent data').not.toHaveProperty(
        'ParentCellId'
    )
    expect(keyboardMovePayload.updates?.[0]?.placement, 'menu move must not reparent the moved cell').not.toHaveProperty('parentCellId')

    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            [expect.stringContaining('Universe')],
            [expect.stringContaining('E2E first child cell'), expect.stringContaining('E2E second child cell')]
        ])

    await page.getByRole('button', { name: 'Vertical tree' }).click()
    await expect(page.getByRole('button', { name: 'Vertical tree' })).toHaveAttribute('aria-pressed', 'true')
    const childDropSource = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E second child cell' }).first()
    const childDropTarget = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' }).first()
    const firstChildId = await childDropTarget.getAttribute('data-cell-id')
    expect(firstChildId, 'child drop target must expose its stable CellId').toBeTruthy()
    const childMoveRequest = waitForMatrixMoveResponse(page, applicationId, 30_000)
    await dragMatrixCellByPointer(childDropSource, childDropTarget, 'child', { axis: 'vertical' })
    const childMoveResponse = await childMoveRequest
    expect(childMoveResponse.ok()).toBe(true)
    const childMovePayload = childMoveResponse.request().postDataJSON() as {
        updates?: Array<{
            cellId?: string
            expectedVersion?: number
            placement?: { parentCellId?: string | null; sortOrder?: number }
            data?: Record<string, unknown>
        }>
    }
    for (const update of childMovePayload.updates ?? []) {
        expect(update.cellId, 'every reparent move update uses the semantic cell UUID v7').toMatch(uuidV7Pattern)
        expect(update.expectedVersion, 'every reparent move update carries its read version').toEqual(expect.any(Number))
        expect(update.expectedVersion).toBeGreaterThan(0)
    }
    expect(childMovePayload.updates?.[0]?.data ?? {}, 'Matrix move command must not send server-owned parent data').not.toHaveProperty(
        'ParentCellId'
    )
    expect(childMovePayload.updates?.[0]?.data ?? {}, 'Matrix move command must not send server-owned order data').not.toHaveProperty(
        '_tp_sort_order'
    )
    expect(childMovePayload.updates?.[0]?.placement?.parentCellId, 'center drop must reparent the moved cell').toBe(firstChildId)
    expect(childMovePayload.updates?.[0]?.placement?.sortOrder, 'first child under a new parent must start at sibling order zero').toBe(0)

    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            expect.arrayContaining([expect.stringContaining('Universe')]),
            expect.arrayContaining([expect.stringContaining('E2E first child cell')]),
            expect.arrayContaining([expect.stringContaining('E2E second child cell')])
        ])

    await page.reload()
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', { name: 'Horizontal rows' }).click()
    await page.getByTestId('interpretation-network-cell').filter({ hasText: 'Universe' }).first().click()
    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            expect.arrayContaining([expect.stringContaining('Universe')]),
            expect.arrayContaining([expect.stringContaining('E2E first child cell')])
        ])
    await page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E first child cell' }).first().click()
    await expect
        .poll(() => readMatrixRowCellTexts(page), { timeout: 30_000 })
        .toEqual([
            expect.arrayContaining([expect.stringContaining('Universe')]),
            expect.arrayContaining([expect.stringContaining('E2E first child cell')]),
            expect.arrayContaining([expect.stringContaining('E2E second child cell')])
        ])

    const editedCell = page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E second child cell' }).first()
    const editedCellId = await editedCell.getAttribute('data-cell-id')
    expect(editedCellId, 'edited Matrix cell must expose its stable CellId').toBeTruthy()
    await page.getByRole('button', { name: 'Cell actions: E2E second child cell' }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const editCellDialog = page.getByRole('dialog', { name: 'Edit cell' })
    await expect(editCellDialog).toBeVisible({ timeout: 30_000 })
    await expectSemanticFieldControls(editCellDialog, { longTextLabels: ['Description'] })
    await editCellDialog.getByRole('textbox', { name: 'Title' }).fill('E2E edited child cell')
    await editCellDialog.getByRole('textbox', { name: 'Description' }).fill('E2E edited child description')
    const editCellRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'PATCH' &&
            new URL(response.url()).pathname ===
                `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells/${editedCellId}`,
        { label: 'Editing an Interpretation Network Matrix cell' }
    )
    await editCellDialog.getByRole('button', { name: 'Save' }).click()
    expect((await editCellRequest).ok()).toBe(true)
    await expect(editCellDialog).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E edited child cell' })).toBeVisible({
        timeout: 30_000
    })

    await page.getByRole('button', { name: 'Cell actions: E2E edited child cell' }).click()
    await page.getByRole('menuitem', { name: 'Delete' }).click()
    const deleteCellDialog = page.getByRole('dialog', { name: 'Delete cell?' })
    await expect(deleteCellDialog).toBeVisible()
    const deleteCellRequest = waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'DELETE' &&
            new URL(response.url()).pathname ===
                `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells/${editedCellId}`,
        { label: 'Deleting an Interpretation Network Matrix cell' }
    )
    await deleteCellDialog.getByRole('button', { name: 'Delete' }).click()
    expect((await deleteCellRequest).ok()).toBe(true)
    await expect(deleteCellDialog).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'E2E edited child cell' })).toHaveCount(0)
}
