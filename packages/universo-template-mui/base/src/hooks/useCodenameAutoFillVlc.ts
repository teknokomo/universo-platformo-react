import { useEffect, useRef } from 'react'
import type { LocalizedContentEntry, VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent } from '@universo/utils'

export interface UseCodenameAutoFillVlcOptions {
    codename: VersionedLocalizedContent<string> | null | undefined
    codenameTouched: boolean
    nameVlc: VersionedLocalizedContent<string> | null | undefined
    deriveCodename?: (nameValue: string) => string
    setValue: (field: 'codename' | 'codenameTouched', value: VersionedLocalizedContent<string> | null | boolean) => void
}

const hasSameContent = (
    left: VersionedLocalizedContent<string> | null | undefined,
    right: VersionedLocalizedContent<string> | null
): boolean => {
    if (!left && !right) return true
    if (!left || !right) return false
    if (left._primary !== right._primary) return false

    const leftLocales = Object.keys(left.locales ?? {}).sort()
    const rightLocales = Object.keys(right.locales ?? {}).sort()
    if (leftLocales.length !== rightLocales.length) return false

    for (let index = 0; index < leftLocales.length; index += 1) {
        const locale = leftLocales[index]
        if (locale !== rightLocales[index]) return false

        const leftContent = typeof left.locales?.[locale]?.content === 'string' ? left.locales[locale]?.content : ''
        const rightContent = typeof right.locales?.[locale]?.content === 'string' ? right.locales[locale]?.content : ''
        if (leftContent !== rightContent) return false
    }

    return true
}

export function useCodenameAutoFillVlc({
    codename,
    codenameTouched,
    nameVlc,
    deriveCodename,
    setValue
}: UseCodenameAutoFillVlcOptions): void {
    const isFirstRender = useRef(true)

    useEffect(() => {
        const nameLocales = Object.entries(nameVlc?.locales ?? {})
        const hasNameContent = nameLocales.some(([, entry]) => typeof entry?.content === 'string' && entry.content.trim().length > 0)

        if (codenameTouched && !hasNameContent) {
            setValue('codenameTouched', false)
            if (codename) {
                setValue('codename', null)
            }
            return
        }

        if (codenameTouched) {
            return
        }

        if (nameLocales.length === 0 || !hasNameContent) {
            if (!isFirstRender.current && codename) {
                setValue('codename', null)
            }
            isFirstRender.current = false
            return
        }

        const nextLocales = nameLocales.reduce<Record<string, LocalizedContentEntry<string>>>((acc, [locale, entry]) => {
            const rawContent = typeof entry?.content === 'string' ? entry.content : ''
            const derivedContent = deriveCodename ? deriveCodename(rawContent) : rawContent
            acc[locale] = {
                ...entry,
                content: derivedContent
            }
            return acc
        }, {})

        const preferredPrimary = nameVlc?._primary || Object.keys(nextLocales)[0] || codename?._primary || 'en'
        if (!nextLocales[preferredPrimary]) {
            nextLocales[preferredPrimary] = createLocalizedContent(preferredPrimary, '').locales[preferredPrimary]
        }

        const nextCodename: VersionedLocalizedContent<string> = codename
            ? {
                  ...codename,
                  _primary: preferredPrimary,
                  locales: nextLocales
              }
            : {
                  ...createLocalizedContent(preferredPrimary, ''),
                  _primary: preferredPrimary,
                  locales: nextLocales
              }

        const shouldSkipInitialSync = isFirstRender.current && hasSameContent(codename, nextCodename)
        isFirstRender.current = false
        if (shouldSkipInitialSync || hasSameContent(codename, nextCodename)) {
            return
        }

        setValue('codename', nextCodename)
    }, [codename, codenameTouched, deriveCodename, nameVlc, setValue])
}

export default useCodenameAutoFillVlc