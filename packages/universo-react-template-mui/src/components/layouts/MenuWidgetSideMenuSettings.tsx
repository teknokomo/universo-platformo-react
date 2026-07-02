import { useId } from 'react'
import { Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, Switch, Typography } from '@mui/material'
import { type DashboardSideMenuMode, type MenuWidgetConfig } from '@universo-react/types'

import {
    applySideMenuPatch,
    EDITABLE_SIDE_MENU_MODES,
    normalizeSideMenuConfig,
    SIDE_MENU_MODE_LABEL_FALLBACKS
} from './menuWidgetSideMenuConfig'

interface MenuWidgetSideMenuSettingsLabels {
    title: string
    primaryMode: string
    rememberUserChoice: string
    modes: Record<DashboardSideMenuMode, string>
}

export interface MenuWidgetSideMenuSettingsProps {
    sideMenu: MenuWidgetConfig['sideMenu']
    labels: MenuWidgetSideMenuSettingsLabels
    onChange: (sideMenu: NonNullable<MenuWidgetConfig['sideMenu']>) => void
}

export function MenuWidgetSideMenuSettings({ sideMenu, labels, onChange }: MenuWidgetSideMenuSettingsProps) {
    const primaryModeLabelId = `${useId()}-primary-mode`
    const normalizedSideMenu = normalizeSideMenuConfig(sideMenu)

    return (
        <Stack spacing={1}>
            <Typography variant='subtitle2'>{labels.title}</Typography>
            <Stack spacing={0.5}>
                {EDITABLE_SIDE_MENU_MODES.map((mode) => {
                    const checked = normalizedSideMenu.availableModes.includes(mode)
                    const disableLastMode = checked && normalizedSideMenu.availableModes.length === 1
                    return (
                        <FormControlLabel
                            key={mode}
                            control={
                                <Checkbox
                                    checked={checked}
                                    disabled={disableLastMode}
                                    onChange={(_, nextChecked) => {
                                        const availableModes = nextChecked
                                            ? [...normalizedSideMenu.availableModes, mode]
                                            : normalizedSideMenu.availableModes.filter((candidate) => candidate !== mode)
                                        onChange(applySideMenuPatch(normalizedSideMenu, { availableModes }))
                                    }}
                                />
                            }
                            label={labels.modes[mode] ?? SIDE_MENU_MODE_LABEL_FALLBACKS[mode]}
                        />
                    )
                })}
            </Stack>
            <FormControl fullWidth size='small'>
                <InputLabel id={primaryModeLabelId}>{labels.primaryMode}</InputLabel>
                <Select
                    labelId={primaryModeLabelId}
                    value={normalizedSideMenu.primaryMode}
                    label={labels.primaryMode}
                    onChange={(event) =>
                        onChange(
                            applySideMenuPatch(normalizedSideMenu, {
                                primaryMode: event.target.value as DashboardSideMenuMode
                            })
                        )
                    }
                >
                    {normalizedSideMenu.availableModes.map((mode) => (
                        <MenuItem key={mode} value={mode}>
                            {labels.modes[mode] ?? SIDE_MENU_MODE_LABEL_FALLBACKS[mode]}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            <FormControlLabel
                control={
                    <Switch
                        checked={normalizedSideMenu.rememberUserChoice ?? true}
                        onChange={(_, checked) => onChange(applySideMenuPatch(normalizedSideMenu, { rememberUserChoice: checked }))}
                    />
                }
                label={labels.rememberUserChoice}
            />
        </Stack>
    )
}
