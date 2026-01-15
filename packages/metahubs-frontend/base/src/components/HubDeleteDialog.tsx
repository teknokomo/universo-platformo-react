import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import {
    BlockingEntitiesDeleteDialog,
    type BlockingEntitiesDeleteDialogLabels,
    type TableColumn
} from '@universo/template-mui'
import type { Hub } from '../types'
import { getVLCString } from '../types'
import { getBlockingCatalogs, type BlockingCatalog } from '../api/hubs'
import { metahubsQueryKeys } from '../api/queryKeys'

export interface HubDeleteDialogProps {
    /** Whether the dialog is open */
    open: boolean
    /** The hub to be deleted */
    hub: Hub | null
    /** Metahub ID for the API call */
    metahubId: string
    /** Callback when dialog is closed */
    onClose: () => void
    /** Callback when delete is confirmed */
    onConfirm: (hub: Hub) => void
    /** Whether delete operation is in progress */
    isDeleting?: boolean
    /** Current UI locale for catalog name display */
    uiLocale?: string
}

/** Internal type for table rows with resolved name */
interface BlockingCatalogRow extends BlockingCatalog {
    displayName: string
}

/**
 * Dialog for confirming hub deletion.
 * Shows blocking catalogs (those with isRequiredHub=true and only this hub)
 * and disables delete button if any exist.
 *
 * This is a thin wrapper around BlockingEntitiesDeleteDialog with Hub-specific configuration.
 */
export const HubDeleteDialog = ({
    open,
    hub,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: HubDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')

    const hubId = hub?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('hubs.deleteDialog.title', 'Удалить хаб'),
            confirmMessage: t(
                'hubs.deleteDialog.confirmMessage',
                'Вы уверены, что хотите удалить этот хаб? Это действие нельзя отменить.'
            ),
            blockingWarning: t(
                'hubs.deleteDialog.hasBlockingCatalogs',
                'Нельзя удалить хаб. Следующие каталоги требуют хотя бы один хаб и привязаны только к этому:'
            ),
            resolutionHint: t(
                'hubs.deleteDialog.resolutionHint',
                'Чтобы удалить этот хаб, сначала добавьте другой хаб к этим каталогам или отключите опцию "Должен быть хаб".'
            ),
            fetchError: t('hubs.deleteDialog.fetchError', 'Failed to check for blocking catalogs'),
            cancelButton: t('common:actions.cancel', 'Отмена'),
            deleteButton: t('common:actions.delete', 'Удалить'),
            deletingButton: t('common:actions.deleting', 'Удаление...')
        }),
        [t]
    )

    const columns: TableColumn<BlockingCatalogRow>[] = useMemo(
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
                label: t('table.name', 'Название'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.displayName}</Typography>
                )
            },
            {
                id: 'codename',
                label: t('hubs.codename', 'Codename'),
                width: 160,
                align: 'left',
                render: (row) => (
                    <Typography variant='body2' color='text.secondary' fontFamily='monospace' noWrap>
                        {row.codename}
                    </Typography>
                )
            }
        ],
        [t]
    )

    const fetchBlockingEntities = async () => {
        const result = await getBlockingCatalogs(metahubId, hubId)
        // Transform to include displayName
        const blockingEntities: BlockingCatalogRow[] = result.blockingCatalogs.map((c) => ({
            ...c,
            displayName: getVLCString(c.name, uiLocale) || getVLCString(c.name, 'en') || c.codename || '—'
        }))
        return { blockingEntities }
    }

    const getBlockingEntityLink = (catalog: BlockingCatalogRow) => `/metahub/${metahubId}/catalog/${catalog.id}/attributes`

    return (
        <BlockingEntitiesDeleteDialog<Hub, BlockingCatalogRow>
            open={open}
            entity={hub}
            queryKey={metahubsQueryKeys.blockingCatalogs(metahubId, hubId)}
            fetchBlockingEntities={fetchBlockingEntities}
            onClose={onClose}
            onConfirm={onConfirm}
            labels={labels}
            columns={columns}
            getBlockingEntityLink={getBlockingEntityLink}
            isDeleting={isDeleting}
        />
    )
}

export default HubDeleteDialog
