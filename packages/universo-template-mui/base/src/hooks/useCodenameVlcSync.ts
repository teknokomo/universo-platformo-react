import { useEffect, useRef } from 'react'
import type { LocalizedContentEntry, VersionedLocalizedContent } from '@universo/types'
import { createLocalizedContent, updateLocalizedContentLocale } from '@universo/utils'

export interface UseCodenameVlcSyncOptions {
    /** Whether VLC mode is enabled for codename */
    localizedEnabled: boolean
    /** Current plain codename value */
    codename: string
    /** Whether codename has been manually touched */
    codenameTouched: boolean
    /** Current VLC codename value */
    codenameVlc: VersionedLocalizedContent<string> | null | undefined
    /** Current name VLC value (to track language switches) */
    nameVlc: VersionedLocalizedContent<string> | null | undefined
    /** Optional transformer from localized name content to codename content */
    deriveCodename?: (nameValue: string) => string
    /** Form setValue function */
    setValue: (field: string, value: unknown) => void
}

/**
 * Hook to synchronize plain codename auto-fill with VLC localized codename field.
 *
 * Handles two scenarios:
 * 1. When codename is auto-filled from name (not touched), sync the value into codenameVlc
 * 2. When the name field's primary locale changes and codename is empty/untouched,
 *    switch the codenameVlc primary locale to match
 */
export function useCodenameVlcSync({
    localizedEnabled,
    codename,
    codenameTouched,
    codenameVlc,
    nameVlc,
    deriveCodename,
    setValue
}: UseCodenameVlcSyncOptions): void {
    const prevCodenameRef = useRef(codename)
    const codenameVlcRef = useRef(codenameVlc)
    const deriveCodenameRef = useRef(deriveCodename)
    codenameVlcRef.current = codenameVlc
    deriveCodenameRef.current = deriveCodename

    const hasSameShape = (a: VersionedLocalizedContent<string> | null | undefined, b: VersionedLocalizedContent<string>): boolean => {
        if (!a) return false
        if (a._primary !== b._primary) return false
        const aLocales = Object.keys(a.locales ?? {}).sort()
        const bLocales = Object.keys(b.locales ?? {}).sort()
        if (aLocales.length !== bLocales.length) return false
        for (let index = 0; index < aLocales.length; index += 1) {
            if (aLocales[index] !== bLocales[index]) return false
        }
        return bLocales.every((locale) => {
            const left = a.locales?.[locale]
            const right = b.locales?.[locale]
            const leftContent = typeof left?.content === 'string' ? left.content : ''
            const rightContent = typeof right?.content === 'string' ? right.content : ''
            return leftContent === rightContent
        })
    }

    // Sync auto-filled codename into VLC / clear VLC when codename is cleared
    useEffect(() => {
        if (!localizedEnabled) return

        const prevCodename = prevCodenameRef.current
        prevCodenameRef.current = codename

        const currentVlc = codenameVlcRef.current
        const locale = currentVlc?._primary || nameVlc?._primary || 'en'

        // Sync auto-filled codename into VLC
        if (!codenameTouched && codename !== prevCodename && codename) {
            if (currentVlc) {
                setValue('codenameVlc', updateLocalizedContentLocale(currentVlc, locale, codename))
            } else {
                setValue('codenameVlc', createLocalizedContent(locale, codename))
            }
        }

        // Clear VLC codename when plain codename is cleared (e.g., name cleared)
        if (!codenameTouched && !codename && prevCodename) {
            if (currentVlc) {
                setValue('codenameVlc', updateLocalizedContentLocale(currentVlc, locale, ''))
            }
        }
    }, [localizedEnabled, codename, codenameTouched, nameVlc, setValue])

    // Mirror localized codename structure/content from localized name while codename is untouched.
    // This guarantees:
    // - language switch in name -> language switch in codename without duplicate empty locale
    // - added locale in name -> added locale in codename
    useEffect(() => {
        if (!localizedEnabled) return
        if (codenameTouched) return

        const currentName = nameVlc
        if (!currentName?.locales) return

        const nameLocales = Object.entries(currentName.locales)
        if (nameLocales.length === 0) return

        const currentVlc = codenameVlcRef.current
        const derive = deriveCodenameRef.current

        const nextLocales = nameLocales.reduce<Record<string, LocalizedContentEntry<string>>>((acc, [locale, localeEntry]) => {
            const sourceContent = typeof localeEntry?.content === 'string' ? localeEntry.content : ''
            const derivedContent = derive ? derive(sourceContent) : sourceContent
            const existing = currentVlc?.locales?.[locale]
            acc[locale] = existing
                ? {
                      ...existing,
                      content: derivedContent
                  }
                : createLocalizedContent(locale, derivedContent).locales[locale]
            return acc
        }, {})

        const preferredPrimary = currentName._primary || Object.keys(nextLocales)[0] || currentVlc?._primary || 'en'
        if (!nextLocales[preferredPrimary]) {
            const primarySeed = createLocalizedContent(preferredPrimary, '').locales[preferredPrimary]
            nextLocales[preferredPrimary] = primarySeed
        }

        const nextVlc: VersionedLocalizedContent<string> = currentVlc
            ? {
                  ...currentVlc,
                  _primary: preferredPrimary,
                  locales: nextLocales
              }
            : {
                  ...createLocalizedContent(preferredPrimary, ''),
                  _primary: preferredPrimary,
                  locales: nextLocales
              }

        if (hasSameShape(currentVlc, nextVlc)) return
        setValue('codenameVlc', nextVlc)
    }, [localizedEnabled, nameVlc, codenameTouched, setValue])
}

export default useCodenameVlcSync
