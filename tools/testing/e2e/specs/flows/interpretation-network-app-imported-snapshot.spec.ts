// Interpretation Network — flow coverage for the imported snapshot runtime.
//
// Verifies:
//   1. The published app opens the Interpretation Network start Page and menu.
//   2. The Structures workspace starts empty after schema sync.
//   3. Browser runtime surfaces do not leak raw UUIDs/JSON and do not
//      throw console/page/API 500 regressions.

import { expect, test } from '../../fixtures/test'
import type { Locator, Page, Response } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectDataGridHorizontalScrollConstrained,
    expectLocalizedValidation,
    expectNoDataGridTechnicalLeakage,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls
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

type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

const createdStructureTerm = 'E2E created structure'
const createdStructureDescription = 'Created through the Interpretation Network structure browser flow.'
const createdMaterialTitle = 'E2E source note'
const createdMaterialDescription = 'Created through the Interpretation Network material browser flow.'
const updatedMaterialTitle = 'E2E edited source note'
const updatedMaterialDescription = 'Updated Interpretation Network material description.'
const materialBodyText = 'Browser-authored material body'

const getRuntimeRowsUrl = (response: Response): URL => new URL(response.url())

const matchesRuntimeRowsCreate = (response: Response, applicationId: string, workspaceId: string): boolean => {
    if (response.request().method() !== 'POST') return false
    const url = getRuntimeRowsUrl(response)
    return url.pathname === `/api/v1/applications/${applicationId}/runtime/rows` && url.searchParams.get('workspaceId') === workspaceId
}

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getMaterialOpenButton = (surface: Locator, title: string): Locator =>
    surface.getByRole('button', { name: new RegExp(`^${escapeRegExp(title)}(?:\\s|$)`) }).first()

const hasLocalizedPayloadValue = (payload: unknown, expectedText: string, locale = 'en'): boolean => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
    return Object.values(payload as Record<string, unknown>).some((value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false
        const locales = (value as { locales?: Record<string, { content?: unknown }> }).locales
        return locales?.[locale]?.content === expectedText
    })
}

const expectInterpretationNetworkStartPage = async (page: Page): Promise<void> => {
    await expect(page.getByRole('navigation').first()).toBeVisible()
    const menu = page.getByRole('navigation').first()
    await expect(menu.getByRole('link', { name: 'Start' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Structures' })).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Workspaces' })).toBeVisible()
    await expect(page.getByRole('main')).toContainText(/interpretation network/i)
    await expect(page.getByRole('main')).toContainText(/structures/i)
    await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
}

const expectEmptyStructuresWorkspace = async (page: Page): Promise<void> => {
    const main = page.getByRole('main')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('heading', { name: 'Structures' })).toBeVisible()
    await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('textbox', { name: 'Filter by title' })).toBeVisible()
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
    await expect(main.getByRole('button', { name: 'Create' })).toBeVisible()
    await expect(main.getByRole('button', { name: 'Add page' })).toHaveCount(0)
    await expect(main.getByText('Gravity', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Gravity material', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Attraction between masses', { exact: false })).toHaveCount(0)
    await expect(main.getByText('Basic interpretation matrix', { exact: false })).toHaveCount(0)
}

const expectEqualDesktopPaneWidths = async (page: Page, label: string): Promise<void> => {
    const widths = await page.evaluate(() => {
        const structurePane = document.querySelector('[data-testid="interpretation-network-structure-pane"]')
        const detailsPane = document.querySelector('[data-testid="interpretation-network-details-pane"]')
        const structureRect = structurePane?.getBoundingClientRect()
        const detailsRect = detailsPane?.getBoundingClientRect()
        return {
            structure: structureRect?.width ?? 0,
            details: detailsRect?.width ?? 0
        }
    })

    expect(widths.structure, `${label} structure pane width`).toBeGreaterThan(320)
    expect(widths.details, `${label} details pane width`).toBeGreaterThan(320)
    expect(Math.abs(widths.structure - widths.details), `${label} panes must have equal width`).toBeLessThanOrEqual(2)
}

