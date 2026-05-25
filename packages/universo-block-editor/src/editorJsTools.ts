/// <reference path="./types/editorjs-tools.d.ts" />

import type { PageBlockContent, PageBlockContentValidationOptions, RuntimePageBlock, SupportedPageBlockType } from '@universo/types'
import {
    adaptEditorJsBlock,
    normalizePageBlockContentForStorage,
    normalizeRuntimePageBlocks,
    SUPPORTED_PAGE_BLOCK_TYPES
} from '@universo/types'

type ToolConstructor = unknown

export type EditorJsToolBundle = {
    Header: ToolConstructor
    List: ToolConstructor
    Quote: ToolConstructor
    Table: ToolConstructor
    Embed: ToolConstructor
    Delimiter: ToolConstructor
    ImageTool: ToolConstructor
}

type EditorJsToolConfig = Record<string, unknown>
type UnknownRecord = Record<string, unknown>
type LocalizedTextEntry = {
    content?: unknown
    version?: unknown
    isActive?: unknown
    createdAt?: unknown
    updatedAt?: unknown
    [key: string]: unknown
}
type LocalizedTextValue = {
    _schema?: unknown
    _primary?: unknown
    locales?: unknown
    [key: string]: unknown
}

const SUPPORTED_BLOCK_TYPE_SET = new Set<string>(SUPPORTED_PAGE_BLOCK_TYPES)

function warnUnsupportedBlockTypes(blockTypes: readonly string[]): void {
    if (blockTypes.length === 0) {
        return
    }

    console.warn(
        `[EditorJsBlockEditor] Ignoring unsupported page block type(s): ${blockTypes.join(', ')}. ` +
            'Check the entity blockContent component configuration.'
    )
}

export async function loadEditorJsToolBundle(): Promise<EditorJsToolBundle> {
    const [header, list, quote, table, embed, delimiter, image] = await Promise.all([
        import('@editorjs/header'),
        import('@editorjs/list'),
        import('@editorjs/quote'),
        import('@editorjs/table'),
        import('@editorjs/embed'),
        import('@editorjs/delimiter'),
        import('@editorjs/image')
    ])

    return {
        Header: header.default,
        List: list.default,
        Quote: quote.default,
        Table: table.default,
        Embed: embed.default,
        Delimiter: delimiter.default,
        ImageTool: image.default
    }
}

export function normalizeAllowedBlockTypes(allowedBlockTypes?: readonly string[]): SupportedPageBlockType[] {
    const source = allowedBlockTypes && allowedBlockTypes.length > 0 ? allowedBlockTypes : SUPPORTED_PAGE_BLOCK_TYPES
    const unsupported = source.filter((type) => !SUPPORTED_BLOCK_TYPE_SET.has(type))
    warnUnsupportedBlockTypes(unsupported)

    const normalized = source.filter((type): type is SupportedPageBlockType => SUPPORTED_BLOCK_TYPE_SET.has(type))

    if (normalized.length > 0) {
        return normalized
    }

    console.warn('[EditorJsBlockEditor] No supported page block types were configured. Falling back to paragraph blocks only.')
    return ['paragraph']
}

export function buildEditorJsTools(bundle: EditorJsToolBundle, allowedBlockTypes?: readonly string[]): EditorJsToolConfig {
    const allowed = new Set(normalizeAllowedBlockTypes(allowedBlockTypes))
    const tools: EditorJsToolConfig = {}

    if (allowed.has('header')) {
        tools.header = {
            class: bundle.Header,
            inlineToolbar: false,
            config: {
                levels: [2, 3, 4],
                defaultLevel: 2
            }
        }
    }

    if (allowed.has('list')) {
        tools.list = {
            class: bundle.List,
            inlineToolbar: false,
            config: {
                defaultStyle: 'unordered',
                maxLevel: 1
            }
        }
    }

    if (allowed.has('quote')) {
        tools.quote = {
            class: bundle.Quote,
            inlineToolbar: false,
            config: {
                quotePlaceholder: '',
                captionPlaceholder: ''
            }
        }
    }

    if (allowed.has('table')) {
        tools.table = {
            class: bundle.Table,
            inlineToolbar: false
        }
    }

    if (allowed.has('embed')) {
        tools.embed = {
            class: bundle.Embed,
            inlineToolbar: false
        }
    }

    if (allowed.has('delimiter')) {
        tools.delimiter = bundle.Delimiter
    }

    if (allowed.has('image')) {
        tools.image = {
            class: bundle.ImageTool,
            inlineToolbar: false,
            config: {
                uploader: {
                    uploadByFile: async () => ({
                        success: 0,
                        message: 'File uploads are not supported for this editor.'
                    }),
                    uploadByUrl: async (url: string) => ({
                        success: 1,
                        file: { url }
                    })
                }
            }
        }
    }

    return tools
}

