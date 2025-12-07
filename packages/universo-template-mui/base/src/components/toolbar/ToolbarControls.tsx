import React, { useState } from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Button, IconButton, Tooltip } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useTheme } from '@mui/material/styles'
import { IconLayoutGrid, IconList, IconSettings } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { SettingsDialog } from '../dialogs/SettingsDialog'
import { useHasGlobalAccess } from '@flowise/store'

export type ViewMode = 'card' | 'list'

export interface ToolbarControlsProps {
    viewToggleEnabled?: boolean
    viewMode?: ViewMode
    onViewModeChange?: (mode: ViewMode) => void
    /** Show settings button (only visible for superadmin/supermoderator) */
    settingsEnabled?: boolean
    primaryAction?: { label: string; onClick: () => void; disabled?: boolean; startIcon?: React.ReactNode }
    cardViewTitle?: string
    listViewTitle?: string
    sx?: SxProps<Theme>
    children?: React.ReactNode
}

/**
 * ToolbarControls renders a standardized set of controls to be placed inside a page header (e.g., ViewHeader children).
 * Search should be handled by ViewHeader search prop, not by this component.
 * Order: (children) | View toggle | Settings button (if superuser) | Primary action
 *
 * Updated with unified borderRadius: 1 (8px) to match new UI template standard
 */
const ToolbarControls: React.FC<ToolbarControlsProps> = ({
    viewToggleEnabled,
    viewMode,
    onViewModeChange,
    settingsEnabled,
    primaryAction,
    cardViewTitle = 'Card View',
    listViewTitle = 'List View',
    sx,
    children
}) => {
    const theme = useTheme()
    const { t } = useTranslation()
    // hasGlobalAccess = user has superadmin/supermoderator role
    const { hasGlobalAccess } = useHasGlobalAccess()
    const [settingsOpen, setSettingsOpen] = useState(false)

    // Only show settings button if enabled AND user is superuser
    const showSettingsButton = settingsEnabled && hasGlobalAccess

    return (
        <>
            <Box sx={{ height: 40, display: 'flex', alignItems: 'center', gap: 1, ...((sx as object) || {}) }}>
                {children}

                {viewToggleEnabled && onViewModeChange && (
                    <ToggleButtonGroup
                        sx={{ borderRadius: 1, maxHeight: 40 }}
                        value={viewMode}
                        color='primary'
                        exclusive
                        onChange={(_, newView) => newView && onViewModeChange(newView)}
                    >
                        <ToggleButton
                            sx={{
                                borderColor: theme.palette.grey[900] + 25,
                                borderRadius: 1
                            }}
                            value='card'
                            title={cardViewTitle}
                        >
                            <IconLayoutGrid />
                        </ToggleButton>
                        <ToggleButton
                            sx={{
                                borderColor: theme.palette.grey[900] + 25,
                                borderRadius: 1
                            }}
                            value='list'
                            title={listViewTitle}
                        >
                            <IconList />
                        </ToggleButton>
                    </ToggleButtonGroup>
                )}

                {showSettingsButton && (
                    <Tooltip title={t('settings:button.tooltip', 'Settings')}>
                        <IconButton
                            onClick={() => setSettingsOpen(true)}
                            sx={{
                                borderRadius: 1,
                                border: `1px solid ${theme.palette.grey[900]}25`,
                                height: 40,
                                width: 40
                            }}
                        >
                            <IconSettings size={20} />
                        </IconButton>
                    </Tooltip>
                )}

                {primaryAction && (
                    <Button
                        variant='contained'
                        onClick={primaryAction.onClick}
                        disabled={primaryAction.disabled}
                        startIcon={primaryAction.startIcon}
                        sx={{ borderRadius: 1, height: 40 }}
                    >
                        {primaryAction.label}
                    </Button>
                )}
            </Box>

            {showSettingsButton && <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        </>
    )
}

export default ToolbarControls
