import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { MetahubSet } from '../types'
import { getVLCString } from '../types'
import { getBlockingSetReferences, type BlockingSetReference } from '../domains/sets'
import { metahubsQueryKeys } from '../domains/shared'
import { buildCatalogAuthoringPath } from '../domains/catalogs/ui/catalogRoutePaths'

export interface SetDeleteDialogProps {
    open: boolean
    set: MetahubSet | null
    metahubId: string
    onClose: () => void
    onConfirm: (set: MetahubSet) => void
    isDeleting?: boolean
    uiLocale?: string
}

interface BlockingReferenceRow extends BlockingSetReference {
    sourceCatalogDisplayName: string
    attributeDisplayName: string
}

export const SetDeleteDialog = ({
    open,
    set,
    metahubId,
    onClose,
    onConfirm,
    isDeleting = false,
    uiLocale = 'en'
}: SetDeleteDialogProps) => {
    const { t } = useTranslation('metahubs')
    const { kindKey } = useParams<{ kindKey?: string }>()
    const setId = set?.id ?? ''

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('sets.deleteDialog.title', 'Delete Set'),
            confirmMessage: t(
                'sets.deleteDialog.confirmMessage',
                'Are you sure you want to delete this set? This action cannot be undone.'
            ),
            blockingWarning: t(
                'sets.deleteDialog.hasBlockingReferences',
                'Cannot delete set. Remove these references from catalog attributes first:'
            ),
            resolutionHint: t('sets.deleteDialog.resolutionHint', 'Open source catalogs from the table and adjust the listed attributes.'),
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
                label: t('sets.deleteDialog.blockingTable.catalog', 'Catalog'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceCatalogDisplayName}</Typography>
                )
            },
            {
                id: 'attribute',
                label: t('sets.deleteDialog.blockingTable.attribute', 'Attribute'),
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
        const result = await getBlockingSetReferences(metahubId, setId, kindKey)
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
        buildCatalogAuthoringPath({
            metahubId,
            catalogId: row.sourceCatalogId,
            kindKey,
            tab: 'attributes'
        })

    return (
        <BlockingEntitiesDeleteDialog<MetahubSet, BlockingReferenceRow>
            open={open}
            entity={set}
            queryKey={metahubsQueryKeys.blockingSetReferences(metahubId, setId, kindKey)}
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

export default SetDeleteDialog
