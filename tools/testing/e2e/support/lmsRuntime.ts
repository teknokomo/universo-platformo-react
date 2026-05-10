import { createLocalizedContent } from '@universo/utils'
import { expect } from '../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createPublication,
    createPublicationLinkedApplication,
    createPublicationVersion,
    getApplicationRuntime,
    listRuntimeLedgerFacts,
    listRuntimeLedgers,
    listLayouts,
    listLinkedCollections,
    listOptionLists,
    listOptionValues,
    syncApplicationSchema,
    syncPublication,
    waitForPublicationReady
} from './backend/api-session.mjs'

export type ApiContext = Awaited<ReturnType<typeof createLoggedInApiContext>>

type NamedItem = {
    id?: string
    codename?: unknown
    name?: unknown
    title?: unknown
}

const readRuntimeLabel = (value: unknown): string => {
    if (typeof value === 'string') {
        return value
    }
    if (!value || typeof value !== 'object') {
        return ''
    }
    const directTitle = (value as { title?: unknown }).title
    if (typeof directTitle === 'string') {
        return directTitle
    }
    const directName = (value as { name?: unknown }).name
    if (typeof directName === 'string') {
        return directName
    }
    const locales = (value as { locales?: Record<string, { content?: string }> }).locales
    if (!locales || typeof locales !== 'object') {
        return ''
    }
    return locales.en?.content ?? locales.ru?.content ?? ''
}

const normalizeEntityLookup = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '')

const findNamedItem = (items: NamedItem[], expectedName: string) => {
    const normalizedExpectedName = normalizeEntityLookup(expectedName)
    return items.find((item) => {
        const candidates = [item.codename, item.name, item.title].map((candidate) => readRuntimeLabel(candidate)).filter(Boolean)
        return candidates.some((candidate) => normalizeEntityLookup(candidate) === normalizedExpectedName)
    })
}

