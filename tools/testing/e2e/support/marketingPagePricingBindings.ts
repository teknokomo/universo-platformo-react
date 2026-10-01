import type { Locator, Page, Response } from '@playwright/test'

import { expect } from '../fixtures/test'
import type { createLoggedInApiContext } from './backend/api-session.mjs'
import { getLayoutZoneWidgetBindings, listLayoutZoneWidgets } from './backend/api-session.mjs'
import { waitForSettledMutationResponse } from './browser/network'
import { expectNoTechnicalLeakage } from './browser/runtimeUx'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

type LayoutZoneWidget = {
    id?: unknown
    widgetKey?: unknown
    config?: unknown
}

type LayoutZoneWidgetsResponse = {
    items?: LayoutZoneWidget[]
}

const readWidgets = (payload: LayoutZoneWidgetsResponse | LayoutZoneWidget[] | null | undefined): LayoutZoneWidget[] => {
    if (Array.isArray(payload)) return payload
    return Array.isArray(payload?.items) ? payload.items : []
}

const readConfig = (widget: LayoutZoneWidget): Record<string, unknown> => {
    if (!widget.config || typeof widget.config !== 'object' || Array.isArray(widget.config)) return {}
    return widget.config as Record<string, unknown>
}

const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

const responseIsMutation = (response: Response, method: string, path: RegExp): boolean =>
    response.request().method() === method && path.test(new URL(response.url()).pathname)

const selectMarketingBindingOption = async (page: Page, dialog: Locator, field: string, option: string): Promise<void> => {
    const input = dialog.getByRole('combobox', { name: field, exact: true })
    await expect(input).toBeEnabled()
    await input.click()
    const optionItem = page.getByRole('option', { name: option, exact: true })
    await expect(optionItem).toBeVisible()
    await optionItem.click()
}

const waitForWidgetState = async (
    api: ApiSession,
    metahubId: string,
    layoutId: string,
    predicate: (widget: LayoutZoneWidget) => boolean,
    message: string
): Promise<LayoutZoneWidget> => {
    let match: LayoutZoneWidget | undefined

    await expect
        .poll(
            async () => {
                const response = (await listLayoutZoneWidgets(api, metahubId, layoutId)) as LayoutZoneWidgetsResponse
                match = readWidgets(response).find(predicate)
                return Boolean(match)
            },
            { timeout: 60_000, message }
        )
        .toBe(true)

    if (!match) throw new Error(message)
    return match
}

const widgetSurface = (page: Page, widget: LayoutZoneWidget): Locator => {
    const id = readString(widget.id)
    if (!id) throw new Error('Marketing widget response did not expose a stable UI identity')
    return page.getByTestId(`layout-widget-${id}`)
}

export async function verifyMarketingPricingRecordRelationSetFlow(options: {
    page: Page
    api: ApiSession
    metahubId: string
    layoutId: string
    mainZone: Locator
}): Promise<void> {
    const { page, api, metahubId, layoutId, mainZone } = options

    await mainZone.getByRole('button', { name: 'Add widget', exact: true }).click()
    const pricingMenu = page.getByRole('menu')
    await expect(pricingMenu).toBeVisible()
    await pricingMenu.getByRole('menuitem', { name: 'Pricing', exact: true }).click()
    const pricingConfigDialog = page.getByRole('dialog').filter({ has: page.getByTestId('marketing-widget-config-dialog') })
    await expect(pricingConfigDialog).toBeVisible()
    await pricingConfigDialog.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(pricingConfigDialog).toHaveCount(0)
    const pricingDialog = page.getByRole('dialog').filter({
        has: page.getByRole('combobox', { name: 'Content source', exact: true })
    })
    await expect(pricingDialog).toBeVisible()
    await expectNoTechnicalLeakage(pricingDialog, { label: 'Pricing binding dialog', checkUuidSubstrings: true })

    await pricingDialog.getByRole('button', { name: /Pricing tiers/ }).click()
    const tierSourceSelect = pricingDialog.getByRole('combobox', { name: 'Content source', exact: true })
    await expect(tierSourceSelect).toHaveValue('Pricing tiers')
    await tierSourceSelect.hover()
    await pricingDialog.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect(tierSourceSelect).toHaveValue('')
    await pricingDialog.getByRole('button', { name: /Pricing benefits/ }).click()
    await expect(pricingDialog.getByText('Choose Pricing tiers before configuring Pricing benefits.', { exact: true })).toBeVisible()
    await expect(pricingDialog.getByRole('combobox', { name: 'Content source', exact: true })).toBeDisabled()
    await pricingDialog.getByRole('button', { name: /Section content/ }).click()

    await selectMarketingBindingOption(page, pricingDialog, 'Content source', 'Marketing sections')
    await selectMarketingBindingOption(page, pricingDialog, 'Content record', 'Pricing')
    await pricingDialog.getByRole('button', { name: /Pricing tiers/ }).click()
    await selectMarketingBindingOption(page, pricingDialog, 'Content source', 'Pricing tiers')
    await pricingDialog.getByRole('button', { name: /Pricing benefits/ }).click()
    await selectMarketingBindingOption(page, pricingDialog, 'Content source', 'Pricing benefits')

    const createPricingResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'PUT', /\/zone-widget$/),
        { label: 'Adding a Pricing placement with a related benefit source' }
    )
    await pricingDialog.getByRole('button', { name: 'Add', exact: true }).click()
    const createPricingResponse = await createPricingResponsePromise
    expect(createPricingResponse.ok()).toBe(true)

    const addedPricingWidget = await waitForWidgetState(
        api,
        metahubId,
        layoutId,
        (widget) => widget.widgetKey === 'marketing.pricing' && readString(readConfig(widget).instanceKey) !== 'pricing',
        'The newly added Pricing placement was not persisted'
    )
    const addedPricingBindings = (await getLayoutZoneWidgetBindings(api, metahubId, layoutId, readString(addedPricingWidget.id), 'en')) as {
        bindings?: Array<{ slot?: string; sourceKey?: string; selectorKind?: string; semanticKey?: string }>
    }
    const bindingBySlot = new Map((addedPricingBindings.bindings ?? []).map((binding) => [binding.slot, binding]))
    expect(bindingBySlot.get('section')).toMatchObject({
        sourceKey: 'MarketingPageSection',
        selectorKind: 'semantic-key',
        semanticKey: 'pricing'
    })
    expect(bindingBySlot.get('tiers')).toMatchObject({ sourceKey: 'MarketingPagePricing', selectorKind: 'record-set' })
    expect(bindingBySlot.get('benefits')).toMatchObject({
        sourceKey: 'MarketingPagePricingBenefit',
        selectorKind: 'relation-set'
    })

    const addedPricingSurface = widgetSurface(page, addedPricingWidget)
    await addedPricingSurface.getByRole('button', { name: 'Delete', exact: true }).click()
    const pricingRemoveDialog = page.getByRole('dialog', { name: 'Remove widget?' })
    await expect(pricingRemoveDialog).toBeVisible()
    const removePricingResponsePromise = waitForSettledMutationResponse(
        page,
        (response) => responseIsMutation(response, 'DELETE', /\/zone-widget\/[^/]+$/),
        { label: 'Removing the Pricing relation-set placement' }
    )
    await pricingRemoveDialog.getByRole('button', { name: 'Remove', exact: true }).click()
    expect((await removePricingResponsePromise).ok()).toBe(true)
    await expect(addedPricingSurface).toHaveCount(0)
}
