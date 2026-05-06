import { z } from 'zod'

const UNSAFE_CONTROL_CHAR_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/
const HTML_TAG_RE = /<\/?[a-z][\s\S]*>/i

export const SUPPORTED_PAGE_BLOCK_TYPES = ['paragraph', 'header', 'list', 'quote', 'table', 'image', 'embed', 'delimiter'] as const

export type SupportedPageBlockType = (typeof SUPPORTED_PAGE_BLOCK_TYPES)[number]
export type PageBlockContentValidationOptions = {
    allowedBlockTypes?: unknown
    maxBlocks?: unknown
}

export function normalizePlainBlockText(value: unknown): string {
    if (typeof value !== 'string') {
        throw new Error('Block text must be a string.')
    }

    const normalized = value.replace(/\r\n/g, '\n').trim()
    if (UNSAFE_CONTROL_CHAR_RE.test(normalized)) {
        throw new Error('Block text contains unsupported control characters.')
    }

    if (HTML_TAG_RE.test(normalized)) {
        throw new Error('Block text must not contain HTML markup.')
    }

    if (normalized.length > 10000) {
        throw new Error('Block text exceeds the supported length.')
    }

    return normalized
}

const plainBlockTextSchema = z
    .string()
    .max(10000)
    .refine((value) => !UNSAFE_CONTROL_CHAR_RE.test(value), 'Block text contains unsupported control characters.')
    .refine((value) => !HTML_TAG_RE.test(value), 'Block text must not contain HTML markup.')

const pageBlockLocalizedTextEntrySchema = z
    .object({
        content: plainBlockTextSchema,
        version: z.number().int().positive().optional(),
        isActive: z.boolean().optional(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional()
    })
    .passthrough()

export const pageBlockLocalizedTextSchema = z.union([
    plainBlockTextSchema,
    z
        .object({
            _schema: z.string().optional(),
            _primary: z.string().min(1).max(10).optional(),
            locales: z.record(pageBlockLocalizedTextEntrySchema)
        })
        .passthrough()
])

const pageBlockIdSchema = z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)

const safePageBlockUrlSchema = z
    .string()
    .url()
    .max(2048)
    .refine((value) => {
        try {
            const protocol = new URL(value).protocol
            return protocol === 'http:' || protocol === 'https:'
        } catch {
            return false
        }
    }, 'Only http and https URLs are supported.')

const paragraphBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('paragraph'),
        data: z
            .object({
                text: pageBlockLocalizedTextSchema
            })
            .strict()
    })
    .strict()

const headerBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('header'),
        data: z
            .object({
                text: pageBlockLocalizedTextSchema,
                level: z.number().int().min(1).max(6).optional()
            })
            .strict()
    })
    .strict()

const listBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('list'),
        data: z
            .object({
                style: z.enum(['ordered', 'unordered']).optional(),
                items: z.array(pageBlockLocalizedTextSchema).max(200)
            })
            .strict()
    })
    .strict()

const quoteBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('quote'),
        data: z
            .object({
                text: pageBlockLocalizedTextSchema,
                caption: pageBlockLocalizedTextSchema.optional(),
                alignment: z.enum(['left', 'center']).optional()
            })
            .strict()
    })
    .strict()

const tableBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('table'),
        data: z
            .object({
                withHeadings: z.boolean().optional(),
                content: z.array(z.array(pageBlockLocalizedTextSchema).max(20)).max(200)
            })
            .strict()
    })
    .strict()

const imageBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('image'),
        data: z
            .object({
                url: safePageBlockUrlSchema,
                caption: pageBlockLocalizedTextSchema.optional(),
                alt: pageBlockLocalizedTextSchema.optional()
            })
            .strict()
    })
    .strict()

const embedBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('embed'),
        data: z
            .object({
                url: safePageBlockUrlSchema,
                caption: pageBlockLocalizedTextSchema.optional()
            })
            .strict()
    })
    .strict()

const delimiterBlockSchema = z
    .object({
        id: pageBlockIdSchema.optional(),
        type: z.literal('delimiter'),
        data: z.record(z.never()).optional().default({})
    })
    .strict()

export const runtimePageBlockSchema = z.discriminatedUnion('type', [
    paragraphBlockSchema,
    headerBlockSchema,
    listBlockSchema,
    quoteBlockSchema,
    tableBlockSchema,
    imageBlockSchema,
    embedBlockSchema,
    delimiterBlockSchema
])

export const editorJsBlockContentPayloadSchema = z
    .object({
        time: z.number().int().nonnegative().optional(),
        version: z.string().max(32).optional(),
        blocks: z.array(runtimePageBlockSchema).max(500)
    })
    .strict()

