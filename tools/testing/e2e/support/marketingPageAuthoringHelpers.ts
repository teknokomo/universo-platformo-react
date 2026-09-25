import type { Locator, Page, Response, TestInfo } from '@playwright/test'

import { expect } from '../fixtures/test'
import {
    createLoggedInApiContext,
    getPublication,
    listConnectors,
    listLayoutZoneWidgets,
    listLayouts,
    listPublicationApplications
} from './backend/api-session.mjs'
import { toolbarSelectors } from './selectors/contracts'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

type PublicationApplication = {
    id?: string
}

type PublicationApplicationsResponse = {
    items?: PublicationApplication[]
}

type Connector = {
    id?: string
    name?: unknown
}

type ConnectorsResponse = {
    items?: Connector[]
}

export type LayoutWidget = {
    id?: unknown
    widgetKey?: unknown
    zone?: unknown
    config?: unknown
    version?: unknown
    isActive?: unknown
}

export type LayoutWidgetsResponse = {
    items?: LayoutWidget[]
}

export const buildExecutionRunId = (runId: string, testInfo: TestInfo): string => {
    const project =
        testInfo.project.name
            .replace(/[^a-zA-Z0-9]/g, '')
            .toLowerCase()
            .slice(-6) || 'project'
    return `${runId}-${project}-r${testInfo.retry}-p${testInfo.repeatEachIndex}-w${testInfo.workerIndex}`
}

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const expectLayoutWidgetLabelsReadable = async (page: Page, label: string): Promise<void> => {
    const labels = page.locator('.layout-widget-label:visible')
    await expect(labels, `${label} must expose widget labels`).not.toHaveCount(0)

    const metrics = await labels.evaluateAll((elements) =>
        elements.map((element) => {
            const node = element as HTMLElement
            const rect = node.getBoundingClientRect()
            const styles = window.getComputedStyle(node)
            return {
                text: node.innerText,
                width: rect.width,
                height: rect.height,
                scrollWidth: node.scrollWidth,
                writingMode: styles.writingMode
            }
        })
    )
    const unreadable = metrics.filter(
        ({ text, width, height, scrollWidth, writingMode }) =>
            !text.trim() || width < 32 || height > 72 || scrollWidth > width + 1 || writingMode !== 'horizontal-tb'
    )
    expect(unreadable, `${label} contains clipped, vertical, or unusably narrow widget labels`).toEqual([])
}

export const expectStandardZoneSettingsFooter = async (dialog: Locator, label: string): Promise<void> => {
    const actions = dialog.getByTestId('layout-zone-settings-actions')
    await expect(actions, `${label} must use the shared dialog actions surface`).toHaveClass(/MuiDialogActions-root/)
    const spacing = await actions.evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
            right: Number.parseFloat(styles.paddingRight) || 0,
            bottom: Number.parseFloat(styles.paddingBottom) || 0
        }
    })
    expect(spacing.right, `${label} must preserve the standard right footer inset`).toBeGreaterThanOrEqual(23)
    expect(spacing.bottom, `${label} must preserve the standard bottom footer inset`).toBeGreaterThanOrEqual(23)
}

export const expectStandardDialogActionFooter = async (dialog: Locator, label: string): Promise<void> => {
    const actions = dialog.locator('.MuiDialogActions-root').last()
    await expect(actions, `${label} must use the shared MUI dialog actions surface`).toBeVisible()
    const spacing = await actions.evaluate((element) => {
        const styles = window.getComputedStyle(element)
        return {
            right: Number.parseFloat(styles.paddingRight) || 0,
            bottom: Number.parseFloat(styles.paddingBottom) || 0
        }
    })
    expect(spacing.right, `${label} must preserve the standard right footer inset`).toBeGreaterThanOrEqual(23)
    expect(spacing.bottom, `${label} must preserve the standard bottom footer inset`).toBeGreaterThanOrEqual(23)
}

export const expectRussianMarketingHeaderLabels = async (zone: Locator): Promise<void> => {
    for (const label of ['Бренд', 'Навигация', 'Аутентификация', 'Переключатель языка', 'Переключатель темы']) {
        await expect(zone.getByText(label, { exact: true }), `Russian header must expose ${label}`).toBeVisible()
    }
    await expect(zone).not.toContainText(/Brand|Authentication|Language switcher|Color mode switcher/)
}

export const responseIsMutation = (response: Response, method: string, path: RegExp): boolean =>
    response.request().method() === method && path.test(new URL(response.url()).pathname)

export const openCreateDialog = async (page: Page, name: string): Promise<Locator> => {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name })
    await expect(dialog).toBeVisible()
    return dialog
}

export const fillLocalizedField = async (dialog: Locator, label: string, value: string): Promise<void> => {
    // LocalizedInlineField renders a labelled textbox for the active locale;
    // role/name is stable even while MUI rehydrates the floating label.
    await dialog.getByRole('textbox', { name: label, exact: true }).first().fill(value)
}

