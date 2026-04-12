import { useState, useMemo, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
    Box,
    ButtonBase,
    Skeleton,
    Stack,
    Typography,
    Chip,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    FormControlLabel,
    Switch,
    Checkbox,
    Radio,
    RadioGroup
} from '@mui/material'
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
    PaginationControls,
    FlowListTable,
    gridSpacing,
    useConfirm,
    LocalizedInlineField,
    CollapsibleSection,
    revealPendingEntityFeedback,
    useListDialogs
} from '@universo/template-mui'
import { EntityFormDialog, ConfirmDeleteDialog, ConflictResolutionDialog } from '@universo/template-mui/components/dialogs'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { ViewHeaderMUI as ViewHeader, BaseEntityMenu } from '@universo/template-mui'

import { useCreatePublication, useDeletePublication, useSyncPublication, useUpdatePublication } from '../hooks/mutations'
import { usePublicationListData } from '../hooks/usePublicationListData'
import { useViewPreference } from '../../../hooks/useViewPreference'
import { STORAGE_KEYS } from '../../../constants/storage'
import { metahubsQueryKeys, invalidatePublicationsQueries } from '../../shared'
import type { VersionedLocalizedContent } from '@universo/types'
import { getVLCString, type PublicationDisplay } from '../../../types'
import { extractLocalizedInput, hasPrimaryContent, ensureLocalizedContent, normalizeLocale } from '../../../utils/localizedInput'
import { isOptimisticLockConflict, extractConflictInfo, isPendingEntity, getPendingAction, type ConflictInfo } from '@universo/utils'
import publicationActions from './PublicationActions'
import { AccessPanel } from './AccessPanel'
import type { PublicationAccessMode, Publication } from '../api'

type PublicationFormValues = {
    nameVlc: VersionedLocalizedContent<string> | null
    descriptionVlc: VersionedLocalizedContent<string> | null
    versionBranchId?: string | null
    applicationIsPublic?: boolean
    applicationWorkspacesEnabled?: boolean
}

type PublicationFormFieldsProps = {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors: Record<string, string>
    uiLocale: string
    nameLabel: string
    descriptionLabel: string
}

const PublicationFormFields = ({
    values,
    setValue,
    isLoading,
    errors,
    uiLocale,
    nameLabel,
    descriptionLabel
}: PublicationFormFieldsProps) => {
    const nameVlc = (values.nameVlc as VersionedLocalizedContent<string> | null | undefined) ?? null
    const descriptionVlc = (values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined) ?? null

    return (
        <Stack spacing={2}>
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
        </Stack>
    )
}

