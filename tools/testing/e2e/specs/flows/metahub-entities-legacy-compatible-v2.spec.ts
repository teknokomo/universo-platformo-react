import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createMetahubAttribute,
    createMetahubCatalog,
    disposeApiContext,
    getEnumerationValue,
    getMetahubEnumeration,
    getMetahubHub,
    getMetahubSet,
    getSetConstant,
    listEnumerationValues,
    listMetahubEnumerations,
    listMetahubHubs,
    listLayouts,
    listLayoutZoneWidgets,
    listMetahubSets,
    listSetConstants,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { waitForSettledMutationResponse } from '../../support/browser/network'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import {
    buildLayoutZoneSelector,
    buildEntityMenuItemSelector,
    buildEntityMenuTriggerSelector,
    entityDialogSelectors
} from '../../support/selectors/contracts'
import {
    buildKindSuffix,
    createPresetEntityTypeViaApi,
    fillNameAndCodename,
    getResponseData,
    openEntityDialog,
    parseJsonResponse,
    readLocalizedText,
    waitForEntityAbsence,
    waitForListEntity,
    type ApiContext,
    type ListPayload
} from './entity-v2-helpers'

type EntityRecord = {
    id?: string
    kind?: string
    description?: unknown
    name?: unknown
}

type LeafEntityRecord = {
    id?: string
    codename?: unknown
    name?: unknown
}

type LayoutListResponse = {
    items?: Array<{
        id?: string
    }>
}

type LayoutWidgetRecord = {
    id?: string
    widgetKey?: string
    config?: Record<string, unknown> | null
}

type LeafFlowConfig = {
    path: string
    heading: string
    createDialog: string
    createEndpoint: (metahubId: string, parentId: string) => string
    list: (api: ApiContext, metahubId: string, parentId: string) => Promise<ListPayload<LeafEntityRecord>>
    get: (api: ApiContext, metahubId: string, parentId: string, entityId: string) => Promise<LeafEntityRecord>
    namePrefix: string
    codenamePrefix: string
}

type LegacyCompatiblePresetCase = {
    slug: 'hub' | 'set' | 'enumeration'
    templateCodename: string
    templateLabel: RegExp
    defaultKindKey: string
    typeCodenameBase: string
    typeName: string
    entityKind: 'hub' | 'set' | 'enumeration'
    legacyRoute: string
    routeHeading: string
    createDialog: string
    editDialog: string
    copyDialog: string
    deleteDialog: string
    createEndpoint: (metahubId: string) => string
    copyEndpoint: (metahubId: string, entityId: string) => string
    deleteEndpoint: (metahubId: string, entityId: string) => string
    list: (api: ApiContext, metahubId: string, params: Record<string, unknown>) => Promise<ListPayload<EntityRecord>>
    get: (api: ApiContext, metahubId: string, entityId: string) => Promise<EntityRecord>
    leafFlow?: LeafFlowConfig
}

const responseMatchesPath = (response: { url(): string }, path: string): boolean => {
    const url = new URL(response.url())
    return url.pathname.endsWith(path)
}

