import type { VersionedLocalizedContent } from '@universo/types'
import type { ActionContext } from '@universo/template-mui'
import type { MetahubBranch, MetahubBranchDisplay, BranchLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import {
    ensureLocalizedContent,
    ensureEntityCodenameContent,
    extractLocalizedInput,
    hasPrimaryContent,
    normalizeLocale
} from '../../../utils/localizedInput'
import { normalizeBranchCopyOptions } from '@universo/utils'
import type { CodenameConfig } from '../../settings/hooks/useCodenameConfig'

// ---- Shared types ----

export type BranchFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    sourceBranchId?: string | null
    fullCopy?: boolean
    copyLayouts?: boolean
    copyHubs?: boolean
    copyCatalogs?: boolean
    copyEnumerations?: boolean
}

export type GenericFormValues = Record<string, unknown>

export type BranchMenuBaseContext = {
    t: (key: string, options?: unknown) => string
} & Record<string, unknown>

// ---- Response helpers ----

export const extractResponseStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const status = (response as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
}

const extractResponseData = (error: unknown): Record<string, unknown> | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    return data as Record<string, unknown>
}

export const extractResponseMessage = (error: unknown): string | undefined => {
    const data = extractResponseData(error)
    if (!data) return undefined
    const backendError = data.error
    if (typeof backendError === 'string') return backendError
    const message = data.message
    return typeof message === 'string' ? message : undefined
}

// ---- Codename config resolution ----

const DEFAULT_CC: CodenameConfig = {
    style: 'pascal-case',
    alphabet: 'en-ru',
    allowMixed: false,
    autoConvertMixedAlphabets: true,
    autoReformat: true,
    requireReformat: true
}

export const getCodenameConfigFromValues = (values: GenericFormValues): CodenameConfig =>
    (values._codenameConfig as CodenameConfig) || DEFAULT_CC

// ---- Action descriptor helpers ----

export const buildInitialValues = (ctx: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>) => {
    const branchMap = ctx.branchMap as Map<string, MetahubBranch> | undefined
    const raw = branchMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: ensureEntityCodenameContent(raw, uiLocale, raw?.codename ?? ctx.entity?.codename ?? ''),
        codenameTouched: true
    }
}

export const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback?: string
): VersionedLocalizedContent<string> | null => {
    if (!value) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        const nextContent = content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        return {
            _schema: 'v1',
            _primary: locale,
            locales: {
                [locale]: { content: nextContent }
            }
        }
    }

    const nextLocales = { ...(value.locales || {}) } as Record<string, { content?: string }>
    const localeEntries = Object.entries(nextLocales)
    for (const [locale, localeValue] of localeEntries) {
        const normalizedLocale = normalizeLocale(locale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${suffix}` }
        }
    }

    const hasAnyContent = Object.values(nextLocales).some(
        (entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0
    )
    if (!hasAnyContent) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        nextLocales[locale] = {
            content: content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        }
    }

    return {
        ...value,
        locales: nextLocales
    }
}

export const buildCopyInitialValues = (ctx: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ctx.entity?.codename || ''
        ),
        codename: null,
        codenameTouched: false,
        ...normalizeBranchCopyOptions()
    }
}

export const validateBranchForm = (
    ctx: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>,
    values: GenericFormValues
) => {
    const cc = getCodenameConfigFromValues(values)
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    if (!normalizedCodename) {
        errors.codename = ctx.t('metahubs:branches.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)) {
        errors.codename = ctx.t('metahubs:branches.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

export const canSaveBranchForm = (values: GenericFormValues) => {
    const cc = getCodenameConfigFromValues(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const codenamePrimaryLocale = codenameValue?._primary ?? nameVlc?._primary ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const normalizedCodename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    return (
        !values._hasCodenameDuplicate &&
        hasPrimaryContent(nameVlc) &&
        Boolean(normalizedCodename) &&
        isValidCodenameForStyle(normalizedCodename, cc.style, cc.alphabet, cc.allowMixed)
    )
}

export const toPayload = (values: GenericFormValues): BranchLocalizedPayload => {
    const cc = getCodenameConfigFromValues(values)
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const codenamePrimaryLocale = codenameValue?._primary ?? namePrimaryLocale ?? 'en'
    const rawCodename = getVLCString(codenameValue || undefined, codenamePrimaryLocale)
    const codename = normalizeCodenameForStyle(rawCodename, cc.style, cc.alphabet)
    const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? codenamePrimaryLocale, codename)

    return {
        codename: codenamePayload,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale
    }
}
