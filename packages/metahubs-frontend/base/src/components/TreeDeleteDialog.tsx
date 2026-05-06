import { useMemo, useCallback } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { TreeEntity } from '../types'
import { getVLCString } from '../types'
import { getBlockingTreeDependencies, type BlockingTreeDependency } from '../domains/entities/presets/api/trees'
import { metahubsQueryKeys } from '../domains/shared'

export interface TreeDeleteDialogProps {
    open: boolean
    hub: TreeEntity | null
    metahubId: string
    onClose: () => void
    onConfirm: (hub: TreeEntity) => void
    isDeleting?: boolean
    uiLocale?: string
    kindKey?: string
}

interface BlockingTreeRow extends BlockingTreeDependency {
    displayName: string
    typeLabel: string
    linkUrl: string
}

export const TreeDeleteDialog = ({
    open,
    hub,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en',
    kindKey
}: TreeDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const treeEntityId = hub?.id ?? ''

    const resolveDisplayName = useCallback(
        (entity: BlockingTreeDependency) =>
            getVLCString(entity.name, uiLocale) ||
            getVLCString(entity.name, 'en') ||
            getVLCString(entity.codename, uiLocale) ||
            getVLCString(entity.codename, 'en') ||
            '—',
        [uiLocale]
    )
    const resolveTypeLabel = useCallback(
        (entity: BlockingTreeDependency) => {
            const translated = entity.typeNameKey ? t(entity.typeNameKey, { defaultValue: entity.kind }) : ''
            return (
                (typeof translated === 'string' ? translated : '') ||
                getVLCString(entity.typeName, uiLocale) ||
                getVLCString(entity.typeName, 'en') ||
                entity.kind
            )
        },
        [t, uiLocale]
    )
    const buildEntityListPath = useCallback(
        (entity: BlockingTreeDependency) =>
            entity.kind === (kindKey ?? 'hub')
                ? `/metahub/${metahubId}/entities/${encodeURIComponent(entity.kind)}/instance/${entity.id}/instances`
                : `/metahub/${metahubId}/entities/${encodeURIComponent(entity.kind)}/instances`,
        [kindKey, metahubId]
    )

    const fetchBlockingEntities = useCallback(async () => {
        const data = await getBlockingTreeDependencies(metahubId, treeEntityId)
        const blockingEntities: BlockingTreeRow[] = [...data.blockingRelatedObjects, ...data.blockingChildTreeEntities].map((entity) => ({
            ...entity,
            displayName: resolveDisplayName(entity),
            typeLabel: resolveTypeLabel(entity),
            linkUrl: buildEntityListPath(entity)
        }))
        return { blockingEntities }
    }, [buildEntityListPath, metahubId, resolveDisplayName, resolveTypeLabel, treeEntityId])

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('hubs.deleteDialog.title', 'Delete hub'),
            confirmMessage: t(
                'hubs.deleteDialog.confirmMessage',
                'Are you sure you want to delete this hub? This action cannot be undone.'
            ),
            blockingWarning: t(
                'hubs.deleteDialog.hasBlockingObjects',
                'Cannot delete hub. The following entities require at least one hub and are only linked to this one:'
            ),
            resolutionHint: t(
                'hubs.deleteDialog.resolutionHint',
                'To delete this hub, first re-link child hubs and add another hub to the listed entities, or disable the required hub option.'
            ),
            fetchError: t('hubs.deleteDialog.fetchError', 'Failed to check for blocking entities'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            deleteButton: t('common:actions.delete', 'Delete'),
            deletingButton: t('common:actions.deleting', 'Deleting...')
        }),
        [t]
    )

    const columns: TableColumn<BlockingTreeRow>[] = useMemo(
        () => [
            {
                id: 'index',
                label: '#',
                width: 48,
                align: 'center',
                render: (_row, index) => <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{index + 1}</Typography>
            },
            {
                id: 'group',
                label: t('table.type', 'Type'),
                width: 150,
                render: (row) => <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{row.typeLabel}</Typography>
            },
            {
                id: 'name',
                label: t('table.name', 'Name'),
                render: (row) => <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.displayName}</Typography>
            },
            {
                id: 'codename',
                label: t('table.codename', 'Codename'),
                width: 160,
                align: 'left',
                render: (row) => (
                    <Typography variant='body2' color='text.secondary' fontFamily='monospace' noWrap>
                        {getVLCString(row.codename, uiLocale) || getVLCString(row.codename, 'en') || row.id}
                    </Typography>
                )
            }
        ],
        [t, uiLocale]
    )

    return (
        <BlockingEntitiesDeleteDialog<TreeEntity, BlockingTreeRow>
            open={open}
            entity={hub}
            queryKey={metahubsQueryKeys.blockingTreeDependencies(metahubId, treeEntityId)}
            fetchBlockingEntities={fetchBlockingEntities}
            onClose={onClose}
            onConfirm={onConfirm}
            labels={labels}
            columns={columns}
            getBlockingEntityLink={(row) => row.linkUrl}
            isDeleting={isDeleting}
            tableMaxHeight={240}
        />
    )
}

export default TreeDeleteDialog
