import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createRecord,
    disposeApiContext,
    getComponent,
    getLayoutZoneWidgetBindings,
    getRecord,
    listEntityInstances,
    listComponents,
    listLayoutZoneWidgets,
    listLayouts,
    listRecords,
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
    slot?: unknown
    sourceKey?: unknown
    selectorKind?: unknown
    semanticKey?: unknown
    selectionLabel?: unknown
}

const readRecordData = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

const readHeroBinding = async (api: ApiSession, metahubId: string, layoutId: string, widgetId: string): Promise<BindingTarget> => {
    const result = (await getLayoutZoneWidgetBindings(api, metahubId, layoutId, widgetId)) as { bindings?: BindingTarget[] }
    const binding = result.bindings?.find((item) => item.slot === 'content')
    if (!binding) throw new Error('The persisted Hero layout did not expose its content binding')
    return binding
}

const assertCurrentBindingResolvesUniquely = async (
    api: ApiSession,
    metahubId: string,
    heroObjectId: string,
    layoutId: string,
    widgetId: string
): Promise<{ binding: BindingTarget; record: RecordItem; records: RecordItem[] }> => {
    const binding = await readHeroBinding(api, metahubId, layoutId, widgetId)
    expect(binding.sourceKey).toBe('MarketingPageHero')
    expect(binding.selectorKind).toBe('semantic-key')
    expect(typeof binding.semanticKey).toBe('string')

    const recordResponse = (await listRecords(api, metahubId, heroObjectId, { limit: 100, offset: 0 })) as {
        items?: RecordItem[]
    }
    const records = recordResponse.items ?? []
    const matches = records.filter((item) => readRecordData(item.data).HeroKey === binding.semanticKey)
    expect(matches, 'A bound semantic key must resolve to exactly one extant record').toHaveLength(1)
    const record = matches[0]
    expect(typeof readRecordData(record?.data).HeroKey, 'The resolved Hero record must expose its semantic key').toBe('string')

    return { binding, record: record!, records }
}

const replaceHeroBinding = (
    api: ApiSession,
    metahubId: string,
    layoutId: string,
    widgetId: string,
    expectedVersion: number,
    semanticKey: string
) =>
    sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/binding`, {
        expectedVersion,
        bindings: [{ slot: 'content', sourceKey: 'MarketingPageHero', selector: { kind: 'semantic-key', value: semanticKey } }]
    })

const replaceWidgetBindings = (
    api: ApiSession,
    metahubId: string,
    layoutId: string,
    widgetId: string,
    expectedVersion: number,
    bindings: Array<{ slot: string; sourceKey: string; selector: Record<string, string> }>
) =>
    sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahubId}/layout/${layoutId}/zone-widget/${widgetId}/binding`, {
        expectedVersion,
        locale: 'en',
        bindings
    })

