import { useState, useMemo, useCallback, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Box, ButtonBase, Checkbox, Divider, FormControlLabel, Radio, RadioGroup, Skeleton, Stack, Typography } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useTranslation } from 'react-i18next'
import { useCommonTranslations } from '@universo/i18n'
import { useSnackbar } from 'notistack'
import { useQueryClient } from '@tanstack/react-query'
import type { VersionedLocalizedContent } from '@universo/types'
import type { ConflictInfo } from '@universo/utils'
import { isPendingEntity, getPendingAction } from '@universo/utils'

// project imports
// Use the new template-mui ItemCard (JS component) for consistency with Uniks
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
    useConfirm,
    RoleChip,
    useUserSettings,
    LocalizedInlineField,
    useCodenameAutoFillVlc,
    revealPendingEntityFeedback
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreateMetahub, useUpdateMetahub, useDeleteMetahub, useCopyMetahub } from '../hooks/mutations'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import * as metahubsApi from '../api'
import { metahubsQueryKeys } from '../../shared'
import { Metahub, MetahubDisplay, MetahubLocalizedPayload, toMetahubDisplay, getVLCString } from '../../../types'
import metahubActions from './MetahubActions'
import { ensureLocalizedContent, extractLocalizedInput, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { sanitizeCodenameForStyle, normalizeCodenameForStyle, isValidCodenameForStyle } from '../../../utils/codename'
import { useCodenameConfig, getCodenameHelperKey } from '../../settings/hooks/useCodenameConfig'
import { CodenameField, ExistingCodenamesProvider } from '../../../components'
import { TemplateSelector } from '../../templates/ui/TemplateSelector'

// Type for metahub update/create data
type MetahubFormValues = {
    nameVlc?: VersionedLocalizedContent<string> | null
    descriptionVlc?: VersionedLocalizedContent<string> | null
    codename?: VersionedLocalizedContent<string> | null
    codenameTouched?: boolean
    storageMode?: 'main_db' | 'external_db'
    createHub?: boolean
    createCatalog?: boolean
    createSet?: boolean
    createEnumeration?: boolean
}

type GenericFormValues = Record<string, unknown>
type ListMetahubsParams = Parameters<typeof metahubsApi.listMetahubs>[0]

type TranslationFn = (key: string, options?: unknown) => string

type BaseMenuContext = {
    t: TranslationFn
} & Record<string, unknown>

type ConfirmSpec = {
    titleKey?: string
    descriptionKey?: string
    confirmKey?: string
    cancelKey?: string
    interpolate?: Record<string, unknown>
    title?: string
    description?: string
    confirmButtonName?: string
    cancelButtonName?: string
}

type ConflictState = {
    open: boolean
    conflict: ConflictInfo | null
    pendingUpdate: { id: string; patch: MetahubLocalizedPayload } | null
}

type PendingMetahubNavigation = {
    pendingId: string
    codename: string
}

const extractResponseStatus = (error: unknown): number | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const status = (response as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
}

const extractResponseMessage = (error: unknown): string | undefined => {
    if (!error || typeof error !== 'object' || !('response' in error)) return undefined
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return undefined
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object') return undefined
    const message = (data as { message?: unknown }).message
    return typeof message === 'string' ? message : undefined
}

const extractConflict = (error: unknown): ConflictInfo | null => {
    if (!error || typeof error !== 'object' || !('response' in error)) return null
    const response = (error as { response?: unknown }).response
    if (!response || typeof response !== 'object') return null
    const data = (response as { data?: unknown }).data
    if (!data || typeof data !== 'object' || !('conflict' in data)) return null
    const conflict = (data as { conflict?: unknown }).conflict
    return conflict && typeof conflict === 'object' ? (conflict as ConflictInfo) : null
}

type GeneralTabFieldsProps = {
    values: GenericFormValues
    setValue: (name: string, value: unknown) => void
    isLoading: boolean
    errors?: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
    codenameLabel: string
    codenameHelper: string
    /** Show TemplateSelector between description and codename */
    showTemplateSelector?: boolean
}

const GeneralTabFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel,
    codenameLabel,
    codenameHelper,
    showTemplateSelector
}: GeneralTabFieldsProps) => {
    const codenameConfig = useCodenameConfig()
    const fieldErrors = errors ?? {}
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codename = (values.codename as VersionedLocalizedContent<string> | null | undefined) ?? null
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const deriveCodename = useCallback(
        (nameContent: string) =>
            sanitizeCodenameForStyle(
                nameContent,
                codenameConfig.style,
                codenameConfig.alphabet,
                codenameConfig.allowMixed,
                codenameConfig.autoConvertMixedAlphabets
            ),
        [codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed, codenameConfig.autoConvertMixedAlphabets]
    )
    useCodenameAutoFillVlc({
        codename,
        codenameTouched,
        nameVlc,
        deriveCodename,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: VersionedLocalizedContent<string> | null | boolean) => void
    })

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={nameLabel}
                required
                disabled={isLoading}
                value={nameVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('nameVlc', next)}
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
                uiLocale={uiLocale}
            />
            <LocalizedInlineField
                mode='localized'
                label={descriptionLabel}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next: VersionedLocalizedContent<string> | null) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale}
                multiline
                rows={2}
            />
            {showTemplateSelector && (
                <TemplateSelector
                    value={values.templateId}
                    onChange={(id) => setValue('templateId', id)}
                    disabled={isLoading}
                    autoSelectDefault
                />
            )}
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched: boolean) => setValue('codenameTouched', touched)}
                onDuplicateStatusChange={(dup) => setValue('_hasCodenameDuplicate', dup)}
                uiLocale={uiLocale}
                label={codenameLabel}
                helperText={codenameHelper}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
        </Stack>
    )
}

