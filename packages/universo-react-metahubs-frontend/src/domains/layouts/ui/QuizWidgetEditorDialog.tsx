import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    Alert,
    Button,
    Collapse,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material'
import type { MetahubModuleRecord, QuizWidgetConfig, VersionedLocalizedContent } from '@universo-react/types'
import { isClientModuleMethodTarget } from '@universo-react/types'
import { EntityFormDialog } from '@universo-react/template-mui'

import { modulesApi } from '../../modules/api/modulesApi'
import { getVLCString } from '../../../types'
import LayoutWidgetSharedBehaviorFields, {
    getSharedBehaviorFromWidgetConfig,
    setSharedBehaviorInWidgetConfig
} from './LayoutWidgetSharedBehaviorFields'
import WidgetScopeVisibilityPanel from './WidgetScopeVisibilityPanel'

export interface QuizWidgetEditorDialogProps {
    open: boolean
    metahubId: string
    config?: QuizWidgetConfig | null
    layoutId?: string | null
    widgetId?: string | null
    showSharedBehavior?: boolean
    showScopeVisibility?: boolean
    onSave: (config: QuizWidgetConfig) => void
    onCancel: () => void
}

type QuizWidgetDraft = {
    title: string
    description: string
    moduleCodename: string
    attachedToKind: 'metahub' | 'object'
    mountMethodName: string
    submitMethodName: string
    emptyStateTitle: string
    emptyStateDescription: string
}

type QuizWidgetModuleOption = {
    codename: string
    label: string
    description: string | null
}

const createDraft = (config?: QuizWidgetConfig | null): QuizWidgetDraft => ({
    title: config?.title ?? '',
    description: config?.description ?? '',
    moduleCodename: config?.moduleCodename ?? '',
    attachedToKind: config?.attachedToKind === 'object' ? 'object' : 'metahub',
    mountMethodName: config?.mountMethodName ?? '',
    submitMethodName: config?.submitMethodName ?? '',
    emptyStateTitle: config?.emptyStateTitle ?? '',
    emptyStateDescription: config?.emptyStateDescription ?? ''
})

const getPreferredLocalizedText = (value: unknown): string => {
    if (!value || typeof value !== 'object') {
        return ''
    }

    const localizedValue = value as VersionedLocalizedContent<string>
    return getVLCString(localizedValue, localizedValue._primary ?? 'en') || getVLCString(localizedValue, 'en') || ''
}

const toModuleOption = (module: MetahubModuleRecord): QuizWidgetModuleOption => {
    const codename = getPreferredLocalizedText(module.codename)
    const name = getPreferredLocalizedText(module.presentation?.name)
    const description = getPreferredLocalizedText(module.presentation?.description) || null

    return {
        codename,
        label: name ? `${name} (${codename})` : codename,
        description
    }
}

const buildQuizWidgetConfig = (draft: QuizWidgetDraft): QuizWidgetConfig => {
    const title = draft.title.trim()
    const description = draft.description.trim()
    const moduleCodename = draft.moduleCodename.trim()
    const mountMethodName = draft.mountMethodName.trim()
    const submitMethodName = draft.submitMethodName.trim()
    const emptyStateTitle = draft.emptyStateTitle.trim()
    const emptyStateDescription = draft.emptyStateDescription.trim()

    return {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(moduleCodename ? { moduleCodename } : {}),
        attachedToKind: draft.attachedToKind,
        ...(mountMethodName && mountMethodName !== 'mount' ? { mountMethodName } : {}),
        ...(submitMethodName && submitMethodName !== 'submit' ? { submitMethodName } : {}),
        ...(emptyStateTitle ? { emptyStateTitle } : {}),
        ...(emptyStateDescription ? { emptyStateDescription } : {})
    }
}

