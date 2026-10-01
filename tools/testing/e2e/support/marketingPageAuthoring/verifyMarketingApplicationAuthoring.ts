import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import {
    createPublicationVersion,
    getApplication,
    getApplicationLayout,
    getLayoutZoneWidgetBindings,
    listApplicationLayouts,
    listLayoutZoneWidgets,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    updateLayoutZoneWidgetConfig,
    waitForPublicationReady
} from '../backend/api-session.mjs'
import { waitForSettledMutationResponse } from '../browser/network'
import { applyBrowserPreferences } from '../browser/preferences'
import {
    expectNoPageHorizontalOverflow,
    expectNoTechnicalLeakage,
    expectRuntimeUxViewportMatrix,
    expectStrictRuntimeUxSurface
} from '../browser/runtimeUx'
import {
    expectLayoutWidgetLabelsReadable,
    expectRussianMarketingHeaderLabels,
    expectStandardZoneSettingsFooter,
    readLayoutWidgetConfig,
    responseIsMutation,
    type LayoutWidget
} from '../marketingPageAuthoringHelpers'

export async function verifyMarketingApplicationAuthoring(options: {
    api: APIRequestContext
    page: Page
    testInfo: TestInfo
    metahubId: string
    sourceLayoutId: string
    publicationId: string
    applicationId: string
}): Promise<string> {
    const { api, page, testInfo, metahubId, sourceLayoutId, publicationId, applicationId } = options
    // Verify the application authoring surface in Russian after materialization.
    // The widget labels and source identity must remain user-facing and usable
    // after the metahub layout has crossed the publication boundary.
    const applicationLayouts = (await listApplicationLayouts(api, applicationId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: unknown; templateKey?: unknown }>
    }
    const applicationMarketingLayout = applicationLayouts.items?.find((item) => item.templateKey === 'marketing-page')
    if (typeof applicationMarketingLayout?.id !== 'string') {
        throw new Error('The marketing application did not expose a materialized marketing layout')
    }

    await applyBrowserPreferences(page, { language: 'ru' })
    await page.goto(`/a/${applicationId}/admin/layouts/${applicationMarketingLayout.id}`)
    const applicationLayoutDetails = page.getByTestId('application-layout-details-content')
    await expect(applicationLayoutDetails).toBeVisible()
    const russianApplicationHeaderZone = page.getByTestId('layout-zone-marketing-header')
    await expectRussianMarketingHeaderLabels(russianApplicationHeaderZone)
    await expect(applicationLayoutDetails.getByText('Начало', { exact: true })).toBeVisible()
    await expect(applicationLayoutDetails.getByText('Конец', { exact: true })).toBeVisible()
    const applicationZoneSettingsButton = page.getByTestId('layout-zone-settings-marketing-header')
    await applicationZoneSettingsButton.focus()
    await page.keyboard.press('Enter')
    const applicationZoneSettingsDialog = page.getByRole('dialog', { name: 'Настройки: Шапка маркетинговой страницы' })
    await expect(applicationZoneSettingsDialog).toBeVisible()
    await expect(applicationZoneSettingsDialog.getByText('Поведение шапки', { exact: true })).toBeVisible()
    await expectStrictRuntimeUxSurface(applicationZoneSettingsDialog, {
        label: 'Russian application Zone Settings dialog',
        locale: 'ru'
    })
    await expectStandardZoneSettingsFooter(applicationZoneSettingsDialog, 'Russian application Zone Settings dialog')
    await applicationZoneSettingsDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(applicationZoneSettingsDialog).toHaveCount(0)
    for (const [zone, label] of [
        ['marketing-header', 'Шапка маркетинговой страницы'],
        ['marketing-main', 'Содержимое маркетинговой страницы'],
        ['marketing-footer', 'Подвал маркетинговой страницы']
    ] as const) {
        await expect(page.getByTestId(`layout-zone-${zone}`)).toContainText(label)
    }

    const marketingWidgets = (await getApplicationLayout(api, applicationId, applicationMarketingLayout.id)) as {
        widgets?: LayoutWidget[]
    }
    const widgetLabels: Record<string, string> = {
        navigation: 'Навигация',
        hero: 'Главный экран',
        logos: 'Коллекция: Логотипы',
        features: 'Коллекция: Возможности',
        testimonials: 'Коллекция: Отзывы',
        highlights: 'Коллекция: Преимущества',
        pricing: 'Тарифы',
        faq: 'Коллекция: FAQ',
        footer: 'Футер'
    }
    for (const [instanceKey, label] of Object.entries(widgetLabels)) {
        const widget = marketingWidgets.widgets?.find(
            (item) => readLayoutWidgetConfig(item).instanceKey === instanceKey && typeof item.id === 'string'
        )
        if (!widget?.id) throw new Error(`The application marketing layout did not expose the ${instanceKey} widget`)
        const surface = page.getByTestId(`layout-widget-${widget.id}`)
        await expect(surface.getByRole('button', { name: label, exact: true })).toBeVisible()
    }

    const featuresWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'features')
    if (!featuresWidget?.id) throw new Error('The application marketing layout did not expose the Features widget')
    const featuresToggle = page.getByTestId(`layout-widget-toggle-${featuresWidget.id}`)
    await expect(featuresToggle).toHaveAttribute('aria-label', 'Отключить виджет: Коллекция: Возможности')
    const actionIntegrityAlert = page.getByRole('alert').filter({
        hasText: 'Этот раздел используется в действии первого экрана. Измените действие или оставьте раздел включённым.'
    })
    const actionIntegrityAlertVisible = expect(actionIntegrityAlert).toBeVisible({ timeout: 10_000 })
    const actionIntegrityResponsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(
                response,
                'PATCH',
                new RegExp(
                    `/api/v1/applications/${applicationId}/layouts/${applicationMarketingLayout.id}/zone-widget/${featuresWidget.id}/toggle-active$`
                )
            ),
        { label: 'Preventing deactivation of a section used by a bound Hero action', timeout: 90_000 }
    )
    await featuresToggle.click()
    const [actionIntegrityResponse] = await Promise.all([actionIntegrityResponsePromise, actionIntegrityAlertVisible])
    expect(actionIntegrityResponse.status()).toBe(409)
    expect(await actionIntegrityResponse.json()).toMatchObject({
        code: 'APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT'
    })
    await expect(featuresToggle).toHaveAttribute('aria-label', 'Отключить виджет: Коллекция: Возможности')
    const layoutAfterRejectedSectionToggle = (await getApplicationLayout(api, applicationId, applicationMarketingLayout.id)) as {
        widgets?: LayoutWidget[]
    }
    expect(layoutAfterRejectedSectionToggle.widgets?.find((item) => item.id === featuresWidget.id)?.isActive).toBe(true)
    await page.screenshot({
        path: testInfo.outputPath('application-layout-hero-action-integrity-conflict-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const logoWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'logos')
    if (!logoWidget?.id) throw new Error('The application marketing layout did not expose the logos widget')
    await page
        .getByTestId(`layout-widget-${logoWidget.id}`)
        .getByRole('button', { name: 'Редактировать виджет: Коллекция: Логотипы', exact: true })
        .click()
    const applicationWidgetDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
    await expect(applicationWidgetDialog).toBeVisible()
    await expect(applicationWidgetDialog.getByRole('alert')).toHaveCount(1)
    await expect(applicationWidgetDialog.getByRole('alert')).toHaveText(
        'Виджет отображает данные из связанных записей Сущностей. Управляйте ими в разделе «Объекты» метахаба.'
    )
    await expectNoTechnicalLeakage(applicationWidgetDialog, {
        label: 'Russian application marketing widget configuration dialog',
        checkUuidSubstrings: true
    })
    await expect(applicationWidgetDialog.getByRole('combobox', { name: 'Источник контента', exact: true })).toHaveCount(0)
    const collectionTypeSelect = applicationWidgetDialog.getByRole('combobox', { name: 'Тип коллекции', exact: true })
    await expect(collectionTypeSelect).toHaveText('Логотипы')
    await collectionTypeSelect.click()
    await expect(page.getByRole('option', { name: 'Логотипы', exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'Логотипы', exact: true }).click()
    await applicationWidgetDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(applicationWidgetDialog).toHaveCount(0)

    await applyBrowserPreferences(page, { language: 'en' })
    await page.reload()
    await expect(applicationLayoutDetails).toBeVisible()
    await page
        .getByTestId(`layout-widget-${logoWidget.id}`)
        .getByRole('button', { name: 'Edit widget: Collection: Logo collection', exact: true })
        .click()
    const englishApplicationWidgetDialog = page.getByRole('dialog').filter({
        has: page.getByTestId('marketing-widget-config-dialog')
    })
    await expect(englishApplicationWidgetDialog).toBeVisible()
    await expect(englishApplicationWidgetDialog.getByRole('alert')).toHaveText(
        'This widget displays content from bound Entity records. Manage its content in the metahub Objects workspace.'
    )
    await expectNoTechnicalLeakage(englishApplicationWidgetDialog, {
        label: 'English application marketing widget configuration dialog',
        checkUuidSubstrings: true
    })
    await englishApplicationWidgetDialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(englishApplicationWidgetDialog).toHaveCount(0)

    await applyBrowserPreferences(page, { language: 'ru' })
    await page.reload()
    await expect(applicationLayoutDetails).toBeVisible()

    // Prove that an Application presentation override survives a source sync,
    // then reset it through the real UI to the latest source baseline. The
    // Entity binding remains owned by the metahub throughout this round trip.
    const sourceWidgets = (await listLayoutZoneWidgets(api, metahubId, sourceLayoutId)) as { items?: LayoutWidget[] }
    const sourceLogoWidget = sourceWidgets.items?.find(
        (widget) => readLayoutWidgetConfig(widget).instanceKey === 'logos' && typeof widget.id === 'string'
    )
    if (!sourceLogoWidget?.id || typeof sourceLogoWidget.version !== 'number') {
        throw new Error('The marketing metahub layout did not expose a versioned Logos source widget')
    }
    const sourceLogoConfig = readLayoutWidgetConfig(sourceLogoWidget)
    const currentSourceMaxItems = Number(sourceLogoConfig.maxItems ?? 100)
    const refreshedSourceMaxItems = currentSourceMaxItems === 23 ? 24 : 23
    const bindingBeforeSourceUpdate = await getLayoutZoneWidgetBindings(api, metahubId, sourceLayoutId, sourceLogoWidget.id, 'ru')

    const applicationLogo = marketingWidgets.widgets?.find((widget) => readLayoutWidgetConfig(widget).instanceKey === 'logos')
    if (!applicationLogo?.id || typeof applicationLogo.version !== 'number') {
        throw new Error('The materialized application did not expose a versioned Logos widget')
    }
    await page
        .getByTestId(`layout-widget-${applicationLogo.id}`)
        .getByRole('button', { name: 'Редактировать виджет: Коллекция: Логотипы', exact: true })
        .click()
    const presentationDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
    await expect(presentationDialog).toBeVisible()
    const maxItemsField = presentationDialog.getByRole('spinbutton', { name: 'Максимум элементов', exact: true })
    await maxItemsField.fill('17')
    const presentationSavePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(
                response,
                'PATCH',
                new RegExp(
                    `/api/v1/applications/${applicationId}/layouts/${applicationMarketingLayout.id}/zone-widget/${applicationLogo.id}/config$`
                )
            ),
        { label: 'Saving the marketing Application presentation override', timeout: 90_000 }
    )
    await presentationDialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    expect((await presentationSavePromise).ok()).toBe(true)
    await expect(presentationDialog).toHaveCount(0)

    const sourceUpdate = await updateLayoutZoneWidgetConfig(api, metahubId, sourceLayoutId, sourceLogoWidget.id, {
        config: { ...sourceLogoConfig, maxItems: refreshedSourceMaxItems },
        expectedVersion: sourceLogoWidget.version
    })
    expect(sourceUpdate.item?.id ?? sourceUpdate.id).toBe(sourceLogoWidget.id)
    await createPublicationVersion(api, metahubId, publicationId, {
        name: { en: `E2E ${applicationId.slice(0, 8)} marketing baseline refresh` },
        namePrimaryLocale: 'en'
    })
    await syncPublication(api, metahubId, publicationId)
    await waitForPublicationReady(api, metahubId, publicationId)
    await syncApplicationSchema(api, applicationId, {
        layoutResolutionPolicy: { default: 'keep_local' }
    })
    await expect
        .poll(
            async () => {
                const current = await getApplication(api, applicationId)
                return current?.schemaStatus ?? current?.data?.schemaStatus ?? null
            },
            { timeout: 180_000, message: 'Waiting for the Application to synchronize the updated Marketing source baseline' }
        )
        .toBe('synced')

    const applicationAfterSync = (await getApplicationLayout(api, applicationId, applicationMarketingLayout.id)) as {
        widgets?: LayoutWidget[]
    }
    const logoAfterSync = applicationAfterSync.widgets?.find((widget) => readLayoutWidgetConfig(widget).instanceKey === 'logos')
    if (!logoAfterSync) throw new Error('The Logos widget disappeared during source synchronization')
    expect(readLayoutWidgetConfig(logoAfterSync).maxItems).toBe(17)
    expect(readLayoutWidgetConfig(logoAfterSync)).not.toHaveProperty('bindings')
    expect(logoAfterSync.sourceConfig).toMatchObject({ maxItems: refreshedSourceMaxItems })
    expect(logoAfterSync.isCustomized).toBe(true)
    const bindingAfterSourceUpdate = await getLayoutZoneWidgetBindings(api, metahubId, sourceLayoutId, sourceLogoWidget.id, 'ru')
    // The binding version follows the entire widget row, so updating presentation
    // settings advances it even though the semantic binding remains unchanged.
    expect(bindingAfterSourceUpdate.widgetKey).toBe(bindingBeforeSourceUpdate.widgetKey)
    expect(bindingAfterSourceUpdate.bindings).toEqual(bindingBeforeSourceUpdate.bindings)

    await page.reload()
    await expect(applicationLayoutDetails).toBeVisible()
    const resetLogoButton = page.getByRole('button', {
        name: 'Сбросить «Коллекция: Логотипы» к источнику',
        exact: true
    })
    await expect(resetLogoButton).toBeVisible()
    const resetResponsePromise = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(response, 'POST', new RegExp(`/api/v1/applications/${applicationId}/layouts/zone-widgets/config/reset$`)),
        { label: 'Resetting the Application presentation to its latest Marketing source baseline', timeout: 90_000 }
    )
    await resetLogoButton.click()
    expect((await resetResponsePromise).ok()).toBe(true)
    const applicationAfterReset = (await getApplicationLayout(api, applicationId, applicationMarketingLayout.id)) as {
        widgets?: LayoutWidget[]
    }
    const logoAfterReset = applicationAfterReset.widgets?.find((widget) => readLayoutWidgetConfig(widget).instanceKey === 'logos')
    expect(logoAfterReset).toBeDefined()
    expect(readLayoutWidgetConfig(logoAfterReset!)).toMatchObject({ maxItems: refreshedSourceMaxItems })
    expect(logoAfterReset?.sourceConfig).toMatchObject({ maxItems: refreshedSourceMaxItems })
    expect(logoAfterReset?.isCustomized).toBe(false)
    const bindingAfterReset = await getLayoutZoneWidgetBindings(api, metahubId, sourceLayoutId, sourceLogoWidget.id, 'ru')
    // Resetting presentation changes the widget row version, not its semantic binding.
    expect(bindingAfterReset.widgetKey).toBe(bindingBeforeSourceUpdate.widgetKey)
    expect(bindingAfterReset.bindings).toEqual(bindingBeforeSourceUpdate.bindings)
    await page.screenshot({
        path: testInfo.outputPath('marketing-page-application-source-reset-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })

    const brandWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'brand')
    if (!brandWidget?.id) throw new Error('The application marketing layout did not expose the brand widget')
    await expect(
        page.getByTestId(`layout-widget-${brandWidget.id}`).getByRole('button', { name: 'Редактировать виджет: Бренд', exact: true })
    ).toHaveCount(0)

    const heroWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'hero')
    if (!heroWidget?.id) throw new Error('The application marketing layout did not expose the hero widget')
    const applicationHeroSurface = page.getByTestId(`layout-widget-${heroWidget.id}`)
    await expect(applicationHeroSurface.getByRole('button', { name: 'Дублировать виджет: Главный экран', exact: true })).toHaveCount(0)
    const marketingMainZone = page.getByTestId('layout-zone-marketing-main')
    await expect(marketingMainZone.getByRole('button', { name: 'Добавить виджет', exact: true })).toBeDisabled()

    const layoutBeforeDeniedAdd = (await getApplicationLayout(api, applicationId, applicationMarketingLayout.id)) as {
        item?: { version?: unknown }
        widgets?: LayoutWidget[]
    }
    const expectedLayoutVersion = Number(layoutBeforeDeniedAdd.item?.version)
    if (!Number.isInteger(expectedLayoutVersion) || expectedLayoutVersion < 1) {
        throw new Error('The application layout did not expose a version for the denied Hero-add probe')
    }
    const deniedHeroAdd = await sendWithCsrf(
        api,
        'PUT',
        `/api/v1/applications/${applicationId}/layouts/${applicationMarketingLayout.id}/zone-widget`,
        {
            expectedVersion: expectedLayoutVersion,
            zone: 'marketing-main',
            widgetKey: 'marketing.hero',
            config: { showLeadForm: true }
        }
    )
    expect(deniedHeroAdd.status).toBe(409)
    expect(await deniedHeroAdd.json()).toMatchObject({ error: 'APPLICATION_LAYOUT_ENTITY_BACKED_WIDGET_COPY_CONFLICT' })
    const layoutAfterDeniedAdd = (await getApplicationLayout(api, applicationId, applicationMarketingLayout.id)) as {
        item?: { version?: unknown }
        widgets?: LayoutWidget[]
    }
    expect(layoutAfterDeniedAdd.item?.version).toBe(expectedLayoutVersion)
    expect(layoutAfterDeniedAdd.widgets).toEqual(layoutBeforeDeniedAdd.widgets)
    expect(layoutAfterDeniedAdd.widgets?.filter((item) => item.widgetKey === 'marketing.hero' && typeof item.id === 'string')).toHaveLength(
        2
    )
    await expectNoTechnicalLeakage(applicationLayoutDetails, {
        label: 'Russian application marketing layout with the source Hero preserved',
        checkUuidSubstrings: true
    })
    await expectNoTechnicalLeakage(applicationLayoutDetails, {
        label: 'Russian application marketing layout authoring surface',
        checkUuidSubstrings: true
    })
    await expectNoPageHorizontalOverflow(page, 'Russian application marketing layout authoring')
    await expectRuntimeUxViewportMatrix(page, 'Russian application marketing layout authoring viewport matrix', {
        beforeEachViewport: async (viewport) => {
            if (viewport.name === 'mobile-390') {
                await expectLayoutWidgetLabelsReadable(page, 'Russian application marketing layout authoring at mobile-390')
            }
        }
    })
    await page.screenshot({
        path: testInfo.outputPath('marketing-page-application-layout-ru.png'),
        fullPage: true,
        animations: 'disabled'
    })

    return actionIntegrityResponse.url()
}
