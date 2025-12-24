import { describe, expect, it } from 'vitest'

import { formatFileSize, getOS, isMobile } from '../genericHelper'

const setUserAgent = (ua: string) => {
    Object.defineProperty(window.navigator, 'userAgent', {
        value: ua,
        configurable: true
    })
}

describe('genericHelper', () => {
    it('detects OS from userAgent', () => {
        setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
        expect(getOS()).toBe('macos')

        setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')
        expect(getOS()).toBe('ios')

        setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        expect(getOS()).toBe('windows')

        setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7)')
        expect(getOS()).toBe('android')

        setUserAgent('Mozilla/5.0 (X11; Linux x86_64)')
        expect(getOS()).toBe('linux')

        setUserAgent('Mozilla/5.0 (SomeOS; FooBar)')
        expect(getOS()).toBe(null)
    })

    it('detects mobile user agents', () => {
        setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 7)')
        expect(isMobile()).toBe(true)

        setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
        expect(isMobile()).toBe(false)
    })

    it('formats file sizes', () => {
        expect(formatFileSize(0)).toBe('0 Bytes')
        expect(formatFileSize(1024)).toBe('1 KB')
        expect(formatFileSize(1536)).toBe('1.5 KB')
        expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    })
})
