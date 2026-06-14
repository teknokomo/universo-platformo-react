import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Alert,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntityFormDialog, LocalizedInlineField } from '@universo-react/template-mui'
import {
    isClientModuleMethodTarget,
    isEnabledCapabilityConfig,
    isServerModuleMethodTarget,
    playcanvasCanvasWidgetConfigSchema,
    type MetahubModuleRecord,
    type VersionedLocalizedContent
} from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'
import type { z } from 'zod'

import { listEntityInstances } from '../../entities/api/entityInstances'
import { listEntityTypes } from '../../entities/api/entityTypes'
import { modulesApi } from '../../modules/api/modulesApi'
import { fetchAllPaginatedItems, metahubsQueryKeys } from '../../shared'
import { getVLCString } from '../../../types'
import { packagesApi, playcanvasProjectsApi } from '../../packages/api'
import LayoutWidgetSharedBehaviorFields from './LayoutWidgetSharedBehaviorFields'
import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'

type PlayCanvasCanvasWidgetConfig = z.infer<typeof playcanvasCanvasWidgetConfigSchema>

type ModuleOption = {
    codename: string
    label: string
    description: string | null
}

type SectionOption = {
    id: string
    codename: string
    label: string
    kindKey: string
    sortOrder: number
}

export interface PlayCanvasCanvasWidgetEditorDialogProps {
    open: boolean
    metahubId: string
    config?: Record<string, unknown> | null
    layoutId?: string | null
    widgetId?: string | null
    showSharedBehavior?: boolean
    showScopeVisibility?: boolean
    onSave: (config: PlayCanvasCanvasWidgetConfig) => void
    onCancel: () => void
}

const normalizeConfig = (config: unknown): PlayCanvasCanvasWidgetConfig => {
    const parsed = playcanvasCanvasWidgetConfigSchema.safeParse(config ?? {})
    if (parsed.success) {
        return {
            ...parsed.data,
            title: parsed.data.title ?? createLocalizedContent('en', 'Universo MMOOMM'),
            minHeight: parsed.data.minHeight ?? 560,
            heightMode: parsed.data.heightMode ?? 'fitViewport'
        }
    }
    return {
        title: createLocalizedContent('en', 'Universo MMOOMM'),
        minHeight: 560,
        heightMode: 'fitViewport'
    }
}

const toManifestSelectValue = (projectId?: string | null, sceneId?: string | null, checksum?: string | null): string =>
    projectId && checksum ? `${projectId}:${sceneId ?? ''}:${checksum}` : ''

const getPreferredLocalizedText = (value: unknown, uiLocale: string): string => {
    if (typeof value === 'string') return value.trim()
    if (!value || typeof value !== 'object') return ''

    const localizedValue = value as VersionedLocalizedContent<string>
    return (
        getVLCString(localizedValue, uiLocale) ||
        getVLCString(localizedValue, localizedValue._primary ?? 'en') ||
        getVLCString(localizedValue, 'en') ||
        ''
    )
}

const createModuleOptions = (
    modules: MetahubModuleRecord[],
    uiLocale: string,
    acceptsTarget: (target: MetahubModuleRecord['manifest']['methods'][number]['target']) => boolean,
    emptyFallback: string
): ModuleOption[] => {
    const seenCodenames = new Set<string>()

    return modules
        .filter((module) => module.isActive && module.manifest.methods.some((method) => acceptsTarget(method.target)))
        .map((module, index) => {
            const codename = getPreferredLocalizedText(module.codename, uiLocale)
            const name = getPreferredLocalizedText(module.presentation?.name, uiLocale)
            const description = getPreferredLocalizedText(module.presentation?.description, uiLocale) || null

            return {
                codename,
                label: name || `${emptyFallback} ${index + 1}`,
                description
            }
        })
        .filter((module) => {
            if (!module.codename || seenCodenames.has(module.codename)) {
                return false
            }
            seenCodenames.add(module.codename)
            return true
        })
        .sort((left, right) => left.label.localeCompare(right.label))
}

