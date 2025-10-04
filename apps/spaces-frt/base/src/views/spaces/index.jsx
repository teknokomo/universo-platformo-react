// English-only comments
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports (reuse core UI via '@' alias from UI app)
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing, baseURL } from '@/store/constant'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import { StyledButton } from '@/ui-component/button/StyledButton'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'

// API
import spacesApi from '../../api/spaces'

// Hooks
import useApi from '../../hooks/useApi'
import { useAuthError } from '@/hooks/useAuthError'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

const Spaces = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const { t } = useTranslation()
  const { unikId } = useParams()
  const location = useLocation()
  const [isLoading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [images, setImages] = useState({})
  const [search, setSearch] = useState('')

  const getAllSpacesApi = useApi(() => spacesApi.getAllSpaces(unikId))
  const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')
  const { handleAuthError } = useAuthError()

  const spacesList = Array.isArray(getAllSpacesApi.data?.data?.spaces)
    ? getAllSpacesApi.data.data.spaces
    : Array.isArray(getAllSpacesApi.data)
    ? getAllSpacesApi.data
    : []

  const handleChange = (event, nextView) => {
    if (nextView === null) return
    localStorage.setItem('flowDisplayStyle', nextView)
    setView(nextView)
  }

  useEffect(() => {
    if (getAllSpacesApi.error) {
      if (!handleAuthError(getAllSpacesApi.error)) setError(getAllSpacesApi.error)
    }
  }, [getAllSpacesApi.error, handleAuthError])

  useEffect(() => {
    setLoading(getAllSpacesApi.loading)
  }, [getAllSpacesApi.loading])

  const onSearchChange = (event) => setSearch(event.target.value)

  function filterFlows(data) {
    const match =
      (data?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (data?.category && data.category.toLowerCase().includes(search.toLowerCase())) ||
      (data?.id || '').toLowerCase().includes(search.toLowerCase())
    return match
  }

  const addNew = () => {
    localStorage.setItem('parentUnikId', unikId)
    navigate(`/unik/${unikId}/spaces/new`)
  }

  const goToCanvas = (selectedSpace) => {
    navigate(`/unik/${unikId}/space/${selectedSpace.id}`)
  }

  useEffect(() => {
    if (location.state && location.state.templateFlowData) {
      navigate(`/unik/${unikId}/spaces/new`, { state: { templateFlowData: location.state.templateFlowData } })
      return
    }
    if (unikId) getAllSpacesApi.request()
  }, [unikId, location.state, navigate])

  useEffect(() => {
    if (!getAllSpacesApi.data) return
    try {
      const spaces = getAllSpacesApi.data?.data?.spaces || getAllSpacesApi.data || []
      const imgMap = {}
      for (let i = 0; i < spaces.length; i += 1) {
        imgMap[spaces[i].id] = []
        const firstCanvas = spaces[i].canvases?.[0]
        if (firstCanvas?.flowData) {
          const flowData = JSON.parse(firstCanvas.flowData)
          const nodes = flowData.nodes || []
          for (let j = 0; j < nodes.length; j += 1) {
            const src = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
            if (!imgMap[spaces[i].id].includes(src)) imgMap[spaces[i].id].push(src)
          }
        }
      }
      setImages(imgMap)
    } catch (e) {
      // do nothing on parse failure
    }
  }, [getAllSpacesApi.data])

  return (
    <MainCard>
      {error ? (
        <ErrorBoundary error={error} />
      ) : (
        <Stack flexDirection='column' sx={{ gap: 3 }}>
          <ViewHeader
            onSearchChange={onSearchChange}
            search={true}
            searchPlaceholder={t('common.search') + ' ' + t('spaces', 'Spaces')}
            title={t('spaces', 'Spaces')}
          >
            <ToggleButtonGroup sx={{ borderRadius: 2, maxHeight: 40 }} value={view} color='primary' exclusive onChange={handleChange}>
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
              {isLoading && !getAllSpacesApi.data ? (
                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                  <Skeleton variant='rounded' height={160} />
                  <Skeleton variant='rounded' height={160} />
                  <Skeleton variant='rounded' height={160} />
                </Box>
              ) : (
                <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                  {spacesList.filter(filterFlows).map((data, index) => (
                    <ItemCard key={index} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} />
                  ))}
                </Box>
              )}
            </>
          ) : (
            <FlowListTable
              data={spacesList}
              images={images}
              isLoading={isLoading}
              filterFunction={filterFlows}
              updateFlowsApi={getAllSpacesApi}
              setError={setError}
            />
          )}
          {!isLoading && spacesList.length === 0 && (
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
