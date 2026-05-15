import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { ObjectCollectionEntity } from '../types'
import { getVLCString } from '../types'
import {
    getBlockingObjectCollectionReferences,
    type BlockingObjectCollectionReference
} from '../domains/entities/presets/api/objectCollections'
import { metahubsQueryKeys } from '../domains/shared'
import { buildObjectCollectionAuthoringPath } from '../domains/shared/entityMetadataRoutePaths'

export interface ObjectCollectionDeleteDialogProps {
    open: boolean
    objectCollection: ObjectCollectionEntity | null
    metahubId: string
    onClose: () => void
    onConfirm: (objectCollection: ObjectCollectionEntity) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingObjectCollectionReference {
    sourceObjectDisplayName: string
    componentDisplayName: string
}

export const ObjectCollectionDeleteDialog = ({
    open,
    objectCollection,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: ObjectCollectionDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const { kindKey } = useParams<{ kindKey?: string }>()
    const objectCollectionId = objectCollection?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('objects.deleteDialog.title', 'Delete object'),
            confirmMessage: t(
                'objects.deleteDialog.confirmMessage',
                'Are you sure you want to delete this object? This action cannot be undone.'
            ),
            blockingWarning: t(
                'objects.deleteDialog.hasBlockingReferences',
                'Cannot delete object. The following references from other objects must be removed first:'
            ),
            resolutionHint: t(
                'objects.deleteDialog.resolutionHint',
                'Open the source objects from the table and remove or reconfigure reference components.'
            ),
            fetchError: t('objects.deleteDialog.fetchBlockingError', 'Failed to check for blocking references'),
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
                id: 'sourceObject',
                label: t('objects.deleteDialog.blockingTable.object', 'Object'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceObjectDisplayName}</Typography>
                )
            },
            {
                id: 'component',
                label: t('objects.deleteDialog.blockingTable.component', 'Component'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, color: 'text.secondary', wordBreak: 'break-word' }}>
                        {row.componentDisplayName}
                    </Typography>
                )
            }
        ],
        [t]
    )

    const fetchBlockingEntities = async () => {
        const result = await getBlockingObjectCollectionReferences(metahubId, objectCollectionId)
        const blockingEntities: BlockingReferenceRow[] = result.blockingReferences.map((ref) => ({
            ...ref,
            sourceObjectDisplayName:
                getVLCString(ref.sourceObjectName ?? undefined, uiLocale) ||
                getVLCString(ref.sourceObjectName ?? undefined, 'en') ||
                ref.sourceObjectCodename ||
                '—',
            componentDisplayName:
                getVLCString(ref.componentName ?? undefined, uiLocale) ||
                getVLCString(ref.componentName ?? undefined, 'en') ||
                ref.componentCodename ||
                '—'
        }))
        return { blockingEntities }
    }

    const getBlockingEntityLink = (row: BlockingReferenceRow) =>
        buildObjectCollectionAuthoringPath({
            metahubId,
            objectCollectionId: row.sourceObjectCollectionId,
            kindKey,
            tab: 'components'
        })

    return (
        <BlockingEntitiesDeleteDialog<ObjectCollectionEntity, BlockingReferenceRow>
            open={open}
            entity={objectCollection}
            queryKey={metahubsQueryKeys.blockingObjectCollectionReferences(metahubId, objectCollectionId)}
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

export default ObjectCollectionDeleteDialog
