import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { listRecords, sendWithCsrf } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import {
    expectLocatorFullyFitsViewport,
    expectLocatorFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage
} from '../browser/runtimeUx'
import { ensureListView, expectStandardDialogActionFooter, responseIsMutation } from '../marketingPageAuthoringHelpers'
import { expectHeroDialogButtonTextOnOneLine } from './marketingHeroAuthoringAssertions'

export async function verifyMarketingHeroBindingDeletionLifecycle(options: {
    api: APIRequestContext
    page: Page
    testInfo: TestInfo
    metahubId: string
    marketingLayoutId: string
    addedHeroWidgetId: string
    heroEntityId: string
    createdHeroRecordId: string
    updatedHeroTitle: string
    independentHeroTitle: string
    independentHeroTitleRu: string
}): Promise<string[]> {
    const {
        api,
        page,
        testInfo,
        metahubId,
        marketingLayoutId,
        addedHeroWidgetId,
        heroEntityId,
        createdHeroRecordId,
        updatedHeroTitle,
        independentHeroTitle,
        independentHeroTitleRu
    } = options
    const openAddedHeroBindingChooser = async () => {
        await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
        const heroSurface = page.getByTestId(`layout-widget-${addedHeroWidgetId}`)
        await heroSurface.getByRole('button', { name: 'Edit', exact: true }).click()

        const dialog = page.getByRole('dialog', { name: 'Hero', exact: true })
        const select = dialog.getByRole('combobox', { name: 'Content record', exact: true })
        const sourceSelect = dialog.getByRole('combobox', { name: 'Content source', exact: true })
        await expect(dialog).toBeVisible()
        await expectNoTechnicalLeakage(dialog, { label: 'Hero content rebind chooser', checkUuidSubstrings: true })
        await expect(sourceSelect).toBeVisible()
        await expect(select).toBeVisible()
        for (const viewport of [
            { name: 'desktop', width: 1920, height: 1080 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 390, height: 844 }
        ]) {
            await page.setViewportSize({ width: viewport.width, height: viewport.height })
            await expectHeroDialogButtonTextOnOneLine(dialog, `Hero content chooser at ${viewport.name}`)
            await expectLocatorFitsViewport(dialog, `Hero binding editor at ${viewport.name}`)
            await expectStandardDialogActionFooter(dialog, `Hero binding editor at ${viewport.name}`)
            await expectNoPageHorizontalOverflow(page, `Hero binding editor at ${viewport.name}`)
            await page.screenshot({
                path: testInfo.outputPath(`marketing-hero-binding-editor-${viewport.name}.png`),
                fullPage: true,
                animations: 'disabled'
            })
        }
        await page.setViewportSize({ width: 1920, height: 1080 })
        await sourceSelect.click()
        const listbox = page.getByRole('listbox')
        await expect(listbox).toBeVisible()
        const menuPaper = page.locator('.MuiAutocomplete-paper:visible').last()
        const firstOption = listbox.getByRole('option').first()
        await expect(firstOption).toBeVisible()
        await expect(firstOption).toContainText(/\S/u)
        await expectNoTechnicalLeakage(firstOption, {
            label: 'Hero source dropdown option',
            checkUuidSubstrings: true
        })
        const menuStyle = await menuPaper.evaluate((paper) => {
            const paperStyle = window.getComputedStyle(paper)
            const list = paper.querySelector('.MuiAutocomplete-listbox') as HTMLElement | null
            const option = list?.querySelector('.MuiAutocomplete-option') as HTMLElement | null
            if (!list || !option) return null
            const listStyle = window.getComputedStyle(list)
            const optionStyle = window.getComputedStyle(option)
            return {
                borderRadius: Number.parseFloat(paperStyle.borderRadius),
                boxShadow: paperStyle.boxShadow,
                listPadding: Number.parseFloat(listStyle.paddingTop),
                optionMinHeight: Number.parseFloat(optionStyle.minHeight),
                optionBorderRadius: Number.parseFloat(optionStyle.borderRadius)
            }
        })
        if (!menuStyle) throw new Error('Shared dropdown did not render its paper, listbox, and option')
        expect(menuStyle.borderRadius).toBeGreaterThan(0)
        expect(menuStyle.boxShadow).not.toBe('none')
        expect(menuStyle.listPadding).toBeGreaterThan(0)
        expect(menuStyle.optionMinHeight).toBeGreaterThan(0)
        expect(menuStyle.optionBorderRadius).toBeGreaterThan(0)
        await expectNoPageHorizontalOverflow(page, 'Open shared Hero source dropdown at desktop')
        await page.screenshot({
            path: testInfo.outputPath('marketing-hero-source-dropdown-desktop-open.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await sourceSelect.press('Escape')
        await expect(listbox).toBeHidden()
        await expect(sourceSelect).toBeFocused()

        await page.setViewportSize({ width: 390, height: 844 })
        await sourceSelect.click()
        await expect(listbox).toBeVisible()
        await expect(firstOption).toBeVisible()
        await expect(firstOption).toContainText(/\S/u)
        await expectNoTechnicalLeakage(firstOption, {
            label: 'Hero source dropdown option at mobile',
            checkUuidSubstrings: true
        })
        await expectLocatorFullyFitsViewport(firstOption, 'Hero source dropdown option at mobile')
        await expectNoPageHorizontalOverflow(page, 'Open shared Hero source dropdown at mobile')
        await page.screenshot({
            path: testInfo.outputPath('marketing-hero-source-dropdown-mobile-open.png'),
            fullPage: true,
            animations: 'disabled'
        })
        await sourceSelect.press('Escape')
        await expect(listbox).toBeHidden()
        await page.setViewportSize({ width: 1920, height: 1080 })
        return { dialog, select }
    }

    // The shared dialog exposes both content selection and the
    // Entity-record editor for every bound Marketing widget.
    let reopenedBinding = await openAddedHeroBindingChooser()
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
    await reopenedBinding.select.click()
    await page.getByRole('option', { name: updatedHeroTitle, exact: true }).click()
    await reopenedBinding.dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    const bindingDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
    await expect(bindingDiscardDialog).toBeVisible()
    await bindingDiscardDialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await expect(reopenedBinding.dialog).toBeVisible()
    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)
    await reopenedBinding.dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(bindingDiscardDialog).toBeVisible()
    await bindingDiscardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(reopenedBinding.dialog).toHaveCount(0)

    reopenedBinding = await openAddedHeroBindingChooser()
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
    await reopenedBinding.select.click()
    await page.getByRole('option', { name: updatedHeroTitle, exact: true }).click()
    const firstRebindResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/binding$/),
        { label: 'Rebinding the second Hero placement to the first Entity record', timeout: 90_000 }
    )
    await reopenedBinding.dialog.getByRole('button', { name: 'Save', exact: true }).click()
    const firstRebindResponse = await firstRebindResponsePromise
    expect(firstRebindResponse.ok()).toBe(true)
    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)

    reopenedBinding = await openAddedHeroBindingChooser()
    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)
    await reopenedBinding.select.click()
    await page.getByRole('option', { name: independentHeroTitle, exact: true }).click()
    const restoreRebindResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/binding$/),
        { label: 'Restoring the second Hero placement to its independent Entity record', timeout: 90_000 }
    )
    await reopenedBinding.dialog.getByRole('button', { name: 'Save', exact: true }).click()
    const restoreRebindResponse = await restoreRebindResponsePromise
    expect(restoreRebindResponse.ok()).toBe(true)
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)

    await reopenedBinding.dialog.getByRole('button', { name: 'Appearance', exact: true }).click()
    const presentationDialog = page.getByRole('dialog', { name: 'Hero', exact: true })
    await expect(presentationDialog).toBeVisible()
    for (const viewport of [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectLocatorFullyFitsViewport(presentationDialog, `Hero presentation dialog at ${viewport.name}`)
        await expectStandardDialogActionFooter(presentationDialog, `Hero presentation dialog at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Hero presentation dialog at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-hero-presentation-dialog-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    const leadFormSwitch = presentationDialog.getByRole('switch', { name: 'Show lead form', exact: true })
    const initialLeadFormState = await leadFormSwitch.isChecked()
    await leadFormSwitch.click()
    await expect(leadFormSwitch).toBeVisible()
    expect(await leadFormSwitch.isChecked()).toBe(!initialLeadFormState)
    await presentationDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    const presentationDiscardDialog = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true })
    await expect(presentationDiscardDialog).toBeVisible()
    await expect(presentationDiscardDialog.getByTestId('dialog-resize-handle')).toHaveCount(0)
    await expect(presentationDiscardDialog.getByTestId('dialog-toggle-fullscreen')).toHaveCount(0)
    const confirmationActions = presentationDiscardDialog.locator('.MuiDialogActions-root').last()
    await expect(confirmationActions).toBeVisible()
    const confirmationActionInsets = await confirmationActions.evaluate((actions) => {
        const styles = window.getComputedStyle(actions)
        return {
            right: Number.parseFloat(styles.paddingRight) || 0,
            bottom: Number.parseFloat(styles.paddingBottom) || 0
        }
    })
    expect(confirmationActionInsets.right).toBeGreaterThanOrEqual(23)
    expect(confirmationActionInsets.bottom).toBeGreaterThanOrEqual(15)
    await presentationDiscardDialog.getByRole('button', { name: 'Keep editing', exact: true }).click()
    await expect(presentationDialog).toBeVisible()
    expect(await leadFormSwitch.isChecked()).toBe(!initialLeadFormState)
    await presentationDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(presentationDiscardDialog).toBeVisible()
    await presentationDiscardDialog.getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(presentationDialog).toHaveCount(0)

    reopenedBinding = await openAddedHeroBindingChooser()
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
    await reopenedBinding.dialog.getByRole('button', { name: 'Appearance', exact: true }).click()
    const reopenedPresentationDialog = page.getByRole('dialog', { name: 'Hero', exact: true })
    await expect(reopenedPresentationDialog).toBeVisible()
    await expect(reopenedPresentationDialog.getByRole('switch', { name: 'Show lead form', exact: true })).toHaveJSProperty(
        'checked',
        initialLeadFormState
    )
    await reopenedPresentationDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(reopenedPresentationDialog).toHaveCount(0)

    reopenedBinding = await openAddedHeroBindingChooser()
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
    await reopenedBinding.dialog.getByRole('button', { name: 'Edit content', exact: true }).click()
    const editHeroRecordForm = page.getByRole('dialog', { name: /^Edit content record(?:\s|$)/u })
    await expect(editHeroRecordForm).toBeVisible()
    await expectNoTechnicalLeakage(editHeroRecordForm, { label: 'Edit Hero content form', checkUuidSubstrings: true })
    const editHeroPrimaryAction = editHeroRecordForm.getByRole('group', { name: 'Primary action', exact: true })
    const editHeroActionTarget = editHeroPrimaryAction.getByRole('combobox', { name: 'Page section', exact: true })
    await editHeroActionTarget.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('option', { name: 'Hero — 2', exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'Hero — 2', exact: true }).click()
    await expect(editHeroActionTarget).toHaveText('Hero — 2')
    const heroActionUpdateResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/api\/v1\/metahub\/[^/]+\/entities\/.*\/record\/[^/]+$/),
        { label: 'Updating the Hero CTA to target the second active Hero section', timeout: 90_000 }
    )
    await editHeroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
    const heroActionUpdateResponse = await heroActionUpdateResponsePromise
    expect(heroActionUpdateResponse.ok()).toBe(true)
    await expect(editHeroRecordForm).toHaveCount(0)
    await expect(reopenedBinding.dialog).toBeVisible()
    await reopenedBinding.dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(reopenedBinding.dialog).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1000 })

    await applyBrowserPreferences(page, { language: 'ru' })
    await page.goto(`/metahub/${metahubId}/entities/object/instance/${heroEntityId}/records`)
    await ensureListView(page)
    const boundHeroRecordRow = page.getByRole('row').filter({ hasText: independentHeroTitleRu }).first()
    await expect(boundHeroRecordRow).toBeVisible()
    await boundHeroRecordRow.getByRole('button', { name: 'Опции', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click()
    const boundHeroDeleteDialog = page.getByRole('dialog', { name: 'Удалить запись', exact: true })
    await expect(boundHeroDeleteDialog).toBeVisible()
    const deniedBoundHeroDeletePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(
                response,
                'DELETE',
                new RegExp(`/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${createdHeroRecordId}$`)
            ),
        { label: 'Refusing to delete a bound Hero record through the Entity records UI', timeout: 90_000 }
    )
    await boundHeroDeleteDialog.getByRole('button', { name: 'Удалить', exact: true }).click()
    const deniedBoundHeroDelete = await deniedBoundHeroDeletePromise
    expect(deniedBoundHeroDelete.status()).toBe(409)
    const deniedBoundHeroDeleteAlert = page.getByRole('alert')
    await expect(deniedBoundHeroDeleteAlert).toContainText(
        'Эта запись используется виджетом макета. Откройте макеты, выберите для виджета другую запись содержимого или удалите виджет, затем повторите удаление.'
    )
    await expectNoTechnicalLeakage(deniedBoundHeroDeleteAlert, {
        label: 'Russian bound Hero record deletion message',
        checkUuidSubstrings: true
    })
    await expect(boundHeroDeleteDialog).toHaveCount(0)
    await expect(boundHeroRecordRow).toBeVisible()

    const deniedBoundHeroDeleteApi = await sendWithCsrf(
        api,
        'DELETE',
        `/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${createdHeroRecordId}`
    )
    expect(deniedBoundHeroDeleteApi.status).toBe(409)
    expect(await deniedBoundHeroDeleteApi.json()).toMatchObject({ code: 'RECORD_BOUND' })
    const recordsAfterDeniedDelete = (await listRecords(api, metahubId!, heroEntityId!, {
        limit: 100,
        offset: 0
    })) as { items?: Array<{ id?: string }> }
    expect(recordsAfterDeniedDelete.items?.some((record) => record.id === createdHeroRecordId)).toBe(true)

    return [deniedBoundHeroDelete.url()]
}