const PublicationList = () => {
    const navigate = useNavigate()
    const { t, i18n } = useTranslation(['metahubs', 'common', 'flowList'])
    const { t: tc } = useCommonTranslations()

    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { dialogs, openCreate, openDelete, openConflict, close } = useListDialogs<Publication>()
    const [view, setView] = useViewPreference(STORAGE_KEYS.PUBLICATION_DISPLAY_STYLE)

    const [dialogError, setDialogError] = useState<string | null>(null)
    const pendingInteractionMessage = tc('pendingCreateBlocked', 'This item is still being created. Please wait a moment and try again.')

    const {
        metahubId,
        metahub,
        isMetahubLoading,
        publications,
        isLoading,
        error,
        refetch,
        branches,
        defaultBranchId,
        getBranchLabel,
        handleSearchChange,
        searchQuery,
        visiblePublications,
        pagination,
        paginationActions,
        totalItems,
        images,
        publicationMap
    } = usePublicationListData()

    const { confirm } = useConfirm()

    const createPublicationMutation = useCreatePublication()
    const updatePublicationMutation = useUpdatePublication()
    const deletePublicationMutation = useDeletePublication()
    const syncPublicationMutation = useSyncPublication()

    const handlePendingPublicationInteraction = useCallback(
        (publicationId: string) => {
            if (!metahubId) return
            revealPendingEntityFeedback({
                queryClient,
                queryKeyPrefix: metahubsQueryKeys.publications(metahubId),
                entityId: publicationId,
                extraQueryKeys: [metahubsQueryKeys.publicationDetail(metahubId, publicationId)]
            })
            enqueueSnackbar(pendingInteractionMessage, { variant: 'info' })
        },
        [enqueueSnackbar, metahubId, pendingInteractionMessage, queryClient]
    )

    const localizedFormDefaults = useMemo<PublicationFormValues>(() => {
        // Auto-fill name: metahub name + " API" suffix across all locales
        let nameVlc: VersionedLocalizedContent<string> | null = null
        if (metahub?.name) {
            const locale = normalizeLocale(i18n.language)
            const metahubName = getVLCString(metahub.name, locale) || getVLCString(metahub.name, 'en') || ''
            if (metahubName) {
                const baseVlc = ensureLocalizedContent(metahub.name, locale, metahubName)
                if (baseVlc && 'locales' in baseVlc) {
                    const updated = { ...baseVlc, locales: { ...baseVlc.locales } }
                    for (const [loc, entry] of Object.entries(updated.locales)) {
                        if (entry && typeof entry.content === 'string' && entry.content.trim()) {
                            updated.locales[loc] = { ...entry, content: `${entry.content} API` }
                        }
                    }
                    nameVlc = updated
                }
            }
        }
        return {
            nameVlc,
            descriptionVlc: null,
            versionBranchId: defaultBranchId ?? null,
            applicationIsPublic: false,
            applicationWorkspacesEnabled: false
        }
    }, [metahub, defaultBranchId, i18n.language])

    const validatePublicationForm = useCallback(
        (values: Record<string, any>) => {
            const errors: Record<string, string> = {}
            const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
            if (!hasPrimaryContent(nameVlc)) {
                errors.nameVlc = tc('crud.nameRequired', 'Name is required')
            }
            return Object.keys(errors).length > 0 ? errors : null
        },
        [tc]
    )

    const canSavePublicationForm = useCallback((values: Record<string, any>) => {
        const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
        return hasPrimaryContent(nameVlc)
    }, [])

    /**
     * Build tabs configuration for create dialog.
     * Tab 1: General (name, description, version settings spoiler, application settings spoiler)
     * Tab 2: Access (access mode configuration)
     *
     * Note: Version and Application settings are collapsed by default under spoiler sections.
     */
    const buildCreateTabs = useCallback(
        ({
            values,
            setValue,
            isLoading: isFormLoading,
            errors
        }: {
            values: Record<string, any>
            setValue: (name: string, value: any) => void
            isLoading: boolean
            errors: Record<string, string>
        }): TabConfig[] => {
            const fieldErrors = errors ?? {}
            const applicationIsPublic = values.applicationIsPublic === true
            const applicationWorkspacesEnabled = values.applicationWorkspacesEnabled === true
            const handleApplicationVisibilityChange = (nextIsPublic: boolean) => {
                setValue('applicationIsPublic', nextIsPublic)
                if (nextIsPublic && !applicationWorkspacesEnabled) {
                    setValue('applicationWorkspacesEnabled', true)
                }
            }

            return [
                {
                    id: 'general',
                    label: t('publications.tabs.general', 'Основное'),
                    content: (
                        <Stack spacing={2}>
                            <PublicationFormFields
                                values={values}
                                setValue={setValue}
                                isLoading={isFormLoading}
                                errors={fieldErrors}
                                uiLocale={i18n.language}
                                nameLabel={tc('fields.name', 'Name')}
                                descriptionLabel={tc('fields.description', 'Description')}
                            />

                            {/* "Create version" — always ON and disabled */}
                            <FormControlLabel
                                control={<Switch checked disabled />}
                                label={t('publications.create.createVersion', 'Create version')}
                            />

                            {/* Version Settings spoiler */}
                            <CollapsibleSection label={t('publications.create.versionSettings', 'Version settings')} defaultOpen={false}>
                                <Stack spacing={2} sx={{ pl: 2 }}>
                                    <LocalizedInlineField
                                        mode='localized'
                                        label={t('publications.versions.versionName', 'Version name')}
                                        disabled={isFormLoading}
                                        value={values.versionNameVlc ?? null}
                                        onChange={(next) => setValue('versionNameVlc', next)}
                                        uiLocale={i18n.language}
                                    />
                                    <LocalizedInlineField
                                        mode='localized'
                                        label={t('publications.versions.versionDescription', 'Version description')}
                                        disabled={isFormLoading}
                                        value={values.versionDescriptionVlc ?? null}
                                        onChange={(next) => setValue('versionDescriptionVlc', next)}
                                        uiLocale={i18n.language}
                                        multiline
                                        rows={2}
                                    />
                                    <FormControl fullWidth disabled={isFormLoading}>
                                        <InputLabel id='publication-version-branch-label'>
                                            {t('publications.versions.branchLabel', 'Branch for version')}
                                        </InputLabel>
                                        <Select
                                            labelId='publication-version-branch-label'
                                            value={values.versionBranchId ?? defaultBranchId ?? ''}
                                            label={t('publications.versions.branchLabel', 'Branch for version')}
                                            onChange={(event) => setValue('versionBranchId', event.target.value)}
                                        >
                                            {branches.map((branch) => (
                                                <MenuItem key={branch.id} value={branch.id}>
                                                    {getBranchLabel(branch.id)}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        <FormHelperText>
                                            {t(
                                                'publications.versions.branchHelper',
                                                'The version snapshot will be created from the selected branch.'
                                            )}
                                        </FormHelperText>
                                    </FormControl>
                                </Stack>
                            </CollapsibleSection>

                            {/* Application toggles — above the spoiler */}
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={Boolean(values.autoCreateApplication)}
                                        onChange={(e) => {
                                            const checked = e.target.checked
                                            setValue('autoCreateApplication', checked)
                                            if (!checked) {
                                                setValue('createApplicationSchema', false)
                                            }
                                        }}
                                        disabled={isFormLoading}
                                    />
                                }
                                label={t('publications.create.createApplication', 'Create application')}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={Boolean(values.createApplicationSchema)}
                                        onChange={(e) => setValue('createApplicationSchema', e.target.checked)}
                                        disabled={isFormLoading || !values.autoCreateApplication}
                                    />
                                }
                                label={t('publications.create.createApplicationSchema', 'Create application schema')}
                            />

                            {values.autoCreateApplication && (
                                <Alert severity='info' sx={{ mt: 1 }}>
                                    {t(
                                        'publications.create.applicationWillBeCreated',
                                        'An application and a connector linked to this Metahub will be created.'
                                    )}
                                </Alert>
                            )}

                            {/* Application Settings spoiler — name/description override */}
                            {values.autoCreateApplication && (
                                <CollapsibleSection
                                    label={t('publications.create.applicationSettings', 'Application settings')}
                                    defaultOpen={false}
                                >
                                    <Stack spacing={2} sx={{ pl: 2 }}>
                                        <LocalizedInlineField
                                            mode='localized'
                                            label={tc('fields.name', 'Name')}
                                            disabled={isFormLoading}
                                            value={values.applicationNameVlc ?? null}
                                            onChange={(next) => setValue('applicationNameVlc', next)}
                                            uiLocale={i18n.language}
                                        />
                                        <LocalizedInlineField
                                            mode='localized'
                                            label={tc('fields.description', 'Description')}
                                            disabled={isFormLoading}
                                            value={values.applicationDescriptionVlc ?? null}
                                            onChange={(next) => setValue('applicationDescriptionVlc', next)}
                                            uiLocale={i18n.language}
                                            multiline
                                            rows={2}
                                        />
                                        <RadioGroup
                                            value={applicationIsPublic ? 'public' : 'closed'}
                                            onChange={(event) => handleApplicationVisibilityChange(event.target.value === 'public')}
                                        >
                                            <FormControlLabel
                                                value='closed'
                                                control={<Radio />}
                                                label={t('publications.applicationParameters.visibility.closed', 'Closed')}
                                                disabled={isFormLoading}
                                            />
                                            <FormControlLabel
                                                value='public'
                                                control={<Radio />}
                                                label={t('publications.applicationParameters.visibility.public', 'Public')}
                                                disabled={isFormLoading}
                                            />
                                        </RadioGroup>
                                        <Alert severity='info'>
                                            {t(
                                                'publications.applicationParameters.visibilityHint',
                                                'Application visibility cannot be changed after creation.'
                                            )}
                                        </Alert>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={applicationWorkspacesEnabled}
                                                    onChange={(event) => setValue('applicationWorkspacesEnabled', event.target.checked)}
                                                    disabled={isFormLoading}
                                                />
                                            }
                                            label={t('publications.applicationParameters.workspacesEnabled', 'Add workspaces')}
                                        />
                                        <Alert severity='info'>
                                            {t(
                                                'publications.applicationParameters.workspacesHint',
                                                'Workspace mode cannot be disabled after the application is created.'
                                            )}
                                        </Alert>
                                        {applicationIsPublic && !applicationWorkspacesEnabled ? (
                                            <Alert severity='warning'>
                                                {t(
                                                    'publications.applicationParameters.publicWorkspacesRecommended',
                                                    'Workspaces are recommended for public applications to isolate each participant data.'
                                                )}
                                            </Alert>
                                        ) : null}
                                    </Stack>
                                </CollapsibleSection>
                            )}
                        </Stack>
                    )
                },
                {
                    id: 'access',
                    label: t('publications.tabs.access', 'Access'),
                    content: (
                        <AccessPanel
                            accessMode={(values.accessMode as PublicationAccessMode) ?? 'full'}
                            onChange={(mode) => setValue('accessMode', mode)}
                            isLoading={isFormLoading}
                            disabled={isFormLoading}
                        />
                    )
                }
            ]
        },
        [branches, defaultBranchId, getBranchLabel, i18n.language, t, tc]
    )

    // Access mode chip colors
    const accessModeColors: Record<'full' | 'restricted', 'success' | 'warning'> = {
        full: 'success',
        restricted: 'warning'
    }

    const publicationColumns = useMemo(
        () => [
            {
                id: 'name',
                label: tc('table.name', 'Name'),
                width: '35%',
                align: 'left' as const,
                render: (row: PublicationDisplay) =>
                    isPendingEntity(row) ? (
                        <ButtonBase
                            onClick={() => handlePendingPublicationInteraction(row.id)}
                            sx={{ alignItems: 'flex-start', display: 'inline-flex', justifyContent: 'flex-start', textAlign: 'left' }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
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
                        <Link
                            to={`/metahub/${metahubId}/publication/${row.id}/versions`}
                            style={{ textDecoration: 'none', color: 'inherit' }}
                        >
                            <Typography
                                sx={{
                                    fontSize: 14,
                                    fontWeight: 500,
                                    wordBreak: 'break-word',
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
                width: '45%',
                align: 'left' as const,
                render: (row: PublicationDisplay) => (
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
                id: 'accessMode',
                label: t('publications.table.accessMode', 'Access'),
                width: '20%',
                align: 'center' as const,
                render: (row: PublicationDisplay) => (
                    <Chip
                        label={t(`publications.accessMode.${row.accessMode}`, row.accessMode === 'full' ? 'Full Access' : 'Restricted')}
                        color={accessModeColors[row.accessMode]}
                        size='small'
                    />
                )
            }
        ],
        [handlePendingPublicationInteraction, metahubId, t, tc]
    )

    const createPublicationContext = useCallback(
        (baseContext: any) => ({
            ...baseContext,
            publicationMap,
            uiLocale: i18n.language,
            metahubId,
            metahub, // Pass metahub for MetahubInfoPanel in edit dialog
            isMetahubLoading, // Pass loading state for metahub
            canDeletePublication: true,
            api: {
                updateEntity: (id: string, data: any) => {
                    if (!metahubId) return Promise.resolve()
                    const publication = publicationMap.get(id)
                    const expectedVersion = publication?.version
                    updatePublicationMutation.mutate(
                        {
                            metahubId,
                            publicationId: id,
                            data: { ...data, expectedVersion }
                        },
                        {
                            onError: (error: unknown) => {
                                if (isOptimisticLockConflict(error)) {
                                    const conflict = extractConflictInfo(error)
                                    if (conflict) {
                                        openConflict({ conflict, pendingUpdate: { id, patch: data } })
                                    }
                                }
                            }
                        }
                    )

                    return Promise.resolve()
                },
                deleteEntity: (id: string) => {
                    if (!metahubId) return
                    return deletePublicationMutation.mutateAsync({ metahubId, publicationId: id })
                },
                syncEntity: async (id: string, confirmDestructive?: boolean) => {
                    if (!metahubId) return
                    await syncPublicationMutation.mutateAsync({ metahubId, publicationId: id, confirmDestructive })
                }
            },
            helpers: {
                refreshList: () => {
                    if (metahubId) {
                        void invalidatePublicationsQueries.all(queryClient, metahubId)
                    }
                },
                openDeleteDialog: (entity: PublicationDisplay) => {
                    // Find the original publication from the map
                    const publication = publicationMap.get(entity.id)
                    if (publication) {
                        openDelete(publication)
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
                navigate
            }
        }),
        [
            publicationMap,
            confirm,
            deletePublicationMutation,
            enqueueSnackbar,
            i18n.language,
            isMetahubLoading,
            metahub,
            metahubId,
            navigate,
            queryClient,
            syncPublicationMutation,
            updatePublicationMutation
        ]
    )

    // Validate metahubId from URL AFTER all hooks
    if (!metahubId) {
        return (
            <EmptyListState
                image={APIEmptySVG}
                imageAlt='Invalid metahub'
                title={t('metahubs:errors.invalidMetahub')}
                description={t('metahubs:errors.pleaseSelectMetahub')}
            />
        )
    }

    const handleAddNew = () => {
        openCreate()
    }

    const handleDialogClose = () => {
        close('create')
    }

    const handleDialogSave = () => {
        close('create')
    }

    const handleCreatePublication = (data: Record<string, any>) => {
        setDialogError(null)
        const nameVlc = data.nameVlc as VersionedLocalizedContent<string> | null | undefined
        const descriptionVlc = data.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
        if (!nameInput || !namePrimaryLocale) {
            setDialogError(tc('crud.nameRequired', 'Name is required'))
            return
        }
        const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)

        // Extract version fields
        const versionNameVlc = data.versionNameVlc as VersionedLocalizedContent<string> | null | undefined
        const versionDescriptionVlc = data.versionDescriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: versionNameInput, primaryLocale: versionNamePrimaryLocale } = extractLocalizedInput(versionNameVlc)
        const { input: versionDescriptionInput, primaryLocale: versionDescriptionPrimaryLocale } =
            extractLocalizedInput(versionDescriptionVlc)
        const versionBranchId = (data.versionBranchId as string | null | undefined) ?? defaultBranchId ?? undefined

        // Extract optional application name/description override
        const appNameVlc = data.applicationNameVlc as VersionedLocalizedContent<string> | null | undefined
        const appDescriptionVlc = data.applicationDescriptionVlc as VersionedLocalizedContent<string> | null | undefined
        const { input: applicationNameInput, primaryLocale: applicationNamePrimaryLocale } = extractLocalizedInput(appNameVlc)
        const { input: applicationDescriptionInput, primaryLocale: applicationDescriptionPrimaryLocale } =
            extractLocalizedInput(appDescriptionVlc)

        createPublicationMutation.mutate({
            metahubId,
            data: {
                name: nameInput,
                description: descriptionInput,
                namePrimaryLocale,
                descriptionPrimaryLocale,
                autoCreateApplication: Boolean(data.autoCreateApplication),
                createApplicationSchema: Boolean(data.createApplicationSchema),
                // First version data
                versionName: versionNameInput,
                versionDescription: versionDescriptionInput,
                versionNamePrimaryLocale,
                versionDescriptionPrimaryLocale,
                versionBranchId,
                // Optional application name/description override
                applicationName: applicationNameInput,
                applicationDescription: applicationDescriptionInput,
                applicationNamePrimaryLocale,
                applicationDescriptionPrimaryLocale,
                applicationIsPublic: Boolean(data.applicationIsPublic),
                applicationWorkspacesEnabled: Boolean(data.applicationWorkspacesEnabled)
            }
        })

        handleDialogSave()
    }

    const handleChange = (_event: any, nextView: string | null) => {
        if (nextView === null) return
        setView(nextView as 'card' | 'table')
    }

    // Transform Publication data for display
    const getPublicationCardData = (publication: Publication): PublicationDisplay => ({
        id: publication.id,
        name: getVLCString(publication.name, i18n.language) || '',
        description: getVLCString(publication.description, i18n.language) || '',
        accessMode: publication.accessMode ?? 'full'
    })

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
                        label: t('common:actions.retry', 'Retry'),
                        onClick: () => refetch()
                    }}
                />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 1 }}>
                    <ViewHeader
                        search={true}
                        onSearchChange={handleSearchChange}
                        searchPlaceholder={t('publications.searchPlaceholder')}
                        title={t('publications.title')}
                    >
                        <ToolbarControls
                            viewToggleEnabled
                            viewMode={view as 'card' | 'list'}
                            onViewModeChange={(mode: string) => handleChange(null, mode)}
                            cardViewTitle={tc('cardView')}
                            listViewTitle={tc('listView')}
                            primaryAction={{
                                label: tc('create'),
                                onClick: handleAddNew,
                                startIcon: <AddRoundedIcon />,
                                disabled: publications.length > 0
                            }}
                        />
                    </ViewHeader>

                    {/* Info banner: temporary single-publication limit - shown below header, above content */}
                    {publications.length > 0 && (
                        <Alert
                            severity='info'
                            icon={<InfoIcon />}
                            sx={{
                                mt: 0,
                                mb: 2
                            }}
                        >
                            {t(
                                'publications.singlePublicationLimit',
                                'Currently, only one Publication per Metahub is supported. Also, after creating a Publication, it cannot be deleted separately, only together with the entire Metahub. In future versions of Universo Platformo, these restrictions will be removed.'
                            )}
                        </Alert>
                    )}

                    {isLoading && publications.length === 0 ? (
                        view === 'card' ? (
                            <SkeletonGrid insetMode='content' />
                        ) : (
                            <Skeleton variant='rectangular' height={120} />
                        )
                    ) : !isLoading && totalItems === 0 ? (
                        <EmptyListState
                            image={APIEmptySVG}
                            imageAlt='No publications'
                            title={searchQuery.trim() ? t('publications.noResults') : t('publications.empty')}
                            description={searchQuery.trim() ? t('publications.noResultsDescription') : t('publications.emptyDescription')}
                        />
                    ) : (
                        <>
                            {view === 'card' ? (
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gap: gridSpacing,
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                                            lg: 'repeat(auto-fill, minmax(260px, 1fr))'
                                        },
                                        justifyContent: 'start',
                                        alignContent: 'start'
                                    }}
                                >
                                    {visiblePublications.map((publication: Publication) => {
                                        const descriptors = [...publicationActions]
                                        const cardData = getPublicationCardData(publication)

                                        return (
                                            <ItemCard
                                                key={publication.id}
                                                data={cardData}
                                                images={images[publication.id] || []}
                                                onClick={() => navigate(`/metahub/${metahubId}/publication/${publication.id}/versions`)}
                                                pending={isPendingEntity(publication)}
                                                pendingAction={getPendingAction(publication)}
                                                onPendingInteractionAttempt={() => handlePendingPublicationInteraction(publication.id)}
                                                footerEndContent={
                                                    <Chip
                                                        label={t(
                                                            `publications.accessMode.${cardData.accessMode}`,
                                                            cardData.accessMode === 'full' ? 'Full Access' : 'Restricted'
                                                        )}
                                                        color={cardData.accessMode === 'full' ? 'success' : 'warning'}
                                                        size='small'
                                                    />
                                                }
                                                headerAction={
                                                    descriptors.length > 0 ? (
                                                        <Box onClick={(e) => e.stopPropagation()}>
                                                            <BaseEntityMenu<PublicationDisplay, Record<string, any>>
                                                                entity={cardData}
                                                                entityKind='publication'
                                                                descriptors={descriptors}
                                                                namespace='metahubs'
                                                                i18nInstance={i18n}
                                                                createContext={createPublicationContext}
                                                            />
                                                        </Box>
                                                    ) : null
                                                }
                                            />
                                        )
                                    })}
                                </Box>
                            ) : (
                                <Box>
                                    <FlowListTable
                                        data={visiblePublications.map(getPublicationCardData)}
                                        images={images}
                                        isLoading={isLoading}
                                        customColumns={publicationColumns}
                                        getRowLink={(row: any) =>
                                            row?.id ? `/metahub/${metahubId}/publication/${row.id}/versions` : undefined
                                        }
                                        onPendingInteractionAttempt={(row: PublicationDisplay) =>
                                            handlePendingPublicationInteraction(row.id)
                                        }
                                        i18nNamespace='flowList'
                                        renderActions={(row: any) => {
                                            const originalPublication = publications.find((a) => a.id === row.id)
                                            if (!originalPublication) return null

                                            const descriptors = [...publicationActions]
                                            if (!descriptors.length) return null

                                            return (
                                                <BaseEntityMenu<PublicationDisplay, Record<string, any>>
                                                    entity={getPublicationCardData(originalPublication)}
                                                    entityKind='publication'
                                                    descriptors={descriptors}
                                                    namespace='metahubs'
                                                    menuButtonLabelKey='flowList:menu.button'
                                                    i18nInstance={i18n}
                                                    createContext={createPublicationContext}
                                                />
                                            )
                                        }}
                                    />
                                </Box>
                            )}

                            {totalItems > 0 && (
                                <Box sx={{ mt: 2 }}>
                                    <PaginationControls
                                        pagination={pagination}
                                        actions={paginationActions}
                                        isLoading={isLoading}
                                        rowsPerPageOptions={[10, 20, 50, 100]}
                                        namespace='common'
                                    />
                                </Box>
                            )}
                        </>
                    )}
                </Stack>
            )}

            <EntityFormDialog
                open={dialogs.create.open}
                title={t('publications.createDialog.title', 'Create Publication')}
                nameLabel={tc('fields.name', 'Name')}
                descriptionLabel={tc('fields.description', 'Description')}
                saveButtonText={tc('actions.create', 'Create')}
                savingButtonText={tc('actions.creating', 'Creating...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                loading={createPublicationMutation.isPending}
                error={dialogError || undefined}
                onClose={handleDialogClose}
                onSave={handleCreatePublication}
                hideDefaultFields
                initialExtraValues={localizedFormDefaults}
                tabs={buildCreateTabs}
                validate={validatePublicationForm}
                canSave={canSavePublicationForm}
            />

            {/* Independent ConfirmDeleteDialog for Publications */}
            <ConfirmDeleteDialog
                open={dialogs.delete.open}
                title={t('publications.deleteDialog.title')}
                description={t('publications.deleteDialog.warning')}
                confirmButtonText={tc('actions.delete', 'Delete')}
                deletingButtonText={tc('actions.deleting', 'Deleting...')}
                cancelButtonText={tc('actions.cancel', 'Cancel')}
                onCancel={() => close('delete')}
                onConfirm={() => {
                    if (!dialogs.delete.item || !metahubId) return

                    deletePublicationMutation.mutate(
                        {
                            metahubId,
                            publicationId: dialogs.delete.item.id
                        },
                        {
                            onSuccess: () => {
                                void invalidatePublicationsQueries.all(queryClient, metahubId)
                            },
                            onError: (err: unknown) => {
                                const responseMessage =
                                    err && typeof err === 'object' && 'response' in err ? (err as any)?.response?.data?.message : undefined
                                const message =
                                    typeof responseMessage === 'string'
                                        ? responseMessage
                                        : err instanceof Error
                                        ? err.message
                                        : typeof err === 'string'
                                        ? err
                                        : t('publications.messages.deleteError')
                                enqueueSnackbar(message, { variant: 'error' })
                            }
                        }
                    )
                }}
            />
            <ConflictResolutionDialog
                open={dialogs.conflict.open}
                conflict={(dialogs.conflict.data as { conflict?: ConflictInfo })?.conflict ?? null}
                onCancel={() => {
                    close('conflict')
                    if (metahubId) {
                        invalidatePublicationsQueries.all(queryClient, metahubId)
                    }
                }}
                onOverwrite={async () => {
                    const pendingUpdate = (dialogs.conflict.data as { pendingUpdate?: { id: string; patch: any } })?.pendingUpdate
                    if (pendingUpdate && metahubId) {
                        const { id, patch } = pendingUpdate
                        await updatePublicationMutation.mutateAsync({
                            metahubId,
                            publicationId: id,
                            data: patch
                        })
                        close('conflict')
                    }
                }}
                isLoading={updatePublicationMutation.isPending}
            />
        </MainCard>
    )
}

export default PublicationList