export const fillLocalizedFieldValues = async (
    page: Page,
    dialog: Locator,
    label: string,
    values: { en: string; ru: string }
): Promise<void> => {
    const findLocaleRow = async (locale: 'en' | 'ru'): Promise<Locator | null> => {
        const rows = dialog.getByTestId(`localized-inline-row-${locale}`)
        for (let index = 0; index < (await rows.count()); index += 1) {
            const row = rows.nth(index)
            if ((await row.getByRole('textbox', { name: label, exact: true }).count()) > 0) return row
        }
        return null
    }

    const englishRow = await findLocaleRow('en')
    if (!englishRow) throw new Error(`Localized field ${label} did not expose its English row`)
    await englishRow.getByRole('textbox', { name: label, exact: true }).fill(values.en)

    let russianRow = await findLocaleRow('ru')
    if (!russianRow) {
        await englishRow.getByRole('button', { name: 'EN', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Add language', exact: true }).click()
        await page.getByRole('menuitem', { name: 'Русский', exact: true }).click()
        russianRow = await findLocaleRow('ru')
    }
    if (!russianRow) throw new Error(`Localized field ${label} did not expose its Russian row after adding the locale`)
    await russianRow.getByRole('textbox', { name: label, exact: true }).fill(values.ru)
}

export const enableSwitch = async (dialog: Locator, label: string): Promise<void> => {
    const input = dialog.getByLabel(label, { exact: true })
    await expect(input).toBeEnabled()
    if (!(await input.isChecked())) await input.check()
    await expect(input).toBeChecked()
}

export const selectMarketingTemplate = async (page: Page, dialog: Locator): Promise<void> => {
    const templateSelect = dialog.getByLabel('Select template', { exact: true })
    await expect(templateSelect).toBeVisible()
    await templateSelect.click()

    const marketingOption = page.getByRole('option', { name: /Marketing page/i })
    await expect(marketingOption).toBeVisible()
    await marketingOption.click()
    await expect(templateSelect).toContainText(/Marketing page/i)
}

export const openVisibleRowMenu = async (page: Page, text: string): Promise<Locator> => {
    const row = page.getByRole('row').filter({ hasText: text }).first()
    await expect(row, `The row containing “${text}” should be visible`).toBeVisible()

    const menuButton = row.getByRole('button', { name: 'Options', exact: true })
    await expect(menuButton, `The row action for “${text}” should have a friendly accessible name`).toBeVisible()
    await expect(menuButton).not.toHaveAttribute('aria-label', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
    await menuButton.click()
    return row
}

export const ensureListView = async (page: Page): Promise<void> => {
    const listView = page.getByTitle(/^(?:List View|Списком)$/)
    if (await listView.count()) {
        await listView.click()
    }
}

export const waitForPublicationApplication = async (
    api: ApiSession,
    metahubId: string,
    publicationId: string
): Promise<PublicationApplication> => {
    let application: PublicationApplication | undefined
    await expect
        .poll(
            async () => {
                const payload = (await listPublicationApplications(api, metahubId, publicationId)) as PublicationApplicationsResponse
                application = payload.items?.[0]
                return application?.id ?? null
            },
            { timeout: 90_000, message: 'Waiting for the publication-linked application to be created' }
        )
        .not.toBeNull()

    if (!application?.id) {
        throw new Error('The publication did not expose a linked application')
    }

    return application
}

export const waitForApplicationConnector = async (api: ApiSession, applicationId: string): Promise<Connector> => {
    let connector: Connector | undefined
    await expect
        .poll(
            async () => {
                const payload = (await listConnectors(api, applicationId)) as ConnectorsResponse
                connector = payload.items?.[0]
                return connector?.id ?? null
            },
            { timeout: 90_000, message: 'Waiting for the publication connector to be created' }
        )
        .not.toBeNull()

    if (!connector?.id) {
        throw new Error('The linked application did not expose a connector')
    }

    return connector
}

export const waitForPublicationVersion = async (api: ApiSession, metahubId: string, publicationId: string): Promise<void> => {
    await expect
        .poll(
            async () => {
                const publication = await getPublication(api, metahubId, publicationId)
                return {
                    activeVersionId: publication?.activeVersionId ?? null,
                    schemaStatus: publication?.schemaStatus ?? null
                }
            },
            { timeout: 90_000, message: 'Waiting for the publication to expose an active version' }
        )
        .toMatchObject({ activeVersionId: expect.any(String) })
}

export const readLayoutWidgetConfig = (widget: LayoutWidget): Record<string, unknown> => {
    if (!widget.config || typeof widget.config !== 'object' || Array.isArray(widget.config)) return {}
    return widget.config as Record<string, unknown>
}

export const findMarketingWidget = async (
    api: ApiSession,
    metahubId: string,
    instanceKey: string
): Promise<{ layoutId: string; widgetId: string }> => {
    const layouts = (await listLayouts(api, metahubId, { limit: 100, offset: 0 })) as {
        items?: Array<{ id?: unknown; templateKey?: unknown }>
    }
    const marketingLayout = layouts.items?.find((layout) => layout.templateKey === 'marketing-page')
    if (typeof marketingLayout?.id !== 'string') {
        throw new Error('The browser-created marketing-page metahub did not expose its marketing layout')
    }

    const widgets = (await listLayoutZoneWidgets(api, metahubId, marketingLayout.id)) as LayoutWidgetsResponse
    const widget = widgets.items?.find((item) => readLayoutWidgetConfig(item).instanceKey === instanceKey)
    if (typeof widget?.id !== 'string') {
        throw new Error(`The marketing layout did not expose the ${instanceKey} widget`)
    }
    return { layoutId: marketingLayout.id, widgetId: widget.id }
}
