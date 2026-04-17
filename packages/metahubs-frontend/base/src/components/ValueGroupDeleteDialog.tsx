import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { ValueGroupEntity } from '../types'
import { getVLCString } from '../types'
import { getBlockingValueGroupReferences, type BlockingValueGroupReference } from '../domains/entities/presets/api/valueGroups'
import { metahubsQueryKeys } from '../domains/shared'
import { buildLinkedCollectionAuthoringPath, resolveEntityChildKindKey } from '../domains/shared/entityMetadataRoutePaths'

export interface ValueGroupDeleteDialogProps {
    open: boolean
    set: ValueGroupEntity | null
    metahubId: string
    onClose: () => void
    onConfirm: (set: ValueGroupEntity) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingValueGroupReference {
    sourceCatalogDisplayName: string
    attributeDisplayName: string
}

export const ValueGroupDeleteDialog = ({
    open,
    set,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: ValueGroupDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const { kindKey } = useParams<{ kindKey?: string }>()
    const valueGroupId = set?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('sets.deleteDialog.title', 'Delete set'),
            confirmMessage: t(
                'sets.deleteDialog.confirmMessage',
                'Are you sure you want to delete this set? This action cannot be undone.'
            ),
            blockingWarning: t(
                'sets.deleteDialog.hasBlockingReferences',
                'Cannot delete set. Remove these references from catalog field definitions first:'
            ),
            resolutionHint: t(
                'sets.deleteDialog.resolutionHint',
                'Open source catalogs from the table and adjust the listed field definitions.'
            ),
            fetchError: t('sets.deleteDialog.fetchBlockingError', 'Failed to check for blocking references'),
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
                label: t('sets.deleteDialog.blockingTable.catalog', 'LinkedCollectionEntity'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceCatalogDisplayName}</Typography>
                )
            },
            {
                id: 'attribute',
                label: t('sets.deleteDialog.blockingTable.attribute', 'Field definition'),
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
        const result = await getBlockingValueGroupReferences(metahubId, valueGroupId, kindKey)
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

    const catalogKindKey = resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'catalog' })
    const getBlockingEntityLink = (row: BlockingReferenceRow) =>
        buildLinkedCollectionAuthoringPath({
            metahubId,
            linkedCollectionId: row.sourceLinkedCollectionId,
            kindKey: catalogKindKey,
            tab: 'fieldDefinitions'
        })

    return (
        <BlockingEntitiesDeleteDialog<ValueGroupEntity, BlockingReferenceRow>
            open={open}
            entity={set}
            queryKey={metahubsQueryKeys.blockingValueGroupReferences(metahubId, valueGroupId, kindKey)}
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

export default ValueGroupDeleteDialog
