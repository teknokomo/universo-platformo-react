import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import type { CrudDashboardState } from '../hooks/useCrudDashboard'

export interface RowActionsMenuProps {
    /** State object returned by `useCrudDashboard()`. */
    state: CrudDashboardState
    /** i18n-resolved labels. */
    labels: RowActionsMenuLabels
    /** Permission flags from the runtime API. Missing flags keep backwards-compatible enabled actions. */
    permissions?: {
        canEdit?: boolean
        canCopy?: boolean
        canDelete?: boolean
    }
}

export interface RowActionsMenuLabels {
    editText: string
    copyText: string
    deleteText: string
}

/**
 * Shared row-actions dropdown menu (Edit / Delete).
 *
 * Extracts the duplicated `<Menu>` JSX from both `DashboardApp`
 * and `ApplicationRuntime`.
 */
export function RowActionsMenu({ state, labels, permissions }: RowActionsMenuProps) {
    const canEdit = permissions?.canEdit !== false
    const canCopy = permissions?.canCopy !== false
    const canDelete = permissions?.canDelete !== false

    if (!canEdit && !canCopy && !canDelete) {
        return null
    }

    return (
        <Menu
            open={Boolean(state.menuAnchorEl)}
            anchorEl={state.menuAnchorEl}
            onClose={state.handleCloseMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            {canEdit ? (
                <MenuItem
                    onClick={() => {
                        if (state.menuRowId) state.handleOpenEdit(state.menuRowId)
                        state.handleCloseMenu()
                    }}
                >
                    <EditIcon fontSize='small' sx={{ mr: 1 }} />
                    {labels.editText}
                </MenuItem>
            ) : null}
            {canCopy ? (
                <MenuItem
                    onClick={() => {
                        if (state.menuRowId) state.handleOpenCopy(state.menuRowId)
                        state.handleCloseMenu()
                    }}
                >
                    <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {labels.copyText}
                </MenuItem>
            ) : null}
            {canDelete && (canEdit || canCopy) ? <Divider /> : null}
            {canDelete ? (
                <MenuItem
                    onClick={() => {
                        if (state.menuRowId) state.handleOpenDelete(state.menuRowId)
                        state.handleCloseMenu()
                    }}
                    sx={{ color: 'error.main' }}
                >
                    <DeleteIcon fontSize='small' sx={{ mr: 1 }} />
                    {labels.deleteText}
                </MenuItem>
            ) : null}
        </Menu>
    )
}