const fillOptionalStructureDialogFields = async (dialog: Locator, values: { term: string; description: string }): Promise<void> => {
    const termField = dialog.getByRole('textbox', { name: 'Term', exact: true })
    if ((await termField.count()) > 0) {
        await termField.first().fill(values.term)
    }

    const descriptionField = dialog.getByRole('textbox', { name: 'Description', exact: true })
    if ((await descriptionField.count()) > 0) {
        await descriptionField.first().fill(values.description)
    }
}

async function fillMaterialDialogFields(dialog: Locator, values: { title: string; description: string }) {
    await dialog.getByRole('textbox', { name: 'Title', exact: true }).fill(values.title)
    await dialog.getByRole('textbox', { name: 'Description', exact: true }).fill(values.description)
}

async function fillMaterialBlockEditor(page: Page, surface: Locator, value: string) {
    const editorRoot = surface.getByTestId('editorjs-block-editor')
    await expect(editorRoot).toBeVisible({ timeout: 20_000 })
    await expect(surface.getByTestId('editorjs-block-editor-loading')).toHaveCount(0, { timeout: 20_000 })
    const previousCommittedSequence = await editorRoot.getAttribute('data-editorjs-committed-sequence')
    await editorRoot.click({ position: { x: 24, y: 24 } })

    const editableBlock = editorRoot.locator('[contenteditable="true"]').first()
    await expect(editableBlock).toBeVisible({ timeout: 20_000 })
    await editableBlock.fill(value)
    await expect(editorRoot.getByText(value)).toBeVisible()
    await expect(editableBlock).toContainText(value)
    await expect
        .poll(() => editorRoot.getAttribute('data-editorjs-committed-sequence'), {
            message: 'Editor.js material content must commit before saving',
            timeout: 20_000
        })
        .not.toBe(previousCommittedSequence)
}

