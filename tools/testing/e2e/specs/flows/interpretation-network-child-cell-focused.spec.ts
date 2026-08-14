// Interpretation Network child-cell regression for the imported snapshot runtime.
//
// Covers the user-reported path directly: import the canonical snapshot,
// create a linked application, open the single-system Matrix in Russian, and
// create a child cell when placement fields are hidden/system-managed.

import { expect, test } from '../../fixtures/test'
import type { Page, Response } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    expectLocalizedValidation,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls
} from '../../support/browser/runtimeUx'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import {
    expectNoInterpretationNetworkBrowserRegressionIssues,
    watchInterpretationNetworkBrowserRegressionIssues
} from '../../support/interpretationNetworkRuntime'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import { expectSingleSystemMatrix, openStructures } from '../../support/interpretationNetworkFocused'

const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const waitForMatrixCellCreateResponse = (page: Page, applicationId: string, timeout = 30_000): Promise<Response> =>
    waitForSettledMutationResponse(
        page,
        (response) =>
            response.request().method() === 'POST' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells`,
        { label: 'Creating an Interpretation Network Matrix child cell', timeout }
    )

const expectRuSingleSystemMatrix = async (page: Page): Promise<void> => {
    const structurePane = page.getByTestId('interpretation-network-structure-pane')
    await expect(page.getByTestId('interpretation-network-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-matrix-workspace')).toBeVisible({ timeout: 30_000 })
    await expect(structurePane.getByRole('tab', { name: 'Матрица' })).toBeVisible()
    await expect(structurePane.getByRole('tab', { name: 'Шаблоны' })).toBeVisible()
    await expect(structurePane.getByRole('heading', { name: 'Структуры' })).toHaveCount(0)
    await expect(page.getByTestId('interpretation-network-structure-header')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Структуры' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Universe|Вселенная/ }).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('interpretation-network-details-pane').getByRole('button', { name: 'Создать' })).toBeVisible()
}

const expectRuHiddenPlacementChildCellCreate = async (page: Page, applicationId: string): Promise<void> => {
    const matrixPane = page.getByTestId('interpretation-network-matrix-workspace')
    await expect(matrixPane).toBeVisible({ timeout: 30_000 })

    const rootButton = matrixPane.getByRole('button', { name: /Universe|Вселенная/ }).first()
    await expect(rootButton).toBeVisible({ timeout: 30_000 })
    const rootContainer = rootButton.locator('xpath=ancestor::*[@data-cell-id][1]')
    await expect(rootContainer).toHaveAttribute('data-cell-id', /.+/)
    const rootCellId = await rootContainer.getAttribute('data-cell-id')
    expect(rootCellId, 'RU root cell must expose a stable CellId for child placement assertions').toMatch(uuidV7Pattern)
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

    const titleField = dialog.getByRole('textbox', { name: 'Название', exact: true })
    await titleField.fill('')
    await dialog.getByRole('button', { name: 'Создать' }).click()
    await expect(dialog.getByText('Заполните это поле.')).toBeVisible()
    await expectLocalizedValidation(dialog, 'ru', { label: 'RU child-cell validation' })

    await titleField.fill('Дочерняя ячейка E2E')
    await dialog.getByRole('textbox', { name: 'Описание' }).fill('Создано из русской формы без полей размещения.')
    const createRequest = waitForMatrixCellCreateResponse(page, applicationId)
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
    expect(createPayload.placement?.sortOrder).toEqual(expect.any(Number))

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
        label: 'RU imported snapshot child-cell Matrix',
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/Cell ID/i, /\[object Object\]/i]
    })
    await expectRuntimeUxViewportMatrix(page, 'RU imported snapshot child-cell post-create Matrix', {
        beforeEachViewport: async () => {
            await expect(matrixPane.getByRole('button', { name: /^(?:\d+\/\d+,\s*)?Дочерняя ячейка E2E$/ })).toBeVisible({
                timeout: 30_000
            })
        }
    })
    await expectNoPageHorizontalOverflow(page, 'RU imported snapshot child-cell create')
}

test.describe('Interpretation Network imported snapshot child cell @flow @interpretation-network-focused', () => {
    test('creates a Russian child Matrix cell when placement controls are hidden', async ({ page, runManifest }) => {
        test.setTimeout(120_000)
        const browserIssues = watchInterpretationNetworkBrowserRegressionIssues(page)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const imported = await importInterpretationNetworkSnapshot(api, {
                snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                label: `child-cell-${runManifest.runId}`
            })
            await recordCreatedMetahub({
                id: imported.metahub.id,
                name: 'Interpretation Network child-cell focused flow',
                codename: `interpretation-network-child-cell-${runManifest.runId}`
            })

            await page.goto(`/a/${imported.applicationId}`)
            await expect(page.getByTestId('runtime-workspace-switcher')).toBeVisible({ timeout: 30_000 })
            await openStructures(page)
            await expectSingleSystemMatrix(page)
            await applyBrowserPreferences(page, { language: 'ru' })
            await page.reload()
            await expectRuSingleSystemMatrix(page)

            await expectRuHiddenPlacementChildCellCreate(page, imported.applicationId)
            expectNoInterpretationNetworkBrowserRegressionIssues(browserIssues, 'RU imported snapshot child-cell focused flow')
        } finally {
            await disposeApiContext(api)
        }
    })
})
