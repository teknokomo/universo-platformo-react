import * as React from 'react';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Breadcrumbs, { breadcrumbsClasses } from '@mui/material/Breadcrumbs';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import Link from '@mui/material/Link';
import { useTranslation } from 'react-i18next';
import i18n from '@ui/i18n';
import { useLocation, NavLink } from 'react-router-dom';

const StyledBreadcrumbs = styled(Breadcrumbs)(({ theme }) => ({
  margin: theme.spacing(1, 0),
  [`& .${breadcrumbsClasses.separator}`]: {
    color: (theme.vars || theme).palette.action.disabled,
    margin: 1,
  },
  [`& .${breadcrumbsClasses.ol}`]: {
    alignItems: 'center',
  },
}));

export default function NavbarBreadcrumbs() {
  const { t } = useTranslation('menu', { i18n });
  const location = useLocation();

  const menuMap: Record<string, string> = {
    uniks: 'uniks',
    metaverses: 'metaverses',
    clusters: 'clusters',
    profile: 'profile',
    docs: 'docs',
    spaces: 'spaces'
  };

  const segments = location.pathname.split('/').filter(Boolean);

  const crumbs = (() => {
    if (segments.length === 0) {
      return [{ label: t(`menu.${menuMap.uniks}`), to: '/uniks' }];
    }

    const primary = segments[0];
    if (primary === 'unik') {
      const items = [{ label: t(`menu.${menuMap.uniks}`), to: '/uniks' }];
      if (segments.includes('spaces')) {
        items.push({ label: t(`menu.${menuMap.spaces}`), to: location.pathname });
      }
      return items;
    }

    if (menuMap[primary]) {
      return [{ label: t(`menu.${menuMap[primary]}`), to: `/${primary}` }];
    }

    return segments.map((segment, index) => ({
      label: segment,
      to: '/' + segments.slice(0, index + 1).join('/')
    }));
  })();

  return (
    <StyledBreadcrumbs
      aria-label="breadcrumb"
      separator={<NavigateNextRoundedIcon fontSize="small" />}
    >
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return isLast ? (
          <Typography key={crumb.to} variant="body1" sx={{ color: 'text.primary', fontWeight: 600 }}>
            {crumb.label}
          </Typography>
        ) : (
          <Link
            component={NavLink}
            key={crumb.to}
            to={crumb.to}
            underline="none"
            color="text.secondary"
            sx={{ fontSize: '1rem' }}
          >
            {crumb.label}
          </Link>
        );
      })}
    </StyledBreadcrumbs>
  );
}