export const pageBlockContentSchema = z
    .object({
        format: z.literal('editorjs').optional().default('editorjs'),
        version: z.string().max(32).optional(),
        blocks: z.array(runtimePageBlockSchema).max(500).optional(),
        data: editorJsBlockContentPayloadSchema.optional()
    })
    .strict()
    .superRefine((value, ctx) => {
        if (!value.blocks && !value.data?.blocks) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['blocks'],
                message: 'Page block content must include a blocks array.'
            })
        }
    })

export type RuntimePageBlock = z.infer<typeof runtimePageBlockSchema>
export type PageBlockContent = z.infer<typeof pageBlockContentSchema>

type UnknownRecord = Record<string, unknown>

const SUPPORTED_PAGE_BLOCK_TYPE_SET = new Set<string>(SUPPORTED_PAGE_BLOCK_TYPES)

const asRecord = (value: unknown): UnknownRecord | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null

const maybeBlockId = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
        return undefined
    }

    return pageBlockIdSchema.safeParse(value).success ? value : undefined
}

const normalizeOptionalText = (value: unknown): string | undefined =>
    typeof value === 'string' && value.trim() ? normalizePlainBlockText(value) : undefined

const normalizeSafeUrl = (value: unknown): string => {
    const parsed = safePageBlockUrlSchema.safeParse(value)
    if (!parsed.success) {
        throw new Error('Block URL must be a valid http or https URL.')
    }

    return parsed.data
}

const adaptParagraphBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data) {
        throw new Error('Paragraph block data is invalid.')
    }

    return {
        id: maybeBlockId(raw.id),
        type: 'paragraph',
        data: {
            text: normalizePlainBlockText(data.text)
        }
    }
}

const adaptHeaderBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data) {
        throw new Error('Header block data is invalid.')
    }

    const level = typeof data.level === 'number' && Number.isInteger(data.level) ? data.level : undefined

    return {
        id: maybeBlockId(raw.id),
        type: 'header',
        data: {
            text: normalizePlainBlockText(data.text),
            ...(level ? { level } : {})
        }
    }
}

const adaptListBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data || !Array.isArray(data.items)) {
        throw new Error('List block data is invalid.')
    }

    const style = data.style === 'ordered' || data.style === 'unordered' ? data.style : undefined
    const items = data.items.map((item) => {
        if (typeof item === 'string') {
            return normalizePlainBlockText(item)
        }

        const itemRecord = asRecord(item)
        if (!itemRecord || typeof itemRecord.content !== 'string') {
            throw new Error('List item data is invalid.')
        }

        if (Array.isArray(itemRecord.items) && itemRecord.items.length > 0) {
            throw new Error('Nested list items are not supported by the current runtime schema.')
        }

        return normalizePlainBlockText(itemRecord.content)
    })

    return {
        id: maybeBlockId(raw.id),
        type: 'list',
        data: {
            ...(style ? { style } : {}),
            items
        }
    }
}

const adaptQuoteBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data) {
        throw new Error('Quote block data is invalid.')
    }

    const caption = normalizeOptionalText(data.caption)
    const alignment = data.alignment === 'center' || data.alignment === 'left' ? data.alignment : undefined

    return {
        id: maybeBlockId(raw.id),
        type: 'quote',
        data: {
            text: normalizePlainBlockText(data.text),
            ...(caption ? { caption } : {}),
            ...(alignment ? { alignment } : {})
        }
    }
}

const adaptTableBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data || !Array.isArray(data.content)) {
        throw new Error('Table block data is invalid.')
    }

    return {
        id: maybeBlockId(raw.id),
        type: 'table',
        data: {
            ...(typeof data.withHeadings === 'boolean' ? { withHeadings: data.withHeadings } : {}),
            content: data.content.map((row) => {
                if (!Array.isArray(row)) {
                    throw new Error('Table row data is invalid.')
                }
                return row.map((cell) => normalizePlainBlockText(cell))
            })
        }
    }
}

const adaptImageBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data) {
        throw new Error('Image block data is invalid.')
    }

    const file = asRecord(data.file)
    const url = data.url ?? file?.url
    const caption = normalizeOptionalText(data.caption)
    const alt = normalizeOptionalText(data.alt)

    return {
        id: maybeBlockId(raw.id),
        type: 'image',
        data: {
            url: normalizeSafeUrl(url),
            ...(caption ? { caption } : {}),
            ...(alt ? { alt } : {})
        }
    }
}

const adaptEmbedBlock = (raw: UnknownRecord): RuntimePageBlock => {
    const data = asRecord(raw.data)
    if (!data) {
        throw new Error('Embed block data is invalid.')
    }

    const url = data.url ?? data.source ?? data.embed
    const caption = normalizeOptionalText(data.caption)

    return {
        id: maybeBlockId(raw.id),
        type: 'embed',
        data: {
            url: normalizeSafeUrl(url),
            ...(caption ? { caption } : {})
        }
    }
}

