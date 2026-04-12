import { createLocalizedContent } from '@universo/utils'

import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    disposeApiContext,
    getApplicationRuntime,
    sendWithCsrf,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from '../../support/backend/api-session.mjs'
import { recordCreatedApplication, recordCreatedMetahub, recordCreatedPublication } from '../../support/backend/run-manifest.mjs'
import { applyBrowserPreferences } from '../../support/browser/preferences'
import { applicationSelectors } from '../../support/selectors/contracts'
import { buildKindSuffix, createPresetEntityTypeViaApi, type ApiContext } from './entity-v2-helpers'

type RuntimeSectionRecord = {
    id?: string
    name?: string
}

type RuntimeState = {
    sections?: RuntimeSectionRecord[]
    activeSectionId?: string | null
}

type RuntimeFilteredPreset = {
    slug: 'hub' | 'set' | 'enumeration'
    templateCodename: string
    defaultKindKey: string
    typeCodenameBase: string
    typeName: string
    createEndpoint: (metahubId: string) => string
}

const RUNTIME_FILTERED_PRESETS: RuntimeFilteredPreset[] = [
    {
        slug: 'hub',
        templateCodename: 'hub-v2',
        defaultKindKey: 'custom.hub-v2',
        typeCodenameBase: 'HubV2Runtime',
        typeName: 'Hubs V2 Runtime',
        createEndpoint: (metahubId) => `/api/v1/metahub/${metahubId}/hubs`
    },
    {
        slug: 'set',
        templateCodename: 'set-v2',
        defaultKindKey: 'custom.set-v2',
        typeCodenameBase: 'SetV2Runtime',
        typeName: 'Sets V2 Runtime',
        createEndpoint: (metahubId) => `/api/v1/metahub/${metahubId}/sets`
    },
    {
        slug: 'enumeration',
        templateCodename: 'enumeration-v2',
        defaultKindKey: 'custom.enumeration-v2',
        typeCodenameBase: 'EnumerationV2Runtime',
        typeName: 'Enumerations V2 Runtime',
        createEndpoint: (metahubId) => `/api/v1/metahub/${metahubId}/enumerations`
    }
]

async function createLegacyCompatibleObjectViaApi(
    api: ApiContext,
    metahubId: string,
    createEndpoint: string,
    payload: {
        name: string
        codename: string
        kindKey: string
    }
) {
    const response = await sendWithCsrf(api, 'POST', createEndpoint, {
        codename: createLocalizedContent('en', payload.codename),
        name: { en: payload.name },
        namePrimaryLocale: 'en',
        kindKey: payload.kindKey
    })

    expect(response.ok).toBe(true)
    const body = (await response.json()) as { data?: { id?: string } } & { id?: string }
    return body.data ?? body
}

test('@flow @combined legacy-compatible V2 hub/set/enumeration types publish cleanly while runtime sections stay catalog-only', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const suffix = buildKindSuffix(`${runManifest.runId}-v2-runtime`)
    const metahubName = `E2E ${runManifest.runId} legacy compatible runtime`
    const metahubCodename = `${runManifest.runId}-legacy-compatible-runtime`
    const publicationName = `E2E ${runManifest.runId} V2 Runtime Publication`
    const applicationName = `E2E ${runManifest.runId} V2 Runtime Application`
    const catalogKindKey = `custom.catalog-v2-runtime-${suffix}`
    const catalogTypeName = `Catalogs V2 Runtime ${suffix}`
    const catalogName = `Runtime Catalog ${suffix}`
    const catalogCodename = `runtime-catalog-${suffix}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for V2 runtime coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createPresetEntityTypeViaApi(api, metahub.id, {
            templateCodename: 'catalog-v2',
            expectedKindKey: 'custom.catalog-v2',
            customKindKey: catalogKindKey,
            customDisplayName: catalogTypeName,
            customCodename: `CatalogV2Runtime${suffix}`,
            published: true
        })

        const createCatalogResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/entities`, {
            kind: catalogKindKey,
            codename: catalogCodename,
            name: { en: catalogName },
            namePrimaryLocale: 'en'
        })
        expect(createCatalogResponse.ok).toBe(true)

        const createdCatalogPayload = (await createCatalogResponse.json()) as { id?: string }
        if (!createdCatalogPayload?.id) {
            throw new Error('Catalog V2 runtime control entity did not return an id')
        }

        const filteredInstanceNames: string[] = []

        for (const preset of RUNTIME_FILTERED_PRESETS) {
            const customKindKey = `${preset.defaultKindKey}-runtime-${suffix}`
            const customTypeName = `${preset.typeName} ${suffix}`
            const instanceName = `${preset.slug.toUpperCase()} Runtime ${suffix}`
            filteredInstanceNames.push(instanceName)

            await createPresetEntityTypeViaApi(api, metahub.id, {
                templateCodename: preset.templateCodename,
                expectedKindKey: preset.defaultKindKey,
                customKindKey,
                customDisplayName: customTypeName,
                customCodename: `${preset.typeCodenameBase}${suffix}`,
                published: true
            })

            const createdEntity = await createLegacyCompatibleObjectViaApi(api, metahub.id, preset.createEndpoint(metahub.id), {
                name: instanceName,
                codename: `${preset.slug}-runtime-${suffix}`,
                kindKey: customKindKey
            })

            if (!createdEntity?.id) {
                throw new Error(`${preset.slug} V2 runtime entity did not return an id`)
            }
        }

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for V2 runtime coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} V2 Runtime Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false,
            workspacesEnabled: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for V2 runtime coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        let runtimeState: RuntimeState | null = null
        let catalogSection: RuntimeSectionRecord | undefined
        await expect
            .poll(
                async () => {
                    runtimeState = (await getApplicationRuntime(api, applicationId)) as RuntimeState
                    catalogSection = runtimeState.sections?.find((section) => section.name === catalogName)
                    return typeof catalogSection?.id === 'string'
                },
                {
                    timeout: 60_000,
                    message: 'Waiting for the catalog-compatible runtime section to appear after publication sync'
                }
            )
            .toBe(true)

        if (!catalogSection?.id || !runtimeState) {
            throw new Error('Catalog V2 runtime section did not appear after publication sync')
        }

        const runtimeSectionNames = runtimeState.sections?.map((section) => section.name).filter(Boolean) ?? []
        expect(runtimeSectionNames).toContain(catalogName)
        for (const filteredName of filteredInstanceNames) {
            expect(runtimeSectionNames).not.toContain(filteredName)
        }

        const sectionState = (await getApplicationRuntime(api, applicationId, { catalogId: catalogSection.id })) as RuntimeState
        expect(sectionState.activeSectionId).toBe(catalogSection.id)

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}?catalogId=${catalogSection.id}`)
        await expect
            .poll(
                async () => {
                    const currentUrl = new URL(page.url())
                    return {
                        pathname: currentUrl.pathname,
                        catalogId: currentUrl.searchParams.get('catalogId')
                    }
                },
                {
                    timeout: 30_000,
                    message: 'Waiting for runtime navigation to keep the selected catalog-compatible section in the URL'
                }
            )
            .toEqual({
                pathname: `/a/${applicationId}`,
                catalogId: catalogSection.id
            })
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})