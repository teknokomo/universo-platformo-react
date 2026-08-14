import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage, RUNTIME_UX_VIEWPORT_MATRIX } from '../../support/browser/runtimeUx'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    attachViewportEvidence,
    ensureSystemStructure,
    expectSingleSystemMatrix,
    findMatrixRowByTitle,
    getMatrixRows,
    openStructures,
    resolveRuntimeIds
} from '../../support/interpretationNetworkFocused'

test.describe('Interpretation Network single-system navigation @flow @interpretation-network-focused', () => {
    test('opens the Matrix through a canonical direct route and survives reload and browser history', async ({
        page,
        runManifest
    }, testInfo) => {
        test.setTimeout(180_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const imported = await importInterpretationNetworkSnapshot(api, {
                snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                label: `single-system-${runManifest.runId}`
            })
            await recordCreatedMetahub({
                id: imported.metahub.id,
                name: 'Interpretation Network single-system focused flow',
                codename: `interpretation-network-single-${runManifest.runId}`
            })
            const runtimeIds = await resolveRuntimeIds(api, imported.applicationId)

            await page.goto(`/a/${imported.applicationId}`)
            await expect(page.getByTestId('runtime-workspace-switcher')).toBeVisible({ timeout: 30_000 })
            const startUrl = page.url()
            await openStructures(page)
            await expectSingleSystemMatrix(page)
            await expectNoTechnicalLeakage(page.getByRole('main'), {
                label: 'single-system Matrix surface',
                disallowUuidSubstring: true
            })

            const matrixUrl = page.url()
            expect(matrixUrl).not.toBe(startUrl)
            expect(new URL(matrixUrl).pathname).toBe(`/a/${imported.applicationId}`)
            expect(new URL(matrixUrl).searchParams.get('matrixCell')).toBeTruthy()
            expect(new URL(matrixUrl).searchParams.get('matrixCell')).toMatch(/^[0-9a-f-]{36}$/i)
            await expectNoPageHorizontalOverflow(page, 'single-system direct Matrix route')

            const system = await ensureSystemStructure(api, imported.applicationId, runtimeIds.workspaceId)
            const interpretationId = system.interpretationId
            expect(
                (await getMatrixRows(api, imported.applicationId, runtimeIds, interpretationId!)).length,
                'fresh system Matrix must contain its root cell'
            ).toBe(1)
            await page.reload()
            await expectSingleSystemMatrix(page)

            const rootCell = page.getByRole('button', { name: /Universe/ }).first()
            await expect(rootCell).toBeVisible()
            await rootCell.click()
            await expect(rootCell).toHaveAttribute('aria-pressed', 'true')
            const rootCellId = await rootCell.getAttribute('data-cell-id')
            expect(rootCellId).toMatch(/^[0-9a-f-]{36}$/i)
            const addButton = page.getByTestId('interpretation-network-matrix-toolbar').getByRole('button', { name: 'Add', exact: true })
            await expect(addButton).toBeEnabled()
            await addButton.click()
            const addDialog = page.getByRole('dialog', { name: 'Add cell' })
            await expect(addDialog).toBeVisible()
            await addDialog.getByRole('textbox', { name: 'Title' }).fill('Fresh system child')
            await addDialog.getByRole('textbox', { name: 'Description' }).fill('Created directly in a fresh single-system Matrix')
            const createCellResponsePromise = page.waitForResponse(
                (response) =>
                    response.request().method() === 'POST' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${imported.applicationId}/runtime/interpretation-network/matrix/cells`
            )
            await addDialog.getByRole('button', { name: 'Create' }).click()
            const createCellResponse = await createCellResponsePromise
            expect(createCellResponse.status()).toBe(201)
            const createPayload = createCellResponse.request().postDataJSON() as {
                data?: Record<string, unknown>
                placement?: { parentCellId?: string | null }
            }
            expect(createPayload.data).not.toHaveProperty('CellId')
            expect(createPayload.data).not.toHaveProperty('ParentCellId')
            expect(createPayload.placement?.parentCellId).toBe(rootCellId)
            const createResult = (await createCellResponse.json()) as { id?: string; status?: string; item?: unknown }
            expect(createResult.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
            expect(createResult.status).toBe('created')
            expect(createResult.item).toBeTruthy()
            await expect(addDialog).toHaveCount(0)
            const createdCell = page.getByTestId('interpretation-network-cell').filter({ hasText: 'Fresh system child' }).first()
            await expect(createdCell).toBeVisible({ timeout: 30_000 })
            const persistedMatrixUrl = page.url()
            await expect(page.getByText('Failed to update matrix cells', { exact: true })).toHaveCount(0)
            await expectNoPageHorizontalOverflow(page, 'fresh single-system cell created')
            const createdScreenshot = await page.screenshot({ fullPage: true, animations: 'disabled' })
            await testInfo.attach('single-system-fresh-cell-created', { body: createdScreenshot, contentType: 'image/png' })

            const rowsAfterCreate = await getMatrixRows(api, imported.applicationId, runtimeIds, interpretationId!)
            const persistedBeforeReload = findMatrixRowByTitle(rowsAfterCreate, 'Fresh system child')
            expect(persistedBeforeReload.parentCellId).toBe(rootCellId)

            await page.reload()
            await expect(page).toHaveURL(persistedMatrixUrl)
            await expectSingleSystemMatrix(page)
            await expect(page.getByTestId('interpretation-network-cell').filter({ hasText: 'Fresh system child' })).toBeVisible({
                timeout: 30_000
            })
            await expect(page.getByText('Failed to update matrix cells', { exact: true })).toHaveCount(0)
            const rowsAfterReload = await getMatrixRows(api, imported.applicationId, runtimeIds, interpretationId!)
            expect(findMatrixRowByTitle(rowsAfterReload, 'Fresh system child').rowId).toBe(persistedBeforeReload.rowId)
            await expectNoPageHorizontalOverflow(page, 'fresh single-system cell persisted after reload')

            await page.goto(startUrl, { waitUntil: 'domcontentloaded' })
            await expect(page).toHaveURL(startUrl)
            await expect(page.getByTestId('interpretation-network-workspace')).toHaveCount(0)
            await page.goBack()
            await expect(page).toHaveURL(persistedMatrixUrl)
            await expectSingleSystemMatrix(page)

            const firstMatrixCell = page.getByRole('button', { name: /Universe/ }).first()
            await firstMatrixCell.focus()
            await expect(firstMatrixCell).toBeFocused()
            await page.keyboard.press('Enter')
            await expect(firstMatrixCell).toHaveAttribute('aria-pressed', 'true')

            for (const viewport of RUNTIME_UX_VIEWPORT_MATRIX) {
                await attachViewportEvidence(page, testInfo, `single-system-matrix-${viewport.name}`, viewport)
                await expectSingleSystemMatrix(page)
            }
        } finally {
            await disposeApiContext(api)
        }
    })
})
