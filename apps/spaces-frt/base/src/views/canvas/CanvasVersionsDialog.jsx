import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import moment from 'moment'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'

// material-ui
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import { IconEdit, IconPlayerPlay, IconTrash } from '@tabler/icons-react'

// hooks & api
import useApi from '../../hooks/useApi'
import useConfirm from '@/hooks/useConfirm'
import canvasVersionsApi from '../../api/canvasVersions'

// store actions
import {
  HIDE_CANVAS_DIALOG,
  SHOW_CANVAS_DIALOG,
  enqueueSnackbar as enqueueSnackbarAction
} from '@/store/actions'

const sortVersions = (versions) => {
  return [...versions].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1
    if (!a.isActive && b.isActive) return 1
    if (b.versionIndex !== a.versionIndex) return b.versionIndex - a.versionIndex
    const aTime = new Date(a.updatedDate || a.createdDate || 0).getTime()
    const bTime = new Date(b.updatedDate || b.createdDate || 0).getTime()
    return bTime - aTime
  })
}

const safeTrim = (value) => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length ? trimmed : undefined
}

const CanvasVersionsDialog = ({
  show,
  dialogProps,
  onCancel,
  onRefreshCanvases,
  onSelectCanvas,
  onActiveVersionChange
}) => {
  const portalElement = typeof document !== 'undefined' ? document.getElementById('portal') : null
  const dispatch = useDispatch()
  const { confirm } = useConfirm()
  const { t } = useTranslation('canvas')

  const [referenceCanvasId, setReferenceCanvasId] = useState(dialogProps?.canvasId || '')
  const [versions, setVersions] = useState([])
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')
  const [activate, setActivate] = useState(true)
  const [editingVersionId, setEditingVersionId] = useState(null)
  const [editLabel, setEditLabel] = useState('')
  const [editDescription, setEditDescription] = useState('')

  const unikId = dialogProps?.unikId
  const spaceId = dialogProps?.spaceId
  const canvasName = dialogProps?.canvasName

  const enqueueSnackbar = (payload) => dispatch(enqueueSnackbarAction(payload))

  const listVersionsApi = useApi(() =>
    referenceCanvasId ? canvasVersionsApi.list(unikId, spaceId, referenceCanvasId) : Promise.resolve({ data: [] })
  )
  const createVersionApi = useApi(canvasVersionsApi.create)
  const updateVersionApi = useApi(canvasVersionsApi.update)
  const activateVersionApi = useApi(canvasVersionsApi.activate)
  const deleteVersionApi = useApi(canvasVersionsApi.remove)

  const resetEditingState = () => {
    setEditingVersionId(null)
    setEditLabel('')
    setEditDescription('')
  }

  const handleOpenEdit = (version) => {
    setEditingVersionId(version.id)
    setEditLabel(version.versionLabel || '')
    setEditDescription(version.versionDescription || '')
  }

  useEffect(() => {
    setReferenceCanvasId(dialogProps?.canvasId || '')
  }, [dialogProps?.canvasId])

  useEffect(() => {
    resetEditingState()
  }, [referenceCanvasId])

  useEffect(() => {
    if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
    else dispatch({ type: HIDE_CANVAS_DIALOG })
    return () => dispatch({ type: HIDE_CANVAS_DIALOG })
  }, [show, dispatch])

  useEffect(() => {
    if (show && unikId && spaceId && referenceCanvasId) {
      listVersionsApi.request().catch(() => {
        enqueueSnackbar({
          message: t('versionsDialog.loadError', 'Failed to load versions'),
          options: { key: new Date().getTime() + Math.random(), variant: 'error' }
        })
      })
    } else {
      setVersions([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show, unikId, spaceId, referenceCanvasId])

  useEffect(() => {
    const raw = listVersionsApi.data
    if (!raw) {
      setVersions([])
      return
    }
    const items = Array.isArray(raw?.data?.versions) ? raw.data.versions : []
    setVersions(sortVersions(items))
  }, [listVersionsApi.data])

  useEffect(() => {
    if (!show) {
      setLabel('')
      setDescription('')
      setActivate(true)
      resetEditingState()
    }
  }, [show])

  const editingVersion = useMemo(
    () => versions.find((item) => item.id === editingVersionId) || null,
    [editingVersionId, versions]
  )

  const handleEditCancel = () => {
    resetEditingState()
  }

  const isBusy =
    listVersionsApi.loading ||
    createVersionApi.loading ||
    activateVersionApi.loading ||
    deleteVersionApi.loading ||
    updateVersionApi.loading

  const handleRefreshVersions = async () => {
    if (unikId && spaceId && referenceCanvasId) {
      await listVersionsApi.request()
    }
  }

  const handleEditSave = async () => {
    if (!unikId || !spaceId || !referenceCanvasId || !editingVersionId) return

    const trimmedLabel = (editLabel || '').trim()
    const trimmedDescription = (editDescription || '').trim()

    if (!trimmedLabel) {
      enqueueSnackbar({
        message: t('versionsDialog.updateEmptyLabel', 'Version label is required'),
        options: { key: new Date().getTime() + Math.random(), variant: 'error' }
      })
      return
    }

    try {
      const response = await updateVersionApi.request(
        unikId,
        spaceId,
        referenceCanvasId,
        editingVersionId,
        {
          label: trimmedLabel,
          description: trimmedDescription.length ? trimmedDescription : ''
        }
      )
      const version = response?.data || response
      if (!version?.id) {
        throw new Error('Invalid server response')
      }

      setVersions((prev) =>
        sortVersions(
          prev.map((item) => (item.id === version.id ? { ...item, ...version } : item))
        )
      )

      resetEditingState()

      if (typeof onRefreshCanvases === 'function') {
        try {
          await onRefreshCanvases()
        } catch (refreshError) {
          console.error('[CanvasVersionsDialog] Failed to refresh canvases after update', refreshError)
        }
      }

      await handleRefreshVersions()

      enqueueSnackbar({
        message: t('versionsDialog.updateSuccess', 'Version updated successfully'),
        options: { key: new Date().getTime() + Math.random(), variant: 'success' }
      })
    } catch (error) {
      enqueueSnackbar({
        message:
          error?.response?.data?.error ||
          error?.message ||
          t('versionsDialog.updateError', 'Failed to update version'),
        options: { key: new Date().getTime() + Math.random(), variant: 'error' }
      })
    }
  }

  const handleCreate = async () => {
    if (!unikId || !spaceId || !referenceCanvasId) return
    try {
      const payload = {
        label: safeTrim(label),
        description: safeTrim(description),
        activate
      }
      const response = await createVersionApi.request(unikId, spaceId, referenceCanvasId, payload)
      const version = response?.data || response
      if (!version?.id) {
        throw new Error('Invalid server response')
      }

      setLabel('')
      setDescription('')

      setVersions((prev) => {
        const cleared = activate ? prev.map((item) => ({ ...item, isActive: false })) : prev
        return sortVersions([...cleared, version])
      })

      if (activate) {
        await handleActivationSideEffects(version.id, version)
      } else {
        enqueueSnackbar({
          message: t('versionsDialog.createSuccess', 'Version saved successfully'),
          options: { key: new Date().getTime() + Math.random(), variant: 'success' }
        })
      }
      await handleRefreshVersions()
    } catch (error) {
      enqueueSnackbar({
        message:
          error?.response?.data?.error ||
          error?.message ||
          t('versionsDialog.createError', 'Failed to save version'),
        options: { key: new Date().getTime() + Math.random(), variant: 'error' }
      })
    }
  }

  const handleActivationSideEffects = async (versionId, activatedVersion) => {
    if (!unikId || !spaceId || !referenceCanvasId) return
    try {
      const response = activatedVersion
        ? { data: activatedVersion }
        : await activateVersionApi.request(unikId, spaceId, referenceCanvasId, versionId)
      const canvas = response?.data || response
      if (!canvas?.id) {
        throw new Error('Invalid activation response')
      }

      setVersions((prev) =>
        sortVersions(
          prev.map((item) => ({
            ...item,
            isActive: item.id === versionId
          }))
        )
      )

      setReferenceCanvasId(canvas.id)

      if (typeof onRefreshCanvases === 'function') {
        await onRefreshCanvases()
      }
      if (typeof onSelectCanvas === 'function') {
        onSelectCanvas(canvas.id)
      }
      if (typeof onActiveVersionChange === 'function') {
        onActiveVersionChange(canvas)
      }

      enqueueSnackbar({
        message: t('versionsDialog.activateSuccess', 'Version activated'),
        options: { key: new Date().getTime() + Math.random(), variant: 'success' }
      })
    } catch (error) {
      enqueueSnackbar({
        message:
          error?.response?.data?.error ||
          error?.message ||
          t('versionsDialog.activateError', 'Failed to activate version'),
        options: { key: new Date().getTime() + Math.random(), variant: 'error' }
      })
      throw error
    }
  }

  const handleActivate = async (versionId) => {
    await handleActivationSideEffects(versionId)
    await handleRefreshVersions()
  }

  const handleDelete = async (versionId) => {
    if (!unikId || !spaceId || !referenceCanvasId) return
    const confirmed = await confirm({
      title: t('versionsDialog.confirmDeleteTitle', 'Delete version'),
      description: t('versionsDialog.confirmDeleteDescription', 'Are you sure you want to delete this version? This action cannot be undone.')
    })
    if (!confirmed) return

    try {
      await deleteVersionApi.request(unikId, spaceId, referenceCanvasId, versionId)
      setVersions((prev) => prev.filter((item) => item.id !== versionId))
      enqueueSnackbar({
        message: t('versionsDialog.deleteSuccess', 'Version deleted'),
        options: { key: new Date().getTime() + Math.random(), variant: 'success' }
      })
      await handleRefreshVersions()
    } catch (error) {
      enqueueSnackbar({
        message:
          error?.response?.data?.error ||
          error?.message ||
          t('versionsDialog.deleteError', 'Failed to delete version'),
        options: { key: new Date().getTime() + Math.random(), variant: 'error' }
      })
    }
  }

  const activeVersionId = useMemo(() => versions.find((item) => item.isActive)?.id || null, [versions])
  const canDelete = useMemo(() => versions.length > 1, [versions])

  const component = show && portalElement ? (
    <Dialog
      open={show}
      fullWidth
      maxWidth='md'
      onClose={onCancel}
      aria-labelledby='canvas-versions-dialog-title'
    >
      <DialogTitle id='canvas-versions-dialog-title'>
        <Stack direction='row' spacing={1} alignItems='center'>
          <Typography variant='h6'>{t('versionsDialog.title', 'Canvas Versions')}</Typography>
          {canvasName && (
            <Chip size='small' label={canvasName} variant='outlined' sx={{ ml: 1 }} />
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Stack spacing={2}>
            <TextField
              label={t('versionsDialog.labelInput', 'Version label')}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              inputProps={{ maxLength: 200 }}
              fullWidth
            />
            <TextField
              label={t('versionsDialog.descriptionInput', 'Description (optional)')}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              inputProps={{ maxLength: 2000 }}
              fullWidth
              multiline
              minRows={2}
            />
            <FormControlLabel
              control={<Switch checked={activate} onChange={(event) => setActivate(event.target.checked)} />}
              label={t('versionsDialog.activateSwitch', 'Set as active version')}
            />
            <Stack direction='row' spacing={2}>
              <Button
                variant='contained'
                onClick={handleCreate}
                disabled={isBusy}
              >
                {t('versionsDialog.createButton', 'Save version')}
              </Button>
              {isBusy && <CircularProgress size={24} />}
            </Stack>
          </Stack>

          <Box>
            {versions.length === 0 ? (
              <Typography color='text.secondary'>
                {t('versionsDialog.empty', 'No versions available yet.')}
              </Typography>
            ) : (
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>{t('versionsDialog.table.label', 'Label')}</TableCell>
                      <TableCell>{t('versionsDialog.table.description', 'Description')}</TableCell>
                      <TableCell>{t('versionsDialog.table.created', 'Created')}</TableCell>
                      <TableCell>{t('versionsDialog.table.status', 'Status')}</TableCell>
                      <TableCell align='right'>{t('versionsDialog.table.actions', 'Actions')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versions.map((item) => {
                      const createdAt = item.createdDate ? moment(item.createdDate).format('YYYY-MM-DD HH:mm') : '—'
                      return (
                        <TableRow key={item.id} hover selected={item.isActive}>
                          <TableCell>
                            <Stack direction='row' spacing={1} alignItems='center'>
                              <Typography variant='subtitle2'>{item.versionLabel}</Typography>
                              {item.versionUuid && (
                                <Chip size='small' label={item.versionUuid.slice(0, 8)} variant='outlined' />
                              )}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2' color='text.secondary'>
                              {item.versionDescription || t('versionsDialog.noDescription', 'No description')}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2'>{createdAt}</Typography>
                          </TableCell>
                          <TableCell>
                            {item.isActive ? (
                              <Chip color='success' size='small' label={t('versionsDialog.active', 'Active')} />
                            ) : (
                              <Chip color='default' size='small' label={t('versionsDialog.inactive', 'Inactive')} />
                            )}
                          </TableCell>
                          <TableCell align='right'>
                            <Stack direction='row' spacing={1} justifyContent='flex-end'>
                              <Tooltip title={t('versionsDialog.editAction', 'Edit')}>
                                <span>
                                  <IconButton
                                    size='small'
                                    onClick={() => handleOpenEdit(item)}
                                    disabled={isBusy}
                                    color='primary'
                                  >
                                    <IconEdit size={18} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={t('versionsDialog.activateAction', 'Activate')}>
                                <span>
                                  <IconButton
                                    size='small'
                                    onClick={() => handleActivate(item.id)}
                                    disabled={isBusy || item.isActive}
                                    color='primary'
                                  >
                                    <IconPlayerPlay size={18} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title={t('versionsDialog.deleteAction', 'Delete')}>
                                <span>
                                  <IconButton
                                    size='small'
                                    onClick={() => handleDelete(item.id)}
                                    disabled={isBusy || item.isActive || !canDelete}
                                    color='error'
                                  >
                                    <IconTrash size={18} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      )
                    })}
              </TableBody>
            </Table>
          </TableContainer>
            )}
          </Box>
          {editingVersionId && (
            <Paper variant='outlined' sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant='subtitle1'>
                  {t('versionsDialog.editTitle', 'Edit version metadata')}
                </Typography>
                {editingVersion?.versionUuid && (
                  <Typography variant='caption' color='text.secondary'>
                    {t('versionsDialog.editUuid', 'Version UUID')}: {editingVersion.versionUuid}
                  </Typography>
                )}
                <TextField
                  label={t('versionsDialog.editLabel', 'Version label')}
                  value={editLabel}
                  onChange={(event) => setEditLabel(event.target.value)}
                  inputProps={{ maxLength: 200 }}
                  fullWidth
                  autoFocus
                />
                <TextField
                  label={t('versionsDialog.editDescription', 'Description (optional)')}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  inputProps={{ maxLength: 2000 }}
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Stack direction='row' spacing={2} alignItems='center'>
                  <Button
                    variant='contained'
                    onClick={handleEditSave}
                    disabled={updateVersionApi.loading}
                  >
                    {t('versionsDialog.editSave', 'Save changes')}
                  </Button>
                  <Button onClick={handleEditCancel} disabled={updateVersionApi.loading}>
                    {t('versionsDialog.editCancel', 'Cancel')}
                  </Button>
                  {updateVersionApi.loading && <CircularProgress size={20} />}
                </Stack>
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{t('common.cancel', 'Cancel')}</Button>
      </DialogActions>
    </Dialog>
  ) : null

  if (!portalElement) return component
  return component ? createPortal(component, portalElement) : null
}

CanvasVersionsDialog.propTypes = {
  show: PropTypes.bool,
  dialogProps: PropTypes.shape({
    unikId: PropTypes.string,
    spaceId: PropTypes.string,
    canvasId: PropTypes.string,
    canvasName: PropTypes.string
  }),
  onCancel: PropTypes.func,
  onRefreshCanvases: PropTypes.func,
  onSelectCanvas: PropTypes.func,
  onActiveVersionChange: PropTypes.func
}

CanvasVersionsDialog.defaultProps = {
  show: false,
  dialogProps: {},
  onCancel: () => {}
}

export default CanvasVersionsDialog
