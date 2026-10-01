import { describe, expect, it } from 'vitest'
import {
    marketingWidgetRecordCopyIntentSchema,
    replaceLayoutZoneWidgetBindingsInputSchema,
    widgetBindingSourceProvisionPayloadSchema
} from '../common/widgetBindingApi'

describe('widget binding API contracts', () => {
    it('accepts localized tags supported by the backend and rejects malformed replacements', () => {
        expect(
            replaceLayoutZoneWidgetBindingsInputSchema.safeParse({
                expectedVersion: 4,
                locale: 'en-GB',
                bindings: [{ slot: 'content', sourceKey: 'MarketingHeroContent', selector: { kind: 'record-set' } }]
            }).success
        ).toBe(true)
        expect(
            replaceLayoutZoneWidgetBindingsInputSchema.safeParse({
                expectedVersion: 4,
                locale: 'en-GB',
                bindings: [],
                unexpected: true
            }).success
        ).toBe(false)
        expect(
            replaceLayoutZoneWidgetBindingsInputSchema.safeParse({
                expectedVersion: 4,
                bindings: [{ slot: 'content', sourceKey: '01a0eac4-0a52-7053-a127-9e8c3a0fd3bb', selector: { kind: 'record-set' } }]
            }).success
        ).toBe(false)
    })

    it('defaults provision locale and validates localized tags through the shared contract', () => {
        expect(
            widgetBindingSourceProvisionPayloadSchema.parse({
                templateSourceKey: 'MarketingHeroContent',
                name: 'Hero content'
            }).locale
        ).toBe('en')
        expect(
            widgetBindingSourceProvisionPayloadSchema.safeParse({
                locale: 'fr-CA',
                templateSourceKey: 'MarketingHeroContent',
                name: 'Hero content'
            }).success
        ).toBe(true)
    })

    it('accepts a bounded UUID v7 semantic copy intent and rejects physical or extra fields', () => {
        const intent = {
            entityId: '01a0eac4-0a52-7053-a127-9e8c3a0fd3bb',
            recordId: '01a0eac4-0a52-7053-a127-9e8c3a0fd3bc',
            sourceKey: 'MarketingPageImage',
            sourceSemanticKey: 'image-01a0eac4-0a52-7053-a127-9e8c3a0fd3bd',
            slot: 'content'
        }
        expect(marketingWidgetRecordCopyIntentSchema.safeParse(intent).success).toBe(true)
        expect(
            marketingWidgetRecordCopyIntentSchema.safeParse({ ...intent, recordId: '00000000-0000-4000-8000-000000000001' }).success
        ).toBe(false)
        expect(marketingWidgetRecordCopyIntentSchema.safeParse({ ...intent, physicalSource: 'internal' }).success).toBe(false)
    })
})
