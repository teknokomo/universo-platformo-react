import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    FormControlLabel,
    Stack,
    Switch,
    TextField,
    Typography
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PublishRoundedIcon from '@mui/icons-material/PublishRounded'
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded'
import type { PlayCanvasProjectSummary, ProjectBindingInstanceConfig } from '@universo-react/types'
import { createLocalizedContent } from '@universo-react/utils'
import { APIEmptySVG, EmptyListState, StandardDialog, ConfirmDeleteDialog } from '@universo-react/template-mui'

import { invalidateEntitiesQueries, metahubsQueryKeys } from '../../shared'
import { getLocalizedContentText, normalizeLocale } from '../../../utils/localizedInput'
import { openPlayCanvasEditor, playcanvasProjectsApi, resolveEditorDisplayMode, usePlayCanvasEditorHostQuery } from '../../packages/api'
import { listEntityInstances, updateEntityInstance, type MetahubEntityInstance } from '../api/entityInstances'
import { useEntityInstanceQuery } from '../hooks/queries'

type ProjectBinding = NonNullable<ProjectBindingInstanceConfig['projectBinding']>

const readLocalizedContentCandidates = (value: unknown, locale: string): string[] => {
    if (typeof value === 'string') return [value]
    if (!value || typeof value !== 'object') return []
    const record = value as { _primary?: string; locales?: Record<string, { content?: unknown }> }
    const locales = record.locales ?? {}
    return [locale, record._primary, 'en', ...Object.keys(locales)]
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .map((item) => locales[item]?.content)
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
}

const localizedContentMatches = (value: unknown, expected: string | null | undefined, locale: string): boolean =>
    typeof expected === 'string' && readLocalizedContentCandidates(value, locale).includes(expected)

const readBinding = (instance: MetahubEntityInstance | undefined): ProjectBinding | null => {
    const config = instance?.config
    if (!config || typeof config !== 'object') return null
    const binding = (config as ProjectBindingInstanceConfig).projectBinding
    if (!binding || typeof binding !== 'object') return null
    if (typeof binding.provider !== 'string' || typeof binding.projectCodename !== 'string') return null
    return binding
}

const instanceCodename = (instance: MetahubEntityInstance | undefined, locale: string): string => {
    const codename = instance?.codename
    if (typeof codename === 'string') return codename
    if (codename && typeof codename === 'object') {
        return getLocalizedContentText(codename, locale, '')
    }
    return ''
}

export interface ProjectBindingSurfaceProps {
    /** Metahub of the bound instance. */
    metahubId?: string
    /** Entity-instance whose `config.projectBinding` this surface manages. */
    entityId?: string
}

/**
 * Chrome-less surface that owns the PlayCanvas project binding for a
 * `project`-kind entity instance: read state, create-and-bind, unbind, publish,
 * open the editor. Rendered only as the "PlayCanvas" tab of the entity form
 * dialog (the dialog passes `metahubId`/`entityId` explicitly because the
 * dialog route is the instances list and has no `:entityId` param). There is no
 * standalone page route anymore.
 */
