// Universo Platformo | Publish Version Section Component
// Component for publishing specific canvas versions

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
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
    onVersionGroupResolved?: (versionGroupId: string) => void
}

export const PublishVersionSection: React.FC<PublishVersionSectionProps> = ({
    unikId,
    spaceId,
    canvasId,
    versionGroupId,
    technology,
    onVersionGroupResolved
}) => {
    const { t } = useTranslation('publish')
    const [allVersions, setAllVersions] = useState<CanvasVersion[]>([])
    const [selectedVersion, setSelectedVersion] = useState('')
    const [publishedLinks, setPublishedLinks] = useState<PublishLinkRecord[]>([])
    const [loading, setLoading] = useState(false)
    const [publishing, setPublishing] = useState(false)
    const [snackbar, setSnackbar] = useState({ open: false, message: '' })
    const [versionsLoaded, setVersionsLoaded] = useState(false)
    const linksStatusRef = useRef({
        loading: false,
        abortController: null as AbortController | null
    })

    const loadVersions = useCallback(async () => {
        setVersionsLoaded(false)
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

    useEffect(() => {
        setPublishedLinks([])
        setVersionsLoaded(false)
        void loadVersions()
    }, [loadVersions, unikId, spaceId, canvasId, technology])

    const versionIds = useMemo(
        () => new Set(allVersions.map((version) => version.id).filter((id): id is string => Boolean(id))),
        [allVersions]
    )

    const publishedVersionUuids = useMemo(
        () => new Set(allVersions.map((version) => version.versionUuid).filter((uuid): uuid is string => Boolean(uuid))),
        [allVersions]
    )

    const inferredVersionGroupId = useMemo(() => {
        if (versionGroupId) {
            return versionGroupId
        }

        const withGroup = allVersions.find((version) => version.versionGroupId)
        return withGroup?.versionGroupId ?? null
    }, [versionGroupId, allVersions])

    useEffect(() => {
        if (!versionGroupId && inferredVersionGroupId && onVersionGroupResolved) {
            onVersionGroupResolved(inferredVersionGroupId)
        }
    }, [versionGroupId, inferredVersionGroupId, onVersionGroupResolved])

    const loadPublishedLinks = useCallback(async () => {
        if (!versionsLoaded) {
            return []
        }

        if (!inferredVersionGroupId && allVersions.length === 0) {
            setPublishedLinks([])
            return []
        }

        // Prevent race conditions
        if (linksStatusRef.current.loading) {
            return []
        }

        // Cancel previous request if still pending
        if (linksStatusRef.current.abortController) {
            linksStatusRef.current.abortController.abort()
        }

        const abortController = new AbortController()
        linksStatusRef.current.loading = true
        linksStatusRef.current.abortController = abortController

        try {
            // Fetch by technology only; do not constrain by versionGroupId here to avoid missing links
            const links = await PublishLinksApi.listLinks({ technology }, { signal: abortController.signal })

            const relevantLinks = links.filter((link) => {
                // Only process version-type links
                if (link.targetType !== 'version') {
                    return false
                }

                // For version links, we want to show ALL versions for this canvas
                // Simplified logic: if it's a version link and belongs to this canvas, show it
                if (link.targetCanvasId && versionIds.has(String(link.targetCanvasId))) {
                    return true
                }

                // Fallback: check by version UUID (if we have this version loaded)
                if (link.targetVersionUuid && publishedVersionUuids.has(link.targetVersionUuid)) {
                    return true
                }

                // Additional check by version group ID (if specified)
                const effectiveGroupId = versionGroupId ?? inferredVersionGroupId
                if (effectiveGroupId && link.versionGroupId === effectiveGroupId) {
                    return true
                }

                return false
            })

            setPublishedLinks(relevantLinks)
            return relevantLinks
        } catch (error: any) {
            if (error.name === 'AbortError' || error.name === 'CanceledError') {
                return []
            }
            console.error('Failed to load published links:', error)
            return []
        } finally {
            linksStatusRef.current.loading = false
            linksStatusRef.current.abortController = null
        }
    }, [technology, versionGroupId, inferredVersionGroupId, versionsLoaded, versionIds, publishedVersionUuids, allVersions.length])

    // Load published links after versions are loaded
    // This fixes the race condition where mount-only effect runs before versionsLoaded is true
    useEffect(() => {
        if (versionsLoaded) {
            void loadPublishedLinks()
        }
    }, [versionsLoaded, loadPublishedLinks])

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
            const previousLinksCount = publishedLinks.length
            await PublishLinksApi.createVersionLink(targetVersion.id, targetVersion.versionUuid, technology)
            // Reload versions first to update publishedVersionUuids, then reload links
            await loadVersions()
            let updatedLinks = await loadPublishedLinks()
            // Retry a few times in case backend is eventually consistent
            if (!updatedLinks || updatedLinks.length <= previousLinksCount) {
                for (let attempt = 1; attempt <= 3; attempt++) {
                    await new Promise((r) => setTimeout(r, 300 * attempt))
                    updatedLinks = await loadPublishedLinks()
                    if (updatedLinks && updatedLinks.length > previousLinksCount) break
                }
            }
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
            // Reload versions first to update publishedVersionUuids, then reload links
            await loadVersions()
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

            let friendlyLabel: string
            if (version?.versionLabel && version.versionLabel.trim().length > 0) {
                friendlyLabel = version.versionLabel
            } else if (typeof version?.versionIndex === 'number') {
                friendlyLabel = `${t('versions.versionLabel')} ${version.versionIndex}`
            } else if (link.targetVersionUuid) {
                const shortUuid = String(link.targetVersionUuid).slice(-6)
                friendlyLabel = `${t('versions.versionLabel')} • ${shortUuid}`
            } else {
                friendlyLabel = t('versions.unknownVersion')
            }

            return {
                link,
                label: friendlyLabel,
                createdAtLabel
            }
        })
    }, [allVersions, publishedLinks, t])

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

    const showVersionGroupNotice = versionsLoaded && !inferredVersionGroupId

    return (
        <>
            {/* Create Version Link Card */}
            <Box
                sx={{
                    mt: 3,
                    p: 2,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'background.paper'
                }}
            >
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
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
            </Box>

            {/* Published Version Links List Card */}
            {publishedVersionItems.length > 0 && (
                <Box
                    sx={{
                        mt: 2,
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper'
                    }}
                >
                    <Typography variant='h6' gutterBottom>
                        {t('versions.publishedVersions')}
                    </Typography>
                    <List dense>
                        {publishedVersionItems.map(({ link, label, createdAtLabel }) => {
                            const versionInfo = `${t('versions.versionLabel')}: ${label}`
                            const urlInfo = `/b/${link.baseSlug}`
                            const secondary = createdAtLabel ? `${urlInfo} • ${createdAtLabel}` : urlInfo
                            return (
                                <ListItem
                                    key={link.id}
                                    secondaryAction={
                                        <>
                                            <IconButton size='small' onClick={() => handleCopy(link.baseSlug)} title={t('links.copy')}>
                                                <ContentCopyIcon fontSize='small' />
                                            </IconButton>
                                            <IconButton size='small' onClick={() => handleOpen(link.baseSlug)} title={t('links.open')}>
                                                <OpenInNewIcon fontSize='small' />
                                            </IconButton>
                                            <IconButton size='small' onClick={() => handleDelete(link.id)} title={t('general.delete')}>
                                                <DeleteIcon fontSize='small' />
                                            </IconButton>
                                        </>
                                    }
                                >
                                    <ListItemText primary={versionInfo} secondary={secondary} />
                                </ListItem>
                            )
                        })}
                    </List>
                </Box>
            )}

            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() => setSnackbar({ ...snackbar, open: false })}
                message={snackbar.message}
            />
        </>
    )
}
