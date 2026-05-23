import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Link from '@mui/material/Link'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { extractPageBlockOutline } from '@universo/types'
import type { RuntimePageBlock } from '@universo/types'

type EmbedBlock = Extract<RuntimePageBlock, { type: 'embed' }>
type HeaderBlock = Extract<RuntimePageBlock, { type: 'header' }>
type ImageBlock = Extract<RuntimePageBlock, { type: 'image' }>
type ListBlock = Extract<RuntimePageBlock, { type: 'list' }>
type TableBlock = Extract<RuntimePageBlock, { type: 'table' }>
type ParagraphBlock = Extract<RuntimePageBlock, { type: 'paragraph' }>
type QuoteBlock = Extract<RuntimePageBlock, { type: 'quote' }>
type CompleteButtonMode = 'manual' | 'autoAfterOpen' | 'hidden'

export type PageBlocksViewProps = {
    blocks: RuntimePageBlock[]
    showOutline?: boolean
    showProgressHeader?: boolean
    completeButtonMode?: CompleteButtonMode
    progressStorageKey?: string
    onProgressChange?: (payload: { action: 'view' | 'complete' }) => Promise<void> | void
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))

const resolveLocalizedText = (value: unknown, locale: string): string => {
    if (typeof value === 'string') return value
    if (!isRecord(value)) return ''

    const locales = isRecord(value.locales) ? value.locales : null
    const primary = typeof value._primary === 'string' ? value._primary : 'en'
    const candidates = [locale.split(/[-_]/)[0], locale, primary, 'en', 'ru'].filter(Boolean)

    for (const candidate of candidates) {
        const localeValue = locales?.[candidate]
        if (isRecord(localeValue) && typeof localeValue.content === 'string' && localeValue.content.trim().length > 0) {
            return localeValue.content
        }
    }

    return ''
}

const readStoredProgress = (storageKey: string | undefined): number => {
    if (!storageKey || typeof window === 'undefined') return 0
    try {
        const raw = window.localStorage.getItem(storageKey)
        if (!raw) return 0
        const parsed = Number(raw)
        return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : 0
    } catch {
        return 0
    }
}

const writeStoredProgress = (storageKey: string | undefined, value: number) => {
    if (!storageKey || typeof window === 'undefined') return
    try {
        window.localStorage.setItem(storageKey, String(Math.max(0, Math.min(100, Math.round(value)))))
    } catch {
        // Local progress is best-effort until server-owned learner progress is implemented.
    }
}

function renderBlock(block: RuntimePageBlock, locale: string, index: number): ReactNode {
    const id = typeof block.id === 'string' ? block.id : undefined
    const blockKey = id ?? JSON.stringify(block)

    if (block.type === 'header') {
        const data: HeaderBlock['data'] = block.data
        const level = Math.max(2, Math.min(4, data.level ?? 3))
        const variant = level === 2 ? 'h5' : level === 3 ? 'h6' : 'subtitle1'
        const component = level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
        return (
            <Typography
                key={blockKey}
                id={id ?? `runtime-page-heading-${index}`}
                component={component}
                variant={variant}
                sx={{ fontWeight: 700, scrollMarginTop: 80 }}
            >
                {resolveLocalizedText(data.text, locale)}
            </Typography>
        )
    }

    if (block.type === 'list') {
        const data: ListBlock['data'] = block.data
        const component = data.style === 'ordered' ? 'ol' : 'ul'
        return (
            <Box key={blockKey} component={component} sx={{ m: 0, pl: 3 }}>
                {data.items.map((item, index) => (
                    <Typography key={index} component='li' variant='body1' sx={{ mb: 0.5 }}>
                        {resolveLocalizedText(item, locale)}
                    </Typography>
                ))}
            </Box>
        )
    }

    if (block.type === 'table') {
        const data: TableBlock['data'] = block.data
        const rows = data.content
        const [headRow, ...bodyRows] = rows
        const renderedBodyRows = data.withHeadings ? bodyRows : rows

        return (
            <TableContainer key={blockKey} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size='small'>
                    {data.withHeadings && headRow ? (
                        <TableHead>
                            <TableRow>
                                {headRow.map((cell, index) => (
                                    <TableCell key={index} sx={{ fontWeight: 700 }}>
                                        {resolveLocalizedText(cell, locale)}
                                    </TableCell>
                                ))}
                            </TableRow>
                        </TableHead>
                    ) : null}
                    <TableBody>
                        {renderedBodyRows.map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                                {row.map((cell, cellIndex) => (
                                    <TableCell key={cellIndex}>{resolveLocalizedText(cell, locale)}</TableCell>
                                ))}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        )
    }

    if (block.type === 'image') {
        const data: ImageBlock['data'] = block.data
        const alt = resolveLocalizedText(data.alt ?? data.caption ?? '', locale)
        const caption = resolveLocalizedText(data.caption ?? '', locale)
        return (
            <Stack key={blockKey} spacing={0.75}>
                <Box
                    component='img'
                    src={data.url}
                    alt={alt}
                    loading='lazy'
                    sx={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 1, bgcolor: 'background.default' }}
                />
                {caption ? (
                    <Typography variant='caption' color='text.secondary'>
                        {caption}
                    </Typography>
                ) : null}
            </Stack>
        )
    }

    if (block.type === 'embed') {
        const data: EmbedBlock['data'] = block.data
        const caption = resolveLocalizedText(data.caption ?? '', locale) || data.url
        return (
            <Link key={blockKey} href={data.url} target='_blank' rel='noopener noreferrer' underline='hover'>
                {caption}
            </Link>
        )
    }

    if (block.type === 'delimiter') {
        return <Box key={blockKey} component='hr' sx={{ width: '100%', border: 0, borderTop: 1, borderColor: 'divider' }} />
    }

    if (block.type === 'quote') {
        const data: QuoteBlock['data'] = block.data
        const caption = resolveLocalizedText(data.caption ?? '', locale)
        return (
            <Stack key={blockKey} spacing={0.5}>
                <Typography
                    variant='body1'
                    color='text.secondary'
                    sx={{ borderLeft: 3, borderColor: 'divider', pl: 2, fontStyle: 'italic' }}
                >
                    {resolveLocalizedText(data.text, locale)}
                </Typography>
                {caption ? (
                    <Typography variant='caption' color='text.secondary'>
                        {caption}
                    </Typography>
                ) : null}
            </Stack>
        )
    }

    if (block.type === 'paragraph') {
        const data: ParagraphBlock['data'] = block.data
        return (
            <Typography key={blockKey} variant='body1' color='text.secondary'>
                {resolveLocalizedText(data.text, locale)}
            </Typography>
        )
    }

    return null
}

