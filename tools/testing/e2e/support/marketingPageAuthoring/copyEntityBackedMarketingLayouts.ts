import { expect, type APIRequestContext, type Page, type Request, type TestInfo } from '@playwright/test'
import { getLayout, getLayoutZoneWidgetBinding, listLayoutZoneWidgets } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { expectNoTechnicalLeakage, expectSemanticFieldControls } from '../browser/runtimeUx'
import {
    fillLocalizedField,
    fillLocalizedFieldValues,
    responseIsMutation,
    type LayoutWidgetsResponse
} from '../marketingPageAuthoringHelpers'
import { parseJsonResponse, readLocalizedText } from '../entityRuntimeParsing'
import { verifyMarketingLayoutCopyDialogViewports } from './verifyMarketingLayoutCopyDialogViewports'

export async function copyEntityBackedMarketingLayouts(options: {
    api: APIRequestContext
    page: Page
    testInfo: TestInfo
    metahubId: string
    marketingLayoutId: string
    executionRunId: string
    sourceLayoutName: string
    sourceHeroWidgetIds: string[]
}): Promise<{ reusedLayoutId: string; reusedLayoutName: string }> {
    const { api, page, testInfo, metahubId, marketingLayoutId, executionRunId, sourceLayoutName, sourceHeroWidgetIds } = options
    const boundRecordIdsForLayout = async (layoutId: string, widgetIds: string[]) =>
        Promise.all(
            widgetIds.map(async (widgetId) => {
                const binding = (await getLayoutZoneWidgetBinding(api, metahubId, layoutId, widgetId, 'en')) as { recordId?: string }
                if (typeof binding.recordId !== 'string') throw new Error('A Hero placement did not return its bound record')
                return binding.recordId
            })
        )
    const sourceHeroRecordIds = (await boundRecordIdsForLayout(marketingLayoutId, sourceHeroWidgetIds)).sort()

    const copyLayoutDialog = () => page.getByRole('dialog', { name: /^Copying Layout\b/i })
    const sourceLayoutRow = () => page.getByRole('row').filter({ has: page.getByRole('link', { name: sourceLayoutName, exact: true }) })
    await expect(sourceLayoutRow()).toBeVisible()
    await sourceLayoutRow()
        .getByRole('button', { name: `Actions for ${sourceLayoutName}`, exact: true })
        .click()
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()

    const reuseLayoutDialog = copyLayoutDialog()
    await expect(reuseLayoutDialog).toBeVisible()
    await expect(reuseLayoutDialog.getByRole('tab', { name: 'Options', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expectNoTechnicalLeakage(reuseLayoutDialog, {
        label: 'Marketing layout copy dialog',
        checkUuidSubstrings: true
    })
    await reuseLayoutDialog.getByRole('tab', { name: 'General', exact: true }).click()
    await expectSemanticFieldControls(reuseLayoutDialog, { longTextLabels: ['Description'] })
    const reusedLayoutDescription = `A copied marketing layout with independently persisted Entity-backed Hero bindings. ${executionRunId}`
    await fillLocalizedFieldValues(page, reuseLayoutDialog, 'Description', {
        en: reusedLayoutDescription,
        ru: `Копия макета с отдельными привязками к Сущностям. ${executionRunId}`
    })
    await reuseLayoutDialog.getByRole('tab', { name: 'Options', exact: true }).click()
    await verifyMarketingLayoutCopyDialogViewports({ page, testInfo, dialog: reuseLayoutDialog })

    let sourceCopyRequests = 0
    const sourceCopyPayloads: Array<Record<string, unknown>> = []
    const observeSourceCopyRequest = (request: Request) => {
        if (
            request.method() === 'POST' &&
            new URL(request.url()).pathname === `/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/copy`
        ) {
            sourceCopyRequests += 1
            sourceCopyPayloads.push(request.postDataJSON() as Record<string, unknown>)
        }
    }
    page.on('request', observeSourceCopyRequest)
    await reuseLayoutDialog.getByRole('button', { name: 'Copy', exact: true }).click()
    await expect(
        reuseLayoutDialog.getByText('Choose whether to reuse or skip bound Hero placements before copying this layout.', {
            exact: true
        })
    ).toBeVisible()
    expect(sourceCopyRequests).toBe(0)
    await page.screenshot({
        path: testInfo.outputPath('marketing-layout-copy-choice-required-mobile.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const reuseHeroRecordsRadio = reuseLayoutDialog.getByRole('radio', { name: /Reuse the same Hero records/ })
    await reuseHeroRecordsRadio.focus()
    await page.keyboard.press('Space')
    await expect(reuseHeroRecordsRadio).toBeChecked()
    const reuseCopyResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/copy$`)),
        { label: 'Copying a marketing layout with explicit Hero record reuse', timeout: 90_000 }
    )
    await reuseLayoutDialog.getByRole('button', { name: 'Copy', exact: true }).click()
    const reuseCopyResponse = await reuseCopyResponsePromise
    expect(reuseCopyResponse.ok()).toBe(true)
    expect(sourceCopyPayloads[0]).toMatchObject({ heroBindingCopyMode: 'reuse' })
    const reusedLayout = await parseJsonResponse<RecordResponse & { name?: unknown }>(
        reuseCopyResponse,
        'Copying a marketing layout with Hero record reuse'
    )
    if (typeof reusedLayout.id !== 'string') throw new Error('The copied marketing layout did not return its new UUID v7 identity')
    expect(reusedLayout.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    const reusedLayoutName = readLocalizedText(reusedLayout.name, 'en')
    const persistedReusedLayout = await getLayout(api, metahubId, reusedLayout.id)
    expect(readLocalizedText(persistedReusedLayout.description, 'en')).toBe(reusedLayoutDescription)
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: reusedLayoutName, exact: true }) })).toBeVisible()

    const reusedLayoutWidgets = (await listLayoutZoneWidgets(api, metahubId, reusedLayout.id)) as LayoutWidgetsResponse
    const reusedHeroWidgetIds = (reusedLayoutWidgets.items ?? [])
        .filter((widget) => widget.widgetKey === 'marketing.hero')
        .map((widget) => String(widget.id))
    expect(reusedHeroWidgetIds).toHaveLength(sourceHeroWidgetIds.length)
    expect(new Set(reusedHeroWidgetIds).size).toBe(reusedHeroWidgetIds.length)
    expect((await boundRecordIdsForLayout(reusedLayout.id, reusedHeroWidgetIds)).sort()).toEqual(sourceHeroRecordIds)

    await sourceLayoutRow()
        .getByRole('button', { name: `Actions for ${sourceLayoutName}`, exact: true })
        .click()
    await page.getByRole('menuitem', { name: 'Copy', exact: true }).click()
    const omitLayoutDialog = copyLayoutDialog()
    await expect(omitLayoutDialog.getByRole('tab', { name: 'Options', exact: true })).toHaveAttribute('aria-selected', 'true')
    const omitLayoutName = `Marketing layout without bound Hero ${executionRunId}`
    await omitLayoutDialog.getByRole('tab', { name: 'General', exact: true }).click()
    await fillLocalizedField(omitLayoutDialog, 'Name', omitLayoutName)
    await omitLayoutDialog.getByRole('tab', { name: 'Options', exact: true }).click()
    const omitHeroRadio = omitLayoutDialog.getByRole('radio', { name: /Skip bound Hero placements/ })
    await omitHeroRadio.focus()
    await page.keyboard.press('Space')
    await expect(omitHeroRadio).toBeChecked()
    await expectNoTechnicalLeakage(omitLayoutDialog, {
        label: 'Marketing layout copy with Hero placements omitted',
        checkUuidSubstrings: true
    })
    const omitCopyResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', new RegExp(`/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/copy$`)),
        { label: 'Copying a marketing layout while omitting bound Hero placements', timeout: 90_000 }
    )
    await omitLayoutDialog.getByRole('button', { name: 'Copy', exact: true }).click()
    const omitCopyResponse = await omitCopyResponsePromise
    expect(sourceCopyPayloads[1]).toMatchObject({ heroBindingCopyMode: 'omit' })
    page.off('request', observeSourceCopyRequest)
    expect(omitCopyResponse.ok()).toBe(true)
    const omittedLayout = await parseJsonResponse<RecordResponse & { name?: unknown }>(
        omitCopyResponse,
        'Copying a marketing layout with Hero placements omitted'
    )
    if (typeof omittedLayout.id !== 'string') throw new Error('The copied marketing layout did not return its new identity')
    expect(omittedLayout.id).not.toBe(marketingLayoutId)
    await expect(page.getByRole('row').filter({ has: page.getByRole('link', { name: omitLayoutName, exact: true }) })).toBeVisible()
    const omittedLayoutWidgets = (await listLayoutZoneWidgets(api, metahubId, omittedLayout.id)) as LayoutWidgetsResponse
    expect((omittedLayoutWidgets.items ?? []).filter((widget) => widget.widgetKey === 'marketing.hero')).toHaveLength(0)

    return { reusedLayoutId: reusedLayout.id, reusedLayoutName }
}
