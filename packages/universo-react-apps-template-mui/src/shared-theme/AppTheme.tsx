import * as React from 'react'
import { ThemeProvider, createTheme, useColorScheme } from '@mui/material/styles'
import type { ThemeOptions } from '@mui/material/styles'
import { inputsCustomizations } from './customizations/inputs'
import { dataDisplayCustomizations } from './customizations/dataDisplay'
import { feedbackCustomizations } from './customizations/feedback'
import { navigationCustomizations } from './customizations/navigation'
import { surfacesCustomizations } from './customizations/surfaces'
import { colorSchemes, typography, shadows, shape } from './themePrimitives'
import type { ThemeMuiInput } from '@universo-react/theme'

/** Resolved theme-preset snapshot ready for MUI consumption (TZ §7). */
export interface AppThemeResolvedTokens {
    /** Canonical SHA-256 of the resolved tokens — the theme memoization key. */
    hash: string
    input: ThemeMuiInput
}

interface AppThemeProps {
    children: React.ReactNode
    /**
     * This is for the docs site. You can ignore it or remove it.
     */
    disableCustomTheme?: boolean
    themeComponents?: ThemeOptions['components']
    defaultMode?: 'light' | 'dark' | 'system'
    /** Theme-preset resolved tokens (the only appearance source). */
    resolvedTokens?: AppThemeResolvedTokens
    /**
     * Layout mode from the appearance contract. Applied through `setMode`
     * because MUI consumes `defaultMode` only in the provider initializer.
     */
    runtimeMode?: 'system' | 'light' | 'dark'
}

/**
 * TZ §7.3: an explicit user choice (persisted `mui-mode`) overrides the
 * layout's default mode, so the synchronizer steps aside when one exists.
 * Post-mount `defaultMode` changes are ignored by MUI's provider, hence the
 * explicit `setMode` sync.
 */
const ThemeModeSynchronizer = ({ mode }: { mode?: 'system' | 'light' | 'dark' }) => {
    const { setMode } = useColorScheme()
    React.useEffect(() => {
        if (!mode) return
        try {
            if (typeof window !== 'undefined' && window.localStorage.getItem('mui-mode')) return
        } catch {
            // Storage unavailable (private mode) — apply the layout mode.
        }
        setMode(mode)
    }, [mode, setMode])
    return null
}

const buildTokenizedColorSchemes = (input: ThemeMuiInput): ThemeOptions['colorSchemes'] => ({
    light: {
        ...colorSchemes.light,
        palette: {
            ...colorSchemes.light.palette,
            ...input.palettePerScheme.light
        }
    },
    dark: {
        ...colorSchemes.dark,
        palette: {
            ...colorSchemes.dark.palette,
            ...input.palettePerScheme.dark
        }
    }
})

const buildTokenizedTypography = (input: ThemeMuiInput): ThemeOptions['typography'] => {
    const headingOverrides: Record<string, { fontSize: string }> = {}
    for (const [level, size] of Object.entries(input.headingFontSizes)) {
        const base = (typography as Record<string, unknown>)[level]
        if (base && typeof base === 'object') {
            headingOverrides[level] = { ...(base as Record<string, unknown>), fontSize: `${size}px` } as { fontSize: string }
        }
    }
    return {
        ...typography,
        fontFamily: input.fontFamily,
        fontSize: input.fontSize,
        // Token font weights become MUI's typography-level defaults
        // (body variants derive from these unless overridden per-variant).
        fontWeightRegular: input.fontWeight.regular,
        fontWeightMedium: input.fontWeight.medium,
        fontWeightBold: input.fontWeight.bold,
        ...headingOverrides
    }
}

const buildTokenizedComponents = (input: ThemeMuiInput): ThemeOptions['components'] => {
    const components: Record<string, unknown> = {
        ...inputsCustomizations,
        ...dataDisplayCustomizations,
        ...feedbackCustomizations,
        ...navigationCustomizations,
        ...surfacesCustomizations
    }
    if (input.shape.borderWidth !== 1) {
        const existing = (components.MuiOutlinedInput ?? {}) as Record<string, unknown>
        const existingStyleOverrides = (existing.styleOverrides ?? {}) as Record<string, unknown>
        const existingNotchedOutline = (existingStyleOverrides.notchedOutline ?? {}) as Record<string, unknown>
        components.MuiOutlinedInput = {
            ...existing,
            styleOverrides: {
                ...existingStyleOverrides,
                notchedOutline: { ...existingNotchedOutline, borderWidth: input.shape.borderWidth }
            }
        } as unknown as ThemeOptions['components']
    }
    return components
}

export default function AppTheme(props: AppThemeProps) {
    const { children, disableCustomTheme, themeComponents, defaultMode, resolvedTokens, runtimeMode } = props
    // The hash is the memoization key (brief goal: rebuild only on hash change).
    // The snapshot is read through a latest-ref so a re-resolved snapshot with
    // the same canonical hash — new object identity, identical content — does
    // not rebuild the MUI theme (an expensive full createTheme pass).
    const resolvedTokensRef = React.useRef(resolvedTokens)
    resolvedTokensRef.current = resolvedTokens
    const tokensHash = resolvedTokens?.hash
    const theme = React.useMemo(() => {
        const currentTokens = resolvedTokensRef.current
        if (disableCustomTheme) return {}
        if (currentTokens) {
            const input = currentTokens.input
            return createTheme({
                cssVariables: {
                    colorSchemeSelector: 'data-mui-color-scheme',
                    cssVarPrefix: 'template'
                },
                colorSchemes: buildTokenizedColorSchemes(input),
                typography: buildTokenizedTypography(input),
                shadows: input.shadows as unknown as ThemeOptions['shadows'],
                shape: { ...shape, borderRadius: input.shape.borderRadius },
                spacing: input.spacingUnit,
                components: {
                    ...buildTokenizedComponents(input),
                    ...themeComponents
                }
            })
        }
        return createTheme({
            cssVariables: {
                colorSchemeSelector: 'data-mui-color-scheme',
                cssVarPrefix: 'template'
            },
            colorSchemes: {
                ...colorSchemes
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
        // Only the canonical hash keys the rebuild; the input itself arrives
        // via the latest-ref above so object identity changes are ignored.
        // eslint-disable-next-line react-hooks/exhaustive-deps -- tokensHash is the memoization key, read through the latest-ref
    }, [disableCustomTheme, themeComponents, tokensHash])
    if (disableCustomTheme) {
        return <React.Fragment>{children}</React.Fragment>
    }
    return (
        <ThemeProvider theme={theme} defaultMode={defaultMode} disableTransitionOnChange>
            <ThemeModeSynchronizer mode={runtimeMode} />
            {children}
        </ThemeProvider>
    )
}