const PRESET_CASES: LegacyCompatiblePresetCase[] = [
    {
        slug: 'hub',
        templateCodename: 'hub-v2',
        templateLabel: /Hubs V2/i,
        defaultKindKey: 'custom.hub-v2',
        typeCodenameBase: 'HubV2',
        typeName: 'Hubs V2',
        entityKind: 'hub',
        legacyRoute: 'hubs',
        routeHeading: 'Hubs',
        createDialog: 'Create Hub',
        editDialog: 'Edit Hub',
        copyDialog: 'Copying Hub',
        deleteDialog: 'Delete Hub',
        createEndpoint: (metahubId) => `/api/v1/metahub/${metahubId}/hubs`,
        copyEndpoint: (metahubId, entityId) => `/api/v1/metahub/${metahubId}/hub/${entityId}/copy`,
        deleteEndpoint: (metahubId, entityId) => `/api/v1/metahub/${metahubId}/hub/${entityId}`,
        list: (api, metahubId, params) => listMetahubHubs(api, metahubId, params),
        get: (api, metahubId, entityId) => getMetahubHub(api, metahubId, entityId)
    },
    {
        slug: 'set',
        templateCodename: 'set-v2',
        templateLabel: /Sets V2/i,
        defaultKindKey: 'custom.set-v2',
        typeCodenameBase: 'SetV2',
        typeName: 'Sets V2',
        entityKind: 'set',
        legacyRoute: 'sets',
        routeHeading: 'Sets',
        createDialog: 'Create Set',
        editDialog: 'Edit Set',
        copyDialog: 'Copying Set',
        deleteDialog: 'Delete Set',
        createEndpoint: (metahubId) => `/api/v1/metahub/${metahubId}/sets`,
        copyEndpoint: (metahubId, entityId) => `/api/v1/metahub/${metahubId}/set/${entityId}/copy`,
        deleteEndpoint: (metahubId, entityId) => `/api/v1/metahub/${metahubId}/set/${entityId}`,
        list: (api, metahubId, params) => listMetahubSets(api, metahubId, params),
        get: (api, metahubId, entityId) => getMetahubSet(api, metahubId, entityId),
        leafFlow: {
            path: 'constants',
            heading: 'Constants',
            createDialog: 'Create Constant',
            createEndpoint: (metahubId, parentId) => `/api/v1/metahub/${metahubId}/set/${parentId}/constants`,
            list: (api, metahubId, parentId) => listSetConstants(api, metahubId, parentId, { limit: 100, offset: 0 }),
            get: (api, metahubId, parentId, entityId) => getSetConstant(api, metahubId, parentId, entityId),
            namePrefix: 'Constant',
            codenamePrefix: 'constant'
        }
    },
    {
        slug: 'enumeration',
        templateCodename: 'enumeration-v2',
        templateLabel: /Enumerations V2/i,
        defaultKindKey: 'custom.enumeration-v2',
        typeCodenameBase: 'EnumerationV2',
        typeName: 'Enumerations V2',
        entityKind: 'enumeration',
        legacyRoute: 'enumerations',
        routeHeading: 'Enumerations',
        createDialog: 'Create Enumeration',
        editDialog: 'Edit Enumeration',
        copyDialog: 'Copying Enumeration',
        deleteDialog: 'Delete Enumeration',
        createEndpoint: (metahubId) => `/api/v1/metahub/${metahubId}/enumerations`,
        copyEndpoint: (metahubId, entityId) => `/api/v1/metahub/${metahubId}/enumeration/${entityId}/copy`,
        deleteEndpoint: (metahubId, entityId) => `/api/v1/metahub/${metahubId}/enumeration/${entityId}`,
        list: (api, metahubId, params) => listMetahubEnumerations(api, metahubId, params),
        get: (api, metahubId, entityId) => getMetahubEnumeration(api, metahubId, entityId),
        leafFlow: {
            path: 'values',
            heading: 'Values',
            createDialog: 'Create value',
            createEndpoint: (metahubId, parentId) => `/api/v1/metahub/${metahubId}/enumeration/${parentId}/values`,
            list: (api, metahubId, parentId) => listEnumerationValues(api, metahubId, parentId, { limit: 100, offset: 0 }),
            get: (api, metahubId, parentId, entityId) => getEnumerationValue(api, metahubId, parentId, entityId),
            namePrefix: 'Value',
            codenamePrefix: 'value'
        }
    }
]

async function createPresetEntityTypeViaUi(
    page: Parameters<typeof test>[0]['page'],
    metahubId: string,
    preset: LegacyCompatiblePresetCase,
    customKindKey: string,
    customTypeName: string
) {
    await page.goto(`/metahub/${metahubId}/entities`)
    const createDialog = await openEntityDialog(page, 'Create Entity Type')

    await createDialog.getByLabel('Select template').click()
    await page.getByRole('option', { name: preset.templateLabel }).click()

    await expect.poll(async () => createDialog.getByLabel('Kind key').inputValue()).toBe(preset.defaultKindKey)
    await createDialog.getByLabel('Kind key').fill(customKindKey)
    await createDialog.getByLabel('Name').first().fill(customTypeName)

    const createTypeResponse = waitForSettledMutationResponse(
        page,
        (response) => response.request().method() === 'POST' && response.url().endsWith(`/api/v1/metahub/${metahubId}/entity-types`),
        { label: `Creating ${preset.typeName} entity type from preset` }
    )

    await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

    return parseJsonResponse<EntityRecord>(await createTypeResponse, `Creating ${preset.typeName} entity type from preset`)
}

