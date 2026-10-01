import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import {
    expectLocalizedValidation,
    expectLocatorFullyFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectSemanticFieldControls,
    expectTableHorizontalScrollConstrained
} from '../browser/runtimeUx'
import {
    ensureListView,
    expectStandardDialogActionFooter,
    fillLocalizedFieldValues,
    responseIsMutation
} from '../marketingPageAuthoringHelpers'
import { expectHeroDialogButtonTextOnOneLine } from './marketingHeroAuthoringAssertions'

export async function editSeededMarketingHeroEntityRecord(options: {
    page: Page
    testInfo: TestInfo
    metahubId: string
    updatedHeroTitle: string
    updatedHeroTitleRu: string
    updatedHeroAccent: string
    updatedHeroAccentRu: string
}): Promise<void> {
    const { page, testInfo, metahubId, updatedHeroTitle, updatedHeroTitleRu, updatedHeroAccent, updatedHeroAccentRu } = options

    // Edit the dedicated Hero Entity record through the generic
    // object/record authoring surface. Hero copy no longer lives in
    // MarketingPageSiteSettings.
    await page.goto(`/metahub/${metahubId}/entities/object/instances`)
    await expect(page.getByRole('heading', { name: 'Objects', exact: true })).toBeVisible()
    await ensureListView(page, true)
    const heroEntityLink = page.getByRole('link', { name: 'Marketing hero', exact: true })
    await expect(heroEntityLink).toBeVisible()
    await heroEntityLink.click()
    await expect(page).toHaveURL(/\/components$/)
    await page.getByRole('tab', { name: 'Records', exact: true }).click()
    await expect(page).toHaveURL(/\/records$/)
    await expect(page.getByRole('heading', { name: 'Records', exact: true })).toBeVisible()

    const heroRecordRow = page.getByRole('row').filter({ hasText: 'Our latest' }).first()
    await expect(heroRecordRow).toBeVisible()
    await heroRecordRow.getByRole('button', { name: 'Options', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click()

    const recordDialog = page.getByRole('dialog', { name: /Edit (Element|Record)/ })
    await expect(recordDialog).toBeVisible()
    await expect(recordDialog.getByRole('combobox', { name: 'Action type', exact: true })).toHaveCount(2)
    await expect(recordDialog.getByRole('combobox', { name: 'Application page', exact: true })).toHaveCount(2)
    await expectNoTechnicalLeakage(recordDialog, {
        label: 'Marketing Hero record dialog',
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/^\s*(?:Published(?: at| by)?|Archived(?: at| by)?|Deleted(?: at| by)?)\s*$/imu]
    })
    await expectSemanticFieldControls(recordDialog, { longTextLabels: ['Description'] })
    await fillLocalizedFieldValues(page, recordDialog, 'Title', { en: updatedHeroTitle, ru: updatedHeroTitleRu })
    await fillLocalizedFieldValues(page, recordDialog, 'Accent', { en: updatedHeroAccent, ru: updatedHeroAccentRu })

    const recordUpdatePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
        { label: 'Updating the Marketing Hero Entity record through the generic record dialog', timeout: 90_000 }
    )
    await recordDialog.getByRole('button', { name: 'Save', exact: true }).click()
    const recordUpdateResponse = await recordUpdatePromise
    expect(recordUpdateResponse.ok()).toBe(true)
    await expect(recordDialog).toHaveCount(0)
    const updatedHeroRecordRow = page.getByRole('row').filter({ hasText: updatedHeroTitle }).first()
    await expect(updatedHeroRecordRow).toBeVisible()
    const heroRecordTable = page.getByRole('table').filter({ has: updatedHeroRecordRow }).first()
    await expect(heroRecordTable, 'The Hero Entity records list must expose its semantic table').toBeVisible()
    await expectNoTechnicalLeakage(heroRecordTable, {
        label: 'Marketing Hero Entity records table',
        checkUuidSubstrings: true
    })
    await expectRuntimeUxViewportMatrix(page, 'Marketing Hero Entity records table', {
        beforeEachViewport: async (viewport) => {
            await expect(updatedHeroRecordRow).toBeVisible()
            const createRecordAction = page.getByTestId('toolbar-primary-action')
            const recordsTabList = page.getByRole('tablist', { name: 'Object tabs', exact: true })
            const [createActionBounds, tabListBounds] = await Promise.all([createRecordAction.boundingBox(), recordsTabList.boundingBox()])
            expect(createActionBounds, 'The record creation action must be visible in every viewport').not.toBeNull()
            expect(tabListBounds, 'The object tabs must be visible in every viewport').not.toBeNull()
            if (!createActionBounds || !tabListBounds) throw new Error('Record header bounds could not be measured')
            const controlsOverlap =
                createActionBounds.x < tabListBounds.x + tabListBounds.width &&
                createActionBounds.x + createActionBounds.width > tabListBounds.x &&
                createActionBounds.y < tabListBounds.y + tabListBounds.height &&
                createActionBounds.y + createActionBounds.height > tabListBounds.y
            expect(controlsOverlap, `The Create action overlaps the object tabs at ${viewport.name}`).toBe(false)
            await expectTableHorizontalScrollConstrained(
                heroRecordTable.locator('xpath=..'),
                `Marketing Hero Entity records table at ${viewport.name}`
            )
            await expectNoTechnicalLeakage(heroRecordTable, {
                label: `Marketing Hero Entity records table at ${viewport.name}`,
                checkUuidSubstrings: true
            })
            await page.screenshot({
                path: testInfo.outputPath(`marketing-hero-records-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }
    })
}

export async function setSeededMarketingHeroSectionAction(options: {
    page: Page
    metahubId: string
    marketingLayoutId: string
    sourceHeroWidgetId: string
}): Promise<void> {
    const { page, metahubId, marketingLayoutId, sourceHeroWidgetId } = options
    // Give the seeded Hero a real section action before publication so
    // the application authoring flow can prove it refuses to hide the
    // last section that the published action targets.
    await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
    const seededHeroSurface = page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)
    const seededHeroEditAction = seededHeroSurface.getByRole('button', { name: 'Edit', exact: true })
    await seededHeroEditAction.click()
    const seededHeroBindingDialog = page.getByRole('dialog', { name: 'Hero', exact: true })
    await expect(seededHeroBindingDialog).toBeVisible()
    const seededHeroDialogAccessibility = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    expect(seededHeroDialogAccessibility.violations, JSON.stringify(seededHeroDialogAccessibility.violations)).toEqual([])
    await seededHeroBindingDialog.getByRole('button', { name: 'Edit content', exact: true }).click()
    const seededHeroRecordForm = page.getByRole('dialog', { name: /^Edit content record(?:\s|$)/u })
    await expect(seededHeroRecordForm).toBeVisible()
    const seededHeroPrimaryAction = seededHeroRecordForm.getByRole('group', { name: 'Primary action', exact: true })
    const seededHeroActionKind = seededHeroPrimaryAction.getByRole('combobox', { name: 'Action type', exact: true })
    await seededHeroActionKind.click()
    await page.getByRole('option', { name: 'Page section', exact: true }).click()
    const seededHeroActionTarget = seededHeroPrimaryAction.getByRole('combobox', { name: 'Page section', exact: true })
    await seededHeroActionTarget.click()
    await page.getByRole('option', { name: 'Features', exact: true }).click()
    await expect(seededHeroActionKind).toHaveText('Page section')
    await expect(seededHeroActionTarget).toHaveText('Features')
    const seededHeroActionSavePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
        { label: 'Binding the seeded Hero action to the active Features section', timeout: 90_000 }
    )
    await seededHeroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await seededHeroActionSavePromise).ok()).toBe(true)
    await expect(seededHeroRecordForm).toHaveCount(0)
    await expect(seededHeroBindingDialog).toBeVisible()
    await expect.poll(() => seededHeroBindingDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
    await seededHeroBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(seededHeroBindingDialog).toHaveCount(0)
    await expect(seededHeroEditAction).toBeFocused()
}

export async function verifyMarketingHeroKeyboardEditing(options: {
    page: Page
    testInfo: TestInfo
    metahubId: string
    marketingLayoutId: string
    sourceHeroWidgetId: string
    updatedHeroTitle: string
    updatedHeroTitleRu: string
}): Promise<void> {
    const { page, testInfo, metahubId, marketingLayoutId, sourceHeroWidgetId, updatedHeroTitle, updatedHeroTitleRu } = options
    await applyBrowserPreferences(page, { language: 'en' })
    await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)

    const tabTo = async (target: Locator, label: string): Promise<void> => {
        await expect(target, `${label} must be visible for keyboard navigation`).toBeVisible()
        for (let pressCount = 0; pressCount < 200; pressCount += 1) {
            if (await target.evaluate((element) => element === document.activeElement)) return
            await page.keyboard.press('Tab')
        }
        throw new Error(`Keyboard navigation did not reach ${label}`)
    }
    const expectFocusWithinDialog = async (dialog: Locator, label: string): Promise<void> => {
        await expect
            .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)), {
                message: `Keyboard focus must remain inside ${label}`
            })
            .toBe(true)
    }

    const heroSurface = page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)
    const openHeroEditor = heroSurface.getByRole('button', { name: 'Edit content', exact: true })
    const openHeroBindings = heroSurface.getByRole('button', { name: 'Edit', exact: true })
    await expect(openHeroBindings).toBeVisible()
    await tabTo(openHeroEditor, 'the direct Hero content edit action')
    await page.keyboard.press('Enter')

    const recordForm = page.getByRole('dialog', { name: /^Edit content record(?:\s|$)/u })
    await expect(recordForm).toBeVisible()
    await expect.poll(() => recordForm.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
    for (const viewport of [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectHeroDialogButtonTextOnOneLine(recordForm, `Direct Hero edit dialog at ${viewport.name}`)
        await expectLocatorFullyFitsViewport(recordForm, `Direct Hero edit dialog at ${viewport.name}`)
        await expectStandardDialogActionFooter(recordForm, `Direct Hero edit form at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Direct Hero edit form at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-hero-direct-edit-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })

    const englishTitleRow = recordForm.getByTestId('localized-inline-row-en').filter({ hasText: 'Title' })
    const russianTitleRow = recordForm.getByTestId('localized-inline-row-ru').filter({ hasText: 'Title' })
    await expect(englishTitleRow).toHaveCount(1)
    await expect(russianTitleRow).toHaveCount(1)
    const englishTitle = englishTitleRow.getByRole('textbox', { name: 'Title', exact: true })
    const russianTitle = russianTitleRow.getByRole('textbox', { name: 'Title', exact: true })
    await tabTo(englishTitle, 'the English Hero title')
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await expect(englishTitle).toHaveValue('')
    await expect(englishTitle).toHaveAttribute('aria-invalid', 'true')
    await expect(englishTitle).toBeFocused()
    await expect(recordForm.getByText('Add Title in English before saving.', { exact: true })).toBeVisible()
    await expect(recordForm.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
    await expectLocalizedValidation(recordForm, 'en', { label: 'Keyboard Hero title validation' })

    // Correct English, make Russian primary in the same form, then switch back
    // without losing either localized draft.
    await page.keyboard.press('Control+A')
    await page.keyboard.type(updatedHeroTitle)
    const russianLocaleAction = russianTitleRow.getByRole('button', { name: 'RU', exact: true })
    await tabTo(russianLocaleAction, 'the Russian locale action')
    await page.keyboard.press('Enter')
    const makeRussianPrimary = page.getByRole('menuitem', { name: 'Make primary', exact: true })
    await expect(makeRussianPrimary).toBeVisible()
    await tabTo(makeRussianPrimary, 'the Make primary menu action for Russian')
    await page.keyboard.press('Enter')
    await tabTo(russianTitle, 'the Russian Hero title')
    await page.keyboard.press('Control+A')
    await page.keyboard.type(updatedHeroTitleRu)
    const englishLocaleAction = englishTitleRow.getByRole('button', { name: 'EN', exact: true })
    await tabTo(englishLocaleAction, 'the English locale action')
    await page.keyboard.press('Enter')
    const makeEnglishPrimary = page.getByRole('menuitem', { name: 'Make primary', exact: true })
    await expect(makeEnglishPrimary).toBeVisible()
    await tabTo(makeEnglishPrimary, 'the Make primary menu action for English')
    await page.keyboard.press('Enter')
    await expect(englishTitle).toHaveValue(updatedHeroTitle)
    await expect(russianTitle).toHaveValue(updatedHeroTitleRu)

    const saveResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
        { label: 'Saving the existing Hero record through keyboard navigation', timeout: 90_000 }
    )
    await tabTo(recordForm.getByRole('button', { name: 'Save', exact: true }), 'the Hero form Save action')
    await page.keyboard.press('Enter')
    expect((await saveResponsePromise).ok()).toBe(true)
    await expect(recordForm).toHaveCount(0)
    const bindingDialog = page.getByRole('dialog', { name: 'Hero', exact: true })
    await expect(bindingDialog).toBeVisible()
    await expect(bindingDialog.getByRole('combobox', { name: 'Content source', exact: true })).toBeVisible()
    await expect(bindingDialog.getByRole('combobox', { name: 'Content record', exact: true })).toHaveValue(updatedHeroTitle)
    await expect(bindingDialog.getByRole('button', { name: 'Create content', exact: true })).toBeEnabled()
    await expect.poll(() => bindingDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
    await tabTo(bindingDialog.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero binding Cancel action')
    await page.keyboard.press('Enter')
    await expect(bindingDialog).toHaveCount(0)
    await expect(openHeroEditor).toBeFocused()

    await tabTo(openHeroEditor, 'the existing Hero edit action')
    await page.keyboard.press('Enter')
    const reopenedRecordForm = page.getByRole('dialog', { name: /^Edit content record(?:\s|$)/u })
    await expect(reopenedRecordForm).toBeVisible()
    const reopenedEnglishTitle = reopenedRecordForm
        .getByTestId('localized-inline-row-en')
        .getByRole('textbox', { name: 'Title', exact: true })
    const reopenedRussianTitle = reopenedRecordForm
        .getByTestId('localized-inline-row-ru')
        .getByRole('textbox', { name: 'Title', exact: true })
    await expect(reopenedEnglishTitle).toHaveValue(updatedHeroTitle)
    await expect(reopenedRussianTitle).toHaveValue(updatedHeroTitleRu)

    await tabTo(reopenedEnglishTitle, 'the English Hero title before cancelling')
    await page.keyboard.press('Control+A')
    await page.keyboard.type('This unsaved Hero title must be discarded')
    await tabTo(reopenedRecordForm.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero form Cancel action')
    await page.keyboard.press('Enter')
    const contentDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
    await expect(contentDiscardDialog).toBeVisible()
    await expectFocusWithinDialog(contentDiscardDialog, 'the discard confirmation dialog')
    const keepEditing = contentDiscardDialog.getByRole('button', { name: 'Keep editing', exact: true })
    await tabTo(keepEditing, 'the Keep editing confirmation action')
    await page.keyboard.press('Shift+Tab')
    await expectFocusWithinDialog(contentDiscardDialog, 'the discard confirmation dialog after Shift+Tab')
    await page.keyboard.press('Tab')
    await expectFocusWithinDialog(contentDiscardDialog, 'the discard confirmation dialog after Tab')
    await tabTo(keepEditing, 'the Keep editing confirmation action after focus cycling')
    await page.keyboard.press('Enter')
    await expect(reopenedEnglishTitle).toHaveValue('This unsaved Hero title must be discarded')
    await expect(reopenedRecordForm).toBeVisible()
    await expectFocusWithinDialog(reopenedRecordForm, 'the Hero record editor after Keep editing')
    await tabTo(reopenedRecordForm.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero form Cancel action')
    await page.keyboard.press('Enter')
    await expect(contentDiscardDialog).toBeVisible()
    await expectFocusWithinDialog(contentDiscardDialog, 'the discard confirmation dialog')
    const discardChanges = contentDiscardDialog.getByRole('button', { name: 'Discard', exact: true })
    await tabTo(discardChanges, 'the Discard confirmation action')
    await page.keyboard.press('Shift+Tab')
    await expectFocusWithinDialog(contentDiscardDialog, 'the discard confirmation dialog after Shift+Tab')
    await page.keyboard.press('Tab')
    await expectFocusWithinDialog(contentDiscardDialog, 'the discard confirmation dialog after Tab')
    await tabTo(discardChanges, 'the Discard confirmation action after focus cycling')
    await page.keyboard.press('Enter')
    await expect(reopenedRecordForm).toHaveCount(0)
    await expect(bindingDialog).toBeVisible()
    await expectFocusWithinDialog(bindingDialog, 'the Hero binding dialog after discarding edits')
    await expect(bindingDialog.getByRole('combobox', { name: 'Content record', exact: true })).toHaveValue(updatedHeroTitle)
    await tabTo(bindingDialog.getByRole('button', { name: 'Cancel', exact: true }), 'the Hero binding Cancel action')
    await page.keyboard.press('Enter')
    await expect(bindingDialog).toHaveCount(0)
    await expect(openHeroEditor).toBeFocused()
}

export async function verifyRussianMarketingHeroRequiredEnglish(options: {
    page: Page
    testInfo: TestInfo
    metahubId: string
    marketingLayoutId: string
    sourceHeroWidgetId: string
}): Promise<void> {
    const { page, testInfo, metahubId, marketingLayoutId, sourceHeroWidgetId } = options
    // Validate the localized record form through the Russian authoring UI.
    // Required Russian values satisfy the generic form, while the Hero
    // contract correctly rejects the missing English copy with a localized
    // message before any request can be made.
    await applyBrowserPreferences(page, { language: 'ru' })
    await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
    const russianHeroSurface = page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)
    const russianHeroEditButton = russianHeroSurface.getByTestId(`layout-widget-edit-${sourceHeroWidgetId}`)
    await russianHeroEditButton.click()
    const russianHeroBindingDialog = page.getByRole('dialog').filter({
        has: page.getByRole('combobox', { name: 'Запись содержимого', exact: true })
    })
    await expect(russianHeroBindingDialog).toBeVisible()
    for (const viewport of [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectHeroDialogButtonTextOnOneLine(russianHeroBindingDialog, `Russian Hero chooser at ${viewport.name}`)
        await expectLocatorFullyFitsViewport(russianHeroBindingDialog, `Russian Hero chooser at ${viewport.name}`)
        await expectStandardDialogActionFooter(russianHeroBindingDialog, `Russian Hero chooser at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Russian Hero chooser at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-hero-russian-chooser-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await expectStandardDialogActionFooter(russianHeroBindingDialog, 'Russian Hero content dialog')
    await expectNoTechnicalLeakage(russianHeroBindingDialog, {
        label: 'Russian Hero content dialog',
        checkUuidSubstrings: true
    })
    await expect.poll(() => russianHeroBindingDialog.evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true)
    await russianHeroBindingDialog.getByRole('button', { name: 'Создать запись', exact: true }).click()
    const russianHeroRecordForm = page.getByRole('dialog', { name: 'Создать запись содержимого', exact: true })
    await expect(russianHeroRecordForm).toBeVisible()
    await expect(russianHeroRecordForm.getByRole('textbox', { name: 'Ключ первого экрана', exact: true })).toHaveCount(0)
    await expectSemanticFieldControls(russianHeroRecordForm, { longTextLabels: ['Описание'] })
    await expect(russianHeroRecordForm.getByRole('group', { name: 'Основное действие', exact: true })).toBeVisible()
    await expect(russianHeroRecordForm.getByRole('combobox', { name: 'Тип действия', exact: true })).toBeVisible()
    await expect(russianHeroRecordForm.getByRole('textbox', { name: 'Основное действие', exact: true })).toHaveCount(0)
    const missingEnglishTitleRow = russianHeroRecordForm.getByTestId('localized-inline-row-en')
    const missingEnglishTitle = missingEnglishTitleRow.getByRole('textbox', { name: 'Заголовок', exact: true })
    await expect(missingEnglishTitle).toHaveAttribute('aria-invalid', 'true')
    for (const viewport of [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectHeroDialogButtonTextOnOneLine(russianHeroRecordForm, `Russian Hero create form at ${viewport.name}`)
        await expectLocatorFullyFitsViewport(russianHeroRecordForm, `Russian Hero create form at ${viewport.name}`)
        await expectStandardDialogActionFooter(russianHeroRecordForm, `Russian Hero create form at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Russian Hero create form at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-hero-russian-create-form-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    const russianHeroRecordFormRussianLocale = russianHeroRecordForm.getByTestId('localized-inline-row-ru')
    await russianHeroRecordFormRussianLocale.getByRole('textbox', { name: 'Заголовок', exact: true }).fill('Новая запись')
    await russianHeroRecordFormRussianLocale.getByRole('textbox', { name: 'Описание', exact: true }).fill('Описание записи')
    await russianHeroRecordFormRussianLocale.getByRole('textbox', { name: 'Подпись email', exact: true }).fill('Электронная почта')
    await russianHeroRecordFormRussianLocale.getByRole('textbox', { name: 'Подсказка email', exact: true }).fill('Введите адрес')
    await russianHeroRecordFormRussianLocale.getByRole('textbox', { name: 'Подпись основной кнопки', exact: true }).fill('Начать')
    await expect(russianHeroRecordForm.getByRole('button', { name: 'Сохранить', exact: true })).toBeDisabled()
    await expect(missingEnglishTitle).toHaveAttribute('aria-invalid', 'true')
    const titleErrorDescriptionId = await missingEnglishTitle.getAttribute('aria-describedby')
    expect(titleErrorDescriptionId).toBeTruthy()
    const titleErrorMessage = russianHeroRecordForm.getByText('Заполните поле «Заголовок» на языке «английский» перед сохранением.', {
        exact: true
    })
    await expect(titleErrorMessage).toBeVisible()
    const helperTextId = await titleErrorMessage.getAttribute('id')
    expect(titleErrorDescriptionId?.split(/\s+/)).toContain(helperTextId)
    await expect(russianHeroRecordForm.getByRole('alert')).toHaveCount(0)
    await expectLocalizedValidation(russianHeroRecordForm, 'ru', { label: 'Russian Hero record validation' })
    await expectNoTechnicalLeakage(russianHeroRecordForm, {
        label: 'Russian Hero record validation form',
        checkUuidSubstrings: true
    })
    await russianHeroRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
    const russianContentDiscardDialog = page.getByRole('dialog', {
        name: 'Отменить несохранённые изменения?',
        exact: true
    })
    await expect(russianContentDiscardDialog).toBeVisible()
    await russianContentDiscardDialog.getByRole('button', { name: 'Продолжить редактирование', exact: true }).click()
    await expect(russianHeroRecordFormRussianLocale.getByRole('textbox', { name: 'Заголовок', exact: true })).toHaveValue('Новая запись')
    await expect(russianHeroRecordForm).toBeVisible()
    await russianHeroRecordForm.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(russianContentDiscardDialog).toBeVisible()
    await russianContentDiscardDialog.getByRole('button', { name: 'Отменить изменения', exact: true }).click()
    await expect(russianHeroRecordForm).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(russianHeroBindingDialog).toBeVisible()
    await russianHeroBindingDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(russianHeroBindingDialog).toHaveCount(0)
    await expect(russianHeroEditButton).toBeFocused()
}
