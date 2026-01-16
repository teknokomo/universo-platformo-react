/**
 * Re-export useViewPreference from @universo/template-mui
 * This provides a centralized, SSR-safe hook for localStorage-backed view preferences.
 *
 * @see {@link @universo/template-mui/hooks/useViewPreference} for implementation details
 */
export { useViewPreference, DEFAULT_VIEW_STYLE } from '@universo/template-mui'
export type { ViewStyle } from '../constants/storage'
