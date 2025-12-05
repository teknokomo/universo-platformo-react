/**
 * useAbility Hook
 *
 * Provides access to CASL ability from AbilityContext.
 *
 * Usage:
 * ```jsx
 * import { useAbility } from '@flowise/store'
 *
 * const MyComponent = () => {
 *   const { ability, loading } = useAbility()
 *
 *   if (loading) return <Loading />
 *
 *   if (ability.can('create', 'Metaverse')) {
 *     return <CreateButton />
 *   }
 *
 *   return <NoAccess />
 * }
 * ```
 */
import { useContext } from 'react'
import AbilityContext from './AbilityContext'

/**
 * Hook to access CASL ability
 * @returns {{ ability: import('@casl/ability').MongoAbility, loading: boolean, error: Error | null, refreshAbility: () => Promise<void>, clearAbility: () => void }}
 */
const useAbility = () => {
    const context = useContext(AbilityContext)

    if (!context) {
        throw new Error('useAbility must be used within AbilityContextProvider')
    }

    return context
}

export default useAbility