test.describe('Interpretation Network imported snapshot @flow', () => {
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
            label: 'flow'
        })
        await recordCreatedMetahub({
            id: metahub.id,
            name: 'Interpretation Network flow',
            codename: 'interpretation-network-flow'
        })

        await page.goto(`/metahub/${metahub.id}`)
        await expect(page.getByText(INTERPRETATION_NETWORK_CANONICAL_METAHUB.name.en, { exact: true }).first()).toBeVisible({
            timeout: 30_000
        })

        await page.goto(`/a/${applicationId}`)
        await expect(page.getByTestId('runtime-workspace-switcher')).toBeVisible({ timeout: 30_000 })
        await expectInterpretationNetworkStartPage(page)
        await expect(page.getByRole('main')).not.toContainText('Users')
        await expect(page.getByRole('main')).not.toContainText('Conversions')
        await expect(page.getByRole('main')).not.toContainText('Event count')

        const menu = page.getByRole('navigation').first()
        await menu.getByRole('link', { name: 'Workspaces' }).click()
        await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
        const workspaceMenu = page.getByRole('navigation').first()
        await expect(workspaceMenu.getByRole('link', { name: 'Structures' })).toBeVisible()
        await workspaceMenu.getByRole('link', { name: 'Structures' }).click()
        await expectEmptyStructuresWorkspace(page)
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network workspace shell')
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network workspace shell', {
            beforeEachViewport: async () => {
                await expectEmptyStructuresWorkspace(page)
            }
        })

        const runtimeSections = await expectInterpretationNetworkRuntimeDataReady(api, applicationId)
        await page.setViewportSize({ width: 1280, height: 900 })
        await expectEmptyStructuresWorkspace(page)
        await expectEqualDesktopPaneWidths(page, 'Empty Interpretation Network workspace')
        await applyBrowserPreferences(page, { language: 'ru' })
        await page.reload()
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('heading', { name: 'Структуры' })).toBeVisible()
        await expect(
            page.getByTestId('interpretation-network-structure-pane').getByRole('textbox', { name: 'Фильтр по названию' })
        ).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Таблица' })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Карточки' })).toBeVisible()
        await expect(page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Создать' })).toBeVisible()
        await expectEqualDesktopPaneWidths(page, 'RU empty Interpretation Network workspace')
        await applyBrowserPreferences(page, { language: 'en' })
        await page.reload()
        await expectEmptyStructuresWorkspace(page)
        const activeWorkspaceId = await page.getByTestId('runtime-workspace-switcher').locator('input').first().inputValue()
        expect(activeWorkspaceId, 'Interpretation Network workspace mutation checks need the active workspace id').toMatch(
            /^[0-9a-f-]{36}$/i
        )
        await page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Create' }).click()
        const structureDialog = page.getByRole('dialog', { name: 'Create structure' })
        await expect(structureDialog).toBeVisible({ timeout: 30_000 })
        if ((await structureDialog.getByRole('textbox', { name: 'Description', exact: true }).count()) > 0) {
            await expectSemanticFieldControls(structureDialog, { longTextLabels: ['Description'] })
        }
        await fillOptionalStructureDialogFields(structureDialog, {
            term: createdStructureTerm,
            description: createdStructureDescription
        })
        const createStructureRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesRuntimeRowsCreate(response, applicationId, activeWorkspaceId),
            { label: 'Creating Interpretation Network structure' }
        )
        await structureDialog.getByRole('button', { name: 'Create' }).click()
        const createStructureResponse = await createStructureRequest
        expect(createStructureResponse.ok()).toBe(true)
        const createdStructure = (await createStructureResponse.json()) as { id?: string }
        expect(createdStructure.id, 'created structure id must be returned by runtime create').toMatch(/^[0-9a-f-]{36}$/i)
        await expect(structureDialog).toHaveCount(0)
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(createdStructureTerm, { timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText('Matrix')
        await expect(page).toHaveURL(
            new RegExp(
                `/a/${escapeRegExp(applicationId)}/${escapeRegExp(runtimeSections.conceptSectionId)}/${escapeRegExp(
                    createdStructure.id ?? ''
                )}$`
            )
        )
        const cells = page.getByTestId('interpretation-network-cell')
        await expect(cells.first()).toBeVisible({ timeout: 30_000 })
        await expect(cells.first()).toContainText('Meaning')
        await expect(cells.first()).not.toContainText('Empty cell')
        await page.reload()
        await expect(page).toHaveURL(
            new RegExp(
                `/a/${escapeRegExp(applicationId)}/${escapeRegExp(runtimeSections.conceptSectionId)}/${escapeRegExp(
                    createdStructure.id ?? ''
                )}$`
            )
        )
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(createdStructureTerm, { timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText('Matrix')
        await expect(page.getByTestId('interpretation-network-cell').first()).toBeVisible({ timeout: 30_000 })
        await cells.first().click()
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
        await expect(
            page.getByTestId('interpretation-network-details-pane').getByRole('textbox', { name: 'Filter by title' })
        ).toBeVisible()
        await expect(page.getByRole('tab', { name: 'Relations' })).toHaveCount(0)
        await expect(page.getByRole('tab', { name: 'Templates' })).toHaveCount(0)

        await page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' }).click()
        const materialDialog = page.getByRole('dialog', { name: 'Add material' })
        await expect(materialDialog).toBeVisible({ timeout: 30_000 })
        await expectSemanticFieldControls(materialDialog, { longTextLabels: ['Description'] })
        await fillMaterialDialogFields(materialDialog, {
            title: createdMaterialTitle,
            description: createdMaterialDescription
        })
        const createMaterialRequest = waitForSettledMutationResponse(
            page,
            (response) => matchesRuntimeRowsCreate(response, applicationId, activeWorkspaceId),
            { label: 'Creating Interpretation Network material' }
        )
        await materialDialog.getByRole('button', { name: 'Create' }).click()
        expect((await createMaterialRequest).ok()).toBe(true)
        await expect(materialDialog).toHaveCount(0)
        const detailsPane = page.getByTestId('interpretation-network-details-pane')
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
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                response.url().includes(`workspaceId=${encodeURIComponent(activeWorkspaceId)}`),
            { label: 'Editing Interpretation Network material metadata' }
        )
        await editMaterialDialog.getByRole('button', { name: 'Save' }).click()
        const editMaterialResponse = await editMaterialRequest
        expect(editMaterialResponse.ok()).toBe(true)
        const editPayload = editMaterialResponse.request().postDataJSON() as { data?: unknown }
        expect(hasLocalizedPayloadValue(editPayload.data, updatedMaterialTitle)).toBe(true)
        expect(hasLocalizedPayloadValue(editPayload.data, updatedMaterialDescription)).toBe(true)
        await expect(editMaterialDialog).toHaveCount(0)
        await expect(getMaterialOpenButton(detailsPane, updatedMaterialTitle)).toBeVisible()
        await getMaterialOpenButton(detailsPane, updatedMaterialTitle).click()
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
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().includes(`/api/v1/applications/${applicationId}/runtime/rows/`) &&
                response.url().includes(`workspaceId=${encodeURIComponent(activeWorkspaceId)}`),
            { label: 'Saving Interpretation Network material body' }
        )
        await detailsPane.getByRole('button', { name: 'Save' }).click()
        expect((await saveMaterialBodyRequest).ok()).toBe(true)
        await expectNoTechnicalLeakage(detailsPane, {
            label: 'Interpretation Network material authoring pane',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i]
        })
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network created structure runtime',
            checkUuidSubstrings: true,
            forbiddenVisibleTextPatterns: [/Cell ID/i]
        })
        await detailsPane.getByRole('button', { name: 'Back to materials' }).click()
        await expect(detailsPane.getByRole('button', { name: 'Create' })).toBeVisible({ timeout: 30_000 })
        await expect(getMaterialOpenButton(detailsPane, updatedMaterialTitle)).toBeVisible()
        await applyBrowserPreferences(page, { language: 'ru' })
        await detailsPane.getByRole('button', { name: 'Create' }).click()
        const ruMaterialDialog = page.getByRole('dialog').first()
        await expect(ruMaterialDialog).toBeVisible({ timeout: 30_000 })
        const ruMaterialTitleField = ruMaterialDialog.getByRole('textbox', { name: /Название|Title/i })
        await ruMaterialTitleField.fill('А'.repeat(260))
        await expect(ruMaterialTitleField).toHaveValue('А'.repeat(255))
        await expect(ruMaterialDialog.getByText(/Максимальная длина: 255|Maximum length: 255/i)).toBeVisible()
        await expect(ruMaterialDialog.getByRole('button', { name: /Создать|Create/i })).toBeEnabled()
        await expectLocalizedValidation(ruMaterialDialog, 'ru', { label: 'RU Interpretation Network material validation' })
        await page.keyboard.press('Escape')
        await expect(ruMaterialDialog).toHaveCount(0)
        await applyBrowserPreferences(page, { language: 'en' })
        await expectRuntimeUxViewportMatrix(page, 'Interpretation Network created structure runtime', {
            beforeEachViewport: async () => {
                await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
                await expect(page.getByTestId('interpretation-network-structure-pane')).toContainText(createdStructureTerm)
                await page.getByTestId('interpretation-network-cell').first().click()
                await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
                await page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Table view' }).click()
                await expect(page.getByTestId('interpretation-network-details-pane').locator('.MuiDataGrid-root')).toBeVisible()
            }
        })

        await page.setViewportSize({ width: 1280, height: 900 })
        await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Create' })).toBeVisible()
        await expect(getMaterialOpenButton(page.getByTestId('interpretation-network-details-pane'), updatedMaterialTitle)).toBeVisible()
        await expectNoTechnicalLeakage(page.getByRole('main'), {
            label: 'Interpretation Network Materials workspace tab',
            checkUuidSubstrings: true
        })
        await expectNoPageHorizontalOverflow(page, 'Interpretation Network Material workspace tab')
        await expectDataGridHorizontalScrollConstrained(page, 'Interpretation Network Materials workspace tab')
        await expectNoDataGridTechnicalLeakage(page.getByTestId('interpretation-network-details-pane'), {
            label: 'Interpretation Network Materials workspace tab',
            checkUuidSubstrings: true
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

        expectNoInterpretationNetworkBrowserRegressionIssues(browserIssues, 'Interpretation Network imported snapshot flow')
    })
})
