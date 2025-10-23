// Entry point for the spaces-frt module build.
// Intentionally do not re-export React components here to keep TS build thin
// (Vite in the consumer app imports JSX files directly via aliases).

// Export hooks for other packages
export { useSpacesQuery } from './hooks/useSpacesQuery'
export type { UseSpacesQueryResult } from './hooks/useSpacesQuery'

// Note: spacesApi is now available from @universo/api-client as api.spaces
// Note: spacesQueryKeys removed - use TanStack Query directly
