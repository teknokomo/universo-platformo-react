import { expect, test } from '../../fixtures/test'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { createLoggedInApiContext, disposeApiContext, requestApi, sendWithCsrf } from '../../support/backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { expectLocatorFitsViewport, expectNoPageHorizontalOverflow, expectNoTechnicalLeakage } from '../../support/browser/runtimeUx'
import {
    attachDialogViewportEvidence,
    attachViewportEvidence,
    findMatrixRowByTitle,
    getMatrixRows,
    resolveRuntimeIds,
    type InterpretationNetworkApi
} from '../../support/interpretationNetworkFocused'
import {
    DESKTOP_VIEWPORT,
    getMatrixCell,
    prepareSingleSystem,
    openMatrixInTreeView,
    expectNoRuntimeLeakage
} from './interpretation-network-browser-gaps.helpers'

type MatrixWidgetTarget = {
    layoutId: string
    widgetId: string
    instanceKey: string
}

const openCellStyleDialog = async (page: Page, title: string, locale: 'en' | 'ru' = 'en'): Promise<Locator> => {
    await getMatrixCell(page, title).click()
    await page.getByRole('button', { name: `${locale === 'ru' ? 'Действия ячейки' : 'Cell actions'}: ${title}`, exact: true }).click()
    await page.getByRole('menuitem', { name: locale === 'ru' ? 'Редактировать' : 'Edit', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: locale === 'ru' ? 'Редактировать ячейку' : 'Edit cell' })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await dialog.getByRole('tab', { name: locale === 'ru' ? 'Стиль' : 'Style', exact: true }).click()
    await expect(dialog.getByTestId('interpretation-network-cell-style-editor')).toBeVisible()
    return dialog
}

const resolveMatrixWidgetTarget = async (api: InterpretationNetworkApi, applicationId: string): Promise<MatrixWidgetTarget> => {
    const runtimeIds = await resolveRuntimeIds(api, applicationId)
    expect(runtimeIds.layoutId, 'active Structure-scoped layout id').toEqual(expect.any(String))
    expect(runtimeIds.widgetId, 'Structure-scoped Interpretation Network widget id').toEqual(expect.any(String))
    expect(runtimeIds.instanceKey, 'Structure-scoped Interpretation Network widget instance key').toEqual(expect.any(String))

    return { layoutId: runtimeIds.layoutId, widgetId: runtimeIds.widgetId, instanceKey: runtimeIds.instanceKey }
}

const readRuntimeRowField = (row: Record<string, unknown>, field: string): unknown => {
    if (Object.prototype.hasOwnProperty.call(row, field)) return row[field]
    const data = row.data
    return data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>)[field] : undefined
}

const expectNewColorPickerButtonInsideField = async (container: Locator, label: string): Promise<void> => {
    const input = container.getByTestId('application-settings-cell-style-new-color')
    const field = input.locator('xpath=ancestor::*[contains(@class, "MuiOutlinedInput-root")]').first()
    const pickerButton = container.getByRole('button', { name: 'Choose color for New color (HEX)', exact: true })
    const [fieldBox, pickerBox] = await Promise.all([field.boundingBox(), pickerButton.boundingBox()])
    expect(fieldBox, `${label}: color field must be rendered`).not.toBeNull()
    expect(pickerBox, `${label}: color picker button must be rendered`).not.toBeNull()
    if (!fieldBox || !pickerBox) return

    expect(pickerBox.x, `${label}: picker button must stay within the field's left edge`).toBeGreaterThanOrEqual(fieldBox.x - 0.5)
    expect(pickerBox.y, `${label}: picker button must stay within the field's top edge`).toBeGreaterThanOrEqual(fieldBox.y - 0.5)
    expect(pickerBox.x + pickerBox.width, `${label}: picker button must stay within the field's right edge`).toBeLessThanOrEqual(
        fieldBox.x + fieldBox.width - 2
    )
    expect(pickerBox.y + pickerBox.height, `${label}: picker button must stay within the field's bottom edge`).toBeLessThanOrEqual(
        fieldBox.y + fieldBox.height - 2
    )
    expect(pickerBox.width, `${label}: compact color picker button has a stable square hit target`).toBeCloseTo(32, 0)
    expect(pickerBox.height, `${label}: compact color picker button has a stable square hit target`).toBeCloseTo(32, 0)
    expect(
        Math.abs(pickerBox.y + pickerBox.height / 2 - (fieldBox.y + fieldBox.height / 2)),
        `${label}: picker button is vertically centered in the outlined field`
    ).toBeLessThanOrEqual(1)
    const swatchBox = await pickerButton.locator('[aria-hidden="true"]').boundingBox()
    expect(swatchBox, `${label}: the color swatch is visible inside its button`).not.toBeNull()
    if (swatchBox) {
        expect(Math.abs(swatchBox.x + swatchBox.width / 2 - (pickerBox.x + pickerBox.width / 2))).toBeLessThanOrEqual(1)
        expect(Math.abs(swatchBox.y + swatchBox.height / 2 - (pickerBox.y + pickerBox.height / 2))).toBeLessThanOrEqual(1)
    }
}

