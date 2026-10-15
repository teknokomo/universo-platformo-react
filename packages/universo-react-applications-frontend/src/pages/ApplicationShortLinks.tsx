import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Box, Button, FormControlLabel, Stack, Switch, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useHasGlobalAccess } from '@universo-react/store'
import type { GlobalShortLinkQuizAccessOption, GlobalShortLinkRecord } from '@universo-react/types'
import {
    APIEmptySVG,
    EmptyListState,
    Loader,
    PaginationControls,
    ViewHeaderMUI as ViewHeader,
    useConfirm
} from '@universo-react/template-mui'
import { useApplicationDetails } from '../api/useApplicationDetails'
import {
    buildPublicGuestAccessUrl,
    buildGlobalShortLinkUrl,
    listGlobalShortLinks,
    listGlobalShortLinkQuizAccessOptions,
    listGlobalShortLinkResourceOptions,
    releaseGlobalShortLink
} from '../api/globalShortLinksApi'
import { globalShortLinksQueryKeys, invalidateGlobalShortLinks } from '../api/globalShortLinksQueryKeys'
import {
    getGlobalShortLinkErrorTranslationKey,
    GuestAccessLinksTable,
    ShortLinkCreator,
    ShortLinksTable,
    type ShortLinkFeedback
} from './ApplicationShortLinksSections'

const SHORT_LINKS_PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

