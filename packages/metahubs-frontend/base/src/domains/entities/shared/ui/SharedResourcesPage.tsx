import { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { SHARED_OBJECT_KINDS } from '@universo/types'

import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { FieldDefinitionListContent } from '../../metadata/fieldDefinition/ui/FieldDefinitionList'
import { FixedValueListContent } from '../../metadata/fixedValue/ui/FixedValueList'
import { SelectableOptionListContent } from '../../metadata/optionValue/ui/SelectableOptionList'
import { LayoutListContent } from '../../../layouts/ui/LayoutList'
import { EntityScriptsTab } from '../../../scripts/ui/EntityScriptsTab'
import { useSharedContainerIds } from '../../../shared/hooks/useSharedContainerIds'

type SharedResourcesTab = 'layouts' | 'fieldDefinitions' | 'fixedValues' | 'optionValues' | 'scripts'

export default function SharedResourcesPage() {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t } = useTranslation('metahubs')
    const [activeTab, setActiveTab] = useState<SharedResourcesTab>('layouts')
    const sharedContainerIdsQuery = useSharedContainerIds(metahubId)

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
                    value={activeTab}
                    onChange={(_, nextValue: SharedResourcesTab) => setActiveTab(nextValue)}
                    variant='scrollable'
                    scrollButtons='auto'
                >
                    <Tab value='layouts' label={t('general.tabs.layouts', 'Layouts')} />
                    <Tab value='fieldDefinitions' label={t('general.tabs.fieldDefinitions', 'Field definitions')} />
                    <Tab value='fixedValues' label={t('general.tabs.fixedValues', 'Fixed values')} />
                    <Tab value='optionValues' label={t('general.tabs.optionValues', 'Option values')} />
                    <Tab value='scripts' label={t('general.tabs.scripts', 'Scripts')} />
                </Tabs>
            </Box>

            <Box data-testid='metahub-shared-resources-content' sx={{ py: 2 }}>
                {activeTab === 'layouts' ? (
                    <LayoutListContent
                        metahubId={metahubId}
                        detailBasePath={metahubId ? `/metahub/${metahubId}/resources/layouts` : ''}
                        title={null}
                        embedded
                        compactHeader={false}
                        renderPageShell={false}
                    />
                ) : null}
                {activeTab === 'fieldDefinitions' ? renderSharedContent('SHARED_CATALOG_POOL') : null}
                {activeTab === 'fixedValues' ? renderSharedContent('SHARED_SET_POOL') : null}
                {activeTab === 'optionValues' ? renderSharedContent('SHARED_ENUM_POOL') : null}
                {activeTab === 'scripts' ? (
                    <EntityScriptsTab metahubId={metahubId} attachedToKind='general' attachedToId={null} t={t} />
                ) : null}
            </Box>
        </MainCard>
    )
}
