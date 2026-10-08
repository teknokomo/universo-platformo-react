import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { useCommonTranslations } from '@universo-react/i18n'
import { useConfirm } from '@universo-react/template-mui'
import type {
    ApplicationLayout,
    ApplicationLayoutCreate,
    ApplicationLayoutScope,
    ApplicationLayoutWidget,
    ApplicationLayoutWidgetMutation,
    ApplicationLayoutDetailResponse,
    LayoutLogicalPlacement,
    ApplicationTemplateKey
} from '@universo-react/types'
import { canAddApplicationLayoutWidget, getLayoutWidgetDefinition } from '@universo-react/types'
import { extractAxiosError } from '@universo-react/utils'
import {
    copyApplicationLayout,
    createApplicationLayout,
    deleteApplicationLayout,
    deleteApplicationLayoutWidget,
    getApplicationLayout,
    listApplicationLayoutScopes,
    listApplicationLayoutWidgetObject,
    listApplicationLayouts,
    moveApplicationLayoutWidget,
    resetApplicationLayoutConfig,
    resetApplicationLayoutZoneSetting,
    resetApplicationLayoutWidgetConfigsBatch,
    toggleApplicationLayoutWidget,
    upsertApplicationLayoutWidget,
    updateApplicationLayout,
    updateApplicationLayoutWidgetConfig,
    updateApplicationLayoutZoneSetting
} from '../../api/applications'
import { applicationsQueryKeys, invalidateApplicationRuntimeQueries } from '../../api/queryKeys'
import type { InterpretationNetworkMatrixSettings } from '../application-settings/MatrixSettingsPanel'
import { STORAGE_KEYS } from '../../constants/storage'
import { useViewPreference } from '../../hooks/useViewPreference'
import type { Application } from '../../types'

import {
    canOverrideActive,
    canOverrideRootOrder,
    canResetSourcePresentation,
    canUpdateSourcePresentation,
    getApplicationPlacementOverridePolicy,
    hasSourceOwnedPlacement,
    marketingHeaderSettingDefinition,
    patchMarketingHeaderPosition,
    resetMarketingHeaderPosition,
    resolveLocalizedText,
    type LayoutMenuState,
    type WidgetPresentationEditorState
} from './applicationLayoutSupport'

