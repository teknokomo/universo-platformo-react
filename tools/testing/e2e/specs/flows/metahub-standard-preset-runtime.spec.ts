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
import { buildKindSuffix, createPresetEntityTypeViaApi, type ApiContext } from './entity-runtime-helpers'

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
}

const RUNTIME_FILTERED_PRESETS: RuntimeFilteredPreset[] = [
    {
        slug: 'hub',
        templateCodename: 'hub',
        defaultKindKey: 'hub',
        typeCodenameBase: 'HubRuntime',
        typeName: 'Hubs Runtime'
    },
    {
        slug: 'set',
        templateCodename: 'set',
        defaultKindKey: 'set',
        typeCodenameBase: 'SetRuntime',
        typeName: 'Sets Runtime'
    },
    {
        slug: 'enumeration',
        templateCodename: 'enumeration',
        defaultKindKey: 'enumeration',
        typeCodenameBase: 'EnumerationRuntime',
        typeName: 'Enumerations Runtime'
    }
]

async function createLegacyCompatibleObjectViaApi(
    api: ApiContext,
    metahubId: string,
    payload: {
        name: string
        codename: string
        kindKey: string
    }
) {
    const response = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahubId}/entities`, {
        kind: payload.kindKey,
        codename: createLocalizedContent('en', payload.codename),
        name: { en: payload.name },
        namePrimaryLocale: 'en'
    })

    if (!response.ok) {
        throw new Error(
            `Creating runtime entity ${payload.kindKey}/${payload.codename} failed with ${response.status} ${
                response.statusText
            }: ${await response.text()}`
        )
    }

    const body = (await response.json()) as { data?: { id?: string } } & { id?: string }
    return body.data ?? body
}

test('@flow @combined published standard preset instances surface as runtime sections after publication sync', async ({
    page,
    runManifest
}) => {
    test.setTimeout(300_000)

    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    const suffix = buildKindSuffix(`${runManifest.runId}-standard-runtime`)
    const metahubName = `E2E ${runManifest.runId} standard preset runtime`
    const metahubCodename = `${runManifest.runId}-standard-preset-runtime`
    const publicationName = `E2E ${runManifest.runId} Runtime Publication`
    const applicationName = `E2E ${runManifest.runId} Runtime Application`
    const objectKindKey = `custom.object-runtime-${suffix}`
    const objectTypeName = `Objects Runtime ${suffix}`
    const objectName = `Runtime Object ${suffix}`
    const objectCodename = `runtime-object-${suffix}`

    try {
        const metahub = await createMetahub(api, {
            name: { en: metahubName },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename)
        })

        if (!metahub?.id) {
            throw new Error('Metahub creation did not return an id for standard preset runtime coverage')
        }

        await recordCreatedMetahub({
            id: metahub.id,
            name: metahubName,
            codename: metahubCodename
        })

        await createPresetEntityTypeViaApi(api, metahub.id, {
            templateCodename: 'object',
            expectedKindKey: 'object',
            customKindKey: objectKindKey,
            customDisplayName: objectTypeName,
            customCodename: `ObjectRuntime${suffix}`,
            published: true
        })

        const createObjectResponse = await sendWithCsrf(api, 'POST', `/api/v1/metahub/${metahub.id}/entities`, {
            kind: objectKindKey,
            codename: objectCodename,
            name: { en: objectName },
            namePrimaryLocale: 'en'
        })
        expect(createObjectResponse.ok).toBe(true)

        const createdObjectPayload = (await createObjectResponse.json()) as { id?: string }
        if (!createdObjectPayload?.id) {
            throw new Error('Object runtime control entity did not return an id')
        }

        const publishedInstanceNames: string[] = [objectName]

        for (const preset of RUNTIME_FILTERED_PRESETS) {
            const customKindKey = `custom.${preset.defaultKindKey}-runtime-${suffix}`
            const customTypeName = `${preset.typeName} ${suffix}`
            const instanceName = `${preset.slug.toUpperCase()} Runtime ${suffix}`
            publishedInstanceNames.push(instanceName)

            await createPresetEntityTypeViaApi(api, metahub.id, {
                templateCodename: preset.templateCodename,
                expectedKindKey: preset.defaultKindKey,
                customKindKey,
                customDisplayName: customTypeName,
                customCodename: `${preset.typeCodenameBase}${suffix}`,
                published: true
            })

            const createdEntity = await createLegacyCompatibleObjectViaApi(api, metahub.id, {
                name: instanceName,
                codename: `${preset.slug}-runtime-${suffix}`,
                kindKey: customKindKey
            })

            if (!createdEntity?.id) {
                throw new Error(`${preset.slug} runtime entity did not return an id`)
            }
        }

        const publication = await createPublication(api, metahub.id, {
            name: { en: publicationName },
            namePrimaryLocale: 'en',
            autoCreateApplication: false
        })

        if (!publication?.id) {
            throw new Error('Publication creation did not return an id for standard preset runtime coverage')
        }

        await recordCreatedPublication({
            id: publication.id,
            metahubId: metahub.id,
            schemaName: publication.schemaName
        })

        await createPublicationVersion(api, metahub.id, publication.id, {
            name: { en: `E2E ${runManifest.runId} Runtime Version` },
            namePrimaryLocale: 'en'
        })
        await syncPublication(api, metahub.id, publication.id)
        await waitForPublicationReady(api, metahub.id, publication.id)

        const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
            name: { en: applicationName },
            namePrimaryLocale: 'en',
            createApplicationSchema: false
        })

        const applicationId = linkedApplication?.application?.id
        if (typeof applicationId !== 'string') {
            throw new Error('Linked application creation did not return an id for standard preset runtime coverage')
        }

        await recordCreatedApplication({
            id: applicationId,
            slug: linkedApplication.application.slug
        })

        await syncApplicationSchema(api, applicationId)

        let runtimeState: RuntimeState | null = null
        let objectSection: RuntimeSectionRecord | undefined
        await expect
            .poll(
                async () => {
                    runtimeState = (await getApplicationRuntime(api, applicationId)) as RuntimeState
                    objectSection = runtimeState.sections?.find((section) => section.name === objectName)
                    return typeof objectSection?.id === 'string'
                },
                {
                    timeout: 60_000,
                    message: 'Waiting for the object runtime section to appear after publication sync'
                }
            )
            .toBe(true)

        if (!objectSection?.id || !runtimeState) {
            throw new Error('Object runtime section did not appear after publication sync')
        }

        const runtimeSectionNames = runtimeState.sections?.map((section) => section.name).filter(Boolean) ?? []
        for (const publishedName of publishedInstanceNames) {
            expect(runtimeSectionNames).toContain(publishedName)
        }

        const sectionState = (await getApplicationRuntime(api, applicationId, { objectCollectionId: objectSection.id })) as RuntimeState
        expect(sectionState.activeSectionId).toBe(objectSection.id)

        await applyBrowserPreferences(page, { language: 'en' })
        await page.goto(`/a/${applicationId}?objectCollectionId=${objectSection.id}`)
        await expect
            .poll(
                async () => {
                    const currentUrl = new URL(page.url())
                    return {
                        pathname: currentUrl.pathname,
                        objectCollectionId: currentUrl.searchParams.get('objectCollectionId')
                    }
                },
                {
                    timeout: 30_000,
                    message: 'Waiting for runtime navigation to keep the selected object section in the URL'
                }
            )
            .toEqual({
                pathname: `/a/${applicationId}`,
                objectCollectionId: objectSection.id
            })
        await expect(page.getByTestId(applicationSelectors.runtimeCreateButton)).toBeVisible({ timeout: 30_000 })
    } finally {
        await disposeApiContext(api)
    }
})
