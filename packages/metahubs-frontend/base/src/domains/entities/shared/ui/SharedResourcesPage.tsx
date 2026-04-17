import { useMemo, useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { isEnabledComponentConfig, type ComponentManifest, SHARED_OBJECT_KINDS } from '@universo/types'

import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { FieldDefinitionListContent } from '../../metadata/fieldDefinition/ui/FieldDefinitionList'
import { FixedValueListContent } from '../../metadata/fixedValue/ui/FixedValueList'
import { SelectableOptionListContent } from '../../metadata/optionValue/ui/SelectableOptionList'
import { LayoutListContent } from '../../../layouts/ui/LayoutList'
import { EntityScriptsTab } from '../../../scripts/ui/EntityScriptsTab'
import { useSharedContainerIds } from '../../../shared/hooks/useSharedContainerIds'
import { useEntityTypesQuery } from '../../hooks/queries'

type SharedResourcesTab = 'layouts' | 'fieldDefinitions' | 'fixedValues' | 'optionValues' | 'scripts'

interface TabConfig {
    value: SharedResourcesTab
    labelKey: string
    labelFallback: string
    visible: boolean
}

function hasAnyEnabledComponent(manifests: ComponentManifest[], component: keyof ComponentManifest): boolean {
    return manifests.some((m) => isEnabledComponentConfig(m[component]))
}

export default function SharedResourcesPage() {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t } = useTranslation('metahubs')
    const [activeTab, setActiveTab] = useState<SharedResourcesTab>('layouts')
    const sharedContainerIdsQuery = useSharedContainerIds(metahubId)

    const entityTypesQuery = useEntityTypesQuery(metahubId, { limit: 100 })

    const tabs = useMemo<TabConfig[]>(() => {
        const manifests = (entityTypesQuery.data?.items ?? []).map((et) => et.components)

        return [
            { value: 'layouts', labelKey: 'general.tabs.layouts', labelFallback: 'Layouts', visible: true },
            {
                value: 'fieldDefinitions',
                labelKey: 'general.tabs.fieldDefinitions',
                labelFallback: 'Field definitions',
                visible: hasAnyEnabledComponent(manifests, 'dataSchema')
            },
            {
                value: 'fixedValues',
                labelKey: 'general.tabs.fixedValues',
                labelFallback: 'Fixed values',
                visible: hasAnyEnabledComponent(manifests, 'fixedValues')
            },
            {
                value: 'optionValues',
                labelKey: 'general.tabs.optionValues',
                labelFallback: 'Option values',
                visible: hasAnyEnabledComponent(manifests, 'optionValues')
            },
            { value: 'scripts', labelKey: 'general.tabs.scripts', labelFallback: 'Scripts', visible: true }
        ]
    }, [entityTypesQuery.data?.items])

    const visibleTabs = tabs.filter((tab) => tab.visible)
    const effectiveTab = visibleTabs.some((tab) => tab.value === activeTab) ? activeTab : visibleTabs[0]?.value ?? 'layouts'

    const renderSharedTabPlaceholder = (message: string) => (
        <Box sx={{ py: 2 }}>
            <Typography variant='body2' color='text.secondary'>
                {message}
            </Typography>
        </Box>
    )

    const renderSharedContent = (kind: keyof typeof SHARED_OBJECT_KINDS) => {
        if (sharedContainerIdsQuery.isLoading) {
            return renderSharedTabPlaceholder(t('general.shared.loading', 'Loading shared entities...'))
        }

        if (sharedContainerIdsQuery.error) {
            return renderSharedTabPlaceholder(t('general.shared.loadError', 'Failed to load shared containers.'))
        }

        const objectId = sharedContainerIdsQuery.data?.[SHARED_OBJECT_KINDS[kind]]
        if (!objectId) {
            return renderSharedTabPlaceholder(t('general.shared.empty', 'Shared container is unavailable.'))
        }

        if (kind === 'SHARED_CATALOG_POOL') {
            return (
                <FieldDefinitionListContent
                    metahubId={metahubId}
                    linkedCollectionId={objectId}
                    title={null}
                    sharedEntityMode
                    renderPageShell={false}
                    showCatalogTabs={false}
                    showSettingsTab={false}
                    allowSystemTab={false}
                />
            )
        }

        if (kind === 'SHARED_SET_POOL') {
            return (
                <FixedValueListContent
                    metahubId={metahubId}
                    valueGroupId={objectId}
                    title={null}
                    sharedEntityMode
                    renderPageShell={false}
                    showSettingsTab={false}
                />
            )
        }

        return (
            <SelectableOptionListContent
                metahubId={metahubId}
                optionListId={objectId}
                title={null}
                sharedEntityMode
                renderPageShell={false}
                showSettingsTab={false}
            />
        )
    }

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('general.title', 'Resources')} />

            <Box data-testid='metahub-shared-resources-tabs' sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={effectiveTab}
                    onChange={(_, nextValue: SharedResourcesTab) => setActiveTab(nextValue)}
                    variant='scrollable'
                    scrollButtons='auto'
                >
                    {visibleTabs.map((tab) => (
                        <Tab key={tab.value} value={tab.value} label={t(tab.labelKey, tab.labelFallback)} />
                    ))}
                </Tabs>
            </Box>

            <Box data-testid='metahub-shared-resources-content' sx={{ py: 2 }}>
                {effectiveTab === 'layouts' ? (
                    <LayoutListContent
                        metahubId={metahubId}
                        detailBasePath={metahubId ? `/metahub/${metahubId}/resources/layouts` : ''}
                        title={null}
                        embedded
                        compactHeader={false}
                        renderPageShell={false}
                    />
                ) : null}
                {effectiveTab === 'fieldDefinitions' ? renderSharedContent('SHARED_CATALOG_POOL') : null}
                {effectiveTab === 'fixedValues' ? renderSharedContent('SHARED_SET_POOL') : null}
                {effectiveTab === 'optionValues' ? renderSharedContent('SHARED_ENUM_POOL') : null}
                {effectiveTab === 'scripts' ? (
                    <EntityScriptsTab metahubId={metahubId} attachedToKind='general' attachedToId={null} t={t} />
                ) : null}
            </Box>
        </MainCard>
    )
}
