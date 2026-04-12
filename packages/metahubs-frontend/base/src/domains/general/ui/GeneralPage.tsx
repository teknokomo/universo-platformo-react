import { useState } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { SHARED_OBJECT_KINDS } from '@universo/types'

import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { AttributeListContent } from '../../attributes/ui/AttributeList'
import { ConstantListContent } from '../../constants/ui/ConstantList'
import { EnumerationValueListContent } from '../../enumerations/ui/EnumerationValueList'
import { LayoutListContent } from '../../layouts/ui/LayoutList'
import { EntityScriptsTab } from '../../scripts/ui/EntityScriptsTab'
import { useSharedContainerIds } from '../../shared/hooks/useSharedContainerIds'

type GeneralTab = 'layouts' | 'attributes' | 'constants' | 'values' | 'scripts'

export default function GeneralPage() {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t } = useTranslation('metahubs')
    const [activeTab, setActiveTab] = useState<GeneralTab>('layouts')
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
                <AttributeListContent
                    metahubId={metahubId}
                    catalogId={objectId}
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
                <ConstantListContent
                    metahubId={metahubId}
                    setId={objectId}
                    title={null}
                    sharedEntityMode
                    renderPageShell={false}
                    showSettingsTab={false}
                />
            )
        }

        return (
            <EnumerationValueListContent
                metahubId={metahubId}
                enumerationId={objectId}
                title={null}
                sharedEntityMode
                renderPageShell={false}
                showSettingsTab={false}
            />
        )
    }

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('general.title', 'Common')} />

            <Box data-testid='metahub-common-tabs' sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, nextValue: GeneralTab) => setActiveTab(nextValue)}
                    variant='scrollable'
                    scrollButtons='auto'
                >
                    <Tab value='layouts' label={t('general.tabs.layouts', 'Layouts')} />
                    <Tab value='attributes' label={t('general.tabs.attributes', 'Attributes')} />
                    <Tab value='constants' label={t('general.tabs.constants', 'Constants')} />
                    <Tab value='values' label={t('general.tabs.values', 'Values')} />
                    <Tab value='scripts' label={t('general.tabs.scripts', 'Scripts')} />
                </Tabs>
            </Box>

            <Box data-testid='metahub-common-content' sx={{ py: 2 }}>
                {activeTab === 'layouts' ? (
                    <LayoutListContent
                        metahubId={metahubId}
                        detailBasePath={metahubId ? `/metahub/${metahubId}/common/layouts` : ''}
                        title={null}
                        embedded
                        compactHeader={false}
                        renderPageShell={false}
                    />
                ) : null}
                {activeTab === 'attributes' ? renderSharedContent('SHARED_CATALOG_POOL') : null}
                {activeTab === 'constants' ? renderSharedContent('SHARED_SET_POOL') : null}
                {activeTab === 'values' ? renderSharedContent('SHARED_ENUM_POOL') : null}
                {activeTab === 'scripts' ? (
                    <EntityScriptsTab metahubId={metahubId} attachedToKind='general' attachedToId={null} t={t} />
                ) : null}
            </Box>
        </MainCard>
    )
}
