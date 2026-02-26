import { Divider, Stack, Button, Chip, Typography, Box, Checkbox, FormControlLabel } from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import FlagIcon from '@mui/icons-material/Flag'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import type { ActionDescriptor, ActionContext } from '@universo/template-mui'
import { LocalizedInlineField, useCodenameAutoFill, notifyError } from '@universo/template-mui'
import type { BranchCopyOptionKey, BranchCopyOptions, VersionedLocalizedContent } from '@universo/types'
import { BRANCH_COPY_OPTION_KEYS } from '@universo/types'
import { normalizeBranchCopyOptions } from '@universo/utils'
import type { MetahubBranch, MetahubBranchDisplay, BranchLocalizedPayload } from '../../../types'
import { getVLCString } from '../../../types'
import { sanitizeCodename, isValidCodename } from '../../../utils/codename'
import { extractLocalizedInput, ensureLocalizedContent, hasPrimaryContent, normalizeLocale } from '../../../utils/localizedInput'
import { CodenameField } from '../../../components'
import { useQuery } from '@tanstack/react-query'
import * as branchesApi from '../api'
import { metahubsQueryKeys } from '../../shared'

const buildInitialValues = (ctx: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>) => {
    const branchMap = ctx.branchMap as Map<string, MetahubBranch> | undefined
    const raw = branchMap?.get(ctx.entity.id)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)
    const nameFallback = ctx.entity?.name || ctx.entity?.codename || ''
    const descriptionFallback = ctx.entity?.description || ''

    return {
        nameVlc: ensureLocalizedContent(raw?.name ?? ctx.entity?.name, uiLocale, nameFallback),
        descriptionVlc: ensureLocalizedContent(raw?.description ?? ctx.entity?.description, uiLocale, descriptionFallback),
        codename: raw?.codename ?? ctx.entity?.codename ?? '',
        codenameTouched: true
    }
}

