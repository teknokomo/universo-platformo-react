import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { createLayout, getLayout, listEntityInstances, resetLayoutZoneSetting, updateLayoutZoneSetting } from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import {
    expectLocatorFitsViewport,
    expectLocatorHasNoInlineOverflow,
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectStrictRuntimeUxSurface
} from '../browser/runtimeUx'
import { applyBrowserPreferences } from '../browser/preferences'
import { readLocalizedText } from '../entityRuntimeParsing'
import {
    expectRussianMarketingHeaderLabels,
    expectStandardZoneSettingsFooter,
    findMarketingWidget,
    responseIsMutation
} from '../marketingPageAuthoringHelpers'

export async function prepareMarketingMetahubLayoutAuthoring(options: {
    api: APIRequestContext
    page: Page
    metahubId: string
    executionRunId: string
    testInfo: TestInfo
}): Promise<{
    marketingLayoutId: string
    faqWidgetId: string
    entityResponse: { items?: Array<{ id?: string; codename?: unknown }> }
}> {
    const { api, page, metahubId, executionRunId, testInfo } = options
    // Change the persisted widget composition through the real metahub
    // authoring surface before publication. The later runtime assertion
    // proves that publication carries this semantic choice forward.
    const { layoutId: marketingLayoutId, widgetId: faqWidgetId } = await findMarketingWidget(api, metahubId, 'faq')

    // Exercise the metahub source chain directly: a global position flows
    // into a scoped layout, a local override wins, and reset exposes later
    // source changes again. Renderer-owned config must remain byte-for-byte
    // stable throughout the neutral metadata mutations.
    const metahubGlobalLayout = await getLayout(api, metahubId, marketingLayoutId)
    const metahubRendererConfig = { ...(metahubGlobalLayout.config ?? {}) }
    const flowGlobalLayout = await updateLayoutZoneSetting(
        api,
        metahubId,
        marketingLayoutId,
        'marketing-header',
        'position',
        'flow',
        metahubGlobalLayout.version
    )
    expect(flowGlobalLayout.config).toEqual(metahubRendererConfig)
    expect(flowGlobalLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'flow' })

    const entityResponse = await listEntityInstances(api, metahubId, { kind: 'object', limit: 200, offset: 0 })
    const siteSettingsEntity = (entityResponse?.items ?? []).find(
        (entity: { id?: string; codename?: unknown }) => readLocalizedText(entity.codename, 'en') === 'MarketingPageSiteSettings'
    )
    if (typeof siteSettingsEntity?.id !== 'string') {
        throw new Error('The marketing authoring fixture did not expose the site-settings entity for scoped inheritance')
    }

    const scopedMetahubLayout = await createLayout(api, metahubId, {
        scopeEntityId: siteSettingsEntity.id,
        baseLayoutId: marketingLayoutId,
        templateKey: 'marketing-page',
        name: { en: `Scoped marketing ${executionRunId}`, ru: `Область маркетинга ${executionRunId}` },
        namePrimaryLocale: 'en',
        isActive: true,
        isDefault: true,
        config: {}
    })
    if (!scopedMetahubLayout?.id || typeof scopedMetahubLayout.version !== 'number') {
        throw new Error('The scoped metahub layout did not return a versioned layout')
    }
    const scopedMetahubBeforeOverride = await getLayout(api, metahubId, scopedMetahubLayout.id)
    expect(scopedMetahubBeforeOverride.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()

    const scopedMetahubFixedLayout = await updateLayoutZoneSetting(
        api,
        metahubId,
        scopedMetahubLayout.id,
        'marketing-header',
        'position',
        'fixed',
        scopedMetahubBeforeOverride.version
    )
    expect(scopedMetahubFixedLayout.neutral?.zoneSettings?.['marketing-header']).toEqual({ position: 'fixed' })

    const scopedMetahubResetLayout = await resetLayoutZoneSetting(
        api,
        metahubId,
        scopedMetahubLayout.id,
        'marketing-header',
        'position',
        scopedMetahubFixedLayout.version
    )
    expect(scopedMetahubResetLayout.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()
    expect((await getLayout(api, metahubId, marketingLayoutId)).neutral?.zoneSettings?.['marketing-header']).toEqual({
        position: 'flow'
    })

    await applyBrowserPreferences(page, { language: 'ru' })
    await page.goto(`/metahub/${metahubId}/resources/layouts/${scopedMetahubLayout.id}`)
    const russianScopedLayoutDetails = page.getByTestId('metahub-layout-details-content')
    await expect(russianScopedLayoutDetails).toBeVisible()
    const russianMetahubHeaderZone = page.getByTestId('layout-zone-marketing-header')
    await expect(russianMetahubHeaderZone).toContainText('Шапка маркетинговой страницы')
    await expectRussianMarketingHeaderLabels(russianMetahubHeaderZone)
    await expect(russianScopedLayoutDetails.getByText('Начало', { exact: true })).toBeVisible()
    await expect(russianScopedLayoutDetails.getByText('Конец', { exact: true })).toBeVisible()
    const russianZoneSettingsButton = page.getByTestId('layout-zone-settings-marketing-header')
    await russianZoneSettingsButton.focus()
    await page.keyboard.press('Enter')
    const russianZoneSettingsDialog = page.getByRole('dialog', { name: 'Настройки: Шапка маркетинговой страницы' })
    await expect(russianZoneSettingsDialog).toBeVisible()
    await expect(russianZoneSettingsDialog.getByText('Поведение шапки', { exact: true })).toBeVisible()
    await expect(russianZoneSettingsDialog.getByRole('radio', { name: 'Закреплена на экране', exact: true })).toBeVisible()
    await expectStrictRuntimeUxSurface(russianZoneSettingsDialog, {
        label: 'Russian metahub Zone Settings dialog',
        locale: 'ru'
    })
    await expectStandardZoneSettingsFooter(russianZoneSettingsDialog, 'Russian metahub Zone Settings dialog')
    await russianZoneSettingsDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(russianZoneSettingsDialog).toHaveCount(0)

    await applyBrowserPreferences(page, { language: 'en' })
    await page.goto(`/metahub/${metahubId}/resources/layouts/${scopedMetahubLayout.id}`)
    const scopedLayoutDetails = page.getByTestId('metahub-layout-details-content')
    await expect(scopedLayoutDetails).toBeVisible()
    const scopedZoneSettingsButton = page.getByTestId('layout-zone-settings-marketing-header')
    await expect(scopedZoneSettingsButton).toBeVisible()
    await scopedZoneSettingsButton.focus()
    await page.keyboard.press('Enter')
    const scopedZoneSettingsDialog = page.getByRole('dialog')
    await expect(scopedZoneSettingsDialog.getByText('Inherited from the current layout source', { exact: true })).toBeVisible()
    await expectRuntimeUxViewportMatrix(page, 'Shared metahub Zone Settings dialog', {
        beforeEachViewport: async (viewport) => {
            await expect(scopedZoneSettingsDialog).toBeVisible()
            await expectLocatorFitsViewport(scopedZoneSettingsDialog, `Metahub Zone Settings dialog at ${viewport.name}`)
            await expectLocatorHasNoInlineOverflow(scopedZoneSettingsDialog, `Metahub Zone Settings dialog at ${viewport.name}`)
            await expectStrictRuntimeUxSurface(scopedZoneSettingsDialog, {
                label: `Metahub Zone Settings dialog at ${viewport.name}`,
                locale: 'en'
            })
        }
    })
    const scopedFixedRadio = scopedZoneSettingsDialog.getByRole('radio', { name: 'Fixed on screen', exact: true })
    await scopedFixedRadio.focus()
    await page.keyboard.press('Space')
    await expect(scopedFixedRadio).toBeChecked()
    const scopedZoneSaveResponse = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/zone-settings\/marketing-header\/position$/),
        { label: 'Saving the scoped marketing header position', timeout: 90_000 }
    )
    const scopedZoneSaveButton = scopedZoneSettingsDialog.getByRole('button', { name: 'Save', exact: true })
    await scopedZoneSaveButton.focus()
    await page.keyboard.press('Enter')
    expect((await scopedZoneSaveResponse).ok()).toBe(true)
    await expect(scopedZoneSettingsDialog).toHaveCount(0)
    await page.reload()
    await page.getByTestId('layout-zone-settings-marketing-header').focus()
    await page.keyboard.press('Enter')
    const scopedCustomizedDialog = page.getByRole('dialog')
    await expect(scopedCustomizedDialog.getByText('Customized for this layout', { exact: true })).toBeVisible()
    await expect(scopedCustomizedDialog.getByRole('radio', { name: 'Fixed on screen', exact: true })).toBeChecked()
    const scopedZoneResetResponse = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'POST', /\/zone-settings\/marketing-header\/position\/reset$/),
        { label: 'Resetting the scoped marketing header position', timeout: 90_000 }
    )
    const scopedZoneResetButton = scopedCustomizedDialog.getByRole('button', { name: 'Reset override', exact: true })
    await scopedZoneResetButton.focus()
    await page.keyboard.press('Enter')
    expect((await scopedZoneResetResponse).ok()).toBe(true)
    await expect(scopedCustomizedDialog).toHaveCount(0)

    const scopedAfterBrowserReset = await getLayout(api, metahubId, scopedMetahubLayout.id)
    expect(scopedAfterBrowserReset.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()
    const globalAfterScopedReset = await getLayout(api, metahubId, marketingLayoutId)
    const restoredGlobalLayout = await resetLayoutZoneSetting(
        api,
        metahubId,
        marketingLayoutId,
        'marketing-header',
        'position',
        globalAfterScopedReset.version
    )
    expect(restoredGlobalLayout.config).toEqual(metahubRendererConfig)
    expect(restoredGlobalLayout.neutral?.zoneSettings?.['marketing-header']).toBeUndefined()

    await page.goto(`/metahub/${metahubId}/resources/layouts/${marketingLayoutId}`)
    const marketingLayoutDetails = page.getByTestId('metahub-layout-details-content')
    await expect(marketingLayoutDetails).toBeVisible()
    await expect(marketingLayoutDetails.getByRole('alert')).toHaveCount(0)
    await expectNoPageHorizontalOverflow(page, 'Marketing metahub layout details')
    await expectNoTechnicalLeakage(marketingLayoutDetails, {
        label: 'Marketing metahub layout details',
        checkUuidSubstrings: true,
        forbiddenVisibleTextPatterns: [/widgetKey/i, /source[_ -]?base/i, /allowedZonesByTemplate/i]
    })
    await page.screenshot({ path: testInfo.outputPath('marketing-metahub-layout-details.png'), fullPage: true })
    const faqSurface = page.getByTestId(`layout-widget-${faqWidgetId}`)
    await expect(faqSurface).toBeVisible()
    const deactivateFaqButton = faqSurface.getByRole('button', { name: 'Deactivate', exact: true })
    await expect(deactivateFaqButton).toBeVisible()
    const deactivateFaqResponse = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PATCH', /\/zone-widget\/[^/]+\/toggle-active$/),
        { label: 'Deactivating the FAQ widget before publication', timeout: 90_000 }
    )
    await deactivateFaqButton.click()
    expect((await deactivateFaqResponse).ok()).toBe(true)
    await expect(faqSurface.getByRole('button', { name: 'Activate', exact: true })).toBeVisible()

    return { marketingLayoutId, faqWidgetId, entityResponse }
}
