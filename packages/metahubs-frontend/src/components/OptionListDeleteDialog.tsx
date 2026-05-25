import { useMemo } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { OptionListEntity } from '../types'
import { getVLCString } from '../types'
import { getBlockingOptionListReferences, type BlockingOptionListReference } from '../domains/entities/presets/api/optionLists'
import { metahubsQueryKeys } from '../domains/shared'
import { buildObjectCollectionAuthoringPath, resolveEntityChildKindKey } from '../domains/shared/entityMetadataRoutePaths'

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
    sourceObjectDisplayName: string
    componentDisplayName: string
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
            title: t('enumerations.deleteDialog.title', 'Delete enumeration'),
            confirmMessage: t(
                'enumerations.deleteDialog.confirmMessage',
                'Are you sure you want to delete this enumeration? This action cannot be undone.'
            ),
            blockingWarning: t(
                'enumerations.deleteDialog.hasBlockingReferences',
                'Cannot delete enumeration. Remove these references from components first:'
            ),
            resolutionHint: t(
                'enumerations.deleteDialog.resolutionHint',
                'Open the source objects and update or remove the reference components.'
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
                id: 'sourceObject',
                label: t('enumerations.deleteDialog.blockingTable.object', 'Object'),
                render: (row) => (
                    <Typography sx={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>{row.sourceObjectDisplayName}</Typography>
                )
            },
            {
                id: 'component',
                label: t('enumerations.deleteDialog.blockingTable.component', 'Component'),
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
        const result = await getBlockingOptionListReferences(metahubId, optionListId, kindKey)
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

    const objectKindKey = resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'object' })
    const getBlockingEntityLink = (row: BlockingReferenceRow) =>
        buildObjectCollectionAuthoringPath({
            metahubId,
            objectCollectionId: row.sourceObjectCollectionId,
            kindKey: objectKindKey,
            tab: 'components'
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
