// Universo Platformo | Publish Version Section Component
// Component for publishing specific canvas versions

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
    Box,
    Typography,
    Select,
    MenuItem,
    Button,
    List,
    ListItem,
    ListItemText,
    IconButton,
    CircularProgress,
    Alert,
    Snackbar
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'
import { PublishLinksApi, canvasVersionsApi, type CanvasVersion, type PublishLinkRecord } from '../api'

interface PublishVersionSectionProps {
    unikId: string
    spaceId: string
    canvasId: string
    versionGroupId?: string | null
    technology: 'arjs' | 'playcanvas'
}

export const PublishVersionSection: React.FC<PublishVersionSectionProps> = ({ unikId, spaceId, canvasId, versionGroupId, technology }) => {
    const { t } = useTranslation('publish')
    const [allVersions, setAllVersions] = useState<CanvasVersion[]>([])
    const [selectedVersion, setSelectedVersion] = useState('')
    const [publishedLinks, setPublishedLinks] = useState<PublishLinkRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    const [versionsLoaded, setVersionsLoaded] = useState(false)

    const loadVersions = useCallback(async () => {
        setLoading(true)
        try {
            const data = await canvasVersionsApi.listVersions(unikId, spaceId, canvasId)
            setAllVersions(data)
        } catch (error) {
            console.error('Failed to load versions:', error)
            setSnackbar({ open: true, message: t('versions.versionPublishError') })
        } finally {
            setLoading(false)
            setVersionsLoaded(true)
        }
    }, [unikId, spaceId, canvasId, t])

    const loadPublishedLinks = useCallback(async () => {
        if (!versionsLoaded) {
            return
        }

        if (!versionGroupId && allVersions.length === 0) {
            setPublishedLinks([])
            return
        }

        try {
            const versionIds = new Set(allVersions.map((version) => version.id))
            const links = await PublishLinksApi.listLinks(
                versionGroupId
                    ? { versionGroupId, technology }
                    : { technology }
            )

            const relevantLinks = links.filter((link) => {
                if (link.targetType !== 'version') {
                    return false
                }

                if (versionGroupId && link.versionGroupId === versionGroupId) {
                    return true
                }

                if (link.targetCanvasId && versionIds.has(link.targetCanvasId)) {
                    return true
                }

                if (link.targetVersionUuid) {
                    return allVersions.some((version) => version.versionUuid === link.targetVersionUuid)
                }

                return false
            })

            setPublishedLinks(relevantLinks)
        } catch (error) {
            console.error('Failed to load published links:', error)
        }
    }, [allVersions, technology, versionGroupId, versionsLoaded])

    useEffect(() => {
        loadVersions()
    }, [loadVersions])

    useEffect(() => {
        loadPublishedLinks()
    }, [loadPublishedLinks])

    const handlePublish = async () => {
        if (!selectedVersion) return

        const targetVersion = allVersions.find((version) => version.versionUuid === selectedVersion)
        if (!targetVersion || !targetVersion.id) {
            console.error('Selected version not found or missing canvas id', { selectedVersion })
            setSnackbar({ open: true, message: t('versions.versionPublishError') })
            return
        }

        setPublishing(true)
        try {
            await PublishLinksApi.createVersionLink(targetVersion.id, targetVersion.versionUuid, technology)
            await loadPublishedLinks()
            setSelectedVersion('')
            setSnackbar({ open: true, message: t('versions.versionPublished') })
        } catch (error) {
            console.error('Failed to publish version:', error)
            setSnackbar({ open: true, message: t('versions.versionPublishError') })
        } finally {
            setPublishing(false)
        }
    }

    const handleDelete = async (linkId: string) => {
        try {
            await PublishLinksApi.deleteLink(linkId)
            await loadPublishedLinks()
            setSnackbar({ open: true, message: t('versions.versionUnpublished') })
        } catch (error) {
            console.error('Failed to delete publication:', error)
            setSnackbar({ open: true, message: t('versions.versionPublishError') })
        }
    }

    const handleCopy = (slug: string) => {
        const url = `${window.location.origin}/b/${slug}`
        navigator.clipboard.writeText(url)
        setSnackbar({ open: true, message: t('success.copied') })
    }

    const handleOpen = (slug: string) => {
        window.open(`/b/${slug}`, '_blank', 'noopener,noreferrer')
    }

    const publishedVersionItems = useMemo(() => {
        if (!publishedLinks.length) {
            return []
        }

        return publishedLinks.map((link) => {
            const version = allVersions.find((v) => v.versionUuid === link.targetVersionUuid)
            const createdAtLabel = version?.createdAt ? new Date(version.createdAt).toLocaleString() : null

            return {
                link,
                label: version?.versionLabel || 'Unknown version',
                createdAtLabel
            }
        })
    }, [allVersions, publishedLinks])

    useEffect(() => {
        if (!selectedVersion) {
            return
        }

        const stillExists = allVersions.some((version) => version.versionUuid === selectedVersion)
        if (!stillExists) {
            setSelectedVersion('')
        }
    }, [allVersions, selectedVersion])

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress />
            </Box>
        )
    }

    const showVersionGroupNotice = !versionGroupId && allVersions.length === 0

    return (
        <>
            <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                {showVersionGroupNotice && (
                    <Alert severity='warning' sx={{ mb: 2 }}>
                        {t('versions.groupMissing')}
                    </Alert>
                )}
                <Typography variant='h6' gutterBottom>
                    {t('versions.title')}
                </Typography>

                {allVersions.length === 0 ? (
                    <Alert severity='info'>{t('versions.noVersions')}</Alert>
                ) : (
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                        <Select
                            value={selectedVersion}
                            onChange={(e) => setSelectedVersion(e.target.value)}
                            displayEmpty
                            fullWidth
                            size='small'
                        >
                            <MenuItem value='' disabled>
                                {t('versions.selectVersion')}
                            </MenuItem>
                            {allVersions.map((v) => {
                                const createdAt = v.createdAt ? new Date(v.createdAt).toLocaleString() : null
                                const baseLabel = createdAt ? `${v.versionLabel} (${createdAt})` : v.versionLabel
                                const label = v.isActive ? `${baseLabel} • ${t('versions.activeLabel')}` : baseLabel
                                return (
                                    <MenuItem key={v.versionUuid} value={v.versionUuid}>
                                        {label}
                                    </MenuItem>
                                )
                            })}
                        </Select>
                        <Button
                            variant='contained'
                            onClick={handlePublish}
                            disabled={!selectedVersion || publishing}
                            startIcon={publishing && <CircularProgress size={16} />}
                        >
                            {t('versions.publishButton')}
                        </Button>
                    </Box>
                )}

                {publishedVersionItems.length > 0 && (
                    <>
                        <Typography variant='subtitle2' sx={{ mt: 2, mb: 1 }}>
                            {t('versions.publishedVersions')}
                        </Typography>
                        <List dense>
                            {publishedVersionItems.map(({ link, label, createdAtLabel }) => {
                                const secondary = createdAtLabel
                                    ? `/b/${link.baseSlug} • ${createdAtLabel}`
                                    : `/b/${link.baseSlug}`
                                return (
                                    <ListItem
                                        key={link.id}
                                        secondaryAction={
                                            <>
                                                <IconButton size='small' onClick={() => handleCopy(link.baseSlug)}>
                                                    <ContentCopyIcon fontSize='small' />
                                                </IconButton>
                                                <IconButton size='small' onClick={() => handleOpen(link.baseSlug)}>
                                                    <OpenInNewIcon fontSize='small' />
                                                </IconButton>
                                                <IconButton size='small' onClick={() => handleDelete(link.id)}>
                                                    <DeleteIcon fontSize='small' />
                                                </IconButton>
                                            </>
                                        }
                                    >
                                        <ListItemText
                                            primary={label}
                                            secondary={secondary}
                                        />
                                    </ListItem>
                                )
                            })}
                        </List>
                    </>
                )}
            </Box>

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            />
        </>
    )
}
