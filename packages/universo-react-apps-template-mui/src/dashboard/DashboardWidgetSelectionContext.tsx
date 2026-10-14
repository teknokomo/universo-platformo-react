import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

interface DashboardWidgetSelectionState {
    selectedDetailsTabs: Readonly<Record<string, string>>
    selectedRelationParents: Readonly<Record<string, string>>
    setDetailsTab: (instanceKey: string, slotKey: string) => void
    setRelationParent: (instanceKey: string, parentKey: string) => void
}

const DashboardWidgetSelectionContext = createContext<DashboardWidgetSelectionState | null>(null)

interface DashboardWidgetSelectionProviderProps {
    children: ReactNode
}

const updateSelection = (current: Record<string, string>, instanceKey: string, selection: string): Record<string, string> => {
    return current[instanceKey] === selection ? current : { ...current, [instanceKey]: selection }
}

export function DashboardWidgetSelectionProvider({ children }: DashboardWidgetSelectionProviderProps) {
    const [selectedDetailsTabs, setSelectedDetailsTabs] = useState<Record<string, string>>({})
    const [selectedRelationParents, setSelectedRelationParents] = useState<Record<string, string>>({})
    const setDetailsTab = useCallback(
        (instanceKey: string, slotKey: string) => setSelectedDetailsTabs((current) => updateSelection(current, instanceKey, slotKey)),
        []
    )
    const setRelationParent = useCallback(
        (instanceKey: string, parentKey: string) =>
            setSelectedRelationParents((current) => updateSelection(current, instanceKey, parentKey)),
        []
    )
    const value = useMemo(
        () => ({ selectedDetailsTabs, selectedRelationParents, setDetailsTab, setRelationParent }),
        [selectedDetailsTabs, selectedRelationParents, setDetailsTab, setRelationParent]
    )

    return <DashboardWidgetSelectionContext.Provider value={value}>{children}</DashboardWidgetSelectionContext.Provider>
}

export function useDashboardWidgetSelection(): DashboardWidgetSelectionState | null {
    return useContext(DashboardWidgetSelectionContext)
}
