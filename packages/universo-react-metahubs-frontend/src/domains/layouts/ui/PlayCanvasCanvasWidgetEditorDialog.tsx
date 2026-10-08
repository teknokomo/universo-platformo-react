import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Alert,
    FormControl,
    FormControlLabel,
    FormHelperText,
    InputLabel,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import { useTranslation } from 'react-i18next'
import { EntityFormDialog, LocalizedInlineField } from '@universo-react/template-mui'
import {
    isClientModuleMethodTarget,
    isServerModuleMethodTarget,
    playcanvasCanvasWidgetConfigSchema,
    type MetahubModuleRecord,
    type VersionedLocalizedContent
} from '@universo-react/types'
import { createLocalizedContent, toLocalizedStringMap, updateLocalizedContentLocale } from '@universo-react/utils'
import type { z } from 'zod'

import { modulesApi } from '../../modules/api/modulesApi'
import { metahubsQueryKeys } from '../../shared'
import { getVLCString } from '../../../types'
import { packagesApi, playcanvasProjectsApi } from '../../packages/api'
import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'
import { DropdownSelect as Select } from '@universo-react/template-mui/dropdowns'

type PlayCanvasCanvasWidgetConfig = z.infer<typeof playcanvasCanvasWidgetConfigSchema>
type LocalizedTitle = VersionedLocalizedContent<string>
type PlayCanvasCanvasWidgetDraft = Omit<PlayCanvasCanvasWidgetConfig, 'title'> & {
    title?: LocalizedTitle | string | Record<string, string>
}

type ModuleOption = {
    codename: string
    label: string
    description: string | null
}

export interface PlayCanvasCanvasWidgetEditorDialogProps {
    open: boolean
    metahubId: string
    config?: Record<string, unknown> | null
    layoutId?: string | null
    widgetId?: string | null
    showScopeVisibility?: boolean
    onSave: (config: PlayCanvasCanvasWidgetConfig) => Promise<void> | void
    onCancel: () => void
}

const toEditorLocalizedTitle = (value: unknown, uiLocale: string): LocalizedTitle => {
    const localizedValues = typeof value === 'string' ? { en: value } : toLocalizedStringMap(value)
    if (!localizedValues || Object.keys(localizedValues).length === 0) {
        return createLocalizedContent('en', 'Universo MMOOMM')
    }

    const configuredPrimary =
        value && typeof value === 'object' && '_primary' in value && typeof value._primary === 'string' ? value._primary : undefined
    const primaryLocale =
        (configuredPrimary && localizedValues[configuredPrimary] !== undefined ? configuredPrimary : undefined) ??
        (localizedValues[uiLocale] !== undefined ? uiLocale : undefined) ??
        (localizedValues.en !== undefined ? 'en' : Object.keys(localizedValues)[0])
    let localizedTitle = createLocalizedContent(primaryLocale, localizedValues[primaryLocale] ?? '')

    for (const [locale, content] of Object.entries(localizedValues)) {
        if (locale === primaryLocale) continue
        localizedTitle = updateLocalizedContentLocale(localizedTitle, locale, content)
    }

    return localizedTitle
}

const normalizeConfig = (config: unknown, uiLocale: string): PlayCanvasCanvasWidgetDraft => {
    const rawConfig = config && typeof config === 'object' && !Array.isArray(config) ? (config as Record<string, unknown>) : {}
    const normalizedInput = {
        ...rawConfig,
        ...(Object.prototype.hasOwnProperty.call(rawConfig, 'title')
            ? { title: toLocalizedStringMap(rawConfig.title) ?? rawConfig.title }
            : {})
    }
    const parsed = playcanvasCanvasWidgetConfigSchema.safeParse(normalizedInput)
    if (parsed.success) {
        return {
            ...parsed.data,
            title: toEditorLocalizedTitle(parsed.data.title, uiLocale),
            minHeight: parsed.data.minHeight ?? 560,
            heightMode: parsed.data.heightMode ?? 'fitViewport'
        }
    }
    return {
        title: toEditorLocalizedTitle(undefined, uiLocale),
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
    showScopeVisibility = false,
    onSave,
    onCancel
}: PlayCanvasCanvasWidgetEditorDialogProps) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const uiLocale = i18n.language?.toLowerCase().startsWith('ru') ? 'ru' : 'en'
    const runtimeManifestLabelId = useId()
    const clientModuleLabelId = useId()
    const serverModuleLabelId = useId()
    const [draft, setDraft] = useState<PlayCanvasCanvasWidgetDraft>(() => normalizeConfig(config, uiLocale))
    const [submitError, setSubmitError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        setDraft(normalizeConfig(config, uiLocale))
        setSubmitError(null)
    }, [config, open, uiLocale])

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

    const hasActivePlayCanvasDisplayPackage = useMemo(
        () => (packagesQuery.data ?? []).some((item) => item.isActive && item.config.kind === 'display'),
        [packagesQuery.data]
    )
    const manifests = useMemo(
        () => (hasActivePlayCanvasDisplayPackage ? manifestsQuery.data ?? [] : []),
        [hasActivePlayCanvasDisplayPackage, manifestsQuery.data]
    )
    const modules = useMemo(() => modulesQuery.data ?? [], [modulesQuery.data])
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
    const updateDraft = (patch: Partial<PlayCanvasCanvasWidgetDraft>) => {
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

    const handleSave = async () => {
        if (draft.runtimeManifest && !selectedManifestExists) {
            setSubmitError(
                t(
                    'layouts.playcanvasCanvasEditor.validation.invalidRuntimeManifest',
                    'Choose a published scene from an active display package or clear the selection.'
                )
            )
            return
        }
        const parsed = playcanvasCanvasWidgetConfigSchema.safeParse({
            ...draft,
            title: toLocalizedStringMap(draft.title) ?? draft.title
        })
        if (!parsed.success) {
            setSubmitError(
                t('layouts.playcanvasCanvasEditor.validation.invalidConfig', 'Check the PlayCanvas canvas widget settings and try again.')
            )
            return
        }
        setSubmitError(null)
        await onSave(parsed.data)
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
            autoCloseOnSuccess={false}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            error={submitError ?? undefined}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography
                        variant='body2'
                        sx={{
                            color: 'text.secondary'
                        }}
                    >
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
                        slotProps={{ htmlInput: { min: 320, max: 1200, step: 20 } }}
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
                    {showScopeVisibility && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
