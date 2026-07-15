import { expect, type Locator, type Page } from '@playwright/test'

import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'

export type InterpretationNetworkMatrixTableLocale = 'en' | 'ru' | 'any'

export const getMatrixTable = (page: Page): Locator => page.getByTestId('interpretation-network-matrix-table')

const getHierarchicalTable = (page: Page): Locator => page.getByTestId('interpretation-network-hierarchical-table')
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const expectMatrixTableHorizontalScrollConstrained = async (page: Page, label: string): Promise<void> => {
    const metrics = await getMatrixTable(page).evaluate((node) => {
        const root = node as HTMLElement
        const rootRect = root.getBoundingClientRect()
        const viewportWidth = document.documentElement.clientWidth
        const pageOverflowPx = Math.max(0, document.documentElement.scrollWidth - viewportWidth)
        const table = root.querySelector('table') as HTMLElement | null

        return {
            visible: rootRect.width > 0 && rootRect.height > 0,
            pageOverflowPx,
            rootLeft: rootRect.left,
            rootRight: rootRect.right,
            viewportWidth,
            internalOverflowPx: Math.max(0, root.scrollWidth - root.clientWidth),
            tableClientWidth: root.clientWidth,
            tableScrollWidth: root.scrollWidth,
            semanticTableVisible: Boolean(table && table.getBoundingClientRect().width > 0 && table.getBoundingClientRect().height > 0)
        }
    })

    expect(metrics.visible, `${label} matrix table scroll region must be visible`).toBe(true)
    expect(metrics.semanticTableVisible, `${label} must contain a visible semantic table`).toBe(true)
    expect(metrics.rootLeft, `${label} matrix table must start inside the viewport`).toBeGreaterThanOrEqual(-1)
    expect(metrics.rootRight, `${label} matrix table must fit inside the viewport`).toBeLessThanOrEqual(metrics.viewportWidth + 1)

    if (metrics.internalOverflowPx > 1) {
        expect(
            metrics.pageOverflowPx,
            `${label} may scroll internally (${metrics.tableClientWidth}/${metrics.tableScrollWidth}) but must not widen the page`
        ).toBeLessThanOrEqual(1)
    }
}

