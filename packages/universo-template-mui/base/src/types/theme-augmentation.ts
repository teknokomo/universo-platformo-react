import '@mui/material/styles'

declare module '@mui/material/styles' {
    interface Theme {
        vars?: {
            palette: Theme['palette']
            shape: Theme['shape']
        }
        applyStyles: (mode: 'light' | 'dark', styles: any) => any
    }
}
