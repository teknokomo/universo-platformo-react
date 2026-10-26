import { normalizeRuntimePageBlocks } from '@universo-react/types'
import { resolveLocalizedContent } from '../../shared/runtimeLocalization'
import { getField } from '../interpretationNetwork/runtimeInterpretationNetworkMetadata'
import { MAX_PUBLIC_BODY_TEXT, type PublicInterpretationNetworkReadInput } from './contracts'
import { issueHandle } from './handles'

const UUID_TEXT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

/** Return bounded localized user text while suppressing raw IDs and serialized objects. */
export const safeDisplayText = (value: unknown, locale: string, maxLength: number, fallback = ''): string => {
    const text = resolveLocalizedContent(value, locale, fallback).trim()
    if (!text || UUID_TEXT.test(text)) return fallback
    if (
        (text.startsWith('{') || text.startsWith('[')) &&
        (() => {
            try {
                return typeof JSON.parse(text) === 'object'
            } catch {
                return false
            }
        })()
    ) {
        return fallback
    }
    return text.slice(0, maxLength)
}

/** Select the supported fallback string for the active locale. */
export const localizeFallback = (locale: string, en: string, ru: string): string => (locale === 'ru' ? ru : en)

/** Project a structure row without exposing its storage identity. */
export const publicStructure = (input: PublicInterpretationNetworkReadInput, row: Record<string, unknown>) => {
    const descriptionField = getField(input.surface.contracts.Structure, 'Description')?.column_name
    return {
        handle: issueHandle(input, { kind: 'structure', recordId: String(row.id) }),
        name: safeDisplayText(row.name, input.locale, 255, localizeFallback(input.locale, 'Untitled structure', 'Структура без названия')),
        description: descriptionField ? safeDisplayText(row.description, input.locale, 2000) || null : null
    }
}

/** Flatten allowlisted rich-text blocks into bounded plain text for public DTOs. */
export const projectBodyText = (value: unknown, locale: string): string => {
    const blocks = normalizeRuntimePageBlocks(value)
    const lines: string[] = []
    for (const block of blocks.slice(0, 200)) {
        const textFrom = (candidate: unknown) => safeDisplayText(candidate, locale, 2000)
        switch (block.type) {
            case 'paragraph':
            case 'header':
            case 'quote':
                lines.push(textFrom(block.data.text))
                break
            case 'list':
                lines.push(...block.data.items.slice(0, 50).map(textFrom))
                break
            case 'table':
                lines.push(...block.data.content.slice(0, 50).flatMap((row) => row.slice(0, 20).map(textFrom)))
                break
            case 'image':
                lines.push(textFrom(block.data.caption ?? block.data.alt))
                break
            case 'embed':
                lines.push(textFrom(block.data.caption))
                break
            case 'delimiter':
                break
            default:
                break
        }
        if (lines.join('\n').length >= MAX_PUBLIC_BODY_TEXT) break
    }
    return lines.join('\n').slice(0, MAX_PUBLIC_BODY_TEXT)
}
