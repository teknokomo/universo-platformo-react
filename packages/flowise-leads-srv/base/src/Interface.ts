/**
 * Lead Interface - Contact information captured during chat interaction
 *
 * @packageDocumentation
 */

/**
 * Lead entity interface
 */
export interface ILead {
    id: string
    name?: string
    email?: string
    phone?: string
    points: number
    canvasId: string
    chatId: string
    createdDate: Date
}

/**
 * Request body for creating a lead
 */
export interface CreateLeadBody {
    canvasId: string
    chatId?: string
    name?: string
    email?: string
    phone?: string
}
