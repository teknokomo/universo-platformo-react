import * as React from 'react'
import CssBaseline from '@mui/material/CssBaseline'
import AppTheme from '../shared-theme/AppTheme'
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
}

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
export default function AppMainLayout({ children, disableCustomTheme }: AppMainLayoutProps) {
    return (
        <AppTheme disableCustomTheme={disableCustomTheme} themeComponents={xThemeComponents}>
            <CssBaseline enableColorScheme />
            {children}
        </AppTheme>
    )
}
