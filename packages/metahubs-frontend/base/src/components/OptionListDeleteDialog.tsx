import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { OptionListEntity } from '../types'
import { getVLCString } from '../types'
import { getBlockingOptionListReferences, type BlockingOptionListReference } from '../domains/entities/presets/api/optionLists'
import { metahubsQueryKeys } from '../domains/shared'
import { buildLinkedCollectionAuthoringPath, resolveEntityChildKindKey } from '../domains/shared/entityMetadataRoutePaths'

export interface OptionListDeleteDialogProps {
    open: boolean
    enumeration: OptionListEntity | null
    metahubId: string
    onClose: () => void
    onConfirm: (enumeration: OptionListEntity) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingOptionListReference {
    sourceCatalogDisplayName: string
    attributeDisplayName: string
}

export const OptionListDeleteDialog = ({
    open,
    enumeration,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: OptionListDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const { kindKey } = useParams<{ kindKey?: string }>()
    const optionListId = enumeration?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('optionLists.deleteDialog.title', 'Delete OptionListEntity'),
            confirmMessage: t(
                'optionLists.deleteDialog.confirmMessage',
                'Are you sure you want to delete this option list? This action cannot be undone.'
            ),
            blockingWarning: t(
                'optionLists.deleteDialog.hasBlockingReferences',
                'Cannot delete option list. Remove these references from field definitions first:'
            ),
            resolutionHint: t(
                'optionLists.deleteDialog.resolutionHint',
                'Open the source linked collections and update or remove the reference field definitions.'
            ),
            fetchError: t('optionLists.deleteDialog.fetchBlockingError', 'Failed to check for blocking references'),
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
                label: t('optionLists.deleteDialog.blockingTable.catalog', 'LinkedCollectionEntity'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceCatalogDisplayName}</Typography>
                )
            },
            {
                id: 'attribute',
                label: t('optionLists.deleteDialog.blockingTable.attribute', 'Field definition'),
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
        const result = await getBlockingOptionListReferences(metahubId, optionListId, kindKey)
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
        <BlockingEntitiesDeleteDialog<OptionListEntity, BlockingReferenceRow>
            open={open}
            entity={enumeration}
            queryKey={metahubsQueryKeys.blockingOptionListReferences(metahubId, optionListId, kindKey)}
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

export default OptionListDeleteDialog
