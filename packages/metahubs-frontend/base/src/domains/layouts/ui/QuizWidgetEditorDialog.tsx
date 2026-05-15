import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, FormControl, FormHelperText, InputLabel, MenuItem, Select, Stack, TextField, Typography } from '@mui/material'
import type { MetahubScriptRecord, QuizWidgetConfig, VersionedLocalizedContent } from '@universo/types'
import { isClientScriptMethodTarget } from '@universo/types'
import { EntityFormDialog } from '@universo/template-mui'

import { scriptsApi } from '../../scripts/api/scriptsApi'
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
    scriptCodename: string
    attachedToKind: 'metahub' | 'object'
    mountMethodName: string
    submitMethodName: string
    emptyStateTitle: string
    emptyStateDescription: string
}

type QuizWidgetScriptOption = {
    codename: string
    label: string
    description: string | null
}

const createDraft = (config?: QuizWidgetConfig | null): QuizWidgetDraft => ({
    title: config?.title ?? '',
    description: config?.description ?? '',
    scriptCodename: config?.scriptCodename ?? '',
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

const toScriptOption = (script: MetahubScriptRecord): QuizWidgetScriptOption => {
    const codename = getPreferredLocalizedText(script.codename)
    const name = getPreferredLocalizedText(script.presentation?.name)
    const description = getPreferredLocalizedText(script.presentation?.description) || null

    return {
        codename,
        label: name ? `${name} (${codename})` : codename,
        description
    }
}

const buildQuizWidgetConfig = (draft: QuizWidgetDraft): QuizWidgetConfig => {
    const title = draft.title.trim()
    const description = draft.description.trim()
    const scriptCodename = draft.scriptCodename.trim()
    const mountMethodName = draft.mountMethodName.trim()
    const submitMethodName = draft.submitMethodName.trim()
    const emptyStateTitle = draft.emptyStateTitle.trim()
    const emptyStateDescription = draft.emptyStateDescription.trim()

    return {
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
        ...(scriptCodename ? { scriptCodename } : {}),
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
    const [draft, setDraft] = useState<QuizWidgetDraft>(() => createDraft(config))
    const [sharedBehaviorValue, setSharedBehaviorValue] = useState(() => getSharedBehaviorFromWidgetConfig(config))

    useEffect(() => {
        if (!open) {
            return
        }

        setDraft(createDraft(config))
        setSharedBehaviorValue(getSharedBehaviorFromWidgetConfig(config))
    }, [open, config])

    const scriptsQuery = useQuery({
        queryKey: ['quiz-widget-editor-scripts', metahubId, draft.attachedToKind],
        enabled: open,
        queryFn: () => scriptsApi.list(metahubId, { attachedToKind: draft.attachedToKind })
    })

    const availableScripts = useMemo(() => {
        const seenCodenames = new Set<string>()

        return (scriptsQuery.data ?? [])
            .filter(
                (script) =>
                    script.isActive &&
                    script.moduleRole === 'widget' &&
                    script.manifest.methods.some((method) => isClientScriptMethodTarget(method.target))
            )
            .map(toScriptOption)
            .filter((script) => {
                if (!script.codename || seenCodenames.has(script.codename)) {
                    return false
                }

                seenCodenames.add(script.codename)
                return true
            })
            .sort((left, right) => left.label.localeCompare(right.label))
    }, [scriptsQuery.data])

    useEffect(() => {
        if (!draft.scriptCodename) {
            return
        }

        if (availableScripts.some((script) => script.codename === draft.scriptCodename)) {
            return
        }

        setDraft((current) => ({
            ...current,
            scriptCodename: ''
        }))
    }, [availableScripts, draft.scriptCodename])

    const selectedScript = availableScripts.find((script) => script.codename === draft.scriptCodename) ?? null

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
                            'Bind the quiz widget to a published widget script. The runtime resolves metahub-wide or current-object scripts by codename.'
                        )}
                    </Typography>

                    {scriptsQuery.isError ? (
                        <Alert severity='error'>
                            {t('layouts.quizEditor.loadError', 'Failed to load available quiz scripts for this metahub.')}
                        </Alert>
                    ) : null}

                    {!scriptsQuery.isLoading && availableScripts.length === 0 ? (
                        <Alert severity='warning'>
                            {t(
                                'layouts.quizEditor.noScripts',
                                'No active widget scripts with client methods are available for the selected attachment kind yet.'
                            )}
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
                        <InputLabel>{t('layouts.quizEditor.attachmentKind', 'Script attachment kind')}</InputLabel>
                        <Select
                            value={draft.attachedToKind}
                            label={t('layouts.quizEditor.attachmentKind', 'Script attachment kind')}
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
                                'Object-scoped scripts resolve against the current object at runtime, while metahub scripts stay global.'
                            )}
                        </FormHelperText>
                    </FormControl>

                    <FormControl fullWidth>
                        <InputLabel>{t('layouts.quizEditor.scriptCodename', 'Script codename')}</InputLabel>
                        <Select
                            value={draft.scriptCodename}
                            label={t('layouts.quizEditor.scriptCodename', 'Script codename')}
                            onChange={(event) => setDraft((current) => ({ ...current, scriptCodename: String(event.target.value) }))}
                        >
                            <MenuItem value=''>{t('layouts.quizEditor.useFirstAvailable', 'Use the first available script')}</MenuItem>
                            {availableScripts.map((script) => (
                                <MenuItem key={script.codename} value={script.codename}>
                                    {script.label}
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            {selectedScript?.description ||
                                t(
                                    'layouts.quizEditor.scriptCodenameHelp',
                                    'Leave this empty only if the selected attachment kind has a single obvious quiz widget script.'
                                )}
                        </FormHelperText>
                    </FormControl>

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <TextField
                            label={t('layouts.quizEditor.mountMethodName', 'Mount method')}
                            value={draft.mountMethodName}
                            onChange={(event) => setDraft((current) => ({ ...current, mountMethodName: event.target.value }))}
                            helperText={t('layouts.quizEditor.mountMethodHelp', 'Optional override. Default: mount')}
                            fullWidth
                        />
                        <TextField
                            label={t('layouts.quizEditor.submitMethodName', 'Submit method')}
                            value={draft.submitMethodName}
                            onChange={(event) => setDraft((current) => ({ ...current, submitMethodName: event.target.value }))}
                            helperText={t('layouts.quizEditor.submitMethodHelp', 'Optional override. Default: submit')}
                            fullWidth
                        />
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
