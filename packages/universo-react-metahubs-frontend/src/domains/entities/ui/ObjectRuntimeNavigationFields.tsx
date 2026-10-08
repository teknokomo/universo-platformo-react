import { Checkbox, FormControlLabel, MenuItem, Stack, TextField, Typography } from '@mui/material'
import {
    DEFAULT_OBJECT_RUNTIME_MENU_ICON,
    OBJECT_RUNTIME_MENU_ICON_KEYS,
    isObjectRuntimeMenuIcon,
    type ObjectRuntimeMenuIcon
} from '@universo-react/types'
import type { UiTranslate } from './entityInstanceListHelpers'

type ObjectRuntimeNavigationFieldsProps = {
    visible: boolean
    icon: unknown
    setValue: (name: string, value: unknown) => void
    disabled: boolean
    t: UiTranslate
}

export default function ObjectRuntimeNavigationFields({ visible, icon, setValue, disabled, t }: ObjectRuntimeNavigationFieldsProps) {
    const selectedIcon: ObjectRuntimeMenuIcon = isObjectRuntimeMenuIcon(icon) ? icon : DEFAULT_OBJECT_RUNTIME_MENU_ICON

    return (
        <Stack spacing={2}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={visible}
                        onChange={(event) => setValue('runtimeMenuVisible', event.target.checked)}
                        disabled={disabled}
                    />
                }
                label={t('objects.runtime.navigation.showInMenu', 'Show in application menu')}
            />
            <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                {t('objects.runtime.navigation.description', 'Only Objects enabled here appear in the published application menu.')}
            </Typography>
            <TextField
                select
                fullWidth
                label={t('objects.runtime.navigation.icon', 'Menu icon')}
                value={selectedIcon}
                onChange={(event) => setValue('runtimeMenuIcon', event.target.value)}
                disabled={disabled || !visible}
            >
                {OBJECT_RUNTIME_MENU_ICON_KEYS.map((iconKey) => (
                    <MenuItem key={iconKey} value={iconKey}>
                        {t(`objects.runtime.navigation.icons.${iconKey}`, iconKey)}
                    </MenuItem>
                ))}
            </TextField>
        </Stack>
    )
}
