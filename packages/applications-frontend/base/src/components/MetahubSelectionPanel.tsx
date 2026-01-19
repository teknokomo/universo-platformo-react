import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { MetahubSummary } from '../types'
import { getVLCString } from '../types'

export interface MetahubSelectionPanelProps {
    /** List of all available metahubs */
    availableMetahubs: MetahubSummary[]
    /** Currently selected metahub IDs */
    selectedMetahubIds: string[]
    /** Callback when selection changes */
    onSelectionChange: (metahubIds: string[]) => void
    /** Whether connector must have at least one metahub */
    isRequiredMetahub: boolean
    /** Callback when isRequiredMetahub changes */
    onRequiredMetahubChange: (value: boolean) => void
    /** Whether connector is restricted to single metahub */
    isSingleMetahub: boolean
    /** Callback when isSingleMetahub changes */
    onSingleMetahubChange: (value: boolean) => void
    /** Disable all interactions */
    disabled?: boolean
    /** Disable only toggle switches while keeping selection active */
    togglesDisabled?: boolean
    /** Error message to display */
    error?: string
    /** Current UI locale for metahub name display */
    uiLocale?: string
}

/**
 * Panel for managing connector metahub associations.
 * Displays selected metahubs in a table with add/remove functionality.
 * Includes toggles for "single metahub only" and "required" modes.
 *
 * This is a thin wrapper around EntitySelectionPanel with Metahub-specific configuration.
 */
export const MetahubSelectionPanel = ({
    availableMetahubs,
    selectedMetahubIds,
    onSelectionChange,
    isRequiredMetahub,
    onRequiredMetahubChange,
    isSingleMetahub,
    onSingleMetahubChange,
    disabled = false,
    togglesDisabled = false,
    error,
    uiLocale = 'en'
}: MetahubSelectionPanelProps) => {
    const { t } = useTranslation('applications')

    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('connectors.metahubs.panelTitle', 'Метахабы'),
            addButton: t('connectors.metahubs.addButton', 'Добавить'),
            dialogTitle: t('connectors.metahubs.selectDialog', 'Выберите метахаб'),
            emptyMessage: t('connectors.metahubs.noSelected', 'Метахабы не выбраны'),
            noAvailableMessage: t('connectors.metahubs.noAvailable', 'Нет доступных метахабов'),
            searchPlaceholder: t('common.search', 'Поиск...'),
            cancelButton: t('common.cancel', 'Отмена'),
            confirmButton: t('connectors.metahubs.addSelected', 'Добавить'),
            removeTitle: t('connectors.metahubs.remove', 'Удалить'),
            nameHeader: t('table.name', 'Название'),
            codenameHeader: t('table.codename', 'Кодовое имя'),
            requiredLabel: t('connectors.metahubs.isRequired', 'Обязательно'),
            requiredEnabledHelp: t('connectors.metahubs.isRequiredEnabled', 'Источник должен иметь хотя бы один связанный Метахаб'),
            requiredDisabledHelp: t('connectors.metahubs.isRequiredDisabled', 'Источник может существовать без метахабов'),
            singleLabel: t('connectors.metahubs.isSingle', 'Один метахаб'),
            singleEnabledHelp: t('connectors.metahubs.isSingleEnabled', 'Источник может быть связан только с одним Метахабом'),
            singleDisabledHelp: t('connectors.metahubs.isSingleDisabled', 'Источник может отображаться в нескольких метахабах'),
            singleWarning: t('connectors.metahubs.isSingleWarning', 'Нельзя включить, пока выбрано несколько метахабов')
        }),
        [t]
    )

    const getDisplayName = (metahub: MetahubSummary): string => {
        return getVLCString(metahub.name, uiLocale) || getVLCString(metahub.name, 'en') || metahub.codename
    }

    const getCodename = (metahub: MetahubSummary): string => {
        return metahub.codename
    }

    return (
        <EntitySelectionPanel<MetahubSummary>
            availableEntities={availableMetahubs}
            selectedIds={selectedMetahubIds}
            onSelectionChange={onSelectionChange}
            getDisplayName={getDisplayName}
            getCodename={getCodename}
            labels={labels}
            disabled={disabled}
            togglesDisabled={togglesDisabled}
            error={error}
            isRequired={isRequiredMetahub}
            onRequiredChange={onRequiredMetahubChange}
            isSingle={isSingleMetahub}
            onSingleChange={onSingleMetahubChange}
        />
    )
}

export default MetahubSelectionPanel
