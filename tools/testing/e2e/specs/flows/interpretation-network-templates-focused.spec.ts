import { expect, test } from '../../fixtures/test'
import { createLoggedInApiContext, disposeApiContext, getRuntimeAppData, sendWithCsrf } from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import { INTERPRETATION_NETWORK_FIXTURE_FILENAME } from '../../support/interpretationNetworkFixtureContract'
import { importInterpretationNetworkSnapshot } from '../../support/interpretationNetworkSnapshotImport'
import {
    addRussianVariant,
    attachDialogViewportEvidence,
    createMaterialForCell,
    expectSingleSystemMatrix,
    findMatrixRowByTitle,
    getMaterialRows,
    getMatrixRows,
    getTemplateMatrixRows,
    getTemplateDetail,
    instantiateTemplate,
    listTemplates,
    openTemplateAction,
    openStructures,
    readLocalizedText,
    resolveRuntimeIds,
    setInterpretationNetworkWidgetConfig,
    uuidV7Pattern
} from '../../support/interpretationNetworkFocused'

const DIALOG_VIEWPORTS = [
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 390, height: 844 }
] as const
const DESKTOP_VIEWPORT = { width: 1280, height: 900 }

const captureDialogViewports = async (
    page: Parameters<typeof attachDialogViewportEvidence>[0],
    testInfo: Parameters<typeof attachDialogViewportEvidence>[1],
    dialog: Parameters<typeof attachDialogViewportEvidence>[2],
    name: string,
    visibleActionNames: string[]
) => {
    for (const viewport of DIALOG_VIEWPORTS) {
        await attachDialogViewportEvidence(page, testInfo, dialog, `${name}-${viewport.name}`, viewport, visibleActionNames)
    }
    await page.setViewportSize(DESKTOP_VIEWPORT)
    await expect(dialog).toBeVisible()
}

const expectDialogKeyboardFocusContainment = async (
    page: Parameters<typeof attachDialogViewportEvidence>[0],
    dialog: Parameters<typeof attachDialogViewportEvidence>[2],
    lastActionName: string
) => {
    const lastAction = dialog.getByRole('button', { name: lastActionName, exact: true })
    await lastAction.focus()
    await expect(lastAction).toBeFocused()
    await page.keyboard.press('Tab')
    await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), {
            message: `Tab from ${lastActionName} must keep keyboard focus inside the modal dialog`
        })
        .toBe(true)
    await page.keyboard.press('Shift+Tab')
    await expect
        .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), {
            message: `Shift+Tab must keep keyboard focus inside the modal dialog`
        })
        .toBe(true)
}

