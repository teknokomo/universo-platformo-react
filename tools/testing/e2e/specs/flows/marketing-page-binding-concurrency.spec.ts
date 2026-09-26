import { createLocalizedContent } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createRecord,
    disposeApiContext,
    getRecord,
    listEntityInstances,
    listLayoutZoneWidgets,
    listLayouts,
    listRecords,
    requestApi,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { readLocalizedText } from './entity-runtime-helpers'

type ApiSession = Awaited<ReturnType<typeof createLoggedInApiContext>>

type EntityListItem = {
    id?: unknown
    codename?: unknown
}

type RecordItem = {
    id?: unknown
    data?: Record<string, unknown>
    version?: unknown
}

type LayoutWidget = {
    id?: unknown
    widgetKey?: unknown
    instanceKey?: unknown
    version?: unknown
    isActive?: unknown
}

type BindingTarget = {
    recordId?: unknown
    recordVersion?: unknown
    widgetVersion?: unknown
    label?: unknown
}

const readRecordData = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readHeroBinding = async (api: ApiSession, metahubId: string, layoutId: string, widgetId: string): Promise<BindingTarget> => {
    const response = await requestApi(api, `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/binding`, {
        method: 'GET'
    })
    if (!response.ok) {
        throw new Error(`Reading the persisted Hero binding failed with ${response.status}`)
    }
    return (await response.json()) as BindingTarget
}

const assertCurrentBindingResolvesUniquely = async (
    api: ApiSession,
    metahubId: string,
    heroObjectId: string,
    layoutId: string,
    widgetId: string
): Promise<{ binding: BindingTarget; record: RecordItem; records: RecordItem[] }> => {
    const binding = await readHeroBinding(api, metahubId, layoutId, widgetId)
    expect(typeof binding.recordId).toBe('string')

    const recordResponse = (await listRecords(api, metahubId, heroObjectId, { limit: 100, offset: 0 })) as {
        items?: RecordItem[]
    }
    const records = recordResponse.items ?? []
    const record = records.find((item) => item.id === binding.recordId)
    expect(record, 'A persisted Hero binding must resolve to an extant record').toBeDefined()
    expect(binding.recordVersion, 'The binding resolver must report the current version of its target record').toBe(record?.version)

    const semanticKey = readRecordData(record?.data).HeroKey
    expect(typeof semanticKey, 'The resolved Hero record must expose its semantic key').toBe('string')
    const matches = records.filter((item) => readRecordData(item.data).HeroKey === semanticKey)
    expect(matches, 'A bound semantic key must resolve to exactly one extant record').toHaveLength(1)
    expect(matches[0]?.id).toBe(binding.recordId)

    return { binding, record: record!, records }
}

