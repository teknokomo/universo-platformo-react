// Universo Platformo | App component for publish frontend
import React from 'react'
import { ThemeProvider, createTheme, StyledEngineProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import AppRoutes from './routes'

// Universo Platformo | Create a theme for our application
const defaultTheme = createTheme({
    palette: {
        primary: {
            main: '#2B5CE4'
        },
        secondary: {
            main: '#7F3995'
        },
        error: {
            main: '#FF0000'
        },
        background: {
            default: '#F8FAFC',
            paper: '#FFFFFF'
        }
    },
    typography: {
        fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif"
    }
})

const App: React.FC = () => {
    return (
        <StyledEngineProvider injectFirst>
            <ThemeProvider theme={defaultTheme}>
                <CssBaseline />
                <AppRoutes />
            </ThemeProvider>
        </StyledEngineProvider>
    )
}

export default App
