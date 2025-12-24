import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
    Box,
    Skeleton,
    Stack,
    Typography,
    TextField,
    Checkbox,
    FormControlLabel,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    CircularProgress,
    Alert,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ListAltIcon from '@mui/icons-material/ListAlt'
import TableRowsIcon from '@mui/icons-material/TableRows'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient, useQuery } from '@tanstack/react-query'

// project imports
import {
    TemplateMainCard as MainCard,
    ToolbarControls,
    EmptyListState,
    APIEmptySVG,
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    ConfirmDialog,
    useConfirm
} from '@universo/template-mui'
import { ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateRecord, useUpdateRecord, useDeleteRecord } from '../hooks/mutations'
import * as recordsApi from '../api/records'
import * as attributesApi from '../api/attributes'
import { metahubsQueryKeys, invalidateRecordsQueries } from '../api/queryKeys'
import { HubRecord, HubRecordDisplay, Attribute, getLocalizedString, toHubRecordDisplay } from '../types'
import recordActions from './RecordActions'

// Dynamic form field component based on attribute type
interface DynamicFieldProps {
    attribute: Attribute
    value: unknown
    onChange: (value: unknown) => void
    locale: string
}

const DynamicField = ({ attribute, value, onChange, locale }: DynamicFieldProps) => {
    const label = getLocalizedString(attribute.name, locale) || attribute.codename

    switch (attribute.dataType) {
        case 'STRING':
            return (
                <TextField
                    fullWidth
                    label={label}
                    value={(value as string) ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={attribute.isRequired}
                    size='small'
                />
            )
        case 'NUMBER':
            return (
                <TextField
                    fullWidth
                    type='number'
                    label={label}
                    value={(value as number) ?? ''}
                    onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : null)}
                    required={attribute.isRequired}
                    size='small'
                />
            )
        case 'BOOLEAN':
            return (
                <FormControlLabel
                    control={<Checkbox checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />}
                    label={label}
                />
            )
        case 'DATE':
            return (
                <TextField
                    fullWidth
                    type='date'
                    label={label}
                    value={(value as string) ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={attribute.isRequired}
                    size='small'
                    InputLabelProps={{ shrink: true }}
                />
            )
        case 'DATETIME':
            return (
                <TextField
                    fullWidth
                    type='datetime-local'
                    label={label}
                    value={(value as string) ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={attribute.isRequired}
                    size='small'
                    InputLabelProps={{ shrink: true }}
                />
            )
        case 'JSON':
            return (
                <TextField
                    fullWidth
                    multiline
                    rows={4}
                    label={label}
                    value={typeof value === 'string' ? value : JSON.stringify(value ?? {}, null, 2)}
                    onChange={(e) => {
                        try {
                            onChange(JSON.parse(e.target.value))
                        } catch {
                            onChange(e.target.value)
                        }
                    }}
                    required={attribute.isRequired}
                    size='small'
                />
            )
        case 'REF':
            return (
                <TextField
                    fullWidth
                    label={`${label} (ID)`}
                    value={(value as string) ?? ''}
                    onChange={(e) => onChange(e.target.value)}
                    required={attribute.isRequired}
                    size='small'
                    placeholder='Enter referenced record ID'
                />
            )
        default:
            return (
                <TextField
                    fullWidth
                    label={label}
                    value={String(value ?? '')}
                    onChange={(e) => onChange(e.target.value)}
                    required={attribute.isRequired}
                    size='small'
                />
            )
    }
}

// Dynamic Record Form Dialog
interface RecordFormDialogProps {
    open: boolean
    onClose: () => void
    onSubmit: (data: Record<string, unknown>) => Promise<void>
    attributes: Attribute[]
    initialData?: Record<string, unknown>
    isSubmitting: boolean
    error: string | null
    title: string
    locale: string
}

const RecordFormDialog = ({
    open,
    onClose,
    onSubmit,
    attributes,
    initialData,
    isSubmitting,
    error,
    title,
    locale
}: RecordFormDialogProps) => {
    const { t } = useTranslation(['metahubs', 'common'])
    const { t: tc } = useCommonTranslations()
    const [formData, setFormData] = useState<Record<string, unknown>>({})

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setFormData(initialData ?? {})
        }
    }, [open, initialData])

    const handleFieldChange = useCallback((codename: string, value: unknown) => {
        setFormData((prev) => ({ ...prev, [codename]: value }))
    }, [])

    const handleSubmit = async () => {
        await onSubmit(formData)
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth='sm' fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    {error && <Alert severity='error'>{error}</Alert>}
                    {attributes.length === 0 ? (
                        <Typography color='text.secondary'>{t('records.noAttributes')}</Typography>
                    ) : (
                        attributes.map((attr) => (
                            <DynamicField
                                key={attr.id}
                                attribute={attr}
                                value={formData[attr.codename]}
                                onChange={(value) => handleFieldChange(attr.codename, value)}
                                locale={locale}
                            />
                        ))
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>
                    {tc('actions.cancel', 'Cancel')}
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant='contained'
                    disabled={isSubmitting || attributes.length === 0}
                    startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
                >
                    {tc('actions.save', 'Save')}
                </Button>
            </DialogActions>
        </Dialog>
    )
}

const RecordList = () => {
    const navigate = useNavigate()
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [editingRecord, setEditingRecord] = useState<HubRecord | null>(null)

    // State management for dialog
    const [isSubmitting, setSubmitting] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Fetch attributes for this hub to build dynamic columns and forms
    const { data: attributesData } = useQuery({
        queryKey: metahubId && hubId ? metahubsQueryKeys.attributesList(metahubId, hubId, { limit: 100 }) : ['empty'],
        queryFn:
            metahubId && hubId
                ? () => attributesApi.listAttributes(metahubId, hubId, { limit: 100 })
                : async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: !!metahubId && !!hubId
    })

    const attributes = attributesData?.items ?? []

    // Use paginated hook for records list
    const paginationResult = usePaginated<HubRecord, 'created' | 'updated'>({
        queryKeyFn: metahubId && hubId ? (params) => metahubsQueryKeys.recordsList(metahubId, hubId, params) : () => ['empty'],
        queryFn:
            metahubId && hubId
                ? (params) => recordsApi.listRecords(metahubId, hubId, params)
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId && !!hubId
    })

    const { data: records, isLoading, error } = paginationResult
    // usePaginated already returns the items array as `data`, here aliased to `records`

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        record: HubRecord | null
    }>({ open: false, record: null })

    const { confirm } = useConfirm()

    const createRecordMutation = useCreateRecord()
    const updateRecordMutation = useUpdateRecord()
    const deleteRecordMutation = useDeleteRecord()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(records)) {
            records.forEach((record) => {
                if (record?.id) {
                    imagesMap[record.id] = []
                }
            })
        }
        return imagesMap
    }, [records])

    // Build dynamic columns based on attributes
    const recordColumns = useMemo(() => {
        const cols: Array<{
            id: string
            label: string
            width: string
            align: 'left' | 'center' | 'right'
            render: (row: HubRecordDisplay) => React.ReactNode
        }> = []

        // Add columns for first 4 attributes
        const visibleAttrs = attributes.slice(0, 4)
        visibleAttrs.forEach((attr) => {
            cols.push({
                id: attr.codename,
                label: getLocalizedString(attr.name, i18n.language) || attr.codename,
                width: `${80 / Math.max(visibleAttrs.length, 1)}%`,
                align: 'left',
                render: (row: HubRecordDisplay) => {
                    const value = row.data?.[attr.codename]
                    if (value === undefined || value === null) return '—'

                    switch (attr.dataType) {
                        case 'BOOLEAN':
                            return value ? '✓' : '✗'
                        case 'JSON':
                            return (
                                <Typography sx={{ fontFamily: 'monospace', fontSize: 12 }} noWrap>
                                    {JSON.stringify(value)}
                                </Typography>
                            )
                        default:
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {String(value)}
                                </Typography>
                            )
                    }
                }
            })
        })

        // Add updated column
        cols.push({
            id: 'updatedAt',
            label: tc('table.updated', 'Updated'),
            width: '15%',
            align: 'left',
            render: (row: HubRecordDisplay) => (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                </Typography>
            )
        })

        return cols
    }, [attributes, i18n.language, tc])

    const createRecordContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    if (!metahubId || !hubId) return
                    await updateRecordMutation.mutateAsync({ metahubId, hubId, recordId: id, data: { data: patch } })
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId || !hubId) return
                    await deleteRecordMutation.mutateAsync({ metahubId, hubId, recordId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId && hubId) {
                        await invalidateRecordsQueries.all(queryClient, metahubId, hubId)
                    }
                },
                confirm: async (spec: any) => {
                    const confirmed = await confirm({
                        title: spec.titleKey ? baseContext.t(spec.titleKey, spec.interpolate) : spec.title,
                        description: spec.descriptionKey ? baseContext.t(spec.descriptionKey, spec.interpolate) : spec.description,
                        confirmButtonName: spec.confirmKey
                            ? baseContext.t(spec.confirmKey)
                            : spec.confirmButtonName || baseContext.t('confirm.delete.confirm'),
                        cancelButtonName: spec.cancelKey
                            ? baseContext.t(spec.cancelKey)
                            : spec.cancelButtonName || baseContext.t('confirm.delete.cancel')
                    })
                    return confirmed
                },
                enqueueSnackbar: (payload: {
                    message: string
                    options?: { variant?: 'default' | 'error' | 'success' | 'warning' | 'info' }
                }) => {
                    if (payload?.message) {
                        enqueueSnackbar(payload.message, payload.options)
                    }
                },
                openDeleteDialog: (record: HubRecord) => {
                    setDeleteDialogState({ open: true, record })
                },
                openEditDialog: (record: HubRecord) => {
                    setEditingRecord(record)
                }
            }
        }),
        [confirm, deleteRecordMutation, enqueueSnackbar, hubId, metahubId, queryClient, updateRecordMutation]
    )

    // Validate metahubId and hubId from URL AFTER all hooks
    if (!metahubId || !hubId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid hub'
                title={t('errors.noHubId', 'No hub ID provided')}
                description={t('errors.pleaseSelectHub', 'Please select a hub')}
            />
        )
    }

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleEditClose = () => {
        setEditingRecord(null)
        setDialogError(null)
    }

    const handleCreateRecord = async (data: Record<string, unknown>) => {
        setDialogError(null)
        setSubmitting(true)
        try {
            await createRecordMutation.mutateAsync({
                metahubId,
                hubId,
                data: { data }
            })

            await invalidateRecordsQueries.all(queryClient, metahubId, hubId)
            handleDialogClose()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('records.createError')
            setDialogError(message)
            console.error('Failed to create record', e)
        } finally {
            setSubmitting(false)
        }
    }

    const handleUpdateRecord = async (data: Record<string, unknown>) => {
        if (!editingRecord) return

        setDialogError(null)
        setSubmitting(true)
        try {
            await updateRecordMutation.mutateAsync({
                metahubId,
                hubId,
                recordId: editingRecord.id,
                data: { data }
            })

            await invalidateRecordsQueries.all(queryClient, metahubId, hubId)
            handleEditClose()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('records.updateError')
            setDialogError(message)
            console.error('Failed to update record', e)
        } finally {
            setSubmitting(false)
        }
    }

    // Transform Record data for FlowListTable
    const getRecordTableData = (record: HubRecord): HubRecordDisplay => toHubRecordDisplay(record, attributes)

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            {error ? (
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Connection error'
                    title={t('errors.connectionFailed')}
                    description={!(error as any)?.response?.status ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
                    action={{
                        label: t('actions.retry'),
                        onClick: () => paginationResult.actions.goToPage(1)
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    {/* Tab navigation between Attributes and Records */}
                    <Box sx={{ mb: 1 }}>
                        <ToggleButtonGroup
                            value='records'
                            exclusive
                            size='small'
                            sx={{ mb: 1 }}
                        >
                            <ToggleButton
                                value='attributes'
                                sx={{ px: 2, py: 0.5 }}
                                onClick={() => navigate(`/metahub/${metahubId}/hubs/${hubId}/attributes`)}
                            >
                                <ListAltIcon sx={{ mr: 1, fontSize: 18 }} />
                                {t('attributes.title')}
                            </ToggleButton>
                            <ToggleButton value='records' sx={{ px: 2, py: 0.5 }}>
                                <TableRowsIcon sx={{ mr: 1, fontSize: 18 }} />
                                {t('records.title')}
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('records.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('records.title')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />,
                                disabled: attributes.length === 0
                            }}
                        />
                    </ViewHeader>

                    {isLoading && records.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && records.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No records'
                            title={t('records.empty')}
                            description={attributes.length === 0 ? t('records.addAttributesFirst') : t('records.emptyDescription')}
                        />
                    ) : (
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable
                                data={records.map(getRecordTableData)}
                                images={images}
                                isLoading={isLoading}
                                customColumns={recordColumns}
                                i18nNamespace='flowList'
                                renderActions={(row: any) => {
                                    const originalRecord = records.find((r) => r.id === row.id)
                                    if (!originalRecord) return null

                                    const descriptors = [...recordActions]
                                    if (!descriptors.length) return null

                                    return (
                                        <BaseEntityMenu<HubRecordDisplay, { data: Record<string, unknown> }>
                                            entity={toHubRecordDisplay(originalRecord, attributes)}
                                            entityKind='record'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createRecordContext}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}

                    {/* Table Pagination at bottom */}
                    {!isLoading && records.length > 0 && (
                        <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 2 }}>
                            <PaginationControls
                                pagination={paginationResult.pagination}
                                actions={paginationResult.actions}
                                isLoading={paginationResult.isLoading}
                                rowsPerPageOptions={[10, 20, 50, 100]}
                                namespace='common'
                            />
                        </Box>
                    )}
                </Stack>
            )}

            {/* Create Record Dialog */}
            <RecordFormDialog
                open={isDialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleCreateRecord}
                attributes={attributes}
                isSubmitting={isSubmitting}
                error={dialogError}
                title={t('records.createDialog.title', 'Add Record')}
                locale={i18n.language}
            />

            {/* Edit Record Dialog */}
            <RecordFormDialog
                open={!!editingRecord}
                onClose={handleEditClose}
                onSubmit={handleUpdateRecord}
                attributes={attributes}
                initialData={editingRecord?.data}
                isSubmitting={isSubmitting}
                error={dialogError}
                title={t('records.editDialog.title', 'Edit Record')}
                locale={i18n.language}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('records.deleteDialog.title')}
                description={t('records.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, record: null })}
                onConfirm={async () => {
                    if (deleteDialogState.record) {
                        try {
                            await deleteRecordMutation.mutateAsync({
                                metahubId,
                                hubId,
                                recordId: deleteDialogState.record.id
                            })
                            setDeleteDialogState({ open: false, record: null })
                        } catch (err: unknown) {
                            const responseMessage =
                                err && typeof err === 'object' && 'response' in err ? (err as any)?.response?.data?.message : undefined
                            const message =
                                typeof responseMessage === 'string'
                                    ? responseMessage
                                    : err instanceof Error
                                    ? err.message
                                    : typeof err === 'string'
                                    ? err
                                    : t('records.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, record: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default RecordList