function normalizeContentLocale(locale?: string): string {
    const normalized = (locale ?? 'en').split(/[-_]/)[0].trim().toLowerCase()
    return normalized || 'en'
}

export function normalizeEditorContentLocale(locale?: string): string {
    return normalizeContentLocale(locale)
}

function asRecord(value: unknown): UnknownRecord | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : null
}

function isLocalizedTextValue(value: unknown): value is LocalizedTextValue {
    const record = asRecord(value)
    return Boolean(record?.locales && typeof record.locales === 'object' && !Array.isArray(record.locales))
}

function readLocalizedEntryContent(entry: unknown): string | null {
    const record = asRecord(entry)
    const content = record?.content
    return typeof content === 'string' ? content : null
}

function resolveEditorText(value: unknown, locale?: string): string {
    if (typeof value === 'string') {
        return value
    }

    if (!isLocalizedTextValue(value)) {
        return ''
    }

    const locales = value.locales as Record<string, unknown>
    const requestedLocale = normalizeContentLocale(locale)
    const requestedContent = readLocalizedEntryContent(locales[requestedLocale])

    if (requestedContent !== null) {
        return requestedContent
    }

    const primary = typeof value._primary === 'string' ? value._primary : null
    const primaryContent = primary ? readLocalizedEntryContent(locales[primary]) : null
    if (primaryContent !== null) {
        return primaryContent
    }

    for (const entry of Object.values(locales)) {
        const content = readLocalizedEntryContent(entry)
        if (content !== null) return content
    }

    return ''
}

function createLocalizedEntry(content: string, base?: unknown): LocalizedTextEntry {
    const existing = asRecord(base) ?? {}
    return {
        ...existing,
        content,
        version: typeof existing.version === 'number' && Number.isFinite(existing.version) ? existing.version : 1,
        isActive: typeof existing.isActive === 'boolean' ? existing.isActive : true
    }
}

function normalizeLocalizedTextValue(value: unknown, fallbackLocale?: string): LocalizedTextValue {
    const targetLocale = normalizeContentLocale(fallbackLocale)

    if (isLocalizedTextValue(value)) {
        const previousLocales = asRecord(value.locales) ?? {}
        return {
            ...value,
            _schema: typeof value._schema === 'string' ? value._schema : '1',
            _primary: typeof value._primary === 'string' && value._primary.trim() ? normalizeContentLocale(value._primary) : targetLocale,
            locales: { ...previousLocales }
        }
    }

    const text = typeof value === 'string' ? value : ''
    return {
        _schema: '1',
        _primary: targetLocale,
        locales: {
            [targetLocale]: createLocalizedEntry(text)
        }
    }
}

function collectLocalizedValueLocales(value: unknown, locales: Set<string>) {
    if (!isLocalizedTextValue(value)) {
        return
    }

    const entries = asRecord(value.locales) ?? {}
    for (const locale of Object.keys(entries)) {
        locales.add(normalizeContentLocale(locale))
    }
}

function collectLocalizedValuePrimary(value: unknown): string | null {
    if (!isLocalizedTextValue(value)) {
        return null
    }

    return typeof value._primary === 'string' && value._primary.trim() ? normalizeContentLocale(value._primary) : null
}

function transformLocalizedValueLocales(
    value: unknown,
    fallbackLocale: string,
    transform: (value: LocalizedTextValue) => LocalizedTextValue
): unknown {
    if (!isLocalizedTextValue(value) && typeof value !== 'string') {
        return value
    }

    return transform(normalizeLocalizedTextValue(value, fallbackLocale))
}

