// Minimal fallback declarations for @universo/template-mui used in this package.
// We only need ItemCard for the current migration step. Expand later if required.

declare module '@universo/template-mui' {
    export const ItemCard: any
}

declare module '@universo/template-mui/components/table/FlowListTable' {
    export const FlowListTable: any
}

declare module '@ui/ui-component/button/StyledButton' {
    export const StyledButton: any
}

declare module '@ui/store/actions' {
    export const enqueueSnackbar: any
}

declare module '@ui/utils/authProvider' {
    export const useAuth: any
}

declare module '@ui/hooks/useConfirm' {
    const useConfirm: any
    export default useConfirm
}