export const expectMatrixTableDefaultRuntime = async (
    page: Page,
    options: {
        locale: InterpretationNetworkMatrixTableLocale
        structureName: string
        rootTitle?: string | RegExp
        focusedTitle?: string | RegExp
        verticalTreeAvailable?: boolean
        assertAxisDialogs?: boolean
        assertDefaultCellDialog?: boolean
        expectedChildLabels?: string[]
        rootOnly?: boolean
        expectBreadcrumbRoot?: boolean
        showHierarchicalTableHeaders?: boolean
        expectedTotalCells?: number
    }
): Promise<void> => {
    const verticalTreeAvailable = options.verticalTreeAvailable ?? true
    const rootTitle = options.rootTitle ?? (options.locale === 'ru' ? 'Вселенная' : 'Universe')
    const tableToggleName =
        options.locale === 'ru' ? 'Табличный вид' : options.locale === 'en' ? 'Table view' : /^(Table view|Табличный вид)$/
    const horizontalRowsToggleName =
        options.locale === 'ru'
            ? 'Горизонтальные строки'
            : options.locale === 'en'
            ? 'Horizontal rows'
            : /^(Horizontal rows|Горизонтальные строки)$/
    const verticalTreeToggleName =
        options.locale === 'ru'
            ? 'Вертикальное дерево'
            : options.locale === 'en'
            ? 'Vertical tree'
            : /^(Vertical tree|Вертикальное дерево)$/
    const focusedTitle = options.focusedTitle ?? rootTitle
    const tableName =
        typeof focusedTitle === 'string'
            ? options.locale === 'ru'
                ? `Таблица матрицы: ${focusedTitle}`
                : options.locale === 'en'
                ? `Matrix table for ${focusedTitle}`
                : new RegExp(`^(Matrix table for ${escapeRegExp(focusedTitle)}|Таблица матрицы: ${escapeRegExp(focusedTitle)})$`)
            : focusedTitle
    const currentLevelHeaderName =
        options.locale === 'ru' ? 'Текущий уровень' : options.locale === 'en' ? 'Current level' : /^(Current level|Текущий уровень)$/
    const cellHeaderName = options.locale === 'ru' ? 'Ячейка' : options.locale === 'en' ? 'Cell' : /^(Cell|Ячейка)$/
    const noChildrenText =
        options.locale === 'ru'
            ? 'У этой ячейки пока нет дочерних ячеек.'
            : options.locale === 'en'
            ? 'This cell has no child cells yet.'
            : /^(This cell has no child cells yet\.|У этой ячейки пока нет дочерних ячеек\.)$/
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })
    await expect(matrixPane.getByRole('button', { name: tableToggleName })).toHaveAttribute('aria-pressed', 'true')
    await expect(matrixPane.getByRole('button', { name: horizontalRowsToggleName })).toBeVisible()
    if (verticalTreeAvailable) {
        await expect(matrixPane.getByRole('button', { name: verticalTreeToggleName })).toBeVisible()
    } else {
        await expect(matrixPane.getByRole('button', { name: verticalTreeToggleName })).toHaveCount(0)
    }

    const hierarchicalTable = getHierarchicalTable(page)
    await expect(hierarchicalTable).toBeVisible({ timeout: 30_000 })
    const expectTableHeaders = options.showHierarchicalTableHeaders === true
    if (options.rootOnly) {
        await expect(getMatrixTable(page)).toHaveCount(0)
        const headerCard = hierarchicalTable.getByTestId('interpretation-network-table-header-card')
        await expect(headerCard).toBeVisible()
        if (typeof rootTitle === 'string') {
            await expect(headerCard).toContainText(rootTitle)
            await expect(headerCard.getByRole('button', { name: new RegExp(`^(\\d+,\\s*)?${escapeRegExp(rootTitle)}$`) })).toBeVisible()
        } else {
            await expect(headerCard.getByRole('button', { name: rootTitle })).toBeVisible()
        }
    } else {
        const tableRegion = getMatrixTable(page)
        await expect(tableRegion).toBeVisible({ timeout: 30_000 })
        await expect(tableRegion).toHaveAttribute('tabindex', '0')
        const table = tableRegion.getByRole('table', { name: tableName })
        await expect(table).toBeVisible()
        if (expectTableHeaders) {
            await expect(table.getByRole('columnheader', { name: currentLevelHeaderName })).toBeVisible()
            await expect(table.getByRole('columnheader', { name: cellHeaderName })).toBeVisible()
        } else {
            await expect(table.getByRole('columnheader', { name: currentLevelHeaderName })).toHaveCount(0)
            await expect(table.getByRole('columnheader', { name: cellHeaderName })).toHaveCount(0)
        }
        if (options.expectedChildLabels && options.expectedChildLabels.length > 0) {
            for (const label of options.expectedChildLabels) {
                const expectedCell = tableRegion.getByTestId('interpretation-network-table-cell').filter({ hasText: label }).first()
                await expect(expectedCell).toBeVisible()
                await expect(expectedCell.locator('xpath=ancestor::tr[1]')).toContainText(noChildrenText)
            }
        } else {
            await expect(table).toContainText(noChildrenText)
        }
        await expect(table.getByRole('button', { name: options.locale === 'ru' ? 'Добавить строку' : 'Add row' })).toHaveCount(0)
        await expect(table.getByRole('button', { name: options.locale === 'ru' ? 'Добавить колонку' : 'Add column' })).toHaveCount(0)
        await expect(tableRegion.getByTestId('interpretation-network-table-empty-cell')).toHaveCount(0)
        if (options.assertAxisDialogs) {
            const addRowName = options.locale === 'ru' ? 'Добавить строку' : 'Add row'
            const addColumnName = options.locale === 'ru' ? 'Добавить колонку' : 'Add column'
            await expect(table.getByRole('button', { name: addRowName })).toHaveCount(0)
            await expect(table.getByRole('button', { name: addColumnName })).toHaveCount(0)
        }
    }
    if (options.expectBreadcrumbRoot) {
        await expect(hierarchicalTable.getByLabel(options.locale === 'ru' ? 'Путь матрицы' : 'Matrix path')).toContainText(rootTitle)
    } else if (options.rootOnly) {
        await expect(hierarchicalTable.getByLabel(options.locale === 'ru' ? 'Путь матрицы' : 'Matrix path')).toHaveCount(0)
    }
    if (options.expectedTotalCells !== undefined) {
        const totalLabel =
            options.locale === 'ru'
                ? new RegExp(`Всего ${options.expectedTotalCells} яче.+ в структуре`)
                : new RegExp(`Total ${options.expectedTotalCells} cells? in the structure`)
        await expect(matrixPane.getByTestId('interpretation-network-tree-total-cells')).toContainText(totalLabel)
    }
    if (options.assertDefaultCellDialog) {
        const addCellName = options.locale === 'ru' ? 'Добавить' : 'Add'
        const addCellDialogName = options.locale === 'ru' ? 'Добавить ячейку' : 'Add cell'
        await matrixPane
            .getByTestId('interpretation-network-matrix-toolbar')
            .getByRole('button', { name: addCellName, exact: true })
            .click()
        const cellDialog = page.getByRole('dialog', { name: addCellDialogName })
        await expect(cellDialog).toBeVisible()
        await expect(cellDialog.getByRole('radio')).toHaveCount(0)
        await expect(cellDialog.getByRole('combobox', { name: options.locale === 'ru' ? 'Выберите строку' : 'Select row' })).toHaveCount(0)
        await expect(
            cellDialog.getByRole('combobox', { name: options.locale === 'ru' ? 'Выберите колонку' : 'Select column' })
        ).toHaveCount(0)
        await expect(
            cellDialog.getByText(
                options.locale === 'ru' ? 'Создаётся автоматически для новой ячейки.' : 'Created automatically for the new cell.'
            )
        ).toHaveCount(0)
        await expect(
            cellDialog.getByText(
                options.locale === 'ru' ? 'Создаётся автоматически для новой колонки.' : 'Created automatically for the new column.'
            )
        ).toHaveCount(0)
        await expect(cellDialog).not.toContainText(options.locale === 'ru' ? 'Размещение' : 'Placement')
        await expect(cellDialog.getByRole('textbox', { name: options.locale === 'ru' ? /Название/i : /Title/i })).toBeVisible()
        await expect(cellDialog.getByRole('textbox', { name: options.locale === 'ru' ? /Описание/i : /Description/i })).toBeVisible()
        await expect(cellDialog).not.toContainText(options.locale === 'ru' ? 'Новая строка' : 'New row')
        await expect(cellDialog).not.toContainText(options.locale === 'ru' ? 'Новая колонка' : 'New column')
        await cellDialog.getByRole('button', { name: options.locale === 'ru' ? 'Отмена' : 'Cancel' }).click()
        await expect(cellDialog).toHaveCount(0)
    }
    await expect(page.getByTestId('interpretation-network-cell')).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-structure-header')).toContainText(options.structureName)
    await expectNoTechnicalLeakage(hierarchicalTable, {
        label: `Interpretation Network Matrix Table ${options.locale}`,
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i, /"blocks"/i]
    })
    await expectNoPageHorizontalOverflow(page, `Interpretation Network Matrix Table ${options.locale}`)
}

