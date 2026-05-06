import '@mui/material/styles'
declare module '@mui/material/styles' {
    interface Theme {
        vars?: {
            palette: Theme['palette'] & {
                outline?: string
            }
            shape: Theme['shape']
        }
        applyStyles: (mode: 'light' | 'dark', styles: Record<string, unknown>) => Record<string, unknown>
    }
}
