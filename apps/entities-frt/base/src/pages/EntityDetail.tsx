import React, { useState, useEffect } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import useApi from 'flowise-ui/src/hooks/useApi'
import { ResourceConfigTree } from '@universo/resources-frt'
import { getEntity } from '../api/entities'

const EntityDetail: React.FC = () => {
    const { t } = useTranslation('entities')
    const { id } = useParams<{ id: string }>()
    const [tab, setTab] = useState(0)
    const [entity, setEntity] = useState<any>(null)
    const entityApi = useApi(getEntity)

    useEffect(() => {
        if (id) entityApi.request(id)
    }, [id, entityApi])

    useEffect(() => {
        if (entityApi.data) setEntity(entityApi.data)
    }, [entityApi.data])

    if (entityApi.loading) return <Typography>{t('detail.loading')}</Typography>
    if (entityApi.error) return <Typography color='error'>{t('detail.error')}</Typography>

    return (
        <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label={t('detail.info')} />
                <Tab label={t('detail.owners')} />
                <Tab label={t('detail.resources')} />
            </Tabs>
            {tab === 0 && <Typography variant='body1'>{entity?.name}</Typography>}
            {tab === 1 && <Typography variant='body1'>{(entity?.owners || []).join(', ')}</Typography>}
            {tab === 2 && <ResourceConfigTree />}
        </Box>
    )
}

export default EntityDetail
