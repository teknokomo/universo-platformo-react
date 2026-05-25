import { describe, expect, it } from 'vitest'

import {
    isAllowedEmbedUrl,
    isDeferredResourceSource,
    normalizeResourceSourceForStorage,
    normalizeSafeExternalUrl,
    parseSafeExternalUrl,
    resourceSourceSchema
} from '../common/resourceSources'

describe('resource source contracts', () => {
    it('normalizes absolute http and https URLs and rejects unsafe protocols or credentials', () => {
        expect(normalizeSafeExternalUrl(' https://example.test/path?q=1 ')).toBe('https://example.test/path?q=1')

        expect(() => parseSafeExternalUrl('javascript:alert(1)')).toThrow('http and https')
        expect(() => parseSafeExternalUrl('https://user:pass@example.test/video')).toThrow('Credentials')
        expect(() => parseSafeExternalUrl('/relative/path')).toThrow('absolute')
    })

    it('allows only explicit embed hosts', () => {
        expect(isAllowedEmbedUrl('https://www.youtube.com/embed/demo')).toBe(true)
        expect(isAllowedEmbedUrl('https://player.vimeo.com/video/1')).toBe(true)
        expect(isAllowedEmbedUrl('https://example.test/embed')).toBe(false)

        expect(
            resourceSourceSchema.safeParse({
                type: 'embed',
                url: 'https://example.test/embed'
            }).success
        ).toBe(false)
    })

    it('validates resource source locator and MIME contracts by type', () => {
        expect(
            normalizeResourceSourceForStorage({
                type: 'video',
                url: 'https://cdn.example.test/lesson.mp4',
                mimeType: 'Video/MP4'
            })
        ).toMatchObject({
            type: 'video',
            url: 'https://cdn.example.test/lesson.mp4',
            mimeType: 'video/mp4',
            launchMode: 'inline'
        })

        expect(
            resourceSourceSchema.safeParse({
                type: 'video',
                url: 'https://cdn.example.test/lesson.flv',
                mimeType: 'video/x-flv'
            }).success
        ).toBe(false)

        expect(
            resourceSourceSchema.safeParse({
                type: 'url',
                url: 'https://example.test',
                pageCodename: 'DuplicateSource'
            }).success
        ).toBe(false)
    })

    it('keeps SCORM, xAPI, and storage-backed resources explicit as deferred runtime sources', () => {
        const scorm = normalizeResourceSourceForStorage({
            type: 'scorm',
            packageDescriptor: {
                version: 'scorm-2004',
                manifest: 'imsmanifest.xml'
            }
        })
        const xapi = normalizeResourceSourceForStorage({
            type: 'xapi',
            packageDescriptor: {
                standard: 'xAPI',
                launch: 'index.html'
            }
        })
        const file = normalizeResourceSourceForStorage({
            type: 'file',
            storageKey: 'uploads/document.pdf'
        })
        const officeDocument = normalizeResourceSourceForStorage({
            type: 'document',
            storageKey: 'uploads/course-plan.docx',
            mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        })
        const uploadedVideo = normalizeResourceSourceForStorage({
            type: 'video',
            storageKey: 'uploads/legacy-lesson.mov',
            mimeType: 'video/quicktime'
        })

        expect(isDeferredResourceSource(scorm)).toBe(true)
        expect(isDeferredResourceSource(xapi)).toBe(true)
        expect(isDeferredResourceSource(file)).toBe(true)
        expect(isDeferredResourceSource(officeDocument)).toBe(true)
        expect(isDeferredResourceSource(uploadedVideo)).toBe(true)
    })
})
