import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material'
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
import { ConfirmDeleteDialog, DynamicEntityFormDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateRecord, useUpdateRecord, useDeleteRecord } from '../hooks/mutations'
import * as recordsApi from '../api/records'
import * as attributesApi from '../api/attributes'
import { getCatalogById } from '../api/catalogs'
import { metahubsQueryKeys, invalidateRecordsQueries } from '../api/queryKeys'
import { HubRecord, HubRecordDisplay, Attribute, getVLCString, toHubRecordDisplay } from '../types'
import recordActions from './RecordActions'
import type { DynamicFieldConfig } from '@universo/template-mui/components/dialogs'

const RecordList = () => {
    const navigate = useNavigate()
    const { metahubId, hubId: hubIdParam, catalogId } = useParams<{ metahubId: string; hubId?: string; catalogId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [editingRecord, setEditingRecord] = useState<HubRecord | null>(null)

    // When accessed via catalog-centric routes (/metahub/:id/catalogs/:catalogId/*), hubId is not in the URL.
    // Resolve a stable hubId from the catalog's hub associations.
    const {
        data: catalogForHubResolution,
        isLoading: isCatalogResolutionLoading,
        error: catalogResolutionError
    } = useQuery({
        queryKey:
            metahubId && catalogId ? metahubsQueryKeys.catalogDetail(metahubId, catalogId) : ['metahubs', 'catalogs', 'detail', 'empty'],
        queryFn: async () => {
            if (!metahubId || !catalogId) {
                throw new Error('metahubId and catalogId are required')
            }
            return getCatalogById(metahubId, catalogId)
        },
        enabled: !!metahubId && !!catalogId && !hubIdParam
    })

    // Hub ID from URL param, or resolved from catalog (for hub-scoped views)
    // Note: undefined means no hub - catalog exists without hub association, which is valid
    const effectiveHubId = hubIdParam || catalogForHubResolution?.hubs?.[0]?.id

    // State management for dialog
    const [isSubmitting, setSubmitting] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Can load data when we have metahubId and catalogId
    // hubId is optional - records/attributes belong to catalog directly
    const canLoadData = !!metahubId && !!catalogId && (!hubIdParam || !isCatalogResolutionLoading)

    // Fetch attributes for this catalog to build dynamic columns and forms
    const { data: attributesData } = useQuery({
        queryKey:
            metahubId && catalogId
                ? effectiveHubId
                    ? metahubsQueryKeys.attributesList(metahubId, effectiveHubId, catalogId, { limit: 100 })
                    : metahubsQueryKeys.attributesListDirect(metahubId, catalogId, { limit: 100 })
                : ['empty'],
        queryFn:
            metahubId && catalogId
                ? () =>
                      effectiveHubId
                          ? attributesApi.listAttributes(metahubId, effectiveHubId, catalogId, { limit: 100 })
                          : attributesApi.listAttributesDirect(metahubId, catalogId, { limit: 100 })
                : async () => ({ items: [], pagination: { limit: 100, offset: 0, count: 0, total: 0, hasMore: false } }),
        enabled: canLoadData
    })

    const attributes = attributesData?.items ?? []

    const recordFields = useMemo<DynamicFieldConfig[]>(
        () =>
            attributes.map((attribute) => ({
                id: attribute.codename,
                label: getVLCString(attribute.name, i18n.language) || attribute.codename,
                type: attribute.dataType as DynamicFieldConfig['type'],
                required: attribute.isRequired,
                localized: attribute.dataType === 'STRING'
            })),
        [attributes, i18n.language]
    )

    // Use paginated hook for records list
    const paginationResult = usePaginated<HubRecord, 'created' | 'updated'>({
        queryKeyFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? metahubsQueryKeys.recordsList(metahubId, effectiveHubId, catalogId, params)
                          : metahubsQueryKeys.recordsListDirect(metahubId, catalogId, params)
                : () => ['empty'],
        queryFn:
            metahubId && catalogId
                ? (params) =>
                      effectiveHubId
                          ? recordsApi.listRecords(metahubId, effectiveHubId, catalogId, params)
                          : recordsApi.listRecordsDirect(metahubId, catalogId, params)
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: canLoadData
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

    const recordMap = useMemo(() => {
        if (!Array.isArray(records)) return new Map<string, HubRecord>()
        return new Map(records.map((record) => [record.id, record]))
    }, [records])

    const orderedAttributes = useMemo(() => {
        const normalizedName = tc('fields.name', 'Name').trim().toLowerCase()
        const normalizedDescription = tc('fields.description', 'Description').trim().toLowerCase()
        const nameTokens = new Set(['name', 'title', 'название', normalizedName])
        const descriptionTokens = new Set(['description', 'desc', 'описание', normalizedDescription])

        const normalizeValue = (value: string) => value.trim().toLowerCase()

        const getRank = (attr: Attribute) => {
            const codename = normalizeValue(attr.codename || '')
            const label = normalizeValue(getVLCString(attr.name, i18n.language) || '')
            if (nameTokens.has(codename) || nameTokens.has(label)) return 0
            if (descriptionTokens.has(codename) || descriptionTokens.has(label)) return 1
            return 2
        }

        return attributes
            .map((attr, index) => ({ attr, index, rank: getRank(attr) }))
            .sort((a, b) => a.rank - b.rank || a.index - b.index)
            .map((item) => item.attr)
    }, [attributes, i18n.language, tc])

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
        const visibleAttrs = orderedAttributes.slice(0, 4)
        visibleAttrs.forEach((attr) => {
            cols.push({
                id: attr.codename,
                label: getVLCString(attr.name, i18n.language) || attr.codename,
                width: `${80 / Math.max(visibleAttrs.length, 1)}%`,
                align: 'left',
                render: (row: HubRecordDisplay) => {
                    const value = row.data?.[attr.codename]
                    if (value === undefined || value === null) return '—'

                    switch (attr.dataType) {
                        case 'STRING': {
                            const localizedValue =
                                value && typeof value === 'object' && 'locales' in (value as any)
                                    ? getVLCString(value as VersionedLocalizedContent<string>, i18n.language)
                                    : String(value)
                            return (
                                <Typography sx={{ fontSize: 14 }} noWrap>
                                    {localizedValue || '—'}
                                </Typography>
                            )
                        }
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
            label: t('records.table.updated', 'Updated'),
            width: '15%',
            align: 'left',
            render: (row: HubRecordDisplay) => (
                <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : '—'}
                </Typography>
            )
        })

        return cols
    }, [i18n.language, orderedAttributes, t])

    const createRecordContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    if (!metahubId || !catalogId) return
                    await updateRecordMutation.mutateAsync({
                        metahubId,
                        hubId: effectiveHubId,
                        catalogId,
                        recordId: id,
                        data: { data: patch }
                    })
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId || !catalogId) return
                    await deleteRecordMutation.mutateAsync({ metahubId, hubId: effectiveHubId, catalogId, recordId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId && catalogId) {
                        if (effectiveHubId) {
                            await invalidateRecordsQueries.all(queryClient, metahubId, effectiveHubId, catalogId)
                        }
                        // Also invalidate catalog-level queries
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.catalogDetail(metahubId, catalogId) })
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.recordsDirect(metahubId, catalogId) })
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
                openDeleteDialog: (record: HubRecordDisplay) => {
                    const fullRecord = recordMap.get(record.id) ?? (record as unknown as HubRecord)
                    setDeleteDialogState({ open: true, record: fullRecord })
                },
                openEditDialog: async (record: HubRecord | HubRecordDisplay) => {
                    if (!metahubId || !catalogId) return
                    const hasData = typeof (record as HubRecord).data === 'object'
                    let fullRecord: HubRecord | null = null
                    if (hasData && (record as HubRecord).data) {
                        fullRecord = record as HubRecord
                    } else {
                        fullRecord = recordMap.get(record.id) || null
                        if (!fullRecord) {
                            try {
                                if (effectiveHubId) {
                                    fullRecord = (await recordsApi.getRecord(metahubId, effectiveHubId, catalogId, record.id)).data
                                } else {
                                    fullRecord = (await recordsApi.getRecordDirect(metahubId, catalogId, record.id)).data
                                }
                            } catch {
                                fullRecord = null
                            }
                        }
                    }
                    if (fullRecord) {
                        setEditingRecord(fullRecord)
                    } else {
                        enqueueSnackbar(t('records.updateError', 'Failed to update record'), { variant: 'error' })
                    }
                }
            }
        }),
        [
            catalogId,
            confirm,
            deleteRecordMutation,
            effectiveHubId,
            enqueueSnackbar,
            metahubId,
            queryClient,
            recordMap,
            t,
            updateRecordMutation
        ]
    )

    // Validate metahubId and catalogId from URL AFTER all hooks
    if (!metahubId || !catalogId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid catalog'
                title={t('errors.noCatalogId', 'No catalog ID provided')}
                description={t('errors.pleaseSelectCatalog', 'Please select a catalog')}
            />
        )
    }

    // Show loading state while resolving catalog (to check for hub association)
    if (!hubIdParam && isCatalogResolutionLoading) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Loading'
                title={tc('loading', 'Loading')}
                description={t('common:loading', 'Loading...')}
            />
        )
    }

    // Show error only if there was an actual error fetching catalog details
    if (!hubIdParam && catalogResolutionError) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Error loading catalog'
                title={t('errors.loadingError', 'Error loading catalog')}
                description={catalogResolutionError instanceof Error ? catalogResolutionError.message : String(catalogResolutionError || '')}
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
                hubId: effectiveHubId,
                catalogId,
                data: { data }
            })

            // Invalidation handled by mutation hook
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
                hubId: effectiveHubId,
                catalogId,
                recordId: editingRecord.id,
                data: { data }
            })

            // Invalidation handled by mutation hook
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
    const getRecordTableData = (record: HubRecord): HubRecordDisplay => toHubRecordDisplay(record, attributes, i18n.language)

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
                        <ToggleButtonGroup value='records' exclusive size='small' sx={{ mb: 1 }}>
                            <ToggleButton
                                value='attributes'
                                sx={{ px: 2, py: 0.5 }}
                                onClick={() => {
                                    if (hubIdParam) {
                                        navigate(`/metahub/${metahubId}/hub/${hubIdParam}/catalog/${catalogId}/attributes`)
                                        return
                                    }
                                    navigate(`/metahub/${metahubId}/catalog/${catalogId}/attributes`)
                                }}
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
                                            entity={toHubRecordDisplay(originalRecord, attributes, i18n.language)}
                                            entityKind='record'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createRecordContext}
                                            contextExtras={{ rawRecord: originalRecord }}
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
            <DynamicEntityFormDialog
                open={isDialogOpen}
                onClose={handleDialogClose}
                onSubmit={handleCreateRecord}
                fields={recordFields}
                isSubmitting={isSubmitting}
                error={dialogError}
                title={t('records.createDialog.title', 'Add Record')}
                locale={i18n.language}
                requireAnyValue
                emptyStateText={t('records.noAttributes')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
            />

            {/* Edit Record Dialog */}
            <DynamicEntityFormDialog
                open={!!editingRecord}
                onClose={handleEditClose}
                onSubmit={handleUpdateRecord}
                initialData={editingRecord?.data}
                isSubmitting={isSubmitting}
                error={dialogError}
                title={t('records.editDialog.title', 'Edit Record')}
                locale={i18n.language}
                fields={recordFields}
                requireAnyValue
                emptyStateText={t('records.noAttributes')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                showDeleteButton
                deleteButtonText={tc('actions.delete', 'Delete')}
                onDelete={() => {
                    if (editingRecord) {
                        setDeleteDialogState({ open: true, record: editingRecord })
                    }
                }}
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
                                hubId: effectiveHubId,
                                catalogId,
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
