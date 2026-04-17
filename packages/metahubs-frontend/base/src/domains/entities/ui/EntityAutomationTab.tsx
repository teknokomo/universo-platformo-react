import { useEffect, useMemo, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSnackbar } from 'notistack'
import { SCRIPT_LIFECYCLE_EVENTS, type MetahubScriptRecord, type ScriptAttachmentKind } from '@universo/types'
import type { TabConfig } from '@universo/template-mui/components/dialogs'
import { extractAxiosError } from '@universo/utils'

import { getLocalizedContentText } from '../../../utils/localizedInput'
import { scriptsApi } from '../../scripts/api/scriptsApi'
import {
    createEntityAction,
    createEntityEventBinding,
    deleteEntityAction,
    deleteEntityEventBinding,
    listEntityActions,
    listEntityEventBindings,
    updateEntityAction,
    updateEntityEventBinding,
    type MetahubEntityAction,
    type MetahubEventBinding
} from '../api/entityAutomation'

type TranslationFn = (key: string, defaultValue?: string) => string

type ActionDraft = {
    id: string | null
    codename: string
    name: string
    actionType: 'script' | 'builtin'
    scriptId: string
    sortOrder: string
    configText: string
    version?: number
}

type EventBindingDraft = {
    id: string | null
    eventName: string
    actionId: string
    priority: string
    isActive: boolean
    configText: string
    version?: number
}

const EVENT_NAME_OPTIONS = [...SCRIPT_LIFECYCLE_EVENTS, 'onValidate', 'beforeWrite', 'afterWrite'] as const

const panelSx = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 2,
    p: 2
} as const

const resolveErrorMessage = (error: unknown, fallback: string): string => {
    const message = extractAxiosError(error).message.trim()
    return message.length > 0 ? message : fallback
}

const ensureJsonRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    return value as Record<string, unknown>
}

const stringifyJson = (value: unknown) => JSON.stringify(ensureJsonRecord(value), null, 2)

const parseJsonRecord = (value: string, label: string): Record<string, unknown> => {
    if (value.trim().length === 0) {
        return {}
    }

    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`${label} must be a JSON object`)
    }

    return parsed as Record<string, unknown>
}

const parseOptionalInteger = (value: string, label: string): number | undefined => {
    if (value.trim().length === 0) {
        return undefined
    }

    const parsed = Number(value)
    if (!Number.isInteger(parsed)) {
        throw new Error(`${label} must be an integer`)
    }

    return parsed
}

const readRecordString = (value: unknown, key: string): string => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return ''
    }

    const entry = (value as Record<string, unknown>)[key]
    return typeof entry === 'string' ? entry : ''
}

const buildActionLabel = (action: MetahubEntityAction): string => {
    const presentationName = readRecordString(action.presentation, 'name').trim()
    if (presentationName.length > 0) {
        return presentationName
    }

    return getLocalizedContentText(action.codename, 'en', action.id) || action.id
}

const buildScriptLabel = (script: MetahubScriptRecord): string => {
    return getLocalizedContentText(script.presentation?.name, 'en', script.id) || script.id
}

const createActionDraft = (action?: MetahubEntityAction | null): ActionDraft => ({
    id: action?.id ?? null,
    codename: action ? getLocalizedContentText(action.codename, 'en', action.id) || '' : '',
    name: action ? readRecordString(action.presentation, 'name') : '',
    actionType: action?.actionType ?? 'script',
    scriptId: action?.scriptId ?? '',
    sortOrder: typeof action?.sortOrder === 'number' ? String(action.sortOrder) : '',
    configText: stringifyJson(action?.config),
    version: action?.version
})

const createEventBindingDraft = (binding?: MetahubEventBinding | null): EventBindingDraft => ({
    id: binding?.id ?? null,
    eventName: binding?.eventName ?? 'afterUpdate',
    actionId: binding?.actionId ?? '',
    priority: typeof binding?.priority === 'number' ? String(binding.priority) : '0',
    isActive: binding?.isActive ?? true,
    configText: stringifyJson(binding?.config),
    version: binding?.version
})

const queryKeys = {
    actions: (metahubId: string, entityId: string) => ['metahub-entity-actions', metahubId, entityId] as const,
    bindings: (metahubId: string, entityId: string) => ['metahub-entity-event-bindings', metahubId, entityId] as const,
    scripts: (metahubId: string, attachedToKind: ScriptAttachmentKind, entityId: string) =>
        ['metahub-entity-automation-scripts', metahubId, attachedToKind, entityId] as const
}

