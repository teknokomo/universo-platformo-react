import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { RuntimePageBlock } from '@universo/types'

type EmbedBlock = Extract<RuntimePageBlock, { type: 'embed' }>
type HeaderBlock = Extract<RuntimePageBlock, { type: 'header' }>
type ImageBlock = Extract<RuntimePageBlock, { type: 'image' }>
type ListBlock = Extract<RuntimePageBlock, { type: 'list' }>
type TableBlock = Extract<RuntimePageBlock, { type: 'table' }>
type ParagraphBlock = Extract<RuntimePageBlock, { type: 'paragraph' }>
type QuoteBlock = Extract<RuntimePageBlock, { type: 'quote' }>

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

function renderBlock(block: RuntimePageBlock, locale: string): ReactNode {
    const id = typeof block.id === 'string' ? block.id : undefined

    if (block.type === 'header') {
        const data: HeaderBlock['data'] = block.data
        const level = Math.max(2, Math.min(4, data.level ?? 3))
        const variant = level === 2 ? 'h5' : level === 3 ? 'h6' : 'subtitle1'
        const component = level === 2 ? 'h2' : level === 3 ? 'h3' : 'h4'
        return (
            <Typography key={id ?? JSON.stringify(block)} component={component} variant={variant} sx={{ fontWeight: 700 }}>
                {resolveLocalizedText(data.text, locale)}
            </Typography>
        )
    }

    if (block.type === 'list') {
        const data: ListBlock['data'] = block.data
        const component = data.style === 'ordered' ? 'ol' : 'ul'
        return (
            <Box key={id ?? JSON.stringify(block)} component={component} sx={{ m: 0, pl: 3 }}>
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
            <TableContainer key={id ?? JSON.stringify(block)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
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
            <Stack key={id ?? JSON.stringify(block)} spacing={0.75}>
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
            <Link key={id ?? JSON.stringify(block)} href={data.url} target='_blank' rel='noopener noreferrer' underline='hover'>
                {caption}
            </Link>
        )
    }

    if (block.type === 'delimiter') {
        return (
            <Box key={id ?? JSON.stringify(block)} component='hr' sx={{ width: '100%', border: 0, borderTop: 1, borderColor: 'divider' }} />
        )
    }

    if (block.type === 'quote') {
        const data: QuoteBlock['data'] = block.data
        const caption = resolveLocalizedText(data.caption ?? '', locale)
        return (
            <Stack key={id ?? JSON.stringify(block)} spacing={0.5}>
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
            <Typography key={id ?? JSON.stringify(block)} variant='body1' color='text.secondary'>
                {resolveLocalizedText(data.text, locale)}
            </Typography>
        )
    }

    return null
}

export default function PageBlocksView({ blocks }: { blocks: RuntimePageBlock[] }) {
    const { i18n } = useTranslation()
    const locale = i18n.language || 'en'
    const visibleBlocks = blocks.filter((block) => isRecord(block))

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
            {visibleBlocks.map((block) => renderBlock(block, locale))}
        </Stack>
    )
}
