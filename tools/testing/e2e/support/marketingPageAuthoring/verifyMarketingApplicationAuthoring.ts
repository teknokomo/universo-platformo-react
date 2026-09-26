import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test'
import { getApplicationLayout, listApplicationLayouts, sendWithCsrf } from '../backend/api-session.mjs'
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
    applicationId: string
    brandLogoUrl: string
}): Promise<string> {
    const { api, page, testInfo, applicationId, brandLogoUrl } = options
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
    await expect(applicationWidgetDialog.getByRole('alert')).toHaveCount(0)
    await expectNoTechnicalLeakage(applicationWidgetDialog, {
        label: 'Russian application marketing widget configuration dialog',
        checkUuidSubstrings: true
    })
    const applicationSourceSelect = applicationWidgetDialog.getByRole('combobox', { name: 'Источник контента', exact: true })
    await expect(applicationSourceSelect).toBeEnabled()
    await applicationSourceSelect.click()
    await expect(page.getByRole('option', { name: 'Логотипы клиентов', exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'Логотипы клиентов', exact: true }).click()
    await applicationWidgetDialog.getByRole('button', { name: 'Отмена', exact: true }).click()
    await expect(applicationWidgetDialog).toHaveCount(0)

    const brandWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'brand')
    if (!brandWidget?.id) throw new Error('The application marketing layout did not expose the brand widget')
    await page
        .getByTestId(`layout-widget-${brandWidget.id}`)
        .getByRole('button', { name: 'Редактировать виджет: Бренд', exact: true })
        .click()
    const brandWidgetDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
    await expect(brandWidgetDialog).toBeVisible()
    await expect(brandWidgetDialog.getByRole('alert')).toHaveCount(0)
    await brandWidgetDialog.getByLabel('URL логотипа бренда', { exact: true }).fill(brandLogoUrl)
    const brandLogoResponse = waitForSettledMutationResponse(
        page,
        (response) =>
            responseIsMutation(
                response,
                'PATCH',
                new RegExp(
                    `/api/v1/applications/${applicationId}/layouts/${applicationMarketingLayout.id}/zone-widget/${brandWidget.id}/config$`
                )
            ),
        { label: 'Saving the marketing brand logo through the widget dialog', timeout: 90_000 }
    )
    await brandWidgetDialog.getByRole('button', { name: 'Сохранить', exact: true }).click()
    expect((await brandLogoResponse).ok()).toBe(true)
    await expect(brandWidgetDialog).toHaveCount(0)

    const heroWidget = marketingWidgets.widgets?.find((item) => readLayoutWidgetConfig(item).instanceKey === 'hero')
    if (!heroWidget?.id) throw new Error('The application marketing layout did not expose the hero widget')
    const applicationHeroSurface = page.getByTestId(`layout-widget-${heroWidget.id}`)
    await expect(applicationHeroSurface.getByRole('button', { name: 'Дублировать виджет: Главный экран', exact: true })).toHaveCount(0)
    const marketingMainZone = page.getByTestId('layout-zone-marketing-main')
    await marketingMainZone.getByRole('button', { name: 'Добавить виджет', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Главный экран', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')

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
