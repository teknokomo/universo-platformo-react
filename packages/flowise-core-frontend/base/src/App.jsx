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

const normalizeLang = (value) => (value ? String(value).split('-')[0].toLowerCase() : 'en')

const getMetaValue = (i18nInstance, key) => {
    const value = i18nInstance.t(key, { ns: 'meta' })
    return value && value !== key ? value : ''
}

const getAlternateLocales = (i18nInstance, currentLocale) => {
    if (!currentLocale) {
        return []
    }

    if (typeof i18nInstance.getFixedT === 'function') {
        const resources = i18nInstance.options?.resources
        if (resources && typeof resources === 'object') {
            const locales = Object.keys(resources).flatMap((lng) => {
                const fixedT = i18nInstance.getFixedT(lng, 'meta')
                const locale = fixedT ? fixedT('ogLocale') : ''
                return locale ? [locale] : []
            })

            return Array.from(new Set(locales)).filter((locale) => locale !== currentLocale)
        }
    }

    if (currentLocale === 'ru_RU') {
        return ['en_US']
    }

    if (currentLocale === 'en_US') {
        return ['ru_RU']
    }

    return []
}

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

        const setMeta = (selector, content) => {
            if (!content) {
                return
            }

            const element = document.querySelector(selector)
            if (element) {
                element.setAttribute('content', content)
            }
        }

        const updateAlternateLocales = (locales) => {
            const nodes = Array.from(document.querySelectorAll('meta[property="og:locale:alternate"]'))

            if (locales.length === 0) {
                nodes.forEach((node) => node.remove())
                return
            }

            locales.forEach((locale, index) => {
                if (nodes[index]) {
                    nodes[index].setAttribute('content', locale)
                } else {
                    const meta = document.createElement('meta')
                    meta.setAttribute('property', 'og:locale:alternate')
                    meta.setAttribute('content', locale)
                    document.head.appendChild(meta)
                }
            })

            nodes.slice(locales.length).forEach((node) => node.remove())
        }

        const applyMeta = () => {
            const lang = normalizeLang(i18n.resolvedLanguage || i18n.language || 'en')
            const title = getMetaValue(i18n, 'title')
            const locale = getMetaValue(i18n, 'ogLocale')
            const alternateLocales = getAlternateLocales(i18n, locale)

            document.documentElement.setAttribute('lang', lang)

            if (title) {
                document.title = title
            }

            const metaTags = [
                { selector: 'meta[name="title"]', content: title },
                { selector: 'meta[name="description"]', content: getMetaValue(i18n, 'description') },
                { selector: 'meta[name="keywords"]', content: getMetaValue(i18n, 'keywords') },
                { selector: 'meta[property="og:title"]', content: getMetaValue(i18n, 'ogTitle') },
                { selector: 'meta[property="og:description"]', content: getMetaValue(i18n, 'ogDescription') },
                { selector: 'meta[property="og:locale"]', content: locale },
                { selector: 'meta[property="twitter:title"]', content: getMetaValue(i18n, 'twitterTitle') },
                { selector: 'meta[property="twitter:description"]', content: getMetaValue(i18n, 'twitterDescription') }
            ]

            metaTags.forEach(({ selector, content }) => {
                setMeta(selector, content)
            })

            updateAlternateLocales(alternateLocales)
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
