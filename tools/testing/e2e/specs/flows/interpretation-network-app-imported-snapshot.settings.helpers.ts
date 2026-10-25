// Focused helpers for the imported Interpretation Network snapshot flow.

import { expect } from '../../fixtures/test'

import type { Locator, Page, TestInfo } from '@playwright/test'

import { listApplicationWorkspaces, sendWithCsrf } from '../../support/backend/api-session.mjs'

import { waitForSettledMutationResponse } from '../../support/browser/network'

import { applyBrowserPreferences } from '../../support/browser/preferences'

import {
    expectLocatorFullyFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix
} from '../../support/browser/runtimeUx'
import { attachDialogViewportEvidence, attachViewportEvidence, resolveRuntimeIds } from '../../support/interpretationNetworkFocused'

import type { ApiContext } from './interpretation-network-app-imported-snapshot.shared.helpers'

import {
    matchesApplicationLayoutWidgetConfigUpdate,
    matchesApplicationLayoutWidgetConfigReset
} from './interpretation-network-app-imported-snapshot.shared.helpers'

import {
    expectInterpretationNetworkStartPage,
    expectSingleSystemMatrixWorkspace,
    expectMultipleStructuresWorkspace,
    attachRuntimeScreenshot
} from './interpretation-network-app-imported-snapshot.navigation.helpers'

type LocatorBoundingBox = NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>

const expectPopoverAnchoredToTrigger = async (popover: Locator, triggerBox: LocatorBoundingBox | null, label: string): Promise<void> => {
    await expectLocatorFullyFitsViewport(popover, label)
    const popoverBox = await popover.boundingBox()
    expect(popoverBox, `${label} must have viewport geometry`).not.toBeNull()
    expect(triggerBox, `${label} trigger must have viewport geometry`).not.toBeNull()
    if (!popoverBox || !triggerBox) return

    expect(
        Math.abs(popoverBox.x + popoverBox.width - (triggerBox.x + triggerBox.width)),
        `${label} stays aligned to its trigger`
    ).toBeLessThanOrEqual(16)
    const popoverAboveGap = Math.abs(popoverBox.y + popoverBox.height - triggerBox.y)
    const popoverBelowGap = Math.abs(popoverBox.y - (triggerBox.y + triggerBox.height))
    const verticalOverlap =
        Math.min(popoverBox.y + popoverBox.height, triggerBox.y + triggerBox.height) - Math.max(popoverBox.y, triggerBox.y)
    expect(verticalOverlap, `${label} does not cover its trigger`).toBeLessThanOrEqual(1)
    expect(Math.min(popoverAboveGap, popoverBelowGap), `${label} remains near its trigger`).toBeLessThanOrEqual(32)
}