test('@flow @marketing-page @concurrency keeps Marketing Entity bindings consistent with concurrent record mutations', async ({
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
        const imageEntity = entities.items?.find((entity) => readLocalizedText(entity.codename, 'en') === 'MarketingPageImage')
        if (typeof imageEntity?.id !== 'string') throw new Error('The marketing-page fixture did not expose MarketingPageImage')
        const pricingObject = entities.items?.find((entity) => readLocalizedText(entity.codename, 'en') === 'MarketingPagePricing')
        if (typeof pricingObject?.id !== 'string') throw new Error('The marketing-page fixture did not expose MarketingPagePricing')
        const pricingBenefitsObject = entities.items?.find(
            (entity) => readLocalizedText(entity.codename, 'en') === 'MarketingPagePricingBenefit'
        )
        if (typeof pricingBenefitsObject?.id !== 'string') {
            throw new Error('The marketing-page fixture did not expose MarketingPagePricingBenefit')
        }
        const alternateTargetObject = entities.items?.find((entity) => readLocalizedText(entity.codename, 'en') === 'MarketingPageFaq')
        if (typeof alternateTargetObject?.id !== 'string')
            throw new Error('The marketing-page fixture did not expose an alternate Object target')

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
        const imageWidget = widgetResponse.items?.find(
            (widget) => widget.widgetKey === 'marketing.image' && widget.instanceKey === 'hero-image'
        )
        if (typeof imageWidget?.id !== 'string' || typeof imageWidget.version !== 'number' || imageWidget.isActive !== true) {
            throw new Error('The marketing-page fixture did not expose an active, versioned Image placement')
        }
        const pricingWidget = widgetResponse.items?.find(
            (widget) => widget.widgetKey === 'marketing.pricing' && widget.instanceKey === 'pricing'
        )
        if (typeof pricingWidget?.id !== 'string' || typeof pricingWidget.version !== 'number' || pricingWidget.isActive !== true) {
            throw new Error('The marketing-page fixture did not expose an active, versioned Pricing section')
        }
        const seededBinding = await readHeroBinding(setupApi, metahub.id, layoutId, heroWidget.id)
        expect(seededBinding.sourceKey).toBe('MarketingPageHero')
        expect(seededBinding.selectorKind).toBe('semantic-key')
        expect(seededBinding.semanticKey).toBe('default')

        const seededImageBindings = (await getLayoutZoneWidgetBindings(setupApi, metahub.id, layoutId, imageWidget.id)) as {
            bindings?: BindingTarget[]
        }
        const seededImageBinding = seededImageBindings.bindings?.find((binding) => binding.slot === 'content')
        expect(seededImageBinding).toMatchObject({
            sourceKey: 'MarketingPageImage',
            selectorKind: 'semantic-key',
            semanticKey: 'default'
        })

        const imageSourceResponse = await sendWithCsrf(
            setupApi,
            'POST',
            `/api/v1/metahub/${metahub.id}/layout/${layoutId}/widget-binding-sources/marketing.image/content`,
            {
                templateSourceKey: 'MarketingPageImage',
                name: `E2E ${executionId} compatible image source`,
                locale: 'en'
            }
        )
        expect(imageSourceResponse.status, 'Provisioning a custom Object from the Image slot contract').toBe(201)
        const imageSourcePayload = (await imageSourceResponse.json()) as { source?: { sourceKey?: unknown } }
        const imageSourceKey = imageSourcePayload.source?.sourceKey
        if (typeof imageSourceKey !== 'string') throw new Error('The custom Image source did not return its generated source key')
        expect(imageSourceKey).toMatch(/^MarketingWidgetSource_[0-9a-f]{32}$/u)
        expect(imageSourceKey).not.toBe('MarketingPageImage')

        const imageSourceEntities = (await listEntityInstances(setupApi, metahub.id, { kind: 'object', limit: 300, offset: 0 })) as {
            items?: EntityListItem[]
        }
        const matchingImageSources = imageSourceEntities.items?.filter(
            (entity) => readLocalizedText(entity.codename, 'en') === imageSourceKey
        )
        expect(matchingImageSources, 'The generated source key must identify exactly one persisted Object').toHaveLength(1)
        const imageSourceObject = matchingImageSources?.[0]
        if (typeof imageSourceObject?.id !== 'string') throw new Error('The custom Image source Object did not expose its API identity')
        expect(isUuidV7(imageSourceObject.id), 'The custom source Object API identity must be UUID v7').toBe(true)

        const imageRecords = (await listRecords(setupApi, metahub.id, imageEntity.id, { limit: 100, offset: 0 })) as {
            items?: RecordItem[]
        }
        const defaultImageRecord = imageRecords.items?.find((record) => readRecordData(record.data).ImageKey === 'default')
        if (typeof defaultImageRecord?.id !== 'string') {
            throw new Error('The marketing-page fixture did not expose its default Image record')
        }
        const currentDefaultImageRecord = (await getRecord(setupApi, metahub.id, imageEntity.id, defaultImageRecord.id)) as RecordItem
        const requestedImageSemanticKey = `e2e-${imageSourceObject.id.replace(/-/gu, '').toLowerCase()}`
        const createdImageRecord = await createRecord(setupApi, metahub.id, imageSourceObject.id, {
            data: { ...readRecordData(currentDefaultImageRecord.data), ImageKey: requestedImageSemanticKey }
        })
        if (typeof createdImageRecord?.id !== 'string') throw new Error('Creating the custom Image record did not return its API identity')
        expect(isUuidV7(createdImageRecord.id), 'The custom semantic record API identity must be UUID v7').toBe(true)
        expect(createdImageRecord.id).not.toBe(imageSourceObject.id)
        const createdImageRecordPersisted = (await getRecord(
            setupApi,
            metahub.id,
            imageSourceObject.id,
            createdImageRecord.id
        )) as RecordItem
        const imageSemanticKey = readRecordData(createdImageRecordPersisted.data).ImageKey
        if (typeof imageSemanticKey !== 'string') {
            throw new Error('The custom Image record did not expose its server-assigned semantic key')
        }
        expect(imageSemanticKey).toMatch(/^image-[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
        expect(isUuidV7(imageSemanticKey.slice('image-'.length))).toBe(true)
        expect(imageSemanticKey).not.toBe('default')
        const recordsAfterImageCreate = (await listRecords(setupApi, metahub.id, imageSourceObject.id, {
            limit: 100,
            offset: 0
        })) as { items?: RecordItem[] }
        expect(
            (recordsAfterImageCreate.items ?? []).filter((record) => readRecordData(record.data).ImageKey === imageSemanticKey)
        ).toHaveLength(1)

        const imageRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${imageSourceObject.id}/record/${createdImageRecord.id}`
        const [imageBindingRaceResponse, imageDeleteRaceResponse] = await Promise.all([
            replaceWidgetBindings(bindingApi, metahub.id, layoutId, imageWidget.id, imageWidget.version, [
                { slot: 'content', sourceKey: imageSourceKey, selector: { kind: 'semantic-key', value: imageSemanticKey } }
            ]),
            sendWithCsrf(mutationApi, 'DELETE', imageRecordPath, undefined)
        ])
        expect(
            imageBindingRaceResponse.ok !== imageDeleteRaceResponse.ok,
            'The generic semantic Object bind-vs-delete race must commit exactly one operation'
        ).toBe(true)

        const [imageBindingsAfterRace, imageRecordsAfterRace] = (await Promise.all([
            getLayoutZoneWidgetBindings(setupApi, metahub.id, layoutId, imageWidget.id),
            listRecords(setupApi, metahub.id, imageSourceObject.id, { limit: 100, offset: 0 })
        ])) as [{ bindings?: BindingTarget[] }, { items?: RecordItem[] }]
        const imageBindingAfterRace = imageBindingsAfterRace.bindings?.find((binding) => binding.slot === 'content')
        const persistedImageRecords = imageRecordsAfterRace.items ?? []
        const persistedImageTarget = persistedImageRecords.find((record) => record.id === createdImageRecord.id)

        if (imageBindingRaceResponse.ok) {
            expect(imageBindingRaceResponse.status).toBe(200)
            expect(imageDeleteRaceResponse.status).toBe(409)
            expect((await imageDeleteRaceResponse.json()).code).toBe('RECORD_BOUND')
            expect(imageBindingAfterRace).toMatchObject({
                sourceKey: imageSourceKey,
                selectorKind: 'semantic-key',
                semanticKey: imageSemanticKey
            })
            expect(persistedImageTarget?.data?.ImageKey).toBe(imageSemanticKey)
            expect(persistedImageRecords.filter((record) => readRecordData(record.data).ImageKey === imageSemanticKey)).toHaveLength(1)
        } else {
            expect(imageDeleteRaceResponse.status).toBe(204)
            expect(imageBindingRaceResponse.status).toBe(404)
            expect((await imageBindingRaceResponse.json()).code).toBe('NOT_FOUND')
            expect(imageBindingAfterRace).toMatchObject({
                sourceKey: 'MarketingPageImage',
                selectorKind: 'semantic-key',
                semanticKey: 'default'
            })
            expect(persistedImageTarget).toBeUndefined()
            expect(persistedImageRecords.filter((record) => readRecordData(record.data).ImageKey === imageSemanticKey)).toHaveLength(0)
        }

        const pricingBindingResponse = (await getLayoutZoneWidgetBindings(setupApi, metahub.id, layoutId, pricingWidget.id)) as {
            bindings?: BindingTarget[]
        }
        const pricingSectionBinding = pricingBindingResponse.bindings?.find((binding) => binding.slot === 'section')
        const pricingTiersBinding = pricingBindingResponse.bindings?.find((binding) => binding.slot === 'tiers')
        const pricingBenefitsBinding = pricingBindingResponse.bindings?.find((binding) => binding.slot === 'benefits')
        if (
            typeof pricingSectionBinding?.sourceKey !== 'string' ||
            typeof pricingSectionBinding.semanticKey !== 'string' ||
            typeof pricingTiersBinding?.sourceKey !== 'string' ||
            pricingTiersBinding.selectorKind !== 'record-set' ||
            pricingBenefitsBinding?.sourceKey !== 'MarketingPagePricingBenefit' ||
            pricingBenefitsBinding.selectorKind !== 'relation-set'
        ) {
            throw new Error('The seeded Pricing widget did not expose its parent and relation bindings')
        }

        const relationSourceResponse = await sendWithCsrf(
            setupApi,
            'POST',
            `/api/v1/metahub/${metahub.id}/layout/${layoutId}/widget-binding-sources/marketing.pricing/benefits`,
            {
                templateSourceKey: 'MarketingPagePricingBenefit',
                parentSourceKey: 'MarketingPagePricing',
                name: `E2E ${executionId} relation source`,
                locale: 'en'
            }
        )
        expect(relationSourceResponse.status, 'Provisioning the isolated relation source').toBe(201)
        const relationSourcePayload = (await relationSourceResponse.json()) as { source?: { sourceKey?: unknown } }
        const relationSourceKey = relationSourcePayload.source?.sourceKey
        if (typeof relationSourceKey !== 'string') throw new Error('The isolated relation source did not return its stable source key')

        const relationSourceEntity = (await listEntityInstances(setupApi, metahub.id, { kind: 'object', limit: 300, offset: 0 })) as {
            items?: EntityListItem[]
        }
        const relationSourceObject = relationSourceEntity.items?.find(
            (entity) => readLocalizedText(entity.codename, 'en') === relationSourceKey
        )
        if (typeof relationSourceObject?.id !== 'string') throw new Error('The isolated relation source Entity was not persisted')
        const relationComponents = (await listComponents(setupApi, metahub.id, relationSourceObject.id, {
            limit: 100,
            offset: 0,
            includeShared: true
        })) as { items?: Array<{ id?: unknown; codename?: unknown }> }
        const tierReference = relationComponents.items?.find((component) => readLocalizedText(component.codename, 'en') === 'TierRef')
        if (typeof tierReference?.id !== 'string') throw new Error('The isolated relation source did not expose its TierRef Component')
        const tierReferenceDetails = (await getComponent(setupApi, metahub.id, relationSourceObject.id, tierReference.id)) as {
            version?: unknown
            targetEntityId?: unknown
            targetEntityKind?: unknown
            validationRules?: unknown
            uiConfig?: unknown
        }
        if (typeof tierReferenceDetails.version !== 'number' || tierReferenceDetails.targetEntityId !== pricingObject.id) {
            throw new Error('The isolated relation source did not target the selected Pricing parent')
        }

        const relationBindingRace = await Promise.all([
            replaceWidgetBindings(setupApi, metahub.id, layoutId, pricingWidget.id, pricingWidget.version as number, [
                {
                    slot: 'section',
                    sourceKey: pricingSectionBinding.sourceKey,
                    selector: { kind: 'semantic-key', value: pricingSectionBinding.semanticKey }
                },
                { slot: 'tiers', sourceKey: pricingTiersBinding.sourceKey, selector: { kind: 'record-set' } },
                { slot: 'benefits', sourceKey: relationSourceKey, selector: { kind: 'relation-set' } }
            ]),
            sendWithCsrf(
                mutationApi,
                'PATCH',
                `/api/v1/metahub/${metahub.id}/entities/object/instance/${relationSourceObject.id}/component/${tierReference.id}`,
                {
                    targetEntityId: alternateTargetObject.id,
                    targetEntityKind: 'object',
                    expectedVersion: tierReferenceDetails.version,
                    validationRules: tierReferenceDetails.validationRules ?? {},
                    uiConfig: tierReferenceDetails.uiConfig ?? {}
                }
            )
        ])
        const [relationBindingResponse, relationRetargetResponse] = relationBindingRace
        expect(
            relationBindingResponse.ok !== relationRetargetResponse.ok,
            'A relation-set binding and its REF target retarget must serialize to exactly one committed operation'
        ).toBe(true)
        if (relationBindingResponse.ok) {
            expect(relationRetargetResponse.status).toBe(409)
            expect((await relationRetargetResponse.json()).code).toBe('ENTITY_COMPONENT_SCHEMA_PROTECTED')
        } else {
            expect(relationBindingResponse.status).toBe(400)
            expect((await relationBindingResponse.json()).code).toBe('VALIDATION_ERROR')
        }

        const [pricingBindingAfterRace, tierReferenceAfterRace] = (await Promise.all([
            getLayoutZoneWidgetBindings(setupApi, metahub.id, layoutId, pricingWidget.id),
            getComponent(setupApi, metahub.id, relationSourceObject.id, tierReference.id)
        ])) as [{ bindings?: BindingTarget[] }, { targetEntityId?: unknown }]
        const benefitsBindingAfterRace = pricingBindingAfterRace.bindings?.find((binding) => binding.slot === 'benefits')
        if (relationBindingResponse.ok) {
            expect(benefitsBindingAfterRace?.sourceKey).toBe(relationSourceKey)
            expect(tierReferenceAfterRace.targetEntityId).toBe(pricingObject.id)
        } else {
            expect(relationRetargetResponse.ok).toBe(true)
            expect(relationBindingResponse.status).toBe(400)
            expect(benefitsBindingAfterRace?.sourceKey).not.toBe(relationSourceKey)
            expect(tierReferenceAfterRace.targetEntityId).toBe(alternateTargetObject.id)
        }

        const currentPrimaryAction = readRecordData(currentDefaultRecord.data).PrimaryAction
        const heroRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${defaultRecord.id}`
        const pricingTogglePath = `/api/v1/metahub/${metahub.id}/layout/${layoutId}/zone-widget/${pricingWidget.id}/toggle-active`
        const widgetsBeforeActionRace = (await listLayoutZoneWidgets(setupApi, metahub.id, layoutId)) as { items?: LayoutWidget[] }
        const pricingWidgetBeforeActionRace = widgetsBeforeActionRace.items?.find((widget) => widget.id === pricingWidget.id)
        if (typeof pricingWidgetBeforeActionRace?.version !== 'number') {
            throw new Error('The Pricing placement did not expose its post-binding version for the next concurrency race')
        }
        const [recordActionRaceResponse, sectionDeactivationRaceResponse] = await Promise.all([
            sendWithCsrf(bindingApi, 'PATCH', heroRecordPath, {
                data: { PrimaryAction: { kind: 'anchor', href: '#pricing' } },
                expectedVersion: currentDefaultRecord.version
            }),
            sendWithCsrf(mutationApi, 'PATCH', pricingTogglePath, {
                isActive: false,
                expectedVersion: pricingWidgetBeforeActionRace.version
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
            expect(recordActionRaceResponse.status).toBe(200)
            expect(sectionDeactivationRaceResponse.ok).toBe(false)
            expect(sectionDeactivationRaceResponse.status).toBe(400)
            expect(await sectionDeactivationRaceResponse.json()).toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'HERO_ACTION_TARGET_UNAVAILABLE'
            })
            expect(readRecordData(postRaceDefaultRecord.data).PrimaryAction).toEqual({ kind: 'anchor', href: '#pricing' })
            expect(postRacePricing?.isActive).toBe(true)
        } else {
            expect(sectionDeactivationRaceResponse.ok).toBe(true)
            expect(sectionDeactivationRaceResponse.status).toBe(200)
            expect(recordActionRaceResponse.status).toBe(400)
            expect(await recordActionRaceResponse.json()).toMatchObject({
                code: 'VALIDATION_ERROR',
                reason: 'HERO_ACTION_TARGET_UNAVAILABLE'
            })
            expect(readRecordData(postRaceDefaultRecord.data).PrimaryAction).toEqual(currentPrimaryAction)
            expect(postRacePricing?.isActive).toBe(false)
        }

        const deleteRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${deleteRaceRecord.id}`
        const [deleteRaceBindingResponse, deleteResponse] = await Promise.all([
            replaceHeroBinding(bindingApi, metahub.id, layoutId, heroWidget.id, heroWidget.version, deleteRaceKey),
            sendWithCsrf(mutationApi, 'DELETE', deleteRecordPath, undefined)
        ])

        expect(deleteRaceBindingResponse.ok !== deleteResponse.ok, 'The binding and deletion race must commit exactly one operation').toBe(
            true
        )

        const afterDeleteRace = await assertCurrentBindingResolvesUniquely(setupApi, metahub.id, heroEntity.id, layoutId, heroWidget.id)
        const deleteRaceRecordAfter = afterDeleteRace.records.find((record) => record.id === deleteRaceRecord.id)
        if (deleteRaceBindingResponse.ok) {
            expect(deleteRaceBindingResponse.status).toBe(200)
            expect(deleteResponse.ok).toBe(false)
            expect(deleteResponse.status).toBe(409)
            expect((await deleteResponse.json()).code).toBe('RECORD_BOUND')
            expect(afterDeleteRace.binding.semanticKey).toBe(deleteRaceKey)
            expect(deleteRaceRecordAfter?.data?.HeroKey).toBe(deleteRaceKey)
        } else {
            expect(deleteResponse.status).toBe(204)
            expect(deleteRaceBindingResponse.status).toBe(404)
            expect((await deleteRaceBindingResponse.json()).code).toBe('NOT_FOUND')
            expect(deleteResponse.ok).toBe(true)
            expect(deleteRaceRecordAfter).toBeUndefined()
            expect(afterDeleteRace.binding.semanticKey).not.toBe(deleteRaceKey)
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

        const renameRecordPath = `/api/v1/metahub/${metahub.id}/entities/object/instance/${heroEntity.id}/record/${renameRaceRecord.id}`
        const [renameRaceBindingResponse, renameResponse] = await Promise.all([
            replaceHeroBinding(bindingApi, metahub.id, layoutId, currentHeroWidget.id, currentHeroWidget.version, originalRenameKey),
            sendWithCsrf(mutationApi, 'PATCH', renameRecordPath, {
                data: { HeroKey: renamedKey },
                expectedVersion: renameRaceRecord.version
            })
        ])

        expect(renameRaceBindingResponse.ok !== renameResponse.ok, 'Binding and semantic-key rename must serialize to one winner').toBe(
            true
        )

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
            expect(renameResponse.status).toBe(200)
            expect(renameRaceBindingResponse.status).toBe(404)
            expect((await renameRaceBindingResponse.json()).code).toBe('NOT_FOUND')
            expect(finalRenameKey).toBe(renamedKey)
            expect(afterRenameRace.binding.semanticKey).not.toBe(originalRenameKey)
            expect(afterRenameRace.records.filter((record) => readRecordData(record.data).HeroKey === originalRenameKey)).toHaveLength(0)
        } else {
            expect(renameRaceBindingResponse.status).toBe(200)
            expect(renameResponse.status).toBe(409)
            expect((await renameResponse.json()).code).toBe('RECORD_PROTECTED')
            expect(finalRenameKey).toBe(originalRenameKey)
            expect(afterRenameRace.binding.semanticKey).toBe(originalRenameKey)
        }

        if (!renameRaceBindingResponse.ok) {
            const latestWidgets = (await listLayoutZoneWidgets(setupApi, metahub.id, layoutId)) as { items?: LayoutWidget[] }
            const latestHeroWidget = latestWidgets.items?.find(
                (widget) => widget.widgetKey === 'marketing.hero' && widget.instanceKey === 'hero'
            )
            if (typeof latestHeroWidget?.id !== 'string' || typeof latestHeroWidget.version !== 'number') {
                throw new Error('The Hero placement did not expose its current version for the bind-first check')
            }
            const bindFirstResponse = await replaceHeroBinding(
                bindingApi,
                metahub.id,
                layoutId,
                latestHeroWidget.id,
                latestHeroWidget.version,
                renamedKey
            )
            expect(bindFirstResponse.ok, 'The renamed record should be bindable after its rename wins first').toBe(true)
        }

        const afterBindFirst = await assertCurrentBindingResolvesUniquely(
            setupApi,
            metahub.id,
            heroEntity.id,
            layoutId,
            currentHeroWidget.id
        )
        expect(afterBindFirst.binding.semanticKey).toBe(finalRenameKey)
        const boundRecordVersion = afterBindFirst.record.version
        if (typeof boundRecordVersion !== 'number') throw new Error('The bound Hero record did not expose its current version')

        const renameAfterBindingResponse = await sendWithCsrf(mutationApi, 'PATCH', renameRecordPath, {
            data: { HeroKey: `${finalRenameKey}-after-binding` },
            expectedVersion: boundRecordVersion
        })
        expect(renameAfterBindingResponse.status, 'A bound Hero semantic key must not be renamed').toBe(409)
        expect(await renameAfterBindingResponse.json()).toMatchObject({ code: 'RECORD_PROTECTED' })

        const deleteAfterBindingResponse = await sendWithCsrf(mutationApi, 'DELETE', renameRecordPath, undefined)
        expect(deleteAfterBindingResponse.status, 'A bound Hero record must not be deleted').toBe(409)
        expect(await deleteAfterBindingResponse.json()).toMatchObject({ code: 'RECORD_BOUND' })

        const afterBoundMutations = await assertCurrentBindingResolvesUniquely(
            setupApi,
            metahub.id,
            heroEntity.id,
            layoutId,
            currentHeroWidget.id
        )
        expect(afterBoundMutations.binding.semanticKey).toBe(finalRenameKey)
        expect(readRecordData(afterBoundMutations.record.data).HeroKey).toBe(finalRenameKey)
    } finally {
        await Promise.all([
            disposeApiContext(setupApi),
            bindingApi ? disposeApiContext(bindingApi) : Promise.resolve(),
            mutationApi ? disposeApiContext(mutationApi) : Promise.resolve()
        ])
    }
})