export default function PageBlocksView({
    blocks,
    showOutline = true,
    showProgressHeader = false,
    completeButtonMode = 'manual',
    progressStorageKey,
    onProgressChange
}: PageBlocksViewProps) {
    const { i18n, t } = useTranslation('apps')
    const locale = i18n.language || 'en'
    const visibleBlocks = useMemo(() => blocks.filter((block) => isRecord(block)), [blocks])
    const outline = useMemo(() => extractPageBlockOutline(visibleBlocks, { locale, maxLevel: 3 }), [locale, visibleBlocks])
    const [readingProgress, setReadingProgress] = useState(() => readStoredProgress(progressStorageKey))
    const persistedViewKeyRef = useRef<string | null>(null)

    const persistProgress = useCallback(
        (action: 'view' | 'complete') => {
            if (!onProgressChange) return
            void Promise.resolve(onProgressChange({ action })).catch(() => undefined)
        },
        [onProgressChange]
    )

    useEffect(() => {
        setReadingProgress(readStoredProgress(progressStorageKey))
    }, [progressStorageKey])

    useEffect(() => {
        if (!onProgressChange || visibleBlocks.length === 0) return
        const viewKey = progressStorageKey ?? `blocks:${visibleBlocks.length}`
        if (persistedViewKeyRef.current === viewKey) return
        persistedViewKeyRef.current = viewKey
        persistProgress('view')
    }, [onProgressChange, persistProgress, progressStorageKey, visibleBlocks.length])

    useEffect(() => {
        if (completeButtonMode !== 'autoAfterOpen' || visibleBlocks.length === 0) return
        setReadingProgress(100)
        writeStoredProgress(progressStorageKey, 100)
        persistProgress('complete')
    }, [completeButtonMode, persistProgress, progressStorageKey, visibleBlocks.length])

    const handleMarkComplete = () => {
        setReadingProgress(100)
        writeStoredProgress(progressStorageKey, 100)
        persistProgress('complete')
    }

    if (visibleBlocks.length === 0) {
        return null
    }

    return (
        <Stack
            data-testid='runtime-page-blocks'
            spacing={1.5}
            sx={{
                width: '100%',
                bgcolor: 'background.paper',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                p: { xs: 2, md: 3 }
            }}
        >
            {showProgressHeader ? (
                <Stack data-testid='runtime-page-progress' spacing={0.75} sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant='subtitle2'>
                                {t('pageBlocks.progress', {
                                    defaultValue: 'Reading progress {{progress}}%',
                                    progress: readingProgress
                                })}
                            </Typography>
                            <LinearProgress
                                aria-label={t('pageBlocks.progressLabel', 'Reading progress')}
                                variant='determinate'
                                value={readingProgress}
                                sx={{ mt: 0.75 }}
                            />
                        </Box>
                        {completeButtonMode === 'manual' && readingProgress < 100 ? (
                            <Button size='small' variant='outlined' onClick={handleMarkComplete}>
                                {t('pageBlocks.markComplete', 'Mark complete')}
                            </Button>
                        ) : null}
                    </Stack>
                </Stack>
            ) : null}
            {showOutline && outline.length > 1 ? (
                <Stack data-testid='runtime-page-outline' spacing={0.75} sx={{ pb: 1, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant='subtitle2'>{t('pageBlocks.outline', 'Outline')}</Typography>
                    <Stack direction='row' flexWrap='wrap' gap={1}>
                        {outline.map((item) => (
                            <Link
                                key={item.id}
                                href={`#${item.id}`}
                                underline='hover'
                                variant='body2'
                                sx={{ pl: Math.max(0, item.level - 2), color: 'text.secondary' }}
                            >
                                {item.text}
                            </Link>
                        ))}
                    </Stack>
                </Stack>
            ) : null}
            {visibleBlocks.map((block, index) => renderBlock(block, locale, index))}
        </Stack>
    )
}
