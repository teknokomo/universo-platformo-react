import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EntitySelectionPanel, type EntitySelectionLabels } from '@universo/template-mui'
import type { PublicationSummary } from '../types'
import { getVLCString } from '../types'

export interface PublicationSelectionPanelProps {
    /**
     * List of all available publications (with metahub info).
     * Each publication represents a metahub that can be connected.
     * UI shows metahub names, but internally we track publication IDs.
     */
    availablePublications: PublicationSummary[]
    /** Currently selected publication IDs (internal, represents the metahub link) */
    selectedPublicationIds: string[]
    /** Callback when selection changes (returns publication IDs) */
    onSelectionChange: (publicationIds: string[]) => void
    /** Whether connector must have at least one metahub */
    isRequiredPublication: boolean
    /** Callback when isRequiredPublication changes */
    onRequiredPublicationChange: (value: boolean) => void
    /** Whether connector is restricted to single metahub */
    isSinglePublication: boolean
    /** Callback when isSinglePublication changes */
    onSinglePublicationChange: (value: boolean) => void
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
 * Displays available metahubs (that have publications) for selection.
 * UI shows metahub names to users, but internally tracks publication IDs
 * since the actual database link is Connector -> Publication.
 *
 * This is a thin wrapper around EntitySelectionPanel with Metahub-specific configuration.
 */
export const PublicationSelectionPanel = ({
    availablePublications,
    selectedPublicationIds,
    onSelectionChange,
    isRequiredPublication,
    onRequiredPublicationChange,
    isSinglePublication,
    onSinglePublicationChange,
    disabled = false,
    togglesDisabled = false,
    error,
    uiLocale = 'en'
}: PublicationSelectionPanelProps) => {
    const { t } = useTranslation('applications')

    // Labels use "Metahub" terminology for user-facing text
    const labels: EntitySelectionLabels = useMemo(
        () => ({
            title: t('connectors.metahubs.title', 'Linked Metahubs'),
            addButton: t('connectors.metahubs.add', 'Add Metahub'),
            dialogTitle: t('connectors.create.selectMetahub', 'Select Metahub'),
            emptyMessage: t('connectors.metahubs.noLinked', 'No metahubs linked yet'),
            noAvailableMessage: t('connectors.create.noMetahubsAvailable', 'No metahubs available'),
            searchPlaceholder: t('common.search', 'Search...'),
            cancelButton: t('common.cancel', 'Cancel'),
            confirmButton: t('connectors.metahubs.add', 'Add Metahub'),
            removeTitle: t('connectors.metahubs.remove', 'Remove link'),
            nameHeader: t('table.name', 'Name'),
            codenameHeader: t('table.codename', 'Codename'),
            requiredLabel: t('connectors.metahubs.required', 'Required'),
            requiredEnabledHelp: t('connectors.metahubInfo.isRequiredHelp', 'Connector must have at least one Metahub linked'),
            requiredDisabledHelp: t('connectors.metahubs.isRequiredDisabled', 'Connector can exist without metahubs'),
            singleLabel: t('connectors.metahubs.singleLimit', 'Single metahub'),
            singleEnabledHelp: t('connectors.metahubInfo.isSingleHelp', 'Connector can only be linked to one Metahub'),
            singleDisabledHelp: t('connectors.metahubs.isSingleDisabled', 'Connector can be linked to multiple metahubs'),
            singleWarning: t('connectors.metahubs.isSingleWarning', 'Cannot enable while multiple metahubs are selected')
        }),
        [t]
    )

    // Display the metahub name (not publication name) to users
    const getDisplayName = (publication: PublicationSummary): string => {
        // Show metahub name - this is what users see
        if (publication.metahub) {
            return (
                getVLCString(publication.metahub.name, uiLocale) ||
                getVLCString(publication.metahub.name, 'en') ||
                publication.metahub.codename
            )
        }
        // Fallback to publication name if metahub not populated
        return getVLCString(publication.name, uiLocale) || getVLCString(publication.name, 'en') || publication.codename
    }

    // Display the metahub codename
    const getCodename = (publication: PublicationSummary): string => {
        return publication.metahub?.codename || publication.codename
    }

    return (
        <EntitySelectionPanel<PublicationSummary>
            availableEntities={availablePublications}
            selectedIds={selectedPublicationIds}
            onSelectionChange={onSelectionChange}
            getDisplayName={getDisplayName}
            getCodename={getCodename}
            labels={labels}
            disabled={disabled}
            togglesDisabled={togglesDisabled}
            error={error}
            isRequired={isRequiredPublication}
            onRequiredChange={onRequiredPublicationChange}
            isSingle={isSinglePublication}
            onSingleChange={onSinglePublicationChange}
        />
    )
}

export default PublicationSelectionPanel
