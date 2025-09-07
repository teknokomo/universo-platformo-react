import React, { useState, useEffect } from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import useApi from 'flowise-ui/src/hooks/useApi'
import { getEntity, listEntityOwners, listEntityResources } from '../api/entities'
import { Entity, Owner, Resource, UseApi } from '../types'

interface ApiContentProps<T extends { id: string | number }> {
  api: { loading: boolean; error: unknown; data: T[] | null }
  loadingMessage: string
  errorMessage: string
  emptyMessage?: string
  renderItem: (item: T) => React.ReactNode
}

function ApiContent<T extends { id: string | number }>({
  api,
  loadingMessage,
  errorMessage,
  emptyMessage,
  renderItem
}: ApiContentProps<T>) {
  if (api.loading) {
    return <Typography>{loadingMessage}</Typography>
  }
  if (api.error) {
    return <Typography color='error'>{errorMessage}</Typography>
  }
  if (!api.data?.length) {
    return emptyMessage ? <Typography>{emptyMessage}</Typography> : null
  }
  return (
    <Box display='flex' flexDirection='column' gap={1}>
      {api.data.map(renderItem)}
    </Box>
  )
}

const EntityDetail: React.FC = () => {
    const { t } = useTranslation('entities')
    const { entityId } = useParams<{ entityId: string }>()
    const [tab, setTab] = useState(0)
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
    }, [entityId, entityApi.request, ownersRequest, resourcesRequest])

    if (entityApi.loading) return <Typography>{t('detail.loading')}</Typography>
    if (entityApi.error) return <Typography color='error'>{t('detail.error')}</Typography>

    return (
        <Box>
            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                <Tab label={t('detail.info')} />
                <Tab label={t('detail.owners')} />
                <Tab label={t('detail.resources')} />
            </Tabs>
            {tab === 0 && <Typography variant='body1'>{entityApi.data?.titleEn}</Typography>}
            {tab === 1 && (
                <ApiContent
                    api={ownersApi}
                    loadingMessage={t('detail.ownersLoading')}
                    errorMessage={t('detail.ownersError')}
                    emptyMessage={t('detail.ownersEmpty')}
                    renderItem={(o: Owner) => <Typography key={o.id}>{o.userId}</Typography>}
                />
            )}
            {tab === 2 && (
                <ApiContent
                    api={resourcesApi}
                    loadingMessage={t('detail.resourcesLoading')}
                    errorMessage={t('detail.resourcesError')}
                    emptyMessage={t('detail.resourcesEmpty')}
                    renderItem={(r: Resource) => <Typography key={r.id}>{r.titleEn}</Typography>}
                />
            )}
        </Box>
    )
}

export default EntityDetail
