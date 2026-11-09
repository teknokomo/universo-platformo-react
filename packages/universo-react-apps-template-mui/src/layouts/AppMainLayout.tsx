import * as React from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import AppTheme, { type AppThemeResolvedTokens } from '../shared-theme/AppTheme'
import {
    chartsCustomizations,
    dataGridCustomizations,
    datePickersCustomizations,
    treeViewCustomizations
} from '../dashboard/theme/customizations'

const xThemeComponents = {
    ...chartsCustomizations,
    ...dataGridCustomizations,
    ...datePickersCustomizations,
    ...treeViewCustomizations
}

export interface AppMainLayoutProps {
    children: React.ReactNode
    /** Pass true to disable the custom theme (e.g. for Storybook / embedding). */
    disableCustomTheme?: boolean
    /** Optional template-owned color scheme and brand overrides for standalone pages. */
    defaultMode?: 'light' | 'dark' | 'system'
    /** Theme-preset appearance (mode + resolved tokens). */
    mode?: 'system' | 'light' | 'dark'
    resolvedTokens?: AppThemeResolvedTokens
}

export interface AppMainLayoutAppearance {
    defaultMode?: 'light' | 'dark' | 'system'
    mode?: 'system' | 'light' | 'dark'
    resolvedTokens?: AppThemeResolvedTokens
}

interface AppMainLayoutContextValue {
    setAppearance: (appearance: AppMainLayoutAppearance | null) => void
}

/**
 * The host application owns the layout boundary. A renderer can use this
 * context to contribute its persisted appearance without creating a nested
 * ThemeProvider (which would split portals and make theme precedence
 * unpredictable).
 */
export const AppMainLayoutContext = React.createContext<AppMainLayoutContextValue | null>(null)

/**
 * Top-level layout that provides the full application theme context.
 *
 * Every component rendered inside this layout — including MUI Dialog
 * portals — inherits the custom MUI theme (colors, typography,
 * component overrides for inputs, feedback, navigation, data-display,
 * surfaces, data-grid, charts, date-pickers, tree-view).
 *
 * Use this layout as the outermost wrapper when rendering Dashboard
 * together with dialogs (FormDialog, ConfirmDeleteDialog) so that
 * _all_ UI elements share the same visual style.
 */
export default function AppMainLayout({ children, disableCustomTheme, defaultMode, mode, resolvedTokens }: AppMainLayoutProps) {
    const [runtimeAppearance, setRuntimeAppearance] = React.useState<AppMainLayoutAppearance | null>(null)
    const setAppearance = React.useCallback((appearance: AppMainLayoutAppearance | null) => {
        setRuntimeAppearance(appearance)
    }, [])
    const contextValue = React.useMemo<AppMainLayoutContextValue>(() => ({ setAppearance }), [setAppearance])
    const effectiveAppearance = runtimeAppearance ?? { defaultMode, mode, resolvedTokens }
    // The resolved snapshot rides with the appearance object; memoize on the
    // snapshot hash so AppTheme's createTheme memo is not rebuilt per render.
    const effectiveResolvedTokens = React.useMemo(() => effectiveAppearance.resolvedTokens ?? null, [effectiveAppearance.resolvedTokens])

    return (
        <AppMainLayoutContext.Provider value={contextValue}>
            <AppTheme
                disableCustomTheme={disableCustomTheme}
                defaultMode={effectiveAppearance.defaultMode}
                resolvedTokens={effectiveResolvedTokens ?? undefined}
                runtimeMode={effectiveAppearance.mode}
                themeComponents={xThemeComponents}
            >
                <CssBaseline enableColorScheme />
                {children}
            </AppTheme>
        </AppMainLayoutContext.Provider>
    )
}
