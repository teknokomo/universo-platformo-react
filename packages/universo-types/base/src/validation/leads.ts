/**
 * Lead types for contact information captured during interactions
 * Used across leads-backend, analytics-frontend, and other modules
 */

/**
 * Lead entity interface
 * Represents a contact captured during quiz/chat interaction
 */
export interface ILead {
    /** Unique identifier (UUID v7) */
    id: string
    /** Optional contact name */
    name?: string
    /** Optional email address */
    email?: string
    /** Optional phone number */
    phone?: string
    /** Points/score earned (default: 0) */
    points: number
    /** Associated canvas ID (optional) */
    canvasId?: string
    /** Chat/session ID */
    chatId: string
    /** Creation timestamp */
    createdDate: Date
}

/**
 * Request payload for creating a lead
 */
export interface CreateLeadPayload {
    /** Canvas ID (optional, can be missing during quiz initialization) */
    canvasId?: string
    /** Chat/session ID (optional, will be auto-generated if missing) */
    chatId?: string
    /** Contact name */
    name?: string
    /** Email address */
    email?: string
    /** Phone number */
    phone?: string
    /** Points/score (default: 0, must be non-negative) */
    points?: number
}

/**
 * Analytics aggregation for leads
 */
export interface LeadsAnalytics {
    /** Total number of leads */
    totalLeads: number
    /** Average points across all leads */
    averagePoints: number
    /** Maximum points achieved */
    maxPoints: number
    /** Sum of all points */
    totalPoints: number
}
