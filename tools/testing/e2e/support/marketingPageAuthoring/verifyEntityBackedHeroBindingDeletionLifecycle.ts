import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { listRecords, sendWithCsrf } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import { expectNoTechnicalLeakage } from '../browser/runtimeUx'
import { ensureListView, responseIsMutation } from '../marketingPageAuthoringHelpers'

export async function verifyEntityBackedHeroBindingDeletionLifecycle(options: {
    api: APIRequestContext
    page: Page
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
        metahubId,
        marketingLayoutId,
        addedHeroWidgetId,
        heroEntityId,
        createdHeroRecordId,
        updatedHeroTitle,
        independentHeroTitle,
        independentHeroTitleRu
    } = options
    const openAddedHeroBinding = async () => {
        await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
        await page.getByTestId(`layout-widget-edit-${addedHeroWidgetId}`).click()
        const dialog = page.getByRole('dialog', { name: 'Hero content', exact: true })
        const select = dialog.getByRole('combobox', { name: 'Hero content record', exact: true })
        await expect(dialog).toBeVisible()
        await expectNoTechnicalLeakage(dialog, { label: 'Hero content binding dialog', checkUuidSubstrings: true })
        return { dialog, select }
    }

    // Rebind away and back through the authoring UI, reloading between
    // saves so the persisted semantic target—not dialog state—is checked.
    let reopenedBinding = await openAddedHeroBinding()
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)
    await reopenedBinding.select.click()
    await page.getByRole('option', { name: updatedHeroTitle, exact: true }).click()
    const firstRebindResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/binding$/),
        { label: 'Rebinding the second Hero placement to the first Entity record', timeout: 90_000 }
    )
    await reopenedBinding.dialog.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await firstRebindResponsePromise).ok()).toBe(true)
    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)

    reopenedBinding = await openAddedHeroBinding()
    await expect(reopenedBinding.select).toHaveValue(updatedHeroTitle)
    await reopenedBinding.select.click()
    await page.getByRole('option', { name: independentHeroTitle, exact: true }).click()
    const restoreRebindResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/binding$/),
        { label: 'Restoring the second Hero placement to its independent Entity record', timeout: 90_000 }
    )
    await reopenedBinding.dialog.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await restoreRebindResponsePromise).ok()).toBe(true)
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)

    reopenedBinding = await openAddedHeroBinding()
    await expect(reopenedBinding.select).toHaveValue(independentHeroTitle)

    await reopenedBinding.dialog.getByRole('button', { name: 'Edit record', exact: true }).click()
    const editHeroRecordForm = page.getByRole('dialog', { name: /Edit Hero content/ })
    await expect(editHeroRecordForm).toBeVisible()
    await expectNoTechnicalLeakage(editHeroRecordForm, { label: 'Edit Hero content form', checkUuidSubstrings: true })
    const editHeroActionTarget = editHeroRecordForm.getByRole('combobox', { name: 'Page section', exact: true }).first()
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
        'Эта запись используется в размещении Hero. Откройте макеты и укажите для этого размещения другую запись содержимого либо удалите размещение, затем повторите удаление.'
    )
    await expectNoTechnicalLeakage(deniedBoundHeroDeleteAlert, {
        label: 'Russian bound Hero record deletion message',
        checkUuidSubstrings: true
    })
    await expect(boundHeroDeleteDialog).toHaveCount(0)
    await expect(boundHeroRecordRow).toBeVisible()

    // Verify the server boundary as well as the normal user-facing delete flow.
    const deniedBoundHeroDeleteApi = await sendWithCsrf(
        api,
        'DELETE',
        `/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${createdHeroRecordId}`
    )
    expect(deniedBoundHeroDeleteApi.status).toBe(409)
    expect(await deniedBoundHeroDeleteApi.json()).toMatchObject({ code: 'RECORD_BOUND' })
    const recordsAfterDeniedDelete = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string }>
    }
    expect(recordsAfterDeniedDelete.items?.some((record) => record.id === createdHeroRecordId)).toBe(true)

    return [deniedBoundHeroDelete.url()]
}
