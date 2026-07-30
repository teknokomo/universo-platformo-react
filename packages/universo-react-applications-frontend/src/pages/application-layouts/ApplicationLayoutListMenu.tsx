import { Divider, Menu, MenuItem } from '@mui/material'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded'
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded'
import type { TFunction } from 'i18next'
import type { ApplicationLayout } from '@universo-react/types'

type Translate = TFunction<'applications'>
type CommonTranslate = TFunction

export interface ApplicationLayoutListMenuProps {
    t: Translate
    tc: CommonTranslate
    anchorEl: HTMLElement | null
    layout: ApplicationLayout | null
    onClose: () => void
    onOpen: (layout: ApplicationLayout) => void
    onEdit: (layout: ApplicationLayout) => void
    onCopy: (layout: ApplicationLayout) => void
    onMakeDefault: (layout: ApplicationLayout) => void
    onToggleActive: (layout: ApplicationLayout) => void
    onDelete: (layout: ApplicationLayout) => void
}

export function ApplicationLayoutListMenu({
    t,
    tc,
    anchorEl,
    layout,
    onClose,
    onOpen,
    onEdit,
    onCopy,
    onMakeDefault,
    onToggleActive,
    onDelete
}: ApplicationLayoutListMenuProps) {
    const runAction = (action: (selectedLayout: ApplicationLayout) => void) => {
        if (layout) action(layout)
        onClose()
    }

    return (
        <Menu
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            <MenuItem onClick={() => runAction(onOpen)}>
                <SettingsRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                {t('actions.open', 'Open')}
            </MenuItem>
            <MenuItem onClick={() => runAction(onEdit)}>
                <EditRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                {tc('actions.edit', 'Edit')}
            </MenuItem>
            <MenuItem onClick={() => runAction(onCopy)}>
                <ContentCopyRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                {tc('actions.copy', 'Copy')}
            </MenuItem>
            <Divider />
            <MenuItem disabled={!layout?.isActive || Boolean(layout?.isDefault)} onClick={() => runAction(onMakeDefault)}>
                <StarRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                {t('layouts.makeDefault', 'Make default')}
            </MenuItem>
            <MenuItem onClick={() => runAction(onToggleActive)}>
                {layout?.isActive ? (
                    <ToggleOffRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                ) : (
                    <ToggleOnRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                )}
                {layout?.isActive ? t('layouts.deactivate', 'Deactivate') : t('layouts.activate', 'Activate')}
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => runAction(onDelete)} sx={{ color: 'error.main' }}>
                <DeleteRoundedIcon fontSize='small' style={{ marginRight: 8 }} />
                {tc('actions.delete', 'Delete')}
            </MenuItem>
        </Menu>
    )
}