const ApplicationShortLinks = () => {
    const { applicationId = '' } = useParams<{ applicationId: string }>()
    const navigate = useNavigate()
    const { t, i18n } = useTranslation('applications')
    const queryClient = useQueryClient()
    const { confirm } = useConfirm()
    const { isSuperuser, loading } = useHasGlobalAccess()
    const applicationQuery = useApplicationDetails(applicationId, { enabled: !loading && Boolean(applicationId) })
    const applicationRole = applicationQuery.data?.role
    const applicationAccessType = applicationQuery.data?.accessType
    const hasPermissionData = typeof applicationAccessType === 'string' && typeof applicationRole === 'string'
    const canManageTargetApplication = applicationAccessType === 'member' && (applicationRole === 'owner' || applicationRole === 'admin')
    const permissionLoading = loading || applicationQuery.isLoading || (!hasPermissionData && applicationQuery.isFetching)
    const canRead = !permissionLoading && (isSuperuser || canManageTargetApplication)
    const isPublicApplication = applicationQuery.data?.isPublic === true
    const canCreate = canRead && isPublicApplication
    const canRelease = canRead
    const workspacesEnabled = applicationQuery.data?.workspacesEnabled === true
    const locale = (i18n.resolvedLanguage ?? i18n.language).toLowerCase().startsWith('ru') ? 'ru' : 'en'

    const [includeReleased, setIncludeReleased] = useState(false)
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(20)
    const [feedback, setFeedback] = useState<ShortLinkFeedback | null>(null)

    const offset = page * pageSize
    const listInput = { applicationId, includeReleased, limit: pageSize, offset }
    const linksQuery = useQuery({
        queryKey: globalShortLinksQueryKeys.list(listInput),
        queryFn: () => listGlobalShortLinks(listInput),
        enabled: canRead && Boolean(applicationId),
        staleTime: 30_000
    })

    const resourceOptionsQuery = useQuery({
        queryKey: globalShortLinksQueryKeys.resourceOptions({ applicationId, locale }),
        queryFn: () => listGlobalShortLinkResourceOptions({ applicationId, locale }),
        enabled:
            canRead &&
            Boolean(applicationId) &&
            linksQuery.data?.items.some((record) => record.target.kind === 'application-resource') === true,
        staleTime: 30_000
    })
    const quizAccessOptionsQuery = useQuery({
        queryKey: globalShortLinksQueryKeys.quizAccessOptions({ applicationId, locale }),
        queryFn: () => listGlobalShortLinkQuizAccessOptions({ applicationId, locale }),
        enabled: canRead && isPublicApplication && Boolean(applicationId),
        staleTime: 30_000
    })

    const handleCreated = useCallback(async () => {
        setPage(0)
        await invalidateGlobalShortLinks(queryClient, applicationId)
        setFeedback({ severity: 'success', message: t('shortLinks.messages.created') })
    }, [applicationId, queryClient, t])

    const releaseMutation = useMutation({
        mutationFn: releaseGlobalShortLink,
        onSuccess: async () => {
            await invalidateGlobalShortLinks(queryClient, applicationId)
            setFeedback({ severity: 'success', message: t('shortLinks.messages.released') })
        },
        onError: (error) => setFeedback({ severity: 'error', message: t(getGlobalShortLinkErrorTranslationKey(error)) })
    })
    const releaseLink = releaseMutation.mutate

    const handleRelease = useCallback(
        async (record: GlobalShortLinkRecord) => {
            const accepted = await confirm({
                title: t('shortLinks.release.confirmTitle'),
                description: t('shortLinks.release.confirmDescription', { slug: record.slug })
            })
            if (!accepted) return
            setFeedback(null)
            releaseLink(record.id)
        },
        [confirm, releaseLink, t]
    )

    const handleCopy = useCallback(
        async (record: GlobalShortLinkRecord) => {
            try {
                await navigator.clipboard.writeText(buildGlobalShortLinkUrl(record.slug))
                setFeedback({ severity: 'success', message: t('shortLinks.messages.copied') })
            } catch {
                setFeedback({ severity: 'error', message: t('shortLinks.errors.copy') })
            }
        },
        [t]
    )
    const handleCopyGuestAccessLink = useCallback(
        async (option: GlobalShortLinkQuizAccessOption) => {
            try {
                await navigator.clipboard.writeText(buildPublicGuestAccessUrl(applicationId, option.slug, window.location.origin))
                setFeedback({ severity: 'success', message: t('shortLinks.messages.guestLinkCopied') })
            } catch {
                setFeedback({ severity: 'error', message: t('shortLinks.errors.copyGuestLink') })
            }
        },
        [applicationId, t]
    )
    const copyRecord = useCallback((record: GlobalShortLinkRecord) => void handleCopy(record), [handleCopy])
    const copyGuestAccessLink = useCallback(
        (option: GlobalShortLinkQuizAccessOption) => void handleCopyGuestAccessLink(option),
        [handleCopyGuestAccessLink]
    )
    const releaseRecord = useCallback((record: GlobalShortLinkRecord) => void handleRelease(record), [handleRelease])

    const setPageSizeAndReset = useCallback((newPageSize: number) => {
        setPageSize(newPageSize)
        setPage(0)
    }, [])
    const paginationActions = useMemo(
        () => ({
            goToPage: (oneBasedPage: number) => setPage(Math.max(0, oneBasedPage - 1)),
            nextPage: () => setPage((currentPage) => currentPage + 1),
            previousPage: () => setPage((currentPage) => Math.max(0, currentPage - 1)),
            setPageSize: setPageSizeAndReset,
            setSearch: (_search: string) => undefined,
            setSort: (_sortBy: string, _sortOrder: 'asc' | 'desc') => undefined
        }),
        [setPageSizeAndReset]
    )

    const pageItems = linksQuery.data?.items ?? []
    const hasMore = linksQuery.data?.hasMore ?? false
    const totalItems = linksQuery.data ? (hasMore ? -1 : offset + pageItems.length) : -1
    const pagination = {
        currentPage: page + 1,
        pageSize,
        totalItems,
        totalPages: hasMore ? page + 2 : Math.max(1, Math.ceil((offset + pageItems.length) / pageSize)),
        hasNextPage: hasMore,
        hasPreviousPage: page > 0
    }

    useEffect(() => {
        if (linksQuery.isSuccess && page > 0 && pageItems.length === 0) setPage((currentPage) => Math.max(0, currentPage - 1))
    }, [linksQuery.isSuccess, page, pageItems.length])

    if (permissionLoading) return <Loader />
    if (!canRead) return <Alert severity='warning'>{t('shortLinks.noPermission')}</Alert>

    const isRecoveringEmptyPage = linksQuery.isSuccess && page > 0 && pageItems.length === 0
    const isEmpty = linksQuery.isSuccess && page === 0 && pageItems.length === 0
    const showPagination = page > 0 || pageItems.length > 0

    return (
        <Stack spacing={2} sx={{ minWidth: 0, width: '100%' }}>
            <ViewHeader title={t('shortLinks.title')} description={t('shortLinks.description')} search={false} />

            {feedback ? <Alert severity={feedback.severity}>{feedback.message}</Alert> : null}
            {linksQuery.isError ? (
                <Alert severity='error' action={<Button onClick={() => void linksQuery.refetch()}>{t('shortLinks.actions.retry')}</Button>}>
                    {t('shortLinks.errors.load')}
                </Alert>
            ) : null}

            <Box component='section' aria-labelledby='short-links-guest-links-title' sx={{ minWidth: 0 }}>
                <Stack spacing={1}>
                    <Typography id='short-links-guest-links-title' variant='h6'>
                        {t('shortLinks.guestLinks.title')}
                    </Typography>
                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                        {t('shortLinks.guestLinks.description')}
                    </Typography>
                    {!isPublicApplication ? (
                        <Alert
                            severity='warning'
                            action={
                                <Button color='inherit' size='small' onClick={() => navigate(`/a/${applicationId}/admin/settings`)}>
                                    {t('shortLinks.guestLinks.openSettings')}
                                </Button>
                            }
                        >
                            {t('shortLinks.guestLinks.publicApplicationRequired')}
                        </Alert>
                    ) : (
                        <>
                            {quizAccessOptionsQuery.isLoading ? (
                                <Typography role='status'>{t('shortLinks.guestLinks.loading')}</Typography>
                            ) : null}
                            {quizAccessOptionsQuery.isError ? (
                                <Alert
                                    severity='error'
                                    action={
                                        <Button onClick={() => void quizAccessOptionsQuery.refetch()}>
                                            {t('shortLinks.actions.retry')}
                                        </Button>
                                    }
                                >
                                    {t('shortLinks.errors.quizOptionsLoad')}
                                </Alert>
                            ) : null}
                            {quizAccessOptionsQuery.isSuccess && quizAccessOptionsQuery.data.length === 0 ? (
                                <Alert severity='info'>{t('shortLinks.guestLinks.empty')}</Alert>
                            ) : null}
                            {quizAccessOptionsQuery.isSuccess && quizAccessOptionsQuery.data.length > 0 ? (
                                <GuestAccessLinksTable
                                    applicationId={applicationId}
                                    data={quizAccessOptionsQuery.data}
                                    onCopy={copyGuestAccessLink}
                                />
                            ) : null}
                        </>
                    )}
                </Stack>
            </Box>

            <ShortLinkCreator
                applicationId={applicationId}
                canCreate={canCreate}
                workspacesEnabled={workspacesEnabled}
                onCreated={handleCreated}
                onFeedback={setFeedback}
            />

            <FormControlLabel
                control={
                    <Switch
                        checked={includeReleased}
                        onChange={(_event, checked) => {
                            setIncludeReleased(checked)
                            setPage(0)
                        }}
                    />
                }
                label={t('shortLinks.filters.includeReleased')}
            />

            {isEmpty ? (
                <EmptyListState image={APIEmptySVG} imageAlt={t('shortLinks.emptyImageAlt')} title={t('shortLinks.empty')} />
            ) : (
                <Box sx={{ maxWidth: '100%', overflowX: 'auto' }}>
                    <ShortLinksTable
                        data={pageItems}
                        quizAccessOptions={quizAccessOptionsQuery.data ?? []}
                        resourceOptions={resourceOptionsQuery.data ?? []}
                        canRelease={canRelease}
                        isLoading={linksQuery.isFetching || isRecoveringEmptyPage}
                        isReleasing={releaseMutation.isPending}
                        onCopy={copyRecord}
                        onRelease={releaseRecord}
                    />
                </Box>
            )}

            {showPagination ? (
                <Box sx={{ mx: { xs: -1.5, md: -2 }, mt: 1 }}>
                    <PaginationControls
                        pagination={pagination}
                        actions={paginationActions}
                        isLoading={linksQuery.isFetching || linksQuery.isError}
                        rowsPerPageOptions={SHORT_LINKS_PAGE_SIZE_OPTIONS}
                        namespace='common'
                    />
                </Box>
            ) : null}
        </Stack>
    )
}

export default ApplicationShortLinks
