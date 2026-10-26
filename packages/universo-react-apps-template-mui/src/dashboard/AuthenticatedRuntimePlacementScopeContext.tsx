import { createContext, useContext } from 'react'
import type { AuthenticatedRuntimePlacementScopes, AuthenticatedRuntimePlacementScope } from './contracts'

const AuthenticatedRuntimePlacementScopeContext = createContext<AuthenticatedRuntimePlacementScopes | undefined>(undefined)

export const AuthenticatedRuntimePlacementScopeProvider = AuthenticatedRuntimePlacementScopeContext.Provider

export function useAuthenticatedRuntimePlacementScope(instanceKey: string): AuthenticatedRuntimePlacementScope | undefined {
    return useContext(AuthenticatedRuntimePlacementScopeContext)?.[instanceKey]
}
