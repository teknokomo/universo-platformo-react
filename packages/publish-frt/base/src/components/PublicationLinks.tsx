// Universo Platformo | Publication Links Component
// Displays base and custom publication slugs with copy functionality

import React, { useState } from 'react'
import { Box, TextField, Typography, IconButton, InputAdornment, Tooltip, Alert } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'

interface PublishLinkRecord {
    id: string
    baseSlug: string
    customSlug?: string | null
    targetType: 'group' | 'version'
    versionLabel?: string
    technology: string
}

interface PublicationLinksProps {
    links: PublishLinkRecord[]
    technology: 'arjs' | 'playcanvas'
}

export const PublicationLinks: React.FC<PublicationLinksProps> = ({ links, technology: _technology }) => {
    const { t } = useTranslation('publish')
    const [copied, setCopied] = useState<string | null>(null)

    const origin = typeof window !== 'undefined' ? window.location.origin : ''

    // Show ONLY base (group) links here; version links are displayed in the bottom block (PublishVersionSection)
    const groupLinks = links.filter((link) => link.targetType === 'group')

    const handleCopy = async (url: string, linkId: string) => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(linkId)
            setTimeout(() => setCopied(null), 2000)
        } catch (error) {
            console.error('Failed to copy:', error)
        }
    }

    const handleOpen = (url: string) => {
        window.open(url, '_blank', 'noopener,noreferrer')
    }

    // If there is nothing to show (no base links), render nothing
    if (groupLinks.length === 0) {
        return null
    }

    return (
        <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant='h6' gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                📤 {t('links.title', 'Publication Links')}
            </Typography>

            <Alert severity='info' sx={{ mb: 2 }}>
                {t('links.description', 'Share these links to give access to your published project')}
            </Alert>

            {/* Group Links (Permanent - Active Version) */}
            {groupLinks.map((link) => {
                const url = `${origin}/p/${link.baseSlug}`
                return (
                    <Box key={link.id} sx={{ mb: 2 }}>
                        <Typography variant='caption' color='text.secondary' sx={{ mb: 0.5, display: 'block' }}>
                            {t('links.baseLink', 'Base Link')} ({t('links.permanent', 'permanent')})
                        </Typography>
                        <TextField
                            fullWidth
                            size='small'
                            value={url}
                            InputProps={{
                                readOnly: true,
                                sx: { fontFamily: 'monospace', fontSize: '0.875rem' },
                                endAdornment: (
                                    <InputAdornment position='end'>
                                        <Tooltip title={copied === link.id ? t('links.copied', 'Copied!') : t('links.copy', 'Copy')}>
                                            <IconButton
                                                size='small'
                                                onClick={() => handleCopy(url, link.id)}
                                                color={copied === link.id ? 'success' : 'default'}
                                            >
                                                <ContentCopyIcon fontSize='small' />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={t('links.open', 'Open in new tab')}>
                                            <IconButton size='small' onClick={() => handleOpen(url)}>
                                                <OpenInNewIcon fontSize='small' />
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>
                )
            })}

            {/* Version links intentionally removed here. They are rendered in PublishVersionSection (bottom block). */}
        </Box>
    )
}
