import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { Hub } from '../types'
import { getVLCString } from '../types'

export interface HubSelectionPanelProps {
    /** List of all available hubs in the metahub */
    availableHubs: Hub[]
    /** Currently selected hub IDs */
    selectedHubIds: string[]
    /** Callback when selection changes */
    onSelectionChange: (hubIds: string[]) => void
    /** Whether catalog must have at least one hub */
    isRequiredHub: boolean
    /** Callback when isRequiredHub changes */
    onRequiredHubChange: (value: boolean) => void
    /** Whether catalog is restricted to single hub */
    isSingleHub: boolean
    /** Callback when isSingleHub changes */
    onSingleHubChange: (value: boolean) => void
    /** Disable all interactions */
    disabled?: boolean
    /** Error message to display */
    error?: string
    /** Current UI locale for hub name display */
    uiLocale?: string
}

/**
 * Panel for managing catalog hub associations.
 * Displays selected hubs in a table with add/remove functionality.
 * Includes toggle for "single hub only" mode.
 *
 * This is a thin wrapper around EntitySelectionPanel with Hub-specific configuration.
 */
export const HubSelectionPanel = ({
    availableHubs,
    selectedHubIds,
    onSelectionChange,
    isRequiredHub,
    onRequiredHubChange,
    isSingleHub,
    onSingleHubChange,
    disabled = false,
    error,
    uiLocale = 'en'
}: HubSelectionPanelProps) => {
    const { t } = useTranslation('metahubs')

    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('catalogs.tabs.hubs', 'Хабы'),
            addButton: t('catalogs.addHub', 'Добавить'),
            dialogTitle: t('catalogs.selectHubs', 'Выберите хабы'),
            emptyMessage: t('catalogs.noHubsSelected', 'Хабы не выбраны'),
            noAvailableMessage: t('catalogs.noHubsAvailable', 'Нет доступных хабов'),
            searchPlaceholder: t('common.search', 'Поиск...'),
            cancelButton: t('common.cancel', 'Отмена'),
            confirmButton: t('catalogs.addSelected', 'Добавить'),
            removeTitle: t('catalogs.removeHub', 'Удалить'),
            nameHeader: t('table.name', 'Название'),
            codenameHeader: t('table.codename', 'Кодовое имя'),
            requiredLabel: t('catalogs.isRequiredHub', 'Должен быть хаб'),
            requiredEnabledHelp: t('catalogs.isRequiredHubEnabled', 'Каталог должен иметь хотя бы один хаб'),
            requiredDisabledHelp: t('catalogs.isRequiredHubDisabled', 'Каталог может существовать без хабов'),
            singleLabel: t('catalogs.isSingleHub', 'Только один хаб'),
            singleEnabledHelp: t('catalogs.isSingleHubEnabled', 'Каталог может быть только в одном хабе'),
            singleDisabledHelp: t('catalogs.isSingleHubDisabled', 'Каталог может отображаться в нескольких хабах'),
            singleWarning: t('catalogs.isSingleHubWarning', 'Нельзя включить, пока выбрано несколько хабов')
        }),
        [t]
    )

    const getDisplayName = (hub: Hub): string => {
        return getVLCString(hub.name, uiLocale) || getVLCString(hub.name, 'en') || hub.codename
    }

    const getCodename = (hub: Hub): string => {
        return hub.codename
    }

    return (
        <EntitySelectionPanel<Hub>
            availableEntities={availableHubs}
            selectedIds={selectedHubIds}
            onSelectionChange={onSelectionChange}
            getDisplayName={getDisplayName}
            getCodename={getCodename}
            labels={labels}
            disabled={disabled}
            error={error}
            isRequired={isRequiredHub}
            onRequiredChange={onRequiredHubChange}
            isSingle={isSingleHub}
            onSingleChange={onSingleHubChange}
        />
    )
}

export default HubSelectionPanel
