import { useParams } from 'react-router-dom'
import { Box, Typography, Stack, CircularProgress, Alert } from '@mui/material'
import { useTranslation } from 'react-i18next'

// project imports
import { ViewHeaderMUI as ViewHeader, EmptyListState, APIEmptySVG } from '@universo/template-mui'

import { useMetaverseDetails } from '../api/useMetaverseDetails'
import { MetaverseBoardGrid } from '../components/dashboard'

/**
 * Metaverse Board Page
 *
 * Displays analytics dashboard for a metaverse with:
 * - Real-time statistics (sections, entities, members)
 * - Documentation resources
 * - Activity and resource charts (demo data)
 */
const MetaverseBoard = () => {
    const { metaverseId } = useParams<{ metaverseId: string }>()
    const { t } = useTranslation('metaverses')

    // Fetch metaverse details with TanStack Query
    const { data: metaverse, isLoading, error, isError } = useMetaverseDetails(metaverseId || '', {
        enabled: Boolean(metaverseId)
    })

    // Loading state
    if (isLoading) {
        return (
            <Box sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%' }}>
                <Stack spacing={2} alignItems='center' minHeight={400} justifyContent='center'>
                    <CircularProgress size={40} />
                    <Typography variant='body2' color='text.secondary'>
                        {t('board.loading', 'Loading dashboard...')}
                    </Typography>
                </Stack>
            </Box>
        )
    }

    // Error state
    if (isError || !metaverse) {
        const errorMessage = error instanceof Error ? error.message : t('board.error', 'Failed to load metaverse data')
        
        return (
            <Stack spacing={3} sx={{ maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto', width: '100%', p: 2 }}>
                <EmptyListState
                    image={APIEmptySVG}
                    imageAlt='Error loading metaverse'
                    title={t('board.error', 'Failed to load metaverse data')}
                />
                <Alert severity='error' sx={{ mx: 'auto', maxWidth: 600 }}>
                    {errorMessage}
                </Alert>
            </Stack>
        )
    }

    // Success state with dashboard
    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' }, mx: 'auto' }}>
            {/* ViewHeader with horizontal padding */}
            <Box sx={{ px: { xs: 1.5, md: 2 } }}>
                <ViewHeader
                    title={metaverse.name}
                    description={
                        metaverse.description || t('board.defaultDescription', 'Metaverse analytics and statistics')
                    }
                    search={false}
                />
            </Box>
            <MetaverseBoardGrid metaverse={metaverse} />
        </Stack>
    )
}

export default MetaverseBoard
