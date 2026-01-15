// TypeScript declarations for JSX components from packages/flowise-core-frontend/base
declare module '*.jsx' {
    const content: any
    export default content
}

// Simple declarations for UI components to avoid compilation issues
declare module '@ui/ui-components/cards/ItemCard' {
    const ItemCard: any
    export default ItemCard
}

declare module '@ui/ui-components/table/FlowListTable' {
    export const FlowListTable: any
}

declare module '@ui/layout/MainLayout/ViewHeader' {
    const ViewHeader: any
    export default ViewHeader
}

declare module '@ui/ErrorBoundary' {
    const ErrorBoundary: any
    export default ErrorBoundary
}

declare module '@ui/store/constant' {
    export const gridSpacing: any
    export const drawerWidth: any
    export const appDrawerWidth: any
}

// Fallback for any other UI components
declare module '@ui/*' {
    const content: any
    export default content
}

declare module 'flowise-ui/*' {
    const content: any
    export default content
}
