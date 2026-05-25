import type { AxiosInstance } from 'axios'

/**
 * Validation result item from the backend
 */
export interface ValidationResult {
    /** Node ID */
    id: string
    /** Node label */
    label: string
    /** Node name (component name) */
    name: string
    /** List of validation issues */
    issues: string[]
}

/**
 * Validation response from the API
 */
export interface ValidationResponse {
    /** Canvas ID that was validated */
    canvasId: string
    /** Whether the canvas is valid (no issues) */
    isValid: boolean
    /** List of validation issues per node */
    issues: ValidationResult[]
}

/**
 * Validation API factory function
 * @param client - Axios instance for making API calls
 * @returns ValidationApi object with methods
 */
export const createValidationApi = (client: AxiosInstance) => ({
    /**
     * Check canvas validation
     * @param unikId - Unik ID for scoping the request
     * @param canvasId - Canvas ID to validate
     * @returns Validation response with issues
     */
    checkValidation: async (unikId: string, canvasId: string): Promise<{ data: ValidationResult[] }> => {
        const response = await client.get<ValidationResponse>(`/unik/${unikId}/validation/${canvasId}`)
        return { data: response.data.issues }
    }
})

export type ValidationApi = ReturnType<typeof createValidationApi>