function mapBlockLocalizedValues(
    block: RuntimePageBlock,
    fallbackLocale: string,
    transform: (value: LocalizedTextValue) => LocalizedTextValue
): RuntimePageBlock {
    switch (block.type) {
        case 'paragraph':
            return {
                ...block,
                data: { ...block.data, text: transformLocalizedValueLocales(block.data.text, fallbackLocale, transform) }
            } as RuntimePageBlock
        case 'header':
            return {
                ...block,
                data: { ...block.data, text: transformLocalizedValueLocales(block.data.text, fallbackLocale, transform) }
            } as RuntimePageBlock
        case 'list':
            return {
                ...block,
                data: {
                    ...block.data,
                    items: block.data.items.map((item) => transformLocalizedValueLocales(item, fallbackLocale, transform))
                }
            } as RuntimePageBlock
        case 'quote':
            return {
                ...block,
                data: {
                    ...block.data,
                    text: transformLocalizedValueLocales(block.data.text, fallbackLocale, transform),
                    ...(block.data.caption
                        ? { caption: transformLocalizedValueLocales(block.data.caption, fallbackLocale, transform) }
                        : {})
                }
            } as RuntimePageBlock
        case 'table':
            return {
                ...block,
                data: {
                    ...block.data,
                    content: block.data.content.map((row) =>
                        row.map((cell) => transformLocalizedValueLocales(cell, fallbackLocale, transform))
                    )
                }
            } as RuntimePageBlock
        case 'image':
            return {
                ...block,
                data: {
                    ...block.data,
                    ...(block.data.caption
                        ? { caption: transformLocalizedValueLocales(block.data.caption, fallbackLocale, transform) }
                        : {}),
                    ...(block.data.alt ? { alt: transformLocalizedValueLocales(block.data.alt, fallbackLocale, transform) } : {})
                }
            } as RuntimePageBlock
        case 'embed':
            return {
                ...block,
                data: {
                    ...block.data,
                    ...(block.data.caption
                        ? { caption: transformLocalizedValueLocales(block.data.caption, fallbackLocale, transform) }
                        : {})
                }
            } as RuntimePageBlock
        case 'delimiter':
            return block
        default:
            return block
    }
}

function mapContentLocalizedValues(
    content: PageBlockContent,
    fallbackLocale: string,
    transform: (value: LocalizedTextValue) => LocalizedTextValue
): PageBlockContent {
    const normalized = normalizePageBlockContentForStorage(content)
    const blocks = normalizeRuntimePageBlocks(normalized).map((block) => mapBlockLocalizedValues(block, fallbackLocale, transform))

    return normalizePageBlockContentForStorage({
        format: 'editorjs',
        data: {
            ...(normalized.data ?? {}),
            blocks
        }
    })
}

function collectBlockLocalizedLocales(block: RuntimePageBlock, locales: Set<string>) {
    switch (block.type) {
        case 'paragraph':
        case 'header':
            collectLocalizedValueLocales(block.data.text, locales)
            break
        case 'list':
            block.data.items.forEach((item) => collectLocalizedValueLocales(item, locales))
            break
        case 'quote':
            collectLocalizedValueLocales(block.data.text, locales)
            collectLocalizedValueLocales(block.data.caption, locales)
            break
        case 'table':
            block.data.content.forEach((row) => row.forEach((cell) => collectLocalizedValueLocales(cell, locales)))
            break
        case 'image':
            collectLocalizedValueLocales(block.data.caption, locales)
            collectLocalizedValueLocales(block.data.alt, locales)
            break
        case 'embed':
            collectLocalizedValueLocales(block.data.caption, locales)
            break
        case 'delimiter':
            break
        default:
            break
    }
}

