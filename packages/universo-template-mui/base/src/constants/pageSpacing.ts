/**
 * Shared page spacing contract.
 *
 * The main layout (MainLayoutMUI) wraps page content with:
 *   px: { xs: 2, md: 3 }
 *
 * ViewHeader uses internal negative margins to extend past the parent
 * boundary on desktop:
 *   ml/mr: { xs: 0, md: -2 }
 *
 * For non-list content sections (settings forms, migrations, etc.) that
 * need to extend back to the content area edges below ViewHeader, apply
 * PAGE_CONTENT_GUTTER_MX as `mx` on the wrapping Box.
 *
 * Tab bars should also stretch back to the same widened content edges below
 * ViewHeader. They should not add positive horizontal padding of their own.
 */

/** Negative horizontal margin — pulls a content section back to the edges of the page gutter */
export const PAGE_CONTENT_GUTTER_MX = { xs: -1.5, md: -2 } as const

/** Tab bar container style: bottom border, shared widened gutter, no positive horizontal padding */
export const PAGE_TAB_BAR_SX = { borderBottom: 1, borderColor: 'divider', mb: 2, mx: PAGE_CONTENT_GUTTER_MX } as const