/**
 * Create options tab content — checkboxes for toggling which entities
 * should be created when bootstrapping a new metahub from a template.
 */
interface MetahubCreateOptionsTabProps {
    values: GenericFormValues
    setValue: (key: string, value: unknown) => void
    isLoading: boolean
    t: TranslationFn
}

function MetahubCreateOptionsTab({ values, setValue, isLoading, t }: MetahubCreateOptionsTabProps) {
    const entityKinds = [
        { key: 'createHub', label: t('createOptions.hub') },
        { key: 'createCatalog', label: t('createOptions.catalog') },
        { key: 'createSet', label: t('createOptions.set') },
        { key: 'createEnumeration', label: t('createOptions.enumeration') }
    ]

    return (
        <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant='subtitle2' color='text.secondary'>
                {t('createOptions.alwaysCreated')}
            </Typography>
            <FormControlLabel control={<Checkbox checked disabled />} label={t('createOptions.branch')} />
            <FormControlLabel control={<Checkbox checked disabled />} label={t('createOptions.layout')} />

            <Divider />

            <Typography variant='subtitle2' color='text.secondary'>
                {t('createOptions.optionalEntities')}
            </Typography>
            {entityKinds.map(({ key, label }) => (
                <FormControlLabel
                    key={key}
                    control={
                        <Checkbox checked={values[key] !== false} onChange={(e) => setValue(key, e.target.checked)} disabled={isLoading} />
                    }
                    label={label}
                />
            ))}
        </Stack>
    )
}

