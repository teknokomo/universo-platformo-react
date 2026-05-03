import { describe, expect, it } from 'vitest'
import { isSafeMenuHref, sanitizeMenuHref } from '../menuHref'

describe('menu href validation', () => {
    it('allows runtime-supported navigation targets', () => {
        expect(sanitizeMenuHref('/catalog/modules')).toBe('/catalog/modules')
        expect(sanitizeMenuHref(' https://example.com/path ')).toBe('https://example.com/path')
        expect(sanitizeMenuHref('http://example.com')).toBe('http://example.com')
        expect(sanitizeMenuHref('mailto:training@example.com')).toBe('mailto:training@example.com')
        expect(sanitizeMenuHref('tel:+12025550123')).toBe('tel:+12025550123')
        expect(sanitizeMenuHref('#reports')).toBe('#reports')
    })

    it('blocks unsafe or ambiguous hrefs', () => {
        expect(isSafeMenuHref('javascript:alert(1)')).toBe(false)
        expect(isSafeMenuHref('data:text/html,<script>alert(1)</script>')).toBe(false)
        expect(isSafeMenuHref('vbscript:msgbox(1)')).toBe(false)
        expect(isSafeMenuHref('//evil.example')).toBe(false)
        expect(isSafeMenuHref('ftp://example.com/file')).toBe(false)
        expect(isSafeMenuHref('')).toBe(false)
    })
})
