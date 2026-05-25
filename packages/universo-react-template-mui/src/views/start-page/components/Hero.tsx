import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Container from '@mui/material/Container'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { Link as RouterLink } from 'react-router-dom'
// MVP: Temporarily commented out - will be restored later
// import { styled } from '@mui/material/styles'

// MVP: Image styled component - temporarily commented out
// const StyledBox = styled('div')(({ theme }) => ({
//   alignSelf: 'center',
//   width: '100%',
//   height: 400,
//   marginTop: theme.spacing(8),
//   borderRadius: (theme.vars || theme).shape.borderRadius,
//   outline: '6px solid',
//   outlineColor: 'hsla(220, 25%, 80%, 0.2)',
//   border: '1px solid',
//   borderColor: (theme.vars || theme).palette.grey[200],
//   boxShadow: '0 0 12px 8px hsla(220, 25%, 80%, 0.2)',
//   backgroundImage: `url(${process.env.TEMPLATE_IMAGE_URL || 'https://mui.com'}/static/screenshots/material-ui/getting-started/templates/dashboard.jpg)`,
//   backgroundSize: 'cover',
//   [theme.breakpoints.up('sm')]: {
//     marginTop: theme.spacing(10),
//     height: 700,
//   },
//   ...theme.applyStyles('dark', {
//     boxShadow: '0 0 24px 12px hsla(210, 100%, 25%, 0.2)',
//     backgroundImage: `url(${process.env.TEMPLATE_IMAGE_URL || 'https://mui.com'}/static/screenshots/material-ui/getting-started/templates/dashboard-dark.jpg)`,
//     outlineColor: 'hsla(220, 20%, 42%, 0.1)',
//     borderColor: (theme.vars || theme).palette.grey[700],
//   }),
// }))

export default function Hero() {
    return (
        <Box
            id='hero'
            sx={{
                width: '100%',
                flex: 1,
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <Container
                sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    zIndex: 1,
                    // Increased top padding for mobile to avoid header overlap
                    pt: { xs: 14, sm: 8 },
                    pb: { xs: 6, sm: 8 }
                }}
            >
                <Stack spacing={4} useFlexGap sx={{ alignItems: 'center', width: { xs: '100%', sm: '70%' } }}>
                    <Typography
                        variant='h1'
                        sx={{
                            display: 'flex',
                            flexDirection: { xs: 'column', sm: 'row' },
                            alignItems: 'center',
                            fontSize: 'clamp(3rem, 10vw, 3.5rem)'
                        }}
                    >
                        Нам&nbsp;нужны&nbsp;
                        <Typography
                            component='span'
                            variant='h1'
                            sx={(theme) => ({
                                fontSize: 'inherit',
                                color: 'primary.main',
                                ...theme.applyStyles('dark', {
                                    color: 'primary.light'
                                })
                            })}
                        >
                            все миры
                        </Typography>
                    </Typography>
                    <Typography
                        sx={{
                            textAlign: 'center',
                            color: 'text.primary',
                            width: { sm: '100%', md: '80%' },
                            fontSize: '1.15rem',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}
                    >
                        Бесконечное пространство исследований и сотрудничества с единомышленниками. Управляйте организациями, проектами и
                        своей жизнью. Превращайте цифровые двойники предприятий и городов в реальность.
                    </Typography>
                    <Stack direction='row' spacing={1} useFlexGap sx={{ pt: 4, justifyContent: 'center' }}>
                        <Button
                            component={RouterLink}
                            to='/auth'
                            variant='contained'
                            color='info'
                            size='large'
                            sx={{
                                minWidth: 'fit-content',
                                boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
                            }}
                        >
                            В будущее
                        </Button>
                    </Stack>
                </Stack>
                {/* MVP: Image temporarily commented out */}
                {/* <StyledBox id="image" /> */}
            </Container>
        </Box>
    )
}