const adaptDelimiterBlock = (raw: UnknownRecord): RuntimePageBlock => ({
    id: maybeBlockId(raw.id),
    type: 'delimiter',
    data: {}
})

export function adaptEditorJsBlock(raw: unknown): RuntimePageBlock {
    const block = asRecord(raw)
    if (!block || typeof block.type !== 'string') {
        throw new Error('Editor.js block is invalid.')
    }

    switch (block.type) {
        case 'paragraph':
            return adaptParagraphBlock(block)
        case 'header':
            return adaptHeaderBlock(block)
        case 'list':
            return adaptListBlock(block)
        case 'quote':
            return adaptQuoteBlock(block)
        case 'table':
            return adaptTableBlock(block)
        case 'image':
            return adaptImageBlock(block)
        case 'embed':
            return adaptEmbedBlock(block)
        case 'delimiter':
            return adaptDelimiterBlock(block)
        default:
            throw new Error(`Unsupported Editor.js block type: ${block.type}`)
    }
}

export function normalizeEditorJsOutputData(
    value: unknown,
    options?: PageBlockContentValidationOptions
): PageBlockContent {
    const output = asRecord(value)
    if (!output || !Array.isArray(output.blocks)) {
        throw new Error('Editor.js output must include a blocks array.')
    }

    return enforcePageBlockContentConstraints(
        pageBlockContentSchema.parse({
            format: 'editorjs',
            data: {
                ...(typeof output.time === 'number' && Number.isFinite(output.time)
                    ? { time: Math.max(0, Math.trunc(output.time)) }
                    : {}),
                ...(typeof output.version === 'string' ? { version: output.version } : {}),
                blocks: output.blocks.map(adaptEditorJsBlock)
            }
        }),
        options
    )
}

function getPageBlockContentBlocks(value: PageBlockContent): RuntimePageBlock[] {
    return value.blocks ?? value.data?.blocks ?? []
}

function normalizeAllowedBlockTypeSet(allowedBlockTypes: unknown): Set<string> | null {
    if (allowedBlockTypes === undefined || allowedBlockTypes === null) {
        return null
    }

    if (!Array.isArray(allowedBlockTypes)) {
        throw new Error('Page block allowedBlockTypes constraint must be an array.')
    }

    if (!allowedBlockTypes.every((type) => typeof type === 'string')) {
        throw new Error('Page block allowedBlockTypes constraint must contain strings only.')
    }

    const normalized = allowedBlockTypes.map((type) => type.trim()).filter(Boolean)
    if (normalized.length === 0) {
        throw new Error('At least one page block type must be allowed.')
    }

    for (const type of normalized) {
        if (!SUPPORTED_PAGE_BLOCK_TYPE_SET.has(type)) {
            throw new Error(`Allowed page block type is not supported: ${type}`)
        }
    }

    return new Set(normalized)
}

export function enforcePageBlockContentConstraints(
    value: PageBlockContent,
    options?: PageBlockContentValidationOptions
): PageBlockContent {
    const blocks = getPageBlockContentBlocks(value)
    const allowedBlockTypeSet = normalizeAllowedBlockTypeSet(options?.allowedBlockTypes)

    if (Number.isInteger(options?.maxBlocks) && typeof options?.maxBlocks === 'number' && options.maxBlocks >= 0) {
        if (blocks.length > options.maxBlocks) {
            throw new Error(`Page block content exceeds the configured block limit of ${options.maxBlocks}.`)
        }
    } else if (options?.maxBlocks !== undefined && options.maxBlocks !== null) {
        throw new Error('Page block maxBlocks constraint must be a non-negative integer.')
    }

    if (allowedBlockTypeSet) {
        const disallowedBlock = blocks.find((block) => !allowedBlockTypeSet.has(block.type))
        if (disallowedBlock) {
            throw new Error(`Page block type is not allowed for this entity type: ${disallowedBlock.type}`)
        }
    }

    return value
}

export function normalizePageBlockContentForStorage(
    value: unknown,
    options?: PageBlockContentValidationOptions
): PageBlockContent {
    const parsed = pageBlockContentSchema.safeParse(value)
    if (parsed.success) {
        return enforcePageBlockContentConstraints(parsed.data, options)
    }

    const raw = asRecord(value)
    const candidate = raw?.format === 'editorjs' && asRecord(raw.data) ? raw.data : raw
    return normalizeEditorJsOutputData(candidate, options)
}

export function normalizeRuntimePageBlocks(value: unknown): RuntimePageBlock[] {
    const parsed = pageBlockContentSchema.safeParse(value)
    if (!parsed.success) {
        return []
    }

    return parsed.data.blocks ?? parsed.data.data?.blocks ?? []
}
