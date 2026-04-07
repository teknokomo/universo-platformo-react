import { useState } from 'react'
import { Box, Tab, Tabs } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { TemplateMainCard as MainCard, PAGE_CONTENT_GUTTER_MX, PAGE_TAB_BAR_SX, ViewHeaderMUI as ViewHeader } from '@universo/template-mui'

import { LayoutListContent } from '../../layouts/ui/LayoutList'

type GeneralTab = 'layouts'

export default function GeneralPage() {
    const { metahubId } = useParams<{ metahubId: string }>()
    const { t } = useTranslation('metahubs')
    const [activeTab, setActiveTab] = useState<GeneralTab>('layouts')

    return (
        <MainCard disableHeader border={false} shadow={false} contentSX={{ px: 0, py: 0 }} disableContentPadding>
            <ViewHeader title={t('general.title', 'Common')} />

            <Box data-testid='metahub-common-tabs' sx={PAGE_TAB_BAR_SX}>
                <Tabs
                    value={activeTab}
                    onChange={(_, nextValue: GeneralTab) => setActiveTab(nextValue)}
                    variant='scrollable'
                    scrollButtons='auto'
                >
                    <Tab value='layouts' label={t('general.tabs.layouts', 'Layouts')} />
                </Tabs>
            </Box>

            <Box data-testid='metahub-common-content' sx={{ py: 2, mx: PAGE_CONTENT_GUTTER_MX }}>
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
            </Box>
        </MainCard>
    )
}
