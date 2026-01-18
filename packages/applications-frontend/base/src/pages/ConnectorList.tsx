import { useState, useMemo, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Box, Skeleton, Stack, Typography, IconButton, Divider } from '@mui/material'
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import InfoIcon from '@mui/icons-material/Info'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'

// project imports
import {
    TemplateMainCard as MainCard,
    ItemCard,
    ToolbarControls,
    EmptyListState,
    SkeletonGrid,
    APIEmptySVG,
    usePaginated,
    useDebouncedSearch,
    PaginationControls,
    FlowListTable,
    gridSpacing,
    ConfirmDialog,
    useConfirm,
    LocalizedInlineField,
    useCodenameAutoFill
} from '@universo/template-mui'
import { EntityFormDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'
import type { TriggerProps } from '@universo/template-mui'

import { useCreateConnector, useUpdateConnector, useDeleteConnector } from '../hooks/mutations'
import { useConnectorMetahubs } from '../hooks/useConnectorMetahubs'
import { useViewPreference } from '../hooks/useViewPreference'
import { STORAGE_KEYS } from '../constants/storage'
import * as connectorsApi from '../api/connectors'
import { applicationsQueryKeys, invalidateConnectorsQueries } from '../api/queryKeys'
import type { VersionedLocalizedContent } from '@universo/types'
import { Connector, ConnectorDisplay, ConnectorLocalizedPayload, getVLCString, toConnectorDisplay } from '../types'
import { sanitizeCodename, isValidCodename } from '../utils/codename'
import { extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../utils/localizedInput'
import { CodenameField, ConnectorDeleteDialog } from '../components'
import connectorActions from './ConnectorActions'

type ConnectorFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    codename: string
    codenameTouched?: boolean
}

type ConnectorFormFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
}

const ConnectorFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper
}: ConnectorFormFieldsProps) => {
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    return (
        <>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next) => setValue('nameVlc', next)}
                error={errors.nameVlc || null}
                helperText={errors.nameVlc}
                uiLocale={uiLocale}
            />
            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                label={codenameLabel}
                helperText={codenameHelper}
                error={errors.codename}
                disabled={isLoading}
                required
            />
        </>
    )
}

