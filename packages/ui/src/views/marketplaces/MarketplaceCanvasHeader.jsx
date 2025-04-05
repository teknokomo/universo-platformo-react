import PropTypes from 'prop-types'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Avatar, Box, ButtonBase, Typography, Stack } from '@mui/material'
import { StyledButton } from '@/ui-component/button/StyledButton'

// icons
import { IconCopy, IconChevronLeft } from '@tabler/icons-react'

// ==============================|| CANVAS HEADER ||============================== //

const MarketplaceCanvasHeader = ({ flowName, flowData, onChatflowCopy }) => {
    const theme = useTheme()
    const navigate = useNavigate()
    const location = useLocation()
    const { t } = useTranslation('templates')

    return (
        <>
            <Box>
                <ButtonBase title={t('templates.common.back')} sx={{ borderRadius: '50%' }}>
                    <Avatar
                        variant='rounded'
                        sx={{
                            ...theme.typography.commonAvatar,
                            ...theme.typography.mediumAvatar,
                            transition: 'all .2s ease-in-out',
                            background: theme.palette.secondary.light,
                            color: theme.palette.secondary.dark,
                            '&:hover': {
                                background: theme.palette.secondary.dark,
                                color: theme.palette.secondary.light
                            }
                        }}
                        color='inherit'
                        onClick={() => {
                            // Get current path using useLocation hook
                            const currentPath = location.pathname;
                            
                            // Extract unikId from URL
                            const pathParts = currentPath.split('/');
                            const unikIdIndex = pathParts.indexOf('uniks') + 1;
                            
                            if (unikIdIndex > 0 && unikIdIndex < pathParts.length) {
                                const unikId = pathParts[unikIdIndex];
                                // Redirect to the list of templates
                                navigate(`/uniks/${unikId}/templates`);
                            } else {
                                // If we couldn't extract unikId, use standard behavior
                                navigate(-1);
                            }
                        }}
                    >
                        <IconChevronLeft stroke={1.5} size='1.3rem' />
                    </Avatar>
                </ButtonBase>
            </Box>
            <Box sx={{ flexGrow: 1 }}>
                <Stack flexDirection='row'>
                    <Typography
                        sx={{
                            fontSize: '1.5rem',
                            fontWeight: 600,
                            ml: 2
                        }}
                    >
                        {flowName}
                    </Typography>
                </Stack>
            </Box>
            <Box>
                <StyledButton
                    color='secondary'
                    variant='contained'
                    title={t('templates.canvas.useChatflow')}
                    onClick={() => onChatflowCopy(flowData)}
                    startIcon={<IconCopy />}
                >
                    {t('templates.canvas.useTemplate')}
                </StyledButton>
            </Box>
        </>
    )
}

MarketplaceCanvasHeader.propTypes = {
    flowName: PropTypes.string,
    flowData: PropTypes.object,
    onChatflowCopy: PropTypes.func
}

export default MarketplaceCanvasHeader