export const expectInterpretationNetworkMatrixSettings = async (page: Page, applicationId: string, testInfo: TestInfo): Promise<void> => {
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('tab', { name: 'Matrix' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Learning Content' })).toHaveCount(0)
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('tab', { name: 'Matrix' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Structure mode' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Hierarchical cells' })).toHaveCount(0)
    await expectNoTechnicalLeakage(page.getByRole('main'), {
        label: 'Interpretation Network application Matrix settings',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network application Matrix settings')
    await attachRuntimeScreenshot(page, testInfo, 'application-settings-matrix-desktop-1280')
    await expectRuntimeUxViewportMatrix(page, 'Interpretation Network application Matrix settings', {
        beforeEachViewport: async () => {
            await page.goto(`/a/${applicationId}/admin/settings`)
            await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
            await page.getByRole('tab', { name: 'Matrix' }).click()
            await expect(page.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible({ timeout: 30_000 })
        }
    })

    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('tab', { name: 'Matrix' }).click()

    const structureMode = page.getByRole('combobox', { name: 'Structure mode' })
    const showNextToMatrix = page.getByRole('checkbox', { name: 'Show next to Matrix' })
    await expect(structureMode).toContainText('Multiple structures')
    await expect(showNextToMatrix).toBeChecked()
    await structureMode.click()
    await page.getByRole('option', { name: 'One system structure' }).click()

    const singleSystemResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => matchesApplicationLayoutWidgetConfigUpdate(response, applicationId),
        { label: 'Saving the One system structure application setting' }
    )
    await page.getByTestId('application-settings-matrix-save').click()
    const singleSystemResponse = await singleSystemResponsePromise
    expect(singleSystemResponse.ok(), 'Saving One system structure must succeed').toBe(true)
    const singleSystemPayload = singleSystemResponse.request().postDataJSON() as {
        updates?: Array<{ config?: Record<string, unknown> }>
    }
    expect(singleSystemPayload.updates?.length, 'One system structure must update inherited widgets').toBeGreaterThan(0)
    for (const update of singleSystemPayload.updates ?? []) {
        expect(update.config).toEqual(expect.objectContaining({ structureMode: 'singleSystem' }))
    }

    await page.reload()
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('combobox', { name: 'Structure mode' })).toContainText('One system structure')
    await expect(page.getByRole('checkbox', { name: 'Show next to Matrix' })).toBeChecked()

    await page.goto(`/a/${applicationId}?targetKind=object&entityTypeCodename=Structure`)
    await expectSingleSystemMatrixWorkspace(page)
    await attachRuntimeScreenshot(page, testInfo, 'application-settings-single-system-runtime-desktop-1280')

    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('combobox', { name: 'Structure mode' })).toContainText('One system structure')
    await structureMode.click()
    await page.getByRole('option', { name: 'Multiple structures' }).click()
    await showNextToMatrix.uncheck()

    const overrideResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => matchesApplicationLayoutWidgetConfigUpdate(response, applicationId),
        { label: 'Overriding inherited Interpretation Network settings before reset' }
    )
    await page.getByTestId('application-settings-matrix-save').click()
    const overrideResponse = await overrideResponsePromise
    expect(overrideResponse.ok(), 'Application Matrix override must succeed before reset').toBe(true)
    const overridePayload = overrideResponse.request().postDataJSON() as {
        updates?: Array<{ config?: Record<string, unknown> }>
    }
    expect(overridePayload.updates?.length, 'Application Matrix override must update inherited widgets').toBeGreaterThan(0)
    for (const update of overridePayload.updates ?? []) {
        expect(update.config).toEqual(
            expect.objectContaining({
                structureMode: 'multiple',
                templatePanel: expect.objectContaining({ showInMatrix: false })
            })
        )
    }
    await expect(page.getByTestId('application-settings-matrix-reset')).toBeVisible({ timeout: 30_000 })

    await page.reload()
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('combobox', { name: 'Structure mode' })).toContainText('Multiple structures')
    await expect(page.getByRole('checkbox', { name: 'Show next to Matrix' })).not.toBeChecked()

    await page.goto(`/a/${applicationId}`)
    await expectInterpretationNetworkStartPage(page)
    const overriddenStructurePane = page.getByTestId('interpretation-network-structure-pane')
    await expect(overriddenStructurePane.getByRole('heading', { name: 'Structures' })).toBeVisible({ timeout: 30_000 })
    await expect(overriddenStructurePane.getByRole('button', { name: 'Create', exact: true })).toBeVisible()
    await expect(overriddenStructurePane.getByRole('tab', { name: 'Templates' })).toBeVisible()
    await expect(overriddenStructurePane.getByRole('tab', { name: 'Matrix' })).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page, 'Interpretation Network application override runtime')

    await page.goto(`/a/${applicationId}/admin/settings`)
    await page.getByRole('tab', { name: 'Matrix' }).click()
    const resetResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => matchesApplicationLayoutWidgetConfigReset(response, applicationId),
        { label: 'Restoring inherited Interpretation Network settings' }
    )
    await page.getByTestId('application-settings-matrix-reset').click()
    const resetResponse = await resetResponsePromise
    expect(resetResponse.ok(), 'Restoring inherited Interpretation Network settings must succeed').toBe(true)
    const resetPayload = resetResponse.request().postDataJSON() as {
        updates?: Array<{ layoutId?: string; widgetId?: string; expectedVersion?: number; config?: unknown }>
    }
    expect(resetPayload.updates?.length, 'Reset must include every inherited Interpretation Network widget').toBeGreaterThan(0)
    for (const update of resetPayload.updates ?? []) {
        expect(update).toEqual({
            layoutId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
            widgetId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
            expectedVersion: expect.any(Number)
        })
        expect(update.expectedVersion).toBeGreaterThan(0)
        expect(update).not.toHaveProperty('config')
    }
    const resetBody = (await resetResponse.json()) as {
        items?: Array<{ config?: Record<string, unknown>; sourceConfig?: Record<string, unknown> | null; isCustomized?: boolean }>
    }
    expect(resetBody.items?.length, 'Reset response must return restored widgets').toBe(resetPayload.updates?.length)
    for (const item of resetBody.items ?? []) {
        expect(item.isCustomized).toBe(false)
        expect(item.config).toEqual(expect.objectContaining({ structureMode: 'multiple' }))
        expect(item.config?.templatePanel).toEqual(expect.objectContaining({ showInStructureList: true, showInMatrix: true }))
        expect(item.config).toEqual(item.sourceConfig)
    }
    await expect(page.getByText('Metahub settings restored')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('application-settings-matrix-reset')).toHaveCount(0, { timeout: 30_000 })

    await page.reload()
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('combobox', { name: 'Structure mode' })).toContainText('Multiple structures')
    await expect(page.getByRole('checkbox', { name: 'Show next to Matrix' })).toBeChecked()

    await page.goto(`/a/${applicationId}`)
    await expectInterpretationNetworkStartPage(page)
    await expectMultipleStructuresWorkspace(page)
    await expectNoPageHorizontalOverflow(page, 'Restored Interpretation Network metahub settings runtime')
    await attachRuntimeScreenshot(page, testInfo, 'application-settings-matrix-reset-runtime-desktop-1280')
}

