import Stack from '@mui/material/Stack';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import CustomDatePicker from './CustomDatePicker';
import NavbarBreadcrumbs from './NavbarBreadcrumbs';
import MenuButton from './MenuButton';
import ColorModeIconDropdown from '../../shared-theme/ColorModeIconDropdown';

import Search from './Search';

export interface HeaderLayoutConfig {
  showBreadcrumbs?: boolean
  showSearch?: boolean
  showDatePicker?: boolean
  showOptionsMenu?: boolean
}

export default function Header({ layoutConfig }: { layoutConfig?: HeaderLayoutConfig }) {
  const showBreadcrumbs = layoutConfig?.showBreadcrumbs ?? true;
  const showSearch = layoutConfig?.showSearch ?? true;
  const showDatePicker = layoutConfig?.showDatePicker ?? true;
  const showOptionsMenu = layoutConfig?.showOptionsMenu ?? true;

  return (
    <Stack
      direction="row"
      sx={{
        display: { xs: 'none', md: 'flex' },
        width: '100%',
        alignItems: { xs: 'flex-start', md: 'center' },
        justifyContent: 'space-between',
        maxWidth: { sm: '100%', md: '1700px' },
        pt: 1.5,
      }}
      spacing={2}
    >
      {showBreadcrumbs && <NavbarBreadcrumbs />}
      <Stack direction="row" sx={{ gap: 1 }}>
        {showSearch && <Search />}
        {showDatePicker && <CustomDatePicker />}
        {showOptionsMenu && (
          <>
            <MenuButton showBadge aria-label="Open notifications">
              <NotificationsRoundedIcon />
            </MenuButton>
            <ColorModeIconDropdown />
          </>
        )}
      </Stack>
    </Stack>
  );
}
