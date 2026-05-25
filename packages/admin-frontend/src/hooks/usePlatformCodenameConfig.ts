import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as settingsApi from '../api/settingsApi'
import { settingsQueryKeys } from '../api/queryKeys'

type CodenameStyle = 'pascal-case' | 'kebab-case'
type CodenameAlphabet = 'en' | 'ru' | 'en-ru'

export interface PlatformCodenameConfig {
    style: CodenameStyle
    alphabet: CodenameAlphabet
    allowMixed: boolean
    autoConvertMixedAlphabets: boolean
    localizedEnabled: boolean
}

function extractValue(setting: settingsApi.AdminSettingItem): unknown {
    const raw = setting.value as Record<string, unknown>
    return '_value' in raw ? raw._value : raw
}

const isCodenameStyle = (v: unknown): v is CodenameStyle => v === 'pascal-case' || v === 'kebab-case'
const isCodenameAlphabet = (v: unknown): v is CodenameAlphabet => v === 'en' || v === 'ru' || v === 'en-ru'

export function usePlatformCodenameConfig(): PlatformCodenameConfig {
    const { data } = useQuery({
        queryKey: settingsQueryKeys.byCategory('metahubs'),
        queryFn: () => settingsApi.listSettingsByCategory('metahubs'),
        staleTime: 10 * 60 * 1000
    })

    return useMemo<PlatformCodenameConfig>(() => {
        const config: PlatformCodenameConfig = {
            style: 'pascal-case',
            alphabet: 'en-ru',
            allowMixed: false,
            autoConvertMixedAlphabets: true,
            localizedEnabled: true
        }

        if (!data?.items) return config

        for (const setting of data.items) {
            const val = extractValue(setting)
            switch (setting.key) {
                case 'codenameStyle':
                    if (isCodenameStyle(val)) config.style = val
                    break
                case 'codenameAlphabet':
                    if (isCodenameAlphabet(val)) config.alphabet = val
                    break
                case 'codenameAllowMixedAlphabets':
                    if (typeof val === 'boolean') config.allowMixed = val
                    break
                case 'codenameAutoConvertMixedAlphabets':
                    if (typeof val === 'boolean') config.autoConvertMixedAlphabets = val
                    break
                case 'codenameLocalizedEnabled':
                    if (typeof val === 'boolean') config.localizedEnabled = val
                    break
            }
        }

        return config
    }, [data])
}
