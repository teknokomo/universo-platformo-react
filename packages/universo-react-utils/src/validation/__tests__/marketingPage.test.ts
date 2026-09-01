import { describe, expect, it } from 'vitest'

import {
    normalizeMarketingAction,
    normalizeMarketingLocalizedText,
    normalizeMarketingMedia,
    normalizeMarketingPageConfig,
    normalizeMarketingPageData,
    parseMarketingActionHref,
    resolveMarketingLocalizedText,
    toMarketingActionHref,
    toMarketingActionLinkAttributes
} from '../marketingPage'

const uuidV7 = '0190a9b5-3cde-7abc-8def-0123456789ab'
const localized = { en: 'English', ru: 'Русский' }
const provenance = {
    layer: 'application' as const,
    sourceId: uuidV7,
    isSeeded: false,
    isAuthored: true
}

describe('marketing page validation utilities', () => {
    it('normalizes plain strings and canonical versioned localized content', () => {
        expect(normalizeMarketingLocalizedText('  Hello  ')).toEqual({ en: 'Hello' })
        expect(
            normalizeMarketingLocalizedText({
                _schema: '1',
                _primary: 'ru',
                locales: {
                    en: { content: 'Hello' },
                    ru: { content: 'Привет' }
                }
            })
        ).toEqual({ en: 'Hello', ru: 'Привет' })
        expect(() => normalizeMarketingLocalizedText({ en: '<b>unsafe</b>' })).toThrow('invalid')
        expect(() => normalizeMarketingLocalizedText({ 'en-US': 'one', en: 'two' })).toThrow('duplicate')
    })

    it('resolves exact, base, fallback, and invalid locale inputs safely', () => {
        expect(resolveMarketingLocalizedText(localized, 'ru-RU')).toBe('Русский')
        expect(resolveMarketingLocalizedText(localized, 'de-DE')).toBe('English')
        expect(resolveMarketingLocalizedText({ fr: 'Bonjour' }, 'de', ['ru'])).toBe('Bonjour')
        expect(resolveMarketingLocalizedText({ en: '<script />' }, 'en')).toBeUndefined()
    })

    it('normalizes action hrefs and adds the external opener policy', () => {
        expect(toMarketingActionHref({ kind: 'internal', path: '/signup' })).toBe('/signup')
        expect(toMarketingActionHref({ kind: 'anchor', href: '#pricing' })).toBe('#pricing')
        expect(toMarketingActionHref({ kind: 'email', address: 'sales@example.test', subject: 'Hello world' })).toBe(
            'mailto:sales@example.test?subject=Hello%20world'
        )
        expect(toMarketingActionHref({ kind: 'tel', number: '+1 (555) 010-1234' })).toBe('tel:+15550101234')
        expect(toMarketingActionLinkAttributes({ kind: 'external', url: 'https://example.test/docs', target: 'new-tab' })).toEqual({
            href: 'https://example.test/docs',
            target: '_blank',
            rel: 'noopener noreferrer'
        })
        expect(toMarketingActionLinkAttributes({ kind: 'external', url: 'https://example.test/docs', target: 'same-tab' })).toEqual({
            href: 'https://example.test/docs'
        })
        expect(() => normalizeMarketingAction({ kind: 'internal', path: '#' })).toThrow('non-placeholder')
    })

    it('parses persisted action hrefs through the canonical action policy', () => {
        expect(parseMarketingActionHref('/signup')).toEqual({ kind: 'internal', path: '/signup', target: 'same-tab' })
        expect(parseMarketingActionHref('#pricing')).toEqual({ kind: 'anchor', href: '#pricing' })
        expect(parseMarketingActionHref('https://example.test/docs')).toEqual({
            kind: 'external',
            url: 'https://example.test/docs',
            target: 'new-tab'
        })
        expect(parseMarketingActionHref('https://example.test/docs', { externalTarget: 'same-tab' })).toEqual({
            kind: 'external',
            url: 'https://example.test/docs',
            target: 'same-tab'
        })
        expect(parseMarketingActionHref('mailto:sales@example.test?subject=Hello%20world')).toEqual({
            kind: 'email',
            address: 'sales@example.test',
            subject: 'Hello world'
        })
        expect(parseMarketingActionHref('mailto:sales@example.test?body=unsafe')).toBeNull()
        expect(parseMarketingActionHref('javascript:alert(1)')).toBeNull()
        expect(parseMarketingActionHref('/\\attacker.test')).toBeNull()
        expect(parseMarketingActionHref('https://user:pass@example.test')).toBeNull()
    })

    it('normalizes media and page data without introducing opaque fallback values', () => {
        expect(
            normalizeMarketingMedia({
                kind: 'logo',
                resource: { type: 'url', url: 'https://cdn.example.test/logo.svg' },
                alt: localized
            })
        ).toMatchObject({ kind: 'logo', decorative: false })
        expect(
            normalizeMarketingMedia({
                kind: 'hero',
                resource: { type: 'file', storageKey: 'marketing/hero.webp', mimeType: 'image/webp' },
                alt: localized
            })
        ).toMatchObject({ resource: { type: 'file', storageKey: 'marketing/hero.webp' } })

        expect(() => normalizeMarketingMedia({ kind: 'logo', resource: { type: 'url', url: 'javascript:alert(1)' } })).toThrow('metadata')

        expect(normalizeMarketingPageConfig({}).themeMode).toBe('system')
        expect(
            normalizeMarketingPageData({
                templateKey: 'marketing-page',
                locale: 'en',
                config: {},
                records: [
                    {
                        id: uuidV7,
                        semanticKey: 'site-settings',
                        locale: 'en',
                        order: 0,
                        isVisible: true,
                        scope: 'application',
                        provenance,
                        kind: 'siteSettings',
                        brandName: localized,
                        heroTitle: localized,
                        heroSubtitle: localized
                    }
                ]
            }).templateKey
        ).toBe('marketing-page')
    })
})
