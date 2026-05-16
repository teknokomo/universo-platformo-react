import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded'
import AudiotrackRoundedIcon from '@mui/icons-material/AudiotrackRounded'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded'
import FileOpenRoundedIcon from '@mui/icons-material/FileOpenRounded'
import InsertLinkRoundedIcon from '@mui/icons-material/InsertLinkRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import PlayCircleRoundedIcon from '@mui/icons-material/PlayCircleRounded'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import type { ResourceSource } from '@universo/types'
import { isAllowedEmbedUrl, isDeferredResourceSource, resourceSourceSchema } from '@universo/types'

export type ResourcePreviewProps = {
    source: unknown
    title?: string
    description?: string
    onOpenPage?: (pageCodename: string) => void
}

type ParsedResourceState =
    | { kind: 'invalid'; message: string }
    | { kind: 'deferred'; source: ResourceSource }
    | { kind: 'ready'; source: ResourceSource }

const parseResourceSource = (source: unknown): ParsedResourceState => {
    const parsed = resourceSourceSchema.safeParse(source)
    if (!parsed.success) {
        return { kind: 'invalid', message: parsed.error.issues[0]?.message ?? 'Invalid resource source.' }
    }

    if (isDeferredResourceSource(parsed.data)) {
        return { kind: 'deferred', source: parsed.data }
    }

    return { kind: 'ready', source: parsed.data }
}

const getResourceIcon = (source?: ResourceSource): ReactNode => {
    switch (source?.type) {
        case 'page':
            return <ArticleRoundedIcon fontSize='small' />
        case 'video':
            return <PlayCircleRoundedIcon fontSize='small' />
        case 'audio':
            return <AudiotrackRoundedIcon fontSize='small' />
        case 'document':
            return <DescriptionRoundedIcon fontSize='small' />
        case 'url':
        case 'embed':
            return <InsertLinkRoundedIcon fontSize='small' />
        case 'file':
        case 'scorm':
        case 'xapi':
            return <FileOpenRoundedIcon fontSize='small' />
        default:
            return <ErrorOutlineRoundedIcon fontSize='small' />
    }
}

const frameSx = {
    width: '100%',
    border: 0,
    borderRadius: 1,
    bgcolor: 'background.default'
}

function ResourcePreviewBody({ source, onOpenPage }: { source: ResourceSource; onOpenPage?: (pageCodename: string) => void }) {
    const { t } = useTranslation()

    if (source.type === 'page') {
        return (
            <Button
                variant='outlined'
                size='small'
                startIcon={<ArticleRoundedIcon />}
                onClick={() => (source.pageCodename ? onOpenPage?.(source.pageCodename) : undefined)}
                disabled={!source.pageCodename || !onOpenPage}
                sx={{ alignSelf: 'flex-start' }}
            >
                {t('resourcePreview.openPage', 'Open page')}
            </Button>
        )
    }

    if (source.type === 'video' && source.url) {
        return (
            <Box
                component='video'
                controls
                preload='metadata'
                src={source.url}
                sx={{ ...frameSx, aspectRatio: '16 / 9', maxHeight: 480 }}
            />
        )
    }

    if (source.type === 'audio' && source.url) {
        return <Box component='audio' controls preload='metadata' src={source.url} sx={{ width: '100%' }} />
    }

    if (source.type === 'document' && source.url) {
        return (
            <Box
                component='iframe'
                title={t('resourcePreview.documentFrameTitle', 'Document preview')}
                src={source.url}
                sandbox=''
                referrerPolicy='no-referrer'
                sx={{ ...frameSx, minHeight: 480 }}
            />
        )
    }

    if (source.type === 'embed' && source.url && isAllowedEmbedUrl(source.url)) {
        return (
            <Box
                component='iframe'
                title={t('resourcePreview.embedFrameTitle', 'Embedded resource')}
                src={source.url}
                sandbox='allow-scripts allow-same-origin allow-presentation'
                allow='fullscreen; picture-in-picture'
                referrerPolicy='strict-origin-when-cross-origin'
                sx={{ ...frameSx, aspectRatio: '16 / 9', minHeight: 240 }}
            />
        )
    }

    if ((source.type === 'url' || source.type === 'document' || source.type === 'embed') && source.url) {
        return (
            <Button
                component='a'
                href={source.url}
                target='_blank'
                rel='noopener noreferrer'
                variant='outlined'
                size='small'
                startIcon={<OpenInNewRoundedIcon />}
                sx={{ alignSelf: 'flex-start' }}
            >
                {t('resourcePreview.openExternal', 'Open')}
            </Button>
        )
    }

    return null
}

export function ResourcePreview({ source, title, description, onOpenPage }: ResourcePreviewProps) {
    const { t } = useTranslation()
    const parsed = parseResourceSource(source)
    const readySource = parsed.kind === 'ready' ? parsed.source : parsed.kind === 'deferred' ? parsed.source : undefined

    return (
        <Stack
            data-testid='resource-preview'
            spacing={1.5}
            sx={{
                width: '100%',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                p: { xs: 2, md: 2.5 }
            }}
        >
            <Stack direction='row' spacing={1} alignItems='center'>
                {getResourceIcon(readySource)}
                <Box sx={{ minWidth: 0 }}>
                    <Typography variant='subtitle1' sx={{ fontWeight: 700 }} noWrap>
                        {title || t('resourcePreview.defaultTitle', 'Resource')}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                        {readySource?.type ?? t('resourcePreview.unknownType', 'Unknown type')}
                    </Typography>
                </Box>
            </Stack>

            {description ? (
                <Typography variant='body2' color='text.secondary'>
                    {description}
                </Typography>
            ) : null}

            {parsed.kind === 'invalid' ? (
                <Typography role='alert' variant='body2' color='error'>
                    {t('resourcePreview.invalidSource', 'This resource source is not valid.')}: {parsed.message}
                </Typography>
            ) : parsed.kind === 'deferred' ? (
                <Typography role='status' variant='body2' color='text.secondary'>
                    {t('resourcePreview.deferredSource', 'This resource type is configured but its runtime player is not available yet.')}
                </Typography>
            ) : (
                <ResourcePreviewBody source={parsed.source} onOpenPage={onOpenPage} />
            )}
        </Stack>
    )
}
