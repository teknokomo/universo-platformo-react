import * as React from 'react'
import DarkModeIcon from '@mui/icons-material/DarkModeRounded'
import LightModeIcon from '@mui/icons-material/LightModeRounded'
import Box from '@mui/material/Box'
import IconButton, { IconButtonProps } from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import { useColorScheme } from '@mui/material/styles'
import { useTranslation } from 'react-i18next'

type ColorModeIconDropdownProps = Omit<IconButtonProps, 'component'> & { 'aria-label'?: string }

export default function ColorModeIconDropdown(props: ColorModeIconDropdownProps) {
    const { t } = useTranslation('common')
    const { mode, systemMode, setMode } = useColorScheme()
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null)
    const menuId = React.useId()
    const open = Boolean(anchorEl)
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        props.onClick?.(event)
        setAnchorEl(event.currentTarget)
    }
    const handleClose = () => {
        setAnchorEl(null)
    }
    const handleMode = (targetMode: 'system' | 'light' | 'dark') => () => {
        setMode(targetMode)
        handleClose()
    }
    if (!mode) {
        return (
            <Box
                data-screenshot='toggle-mode'
                sx={(theme) => ({
                    verticalAlign: 'bottom',
                    display: 'inline-flex',
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: (theme.vars || theme).shape.borderRadius,
                    border: '1px solid',
                    borderColor: (theme.vars || theme).palette.divider
                })}
            />
        )
    }
    const resolvedMode = (systemMode || mode) as 'light' | 'dark'
    const icon = {
        light: <LightModeIcon />,
        dark: <DarkModeIcon />
    }[resolvedMode]
    return (
        <React.Fragment>
            <IconButton
                {...props}
                data-screenshot='toggle-mode'
                onClick={handleClick}
                disableRipple
                size='small'
                aria-label={props['aria-label'] ?? t('layouts.widgets.colorModeSwitcher', 'Color mode switcher')}
                aria-controls={open ? menuId : undefined}
                aria-haspopup='menu'
                aria-expanded={open}
            >
                {icon}
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                id={menuId}
                open={open}
                onClose={handleClose}
                onClick={handleClose}
                slotProps={{
                    paper: {
                        variant: 'outlined',
                        elevation: 0,
                        sx: {
                            my: '4px'
                        }
                    }
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem selected={mode === 'system'} onClick={handleMode('system')}>
                    {t('colorModes.system', 'System')}
                </MenuItem>
                <MenuItem selected={mode === 'light'} onClick={handleMode('light')}>
                    {t('colorModes.light', 'Light')}
                </MenuItem>
                <MenuItem selected={mode === 'dark'} onClick={handleMode('dark')}>
                    {t('colorModes.dark', 'Dark')}
                </MenuItem>
            </Menu>
        </React.Fragment>
    )
}
