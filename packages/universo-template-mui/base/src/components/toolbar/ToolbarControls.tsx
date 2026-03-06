import React, { useState } from 'react'
import { Box, ToggleButton, ToggleButtonGroup, Button, IconButton, Tooltip, ButtonGroup, Menu, MenuItem, ListItemIcon } from '@mui/material'
import type { SxProps, Theme } from '@mui/material/styles'
import { useTheme } from '@mui/material/styles'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { IconLayoutGrid, IconList, IconSettings } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { SettingsDialog } from '../dialogs/SettingsDialog'
import { useHasGlobalAccess } from '@universo/store'

export type ViewMode = 'card' | 'list'

export interface ToolbarControlsProps {
    viewToggleEnabled?: boolean
    viewMode?: ViewMode
    onViewModeChange?: (mode: ViewMode) => void
    /** Show settings button (only visible for superuser) */
    settingsEnabled?: boolean
    primaryAction?: { label: string; onClick: () => void; disabled?: boolean; startIcon?: React.ReactNode }
    primaryActionMenuItems?: Array<{ label: string; onClick: () => void; disabled?: boolean; startIcon?: React.ReactNode }>
    primaryActionMenuAriaLabel?: string
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
    primaryActionMenuItems,
    primaryActionMenuAriaLabel = 'action menu',
    cardViewTitle = 'Card View',
    listViewTitle = 'List View',
    sx,
    children
}) => {
    const theme = useTheme()
    const { t } = useTranslation()
    // isSuperuser = user has is_superuser=true role (full bypass)
    // hasAnyGlobalRole = user has any global role (metaeditor, etc.)
    const { isSuperuser, hasAnyGlobalRole } = useHasGlobalAccess()
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [primaryActionMenuAnchor, setPrimaryActionMenuAnchor] = useState<null | HTMLElement>(null)

    // Show settings button if enabled AND (user is superuser OR has any global role)
    const showSettingsButton = settingsEnabled && (isSuperuser || hasAnyGlobalRole)
    const hasPrimaryActionMenuItems = Array.isArray(primaryActionMenuItems) && primaryActionMenuItems.length > 0
    const isPrimaryActionMenuOpen = Boolean(primaryActionMenuAnchor)
    const handleOpenPrimaryActionMenu = (event: React.MouseEvent<HTMLElement>) => {
        setPrimaryActionMenuAnchor(event.currentTarget)
    }
    const handleClosePrimaryActionMenu = () => {
        setPrimaryActionMenuAnchor(null)
    }
    const handlePrimaryActionMenuItemClick = (onClick: () => void) => {
        handleClosePrimaryActionMenu()
        onClick()
    }

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

                {primaryAction &&
                    (hasPrimaryActionMenuItems ? (
                        <>
                            <ButtonGroup
                                variant='contained'
                                sx={{
                                    borderRadius: 1,
                                    height: 40,
                                    overflow: 'hidden',
                                    '& .MuiButton-root': {
                                        height: '100%',
                                        minHeight: 40,
                                        '&:focus-visible': {
                                            outline: 'none'
                                        }
                                    },
                                    '& .MuiButtonGroup-grouped': {
                                        borderColor: 'transparent'
                                    }
                                }}
                            >
                                <Button
                                    onClick={primaryAction.onClick}
                                    disabled={primaryAction.disabled}
                                    startIcon={primaryAction.startIcon}
                                    sx={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
                                >
                                    {primaryAction.label}
                                </Button>
                                <Button
                                    aria-label={primaryActionMenuAriaLabel}
                                    aria-controls={isPrimaryActionMenuOpen ? 'toolbar-primary-action-menu' : undefined}
                                    aria-haspopup='menu'
                                    aria-expanded={isPrimaryActionMenuOpen ? 'true' : undefined}
                                    onClick={handleOpenPrimaryActionMenu}
                                    disabled={primaryAction.disabled}
                                    sx={{
                                        minWidth: 40,
                                        px: 0.5,
                                        borderTopLeftRadius: 0,
                                        borderBottomLeftRadius: 0
                                    }}
                                >
                                    <ArrowDropDownIcon fontSize='small' />
                                </Button>
                            </ButtonGroup>
                            <Menu
                                id='toolbar-primary-action-menu'
                                anchorEl={primaryActionMenuAnchor}
                                open={isPrimaryActionMenuOpen}
                                onClose={handleClosePrimaryActionMenu}
                            >
                                {primaryActionMenuItems.map((item) => (
                                    <MenuItem
                                        key={item.label}
                                        disabled={item.disabled}
                                        onClick={() => handlePrimaryActionMenuItemClick(item.onClick)}
                                    >
                                        {item.startIcon ? <ListItemIcon sx={{ minWidth: 28 }}>{item.startIcon}</ListItemIcon> : null}
                                        {item.label}
                                    </MenuItem>
                                ))}
                            </Menu>
                        </>
                    ) : (
                        <Button
                            variant='contained'
                            onClick={primaryAction.onClick}
                            disabled={primaryAction.disabled}
                            startIcon={primaryAction.startIcon}
                            sx={{ borderRadius: 1, height: 40 }}
                        >
                            {primaryAction.label}
                        </Button>
                    ))}
            </Box>

            {showSettingsButton && <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />}
        </>
    )
}

export default ToolbarControls
