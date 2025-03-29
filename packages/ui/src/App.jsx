import { useSelector } from 'react-redux'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline, StyledEngineProvider } from '@mui/material'

// routing
import Routes from '@/routes'

// defaultTheme
import themes from '@/themes'

// project imports
import NavigationScroll from '@/layout/NavigationScroll'

// ==============================|| APP ||============================== //

const App = () => {
    const { i18n } = useTranslation()
    const [i18nInitialized, setI18nInitialized] = useState(false)
    const customization = useSelector((state) => state.customization)

    // Check i18n initialization
    useEffect(() => {
        if (i18n.isInitialized) {
            setI18nInitialized(true)
        } else {
            // Listener for initialization event
            const handleInitialized = () => {
                setI18nInitialized(true)
            }
            i18n.on('initialized', handleInitialized)
            
            return () => {
                i18n.off('initialized', handleInitialized)
            }
        }
    }, [i18n])

    if (!i18nInitialized) {
        return <div>Загрузка...</div>
    }

    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={themes(customization)}>
                <CssBaseline />
                <NavigationScroll>
                    <Routes />
                </NavigationScroll>
            </ThemeProvider>
        </StyledEngineProvider>
    )
}

export default App
