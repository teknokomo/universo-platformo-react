import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { GridLocaleText } from '@mui/x-data-grid'
import type { AvailableInterpretationNetworkFavorite } from './runtimeInterpretationNetworkFavoritesApi'
import { useInterpretationNetworkFavorites } from './useInterpretationNetworkFavorites'

export type InterpretationNetworkFavoritesContextValue = ReturnType<typeof useInterpretationNetworkFavorites> & {
    selectedInterpretationId: string | null
    localeText?: Partial<GridLocaleText>
    onNavigateFavorite: (favorite: AvailableInterpretationNetworkFavorite) => void
}

export const InterpretationNetworkFavoritesContext = createContext<InterpretationNetworkFavoritesContextValue | null>(null)

export function useInterpretationNetworkFavoritesContext(): InterpretationNetworkFavoritesContextValue | null {
    return useContext(InterpretationNetworkFavoritesContext)
}

export interface InterpretationNetworkFavoritesProviderProps {
    apiBaseUrl?: string | null
    applicationId?: string | null
    workspaceId?: string | null
    locale: string
    queryKeyPrefix?: readonly unknown[]
    enabled: boolean
    selectedInterpretationId: string | null
    localeText?: Partial<GridLocaleText>
    onNavigateFavorite: (favorite: AvailableInterpretationNetworkFavorite) => void
    children: ReactNode
}

export function InterpretationNetworkFavoritesProvider({
    apiBaseUrl,
    applicationId,
    workspaceId,
    locale,
    queryKeyPrefix,
    enabled,
    selectedInterpretationId,
    localeText,
    onNavigateFavorite,
    children
}: InterpretationNetworkFavoritesProviderProps) {
    const favorites = useInterpretationNetworkFavorites({
        apiBaseUrl,
        applicationId,
        workspaceId,
        locale,
        queryKeyPrefix,
        enabled
    })
    const value = useMemo(
        () => ({ ...favorites, selectedInterpretationId, localeText, onNavigateFavorite }),
        [favorites, localeText, onNavigateFavorite, selectedInterpretationId]
    )

    return <InterpretationNetworkFavoritesContext.Provider value={value}>{children}</InterpretationNetworkFavoritesContext.Provider>
}
