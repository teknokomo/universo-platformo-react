/**
 * Builds the canonical public address path for an application reference
 * (alias or UUID). Shared by the alias management surfaces so the address
 * format never diverges between the admin table and the address dialog.
 */
export const buildPublicApplicationAddressPath = (reference: string): string => `/a/${encodeURIComponent(reference.trim())}`

/**
 * Absolute same-origin address; falls back to the relative path when no
 * browser origin is available (server-side rendering, tests).
 */
export const buildPublicApplicationAddress = (reference: string): string => {
    const relative = buildPublicApplicationAddressPath(reference)
    return typeof window === 'undefined' ? relative : `${window.location.origin}${relative}`
}