export async function waitForMetahubCatalogId(api: ApiContext, metahubId: string, expectedName: string) {
    let catalogId: string | null = null

    await expect
        .poll(
            async () => {
                const response = await listLinkedCollections(api, metahubId, { limit: 100, offset: 0 })
                catalogId = findNamedItem(response.items ?? [], expectedName)?.id ?? null
                return catalogId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(catalogId)
}

export async function waitForMetahubEnumerationId(api: ApiContext, metahubId: string, expectedName: string) {
    let enumerationId: string | null = null

    await expect
        .poll(
            async () => {
                const response = await listOptionLists(api, metahubId, { limit: 100, offset: 0 })
                enumerationId = findNamedItem(response.items ?? [], expectedName)?.id ?? null
                return enumerationId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(enumerationId)
}

export async function waitForOptionValueId(api: ApiContext, metahubId: string, enumerationId: string, expectedCodename: string) {
    let optionValueId: string | null = null

    await expect
        .poll(
            async () => {
                const response = await listOptionValues(api, metahubId, enumerationId, { limit: 100, offset: 0 })
                const match = (response.items ?? []).find(
                    (item: { id?: string; codename?: unknown; name?: unknown; title?: unknown }) =>
                        normalizeEntityLookup(readRuntimeLabel(item.codename)) === normalizeEntityLookup(expectedCodename) ||
                        normalizeEntityLookup(readRuntimeLabel(item.name)) === normalizeEntityLookup(expectedCodename)
                )
                optionValueId = match?.id ?? null
                return optionValueId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(optionValueId)
}

export async function waitForApplicationCatalogId(api: ApiContext, applicationId: string, expectedName: string) {
    let catalogId: string | null = null

    await expect
        .poll(
            async () => {
                const runtime = await getApplicationRuntime(api, applicationId)
                catalogId = findNamedItem(runtime.catalogs ?? [], expectedName)?.id ?? null
                return catalogId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(catalogId)
}

export async function waitForApplicationLedgerId(api: ApiContext, applicationId: string, expectedName: string) {
    let ledgerId: string | null = null

    await expect
        .poll(
            async () => {
                const response = await listRuntimeLedgers(api, applicationId)
                ledgerId = findNamedItem(response.ledgers ?? [], expectedName)?.id ?? null
                return ledgerId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(ledgerId)
}

export async function waitForApplicationLedgerFactCount(
    api: ApiContext,
    applicationId: string,
    ledgerId: string,
    expectedCount: number,
    params: { workspaceId?: string } = {}
) {
    let facts: Array<Record<string, unknown>> = []

    await expect
        .poll(
            async () => {
                const response = await listRuntimeLedgerFacts(api, applicationId, ledgerId, {
                    limit: Math.max(expectedCount, 1),
                    ...params
                })
                facts = Array.isArray(response.rows) ? response.rows : []
                return facts.length
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBe(expectedCount)

    return facts
}

export async function waitForApplicationRuntimeRow(api: ApiContext, applicationId: string, catalogId: string, rowId: string) {
    let row: Record<string, unknown> | null = null

    await expect
        .poll(
            async () => {
                const runtime = await getApplicationRuntime(api, applicationId, { catalogId })
                row = (runtime.rows ?? []).find((item: { id?: string }) => item?.id === rowId) ?? null
                return row && typeof row.id === 'string' ? row.id : null
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBe(rowId)

    return row
}

export async function waitForApplicationRuntimeRowCount(
    api: ApiContext,
    applicationId: string,
    catalogId: string,
    expectedCount: number,
    params: { workspaceId?: string } = {}
) {
    let runtimeRows: Array<Record<string, unknown>> = []

    await expect
        .poll(
            async () => {
                const runtime = await getApplicationRuntime(api, applicationId, {
                    catalogId,
                    ...params
                })
                runtimeRows = Array.isArray(runtime.rows) ? runtime.rows : []
                return runtimeRows.length
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBe(expectedCount)

    return runtimeRows
}

export async function waitForDefaultLayoutId(api: ApiContext, metahubId: string) {
    let layoutId: string | null = null

    await expect
        .poll(
            async () => {
                const response = await listLayouts(api, metahubId, { limit: 100, offset: 0 })
                const items = Array.isArray(response.items) ? response.items : []
                layoutId = items.find((item: { id?: string; isDefault?: boolean }) => item?.isDefault)?.id ?? items[0]?.id ?? null
                return layoutId
            },
            { timeout: 30_000, intervals: [500, 1_000, 2_000] }
        )
        .toBeTruthy()

    return String(layoutId)
}

export async function setupPublishedLmsApplication(
    api: ApiContext,
    options: {
        runId: string
        label: string
        isPublic?: boolean
        workspacesEnabled?: boolean
    }
) {
    const metahub = await createMetahub(api, {
        name: { en: `E2E ${options.runId} ${options.label} LMS` },
        namePrimaryLocale: 'en',
        codename: createLocalizedContent('en', `${options.runId}-${options.label.toLowerCase().replace(/\s+/g, '-')}-lms`),
        templateCodename: 'lms'
    })

    if (!metahub?.id) {
        throw new Error(`LMS metahub creation did not return an id for ${options.label}`)
    }

    const publication = await createPublication(api, metahub.id, {
        name: { en: `E2E ${options.runId} ${options.label} LMS Publication` },
        namePrimaryLocale: 'en',
        autoCreateApplication: false
    })

    if (!publication?.id) {
        throw new Error(`LMS publication creation did not return an id for ${options.label}`)
    }

    await createPublicationVersion(api, metahub.id, publication.id, {
        name: { en: `E2E ${options.runId} ${options.label} LMS Version` },
        namePrimaryLocale: 'en'
    })
    await syncPublication(api, metahub.id, publication.id)
    await waitForPublicationReady(api, metahub.id, publication.id)

    const linkedApplication = await createPublicationLinkedApplication(api, metahub.id, publication.id, {
        name: { en: `E2E ${options.runId} ${options.label} LMS App` },
        namePrimaryLocale: 'en',
        createApplicationSchema: false,
        isPublic: options.isPublic === true
    })

    const applicationId = linkedApplication?.application?.id
    if (typeof applicationId !== 'string') {
        throw new Error(`LMS linked application did not return an id for ${options.label}`)
    }

    await syncApplicationSchema(
        api,
        applicationId,
        options.workspacesEnabled === false
            ? {}
            : {
                  schemaOptions: {
                      workspaceModeRequested: 'enabled',
                      acknowledgeIrreversibleWorkspaceEnablement: true
                  }
              }
    )

    return {
        metahub,
        publication,
        linkedApplication,
        applicationId,
        applicationSlug: linkedApplication.application.slug,
        layoutId: await waitForDefaultLayoutId(api, metahub.id)
    }
}
