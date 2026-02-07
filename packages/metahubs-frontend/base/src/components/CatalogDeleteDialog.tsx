import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { Catalog } from '../types'
import { getVLCString } from '../types'
import { getBlockingCatalogReferences, type BlockingCatalogReference } from '../domains/catalogs'
import { metahubsQueryKeys } from '../domains/shared'

export interface CatalogDeleteDialogProps {
    open: boolean
    catalog: Catalog | null
    metahubId: string
    onClose: () => void
    onConfirm: (catalog: Catalog) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingCatalogReference {
    sourceCatalogDisplayName: string
    attributeDisplayName: string
}

export const CatalogDeleteDialog = ({
    open,
    catalog,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: CatalogDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const catalogId = catalog?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('catalogs.deleteDialog.title', 'Delete Catalog'),
            confirmMessage: t(
                'catalogs.deleteDialog.confirmMessage',
                'Are you sure you want to delete this catalog? This action cannot be undone.'
            ),
            blockingWarning: t(
                'catalogs.deleteDialog.hasBlockingReferences',
                'Cannot delete catalog. The following references from other catalogs must be removed first:'
            ),
            resolutionHint: t(
                'catalogs.deleteDialog.resolutionHint',
                'Open the source catalogs from the table and remove or reconfigure reference attributes.'
            ),
            fetchError: t('catalogs.deleteDialog.fetchBlockingError', 'Failed to check for blocking references'),
            cancelButton: t('common:actions.cancel', 'Cancel'),
            deleteButton: t('common:actions.delete', 'Delete'),
            deletingButton: t('common:actions.deleting', 'Deleting...')
        }),
        [t]
    )

    const columns: TableColumn<BlockingReferenceRow>[] = useMemo(
        () => [
            {
                id: 'index',
                label: '#',
                width: 48,
                align: 'center',
                render: (_row, index) => <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{index + 1}</Typography>
            },
            {
                id: 'sourceCatalog',
                label: t('catalogs.deleteDialog.blockingTable.catalog', 'Catalog'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceCatalogDisplayName}</Typography>
                )
            },
            {
                id: 'attribute',
                label: t('catalogs.deleteDialog.blockingTable.attribute', 'Attribute'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, color: 'text.secondary', wordBreak: 'break-word' }}>
                        {row.attributeDisplayName}
                    </Typography>
                )
            }
        ],
        [t]
    )

    const fetchBlockingEntities = async () => {
        const result = await getBlockingCatalogReferences(metahubId, catalogId)
        const blockingEntities: BlockingReferenceRow[] = result.blockingReferences.map((ref) => ({
            ...ref,
            sourceCatalogDisplayName:
                getVLCString(ref.sourceCatalogName ?? undefined, uiLocale) ||
                getVLCString(ref.sourceCatalogName ?? undefined, 'en') ||
                ref.sourceCatalogCodename ||
                '—',
            attributeDisplayName:
                getVLCString(ref.attributeName ?? undefined, uiLocale) ||
                getVLCString(ref.attributeName ?? undefined, 'en') ||
                ref.attributeCodename ||
                '—'
        }))
        return { blockingEntities }
    }

    const getBlockingEntityLink = (row: BlockingReferenceRow) => `/metahub/${metahubId}/catalog/${row.sourceCatalogId}/attributes`

    return (
        <BlockingEntitiesDeleteDialog<Catalog, BlockingReferenceRow>
            open={open}
            entity={catalog}
            queryKey={metahubsQueryKeys.blockingCatalogReferences(metahubId, catalogId)}
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

export default CatalogDeleteDialog
