import { useState, type MouseEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import type { DashboardDetailsSlot, DashboardRowActionTarget } from '../contracts'

interface DashboardRowActions {
    canEditRows: boolean
    canCopyRows: boolean
    canDeleteRows: boolean
    showRowActions: boolean
    rowActionMenu: ReactNode
    openRowActionMenu: (event: MouseEvent<HTMLElement>, target: DashboardRowActionTarget) => void
    renderRowActionButton: (target: DashboardRowActionTarget, displayName?: string) => ReactNode
}

export function useDashboardRowActions(details: DashboardDetailsSlot | undefined): DashboardRowActions {
    const { t } = useTranslation('apps')
    const [rowActionMenuAnchor, setRowActionMenuAnchor] = useState<HTMLElement | null>(null)
    const [rowActionMenuTarget, setRowActionMenuTarget] = useState<DashboardRowActionTarget | null>(null)
    const canEditRows =
        details?.runtimeAccessMode !== 'public' && details?.permissions?.editContent === true && Boolean(details.onOpenRowTarget)
    const canCopyRows =
        details?.runtimeAccessMode !== 'public' && details?.permissions?.createContent === true && Boolean(details.onOpenRowTarget)
    const canDeleteRows =
        details?.runtimeAccessMode !== 'public' && details?.permissions?.deleteContent === true && Boolean(details.onOpenRowTarget)
    const showRowActions = canEditRows || canCopyRows || canDeleteRows

    const closeRowActionMenu = () => {
        setRowActionMenuAnchor(null)
        setRowActionMenuTarget(null)
    }
    const openRowActionMenu = (event: MouseEvent<HTMLElement>, target: DashboardRowActionTarget) => {
        event.preventDefault()
        event.stopPropagation()
        if (details?.onOpenRowMenu) {
            details.onOpenRowMenu(event, target.recordHandle, target)
            return
        }
        setRowActionMenuAnchor(event.currentTarget)
        setRowActionMenuTarget(target)
    }
    const runRowAction = (action: 'edit' | 'copy' | 'delete') => {
        const target = rowActionMenuTarget
        closeRowActionMenu()
        if (!target) return
        if ((action === 'edit' && !canEditRows) || (action === 'copy' && !canCopyRows) || (action === 'delete' && !canDeleteRows)) return
        details?.onOpenRowTarget?.(
            {
                rowId: target.recordHandle,
                objectCollectionCodename: target.entityCodename,
                ...(target.relationScope ? { relationScope: target.relationScope } : {})
            },
            action
        )
    }

    const rowActionMenu = (
        <Menu anchorEl={rowActionMenuAnchor} open={Boolean(rowActionMenuAnchor)} onClose={closeRowActionMenu}>
            {canEditRows ? (
                <MenuItem onClick={() => runRowAction('edit')}>
                    <EditRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('app.edit', 'Edit')}
                </MenuItem>
            ) : null}
            {canCopyRows ? (
                <MenuItem onClick={() => runRowAction('copy')}>
                    <ContentCopyRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('app.copy', 'Copy')}
                </MenuItem>
            ) : null}
            {canDeleteRows ? (
                <MenuItem onClick={() => runRowAction('delete')} sx={{ color: 'error.main' }}>
                    <DeleteOutlineRoundedIcon fontSize='small' sx={{ mr: 1 }} />
                    {t('app.delete', 'Delete')}
                </MenuItem>
            ) : null}
        </Menu>
    )

    const renderRowActionButton = (target: DashboardRowActionTarget, displayName?: string) =>
        showRowActions ? (
            <IconButton
                size='small'
                data-testid={`grid-row-actions-trigger-${target.recordHandle}`}
                aria-label={t('app.rowActionsFor', 'Actions for {{name}}', {
                    name: displayName || t('runtime.table.untitled', 'Untitled row')
                })}
                onClick={(event) => openRowActionMenu(event, target)}
            >
                <MoreVertRoundedIcon fontSize='small' />
            </IconButton>
        ) : null

    return {
        canEditRows,
        canCopyRows,
        canDeleteRows,
        showRowActions,
        rowActionMenu,
        openRowActionMenu,
        renderRowActionButton
    }
}
