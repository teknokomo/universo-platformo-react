/**
 * Grid spacing constant for consistent layout spacing
 * Used across all components for margin/padding consistency
 * Value: 3 means 24px (8px base × 3)
 */
export const gridSpacing = 3

/**
 * Maximum scroll value for canvas/dialog components
 */
export const maxScroll = 100000

/**
 * API base URL - extracted from flowise-ui store/constant
 * Resolves to current window origin in browser, fallback to localhost in Node.js
 */
export const baseURL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

/**
 * Redacted credential placeholder value
 * Used to mask sensitive credentials in the UI
 */
export const REDACTED_CREDENTIAL_VALUE = '_FLOWISE_BLANK_07167752-1a71-43b1-bf8f-4f32252165db'
