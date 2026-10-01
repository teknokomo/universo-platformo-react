import type { Request } from 'express'
import { resolvePublicRuntimeRequest } from '../../controllers/publicApplicationRuntimeController'
import { PublicApplicationUnavailableError } from '../../services/publicApplicationRuntime'

const requestWithQuery = (query: Record<string, unknown>) => ({ query } as unknown as Request)
const applicationId = '0190a9b5-3cde-7abc-8def-0123456789ab'

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