const EntityActionsTab = ({
    t,
    metahubId,
    entityId,
    attachedToKind
}: {
    t: TranslationFn
    metahubId: string | null | undefined
    entityId: string | null
    attachedToKind: ScriptAttachmentKind
}) => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const [selectedActionId, setSelectedActionId] = useState<string | null>(null)
    const [draft, setDraft] = useState<ActionDraft>(() => createActionDraft())
    const [formError, setFormError] = useState<string | null>(null)

    const canLoad = Boolean(metahubId && entityId)

    const actionsQuery = useQuery({
        queryKey: canLoad ? queryKeys.actions(metahubId!, entityId!) : ['metahub-entity-actions', 'empty'],
        queryFn: () => listEntityActions(metahubId!, entityId!),
        enabled: canLoad,
        staleTime: 30_000
    })

    const scriptsQuery = useQuery({
        queryKey: canLoad ? queryKeys.scripts(metahubId!, attachedToKind, entityId!) : ['metahub-entity-automation-scripts', 'empty'],
        queryFn: () => scriptsApi.list(metahubId!, { attachedToKind, attachedToId: entityId! }),
        enabled: canLoad,
        staleTime: 30_000
    })

    const actions = actionsQuery.data ?? []
    const scripts = scriptsQuery.data ?? []
    const selectedAction = useMemo(() => actions.find((action) => action.id === selectedActionId) ?? null, [actions, selectedActionId])
    const scriptNameById = useMemo(() => new Map(scripts.map((script) => [script.id, buildScriptLabel(script)])), [scripts])

    useEffect(() => {
        if (!selectedActionId) {
            return
        }

        if (!selectedAction) {
            setSelectedActionId(null)
            setDraft(createActionDraft())
            return
        }

        setDraft(createActionDraft(selectedAction))
    }, [selectedAction, selectedActionId])

    const createMutation = useMutation({
        mutationFn: async (nextDraft: ActionDraft) => {
            if (!metahubId || !entityId) {
                throw new Error(t('entities.instances.automation.actions.saveFirst', 'Save this entity first to manage actions.'))
            }

            return createEntityAction(metahubId, entityId, {
                codename: nextDraft.codename.trim(),
                presentation: nextDraft.name.trim().length > 0 ? { name: nextDraft.name.trim() } : {},
                actionType: nextDraft.actionType,
                scriptId: nextDraft.actionType === 'script' ? nextDraft.scriptId || null : null,
                sortOrder: parseOptionalInteger(
                    nextDraft.sortOrder,
                    t('entities.instances.automation.actions.fields.sortOrder', 'Sort order')
                ),
                config: parseJsonRecord(nextDraft.configText, t('entities.instances.automation.actions.fields.config', 'Action config'))
            })
        }
    })

    const updateMutation = useMutation({
        mutationFn: async (nextDraft: ActionDraft) => {
            if (!metahubId || !nextDraft.id) {
                throw new Error(t('entities.instances.automation.actions.saveFirst', 'Save this entity first to manage actions.'))
            }

            return updateEntityAction(metahubId, nextDraft.id, {
                codename: nextDraft.codename.trim(),
                presentation: nextDraft.name.trim().length > 0 ? { name: nextDraft.name.trim() } : {},
                actionType: nextDraft.actionType,
                scriptId: nextDraft.actionType === 'script' ? nextDraft.scriptId || null : null,
                sortOrder: parseOptionalInteger(
                    nextDraft.sortOrder,
                    t('entities.instances.automation.actions.fields.sortOrder', 'Sort order')
                ),
                config: parseJsonRecord(nextDraft.configText, t('entities.instances.automation.actions.fields.config', 'Action config')),
                expectedVersion: nextDraft.version
            })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (actionId: string) => {
            if (!metahubId) {
                throw new Error(t('entities.instances.automation.actions.saveFirst', 'Save this entity first to manage actions.'))
            }

            await deleteEntityAction(metahubId, actionId)
        }
    })

    const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

    const refreshActions = async () => {
        if (!metahubId || !entityId) {
            return
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.actions(metahubId, entityId) })
    }

    const handleNew = () => {
        setSelectedActionId(null)
        setDraft(createActionDraft())
        setFormError(null)
    }

    const handleSave = async () => {
        setFormError(null)

        if (draft.codename.trim().length === 0) {
            setFormError(t('entities.instances.automation.actions.validation.codenameRequired', 'Action codename is required.'))
            return
        }

        if (draft.actionType === 'script' && draft.scriptId.trim().length === 0) {
            setFormError(t('entities.instances.automation.actions.validation.scriptRequired', 'Select a script for script actions.'))
            return
        }

        try {
            const saved = draft.id ? await updateMutation.mutateAsync(draft) : await createMutation.mutateAsync(draft)
            await refreshActions()
            setSelectedActionId(saved.id)
            setDraft(createActionDraft(saved))
            enqueueSnackbar(
                draft.id
                    ? t('entities.instances.automation.actions.updateSuccess', 'Action updated')
                    : t('entities.instances.automation.actions.createSuccess', 'Action created'),
                { variant: 'success' }
            )
        } catch (error) {
            setFormError(
                resolveErrorMessage(
                    error,
                    draft.id
                        ? t('entities.instances.automation.actions.updateError', 'Failed to update action')
                        : t('entities.instances.automation.actions.createError', 'Failed to create action')
                )
            )
        }
    }

    const handleDelete = async () => {
        if (!draft.id) {
            return
        }

        setFormError(null)

        try {
            await deleteMutation.mutateAsync(draft.id)
            await refreshActions()
            handleNew()
            enqueueSnackbar(t('entities.instances.automation.actions.deleteSuccess', 'Action deleted'), { variant: 'success' })
        } catch (error) {
            setFormError(resolveErrorMessage(error, t('entities.instances.automation.actions.deleteError', 'Failed to delete action')))
        }
    }

    if (!canLoad) {
        return (
            <Alert severity='info'>
                {t('entities.instances.automation.actions.saveFirst', 'Save this entity first to manage actions.')}
            </Alert>
        )
    }

    return (
        <Stack spacing={2}>
            <Alert severity='info'>
                {t(
                    'entities.instances.automation.actions.description',
                    'Actions describe reusable automation steps for this entity instance. Script actions can be bound to lifecycle events in the Events tab.'
                )}
            </Alert>

            {actionsQuery.error ? (
                <Alert severity='error'>
                    {resolveErrorMessage(
                        actionsQuery.error,
                        t('entities.instances.automation.actions.loadError', 'Failed to load actions')
                    )}
                </Alert>
            ) : null}

            <Box sx={panelSx}>
                <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={1} sx={{ mb: 1.5 }}>
                    <Typography variant='subtitle2'>
                        {t('entities.instances.automation.actions.listTitle', 'Configured actions')}
                    </Typography>
                    <Button size='small' onClick={handleNew} disabled={isSaving}>
                        {t('entities.instances.automation.actions.newAction', 'New action')}
                    </Button>
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
                    {actions.map((action) => (
                        <ListItemButton
                            key={action.id}
                            selected={action.id === selectedActionId}
                            onClick={() => setSelectedActionId(action.id)}
                        >
                            <ListItemText
                                primary={buildActionLabel(action)}
                                secondary={
                                    action.actionType === 'script'
                                        ? `${t('entities.instances.automation.actions.type.script', 'Script')} · ${
                                              scriptNameById.get(action.scriptId ?? '') ??
                                              t('entities.instances.automation.actions.noScript', 'No script')
                                          }`
                                        : t('entities.instances.automation.actions.type.builtin', 'Platform action')
                                }
                            />
                        </ListItemButton>
                    ))}
                    {actionsQuery.isLoading ? (
                        <Box sx={{ px: 1, py: 2 }}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('entities.instances.automation.actions.loading', 'Loading actions...')}
                            </Typography>
                        </Box>
                    ) : null}
                    {!actionsQuery.isLoading && actions.length === 0 ? (
                        <Box sx={{ px: 1, py: 2 }}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('entities.instances.automation.actions.empty', 'No actions configured yet.')}
                            </Typography>
                        </Box>
                    ) : null}
                </List>
            </Box>

            <Box sx={panelSx}>
                <Stack spacing={2}>
                    <Typography variant='subtitle2'>
                        {draft.id
                            ? t('entities.instances.automation.actions.editTitle', 'Edit action')
                            : t('entities.instances.automation.actions.createTitle', 'Create action')}
                    </Typography>

                    {formError ? <Alert severity='error'>{formError}</Alert> : null}

                    <TextField
                        label={t('entities.instances.automation.actions.fields.name', 'Action name')}
                        value={draft.name}
                        onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                        disabled={isSaving}
                        size='small'
                        fullWidth
                    />

                    <TextField
                        label={t('entities.instances.automation.actions.fields.codename', 'Action codename')}
                        value={draft.codename}
                        onChange={(event) => setDraft((prev) => ({ ...prev, codename: event.target.value }))}
                        disabled={isSaving}
                        size='small'
                        fullWidth
                        required
                    />

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <FormControl size='small' fullWidth>
                            <InputLabel>{t('entities.instances.automation.actions.fields.actionType', 'Action type')}</InputLabel>
                            <Select
                                label={t('entities.instances.automation.actions.fields.actionType', 'Action type')}
                                value={draft.actionType}
                                onChange={(event) =>
                                    setDraft((prev) => ({
                                        ...prev,
                                        actionType: event.target.value as ActionDraft['actionType'],
                                        scriptId: event.target.value === 'builtin' ? '' : prev.scriptId
                                    }))
                                }
                                disabled={isSaving}
                            >
                                <MenuItem value='script'>{t('entities.instances.automation.actions.type.script', 'Script')}</MenuItem>
                                <MenuItem value='builtin'>
                                    {t('entities.instances.automation.actions.type.builtin', 'Platform action')}
                                </MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl size='small' fullWidth disabled={isSaving || draft.actionType !== 'script'}>
                            <InputLabel>{t('entities.instances.automation.actions.fields.script', 'Script')}</InputLabel>
                            <Select
                                label={t('entities.instances.automation.actions.fields.script', 'Script')}
                                value={draft.scriptId}
                                onChange={(event) => setDraft((prev) => ({ ...prev, scriptId: String(event.target.value) }))}
                            >
                                <MenuItem value=''>
                                    {t('entities.instances.automation.actions.fields.scriptPlaceholder', 'Select a script')}
                                </MenuItem>
                                {scripts.map((script) => (
                                    <MenuItem key={script.id} value={script.id}>
                                        {buildScriptLabel(script)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label={t('entities.instances.automation.actions.fields.sortOrder', 'Sort order')}
                            type='number'
                            value={draft.sortOrder}
                            onChange={(event) => setDraft((prev) => ({ ...prev, sortOrder: event.target.value }))}
                            disabled={isSaving}
                            size='small'
                            sx={{ width: { xs: '100%', md: 180 } }}
                        />
                    </Stack>

                    {draft.actionType === 'script' && scripts.length === 0 ? (
                        <Alert severity='warning'>
                            {t(
                                'entities.instances.automation.actions.noScriptsAvailable',
                                'No scripts are attached to this entity yet. Add one in the Scripts tab or switch this action to a platform action.'
                            )}
                        </Alert>
                    ) : null}

                    <TextField
                        label={t('entities.instances.automation.actions.fields.config', 'Action config (JSON)')}
                        value={draft.configText}
                        onChange={(event) => setDraft((prev) => ({ ...prev, configText: event.target.value }))}
                        disabled={isSaving}
                        size='small'
                        multiline
                        minRows={6}
                        fullWidth
                    />

                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                        {draft.id ? (
                            <Button color='error' onClick={handleDelete} disabled={isSaving}>
                                {t('entities.instances.automation.actions.deleteAction', 'Delete action')}
                            </Button>
                        ) : null}
                        <Button variant='contained' onClick={handleSave} disabled={isSaving}>
                            {draft.id
                                ? t('entities.instances.automation.actions.updateAction', 'Update action')
                                : t('entities.instances.automation.actions.createAction', 'Create action')}
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </Stack>
    )
}

const EntityEventBindingsTab = ({
    t,
    metahubId,
    entityId,
    attachedToKind
}: {
    t: TranslationFn
    metahubId: string | null | undefined
    entityId: string | null
    attachedToKind: ScriptAttachmentKind
}) => {
    const queryClient = useQueryClient()
    const { enqueueSnackbar } = useSnackbar()
    const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null)
    const [draft, setDraft] = useState<EventBindingDraft>(() => createEventBindingDraft())
    const [formError, setFormError] = useState<string | null>(null)

    const canLoad = Boolean(metahubId && entityId)

    const actionsQuery = useQuery({
        queryKey: canLoad ? queryKeys.actions(metahubId!, entityId!) : ['metahub-entity-actions', 'empty'],
        queryFn: () => listEntityActions(metahubId!, entityId!),
        enabled: canLoad,
        staleTime: 30_000
    })

    const bindingsQuery = useQuery({
        queryKey: canLoad ? queryKeys.bindings(metahubId!, entityId!) : ['metahub-entity-event-bindings', 'empty'],
        queryFn: () => listEntityEventBindings(metahubId!, entityId!),
        enabled: canLoad,
        staleTime: 30_000
    })

    const scriptsQuery = useQuery({
        queryKey: canLoad ? queryKeys.scripts(metahubId!, attachedToKind, entityId!) : ['metahub-entity-automation-scripts', 'empty'],
        queryFn: () => scriptsApi.list(metahubId!, { attachedToKind, attachedToId: entityId! }),
        enabled: canLoad,
        staleTime: 30_000
    })

    const actions = actionsQuery.data ?? []
    const bindings = bindingsQuery.data ?? []
    const scripts = scriptsQuery.data ?? []
    const selectedBinding = useMemo(
        () => bindings.find((binding) => binding.id === selectedBindingId) ?? null,
        [bindings, selectedBindingId]
    )
    const scriptNameById = useMemo(() => new Map(scripts.map((script) => [script.id, buildScriptLabel(script)])), [scripts])
    const actionLabelById = useMemo(
        () =>
            new Map(
                actions.map((action) => {
                    const baseLabel = buildActionLabel(action)
                    const scriptSuffix = action.actionType === 'script' ? scriptNameById.get(action.scriptId ?? '') : null
                    return [action.id, scriptSuffix ? `${baseLabel} · ${scriptSuffix}` : baseLabel]
                })
            ),
        [actions, scriptNameById]
    )

    useEffect(() => {
        if (!selectedBindingId) {
            return
        }

        if (!selectedBinding) {
            setSelectedBindingId(null)
            setDraft(createEventBindingDraft())
            return
        }

        setDraft(createEventBindingDraft(selectedBinding))
    }, [selectedBinding, selectedBindingId])

    const createMutation = useMutation({
        mutationFn: async (nextDraft: EventBindingDraft) => {
            if (!metahubId || !entityId) {
                throw new Error(t('entities.instances.automation.events.saveFirst', 'Save this entity first to manage event bindings.'))
            }

            return createEntityEventBinding(metahubId, entityId, {
                eventName: nextDraft.eventName,
                actionId: nextDraft.actionId,
                priority: parseOptionalInteger(nextDraft.priority, t('entities.instances.automation.events.fields.priority', 'Priority')),
                isActive: nextDraft.isActive,
                config: parseJsonRecord(nextDraft.configText, t('entities.instances.automation.events.fields.config', 'Binding config'))
            })
        }
    })

    const updateMutation = useMutation({
        mutationFn: async (nextDraft: EventBindingDraft) => {
            if (!metahubId || !nextDraft.id) {
                throw new Error(t('entities.instances.automation.events.saveFirst', 'Save this entity first to manage event bindings.'))
            }

            return updateEntityEventBinding(metahubId, nextDraft.id, {
                eventName: nextDraft.eventName,
                actionId: nextDraft.actionId,
                priority: parseOptionalInteger(nextDraft.priority, t('entities.instances.automation.events.fields.priority', 'Priority')),
                isActive: nextDraft.isActive,
                config: parseJsonRecord(nextDraft.configText, t('entities.instances.automation.events.fields.config', 'Binding config')),
                expectedVersion: nextDraft.version
            })
        }
    })

    const deleteMutation = useMutation({
        mutationFn: async (bindingId: string) => {
            if (!metahubId) {
                throw new Error(t('entities.instances.automation.events.saveFirst', 'Save this entity first to manage event bindings.'))
            }

            await deleteEntityEventBinding(metahubId, bindingId)
        }
    })

    const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending

    const refreshBindings = async () => {
        if (!metahubId || !entityId) {
            return
        }

        await queryClient.invalidateQueries({ queryKey: queryKeys.bindings(metahubId, entityId) })
        await queryClient.invalidateQueries({ queryKey: queryKeys.actions(metahubId, entityId) })
    }

    const handleNew = () => {
        setSelectedBindingId(null)
        setDraft(createEventBindingDraft())
        setFormError(null)
    }

    const handleSave = async () => {
        setFormError(null)

        if (draft.eventName.trim().length === 0) {
            setFormError(t('entities.instances.automation.events.validation.eventRequired', 'Select an event name.'))
            return
        }

        if (draft.actionId.trim().length === 0) {
            setFormError(t('entities.instances.automation.events.validation.actionRequired', 'Select an action to bind.'))
            return
        }

        try {
            const saved = draft.id ? await updateMutation.mutateAsync(draft) : await createMutation.mutateAsync(draft)
            await refreshBindings()
            setSelectedBindingId(saved.id)
            setDraft(createEventBindingDraft(saved))
            enqueueSnackbar(
                draft.id
                    ? t('entities.instances.automation.events.updateSuccess', 'Event binding updated')
                    : t('entities.instances.automation.events.createSuccess', 'Event binding created'),
                { variant: 'success' }
            )
        } catch (error) {
            setFormError(
                resolveErrorMessage(
                    error,
                    draft.id
                        ? t('entities.instances.automation.events.updateError', 'Failed to update event binding')
                        : t('entities.instances.automation.events.createError', 'Failed to create event binding')
                )
            )
        }
    }

    const handleDelete = async () => {
        if (!draft.id) {
            return
        }

        setFormError(null)

        try {
            await deleteMutation.mutateAsync(draft.id)
            await refreshBindings()
            handleNew()
            enqueueSnackbar(t('entities.instances.automation.events.deleteSuccess', 'Event binding deleted'), { variant: 'success' })
        } catch (error) {
            setFormError(
                resolveErrorMessage(error, t('entities.instances.automation.events.deleteError', 'Failed to delete event binding'))
            )
        }
    }

    if (!canLoad) {
        return (
            <Alert severity='info'>
                {t('entities.instances.automation.events.saveFirst', 'Save this entity first to manage event bindings.')}
            </Alert>
        )
    }

    return (
        <Stack spacing={2}>
            <Alert severity='info'>
                {t(
                    'entities.instances.automation.events.description',
                    'Event bindings connect lifecycle events to configured actions. Use priorities to control execution order when multiple bindings target the same event.'
                )}
            </Alert>

            {bindingsQuery.error ? (
                <Alert severity='error'>
                    {resolveErrorMessage(
                        bindingsQuery.error,
                        t('entities.instances.automation.events.loadError', 'Failed to load event bindings')
                    )}
                </Alert>
            ) : null}

            <Box sx={panelSx}>
                <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={1} sx={{ mb: 1.5 }}>
                    <Typography variant='subtitle2'>
                        {t('entities.instances.automation.events.listTitle', 'Configured event bindings')}
                    </Typography>
                    <Button size='small' onClick={handleNew} disabled={isSaving}>
                        {t('entities.instances.automation.events.newBinding', 'New binding')}
                    </Button>
                </Stack>
                <Divider sx={{ mb: 1.5 }} />
                <List dense disablePadding sx={{ maxHeight: 240, overflowY: 'auto' }}>
                    {bindings.map((binding) => (
                        <ListItemButton
                            key={binding.id}
                            selected={binding.id === selectedBindingId}
                            onClick={() => setSelectedBindingId(binding.id)}
                        >
                            <ListItemText
                                primary={`${binding.eventName} → ${actionLabelById.get(binding.actionId) ?? binding.actionId}`}
                                secondary={
                                    binding.isActive
                                        ? `${t('entities.instances.automation.events.active', 'Active')} · ${t(
                                              'entities.instances.automation.events.priority',
                                              'Priority'
                                          )} ${binding.priority}`
                                        : `${t('entities.instances.automation.events.inactive', 'Inactive')} · ${t(
                                              'entities.instances.automation.events.priority',
                                              'Priority'
                                          )} ${binding.priority}`
                                }
                            />
                            {binding.isActive ? (
                                <Chip size='small' label={t('entities.instances.automation.events.active', 'Active')} />
                            ) : null}
                        </ListItemButton>
                    ))}
                    {bindingsQuery.isLoading ? (
                        <Box sx={{ px: 1, py: 2 }}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('entities.instances.automation.events.loading', 'Loading event bindings...')}
                            </Typography>
                        </Box>
                    ) : null}
                    {!bindingsQuery.isLoading && bindings.length === 0 ? (
                        <Box sx={{ px: 1, py: 2 }}>
                            <Typography variant='body2' color='text.secondary'>
                                {t('entities.instances.automation.events.empty', 'No event bindings configured yet.')}
                            </Typography>
                        </Box>
                    ) : null}
                </List>
            </Box>

            <Box sx={panelSx}>
                <Stack spacing={2}>
                    <Typography variant='subtitle2'>
                        {draft.id
                            ? t('entities.instances.automation.events.editTitle', 'Edit event binding')
                            : t('entities.instances.automation.events.createTitle', 'Create event binding')}
                    </Typography>

                    {actions.length === 0 && !actionsQuery.isLoading ? (
                        <Alert severity='warning'>
                            {t(
                                'entities.instances.automation.events.noActionsAvailable',
                                'No actions are available yet. Create an action in the Actions tab before binding lifecycle events.'
                            )}
                        </Alert>
                    ) : null}

                    {formError ? <Alert severity='error'>{formError}</Alert> : null}

                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                        <FormControl size='small' fullWidth>
                            <InputLabel>{t('entities.instances.automation.events.fields.eventName', 'Event name')}</InputLabel>
                            <Select
                                label={t('entities.instances.automation.events.fields.eventName', 'Event name')}
                                value={draft.eventName}
                                onChange={(event) => setDraft((prev) => ({ ...prev, eventName: String(event.target.value) }))}
                                disabled={isSaving}
                            >
                                {EVENT_NAME_OPTIONS.map((eventName) => (
                                    <MenuItem key={eventName} value={eventName}>
                                        {eventName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl size='small' fullWidth>
                            <InputLabel>{t('entities.instances.automation.events.fields.action', 'Linked action')}</InputLabel>
                            <Select
                                label={t('entities.instances.automation.events.fields.action', 'Linked action')}
                                value={draft.actionId}
                                onChange={(event) => setDraft((prev) => ({ ...prev, actionId: String(event.target.value) }))}
                                disabled={isSaving || actions.length === 0}
                            >
                                <MenuItem value=''>
                                    {t('entities.instances.automation.events.fields.actionPlaceholder', 'Select an action')}
                                </MenuItem>
                                {actions.map((action) => (
                                    <MenuItem key={action.id} value={action.id}>
                                        {actionLabelById.get(action.id) ?? action.id}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            label={t('entities.instances.automation.events.fields.priority', 'Priority')}
                            type='number'
                            value={draft.priority}
                            onChange={(event) => setDraft((prev) => ({ ...prev, priority: event.target.value }))}
                            disabled={isSaving}
                            size='small'
                            sx={{ width: { xs: '100%', md: 180 } }}
                        />
                    </Stack>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={draft.isActive}
                                onChange={(event) => setDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
                                disabled={isSaving}
                            />
                        }
                        label={t('entities.instances.automation.events.fields.isActive', 'Binding is active')}
                    />

                    <TextField
                        label={t('entities.instances.automation.events.fields.config', 'Binding config (JSON)')}
                        value={draft.configText}
                        onChange={(event) => setDraft((prev) => ({ ...prev, configText: event.target.value }))}
                        disabled={isSaving}
                        size='small'
                        multiline
                        minRows={6}
                        fullWidth
                    />

                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                        {draft.id ? (
                            <Button color='error' onClick={handleDelete} disabled={isSaving}>
                                {t('entities.instances.automation.events.deleteBinding', 'Delete binding')}
                            </Button>
                        ) : null}
                        <Button variant='contained' onClick={handleSave} disabled={isSaving || actions.length === 0}>
                            {draft.id
                                ? t('entities.instances.automation.events.updateBinding', 'Update binding')
                                : t('entities.instances.automation.events.createBinding', 'Create binding')}
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </Stack>
    )
}

export const createEntityActionsTab = (params: {
    t: TranslationFn
    metahubId: string | null | undefined
    entityId: string | null
    attachedToKind: ScriptAttachmentKind
}): TabConfig => ({
    id: 'actions',
    label: params.t('entities.instances.tabs.actions', 'Actions'),
    content: (
        <EntityActionsTab t={params.t} metahubId={params.metahubId} entityId={params.entityId} attachedToKind={params.attachedToKind} />
    )
})

export const createEntityEventsTab = (params: {
    t: TranslationFn
    metahubId: string | null | undefined
    entityId: string | null
    attachedToKind: ScriptAttachmentKind
}): TabConfig => ({
    id: 'events',
    label: params.t('entities.instances.tabs.events', 'Events'),
    content: (
        <EntityEventBindingsTab
            t={params.t}
            metahubId={params.metahubId}
            entityId={params.entityId}
            attachedToKind={params.attachedToKind}
        />
    )
})
