/**
 * GuestStartPage - Landing page for non-authenticated users
 *
 * Displays:
 * - Hero section with title and "Start now" button (centered vertically)
 * - Testimonials section (4 cards in 1 row, fixed to bottom)
 * - Footer with contact information
 */
import Box from '@mui/material/Box'
import Hero from './components/Hero'
import Testimonials from './components/Testimonials'
import { StartFooter } from '../components/StartFooter'

export default function GuestStartPage() {
    return (
        <Box
            sx={(theme) => ({
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                // Background image with responsive cover (served from public folder)
                backgroundImage: 'url(/background-image.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                // Gradient overlay on top of image for better text readability
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(210, 100%, 90%), transparent)',
                    pointerEvents: 'none',
                    zIndex: 0
                },
                position: 'relative',
                ...theme.applyStyles('dark', {
                    '&::before': {
                        background: 'radial-gradient(ellipse 80% 50% at 50% -20%, hsl(210, 100%, 16%), transparent)'
                    }
                })
            })}
        >
            {/* Hero takes available space, gradient stays at top, content centered */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
                <Hero />
            </Box>

            {/* Testimonials fixed to bottom */}
            <Box sx={{ flexShrink: 0, zIndex: 1 }}>
                <Testimonials />
            </Box>

            {/* Footer with contact information */}
            <Box sx={{ flexShrink: 0, zIndex: 1 }}>
                <StartFooter />
            </Box>
        </Box>
    )
}