test('@flow @marketing-page @concurrency keeps Hero bindings consistent with concurrent record mutations', async ({
    runManifest
}, testInfo) => {
    test.setTimeout(240_000)

    const credentials = {
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    }
    const setupApi = await createLoggedInApiContext(credentials)
    let bindingApi: ApiSession | null = null
    let mutationApi: ApiSession | null = null

    try {
        bindingApi = await createLoggedInApiContext(credentials)
        mutationApi = await createLoggedInApiContext(credentials)

        const executionId = `${runManifest.runId}-hero-binding-${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${testInfo.retry}`
        const metahubCodename = `${executionId}-marketing-page`
        const metahub = await createMetahub(setupApi, {
            name: { en: `E2E ${executionId} Hero binding concurrency` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (typeof metahub?.id !== 'string') throw new Error('The marketing-page fixture did not return a metahub id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubCodename, codename: metahubCodename })

        const entities = (await listEntityInstances(setupApi, metahub.id, { kind: 'object', limit: 200, offset: 0 })) as {
            items?: EntityListItem[]
        }
        const heroEntity = entities.items?.find((entity) => readLocalizedText(entity.codename, 'en') === 'MarketingPageHero')
        if (typeof heroEntity?.id !== 'string') throw new Error('The marketing-page fixture did not expose MarketingPageHero')

        const layouts = await listLayouts(setupApi, metahub.id, { limit: 100, offset: 0 })
        const marketingLayout = layouts.items?.find(
            (layout: { id?: unknown; templateKey?: unknown }) => layout.templateKey === 'marketing-page'
        )
        if (typeof marketingLayout?.id !== 'string') throw new Error('The marketing-page fixture did not expose its source layout')
        const layoutId = marketingLayout.id

        const defaultRecords = (await listRecords(setupApi, metahub.id, heroEntity.id, { limit: 100, offset: 0 })) as {
            items?: RecordItem[]
        }
        const defaultRecord = defaultRecords.items?.find((record) => readRecordData(record.data).HeroKey === 'default')
        if (typeof defaultRecord?.id !== 'string') throw new Error('The marketing-page fixture did not expose its default Hero record')
        const currentDefaultRecord = (await getRecord(setupApi, metahub.id, heroEntity.id, defaultRecord.id)) as RecordItem
        if (typeof currentDefaultRecord.version !== 'number') throw new Error('The default Hero record did not expose its current version')

        const recordDataWithoutKey = { ...readRecordData(defaultRecord.data) }
        delete recordDataWithoutKey.HeroKey

        const createHeroRecord = async (): Promise<RecordItem> => {
            const created = await createRecord(setupApi, metahub.id, heroEntity.id as string, { data: recordDataWithoutKey })
            if (typeof created?.id !== 'string') throw new Error('Creating an independent Hero record did not return an id')
            return (await getRecord(setupApi, metahub.id, heroEntity.id as string, created.id)) as RecordItem
        }

        const deleteRaceRecord = await createHeroRecord()
        const deleteRaceKey = readRecordData(deleteRaceRecord.data).HeroKey
        if (typeof deleteRaceRecord.id !== 'string' || typeof deleteRaceKey !== 'string') {
            throw new Error('The delete-race Hero record did not expose its id and semantic key')
        }

        const widgetResponse = (await listLayoutZoneWidgets(setupApi, metahub.id, layoutId)) as { items?: LayoutWidget[] }
        const heroWidget = widgetResponse.items?.find((widget) => widget.widgetKey === 'marketing.hero' && widget.instanceKey === 'hero')
        if (typeof heroWidget?.id !== 'string' || typeof heroWidget.version !== 'number') {
            throw new Error('The marketing-page fixture did not expose a versioned Hero placement')
        }
        const pricingWidget = widgetResponse.items?.find(
            (widget) => widget.widgetKey === 'marketing.pricing' && widget.instanceKey === 'pricing'
        )
        if (typeof pricingWidget?.id !== 'string' || typeof pricingWidget.version !== 'number' || pricingWidget.isActive !== true) {
            throw new Error('The marketing-page fixture did not expose an active, versioned Pricing section')
        }
        const seededBinding = await readHeroBinding(setupApi, metahub.id, layoutId, heroWidget.id)
        expect(seededBinding.recordId).toBe(defaultRecord.id)

        const currentPrimaryAction = readRecordData(currentDefaultRecord.data).PrimaryAction
        const heroRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${defaultRecord.id}`
        const pricingTogglePath = `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget/${pricingWidget.id}/toggle-active`
        const [recordActionRaceResponse, sectionDeactivationRaceResponse] = await Promise.all([
            sendWithCsrf(bindingApi, 'PATCH', heroRecordPath, {
                data: { PrimaryAction: { kind: 'anchor', href: '#pricing' } },
                expectedVersion: currentDefaultRecord.version
            }),
            sendWithCsrf(mutationApi, 'PATCH', pricingTogglePath, {
                isActive: false,
                expectedVersion: pricingWidget.version
            })
        ])
        expect(
            recordActionRaceResponse.ok !== sectionDeactivationRaceResponse.ok,
            'A concurrent Hero anchor update and target-section deactivation must serialize so exactly one succeeds'
        ).toBe(true)

        const postRaceDefaultRecord = (await getRecord(setupApi, metahub.id, heroEntity.id, defaultRecord.id)) as RecordItem
        const postRaceWidgets = (await listLayoutZoneWidgets(setupApi, metahub.id, layoutId)) as { items?: LayoutWidget[] }
        const postRacePricing = postRaceWidgets.items?.find((widget) => widget.id === pricingWidget.id)
        if (recordActionRaceResponse.ok) {
            expect(sectionDeactivationRaceResponse.ok).toBe(false)
            expect(readRecordData(postRaceDefaultRecord.data).PrimaryAction).toEqual({ kind: 'anchor', href: '#pricing' })
            expect(postRacePricing?.isActive).toBe(true)
        } else {
            expect(sectionDeactivationRaceResponse.ok).toBe(true)
            expect(readRecordData(postRaceDefaultRecord.data).PrimaryAction).toEqual(currentPrimaryAction)
            expect(postRacePricing?.isActive).toBe(false)
        }

        const bindingPath = `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget/${heroWidget.id}/binding`
        const deleteRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${deleteRaceRecord.id}`
        const [deleteRaceBindingResponse, deleteResponse] = await Promise.all([
            sendWithCsrf(bindingApi, 'PATCH', bindingPath, {
                recordId: deleteRaceRecord.id,
                expectedVersion: heroWidget.version
            }),
            sendWithCsrf(mutationApi, 'DELETE', deleteRecordPath, undefined)
        ])

        expect(deleteRaceBindingResponse.ok !== deleteResponse.ok, 'The binding and deletion race must commit exactly one operation').toBe(
            true
        )

        const afterDeleteRace = await assertCurrentBindingResolvesUniquely(setupApi, metahub.id, heroEntity.id, layoutId, heroWidget.id)
        const deleteRaceRecordAfter = afterDeleteRace.records.find((record) => record.id === deleteRaceRecord.id)
        if (deleteRaceBindingResponse.ok) {
            expect(deleteResponse.ok).toBe(false)
            expect(afterDeleteRace.binding.recordId).toBe(deleteRaceRecord.id)
            expect(deleteRaceRecordAfter?.data?.HeroKey).toBe(deleteRaceKey)
        } else {
            expect(deleteResponse.ok).toBe(true)
            expect(deleteRaceRecordAfter).toBeUndefined()
            expect(afterDeleteRace.binding.recordId).not.toBe(deleteRaceRecord.id)
            expect(afterDeleteRace.records.filter((record) => readRecordData(record.data).HeroKey === deleteRaceKey)).toHaveLength(0)
        }

        const renameRaceRecord = await createHeroRecord()
        if (typeof renameRaceRecord.id !== 'string' || typeof renameRaceRecord.version !== 'number') {
            throw new Error('The rename-race Hero record did not expose its id and version')
        }
        const originalRenameKey = readRecordData(renameRaceRecord.data).HeroKey
        if (typeof originalRenameKey !== 'string') throw new Error('The rename-race Hero record did not expose its semantic key')
        const renamedKey = `${originalRenameKey}-renamed`

        const currentWidgets = (await listLayoutZoneWidgets(setupApi, metahub.id, layoutId)) as { items?: LayoutWidget[] }
        const currentHeroWidget = currentWidgets.items?.find(
            (widget) => widget.widgetKey === 'marketing.hero' && widget.instanceKey === 'hero'
        )
        if (typeof currentHeroWidget?.id !== 'string' || typeof currentHeroWidget.version !== 'number') {
            throw new Error('The Hero placement did not expose its current version for the rename race')
        }

        const currentBindingPath = `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget/${currentHeroWidget.id}/binding`
        const renameRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${renameRaceRecord.id}`
        const [renameRaceBindingResponse, renameResponse] = await Promise.all([
            sendWithCsrf(bindingApi, 'PATCH', currentBindingPath, {
                recordId: renameRaceRecord.id,
                expectedVersion: currentHeroWidget.version
            }),
            sendWithCsrf(mutationApi, 'PATCH', renameRecordPath, {
                data: { HeroKey: renamedKey },
                expectedVersion: renameRaceRecord.version
            })
        ])

        expect(renameRaceBindingResponse.ok || renameResponse.ok, 'At least one side of the rename race must commit').toBe(true)

        const afterRenameRace = await assertCurrentBindingResolvesUniquely(
            setupApi,
            metahub.id,
            heroEntity.id,
            layoutId,
            currentHeroWidget.id
        )
        const renameRaceRecordAfter = afterRenameRace.records.find((record) => record.id === renameRaceRecord.id)
        expect(renameRaceRecordAfter, 'The rename race must leave the target record extant').toBeDefined()
        const finalRenameKey = readRecordData(renameRaceRecordAfter?.data).HeroKey

        if (renameResponse.ok) {
            expect(finalRenameKey).toBe(renamedKey)
            expect(afterRenameRace.records.filter((record) => readRecordData(record.data).HeroKey === originalRenameKey)).toHaveLength(0)
            if (renameRaceBindingResponse.ok) {
                expect(afterRenameRace.binding.recordId).toBe(renameRaceRecord.id)
            } else {
                expect(afterRenameRace.binding.recordId).not.toBe(renameRaceRecord.id)
            }
        } else {
            expect(finalRenameKey).toBe(originalRenameKey)
            expect(renameRaceBindingResponse.ok).toBe(true)
            expect(afterRenameRace.binding.recordId).toBe(renameRaceRecord.id)
        }

        if (!renameRaceBindingResponse.ok) {
            const latestWidgets = (await listLayoutZoneWidgets(setupApi, metahub.id, layoutId)) as { items?: LayoutWidget[] }
            const latestHeroWidget = latestWidgets.items?.find(
                (widget) => widget.widgetKey === 'marketing.hero' && widget.instanceKey === 'hero'
            )
            if (typeof latestHeroWidget?.id !== 'string' || typeof latestHeroWidget.version !== 'number') {
                throw new Error('The Hero placement did not expose its current version for the bind-first check')
            }
            const bindFirstResponse = await sendWithCsrf(bindingApi, 'PATCH', currentBindingPath, {
                recordId: renameRaceRecord.id,
                expectedVersion: latestHeroWidget.version
            })
            expect(bindFirstResponse.ok, 'The renamed record should be bindable after its rename wins first').toBe(true)
        }

        const afterBindFirst = await assertCurrentBindingResolvesUniquely(
            setupApi,
            metahub.id,
            heroEntity.id,
            layoutId,
            currentHeroWidget.id
        )
        expect(afterBindFirst.binding.recordId).toBe(renameRaceRecord.id)
        const boundRecordVersion = afterBindFirst.record.version
        if (typeof boundRecordVersion !== 'number') throw new Error('The bound Hero record did not expose its current version')

        const renameAfterBindingResponse = await sendWithCsrf(mutationApi, 'PATCH', renameRecordPath, {
            data: { HeroKey: `${finalRenameKey}-after-binding` },
            expectedVersion: boundRecordVersion
        })
        expect(renameAfterBindingResponse.ok, 'A bound Hero semantic key must not be renamed').toBe(false)

        const deleteAfterBindingResponse = await sendWithCsrf(mutationApi, 'DELETE', renameRecordPath, undefined)
        expect(deleteAfterBindingResponse.ok, 'A bound Hero record must not be deleted').toBe(false)

        const afterBoundMutations = await assertCurrentBindingResolvesUniquely(
            setupApi,
            metahub.id,
            heroEntity.id,
            layoutId,
            currentHeroWidget.id
        )
        expect(afterBoundMutations.binding.recordId).toBe(renameRaceRecord.id)
        expect(readRecordData(afterBoundMutations.record.data).HeroKey).toBe(finalRenameKey)
    } finally {
        await Promise.all([
            disposeApiContext(setupApi),
            bindingApi ? disposeApiContext(bindingApi) : Promise.resolve(),
            mutationApi ? disposeApiContext(mutationApi) : Promise.resolve()
        ])
    }
})
