import type { Request } from 'express'
import { createSafeRequestLogMetadata, sanitizeRequestLogBody, sanitizeRequestLogUrl } from '../utils/logger'

describe('request log sanitization', () => {
    it('redacts credentials from URLs, headers, query, params, and bodies', () => {
        const secret = 'editor-token-secret-value'
        const request = {
            method: 'POST',
            url: `/api/v1/projects/project-1/assets?artifactToken=${secret}&filter=script`,
            originalUrl: `/api/v1/projects/project-1/assets?artifactToken=${secret}&filter=script`,
            body: {
                name: 'private asset name',
                source: 'export default function leakedSource() {}',
                nested: {
                    accessToken: secret
                }
            },
            query: {
                accessToken: secret,
                filter: 'script',
                email: 'private@example.com'
            },
            params: {
                artifactToken: secret,
                projectId: 'project-1',
                displayName: 'Private Person'
            },
            headers: {
                authorization: `Bearer ${secret}`,
                cookie: `session=${secret}`,
                'set-cookie': [`session=${secret}`],
                'x-playcanvas-editor-token': secret,
                'x-csrf-token': secret,
                'x-access-token': secret,
                'x-request-id': 'request-1',
                'content-type': 'application/json',
                'x-unknown-secret': secret
            }
        } as unknown as Request

        const metadata = createSafeRequestLogMetadata(request)
        const serializedMetadata = JSON.stringify(metadata)

        expect(serializedMetadata).not.toContain(secret)
        expect(metadata.url).toContain('filter=script')
        expect(metadata.url).not.toContain('artifactToken=' + secret)
        expect(metadata.headers.authorization).toBe('[REDACTED]')
        expect(metadata.headers.cookie).toBe('[REDACTED]')
        expect(metadata.headers['set-cookie']).toBe('[REDACTED]')
        expect(metadata.headers['x-playcanvas-editor-token']).toBe('[REDACTED]')
        expect(metadata.headers['x-csrf-token']).toBe('[REDACTED]')
        expect(metadata.headers['x-access-token']).toBe('[REDACTED]')
        expect(metadata.headers['x-request-id']).toBe('request-1')
        expect(metadata.headers['content-type']).toBe('application/json')
        expect(metadata.headers['x-unknown-secret']).toBe('[REDACTED]')

        const body = metadata.body as Record<string, unknown>
        expect(body.source).toBe('[REDACTED]')
        expect((body.nested as Record<string, unknown>).accessToken).toBe('[REDACTED]')
        expect((metadata.query as Record<string, unknown>).accessToken).toBe('[REDACTED]')
        expect((metadata.query as Record<string, unknown>).email).toBe('[REDACTED]')
        expect((metadata.params as Record<string, unknown>).artifactToken).toBe('[REDACTED]')
        expect((metadata.params as Record<string, unknown>).displayName).toBe('[REDACTED]')

        const artifactUrl = sanitizeRequestLogUrl(
            `https://example.test/api/v1/metahub/mh-1/packages/pkg/editor-artifact-token/${secret}/index.html`
        )
        expect(artifactUrl).toContain('/editor-artifact-token/[REDACTED]/index.html')
        expect(artifactUrl).not.toContain(secret)
    })

    it('never serializes raw string or binary request bodies and bounds nested metadata', () => {
        const secretSource = 'const source = "must not be logged"'
        const body = {
            source: secretSource,
            file: Buffer.from(secretSource),
            items: [secretSource, { content: secretSource }],
            nested: { level1: { level2: { level3: { level4: { level5: secretSource } } } } }
        }

        const sanitizedBody = sanitizeRequestLogBody(body)
        const serializedBody = JSON.stringify(sanitizedBody)

        expect(serializedBody).not.toContain(secretSource)
        expect((sanitizedBody as Record<string, unknown>).source).toBe('[REDACTED]')
        expect((sanitizedBody as Record<string, unknown>).file).toBe('[REDACTED]')
        expect((sanitizedBody as Record<string, unknown>).items).toEqual(['[REDACTED]', { content: '[REDACTED]' }])
        expect(serializedBody).toContain('[TRUNCATED]')
    })
})
