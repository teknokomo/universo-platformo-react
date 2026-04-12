/**
 * Shared page spacing contract.
 *
 * The main layout (MainLayoutMUI) wraps page content with:
 *   default routes: px: { xs: 1.5, md: 2 }
 *   metahub routes (`/metahubs`, `/metahub/*`): px: { xs: 1, md: 1.5 }
 *
 * For non-metahub content sections (settings forms, migrations, etc.) that
 * need to align back to the page content edges below ViewHeader, apply
 * PAGE_CONTENT_GUTTER_MX as `mx` on the wrapping Box.
 *
 * Tab bars should also stretch back to the same content edges below
 * ViewHeader. They should not add positive horizontal padding of their own.
 * Metahub pages intentionally use a narrower route-aware shell gutter and
 * should not reuse PAGE_CONTENT_GUTTER_MX.
 */

/** Negative horizontal margin — pulls a content section back to the page-content edges */
export const PAGE_CONTENT_GUTTER_MX = { xs: -1.5, md: -2 } as const

/** Default page gutter applied by the shared shell on non-metahub routes. */
export const DEFAULT_PAGE_GUTTER_PX = { xs: 1.5, md: 2 } as const

/** Narrower page gutter applied by the shared shell on metahub routes. */
export const METAHUB_PAGE_GUTTER_PX = { xs: 1, md: 1.5 } as const

/** Detects the standalone metahub shell routes that use the narrower shared gutter contract. */
export const isMetahubShellRoute = (pathname: string): boolean => /^\/metahubs?(?:\/|$)/.test(pathname)

/** Route-aware page gutter for the shared shell stack. */
export const getPageGutterPx = (pathname: string) =>
	isMetahubShellRoute(pathname) ? METAHUB_PAGE_GUTTER_PX : DEFAULT_PAGE_GUTTER_PX

/** Route-aware header inset that keeps shell breadcrumbs aligned with the accepted metahub body inset. */
export const getHeaderInsetPx = (pathname: string) => (isMetahubShellRoute(pathname) ? METAHUB_PAGE_GUTTER_PX : 0)

/** Tab bar container style: bottom border, shared widened gutter, no positive horizontal padding */
export const PAGE_TAB_BAR_SX = { borderBottom: 1, borderColor: 'divider', mb: 2, mx: PAGE_CONTENT_GUTTER_MX } as const
