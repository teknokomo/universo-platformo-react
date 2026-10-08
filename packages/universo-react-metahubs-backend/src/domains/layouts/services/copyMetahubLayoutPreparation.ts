import {
    decodeLayoutConfigEnvelope,
    encodeLayoutConfigEnvelope,
    getLayoutZoneSettingDefault,
    marketingPageConfigSchema,
    type ApplicationTemplateKey
} from '@universo-react/types'
import { localizedContent } from '@universo-react/utils'
import { MetahubDomainError } from '../../shared/domainErrors'
import type { CopyMetahubLayoutInput, LayoutCopyOwnership, PreparedLayoutCopy } from './copyMetahubLayoutTypes'

const { sanitizeLocalizedInput, buildLocalizedContent } = localizedContent
const copyOperationDetails = { operation: 'copy-layout' }

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const normalizeLocaleCode = (locale: string): string => locale.split('-')[0].split('_')[0].toLowerCase()

const toLocalizedInputRecord = (value: string | Record<string, string>): Record<string, string | undefined> => {
    if (typeof value === 'string') return { en: value }
    return value
}

const buildDefaultCopyNameInput = (name: unknown): Record<string, string> => {
    const locales = (name as { locales?: Record<string, { content?: string }> } | undefined)?.locales ?? {}
    const entries = Object.entries(locales)
        .map(([locale, value]) => [normalizeLocaleCode(locale), typeof value?.content === 'string' ? value.content.trim() : ''] as const)
        .filter(([, content]) => content.length > 0)

    if (entries.length === 0) return { en: 'Copy (copy)' }

    const result: Record<string, string> = {}
    for (const [locale, content] of entries) {
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        result[locale] = `${content}${suffix}`
    }
    return result
}

const requireLayoutName = (name: Record<string, string | undefined>): void => {
    if (Object.keys(name).length === 0) {
        throw new MetahubDomainError({
            message: 'Name is required',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }
}

const prepareLayoutName = (sourceLayout: Record<string, unknown>, input: CopyMetahubLayoutInput) => {
    const sourceName = isRecord(sourceLayout.name) ? sourceLayout.name : {}
    const requestedName = input.name ? sanitizeLocalizedInput(toLocalizedInputRecord(input.name)) : buildDefaultCopyNameInput(sourceName)
    requireLayoutName(requestedName)

    const sourceNamePrimary = typeof sourceName._primary === 'string' ? sourceName._primary : 'en'
    const name = buildLocalizedContent(requestedName, input.namePrimaryLocale, sourceNamePrimary)
    if (!name) {
        throw new MetahubDomainError({
            message: 'Name is required',
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }

    let description: unknown = sourceLayout.description ?? null
    if (input.description !== undefined) {
        const sanitizedDescription = sanitizeLocalizedInput(toLocalizedInputRecord(input.description))
        description =
            Object.keys(sanitizedDescription).length > 0
                ? buildLocalizedContent(sanitizedDescription, input.descriptionPrimaryLocale, input.namePrimaryLocale ?? sourceNamePrimary)
                : null
    }

    return { name, description, sourceNamePrimary }
}

const decodeSourceLayoutConfig = (sourceLayout: Record<string, unknown>, templateKey: ApplicationTemplateKey) => {
    try {
        return decodeLayoutConfigEnvelope(sourceLayout.config ?? {}, {
            templateKey,
            allowSourceZoneSettings: false
        })
    } catch {
        throw new MetahubDomainError({
            message: 'Layout configuration metadata is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }
}

const validateSourceComposition = (
    composition: ReturnType<typeof decodeLayoutConfigEnvelope>['neutral']['composition'],
    ownership: LayoutCopyOwnership
): void => {
    if (!composition) {
        throw new MetahubDomainError({
            message: 'Layout composition metadata is invalid',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }
    if (
        (ownership.isOverlayLayout && (composition.mode !== 'overlay' || composition.baseLayoutId !== ownership.baseLayoutId)) ||
        (!ownership.isOverlayLayout && composition.mode !== 'independent')
    ) {
        throw new MetahubDomainError({
            message: 'Layout composition metadata does not match its scope',
            statusCode: 409,
            code: 'VALIDATION_ERROR',
            details: copyOperationDetails
        })
    }
}

const prepareRendererConfig = (rendererConfig: Record<string, unknown>, templateKey: ApplicationTemplateKey): Record<string, unknown> => {
    if (templateKey !== 'dashboard') {
        if (!marketingPageConfigSchema.safeParse(rendererConfig).success) {
            throw new MetahubDomainError({
                message: 'Marketing layout configuration is invalid',
                statusCode: 409,
                code: 'VALIDATION_ERROR',
                details: copyOperationDetails
            })
        }
        return rendererConfig
    }

    return rendererConfig
}

const prepareNeutralMetadata = (
    neutral: ReturnType<typeof decodeLayoutConfigEnvelope>['neutral'],
    ownership: LayoutCopyOwnership,
    skipDefaultZoneWidgetSeed: boolean
) => {
    const copiedNeutral = { ...neutral }
    if (ownership.templateKey === 'dashboard' && skipDefaultZoneWidgetSeed) {
        copiedNeutral.skipDefaultZoneWidgetSeed = true
    }
    if (ownership.isOverlayLayout && ownership.baseLayoutId) {
        copiedNeutral.composition = { mode: 'overlay', baseLayoutId: ownership.baseLayoutId }
        return copiedNeutral
    }

    copiedNeutral.composition = { mode: 'independent', baseLayoutId: null }
    if (ownership.templateKey === 'marketing-page') {
        copiedNeutral.zoneSettings = {
            ...(copiedNeutral.zoneSettings ?? {}),
            'marketing-header': {
                ...(copiedNeutral.zoneSettings?.['marketing-header'] ?? {}),
                position:
                    copiedNeutral.zoneSettings?.['marketing-header']?.position ??
                    ((getLayoutZoneSettingDefault(ownership.templateKey, 'marketing-header', 'position') ?? 'fixed') as 'fixed' | 'flow')
            }
        }
    }
    return copiedNeutral
}

export const prepareLayoutCopy = (
    sourceLayout: Record<string, unknown>,
    input: CopyMetahubLayoutInput,
    ownership: LayoutCopyOwnership,
    copyWidgets: boolean
): PreparedLayoutCopy => {
    const { name, description } = prepareLayoutName(sourceLayout, input)
    const sourceEnvelope = decodeSourceLayoutConfig(sourceLayout, ownership.templateKey)
    validateSourceComposition(sourceEnvelope.neutral.composition, ownership)
    const rendererConfig = prepareRendererConfig(sourceEnvelope.rendererConfig, ownership.templateKey)
    const neutral = prepareNeutralMetadata(sourceEnvelope.neutral, ownership, !copyWidgets)
    const config = encodeLayoutConfigEnvelope({ rendererConfig, neutral }, { templateKey: ownership.templateKey })

    return {
        name,
        description,
        config,
        isActive: sourceLayout.is_active !== false,
        sortOrder: typeof sourceLayout.sort_order === 'number' ? sourceLayout.sort_order : 0
    }
}
