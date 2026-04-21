import { useEffect, useState } from 'react'
import { Alert, Box, Button, Card, CardContent, CardHeader, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ModuleViewerWidgetConfig } from '@universo/types'
import { useDashboardDetails } from '../DashboardDetailsContext'
import { executeClientScriptMethod } from '../runtime/browserScriptRuntime'
import { createClientScriptContext, useRuntimeWidgetClientScript } from './runtimeWidgetHelpers'
import QuizWidget from './QuizWidget'

type ContentItem = {
    id: string
    itemType: string
    itemTitle?: string
    itemContent?: string
    quizId?: string
    sortOrder: number
}

type ModuleModel = {
    title: string
    description?: string
    progressPercent?: number
    items: ContentItem[]
}

const readString = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback)
const readNumber = (value: unknown, fallback = 0): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)

const normalizeModuleModel = (value: unknown, fallbackTitle: string): ModuleModel | null => {
    if (!value || typeof value !== 'object') return null
    const source = value as Record<string, unknown>
    const rawItems = Array.isArray(source.items) ? source.items : []
    const items = rawItems
        .reduce<ContentItem[]>((acc, item, index) => {
            if (!item || typeof item !== 'object') return acc
            const raw = item as Record<string, unknown>
            acc.push({
                id: readString(raw.id, `item-${index}`),
                itemType: readString(raw.itemType, 'text'),
                itemTitle: readString(raw.itemTitle) || undefined,
                itemContent: readString(raw.itemContent) || undefined,
                quizId: readString(raw.quizId) || undefined,
                sortOrder: readNumber(raw.sortOrder, index)
            })
            return acc
        }, [])
        .sort((a, b) => a.sortOrder - b.sortOrder)

    if (items.length === 0) return null
    return {
        title: readString(source.title, fallbackTitle),
        description: readString(source.description, ''),
        progressPercent: typeof source.progressPercent === 'number' ? source.progressPercent : undefined,
        items
    }
}

