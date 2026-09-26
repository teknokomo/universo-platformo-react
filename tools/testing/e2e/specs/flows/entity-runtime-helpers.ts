import type { Locator, Page } from '@playwright/test'

import { createLocalizedContent } from '@universo-react/utils'

import { expect } from '../../fixtures/test'
import { createMetahubEntityType, createLoggedInApiContext, getTemplate, listTemplates } from '../../support/backend/api-session.mjs'
import { toolbarSelectors } from '../../support/selectors/contracts'
export { parseJsonResponse, readLocalizedText } from '../../support/entityRuntimeParsing'

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

const ENTITY_TYPE_UI_CREATE_KEYS = [
    'iconName',
    'tabs',
    'sidebarSection',
    'sidebarOrder',
    'nameKey',
    'descriptionKey',
    'resourceSurfaces',
    'treeAssignmentLabels'
] as const

const pickEntityTypeUiCreateFields = (ui: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(ENTITY_TYPE_UI_CREATE_KEYS.filter((key) => ui[key] !== undefined).map((key) => [key, ui[key]]))

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
        capabilities: isRecord(entityType?.capabilities) ? entityType.capabilities : {},
        ui: pickEntityTypeUiCreateFields(ui),
        config: isRecord(entityType?.config) ? entityType.config : {},
        published: options.published ?? true
    })

    return getResponseData(createdPayload)
}
