// Module load diagnostics
// eslint-disable-next-line no-console
console.info('[app-module] App.jsx module loaded')

import { useSelector } from 'react-redux'
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from '@universo/i18n'
import { useAuth } from '@universo/auth-frt'

import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, StyledEngineProvider } from '@mui/material'

// routing
import Routes from '@flowise/template-mui/routes'

// defaultTheme
import themes from '@flowise/template-mui/themes'

// project imports
import NavigationScroll from '@flowise/template-mui/layout/NavigationScroll'

// ==============================|| APP ||============================== //

const App = () => {
    const { user } = useAuth()
    
    // eslint-disable-next-line no-console
    console.info('[app-init] render start', {
        hasUser: !!user,
        userId: user?.id,
        timestamp: Date.now()
    })
    
    const { i18n } = useTranslation()
    const [i18nInitialized, setI18nInitialized] = useState(false)
    const customization = useSelector((state) => state.customization)

    const themeFactory = useMemo(() => {
        if (typeof themes === 'function') {
            return themes
        }

        if (typeof themes?.default === 'function') {
            // eslint-disable-next-line no-console
            console.warn('[app-theme] using default export fallback')
            return themes.default
        }

        if (typeof themes?.theme === 'function') {
            // eslint-disable-next-line no-console
            console.warn('[app-theme] using named theme export fallback')
            return themes.theme
        }

        throw new Error('Unable to resolve theme factory from @flowise/template-mui/themes')
    }, [])

    const themeInstance = useMemo(() => {
        try {
            const result = themeFactory(customization)
            // eslint-disable-next-line no-console
            console.info('[app-theme]', {
                type: typeof themeFactory,
                resultType: typeof result,
                keys: result ? Object.keys(result) : null
            })
            return result
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error('[app-theme-error]', error)
            throw error
        }
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
                <NavigationScroll>
                    <Routes />
                </NavigationScroll>
            </ThemeProvider>
        </StyledEngineProvider>
    )
}

export default App