export const expectIndependentAxesMatrixTableRuntime = async (
    page: Page,
    options: {
        locale: InterpretationNetworkMatrixTableLocale
        verticalTreeAvailable?: boolean
    }
): Promise<void> => {
    const verticalTreeAvailable = options.verticalTreeAvailable ?? true
    const tableToggleName =
        options.locale === 'ru' ? 'Табличный вид' : options.locale === 'en' ? 'Table view' : /^(Table view|Табличный вид)$/
    const verticalTreeToggleName =
        options.locale === 'ru'
            ? 'Вертикальное дерево'
            : options.locale === 'en'
            ? 'Vertical tree'
            : /^(Vertical tree|Вертикальное дерево)$/
    const rowHeaderName = options.locale === 'ru' ? 'Строки' : options.locale === 'en' ? 'Rows' : /^(Rows|Строки)$/
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })
    await expect(matrixPane.getByRole('button', { name: tableToggleName })).toHaveAttribute('aria-pressed', 'true')
    if (verticalTreeAvailable) {
        await expect(matrixPane.getByRole('button', { name: verticalTreeToggleName })).toBeVisible()
    } else {
        await expect(matrixPane.getByRole('button', { name: verticalTreeToggleName })).toHaveCount(0)
    }

    const tableRegion = getMatrixTable(page)
    await expect(tableRegion).toBeVisible({ timeout: 30_000 })
    const table = tableRegion.getByRole('table', {
        name: options.locale === 'ru' ? 'Таблица матрицы' : options.locale === 'en' ? 'Matrix table' : /^(Matrix table|Таблица матрицы)$/
    })
    await expect(table).toBeVisible()
    await expect(table.getByRole('columnheader', { name: rowHeaderName })).toBeVisible()
    await expect(table.getByRole('button', { name: options.locale === 'ru' ? 'Добавить строку' : 'Add row' })).toBeVisible()
    await expect(table.getByRole('button', { name: options.locale === 'ru' ? 'Добавить колонку' : 'Add column' })).toBeVisible()
    await expect(tableRegion.getByTestId('interpretation-network-table-empty-cell')).not.toHaveCount(0)
}
