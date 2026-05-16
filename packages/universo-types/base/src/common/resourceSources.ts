import { z } from 'zod'

const CONTROL_CHAR_RE = new RegExp(String.raw`[\u0000-\u001F\u007F]`)

export const RESOURCE_TYPES = ['page', 'url', 'video', 'audio', 'document', 'scorm', 'xapi', 'embed', 'file'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

export const RESOURCE_LAUNCH_MODES = ['inline', 'newTab', 'download'] as const
export type ResourceLaunchMode = (typeof RESOURCE_LAUNCH_MODES)[number]

export const SAFE_EXTERNAL_URL_PROTOCOLS = ['http:', 'https:'] as const
export type SafeExternalUrlProtocol = (typeof SAFE_EXTERNAL_URL_PROTOCOLS)[number]

export const DEFAULT_ALLOWED_EMBED_HOSTS = ['youtube.com', 'www.youtube.com', 'youtu.be', 'vimeo.com', 'player.vimeo.com'] as const

export const SAFE_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const
export const SAFE_AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/wav'] as const
export const SAFE_DOCUMENT_MIME_TYPES = ['application/pdf'] as const

const allowedProtocols = new Set<string>(SAFE_EXTERNAL_URL_PROTOCOLS)
const safeVideoMimeTypes = new Set<string>(SAFE_VIDEO_MIME_TYPES)
const safeAudioMimeTypes = new Set<string>(SAFE_AUDIO_MIME_TYPES)
const safeDocumentMimeTypes = new Set<string>(SAFE_DOCUMENT_MIME_TYPES)
const deferredPackageResourceTypes = new Set<ResourceType>(['scorm', 'xapi'])

export type SafeExternalUrlOptions = {
    allowedEmbedHosts?: readonly string[] | null
}

const normalizeHostname = (value: string): string => value.trim().replace(/\.$/, '').toLowerCase()

export function parseSafeExternalUrl(input: string): URL {
    const normalized = input.trim()

    if (normalized.length === 0) {
        throw new Error('URL must be non-empty.')
    }

    if (normalized.length > 2048) {
        throw new Error('URL exceeds the supported length.')
    }

    if (CONTROL_CHAR_RE.test(normalized)) {
        throw new Error('URL contains unsupported control characters.')
    }

    let url: URL
    try {
        url = new URL(normalized)
    } catch {
        throw new Error('URL must be absolute.')
    }

    if (!allowedProtocols.has(url.protocol)) {
        throw new Error('Only http and https URLs are supported.')
    }

    if (url.username || url.password) {
        throw new Error('Credentials in URLs are not allowed.')
    }

    if (!url.hostname) {
        throw new Error('URL must include a hostname.')
    }

    return url
}

export function normalizeSafeExternalUrl(input: string): string {
    return parseSafeExternalUrl(input).toString()
}

export function isAllowedEmbedUrl(input: string, options?: SafeExternalUrlOptions): boolean {
    let url: URL
    try {
        url = parseSafeExternalUrl(input)
    } catch {
        return false
    }

    const allowedHosts = new Set((options?.allowedEmbedHosts ?? DEFAULT_ALLOWED_EMBED_HOSTS).map(normalizeHostname))
    const hostname = normalizeHostname(url.hostname)

    return allowedHosts.has(hostname)
}

export const safeExternalUrlSchema = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .refine((value) => {
        try {
            parseSafeExternalUrl(value)
            return true
        } catch {
            return false
        }
    }, 'Only absolute http and https URLs without credentials are supported.')
    .transform(normalizeSafeExternalUrl)

export const safeEmbedUrlSchema = safeExternalUrlSchema.refine(
    (value) => isAllowedEmbedUrl(value),
    'Embed URL host is not allowed by the runtime embed policy.'
)

const codenameSchema = z.string().trim().min(1).max(128)
const storageKeySchema = z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
    .refine((value) => !value.includes('..'), 'Storage keys must not contain path traversal segments.')

const mimeTypeSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*(?:;[a-z0-9 =._+-]+)?$/i)
    .transform((value) => value.toLowerCase())

export const resourceSourceSchema = z
    .object({
        type: z.enum(RESOURCE_TYPES),
        url: safeExternalUrlSchema.optional(),
        pageCodename: codenameSchema.optional(),
        storageKey: storageKeySchema.optional(),
        packageDescriptor: z.record(z.string(), z.unknown()).optional(),
        mimeType: mimeTypeSchema.optional(),
        launchMode: z.enum(RESOURCE_LAUNCH_MODES).default('inline')
    })
    .strict()
    .superRefine((value, ctx) => {
        const hasUrl = typeof value.url === 'string'
        const hasPage = typeof value.pageCodename === 'string'
        const hasStorage = typeof value.storageKey === 'string'
        const hasPackage = Boolean(value.packageDescriptor)
        const sourceCount = [hasUrl, hasPage, hasStorage, hasPackage].filter(Boolean).length

        if (sourceCount !== 1) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Resource source must define exactly one source locator',
                path: ['source']
            })
            return
        }

        if (value.type === 'page' && !hasPage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Page resources must use pageCodename',
                path: ['pageCodename']
            })
        }

        if (value.type === 'url' && !hasUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${value.type} resources must use url`,
                path: ['url']
            })
        }

        if ((value.type === 'video' || value.type === 'audio') && !hasUrl && !hasStorage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${value.type} resources must use url or storageKey`,
                path: ['storageKey']
            })
        }

        if (value.type === 'embed') {
            if (!hasUrl) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Embed resources must use url',
                    path: ['url']
                })
            } else if (!isAllowedEmbedUrl(value.url)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'Embed URL host is not allowed by the runtime embed policy',
                    path: ['url']
                })
            }
        }

        if ((value.type === 'document' || value.type === 'file') && !hasUrl && !hasStorage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${value.type} resources must use url or storageKey`,
                path: ['storageKey']
            })
        }

        if (deferredPackageResourceTypes.has(value.type) && !hasPackage && !hasStorage) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: `${value.type} resources must use packageDescriptor or storageKey`,
                path: ['packageDescriptor']
            })
        }

        if (value.mimeType && !hasStorage) {
            if (value.type === 'video' && !safeVideoMimeTypes.has(value.mimeType)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported video MIME type', path: ['mimeType'] })
            }
            if (value.type === 'audio' && !safeAudioMimeTypes.has(value.mimeType)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported audio MIME type', path: ['mimeType'] })
            }
            if (value.type === 'document' && !safeDocumentMimeTypes.has(value.mimeType)) {
                ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unsupported document MIME type', path: ['mimeType'] })
            }
        }
    })
export type ResourceSource = z.infer<typeof resourceSourceSchema>

export function normalizeResourceSourceForStorage(value: unknown): ResourceSource {
    return resourceSourceSchema.parse(value)
}

export function isDeferredResourceSource(source: ResourceSource): boolean {
    return deferredPackageResourceTypes.has(source.type) || source.type === 'file' || Boolean(source.storageKey)
}
