import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { Breadcrumbs, Card, CircularProgress, Link, Stack, Typography, Button } from '@mui/material'
import { IconArrowLeft } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'

// ui imports
import ErrorBoundary from '@ui/ErrorBoundary'

import { useApi } from '../hooks/useApi'
import * as resourcesApi from '../api/resources'
import { Resource } from '../types'

const ResourceDetail: React.FC = () => {
  const { resourceId, clusterId } = useParams<{ resourceId: string; clusterId?: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('resources')

  const { request: getResource } = useApi(resourcesApi.getResource)

  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState<any>(null)
  const [resource, setResource] = useState<Resource | null>(null)

  useEffect(() => {
    const fetch = async () => {
      if (!resourceId) return
      try {
        setLoading(true)
        setError(null)
        const res = await getResource(resourceId)
        setResource(res)
      } catch (err: any) {
        setError(err)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [resourceId, getResource])

  return (
    <Card sx={{ background: 'transparent', maxWidth: '960px', mx: 'auto', p: 1.25 }}>
      {error ? (
        <ErrorBoundary error={error} />
      ) : (
        <Stack spacing={2}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              component={RouterLink}
              to={clusterId ? `/clusters/${clusterId}/resources` : '/resources'}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <IconArrowLeft size={16} />
              {t('resources.title')}
            </Link>
            <Typography color="text.primary">{resource?.name || t('detail.info')}</Typography>
          </Breadcrumbs>

          {isLoading ? (
            <Stack direction="row" alignItems="center" justifyContent="center" sx={{ py: 6 }}>
              <CircularProgress size={24} />
            </Stack>
          ) : (
            <>
              <Typography variant="h4" gutterBottom>
                {resource?.name}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {resource?.description || '\u2014'}
              </Typography>
            </>
          )}

          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate(-1)}>{t('common.back')}</Button>
          </Stack>
        </Stack>
      )}
    </Card>
  )
}

export default ResourceDetail