function collectBlockLocalizedPrimary(block: RuntimePageBlock): string | null {
    switch (block.type) {
        case 'paragraph':
        case 'header':
            return collectLocalizedValuePrimary(block.data.text)
        case 'list':
            return block.data.items.map(collectLocalizedValuePrimary).find(Boolean) ?? null
        case 'quote':
            return collectLocalizedValuePrimary(block.data.text) ?? collectLocalizedValuePrimary(block.data.caption)
        case 'table':
            for (const row of block.data.content) {
                const primary = row.map(collectLocalizedValuePrimary).find(Boolean)
                if (primary) return primary
            }
            return null
        case 'image':
            return collectLocalizedValuePrimary(block.data.caption) ?? collectLocalizedValuePrimary(block.data.alt)
        case 'embed':
            return collectLocalizedValuePrimary(block.data.caption)
        case 'delimiter':
            return null
        default:
            return null
    }
}

export function collectEditorJsContentLocales(content: PageBlockContent, fallbackLocale?: string): string[] {
    const locales = new Set<string>()
    normalizeRuntimePageBlocks(content).forEach((block) => collectBlockLocalizedLocales(block, locales))

    if (locales.size === 0) {
        locales.add(normalizeContentLocale(fallbackLocale))
    }

    return Array.from(locales)
}

export function resolveEditorJsContentPrimaryLocale(content: PageBlockContent, fallbackLocale?: string): string {
    for (const block of normalizeRuntimePageBlocks(content)) {
        const primary = collectBlockLocalizedPrimary(block)
        if (primary) return primary
    }

    return normalizeContentLocale(fallbackLocale)
}

export function addEditorJsContentLocale(content: PageBlockContent, locale: string, sourceLocale?: string): PageBlockContent {
    const targetLocale = normalizeContentLocale(locale)
    const fallbackLocale = normalizeContentLocale(sourceLocale ?? locale)

    return mapContentLocalizedValues(content, fallbackLocale, (value) => {
        const locales = asRecord(value.locales) ?? {}
        if (locales[targetLocale]) {
            return value
        }

        return {
            ...value,
            locales: {
                ...locales,
                [targetLocale]: createLocalizedEntry('')
            }
        }
    })
}

export function renameEditorJsContentLocale(content: PageBlockContent, fromLocale: string, toLocale: string): PageBlockContent {
    const sourceLocale = normalizeContentLocale(fromLocale)
    const targetLocale = normalizeContentLocale(toLocale)

    if (sourceLocale === targetLocale) {
        return normalizePageBlockContentForStorage(content)
    }

    return mapContentLocalizedValues(content, sourceLocale, (value) => {
        const locales = asRecord(value.locales) ?? {}
        const sourceEntry = locales[sourceLocale] ?? createLocalizedEntry(resolveEditorText(value, sourceLocale))
        const nextLocales = { ...locales, [targetLocale]: sourceEntry }
        delete nextLocales[sourceLocale]

        return {
            ...value,
            _primary: normalizeContentLocale(value._primary as string | undefined) === sourceLocale ? targetLocale : value._primary,
            locales: nextLocales
        }
    })
}

export function removeEditorJsContentLocale(content: PageBlockContent, locale: string): PageBlockContent {
    const targetLocale = normalizeContentLocale(locale)

    return mapContentLocalizedValues(content, targetLocale, (value) => {
        const locales = asRecord(value.locales) ?? {}
        const nextLocales = { ...locales }
        delete nextLocales[targetLocale]
        const remainingLocales = Object.keys(nextLocales)
        const nextPrimary =
            normalizeContentLocale(value._primary as string | undefined) === targetLocale
                ? remainingLocales[0] ?? targetLocale
                : value._primary

        return {
            ...value,
            _primary: nextPrimary,
            locales: nextLocales
        }
    })
}

export function setEditorJsContentPrimaryLocale(content: PageBlockContent, locale: string): PageBlockContent {
    const targetLocale = normalizeContentLocale(locale)

    return mapContentLocalizedValues(content, targetLocale, (value) => ({
        ...value,
        _primary: targetLocale
    }))
}

