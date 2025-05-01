// Universo Platformo | Access Control Service
// Centralized service for checking user access to resources

// Import the correct Supabase clients
import { supabase, getSupabaseClientWithAuth } from '../../utils/supabase'

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
            // Universo Platformo | Log missing IDs
            console.log(`[AccessControlService] checkUnikAccess called with missing IDs: userId=${userId}, unikId=${unikId}`)
            return false
        }

        // Universo Platformo | Log input parameters
        console.log(`[AccessControlService] Checking Unik access for userId: ${userId}, unikId: ${unikId}`)

        try {
            // Use authenticated client if token provided, otherwise fall back to anon client
            const client = authToken ? getSupabaseClientWithAuth(authToken) : supabase

            // Universo Platformo | Execute direct query with explicit casting
            console.log(`[AccessControlService] Executing query with UUID casting and auth=${!!authToken}`)

            // Use SQL query with explicit UUID casting
            const { data, error } = await client
                .from('user_uniks')
                .select('*')
                .filter('user_id', 'eq', userId)
                .filter('unik_id', 'eq', unikId)

            // Universo Platformo | Log response
            console.log(`[AccessControlService] Supabase response:`, { data, error })

            const hasAccess = !error && Array.isArray(data) && data.length > 0
            // Universo Platformo | Log access result
            console.log(`[AccessControlService] Access result for userId ${userId} to unikId ${unikId}: ${hasAccess}`)

            return hasAccess
        } catch (error) {
            // Universo Platformo | Log caught error
            console.error('[AccessControlService] Error during checkUnikAccess:', error)
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
            // Use authenticated client if token provided
            const client = authToken ? getSupabaseClientWithAuth(authToken) : supabase

            const { data, error } = await client
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
            // Use authenticated client if token provided
            const client = authToken ? getSupabaseClientWithAuth(authToken) : supabase

            const { data, error } = await client.from('user_uniks').select('unik_id, role').filter('user_id', 'eq', userId)

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
            // Use authenticated client if token provided
            const client = authToken ? getSupabaseClientWithAuth(authToken) : supabase

            // First get the Unik ID for this chatflow
            const { data: chatflow, error: chatflowError } = await client
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
