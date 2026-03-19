// TypeScript declarations for JSX components from the shared core frontend shell
import type { ComponentType } from 'react'

declare module '*.jsx' {
    const content: ComponentType<Record<string, unknown>>
    export default content
}

// Simple declarations for UI components to avoid compilation issues
declare module '@ui/ui-components/cards/ItemCard' {
    const ItemCard: ComponentType<Record<string, unknown>>
    export default ItemCard
}

declare module '@ui/ui-components/table/FlowListTable' {
    export const FlowListTable: ComponentType<Record<string, unknown>>
}

declare module '@ui/layout/MainLayout/ViewHeader' {
    const ViewHeader: ComponentType<Record<string, unknown>>
    export default ViewHeader
}

declare module '@ui/ErrorBoundary' {
    const ErrorBoundary: ComponentType<Record<string, unknown>>
    export default ErrorBoundary
}

declare module '@ui/store/constant' {
    export const gridSpacing: number
    export const drawerWidth: number
    export const appDrawerWidth: number
}

// Fallback for any other UI components
declare module '@ui/*' {
    const content: ComponentType<Record<string, unknown>>
    export default content
}
