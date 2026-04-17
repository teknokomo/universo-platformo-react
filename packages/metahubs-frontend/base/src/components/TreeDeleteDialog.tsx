import { useMemo, useCallback } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { BlockingEntitiesDeleteDialog, type BlockingEntitiesDeleteDialogLabels, type TableColumn } from '@universo/template-mui'
import type { TreeEntity } from '../types'
import { getVLCString } from '../types'
import { getBlockingTreeDependencies, type BlockingTreeDependency } from '../domains/entities/presets/api/trees'
import { metahubsQueryKeys } from '../domains/shared'
import {
    buildLinkedCollectionAuthoringPath,
    buildOptionListAuthoringPath,
    buildTreeEntityAuthoringPath,
    buildValueGroupAuthoringPath,
    resolveEntityChildKindKey
} from '../domains/shared/entityMetadataRoutePaths'

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

type BlockingGroup = 'linkedCollection' | 'optionList' | 'valueGroup' | 'treeEntity'

interface BlockingTreeRow extends BlockingTreeDependency {
    displayName: string
    group: BlockingGroup
    linkUrl: string
}

const GROUP_I18N_MAP: Record<BlockingGroup, { key: string; fallback: string }> = {
    linkedCollection: { key: 'treeEntities.deleteDialog.sections.linkedCollections', fallback: 'Linked collection' },
    optionList: { key: 'treeEntities.deleteDialog.sections.optionLists', fallback: 'Option list' },
    valueGroup: { key: 'treeEntities.deleteDialog.sections.valueGroups', fallback: 'Value group' },
    treeEntity: { key: 'treeEntities.deleteDialog.sections.treeEntities', fallback: 'Tree entity' }
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

    const catalogKindKey = resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'catalog' })
    const setKindKey = resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'set' })
    const enumerationKindKey = resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'enumeration' })
    const hubKindKey = resolveEntityChildKindKey({ routeKindKey: kindKey, childObjectKind: 'hub' })

    const resolveDisplayName = useCallback(
        (entity: BlockingTreeDependency) =>
            getVLCString(entity.name, uiLocale) || getVLCString(entity.name, 'en') || entity.codename || '—',
        [uiLocale]
    )

    const fetchBlockingEntities = useCallback(async () => {
        const data = await getBlockingTreeDependencies(metahubId, treeEntityId)
        const blockingEntities: BlockingTreeRow[] = [
            ...data.blockingLinkedCollections.map((e) => ({
                ...e,
                displayName: resolveDisplayName(e),
                group: 'linkedCollection' as const,
                linkUrl: buildLinkedCollectionAuthoringPath({
                    metahubId,
                    linkedCollectionId: e.id,
                    kindKey: catalogKindKey,
                    tab: 'fieldDefinitions'
                })
            })),
            ...data.blockingOptionLists.map((e) => ({
                ...e,
                displayName: resolveDisplayName(e),
                group: 'optionList' as const,
                linkUrl: buildOptionListAuthoringPath({ metahubId, optionListId: e.id, kindKey: enumerationKindKey })
            })),
            ...data.blockingValueGroups.map((e) => ({
                ...e,
                displayName: resolveDisplayName(e),
                group: 'valueGroup' as const,
                linkUrl: buildValueGroupAuthoringPath({ metahubId, valueGroupId: e.id, kindKey: setKindKey })
            })),
            ...data.blockingChildTreeEntities.map((e) => ({
                ...e,
                displayName: resolveDisplayName(e),
                group: 'treeEntity' as const,
                linkUrl: buildTreeEntityAuthoringPath({ metahubId, treeEntityId: e.id, kindKey: hubKindKey, tab: 'treeEntities' })
            }))
        ]
        return { blockingEntities }
    }, [metahubId, treeEntityId, resolveDisplayName, catalogKindKey, setKindKey, enumerationKindKey, hubKindKey])

    const labels: BlockingEntitiesDeleteDialogLabels = useMemo(
        () => ({
            title: t('treeEntities.deleteDialog.title', 'Delete tree entity'),
            confirmMessage: t(
                'treeEntities.deleteDialog.confirmMessage',
                'Are you sure you want to delete this tree entity? This action cannot be undone.'
            ),
            blockingWarning: t(
                'treeEntities.deleteDialog.hasBlockingObjects',
                'Cannot delete tree entity. The following entities require at least one tree entity and are only linked to this one:'
            ),
            resolutionHint: t(
                'treeEntities.deleteDialog.resolutionHint',
                'To delete this tree entity, first re-link child tree entities and add another tree entity to these linked collections, value groups, and option lists, or disable the required tree-entity option.'
            ),
            fetchError: t('treeEntities.deleteDialog.fetchError', 'Failed to check for blocking entities'),
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
                render: (row) => {
                    const groupInfo = GROUP_I18N_MAP[row.group]
                    return <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t(groupInfo.key, groupInfo.fallback)}</Typography>
                }
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
                        {row.codename}
                    </Typography>
                )
            }
        ],
        [t]
    )

    return (
        <BlockingEntitiesDeleteDialog<TreeEntity, BlockingTreeRow>
            open={open}
            entity={hub}
            queryKey={metahubsQueryKeys.blockingLinkedCollections(metahubId, treeEntityId)}
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
