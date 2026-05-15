import type { Locator, Page, Response as PlaywrightResponse } from '@playwright/test'

import { createLocalizedContent } from '@universo/utils'

import { expect } from '../../fixtures/test'
import { createMetahubEntityType, createLoggedInApiContext, getTemplate, listTemplates } from '../../support/backend/api-session.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'

export type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

export type ListPayload<T> = {
    items?: T[]
}

export type PresetEntityTypeCreateOptions = {
    templateCodename: string
    expectedKindKey: string
    customKindKey: string
    customDisplayName?: string
    customCodename?: string
    published?: boolean
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const getResponseData = (payload: unknown): Record<string, unknown> => {
    if (isRecord(payload?.data)) {
        return payload.data
    }

    return isRecord(payload) ? payload : {}
}

export const readLocalizedText = (value: unknown, locale = 'en'): string | undefined => {
    if (typeof value === 'string') {
        return value
    }

    if (!value || typeof value !== 'object') {
        return undefined
    }

    const raw = value as {
        _primary?: unknown
        locales?: Record<string, { content?: unknown }>
    }
    const normalizedLocale = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const directValue = raw.locales?.[normalizedLocale]?.content
    if (typeof directValue === 'string' && directValue.length > 0) {
        return directValue
    }

    const primaryLocale = typeof raw._primary === 'string' ? raw._primary : undefined
    const primaryValue = primaryLocale ? raw.locales?.[primaryLocale]?.content : undefined
    if (typeof primaryValue === 'string' && primaryValue.length > 0) {
        return primaryValue
    }

    const fallbackValue = Object.values(raw.locales ?? {}).find(
        (entry) => typeof entry?.content === 'string' && entry.content.length > 0
    )?.content
    return typeof fallbackValue === 'string' ? fallbackValue : undefined
}

export async function parseJsonResponse<T>(response: PlaywrightResponse, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

export function buildKindSuffix(runId: string): string {
    const normalized = runId.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return normalized.slice(-8) || 'e2e'
}

export async function openEntityDialog(page: Page, dialogName: string): Promise<Locator> {
    await page.getByTestId(toolbarSelectors.primaryAction).click()
    const dialog = page.getByRole('dialog', { name: dialogName })
    await expect(dialog).toBeVisible()
    return dialog
}

export async function fillNameAndCodename(dialog: Locator, values: { name?: string; codename: string }) {
    if (typeof values.name === 'string') {
        await dialog.getByLabel('Name').first().fill(values.name)
    }

    await dialog.getByLabel('Codename').first().fill(values.codename)
}

export async function waitForListEntity<T extends { id?: string }>(
    loader: () => Promise<ListPayload<T>>,
    expectedId: string,
    label: string
): Promise<T> {
    let matched: T | undefined

    await expect
        .poll(
            async () => {
                const payload = await loader()
                matched = payload.items?.find((item) => item.id === expectedId)
                return Boolean(matched?.id)
            },
            { message: `Waiting for ${label} ${expectedId} to appear in backend list` }
        )
        .toBe(true)

    if (!matched) {
        throw new Error(`Unable to find ${label} ${expectedId} in backend list`)
    }

    return matched
}

export async function waitForEntityAbsence<T extends { id?: string }>(
    loader: () => Promise<ListPayload<T>>,
    expectedId: string,
    label: string
) {
    await expect
        .poll(
            async () => {
                const payload = await loader()
                return payload.items?.some((item) => item.id === expectedId) ?? false
            },
            { message: `Waiting for ${label} ${expectedId} to disappear from backend list` }
        )
        .toBe(false)
}

export async function getPresetEntityType(api: ApiContext, templateCodename: string, expectedKindKey: string) {
    const templatesPayload = await listTemplates(api, {
        definitionType: 'entity_type_preset'
    })
    const templateItems = Array.isArray(templatesPayload?.data) ? templatesPayload.data : []
    const presetTemplate = templateItems.find((template) => template?.codename === templateCodename)

    expect(presetTemplate?.id).toBeTruthy()

    const templateDetail = await getTemplate(api, String(presetTemplate?.id))
    const manifest = isRecord(templateDetail?.activeVersionManifest) ? templateDetail.activeVersionManifest : null
    const entityType = manifest && isRecord(manifest.entityType) ? manifest.entityType : null

    expect(entityType?.kindKey).toBe(expectedKindKey)

    return entityType
}

export async function createPresetEntityTypeViaApi(api: ApiContext, metahubId: string, options: PresetEntityTypeCreateOptions) {
    const entityType = await getPresetEntityType(api, options.templateCodename, options.expectedKindKey)
    const presentation = isRecord(entityType?.presentation) ? { ...entityType.presentation } : {}
    const ui = isRecord(entityType?.ui) ? { ...entityType.ui } : {}

    if (options.customDisplayName) {
        presentation.name = createLocalizedContent('en', options.customDisplayName)
        ui.nameKey = options.customDisplayName
    }

    const createdPayload = await createMetahubEntityType(api, metahubId, {
        kindKey: options.customKindKey,
        codename: options.customCodename ? createLocalizedContent('en', options.customCodename) : entityType?.codename,
        presentation,
        components: isRecord(entityType?.components) ? entityType.components : {},
        ui,
        config: isRecord(entityType?.config) ? entityType.config : {},
        published: options.published ?? true
    })

    return getResponseData(createdPayload)
}
