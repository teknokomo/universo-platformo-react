import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { packagesApi } from '../api'
import { metahubsQueryKeys } from '../../shared'
import { getLocalizedContentText, normalizeLocale } from '../../../utils/localizedInput'

const getHttpStatus = (error: unknown): number | undefined => {
    const status = (error as { response?: { status?: unknown } } | null)?.response?.status
    return typeof status === 'number' ? status : undefined
}

type FrameStatus = 'checking' | 'loading' | 'loaded' | 'error'

export default function PlayCanvasEditorHostPage() {
    const { metahubId = '', packageSlug = '' } = useParams()
    const [searchParams] = useSearchParams()
    const { t, i18n } = useTranslation(['metahubs'])
    const locale = normalizeLocale(i18n.language)

    const hostQuery = useQuery({
        queryKey: [...metahubsQueryKeys.packagesAttached(metahubId), 'authoring-host', packageSlug],
        queryFn: () => packagesApi.getAuthoringHost(metahubId, packageSlug),
        enabled: Boolean(metahubId && packageSlug)
    })

    const host = hostQuery.data
    const fallbackDisplayName =
        packageSlug === 'playcanvas-editor' ? 'PlayCanvas Editor' : t('packages.editorHost.fallbackName', 'Package editor')
    const displayName = useMemo(
        () => getLocalizedContentText(host?.displayName, locale, fallbackDisplayName),
        [fallbackDisplayName, host?.displayName, locale]
    )
    const displayConfig = host?.attachmentConfig.kind === 'display' ? host.attachmentConfig : null
    const mode = displayConfig?.display.mode ?? 'disabled'
    const forceSandboxedFrame = searchParams.get('view') === 'sandboxed-frame'
    const frameUrl = useMemo(() => {
        if (mode === 'developmentUrl') {
            return displayConfig?.display.developmentUrl ?? null
        }
        if (!host?.artifactUrl) {
            return null
        }
        const separator = host.artifactUrl.includes('?') ? '&' : '?'
        return `${host.artifactUrl}${separator}locale=${encodeURIComponent(locale)}`
    }, [displayConfig?.display.developmentUrl, host?.artifactUrl, locale, mode])
    const [frameStatus, setFrameStatus] = useState<FrameStatus>('checking')

    useEffect(() => {
        if (!frameUrl) {
            setFrameStatus('checking')
            return undefined
        }

        let active = true
        let timeoutId: ReturnType<typeof setTimeout> | undefined
        const resolvedFrameUrl = new URL(frameUrl, window.location.href)

        setFrameStatus('checking')

        if (resolvedFrameUrl.origin === window.location.origin) {
            fetch(resolvedFrameUrl.toString(), {
                cache: 'no-store',
                credentials: 'same-origin'
            })
                .then((response) => {
                    if (!active) return
                    setFrameStatus(response.ok ? 'loading' : 'error')
                })
                .catch(() => {
                    if (!active) return
                    setFrameStatus('error')
                })
        } else {
            setFrameStatus('loading')
            timeoutId = setTimeout(() => {
                if (!active) return
                setFrameStatus((current) => (current === 'loaded' ? current : 'error'))
            }, 15000)
        }

        return () => {
            active = false
            if (timeoutId) {
                clearTimeout(timeoutId)
            }
        }
    }, [frameUrl])

    const sandboxedSeparateHostUrl =
        metahubId && packageSlug
            ? `/metahub/${encodeURIComponent(metahubId)}/resources/packages/${encodeURIComponent(packageSlug)}/editor?view=sandboxed-frame`
            : '#'
    const packagesUrl = metahubId ? `/metahub/${encodeURIComponent(metahubId)}/resources` : '#'
    const renderHeader = () => (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button component='a' href={packagesUrl} variant='outlined' startIcon={<ArrowBackRoundedIcon />}>
                {t('packages.editorHost.backToPackages', 'Back to packages')}
            </Button>
            <Typography variant='h4' sx={{ overflowWrap: 'anywhere' }}>
                {displayName}
            </Typography>
        </Stack>
    )
    const renderState = (severity: 'info' | 'warning' | 'error' | 'success', message: string) => (
        <Stack spacing={2} sx={{ p: 3, maxWidth: 760 }}>
            {renderHeader()}
            <Alert severity={severity}>{message}</Alert>
        </Stack>
    )

    if (hostQuery.isLoading) {
        return (
            <Stack direction='row' spacing={1} alignItems='center' sx={{ p: 3 }}>
                <CircularProgress size={18} />
                <Typography variant='body2' color='text.secondary'>
                    {t('packages.editorHost.loading', 'Loading editor...')}
                </Typography>
            </Stack>
        )
    }

    if (hostQuery.isError || !host) {
        const status = getHttpStatus(hostQuery.error)
        const message =
            status === 401 || status === 403
                ? t('packages.editorHost.permissionDenied', 'You do not have permission to open this editor.')
                : t('packages.editorHost.loadError', 'Failed to load editor settings.')
        return renderState('error', message)
    }

    if (mode === 'disabled') {
        return renderState('info', t('packages.editorHost.disabled', 'This editor is disabled for the metahub.'))
    }

    if (host.artifactStatus === 'blocked' || host.artifactStatus === 'misconfigured') {
        return renderState('warning', t('packages.editorHost.misconfigured', 'Editor display settings are incomplete.'))
    }

    if (host.artifactStatus !== 'available' && mode !== 'developmentUrl') {
        return renderState('warning', t('packages.editorHost.artifactMissing', 'The editor artifact is not available yet.'))
    }

    if (!frameUrl) {
        return renderState('warning', t('packages.editorHost.misconfigured', 'Editor display settings are incomplete.'))
    }

    if (mode === 'openSeparately' && !forceSandboxedFrame) {
        return (
            <Stack spacing={2} sx={{ p: 3, maxWidth: 720 }}>
                {renderHeader()}
                <Alert severity='info'>{t('packages.editorHost.openSeparately', 'This editor is configured to open separately.')}</Alert>
                <Button
                    component='a'
                    href={sandboxedSeparateHostUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    variant='contained'
                    startIcon={<OpenInNewRoundedIcon />}
                >
                    {t('packages.actions.openEditor', 'Open editor')}
                </Button>
            </Stack>
        )
    }

    return (
        <Stack sx={{ minHeight: 'calc(100vh - 96px)', p: 2 }} spacing={1.5}>
            {renderHeader()}
            {frameStatus === 'error' ? (
                <Alert severity='error'>{t('packages.editorHost.frameLoadError', 'The editor frame could not be loaded.')}</Alert>
            ) : displayConfig?.display.showArtifactOnlyNotice ? (
                <Alert severity={frameStatus === 'loaded' && mode !== 'developmentUrl' ? 'success' : 'info'}>
                    {frameStatus === 'loaded'
                        ? mode === 'developmentUrl'
                            ? t('packages.editorHost.developmentNotice', 'Development URL mode is active.')
                            : t('packages.editorHost.artifactReady', 'Editor artifact is ready.')
                        : t('packages.editorHost.frameLoading', 'Loading editor frame...')}
                </Alert>
            ) : null}
            {frameStatus !== 'checking' && frameStatus !== 'error' ? (
                <Box
                    component='iframe'
                    title={displayName}
                    src={frameUrl}
                    sandbox='allow-scripts'
                    referrerPolicy='no-referrer'
                    allow=''
                    onLoad={() => setFrameStatus('loaded')}
                    onError={() => setFrameStatus('error')}
                    sx={{
                        flex: 1,
                        width: '100%',
                        minHeight: 640,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1
                    }}
                />
            ) : null}
        </Stack>
    )
}
