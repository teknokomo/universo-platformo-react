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