export const expectMetahubAggregateWidgetSettings = async (page: Page, metahubId: string, testInfo: TestInfo): Promise<void> => {
    await page.goto(`/metahub/${metahubId}/settings`)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('tab', { name: 'Layouts and widgets' })).toBeVisible()
    await page.getByRole('tab', { name: 'Layouts and widgets' }).click()

    const main = page.getByRole('main')
    await expect(main.getByText('Interpretation network workspace').first()).toBeVisible({ timeout: 30_000 })
    await expect(main.getByText(/Matrix mode:/).first()).toBeVisible()
    await expect(main.getByRole('button', { name: 'Edit settings' }).first()).toBeVisible()
    await expectNoTechnicalLeakage(main, {
        label: 'Metahub aggregate layout widget settings',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await expectNoPageHorizontalOverflow(page, 'Metahub aggregate layout widget settings')
    await attachRuntimeScreenshot(page, testInfo, 'metahub-settings-layout-widgets-desktop-1280')

    await main.getByRole('button', { name: 'Edit settings' }).first().click()
    const dialog = page.getByRole('dialog', { name: /^Interpretation network workspace\b/u })
    await expect(dialog.getByRole('heading', { name: /^Interpretation network workspace\b/u })).toBeVisible({ timeout: 30_000 })
    await expect(dialog.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible()
    await expect(dialog.getByText('Raw JSON')).toHaveCount(0)
    await expectNoTechnicalLeakage(dialog, {
        label: 'Metahub aggregate layout widget editor',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })

    const customColorInput = page.getByTestId('interpretation-network-custom-cell-color')
    const accessibleCustomColorPickerButton = dialog.getByRole('button', { name: 'Choose custom color', exact: true })
    const customColorPickerButton = accessibleCustomColorPickerButton
    const customColorPicker = page.getByRole('dialog', { name: 'Choose custom color', exact: true })
    await expect(accessibleCustomColorPickerButton, 'The swatch button has an accessible name before opening the picker').toBeVisible()
    await customColorInput.fill('#336C9E')
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await page.setViewportSize(viewport)
        await customColorInput.scrollIntoViewIfNeeded()
        const field = customColorInput.locator('xpath=..')
        const [fieldBox, pickerButtonBox] = await Promise.all([field.boundingBox(), customColorPickerButton.boundingBox()])
        expect(fieldBox, `Metahub color field at ${viewport.width}px must be rendered`).not.toBeNull()
        expect(pickerButtonBox, `Metahub color picker button at ${viewport.width}px must be rendered`).not.toBeNull()
        if (fieldBox && pickerButtonBox) {
            expect(pickerButtonBox.x, `Color picker button at ${viewport.width}px must stay inside its field`).toBeGreaterThanOrEqual(
                fieldBox.x + 2
            )
            expect(pickerButtonBox.y, `Color picker button at ${viewport.width}px must stay inside its field`).toBeGreaterThanOrEqual(
                fieldBox.y + 2
            )
            expect(
                pickerButtonBox.x + pickerButtonBox.width,
                `Color picker button at ${viewport.width}px must remain inset from its field edge`
            ).toBeLessThanOrEqual(fieldBox.x + fieldBox.width - 2)
            expect(
                pickerButtonBox.y + pickerButtonBox.height,
                `Color picker button at ${viewport.width}px must remain inset from its field edge`
            ).toBeLessThanOrEqual(fieldBox.y + fieldBox.height - 2)
            expect(
                pickerButtonBox.width,
                `Color picker button at ${viewport.width}px must retain a compact 32px square hit target`
            ).toBeCloseTo(32, 0)
            expect(
                pickerButtonBox.height,
                `Color picker button at ${viewport.width}px must retain a compact 32px square hit target`
            ).toBeCloseTo(32, 0)
            expect(
                Math.abs(pickerButtonBox.y + pickerButtonBox.height / 2 - (fieldBox.y + fieldBox.height / 2)),
                `Color picker button at ${viewport.width}px must be vertically centered inside its field`
            ).toBeLessThanOrEqual(1)
            const swatchBox = await customColorPickerButton.locator('[aria-hidden="true"]').boundingBox()
            expect(swatchBox, `Color picker button at ${viewport.width}px must show the selected swatch`).not.toBeNull()
            if (swatchBox) {
                expect(Math.abs(swatchBox.x + swatchBox.width / 2 - (pickerButtonBox.x + pickerButtonBox.width / 2))).toBeLessThanOrEqual(1)
                expect(Math.abs(swatchBox.y + swatchBox.height / 2 - (pickerButtonBox.y + pickerButtonBox.height / 2))).toBeLessThanOrEqual(
                    1
                )
            }
        }

        await attachRuntimeScreenshot(page, testInfo, `metahub-widget-editor-color-field-${viewport.width}px`)
        await customColorPickerButton.click()
        await expect(customColorPicker.getByRole('slider', { name: 'Hue', exact: true })).toBeVisible()
        await expect(customColorPicker).not.toContainText('RGB')
        await expectPopoverAnchoredToTrigger(
            customColorPicker,
            pickerButtonBox,
            `Metahub widget editor color picker at ${viewport.width}px`
        )
        await expectNoPageHorizontalOverflow(page, `Metahub widget editor color picker at ${viewport.width}px`)
        await attachDialogViewportEvidence(page, testInfo, customColorPicker, 'metahub-widget-editor-color-picker', viewport)
        await page.keyboard.press('Escape')
        await expect(customColorPicker).toHaveCount(0)
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    const invalidColorMessage = 'Enter a valid HEX color, such as #336C9E.'
    const addCustomColorButton = dialog.getByRole('button', { name: 'Add custom color', exact: true })
    await customColorInput.fill('#GGGGGG')
    await expect(dialog.getByText(invalidColorMessage, { exact: true })).toBeVisible()
    await expect(addCustomColorButton).toBeDisabled()
    await customColorInput.fill('#336C9E')
    await expect(dialog.getByText(invalidColorMessage, { exact: true })).toHaveCount(0)
    await expect(addCustomColorButton).toBeEnabled()

    await customColorPickerButton.click()
    await expect(customColorPicker).toBeVisible()
    const hueSlider = customColorPicker.getByRole('slider', { name: 'Hue', exact: true })
    await expect(hueSlider).toBeVisible()
    await hueSlider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(customColorInput).not.toHaveValue('#336C9E')
    const pickedColor = await customColorInput.inputValue()
    expect(pickedColor, 'A picker interaction writes an uppercase HEX value to its field').toMatch(/^#[0-9A-F]{6}$/u)
    await page.keyboard.press('Escape')
    await expect(customColorPicker).toHaveCount(0)
    await addCustomColorButton.click()
    await expect(dialog.getByText(pickedColor, { exact: true })).toBeVisible()

    const saveColorResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => {
            const pathname = new URL(response.url()).pathname
            return (
                response.request().method() === 'PATCH' &&
                pathname.startsWith(`/api/v1/metahub/${metahubId}/layout/`) &&
                pathname.endsWith('/config')
            )
        },
        { label: 'Saving a custom HEX color from the metahub widget editor' }
    )
    await dialog.getByRole('button', { name: 'Save', exact: true }).click()
    const saveColorResponse = await saveColorResponsePromise
    expect(saveColorResponse.ok(), 'Saving a custom HEX color from the metahub widget editor must succeed').toBe(true)
    const saveColorPayload = saveColorResponse.request().postDataJSON() as {
        config?: { cellStylePolicy?: { allowedColors?: string[] } }
    }
    expect(saveColorPayload.config?.cellStylePolicy?.allowedColors).toContain(pickedColor)
    await expect(dialog).toHaveCount(0)

    await main.getByRole('button', { name: 'Edit settings' }).first().click()
    await expect(dialog.getByText(pickedColor, { exact: true })).toBeVisible({ timeout: 30_000 })
    await attachRuntimeScreenshot(page, testInfo, 'metahub-aggregate-widget-editor-desktop-1280')
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
}

export const expectApplicationLayoutWidgetSettings = async (page: Page, applicationId: string, testInfo: TestInfo): Promise<void> => {
    await page.goto(`/a/${applicationId}/admin/layouts`)
    await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible({ timeout: 30_000 })
    await page.getByTestId('application-layouts-list-content').getByRole('button', { name: 'Structures workspace', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Structures workspace' })).toBeVisible({ timeout: 30_000 })

    const main = page.getByRole('main')
    await expect(main.getByText('Target: Object: Structures', { exact: true })).toBeVisible()
    const widgetCard = main
        .getByTestId(/^layout-widget-/)
        .filter({ hasText: 'Interpretation network workspace' })
        .first()
    await expect(widgetCard).toBeVisible({ timeout: 30_000 })
    await expect(widgetCard.getByText('Inherited from metahub')).toBeVisible()
    await expect(widgetCard.getByText('Raw JSON')).toHaveCount(0)

    await widgetCard.getByRole('button', { name: 'Edit widget: Interpretation network workspace', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Interpretation network workspace' })
    await expect(dialog).toBeVisible({ timeout: 30_000 })
    await expect(dialog.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible()
    await expect(dialog.getByText('Raw JSON')).toHaveCount(0)
    await expectNoTechnicalLeakage(dialog, {
        label: 'Application layout widget typed settings editor',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await attachRuntimeScreenshot(page, testInfo, 'application-layout-widget-settings-dialog-desktop-1280')
    for (const viewport of [
        { name: 'desktop-1920', width: 1920, height: 1080 },
        { name: 'tablet-768', width: 768, height: 1024 },
        { name: 'mobile-390', width: 390, height: 844 }
    ]) {
        await attachDialogViewportEvidence(page, testInfo, dialog, 'application-layout-widget-settings-dialog', viewport, [
            'Cancel',
            'Save'
        ])
        await expect(dialog.getByRole('combobox', { name: 'Matrix mode' })).toBeVisible()
        await expectNoTechnicalLeakage(dialog, {
            label: `Application layout widget settings dialog ${viewport.name}`,
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
    }
    await page.setViewportSize({ width: 1280, height: 900 })
    await dialog.getByRole('button', { name: 'Cancel' }).click()
    await expect(dialog).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page, 'Application layout widget settings')
}

export const expectWorkspaceSettingsLocalized = async (
    page: Page,
    api: ApiContext,
    applicationId: string,
    testInfo: TestInfo
): Promise<void> => {
    const workspaces = await listApplicationWorkspaces(api, applicationId)
    const workspaceItems = Array.isArray(workspaces?.items) ? workspaces.items : []
    const workspaceId = workspaceItems.find((workspace: { id?: string; isDefault?: boolean }) => workspace.isDefault === true)?.id
    if (typeof workspaceId !== 'string') {
        throw new Error('Interpretation Network workspace settings proof requires a default workspace id')
    }

    const runtimeIds = await resolveRuntimeIds(api, applicationId, workspaceId)

    const application = await sendWithCsrf(api, 'PATCH', `/api/v1/applications/${applicationId}`, {
        settings: {
            workspaceOverrides: {
                allowedAddresses: [
                    ...['sectionLinksEnabled', 'dashboardDefaultMode', 'workspaceOpenBehavior'].map((key) => ({
                        key,
                        target: { kind: 'global' }
                    })),
                    ...[
                        'interpretationNetwork.cellStylePolicy.allowedColors',
                        'interpretationNetwork.cellStylePolicy.allowCustomColors',
                        'interpretationNetwork.cellStylePolicy.editable.fillColor'
                    ].map((key) => ({ key, target: { kind: 'widget', instanceKey: runtimeIds.instanceKey } }))
                ],
                lockedAddresses: []
            }
        }
    })
    if (!application.ok) {
        throw new Error(`Updating application workspace override policy failed with ${application.status}: ${await application.text()}`)
    }

    await applyBrowserPreferences(page, { language: 'ru' })
    const workspaceSettingsTarget = new URLSearchParams({
        targetKind: 'object',
        entityTypeId: runtimeIds.entityTypeId,
        locale: 'ru',
        themeVariant: 'light'
    })
    await page.goto(`/a/${applicationId}/workspaces/${workspaceId}/settings?${workspaceSettingsTarget}`)
    const main = page.getByRole('main')
    await expect(page.getByTestId('runtime-workspaces-page')).toBeVisible({ timeout: 30_000 })
    await expect(main.getByRole('heading', { name: /Настройки/ })).toBeVisible()
    await expect(main.getByRole('heading', { name: 'Индивидуальные ссылки разделов' })).toBeVisible()
    await expect(main.getByRole('heading', { name: 'Стартовый дашборд runtime' })).toBeVisible()
    await expect(main.getByRole('heading', { name: 'Открытие рабочего пространства' })).toBeVisible()
    await expect(main.getByRole('combobox', { name: 'Стартовый дашборд runtime' })).toBeVisible()
    const widgetSettings = main.getByTestId('runtime-workspace-widget-settings')
    await expect(widgetSettings.getByRole('heading', { name: 'Трактовочная сеть — Центральная зона (виджет 1)' })).toBeVisible()
    const allowedColorsCard = widgetSettings.getByTestId('runtime-workspace-widget-setting-card').filter({ hasText: 'Доступные цвета' })
    await expect(allowedColorsCard).toBeVisible()
    await expect(allowedColorsCard.getByRole('button', { name: 'Добавить цвет' })).toBeVisible()
    await expect(widgetSettings.getByRole('heading', { name: 'Разрешить произвольные цвета' })).toBeVisible()
    await expect(widgetSettings.getByRole('heading', { name: 'Разрешить менять цвет заливки' })).toBeVisible()
    await expect(main).not.toContainText(runtimeIds.instanceKey)
    await expect(main.getByText(/workspace\.settingKeys|settings\.keys/)).toHaveCount(0)
    await expectNoTechnicalLeakage(main, {
        label: 'Russian workspace settings',
        checkUuidSubstrings: true,
        checkOpaqueRuntimeHandles: true
    })
    await expectNoPageHorizontalOverflow(page, 'Russian workspace settings')
    await attachRuntimeScreenshot(page, testInfo, 'workspace-settings-ru-desktop-1280')
    for (const viewport of [
        { width: 1920, height: 1080 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 }
    ]) {
        await page.setViewportSize(viewport)
        await expect(widgetSettings).toBeVisible()
        await expect(allowedColorsCard.getByRole('button', { name: 'Добавить цвет' })).toBeVisible()
        await expectNoTechnicalLeakage(main, {
            label: `Russian workspace settings at ${viewport.width}px`,
            checkUuidSubstrings: true,
            checkOpaqueRuntimeHandles: true
        })
        await attachViewportEvidence(page, testInfo, `interpretation-network-workspace-settings-ru-${viewport.width}`, viewport)
    }
    await page.setViewportSize({ width: 1280, height: 900 })

    const addColor = allowedColorsCard.getByRole('button', { name: 'Добавить цвет' })
    await addColor.click()
    const saveColors = allowedColorsCard.getByRole('button', { name: 'Сохранить цвета' })
    await expect(saveColors).toBeEnabled()
    const updatePromise = page.waitForResponse(
        (response) =>
            response.request().method() === 'PUT' &&
            new URL(response.url()).pathname === `/api/v1/applications/${applicationId}/runtime/workspaces/${workspaceId}/settings`
    )
    await saveColors.click()
    const updateResponse = await updatePromise
    expect(updateResponse.ok(), 'Saving a Workspace-owned widget color palette must succeed').toBe(true)
    const updateBody = updateResponse.request().postDataJSON() as {
        settings?: Array<{ key?: string; target?: { kind?: string; instanceKey?: string }; value?: unknown }>
    }
    expect(updateBody.settings).toEqual([
        expect.objectContaining({
            key: 'interpretationNetwork.cellStylePolicy.allowedColors',
            target: { kind: 'widget', instanceKey: runtimeIds.instanceKey },
            value: expect.any(Array)
        })
    ])
    await expect(allowedColorsCard.getByText('Переопределено в рабочем пространстве')).toBeVisible({ timeout: 30_000 })
    await applyBrowserPreferences(page, { language: 'en' })
}

export const saveApplicationMatrixViewSettings = async (
    page: Page,
    applicationId: string,
    settings: {
        matrixMode?: 'Hierarchical cells' | 'Independent rows'
        table: boolean
        horizontalRows: boolean
        verticalTree: boolean
        defaultView: 'Table view' | 'Horizontal rows' | 'Vertical tree'
        tableProjection?: 'Hierarchy path' | 'Separate axes'
        breadcrumbDepth?: { mode: 'Full path' } | { mode: 'Last levels'; count: '1' | '2' | '3' | '4' | '5' | '6' | '8' | '10' | '12' }
        toolbarLayout?: 'Horizontal' | 'Vertical'
        showHierarchicalTableHeaders?: boolean
        showHierarchicalTableHeaderCard?: boolean
        colorBreadcrumbsByCell?: boolean
        allowNewAxesInCellDialog?: boolean
    }
): Promise<void> => {
    await page.goto(`/a/${applicationId}/admin/settings`)
    await expect(page.getByRole('heading', { name: 'Application Settings' })).toBeVisible({ timeout: 30_000 })
    await page.getByRole('tab', { name: 'Matrix' }).click()
    await expect(page.getByRole('tab', { name: 'Matrix' })).toHaveAttribute('aria-selected', 'true')

    let changed = false

    if (settings.matrixMode) {
        const matrixMode = page.getByRole('combobox', { name: 'Matrix mode' })
        if ((await matrixMode.textContent())?.trim() !== settings.matrixMode) {
            await matrixMode.click()
            await page.getByRole('option', { name: settings.matrixMode }).click()
            changed = true
        }
    }

    const setChecked = async (name: 'Table view' | 'Horizontal rows' | 'Vertical tree', checked: boolean) => {
        const checkbox = page.getByRole('checkbox', { name })
        await expect(checkbox).toBeVisible()
        if ((await checkbox.isChecked()) !== checked) {
            await checkbox.click()
            changed = true
        }
        await expect(checkbox).toBeChecked({ checked })
    }

    await setChecked('Table view', settings.table)
    await setChecked('Horizontal rows', settings.horizontalRows)
    await setChecked('Vertical tree', settings.verticalTree)
    if (settings.allowNewAxesInCellDialog !== undefined) {
        const axisDialogSwitch = page.getByTestId('application-setting-matrix-new-axes-in-cell-dialog').getByRole('switch')
        await expect(axisDialogSwitch).toBeVisible()
        if ((await axisDialogSwitch.isChecked()) !== settings.allowNewAxesInCellDialog) {
            await axisDialogSwitch.click()
            changed = true
        }
        await expect(axisDialogSwitch).toBeChecked({ checked: settings.allowNewAxesInCellDialog })
    }
    if (settings.tableProjection) {
        const tableProjection = page.getByRole('combobox', { name: 'Table projection' })
        await expect(tableProjection).toBeVisible()
        if ((await tableProjection.textContent())?.trim() !== settings.tableProjection) {
            await tableProjection.click()
            await page.getByRole('option', { name: settings.tableProjection }).click()
            changed = true
        }
    }
    if (settings.breadcrumbDepth) {
        const breadcrumbPanel = page.getByTestId('application-setting-matrix-breadcrumb-depth')
        const breadcrumbMode = breadcrumbPanel.getByRole('combobox', { name: 'Path' })
        if ((await breadcrumbMode.textContent())?.trim() !== settings.breadcrumbDepth.mode) {
            await breadcrumbMode.click()
            await page.getByRole('option', { name: settings.breadcrumbDepth.mode }).click()
            changed = true
        }
        if (settings.breadcrumbDepth.mode === 'Last levels') {
            const breadcrumbCount = breadcrumbPanel.locator('#application-settings-matrix-breadcrumb-depth-count')
            if ((await breadcrumbCount.textContent())?.trim() !== settings.breadcrumbDepth.count) {
                await breadcrumbCount.click()
                await page.getByRole('option', { name: settings.breadcrumbDepth.count, exact: true }).click()
                changed = true
            }
        }
    }
    if (settings.toolbarLayout) {
        const toolbarLayout = page.getByRole('combobox', { name: 'Toolbar layout' })
        if ((await toolbarLayout.textContent())?.trim() !== settings.toolbarLayout) {
            await toolbarLayout.click()
            await page.getByRole('option', { name: settings.toolbarLayout }).click()
            changed = true
        }
    }
    if (settings.showHierarchicalTableHeaders !== undefined) {
        const headersSwitch = page.getByTestId('application-setting-matrix-table-headers').getByRole('switch')
        await expect(headersSwitch).toBeVisible()
        if ((await headersSwitch.isChecked()) !== settings.showHierarchicalTableHeaders) {
            await headersSwitch.click()
            changed = true
        }
        await expect(headersSwitch).toBeChecked({ checked: settings.showHierarchicalTableHeaders })
    }
    if (settings.showHierarchicalTableHeaderCard !== undefined) {
        const headerCardSwitch = page.getByTestId('application-setting-matrix-table-header-card').getByRole('switch')
        await expect(headerCardSwitch).toBeVisible()
        if ((await headerCardSwitch.isChecked()) !== settings.showHierarchicalTableHeaderCard) {
            await headerCardSwitch.click()
            changed = true
        }
        await expect(headerCardSwitch).toBeChecked({ checked: settings.showHierarchicalTableHeaderCard })
    }
    if (settings.colorBreadcrumbsByCell !== undefined) {
        const breadcrumbColorsSwitch = page.getByTestId('application-setting-matrix-breadcrumb-colors').getByRole('switch')
        await expect(breadcrumbColorsSwitch).toBeVisible()
        if ((await breadcrumbColorsSwitch.isChecked()) !== settings.colorBreadcrumbsByCell) {
            await breadcrumbColorsSwitch.click()
            changed = true
        }
        await expect(breadcrumbColorsSwitch).toBeChecked({ checked: settings.colorBreadcrumbsByCell })
    }
    const defaultView = page.getByRole('combobox', { name: 'Default view' })
    if ((await defaultView.textContent())?.trim() !== settings.defaultView) {
        await defaultView.click()
        await page.getByRole('option', { name: settings.defaultView }).click()
        changed = true
    }
    if (!changed) {
        await expect(page.getByTestId('application-settings-matrix-save')).toHaveCount(0)
        return
    }

    const saveResponse = waitForSettledMutationResponse(
        page,
        (response) => matchesApplicationLayoutWidgetConfigUpdate(response, applicationId),
        { label: 'Saving Interpretation Network Matrix settings' }
    )
    await expect(page.getByTestId('application-settings-matrix-save')).toBeVisible()
    await page.getByTestId('application-settings-matrix-save').click()
    await expect((await saveResponse).ok(), 'Matrix settings widget config update must succeed').toBe(true)
    await expect(page.getByTestId('application-settings-matrix-save')).toHaveCount(0)
}
