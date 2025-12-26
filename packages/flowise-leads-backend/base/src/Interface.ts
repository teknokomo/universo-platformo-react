/**
 * Lead Interface - Contact information captured during chat interaction
 *
 * @packageDocumentation
 */

// Re-export types from @universo/types for convenience and backwards compatibility
export type { ILead, CreateLeadPayload, LeadsAnalytics } from '@universo/types'

/**
 * @deprecated Use CreateLeadPayload from '@universo/types' instead
 * Kept for backwards compatibility
 */
export type CreateLeadBody = import('@universo/types').CreateLeadPayload
