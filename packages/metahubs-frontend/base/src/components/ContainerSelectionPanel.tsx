import { useMemo } from 'react'
import { Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { TreeEntity } from '../types'
import { getVLCString } from '../types'

export interface ContainerSelectionPanelProps {
    /** List of available containers in the current metahub context */
    availableContainers: TreeEntity[]
    /** Currently selected container IDs */
    selectedContainerIds: string[]
    /** Callback when selection changes */
    onSelectionChange: (containerIds: string[]) => void
    /** Whether at least one container is required */
    isContainerRequired: boolean
    /** Callback when container requirement changes */
    onRequiredContainerChange: (value: boolean) => void
    /** Whether only a single container may be selected */
    isSingleContainer: boolean
    /** Callback when single-container mode changes */
    onSingleContainerChange: (value: boolean) => void
    /** Disable all interactions */
    disabled?: boolean
    /** Error message to display */
    error?: string
    /** Current UI locale for container name display */
    uiLocale?: string
    /** Legacy alias kept for compatibility with existing callers */
    currentTreeEntityId?: string | null
    /** Current container context for quick re-link action */
    currentContainerId?: string | null
    /** Optional label overrides for non-linked-collection contexts. */
    labelsOverride?: Partial<EntitySelectionLabels>
}

/**
 * Panel for managing tree-entity container links.
 * Displays selected containers in a table with add/remove functionality.
 * Includes toggle for single-container mode.
 *
 * This is a thin wrapper around EntitySelectionPanel with TreeEntity-specific configuration.
 */
export const ContainerSelectionPanel = ({
    availableContainers,
    selectedContainerIds,
    onSelectionChange,
    isContainerRequired,
    onRequiredContainerChange,
    isSingleContainer,
    onSingleContainerChange,
    disabled = false,
    error,
    uiLocale = 'en',
    currentTreeEntityId = null,
    currentContainerId = null,
    labelsOverride
}: ContainerSelectionPanelProps) => {
    const { t } = useTranslation(['metahubs', 'common'])
    const resolvedCurrentContainerId = currentContainerId ?? currentTreeEntityId

    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('entities.selection.title', 'Containers'),
            addButton: t('entities.selection.addButton', 'Add'),
            dialogTitle: t('entities.selection.dialogTitle', 'Select containers'),
            emptyMessage: t('entities.selection.empty', 'No containers selected'),
            requiredWarningMessage: t('entities.selection.requiredWarning', 'Select at least one container'),
            noAvailableMessage: t('entities.selection.noAvailable', 'No containers available'),
            searchPlaceholder: t('common:search', 'Поиск...'),
            cancelButton: t('common:actions.cancel', 'Отмена'),
            confirmButton: t('entities.selection.confirmButton', 'Add'),
            removeTitle: t('entities.selection.removeTitle', 'Remove'),
            nameHeader: t('table.name', 'Название'),
            codenameHeader: t('table.codename', 'Кодовое имя'),
            requiredLabel: t('entities.selection.requiredLabel', 'Container required'),
            requiredEnabledHelp: t('entities.selection.requiredEnabledHelp', 'At least one container must stay linked'),
            requiredDisabledHelp: t('entities.selection.requiredDisabledHelp', 'The entity can exist without linked containers'),
            singleLabel: t('entities.selection.singleLabel', 'Single container only'),
            singleEnabledHelp: t('entities.selection.singleEnabledHelp', 'The entity can only be linked to one container'),
            singleDisabledHelp: t('entities.selection.singleDisabledHelp', 'The entity can be linked to multiple containers'),
            singleWarning: t('entities.selection.singleWarning', 'Cannot enable while multiple containers are selected')
        }),
        [t]
    )

    const resolvedLabels = useMemo(
        () => ({
            ...labels,
            ...(labelsOverride ?? {})
        }),
        [labels, labelsOverride]
    )

    const getDisplayName = (container: TreeEntity): string => {
        return (
            getVLCString(container.name, uiLocale) ||
            getVLCString(container.name, 'en') ||
            getVLCString(container.codename, uiLocale) ||
            getVLCString(container.codename, 'en') ||
            container.id
        )
    }

    const getCodename = (container: TreeEntity): string => {
        return getVLCString(container.codename, uiLocale) || getVLCString(container.codename, 'en') || container.id
    }

    const showRelinkCurrentContainer =
        typeof resolvedCurrentContainerId === 'string' &&
        resolvedCurrentContainerId.length > 0 &&
        !selectedContainerIds.includes(resolvedCurrentContainerId) &&
        availableContainers.some((container) => container.id === resolvedCurrentContainerId)

    const handleRelinkCurrentContainer = () => {
        if (!showRelinkCurrentContainer || !resolvedCurrentContainerId) return
        onSelectionChange([...selectedContainerIds, resolvedCurrentContainerId])
    }

    return (
        <EntitySelectionPanel<TreeEntity>
            availableEntities={availableContainers}
            selectedIds={selectedContainerIds}
            onSelectionChange={onSelectionChange}
            getDisplayName={getDisplayName}
            getCodename={getCodename}
            labels={resolvedLabels}
            disabled={disabled}
            error={error}
            isRequired={isContainerRequired}
            onRequiredChange={onRequiredContainerChange}
            isSingle={isSingleContainer}
            onSingleChange={onSingleContainerChange}
            headerActions={
                showRelinkCurrentContainer ? (
                    <Button size='small' variant='outlined' onClick={handleRelinkCurrentContainer} disabled={disabled}>
                        {t('entities.selection.currentContainerShort', 'Current container')}
                    </Button>
                ) : undefined
            }
        />
    )
}

export default ContainerSelectionPanel
