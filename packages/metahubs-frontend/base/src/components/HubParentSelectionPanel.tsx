import { useMemo } from 'react'
import { Button } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { Hub } from '../types'
import { getVLCString } from '../types'

export interface HubParentSelectionPanelProps {
    availableHubs: Hub[]
    parentHubId: string | null
    onParentHubChange: (parentHubId: string | null) => void
    excludedHubIds?: string[] | Set<string>
    disabled?: boolean
    error?: string
    uiLocale?: string
    currentHubId?: string | null
}

export const HubParentSelectionPanel = ({
    availableHubs,
    parentHubId,
    onParentHubChange,
    excludedHubIds,
    disabled = false,
    error,
    uiLocale = 'en',
    currentHubId = null
}: HubParentSelectionPanelProps) => {
    const { t } = useTranslation(['metahubs', 'common'])

    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('hubs.tabs.hubs', 'Хабы'),
            addButton: t('hubs.addParentHub', 'Добавить'),
            dialogTitle: t('hubs.selectParentHub', 'Выберите родительский хаб'),
            emptyMessage: t('hubs.noParentHub', 'Родительский хаб не выбран'),
            noAvailableMessage: t('hubs.noAvailableParentHubs', 'Нет доступных хабов'),
            searchPlaceholder: t('common:search', 'Поиск...'),
            cancelButton: t('common:actions.cancel', 'Отмена'),
            confirmButton: t('hubs.addSelectedParentHub', 'Добавить'),
            removeTitle: t('hubs.removeParentHub', 'Удалить связь'),
            nameHeader: t('table.name', 'Название'),
            codenameHeader: t('table.codename', 'Кодовое имя')
        }),
        [t]
    )

    const excludedIdsSet = useMemo(() => (excludedHubIds instanceof Set ? excludedHubIds : new Set(excludedHubIds ?? [])), [excludedHubIds])
    const filteredAvailableHubs = useMemo(() => availableHubs.filter((hub) => !excludedIdsSet.has(hub.id)), [availableHubs, excludedIdsSet])

    const showRelinkCurrentHub =
        typeof currentHubId === 'string' &&
        currentHubId.length > 0 &&
        parentHubId !== currentHubId &&
        filteredAvailableHubs.some((hub) => hub.id === currentHubId)

    const handleRelinkCurrentHub = () => {
        if (!showRelinkCurrentHub || !currentHubId) return
        onParentHubChange(currentHubId)
    }

    return (
        <EntitySelectionPanel<Hub>
            availableEntities={filteredAvailableHubs}
            selectedIds={parentHubId ? [parentHubId] : []}
            onSelectionChange={(ids) => onParentHubChange(ids[0] ?? null)}
            getDisplayName={(hub) => getVLCString(hub.name, uiLocale) || getVLCString(hub.name, 'en') || hub.codename}
            getCodename={(hub) => hub.codename}
            labels={labels}
            disabled={disabled}
            error={error}
            isSingle
            headerActions={
                showRelinkCurrentHub ? (
                    <Button size='small' variant='outlined' onClick={handleRelinkCurrentHub} disabled={disabled}>
                        {t('hubs.linkCurrentHubShort', 'Текущий хаб')}
                    </Button>
                ) : undefined
            }
        />
    )
}

export default HubParentSelectionPanel
