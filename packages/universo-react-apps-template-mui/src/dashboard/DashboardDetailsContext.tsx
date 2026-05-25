import { createContext, useContext } from 'react'
import type { DashboardDetailsSlot } from './Dashboard'

/**
 * React context providing DashboardDetailsSlot data to descendant widgets.
 * Used by data-driven center zone widgets (e.g. detailsTable inside columnsContainer)
 * that need access to table rows, columns, pagination, etc.
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
