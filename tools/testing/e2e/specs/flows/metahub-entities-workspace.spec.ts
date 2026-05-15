import type { Response as PlaywrightResponse } from '@playwright/test'
import { createLocalizedContent, getVLCString } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    addMetahubMember,
    createAdminUser,
    createLoggedInApiContext,
    createMetahub,
    createComponent,
    disposeApiContext,
    getAssignableRoles,
    listMetahubEntityTypes,
    listMetahubScripts,
    listMetahubMembers,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { createLoggedInBrowserContext } from '../../support/browser/auth'
import { disposeBootstrapApiContext, createBootstrapApiContext } from '../../support/backend/bootstrap.mjs'
import { recordCreatedGlobalUser, recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { buildEntityMenuTriggerSelector, entityDialogSelectors, toolbarSelectors } from '../../support/selectors/contracts'

type EntityTypeRecord = {
    id?: string
    kindKey?: string
    published?: boolean
}

type EntityTypeListPayload = {
    items?: EntityTypeRecord[]
}

type EntityRecord = {
    id?: string
    description?: unknown
    name?: unknown
    codename?: unknown
}

type EntityListPayload = {
    items?: EntityRecord[]
}

type ActionRecord = {
    id?: string
    actionType?: string
    scriptId?: string | null
    codename?: unknown
}

type ActionListPayload = {
    items?: ActionRecord[]
}

type EventBindingRecord = {
    id?: string
    eventName?: string
    actionId?: string
    isActive?: boolean
    priority?: number
}

type EventBindingListPayload = {
    items?: EventBindingRecord[]
}

type ApiSessionLike = {
    baseURL: string
    cookies: Map<string, string>
}

type ListedMember = {
    id?: string
    userId?: string
    email?: string | null
}

function buildApiCookieHeader(api: ApiSessionLike): string {
    return Array.from(api.cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ')
}

const buildObjectInstancesPagePath = (metahubId: string, kindKey = 'object') =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instances`

const buildObjectComponentsPagePath = (metahubId: string, objectId: string, kindKey = 'object') =>
    `/metahub/${metahubId}/entities/${encodeURIComponent(kindKey)}/instance/${objectId}/components`

const buildEntityInstancesApiPath = (metahubId: string, kindKey: string) =>
    `/api/v1/metahub/${metahubId}/entities?kind=${encodeURIComponent(kindKey)}`

const buildEntityInstanceApiPath = (metahubId: string, entityId: string) => `/api/v1/metahub/${metahubId}/entity/${entityId}`

async function getEntityViaApi(api: ApiSessionLike, metahubId: string, entityId: string): Promise<EntityRecord> {
    const response = await fetch(new URL(buildEntityInstanceApiPath(metahubId, entityId), api.baseURL), {
        headers: {
            Accept: 'application/json',
            Cookie: buildApiCookieHeader(api)
        }
    })

    if (!response.ok) {
        throw new Error(`Fetching entity ${entityId} failed with ${response.status} ${response.statusText}: ${await response.text()}`)
    }

    return (await response.json()) as EntityRecord
}

async function listEntitiesViaApi(api: ApiSessionLike, metahubId: string, kindKey: string): Promise<EntityListPayload> {
    const response = await fetch(new URL(buildEntityInstancesApiPath(metahubId, kindKey), api.baseURL), {
        headers: {
            Accept: 'application/json',
            Cookie: buildApiCookieHeader(api)
        }
    })

    if (!response.ok) {
        throw new Error(`Listing entities for ${kindKey} failed with ${response.status} ${response.statusText}: ${await response.text()}`)
    }

    return (await response.json()) as EntityListPayload
}

async function listEntityActionsViaApi(api: ApiSessionLike, metahubId: string, entityId: string): Promise<ActionListPayload> {
    const response = await fetch(new URL(`/api/v1/metahub/${metahubId}/object/${entityId}/actions`, api.baseURL), {
        headers: {
            Accept: 'application/json',
            Cookie: buildApiCookieHeader(api)
        }
    })

    return parseApiJsonResponse(response, `Listing actions for entity ${entityId}`)
}

async function listEntityEventBindingsViaApi(api: ApiSessionLike, metahubId: string, entityId: string): Promise<EventBindingListPayload> {
    const response = await fetch(new URL(`/api/v1/metahub/${metahubId}/object/${entityId}/event-bindings`, api.baseURL), {
        headers: {
            Accept: 'application/json',
            Cookie: buildApiCookieHeader(api)
        }
    })

    return parseApiJsonResponse(response, `Listing event bindings for entity ${entityId}`)
}

function readLocalizedText(value: unknown, locale = 'en'): string | undefined {
    const resolved = getVLCString(value as Parameters<typeof getVLCString>[0], locale)
    return resolved || undefined
}

async function parseJsonResponse<T>(response: PlaywrightResponse, label: string): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok()) {
        throw new Error(`${label} failed with ${response.status()} ${response.statusText()}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

async function parseApiJsonResponse<T>(
    response: { ok: boolean; status: number; statusText: string; text(): Promise<string> },
    label: string
): Promise<T> {
    const bodyText = await response.text()

    if (!response.ok) {
        throw new Error(`${label} failed with ${response.status} ${response.statusText}: ${bodyText}`)
    }

    return JSON.parse(bodyText) as T
}

function resolveGlobalRoleIds(roles: Array<{ id?: string; codename?: string }>, roleCodenames: string[]) {
    const roleMap = new Map(roles.map((role) => [String(role.codename).toLowerCase(), role.id]))
    const roleIds = roleCodenames.map((codename) => roleMap.get(codename.toLowerCase())).filter(Boolean)

    if (roleIds.length !== roleCodenames.length) {
        const missing = roleCodenames.filter((codename) => !roleMap.has(codename.toLowerCase()))
        throw new Error(`Assignable global role(s) not found: ${missing.join(', ')}`)
    }

    return roleIds
}

function getListedMembers(payload: { members?: ListedMember[]; items?: ListedMember[] } | null | undefined): ListedMember[] {
    if (Array.isArray(payload?.members)) {
        return payload.members
    }

    if (Array.isArray(payload?.items)) {
        return payload.items
    }

    return []
}

async function waitForMetahubMember(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    predicate: (member: ListedMember) => boolean
) {
    let matchedMember: ListedMember | null = null

    await expect
        .poll(async () => {
            const payload = await listMetahubMembers(api, metahubId)
            matchedMember = getListedMembers(payload).find(predicate) ?? null
            return Boolean(matchedMember?.id)
        })
        .toBe(true)

    if (!matchedMember) {
        throw new Error(`Metahub member was not found for ${metahubId}`)
    }

    return matchedMember
}

async function createEntityTypeViaApi(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    payload: Record<string, unknown>
): Promise<EntityTypeRecord> {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entity-types`, payload)
    return parseApiJsonResponse<EntityTypeRecord>(response, 'Creating entity type via API')
}

async function createEntityInstanceViaApi(
    api: Awaited<ReturnType<typeof createLoggedInApiContext>>,
    metahubId: string,
    payload: Record<string, unknown>
): Promise<{ id?: string }> {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entities`, payload)
    return parseApiJsonResponse<{ id?: string }>(response, 'Creating entity instance via API')
}

function buildKindSuffix(runId: string): string {
    const normalized = runId.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return normalized.slice(-8) || 'e2e'
}

const GENERIC_ENTITY_WIDGET_SOURCE = `import { ExtensionScript, AtClient } from '@universo/extension-sdk'

export default class GenericEntityWidget extends ExtensionScript {
    @AtClient()
    async mount() {
        return { ok: true }
    }
}
`

test('@flow metahub entities workspace supports preset-backed create flow with backend persistence and Russian parity', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} entities workspace`
    const metahubCodename = `${runManifest.runId}-entities-workspace`
    const kindSuffix = buildKindSuffix(runManifest.runId)
    const customKindKey = `custom.object-${kindSuffix}`
    const customName = `Objects ${kindSuffix}`
    const instanceName = `${customName} Instance`
    const instanceCodename = `object-instance-${kindSuffix}`
    const entityDescription = `Entity description ${kindSuffix}`
    const copiedInstanceName = `${customName} Copy`
    const copiedInstanceCodename = `object-instance-${kindSuffix}-copy`
    const componentName = `Title ${kindSuffix}`
    const componentCodename = `title-${kindSuffix}`
    const standardManagedSurfaces = [
        { kindKey: 'hub', heading: 'Hubs' },
        { kindKey: 'set', heading: 'Sets' },
        { kindKey: 'enumeration', heading: 'Enumerations' }
    ]

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for entities workspace coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.addInitScript(() => {
            window.localStorage.setItem('metahubsEntityInstanceDisplayStyle', 'list')
        })
        await page.goto(`/metahub/${metahub.id}/entities`)

        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await expect(page.getByRole('heading', { name: 'Entities' })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Create')

        for (const surface of standardManagedSurfaces) {
            await page.goto(buildObjectInstancesPagePath(metahub.id, surface.kindKey))
            await expect(page).toHaveURL(`/metahub/${metahub.id}/entities/${surface.kindKey}/instances`)
            await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible()
            await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Create')
        }

        await page.goto(`/metahub/${metahub.id}/entities`)

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const createDialog = page.getByRole('dialog', { name: /Create Entity(?: Type)?/ })
        await expect(createDialog).toBeVisible()
        await expect(createDialog.getByLabel('Select template')).toBeVisible()
        await expect(createDialog.getByText('Reusable presets are sourced from the existing template registry.')).toBeVisible()

        await createDialog.getByLabel('Select template').click()
        await page.getByRole('option', { name: /^Objects\b/i }).click()

        await expect.poll(async () => createDialog.getByLabel('Kind key').inputValue()).toBe('object')
        await expect(createDialog.getByLabel('Name').first()).toHaveValue('Objects')
        await expect(createDialog.getByRole('checkbox', { name: 'Publish to dynamic menu' })).toBeChecked()
        await expect(createDialog.getByRole('checkbox', { name: 'Hubs' })).toBeChecked()
        await expect(createDialog.getByRole('checkbox', { name: 'Layout' })).toBeChecked()
        await expect(createDialog.getByRole('checkbox', { name: 'Scripts' })).toBeChecked()
        await createDialog.getByRole('tab', { name: 'Components' }).click()
        await expect(createDialog.getByRole('checkbox', { name: 'Data schema' })).toBeChecked()
        await expect(createDialog.getByRole('checkbox', { name: 'Physical table' })).toBeChecked()
        await createDialog.getByRole('tab', { name: 'General' }).click()

        await createDialog.getByLabel('Kind key').fill(customKindKey)
        await createDialog.getByLabel('Name').first().fill(customName)

        const createResponse = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entity-types`),
            { label: 'Creating entity type from preset' }
        )
        await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdEntityType = await parseJsonResponse<EntityTypeRecord>(await createResponse, 'Creating entity type from preset')
        if (!createdEntityType.id) {
            throw new Error('Create entity type response did not contain an id')
        }

        expect(createdEntityType.kindKey).toBe(customKindKey)
        await expect(page.getByRole('cell', { name: customName, exact: true })).toBeVisible()

        let persistedEntityType: EntityTypeRecord | undefined
        await expect
            .poll(
                async () => {
                    const payload = (await listMetahubEntityTypes(api, metahub.id, {
                        limit: 100,
                        offset: 0
                    })) as EntityTypeListPayload
                    persistedEntityType = payload.items?.find((item) => item.id === createdEntityType.id)
                    return persistedEntityType?.kindKey ?? null
                },
                { message: 'Waiting for created entity type to persist in backend list' }
            )
            .toBe(customKindKey)

        await page.goto(`/metahub/${metahub.id}/entities`)

        const dynamicMenuLink = page.getByRole('link', { name: customName, exact: true })
        await expect(dynamicMenuLink).toBeVisible()
        await dynamicMenuLink.click()

        await expect(page).toHaveURL(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await expect(page.getByRole('heading', { name: `${customName} instances` })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Create entity')

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const createInstanceDialog = page.getByRole('dialog', { name: 'Create Entity' })
        await expect(createInstanceDialog).toBeVisible()
        await createInstanceDialog.getByLabel('Name').first().fill(instanceName)
        await createInstanceDialog.getByLabel('Codename').first().fill(instanceCodename)

        const createInstanceResponse = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities`),
            { label: 'Creating entity through the generic entity surface' }
        )

        await createInstanceDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdObjectInstance = await parseJsonResponse<{ id?: string }>(
            await createInstanceResponse,
            'Creating entity through the generic entity surface'
        )

        if (!createdObjectInstance.id) {
            throw new Error('Create entity response did not contain an id')
        }

        await expect(page.getByText(instanceName, { exact: true })).toBeVisible()

        let persistedEntityRecord: EntityRecord | undefined
        await expect
            .poll(
                async () => {
                    const payload = await listEntitiesViaApi(api, metahub.id, customKindKey)
                    persistedEntityRecord = payload.items?.find((item) => item.id === createdObjectInstance.id)
                    return persistedEntityRecord?.id ?? null
                },
                { message: 'Waiting for the created entity instance to appear in the generic entity list' }
            )
            .toBe(createdObjectInstance.id)

        const createdEntityRow = page.getByRole('row').filter({ hasText: instanceName })
        await createdEntityRow.getByRole('button', { name: 'Edit' }).click()

        const entityEditDialog = page.getByRole('dialog', { name: 'Edit Entity' })
        await expect(entityEditDialog).toBeVisible()
        await expect(entityEditDialog.getByRole('tab', { name: 'Components' })).toBeVisible()
        await expect(entityEditDialog.getByRole('tab', { name: 'Layout' })).toBeVisible()
        await expect(entityEditDialog.getByRole('tab', { name: 'Scripts' })).toBeVisible()

        const entityEditResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'PATCH' &&
                response.url().endsWith(buildEntityInstanceApiPath(metahub.id, createdObjectInstance.id)),
            { label: 'Updating entity instance through the generic entity route' }
        )

        const entityDescriptionField = entityEditDialog.getByRole('tabpanel', { name: 'General' }).locator('textarea:not([readonly])')
        await entityDescriptionField.fill(entityDescription)
        await expect(entityDescriptionField).toHaveValue(entityDescription)
        await entityEditDialog.getByTestId(entityDialogSelectors.submitButton).click()
        const entityEditNetworkResponse = await entityEditResponse
        expect(entityEditNetworkResponse.request().postDataJSON()).toMatchObject({
            description: {
                en: entityDescription
            }
        })
        const entityEditResponseBody = (await entityEditNetworkResponse.json()) as EntityRecord
        expect(entityEditResponseBody.id).toBe(createdObjectInstance.id)
        await expect(entityEditDialog).toHaveCount(0)

        await expect
            .poll(
                async () => {
                    const entityRecord = await getEntityViaApi(api, metahub.id, createdObjectInstance.id)
                    return readLocalizedText(entityRecord.description)
                },
                { message: 'Waiting for the generic entity get-by-id endpoint to expose the edited description' }
            )
            .toBe(entityDescription)

        await expect
            .poll(
                async () => {
                    const payload = await listEntitiesViaApi(api, metahub.id, customKindKey)
                    const entityRecord = payload.items?.find((item) => item.id === createdObjectInstance.id)
                    return readLocalizedText(entityRecord?.description)
                },
                { message: 'Waiting for the generic entity list endpoint to expose the edited description' }
            )
            .toBe(entityDescription)

        await createComponent(api, metahub.id, createdObjectInstance.id, {
            name: { en: componentName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', componentCodename),
            dataType: 'STRING',
            isRequired: false
        })

        await page.goto(buildObjectInstancesPagePath(metahub.id, customKindKey))
        await expect(page.getByRole('heading', { name: `${customName} instances` })).toBeVisible()
        await expect(page.getByText(instanceName, { exact: true })).toBeVisible()
        const reopenedEntityRow = page.getByRole('row').filter({ hasText: instanceName })
        await reopenedEntityRow.getByRole('button', { name: 'Edit' }).click()

        const reopenedEditDialog = page.getByRole('dialog', { name: 'Edit Entity' })
        await expect(reopenedEditDialog).toBeVisible()
        await expect(reopenedEditDialog.getByRole('tabpanel', { name: 'General' }).locator('textarea:not([readonly])')).toHaveValue(
            entityDescription
        )
        await reopenedEditDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(reopenedEditDialog).toHaveCount(0)

        await page.goto(buildObjectComponentsPagePath(metahub.id, createdObjectInstance.id, customKindKey))
        const entityBreadcrumbs = page.getByLabel('breadcrumb')
        await expect(page.getByRole('heading', { name: 'Components' })).toBeVisible()
        await expect(entityBreadcrumbs).toContainText('Entities')
        await expect(entityBreadcrumbs).toContainText('Objects')
        await expect(entityBreadcrumbs).toContainText(instanceName)
        await expect(entityBreadcrumbs.getByRole('link', { name: 'Objects' })).toHaveAttribute(
            'href',
            `/metahub/${metahub.id}/entities/${encodeURIComponent(customKindKey)}/instances`
        )
        await expect(entityBreadcrumbs.getByRole('link', { name: instanceName })).toHaveAttribute(
            'href',
            `/metahub/${metahub.id}/entities/${encodeURIComponent(customKindKey)}/instance/${createdObjectInstance.id}/components`
        )
        await page.getByRole('tab', { name: 'System' }).click()
        await expect(page.getByRole('heading', { name: 'System Components' })).toBeVisible()
        await expect(entityBreadcrumbs).toContainText('System Components')
        await page.getByRole('tab', { name: /Records|Elements|records.title/ }).click()
        await expect(page.getByRole('heading', { name: /Records|Elements|records.title/ })).toBeVisible()
        await expect(entityBreadcrumbs).toContainText(/Records|Elements|records.title/)

        await page.goto(buildObjectInstancesPagePath(metahub.id, customKindKey))
        const copySourceRow = page.getByRole('row').filter({ hasText: instanceName })
        await copySourceRow.getByRole('button', { name: 'Copy' }).click()

        const entityCopyDialog = page.getByRole('dialog', { name: 'Copy Entity' })
        await expect(entityCopyDialog).toBeVisible()
        await entityCopyDialog.getByLabel('Name').first().fill(copiedInstanceName)
        await entityCopyDialog.getByLabel('Codename').first().fill(copiedInstanceCodename)

        const entityCopyResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`${buildEntityInstanceApiPath(metahub.id, createdObjectInstance.id)}/copy`),
            { label: 'Copying entity instance through the generic entity route' }
        )

        await entityCopyDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const copiedEntity = await parseJsonResponse<{ id?: string }>(
            await entityCopyResponse,
            'Copying entity instance through the generic entity route'
        )

        if (!copiedEntity.id) {
            throw new Error('Copy entity response did not contain an id')
        }

        await expect
            .poll(
                async () => {
                    const payload = await listEntitiesViaApi(api, metahub.id, customKindKey)
                    return payload.items?.some((item) => item.id === copiedEntity.id) ?? false
                },
                { message: 'Waiting for the copied entity instance to appear in the generic entity list' }
            )
            .toBe(true)

        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await expect(page.getByText(copiedInstanceName, { exact: true })).toBeVisible()

        await applyBrowserPreferences(page, { language: 'ru' })
        await page.goto(`/metahub/${metahub.id}/entities`)

        await expect(page.locator('html')).toHaveAttribute('lang', 'ru')
        await expect(page.getByRole('heading', { name: 'Сущности' })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Создать')
        const customEntityLink = page.locator(`a[href="/metahub/${metahub.id}/entities/${customKindKey}/instances"]`).first()
        await expect(customEntityLink).toBeVisible()
        await customEntityLink.click()
        await expect(page.getByRole('heading', { name: /Объекты|Objects/ })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Создать')
        await page.goto(`/metahub/${metahub.id}/entities`)

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const ruDialog = page.getByRole('dialog', { name: 'Создать тип сущности' })
        await expect(ruDialog).toBeVisible()
        await expect(ruDialog.getByLabel('Выберите шаблон')).toBeVisible()

        await ruDialog.getByLabel('Выберите шаблон').click()
        await expect(page.getByRole('option', { name: /Объекты|Objects/i }).first()).toBeVisible()
        await page.keyboard.press('Escape')
        await ruDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(ruDialog).toHaveCount(0)
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow metahub custom entity instances author scripts actions and events through the browser with custom attachment kinds', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const metahubName = `E2E ${runManifest.runId} custom entity scripts`
    const metahubCodename = `${runManifest.runId}-custom-entity-scripts`
    const kindSuffix = buildKindSuffix(`${runManifest.runId}-scripts`)
    const customKindKey = `custom.entity-${kindSuffix}`
    const customTypeName = `Entity ${kindSuffix}`
    const typeCodename = `Document${kindSuffix}`
    const entityName = `${customTypeName} Instance`
    const entityCodename = `entity-instance-${kindSuffix}`
    const scriptName = `${customTypeName} Widget`
    const scriptCodename = `entity-widget-${kindSuffix}`
    const actionName = `${customTypeName} Render Action`
    const actionCodename = `entity-render-${kindSuffix}`
    const bindingPriority = '10'

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for custom entity scripts coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const createdEntityType = await createEntityTypeViaApi(api, metahub.id, {
            kindKey: customKindKey,
            codename: createLocalizedContent('en', typeCodename),
            presentation: {},
            components: {
                dataSchema: { enabled: true },
                records: false,
                treeAssignment: false,
                optionValues: false,
                constants: false,
                hierarchy: false,
                nestedCollections: false,
                relations: false,
                actions: { enabled: true },
                events: { enabled: true },
                scripting: { enabled: true },
                layoutConfig: false,
                runtimeBehavior: false,
                physicalTable: { enabled: true, prefix: `ent${kindSuffix.slice(0, 6) || 'e2e'}` }
            },
            ui: {
                iconName: 'IconLayoutDashboard',
                tabs: ['general', 'scripts'],
                sidebarSection: 'objects',
                nameKey: customTypeName,
                descriptionKey: 'Custom entity script browser proof'
            },
            published: false
        })

        if (!createdEntityType.id) {
            throw new Error('Entity type creation did not return an id for custom entity scripts coverage')
        }

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)

        await expect(page.getByRole('heading', { name: `${customTypeName} instances` })).toBeVisible()
        await expect(page.getByTestId(toolbarSelectors.primaryAction)).toContainText('Create entity')

        await page.getByTestId(toolbarSelectors.primaryAction).click()

        const createEntityDialog = page.getByRole('dialog', { name: 'Create entity' })
        await expect(createEntityDialog).toBeVisible()
        await createEntityDialog.getByLabel('Name').first().fill(entityName)
        await createEntityDialog.getByLabel('Codename').first().fill(entityCodename)

        const createEntityResponse = waitForSettledMutationResponse(
            page,
            (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/entities`),
            { label: 'Creating generic entity instance for script coverage' }
        )

        await createEntityDialog.getByTestId(entityDialogSelectors.submitButton).click()

        const createdEntity = await parseJsonResponse<{ id?: string }>(
            await createEntityResponse,
            'Creating generic entity instance for script coverage'
        )

        if (!createdEntity.id) {
            throw new Error('Create entity instance response did not contain an id for custom entity scripts coverage')
        }

        await expect(page.getByText(entityName, { exact: true })).toBeVisible()
        await page.getByRole('button', { name: 'Edit' }).first().click()

        let editEntityDialog = page.getByRole('dialog', { name: 'Edit Entity' })
        await expect(editEntityDialog).toBeVisible()
        await editEntityDialog.getByRole('tab', { name: 'Scripts' }).click()
        await expect(editEntityDialog.getByRole('heading', { name: 'Attached scripts' })).toBeVisible()

        await editEntityDialog.getByRole('combobox').first().click()
        await page.getByRole('option', { name: 'Widget' }).click()
        await editEntityDialog.getByLabel('Name').first().fill(scriptName)
        await editEntityDialog.getByLabel('Codename').first().fill(scriptCodename)

        const editorContent = editEntityDialog.locator('.cm-content').first()
        await expect(editorContent).toBeVisible()
        await editorContent.click()
        await page.keyboard.press('Control+A')
        await page.keyboard.press('Delete')
        await page.keyboard.insertText(GENERIC_ENTITY_WIDGET_SOURCE)

        const createScriptRequest = page.waitForRequest(
            (request) => request.method() === 'POST' && request.url().endsWith(`/api/v1/metahub/${metahub.id}/scripts`)
        )
        const createScriptResponse = page.waitForResponse(
            (response) =>
                response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahub.id}/scripts`) && response.ok()
        )

        await editEntityDialog.getByRole('button', { name: 'Create script' }).click()

        const request = await createScriptRequest
        const requestPayload = request.postDataJSON()
        expect(requestPayload?.attachedToKind).toBe(customKindKey)
        expect(requestPayload?.attachedToId).toBe(createdEntity.id)
        expect(requestPayload?.sourceCode).toContain('GenericEntityWidget')

        const response = await createScriptResponse
        const createdScript = await response.json()
        expect(typeof createdScript?.id).toBe('string')
        expect(createdScript?.attachedToKind).toBe(customKindKey)

        await editEntityDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(editEntityDialog).toHaveCount(0)

        await page.getByRole('button', { name: 'Edit' }).first().click()
        editEntityDialog = page.getByRole('dialog', { name: 'Edit Entity' })
        await expect(editEntityDialog).toBeVisible()

        await editEntityDialog.getByRole('tab', { name: 'Actions' }).click()
        const actionsPanel = editEntityDialog.locator('[role="tabpanel"]:visible')
        await expect(actionsPanel.getByText('Configured actions')).toBeVisible()
        await actionsPanel.getByLabel('Action name').fill(actionName)
        await actionsPanel.getByLabel('Action codename').fill(actionCodename)

        await actionsPanel.getByRole('combobox').nth(1).click()
        await page.getByRole('option', { name: scriptName, exact: true }).click()

        const createActionResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/object/${createdEntity.id}/actions`),
            { label: 'Creating entity action for custom entity automation coverage' }
        )

        await actionsPanel.getByRole('button', { name: 'Create action' }).click()

        const createdAction = await parseJsonResponse<{ id?: string; scriptId?: string | null; actionType?: string }>(
            await createActionResponse,
            'Creating entity action for custom entity automation coverage'
        )

        if (!createdAction.id) {
            throw new Error('Create action response did not contain an id for custom entity automation coverage')
        }

        expect(createdAction?.scriptId).toBe(createdScript.id)
        expect(createdAction?.actionType).toBe('script')
        await expect(actionsPanel.getByText(actionName, { exact: true })).toBeVisible()

        await editEntityDialog.getByRole('tab', { name: 'Events' }).click()
        const eventsPanel = editEntityDialog.locator('[role="tabpanel"]:visible')
        await expect(eventsPanel.getByText('Configured event bindings')).toBeVisible()
        await eventsPanel.getByRole('combobox').nth(1).click()
        await page.getByRole('option', { name: new RegExp(actionName) }).click()
        await eventsPanel.getByLabel('Priority').fill(bindingPriority)

        const createBindingResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                response.request().method() === 'POST' &&
                response.url().endsWith(`/api/v1/metahub/${metahub.id}/object/${createdEntity.id}/event-bindings`),
            { label: 'Creating event binding for custom entity automation coverage' }
        )

        await eventsPanel.getByRole('button', { name: 'Create binding' }).click()

        const createdBinding = await parseJsonResponse<{
            id?: string
            eventName?: string
            actionId?: string
            isActive?: boolean
            priority?: number
        }>(await createBindingResponse, 'Creating event binding for custom entity automation coverage')

        if (!createdBinding.id) {
            throw new Error('Create event binding response did not contain an id for custom entity automation coverage')
        }

        expect(createdBinding?.actionId).toBe(createdAction.id)
        expect(createdBinding?.eventName).toBe('afterUpdate')
        expect(createdBinding?.isActive).toBe(true)
        expect(createdBinding?.priority).toBe(Number(bindingPriority))
        await expect(eventsPanel.getByText(`afterUpdate → ${actionName} · ${scriptName}`)).toBeVisible()

        const persistedScripts = await listMetahubScripts(api, metahub.id, {
            attachedToKind: customKindKey,
            attachedToId: createdEntity.id,
            limit: 100,
            offset: 0
        })
        expect(Array.isArray(persistedScripts?.items)).toBe(true)
        expect(persistedScripts.items?.some((script) => script.id === createdScript.id)).toBe(true)

        const persistedActions = await listEntityActionsViaApi(api, metahub.id, createdEntity.id)
        const persistedAction = persistedActions.items?.find((action) => action.id === createdAction.id)
        expect(persistedAction?.scriptId).toBe(createdScript.id)
        expect(persistedAction?.actionType).toBe('script')
        expect(readLocalizedText(persistedAction?.codename)).toBe(actionCodename)

        const persistedBindings = await listEntityEventBindingsViaApi(api, metahub.id, createdEntity.id)
        const persistedBinding = persistedBindings.items?.find((binding) => binding.id === createdBinding.id)
        expect(persistedBinding?.actionId).toBe(createdAction.id)
        expect(persistedBinding?.eventName).toBe('afterUpdate')
        expect(persistedBinding?.priority).toBe(Number(bindingPriority))
        expect(persistedBinding?.isActive).toBe(true)

        await editEntityDialog.getByTestId(entityDialogSelectors.cancelButton).click()
        await expect(editEntityDialog).toHaveCount(0)
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow @permission object-style entity instances stay read-only for metahub members', async ({ browser, runManifest }) => {
    test.setTimeout(300_000)

    const bootstrapApi = await createBootstrapApiContext()
    const ownerApi = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const memberEmail = `e2e+${runManifest.runId}.object-member@${process.env.E2E_TEST_USER_EMAIL_DOMAIN || 'example.test'}`
    const memberPassword = process.env.E2E_TEST_USER_PASSWORD || 'ChangeMe_E2E-123456!'
    const defaultRoleCodenames = String(process.env.E2E_TEST_USER_ROLE_CODENAMES || 'User')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    const metahubName = `E2E ${runManifest.runId} object-style member metahub`
    const metahubCodename = `${runManifest.runId}-object-style-member`
    const kindSuffix = buildKindSuffix(`${runManifest.runId}-readonly`)
    const customKindKey = `custom.object-readonly-${kindSuffix}`
    const customName = `Objects Read Only ${kindSuffix}`
    const instanceName = `${customName} Instance`
    const typeCodename = `ObjectReadOnly${kindSuffix}`
    const instanceCodename = `ObjectReadOnly${kindSuffix}`

    let memberSession: Awaited<ReturnType<typeof createLoggedInBrowserContext>> | null = null

    try {
        const assignableRoles = await getAssignableRoles(bootstrapApi)
        const defaultRoleIds = resolveGlobalRoleIds(assignableRoles, defaultRoleCodenames)

        const createdUser = await createAdminUser(bootstrapApi, {
            email: memberEmail,
            password: memberPassword,
            roleIds: defaultRoleIds,
            comment: `Created for object-style member ACL coverage ${runManifest.runId}`
        })

        if (!createdUser?.userId) {
            throw new Error(`Created user ${memberEmail} did not return a user id`)
        }

        await recordCreatedGlobalUser({ userId: createdUser.userId, email: memberEmail })

        const metahub = await createMetahub(ownerApi, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for object-style member coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        const createdEntityType = await createEntityTypeViaApi(ownerApi, metahub.id, {
            kindKey: customKindKey,
            codename: createLocalizedContent('en', typeCodename),
            presentation: {},
            components: {
                dataSchema: { enabled: true },
                records: { enabled: true },
                treeAssignment: { enabled: true },
                optionValues: false,
                constants: false,
                hierarchy: { enabled: true, supportsFolders: true },
                nestedCollections: false,
                relations: { enabled: true, allowedRelationTypes: ['manyToOne'] },
                actions: { enabled: true },
                events: { enabled: true },
                scripting: { enabled: true },
                layoutConfig: { enabled: true },
                runtimeBehavior: { enabled: true },
                physicalTable: { enabled: true, prefix: `cv${kindSuffix.slice(0, 6) || 'read'}` }
            },
            ui: {
                iconName: 'IconDatabase',
                tabs: ['general', 'hubs', 'layout', 'scripts'],
                sidebarSection: 'objects',
                nameKey: customName,
                descriptionKey: 'Object-style read-only ACL proof'
            },
            config: {
                compatibility: {
                    legacyObjectKind: 'object'
                }
            },
            published: true
        })

        if (!createdEntityType.id) {
            throw new Error('Entity type creation did not return an id for object-style member coverage')
        }

        const createdInstance = await createEntityInstanceViaApi(ownerApi, metahub.id, {
            kind: customKindKey,
            codename: createLocalizedContent('en', instanceCodename),
            name: { en: instanceName },
            namePrimaryLocale: 'en'
        })

        if (!createdInstance.id) {
            throw new Error('Entity instance creation did not return an id for object-style member coverage')
        }

        await addMetahubMember(ownerApi, metahub.id, {
            email: memberEmail,
            role: 'member'
        })

        await waitForMetahubMember(ownerApi, metahub.id, (member) => member.userId === createdUser.userId)

        memberSession = await createLoggedInBrowserContext(browser, {
            email: memberEmail,
            password: memberPassword
        })

        const memberPage = memberSession.page
        await applyBrowserPreferences(memberPage, { language: 'en' })
        await memberPage.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)

        await expect(memberPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/entities/${customKindKey}/instances(?:\\?.*)?$`))
        await expect(memberPage.getByRole('heading', { name: 'Objects' })).toBeVisible()
        await expect(memberPage.getByText(instanceName, { exact: true })).toBeVisible()
        await expect(memberPage.getByTestId(toolbarSelectors.primaryAction)).toHaveCount(0)
        await expect(memberPage.getByTestId(buildEntityMenuTriggerSelector(customKindKey, createdInstance.id))).toHaveCount(0)
        await expect(memberPage.getByRole('button', { name: 'Edit' })).toHaveCount(0)
        await expect(memberPage.getByRole('button', { name: 'Copy' })).toHaveCount(0)
        await expect(memberPage.getByRole('button', { name: 'Delete' })).toHaveCount(0)

        await memberPage.goto(`/metahub/${metahub.id}/entities`)

        await expect(memberPage).toHaveURL(new RegExp(`/metahub/${metahub.id}/entities(?:\\?.*)?$`))
        await expect(memberPage.getByRole('heading', { name: 'Entities' })).toBeVisible()
        await expect(memberPage.getByRole('link', { name: customName, exact: true })).toBeVisible()
        await expect(memberPage.getByTestId(toolbarSelectors.primaryAction)).toHaveCount(0)
        await expect(memberPage.getByRole('button', { name: /Create Entity(?: Type)?/ })).toHaveCount(0)
        await expect(memberPage.getByRole('button', { name: 'Edit Entity Type' })).toHaveCount(0)
    } finally {
        await memberSession?.context.close().catch(() => undefined)
        await disposeApiContext(ownerApi)
        await disposeBootstrapApiContext(bootstrapApi)
    }
})
