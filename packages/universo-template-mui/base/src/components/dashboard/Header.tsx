import Stack from '@mui/material/Stack'
import NavbarBreadcrumbs from './NavbarBreadcrumbs'
import ColorModeIconDropdown from '../shared/ColorModeIconDropdown'
import LanguageSwitcher from '../shared/LanguageSwitcher'
import type { DashboardLayoutConfig } from './runtimeTypes'

export default function Header({ layoutConfig }: { layoutConfig?: DashboardLayoutConfig }) {
    const showBreadcrumbs = layoutConfig?.showBreadcrumbs ?? true

    return (
        <Stack
            direction='row'
            sx={{
                display: { xs: 'none', md: 'flex' },
                width: '100%',
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                maxWidth: { sm: '100%', md: '1700px' },
                pt: 1.5
            }}
            spacing={2}
        >
            {showBreadcrumbs ? <NavbarBreadcrumbs /> : <span />}
            <Stack direction='row' sx={{ gap: 1 }}>
                {/* Keep only theme + language in the host shell (future features stay hidden for now). */}
                <ColorModeIconDropdown />
                <LanguageSwitcher />
            </Stack>
        </Stack>
    )
}
