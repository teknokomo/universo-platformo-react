import { describe, expect, it } from 'vitest'
import { sanitizeHref } from '../MenuContent'

describe('MenuContent sanitizeHref', () => {
    it('keeps safe internal, http, mail, tel, and hash links', () => {
        expect(sanitizeHref('/workspaces')).toBe('/workspaces')
        expect(sanitizeHref('#overview')).toBe('#overview')
        expect(sanitizeHref('https://example.test/path')).toBe('https://example.test/path')
        expect(sanitizeHref('http://example.test/path')).toBe('http://example.test/path')
        expect(sanitizeHref('mailto:support@example.test')).toBe('mailto:support@example.test')
        expect(sanitizeHref('tel:+10000000000')).toBe('tel:+10000000000')
    })

    it('blocks unsafe schemes and protocol-relative links', () => {
        expect(sanitizeHref('javascript:alert(1)')).toBeUndefined()
        expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined()
        expect(sanitizeHref('vbscript:msgbox(1)')).toBeUndefined()
        expect(sanitizeHref('//example.test/path')).toBeUndefined()
    })
})
