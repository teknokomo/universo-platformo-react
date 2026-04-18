import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { LinkedCollectionEntity } from '../types'
import { getVLCString } from '../types'
import {
    getBlockingLinkedCollectionReferences,
    type BlockingLinkedCollectionReference
} from '../domains/entities/presets/api/linkedCollections'
import { metahubsQueryKeys } from '../domains/shared'
import { buildLinkedCollectionAuthoringPath } from '../domains/shared/entityMetadataRoutePaths'

export interface LinkedCollectionDeleteDialogProps {
    open: boolean
    catalog: LinkedCollectionEntity | null
    metahubId: string
    onClose: () => void
    onConfirm: (catalog: LinkedCollectionEntity) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingLinkedCollectionReference {
    sourceCatalogDisplayName: string
    attributeDisplayName: string
}

export const LinkedCollectionDeleteDialog = ({
    open,
    catalog,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: LinkedCollectionDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const { kindKey } = useParams<{ kindKey?: string }>()
    const linkedCollectionId = catalog?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('catalogs.deleteDialog.title', 'Delete catalog'),
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
                label: t('catalogs.deleteDialog.blockingTable.catalog', 'LinkedCollectionEntity'),
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
        const result = await getBlockingLinkedCollectionReferences(metahubId, linkedCollectionId)
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

    const getBlockingEntityLink = (row: BlockingReferenceRow) =>
        buildLinkedCollectionAuthoringPath({
            metahubId,
            linkedCollectionId: row.sourceLinkedCollectionId,
            kindKey,
            tab: 'fieldDefinitions'
        })

    return (
        <BlockingEntitiesDeleteDialog<LinkedCollectionEntity, BlockingReferenceRow>
            open={open}
            entity={catalog}
            queryKey={metahubsQueryKeys.blockingLinkedCollectionReferences(metahubId, linkedCollectionId)}
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

export default LinkedCollectionDeleteDialog
