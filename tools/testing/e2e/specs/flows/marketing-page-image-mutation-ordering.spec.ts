import { createLocalizedContent, isUuidV7 } from '@universo-react/utils'
import { expect, test } from '../../fixtures/test'
import {
    createLoggedInApiContext,
    createMetahub,
    createRecord,
    disposeApiContext,
    getLayoutZoneWidgetBindings,
    getRecord,
    listEntityInstances,
    listLayoutZoneWidgets,
    listLayouts,
    listRecords,
    sendWithCsrf
} from '../../support/backend/api-session.mjs'
import { recordCreatedMetahub } from '../../support/backend/run-manifest.mjs'
import { readLocalizedText } from './entity-runtime-helpers'

type ImageRecord = {
    id?: string
    version?: number
    data?: Record<string, unknown>
}

type ImageWidget = {
    id?: string
    version?: number
    widgetKey?: string
    instanceKey?: string
}

const asRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}

test('@flow @marketing-page @mutation-ordering serializes Image binding against semantic key rename and record deletion', async ({
    runManifest
}) => {
    test.setTimeout(180_000)
    const api = await createLoggedInApiContext({
        email: runManifest.testUser.email,
        password: runManifest.testUser.password
    })

    try {
        const executionId = `${runManifest.runId}-image-order-${test.info().workerIndex}-${test.info().repeatEachIndex}-${
            test.info().retry
        }`
        const metahubCodename = `${executionId}-marketing-page`
        const metahub = await createMetahub(api, {
            name: { en: `E2E ${executionId} Image policy ordering` },
            namePrimaryLocale: 'en',
            codename: createLocalizedContent('en', metahubCodename),
            templateCodename: 'marketing-page'
        })
        if (typeof metahub?.id !== 'string') throw new Error('The marketing-page fixture did not return a metahub id')
        await recordCreatedMetahub({ id: metahub.id, name: metahubCodename, codename: metahubCodename })

        const entities = (await listEntityInstances(api, metahub.id, { kind: 'object', limit: 200, offset: 0 })) as {
            items?: Array<{ id?: unknown; codename?: unknown }>
        }
        const imageEntity = entities.items?.find((entity) => readLocalizedText(entity.codename, 'en') === 'MarketingPageImage')
        if (typeof imageEntity?.id !== 'string') throw new Error('The marketing-page fixture did not expose MarketingPageImage')
        const layouts = await listLayouts(api, metahub.id, { limit: 100, offset: 0 })
        const layout = layouts.items?.find((item: { id?: unknown; templateKey?: unknown }) => item.templateKey === 'marketing-page')
        if (typeof layout?.id !== 'string') throw new Error('The marketing-page fixture did not expose its layout')

        const widgets = (await listLayoutZoneWidgets(api, metahub.id, layout.id)) as { items?: ImageWidget[] }
        const imageWidget = widgets.items?.find((item) => item.widgetKey === 'marketing.image' && item.instanceKey === 'hero-image')
        if (typeof imageWidget?.id !== 'string') throw new Error('The marketing-page fixture did not expose its Image placement')
        const initialBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layout.id, imageWidget.id)) as {
            bindings?: Array<{ slot?: string; sourceKey?: string; semanticKey?: string }>
        }
        expect(initialBindings.bindings?.find(({ slot }) => slot === 'content')).toMatchObject({
            sourceKey: 'MarketingPageImage',
            semanticKey: 'default'
        })
        const seededRecords = (await listRecords(api, metahub.id, imageEntity.id, { limit: 100, offset: 0 })) as {
            items?: ImageRecord[]
        }
        const defaultRecord = seededRecords.items?.find((record) => asRecord(record.data).ImageKey === 'default')
        if (typeof defaultRecord?.id !== 'string') throw new Error('The marketing-page fixture did not expose its default Image record')

        const createImageRecord = async (): Promise<ImageRecord> => {
            const data = { ...asRecord(defaultRecord.data) }
            delete data.ImageKey
            const created = await createRecord(api, metahub.id, imageEntity.id as string, { data })
            if (typeof created?.id !== 'string') throw new Error('Creating a test Image record did not return its identity')
            expect(isUuidV7(created.id)).toBe(true)
            const persisted = (await getRecord(api, metahub.id, imageEntity.id as string, created.id)) as ImageRecord
            if (typeof persisted.version !== 'number') throw new Error('The test Image record did not expose its version')
            const semanticKey = asRecord(persisted.data).ImageKey
            if (typeof semanticKey !== 'string' || !isUuidV7(semanticKey.slice('image-'.length))) {
                throw new Error('The test Image record did not receive a unique UUID v7 semantic key')
            }
            return persisted
        }

        const getCurrentImageWidget = async (): Promise<ImageWidget> => {
            const response = (await listLayoutZoneWidgets(api, metahub.id, layout.id)) as { items?: ImageWidget[] }
            const current = response.items?.find((item) => item.id === imageWidget.id)
            if (typeof current?.id !== 'string' || typeof current.version !== 'number') {
                throw new Error('The Image placement did not expose its current identity and version')
            }
            return current
        }

        const bindImageRecord = async (semanticKey: string) => {
            const current = await getCurrentImageWidget()
            return sendWithCsrf(api, 'PATCH', `/api/v1/metahub/${metahub.id}/layout/${layout.id}/zone-widget/${current.id}/binding`, {
                expectedVersion: current.version,
                locale: 'en',
                bindings: [
                    {
                        slot: 'content',
                        sourceKey: 'MarketingPageImage',
                        selector: { kind: 'semantic-key', value: semanticKey }
                    }
                ]
            })
        }

        const imageRecordPath = (recordId: string) =>
            `/api/v1/metahub/${metahub.id}/entities/object/instance/${imageEntity.id}/record/${recordId}`

        // Bind first: the binding owns the semantic key and the delete must fail.
        const bindFirstRecord = await createImageRecord()
        const bindFirstKey = asRecord(bindFirstRecord.data).ImageKey as string
        const bindFirstResponse = await bindImageRecord(bindFirstKey)
        expect(bindFirstResponse.status).toBe(200)
        const deleteBoundResponse = await sendWithCsrf(api, 'DELETE', imageRecordPath(bindFirstRecord.id as string), undefined)
        expect(deleteBoundResponse.status).toBe(409)
        expect(await deleteBoundResponse.json()).toMatchObject({ code: 'RECORD_BOUND' })
        const bindFirstPersisted = (await getRecord(api, metahub.id, imageEntity.id, bindFirstRecord.id as string)) as ImageRecord
        expect(asRecord(bindFirstPersisted.data).ImageKey).toBe(bindFirstKey)

        // Delete first: a subsequent attempt to bind the removed semantic key must fail closed.
        const deleteFirstRecord = await createImageRecord()
        const deleteFirstKey = asRecord(deleteFirstRecord.data).ImageKey as string
        const deleteFirstResponse = await sendWithCsrf(api, 'DELETE', imageRecordPath(deleteFirstRecord.id as string), undefined)
        expect(deleteFirstResponse.status).toBe(204)
        const bindDeletedResponse = await bindImageRecord(deleteFirstKey)
        expect(bindDeletedResponse.status).toBe(404)
        expect(await bindDeletedResponse.json()).toMatchObject({ code: 'NOT_FOUND' })
        const remainingImageRecords = (await listRecords(api, metahub.id, imageEntity.id, { limit: 100, offset: 0 })) as {
            items?: ImageRecord[]
        }
        expect(remainingImageRecords.items?.some((record) => record.id === deleteFirstRecord.id)).toBe(false)

        // Rename first: the old selector no longer resolves, while the new key can bind.
        const renameFirstRecord = await createImageRecord()
        const originalRenameKey = asRecord(renameFirstRecord.data).ImageKey as string
        const renamedKey = `${originalRenameKey}-renamed`
        const renameFirstResponse = await sendWithCsrf(api, 'PATCH', imageRecordPath(renameFirstRecord.id as string), {
            data: { ImageKey: renamedKey },
            expectedVersion: renameFirstRecord.version
        })
        expect(renameFirstResponse.status).toBe(200)
        const bindOldKeyResponse = await bindImageRecord(originalRenameKey)
        expect(bindOldKeyResponse.status).toBe(404)
        expect(await bindOldKeyResponse.json()).toMatchObject({ code: 'NOT_FOUND' })
        const bindRenamedKeyResponse = await bindImageRecord(renamedKey)
        expect(bindRenamedKeyResponse.status).toBe(200)

        // Bind first: changing a live selector must fail without changing its row.
        const bindThenRenameRecord = await createImageRecord()
        const boundSemanticKey = asRecord(bindThenRenameRecord.data).ImageKey as string
        const bindBeforeRenameResponse = await bindImageRecord(boundSemanticKey)
        expect(bindBeforeRenameResponse.status).toBe(200)
        const renameBoundResponse = await sendWithCsrf(api, 'PATCH', imageRecordPath(bindThenRenameRecord.id as string), {
            data: { ImageKey: `${boundSemanticKey}-renamed` },
            expectedVersion: bindThenRenameRecord.version
        })
        expect(renameBoundResponse.status).toBe(409)
        expect(await renameBoundResponse.json()).toMatchObject({ code: 'RECORD_PROTECTED' })
        const deleteBoundAgainResponse = await sendWithCsrf(api, 'DELETE', imageRecordPath(bindThenRenameRecord.id as string), undefined)
        expect(deleteBoundAgainResponse.status).toBe(409)
        expect(await deleteBoundAgainResponse.json()).toMatchObject({ code: 'RECORD_BOUND' })
        const finalBoundRecord = (await getRecord(api, metahub.id, imageEntity.id, bindThenRenameRecord.id as string)) as ImageRecord
        expect(asRecord(finalBoundRecord.data).ImageKey).toBe(boundSemanticKey)
        const finalBindings = (await getLayoutZoneWidgetBindings(api, metahub.id, layout.id, imageWidget.id)) as {
            bindings?: Array<{ slot?: string; sourceKey?: string; semanticKey?: string }>
        }
        expect(finalBindings.bindings?.find(({ slot }) => slot === 'content')).toMatchObject({
            sourceKey: 'MarketingPageImage',
            semanticKey: boundSemanticKey
        })
    } finally {
        await disposeApiContext(api)
    }
})
