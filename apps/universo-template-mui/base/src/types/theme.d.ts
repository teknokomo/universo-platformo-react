import '@mui/material/styles'

declare module '@mui/material/styles' {
    interface Palette {
        card: {
            main: string
            hover: string
            light: string
        }
    }

    interface PaletteOptions {
        card?: {
            main?: string
            hover?: string
            light?: string
        }
    }
}
