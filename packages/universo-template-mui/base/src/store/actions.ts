/**
 * Action types for Confirm Dialog system
 * Used by confirmReducer to manage dialog state
 */

export const SHOW_CONFIRM = 'SHOW_CONFIRM'
export const HIDE_CONFIRM = 'HIDE_CONFIRM'

export interface ConfirmPayload {
    title?: string
    description: string
    confirmButtonName?: string
    cancelButtonName?: string
    customBtnId?: string
}

export type ConfirmAction = { type: typeof SHOW_CONFIRM; payload: ConfirmPayload } | { type: typeof HIDE_CONFIRM }
