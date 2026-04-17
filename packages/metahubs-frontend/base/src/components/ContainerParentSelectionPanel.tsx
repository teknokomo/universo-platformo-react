import { useMemo } from 'react'
import { Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { TreeEntity } from '../types'
import { getVLCString } from '../types'

export interface ContainerParentSelectionPanelProps {
    availableContainers: TreeEntity[]
    parentContainerId: string | null
    onParentContainerChange: (parentContainerId: string | null) => void
    excludedContainerIds?: string[] | Set<string>
    disabled?: boolean
    error?: string
    uiLocale?: string
    /** Current container context for quick re-link action */
    currentContainerId?: string | null
}

export const ContainerParentSelectionPanel = ({
    availableContainers,
    parentContainerId,
    onParentContainerChange,
    excludedContainerIds,
    disabled = false,
    error,
    uiLocale = 'en',
    currentContainerId = null
}: ContainerParentSelectionPanelProps) => {
    const { t } = useTranslation(['metahubs', 'common'])

    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('entities.parentSelection.title', 'Parent container'),
            addButton: t('entities.parentSelection.addButton', 'Add'),
            dialogTitle: t('entities.parentSelection.dialogTitle', 'Select parent container'),
            emptyMessage: t('entities.parentSelection.empty', 'Parent container is not selected'),
            noAvailableMessage: t('entities.parentSelection.noAvailable', 'No parent containers available'),
            searchPlaceholder: t('common:search', 'Поиск...'),
            cancelButton: t('common:actions.cancel', 'Отмена'),
            confirmButton: t('entities.parentSelection.confirmButton', 'Add'),
            removeTitle: t('entities.parentSelection.removeTitle', 'Remove link'),
            nameHeader: t('table.name', 'Название'),
            codenameHeader: t('table.codename', 'Кодовое имя')
        }),
        [t]
    )

    const excludedIdsSet = useMemo(
        () => (excludedContainerIds instanceof Set ? excludedContainerIds : new Set(excludedContainerIds ?? [])),
        [excludedContainerIds]
    )
    const filteredAvailableContainers = useMemo(
        () => availableContainers.filter((container) => !excludedIdsSet.has(container.id)),
        [availableContainers, excludedIdsSet]
    )

    const showRelinkCurrentContainer =
        typeof currentContainerId === 'string' &&
        currentContainerId.length > 0 &&
        parentContainerId !== currentContainerId &&
        filteredAvailableContainers.some((container) => container.id === currentContainerId)

    const handleRelinkCurrentContainer = () => {
        if (!showRelinkCurrentContainer || !currentContainerId) return
        onParentContainerChange(currentContainerId)
    }

    return (
        <EntitySelectionPanel<TreeEntity>
            availableEntities={filteredAvailableContainers}
            selectedIds={parentContainerId ? [parentContainerId] : []}
            onSelectionChange={(ids) => onParentContainerChange(ids[0] ?? null)}
            getDisplayName={(container) =>
                getVLCString(container.name, uiLocale) || getVLCString(container.name, 'en') || container.codename
            }
            getCodename={(container) => container.codename}
            labels={labels}
            disabled={disabled}
            error={error}
            isSingle
            headerActions={
                showRelinkCurrentContainer ? (
                    <Button size='small' variant='outlined' onClick={handleRelinkCurrentContainer} disabled={disabled}>
                        {t('entities.parentSelection.currentContainerShort', 'Current container')}
                    </Button>
                ) : undefined
            }
        />
    )
}

export default ContainerParentSelectionPanel
