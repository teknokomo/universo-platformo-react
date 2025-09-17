// Entry point for the spaces-frt module build.
// Intentionally do not re-export React components here to keep TS build thin
// (Vite in the consumer app imports JSX files directly via aliases).

// Export API for other packages
export { default as spacesApi } from './api/spaces.js'

export {};
