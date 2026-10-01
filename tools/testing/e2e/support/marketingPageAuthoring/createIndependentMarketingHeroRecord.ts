import AxeBuilder from '@axe-core/playwright'
import { expect, type APIRequestContext, type Page, type Request, type Response, type TestInfo } from '@playwright/test'
import { isUuidV7 } from '@universo-react/utils'
import { getLayout, getLayoutZoneWidgetBindings, listLayoutZoneWidgets, listRecords } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import {
    expectLocatorFitsViewport,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectSemanticFieldControls
} from '../browser/runtimeUx'
import { expectHeroDialogButtonTextOnOneLine } from './marketingHeroAuthoringAssertions'
import { readLocalizedText } from '../entityRuntimeParsing'
import {
    expectStandardDialogActionFooter,
    fillLocalizedFieldValues,
    responseIsMutation,
    type LayoutWidgetsResponse
} from '../marketingPageAuthoringHelpers'

export async function createIndependentMarketingHeroRecord(options: {
    api: APIRequestContext
    page: Page
    testInfo: TestInfo
    metahubId: string
    marketingLayoutId: string
    heroEntityId: string
    sourceHeroWidgetId: string
    independentHeroTitle: string
    independentHeroAccent: string
    independentHeroTitleRu: string
    independentHeroAccentRu: string
}): Promise<{
    createdHeroRecord: { id: string }
    addedHeroWidget: { id: string }
    sourceLayoutName: string
}> {
    const {
        api,
        page,
        testInfo,
        metahubId,
        marketingLayoutId,
        heroEntityId,
        sourceHeroWidgetId,
        independentHeroTitle,
        independentHeroAccent,
        independentHeroTitleRu,
        independentHeroAccentRu
    } = options
    await applyBrowserPreferences(page, { language: 'en' })
    await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
    const sourceBinding = (await getLayoutZoneWidgetBindings(api, metahubId, marketingLayoutId, sourceHeroWidgetId, 'en')) as {
        bindings?: Array<{ slot?: string; semanticKey?: string }>
    }
    const sourceHeroKey = sourceBinding.bindings?.find((binding) => binding.slot === 'content')?.semanticKey
    if (!sourceHeroKey) throw new Error('The seeded Hero placement had no semantic Entity binding')
    const recordsBeforeDuplicate = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string; data?: Record<string, unknown> }>
    }
    const sourceRecord = recordsBeforeDuplicate.items?.find((record) => record.data?.HeroKey === sourceHeroKey)
    if (!sourceRecord?.id) throw new Error('The seeded Hero record was not available before duplication')
    const sourceTitleBeforeEdit = readLocalizedText(sourceRecord.data?.Title, 'en')
    const widgetsBeforeDuplicate = (await listLayoutZoneWidgets(api, metahubId, marketingLayoutId)) as LayoutWidgetsResponse
    const widgetIdsBeforeDuplicate = new Set(widgetsBeforeDuplicate.items?.map((widget) => widget.id))
    const sourceHeroSurface = page.getByTestId(`layout-widget-${sourceHeroWidgetId}`)

    const observedMetahubMutations: string[] = []
    const duplicatePath = `/api/v1/metahub/${metahubId}/layout/${marketingLayoutId}/zone-widget/duplicate`
    const captureLayoutMutation = (request: Request) => {
        const method = request.method()
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return
        const pathname = new URL(request.url()).pathname
        if (pathname.startsWith(`/api/v1/metahub/${metahubId}/`)) {
            observedMetahubMutations.push(`${method} ${pathname}`)
        }
    }
    const duplicateResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', /\/zone-widget\/duplicate$/),
        { label: 'Creating an independent Hero placement and Entity record', timeout: 90_000 }
    )
    page.on('request', captureLayoutMutation)
    let duplicateResponse: Response
    try {
        await sourceHeroSurface.getByRole('button', { name: /^Duplicate widget:/ }).click()
        duplicateResponse = await duplicateResponsePromise
    } finally {
        page.off('request', captureLayoutMutation)
    }
    expect(duplicateResponse.status()).toBe(201)
    expect(duplicateResponse.ok()).toBe(true)
    expect(observedMetahubMutations).toEqual([`POST ${duplicatePath}`])
    await expect(page.getByRole('dialog', { name: 'Hero', exact: true })).toHaveCount(0)
    await expect(page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })).toHaveCount(0)

    const addedHeroWidgets = (await listLayoutZoneWidgets(api, metahubId, marketingLayoutId)) as LayoutWidgetsResponse
    const newlyPersistedHeroWidgets = (addedHeroWidgets.items ?? []).filter(
        (widget) => widget.widgetKey === 'marketing.hero' && !widgetIdsBeforeDuplicate.has(widget.id)
    )
    expect(newlyPersistedHeroWidgets).toHaveLength(1)
    const addedHeroWidget = newlyPersistedHeroWidgets[0]
    if (!addedHeroWidget?.id) throw new Error('The duplicated Hero placement was not persisted')
    expect(isUuidV7(addedHeroWidget.id)).toBe(true)
    await expect
        .poll(
            async () => {
                const binding = (await getLayoutZoneWidgetBindings(api, metahubId, marketingLayoutId, addedHeroWidget.id, 'en')) as {
                    bindings?: Array<{ slot?: string; semanticKey?: string }>
                }
                return binding.bindings?.find((item) => item.slot === 'content')?.semanticKey ?? null
            },
            { timeout: 60_000, message: 'The new Hero placement must receive an Entity binding automatically' }
        )
        .not.toBeNull()
    const createdHeroBinding = (await getLayoutZoneWidgetBindings(api, metahubId, marketingLayoutId, addedHeroWidget.id, 'en')) as {
        bindings?: Array<{ slot?: string; semanticKey?: string }>
    }
    const createdHeroKey = createdHeroBinding.bindings?.find((item) => item.slot === 'content')?.semanticKey
    if (!createdHeroKey) throw new Error('The duplicated Hero placement was not bound to a semantic record')
    await expect
        .poll(
            async () => {
                const records = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
                    items?: Array<{ id?: string; data?: Record<string, unknown> }>
                }
                return records.items?.length ?? 0
            },
            { timeout: 60_000, message: 'Duplicating Hero must create a separate Entity record' }
        )
        .toBe((recordsBeforeDuplicate.items?.length ?? 0) + 1)
    const recordsAfterDuplicate = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string; data?: Record<string, unknown> }>
    }
    const createdHeroRecord = recordsAfterDuplicate.items?.find((record) => record.data?.HeroKey === createdHeroKey)
    if (!createdHeroRecord?.id) throw new Error('The duplicate Hero binding did not resolve to its new Entity record')
    expect(isUuidV7(createdHeroRecord.id)).toBe(true)
    expect(String(createdHeroRecord.data?.HeroKey ?? '')).not.toBe('')
    expect(createdHeroRecord.data?.HeroKey).not.toBe('default')
    expect(createdHeroRecord.data?.HeroKey).not.toBe(sourceHeroKey)
    expect(createdHeroRecord.id).not.toBe(sourceRecord.id)
    expect(createdHeroKey).toBe(String(createdHeroRecord.data?.HeroKey ?? ''))

    const duplicateSurface = page.getByTestId(`layout-widget-${addedHeroWidget.id}`)
    await expect(duplicateSurface).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(page.getByRole('tooltip')).toHaveCount(0)
    for (const viewport of [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectNoPageHorizontalOverflow(page, `Automatically duplicated Hero at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-hero-auto-duplicate-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await duplicateSurface.getByRole('button', { name: 'Edit content', exact: true }).click()
    const heroRecordForm = page.getByRole('dialog', { name: /^Edit content record(?:\s|$)/u })
    await expect(heroRecordForm).toBeVisible()
    await expectNoTechnicalLeakage(heroRecordForm, { label: 'Duplicated Hero record editor', checkUuidSubstrings: true })
    const accessibility = await new AxeBuilder({ page })
        .include('[role="dialog"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()
    expect(accessibility.violations, JSON.stringify(accessibility.violations)).toEqual([])
    await expectSemanticFieldControls(heroRecordForm, { longTextLabels: ['Description'] })
    await fillLocalizedFieldValues(page, heroRecordForm, 'Title', {
        en: independentHeroTitle,
        ru: independentHeroTitleRu
    })
    await fillLocalizedFieldValues(page, heroRecordForm, 'Accent', {
        en: independentHeroAccent,
        ru: independentHeroAccentRu
    })
    const titleInput = heroRecordForm.getByTestId('localized-inline-row-en').getByRole('textbox', { name: 'Title', exact: true })
    await expect(titleInput).toHaveValue(independentHeroTitle)
    for (const viewport of [
        { name: 'desktop', width: 1920, height: 1080 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'mobile', width: 390, height: 844 }
    ]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height })
        await expectHeroDialogButtonTextOnOneLine(heroRecordForm, `Duplicated Hero editor at ${viewport.name}`)
        await expectLocatorFitsViewport(heroRecordForm, `Duplicated Hero editor at ${viewport.name}`)
        await expectStandardDialogActionFooter(heroRecordForm, `Duplicated Hero editor at ${viewport.name}`)
        await expectNoPageHorizontalOverflow(page, `Duplicated Hero editor at ${viewport.name}`)
        await page.screenshot({
            path: testInfo.outputPath(`marketing-hero-duplicate-editor-${viewport.name}.png`),
            fullPage: true,
            animations: 'disabled'
        })
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    const editResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/entities\/.*\/record\/[^/]+$/),
        { label: 'Saving independent Hero record edits', timeout: 90_000 }
    )
    await heroRecordForm.getByRole('button', { name: 'Save', exact: true }).click()
    const editResponse = await editResponsePromise
    expect(editResponse.ok()).toBe(true)
    await expect(heroRecordForm).toHaveCount(0)

    const persistedRecords = (await listRecords(api, metahubId, heroEntityId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: string; data?: Record<string, unknown> }>
    }
    const persistedCopy = persistedRecords.items?.find((record) => record.id === createdHeroRecord.id)
    const persistedSource = persistedRecords.items?.find((record) => record.id === sourceRecord.id)
    expect(readLocalizedText(persistedCopy?.data?.Title, 'en')).toBe(independentHeroTitle)
    expect(readLocalizedText(persistedCopy?.data?.Title, 'ru')).toBe(independentHeroTitleRu)
    expect(readLocalizedText(persistedSource?.data?.Title, 'en')).toBe(sourceTitleBeforeEdit)
    const heroBindingDialog = page.getByRole('dialog').filter({
        has: page.getByRole('combobox', { name: 'Content record', exact: true })
    })
    await expect(heroBindingDialog).toBeVisible()
    await heroBindingDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(heroBindingDialog).toHaveCount(0)

    const sourceLayoutDetails = await getLayout(api, metahubId, marketingLayoutId)
    const sourceLayoutName = readLocalizedText(sourceLayoutDetails.name, 'en')
    if (!sourceLayoutName) throw new Error('The source marketing layout did not have an English display name')
    return {
        createdHeroRecord: { id: createdHeroRecord.id },
        addedHeroWidget: { id: String(addedHeroWidget.id) },
        sourceLayoutName
    }
}
