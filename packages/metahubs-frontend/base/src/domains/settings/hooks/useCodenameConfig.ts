/**
 * Universo Platformo | Codename Configuration Hook
 *
 * Reads all codename-related settings for the current metahub and returns
 * a typed configuration object.
 *
 * Fallback chain: metahub setting → platform default → hardcoded default.
 * When no metahubId is present (e.g. creating a new metahub), platform-level
 * defaults are fetched from `GET /metahubs/codename-defaults` (available to
 * any authenticated user, no admin privileges required).
 */

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useSettingValue } from './useSettings'
import apiClient from '../../shared/apiClient'

type CodenameStyle = 'kebab-case' | 'pascal-case'
type CodenameAlphabet = 'en' | 'ru' | 'en-ru'

export interface CodenameConfig {
    /** 'kebab-case' or 'pascal-case' */
    style: CodenameStyle
    /** 'en', 'ru', or 'en-ru' */
    alphabet: CodenameAlphabet
    /** Whether mixed Latin+Cyrillic is allowed in a single codename (only meaningful for 'en-ru') */
    allowMixed: boolean
    /** Auto-convert mixed alphabet codenames to a single alphabet by first symbol during name-based auto-generation and on manual input blur */
    autoConvertMixedAlphabets: boolean
    /** Auto-convert old-format codenames when editing/copying */
    autoReformat: boolean
    /** Block save until codename is updated to the new format (only when autoReformat is off) */
    requireReformat: boolean
    /** Whether localized (multi-locale) codenames are enabled. When false, codename uses a single locale without language switching. */
    localizedEnabled: boolean
}

/**
 * Returns the i18n key suffix for the codename helper text based on current config.
 * - kebab-case → 'codenameHelper' (default kebab text)
 * - pascal-case + en-only → 'codenameHelperPascalEn'
 * - pascal-case + any other → 'codenameHelperPascal'
 */
export const getCodenameHelperKey = (config: CodenameConfig): string => {
    if (config.style === 'pascal-case') {
        return config.alphabet === 'en' ? 'codenameHelperPascalEn' : 'codenameHelperPascal'
    }
    return 'codenameHelper'
}

// ── Platform-level codename defaults ─────────────────────────────────────

/** Shape returned by GET /metahubs/codename-defaults */
interface CodenameDefaultsResponse {
    success: boolean
    data: {
        style: CodenameStyle
        alphabet: CodenameAlphabet
        allowMixed: boolean
        autoConvertMixedAlphabets: boolean
        localizedEnabled: boolean
    }
}

/**
 * Fetches platform-level codename defaults from `GET /metahubs/codename-defaults`.
 * Accessible to any authenticated user (no admin role required).
 * Only enabled when no metahubId is present (new metahub creation flow).
 */
const usePlatformCodenameDefaults = () => {
    const { metahubId } = useParams<{ metahubId: string }>()

    return useQuery({
        queryKey: ['metahubs', 'codename-defaults'],
        queryFn: async () => {
            const response = await apiClient.get<CodenameDefaultsResponse>('/metahubs/codename-defaults')
            return response.data.data
        },
        enabled: !metahubId,
        staleTime: 10 * 60 * 1000 // 10 minutes — platform defaults change very rarely
    })
}

// ── Main hook ────────────────────────────────────────────────────────────

export const useCodenameConfig = (): CodenameConfig => {
    // Per-metahub settings (available when editing an existing metahub)
    const style = useSettingValue<CodenameStyle>('general.codenameStyle')
    const alphabet = useSettingValue<CodenameAlphabet>('general.codenameAlphabet')
    const allowMixed = useSettingValue<boolean>('general.codenameAllowMixedAlphabets')
    const autoConvertMixedAlphabets = useSettingValue<boolean>('general.codenameAutoConvertMixedAlphabets')
    const autoReformat = useSettingValue<boolean>('general.codenameAutoReformat')
    const requireReformat = useSettingValue<boolean>('general.codenameRequireReformat')
    const localizedEnabled = useSettingValue<boolean>('general.codenameLocalizedEnabled')
    // Platform-level defaults (fetched only when no metahubId in URL)
    const { data: defaults } = usePlatformCodenameDefaults()

    return useMemo<CodenameConfig>(() => {
        return {
            style: style ?? defaults?.style ?? 'pascal-case',
            alphabet: alphabet ?? defaults?.alphabet ?? 'en-ru',
            allowMixed: allowMixed ?? defaults?.allowMixed ?? false,
            autoConvertMixedAlphabets: autoConvertMixedAlphabets ?? defaults?.autoConvertMixedAlphabets ?? true,
            autoReformat: autoReformat ?? true,
            requireReformat: requireReformat ?? true,
            localizedEnabled: localizedEnabled ?? defaults?.localizedEnabled ?? true
        }
    }, [style, alphabet, allowMixed, autoConvertMixedAlphabets, autoReformat, requireReformat, localizedEnabled, defaults])
}
