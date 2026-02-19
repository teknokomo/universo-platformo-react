import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import type { CrudDashboardState } from '../hooks/useCrudDashboard'

export interface RowActionsMenuProps {
    /** State object returned by `useCrudDashboard()`. */
    state: CrudDashboardState
    /** i18n-resolved labels. */
    labels: RowActionsMenuLabels
}

export interface RowActionsMenuLabels {
    editText: string
    deleteText: string
}

/**
 * Shared row-actions dropdown menu (Edit / Delete).
 *
 * Extracts the duplicated `<Menu>` JSX from both `DashboardApp`
 * and `ApplicationRuntime`.
 */
export function RowActionsMenu({ state, labels }: RowActionsMenuProps) {
    return (
        <Menu
            open={Boolean(state.menuAnchorEl)}
            anchorEl={state.menuAnchorEl}
            onClose={state.handleCloseMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
            <MenuItem
                onClick={() => {
                    if (state.menuRowId) state.handleOpenEdit(state.menuRowId)
                    state.handleCloseMenu()
                }}
            >
                <EditIcon fontSize='small' sx={{ mr: 1 }} />
                {labels.editText}
            </MenuItem>
            <Divider />
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
        </Menu>
    )
}