export function ProjectBindingSurface({ metahubId, entityId }: ProjectBindingSurfaceProps) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const locale = normalizeLocale(i18n.language)
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const [unbindOpen, setUnbindOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [nameDraft, setNameDraft] = useState('')
    const [createSubmitted, setCreateSubmitted] = useState(false)
    const [bindExistingOpen, setBindExistingOpen] = useState(false)
    const [bindExistingSelection, setBindExistingSelection] = useState<PlayCanvasProjectSummary | null>(null)
    const [bindExistingUnboundOnly, setBindExistingUnboundOnly] = useState(true)

    // Canonical entity-detail cache key (shared with the list/edit surfaces) so a
    // binding write here invalidates the same cache the rest of the entity UI reads.
    const instanceQuery = useEntityInstanceQuery(metahubId, entityId)

    const binding = readBinding(instanceQuery.data)

    const projectsQuery = useQuery({
        queryKey: metahubsQueryKeys.playcanvasProjects(metahubId ?? ''),
        queryFn: () => playcanvasProjectsApi.list(metahubId as string),
        enabled: Boolean(metahubId)
    })

    // Read the PlayCanvas Editor package's display-mode so "Open editor" honors
    // the user's package settings: `openSeparately` opens a popup on the
    // /fullscreen route, while every other mode keeps the editor inline.
    const editorHostQuery = usePlayCanvasEditorHostQuery(metahubId)
    const editorDisplayMode = resolveEditorDisplayMode(editorHostQuery.data)

    const boundProject = useMemo<PlayCanvasProjectSummary | null>(() => {
        if (!binding) return null
        const projects = projectsQuery.data ?? []
        return (
            projects.find((project) => localizedContentMatches(project.codename, binding.projectCodename, locale)) ??
            projects.find((project) => project.id === binding.projectId) ??
            null
        )
    }, [binding, projectsQuery.data, locale])

    const projectKind = instanceQuery.data?.kind

    // All "Projects" instances in this metahub, used to compute which PlayCanvas
    // projects are already bound (so the "Bind existing" picker can filter to
    // unbound ones). Loaded only when the picker is open.
    const projectInstancesQuery = useQuery({
        queryKey: [...metahubsQueryKeys.playcanvasProjects(metahubId ?? ''), 'instance-bindings', projectKind ?? ''],
        queryFn: () => listEntityInstances(metahubId as string, { kind: projectKind as string, limit: 1000, offset: 0 }),
        enabled: Boolean(metahubId && projectKind && bindExistingOpen)
    })

    const boundProjectCodenames = useMemo<Set<string>>(() => {
        const codenames = new Set<string>()
        for (const instance of projectInstancesQuery.data?.items ?? []) {
            // Exclude THIS instance — re-binding it should not hide its own target.
            if (instance.id === entityId) continue
            const otherBinding = readBinding(instance)
            if (otherBinding?.projectCodename) codenames.add(otherBinding.projectCodename)
        }
        return codenames
    }, [projectInstancesQuery.data, entityId])

    const bindableProjects = useMemo<PlayCanvasProjectSummary[]>(() => {
        const projects = projectsQuery.data ?? []
        if (!bindExistingUnboundOnly) return projects
        return projects.filter((project) => !boundProjectCodenames.has(getLocalizedContentText(project.codename, locale, '')))
    }, [projectsQuery.data, bindExistingUnboundOnly, boundProjectCodenames, locale])

    const invalidateInstance = async () => {
        if (!metahubId || !entityId) return
        // Mirror the canonical entity-update invalidation (hooks/mutations.ts): refresh
        // the kind's whole entities cache (every list variant) plus the entity-detail
        // cache, so the row's "Open editor" shortcut and bound state reflect the new
        // binding without a full page refresh. The kind comes from the loaded instance.
        const kind = instanceQuery.data?.kind
        if (kind) {
            await invalidateEntitiesQueries.all(queryClient, metahubId, kind)
        }
        await invalidateEntitiesQueries.detail(queryClient, metahubId, entityId)
    }
    const invalidateProjects = async () => {
        await queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.playcanvasProjects(metahubId ?? '') })
    }

    const writeBinding = async (nextBinding: ProjectBinding | null) => {
        const current = instanceQuery.data
        const config = { ...(current?.config ?? {}) } as Record<string, unknown>
        // The PATCH endpoint shallow-merges `config`, so an absent key means
        // "leave unchanged", not "remove". To unbind we must send an explicit
        // `null` — the documented clear signal (validateProjectBindingConfigForEntity)
        // — otherwise the server keeps the previous binding and the unbind no-ops.
        config.projectBinding = nextBinding ?? null
        await updateEntityInstance(metahubId as string, entityId as string, {
            config,
            expectedVersion: current?.version
        })
    }

    const createAndBindMutation = useMutation({
        mutationFn: async () => {
            const project = await playcanvasProjectsApi.create(metahubId as string, {
                displayName: createLocalizedContent(locale, nameDraft.trim()),
                description: null
            })
            // If the follow-up writeBinding fails, we MUST clean up the just-created
            // project, otherwise it becomes an orphan (binding card never appears
            // and the cascade on instance delete has no chance to clean it up).
            try {
                await writeBinding({
                    provider: 'playcanvasEditor',
                    projectCodename: getLocalizedContentText(project.codename, locale, project.id),
                    projectId: project.id
                })
            } catch (writeError) {
                try {
                    await playcanvasProjectsApi.remove(metahubId as string, project.id, project.version)
                } catch (cleanupError) {
                    console.error('Failed to roll back orphan PlayCanvas project after writeBinding error', {
                        projectId: project.id,
                        writeError,
                        cleanupError
                    })
                }
                throw writeError
            }
            return project
        },
        onSuccess: async () => {
            enqueueSnackbar(t('projects.binding.notifications.created', 'PlayCanvas project created and bound'), { variant: 'success' })
            setCreateOpen(false)
            setNameDraft('')
            setCreateSubmitted(false)
            await Promise.all([invalidateInstance(), invalidateProjects()])
        },
        onError: () => {
            enqueueSnackbar(t('projects.binding.notifications.createFailed', 'Failed to create and bind the PlayCanvas project'), {
                variant: 'error'
            })
        }
    })

    const bindExistingMutation = useMutation({
        mutationFn: async (project: PlayCanvasProjectSummary) => {
            await writeBinding({
                provider: 'playcanvasEditor',
                projectCodename: getLocalizedContentText(project.codename, locale, project.id),
                projectId: project.id
            })
        },
        onSuccess: async () => {
            enqueueSnackbar(t('projects.binding.notifications.boundExisting', 'PlayCanvas project bound'), { variant: 'success' })
            setBindExistingOpen(false)
            setBindExistingSelection(null)
            await Promise.all([invalidateInstance(), invalidateProjects()])
        },
        onError: () => {
            enqueueSnackbar(t('projects.binding.notifications.bindFailed', 'Failed to bind the PlayCanvas project'), { variant: 'error' })
        }
    })

    const publishMutation = useMutation({
        mutationFn: () => playcanvasProjectsApi.publish(metahubId as string, boundProject!.id),
        onSuccess: async (items) => {
            enqueueSnackbar(
                t('projects.binding.notifications.published', 'Runtime published with {{count}} scene(s)', { count: items.length }),
                { variant: 'success' }
            )
            await Promise.all([
                invalidateProjects(),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.playcanvasPublishedRuntimeManifests(metahubId ?? '') })
            ])
        },
        onError: () => {
            enqueueSnackbar(t('projects.binding.notifications.publishFailed', 'Failed to publish the runtime'), { variant: 'error' })
        }
    })

    const unbindMutation = useMutation({
        mutationFn: () => writeBinding(null),
        onSuccess: async () => {
            enqueueSnackbar(t('projects.binding.notifications.unbound', 'PlayCanvas project unbound'), { variant: 'success' })
            setUnbindOpen(false)
            await invalidateInstance()
        },
        onError: () => {
            enqueueSnackbar(t('projects.binding.notifications.unbindFailed', 'Failed to unbind the PlayCanvas project'), {
                variant: 'error'
            })
        }
    })

    const openEditor = () => {
        if (!metahubId) return
        openPlayCanvasEditor({ metahubId, projectId: boundProject?.id, displayMode: editorDisplayMode })
    }

    const statusLabel = (project: PlayCanvasProjectSummary): string => {
        if (project.compatibilityStatus !== 'compatible') {
            return t(`projects.binding.compatibility.${project.compatibilityStatus}`, 'Compatibility issue')
        }
        return project.publishable
            ? t('projects.binding.status.ready', 'Ready')
            : t('projects.binding.status.needsAttention', 'Needs attention')
    }

    const statusColor = (project: PlayCanvasProjectSummary): 'success' | 'warning' | 'error' => {
        if (project.compatibilityStatus === 'blocked' || project.compatibilityStatus === 'unsupported') return 'error'
        if (project.compatibilityStatus === 'needsMigration') return 'warning'
        return project.publishable ? 'success' : 'warning'
    }

    const openCreateDialog = () => {
        setNameDraft(instanceCodename(instanceQuery.data, locale))
        setCreateSubmitted(false)
        setCreateOpen(true)
    }

    const openBindExistingDialog = () => {
        setBindExistingSelection(null)
        setBindExistingUnboundOnly(true)
        setBindExistingOpen(true)
    }

    const body = (
        <>
            {binding && boundProject ? (
                <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent='space-between' gap={1.5}>
                        <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                            <Stack direction='row' spacing={1} flexWrap='wrap' alignItems='center'>
                                <Typography variant='subtitle1' sx={{ overflowWrap: 'anywhere' }}>
                                    {getLocalizedContentText(
                                        boundProject.displayName,
                                        locale,
                                        t('projects.binding.unnamedProject', 'Unnamed project')
                                    )}
                                </Typography>
                                <Chip size='small' color={statusColor(boundProject)} label={statusLabel(boundProject)} />
                            </Stack>
                            <Typography variant='body2' color='text.secondary'>
                                {t(
                                    'projects.binding.counts',
                                    '{{scenes}} scenes, {{assets}} assets, {{scripts}} scripts, {{artifacts}} generated artifacts',
                                    {
                                        scenes: boundProject.sceneCount,
                                        assets: boundProject.assetCount,
                                        scripts: boundProject.scriptCount,
                                        artifacts: boundProject.generatedArtifactCount
                                    }
                                )}
                            </Typography>
                        </Stack>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                            <Button
                                size='small'
                                variant='outlined'
                                startIcon={<OpenInNewRoundedIcon fontSize='small' />}
                                onClick={openEditor}
                            >
                                {t('projects.binding.actions.openEditor', 'Open editor')}
                            </Button>
                            <Button
                                size='small'
                                variant='outlined'
                                startIcon={<PublishRoundedIcon fontSize='small' />}
                                disabled={!boundProject.publishable || publishMutation.isPending}
                                onClick={() => publishMutation.mutate()}
                            >
                                {t('projects.binding.actions.publish', 'Publish runtime')}
                            </Button>
                            <Button
                                size='small'
                                color='warning'
                                startIcon={<LinkOffRoundedIcon fontSize='small' />}
                                disabled={unbindMutation.isPending}
                                onClick={() => setUnbindOpen(true)}
                            >
                                {t('projects.binding.actions.unbind', 'Unbind')}
                            </Button>
                        </Stack>
                    </Stack>
                </Box>
            ) : binding && !boundProject ? (
                <Stack spacing={2}>
                    <Alert severity='warning'>
                        {t('projects.binding.missingProject', 'The bound PlayCanvas project is no longer available.')}
                    </Alert>
                    <Box>
                        <Button
                            color='warning'
                            startIcon={<LinkOffRoundedIcon fontSize='small' />}
                            disabled={unbindMutation.isPending}
                            onClick={() => setUnbindOpen(true)}
                        >
                            {t('projects.binding.actions.unbind', 'Unbind')}
                        </Button>
                    </Box>
                </Stack>
            ) : (
                <Stack alignItems='center' spacing={1}>
                    <EmptyListState
                        image={APIEmptySVG}
                        imageAlt={t('projects.binding.empty.imageAlt', 'No bound PlayCanvas project')}
                        title={t('projects.binding.empty.title', 'No PlayCanvas project bound yet')}
                        description={t(
                            'projects.binding.empty.description',
                            'Create and bind a PlayCanvas project to author its 3D scene in the editor.'
                        )}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <Button variant='contained' startIcon={<AddRoundedIcon />} onClick={openCreateDialog}>
                            {t('projects.binding.actions.createAndBind', 'Create & bind project')}
                        </Button>
                        <Button variant='outlined' startIcon={<LinkRoundedIcon />} onClick={openBindExistingDialog}>
                            {t('projects.binding.actions.bindExisting', 'Bind existing project')}
                        </Button>
                    </Stack>
                </Stack>
            )}

            <StandardDialog
                open={createOpen}
                onClose={() => !createAndBindMutation.isPending && setCreateOpen(false)}
                maxWidth='sm'
                fullWidth
                title={t('projects.binding.dialogs.create.title', 'Create & bind PlayCanvas project')}
                disablePresentationControls
                actions={
                    <>
                        <Button onClick={() => setCreateOpen(false)} disabled={createAndBindMutation.isPending}>
                            {t('common:actions.cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant='contained'
                            disabled={createAndBindMutation.isPending}
                            onClick={() => {
                                setCreateSubmitted(true)
                                if (nameDraft.trim().length === 0) return
                                createAndBindMutation.mutate()
                            }}
                        >
                            {t('common:actions.create', 'Create')}
                        </Button>
                    </>
                }
            >
                {/* pt: 1.5 leaves room for the outlined TextField's floating label,
                    which sits ~9px above the input and was clipped by the dialog
                    content's top edge with the previous pt: 0.5. */}
                <Stack spacing={2} sx={{ pt: 1.5 }}>
                    <TextField
                        label={t('projects.binding.fields.name', 'Project name')}
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        fullWidth
                        required
                        error={createSubmitted && nameDraft.trim().length === 0}
                        helperText={
                            createSubmitted && nameDraft.trim().length === 0
                                ? t('projects.binding.validation.nameRequired', 'Enter a project name.')
                                : t('projects.binding.fields.nameHelper', 'Shown for the bound PlayCanvas project.')
                        }
                    />
                </Stack>
            </StandardDialog>

            <StandardDialog
                open={bindExistingOpen}
                onClose={() => !bindExistingMutation.isPending && setBindExistingOpen(false)}
                maxWidth='sm'
                fullWidth
                title={t('projects.binding.dialogs.bindExisting.title', 'Bind existing PlayCanvas project')}
                disablePresentationControls
                actions={
                    <>
                        <Button onClick={() => setBindExistingOpen(false)} disabled={bindExistingMutation.isPending}>
                            {t('common:actions.cancel', 'Cancel')}
                        </Button>
                        <Button
                            variant='contained'
                            disabled={!bindExistingSelection || bindExistingMutation.isPending}
                            onClick={() => bindExistingSelection && bindExistingMutation.mutate(bindExistingSelection)}
                        >
                            {t('projects.binding.actions.bind', 'Bind')}
                        </Button>
                    </>
                }
            >
                <Stack spacing={2} sx={{ pt: 1.5 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={bindExistingUnboundOnly}
                                onChange={(event) => {
                                    setBindExistingUnboundOnly(event.target.checked)
                                    setBindExistingSelection(null)
                                }}
                            />
                        }
                        label={t('projects.binding.dialogs.bindExisting.filterUnbound', 'Show only unbound projects')}
                    />
                    <Autocomplete<PlayCanvasProjectSummary>
                        options={bindableProjects}
                        value={bindExistingSelection}
                        loading={projectsQuery.isLoading || projectInstancesQuery.isLoading}
                        onChange={(_event, value) => setBindExistingSelection(value)}
                        getOptionLabel={(option) =>
                            getLocalizedContentText(option.displayName, locale, t('projects.binding.unnamedProject', 'Unnamed project'))
                        }
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        noOptionsText={t('projects.binding.dialogs.bindExisting.empty', 'No projects available')}
                        renderOption={(props, option) => {
                            const isBound = boundProjectCodenames.has(getLocalizedContentText(option.codename, locale, ''))
                            return (
                                <Box component='li' {...props} key={option.id}>
                                    <Stack spacing={0.25} sx={{ minWidth: 0, width: '100%' }}>
                                        <Stack direction='row' spacing={1} alignItems='center' flexWrap='wrap'>
                                            <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                                                {getLocalizedContentText(
                                                    option.displayName,
                                                    locale,
                                                    t('projects.binding.unnamedProject', 'Unnamed project')
                                                )}
                                            </Typography>
                                            <Chip size='small' color={statusColor(option)} label={statusLabel(option)} />
                                            {isBound ? (
                                                <Chip
                                                    size='small'
                                                    variant='outlined'
                                                    color='warning'
                                                    label={t('projects.binding.dialogs.bindExisting.alreadyBound', 'Already bound')}
                                                />
                                            ) : null}
                                        </Stack>
                                        <Typography variant='caption' color='text.secondary'>
                                            {getLocalizedContentText(option.codename, locale, option.id)}
                                        </Typography>
                                    </Stack>
                                </Box>
                            )
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={t('projects.binding.dialogs.bindExisting.field', 'PlayCanvas project')}
                                helperText={t(
                                    'projects.binding.dialogs.bindExisting.helper',
                                    'Bind an already-created PlayCanvas project. Projects already bound elsewhere can be shared.'
                                )}
                            />
                        )}
                    />
                </Stack>
            </StandardDialog>

            <ConfirmDeleteDialog
                open={unbindOpen}
                title={t('projects.binding.dialogs.unbind.title', 'Unbind PlayCanvas project')}
                description={t(
                    'projects.binding.dialogs.unbind.description',
                    'Remove the link between this entity and its PlayCanvas project. The project itself is not deleted.'
                )}
                confirmButtonText={t('projects.binding.actions.unbind', 'Unbind')}
                deletingButtonText={t('projects.binding.dialogs.unbind.unbinding', 'Unbinding...')}
                cancelButtonText={t('common:actions.cancel', 'Cancel')}
                loading={unbindMutation.isPending}
                onCancel={() => setUnbindOpen(false)}
                onConfirm={async () => {
                    await unbindMutation.mutateAsync()
                }}
            />
        </>
    )

    // The loading/error guards run before any mutation action renders so the tab
    // never exposes Create / Unbind against not-yet-loaded data (which would write
    // `config` from an empty object or clear a still-loading valid binding).
    const wrap = (content: JSX.Element): JSX.Element => <Box data-testid='project-binding-surface'>{content}</Box>

    if (instanceQuery.isLoading || projectsQuery.isLoading) {
        return wrap(
            <Stack direction='row' spacing={1} alignItems='center' sx={{ py: 3 }}>
                <CircularProgress size={18} />
                <Typography variant='body2' color='text.secondary'>
                    {t('projects.binding.loading', 'Loading PlayCanvas project binding...')}
                </Typography>
            </Stack>
        )
    }

    if (instanceQuery.isError) {
        return wrap(<Alert severity='error'>{t('projects.binding.loadError', 'Failed to load the project binding.')}</Alert>)
    }

    return wrap(body)
}
