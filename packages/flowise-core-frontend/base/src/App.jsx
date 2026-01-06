import { useSelector } from 'react-redux'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@universo/i18n'

import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, StyledEngineProvider } from '@mui/material'

// routing
import Routes from '@flowise/template-mui/routes'

// defaultTheme
import themes from '@flowise/template-mui/themes'

// project imports
import NavigationScroll from '@flowise/template-mui/layout/NavigationScroll'

// CASL Ability context
import { AbilityContextProvider, useAbility } from '@flowise/store'

// ==============================|| CASL DEBUG COMPONENT ||============================== //
// TODO: Remove this after testing CASL integration
const CaslDebugger = () => {
    const { ability, loading, error } = useAbility()

    useEffect(() => {
        if (loading) {
            console.log('[CASL Debug] Loading permissions...')
        } else if (error) {
            console.error('[CASL Debug] Error loading permissions:', error)
        } else if (ability) {
            console.log('[CASL Debug] Ability loaded:', {
                rulesCount: ability.rules?.length || 0,
                rules: ability.rules,
                canCreateMetaverse: ability.can('create', 'Metaverse'),
                canManageAll: ability.can('manage', 'all')
            })
        }
    }, [ability, loading, error])

    return null // This component only logs, doesn't render anything
}

// ==============================|| APP ||============================== //

const App = () => {
    const { i18n } = useTranslation()
    const [i18nInitialized, setI18nInitialized] = useState(false)
    const customization = useSelector((state) => state.customization)

    const themeFactory = useMemo(() => {
        if (typeof themes === 'function') {
            return themes
        }

        if (typeof themes?.default === 'function') {
            return themes.default
        }

        if (typeof themes?.theme === 'function') {
            return themes.theme
        }

        throw new Error('Unable to resolve theme factory from @flowise/template-mui/themes')
    }, [])

    const themeInstance = useMemo(() => {
        return themeFactory(customization)
    }, [customization, themeFactory])

    // Check i18n initialization (must not change number/order of hooks)
    useEffect(() => {
        if (i18n.isInitialized) {
            setI18nInitialized(true)
        } else {
            const handleInitialized = () => setI18nInitialized(true)
            i18n.on('initialized', handleInitialized)
            return () => i18n.off('initialized', handleInitialized)
        }
    }, [i18n])

    useEffect(() => {
        if (!i18nInitialized || typeof document === 'undefined') {
            return
        }

        const normalizeLang = (value) => (value ? String(value).split('-')[0].toLowerCase() : 'en')

        const getMeta = (key) => {
            const value = i18n.t(key, { ns: 'meta' })
            return value && value !== key ? value : ''
        }

        const setMeta = (selector, content) => {
            if (!content) {
                return
            }

            const element = document.querySelector(selector)
            if (element) {
                element.setAttribute('content', content)
            }
        }

        const applyMeta = () => {
            const lang = normalizeLang(i18n.resolvedLanguage || i18n.language || 'en')
            const locale = getMeta('ogLocale')
            const alternateLocale = locale === 'ru_RU' ? 'en_US' : 'ru_RU'

            document.documentElement.setAttribute('lang', lang)

            const title = getMeta('title')
            if (title) {
                document.title = title
            }

            setMeta('meta[name="title"]', title)
            setMeta('meta[name="description"]', getMeta('description'))
            setMeta('meta[name="keywords"]', getMeta('keywords'))
            setMeta('meta[property="og:title"]', getMeta('ogTitle'))
            setMeta('meta[property="og:description"]', getMeta('ogDescription'))
            setMeta('meta[property="og:locale"]', locale)
            setMeta('meta[property="og:locale:alternate"]', alternateLocale)
            setMeta('meta[property="twitter:title"]', getMeta('twitterTitle'))
            setMeta('meta[property="twitter:description"]', getMeta('twitterDescription'))
        }

        applyMeta()
        i18n.on('languageChanged', applyMeta)

        return () => {
            i18n.off('languageChanged', applyMeta)
        }
    }, [i18n, i18nInitialized])

    if (!i18nInitialized) {
        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={themeInstance}>
                <CssBaseline />
                <div>Загрузка...</div>
            </ThemeProvider>
        </StyledEngineProvider>
    }

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={themeInstance}>
                <CssBaseline />
                <AbilityContextProvider>
                    <CaslDebugger />
                    <NavigationScroll>
                        <Routes />
                    </NavigationScroll>
                </AbilityContextProvider>
            </ThemeProvider>
        </StyledEngineProvider>
    )
}

export default App