function mergeLocalizedText(previous: unknown, nextText: unknown, locale?: string): unknown {
    const text = typeof nextText === 'string' ? nextText : resolveEditorText(nextText, locale)
    const targetLocale = normalizeContentLocale(locale)

    if (!isLocalizedTextValue(previous)) {
        if (typeof previous === 'string' && targetLocale !== 'en') {
            return {
                _schema: '1',
                _primary: 'en',
                locales: {
                    en: createLocalizedEntry(previous),
                    [targetLocale]: createLocalizedEntry(text)
                }
            }
        }

        return targetLocale === 'en'
            ? text
            : { _schema: '1', _primary: targetLocale, locales: { [targetLocale]: createLocalizedEntry(text) } }
    }

    const previousLocales = asRecord(previous.locales) ?? {}
    const primaryLocale = typeof previous._primary === 'string' && previous._primary.trim() ? previous._primary : targetLocale

    return {
        ...previous,
        _schema: typeof previous._schema === 'string' ? previous._schema : '1',
        _primary: primaryLocale,
        locales: {
            ...previousLocales,
            [targetLocale]: createLocalizedEntry(text, previousLocales[targetLocale])
        }
    }
}

function toEditorJsBlock(block: RuntimePageBlock, locale?: string): Record<string, unknown> {
    switch (block.type) {
        case 'paragraph':
            return { id: block.id, type: block.type, data: { text: resolveEditorText(block.data.text, locale) } }
        case 'header':
            return {
                id: block.id,
                type: block.type,
                data: { text: resolveEditorText(block.data.text, locale), level: block.data.level ?? 2 }
            }
        case 'list':
            return {
                id: block.id,
                type: block.type,
                data: {
                    style: block.data.style ?? 'unordered',
                    meta: {},
                    items: block.data.items.map((item) => ({
                        content: resolveEditorText(item, locale),
                        meta: {},
                        items: []
                    }))
                }
            }
        case 'quote':
            return {
                id: block.id,
                type: block.type,
                data: {
                    text: resolveEditorText(block.data.text, locale),
                    caption: block.data.caption ? resolveEditorText(block.data.caption, locale) : '',
                    alignment: block.data.alignment ?? 'left'
                }
            }
        case 'table':
            return {
                id: block.id,
                type: block.type,
                data: {
                    withHeadings: block.data.withHeadings ?? false,
                    content: block.data.content.map((row) => row.map((cell) => resolveEditorText(cell, locale)))
                }
            }
        case 'image':
            return {
                id: block.id,
                type: block.type,
                data: {
                    file: { url: block.data.url },
                    caption: block.data.caption ? resolveEditorText(block.data.caption, locale) : ''
                }
            }
        case 'embed':
            return {
                id: block.id,
                type: block.type,
                data: {
                    source: block.data.url,
                    caption: block.data.caption ? resolveEditorText(block.data.caption, locale) : ''
                }
            }
        case 'delimiter':
            return { id: block.id, type: block.type, data: {} }
        default:
            return { type: 'paragraph', data: { text: '' } }
    }
}

function resolvePreviousBlock(
    previousBlocks: RuntimePageBlock[],
    plainBlock: RuntimePageBlock,
    index: number,
    previousById: Map<string, RuntimePageBlock>
): RuntimePageBlock | null {
    const byId = plainBlock.id ? previousById.get(plainBlock.id) : null
    if (byId?.type === plainBlock.type) {
        return byId
    }

    const byIndex = previousBlocks[index]
    return byIndex?.type === plainBlock.type ? byIndex : null
}