test.describe('Interpretation Network browser gap coverage @flow @interpretation-network-focused', () => {
    test('applies Metahub default, Application override, and delegated Workspace cell-style policies', async ({
        page,
        runManifest
    }, testInfo: TestInfo) => {
        test.setTimeout(240_000)
        const api = await createLoggedInApiContext(runManifest.testUser)

        try {
            const { applicationId, runtimeIds, system } = await prepareSingleSystem(api, runManifest.runId, 'style-policy-chain')
            await openMatrixInTreeView(page, applicationId)

            const defaultDialog = await openCellStyleDialog(page, 'Universe')
            const defaultStyle = defaultDialog.getByTestId('interpretation-network-cell-style-editor')
            const defaultFillPresets = defaultStyle.getByRole('group', { name: 'Fill preset colors', exact: true })
            await expect(defaultFillPresets.getByRole('button')).toHaveCount(10)
            await expect(defaultStyle.getByLabel('Fill color picker', { exact: true })).toBeVisible()
            await expect(defaultFillPresets.getByRole('button', { name: 'Black', exact: true })).toBeEnabled()
            await expect(defaultFillPresets.getByRole('button', { name: 'White', exact: true })).toBeEnabled()
            await expect(defaultStyle.getByLabel('Fill Hex color', { exact: true })).toBeVisible()
            await defaultStyle.getByRole('button', { name: 'Fill color picker', exact: true }).click()
            const defaultFillPicker = page.getByRole('dialog', { name: 'Fill color picker', exact: true })
            await expect(defaultFillPicker.locator('.react-colorful')).toBeVisible()
            await expect(defaultFillPicker.getByRole('textbox')).toHaveCount(0)
            await page.keyboard.press('Escape')
            await expect(defaultFillPicker).toHaveCount(0)
            await attachViewportEvidence(page, testInfo, 'interpretation-network-style-policy-metahub-default', DESKTOP_VIEWPORT)
            await expectNoRuntimeLeakage(defaultDialog, 'Metahub default cell style policy')
            await defaultDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(defaultDialog).toHaveCount(0)

            await page.goto(`/a/${applicationId}/admin/settings`)
            await expect(page.getByRole('heading', { name: 'Application Settings', exact: true })).toBeVisible({ timeout: 30_000 })
            await page.getByRole('tab', { name: 'Matrix', exact: true }).click()
            const applicationPolicy = page.getByTestId('application-setting-matrix-cell-style-policy')
            await expect(applicationPolicy).toBeVisible()

            const fillColorSetting = applicationPolicy.getByRole('switch', { name: 'Allow fill color changes', exact: true })
            const textColorSetting = applicationPolicy.getByRole('switch', { name: 'Allow text color changes', exact: true })
            const borderColorSetting = applicationPolicy.getByRole('switch', { name: 'Allow border color changes', exact: true })
            const borderWidthSetting = applicationPolicy.getByRole('switch', { name: 'Allow border width changes', exact: true })
            const borderStyleSetting = applicationPolicy.getByRole('switch', { name: 'Allow border style changes', exact: true })
            const customColorsSetting = applicationPolicy.getByRole('switch', { name: 'Allow custom colors', exact: true })

            await expect(fillColorSetting).toBeChecked()
            await expect(textColorSetting).toBeChecked()
            await expect(borderColorSetting).toBeChecked()
            await expect(borderWidthSetting).toBeChecked()
            await expect(borderStyleSetting).toBeChecked()
            await expect(customColorsSetting).toBeChecked()

            await fillColorSetting.uncheck()
            await borderColorSetting.uncheck()
            await borderWidthSetting.uncheck()
            await borderStyleSetting.uncheck()
            await customColorsSetting.uncheck()

            const removeColorButtons = applicationPolicy.getByRole('button', { name: /^Remove / })
            await expect(removeColorButtons).toHaveCount(10)
            while ((await removeColorButtons.count()) > 1) {
                await removeColorButtons.nth(1).click()
            }
            await expect(applicationPolicy.getByText('#000000', { exact: true })).toBeVisible()
            await expect(removeColorButtons).toHaveCount(1)
            await expectNoTechnicalLeakage(applicationPolicy, {
                label: 'Application cell style policy settings',
                checkUuidSubstrings: true,
                checkOpaqueRuntimeHandles: true
            })
            for (const viewport of [
                { width: 1920, height: 1080 },
                { width: 768, height: 1024 },
                { width: 390, height: 844 }
            ]) {
                await applicationPolicy.scrollIntoViewIfNeeded()
                await attachViewportEvidence(page, testInfo, 'interpretation-network-style-policy-application-settings', viewport)
                await expectLocatorFitsViewport(applicationPolicy, `Application cell style policy at ${viewport.width}px`)
                await expectNewColorPickerButtonInsideField(applicationPolicy, `Application color field at ${viewport.width}px`)
            }
            const newColorPickerButton = applicationPolicy.getByRole('button', {
                name: 'Choose color for New color (HEX)',
                exact: true
            })
            const newColorPicker = page.getByRole('dialog', { name: 'Choose color for New color (HEX)', exact: true })
            for (const viewport of [
                { width: 1920, height: 1080 },
                { width: 768, height: 1024 },
                { width: 390, height: 844 }
            ]) {
                await page.setViewportSize(viewport)
                await newColorPickerButton.scrollIntoViewIfNeeded()
                await newColorPickerButton.click()
                await expect(newColorPicker.locator('.react-colorful')).toBeVisible()
                await expect(newColorPicker).not.toContainText('RGB')
                await expectLocatorFitsViewport(newColorPicker, `New color picker at ${viewport.width}px`)
                await expectNoPageHorizontalOverflow(page, `Open new color picker at ${viewport.width}px`)
                await attachViewportEvidence(page, testInfo, 'interpretation-network-style-policy-new-color-picker', viewport, {
                    fullPage: false
                })
                await page.keyboard.press('Escape')
                await expect(newColorPicker).toHaveCount(0)
            }
            await page.setViewportSize(DESKTOP_VIEWPORT)

            const applicationPolicySave = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'PATCH' &&
                    new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/layouts/zone-widgets/config/batch`,
                { label: 'Saving the Application cell style policy', timeout: 30_000 }
            )
            await page.getByTestId('application-settings-matrix-save').click()
            const applicationPolicyResponse = await applicationPolicySave
            expect(applicationPolicyResponse.ok(), 'Saving the Application cell style policy must succeed').toBe(true)
            const applicationPolicyPayload = applicationPolicyResponse.request().postDataJSON() as {
                updates?: Array<{ config?: Record<string, unknown> }>
            }
            expect(applicationPolicyPayload.updates?.length).toBeGreaterThan(0)
            for (const update of applicationPolicyPayload.updates ?? []) {
                expect(update.config?.cellStylePolicy).toEqual({
                    allowedColors: ['#000000'],
                    allowCustomColors: false,
                    editable: {
                        fillColor: false,
                        textColor: true,
                        borderColor: false,
                        borderWidth: false,
                        borderStyle: false
                    }
                })
            }

            await openMatrixInTreeView(page, applicationId)

            const applicationDialog = await openCellStyleDialog(page, 'Universe')
            const applicationStyle = applicationDialog.getByTestId('interpretation-network-cell-style-editor')
            const applicationFillPresets = applicationStyle.getByRole('group', { name: 'Fill preset colors', exact: true })
            const applicationTextPresets = applicationStyle.getByRole('group', { name: 'Text color preset colors', exact: true })
            await expect(applicationFillPresets.getByRole('button')).toHaveCount(1)
            await expect(applicationFillPresets.getByRole('button', { name: 'Black', exact: true })).toBeDisabled()
            await expect(applicationTextPresets.getByRole('button', { name: 'Black', exact: true })).toBeEnabled()
            await expect(applicationStyle.getByLabel('Fill color picker', { exact: true })).toHaveCount(0)
            await expect(applicationStyle.getByLabel('Text color color picker', { exact: true })).toHaveCount(0)
            await expect(
                applicationStyle
                    .getByRole('group', { name: 'All borders preset colors', exact: true })
                    .getByRole('button', { name: 'Black', exact: true })
            ).toBeDisabled()
            await expect(applicationStyle.getByRole('combobox', { name: 'Width', exact: true })).toBeDisabled()
            await expect(applicationStyle.getByRole('combobox', { name: 'Style', exact: true })).toBeDisabled()
            await attachViewportEvidence(page, testInfo, 'interpretation-network-style-policy-application-override', DESKTOP_VIEWPORT)
            await expectNoRuntimeLeakage(applicationDialog, 'Application cell style policy override')
            await applicationDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(applicationDialog).toHaveCount(0)

            const widgetTarget = await resolveMatrixWidgetTarget(api, applicationId)
            const delegateResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
                settings: {
                    workspaceOverrides: {
                        allowedAddresses: [
                            'interpretationNetwork.cellStylePolicy.allowedColors',
                            'interpretationNetwork.cellStylePolicy.allowCustomColors',
                            'interpretationNetwork.cellStylePolicy.editable.fillColor'
                        ].map((key) => ({ key, target: { kind: 'widget', instanceKey: widgetTarget.instanceKey } })),
                        lockedAddresses: []
                    }
                }
            })
            expect(delegateResponse.ok).toBe(true)

            const workspaceOverrideResponse = await sendWithCsrf(
                api,
                'PUT',
                `/api/v1/applications/${applicationId}/runtime/workspaces/${runtimeIds.workspaceId}/settings?${new URLSearchParams({
                    targetKind: 'object',
                    entityTypeId: runtimeIds.entityTypeId,
                    locale: 'en',
                    themeVariant: 'light'
                })}`,
                {
                    settings: [
                        {
                            key: 'interpretationNetwork.cellStylePolicy.allowedColors',
                            target: { kind: 'widget', instanceKey: widgetTarget.instanceKey },
                            value: ['#654321']
                        },
                        {
                            key: 'interpretationNetwork.cellStylePolicy.allowCustomColors',
                            target: { kind: 'widget', instanceKey: widgetTarget.instanceKey },
                            value: true
                        },
                        {
                            key: 'interpretationNetwork.cellStylePolicy.editable.fillColor',
                            target: { kind: 'widget', instanceKey: widgetTarget.instanceKey },
                            value: true
                        }
                    ]
                }
            )
            expect(workspaceOverrideResponse.ok).toBe(true)

            await openMatrixInTreeView(page, applicationId)
            const workspaceDialog = await openCellStyleDialog(page, 'Universe')
            const workspaceStyle = workspaceDialog.getByTestId('interpretation-network-cell-style-editor')
            const workspaceFillPresets = workspaceStyle.getByRole('group', { name: 'Fill preset colors', exact: true })
            await expect(workspaceFillPresets.getByRole('button')).toHaveCount(1)
            await expect(workspaceFillPresets.getByRole('button', { name: '#654321', exact: true })).toBeEnabled()
            await expect(workspaceStyle.getByLabel('Fill color picker', { exact: true })).toBeVisible()
            for (const viewport of [
                { width: 1920, height: 1080 },
                { width: 768, height: 1024 },
                { width: 390, height: 844 }
            ]) {
                await attachDialogViewportEvidence(
                    page,
                    testInfo,
                    workspaceDialog,
                    'interpretation-network-style-policy-workspace-override',
                    viewport,
                    ['Cancel', 'Save']
                )
                await expectLocatorFitsViewport(workspaceDialog, `Workspace cell style editor at ${viewport.width}px`)
            }
            await expectNoRuntimeLeakage(workspaceDialog, 'Workspace cell style policy override')
            await page.setViewportSize(DESKTOP_VIEWPORT)
            await workspaceFillPresets.getByRole('button', { name: '#654321', exact: true }).click()
            const styleSaveResponsePromise = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'PATCH' &&
                    new URL(response.url()).pathname.startsWith(
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells/`
                    ),
                { label: 'Saving a cell style with the delegated Workspace color', timeout: 30_000 }
            )
            await workspaceDialog.getByRole('button', { name: 'Save', exact: true }).click()
            expect((await styleSaveResponsePromise).ok(), 'A color allowed by Workspace policy must save').toBe(true)
            await expect(workspaceDialog).toHaveCount(0)

            const rowsAfterAllowedStyle = await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId)
            const universeAfterAllowedStyle = findMatrixRowByTitle(rowsAfterAllowedStyle, 'Universe')
            expect(readRuntimeRowField(universeAfterAllowedStyle.row, 'CellFillColor')).toBe('#654321')
            const persistedWorkspaceStyleDialog = await openCellStyleDialog(page, 'Universe')
            const persistedWorkspaceStyle = persistedWorkspaceStyleDialog.getByTestId('interpretation-network-cell-style-editor')
            await expect(persistedWorkspaceStyle.getByLabel('Fill Hex color', { exact: true })).toHaveValue('#654321')
            await expect(
                persistedWorkspaceStyle
                    .getByRole('group', { name: 'Fill preset colors', exact: true })
                    .getByRole('button', { name: '#654321', exact: true })
            ).toBeEnabled()
            const customHexInput = persistedWorkspaceStyle.getByLabel('Fill Hex color', { exact: true })
            await customHexInput.fill('#12abef')
            await expect(customHexInput).toHaveValue('#12ABEF')
            const customHexSaveResponsePromise = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'PATCH' &&
                    new URL(response.url()).pathname.startsWith(
                        `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells/`
                    ),
                { label: 'Saving a custom HEX color from the Workspace editor', timeout: 30_000 }
            )
            await persistedWorkspaceStyleDialog.getByRole('button', { name: 'Save', exact: true }).click()
            expect((await customHexSaveResponsePromise).ok(), 'A valid custom HEX value must persist through the runtime editor').toBe(true)
            await expect(persistedWorkspaceStyleDialog).toHaveCount(0)
            const rowsAfterCustomHex = await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId)
            expect(readRuntimeRowField(findMatrixRowByTitle(rowsAfterCustomHex, 'Universe').row, 'CellFillColor')).toBe('#12ABEF')
            const reopenedCustomHexDialog = await openCellStyleDialog(page, 'Universe')
            await expect(
                reopenedCustomHexDialog
                    .getByTestId('interpretation-network-cell-style-editor')
                    .getByLabel('Fill Hex color', { exact: true })
            ).toHaveValue('#12ABEF')
            await reopenedCustomHexDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(reopenedCustomHexDialog).toHaveCount(0)

            const rowsBeforeBypass = await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId)
            const universeBeforeBypass = findMatrixRowByTitle(rowsBeforeBypass, 'Universe')
            const bypassParams = new URLSearchParams({
                workspaceId: runtimeIds.workspaceId,
                targetKind: 'object',
                entityTypeId: runtimeIds.entityTypeId,
                layoutId: widgetTarget.layoutId,
                widgetId: widgetTarget.widgetId,
                instanceKey: widgetTarget.instanceKey,
                locale: 'en',
                themeVariant: 'light'
            })
            const bypassResponse = await sendWithCsrf(
                api,
                'PATCH',
                `/api/v1/applications/${applicationId}/runtime/interpretation-network/matrix/cells/${universeBeforeBypass.cellId}?${bypassParams}`,
                {
                    interpretationId: system.interpretationId,
                    expectedCellVersion: Number(universeBeforeBypass.row._upl_version ?? 1),
                    data: { BorderTopColor: '#654321' }
                }
            )
            expect(bypassResponse.status).toBe(403)
            expect(await getMatrixRows(api, applicationId, runtimeIds, system.interpretationId)).toEqual(rowsBeforeBypass)

            const fillColorAddress = {
                key: 'interpretationNetwork.cellStylePolicy.editable.fillColor',
                target: { kind: 'widget', instanceKey: widgetTarget.instanceKey }
            }
            const lockPolicyResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
                settings: {
                    workspaceOverrides: {
                        allowedAddresses: [
                            'interpretationNetwork.cellStylePolicy.allowedColors',
                            'interpretationNetwork.cellStylePolicy.allowCustomColors',
                            fillColorAddress.key
                        ].map((key) => ({ key, target: fillColorAddress.target })),
                        lockedAddresses: [fillColorAddress]
                    }
                }
            })
            expect(lockPolicyResponse.ok, 'The Application can lock a delegated Workspace setting').toBe(true)

            const deniedWorkspaceWrite = await sendWithCsrf(
                api,
                'PUT',
                `/api/v1/applications/${applicationId}/runtime/workspaces/${runtimeIds.workspaceId}/settings`,
                { settings: [{ ...fillColorAddress, value: false }] }
            )
            expect(deniedWorkspaceWrite.status, 'A locked Workspace setting must fail closed').toBe(403)

            const currentRuntimeTarget = new URL(page.url()).searchParams
            const workspaceSettingsTarget = new URLSearchParams()
            for (const key of ['targetKind', 'entityTypeId', 'entityTypeCodename', 'locale', 'themeVariant']) {
                const value = currentRuntimeTarget.get(key)
                if (value) workspaceSettingsTarget.set(key, value)
            }
            const lockedWorkspaceSettingsResponse = await requestApi(
                api,
                `/api/v1/applications/${applicationId}/runtime/workspaces/${runtimeIds.workspaceId}/settings?${workspaceSettingsTarget}`,
                { method: 'GET' }
            )
            expect(lockedWorkspaceSettingsResponse.status, 'The authorized Workspace settings read must succeed').toBe(200)
            const lockedWorkspaceSettings = (await lockedWorkspaceSettingsResponse.json()) as {
                widgetSettings?: Array<{ key?: string; value?: unknown }>
                effectiveWidgetConfigs?: Array<{
                    target?: { kind?: string; instanceKey?: string }
                    cellStylePolicy?: { editable?: { fillColor?: boolean } }
                }>
            }
            expect(lockedWorkspaceSettings.widgetSettings?.some((setting) => setting.key === fillColorAddress.key)).toBe(false)
            expect(lockedWorkspaceSettings.effectiveWidgetConfigs).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        target: { kind: 'widget', instanceKey: widgetTarget.instanceKey },
                        cellStylePolicy: expect.objectContaining({ editable: expect.objectContaining({ fillColor: false }) })
                    })
                ])
            )

            await openMatrixInTreeView(page, applicationId)
            const lockedDialog = await openCellStyleDialog(page, 'Universe')
            const lockedStyle = lockedDialog.getByTestId('interpretation-network-cell-style-editor')
            await expect(lockedStyle.getByLabel('Fill color picker', { exact: true })).toBeDisabled()
            await expect(lockedStyle.getByLabel('Fill Hex color', { exact: true })).toBeDisabled()
            await expect(lockedStyle.getByRole('group', { name: 'Fill preset colors', exact: true }).getByRole('button')).toBeDisabled()
            await expect(lockedStyle.getByLabel('Text color color picker', { exact: true })).toBeEnabled()
            await lockedDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(lockedDialog).toHaveCount(0)

            const unlockPolicyResponse = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
                settings: {
                    workspaceOverrides: {
                        allowedAddresses: [
                            'interpretationNetwork.cellStylePolicy.allowedColors',
                            'interpretationNetwork.cellStylePolicy.allowCustomColors',
                            fillColorAddress.key
                        ].map((key) => ({ key, target: fillColorAddress.target })),
                        lockedAddresses: []
                    }
                }
            })
            expect(unlockPolicyResponse.ok, 'The Application can unlock its delegated Workspace setting').toBe(true)

            const unlockedWorkspaceSettingsResponse = await requestApi(
                api,
                `/api/v1/applications/${applicationId}/runtime/workspaces/${runtimeIds.workspaceId}/settings?${workspaceSettingsTarget}`,
                { method: 'GET' }
            )
            expect(unlockedWorkspaceSettingsResponse.status, 'The authorized Workspace settings read must succeed after unlocking').toBe(
                200
            )
            const unlockedWorkspaceSettings = (await unlockedWorkspaceSettingsResponse.json()) as {
                widgetSettings?: Array<{ key?: string; value?: unknown }>
            }
            expect(unlockedWorkspaceSettings.widgetSettings).toContainEqual(
                expect.objectContaining({ key: fillColorAddress.key, value: true })
            )

            await openMatrixInTreeView(page, applicationId)
            const unlockedDialog = await openCellStyleDialog(page, 'Universe')
            await expect(unlockedDialog.getByLabel('Fill color picker', { exact: true })).toBeVisible()
            await expect(
                unlockedDialog
                    .getByTestId('interpretation-network-cell-style-editor')
                    .getByRole('group', { name: 'Fill preset colors', exact: true })
                    .getByRole('button', { name: '#654321', exact: true })
            ).toBeEnabled()
            await unlockedDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
            await expect(unlockedDialog).toHaveCount(0)

            await openMatrixInTreeView(page, applicationId, 'ru', 'Universe')
            const russianDialog = await openCellStyleDialog(page, 'Universe', 'ru')
            const russianStyle = russianDialog.getByTestId('interpretation-network-cell-style-editor')
            await expect(russianDialog.getByRole('tab', { name: 'Стиль', exact: true })).toBeVisible()
            await expect(russianStyle.getByLabel('Выбор цвета: Заливка', { exact: true })).toBeVisible()
            await expect(
                russianStyle
                    .getByRole('group', { name: 'Готовые цвета: Заливка', exact: true })
                    .getByRole('button', { name: '#654321', exact: true })
            ).toBeEnabled()
            await attachDialogViewportEvidence(
                page,
                testInfo,
                russianDialog,
                'interpretation-network-style-policy-workspace-override-ru',
                DESKTOP_VIEWPORT,
                ['Отмена', 'Сохранить']
            )
            await expectNoRuntimeLeakage(russianDialog, 'Russian Workspace cell style policy override')
            await russianDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
            await expect(russianDialog).toHaveCount(0)
        } finally {
            await disposeApiContext(api)
        }
    })
})
