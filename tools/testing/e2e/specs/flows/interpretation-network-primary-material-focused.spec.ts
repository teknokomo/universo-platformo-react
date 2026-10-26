import { expect, test } from '../../fixtures/test'
import type { Locator, Page } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext } from '../../support/backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { expectNoPageHorizontalOverflow } from '../../support/browser/runtimeUx'
import { attachViewportEvidence, findMatrixRowByTitle, getMaterialRows, getMatrixRows } from '../../support/interpretationNetworkFocused'
import {
    DESKTOP_VIEWPORT,
    getMatrixCell,
    prepareSingleSystem,
    openMatrixInTreeView,
    expectNoRuntimeLeakage
} from './interpretation-network-browser-gaps.helpers'

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
        { label: `Creating material ${title}`, timeout: 30_000 }
    )
    await dialog.getByRole('button', { name: 'Create', exact: true }).click()
    expect((await createResponse).ok()).toBe(true)
    await expect(dialog).toHaveCount(0)
    await expect(details.getByRole('button', { name: 'Back to materials', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(details).toContainText(title)
    await details.getByRole('button', { name: 'Back to materials', exact: true }).click()
    await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible({ timeout: 30_000 })
}

const materialRow = (details: Locator, title: string): Locator =>
    details.getByTestId('interpretation-network-material-table').getByRole('row').filter({ hasText: title }).first()

test.describe('Interpretation Network browser gap coverage @flow @interpretation-network-focused', () => {
    test('replaces, clears, and deletes the Primary Material with visible list transitions', async ({ page, runManifest }, testInfo) => {
        test.setTimeout(180_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const { applicationId, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'primary-material-lifecycle')
            await openMatrixInTreeView(page, applicationId)
            await getMatrixCell(page, 'Universe').click()

            await createMaterialFromDetails(
                page,
                applicationId,
                'Lifecycle primary E2E',
                'First material in the Primary Material lifecycle.'
            )
            await createMaterialFromDetails(page, applicationId, 'Lifecycle replacement E2E', 'Replacement and delete target material.')
            await createMaterialFromDetails(page, applicationId, 'Lifecycle secondary E2E', 'Secondary material delete target.')

            const details = page.getByTestId('interpretation-network-details-pane')
            const firstRow = materialRow(details, 'Lifecycle primary E2E')
            const replacementRow = materialRow(details, 'Lifecycle replacement E2E')
            const secondaryRow = materialRow(details, 'Lifecycle secondary E2E')
            await expect(firstRow).toBeVisible()
            await expect(replacementRow).toBeVisible()
            await expect(secondaryRow).toBeVisible()

            const primaryMaterialActions = firstRow.getByRole('button', {
                name: 'Material actions: Lifecycle primary E2E',
                exact: true
            })
            await primaryMaterialActions.focus()
            await expect(primaryMaterialActions).toBeFocused()
            const primaryActionsAnchor = await primaryMaterialActions.boundingBox()
            expect(primaryActionsAnchor, 'Primary Material actions must have a visible keyboard anchor').not.toBeNull()
            await page.keyboard.press('Enter')
            const primaryMaterialMenu = page.getByRole('menu')
            await expect(primaryMaterialMenu).toBeVisible()
            const primaryMenuBox = await primaryMaterialMenu.boundingBox()
            expect(primaryMenuBox, 'Primary Material actions menu must be visible beside its trigger').not.toBeNull()
            const viewport = page.viewportSize()
            expect(viewport).not.toBeNull()
            expect(primaryMenuBox!.x).toBeGreaterThanOrEqual(0)
            expect(primaryMenuBox!.y).toBeGreaterThanOrEqual(0)
            expect(primaryMenuBox!.x + primaryMenuBox!.width).toBeLessThanOrEqual(viewport!.width + 1)
            expect(primaryMenuBox!.y + primaryMenuBox!.height).toBeLessThanOrEqual(viewport!.height + 1)
            const horizontalGap = Math.max(
                primaryActionsAnchor!.x - (primaryMenuBox!.x + primaryMenuBox!.width),
                primaryMenuBox!.x - (primaryActionsAnchor!.x + primaryActionsAnchor!.width),
                0
            )
            expect(horizontalGap, 'Primary Material actions menu stays horizontally anchored to its keyboard trigger').toBeLessThanOrEqual(
                16
            )
            expect(primaryMenuBox!.y).toBeGreaterThanOrEqual(primaryActionsAnchor!.y - 8)
            expect(primaryMenuBox!.y).toBeLessThan(primaryActionsAnchor!.y + primaryActionsAnchor!.height + 8)
            await page.getByRole('menuitem', { name: 'Set as Primary Material', exact: true }).click()
            await expect(firstRow.getByText('Primary Material', { exact: true })).toBeVisible({ timeout: 30_000 })
            const firstMaterial = (await getMaterialRows(api, applicationId, runtimeIds)).find(
                (material) => material.title === 'Lifecycle primary E2E'
            )
            expect(firstMaterial?.rowId).toEqual(expect.any(String))
            expect(
                findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe').materialRef
            ).toBe(firstMaterial?.rowId)

            await replacementRow.getByRole('button', { name: 'Material actions: Lifecycle replacement E2E', exact: true }).click()
            await page.getByRole('menuitem', { name: 'Replace Primary Material', exact: true }).click()
            await expect(replacementRow.getByText('Primary Material', { exact: true })).toBeVisible({ timeout: 30_000 })
            await expect(firstRow.getByText('Primary Material', { exact: true })).toHaveCount(0)
            const replacementAfterSet = (await getMaterialRows(api, applicationId, runtimeIds)).find(
                (material) => material.title === 'Lifecycle replacement E2E'
            )
            expect(replacementAfterSet?.rowId).toEqual(expect.any(String))
            expect(
                findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe').materialRef
            ).toBe(replacementAfterSet?.rowId)
            await attachViewportEvidence(page, testInfo, 'interpretation-network-primary-material-replaced', DESKTOP_VIEWPORT)

            const secondaryMaterial = (await getMaterialRows(api, applicationId, runtimeIds)).find(
                (material) => material.title === 'Lifecycle secondary E2E'
            )
            expect(secondaryMaterial?.rowId).toEqual(expect.any(String))
            await details.getByRole('button', { name: 'Lifecycle secondary E2E', exact: true }).click()
            await expect(details.getByText('Primary Material', { exact: true })).toHaveCount(0)
            await expect(details.getByRole('button', { name: 'Delete material', exact: true })).toBeVisible()
            const secondaryDeleteResponse = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'DELETE' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/materials/${secondaryMaterial!.rowId}`,
                { label: 'Deleting a secondary Material while another remains Primary', timeout: 30_000 }
            )
            await details.getByRole('button', { name: 'Delete material', exact: true }).click()
            const secondaryConfirmation = page.getByRole('dialog', { name: 'Delete material?' })
            await expect(secondaryConfirmation).toContainText('Lifecycle secondary E2E')
            await secondaryConfirmation.getByRole('button', { name: 'Delete material', exact: true }).click()
            expect((await secondaryDeleteResponse).ok()).toBe(true)
            await expect(secondaryConfirmation).toHaveCount(0)
            await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible()
            await expect(details.getByRole('button', { name: 'Lifecycle primary E2E', exact: true })).toBeVisible()
            await expect(details.getByRole('button', { name: 'Lifecycle replacement E2E', exact: true })).toBeVisible()
            await expect(details.getByRole('button', { name: 'Lifecycle secondary E2E', exact: true })).toHaveCount(0)
            await expect(details.getByText('Primary Material', { exact: true })).toBeVisible()
            const materialsAfterSecondaryDelete = await getMaterialRows(api, applicationId, runtimeIds)
            expect(materialsAfterSecondaryDelete.map((material) => material.rowId)).toEqual(
                expect.arrayContaining([firstMaterial!.rowId, replacementAfterSet!.rowId])
            )
            expect(materialsAfterSecondaryDelete.map((material) => material.rowId)).not.toContain(secondaryMaterial.rowId)
            expect(
                findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe').materialRef
            ).toBe(replacementAfterSet?.rowId)

            await replacementRow.getByRole('button', { name: 'Material actions: Lifecycle replacement E2E', exact: true }).click()
            await page.getByRole('menuitem', { name: 'Clear Primary Material', exact: true }).click()
            await expect(details.getByText('Primary Material', { exact: true })).toHaveCount(0)
            await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible()
            expect(
                findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe').materialRef
            ).toBeNull()
            await attachViewportEvidence(page, testInfo, 'interpretation-network-primary-material-cleared', DESKTOP_VIEWPORT)

            await replacementRow.getByRole('button', { name: 'Material actions: Lifecycle replacement E2E', exact: true }).click()
            await page.getByRole('menuitem', { name: 'Set as Primary Material', exact: true }).click()
            await expect(replacementRow.getByText('Primary Material', { exact: true })).toBeVisible({ timeout: 30_000 })

            const replacementMaterial = (await getMaterialRows(api, applicationId, runtimeIds)).find(
                (material) => material.title === 'Lifecycle replacement E2E'
            )
            expect(replacementMaterial?.rowId).toEqual(expect.any(String))
            expect(
                findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe').materialRef
            ).toBe(replacementMaterial?.rowId)

            await details.getByRole('button', { name: 'Lifecycle replacement E2E', exact: true }).click()
            await expect(details.getByRole('button', { name: 'Back to materials', exact: true })).toBeVisible()
            await expect(details.getByText('Primary Material', { exact: true })).toBeVisible()
            await expect(details.getByRole('button', { name: 'Delete material', exact: true })).toBeVisible()
            for (const viewport of [
                { width: 1920, height: 1080 },
                { width: 768, height: 1024 },
                { width: 390, height: 844 }
            ]) {
                await page.setViewportSize(viewport)
                await expect(details.getByRole('button', { name: 'Back to materials', exact: true })).toBeVisible()
                await expect(details.getByText('Material content', { exact: true })).toBeVisible()
                await expect(details.getByTestId('interpretation-network-material-table')).toHaveCount(0)
                await expect(details.getByRole('button', { name: 'Delete material', exact: true })).toBeVisible()
                await expectNoPageHorizontalOverflow(page, `Primary Material detail at ${viewport.width}px`)
                await attachViewportEvidence(page, testInfo, 'interpretation-network-primary-material-detail', viewport)
            }
            await page.setViewportSize(DESKTOP_VIEWPORT)

            const deleteResponse = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'DELETE' &&
                    new URL(response.url()).pathname ===
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/materials/${replacementMaterial!.rowId}`,
                { label: 'Deleting the current Primary Material', timeout: 30_000 }
            )
            await details.getByRole('button', { name: 'Delete material', exact: true }).click()
            const confirmation = page.getByRole('dialog', { name: 'Delete material?' })
            await expect(confirmation).toContainText('Lifecycle replacement E2E')
            await confirmation.getByRole('button', { name: 'Delete material', exact: true }).click()
            expect((await deleteResponse).ok()).toBe(true)
            await expect(confirmation).toHaveCount(0)

            await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible({ timeout: 30_000 })
            await expect(details.getByRole('button', { name: 'Lifecycle primary E2E', exact: true })).toBeVisible()
            await expect(details.getByRole('button', { name: 'Lifecycle replacement E2E', exact: true })).toHaveCount(0)
            await expect(details.getByText('Primary Material', { exact: true })).toHaveCount(0)
            expect(
                findMatrixRowByTitle(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId), 'Universe').materialRef
            ).toBeNull()
            await expectNoRuntimeLeakage(page.getByRole('main'), 'Primary Material replace clear delete lifecycle')
            for (const viewport of [
                { width: 1920, height: 1080 },
                { width: 768, height: 1024 },
                { width: 390, height: 844 }
            ]) {
                await attachViewportEvidence(page, testInfo, 'interpretation-network-primary-material-deleted', viewport)
                await expect(details.getByTestId('interpretation-network-material-table')).toBeVisible()
                await expectNoPageHorizontalOverflow(page, `Primary Material lifecycle at ${viewport.width}px`)
            }
        } finally {
            await disposeApiContext(api)
        }
    })
})