function mergeBlockWithLocale(plainBlock: RuntimePageBlock, previousBlock: RuntimePageBlock | null, locale?: string): RuntimePageBlock {
    switch (plainBlock.type) {
        case 'paragraph':
            return {
                ...plainBlock,
                data: {
                    text: mergeLocalizedText(
                        previousBlock?.type === 'paragraph' ? previousBlock.data.text : undefined,
                        plainBlock.data.text,
                        locale
                    )
                }
            } as RuntimePageBlock
        case 'header':
            return {
                ...plainBlock,
                data: {
                    ...plainBlock.data,
                    text: mergeLocalizedText(
                        previousBlock?.type === 'header' ? previousBlock.data.text : undefined,
                        plainBlock.data.text,
                        locale
                    )
                }
            } as RuntimePageBlock
        case 'list':
            return {
                ...plainBlock,
                data: {
                    ...plainBlock.data,
                    items: plainBlock.data.items.map((item, index) =>
                        mergeLocalizedText(previousBlock?.type === 'list' ? previousBlock.data.items[index] : undefined, item, locale)
                    )
                }
            } as RuntimePageBlock
        case 'quote':
            return {
                ...plainBlock,
                data: {
                    ...plainBlock.data,
                    text: mergeLocalizedText(
                        previousBlock?.type === 'quote' ? previousBlock.data.text : undefined,
                        plainBlock.data.text,
                        locale
                    ),
                    ...(plainBlock.data.caption
                        ? {
                              caption: mergeLocalizedText(
                                  previousBlock?.type === 'quote' ? previousBlock.data.caption : undefined,
                                  plainBlock.data.caption,
                                  locale
                              )
                          }
                        : {})
                }
            } as RuntimePageBlock
        case 'table':
            return {
                ...plainBlock,
                data: {
                    ...plainBlock.data,
                    content: plainBlock.data.content.map((row, rowIndex) =>
                        row.map((cell, cellIndex) =>
                            mergeLocalizedText(
                                previousBlock?.type === 'table' ? previousBlock.data.content[rowIndex]?.[cellIndex] : undefined,
                                cell,
                                locale
                            )
                        )
                    )
                }
            } as RuntimePageBlock
        case 'image':
            return {
                ...plainBlock,
                data: {
                    ...plainBlock.data,
                    ...(plainBlock.data.caption
                        ? {
                              caption: mergeLocalizedText(
                                  previousBlock?.type === 'image' ? previousBlock.data.caption : undefined,
                                  plainBlock.data.caption,
                                  locale
                              )
                          }
                        : {}),
                    ...(plainBlock.data.alt
                        ? {
                              alt: mergeLocalizedText(
                                  previousBlock?.type === 'image' ? previousBlock.data.alt : undefined,
                                  plainBlock.data.alt,
                                  locale
                              )
                          }
                        : {})
                }
            } as RuntimePageBlock
        case 'embed':
            return {
                ...plainBlock,
                data: {
                    ...plainBlock.data,
                    ...(plainBlock.data.caption
                        ? {
                              caption: mergeLocalizedText(
                                  previousBlock?.type === 'embed' ? previousBlock.data.caption : undefined,
                                  plainBlock.data.caption,
                                  locale
                              )
                          }
                        : {})
                }
            } as RuntimePageBlock
        case 'delimiter':
            return plainBlock
        default:
            return plainBlock
    }
}

export function toEditorJsOutputData(value: PageBlockContent | null | undefined, locale?: string): Record<string, unknown> {
    const blocks = normalizeRuntimePageBlocks(value)
    const payload = value?.data

    return {
        time: payload?.time ?? Date.now(),
        version: payload?.version ?? value?.version,
        blocks: blocks.map((block) => toEditorJsBlock(block, locale))
    }
}

export function mergeEditorJsOutputDataWithLocale(
    outputData: unknown,
    previousValue: PageBlockContent,
    locale?: string,
    options?: PageBlockContentValidationOptions
): PageBlockContent {
    const output = asRecord(outputData)
    if (!output || !Array.isArray(output.blocks)) {
        throw new Error('Editor.js output must include a blocks array.')
    }

    const previousBlocks = normalizeRuntimePageBlocks(previousValue)
    const previousById = new Map(previousBlocks.flatMap((block) => (block.id ? [[block.id, block] as const] : [])))
    const blocks = output.blocks.map((rawBlock, index) => {
        const plainBlock = adaptEditorJsBlock(rawBlock)
        const previousBlock = resolvePreviousBlock(previousBlocks, plainBlock, index, previousById)
        return mergeBlockWithLocale(plainBlock, previousBlock, locale)
    })

    return normalizePageBlockContentForStorage(
        {
            format: 'editorjs',
            data: {
                ...(typeof output.time === 'number' && Number.isFinite(output.time) ? { time: Math.max(0, Math.trunc(output.time)) } : {}),
                ...(typeof output.version === 'string' ? { version: output.version } : {}),
                blocks
            }
        },
        options
    )
}