const ConnectorList = () => {
    const { applicationId } = useParams<{ applicationId: string }>()
    const { t, i18n } = useTranslation(['applications', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.CONNECTOR_DISPLAY_STYLE)

    // State management for dialog
    const [isCreating, setCreating] = useState(false)
    const [dialogError, setDialogError] = useState<string | null>(null)

    // Use paginated hook for connectors list
    const paginationResult = usePaginated<Connector, 'codename' | 'created' | 'updated'>({
        queryKeyFn: applicationId ? (params) => applicationsQueryKeys.connectorsList(applicationId, params) : () => ['empty'],
        queryFn: applicationId
            ? (params) => connectorsApi.listConnectors(applicationId, params)
            : async () => ({ items: [], pagination: { limit: 20, offset: 0, count: 0, total: 0, hasMore: false } }),
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc',
        enabled: !!applicationId
    })

    const { data: connectors, isLoading, error } = paginationResult
    // usePaginated already extracts items array, so data IS the array

    // Instant search for better UX
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        connector: Connector | null
    }>({ open: false, connector: null })

    const { confirm } = useConfirm()

    const createConnectorMutation = useCreateConnector()
    const updateConnectorMutation = useUpdateConnector()
    const deleteConnectorMutation = useDeleteConnector()

    // Get first connector ID for metahub lookup (currently only one Connector allowed)
    const firstConnectorId = Array.isArray(connectors) && connectors.length > 0 ? connectors[0].id : ''
    
    // Fetch metahubs for the first connector to enable navigation
    const { data: connectorMetahubsData } = useConnectorMetahubs(applicationId ?? '', firstConnectorId)
    
    // Build a map of connectorId -> metahubId for navigation
    const connectorMetahubMap = useMemo(() => {
        const map: Record<string, string> = {}
        if (firstConnectorId && connectorMetahubsData?.items?.length) {
            // Use first linked metahub
            map[firstConnectorId] = connectorMetahubsData.items[0].metahubId
        }
        return map
    }, [firstConnectorId, connectorMetahubsData])

    // Memoize images object
    const images = useMemo(() => {
        const imagesMap: Record<string, any[]> = {}
        if (Array.isArray(connectors)) {
            connectors.forEach((connector) => {
                if (connector?.id) {
                    imagesMap[connector.id] = []
                }
            })
        }
        return imagesMap
    }, [connectors])

    const connectorMap = useMemo(() => {
        if (!Array.isArray(connectors)) return new Map<string, Connector>()
        return new Map(connectors.map((connector) => [connector.id, connector]))
    }, [connectors])

    const localizedFormDefaults = useMemo<ConnectorFormValues>(
        () => ({ nameVlc: null, descriptionVlc: null, codename: '', codenameTouched: false }),
        []
    )

    const validateConnectorForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = typeof values.codename === 'string' ? values.codename : ''
            const normalizedCodename = sanitizeCodename(rawCodename)
            if (!normalizedCodename) {
                errors.codename = t('connectors.validation.codenameRequired', 'Codename is required')
            } else if (!isValidCodename(normalizedCodename)) {
                errors.codename = t('connectors.validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [t, tc]
    )

    const canSaveConnectorForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const rawCodename = typeof values.codename === 'string' ? values.codename : ''
        const normalizedCodename = sanitizeCodename(rawCodename)
        return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
    }, [])

    const renderLocalizedFields = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors?: Record<string, string>
        }) => {
            const fieldErrors = errors ?? {}
            return (
                <ConnectorFormFields
                    values={values}
                    setValue={setValue}
                    isLoading={isLoading}
                    errors={fieldErrors}
                    uiLocale={i18n.language}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    codenameLabel={t('connectors.codename', 'Codename')}
                    codenameHelper={t('connectors.codenameHelper', 'Unique identifier')}
                />
            )
        },
        [i18n.language, t, tc]
    )

    const connectorColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '25%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ConnectorDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: ConnectorDisplay) => (
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
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '30%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ConnectorDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: ConnectorDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: t('connectors.codename', 'Codename'),
                width: '15%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: ConnectorDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: ConnectorDisplay) => (
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
            }
        ],
        [t, tc, applicationId]
    )

    const createConnectorContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            connectorMap,
            applicationId, // Pass applicationId for metahub loading in edit dialog
            uiLocale: i18n.language,
            api: {
                updateEntity: async (id: string, patch: ConnectorLocalizedPayload) => {
                    if (!applicationId) return
                    const normalizedCodename = sanitizeCodename(patch.codename)
                    if (!normalizedCodename) {
                        throw new Error(t('connectors.validation.codenameRequired', 'Codename is required'))
                    }
                    await updateConnectorMutation.mutateAsync({
                        applicationId,
                        connectorId: id,
                        data: { ...patch, codename: normalizedCodename }
                    })
                },
                deleteEntity: async (id: string) => {
                    if (!applicationId) return
                    await deleteConnectorMutation.mutateAsync({ applicationId, connectorId: id })
                }
            },
            helpers: {
                refreshList: async () => {
                    if (applicationId) {
                        await invalidateConnectorsQueries.all(queryClient, applicationId)
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
                openDeleteDialog: (connectorOrDisplay: Connector | ConnectorDisplay) => {
                    // Handle both Connector and ConnectorDisplay (from BaseEntityMenu context)
                    const connector =
                        'applicationId' in connectorOrDisplay ? connectorOrDisplay : connectorMap.get(connectorOrDisplay.id)
                    if (connector) {
                        setDeleteDialogState({ open: true, connector })
                    }
                }
            }
        }),
        [confirm, deleteConnectorMutation, enqueueSnackbar, connectorMap, i18n.language, applicationId, queryClient, t, updateConnectorMutation]
    )

    // Validate applicationId from URL AFTER all hooks
    if (!applicationId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid application'
                title={t('applications:errors.invalidApplication')}
                description={t('applications:errors.pleaseSelectApplication')}
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

    const handleCreateConnector = async (data: Record<string, any>) => {
        setDialogError(null)
        setCreating(true)
        try {
            const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
            const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
            if (!nameInput || !namePrimaryLocale) {
                setDialogError(tc('crud.nameRequired', 'Name is required'))
                return
            }
            const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
            const normalizedCodename = sanitizeCodename(String(data.codename || ''))
            if (!normalizedCodename) {
                setDialogError(t('connectors.validation.codenameRequired', 'Codename is required'))
                return
            }

            await createConnectorMutation.mutateAsync({
                applicationId,
                data: {
                    codename: normalizedCodename,
                    name: nameInput,
                    description: descriptionInput,
                    namePrimaryLocale,
                    descriptionPrimaryLocale
                }
            })

            await invalidateConnectorsQueries.all(queryClient, applicationId)
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
                    : t('connectors.createError')
            setDialogError(message)
            console.error('Failed to create connector', e)
        } finally {
            setCreating(false)
        }
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    // Transform Connector data for display (ItemCard and FlowListTable expect string name)
    const getConnectorCardData = (connector: Connector): ConnectorDisplay => toConnectorDisplay(connector, i18n.language)

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
                    <ViewHeader
                        search={true}
                        searchPlaceholder={t('connectors.searchPlaceholder')}
                        onSearchChange={handleSearchChange}
                        title={t('connectors.title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('addNew'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />,
                                disabled: connectors.length > 0
                            }}
                        />
                    </ViewHeader>

                    {/* Info banner: temporary single-connector limit - shown below header, above content */}
                    {connectors.length > 0 && (
                        <Alert
                            severity="info"
                            icon={<InfoIcon />}
                            sx={{
                                mx: { xs: -1.5, md: -2 },
                                mt: 0,
                                mb: 2
                            }}
                        >
                            {t('connectors.singleConnectorLimit', 'Currently, only one Connector per Application is supported.')}
                        </Alert>
                    )}

                    {isLoading && connectors.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && connectors.length === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No connectors'
                            title={t('connectors.empty')}
                            description={t('connectors.emptyDescription')}
                        />
                    ) : (
                        <>
                            {view === 'card' ? (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: gridSpacing,
                                        mx: { xs: -1.5, md: -2 },
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                            lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                        },
                                        justifyContent: 'start',
                                        alignContent: 'start'
                                    }}
                                >
                                    {connectors.map((connector: Connector) => {
                                        const descriptors = [...connectorActions]
                                        // Navigate to connector board within Applications
                                        const connectorHref = applicationId
                                            ? `/application/${applicationId}/connector/${connector.id}`
                                            : undefined

                                        return (
                                            <ItemCard
                                                key={connector.id}
                                                data={getConnectorCardData(connector)}
                                                images={images[connector.id] || []}
                                                href={connectorHref}
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<ConnectorDisplay, ConnectorLocalizedPayload>
                                                                entity={toConnectorDisplay(connector, i18n.language)}
                                                                entityKind='connector'
                                                                descriptors={descriptors}
                                                                namespace='applications'
                                                                i18nInstance={i18n}
                                                                createContext={createConnectorContext}
                                                                renderTrigger={(props: TriggerProps) => (
                                                                    <IconButton
                                                                        size='small'
                                                                        sx={{ color: 'text.secondary', width: 28, height: 28, p: 0.25 }}
                                                                        {...props}
                                                                    >
                                                                        <MoreVertRoundedIcon fontSize='small' />
                                                                    </IconButton>
                                                                )}
                                                            />
                                                        </Box>
                                                    ) : null
                                                }
                                            />
                                        )
                                    })}
                                </Box>
                            ) : (
                                <Box sx={{ mx: { xs: -1.5, md: -2 } }}>
                                    <FlowListTable
                                        data={connectors.map(getConnectorCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        getRowLink={(row: any) => {
                                            // Navigate to connector board within Applications
                                            return applicationId && row?.id
                                                ? `/application/${applicationId}/connector/${row.id}`
                                                : undefined
                                        }}
                                        customColumns={connectorColumns}
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalConnector = connectors.find((h) => h.id === row.id)
                                            if (!originalConnector) return null

                                            const descriptors = [...connectorActions]
                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<ConnectorDisplay, ConnectorLocalizedPayload>
                                                    entity={toConnectorDisplay(originalConnector, i18n.language)}
                                                    entityKind='connector'
                                                    descriptors={descriptors}
                                                    namespace='applications'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createConnectorContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}
                        </>
                    )}

                    {/* Table Pagination at bottom */}
                    {!isLoading && connectors.length > 0 && (
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
                title={t('connectors.createDialog.title', 'Create Connector')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.save', 'Save')}
                savingButtonText={tc('actions.saving', 'Saving...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={isCreating}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreateConnector}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                extraFields={renderLocalizedFields}
                validate={validateConnectorForm}
                canSave={canSaveConnectorForm}
            />

            {/* Connector delete dialog */}
            <ConnectorDeleteDialog
                open={deleteDialogState.open}
                connector={deleteDialogState.connector}
                applicationId={applicationId}
                onClose={() => setDeleteDialogState({ open: false, connector: null })}
                onConfirm={async (connector) => {
                    try {
                        await deleteConnectorMutation.mutateAsync({
                            applicationId,
                            connectorId: connector.id
                        })
                        setDeleteDialogState({ open: false, connector: null })
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
                                : t('connectors.deleteError')
                        enqueueSnackbar(message, { variant: 'error' })
                        setDeleteDialogState({ open: false, connector: null })
                    }
                }}
                isDeleting={deleteConnectorMutation.isPending}
                uiLocale={i18n.language}
            />

            <ConfirmDialog />
        </MainCard>
    )
}

export default ConnectorList
