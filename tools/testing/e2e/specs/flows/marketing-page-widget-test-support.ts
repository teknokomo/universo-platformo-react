import type { Locator, Page, Response } from '@playwright/test'

import { expect } from '../../fixtures/test'
import { listLayoutZoneWidgets, listLayouts } from '../../support/backend/api-session.mjs'

export type LayoutZoneWidget = {
    id?: unknown
    zone?: unknown
    widgetKey?: unknown
    sortOrder?: unknown
    version?: unknown
    isActive?: unknown
    config?: unknown
}

export type LayoutZoneWidgetsResponse = {
    items?: LayoutZoneWidget[]
}

export const readWidgets = (payload: LayoutZoneWidgetsResponse | LayoutZoneWidget[] | null | undefined): LayoutZoneWidget[] => {
    if (Array.isArray(payload)) return payload
    return Array.isArray(payload?.items) ? payload.items : []
}

export const readConfig = (widget: LayoutZoneWidget): Record<string, unknown> => {
    if (!widget.config || typeof widget.config !== 'object' || Array.isArray(widget.config)) return {}
    return widget.config as Record<string, unknown>
}

export const readRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

export const readString = (value: unknown): string => (typeof value === 'string' ? value : '')

export const responseIsMutation = (response: Response, method: string, path: RegExp): boolean =>
    response.request().method() === method && path.test(new URL(response.url()).pathname)

export const getWidgetByInstanceKey = (widgets: LayoutZoneWidget[], instanceKey: string): LayoutZoneWidget | undefined =>
    widgets.find((widget) => readString(readConfig(widget).instanceKey) === instanceKey)

export const waitForWidgetState = async (
    api: Parameters<typeof listLayoutZoneWidgets>[0],
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

export const widgetSurface = (page: Page, widget: LayoutZoneWidget): Locator => {
    const id = readString(widget.id)
    if (!id) throw new Error('Marketing widget response did not expose a stable UI identity')
    return page.getByTestId(`layout-widget-${id}`)
}

export const openWidgetBindingDialog = async (page: Page, surface: Locator): Promise<Locator> => {
    const editBindings = surface.locator('button[data-testid^="layout-widget-edit-"]:not([data-testid^="layout-widget-edit-content-"])')
    await expect(editBindings).toHaveCount(1)
    await editBindings.click()
    const dialog = page.getByRole('dialog').filter({
        has: page.getByRole('combobox', { name: /^(Content source|Источник содержимого)$/u })
    })
    await expect(dialog).toBeVisible()
    return dialog
}

export const layoutIdForMarketingPage = async (api: Parameters<typeof listLayouts>[0], metahubId: string): Promise<string> => {
    const response = await listLayouts(api, metahubId, { limit: 100, offset: 0 })
    const layout = response.items?.find((item: { id?: unknown; templateKey?: unknown }) => item.templateKey === 'marketing-page')
    const layoutId = readString(layout?.id)
    if (!layoutId) throw new Error('The marketing-page metahub did not expose a marketing layout')
    return layoutId
}