const MetahubList = () => {
    const codenameConfig = useCodenameConfig()
    // Use metahubs namespace for view-specific keys, roles and access for role/permission labels
    const { t, i18n } = useTranslation(['metahubs', 'roles', 'access', 'flowList'])
    // Use common namespace for table headers and common actions (with keyPrefix for cleaner usage)
    const { t: tc } = useCommonTranslations()
    const navigate = useNavigate()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [isDialogOpen, setDialogOpen] = useState(false)
    const [view, setView] = useViewPreference(STORAGE_KEYS.METAHUB_DISPLAY_STYLE)
    const [pendingMetahubNavigation, setPendingMetahubNavigation] = useState<PendingMetahubNavigation | null>(null)

    // Get user settings for showAll preference
    const { settings } = useUserSettings()
    const showAll = settings.admin?.showAllItems ?? false
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    // Mutation hook for create (fire-and-forget with optimistic UI)
    const createMetahubMutation = useCreateMetahub()

    // Create query function that includes showAll parameter
    const queryFnWithShowAll = useCallback((params: ListMetahubsParams) => metahubsApi.listMetahubs({ ...params, showAll }), [showAll])

    // Use paginated hook for metahubs list
    const paginationResult = usePaginated<Metahub, 'name' | 'codename' | 'created' | 'updated'>({
        queryKeyFn: (params) => [...metahubsQueryKeys.list(params), { showAll }],
        queryFn: queryFnWithShowAll,
        initialLimit: 20,
        sortBy: 'updated',
        sortOrder: 'desc'
    })

    const { data: metahubs, isLoading, error } = paginationResult

    // Instant search for better UX (backend has rate limiting protection)
    const { handleSearchChange } = useDebouncedSearch({
        onSearchChange: paginationResult.actions.setSearch,
        delay: 0
    })

    // State for independent ConfirmDeleteDialog (not managed by BaseEntityMenu)
    const [deleteDialogState, setDeleteDialogState] = useState<{
        open: boolean
        metahub: MetahubDisplay | null
    }>({ open: false, metahub: null })

    // State for conflict resolution dialog
    const [conflictState, setConflictState] = useState<ConflictState>({ open: false, conflict: null, pendingUpdate: null })

    const { confirm } = useConfirm()

    const updateMetahubMutation = useUpdateMetahub()
    const deleteMetahubMutation = useDeleteMetahub()
    const copyMetahubMutation = useCopyMetahub()

    // Convert metahubs to display format
    const metahubsDisplay = useMemo(() => {
        if (!Array.isArray(metahubs)) return []
        const currentLocale = i18n.language
        return metahubs.map((metahub) => toMetahubDisplay(metahub, currentLocale))
    }, [metahubs, i18n.language])

    const metahubMap = useMemo(() => {
        if (!Array.isArray(metahubs)) return new Map<string, Metahub>()
        return new Map(metahubs.map((metahub) => [metahub.id, metahub]))
    }, [metahubs])

    useEffect(() => {
        if (!pendingMetahubNavigation) return

        if (metahubsDisplay.some((metahub) => metahub.id === pendingMetahubNavigation.pendingId)) {
            return
        }

        const resolvedMetahub = metahubsDisplay.find(
            (metahub) => !isPendingEntity(metahub) && metahub.codename === pendingMetahubNavigation.codename
        )

        if (!resolvedMetahub) return

        setPendingMetahubNavigation(null)
        navigate(`/metahub/${resolvedMetahub.id}`)
    }, [metahubsDisplay, navigate, pendingMetahubNavigation])

    const queuePendingMetahubNavigation = useCallback(
        (pendingMetahub: MetahubDisplay) => {
            if (!pendingMetahub.codename) return
            setPendingMetahubNavigation({
                pendingId: pendingMetahub.id,
                codename: pendingMetahub.codename
            })
        },
        [setPendingMetahubNavigation]
    )

    const handlePendingMetahubInteraction = useCallback(
        (pendingMetahub: MetahubDisplay) => {
            queuePendingMetahubNavigation(pendingMetahub)
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.lists(),
                entityId: pendingMetahub.id,
                extraQueryKeys: [metahubsQueryKeys.detail(pendingMetahub.id)]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, pendingInteractionMessage, queryClient, queuePendingMetahubNavigation]
    )

    // Memoize images object to prevent unnecessary re-creation on every render
    const images = useMemo(() => {
        const imagesMap: Record<string, unknown[]> = {}
        if (Array.isArray(metahubsDisplay)) {
            metahubsDisplay.forEach((metahub) => {
                if (metahub?.id) {
                    imagesMap[metahub.id] = []
                }
            })
        }
        return imagesMap
    }, [metahubsDisplay])

    const localizedFormDefaults = useMemo<MetahubFormValues>(
        () => ({
            nameVlc: null,
            descriptionVlc: null,
            codename: null,
            codenameTouched: false,
            storageMode: 'main_db',
            createHub: true,
            createCatalog: true,
            createSet: true,
            createEnumeration: true
        }),
        []
    )

    const buildFormTabs = useCallback(
        ({
            values,
            setValue,
            isLoading,
            errors
        }: {
            values: GenericFormValues
            setValue: (name: string, value: unknown) => void
            isLoading: boolean
            errors?: Record<string, string>
        }) => {
            const fieldErrors = errors ?? {}
            const storageMode = values.storageMode ?? 'main_db'

            return [
                {
                    id: 'general',
                    label: t('tabs.general'),
                    content: (
                        <GeneralTabFields
                            values={values}
                            setValue={setValue}
                            isLoading={isLoading}
                            errors={fieldErrors}
                            uiLocale={i18n.language}
                            nameLabel={tc('fields.name', 'Name')}
                            descriptionLabel={tc('fields.description', 'Description')}
                            codenameLabel={t('codename', 'Codename')}
                            codenameHelper={t(getCodenameHelperKey(codenameConfig), 'Unique identifier')}
                            showTemplateSelector
                        />
                    )
                },
                {
                    id: 'storage',
                    label: t('tabs.storage'),
                    content: (
                        <Box sx={{ mt: 2 }}>
                            <RadioGroup value={storageMode} onChange={(e) => setValue('storageMode', e.target.value)}>
                                <FormControlLabel value='main_db' control={<Radio />} label={t('storage.mainDb')} disabled={isLoading} />
                                <FormControlLabel
                                    value='external_db'
                                    control={<Radio />}
                                    label={
                                        <Box>
                                            <Typography variant='body1'>{t('storage.externalDb')}</Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                {t('storage.externalDbDisabled')}
                                            </Typography>
                                        </Box>
                                    }
                                    disabled={true}
                                />
                            </RadioGroup>
                        </Box>
                    )
                },
                {
                    id: 'create-options',
                    label: t('createOptions.tab'),
                    content: <MetahubCreateOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={t} />
                }
            ]
        },
        [codenameConfig, i18n.language, tc, t]
    )

    const validateMetahubForm = useCallback(
        (values: GenericFormValues) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            const rawCodename = getVLCString(codenameValue || undefined, codenameValue?._primary ?? 'en')
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            if (!normalizedCodename) {
                errors.codename = t('validation.codenameRequired', 'Codename is required')
            } else if (
                !isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            ) {
                errors.codename = t('validation.codenameInvalid', 'Codename contains invalid characters')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style, t, tc]
    )

    const canSaveMetahubForm = useCallback(
        (values: GenericFormValues) => {
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            const codenameValue = values.codename as VersionedLocalizedContent<string> | null | undefined
            const rawCodename = getVLCString(codenameValue || undefined, codenameValue?._primary ?? 'en')
            const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
            return (
                !values._hasCodenameDuplicate &&
                hasPrimaryContent(nameVlc) &&
                Boolean(normalizedCodename) &&
                isValidCodenameForStyle(normalizedCodename, codenameConfig.style, codenameConfig.alphabet, codenameConfig.allowMixed)
            )
        },
        [codenameConfig.allowMixed, codenameConfig.alphabet, codenameConfig.style]
    )

    const handleAddNew = () => {
        setDialogOpen(true)
    }

    const handleDialogClose = () => {
        setDialogOpen(false)
    }

    const handleCreateMetahub = (data: GenericFormValues) => {
        // Validation is handled by EntityFormDialog's validate/canSave props.
        // This handler only prepares the payload and calls mutate() fire-and-forget.
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const codenameValue = data.codename as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        const rawCodename = getVLCString(codenameValue || undefined, codenameValue?._primary ?? namePrimaryLocale ?? 'en')
        const normalizedCodename = normalizeCodenameForStyle(rawCodename, codenameConfig.style, codenameConfig.alphabet)
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
        const codenamePayload = ensureLocalizedContent(codenameValue, namePrimaryLocale ?? 'en', normalizedCodename || '')

        const createOptions = {
            createHub: data.createHub !== false,
            createCatalog: data.createCatalog !== false,
            createSet: data.createSet !== false,
            createEnumeration: data.createEnumeration !== false
        }

        // Fire-and-forget: optimistic card appears via onMutate, errors via onError snackbar,
        // cache invalidation via onSettled. Dialog closes immediately after mutate() returns.
        createMetahubMutation.mutate({
            codename: codenamePayload,
            name: nameInput ?? {},
            description: descriptionInput,
            namePrimaryLocale: namePrimaryLocale ?? '',
            descriptionPrimaryLocale,
            templateId: (data.templateId as string) || undefined,
            createOptions
        })
    }

    const handleChange = (_event: unknown, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    const metahubColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '20%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.name?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) =>
                    isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingMetahubInteraction(row)}
                            sx={{ alignItems: 'flex-start', display: 'inline-flex', justifyContent: 'flex-start', textAlign: 'left' }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    '&:hover': {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                    }
                                }}
                            >
                                {row.name || '—'}
                            </Typography>
                        </ButtonBase>
                    ) : (
                        <Link to={`/metahub/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
                                    overflowWrap: 'break-word',
                                    '&:hover': {
                                        textDecoration: 'underline',
                                        color: 'primary.main'
                                    }
                                }}
                            >
                                {row.name || '—'}
                            </Typography>
                        </Link>
                    )
            },
            {
                id: 'description',
                label: tc('table.description', 'Description'),
                width: '26%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.description?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word'
                        }}
                    >
                        {row.description || '—'}
                    </Typography>
                )
            },
            {
                id: 'codename',
                label: t('codename', 'Codename'),
                width: '14%',
                align: 'left' as const,
                sortable: true,
                sortAccessor: (row: MetahubDisplay) => row.codename?.toLowerCase() ?? '',
                render: (row: MetahubDisplay) => (
                    <Typography
                        sx={{
                            fontSize: 14,
                            wordBreak: 'break-word',
                            overflowWrap: 'break-word',
                            fontFamily: 'monospace'
                        }}
                    >
                        {row.codename || '—'}
                    </Typography>
                )
            },
            {
                id: 'role',
                label: tc('table.role', 'Role'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (row.role ? <RoleChip role={row.role} accessType={row.accessType} /> : '—')
            },
            {
                id: 'hubs',
                label: t('table.hubs'),
                width: '10%',
                align: 'center' as const,
                render: (row: MetahubDisplay) => (typeof row.hubsCount === 'number' ? row.hubsCount : '—')
            }
        ],
        [handlePendingMetahubInteraction, t, tc]
    )

    // Removed N+1 counts loading; counts are provided by backend list response

    const createMetahubContext = useCallback(
        (baseContext: BaseMenuContext) => ({
            ...baseContext,
            metahubMap,
            uiLocale: i18n.language,
            api: {
                updateEntity: (id: string, patch: MetahubLocalizedPayload) => {
                    const metahub = metahubMap.get(id)
                    const expectedVersion = metahub?.version
                    void updateMetahubMutation.mutateAsync({ id, data: patch, expectedVersion }).catch((error: unknown) => {
                        if (extractResponseStatus(error) === 409) {
                            const conflict = extractConflict(error)
                            if (conflict) {
                                setConflictState({
                                    open: true,
                                    conflict,
                                    pendingUpdate: { id, patch }
                                })
                            }
                        }
                    })

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    deleteMetahubMutation.mutate(id)
                },
                copyEntity: (
                    id: string,
                    payload: {
                        name?: Record<string, string>
                        description?: Record<string, string>
                        namePrimaryLocale?: string
                        descriptionPrimaryLocale?: string
                        codename?: string
                        copyDefaultBranchOnly?: boolean
                        copyAccess?: boolean
                    }
                ) => {
                    void copyMetahubMutation.mutateAsync({ id, data: payload }).catch(() => undefined)

                    return Promise.resolve()
                }
            },
            helpers: {
                refreshList: () => {
                    console.info('[metahub:list] explicit refreshList requested')
                    // Explicit cache invalidation
                    void queryClient.invalidateQueries({
                        queryKey: metahubsQueryKeys.lists()
                    })
                },
                confirm: async (spec: ConfirmSpec) => {
                    // Support both direct strings and translation keys
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
                // Helper to open ConfirmDeleteDialog independently from BaseEntityMenu
                openDeleteDialog: (metahub: MetahubDisplay) => {
                    setDeleteDialogState({ open: true, metahub })
                }
            }
        }),
        [
            confirm,
            copyMetahubMutation,
            deleteMetahubMutation,
            enqueueSnackbar,
            i18n.language,
            metahubMap,
            queryClient,
            updateMetahubMutation
        ]
    )

    return (
        <MainCard
            sx={{ maxWidth: '100%', width: '100%' }}
            contentSX={{ px: 0, py: 0 }}
            disableContentPadding
            disableHeader
            border={false}
            shadow={false}
        >
            <ExistingCodenamesProvider entities={metahubs ?? []}>
                {error ? (
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt='Connection error'
                        title={t('errors.connectionFailed')}
                        description={!extractResponseStatus(error) ? t('errors.checkConnection') : t('errors.pleaseTryLater')}
                        action={{
                            label: t('actions.retry'),
                            onClick: () => paginationResult.actions.goToPage(1)
                        }}
                    />
                ) : (
                    <Stack flexDirection='column' sx={{ gap: 1 }}>
                        <ViewHeader
                            search={true}
                            searchPlaceholder={t('searchPlaceholder')}
                            onSearchChange={handleSearchChange}
                            title={t('title')}
                        >
                            <ToolbarControls
                                viewToggleEnabled
                                settingsEnabled
                                viewMode={view as 'card' | 'list'}
                                onViewModeChange={(mode: string) => handleChange(null, mode)}
                                cardViewTitle={tc('cardView')}
                                listViewTitle={tc('listView')}
                                primaryAction={{
                                    label: tc('create'),
                                    onClick: handleAddNew,
                                    startIcon: <AddRoundedIcon />
                                }}
                            />
                        </ViewHeader>

                        {isLoading && metahubsDisplay.length === 0 ? (
                            view === 'card' ? (
                                <SkeletonGrid />
                            ) : (
                                <Skeleton variant='rectangular' height={120} />
                            )
                        ) : !isLoading && metahubsDisplay.length === 0 ? (
                            <EmptyListState image={APIEmptySVG} imageAlt='No metahubs' title={t('noMetahubsFound')} />
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
                                        {metahubsDisplay.map((metahub: MetahubDisplay) => {
                                            // Filter actions based on permissions (same logic as table view)
                                            const descriptors = metahubActions.filter((descriptor) => {
                                                if (descriptor.id === 'edit' || descriptor.id === 'delete' || descriptor.id === 'copy') {
                                                    return metahub.permissions?.manageMetahub
                                                }
                                                return true
                                            })

                                            return (
                                                <ItemCard
                                                    key={metahub.id}
                                                    data={metahub}
                                                    images={images[metahub.id] || []}
                                                    href={`/metahub/${metahub.id}`}
                                                    pending={isPendingEntity(metahub)}
                                                    pendingAction={getPendingAction(metahub)}
                                                    onPendingInteractionAttempt={() => handlePendingMetahubInteraction(metahub)}
                                                    footerEndContent={
                                                        metahub.role ? (
                                                            <RoleChip role={metahub.role} accessType={metahub.accessType} />
                                                        ) : null
                                                    }
                                                    headerAction={
                                                        descriptors.length > 0 ? (
                                                            <Box onClick={(e) => e.stopPropagation()}>
                                                                <BaseEntityMenu<MetahubDisplay, MetahubLocalizedPayload>
                                                                    entity={metahub}
                                                                    entityKind='metahub'
                                                                    descriptors={descriptors}
                                                                    namespace='metahubs'
                                                                    i18nInstance={i18n}
                                                                    createContext={createMetahubContext}
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
                                            data={metahubsDisplay}
                                            images={images}
                                            isLoading={isLoading}
                                            getRowLink={(row: MetahubDisplay) => (row?.id ? `/metahub/${row.id}` : undefined)}
                                            onPendingInteractionAttempt={(row: MetahubDisplay) => handlePendingMetahubInteraction(row)}
                                            customColumns={metahubColumns}
                                            i18nNamespace='flowList'
                                            renderActions={(row: MetahubDisplay) => {
                                                const descriptors = metahubActions.filter((descriptor) => {
                                                    if (
                                                        descriptor.id === 'edit' ||
                                                        descriptor.id === 'delete' ||
                                                        descriptor.id === 'copy'
                                                    ) {
                                                        return row.permissions?.manageMetahub
                                                    }
                                                    return true
                                                })

                                                if (!descriptors.length) return null

                                                return (
                                                    <BaseEntityMenu<MetahubDisplay, MetahubLocalizedPayload>
                                                        entity={row}
                                                        entityKind='metahub'
                                                        descriptors={descriptors}
                                                        // Use metahubs namespace for action item labels (edit/delete)
                                                        // but keep the button label from flowList via explicit namespaced key
                                                        namespace='metahubs'
                                                        menuButtonLabelKey='flowList:menu.button'
                                                        i18nInstance={i18n}
                                                        createContext={createMetahubContext}
                                                    />
                                                )
                                            }}
                                        />
                                    </Box>
                                )}
                            </>
                        )}

                        {/* Table Pagination at bottom - only show when there's data */}
                        {!isLoading && metahubsDisplay.length > 0 && (
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
                    title={t('createMetahub', 'Create Metahub')}
                    nameLabel={tc('fields.name', 'Name')}
                    descriptionLabel={tc('fields.description', 'Description')}
                    saveButtonText={tc('actions.create', 'Create')}
                    savingButtonText={tc('actions.creating', 'Creating...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onClose={handleDialogClose}
                    onSave={handleCreateMetahub}
                    hideDefaultFields
                    initialExtraValues={localizedFormDefaults}
                    tabs={buildFormTabs}
                    canSave={canSaveMetahubForm}
                    validate={validateMetahubForm}
                />

                {/* Independent ConfirmDeleteDialog for Delete button in edit dialog */}
                <ConfirmDeleteDialog
                    open={deleteDialogState.open}
                    title={t('confirmDelete')}
                    description={t('confirmDeleteDescription', { name: deleteDialogState.metahub?.name || '' })}
                    confirmButtonText={tc('actions.delete', 'Delete')}
                    deletingButtonText={tc('actions.deleting', 'Deleting...')}
                    cancelButtonText={tc('actions.cancel', 'Cancel')}
                    onCancel={() => setDeleteDialogState({ open: false, metahub: null })}
                    onConfirm={() => {
                        if (!deleteDialogState.metahub) return

                        deleteMetahubMutation.mutate(deleteDialogState.metahub.id, {
                            onError: (err: unknown) => {
                                const responseMessage = extractResponseMessage(err)
                                const message =
                                    typeof responseMessage === 'string'
                                        ? responseMessage
                                        : err instanceof Error
                                        ? err.message
                                        : typeof err === 'string'
                                        ? err
                                        : t('deleteError')
                                enqueueSnackbar(message, { variant: 'error' })
                            }
                        })
                    }}
                />

                {/* Conflict Resolution Dialog for optimistic locking */}
                <ConflictResolutionDialog
                    open={conflictState.open}
                    conflict={conflictState.conflict}
                    onCancel={() => {
                        setConflictState({ open: false, conflict: null, pendingUpdate: null })
                        // Refresh list to get latest data
                        queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.lists() })
                    }}
                    onOverwrite={async () => {
                        // Force update without version check
                        if (conflictState.pendingUpdate) {
                            const { id, patch } = conflictState.pendingUpdate
                            try {
                                await updateMetahubMutation.mutateAsync({ id, data: patch })
                                setConflictState({ open: false, conflict: null, pendingUpdate: null })
                            } catch {
                                enqueueSnackbar(t('updateError', 'Failed to update'), { variant: 'error' })
                            }
                        }
                    }}
                />
            </ExistingCodenamesProvider>
        </MainCard>
    )
}

export default MetahubList
