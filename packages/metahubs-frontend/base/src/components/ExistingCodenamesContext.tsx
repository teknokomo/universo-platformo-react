/**
 * Universo Platformo | Existing Codenames Context
 *
 * Provides a list of existing entity codenames (including VLC locale variants)
 * to descendant components. The CodenameField wrapper consumes this context
 * to perform reactive duplicate checking.
 *
 * Usage:
 * ```tsx
 * <ExistingCodenamesProvider entities={hubs}>
 *   <HubFormFields ... />
 * </ExistingCodenamesProvider>
 * ```
 */

import { createContext, useContext } from 'react'
import type { VersionedLocalizedContent } from '@universo/types'

/** Minimal shape: only the fields needed for duplicate checking */
export interface ExistingCodenameEntity {
    id: string
    codename: VersionedLocalizedContent<string> | string | null
}

interface ExistingCodenamesContextValue {
    entities: ExistingCodenameEntity[]
}

const ExistingCodenamesContext = createContext<ExistingCodenamesContextValue>({ entities: [] })

/**
 * Provider that exposes a list of existing entities to child CodenameField instances.
 * Should wrap the dialog / form area where codename fields are rendered.
 */
export const ExistingCodenamesProvider = ({ entities, children }: { entities: ExistingCodenameEntity[]; children: React.ReactNode }) => {
    return <ExistingCodenamesContext.Provider value={{ entities }}>{children}</ExistingCodenamesContext.Provider>
}

/** Hook to read existing codename entities from the nearest provider. */
export const useExistingCodenames = (): ExistingCodenameEntity[] => {
    const ctx = useContext(ExistingCodenamesContext)
    return ctx.entities
}

export default ExistingCodenamesContext
