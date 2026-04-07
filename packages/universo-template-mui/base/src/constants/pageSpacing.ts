/**
 * Shared page spacing contract.
 *
 * The main layout (MainLayoutMUI) wraps page content with:
 *   px: { xs: 1.5, md: 2 }
 *
 * For non-list content sections (settings forms, migrations, etc.) that
 * need to align back to the page content edges below ViewHeader, apply
 * PAGE_CONTENT_GUTTER_MX as `mx` on the wrapping Box.
 *
 * Tab bars should also stretch back to the same content edges below
 * ViewHeader. They should not add positive horizontal padding of their own.
 */

/** Negative horizontal margin — pulls a content section back to the page-content edges */
export const PAGE_CONTENT_GUTTER_MX = { xs: -1.5, md: -2 } as const

/** Tab bar container style: bottom border, shared widened gutter, no positive horizontal padding */
export const PAGE_TAB_BAR_SX = { borderBottom: 1, borderColor: 'divider', mb: 2, mx: PAGE_CONTENT_GUTTER_MX } as const
