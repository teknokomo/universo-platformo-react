import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import {
    BlockingEntitiesDeleteDialog,
    type BlockingEntitiesDeleteDialogLabels,
    type TableColumn,
    RoleChip
} from '@universo/template-mui'
import type { MetahubBranch, BlockingBranchUser } from '../types'
import { getBlockingUsers } from '../domains/branches'
import { metahubsQueryKeys } from '../domains/shared'

export interface BranchDeleteDialogProps {
    open: boolean
    branch: MetahubBranch | null
    metahubId: string
    onClose: () => void
    onConfirm: (branch: MetahubBranch) => void
    isDeleting?: boolean
}

interface BlockingUserRow extends BlockingBranchUser {
    displayName: string
}

export const BranchDeleteDialog = ({
    open,
    branch,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false
}: BranchDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const branchId = branch?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('branches.deleteDialog.title', 'Delete branch'),
            confirmMessage: t(
                'branches.deleteDialog.confirmMessage',
                'Are you sure you want to delete this branch? This action cannot be undone.'
            ),
            blockingWarning: t(
                'branches.deleteDialog.hasBlockingUsers',
                'This branch cannot be deleted. The following users are using it as their active branch:'
            ),
            resolutionHint: t(
                'branches.deleteDialog.resolutionHint',
                'To delete the branch, ask users to switch to another branch.'
            ),
            fetchError: t('branches.deleteDialog.fetchError', 'Failed to check for blocking users'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            deleteButton: t('common:actions.delete', 'Delete'),
            deletingButton: t('common:actions.deleting', 'Deleting...')
        }),
        [t]
    )

    const columns: TableColumn<BlockingUserRow>[] = useMemo(
        () => [
            {
                id: 'index',
                label: '#',
                width: 48,
                align: 'center',
                render: (_row, index) => <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{index + 1}</Typography>
            },
            {
                id: 'name',
                label: t('table.name', 'Name'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.displayName}</Typography>
                )
            },
            {
                id: 'email',
                label: t('table.email', 'Email'),
                width: 200,
                render: (row) => (
                    <Typography variant='body2' color='text.secondary' noWrap>
                        {row.email ?? '—'}
                    </Typography>
                )
            },
            {
                id: 'role',
                label: t('table.role', 'Role'),
                width: 120,
                align: 'left',
                render: (row) => <RoleChip role={row.role} size='small' />
            }
        ],
        [t]
    )

    const fetchBlockingEntities = async () => {
        const result = await getBlockingUsers(metahubId, branchId)
        const blockingEntities: BlockingUserRow[] = result.blockingUsers.map((user) => ({
            ...user,
            displayName: user.nickname || user.email || user.userId
        }))
        return { blockingEntities }
    }

    return (
        <BlockingEntitiesDeleteDialog<MetahubBranch, BlockingUserRow>
            open={open}
            entity={branch}
            queryKey={metahubsQueryKeys.blockingBranchUsers(metahubId, branchId)}
            fetchBlockingEntities={fetchBlockingEntities}
            onClose={onClose}
            onConfirm={onConfirm}
            labels={labels}
            columns={columns}
            isDeleting={isDeleting}
        />
    )
}

export default BranchDeleteDialog