async function createLegacyCompatibleObjectViaApi(
    api: ApiContext,
    metahubId: string,
    preset: LegacyCompatiblePresetCase,
    payload: {
        name: string
        codename: string
        kindKey?: string
    }
) {
    const response = await sendWithCsrf(api, 'POST', preset.createEndpoint(metahubId), {
        codename: createLocalizedContent('en', payload.codename),
        name: { en: payload.name },
        namePrimaryLocale: 'en',
        ...(payload.kindKey ? { kindKey: payload.kindKey } : {})
    })

    expect(response.ok).toBe(true)
    const body = (await response.json()) as { data?: EntityRecord } & EntityRecord
    return body.data ?? body
}

async function waitForFirstLayoutId(api: ApiContext, metahubId: string) {
    let payload: LayoutListResponse | null = null

    await expect
        .poll(async () => {
            payload = (await listLayouts(api, metahubId, { limit: 20, offset: 0 })) as LayoutListResponse
            return typeof payload?.items?.[0]?.id === 'string'
        })
        .toBe(true)

    const layoutId = payload?.items?.[0]?.id
    if (!layoutId) {
        throw new Error(`No layout was returned for metahub ${metahubId} during Hub V2 widget-binding coverage`)
    }

    return layoutId
}

for (const preset of PRESET_CASES) {
    test(`@flow ${preset.typeName} delegated workspace flow preserves legacy lifecycle and browser leaf authoring`, async ({ page, runManifest }) => {
        test.setTimeout(300_000)

        const api = await createLoggedInApiContext({
            email: runManifest.testUser.email,
            password: runManifest.testUser.password
        })

        const kindSuffix = buildKindSuffix(`${runManifest.runId}-${preset.slug}-v2`)
        const metahubName = `E2E ${runManifest.runId} ${preset.slug} v2 workspace`
        const metahubCodename = `${runManifest.runId}-${preset.slug}-v2-workspace`
        const customKindKey = `${preset.defaultKindKey}-${kindSuffix}`
        const customTypeName = `${preset.typeName} ${kindSuffix}`
        const instanceName = `${preset.typeName} Instance ${kindSuffix}`
        const instanceCodename = `${preset.slug}-instance-${kindSuffix}`
        const updatedDescription = `Updated ${preset.slug} description ${kindSuffix}`
        const copiedName = `${preset.typeName} Copy ${kindSuffix}`
        const copiedCodename = `${preset.slug}-copy-${kindSuffix}`

        try {
            const metahub = await createMetahub(api, {
                name: { en: metahubName },
                namePrimaryLocale: 'en',
                codename: createLocalizedContent('en', metahubCodename)
            })

            if (!metahub?.id) {
                throw new Error(`Metahub creation did not return an id for ${preset.slug} v2 workspace coverage`)
            }

            await recordCreatedMetahub({
                id: metahub.id,
                name: metahubName,
                codename: metahubCodename
            })

            await applyBrowserPreferences(page, { language: 'en' })

            await createPresetEntityTypeViaUi(page, metahub.id, preset, customKindKey, customTypeName)

            const dynamicMenuLink = page.getByRole('link', { name: customTypeName, exact: true })
            await expect(dynamicMenuLink).toBeVisible()
            await dynamicMenuLink.click()

            await expect(page).toHaveURL(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
            await expect(page.getByRole('heading', { name: preset.routeHeading })).toBeVisible()

            const createDialog = await openEntityDialog(page, preset.createDialog)
            await fillNameAndCodename(createDialog, { name: instanceName, codename: instanceCodename })

            const createResponse = waitForSettledMutationResponse(
                page,
                (response) => response.request().method() === 'POST' && response.url().endsWith(preset.createEndpoint(metahub.id)),
                { label: `Creating ${preset.slug} through the ${preset.typeName} surface` }
            )

            await createDialog.getByTestId(entityDialogSelectors.submitButton).click()

            const createdInstanceResponse = await createResponse
            expect(createdInstanceResponse.request().postDataJSON()).toMatchObject({ kindKey: customKindKey })

            const createdInstance = await parseJsonResponse<EntityRecord>(
                createdInstanceResponse,
                `Creating ${preset.slug} through the ${preset.typeName} surface`
            )

            if (!createdInstance.id) {
                throw new Error(`Create ${preset.slug} response did not contain an id for ${preset.typeName}`)
            }

            await expect(page.getByText(instanceName, { exact: true })).toBeVisible()
            await waitForListEntity(
                () => preset.list(api, metahub.id, { limit: 100, offset: 0, kindKey: customKindKey }),
                createdInstance.id,
                `${preset.slug} v2 instance`
            )

            const persistedInstance = await preset.get(api, metahub.id, createdInstance.id)
            expect(persistedInstance.id).toBe(createdInstance.id)

            await page.getByTestId(buildEntityMenuTriggerSelector(preset.entityKind, createdInstance.id)).click()
            await page.getByTestId(buildEntityMenuItemSelector(preset.entityKind, 'edit', createdInstance.id)).click()

            const editDialog = page.getByRole('dialog', { name: preset.editDialog })
            await expect(editDialog).toBeVisible()
            await editDialog.getByLabel('Description').first().fill(updatedDescription)

            const updateResponse = waitForSettledMutationResponse(
                page,
                (response) => response.request().method() === 'PATCH' && response.url().includes(`/api/v1/metahub/${metahub.id}/`),
                { label: `Updating ${preset.slug} through delegated edit flow` }
            )

            await editDialog.getByTestId(entityDialogSelectors.submitButton).click()
            await parseJsonResponse(await updateResponse, `Updating ${preset.slug} through delegated edit flow`)
            await expect(editDialog).toHaveCount(0)

            await expect
                .poll(async () => readLocalizedText((await preset.get(api, metahub.id, createdInstance.id)).description), {
                    message: `Waiting for ${preset.slug} description to persist after delegated edit`
                })
                .toBe(updatedDescription)

            if (preset.leafFlow) {
                const leafName = `${preset.leafFlow.namePrefix} ${kindSuffix}`
                const leafCodename = `${preset.leafFlow.codenamePrefix}-${kindSuffix}`

                await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instance/${createdInstance.id}/${preset.leafFlow.path}`)
                await expect(page.getByRole('heading', { name: preset.leafFlow.heading })).toBeVisible()

                const leafDialog = await openEntityDialog(page, preset.leafFlow.createDialog)
                await fillNameAndCodename(leafDialog, { name: leafName, codename: leafCodename })

                const createLeafResponse = waitForSettledMutationResponse(
                    page,
                    (response) =>
                        response.request().method() === 'POST' &&
                        responseMatchesPath(response, preset.leafFlow?.createEndpoint(metahub.id, createdInstance.id) ?? ''),
                    { label: `Creating ${preset.leafFlow.path} through the delegated ${preset.slug} leaf route` }
                )

                await leafDialog.getByTestId(entityDialogSelectors.submitButton).click()

                const createdLeaf = await parseJsonResponse<LeafEntityRecord>(
                    await createLeafResponse,
                    `Creating ${preset.leafFlow.path} through the delegated ${preset.slug} leaf route`
                )

                if (!createdLeaf.id) {
                    throw new Error(`Create ${preset.leafFlow.path} response did not contain an id for ${preset.slug}`)
                }

                await waitForListEntity(
                    () => preset.leafFlow!.list(api, metahub.id, createdInstance.id),
                    createdLeaf.id,
                    `${preset.slug} ${preset.leafFlow.path}`
                )

                const persistedLeaf = await preset.leafFlow.get(api, metahub.id, createdInstance.id, createdLeaf.id)
                expect(persistedLeaf.id).toBe(createdLeaf.id)
            }

            await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
            await page.getByTestId(buildEntityMenuTriggerSelector(preset.entityKind, createdInstance.id)).click()
            await page.getByTestId(buildEntityMenuItemSelector(preset.entityKind, 'copy', createdInstance.id)).click()

            const copyDialog = page.getByRole('dialog', { name: preset.copyDialog })
            await expect(copyDialog).toBeVisible()
            await fillNameAndCodename(copyDialog, { name: copiedName, codename: copiedCodename })

            const copyResponse = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'POST' &&
                    responseMatchesPath(response, preset.copyEndpoint(metahub.id, createdInstance.id)),
                { label: `Copying ${preset.slug} through delegated lifecycle flow` }
            )

            await copyDialog.getByTestId(entityDialogSelectors.submitButton).click()

            const copiedInstance = await parseJsonResponse<EntityRecord>(
                await copyResponse,
                `Copying ${preset.slug} through delegated lifecycle flow`
            )

            if (!copiedInstance.id) {
                throw new Error(`Copy ${preset.slug} response did not contain an id for ${preset.typeName}`)
            }

            await waitForListEntity(
                () => preset.list(api, metahub.id, { limit: 100, offset: 0, kindKey: customKindKey }),
                copiedInstance.id,
                `copied ${preset.slug} v2 instance`
            )

            await page.goto(`/metahub/${metahub.id}/${preset.legacyRoute}`)
            await expect(page.getByRole('heading', { name: preset.routeHeading })).toBeVisible()
            await expect(page.getByText(instanceName, { exact: true })).toBeVisible()

            await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
            await page.getByTestId(buildEntityMenuTriggerSelector(preset.entityKind, copiedInstance.id)).click()
            await page.getByTestId(buildEntityMenuItemSelector(preset.entityKind, 'delete', copiedInstance.id)).click()

            const deleteDialog = page.getByRole('dialog', { name: preset.deleteDialog })
            await expect(deleteDialog).toBeVisible()

            const deleteResponse = waitForSettledMutationResponse(
                page,
                (response) =>
                    response.request().method() === 'DELETE' &&
                    responseMatchesPath(response, preset.deleteEndpoint(metahub.id, copiedInstance.id)),
                { label: `Deleting copied ${preset.slug} through delegated lifecycle flow` }
            )

            await deleteDialog.getByRole('button', { name: 'Delete' }).click()
            expect((await deleteResponse).ok()).toBe(true)

            await waitForEntityAbsence(
                () => preset.list(api, metahub.id, { limit: 100, offset: 0, kindKey: customKindKey }),
                copiedInstance.id,
                `copied ${preset.slug} v2 instance`
            )
        } finally {
            await disposeApiContext(api)
        }
    })
}

test('@flow Sets V2 delegated workspace flow blocks delete when catalog attributes still reference the compatible set', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const preset = PRESET_CASES.find((candidate) => candidate.slug === 'set')
    if (!preset) {
        throw new Error('Set V2 preset case is missing from the legacy-compatible V2 test registry')
    }

    const kindSuffix = buildKindSuffix(`${runManifest.runId}-set-delete-blocked-v2`)
    const metahubName = `E2E ${runManifest.runId} set delete blocked`
    const metahubCodename = `${runManifest.runId}-set-delete-blocked`
    const customKindKey = `${preset.defaultKindKey}-${kindSuffix}`
    const customTypeName = `${preset.typeName} Delete Blocked ${kindSuffix}`
    const setName = `Blocked Set ${kindSuffix}`
    const setCodename = `blocked-set-${kindSuffix}`
    const catalogName = `Blocking Catalog ${kindSuffix}`
    const catalogCodename = `blocking-catalog-${kindSuffix}`
    const attributeName = `Blocking Reference ${kindSuffix}`
    const attributeCodename = `blocking-reference-${kindSuffix}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for blocked Set V2 delete coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createPresetEntityTypeViaApi(api, metahub.id, {
            templateCodename: preset.templateCodename,
            expectedKindKey: preset.defaultKindKey,
            customKindKey,
            customDisplayName: customTypeName,
            customCodename: `${preset.typeCodenameBase}DeleteBlocked${kindSuffix}`,
            published: true
        })

        const createdSet = await createLegacyCompatibleObjectViaApi(api, metahub.id, preset, {
            name: setName,
            codename: setCodename,
            kindKey: customKindKey
        })

        if (!createdSet?.id) {
            throw new Error('Blocked Set V2 delete fixture did not return an id')
        }

        const createdCatalogPayload = await createMetahubCatalog(api, metahub.id, {
            codename: createLocalizedContent('en', catalogCodename),
            name: { en: catalogName },
            namePrimaryLocale: 'en'
        })
        const createdCatalog = getResponseData(createdCatalogPayload)
        if (typeof createdCatalog.id !== 'string') {
            throw new Error('Blocking catalog fixture did not return an id')
        }

        await createMetahubAttribute(api, metahub.id, createdCatalog.id, {
            codename: createLocalizedContent('en', attributeCodename),
            dataType: 'REF',
            name: { en: attributeName },
            namePrimaryLocale: 'en',
            targetEntityId: createdSet.id,
            targetEntityKind: customKindKey,
            isRequired: false
        })

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
        await expect(page.getByRole('heading', { name: preset.routeHeading })).toBeVisible()
        await expect(page.getByText(setName, { exact: true })).toBeVisible()

        await page.getByTestId(buildEntityMenuTriggerSelector('set', createdSet.id)).click()
        await page.getByTestId(buildEntityMenuItemSelector('set', 'delete', createdSet.id)).click()

        const deleteDialog = page.getByRole('dialog', { name: 'Delete Set' })
        await expect(deleteDialog).toBeVisible()
        await expect(
            deleteDialog.getByText('Cannot delete set. Remove these references from catalog attributes first:')
        ).toBeVisible()
        await expect(deleteDialog.getByText(catalogName, { exact: true })).toBeVisible()
        await expect(deleteDialog.getByText(attributeName, { exact: true })).toBeVisible()
        await expect(deleteDialog.getByRole('button', { name: 'Delete' })).toBeDisabled()

        await deleteDialog.getByRole('button', { name: 'Cancel' }).click()
        await expect(deleteDialog).toHaveCount(0)
        await expect(page.getByText(setName, { exact: true })).toBeVisible()
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow legacy and V2 routes coexist without leaking built-in rows into V2 filtered surfaces', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const suffix = buildKindSuffix(`${runManifest.runId}-coexistence-v2`)
    const metahubName = `E2E ${runManifest.runId} legacy compatible coexistence`
    const metahubCodename = `${runManifest.runId}-legacy-compatible-coexistence`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for coexistence coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await applyBrowserPreferences(page, { language: 'en' })

        for (const preset of PRESET_CASES) {
            const customKindKey = `${preset.defaultKindKey}-coexist-${suffix}`
            const customTypeName = `${preset.typeName} Coexist ${suffix}`
            const builtInName = `Legacy ${preset.typeName} ${suffix}`
            const customName = `V2 ${preset.typeName} ${suffix}`

            await createPresetEntityTypeViaApi(api, metahub.id, {
                templateCodename: preset.templateCodename,
                expectedKindKey: preset.defaultKindKey,
                customKindKey,
                customDisplayName: customTypeName,
                customCodename: `${preset.typeCodenameBase}Coexist${suffix}`,
                published: true
            })

            await createLegacyCompatibleObjectViaApi(api, metahub.id, preset, {
                name: builtInName,
                codename: `legacy-${preset.slug}-${suffix}`
            })

            await createLegacyCompatibleObjectViaApi(api, metahub.id, preset, {
                name: customName,
                codename: `v2-${preset.slug}-${suffix}`,
                kindKey: customKindKey
            })

            await page.goto(`/metahub/${metahub.id}/${preset.legacyRoute}`)
            await expect(page.getByRole('heading', { name: preset.routeHeading })).toBeVisible()
            await expect(page.getByText(builtInName, { exact: true })).toBeVisible()
            await expect(page.getByText(customName, { exact: true })).toBeVisible()

            await page.goto(`/metahub/${metahub.id}/entities/${customKindKey}/instances`)
            await expect(page.getByRole('heading', { name: preset.routeHeading })).toBeVisible()
            await expect(page.getByText(customName, { exact: true })).toBeVisible()
            await expect(page.getByText(builtInName, { exact: true })).toHaveCount(0)
        }
    } finally {
        await disposeApiContext(api)
    }
})

test('@flow Hub V2 instances are selectable in menu widget hub bindings', async ({ page, runManifest }) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const preset = PRESET_CASES.find((candidate) => candidate.slug === 'hub')
    if (!preset) {
        throw new Error('Hub V2 preset case is missing from the legacy-compatible V2 test registry')
    }

    const kindSuffix = buildKindSuffix(`${runManifest.runId}-hub-binding-v2`)
    const metahubName = `E2E ${runManifest.runId} hub widget binding`
    const metahubCodename = `${runManifest.runId}-hub-widget-binding`
    const customKindKey = `${preset.defaultKindKey}-${kindSuffix}`
    const customTypeName = `${preset.typeName} Binding ${kindSuffix}`
    const hubName = `Hub Binding ${kindSuffix}`
    const hubCodename = `hub-binding-${kindSuffix}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for Hub V2 widget-binding coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createPresetEntityTypeViaApi(api, metahub.id, {
            templateCodename: preset.templateCodename,
            expectedKindKey: preset.defaultKindKey,
            customKindKey,
            customDisplayName: customTypeName,
            customCodename: `${preset.typeCodenameBase}Binding${kindSuffix}`,
            published: false
        })

        const createdHub = await createLegacyCompatibleObjectViaApi(api, metahub.id, preset, {
            name: hubName,
            codename: hubCodename,
            kindKey: customKindKey
        })

        if (!createdHub?.id) {
            throw new Error('Hub V2 widget-binding fixture did not return an id')
        }

        await waitForListEntity(
            () => preset.list(api, metahub.id, { limit: 100, offset: 0, kindKey: customKindKey }),
            createdHub.id,
            'hub v2 widget binding instance'
        )

        const layoutId = await waitForFirstLayoutId(api, metahub.id)
        const initialZoneWidgets = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutWidgetRecord[] }
        const existingMenuWidget = initialZoneWidgets.items?.find((item) => item.widgetKey === 'menuWidget')

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/metahub/${metahub.id}/common/layouts/${layoutId}`)
        await expect(page.getByText('Drag widgets between zones to change runtime composition.')).toBeVisible()

        if (existingMenuWidget?.id) {
            await page.getByTestId(`layout-widget-edit-${existingMenuWidget.id}`).click()
        } else {
            const leftZone = page.getByTestId(buildLayoutZoneSelector('left'))
            await expect(leftZone).toBeVisible()
            await leftZone.getByRole('button', { name: 'Add widget' }).click()
            await page.getByRole('menuitem', { name: 'Menu', exact: true }).click()
        }

        const dialog = page.getByRole('dialog', { name: /menu/i })
        await expect(dialog).toBeVisible()

        const bindToHubToggle = dialog.getByLabel('Bind menu to hub')
        if (!(await bindToHubToggle.isChecked())) {
            await bindToHubToggle.check()
        }

        await dialog.getByRole('combobox').click()
        const hubOption = page.getByRole('option', { name: hubName, exact: true })
        await expect(hubOption).toBeVisible()
        await hubOption.click()

        const saveResponse = waitForSettledMutationResponse(
            page,
            (response) =>
                ['PUT', 'PATCH'].includes(response.request().method()) &&
                response.url().includes(`/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget`),
            { label: 'Saving Hub V2 menu widget binding' }
        )

        await dialog.getByRole('button', { name: 'Save', exact: true }).click()
        expect((await saveResponse).ok()).toBe(true)
        await expect(dialog).toHaveCount(0)

        await expect
            .poll(
                async () => {
                    const payload = (await listLayoutZoneWidgets(api, metahub.id, layoutId)) as { items?: LayoutWidgetRecord[] }
                    const persistedMenuWidget = payload.items?.find((item) => {
                        if (item.widgetKey !== 'menuWidget' || !item.config || typeof item.config !== 'object') {
                            return false
                        }

                        return item.config.boundHubId === createdHub.id
                    })

                    if (!persistedMenuWidget?.config || typeof persistedMenuWidget.config !== 'object') {
                        return false
                    }

                    return persistedMenuWidget.config.bindToHub === true && persistedMenuWidget.config.boundHubId === createdHub.id
                },
                {
                    message: 'Waiting for the Hub V2 menu widget binding to persist'
                }
            )
            .toBe(true)
    } finally {
        await disposeApiContext(api)
    }
})