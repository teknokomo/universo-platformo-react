// Universo Platformo | API Links component
import * as React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import { Box, Link, Typography, Paper } from '@mui/material'
import LaunchIcon from '@mui/icons-material/Launch'

// Const
import { baseURL } from '@/store/constant'

// Universo Platformo | Component to display API links
const LinksCode = ({ chatflowid }) => {
    const { t } = useTranslation(['chatflows'])

    // Universo Platformo | Common styles for links
    const linkStyle = {
        display: 'flex',
        alignItems: 'center',
        mb: 1,
        color: 'primary.main',
        '& svg': {
            ml: 0.5,
            width: '0.85em',
            height: '0.85em'
        }
    }

    // Universo Platformo | Styles for the information block
    const paperStyle = {
        p: 2,
        mb: 2,
        backgroundColor: 'background.neutral'
    }

    return (
        <Box sx={{ mt: 2 }}>
            <Typography variant='h5' gutterBottom>
                {t('chatflows.apiLinks.title')}
            </Typography>
            <Typography variant='body2' sx={{ mb: 2 }}>
                {t('chatflows.apiLinks.description')}
            </Typography>

            <Paper sx={paperStyle} variant='outlined'>
                <Typography variant='subtitle1' gutterBottom>
                    {t('chatflows.apiLinks.endpoints')}
                </Typography>

                <>
                    <Link href={`${baseURL}/api/v1/prediction/${chatflowid}`} target='_blank' sx={linkStyle}>
                        POST {baseURL}/api/v1/prediction/{chatflowid}
                        <LaunchIcon fontSize='small' />
                    </Link>
                    <Typography variant='body2' sx={{ mb: 2 }}>
                        {t('chatflows.apiLinks.chatEndpointDescription')}
                    </Typography>
                </>
            </Paper>

            <Paper sx={paperStyle} variant='outlined'>
                <Typography variant='subtitle1' gutterBottom>
                    {t('chatflows.apiLinks.documentation')}
                </Typography>
                <Link href={`${baseURL}/api-docs`} target='_blank' sx={linkStyle}>
                    {baseURL}/api-docs
                    <LaunchIcon fontSize='small' />
                </Link>
                <Typography variant='body2'>{t('chatflows.apiLinks.documentationDescription')}</Typography>
            </Paper>
        </Box>
    )
}

LinksCode.propTypes = {
    chatflowid: PropTypes.string.isRequired
}

export default LinksCode
