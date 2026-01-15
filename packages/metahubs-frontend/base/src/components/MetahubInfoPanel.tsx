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
            title: t('publications.create.metahubsTitle', 'Metahubs'),
            addButton: t('common.add', 'Add'),
            dialogTitle: t('publications.create.selectMetahub', 'Select a metahub'),
            emptyMessage: t('publications.create.noMetahubSelected', 'No metahub selected'),
            noAvailableMessage: t('publications.create.noMetahubsAvailable', 'No metahubs available'),
            searchPlaceholder: t('common.search', 'Search...'),
            cancelButton: t('common.cancel', 'Cancel'),
            confirmButton: t('common.add', 'Add'),
            removeTitle: t('common.remove', 'Remove'),
            nameHeader: t('table.name', 'Name'),
            codenameHeader: t('table.codename', 'Codename'),
            requiredLabel: t('publications.create.isRequiredMetahub', 'Required'),
            requiredEnabledHelp: t('publications.create.isRequiredMetahubEnabled', 'Connector must have at least one linked Metahub'),
            requiredDisabledHelp: t('publications.create.isRequiredMetahubDisabled', 'Connector can exist without metahubs'),
            singleLabel: t('publications.create.isSingleMetahub', 'Single metahub'),
            singleEnabledHelp: t('publications.create.isSingleMetahubEnabled', 'Connector can be linked to only one Metahub'),
            singleDisabledHelp: t('publications.create.isSingleMetahubDisabled', 'Connector can appear in multiple metahubs'),
            singleWarning: t('publications.create.isSingleMetahubWarning', 'Cannot enable while multiple metahubs are selected')
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
            <Alert severity='info' icon={<InfoIcon />}>
                {infoMessage ||
                    t(
                        'publications.create.metahubLocked',
                        'Metahub connections and restrictions are currently locked. This functionality will be available in a future update.'
                    )}
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
