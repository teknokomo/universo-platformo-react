// Universo Platformo | Generic component for displaying and copying publication link
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paper, Typography, IconButton, Tooltip, Box, Link } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import DoneIcon from '@mui/icons-material/Done'

interface PublicationLinkProps {
    url: string
    labelKey?: string
    helpTextKey?: string
    viewTooltipKey?: string
}

export const PublicationLink: React.FC<PublicationLinkProps> = ({
    url,
    labelKey = 'arjs.publishedUrl',
    helpTextKey = 'arjs.showMarker',
    viewTooltipKey = 'arjs.viewAR'
}) => {
    const { t } = useTranslation('publish')
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(url)
        setCopied(true)

        // Reset copied state after 3 seconds
        setTimeout(() => {
            setCopied(false)
        }, 3000)
    }

    const handleOpen = () => {
        window.open(url, '_blank')
    }

    return (
        <Paper
            elevation={0}
            variant='outlined'
            sx={{
                p: 2,
                mt: 2,
                mb: 2,
                borderRadius: 1,
                backgroundColor: 'background.default'
            }}
        >
            <Typography variant='subtitle2' component='div' gutterBottom>
                {t(labelKey)}
            </Typography>

            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    p: 1
                }}
            >
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}
                >
                    <Link href={url} target='_blank' rel='noopener' underline='hover' color='primary' sx={{ fontSize: '0.875rem' }}>
                        {url}
                    </Link>
                </Box>

                <Box sx={{ ml: 1, display: 'flex' }}>
                    <Tooltip title={copied ? t('success.copied') : t('arjs.copyLink')}>
                        <IconButton size='small' onClick={handleCopy} color={copied ? 'success' : 'default'}>
                            {copied ? <DoneIcon fontSize='small' /> : <ContentCopyIcon fontSize='small' />}
                        </IconButton>
                    </Tooltip>

                    <Tooltip title={t(viewTooltipKey)}>
                        <IconButton size='small' onClick={handleOpen} color='primary'>
                            <OpenInNewIcon fontSize='small' />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {helpTextKey && (
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                    {t(helpTextKey)}
                </Typography>
            )}
        </Paper>
    )
}

export default PublicationLink
