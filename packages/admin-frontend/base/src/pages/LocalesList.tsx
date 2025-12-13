import { useState, useMemo, useCallback } from 'react'
import { Box, Stack, Typography, IconButton, Chip, Switch, Tooltip } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'
import LanguageRoundedIcon from '@mui/icons-material/LanguageRounded'
import StarRoundedIcon from '@mui/icons-material/StarRounded'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { resolveLocalizedContent } from '@universo/utils'
import { isValidLocaleCode } from '@universo/types'
import { useSnackbar } from 'notistack'

import { TemplateMainCard as MainCard, ViewHeaderMUI as ViewHeader, FlowListTable, useConfirm } from '@universo/template-mui'

import * as localesApi from '../api/localesApi'
import type { LocaleItem, UpdateLocalePayload } from '../api/localesApi'
import { localesQueryKeys } from '../api/queryKeys'
import LocaleDialog from '../components/LocaleDialog'

/**
 * Locales List Page
 *
 * Displays all configured locales with ability to:
 * - Toggle Content enabled/disabled
 * - Set default locale
 * - Edit locale properties
 * - Delete non-system locales
 */
const LocalesList = () => {
    const { t, i18n } = useTranslation('admin')
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const { confirm } = useConfirm()

    // Get current locale safely using shared utility
    const langCode = i18n.language?.split('-')[0] || 'en'
    const currentLang = isValidLocaleCode(langCode) ? langCode : 'en'

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingLocale, setEditingLocale] = useState<LocaleItem | null>(null)

    // Query for locales list
    const {
        data,
        isLoading,
        error: _error
    } = useQuery({
        queryKey: localesQueryKeys.list({ includeDisabled: true }),
        queryFn: () => localesApi.listLocales({ includeDisabled: true })
    })

    const locales = data?.items || []

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: UpdateLocalePayload }) => localesApi.updateLocale(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: localesQueryKeys.lists() })
            // Invalidate public content locales endpoint used by LocalizedFieldEditor
            queryClient.invalidateQueries({ queryKey: ['locales', 'content', 'public'] })
        },
        onError: (err: Error) => {
            enqueueSnackbar(err.message || t('locales.updateError', 'Failed to update locale'), { variant: 'error' })
        }
    })

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: localesApi.deleteLocale,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: localesQueryKeys.lists() })
            // Invalidate public content locales endpoint used by LocalizedFieldEditor
            queryClient.invalidateQueries({ queryKey: ['locales', 'content', 'public'] })
            enqueueSnackbar(t('locales.deleteSuccess', 'Locale deleted successfully'), { variant: 'success' })
        },
        onError: (err: Error) => {
            enqueueSnackbar(err.message || t('locales.deleteError', 'Failed to delete locale'), { variant: 'error' })
        }
    })

    // Handler: Toggle Content enabled
    const handleToggleContent = useCallback(
        (locale: LocaleItem) => {
            updateMutation.mutate({
                id: locale.id,
                data: { isEnabledContent: !locale.isEnabledContent }
            })
        },
        [updateMutation]
    )

    // Handler: Set default Content locale
    const handleSetDefaultContent = useCallback(
        (locale: LocaleItem) => {
            if (locale.isDefaultContent) return
            updateMutation.mutate({
                id: locale.id,
                data: { isDefaultContent: true }
            })
        },
        [updateMutation]
    )

    // Handler: Delete locale
    const handleDelete = useCallback(
        async (locale: LocaleItem) => {
            const confirmed = await confirm({
                title: t('locales.deleteConfirmTitle', 'Delete Locale'),
                description: t('locales.deleteConfirmDescription', {
                    defaultValue: 'Are you sure you want to delete locale "{{code}}"? This action cannot be undone.',
                    code: locale.code
                })
            })
            if (confirmed) {
                deleteMutation.mutate(locale.id)
            }
        },
        [confirm, deleteMutation, t]
    )

    // Handler: Edit locale
    const handleEdit = useCallback((locale: LocaleItem) => {
        setEditingLocale(locale)
        setDialogOpen(true)
    }, [])

    // Handler: Add new locale
    const handleAdd = useCallback(() => {
        setEditingLocale(null)
        setDialogOpen(true)
    }, [])

    // Handler: Close dialog
    const handleCloseDialog = useCallback(() => {
        setDialogOpen(false)
        setEditingLocale(null)
    }, [])

    // Handler: Dialog success (refresh list)
    const handleDialogSuccess = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: localesQueryKeys.lists() })
        // Invalidate public content locales endpoint used by LocalizedFieldEditor
        queryClient.invalidateQueries({ queryKey: ['locales', 'content', 'public'] })
        handleCloseDialog()
    }, [queryClient, handleCloseDialog])

    // Get localized name for display
    const getLocaleName = useCallback(
        (locale: LocaleItem): string => {
            // currentLang is already validated as LocaleCode (string)
            return resolveLocalizedContent(locale.name, currentLang, locale.code)
        },
        [currentLang]
    )

    // Table columns definition
    const columns = useMemo(
        () => [
            {
                id: 'code',
                label: t('locales.code', 'Code'),
                width: '15%',
                render: (locale: LocaleItem) => (
                    <Stack direction='row' alignItems='center' spacing={1}>
                        <Chip
                            label={locale.code.toUpperCase()}
                            size='small'
                            color={locale.isDefaultContent ? 'primary' : 'default'}
                            icon={locale.isDefaultContent ? <StarRoundedIcon /> : undefined}
                        />
                        {locale.isSystem && <Chip label={t('common.system', 'System')} size='small' variant='outlined' />}
                    </Stack>
                )
            },
            {
                id: 'name',
                label: t('locales.name', 'Name'),
                width: '30%',
                render: (locale: LocaleItem) => (
                    <Typography>
                        {getLocaleName(locale)}
                        {locale.nativeName && (
                            <Typography component='span' color='text.secondary' sx={{ ml: 1 }}>
                                ({locale.nativeName})
                            </Typography>
                        )}
                    </Typography>
                )
            },
            {
                id: 'content',
                label: t('locales.enabledContent', 'Content'),
                width: '20%',
                render: (locale: LocaleItem) => (
                    <Stack direction='row' alignItems='center' spacing={1}>
                        <Switch
                            checked={locale.isEnabledContent}
                            onChange={() => handleToggleContent(locale)}
                            size='small'
                            disabled={locale.isDefaultContent && locale.isEnabledContent}
                        />
                        <Typography variant='body2' color={locale.isEnabledContent ? 'success.main' : 'text.secondary'}>
                            {locale.isEnabledContent ? t('common.enabled', 'Enabled') : t('common.disabled', 'Disabled')}
                        </Typography>
                    </Stack>
                )
            },
            {
                id: 'ui',
                label: t('locales.enabledUi', 'UI'),
                width: '15%',
                render: (locale: LocaleItem) => (
                    <Tooltip title={t('locales.uiRequiresFiles', 'UI translations require JSON files in the codebase')}>
                        <Chip
                            label={locale.isEnabledUi ? t('common.yes', 'Yes') : t('common.no', 'No')}
                            size='small'
                            color={locale.isEnabledUi ? 'success' : 'default'}
                            variant='outlined'
                        />
                    </Tooltip>
                )
            },
            {
                id: 'actions',
                label: '',
                width: '20%',
                align: 'right' as const,
                render: (locale: LocaleItem) => (
                    <Stack direction='row' spacing={0.5} justifyContent='flex-end'>
                        {!locale.isDefaultContent && locale.isEnabledContent && (
                            <Tooltip title={t('locales.setDefaultContent', 'Set as default for content')}>
                                <IconButton size='small' onClick={() => handleSetDefaultContent(locale)}>
                                    <LanguageRoundedIcon fontSize='small' />
                                </IconButton>
                            </Tooltip>
                        )}
                        <Tooltip title={t('common.edit', 'Edit')}>
                            <IconButton size='small' onClick={() => handleEdit(locale)}>
                                <EditRoundedIcon fontSize='small' />
                            </IconButton>
                        </Tooltip>
                        {!locale.isSystem && (
                            <Tooltip title={t('common.delete', 'Delete')}>
                                <span>
                                    <IconButton
                                        size='small'
                                        color='error'
                                        onClick={() => handleDelete(locale)}
                                        disabled={locale.isDefaultContent || locale.isDefaultUi}
                                    >
                                        <DeleteRoundedIcon fontSize='small' />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                    </Stack>
                )
            }
        ],
        [t, getLocaleName, handleToggleContent, handleSetDefaultContent, handleEdit, handleDelete]
    )

    return (
        <Box>
            <ViewHeader
                title={t('locales.title', 'Locales')}
                description={t('locales.description', 'Manage available languages for content localization')}
            >
                <Tooltip title={t('locales.addNew', 'Add Locale')}>
                    <IconButton color='primary' onClick={handleAdd}>
                        <AddRoundedIcon />
                    </IconButton>
                </Tooltip>
            </ViewHeader>

            <MainCard>
                <FlowListTable data={locales} customColumns={columns} isLoading={isLoading} />
            </MainCard>

            <LocaleDialog open={dialogOpen} onClose={handleCloseDialog} onSuccess={handleDialogSuccess} locale={editingLocale} />
        </Box>
    )
}

export default LocalesList
