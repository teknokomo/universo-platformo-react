// Universo Platformo | Access Control Service
// Centralized service for checking user access to resources

// Import the correct Supabase clients
import { supabase } from '../../utils/supabase'

/**
 * Service for checking user access permissions to various resources
 */
export class AccessControlService {
    /**
     * Checks if a user has access to a specific Unik
     * @param userId The user ID to check
     * @param unikId The Unik ID to check access for
     * @param authToken JWT token for authenticated requests
     * @returns Promise resolving to true if user has access, false otherwise
     */
    async checkUnikAccess(userId: string, unikId: string, authToken?: string): Promise<boolean> {
        if (!userId || !unikId) {
            return false
        }

        try {
            // Use SQL query with explicit UUID casting
            const { data, error } = await supabase
                .from('user_uniks')
                .select('*')
                .filter('user_id', 'eq', userId)
                .filter('unik_id', 'eq', unikId)

            const hasAccess = !error && Array.isArray(data) && data.length > 0
            return hasAccess
        } catch (error) {
            console.error('AccessControlService error during checkUnikAccess:', error)
            return false
        }
    }

    /**
     * Checks if a user is the owner of a specific Unik
     * @param userId The user ID to check
     * @param unikId The Unik ID to check ownership for
     * @param authToken JWT token for authenticated requests
     * @returns Promise resolving to true if user is the owner, false otherwise
     */
    async isUnikOwner(userId: string, unikId: string, authToken?: string): Promise<boolean> {
        if (!userId || !unikId) return false

        try {
            const { data, error } = await supabase
                .from('user_uniks')
                .select('role')
                .filter('user_id', 'eq', userId)
                .filter('unik_id', 'eq', unikId)
                .filter('role', 'eq', 'owner')

            return !error && Array.isArray(data) && data.length > 0
        } catch (error) {
            console.error('Error checking Unik ownership:', error)
            return false
        }
    }

    /**
     * Gets all Uniks that a user has access to
     * @param userId The user ID to get Uniks for
     * @param authToken JWT token for authenticated requests
     * @returns Promise resolving to an array of Unik objects with access information
     */
    async getUserUniks(userId: string, authToken?: string): Promise<any[]> {
        if (!userId) return []

        try {
            const { data, error } = await supabase.from('user_uniks').select('unik_id, role').filter('user_id', 'eq', userId)

            return data || []
        } catch (error) {
            console.error('Error getting user Uniks:', error)
            return []
        }
    }

    /**
     * Checks if a user has access to a Chatflow through Unik ownership
     * @param userId The user ID to check
     * @param chatflowId The Chatflow ID to check access for
     * @param authToken JWT token for authenticated requests
     * @returns Promise resolving to true if user has access, false otherwise
     */
    async checkChatflowAccess(userId: string, chatflowId: string, authToken?: string): Promise<boolean> {
        if (!userId || !chatflowId) return false

        try {
            // First get the Unik ID for this chatflow
            const { data: chatflow, error: chatflowError } = await supabase
                .from('chat_flow')
                .select('unik_id')
                .filter('id', 'eq', chatflowId)
                .maybeSingle()

            if (chatflowError || !chatflow) return false

            // Then check if user has access to this Unik
            return await this.checkUnikAccess(userId, chatflow.unik_id, authToken)
        } catch (error) {
            console.error('Error checking Chatflow access:', error)
            return false
        }
    }
}

// Export a singleton instance of the service
export const accessControlService = new AccessControlService()
