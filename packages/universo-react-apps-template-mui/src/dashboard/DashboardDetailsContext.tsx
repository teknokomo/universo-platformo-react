import { createContext, useContext } from 'react'
import type { DashboardDetailsSlot } from './contracts'

/**
 * React context providing DashboardDetailsSlot data to descendant widgets.
 * Used by runtime widgets to access host capabilities, localized settings,
 * entity navigation, and domain-specific actions.
 */
const DashboardDetailsContext = createContext<DashboardDetailsSlot | undefined>(undefined)

export const DashboardDetailsProvider = DashboardDetailsContext.Provider

/**
 * Hook to consume DashboardDetailsSlot from the nearest provider.
 * Returns undefined if no provider is present above in the tree.
 */
export function useDashboardDetails(): DashboardDetailsSlot | undefined {
    return useContext(DashboardDetailsContext)
}
