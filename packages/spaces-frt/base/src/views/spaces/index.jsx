// English-only comments
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from '@universo/i18n/hooks'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import { MainCard, ItemCard, ConfirmDialog, StyledButton, FlowListTable } from '@flowise/template-mui'
import { gridSpacing } from '@flowise/template-mui'
import { WorkflowEmptySVG } from '@flowise/template-mui'
import { ViewHeaderMUI as ViewHeader } from '@flowise/template-mui'
import { ErrorBoundary } from '@flowise/template-mui'
import { useSpacesQuery } from '@universo/spaces-frt'

// API
import { api } from '@universo/api-client'

// Hooks - use TypeScript version from spaces-frt package
import useApi from '@universo/spaces-frt/src/hooks/useApi'
import { useAuthError } from '@universo/auth-frt'

// Utils
import { getApiBaseURL } from '@universo/utils'
const baseURL = getApiBaseURL()

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

const buildImagePreviewMap = (spaces = []) => {
  const imageMap = {}

  if (!Array.isArray(spaces)) return imageMap

  spaces.forEach((space) => {
    const spaceId = space?.id
    if (!spaceId) return

    imageMap[spaceId] = []
    const firstCanvas = space?.canvases?.[0]
    if (!firstCanvas?.flowData) return

    try {
      const flowData = typeof firstCanvas.flowData === 'string' ? JSON.parse(firstCanvas.flowData) : firstCanvas.flowData
      const nodes = Array.isArray(flowData?.nodes) ? flowData.nodes : []
      nodes.forEach((node) => {
        const name = node?.data?.name
        if (!name) return
        const src = `${baseURL}/api/v1/node-icon/${name}`
        if (!imageMap[spaceId].includes(src)) {
          imageMap[spaceId].push(src)
        }
      })
    } catch {
      // Ignore malformed flow data
    }
  })

  return imageMap
}

const filterFlowsFactory = (search) => {
  const query = search.trim().toLowerCase()
  if (!query) return () => true

  return (data) => {
    const name = (data?.name || '').toLowerCase()
    const category = (data?.category || '').toLowerCase()
    const id = (data?.id || '').toLowerCase()
    return name.includes(query) || category.includes(query) || id.includes(query)
  }
}

const Spaces = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const { t } = useTranslation()
  const { unikId } = useParams()
  const location = useLocation()

  const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [images, setImages] = useState({})

  const { handleAuthError } = useAuthError()
  const { data: spacesList = [], isLoading, isFetching, error: queryError, refetch } = useSpacesQuery(unikId)

  const loading = isLoading || isFetching

  useEffect(() => {
    localStorage.setItem('parentUnikId', unikId ?? '')
  }, [unikId])

  useEffect(() => {
    if (location.state?.templateFlowData && unikId) {
      navigate(`/unik/${unikId}/spaces/new`, { state: { templateFlowData: location.state.templateFlowData } })
    }
  }, [unikId, location.state, navigate])

  useEffect(() => {
    if (queryError) {
      if (!handleAuthError(queryError)) {
        setError(queryError)
      }
    } else {
      setError(null)
    }
  }, [queryError, handleAuthError])

  useEffect(() => {
    setImages(buildImagePreviewMap(spacesList))
  }, [spacesList])

  const handleChangeView = (_event, nextView) => {
    if (!nextView) return
    localStorage.setItem('flowDisplayStyle', nextView)
    setView(nextView)
  }

  const onSearchChange = (event) => setSearch(event.target.value)
  const filterFlows = useMemo(() => filterFlowsFactory(search), [search])

  const addNew = () => {
    if (!unikId) return
    localStorage.setItem('parentUnikId', unikId)
    navigate(`/unik/${unikId}/spaces/new`)
  }

  const goToCanvas = (selectedSpace) => {
    if (!unikId || !selectedSpace?.id) return
    navigate(`/unik/${unikId}/space/${selectedSpace.id}`)
  }

  const tableRefreshAdapter = useMemo(
    () => ({
      async request() {
        const result = await refetch()
        return result.data ?? []
      },
      get loading() {
        return isFetching
      },
      get data() {
        return spacesList
      },
      get error() {
        return queryError
      }
    }),
    [refetch, isFetching, spacesList, queryError]
  )

  return (
    <MainCard>
      {error ? (
        <ErrorBoundary error={error} />
      ) : (
        <Stack flexDirection='column' sx={{ gap: 3 }}>
          <ViewHeader
            onSearchChange={onSearchChange}
            search
            searchPlaceholder={`${t('common.search')} ${t('spaces', 'Spaces')}`}
            title={t('spaces', 'Spaces')}
          >
            <ToggleButtonGroup
              sx={{ borderRadius: 2, maxHeight: 40 }}
              value={view}
              color='primary'
              exclusive
              onChange={handleChangeView}
            >
              <ToggleButton sx={{ borderRadius: 2 }} variant='contained' value='card' title={t('common.cardView')}>
                <IconLayoutGrid />
              </ToggleButton>
              <ToggleButton sx={{ borderRadius: 2 }} variant='contained' value='list' title={t('common.listView')}>
                <IconList />
              </ToggleButton>
            </ToggleButtonGroup>
            <StyledButton variant='contained' onClick={addNew} startIcon={<IconPlus />} sx={{ borderRadius: 2, height: 40 }}>
              {t('common.addNew')}
            </StyledButton>
          </ViewHeader>
          {!view || view === 'card' ? (
            <>
              {loading && spacesList.length === 0 ? (
                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                  <Skeleton variant='rounded' height={160} />
                  <Skeleton variant='rounded' height={160} />
                  <Skeleton variant='rounded' height={160} />
                </Box>
              ) : (
                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                  {spacesList.filter(filterFlows).map((data) => (
                    <ItemCard key={data.id ?? data.name} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} />
                  ))}
                </Box>
              )}
            </>
          ) : (
            <FlowListTable
              data={spacesList}
              images={images}
              isLoading={loading}
              filterFunction={filterFlows}
              updateFlowsApi={tableRefreshAdapter}
              setError={setError}
            />
          )}
          {!loading && spacesList.length === 0 && (
            <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
              <Box sx={{ p: 2, height: 'auto' }}>
                <img src={WorkflowEmptySVG} alt='WorkflowEmptySVG' width='85' />
              </Box>
              <Box sx={{ color: theme.palette.grey[700] }}>{t('canvases:canvases.noCanvasesYet', 'Нет данных')}</Box>
            </Stack>
          )}
          <ConfirmDialog
            open={false}
            title={'dummy'}
            content={'dummy'}
            onCancel={() => {}}
            onConfirm={() => {}}
          />
        </Stack>
      )}
    </MainCard>
  )
}

export default Spaces