const appendLocalizedCopySuffix = (
    value: VersionedLocalizedContent<string> | null | undefined,
    uiLocale: string,
    fallback?: string
): VersionedLocalizedContent<string> | null => {
    if (!value) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        const nextContent = content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}`
        return {
            _schema: 'v1',
            _primary: locale,
            locales: {
                [locale]: { content: nextContent }
            }
        }
    }

    const nextLocales = { ...(value.locales || {}) } as Record<string, { content?: string }>
    const localeEntries = Object.entries(nextLocales)
    for (const [locale, localeValue] of localeEntries) {
        const normalizedLocale = normalizeLocale(locale)
        const suffix = normalizedLocale === 'ru' ? ' (копия)' : ' (copy)'
        const content = typeof localeValue?.content === 'string' ? localeValue.content.trim() : ''
        if (content.length > 0) {
            nextLocales[locale] = { ...localeValue, content: `${content}${suffix}` }
        }
    }

    const hasAnyContent = Object.values(nextLocales).some((entry) => typeof entry?.content === 'string' && entry.content.trim().length > 0)
    if (!hasAnyContent) {
        const locale = normalizeLocale(uiLocale)
        const suffix = locale === 'ru' ? ' (копия)' : ' (copy)'
        const content = (fallback || '').trim()
        nextLocales[locale] = { content: content ? `${content}${suffix}` : locale === 'ru' ? `Копия${suffix}` : `Copy${suffix}` }
    }

    return {
        ...value,
        locales: nextLocales
    }
}

const buildCopyInitialValues = (ctx: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>) => {
    const initial = buildInitialValues(ctx)
    const uiLocale = normalizeLocale(ctx.uiLocale as string | undefined)

    return {
        ...initial,
        nameVlc: appendLocalizedCopySuffix(
            initial.nameVlc as VersionedLocalizedContent<string> | null | undefined,
            uiLocale,
            ctx.entity?.name || ctx.entity?.codename || ''
        ),
        codenameTouched: false,
        ...normalizeBranchCopyOptions()
    }
}

const getBranchCopyOptions = (values: Record<string, any>): BranchCopyOptions => {
    return normalizeBranchCopyOptions({
        fullCopy: values.fullCopy,
        copyLayouts: values.copyLayouts,
        copyHubs: values.copyHubs,
        copyCatalogs: values.copyCatalogs,
        copyEnumerations: values.copyEnumerations
    })
}

const setAllBranchCopyChildren = (setValue: (name: string, value: any) => void, checked: boolean) => {
    for (const key of BRANCH_COPY_OPTION_KEYS) {
        setValue(key, checked)
    }
    setValue('fullCopy', checked)
}

const toggleBranchCopyChild = (
    setValue: (name: string, value: any) => void,
    key: BranchCopyOptionKey,
    checked: boolean,
    values: Record<string, any>
) => {
    setValue(key, checked)
    const nextOptions = getBranchCopyOptions({
        ...values,
        [key]: checked,
        fullCopy: false
    })
    setValue('fullCopy', nextOptions.fullCopy)
}

const BranchCopyOptionsTab = ({
    values,
    setValue,
    isLoading,
    t
}: {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    t: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>['t']
}) => {
    const options = getBranchCopyOptions(values)
    const allChildrenChecked = BRANCH_COPY_OPTION_KEYS.every((key) => options[key])
    const hasCheckedChildren = BRANCH_COPY_OPTION_KEYS.some((key) => options[key])

    return (
        <Stack spacing={1}>
            <FormControlLabel
                control={
                    <Checkbox
                        checked={allChildrenChecked}
                        indeterminate={!allChildrenChecked && hasCheckedChildren}
                        onChange={(event) => setAllBranchCopyChildren(setValue, event.target.checked)}
                        disabled={isLoading}
                    />
                }
                label={t('metahubs:branches.copy.options.fullCopy', 'Полное копирование')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyLayouts}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyLayouts', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('metahubs:branches.copy.options.copyLayouts', 'Макеты')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyHubs}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyHubs', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('metahubs:branches.copy.options.copyHubs', 'Хабы')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyCatalogs}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyCatalogs', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('metahubs:branches.copy.options.copyCatalogs', 'Каталоги')}
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={options.copyEnumerations}
                        onChange={(event) => toggleBranchCopyChild(setValue, 'copyEnumerations', event.target.checked, values)}
                        disabled={isLoading}
                    />
                }
                label={t('metahubs:branches.copy.options.copyEnumerations', 'Перечисления')}
            />
        </Stack>
    )
}

const validateBranchForm = (ctx: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>, values: Record<string, any>) => {
    const errors: Record<string, string> = {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    if (!hasPrimaryContent(nameVlc)) {
        errors.nameVlc = ctx.t('common:crud.nameRequired', 'Name is required')
    }
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    if (!normalizedCodename) {
        errors.codename = ctx.t('metahubs:branches.validation.codenameRequired', 'Codename is required')
    } else if (!isValidCodename(normalizedCodename)) {
        errors.codename = ctx.t('metahubs:branches.validation.codenameInvalid', 'Codename contains invalid characters')
    }
    return Object.keys(errors).length > 0 ? errors : null
}

const canSaveBranchForm = (values: Record<string, any>) => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const rawCodename = typeof values.codename === 'string' ? values.codename : ''
    const normalizedCodename = sanitizeCodename(rawCodename)
    return hasPrimaryContent(nameVlc) && Boolean(normalizedCodename) && isValidCodename(normalizedCodename)
}

const toPayload = (values: Record<string, any>): BranchLocalizedPayload => {
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const { input: nameInput, primaryLocale: namePrimaryLocale } = extractLocalizedInput(nameVlc)
    const { input: descriptionInput, primaryLocale: descriptionPrimaryLocale } = extractLocalizedInput(descriptionVlc)
    const codename = sanitizeCodename(String(values.codename || ''))

    return {
        codename,
        name: nameInput ?? {},
        description: descriptionInput,
        namePrimaryLocale,
        descriptionPrimaryLocale
    }
}

const BranchEditFields = ({
    values,
    setValue,
    isLoading,
    errors,
    t,
    uiLocale,
    onActivate,
    isActive,
    showActivateControl = true
}: {
    values: Record<string, any>
    setValue: (name: string, value: any) => void
    isLoading: boolean
    errors?: Record<string, string>
    t: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>['t']
    uiLocale?: string
    onActivate: () => void
    isActive?: boolean
    showActivateControl?: boolean
}) => {
    const fieldErrors = errors ?? {}
    const nameVlc = values.nameVlc as VersionedLocalizedContent<string> | null | undefined
    const descriptionVlc = values.descriptionVlc as VersionedLocalizedContent<string> | null | undefined
    const codename = typeof values.codename === 'string' ? values.codename : ''
    const codenameTouched = Boolean(values.codenameTouched)
    const primaryLocale = nameVlc?._primary ?? normalizeLocale(uiLocale)
    const nameValue = getVLCString(nameVlc || undefined, primaryLocale)
    const nextCodename = sanitizeCodename(nameValue)

    useCodenameAutoFill({
        codename,
        codenameTouched,
        nextCodename,
        nameValue,
        setValue: setValue as (field: 'codename' | 'codenameTouched', value: string | boolean) => void
    })

    return (
        <Stack spacing={2}>
            <LocalizedInlineField
                mode='localized'
                label={t('common:fields.name')}
                required
                disabled={isLoading}
                value={values.nameVlc ?? null}
                onChange={(next) => setValue('nameVlc', next)}
                error={fieldErrors.nameVlc || null}
                helperText={fieldErrors.nameVlc}
                uiLocale={uiLocale as string}
            />
            <LocalizedInlineField
                mode='localized'
                label={t('common:fields.description')}
                disabled={isLoading}
                value={descriptionVlc}
                onChange={(next) => setValue('descriptionVlc', next)}
                uiLocale={uiLocale as string}
                multiline
                rows={2}
            />
            <Divider />
            <CodenameField
                value={codename}
                onChange={(value) => setValue('codename', value)}
                touched={codenameTouched}
                onTouchedChange={(touched) => setValue('codenameTouched', touched)}
                label={t('metahubs:branches.codename', 'Codename')}
                helperText={t(
                    'metahubs:branches.codenameHelper',
                    'Unique identifier for URLs (lowercase Latin letters, numbers, hyphens). Auto-generated from the name with transliteration. You can edit it manually.'
                )}
                error={fieldErrors.codename}
                disabled={isLoading}
                required
            />
            {showActivateControl ? (
                <Stack direction='row' spacing={1} alignItems='center'>
                    <Button type='button' size='small' variant='outlined' disabled={Boolean(isActive) || isLoading} onClick={onActivate}>
                        {t('metahubs:branches.activate', 'Activate')}
                    </Button>
                    {isActive ? (
                        <Chip size='small' label={t('metahubs:branches.badge.active', 'Active')} color='success' variant='outlined' />
                    ) : null}
                </Stack>
            ) : null}
        </Stack>
    )
}

const SourceInfoCard = ({ text, tone = 'info' }: { text: string; tone?: 'info' | 'warning' }) => (
    <Box
        sx={{
            width: '100%',
            display: 'flex',
            gap: 1.5,
            alignItems: 'flex-start',
            p: 2,
            borderRadius: 2,
            bgcolor: 'action.hover'
        }}
    >
        {tone === 'warning' ? (
            <WarningAmberOutlinedIcon sx={{ color: 'warning.main', mt: '2px' }} fontSize='small' />
        ) : (
            <InfoOutlinedIcon sx={{ color: 'text.secondary', mt: '2px' }} fontSize='small' />
        )}
        <Typography color='text.secondary'>{text}</Typography>
    </Box>
)

const BranchSourceInfoTab = ({
    metahubId,
    branchId,
    uiLocale,
    t
}: {
    metahubId: string
    branchId: string
    uiLocale?: string
    t: ActionContext<MetahubBranchDisplay, BranchLocalizedPayload>['t']
}) => {
    const { data, isLoading, error } = useQuery({
        queryKey: metahubsQueryKeys.branchDetail(metahubId, branchId),
        queryFn: async () => {
            const response = await branchesApi.getBranch(metahubId, branchId)
            return response.data
        },
        enabled: Boolean(metahubId && branchId)
    })

    const chain = data?.sourceChain ?? []
    const hasSource = Boolean(data?.sourceBranchId)

    if (isLoading) {
        return <Typography>{t('common:loading', 'Loading...')}</Typography>
    }

    if (error) {
        return <Typography color='error'>{t('metahubs:errors.pleaseTryLater', 'Please try again later')}</Typography>
    }

    if (!hasSource) {
        return <SourceInfoCard text={t('metahubs:branches.sourceEmptyInfo', 'Branch has no source')} />
    }

    if (chain.length === 0) {
        return <SourceInfoCard text={t('metahubs:branches.sourceMissing', 'Source branch is missing')} tone='warning' />
    }

    return (
        <Stack spacing={1.5}>
            <Typography sx={{ fontWeight: 600 }}>{t('metahubs:branches.sourceChainTitle', 'Source chain')}</Typography>
            <Box
                sx={{
                    width: '100%',
                    p: 2,
                    borderRadius: 2,
                    bgcolor: 'action.hover'
                }}
            >
                <Stack spacing={1.5}>
                    {chain.map((node, index) => {
                        const isMissing = Boolean(node.isMissing)
                        const name = node.name ? getVLCString(node.name, uiLocale ?? 'en') : ''
                        const label = name || node.codename || node.id
                        const codenameInfo = name && node.codename ? `(${node.codename})` : null

                        return (
                            <Box key={node.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                                <Chip size='small' label={index + 1} variant='outlined' />
                                {isMissing ? (
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                        <WarningAmberOutlinedIcon sx={{ color: 'warning.main', mt: '2px' }} fontSize='small' />
                                        <Box>
                                            <Typography color='text.primary'>
                                                {t('metahubs:branches.sourceMissingItem', 'Deleted branch')}
                                            </Typography>
                                            <Typography variant='caption' color='text.secondary'>
                                                {node.id}
                                            </Typography>
                                        </Box>
                                    </Box>
                                ) : (
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                                        <LinkOutlinedIcon sx={{ color: 'text.secondary', mt: '2px' }} fontSize='small' />
                                        <Box>
                                            <Typography>{label}</Typography>
                                            {codenameInfo ? (
                                                <Typography variant='caption' color='text.secondary'>
                                                    {codenameInfo}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        )
                    })}
                </Stack>
            </Box>
        </Stack>
    )
}

const branchActions: readonly ActionDescriptor<MetahubBranchDisplay, BranchLocalizedPayload>[] = [
    {
        id: 'edit',
        labelKey: 'common:actions.edit',
        icon: <EditIcon />,
        order: 10,
        group: 'main',
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const initial = buildInitialValues(ctx)
                return {
                    open: true,
                    mode: 'edit' as const,
                    title: ctx.t('metahubs:branches.editTitle', 'Edit Branch'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('common:actions.save'),
                    savingButtonText: ctx.t('common:actions.saving'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: any) => [
                        {
                            id: 'general',
                            label: ctx.t('metahubs:branches.tabs.general', 'General'),
                            content: (
                                <BranchEditFields
                                    values={values}
                                    setValue={setValue}
                                    isLoading={isLoading}
                                    errors={errors}
                                    t={ctx.t}
                                    uiLocale={ctx.uiLocale as string}
                                    onActivate={async () => {
                                        try {
                                            await ctx.runtime?.activateBranch?.(ctx.entity.id)
                                            await ctx.helpers?.refreshList?.()
                                        } catch (error: unknown) {
                                            notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                                        }
                                    }}
                                    isActive={ctx.entity.isActive}
                                />
                            )
                        },
                        {
                            id: 'source',
                            label: ctx.t('metahubs:branches.tabs.source', 'Источник'),
                            content: (
                                <BranchSourceInfoTab
                                    metahubId={ctx.entity.metahubId}
                                    branchId={ctx.entity.id}
                                    uiLocale={ctx.uiLocale as string}
                                    t={ctx.t}
                                />
                            )
                        }
                    ],
                    validate: (values: Record<string, any>) => validateBranchForm(ctx, values),
                    canSave: canSaveBranchForm,
                    showDeleteButton: true,
                    deleteButtonText: ctx.t('common:actions.delete'),
                    deleteButtonDisabled: Boolean(ctx.entity.isDefault),
                    onDelete: () => {
                        ctx.helpers?.openDeleteDialog?.(ctx.entity)
                    },
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh branches list after edit', e)
                        }
                    },
                    onSave: async (data: Record<string, any>) => {
                        try {
                            const payload = toPayload(data)
                            await ctx.api?.updateEntity?.(ctx.entity.id, payload)
                            await ctx.helpers?.refreshList?.()
                        } catch (error: unknown) {
                            notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                            throw error
                        }
                    }
                }
            }
        }
    },
    {
        id: 'copy',
        labelKey: 'common:actions.copy',
        icon: <ContentCopyIcon />,
        order: 11,
        group: 'main',
        dialog: {
            loader: async () => {
                const module = await import('@universo/template-mui/components/dialogs')
                return { default: module.EntityFormDialog }
            },
            buildProps: (ctx) => {
                const initial = buildCopyInitialValues(ctx)
                return {
                    open: true,
                    mode: 'create' as const,
                    title: ctx.t('metahubs:branches.copyTitle', 'Copying Branch'),
                    nameLabel: ctx.t('common:fields.name'),
                    descriptionLabel: ctx.t('common:fields.description'),
                    saveButtonText: ctx.t('metahubs:branches.copy.action', 'Copy'),
                    savingButtonText: ctx.t('metahubs:branches.copy.actionLoading', 'Copying...'),
                    cancelButtonText: ctx.t('common:actions.cancel'),
                    hideDefaultFields: true,
                    initialExtraValues: initial,
                    tabs: ({ values, setValue, isLoading, errors }: any) => [
                        {
                            id: 'general',
                            label: ctx.t('metahubs:branches.tabs.general', 'Основное'),
                            content: (
                                <BranchEditFields
                                    values={values}
                                    setValue={setValue}
                                    isLoading={isLoading}
                                    errors={errors}
                                    t={ctx.t}
                                    uiLocale={ctx.uiLocale as string}
                                    onActivate={() => undefined}
                                    showActivateControl={false}
                                />
                            )
                        },
                        {
                            id: 'options',
                            label: ctx.t('metahubs:branches.tabs.options', 'Опции'),
                            content: <BranchCopyOptionsTab values={values} setValue={setValue} isLoading={isLoading} t={ctx.t} />
                        }
                    ],
                    validate: (values: Record<string, any>) => validateBranchForm(ctx, values),
                    canSave: canSaveBranchForm,
                    onClose: () => {
                        // BaseEntityMenu handles dialog closing
                    },
                    onSuccess: async () => {
                        try {
                            await ctx.helpers?.refreshList?.()
                        } catch (e) {
                            // eslint-disable-next-line no-console
                            console.error('Failed to refresh branches list after copy', e)
                        }
                    },
                    onSave: async (data: Record<string, any>) => {
                        try {
                            const payload = toPayload(data)
                            const copyOptions = getBranchCopyOptions(data)
                            await ctx.api?.copyEntity?.(ctx.entity.id, {
                                ...payload,
                                sourceBranchId: ctx.entity.id,
                                ...copyOptions
                            })
                            await ctx.helpers?.refreshList?.()
                        } catch (error: unknown) {
                            notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
                            throw error
                        }
                    }
                }
            }
        }
    },
    {
        id: 'activate',
        labelKey: 'branches.actions.activate',
        icon: <PlayCircleOutlineIcon />,
        order: 20,
        group: 'status',
        visible: (ctx) => !ctx.entity.isActive,
        onSelect: async (ctx) => {
            try {
                await ctx.runtime?.activateBranch?.(ctx.entity.id)
                await ctx.helpers?.refreshList?.()
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'setDefault',
        labelKey: 'branches.actions.setDefault',
        icon: <FlagIcon />,
        order: 21,
        group: 'status',
        visible: (ctx) => !ctx.entity.isDefault,
        onSelect: async (ctx) => {
            try {
                await ctx.runtime?.setDefaultBranch?.(ctx.entity.id)
                await ctx.helpers?.refreshList?.()
            } catch (error: unknown) {
                notifyError(ctx.t, ctx.helpers?.enqueueSnackbar, error)
            }
        }
    },
    {
        id: 'delete',
        labelKey: 'common:actions.delete',
        icon: <DeleteIcon />,
        tone: 'danger',
        order: 30,
        group: 'danger',
        enabled: (ctx) => !ctx.entity.isDefault,
        onSelect: async (ctx) => {
            ctx.helpers?.openDeleteDialog?.(ctx.entity)
        }
    }
]

export default branchActions
