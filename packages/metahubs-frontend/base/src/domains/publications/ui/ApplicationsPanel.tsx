import { useState, useEffect } from 'react'
import { Stack, Typography, Box, Skeleton, List, ListItem, ListItemText, Link as MuiLink } from '@mui/material'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useTranslation } from 'react-i18next'
import type { LinkedApplication } from '../api'
import { getPublicationApplications } from '../api'
import { getVLCString } from '../../../types'

/**
 * Props for the ApplicationsPanel component
 */
interface ApplicationsPanelProps {
    /** Metahub ID */
    metahubId: string
    /** Publication ID */
    publicationId: string
    /** Current UI locale for localized fields */
    uiLocale?: string
}

/**
 * ApplicationsPanel displays the list of applications linked to this publication.
 *
 * Applications are linked via the connectors_metahubs junction table.
 * This is a read-only view showing which apps consume this publication's data.
 */
export const ApplicationsPanel = ({
    metahubId,
    publicationId,
    uiLocale = 'en'
}: ApplicationsPanelProps) => {
    const { t } = useTranslation(['metahubs', 'common'])
    const [applications, setApplications] = useState<LinkedApplication[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchApplications = async () => {
            if (!metahubId || !publicationId) return

            setIsLoading(true)
            setError(null)

            try {
                const response = await getPublicationApplications(metahubId, publicationId)
                setApplications(response.items)
            } catch (err) {
                console.error('Failed to fetch linked applications:', err)
                setError(err instanceof Error ? err.message : 'Failed to load applications')
            } finally {
                setIsLoading(false)
            }
        }

        fetchApplications()
    }, [metahubId, publicationId])

    if (isLoading) {
        return (
            <Stack spacing={2}>
                <Skeleton variant="text" width="60%" height={28} />
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="rectangular" width="100%" height={60} sx={{ borderRadius: 1 }} />
                ))}
            </Stack>
        )
    }

    if (error) {
        return (
            <Box sx={{ p: 2, bgcolor: 'error.lighter', borderRadius: 1 }}>
                <Typography color="error.main">
                    {error}
                </Typography>
            </Box>
        )
    }

    if (applications.length === 0) {
        return (
            <Box sx={{ p: 3, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                <Typography variant="body1" color="text.secondary">
                    {t('publications.applications.empty', 'Нет связанных приложений')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {t('publications.applications.emptyHint', 'Приложения связываются с публикацией через коннекторы.')}
                </Typography>
            </Box>
        )
    }

    return (
        <Stack spacing={2}>
            <Typography variant="subtitle2" color="text.secondary">
                {t('publications.applications.count', 'Связанные приложения')}: {applications.length}
            </Typography>

            <List disablePadding>
                {applications.map((app) => {
                    const name = getVLCString(app.name, uiLocale) || app.slug || app.id
                    const description = app.description ? getVLCString(app.description, uiLocale) : null

                    return (
                        <ListItem
                            key={app.id}
                            sx={{
                                bgcolor: 'background.paper',
                                borderRadius: 1,
                                mb: 1,
                                border: 1,
                                borderColor: 'divider'
                            }}
                            secondaryAction={
                                <MuiLink
                                    href={`/application/${app.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                                >
                                    <OpenInNewIcon fontSize="small" />
                                </MuiLink>
                            }
                        >
                            <ListItemText
                                primary={
                                    <Typography variant="body1" fontWeight={500}>
                                        {name}
                                    </Typography>
                                }
                                secondary={description || t('publications.applications.noDescription', 'Нет описания')}
                            />
                        </ListItem>
                    )
                })}
            </List>
        </Stack>
    )
}

export default ApplicationsPanel