export default function QuizWidgetEditorDialog({
    open,
    metahubId,
    config,
    layoutId,
    widgetId,
    showSharedBehavior = false,
    showScopeVisibility = false,
    onSave,
    onCancel
}: QuizWidgetEditorDialogProps) {
    const { t } = useTranslation(['metahubs', 'common'])
    const attachmentKindLabelId = useId()
    const moduleLabelId = useId()
    const [draft, setDraft] = useState<QuizWidgetDraft>(() => createDraft(config))
    const [sharedBehaviorValue, setSharedBehaviorValue] = useState(() => getSharedBehaviorFromWidgetConfig(config))
    const [showAdvancedActions, setShowAdvancedActions] = useState(false)

    useEffect(() => {
        if (!open) {
            return
        }

        setDraft(createDraft(config))
        setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(config))
        setShowAdvancedActions(false)
    }, [open, config])

    const modulesQuery = useQuery({
        queryKey: ['quiz-widget-editor-modules', metahubId, draft.attachedToKind],
        enabled: open,
        queryFn: () => modulesApi.list(metahubId, { attachedToKind: draft.attachedToKind })
    })

    const availableModules = useMemo(() => {
        const seenCodenames = new Set<string>()

        return (modulesQuery.data ?? [])
            .filter(
                (module) =>
                    module.isActive &&
                    module.moduleRole === 'widget' &&
                    module.manifest.methods.some((method) => isClientModuleMethodTarget(method.target))
            )
            .map(toModuleOption)
            .filter((module) => {
                if (!module.codename || seenCodenames.has(module.codename)) {
                    return false
                }

                seenCodenames.add(module.codename)
                return true
            })
            .sort((left, right) => left.label.localeCompare(right.label))
    }, [modulesQuery.data])

    useEffect(() => {
        if (!draft.moduleCodename) {
            return
        }

        if (availableModules.some((module) => module.codename === draft.moduleCodename)) {
            return
        }

        setDraft((current) => ({
            ...current,
            moduleCodename: ''
        }))
    }, [availableModules, draft.moduleCodename])

    const selectedModule = availableModules.find((module) => module.codename === draft.moduleCodename) ?? null

    return (
        <EntityFormDialog
            open={open}
            title={t('layouts.quizEditor.title', 'Quiz widget')}
            mode={config ? 'edit' : 'create'}
            nameLabel={t('common:fields.name', 'Name')}
            descriptionLabel={t('common:fields.description', 'Description')}
            hideDefaultFields
            onClose={onCancel}
            onSave={() => onSave(setSharedBehaviorInWidgetConfig(buildQuizWidgetConfig(draft), sharedBehaviorValue) as QuizWidgetConfig)}
            saveButtonText={t('common:save', 'Save')}
            cancelButtonText={t('common:cancel', 'Cancel')}
            extraFields={() => (
                <Stack spacing={2.5}>
                    <Typography variant='body2' color='text.secondary'>
                        {t(
                            'layouts.quizEditor.description',
                            'Choose which published quiz behavior this widget should use for the selected page or application scope.'
                        )}
                    </Typography>

                    {modulesQuery.isError ? (
                        <Alert severity='error'>
                            {t('layouts.quizEditor.loadError', 'Failed to load available quiz modules for this metahub.')}
                        </Alert>
                    ) : null}

                    {!modulesQuery.isLoading && availableModules.length === 0 ? (
                        <Alert severity='warning'>
                            {t('layouts.quizEditor.noModules', 'No active quiz modules are available for the selected source yet.')}
                        </Alert>
                    ) : null}

                    <TextField
                        label={t('layouts.quizEditor.widgetTitle', 'Widget title override')}
                        value={draft.title}
                        onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                        fullWidth
                    />

                    <TextField
                        label={t('layouts.quizEditor.widgetDescription', 'Widget description override')}
                        value={draft.description}
                        onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                        multiline
                        minRows={2}
                        fullWidth
                    />

                    <FormControl fullWidth>
                        <InputLabel id={attachmentKindLabelId}>{t('layouts.quizEditor.attachmentKind', 'Quiz source')}</InputLabel>
                        <Select
                            labelId={attachmentKindLabelId}
                            value={draft.attachedToKind}
                            label={t('layouts.quizEditor.attachmentKind', 'Quiz source')}
                            onChange={(event) =>
                                setDraft((current) => ({
                                    ...current,
                                    attachedToKind: event.target.value as 'metahub' | 'object'
                                }))
                            }
                        >
                            <MenuItem value='metahub'>{t('layouts.quizEditor.attachmentKinds.metahub', 'Metahub')}</MenuItem>
                            <MenuItem value='object'>{t('layouts.quizEditor.attachmentKinds.object', 'Current object')}</MenuItem>
                        </Select>
                        <FormHelperText>
                            {t(
                                'layouts.quizEditor.attachmentKindHelp',
                                'Use the current object for page-specific quizzes, or the metahub for quizzes shared across the application.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel id={moduleLabelId}>{t('layouts.quizEditor.moduleCodename', 'Quiz module')}</InputLabel>
                        <Select
                            labelId={moduleLabelId}
                            value={draft.moduleCodename}
                            label={t('layouts.quizEditor.moduleCodename', 'Quiz module')}
                            onChange={(event) => setDraft((current) => ({ ...current, moduleCodename: String(event.target.value) }))}
                        >
                            <MenuItem value=''>{t('layouts.quizEditor.useFirstAvailable', 'Use the first available quiz module')}</MenuItem>
                            {availableModules.map((module) => (
                                <MenuItem key={module.codename} value={module.codename}>
                                    {module.label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {selectedModule?.description ||
                                t(
                                    'layouts.quizEditor.moduleCodenameHelp',
                                    'Leave this empty only when there is a single obvious quiz module for the selected source.'
                                )}
                        </FormHelperText>
                    </FormControl>

                    <Stack spacing={1}>
                        <Button
                            type='button'
                            variant='text'
                            size='small'
                            sx={{ alignSelf: 'flex-start' }}
                            onClick={() => setShowAdvancedActions((value) => !value)}
                        >
                            {t('layouts.quizEditor.advancedActions', 'Advanced actions')}
                        </Button>
                        <Collapse in={showAdvancedActions} unmountOnExit>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                                <TextField
                                    label={t('layouts.quizEditor.mountMethodName', 'Content loader')}
                                    value={draft.mountMethodName}
                                    onChange={(event) => setDraft((current) => ({ ...current, mountMethodName: event.target.value }))}
                                    helperText={t('layouts.quizEditor.mountMethodHelp', 'Optional. Leave empty to use the default loader.')}
                                    fullWidth
                                />
                                <TextField
                                    label={t('layouts.quizEditor.submitMethodName', 'Answer checker')}
                                    value={draft.submitMethodName}
                                    onChange={(event) => setDraft((current) => ({ ...current, submitMethodName: event.target.value }))}
                                    helperText={t(
                                        'layouts.quizEditor.submitMethodHelp',
                                        'Optional. Leave empty to use the default answer checker.'
                                    )}
                                    fullWidth
                                />
                            </Stack>
                        </Collapse>
                    </Stack>

                    <TextField
                        label={t('layouts.quizEditor.emptyStateTitle', 'Empty state title')}
                        value={draft.emptyStateTitle}
                        onChange={(event) => setDraft((current) => ({ ...current, emptyStateTitle: event.target.value }))}
                        fullWidth
                    />

                    <TextField
                        label={t('layouts.quizEditor.emptyStateDescription', 'Empty state description')}
                        value={draft.emptyStateDescription}
                        onChange={(event) => setDraft((current) => ({ ...current, emptyStateDescription: event.target.value }))}
                        multiline
                        minRows={2}
                        fullWidth
                    />

                    {showSharedBehavior ? (
                        <LayoutWidgetSharedBehaviorFields
                            value={{ sharedBehavior: sharedBehaviorValue }}
                            onChange={(nextValue) => setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(nextValue))}
                        />
                    ) : null}

                    {showScopeVisibility && layoutId && widgetId ? (
                        <WidgetScopeVisibilityPanel metahubId={metahubId} layoutId={layoutId} widgetId={widgetId} />
                    ) : null}
                </Stack>
            )}
        />
    )
}