test.describe('Interpretation Network template lifecycle @flow @interpretation-network-focused', () => {
    test('copies structure-only and material templates with fresh IDs and immutable sources', async ({ page, runManifest }, testInfo) => {
        test.setTimeout(240_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const imported = await importInterpretationNetworkSnapshot(api, {
                snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                label: `templates-${runManifest.runId}`
            })
            await recordCreatedMetahub({
                id: imported.metahub.id,
                name: 'Interpretation Network template focused flow',
                codename: `interpretation-network-template-${runManifest.runId}`
            })
            await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })
            const runtimeIds = await resolveRuntimeIds(api, imported.applicationId)
            const systemStructureResponse = await sendWithCsrf(
                api,
                'POST',
                `/api/v1/applications/${
                    imported.applicationId
                }/runtime/interpretation-network/system-structure/ensure?workspaceId=${encodeURIComponent(runtimeIds.workspaceId)}`,
                { locale: 'en' }
            )
            expect(systemStructureResponse.ok).toBe(true)
            const system = (await systemStructureResponse.json()) as { structureId: string; interpretationId: string }
            const sourceMatrixRowsBefore = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
            expect(sourceMatrixRowsBefore.length).toBeGreaterThan(0)

            const unrelated = await importInterpretationNetworkSnapshot(api, {
                snapshotFilename: INTERPRETATION_NETWORK_FIXTURE_FILENAME,
                label: `templates-unrelated-${runManifest.runId}`
            })
            await recordCreatedMetahub({
                id: unrelated.metahub.id,
                name: 'Interpretation Network unrelated-template canary',
                codename: `interpretation-network-template-unrelated-${runManifest.runId}`
            })
            const unrelatedRuntimeIds = await resolveRuntimeIds(api, unrelated.applicationId)
            expect(await listTemplates(api, unrelated.applicationId, unrelatedRuntimeIds.workspaceId)).toEqual([])

            await page.goto(`/a/${imported.applicationId}`)
            await expect(page.getByTestId('runtime-workspace-switcher')).toBeVisible({ timeout: 30_000 })
            await openStructures(page)
            await expectSingleSystemMatrix(page)
            const saveButton = page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Save as template' })
            await expect(saveButton).toBeVisible()
            await saveButton.focus()
            await expect(saveButton).toBeFocused()
            await page.keyboard.press('Enter')
            const saveDialog = page.getByRole('dialog', { name: 'Save structure as template' })
            await expect(saveDialog).toBeVisible()
            const templateNameField = saveDialog.getByRole('textbox', { name: 'Template name' }).first()
            await expect(templateNameField).toBeVisible()
            await templateNameField.focus()
            await expect(templateNameField).toBeFocused()
            await expect(saveDialog.getByRole('textbox', { name: 'Description' })).toBeVisible()
            await expect(saveDialog.getByRole('textbox', { name: 'Description' })).toHaveAttribute('rows', '3')
            await expect(saveDialog.getByRole('table', { name: 'Saved data' })).toBeVisible()
            await addRussianVariant(page, saveDialog.getByRole('textbox', { name: 'Template name' }).first(), 'Шаблон сети')
            await saveDialog.getByRole('textbox', { name: 'Template name' }).first().fill('Structure-only template')
            await saveDialog.getByRole('textbox', { name: 'Description' }).first().fill('Structure-only focused template')
            await saveDialog.getByRole('radio', { name: 'Structure only' }).check()
            await captureDialogViewports(page, testInfo, saveDialog, 'interpretation-network-save-template-dialog', ['Cancel', 'Save'])
            await expectDialogKeyboardFocusContainment(page, saveDialog, 'Save')
            await saveDialog.getByRole('button', { name: 'Save' }).click()
            await expect(saveDialog).toHaveCount(0)

            const templatesAfterStructure = await listTemplates(api, imported.applicationId, runtimeIds.workspaceId)
            const structureOnlyTemplate = templatesAfterStructure.find(
                (template) => readLocalizedText(template.name) === 'Structure-only template'
            )
            expect(structureOnlyTemplate).toBeDefined()
            expect(structureOnlyTemplate?.includesMaterials).toBe(false)
            expect(structureOnlyTemplate?.id).toMatch(uuidV7Pattern)
            const structureTemplateDetail = await getTemplateDetail(
                api,
                imported.applicationId,
                runtimeIds.workspaceId,
                structureOnlyTemplate!.id
            )
            expect(structureTemplateDetail.matrix.cellCount).toBe(sourceMatrixRowsBefore.length)
            expect(structureTemplateDetail.matrix.rootCount).toBe(1)
            expect(structureTemplateDetail.materialCount).toBe(0)
            expect(await listTemplates(api, unrelated.applicationId, unrelatedRuntimeIds.workspaceId)).toEqual([])

            await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'multiple' })
            const createdFromStructureOnly = await instantiateTemplate(
                api,
                imported.applicationId,
                runtimeIds.workspaceId,
                structureOnlyTemplate!,
                'From structure-only template'
            )
            const copiedStructureRows = await getRuntimeAppData(api, imported.applicationId, {
                objectCollectionCodename: 'Structure',
                workspaceId: runtimeIds.workspaceId,
                locale: 'en',
                limit: 100,
                offset: 0
            })
            expect(JSON.stringify(copiedStructureRows)).toContain('From structure-only template')
            const copiedStructureMatrixRows = await getMatrixRows(
                api,
                imported.applicationId,
                runtimeIds,
                createdFromStructureOnly.interpretationId
            )
            expect(copiedStructureMatrixRows.length).toBe(sourceMatrixRowsBefore.length)
            const sourceStructureRowIds = new Set(sourceMatrixRowsBefore.map((row) => row.id))
            const copiedStructureRowIds = copiedStructureMatrixRows.map((row) => row.id)
            expect(new Set(copiedStructureRowIds).size).toBe(copiedStructureRowIds.length)
            for (const copiedRowId of copiedStructureRowIds) {
                expect(copiedRowId).toMatch(uuidV7Pattern)
                expect(sourceStructureRowIds.has(copiedRowId)).toBe(false)
            }

            await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'singleSystem' })
            const sourceMaterialCell = findMatrixRowByTitle(sourceMatrixRowsBefore, 'Universe')
            const authoredMaterialBody = {
                time: 0,
                version: '2.30.8',
                blocks: [
                    {
                        id: 'focused-material-paragraph',
                        type: 'paragraph',
                        data: { text: 'Authored body with an ordinary https://example.test/reference URL' }
                    }
                ]
            }
            const createdSourceMaterial = await createMaterialForCell(api, imported.applicationId, runtimeIds, {
                interpretationId: system.interpretationId,
                matrixRowId: sourceMaterialCell.rowId,
                cellId: sourceMaterialCell.cellId,
                title: 'Focused source material',
                description: 'Real Material attached before saving the with-materials template',
                body: authoredMaterialBody
            })
            const sourceRowsWithMaterial = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
            const sourceMaterialMatrixRow = findMatrixRowByTitle(sourceRowsWithMaterial, 'Universe')
            expect(sourceMaterialMatrixRow.materialRef).toBe(createdSourceMaterial.id)
            const sourceMaterial = (await getMaterialRows(api, imported.applicationId, runtimeIds)).find(
                (material) => material.rowId === createdSourceMaterial.id
            )
            expect(sourceMaterial).toMatchObject({
                rowId: createdSourceMaterial.id,
                cellId: sourceMaterialCell.cellId,
                templateOwnerId: null,
                title: 'Focused source material'
            })
            expect(sourceMaterial?.body).toEqual(authoredMaterialBody)
            await page.goto(`/a/${imported.applicationId}`)
            await expectSingleSystemMatrix(page)
            await page.getByTestId('interpretation-network-structure-pane').getByRole('button', { name: 'Save as template' }).click()
            const materialSaveDialog = page.getByRole('dialog', { name: 'Save structure as template' })
            await expect(materialSaveDialog).toBeVisible()
            await materialSaveDialog.getByRole('textbox', { name: 'Template name' }).first().fill('Materials template')
            await materialSaveDialog.getByRole('textbox', { name: 'Description' }).first().fill('Template with materials')
            await materialSaveDialog.getByRole('radio', { name: 'Structure and materials' }).check()
            await materialSaveDialog.getByRole('button', { name: 'Save' }).click()
            await expect(materialSaveDialog).toHaveCount(0)

            const templatesWithMaterials = await listTemplates(api, imported.applicationId, runtimeIds.workspaceId)
            const materialsTemplate = templatesWithMaterials.find((template) => readLocalizedText(template.name) === 'Materials template')
            expect(materialsTemplate?.includesMaterials).toBe(true)
            expect(materialsTemplate?.id).toMatch(uuidV7Pattern)
            const materialsDetail = await getTemplateDetail(api, imported.applicationId, runtimeIds.workspaceId, materialsTemplate!.id)
            expect(materialsDetail.matrix.cellCount).toBeGreaterThan(0)
            expect(materialsDetail.materialCount).toBeGreaterThan(0)
            const templateRows = await getTemplateMatrixRows(api, imported.applicationId, runtimeIds, materialsTemplate!.id)
            const templateMaterialMatrixRow = findMatrixRowByTitle(templateRows, 'Universe')
            expect(templateMaterialMatrixRow.rowId).toMatch(uuidV7Pattern)
            expect(templateMaterialMatrixRow.rowId).not.toBe(sourceMaterialCell.rowId)
            expect(templateMaterialMatrixRow.cellId).toMatch(uuidV7Pattern)
            expect(templateMaterialMatrixRow.cellId).not.toBe(sourceMaterialCell.cellId)
            expect(templateMaterialMatrixRow.materialRef).toMatch(uuidV7Pattern)
            expect(templateMaterialMatrixRow.materialRef).not.toBe(createdSourceMaterial.id)
            const templateMaterial = (await getMaterialRows(api, imported.applicationId, runtimeIds)).find(
                (material) => material.rowId === templateMaterialMatrixRow.materialRef
            )
            expect(templateMaterial).toBeDefined()
            expect(templateMaterial!.rowId).toMatch(uuidV7Pattern)
            expect(templateMaterial).toMatchObject({
                cellId: templateMaterialMatrixRow.cellId,
                templateOwnerId: materialsTemplate!.id,
                title: sourceMaterial?.title,
                description: sourceMaterial?.description,
                body: sourceMaterial?.body
            })

            await setInterpretationNetworkWidgetConfig(api, imported.applicationId, { structureMode: 'multiple' })
            const createdFromMaterials = await instantiateTemplate(
                api,
                imported.applicationId,
                runtimeIds.workspaceId,
                materialsTemplate!,
                'From materials template'
            )
            const copiedMaterialsRows = await getMatrixRows(api, imported.applicationId, runtimeIds, createdFromMaterials.interpretationId)
            expect(copiedMaterialsRows.length).toBe(materialsDetail.matrix.cellCount)
            expect(copiedMaterialsRows.map((row) => row.id)).not.toEqual(sourceMatrixRowsBefore.map((row) => row.id))
            expect(copiedMaterialsRows.map((row) => row.id)).not.toContain(system.interpretationId)
            const clonedMaterialMatrixRow = findMatrixRowByTitle(copiedMaterialsRows, 'Universe')
            expect(clonedMaterialMatrixRow.rowId).toMatch(uuidV7Pattern)
            expect(clonedMaterialMatrixRow.rowId).not.toBe(sourceMaterialCell.rowId)
            expect(clonedMaterialMatrixRow.rowId).not.toBe(templateMaterialMatrixRow.rowId)
            expect(clonedMaterialMatrixRow.cellId).toMatch(uuidV7Pattern)
            expect(clonedMaterialMatrixRow.cellId).not.toBe(sourceMaterialCell.cellId)
            expect(clonedMaterialMatrixRow.cellId).not.toBe(templateMaterialMatrixRow.cellId)
            expect(clonedMaterialMatrixRow.materialRef).toMatch(uuidV7Pattern)
            expect(clonedMaterialMatrixRow.materialRef).not.toBe(createdSourceMaterial.id)
            expect(clonedMaterialMatrixRow.materialRef).not.toBe(templateMaterialMatrixRow.materialRef)
            const clonedMaterial = (await getMaterialRows(api, imported.applicationId, runtimeIds)).find(
                (material) => material.rowId === clonedMaterialMatrixRow.materialRef
            )
            expect(clonedMaterial).toBeDefined()
            expect(clonedMaterial!.rowId).toMatch(uuidV7Pattern)
            expect(clonedMaterial).toMatchObject({
                cellId: clonedMaterialMatrixRow.cellId,
                templateOwnerId: null,
                title: sourceMaterial?.title,
                description: sourceMaterial?.description,
                body: sourceMaterial?.body
            })

            const sourceMatrixRowsAfter = await getMatrixRows(api, imported.applicationId, runtimeIds, system.interpretationId)
            expect(sourceMatrixRowsAfter).toEqual(sourceRowsWithMaterial)
            expect(await getTemplateMatrixRows(api, imported.applicationId, runtimeIds, materialsTemplate!.id)).toEqual(templateRows)
            const sourceMaterialAfter = (await getMaterialRows(api, imported.applicationId, runtimeIds)).find(
                (material) => material.rowId === createdSourceMaterial.id
            )
            expect(sourceMaterialAfter).toEqual(sourceMaterial)

            await page.goto(`/a/${imported.applicationId}`)
            await openStructures(page)
            await expect(page.getByTestId('interpretation-network-structure-pane')).toBeVisible({ timeout: 30_000 })
            const structurePane = page.getByTestId('interpretation-network-structure-pane')
            await structurePane.getByRole('tab', { name: 'Templates' }).click()
            const templateTable = structurePane.getByTestId('interpretation-network-template-table')
            await expect(templateTable).toBeVisible()
            await expect(templateTable).toContainText('Materials template')

            const structuresTab = structurePane.getByRole('tab', { name: 'Structures' })
            await structuresTab.click()
            const createButton = structurePane.getByRole('button', { name: 'Create', exact: true })
            await expect(createButton).toBeVisible()
            await createButton.focus()
            await expect(createButton).toBeFocused()
            await page.keyboard.press('Enter')
            const createDialog = page.getByRole('dialog', { name: 'Create structure' })
            await expect(createDialog).toBeVisible()
            const createTemplatesTab = createDialog.getByRole('tab', { name: 'Templates' })
            await createTemplatesTab.focus()
            await expect(createTemplatesTab).toBeFocused()
            await page.keyboard.press('Enter')
            await expect(createTemplatesTab).toHaveAttribute('aria-selected', 'true')
            await createDialog.getByRole('combobox', { name: 'Template' }).click()
            await page.getByRole('option', { name: /Materials template/ }).click()
            await createDialog.getByRole('textbox', { name: 'Name' }).first().fill('Created through template dialog')
            await createDialog.getByRole('textbox', { name: 'Description' }).first().fill('Created by the browser lifecycle flow')
            await addRussianVariant(page, createDialog.getByRole('textbox', { name: 'Name' }).first(), 'Создано из шаблона')
            await addRussianVariant(page, createDialog.getByRole('textbox', { name: 'Description' }).first(), 'Описание новой структуры')
            await expect(createDialog.getByRole('textbox', { name: 'Description' }).first()).toHaveAttribute('rows')
            await expect(createDialog.getByRole('table', { name: 'Template creation details' })).toBeVisible()
            await captureDialogViewports(page, testInfo, createDialog, 'interpretation-network-create-from-template-dialog', [
                'Cancel',
                'Create'
            ])
            await expectDialogKeyboardFocusContainment(page, createDialog, 'Create')
            await page.keyboard.press('Escape')
            await expect(createDialog).toHaveCount(0)
            await expect(createButton).toBeFocused()
            await structurePane.getByRole('tab', { name: 'Templates' }).click()
            await expect(templateTable).toBeVisible()

            await openTemplateAction(page, 'Materials template', 'Open')
            const detailDialog = page.getByRole('dialog', { name: 'Materials template' })
            await expect(detailDialog).toBeVisible()
            await expect(detailDialog).toContainText('Structure and materials')
            await captureDialogViewports(page, testInfo, detailDialog, 'interpretation-network-template-details-dialog', ['Close'])
            await detailDialog.getByRole('button', { name: 'Close' }).click()
            await expect(detailDialog).toHaveCount(0)

            await openTemplateAction(page, 'Materials template', 'Edit')
            const editDialog = page.getByRole('dialog', { name: 'Edit template' })
            await expect(editDialog).toBeVisible()
            await expect(editDialog.getByRole('combobox', { name: 'Saved data' })).toHaveCount(0)
            await expect(editDialog.getByRole('textbox', { name: 'Description' })).toHaveAttribute('rows', '3')
            await editDialog.getByRole('textbox', { name: 'Template name' }).first().fill('Edited materials template')
            await addRussianVariant(page, editDialog.getByRole('textbox', { name: 'Description' }).first(), 'Описание шаблона')
            await captureDialogViewports(page, testInfo, editDialog, 'interpretation-network-edit-template-dialog', ['Cancel', 'Save'])
            await editDialog.getByRole('button', { name: 'Save' }).click()
            await expect(editDialog).toHaveCount(0)
            await expect(templateTable).toContainText('Edited materials template')

            await openTemplateAction(page, 'Edited materials template', 'Delete')
            const deleteDialog = page.getByRole('dialog', { name: 'Delete template?' })
            await expect(deleteDialog).toBeVisible()
            await expect(deleteDialog).toContainText('Structures created from this template are not changed.')
            await expect(deleteDialog.getByRole('button', { name: /fullscreen|resize/i })).toHaveCount(0)
            await captureDialogViewports(page, testInfo, deleteDialog, 'interpretation-network-delete-template-dialog', [
                'Cancel',
                'Delete'
            ])
            await deleteDialog.getByRole('button', { name: 'Delete' }).click()
            await expect(deleteDialog).toHaveCount(0)
            await expect(templateTable).not.toContainText('Edited materials template')
            await expectNoTechnicalLeakage(page.getByRole('main'), {
                label: 'Interpretation Network focused template management',
                checkUuidSubstrings: true
            })
            await expectNoPageHorizontalOverflow(page, 'Interpretation Network focused template management')
            const screenshot = await page.screenshot({ fullPage: true, animations: 'disabled' })
            await testInfo.attach('interpretation-network-template-management', { body: screenshot, contentType: 'image/png' })
        } finally {
            await disposeApiContext(api)
        }
    })
})