const isLayoutSectionEntityType = (entityType: { capabilities: { layoutConfig?: unknown } }): boolean =>
    isEnabledCapabilityConfig(entityType.capabilities.layoutConfig)

const readManifestMetadataText = (metadata: Record<string, unknown> | undefined, key: string): string => {
    const value = metadata?.[key]
    return typeof value === 'string' ? value.trim() : ''
}

export default function PlayCanvasCanvasWidgetEditorDialog({
    open,
    metahubId,
    config,
    layoutId,
    widgetId,
    showSharedBehavior = false,
    showScopeVisibility = false,
    onSave,
    onCancel
}: PlayCanvasCanvasWidgetEditorDialogProps) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const uiLocale = i18n.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
    const runtimeManifestLabelId = useId()
    const clientModuleLabelId = useId()
    const serverModuleLabelId = useId()
    const sectionsLabelId = useId()
    const [draft, setDraft] = useState<PlayCanvasCanvasWidgetConfig>(() => normalizeConfig(config))
    const [submitError, setSubmitError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setDraft(normalizeConfig(config))
        setSubmitError(null)
    }, [config, open])

    const manifestsQuery = useQuery({
        queryKey: metahubsQueryKeys.playcanvasPublishedRuntimeManifests(metahubId),
        queryFn: () => playcanvasProjectsApi.listPublishedRuntimeManifests(metahubId),
        enabled: Boolean(open && metahubId)
    })

    const packagesQuery = useQuery({
        queryKey: [...metahubsQueryKeys.detail(metahubId), 'playcanvasCanvasWidget', 'packages'],
        queryFn: () => packagesApi.listAttached(metahubId),
        enabled: Boolean(open && metahubId)
    })

    const modulesQuery = useQuery({
        queryKey: [...metahubsQueryKeys.detail(metahubId), 'playcanvasCanvasWidget', 'modules'],
        queryFn: () => modulesApi.list(metahubId),
        enabled: Boolean(open && metahubId)
    })

    const sectionTargetsQuery = useQuery({
        queryKey: [...metahubsQueryKeys.detail(metahubId), 'playcanvasCanvasWidget', 'sectionTargets', uiLocale],
        enabled: Boolean(open && metahubId),
        queryFn: async (): Promise<SectionOption[]> => {
            const entityTypesPage = await fetchAllPaginatedItems((params) => listEntityTypes(metahubId, params), {
                limit: 1000,
                sortOrder: 'asc'
            })
            const layoutCapableTypes = entityTypesPage.items.filter(isLayoutSectionEntityType)
            const groups = await Promise.all(
                layoutCapableTypes.map(async (entityType) => {
                    const instancesPage = await fetchAllPaginatedItems(
                        (params) => listEntityInstances(metahubId, { ...params, kind: entityType.kindKey }),
                        { limit: 1000, sortOrder: 'asc' }
                    )
                    const typeLabel =
                        getPreferredLocalizedText(entityType.codename, uiLocale) ||
                        entityType.ui?.nameKey ||
                        t('layouts.playcanvasCanvasEditor.sectionTypeFallback', 'Section')

                    return instancesPage.items.map((entity, index) => {
                        const name = getPreferredLocalizedText(entity.name, uiLocale)
                        const codename = getPreferredLocalizedText(entity.codename, uiLocale)
                        return {
                            id: entity.id,
                            codename,
                            label: `${name || t('layouts.playcanvasCanvasEditor.unnamedSection', 'Unnamed section')} · ${typeLabel}`,
                            kindKey: entityType.kindKey,
                            sortOrder: typeof entity.sortOrder === 'number' ? entity.sortOrder : index
                        }
                    })
                })
            )

            return groups
                .flat()
                .sort(
                    (left, right) =>
                        left.kindKey.localeCompare(right.kindKey) ||
                        left.sortOrder - right.sortOrder ||
                        left.label.localeCompare(right.label)
                )
        }
    })

    const runtimeProjectIds = useMemo(
        () =>
            new Set(
                (packagesQuery.data ?? [])
                    .filter((item) => item.isActive && item.config.kind === 'display')
                    .map((item) => (item.config.kind === 'display' ? item.config.playcanvasProject?.defaultProjectId : null))
                    .filter((projectId): projectId is string => typeof projectId === 'string' && projectId.length > 0)
            ),
        [packagesQuery.data]
    )
    const manifests = useMemo(
        () => (manifestsQuery.data ?? []).filter((item) => runtimeProjectIds.has(item.projectId)),
        [manifestsQuery.data, runtimeProjectIds]
    )
    const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
    const sectionTargets = sectionTargetsQuery.data ?? []
    const selectedManifestValue = toManifestSelectValue(
        draft.runtimeManifest?.projectId,
        draft.runtimeManifest?.sceneId,
        draft.runtimeManifest?.checksum
    )
    const selectedManifestExists = manifests.some(
        (item) => toManifestSelectValue(item.projectId, item.sceneId, item.checksum) === selectedManifestValue
    )

    const manifestOptions = useMemo(
        () =>
            manifests.map((item, index) => {
                const metadata = item.runtimeManifest.metadata
                const sceneLabel =
                    readManifestMetadataText(metadata, 'sceneName') ||
                    readManifestMetadataText(metadata, 'displayName') ||
                    t('layouts.playcanvasCanvasEditor.publishedSceneFallback', 'Published scene {{number}}', { number: index + 1 })
                const projectLabel = readManifestMetadataText(metadata, 'projectName')
                const publishedAt = item.publishedAt ? new Date(item.publishedAt) : null
                const dateLabel =
                    publishedAt && Number.isFinite(publishedAt.getTime())
                        ? new Intl.DateTimeFormat(uiLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(publishedAt)
                        : ''

                return {
                    value: toManifestSelectValue(item.projectId, item.sceneId, item.checksum),
                    label: projectLabel
                        ? t('layouts.playcanvasCanvasEditor.manifestOptionWithProject', '{{scene}} · {{project}}{{date}}', {
                              scene: sceneLabel,
                              project: projectLabel,
                              date: dateLabel ? ` · ${dateLabel}` : ''
                          })
                        : t('layouts.playcanvasCanvasEditor.manifestOption', '{{scene}}{{date}}', {
                              scene: sceneLabel,
                              date: dateLabel ? ` · ${dateLabel}` : ''
                          }),
                    item
                }
            }),
        [manifests, t, uiLocale]
    )

    const clientModuleOptions = useMemo(
        () =>
            createModuleOptions(
                modules,
                uiLocale,
                isClientModuleMethodTarget,
                t('layouts.playcanvasCanvasEditor.moduleFallback.client', 'Client module')
            ),
        [modules, t, uiLocale]
    )
    const serverModuleOptions = useMemo(
        () =>
            createModuleOptions(
                modules,
                uiLocale,
                isServerModuleMethodTarget,
                t('layouts.playcanvasCanvasEditor.moduleFallback.server', 'Server module')
            ),
        [modules, t, uiLocale]
    )
    const selectedClientModule = clientModuleOptions.find((module) => module.codename === draft.moduleCodename) ?? null
    const selectedServerModule = serverModuleOptions.find((module) => module.codename === draft.serverModuleCodename) ?? null
    const selectedSectionIds =
        draft.visibleFor?.sectionIds ??
        sectionTargets
            .filter((section) => (draft.visibleFor?.sectionCodenames ?? []).includes(section.codename))
            .map((section) => section.id)

    const updateDraft = (patch: Partial<PlayCanvasCanvasWidgetConfig>) => {
        setSubmitError(null)
        setDraft((current) => ({ ...current, ...patch }))
    }

    const handleManifestChange = (value: string) => {
        const selected = manifestOptions.find((option) => option.value === value)?.item
        updateDraft({
            runtimeManifest: selected
                ? {
                      source: 'publishedManifest',
                      projectId: selected.projectId,
                      sceneId: selected.sceneId ?? null,
                      checksum: selected.checksum,
                      failClosed: true
                  }
                : undefined
        })
    }

    const handleSectionChange = (sectionIds: string[]) => {
        const selectedSections = sectionIds
            .map((sectionId) => sectionTargets.find((section) => section.id === sectionId))
            .filter((section): section is SectionOption => Boolean(section))

        updateDraft({
            visibleFor:
                selectedSections.length > 0
                    ? {
                          sectionIds: selectedSections.map((section) => section.id),
                          sectionCodenames: selectedSections.map((section) => section.codename)
                      }
                    : undefined
        })
    }

    const handleSave = () => {
        if (draft.runtimeManifest && !selectedManifestExists) {
            setSubmitError(
                t(
                    'layouts.playcanvasCanvasEditor.validation.invalidRuntimeManifest',
                    'Choose a published scene from an active display package or clear the selection.'
                )
            )
            return
        }
        const parsed = playcanvasCanvasWidgetConfigSchema.safeParse(draft)
        if (!parsed.success) {
            setSubmitError(
                t('layouts.playcanvasCanvasEditor.validation.invalidConfig', 'Check the PlayCanvas canvas widget settings and try again.')
            )
            return
        }
        setSubmitError(null)
        onSave(parsed.data)
    }

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.playcanvasCanvasEditor.title', 'PlayCanvas canvas widget')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={handleSave}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            error={submitError ?? undefined}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'layouts.playcanvasCanvasEditor.description',
                            'Bind the runtime canvas to a published PlayCanvas scene and MMOOMM runtime modules.'
                        )}
                    </Typography>
                    <LocalizedInlineField
                        mode='localized'
                        label={t('layouts.playcanvasCanvasEditor.fields.title', 'Widget title')}
                        value={(draft.title as VersionedLocalizedContent<string> | null | undefined) ?? null}
                        onChange={(value) => updateDraft({ title: value ?? undefined })}
                        uiLocale={uiLocale}
                    />
                    {modulesQuery.isError ? (
                        <Alert severity='error'>
                            {t('layouts.playcanvasCanvasEditor.modulesLoadError', 'Failed to load available runtime modules.')}
                        </Alert>
                    ) : null}
                    <FormControl fullWidth size='small'>
                        <InputLabel id={clientModuleLabelId}>
                            {t('layouts.playcanvasCanvasEditor.fields.clientModule', 'Client module')}
                        </InputLabel>
                        <Select
                            labelId={clientModuleLabelId}
                            label={t('layouts.playcanvasCanvasEditor.fields.clientModule', 'Client module')}
                            value={selectedClientModule ? draft.moduleCodename ?? '' : ''}
                            disabled={modulesQuery.isLoading}
                            onChange={(event) => updateDraft({ moduleCodename: String(event.target.value) || null })}
                        >
                            <MenuItem value=''>
                                {t('layouts.playcanvasCanvasEditor.fields.useFirstClientModule', 'Use the first available client module')}
                            </MenuItem>
                            {clientModuleOptions.map((module) => (
                                <MenuItem key={module.codename} value={module.codename}>
                                    {module.label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {selectedClientModule?.description ||
                                t('layouts.playcanvasCanvasEditor.fields.clientModuleHelp', 'Choose the browser-side canvas behavior.')}
                        </FormHelperText>
                    </FormControl>
                    <FormControl fullWidth size='small'>
                        <InputLabel id={serverModuleLabelId}>
                            {t('layouts.playcanvasCanvasEditor.fields.serverModule', 'Realtime server module')}
                        </InputLabel>
                        <Select
                            labelId={serverModuleLabelId}
                            label={t('layouts.playcanvasCanvasEditor.fields.serverModule', 'Realtime server module')}
                            value={selectedServerModule ? draft.serverModuleCodename ?? '' : ''}
                            disabled={modulesQuery.isLoading}
                            onChange={(event) => updateDraft({ serverModuleCodename: String(event.target.value) || null })}
                        >
                            <MenuItem value=''>
                                {t('layouts.playcanvasCanvasEditor.fields.noServerModule', 'No realtime server module')}
                            </MenuItem>
                            {serverModuleOptions.map((module) => (
                                <MenuItem key={module.codename} value={module.codename}>
                                    {module.label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {selectedServerModule?.description ||
                                t(
                                    'layouts.playcanvasCanvasEditor.fields.serverModuleHelp',
                                    'Optional server-authoritative behavior for the scene.'
                                )}
                        </FormHelperText>
                    </FormControl>
                    <FormControl fullWidth size='small'>
                        <InputLabel id={runtimeManifestLabelId}>
                            {t('layouts.playcanvasCanvasEditor.fields.runtimeManifest', 'Published scene')}
                        </InputLabel>
                        <Select
                            labelId={runtimeManifestLabelId}
                            label={t('layouts.playcanvasCanvasEditor.fields.runtimeManifest', 'Published scene')}
                            value={selectedManifestExists ? selectedManifestValue : ''}
                            disabled={manifestsQuery.isLoading || packagesQuery.isLoading}
                            onChange={(event) => handleManifestChange(event.target.value)}
                        >
                            <MenuItem value=''>
                                {t('layouts.playcanvasCanvasEditor.fields.noRuntimeManifest', 'No published scene')}
                            </MenuItem>
                            {manifestOptions.map((option) => (
                                <MenuItem key={option.value} value={option.value}>
                                    {option.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {manifestsQuery.isError || packagesQuery.isError ? (
                        <Alert severity='error'>
                            {t('layouts.playcanvasCanvasEditor.manifestLoadError', 'Failed to load published PlayCanvas scenes.')}
                        </Alert>
                    ) : null}
                    <TextField
                        label={t('layouts.playcanvasCanvasEditor.fields.minHeight', 'Minimum height')}
                        value={draft.minHeight ?? 560}
                        onChange={(event) => {
                            const parsed = Number(event.target.value)
                            updateDraft({ minHeight: Number.isFinite(parsed) ? Math.trunc(parsed) : 560 })
                        }}
                        type='number'
                        inputProps={{ min: 320, max: 1200, step: 20 }}
                        fullWidth
                        size='small'
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.heightMode === 'fitViewport'}
                                onChange={(_, checked) => updateDraft({ heightMode: checked ? 'fitViewport' : 'fixed' })}
                            />
                        }
                        label={t('layouts.playcanvasCanvasEditor.fields.fitViewport', 'Fit available viewport height')}
                    />
                    <FormControl fullWidth size='small'>
                        <InputLabel id={sectionsLabelId}>
                            {t('layouts.playcanvasCanvasEditor.fields.sections', 'Visible in sections')}
                        </InputLabel>
                        <Select
                            multiple
                            labelId={sectionsLabelId}
                            label={t('layouts.playcanvasCanvasEditor.fields.sections', 'Visible in sections')}
                            value={selectedSectionIds}
                            disabled={sectionTargetsQuery.isLoading}
                            onChange={(event) => {
                                const value = event.target.value
                                handleSectionChange(typeof value === 'string' ? value.split(',') : value)
                            }}
                            renderValue={(selected) =>
                                selected
                                    .map((sectionId) => sectionTargets.find((section) => section.id === sectionId)?.label)
                                    .filter(Boolean)
                                    .join(', ')
                            }
                        >
                            {sectionTargets.map((section) => (
                                <MenuItem key={section.id} value={section.id}>
                                    {section.label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {t(
                                'layouts.playcanvasCanvasEditor.fields.sectionsHelp',
                                'Leave empty to show the canvas in every section where this layout is active.'
                            )}
                        </FormHelperText>
                    </FormControl>
                    {sectionTargetsQuery.isError ? (
                        <Alert severity='error'>
                            {t('layouts.playcanvasCanvasEditor.sectionsLoadError', 'Failed to load available sections.')}
                        </Alert>
                    ) : null}
                    {showSharedBehavior ? <LayoutWidgetSharedBehaviorFields value={draft} onChange={(value) => setDraft(value)} /> : null}
                    {showScopeVisibility && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
