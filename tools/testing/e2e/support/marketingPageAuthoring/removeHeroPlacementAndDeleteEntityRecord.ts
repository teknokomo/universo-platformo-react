import { expect, type APIRequestContext, type Page } from '@playwright/test'
import { getLayoutZoneWidgetBinding, listLayoutZoneWidgets, listLayouts, listRecords, sendWithCsrf } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import { expectNoTechnicalLeakage } from '../browser/runtimeUx'
import { ensureListView, responseIsMutation, type LayoutWidgetsResponse } from '../marketingPageAuthoringHelpers'

export async function removeHeroPlacementAndDeleteEntityRecord(options: {
    api: APIRequestContext
    page: Page
    metahubId: string
    marketingLayoutId: string
    addedHeroWidgetId: string
    reusedLayoutId: string
    reusedLayoutName: string
    heroEntityId: string
    heroRecordId: string
    heroRecordTitleRu: string
}): Promise<void> {
    const {
        api,
        page,
        metahubId,
        marketingLayoutId,
        addedHeroWidgetId,
        reusedLayoutId,
        reusedLayoutName,
        heroEntityId,
        heroRecordId,
        heroRecordTitleRu
    } = options

    await applyBrowserPreferences(page, { language: 'en' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
    const heroPlacement = page.getByTestId(`layout-widget-${addedHeroWidgetId}`)
    await expect(heroPlacement).toBeVisible()
    await page.getByTestId(`layout-widget-remove-${addedHeroWidgetId}`).click()

    const removeWidgetDialog = page.getByRole('dialog', { name: 'Remove widget?', exact: true })
    await expect(removeWidgetDialog).toBeVisible()
    await expectNoTechnicalLeakage(removeWidgetDialog, {
        label: 'Remove bound Hero placement confirmation',
        checkUuidSubstrings: true
    })
    const removeWidgetResponsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(
                response,
                'DELETE',
                new RegExp(`/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/zone-widget/${addedHeroWidgetId}$`)
            ),
        { label: 'Removing a bound Hero placement through the layout authoring UI', timeout: 90_000 }
    )
    await removeWidgetDialog.getByRole('button', { name: 'Remove', exact: true }).click()
    expect((await removeWidgetResponsePromise).ok()).toBe(true)
    await expect(heroPlacement).toHaveCount(0)

    const remainingSourceWidgets = (await listLayoutZoneWidgets(api, metahubId, marketingLayoutId)) as LayoutWidgetsResponse
    const sourceBindings = await Promise.all(
        (remainingSourceWidgets.items ?? [])
            .filter((widget) => widget.widgetKey === 'marketing.hero' && typeof widget.id === 'string')
            .map((widget) => getLayoutZoneWidgetBinding(api, metahubId, marketingLayoutId, String(widget.id), 'en'))
    )
    expect(sourceBindings.some((binding) => (binding as { recordId?: string }).recordId === heroRecordId)).toBe(false)

    const remainingCopies = (await listLayoutZoneWidgets(api, metahubId, reusedLayoutId)) as LayoutWidgetsResponse
    const copyBindings = await Promise.all(
        (remainingCopies.items ?? [])
            .filter((widget) => widget.widgetKey === 'marketing.hero' && typeof widget.id === 'string')
            .map((widget) => getLayoutZoneWidgetBinding(api, metahubId, reusedLayoutId, String(widget.id), 'en'))
    )
    expect(copyBindings.filter((binding) => (binding as { recordId?: string }).recordId === heroRecordId)).toHaveLength(1)

    const stillBoundDelete = await sendWithCsrf(
        api,
        'DELETE',
        `/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${heroRecordId}`
    )
    expect(stillBoundDelete.status).toBe(409)
    expect(await stillBoundDelete.json()).toMatchObject({ code: 'RECORD_BOUND' })

    await page.goto(`/metahub/${metahubId}/resources`)
    await page.getByRole('tab', { name: /^(?:Layouts|Макеты)$/ }).click()
    await ensureListView(page)
    const reusedLayoutRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: reusedLayoutName, exact: true }) })
    await expect(reusedLayoutRow).toBeVisible()
    await reusedLayoutRow.getByRole('button', { name: `Actions for ${reusedLayoutName}`, exact: true }).click()
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click()
    const deleteLayoutDialog = page.getByRole('dialog', { name: 'Delete layout?', exact: true })
    await expect(deleteLayoutDialog).toBeVisible()
    await expectNoTechnicalLeakage(deleteLayoutDialog, { label: 'Delete copied layout confirmation', checkUuidSubstrings: true })
    const deleteLayoutResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'DELETE', new RegExp(`/api/v1/metahub/${metahubId}/layout/${reusedLayoutId}$`)),
        { label: 'Deleting the copied layout that still references the Hero record', timeout: 90_000 }
    )
    await deleteLayoutDialog.getByRole('button', { name: 'Delete', exact: true }).click()
    expect((await deleteLayoutResponsePromise).ok()).toBe(true)
    const activeLayouts = (await listLayouts(api, metahubId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string }>
    }
    expect(activeLayouts.items?.some((layout) => layout.id === reusedLayoutId)).toBe(false)

    await applyBrowserPreferences(page, { language: 'ru' })
    await page.goto(`/metahub/${metahubId}/entities/object/instance/${heroEntityId}/records`)
    await ensureListView(page)
    const heroRecordRow = page.getByRole('row').filter({ hasText: heroRecordTitleRu }).first()
    await expect(heroRecordRow).toBeVisible()
    await heroRecordRow.getByRole('button', { name: 'Опции', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Удалить', exact: true }).click()
    const deleteRecordDialog = page.getByRole('dialog', { name: 'Удалить запись', exact: true })
    await expect(deleteRecordDialog).toBeVisible()
    await expectNoTechnicalLeakage(deleteRecordDialog, { label: 'Delete unbound Hero record confirmation', checkUuidSubstrings: true })
    const deleteRecordResponsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(
                response,
                'DELETE',
                new RegExp(`/api/v1/metahub/${metahubId}/entities/object/instance/${heroEntityId}/record/${heroRecordId}$`)
            ),
        { label: 'Deleting an unbound Hero Entity record through the records UI', timeout: 90_000 }
    )
    await deleteRecordDialog.getByRole('button', { name: 'Удалить', exact: true }).click()
    expect((await deleteRecordResponsePromise).ok()).toBe(true)
    await expect(heroRecordRow).toHaveCount(0)
    const activeRecords = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string }>
    }
    expect(activeRecords.items?.some((record) => record.id === heroRecordId)).toBe(false)
}
