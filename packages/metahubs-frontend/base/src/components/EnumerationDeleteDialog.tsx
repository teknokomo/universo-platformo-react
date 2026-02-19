import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { Enumeration } from '../types'
import { getVLCString } from '../types'
import { getBlockingEnumerationReferences, type BlockingEnumerationReference } from '../domains/enumerations'
import { metahubsQueryKeys } from '../domains/shared'

export interface EnumerationDeleteDialogProps {
    open: boolean
    enumeration: Enumeration | null
    metahubId: string
    onClose: () => void
    onConfirm: (enumeration: Enumeration) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingEnumerationReference {
    sourceCatalogDisplayName: string
    attributeDisplayName: string
}

export const EnumerationDeleteDialog = ({
    open,
    enumeration,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: EnumerationDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const enumerationId = enumeration?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('enumerations.deleteDialog.title', 'Delete Enumeration'),
            confirmMessage: t(
                'enumerations.deleteDialog.confirmMessage',
                'Are you sure you want to delete this enumeration? This action cannot be undone.'
            ),
            blockingWarning: t(
                'enumerations.deleteDialog.hasBlockingReferences',
                'Cannot delete enumeration. Remove these references from attributes first:'
            ),
            resolutionHint: t(
                'enumerations.deleteDialog.resolutionHint',
                'Open the source catalogs and update or remove the reference attributes.'
            ),
            fetchError: t('enumerations.deleteDialog.fetchBlockingError', 'Failed to check for blocking references'),
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
                label: t('enumerations.deleteDialog.blockingTable.catalog', 'Catalog'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceCatalogDisplayName}</Typography>
                )
            },
            {
                id: 'attribute',
                label: t('enumerations.deleteDialog.blockingTable.attribute', 'Attribute'),
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
        const result = await getBlockingEnumerationReferences(metahubId, enumerationId)
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
        <BlockingEntitiesDeleteDialog<Enumeration, BlockingReferenceRow>
            open={open}
            entity={enumeration}
            queryKey={metahubsQueryKeys.blockingEnumerationReferences(metahubId, enumerationId)}
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

export default EnumerationDeleteDialog