export const useApplicationLayoutsController = () => {
    const { applicationId, layoutId } = useParams<{ applicationId: string; layoutId?: string }>()
    const { t, i18n } = useTranslation('applications')
    const { t: tc } = useCommonTranslations()
    const { enqueueSnackbar } = useSnackbar()
    const { confirm } = useConfirm()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const applicationAccess = applicationId ? queryClient.getQueryData<Application>(applicationsQueryKeys.detail(applicationId)) : undefined
    const canManageLayouts =
        typeof applicationAccess?.permissions?.manageApplication === 'boolean'
            ? applicationAccess.permissions.manageApplication
            : applicationAccess?.role === 'owner' || applicationAccess?.role === 'admin'

    const [view, setView] = useViewPreference(STORAGE_KEYS.LAYOUT_DISPLAY_STYLE)
    const [scopeFilter, setScopeFilter] = useState<string>('all')
    const [searchValue, setSearchValue] = useState('')
    const [menuState, setMenuState] = useState<LayoutMenuState>({ anchorEl: null, layout: null })
    const [createOpen, setCreateOpen] = useState(false)
    const [name, setName] = useState('')
    const [scopeId, setScopeId] = useState<string>('global')
    const [createTemplateKey, setCreateTemplateKey] = useState<ApplicationTemplateKey>('dashboard')
    const [templateFilter, setTemplateFilter] = useState<'all' | ApplicationTemplateKey>('all')
    const [editingLayout, setEditingLayout] = useState<ApplicationLayout | null>(null)
    const [layoutNameEn, setLayoutNameEn] = useState('')
    const [layoutNameRu, setLayoutNameRu] = useState('')
    const [layoutDescriptionEn, setLayoutDescriptionEn] = useState('')
    const [layoutDescriptionRu, setLayoutDescriptionRu] = useState('')
    const [interpretationNetworkEditingWidget, setInterpretationNetworkEditingWidget] = useState<ApplicationLayoutWidget | null>(null)
    const [interpretationNetworkInitialSettings, setInterpretationNetworkInitialSettings] =
        useState<InterpretationNetworkMatrixSettings | null>(null)
    const [interpretationNetworkDraft, setInterpretationNetworkDraft] = useState<InterpretationNetworkMatrixSettings | null>(null)
    const [interpretationNetworkDraftHasChanges, setInterpretationNetworkDraftHasChanges] = useState(false)
    const [workspaceSwitcherEditingWidget, setWorkspaceSwitcherEditingWidget] = useState<ApplicationLayoutWidget | null>(null)
    const [widgetPresentationEditor, setWidgetPresentationEditor] = useState<WidgetPresentationEditorState>({
        open: false,
        zone: null,
        widgetId: null,
        widgetKey: null,
        config: null
    })
    const [zoneSettingsOpen, setZoneSettingsOpen] = useState(false)
    const [zoneSettingsError, setZoneSettingsError] = useState<string | null>(null)
    const [widgetMutationError, setWidgetMutationError] = useState<{ scope: string; message: string } | null>(null)
    const layoutScopeKey = `${applicationId ?? ''}:${layoutId ?? ''}`
    const layoutDetailQueryKey =
        applicationId && layoutId ? applicationsQueryKeys.layoutDetail(applicationId, layoutId) : ['application-layout-detail-empty']

    const scopesQuery = useQuery({
        queryKey: applicationId ? applicationsQueryKeys.layoutScopes(applicationId, i18n.language) : ['application-layout-scopes-empty'],
        queryFn: () => listApplicationLayoutScopes(String(applicationId), i18n.language),
        enabled: Boolean(applicationId)
    })

    const layoutsQuery = useQuery({
        queryKey: applicationId
            ? applicationsQueryKeys.layoutsList(applicationId, {
                  sortOrder: 'asc',
                  limit: 100,
                  offset: 0,
                  scopeEntityId: scopeFilter === 'all' ? undefined : scopeFilter === 'global' ? null : scopeFilter
              })
            : ['application-layouts-empty'],
        queryFn: () =>
            listApplicationLayouts(String(applicationId), {
                sortOrder: 'asc',
                limit: 100,
                offset: 0,
                scopeEntityId: scopeFilter === 'all' ? undefined : scopeFilter === 'global' ? null : scopeFilter
            }),
        enabled: Boolean(applicationId)
    })

    const detailQuery = useQuery({
        queryKey: layoutDetailQueryKey,
        queryFn: async () => {
            const response = await getApplicationLayout(String(applicationId), String(layoutId))
            return {
                ...response,
                widgets: response.widgets.map((widget) => ({
                    ...widget,
                    config: widget.config,
                    sourceConfig: widget.sourceConfig
                }))
            }
        },
        enabled: Boolean(applicationId && layoutId)
    })

    const widgetObjectQuery = useQuery({
        queryKey:
            applicationId && layoutId
                ? [...applicationsQueryKeys.layoutZoneWidgets(applicationId, layoutId), 'object']
                : ['layout-widget-object-empty'],
        queryFn: () => listApplicationLayoutWidgetObject(String(applicationId), String(layoutId)),
        enabled: Boolean(applicationId && layoutId)
    })

    const getWidgetPlacementOverridePolicy = (widget: ApplicationLayoutWidget) =>
        getApplicationPlacementOverridePolicy(widget, widgetObjectQuery.data)

    const scopesById = useMemo(() => {
        const map = new Map<string, ApplicationLayoutScope>()
        for (const scope of scopesQuery.data ?? []) {
            map.set(scope.id, scope)
        }
        return map
    }, [scopesQuery.data])

    const invalidateLayouts = async () => {
        if (!applicationId) return
        await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.layouts(applicationId) })
        await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.applicationDiff(applicationId) })
        await invalidateApplicationRuntimeQueries.all(queryClient, applicationId)
        if (layoutId) {
            await queryClient.invalidateQueries({ queryKey: applicationsQueryKeys.layoutDetail(applicationId, layoutId) })
        }
    }

    const notifyLayoutMutationError = (error: unknown, fallbackKey: string, fallbackMessage: string) => {
        const apiError = extractAxiosError(error)
        const message =
            apiError.code === 'APPLICATION_LAYOUT_VERSION_CONFLICT'
                ? t('layouts.versionConflict', 'This layout changed in another session. Reload it and try again.')
                : t(fallbackKey, fallbackMessage)
        enqueueSnackbar(message, { variant: 'error' })
    }

    const notifyWidgetMutationError = (error: unknown, fallbackKey: string, fallbackMessage: string) => {
        const apiError = extractAxiosError(error)
        if (
            apiError.code === 'APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT' ||
            apiError.message === 'APPLICATION_LAYOUT_MARKETING_HERO_ACTION_INTEGRITY_CONFLICT'
        ) {
            setWidgetMutationError({
                scope: layoutScopeKey,
                message: t(
                    'layouts.marketing.heroActionIntegrityConflict',
                    'This section is used by a Hero action. Change that action or keep the section active.'
                )
            })
            return
        }
        const message =
            apiError.code === 'APPLICATION_LAYOUT_WIDGET_VERSION_CONFLICT' ||
            apiError.message === 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'
                ? t('layouts.widgetVersionConflict', 'This widget changed in another session. Reload the layout and try again.')
                : t(fallbackKey, fallbackMessage)
        enqueueSnackbar(message, { variant: 'error' })
    }

    const createMutation = useMutation({
        mutationFn: (payload: ApplicationLayoutCreate) => createApplicationLayout(String(applicationId), payload),
        onError: (error) => notifyLayoutMutationError(error, 'layouts.createError', 'Failed to create layout.'),
        onSuccess: async () => {
            setCreateOpen(false)
            setName('')
            setScopeId('global')
            setCreateTemplateKey(applicationTemplateKey)
            await invalidateLayouts()
        }
    })

    const updateMutation = useMutation({
        mutationFn: ({ layout, data }: { layout: ApplicationLayout; data: Partial<ApplicationLayout> }) =>
            updateApplicationLayout(String(applicationId), layout.id, { ...data, expectedVersion: layout.version }),
        onError: (error) => {
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_LAYOUT_TEMPLATE_IMMUTABLE'
                    ? t('layouts.templateImmutable', 'A layout template cannot be changed after creation.')
                    : apiError.code === 'APPLICATION_LAYOUT_INVALID'
                    ? t('layouts.invalidRequest', 'The layout data is invalid. Review the fields and try again.')
                    : apiError.code === 'APPLICATION_LAYOUT_VERSION_CONFLICT'
                    ? t('layouts.versionConflict', 'This layout changed in another session. Reload it and try again.')
                    : t('layouts.saveError', 'Failed to save layout settings.')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: invalidateLayouts
    })

    const resetMarketingAppearanceMutation = useMutation({
        mutationFn: ({ layout }: { layout: ApplicationLayout }) =>
            resetApplicationLayoutConfig(String(applicationId), layout.id, { expectedVersion: layout.version }),
        onError: (error) => {
            const apiError = extractAxiosError(error)
            const errorCode = apiError.code ?? apiError.message
            const message =
                errorCode === 'APPLICATION_LAYOUT_VERSION_CONFLICT'
                    ? t(
                          'layouts.marketing.resetConflict',
                          'Marketing appearance changed while you were editing. Reload the layout and try again.'
                      )
                    : errorCode === 'APPLICATION_LAYOUT_MARKETING_RESET_NOT_SUPPORTED'
                    ? t('layouts.marketing.resetUnsupported', 'Only marketing page layouts can restore marketing appearance defaults.')
                    : t('layouts.marketing.resetError', 'Failed to restore marketing appearance defaults.')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            enqueueSnackbar(t('layouts.marketing.resetSuccess', 'Marketing appearance restored to template defaults.'), {
                variant: 'success'
            })
            await invalidateLayouts()
        }
    })

    const updateZoneSettingMutation = useMutation({
        mutationFn: ({ layout, settingKey, value }: { layout: ApplicationLayout; settingKey: string; value: string }) =>
            updateApplicationLayoutZoneSetting(String(applicationId), layout.id, 'marketing-header', settingKey, {
                value,
                expectedVersion: layout.version
            }),
        onMutate: async ({ layout: _layout, value }) => {
            setZoneSettingsError(null)
            await queryClient.cancelQueries({ queryKey: layoutDetailQueryKey })
            const previous = queryClient.getQueryData<{ item: ApplicationLayout; widgets: ApplicationLayoutWidget[] }>(layoutDetailQueryKey)
            queryClient.setQueryData(layoutDetailQueryKey, (current: typeof previous) =>
                current ? { ...current, item: patchMarketingHeaderPosition(current.item, value) } : current
            )
            return { previous }
        },
        onError: (error, _variables, context) => {
            if (context?.previous) queryClient.setQueryData(layoutDetailQueryKey, context.previous)
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' ||
                apiError.code === 'APPLICATION_LAYOUT_VERSION_CONFLICT'
                    ? t('layouts.zoneSettingVersionConflict', 'This layout changed in another session. Reload it and try again.')
                    : apiError.code === 'APPLICATION_LAYOUT_ZONE_SETTING_CONFLICT'
                    ? t('layouts.zoneSettingUnresolved', 'Resolve the layout source conflict before changing this setting.')
                    : t('layouts.zoneSettingUpdateError', 'Failed to save zone settings.')
            setZoneSettingsError(message)
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            setZoneSettingsOpen(false)
            await invalidateLayouts()
        }
    })

    const resetZoneSettingMutation = useMutation({
        mutationFn: (layout: ApplicationLayout) => {
            const settingKey = marketingHeaderSettingDefinition?.key
            if (!settingKey) return Promise.reject(new Error('LAYOUT_ZONE_SETTING_UNAVAILABLE'))
            return resetApplicationLayoutZoneSetting(String(applicationId), layout.id, 'marketing-header', settingKey, {
                expectedVersion: layout.version
            })
        },
        onMutate: async (_layout) => {
            setZoneSettingsError(null)
            await queryClient.cancelQueries({ queryKey: layoutDetailQueryKey })
            const previous = queryClient.getQueryData<{ item: ApplicationLayout; widgets: ApplicationLayoutWidget[] }>(layoutDetailQueryKey)
            queryClient.setQueryData(layoutDetailQueryKey, (current: typeof previous) =>
                current ? { ...current, item: resetMarketingHeaderPosition(current.item) } : current
            )
            return { previous }
        },
        onError: (error, _layout, context) => {
            if (context?.previous) queryClient.setQueryData(layoutDetailQueryKey, context.previous)
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_LAYOUT_ZONE_SETTING_VERSION_CONFLICT' ||
                apiError.code === 'APPLICATION_LAYOUT_VERSION_CONFLICT'
                    ? t('layouts.zoneSettingVersionConflict', 'This layout changed in another session. Reload it and try again.')
                    : t('layouts.zoneSettingResetError', 'Failed to reset zone settings.')
            setZoneSettingsError(message)
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            setZoneSettingsOpen(false)
            await invalidateLayouts()
        }
    })

    const requestMarketingAppearanceReset = async (layout: ApplicationLayout) => {
        if (resetMarketingAppearanceMutation.isPending) return
        const confirmed = await confirm({
            title: t('layouts.marketing.resetTitle', 'Restore marketing page defaults?'),
            description: t(
                'layouts.marketing.resetDescription',
                'This restores the theme, colors, and action policy for this application layout. Widget composition and content records will not change.'
            ),
            confirmButtonName: t('layouts.marketing.resetConfirm', 'Restore defaults'),
            cancelButtonName: tc('actions.cancel', 'Cancel')
        })
        if (confirmed) resetMarketingAppearanceMutation.mutate({ layout })
    }

    const deleteMutation = useMutation({
        mutationFn: (layout: ApplicationLayout) => deleteApplicationLayout(String(applicationId), layout.id, layout.version),
        onError: (error) => notifyLayoutMutationError(error, 'layouts.deleteError', 'Failed to delete layout.'),
        onSuccess: invalidateLayouts
    })

    const requestDeleteLayout = async (layout: ApplicationLayout) => {
        if (deleteMutation.isPending) return
        const confirmed = await confirm({
            title: t('layouts.deleteTitle', 'Delete layout?'),
            description: t(
                'layouts.deleteDescription',
                'This removes the layout and its widget placements. Content records and entity data will not be deleted.'
            ),
            confirmButtonName: tc('actions.delete', 'Delete'),
            cancelButtonName: tc('actions.cancel', 'Cancel')
        })
        if (!confirmed) return
        try {
            await deleteMutation.mutateAsync(layout)
        } catch {
            // The mutation reports a localized error and leaves the list available for retry.
        }
    }

    const copyMutation = useMutation({
        mutationFn: (layout: ApplicationLayout) => copyApplicationLayout(String(applicationId), layout.id, layout.version),
        onError: (error) => notifyLayoutMutationError(error, 'layouts.copyError', 'Failed to copy layout.'),
        onSuccess: invalidateLayouts
    })

    const toggleWidgetMutation = useMutation({
        mutationFn: ({ widget, isActive }: { widget: ApplicationLayoutWidget; isActive: boolean }) => {
            const currentLayout = detailQuery.data?.item
            if (
                !currentLayout ||
                !canOverrideActive(currentLayout, widget, getWidgetPlacementOverridePolicy(widget), widgetObjectQuery.data)
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_SOURCE_OWNED')
            }
            return toggleApplicationLayoutWidget(String(applicationId), String(layoutId), widget.id, {
                isActive,
                expectedVersion: widget.version
            })
        },
        onError: (error) => notifyWidgetMutationError(error, 'layouts.widgetToggleError', 'Failed to change widget visibility.'),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const addWidgetMutation = useMutation({
        mutationFn: ({
            zone,
            widgetKey,
            config
        }: {
            zone: ApplicationLayoutWidgetMutation['zone']
            widgetKey: ApplicationLayoutWidgetMutation['widgetKey']
            config?: Record<string, unknown>
        }) => {
            const currentLayout = detailQuery.data?.item
            const definition = getLayoutWidgetDefinition(widgetKey, config)
            if (
                !currentLayout ||
                !definition?.supportedTemplates.includes(currentLayout.templateKey) ||
                !canAddApplicationLayoutWidget(definition, currentLayout.sourceKind)
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_ADD_NOT_ALLOWED')
            }
            const expectedVersion = detailQuery.data?.item.version
            if (typeof expectedVersion !== 'number') throw new Error('APPLICATION_LAYOUT_VERSION_UNAVAILABLE')
            return upsertApplicationLayoutWidget(String(applicationId), String(layoutId), {
                zone,
                widgetKey,
                config: config ?? {},
                expectedVersion
            })
        },
        onError: (error) => notifyWidgetMutationError(error, 'layouts.widgetAddError', 'Failed to add widget.'),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const duplicateWidgetMutation = useMutation({
        mutationFn: (widget: ApplicationLayoutWidget) => {
            const currentLayout = detailQuery.data?.item
            const definition = getLayoutWidgetDefinition(widget.widgetKey, widget.config)
            if (
                !currentLayout ||
                hasSourceOwnedPlacement(currentLayout, widget, widgetObjectQuery.data) ||
                definition?.authoring?.application?.canDuplicate === false
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_DUPLICATE_NOT_ALLOWED')
            }
            const expectedVersion = currentLayout.version
            if (typeof expectedVersion !== 'number') throw new Error('APPLICATION_LAYOUT_VERSION_UNAVAILABLE')
            const config = widget.config
            return upsertApplicationLayoutWidget(String(applicationId), String(layoutId), {
                zone: widget.zone,
                widgetKey: widget.widgetKey,
                config,
                expectedVersion
            })
        },
        onError: (error) => notifyWidgetMutationError(error, 'layouts.widgetDuplicateError', 'Failed to duplicate widget.'),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const moveWidgetMutation = useMutation({
        mutationFn: ({
            widget,
            targetZone,
            targetIndex,
            targetPlacement
        }: {
            widget: ApplicationLayoutWidget
            targetZone: ApplicationLayoutWidget['zone']
            targetIndex: number
            targetPlacement?: LayoutLogicalPlacement
        }) => {
            const currentLayout = detailQuery.data?.item
            if (
                !currentLayout ||
                !canOverrideRootOrder(currentLayout, widget, targetZone, getWidgetPlacementOverridePolicy(widget), widgetObjectQuery.data)
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_MOVE_NOT_ALLOWED')
            }
            return moveApplicationLayoutWidget(String(applicationId), String(layoutId), {
                widgetId: widget.id,
                targetZone,
                targetIndex,
                targetPlacement,
                expectedVersion: widget.version
            })
        },
        onError: (error) => notifyWidgetMutationError(error, 'layouts.widgetMoveError', 'Failed to move widget.'),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const deleteWidgetMutation = useMutation({
        mutationFn: (widget: ApplicationLayoutWidget) => {
            const currentLayout = detailQuery.data?.item
            if (!currentLayout || hasSourceOwnedPlacement(currentLayout, widget, widgetObjectQuery.data)) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_DELETE_NOT_ALLOWED')
            }
            return deleteApplicationLayoutWidget(String(applicationId), String(layoutId), widget.id, widget.version)
        },
        onError: (error) => notifyWidgetMutationError(error, 'layouts.widgetDeleteError', 'Failed to remove widget.'),
        onSuccess: async () => {
            await invalidateLayouts()
        }
    })

    const updateWidgetConfigMutation = useMutation({
        mutationFn: ({ widget, config }: { widget: ApplicationLayoutWidget; config: Record<string, unknown> }) => {
            const currentLayout = detailQuery.data?.item
            if (
                !currentLayout ||
                Object.prototype.hasOwnProperty.call(config, 'instanceKey') ||
                !canUpdateSourcePresentation(currentLayout, widget, config, widgetObjectQuery.data)
            ) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_CONFIG_NOT_ALLOWED')
            }
            return updateApplicationLayoutWidgetConfig(String(applicationId), String(layoutId), widget.id, {
                config,
                expectedVersion: widget.version
            })
        },
        onMutate: async ({ widget, config }) => {
            await queryClient.cancelQueries({ queryKey: layoutDetailQueryKey })
            const previousDetail = queryClient.getQueryData<ApplicationLayoutDetailResponse>(layoutDetailQueryKey)

            if (previousDetail) {
                queryClient.setQueryData<ApplicationLayoutDetailResponse>(layoutDetailQueryKey, {
                    ...previousDetail,
                    widgets: previousDetail.widgets.map((item) => (item.id === widget.id ? { ...item, config } : item))
                })
            }

            return { previousDetail }
        },
        onError: (error, _variables, context) => {
            if (context?.previousDetail) {
                queryClient.setQueryData(layoutDetailQueryKey, context.previousDetail)
            }
            const apiError = extractAxiosError(error)
            const message =
                apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
                    ? t(
                          'settings.matrix.singleSystemStructuresExist',
                          'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.'
                      )
                    : apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
                    ? t(
                          'settings.matrix.singleSystemMetadataMissing',
                          'Single-system mode cannot be enabled because the Structure metadata is incomplete.'
                      )
                    : t('layouts.interpretationNetworkEditor.saveError', 'Failed to save widget settings')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async () => {
            setInterpretationNetworkEditingWidget(null)
            setInterpretationNetworkInitialSettings(null)
            setInterpretationNetworkDraft(null)
            setInterpretationNetworkDraftHasChanges(false)
            await invalidateLayouts()
        }
    })

    const resetWidgetConfigMutation = useMutation({
        mutationFn: (widget: ApplicationLayoutWidget) => {
            const currentLayout = detailQuery.data?.item
            const isLocalMatrixReset =
                currentLayout != null &&
                widget.widgetKey === 'interpretationNetworkWorkspace' &&
                !hasSourceOwnedPlacement(currentLayout, widget, widgetObjectQuery.data) &&
                widget.sourceConfig != null &&
                widget.isCustomized === true
            if (!currentLayout || (!canResetSourcePresentation(currentLayout, widget, widgetObjectQuery.data) && !isLocalMatrixReset)) {
                throw new Error('APPLICATION_LAYOUT_WIDGET_RESET_NOT_ALLOWED')
            }
            return resetApplicationLayoutWidgetConfigsBatch(String(applicationId), {
                updates: [
                    {
                        layoutId: String(layoutId),
                        widgetId: widget.id,
                        expectedVersion: widget.version
                    }
                ]
            })
        },
        onError: (error, widget) => {
            const apiError = extractAxiosError(error)
            const currentLayout = detailQuery.data?.item
            if (currentLayout && canResetSourcePresentation(currentLayout, widget, widgetObjectQuery.data)) {
                const isConflict =
                    apiError.code === 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT' ||
                    apiError.message === 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'
                enqueueSnackbar(
                    isConflict
                        ? t(
                              'layouts.widgetResetToSourceConflict',
                              'This widget changed in another session. Reload the layout and try again.'
                          )
                        : t('layouts.widgetResetToSourceError', 'Failed to reset widget settings to the source.'),
                    { variant: 'error' }
                )
                return
            }
            const isLocalMatrixReset =
                currentLayout != null &&
                widget.widgetKey === 'interpretationNetworkWorkspace' &&
                !hasSourceOwnedPlacement(currentLayout, widget, widgetObjectQuery.data)
            if (!isLocalMatrixReset) {
                notifyWidgetMutationError(error, 'layouts.widgetResetToSourceError', 'Failed to reset widget settings to the source.')
                return
            }
            const message =
                apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_NON_SYSTEM_STRUCTURES_EXIST'
                    ? t(
                          'settings.matrix.singleSystemStructuresExist',
                          'Single-system mode cannot be enabled while ordinary Structures exist. Delete them first.'
                      )
                    : apiError.code === 'APPLICATION_INTERPRETATION_NETWORK_METADATA_MISSING'
                    ? t(
                          'settings.matrix.singleSystemMetadataMissing',
                          'Single-system mode cannot be enabled because the Structure metadata is incomplete.'
                      )
                    : apiError.message === 'APPLICATION_LAYOUT_WIDGET_BATCH_CONFLICT'
                    ? t(
                          'settings.matrix.resetConflict',
                          'Matrix settings changed while you were editing. Reload the current values and try again.'
                      )
                    : t('settings.matrix.resetError', 'Failed to restore metahub settings')
            enqueueSnackbar(message, { variant: 'error' })
        },
        onSuccess: async (_widgets, widget) => {
            const currentLayout = detailQuery.data?.item
            if (currentLayout && canResetSourcePresentation(currentLayout, widget, widgetObjectQuery.data)) {
                enqueueSnackbar(t('layouts.widgetResetToSourceSuccess', 'Widget settings were reset to the source.'), {
                    variant: 'success'
                })
            } else {
                setInterpretationNetworkEditingWidget(null)
                setInterpretationNetworkInitialSettings(null)
                setInterpretationNetworkDraft(null)
                setInterpretationNetworkDraftHasChanges(false)
                enqueueSnackbar(t('settings.matrix.resetSuccess', 'Metahub settings restored'), { variant: 'success' })
            }
            await invalidateLayouts()
        }
    })

    const layouts = useMemo(() => layoutsQuery.data?.items ?? [], [layoutsQuery.data?.items])
    const [applicationTemplateKey, setApplicationTemplateKey] = useState<ApplicationTemplateKey>('dashboard')
    useEffect(() => {
        const globalLayout =
            layouts.find((layout) => layout.scopeEntityId == null && layout.isDefault) ??
            layouts.find((layout) => layout.scopeEntityId == null)
        if (globalLayout) {
            setApplicationTemplateKey((current) => (current === globalLayout.templateKey ? current : globalLayout.templateKey))
        }
    }, [layouts])
    const isLoading =
        scopesQuery.isLoading || layoutsQuery.isLoading || (Boolean(layoutId) && (detailQuery.isLoading || widgetObjectQuery.isLoading))
    const isSchemaNotReady =
        (scopesQuery.error as { response?: { data?: { error?: string } } } | null)?.response?.data?.error === 'APPLICATION_SCHEMA_NOT_READY'

    const filteredLayouts = useMemo(() => {
        const normalizedSearch = searchValue.trim().toLowerCase()
        return layouts.filter((layout) => {
            if (templateFilter !== 'all' && layout.templateKey !== templateFilter) return false
            const title = resolveLocalizedText(layout.name, i18n.language, t('layouts.unnamed', 'Untitled layout')).toLowerCase()
            const description = resolveLocalizedText(layout.description ?? {}, i18n.language, '').toLowerCase()
            const scopeName = (scopesById.get(layout.scopeId ?? 'global')?.name ?? t('layouts.globalScope', 'Global')).toLowerCase()
            const templateName = t(
                layout.templateKey === 'marketing-page' ? 'layouts.templates.marketingPage' : 'layouts.templates.dashboard',
                layout.templateKey === 'marketing-page' ? 'Marketing page' : 'Dashboard'
            ).toLowerCase()
            return (
                !normalizedSearch ||
                title.includes(normalizedSearch) ||
                description.includes(normalizedSearch) ||
                scopeName.includes(normalizedSearch) ||
                templateName.includes(normalizedSearch)
            )
        })
    }, [i18n.language, layouts, scopesById, searchValue, t, templateFilter])

    const formatScopeKind = (scopeKind: string | null | undefined) => {
        const normalizedKind = scopeKind?.trim().toLowerCase()
        if (normalizedKind === 'page') return t('layouts.scopeKinds.page', 'Page')
        if (normalizedKind === 'object') return t('layouts.scopeKinds.object', 'Object')
        return t('layouts.scopeKinds.entity', 'Entity')
    }

    const formatLayoutTarget = (layout: ApplicationLayout) => {
        const scope = scopesById.get(layout.scopeId ?? 'global')
        if (layout.scopeKind === 'global' || layout.scopeEntityId === null || scope?.scopeKind === 'global') {
            return t('layouts.scopeKinds.global', 'Global')
        }
        const targetName = scope?.name?.trim() || t('layouts.unnamedTarget', 'Selected entity')
        return `${formatScopeKind(scope?.scopeEntityKind ?? scope?.kind ?? layout.scopeEntityKind)}: ${targetName}`
    }

    const formatTemplate = (templateKey: ApplicationTemplateKey) =>
        t(
            templateKey === 'marketing-page' ? 'layouts.templates.marketingPage' : 'layouts.templates.dashboard',
            templateKey === 'marketing-page' ? 'Marketing page' : 'Dashboard'
        )

    const formatComposition = (layout: ApplicationLayout) => {
        if (layout.scopeKind === 'global' || layout.scopeEntityId === null) return t('layouts.composition.global', 'Global default')
        return layout.compositionMode === 'overlay'
            ? t('layouts.composition.inherited', 'Scoped overlay')
            : t('layouts.composition.independent', 'Independent layout')
    }

    const openCreateDialog = () => {
        setName('')
        setScopeId('global')
        setCreateTemplateKey(applicationTemplateKey)
        setCreateOpen(true)
    }

    const handleCreate = () => {
        const selectedScope = scopesById.get(scopeId)
        const normalizedName = name.trim()
        if (!normalizedName || (scopeId !== 'global' && !selectedScope?.scopeEntityId)) return
        createMutation.mutate({
            templateKey: createTemplateKey,
            name: {
                en: normalizedName,
                ru: normalizedName
            },
            scopeEntityId: selectedScope?.scopeEntityId ?? null,
            isActive: true,
            isDefault: false,
            sortOrder: layouts.length + 1,
            config: {}
        })
    }

    const openLayoutEditor = (layout: ApplicationLayout) => {
        setEditingLayout(layout)
        setLayoutNameEn(resolveLocalizedText(layout.name, 'en', ''))
        setLayoutNameRu(resolveLocalizedText(layout.name, 'ru', ''))
        setLayoutDescriptionEn(resolveLocalizedText(layout.description ?? {}, 'en', ''))
        setLayoutDescriptionRu(resolveLocalizedText(layout.description ?? {}, 'ru', ''))
    }

    const handleLayoutSave = async () => {
        if (!editingLayout) return
        const normalizedNameEn = layoutNameEn.trim()
        const normalizedNameRu = layoutNameRu.trim()
        if (!normalizedNameEn && !normalizedNameRu) return
        try {
            await updateMutation.mutateAsync({
                layout: editingLayout,
                data: {
                    name: {
                        en: normalizedNameEn || normalizedNameRu,
                        ru: normalizedNameRu || normalizedNameEn
                    },
                    description:
                        layoutDescriptionEn.trim() || layoutDescriptionRu.trim()
                            ? {
                                  en: layoutDescriptionEn.trim() || layoutDescriptionRu.trim(),
                                  ru: layoutDescriptionRu.trim() || layoutDescriptionEn.trim()
                              }
                            : null
                }
            })
            setEditingLayout(null)
        } catch {
            // The mutation reports a localized error and keeps the edit dialog open.
        }
    }

    const openMenu = (event: React.MouseEvent<HTMLElement>, layout: ApplicationLayout) => {
        event.stopPropagation()
        setMenuState({ anchorEl: event.currentTarget, layout })
    }

    const closeMenu = () => setMenuState({ anchorEl: null, layout: null })

    return {
        applicationId,
        layoutId,
        t,
        i18n,
        tc,
        navigate,
        canManageLayouts,
        view,
        setView,
        scopeFilter,
        setScopeFilter,
        setSearchValue,
        menuState,
        createOpen,
        setCreateOpen,
        name,
        setName,
        scopeId,
        setScopeId,
        createTemplateKey,
        setCreateTemplateKey,
        templateFilter,
        setTemplateFilter,
        editingLayout,
        setEditingLayout,
        layoutNameEn,
        setLayoutNameEn,
        layoutNameRu,
        setLayoutNameRu,
        layoutDescriptionEn,
        setLayoutDescriptionEn,
        layoutDescriptionRu,
        setLayoutDescriptionRu,
        interpretationNetworkEditingWidget,
        setInterpretationNetworkEditingWidget,
        interpretationNetworkInitialSettings,
        setInterpretationNetworkInitialSettings,
        interpretationNetworkDraft,
        setInterpretationNetworkDraft,
        interpretationNetworkDraftHasChanges,
        setInterpretationNetworkDraftHasChanges,
        workspaceSwitcherEditingWidget,
        setWorkspaceSwitcherEditingWidget,
        widgetPresentationEditor,
        setWidgetPresentationEditor,
        zoneSettingsOpen,
        setZoneSettingsOpen,
        zoneSettingsError,
        setZoneSettingsError,
        widgetMutationError,
        layoutScopeKey,
        scopesQuery,
        layoutsQuery,
        detailQuery,
        widgetObjectQuery,
        getWidgetPlacementOverridePolicy,
        createMutation,
        updateMutation,
        resetMarketingAppearanceMutation,
        updateZoneSettingMutation,
        resetZoneSettingMutation,
        requestMarketingAppearanceReset,
        requestDeleteLayout,
        copyMutation,
        toggleWidgetMutation,
        addWidgetMutation,
        duplicateWidgetMutation,
        moveWidgetMutation,
        deleteWidgetMutation,
        updateWidgetConfigMutation,
        resetWidgetConfigMutation,
        applicationTemplateKey,
        isLoading,
        isSchemaNotReady,
        filteredLayouts,
        formatScopeKind,
        formatLayoutTarget,
        formatTemplate,
        formatComposition,
        openCreateDialog,
        handleCreate,
        openLayoutEditor,
        handleLayoutSave,
        openMenu,
        closeMenu
    }
}
