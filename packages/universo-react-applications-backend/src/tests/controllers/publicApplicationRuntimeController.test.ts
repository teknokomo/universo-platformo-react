import type { Request } from 'express'
import type { DbExecutor } from '@universo-react/utils'
import {
    createPublicApplicationRuntimeController,
    parsePublicInterpretationNetworkQuery,
    resolvePublicRuntimeRequest,
    serializeBoundedPublicRuntimePayload
} from '../../controllers/publicApplicationRuntimeController'
import { MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES, type PublicApplicationRuntime } from '@universo-react/types'
import { PublicApplicationUnavailableError } from '../../services/publicApplicationRuntime'

const requestWithQuery = (query: Record<string, unknown>) => ({ query } as unknown as Request)
const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'

describe('public application runtime response serialization', () => {
    it('rejects a serialized payload above the shared anonymous response bound', () => {
        const payload = { data: 'x'.repeat(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES) } as unknown as PublicApplicationRuntime
        expect(() => serializeBoundedPublicRuntimePayload(payload)).toThrow('Public runtime data is temporarily unavailable')
    })

    it('counts UTF-8 bytes when bounding page payloads', () => {
        const payload = { data: 'я'.repeat(MAX_PUBLIC_APPLICATION_RUNTIME_RESPONSE_BYTES / 2) }
        expect(() => serializeBoundedPublicRuntimePayload(payload)).toThrow('Public runtime data is temporarily unavailable')
    })
})

describe('public application runtime controller request parsing', () => {
    it('defaults to English global scope and accepts supported locales', () => {
        expect(resolvePublicRuntimeRequest(requestWithQuery({}), applicationId)).toMatchObject({
            locale: 'en',
            target: { applicationId, targetKind: null, locale: 'en' }
        })
        expect(resolvePublicRuntimeRequest(requestWithQuery({ locale: 'en' }), applicationId).locale).toBe('en')
        expect(resolvePublicRuntimeRequest(requestWithQuery({ locale: 'ru' }), applicationId).locale).toBe('ru')
    })

    it('accepts one page/object selector and validates its UUID v7 or codename form', () => {
        const pageId = '0190a9b5-3cde-7abc-8def-0123456789ac'
        expect(
            resolvePublicRuntimeRequest(requestWithQuery({ targetKind: 'page', entityTypeId: pageId, locale: 'ru' }), applicationId)
        ).toMatchObject({
            locale: 'ru',
            target: { applicationId, targetKind: 'page', entityTypeId: pageId, locale: 'ru' }
        })
        expect(
            resolvePublicRuntimeRequest(
                requestWithQuery({ targetKind: 'object', entityTypeCodename: 'MarketingPageFeature' }),
                applicationId
            ).target
        ).toMatchObject({ targetKind: 'object', entityTypeCodename: 'MarketingPageFeature' })
    })

    it('rejects unknown, repeated, unsupported, incomplete, or workspace-selecting queries', () => {
        for (const query of [
            { debug: 'true' },
            { locale: ['en', 'ru'] },
            { locale: 'fr' },
            { workspaceId: applicationId },
            { targetKind: 'set', entityTypeId: applicationId },
            { targetKind: 'page' },
            { entityTypeId: applicationId },
            { targetKind: 'page', entityTypeId: applicationId, entityTypeCodename: 'Landing' },
            { targetKind: 'page', entityTypeId: '0190a9b5-3cde-4abc-8def-0123456789ab' }
        ]) {
            expect(() => resolvePublicRuntimeRequest(requestWithQuery(query), applicationId)).toThrow(PublicApplicationUnavailableError)
        }
    })
})

describe('public Interpretation Network runtime controller request parsing', () => {
    it('validates parent handles in the request parser before runtime resolution', () => {
        const validHandle = `pn1.${'a'.repeat(28)}`

        expect(parsePublicInterpretationNetworkQuery(requestWithQuery({ view: 'matrix', parentHandle: validHandle }))).toMatchObject({
            view: 'matrix',
            parentHandle: validHandle
        })

        for (const parentHandle of ['invalid', `pn1.${'a'.repeat(1025)}`, ['pn1.valid']]) {
            expect(() => parsePublicInterpretationNetworkQuery(requestWithQuery({ view: 'matrix', parentHandle }))).toThrow(
                PublicApplicationUnavailableError
            )
        }
    })

    it('rejects an invalid parent handle before opening a public runtime transaction', async () => {
        const transaction = jest.fn()
        const controller = createPublicApplicationRuntimeController(() => ({ transaction } as unknown as DbExecutor))
        const req = {
            params: { applicationRef: applicationId, instanceKey: 'interpretation-workspace' },
            query: { view: 'matrix', parentHandle: 'invalid' },
            get: jest.fn(() => undefined)
        } as unknown as Request
        const res = {
            set: jest.fn().mockReturnThis(),
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        }

        await controller.getInterpretationNetwork(req, res as never)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(transaction).not.toHaveBeenCalled()
    })
})
