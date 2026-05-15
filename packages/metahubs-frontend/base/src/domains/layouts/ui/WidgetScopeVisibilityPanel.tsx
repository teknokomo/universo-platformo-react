import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSnackbar } from 'notistack'
import { Alert, Box, Chip, CircularProgress, Paper, Stack, Switch, Typography } from '@mui/material'
import { notifyError } from '@universo/template-mui'
import type { VersionedLocalizedContent } from '@universo/types'

import * as layoutsApi from '../api'
import { metahubsQueryKeys } from '../../shared'
import { getVLCString, normalizeLocale } from '../../../types'

type Props = {
    metahubId: string
    layoutId: string
    widgetId: string
    disabled?: boolean
}

const asVlc = (value: unknown): VersionedLocalizedContent<string> | null => {
    if (!value || typeof value !== 'object') {
        return null
    }
    return value as VersionedLocalizedContent<string>
}

const resolveLocalizedText = (value: unknown, locale: string): string => {
    const vlc = asVlc(value)
    if (!vlc) {
        return typeof value === 'string' ? value : ''
    }
    return getVLCString(vlc, locale) || getVLCString(vlc, vlc._primary ?? 'en') || getVLCString(vlc, 'en') || ''
}

export default function WidgetScopeVisibilityPanel({ metahubId, layoutId, widgetId, disabled = false }: Props) {
    const { t, i18n } = useTranslation(['metahubs', 'common'])
    const { enqueueSnackbar } = useSnackbar()
    const queryClient = useQueryClient()
    const uiLocale = normalizeLocale(i18n.language)

    const queryKey = useMemo(
        () => [...metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId), 'scope-visibility', widgetId],
        [layoutId, metahubId, widgetId]
    )

    const visibilityQuery = useQuery({
        queryKey,
        queryFn: () => layoutsApi.listLayoutWidgetScopeVisibility(metahubId, layoutId, widgetId),
        enabled: Boolean(metahubId && layoutId && widgetId)
    })

    const resolveKindLabel = (kind: string): string => {
        switch (kind) {
            case 'hub':
                return t('hubs.title', 'Hub')
            case 'object':
                return t('objects.title', 'Object')
            case 'set':
                return t('sets.title', 'Set')
            case 'enumeration':
                return t('enumerations.title', 'Enumeration')
            case 'page':
                return t('pages.title', 'Page')
            case 'ledger':
                return t('ledgers.title', 'Ledger')
            default:
                return kind
        }
    }

    const mutation = useMutation({
        mutationFn: ({ scopeEntityId, isVisible }: { scopeEntityId: string; isVisible: boolean }) =>
            layoutsApi.updateLayoutWidgetScopeVisibility(metahubId, layoutId, widgetId, scopeEntityId, isVisible),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey }),
                queryClient.invalidateQueries({ queryKey: metahubsQueryKeys.layoutZoneWidgets(metahubId, layoutId) })
            ])
        },
        onError: (error) => notifyError(t, enqueueSnackbar, error)
    })

    const items = visibilityQuery.data ?? []

    return (
        <Stack spacing={1.5} data-testid='layout-widget-scope-visibility-panel'>
            <Box>
                <Typography variant='subtitle2'>{t('layouts.widgetScopeVisibility.title', 'Visibility by entity')}</Typography>
                <Typography variant='body2' color='text.secondary'>
                    {t(
                        'layouts.widgetScopeVisibility.description',
                        'Disable this global widget for selected entities. A scoped layout is created automatically when a visibility override is saved.'
                    )}
                </Typography>
            </Box>

            {visibilityQuery.isLoading ? (
                <Stack direction='row' spacing={1} alignItems='center' sx={{ py: 1 }}>
                    <CircularProgress size={18} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('common:loading', 'Loading...')}
                    </Typography>
                </Stack>
            ) : null}

            {visibilityQuery.isError ? (
                <Alert severity='error'>
                    {t('layouts.widgetScopeVisibility.loadError', 'Failed to load entity visibility overrides.')}
                </Alert>
            ) : null}

            {!visibilityQuery.isLoading && !visibilityQuery.isError && items.length === 0 ? (
                <Alert severity='info'>
                    {t('layouts.widgetScopeVisibility.empty', 'No entity types with custom layouts are available in this metahub.')}
                </Alert>
            ) : null}

            {items.map((item) => {
                const name = resolveLocalizedText(item.name, uiLocale) || t('layouts.widgetScopeVisibility.unnamedEntity', 'Unnamed entity')
                const codename = resolveLocalizedText(item.codename, uiLocale)
                const kind = resolveKindLabel(item.kind)
                const isPending = mutation.isPending && mutation.variables?.scopeEntityId === item.scopeEntityId
                return (
                    <Paper
                        key={item.scopeEntityId}
                        variant='outlined'
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 1.5,
                            px: 1.5,
                            py: 1,
                            borderRadius: 1.5
                        }}
                        data-testid={`layout-widget-scope-visibility-row-${item.scopeEntityId}`}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography variant='body2' noWrap>
                                {name}
                            </Typography>
                            <Typography variant='caption' color='text.secondary' noWrap component='div'>
                                {t('layouts.widgetScopeVisibility.entityMeta', '{{kind}}{{codename}}', {
                                    kind,
                                    codename: codename ? ` · ${codename}` : ''
                                })}
                            </Typography>
                        </Box>
                        <Stack direction='row' spacing={1} alignItems='center' sx={{ flexShrink: 0 }}>
                            <Chip
                                size='small'
                                variant='outlined'
                                color={item.isOverridden ? 'warning' : 'default'}
                                label={
                                    item.isOverridden
                                        ? t('layouts.widgetScopeVisibility.overridden', 'Overridden')
                                        : t('layouts.widgetScopeVisibility.inherited', 'Inherited')
                                }
                            />
                            {item.layoutId ? (
                                <Chip
                                    size='small'
                                    variant='outlined'
                                    label={t('layouts.widgetScopeVisibility.scopedLayout', 'Scoped layout')}
                                />
                            ) : null}
                            <Switch
                                checked={item.isVisible}
                                disabled={disabled || isPending}
                                inputProps={{
                                    'aria-label': t('layouts.widgetScopeVisibility.toggleAria', 'Toggle widget visibility for {{name}}', {
                                        name
                                    })
                                }}
                                onChange={(_, checked) => mutation.mutate({ scopeEntityId: item.scopeEntityId, isVisible: checked })}
                                data-testid={`layout-widget-scope-visibility-switch-${item.scopeEntityId}`}
                            />
                        </Stack>
                    </Paper>
                )
            })}
        </Stack>
    )
}