export default function ModuleViewerWidget({ config }: { config?: Record<string, unknown> }) {
    const { t, i18n } = useTranslation('apps')
    const details = useDashboardDetails()
    const widgetConfig = (config ?? {}) as ModuleViewerWidgetConfig
    const [currentIndex, setCurrentIndex] = useState(0)

    const applicationId = details?.applicationId
    const linkedCollectionId = details?.linkedCollectionId ?? null
    const apiBaseUrl = details?.apiBaseUrl ?? '/api/v1'
    const mountMethodName = widgetConfig.mountMethodName || 'mount'

    const { scriptsQuery, selectedScript, clientBundleQuery, clientBundle } = useRuntimeWidgetClientScript({
        queryKeyPrefix: 'module-viewer',
        apiBaseUrl,
        applicationId,
        linkedCollectionId,
        scriptCodename: widgetConfig.scriptCodename,
        attachedToKind: widgetConfig.attachedToKind
    })

    const moduleQuery = useQuery({
        queryKey: ['module-viewer-model', selectedScript?.id, linkedCollectionId, mountMethodName],
        enabled: Boolean(applicationId && selectedScript && clientBundle),
        queryFn: async () => {
            if (!applicationId || !selectedScript || !clientBundle) return null
            if (!selectedScript.manifest.methods.some((method) => method.name === mountMethodName)) return null

            const rawModel = await executeClientScriptMethod({
                bundle: clientBundle,
                methodName: mountMethodName,
                args: [i18n.language],
                context: createClientScriptContext({ apiBaseUrl, applicationId, script: selectedScript })
            })

            return normalizeModuleModel(rawModel, t('moduleViewer.defaultTitle', 'Module Viewer'))
        }
    })

    const moduleModel = moduleQuery.data

    useEffect(() => {
        setCurrentIndex(0)
    }, [moduleModel])

    const currentItem = moduleModel?.items[currentIndex] ?? null
    const totalItems = moduleModel?.items.length ?? 0
    const progressValue = moduleModel?.progressPercent ?? (totalItems > 0 ? ((currentIndex + 1) / totalItems) * 100 : 0)

    const goToPrevious = () => setCurrentIndex((i) => Math.max(i - 1, 0))
    const goToNext = () => setCurrentIndex((i) => Math.min(i + 1, totalItems - 1))

    if (!applicationId) {
        return (
            <Alert severity='info'>
                {t('moduleViewer.missingContext', 'Module viewer widget is available only inside the application runtime surface.')}
            </Alert>
        )
    }

    if (scriptsQuery.isLoading || clientBundleQuery.isLoading || moduleQuery.isLoading) {
        return (
            <Card variant='outlined'>
                <CardContent>
                    <Stack direction='row' spacing={1.5} alignItems='center'>
                        <CircularProgress size={20} />
                        <Typography variant='body2'>{t('moduleViewer.loading', 'Loading module...')}</Typography>
                    </Stack>
                </CardContent>
            </Card>
        )
    }

    if (scriptsQuery.isError) {
        return <Alert severity='error'>{t('moduleViewer.loadScriptsError', 'Failed to load widget scripts.')}</Alert>
    }

    if (moduleQuery.isError) {
        return <Alert severity='error'>{t('moduleViewer.loadModelError', 'Failed to load module content.')}</Alert>
    }

    if (clientBundleQuery.isError) {
        return <Alert severity='error'>{t('moduleViewer.loadBundleError', 'Failed to load the widget client bundle.')}</Alert>
    }

    if (!selectedScript || !moduleModel) {
        return (
            <Card variant='outlined'>
                <CardHeader title={widgetConfig.emptyStateTitle || t('moduleViewer.emptyTitle', 'Module viewer is not configured')} />
                <CardContent>
                    <Typography variant='body2' color='text.secondary'>
                        {widgetConfig.emptyStateDescription ||
                            t(
                                'moduleViewer.emptyDescription',
                                'Attach an active widget script to the current catalog or metahub and expose a mount() method to render module content here.'
                            )}
                    </Typography>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card variant='outlined'>
            <LinearProgress variant='determinate' value={progressValue} />
            <CardHeader title={moduleModel.title} subheader={moduleModel.description || undefined} />
            <CardContent>
                <Stack spacing={2}>
                    <Stack direction='row' spacing={1.5} alignItems='center' justifyContent='space-between'>
                        <Typography variant='overline'>
                            {t('moduleViewer.itemOf', {
                                defaultValue: 'Item {{current}} of {{total}}',
                                current: currentIndex + 1,
                                total: totalItems
                            })}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                            {Math.round(progressValue)}%
                        </Typography>
                    </Stack>

                    {currentItem ? (
                        <Box>
                            {currentItem.itemTitle ? (
                                <Typography variant='h6' sx={{ mb: 1.5 }}>
                                    {currentItem.itemTitle}
                                </Typography>
                            ) : null}

                            {currentItem.itemType === 'text' && currentItem.itemContent ? (
                                <Typography variant='body1' sx={{ whiteSpace: 'pre-wrap' }}>
                                    {currentItem.itemContent}
                                </Typography>
                            ) : null}

                            {currentItem.itemType === 'image' && currentItem.itemContent ? (
                                <Box
                                    component='img'
                                    src={currentItem.itemContent}
                                    alt={currentItem.itemTitle || 'Image'}
                                    sx={{ maxWidth: '100%', borderRadius: 1 }}
                                />
                            ) : null}

                            {currentItem.itemType === 'video_url' && currentItem.itemContent ? (
                                <Box sx={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: 1 }}>
                                    <iframe
                                        src={currentItem.itemContent}
                                        title={currentItem.itemTitle || 'Video'}
                                        allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture'
                                        allowFullScreen
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 0 }}
                                    />
                                </Box>
                            ) : null}

                            {currentItem.itemType === 'quiz_ref' && currentItem.quizId ? (
                                <QuizWidget config={{ attachedToKind: 'metahub', quizId: currentItem.quizId }} />
                            ) : null}
                        </Box>
                    ) : null}

                    <Stack direction='row' spacing={1} justifyContent='flex-end'>
                        <Button variant='text' onClick={() => setCurrentIndex(0)} disabled={currentIndex === 0}>
                            {t('moduleViewer.restart', 'Restart')}
                        </Button>
                        <Button variant='outlined' onClick={goToPrevious} disabled={currentIndex === 0}>
                            {t('moduleViewer.previous', 'Previous')}
                        </Button>
                        <Button variant='contained' onClick={goToNext} disabled={currentIndex >= totalItems - 1}>
                            {t('moduleViewer.next', 'Next')}
                        </Button>
                    </Stack>
                </Stack>
            </CardContent>
        </Card>
    )
}
