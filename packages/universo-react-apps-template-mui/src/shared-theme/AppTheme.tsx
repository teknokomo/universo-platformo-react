import * as React from 'react'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import type { ThemeOptions } from '@mui/material/styles'
import { inputsCustomizations } from './customizations/inputs'
import { dataDisplayCustomizations } from './customizations/dataDisplay'
import { feedbackCustomizations } from './customizations/feedback'
import { navigationCustomizations } from './customizations/navigation'
import { surfacesCustomizations } from './customizations/surfaces'
import { colorSchemes, typography, shadows, shape } from './themePrimitives'

interface AppThemeProps {
    children: React.ReactNode
    /**
     * This is for the docs site. You can ignore it or remove it.
     */
    disableCustomTheme?: boolean
    themeComponents?: ThemeOptions['components']
    defaultMode?: 'light' | 'dark' | 'system'
    primaryColor?: string
    accentColor?: string
}

export default function AppTheme(props: AppThemeProps) {
    const { children, disableCustomTheme, themeComponents, defaultMode, primaryColor, accentColor } = props
    const theme = React.useMemo(() => {
        return disableCustomTheme
            ? {}
            : createTheme({
                  // For more details about CSS variables configuration, see https://mui.com/material-ui/customization/css-theme-variables/configuration/
                  cssVariables: {
                      colorSchemeSelector: 'data-mui-color-scheme',
                      cssVarPrefix: 'template'
                  },
                  colorSchemes: {
                      ...colorSchemes,
                      light: {
                          ...colorSchemes.light,
                          palette: {
                              ...colorSchemes.light.palette,
                              ...(primaryColor ? { primary: { ...colorSchemes.light.palette.primary, main: primaryColor } } : {}),
                              ...(accentColor ? { secondary: { main: accentColor } } : {})
                          }
                      },
                      dark: {
                          ...colorSchemes.dark,
                          palette: {
                              ...colorSchemes.dark.palette,
                              ...(primaryColor ? { primary: { ...colorSchemes.dark.palette.primary, main: primaryColor } } : {}),
                              ...(accentColor ? { secondary: { main: accentColor } } : {})
                          }
                      }
                  }, // MUI color-scheme configuration for light and dark mode, see https://mui.com/material-ui/customization/css-theme-variables/configuration/
                  typography,
                  shadows,
                  shape,
                  components: {
                      ...inputsCustomizations,
                      ...dataDisplayCustomizations,
                      ...feedbackCustomizations,
                      ...navigationCustomizations,
                      ...surfacesCustomizations,
                      ...themeComponents
                  }
              })
    }, [accentColor, disableCustomTheme, primaryColor, themeComponents])
    if (disableCustomTheme) {
        return <React.Fragment>{children}</React.Fragment>
    }
    return (
        <ThemeProvider theme={theme} defaultMode={defaultMode} disableTransitionOnChange>
            {children}
        </ThemeProvider>
    )
}
