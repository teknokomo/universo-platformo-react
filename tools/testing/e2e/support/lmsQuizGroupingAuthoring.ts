import { expect, type Locator, type Page, type Request, type Response, type TestInfo } from '@playwright/test'
import { isUuidV7 } from '@universo-react/utils'
import { waitForSettledMutationResponse } from './browser/network'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from './browser/runtimeUx'

type Row = Record<string, unknown>

/** Exercise grouping through the existing parent form and restore the flat source quiz. */
export async function assertLmsQuizGroupingAuthoring({
    page,
    quizzesSurface,
    quizTitle,
    testInfo,
    readState,
    isParentPatch
}: {
    page: Page
    quizzesSurface: Locator
    quizTitle: string
    testInfo: TestInfo
    readState: () => Promise<{ blocks: Row[]; questions: Row[] }>
    isParentPatch: (response: Response) => boolean
}): Promise<void> {
    const before = await readState()
    expect(before.blocks).toHaveLength(0)
    expect(before.questions.length).toBeGreaterThan(1)
    await expectNoTechnicalLeakage(quizzesSurface, { label: 'Quiz list before grouping authoring', checkUuidSubstrings: true })
    const content = (rows: Row[]) => rows.map(({ Prompt, Options }) => ({ Prompt, Options }))
    const quizRow = quizzesSurface.getByRole('row').filter({ hasText: quizTitle })
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Edit element', exact: true }) })
    const blocks = () => dialog.getByRole('grid').nth(0)
    const blockRows = () => blocks().getByRole('rowgroup').getByRole('row')
    const questionSelector = () => dialog.getByRole('grid').nth(1).getByRole('combobox', { name: 'Block', exact: true }).first()
    const groupTitle = 'E2E opening block'
    const copiedTitle = 'E2E copied block'
    const runtimeMutations: Array<{ method: string; url: string }> = []
    const trackRuntimeMutation = (request: Request) => {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) return
        const url = new URL(request.url())
        if (url.pathname.startsWith('/api/v1/applications/') && url.pathname.includes('/runtime/')) {
            runtimeMutations.push({ method: request.method(), url: url.toString() })
        }
    }
    page.on('request', trackRuntimeMutation)
    let mutationBaseline = runtimeMutations.length
    let stateBeforeEdit = before
    const open = async () => {
        mutationBaseline = runtimeMutations.length
        await quizRow.getByRole('button', { name: /^Actions for /u }).click()
        await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()
        await expect(dialog).toBeVisible()
        stateBeforeEdit = await readState()
    }
    const save = async () => {
        expect(await readState(), 'Editing related tables must not persist child data before parent Save').toEqual(stateBeforeEdit)
        const responsePromise = waitForSettledMutationResponse(page, isParentPatch, { label: 'Saving coupled quiz tables' })
        await dialog.getByRole('button', { name: 'Save', exact: true }).click()
        const parentResponse = await responsePromise
        expect(parentResponse.status()).toBe(200)
        const writes = runtimeMutations.slice(mutationBaseline)
        expect(writes, 'Coupled table changes must be persisted by one parent-row mutation').toHaveLength(1)
        expect(writes[0]?.method).toBe('PATCH')
        expect(writes[0]?.url).toBe(parentResponse.url())
        await expect(dialog).toHaveCount(0)
        await expectNoTechnicalLeakage(quizzesSurface, { label: 'Quiz list after grouping save', checkUuidSubstrings: true })
    }
    const editTitle = async (row: Locator, title: string) => {
        await row.getByRole('gridcell').nth(1).dblclick()
        const editor = row.getByRole('textbox', { name: 'Title', exact: true })
        await editor.fill(title)
        await editor.press('Tab')
        await expect(row).toContainText(title)
    }
    const editIntroduction = async (row: Locator) => {
        const introductionHeader = blocks().getByRole('columnheader', { name: 'Introduction', exact: true })
        const columnIndex = await introductionHeader.getAttribute('aria-colindex')
        expect(columnIndex).not.toBeNull()
        const cell = row.locator(`[role="gridcell"][aria-colindex="${columnIndex}"]`)
        await cell.dblclick()
        const editor = row.getByRole('textbox', { name: 'Introduction', exact: true })
        await expect(editor).toHaveJSProperty('tagName', 'TEXTAREA')
        await editor.fill('Opening introduction\nSecond line')
        await expect(editor).toHaveValue('Opening introduction\nSecond line')
        await editor.press('Tab')
        await expect(row).toContainText('Opening introduction')
    }
    const deleteBlock = async (row: Locator) => {
        await row.getByRole('button', { name: 'Actions', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
        const confirmation = page.getByRole('dialog', { name: 'Delete Row', exact: true })
        await confirmation.getByRole('button', { name: 'Delete', exact: true }).click()
    }

    await open()
    await dialog.getByRole('button', { name: 'Add Row', exact: true }).first().click()
    let confirmation = page.getByRole('dialog', { name: 'Update related table rows?', exact: true })
    await expect(confirmation).toBeVisible()
    await expect(confirmation.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).press('Enter')
    await expect(confirmation).toHaveCount(0)
    await expect(blockRows()).toHaveCount(0)

    await dialog.getByRole('button', { name: 'Add Row', exact: true }).first().click()
    confirmation = page.getByRole('dialog', { name: 'Update related table rows?', exact: true })
    await expect(confirmation).toHaveAccessibleDescription(/Assign all existing related rows/u)
    await expect(confirmation.getByRole('button', { name: /resize|fullscreen/i })).toHaveCount(0)
    for (const viewport of [
        { name: 'mobile', width: 390, height: 844 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expect(confirmation).toBeVisible()
        await expectNoPageHorizontalOverflow(page, `Quiz grouping confirmation at ${viewport.width}px`)
        const bounds = await confirmation.boundingBox()
        expect(bounds, `The confirmation dialog must fit ${viewport.name}`).not.toBeNull()
        expect(bounds!.x, `The confirmation dialog must fit the left edge at ${viewport.width}px`).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width, `The confirmation dialog must fit the right edge at ${viewport.width}px`).toBeLessThanOrEqual(
            viewport.width
        )
        await page.screenshot({
            path: testInfo.outputPath(`lms-quiz-grouping-confirmation-en-${viewport.name}.png`),
            animations: 'disabled'
        })
    }
    await confirmation.getByRole('button', { name: 'Apply change', exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(blockRows()).toHaveCount(1)
    await editTitle(blockRows().first(), groupTitle)
    await editIntroduction(blockRows().first())
    await expect(questionSelector()).toHaveText(groupTitle)
    await expectNoTechnicalLeakage(dialog, { label: 'Confirmed grouping authoring', checkUuidSubstrings: true })
    await save()
    let state = await readState()
    expect(state.blocks).toHaveLength(1)
    const key = state.blocks[0]?.BlockKey
    expect(typeof key === 'string' && isUuidV7(key)).toBe(true)
    expect(state.questions.every((row) => row.BlockKey === key)).toBe(true)
    expect(content(state.questions)).toEqual(content(before.questions))

    await open()
    await dialog.getByRole('button', { name: 'Add Row', exact: true }).first().click()
    const unusedBlockRow = blockRows().nth(1)
    const unusedBlockTitle = unusedBlockRow.getByRole('textbox', { name: 'Title', exact: true })
    await unusedBlockTitle.fill('E2E unused block')
    await unusedBlockTitle.press('Tab')
    await expect(unusedBlockRow).toContainText('E2E unused block')
    await expect(dialog.getByText('Each group must contain at least one related row before saving.', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await deleteBlock(unusedBlockRow)
    await expect(dialog.getByText('Each group must contain at least one related row before saving.', { exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await save()
    state = await readState()
    expect(state.blocks).toHaveLength(1)
    expect(state.questions.every((row) => row.BlockKey === key)).toBe(true)

    await open()
    await expect(questionSelector()).toHaveText(groupTitle)
    await blockRows().first().getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
    await expect(blockRows()).toHaveCount(2)
    await editTitle(blockRows().nth(1), copiedTitle)
    const selector = questionSelector()
    await selector.focus()
    await selector.press('ArrowDown')
    const emptySelection = page.getByRole('option', { name: 'Select an item', exact: true })
    expect(await emptySelection.getAttribute('aria-disabled')).toBe('true')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(selector).toHaveText(copiedTitle)
    await blockRows().nth(1).getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('menuitem', { name: /^Move up/u }).click()
    await expect(blockRows().first()).toContainText(copiedTitle)
    await save()
    state = await readState()
    expect(state.blocks).toHaveLength(2)
    const keys = state.blocks.map((row) => row.BlockKey)
    expect(new Set(keys).size).toBe(2)
    expect(keys.every((value) => typeof value === 'string' && isUuidV7(value))).toBe(true)
    expect(state.questions[0]?.BlockKey).not.toBe(key)
    expect(state.questions.slice(1).every((row) => row.BlockKey === key)).toBe(true)

    await open()
    await expect(blockRows().first()).toContainText(copiedTitle)
    await expect(questionSelector()).toHaveText(copiedTitle)
    await deleteBlock(blockRows().filter({ hasText: copiedTitle }))
    await expect(blockRows()).toHaveCount(1)
    await expect(dialog.getByText('Reassign this row to an existing group and try again.', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await questionSelector().click()
    await page.getByRole('option', { name: groupTitle, exact: true }).click()
    await expect(dialog.getByText('Reassign this row to an existing group and try again.', { exact: true })).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
    await save()

    await open()
    await deleteBlock(blockRows().first())
    confirmation = page.getByRole('dialog', { name: 'Update related table rows?', exact: true })
    await expect(confirmation).toHaveAccessibleDescription(/Remove the grouping/u)
    await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(blockRows()).toHaveCount(1)
    await expect(questionSelector()).toHaveText(groupTitle)
    await deleteBlock(blockRows().first())
    confirmation = page.getByRole('dialog', { name: 'Update related table rows?', exact: true })
    await confirmation.getByRole('button', { name: 'Apply change', exact: true }).click()
    await expect(confirmation).toHaveCount(0)
    await expect(blockRows()).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page, 'Flat quiz restored after confirmed grouping conversion')
    await save()
    state = await readState()
    expect(state.blocks).toHaveLength(0)
    expect(state.questions.every((row) => row.BlockKey === null)).toBe(true)
    expect(content(state.questions)).toEqual(content(before.questions))
    await open()
    await expect(blockRows()).toHaveCount(0)
    await page.screenshot({ path: testInfo.outputPath('lms-quiz-grouping-restored-flat-en.png'), animations: 'disabled' })
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
}
