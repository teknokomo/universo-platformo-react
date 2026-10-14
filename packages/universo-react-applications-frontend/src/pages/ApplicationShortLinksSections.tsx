import { useMemo, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded'
import {
    Box,
    Button,
    Chip,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
    globalShortLinkSlugSchema,
    type GlobalShortLinkApplicationSection,
    type GlobalShortLinkCreateInput,
    type GlobalShortLinkQuizAccessOption,
    type GlobalShortLinkResourceOption,
    type GlobalShortLinkRecord,
    type GlobalShortLinkTarget
} from '@universo-react/types'
import { FlowListTable, type TableColumn } from '@universo-react/template-mui'
import {
    createGlobalShortLink,
    buildPublicGuestAccessUrl,
    getGlobalShortLinkErrorCode,
    listGlobalShortLinkQuizAccessOptions,
    listGlobalShortLinkResourceOptions
} from '../api/globalShortLinksApi'
import { globalShortLinksQueryKeys } from '../api/globalShortLinksQueryKeys'

type TargetKind = GlobalShortLinkTarget['kind']
export type ShortLinkFeedback = { severity: 'success' | 'error'; message: string }

const resourceOptionKey = (option: Pick<GlobalShortLinkResourceOption, 'targetKind' | 'entityTypeCodename'>) =>
    `${option.targetKind}:${option.entityTypeCodename}`
const quizAccessOptionKey = (option: Pick<GlobalShortLinkQuizAccessOption, 'id'>) => option.id

export const getGlobalShortLinkErrorTranslationKey = (error: unknown): string => {
    switch (getGlobalShortLinkErrorCode(error)) {
        case 'GLOBAL_SHORT_LINK_SLUG_CONFLICT':
            return 'shortLinks.errors.conflict'
        case 'GLOBAL_SHORT_LINK_FORMAT':
            return 'shortLinks.errors.format'
        case 'GLOBAL_SHORT_LINK_RESERVED':
            return 'shortLinks.errors.reserved'
        case 'GLOBAL_SHORT_LINK_UUID':
            return 'shortLinks.errors.uuid'
        case 'GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE':
        case 'GLOBAL_SHORT_LINK_TARGET_UNSUPPORTED':
            return 'shortLinks.errors.targetUnavailable'
        default:
            return 'shortLinks.errors.save'
    }
}

const buildGlobalShortLinkTarget = (input: {
    targetKind: TargetKind
    applicationId: string
    section: GlobalShortLinkApplicationSection
    selectedQuizAccessOption?: GlobalShortLinkQuizAccessOption
    selectedResourceOption?: GlobalShortLinkResourceOption
    workspacesEnabled: boolean
}): GlobalShortLinkTarget => {
    if (input.targetKind === 'application-entry') {
        return { kind: 'application-entry', applicationId: input.applicationId }
    }
    if (input.targetKind === 'application-section') {
        if (input.section === 'workspace' && !input.workspacesEnabled) {
            throw new Error('GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE')
        }
        return { kind: 'application-section', applicationId: input.applicationId, section: input.section }
    }
    if (input.targetKind === 'lms-access-link' && input.selectedQuizAccessOption) {
        return {
            kind: 'lms-access-link',
            applicationId: input.applicationId,
            accessLinkId: input.selectedQuizAccessOption.id,
            accessLinkSlug: input.selectedQuizAccessOption.slug,
            workspaceId: input.selectedQuizAccessOption.workspaceId
        }
    }
    if (input.targetKind === 'application-resource' && input.selectedResourceOption) {
        return {
            kind: 'application-resource',
            applicationId: input.applicationId,
            targetKind: input.selectedResourceOption.targetKind,
            entityTypeCodename: input.selectedResourceOption.entityTypeCodename
        }
    }
    throw new Error('GLOBAL_SHORT_LINK_TARGET_UNAVAILABLE')
}

interface ShortLinkCreatorProps {
    applicationId: string
    canCreate: boolean
    workspacesEnabled: boolean
    onCreated: () => Promise<void>
    onFeedback: (feedback: ShortLinkFeedback | null) => void
}

export const ShortLinkCreator = ({ applicationId, canCreate, workspacesEnabled, onCreated, onFeedback }: ShortLinkCreatorProps) => {
    const { t, i18n } = useTranslation('applications')
    const locale = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('ru') ? 'ru' : 'en'
    const [targetKind, setTargetKind] = useState<TargetKind>('application-entry')
    const [shortSlug, setShortSlug] = useState('')
    const [shortSlugTouched, setShortSlugTouched] = useState(false)
    const [quizAccessOptionKeyValue, setQuizAccessOptionKeyValue] = useState('')
    const [resourceKey, setResourceKey] = useState('')
    const [section, setSection] = useState<GlobalShortLinkApplicationSection>('dashboard')

    const parsedShortSlug = globalShortLinkSlugSchema.safeParse(shortSlug)
    const slugErrorReason =
        shortSlug.trim().length === 0
            ? shortSlugTouched
                ? 'required'
                : null
            : parsedShortSlug.success
            ? null
            : parsedShortSlug.error.issues[0]?.message ?? 'format'
    const slugErrorTranslationKey = slugErrorReason
        ? slugErrorReason === 'required'
            ? 'shortLinks.errors.slugRequired'
            : slugErrorReason === 'reserved'
            ? 'shortLinks.errors.reserved'
            : slugErrorReason === 'uuid'
            ? 'shortLinks.errors.uuid'
            : 'shortLinks.errors.format'
        : null

    const quizAccessOptionsQuery = useQuery({
        queryKey: globalShortLinksQueryKeys.quizAccessOptions({ applicationId, locale }),
        queryFn: () => listGlobalShortLinkQuizAccessOptions({ applicationId, locale }),
        enabled: canCreate && Boolean(applicationId) && targetKind === 'lms-access-link',
        staleTime: 30_000
    })
    const resourceOptionsQuery = useQuery({
        queryKey: globalShortLinksQueryKeys.resourceOptions({ applicationId, locale }),
        queryFn: () => listGlobalShortLinkResourceOptions({ applicationId, locale }),
        enabled: canCreate && Boolean(applicationId) && targetKind === 'application-resource',
        staleTime: 30_000
    })
    const selectedResourceOption = resourceOptionsQuery.data?.find((option) => resourceOptionKey(option) === resourceKey)
    const selectedQuizAccessOption = quizAccessOptionsQuery.data?.find((option) => quizAccessOptionKey(option) === quizAccessOptionKeyValue)

    const createMutation = useMutation({
        mutationFn: (): Promise<GlobalShortLinkRecord> => {
            const normalizedSlug = globalShortLinkSlugSchema.parse(shortSlug)
            const target = buildGlobalShortLinkTarget({
                targetKind,
                applicationId,
                section,
                selectedQuizAccessOption,
                selectedResourceOption,
                workspacesEnabled
            })
            const input: GlobalShortLinkCreateInput = { slug: normalizedSlug, target }
            return createGlobalShortLink(input)
        },
        onSuccess: async () => {
            await onCreated()
            setShortSlug('')
            setShortSlugTouched(false)
            setQuizAccessOptionKeyValue('')
            setResourceKey('')
        },
        onError: (error) => onFeedback({ severity: 'error', message: t(getGlobalShortLinkErrorTranslationKey(error)) })
    })

    if (!canCreate) return null

    return (
        <Box
            component='form'
            onSubmit={(event) => {
                event.preventDefault()
                setShortSlugTouched(true)
                if (!parsedShortSlug.success) return
                onFeedback(null)
                createMutation.mutate()
            }}
            sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 1fr 1fr auto' }, gap: 1.5, alignItems: 'start' }}
        >
            <TextField
                label={t('shortLinks.fields.shortSlug')}
                value={shortSlug}
                onChange={(event) => setShortSlug(event.target.value)}
                onBlur={() => setShortSlugTouched(true)}
                error={Boolean(slugErrorTranslationKey)}
                helperText={slugErrorTranslationKey ? t(slugErrorTranslationKey) : t('shortLinks.fields.shortSlugHelp')}
                fullWidth
                slotProps={{ htmlInput: { maxLength: 63, autoComplete: 'off', 'aria-required': true } }}
            />
            <FormControl fullWidth>
                <InputLabel id='short-link-target-label'>{t('shortLinks.fields.target')}</InputLabel>
                <Select
                    labelId='short-link-target-label'
                    label={t('shortLinks.fields.target')}
                    value={targetKind}
                    onChange={(event) => setTargetKind(event.target.value as TargetKind)}
                >
                    <MenuItem value='lms-access-link'>{t('shortLinks.targets.lms-access-link')}</MenuItem>
                    <MenuItem value='application-entry'>{t('shortLinks.targets.application-entry')}</MenuItem>
                    <MenuItem value='application-section'>{t('shortLinks.targets.application-section')}</MenuItem>
                    <MenuItem value='application-resource'>{t('shortLinks.targets.application-resource')}</MenuItem>
                </Select>
            </FormControl>
            {targetKind === 'lms-access-link' ? (
                <FormControl
                    fullWidth
                    error={quizAccessOptionsQuery.isError || (quizAccessOptionsQuery.isSuccess && !quizAccessOptionsQuery.data.length)}
                >
                    <InputLabel id='short-link-quiz-access-label'>{t('shortLinks.fields.quizAccessLink')}</InputLabel>
                    <Select
                        labelId='short-link-quiz-access-label'
                        label={t('shortLinks.fields.quizAccessLink')}
                        value={quizAccessOptionKeyValue}
                        onChange={(event) => setQuizAccessOptionKeyValue(event.target.value)}
                        disabled={
                            quizAccessOptionsQuery.isLoading || quizAccessOptionsQuery.isError || !quizAccessOptionsQuery.data?.length
                        }
                    >
                        {!quizAccessOptionsQuery.data?.length ? (
                            <MenuItem value='' disabled>
                                {quizAccessOptionsQuery.isLoading
                                    ? t('shortLinks.fields.quizOptionsLoading')
                                    : quizAccessOptionsQuery.isError
                                    ? t('shortLinks.errors.quizOptionsLoad')
                                    : t('shortLinks.fields.quizOptionsEmpty')}
                            </MenuItem>
                        ) : null}
                        {quizAccessOptionsQuery.data?.map((option) => (
                            <MenuItem key={quizAccessOptionKey(option)} value={quizAccessOptionKey(option)}>
                                {option.workspaceLabel
                                    ? t('shortLinks.fields.quizInWorkspace', { quiz: option.label, workspace: option.workspaceLabel })
                                    : option.label}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>
                        {quizAccessOptionsQuery.isError
                            ? t('shortLinks.errors.quizOptionsLoad')
                            : quizAccessOptionsQuery.isSuccess && !quizAccessOptionsQuery.data.length
                            ? t('shortLinks.fields.quizOptionsEmpty')
                            : t('shortLinks.fields.quizAccessHelp')}
                    </FormHelperText>
                </FormControl>
            ) : targetKind === 'application-section' ? (
                <FormControl fullWidth>
                    <InputLabel id='short-link-section-label'>{t('shortLinks.fields.section')}</InputLabel>
                    <Select
                        labelId='short-link-section-label'
                        label={t('shortLinks.fields.section')}
                        value={section}
                        onChange={(event) => setSection(event.target.value as GlobalShortLinkApplicationSection)}
                    >
                        <MenuItem value='dashboard'>{t('shortLinks.sections.dashboard')}</MenuItem>
                        {workspacesEnabled ? <MenuItem value='workspace'>{t('shortLinks.sections.workspace')}</MenuItem> : null}
                    </Select>
                </FormControl>
            ) : targetKind === 'application-resource' ? (
                <FormControl
                    fullWidth
                    error={resourceOptionsQuery.isError || (resourceOptionsQuery.isSuccess && !resourceOptionsQuery.data.length)}
                >
                    <InputLabel id='short-link-resource-label'>{t('shortLinks.fields.applicationResource')}</InputLabel>
                    <Select
                        labelId='short-link-resource-label'
                        label={t('shortLinks.fields.applicationResource')}
                        value={resourceKey}
                        onChange={(event) => setResourceKey(event.target.value)}
                        disabled={resourceOptionsQuery.isLoading || resourceOptionsQuery.isError || !resourceOptionsQuery.data?.length}
                    >
                        {!resourceOptionsQuery.data?.length ? (
                            <MenuItem value='' disabled>
                                {resourceOptionsQuery.isLoading
                                    ? t('shortLinks.fields.resourceOptionsLoading')
                                    : resourceOptionsQuery.isError
                                    ? t('shortLinks.errors.resourceOptionsLoad')
                                    : t('shortLinks.fields.resourceOptionsEmpty')}
                            </MenuItem>
                        ) : null}
                        {resourceOptionsQuery.data?.map((option) => (
                            <MenuItem key={resourceOptionKey(option)} value={resourceOptionKey(option)}>
                                {option.label}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>
                        {resourceOptionsQuery.isError
                            ? t('shortLinks.errors.resourceOptionsLoad')
                            : resourceOptionsQuery.isSuccess && !resourceOptionsQuery.data.length
                            ? t('shortLinks.fields.resourceOptionsEmpty')
                            : t('shortLinks.fields.applicationResourceHelp')}
                    </FormHelperText>
                </FormControl>
            ) : (
                <Typography variant='body2' sx={{ color: 'text.secondary', alignSelf: 'center' }}>
                    {t('shortLinks.fields.applicationEntryHelp')}
                </Typography>
            )}
            <Button
                type='submit'
                variant='contained'
                startIcon={<AddRoundedIcon />}
                disabled={
                    createMutation.isPending ||
                    (targetKind === 'lms-access-link' &&
                        (!selectedQuizAccessOption || quizAccessOptionsQuery.isLoading || quizAccessOptionsQuery.isError)) ||
                    (targetKind === 'application-resource' &&
                        (!selectedResourceOption || resourceOptionsQuery.isLoading || resourceOptionsQuery.isError))
                }
            >
                {t('shortLinks.actions.create')}
            </Button>
        </Box>
    )
}

interface GuestAccessLinksTableProps {
    applicationId: string
    data: GlobalShortLinkQuizAccessOption[]
    onCopy: (option: GlobalShortLinkQuizAccessOption) => void
}

export const GuestAccessLinksTable = ({ applicationId, data, onCopy }: GuestAccessLinksTableProps) => {
    const { t } = useTranslation('applications')
    const columns = useMemo<TableColumn<GlobalShortLinkQuizAccessOption>[]>(
        () => [
            {
                id: 'quiz',
                label: t('shortLinks.guestLinks.quiz'),
                width: '30%',
                render: (option) => (
                    <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                        {option.workspaceLabel
                            ? t('shortLinks.fields.quizInWorkspace', { quiz: option.label, workspace: option.workspaceLabel })
                            : option.label}
                    </Typography>
                )
            },
            {
                id: 'url',
                label: t('shortLinks.guestLinks.url'),
                width: '55%',
                render: (option) => (
                    <Typography component='code' variant='body2' sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                        {buildPublicGuestAccessUrl(applicationId, option.slug)}
                    </Typography>
                )
            },
            {
                id: 'actions',
                label: t('shortLinks.guestLinks.actions'),
                width: '15%',
                align: 'right',
                render: (option) => (
                    <Tooltip title={t('shortLinks.guestLinks.copy')}>
                        <Button size='small' variant='outlined' startIcon={<ContentCopyRoundedIcon />} onClick={() => onCopy(option)}>
                            {t('shortLinks.guestLinks.copy')}
                        </Button>
                    </Tooltip>
                )
            }
        ],
        [applicationId, onCopy, t]
    )

    return (
        <FlowListTable<GlobalShortLinkQuizAccessOption>
            data={data}
            isLoading={false}
            customColumns={columns}
            tableAriaLabel={t('shortLinks.guestLinks.tableAriaLabel')}
        />
    )
}

interface ShortLinksTableProps {
    data: GlobalShortLinkRecord[]
    quizAccessOptions: GlobalShortLinkQuizAccessOption[]
    resourceOptions: GlobalShortLinkResourceOption[]
    canRelease: boolean
    isLoading: boolean
    isReleasing: boolean
    onCopy: (record: GlobalShortLinkRecord) => void
    onRelease: (record: GlobalShortLinkRecord) => void
}

export const ShortLinksTable = ({
    data,
    quizAccessOptions,
    resourceOptions,
    canRelease,
    isLoading,
    isReleasing,
    onCopy,
    onRelease
}: ShortLinksTableProps) => {
    const { t } = useTranslation('applications')
    const columns = useMemo<TableColumn<GlobalShortLinkRecord>[]>(
        () => [
            {
                id: 'link',
                label: t('shortLinks.columns.link'),
                width: '42%',
                render: (record) => (
                    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                        <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                            /l/{record.slug}
                        </Typography>
                        <Typography variant='caption' sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
                            {t(`shortLinks.targets.${record.target.kind}`)}
                        </Typography>
                    </Stack>
                )
            },
            {
                id: 'destination',
                label: t('shortLinks.columns.destination'),
                width: '34%',
                render: (record) => {
                    const target = record.target
                    let label: string
                    if (target.kind === 'lms-access-link') {
                        const option = quizAccessOptions.find((candidate) => candidate.id === target.accessLinkId)
                        label = option
                            ? option.workspaceLabel
                                ? t('shortLinks.fields.quizInWorkspace', { quiz: option.label, workspace: option.workspaceLabel })
                                : option.label
                            : t('shortLinks.targets.quiz', { slug: target.accessLinkSlug })
                    } else if (target.kind === 'application-section') {
                        label = t(`shortLinks.sections.${target.section}`)
                    } else if (target.kind === 'application-resource') {
                        label =
                            resourceOptions.find(
                                (option) =>
                                    option.targetKind === target.targetKind && option.entityTypeCodename === target.entityTypeCodename
                            )?.label ?? t('shortLinks.targets.applicationResourceFallback')
                    } else {
                        label = t('shortLinks.targets.applicationEntry')
                    }

                    return (
                        <Typography variant='body2' sx={{ overflowWrap: 'anywhere' }}>
                            {label}
                        </Typography>
                    )
                }
            },
            {
                id: 'status',
                label: t('shortLinks.columns.status'),
                width: '12%',
                render: (record) => (
                    <Chip
                        size='small'
                        variant='outlined'
                        label={t(record.releasedAt ? 'shortLinks.states.released' : 'shortLinks.states.active')}
                    />
                )
            },
            {
                id: 'actions',
                label: t('shortLinks.columns.actions'),
                width: '12%',
                align: 'right',
                render: (record) => (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        {!record.releasedAt ? (
                            <Tooltip title={t('shortLinks.actions.copy')}>
                                <Button
                                    size='small'
                                    variant='outlined'
                                    startIcon={<ContentCopyRoundedIcon />}
                                    onClick={() => onCopy(record)}
                                >
                                    {t('shortLinks.actions.copy')}
                                </Button>
                            </Tooltip>
                        ) : null}
                        {!record.releasedAt && canRelease ? (
                            <Tooltip title={t('shortLinks.actions.release')}>
                                <Button
                                    size='small'
                                    color='error'
                                    variant='text'
                                    startIcon={<LinkOffRoundedIcon />}
                                    disabled={isReleasing}
                                    onClick={() => onRelease(record)}
                                >
                                    {t('shortLinks.actions.release')}
                                </Button>
                            </Tooltip>
                        ) : null}
                    </Stack>
                )
            }
        ],
        [canRelease, isReleasing, onCopy, onRelease, quizAccessOptions, resourceOptions, t]
    )

    return (
        <FlowListTable<GlobalShortLinkRecord>
            data={data}
            isLoading={isLoading}
            customColumns={columns}
            tableAriaLabel={t('shortLinks.tableAriaLabel')}
        />
    )
}
