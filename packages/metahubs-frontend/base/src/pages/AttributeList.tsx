import { useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Box, Skeleton, Stack, Typography, Chip, ToggleButtonGroup, ToggleButton } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ListAltIcon from '@mui/icons-material/ListAlt'
import TableRowsIcon from '@mui/icons-material/TableRows'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

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
import { EntityFormDialog, ConfirmDeleteDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateAttribute, useUpdateAttribute, useDeleteAttribute } from '../hooks/mutations'
import * as attributesApi from '../api/attributes'
import { metahubsQueryKeys, invalidateAttributesQueries } from '../api/queryKeys'
import { Attribute, AttributeDisplay, AttributeDataType, toAttributeDisplay } from '../types'
import attributeActions from './AttributeActions'

// Type for attribute create/update data
type AttributeData = {
    codename: string
    dataType: AttributeDataType
    name?: { en?: string; ru?: string }
    description?: { en?: string; ru?: string }
    isRequired?: boolean
}

// Get color for data type chip
const getDataTypeColor = (dataType: AttributeDataType): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' => {
    switch (dataType) {
        case 'STRING':
            return 'primary'
        case 'NUMBER':
            return 'secondary'
        case 'BOOLEAN':
            return 'success'
        case 'DATE':
        case 'DATETIME':
            return 'warning'
        case 'REF':
            return 'info'
        case 'JSON':
            return 'default'
        default:
            return 'default'
    }
}

