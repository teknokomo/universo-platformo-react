import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack, Alert } from '@mui/material'
import InfoIcon from '@mui/icons-material/Info'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { Metahub } from '../types'
import { getVLCString } from '../types'

export interface MetahubInfoPanelProps {
    /** The metahub that will be linked to the connector */
    metahub: Metahub | null
    /** Loading state */
    isLoading?: boolean
    /** Whether connector is limited to single metahub (always true, locked) */
    isSingleMetahub?: boolean
    /** Whether connector requires at least one metahub (always true, locked) */
    isRequiredMetahub?: boolean
    /** Current UI locale for display */
    uiLocale?: string
    /** Optional info message to display */
    infoMessage?: string
}

/**
 * Panel for displaying locked Metahub info when creating Publication from Metahub context.
 * Uses EntitySelectionPanel for consistent UI with other selection panels (like HubSelectionPanel).
 * 
 * This panel is read-only because:
 * - The Metahub is determined by the URL context (metahubId)
 * - isSingleMetahub and isRequiredMetahub are temporarily locked to 'true'
 */
export const MetahubInfoPanel = ({
    metahub,
    isLoading = false,
    isSingleMetahub = true,
    isRequiredMetahub = true,
    uiLocale = 'en',
    infoMessage
}: MetahubInfoPanelProps) => {
    const { t } = useTranslation('metahubs')

    // Build available and selected arrays from the single metahub
    const availableMetahubs = useMemo(() => {
        return metahub ? [metahub] : []
    }, [metahub])

    const selectedMetahubIds = useMemo(() => {
        return metahub ? [metahub.id] : []
    }, [metahub])

    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('publications.create.metahubsTitle', 'Метахабы'),
            addButton: t('common.add', 'Добавить'),
            dialogTitle: t('publications.create.selectMetahub', 'Выберите метахаб'),
            emptyMessage: t('publications.create.noMetahubSelected', 'Метахаб не выбран'),
            noAvailableMessage: t('publications.create.noMetahubsAvailable', 'Нет доступных метахабов'),
            searchPlaceholder: t('common.search', 'Поиск...'),
            cancelButton: t('common.cancel', 'Отмена'),
            confirmButton: t('common.add', 'Добавить'),
            removeTitle: t('common.remove', 'Удалить'),
            nameHeader: t('table.name', 'Название'),
            codenameHeader: t('table.codename', 'Кодовое имя'),
            requiredLabel: t('publications.create.isRequiredMetahub', 'Обязательно'),
            requiredEnabledHelp: t('publications.create.isRequiredMetahubEnabled', 'Коннектор должен иметь хотя бы один связанный Метахаб'),
            requiredDisabledHelp: t('publications.create.isRequiredMetahubDisabled', 'Коннектор может существовать без метахабов'),
            singleLabel: t('publications.create.isSingleMetahub', 'Один метахаб'),
            singleEnabledHelp: t('publications.create.isSingleMetahubEnabled', 'Коннектор может быть связан только с одним Метахабом'),
            singleDisabledHelp: t('publications.create.isSingleMetahubDisabled', 'Коннектор может отображаться в нескольких метахабах'),
            singleWarning: t('publications.create.isSingleMetahubWarning', 'Нельзя включить, пока выбрано несколько метахабов')
        }),
        [t]
    )

    const getDisplayName = (m: Metahub): string => {
        return getVLCString(m.name, uiLocale) || getVLCString(m.name, 'en') || m.codename
    }

    const getCodename = (m: Metahub): string => {
        return m.codename
    }

    // No-op handlers since the panel is disabled
    const handleSelectionChange = () => {}
    const handleRequiredChange = () => {}
    const handleSingleChange = () => {}

    if (isLoading) {
        return null
    }

    return (
        <Stack spacing={2}>
            {/* Info alert about locked settings */}
            <Alert severity="info" icon={<InfoIcon />}>
                {infoMessage || t('publications.create.metahubLocked', 'Связи с метахабами и ограничения сейчас заблокированы. Эта функциональность будет доступна в будущем обновлении.')}
            </Alert>

            <EntitySelectionPanel<Metahub>
                availableEntities={availableMetahubs}
                selectedIds={selectedMetahubIds}
                onSelectionChange={handleSelectionChange}
                getDisplayName={getDisplayName}
                getCodename={getCodename}
                labels={labels}
                disabled={true}
                isRequired={isRequiredMetahub}
                onRequiredChange={handleRequiredChange}
                isSingle={isSingleMetahub}
                onSingleChange={handleSingleChange}
            />
        </Stack>
    )
}

export default MetahubInfoPanel
