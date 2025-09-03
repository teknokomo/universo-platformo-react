import React, { useState, useEffect } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import useApi from 'flowise-ui/src/hooks/useApi'
import { getEntity, listEntityOwners, listEntityResources } from '../api/entities'
import { Entity, Owner, Resource, UseApi } from '../types'

const EntityDetail: React.FC = () => {
    const { t } = useTranslation('entities')
    const { entityId } = useParams<{ entityId: string }>()
    const [tab, setTab] = useState(0)
    const [entity, setEntity] = useState<Entity | null>(null)
    const [owners, setOwners] = useState<Owner[]>([])
    const [resources, setResources] = useState<Resource[]>([])
    const useTypedApi = useApi as UseApi
    const entityApi = useTypedApi<Entity>(getEntity)
    const { request: ownersRequest, ...ownersApi } = useTypedApi<Owner[]>(listEntityOwners)
    const { request: resourcesRequest, ...resourcesApi } = useTypedApi<Resource[]>(listEntityResources)

    useEffect(() => {
        if (entityId) {
            entityApi.request(entityId)
            ownersRequest(entityId)
            resourcesRequest(entityId)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entityId])

    useEffect(() => {
        if (entityApi.data) setEntity(entityApi.data)
    }, [entityApi.data])
    useEffect(() => {
        if (ownersApi.data) setOwners(ownersApi.data)
    }, [ownersApi.data])
    useEffect(() => {
        if (resourcesApi.data) setResources(resourcesApi.data)
    }, [resourcesApi.data])

    if (entityApi.loading) return <Typography>{t('detail.loading')}</Typography>
    if (entityApi.error) return <Typography color='error'>{t('detail.error')}</Typography>

    return (
        <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label={t('detail.info')} />
                <Tab label={t('detail.owners')} />
                <Tab label={t('detail.resources')} />
            </Tabs>
            {tab === 0 && <Typography variant='body1'>{entity?.titleEn}</Typography>}
            {tab === 1 &&
                (ownersApi.loading ? (
                    <Typography>{t('detail.ownersLoading')}</Typography>
                ) : ownersApi.error ? (
                    <Typography color='error'>{t('detail.ownersError')}</Typography>
                ) : (
                    <Box display='flex' flexDirection='column' gap={1}>
                        {owners.map((o) => (
                            <Typography key={o.id}>{o.userId}</Typography>
                        ))}
                    </Box>
                ))}
            {tab === 2 &&
                (resourcesApi.loading ? (
                    <Typography>{t('detail.resourcesLoading')}</Typography>
                ) : resourcesApi.error ? (
                    <Typography color='error'>{t('detail.resourcesError')}</Typography>
                ) : (
                    <Box display='flex' flexDirection='column' gap={1}>
                        {resources.map((r) => (
                            <Typography key={r.id}>{r.titleEn}</Typography>
                        ))}
                    </Box>
                ))}
        </Box>
    )
}

export default EntityDetail