const AttributeList = () => {
    const navigate = useNavigate()
    const { metahubId, hubId } = useParams<{ metahubId: string; hubId: string }>()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for attributes list
    const paginationResult = usePaginated<Attribute, 'codename' | 'created' | 'updated'>({
        queryKeyFn: metahubId && hubId ? (params) => metahubsQueryKeys.attributesList(metahubId, hubId, params) : () => ['empty'],
        queryFn:
            metahubId && hubId
                ? (params) => attributesApi.listAttributes(metahubId, hubId, params)
                : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!metahubId && !!hubId
    })

    const { data: attributes, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { searchValue, handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        attribute: Attribute | null
    }>({ open: false, attribute: null })

    const { confirm } = useConfirm()

    const createAttributeMutation = useCreateAttribute()
    const updateAttributeMutation = useUpdateAttribute()
    const deleteAttributeMutation = useDeleteAttribute()

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(attributes)) {
            attributes.forEach((attr) => {
                if (attr?.id) {
                    imagesMap[attr.id] = []
                }
            })
        }
        return imagesMap
    }, [attributes])

    const attributeColumns = useMemo(
        () => [
            {
                id: 'codename',
                label: t('attributes.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                render: (row: AttributeDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 600,
                            fontFamily: 'monospace',
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.codename || '—'}
                    </Typography>
                )
            },
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                render: (row: AttributeDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            fontWeight: 500,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.name || '—'}
                    </Typography>
                )
            },
            {
                id: 'dataType',
                label: t('attributes.dataType', 'Type'),
                width: '12%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => <Chip label={row.dataType} size='small' color={getDataTypeColor(row.dataType)} />
            },
            {
                id: 'isRequired',
                label: t('attributes.required', 'Required'),
                width: '10%',
                align: 'center' as const,
                render: (row: AttributeDisplay) => (
                    <Chip
                        label={row.isRequired ? tc('yes', 'Yes') : tc('no', 'No')}
                        size='small'
                        variant='outlined'
                        color={row.isRequired ? 'error' : 'default'}
                    />
                )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '33%',
                align: 'left' as const,
                render: (row: AttributeDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            }
        ],
        [t, tc]
    )

    const createAttributeContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            api: {
                updateEntity: async (id: string, patch: any) => {
                    if (!metahubId || !hubId) return
                    await updateAttributeMutation.mutateAsync({ metahubId, hubId, attributeId: id, data: patch })
                },
                deleteEntity: async (id: string) => {
                    if (!metahubId || !hubId) return
                    await deleteAttributeMutation.mutateAsync({ metahubId, hubId, attributeId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (metahubId && hubId) {
                        await invalidateAttributesQueries.all(queryClient, metahubId, hubId)
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
                openDeleteDialog: (attribute: Attribute) => {
                    setDeleteDialogState({ open: true, attribute })
                }
            }
        }),
        [confirm, deleteAttributeMutation, enqueueSnackbar, hubId, metahubId, queryClient, updateAttributeMutation]
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

    const handleDialogSave = () => {
        setDialogOpen(false)
    }

    const handleCreateAttribute = async (data: { name: string; description?: string }) => {
        setDialogError(null)
        setCreating(true)
        try {
            await createAttributeMutation.mutateAsync({
                metahubId,
                hubId,
                data: {
                    codename: data.name.toLowerCase().replace(/\s+/g, '_'),
                    dataType: 'STRING',
                    name: { en: data.name }
                }
            })

            await invalidateAttributesQueries.all(queryClient, metahubId, hubId)
            handleDialogSave()
        } catch (e: unknown) {
            const responseMessage = e && typeof e === 'object' && 'response' in e ? (e as any)?.response?.data?.message : undefined
            const message =
                typeof responseMessage === 'string'
                    ? responseMessage
                    : e instanceof Error
                    ? e.message
                    : typeof e === 'string'
                    ? e
                    : t('attributes.createError')
            setDialogError(message)
            console.error('Failed to create attribute', e)
        } finally {
            setCreating(false)
        }
    }

    // Transform Attribute data for FlowListTable (which expects string name)
    const getAttributeTableData = (attr: Attribute): AttributeDisplay => toAttributeDisplay(attr, i18n.language)

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
                            value='attributes'
                            exclusive
                            size='small'
                            sx={{ mb: 1 }}
                        >
                            <ToggleButton value='attributes' sx={{ px: 2, py: 0.5 }}>
                                <ListAltIcon sx={{ mr: 1, fontSize: 18 }} />
                                {t('attributes.title')}
                            </ToggleButton>
                            <ToggleButton
                                value='records'
                                sx={{ px: 2, py: 0.5 }}
                                onClick={() => navigate(`/metahub/${metahubId}/hubs/${hubId}/records`)}
                            >
                                <TableRowsIcon sx={{ mr: 1, fontSize: 18 }} />
                                {t('records.title')}
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>

                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('attributes.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('attributes.title')}
                    >
                        <ToolbarControls
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />
                            }}
                        />
                    </ViewHeader>

                    {isLoading && attributes.length === 0 ? (
                        <Skeleton variant='rectangular' height={120} />
                    ) : !isLoading && attributes.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No attributes'
                            title={t('attributes.empty')}
                            description={t('attributes.emptyDescription')}
                        />
                    ) : (
                        <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                            <FlowListTable
                                data={attributes.map(getAttributeTableData)}
                                images={images}
                                isLoading={isLoading}
                                customColumns={attributeColumns}
                                i18nNamespace='flowList'
                                renderActions={(row: any) => {
                                    const originalAttribute = attributes.find((a) => a.id === row.id)
                                    if (!originalAttribute) return null

                                    const descriptors = [...attributeActions] as any[]
                                    if (!descriptors.length) return null

                                    return (
                                        <BaseEntityMenu<AttributeDisplay, AttributeData>
                                            entity={toAttributeDisplay(originalAttribute, i18n.language)}
                                            entityKind='attribute'
                                            descriptors={descriptors}
                                            namespace='metahubs'
                                            menuButtonLabelKey='flowList:menu.button'
                                            i18nInstance={i18n}
                                            createContext={createAttributeContext}
                                        />
                                    )
                                }}
                            />
                        </Box>
                    )}

                    {/* Table Pagination at bottom */}
                    {!isLoading && attributes.length > 0 && (
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

            <EntityFormDialog
                open={isDialogOpen}
                title={t('attributes.createDialog.title', 'Add Attribute')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateAttribute}
            />

            {/* Independent ConfirmDeleteDialog */}
            <ConfirmDeleteDialog
                open={deleteDialogState.open}
                title={t('attributes.deleteDialog.title')}
                description={t('attributes.deleteDialog.message')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => setDeleteDialogState({ open: false, attribute: null })}
                onConfirm={async () => {
                    if (deleteDialogState.attribute) {
                        try {
                            await deleteAttributeMutation.mutateAsync({
                                metahubId,
                                hubId,
                                attributeId: deleteDialogState.attribute.id
                            })
                            setDeleteDialogState({ open: false, attribute: null })
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
                                    : t('attributes.deleteError')
                            enqueueSnackbar(message, { variant: 'error' })
                            setDeleteDialogState({ open: false, attribute: null })
                        }
                    }
                }}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default AttributeList
