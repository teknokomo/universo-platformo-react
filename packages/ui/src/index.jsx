import React from 'react'
import App from '@/App'
import { store } from '@/store'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@/utils/authProvider'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createGlobalQueryClient } from '@/config/queryClient'

// i18n initialization
import '@/i18n'

// style + assets
import '@/assets/scss/style.scss'

// third party
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { SnackbarProvider } from 'notistack'
import ConfirmContextProvider from '@/store/context/ConfirmContextProvider'
import { ReactFlowContext } from '@/store/context/ReactFlowContext'
import { setupBuilders } from '@apps/publish-frt/base/src/builders'

const container = document.getElementById('root')
const root = createRoot(container)

// Universo Platformo | initialize UPDL builders
setupBuilders()

// Create global QueryClient instance (following TanStack Query v5 best practices)
// This single instance is shared across the entire application for optimal caching
const queryClient = createGlobalQueryClient()

root.render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <Provider store={store}>
                <BrowserRouter>
                    <SnackbarProvider>
                        <ConfirmContextProvider>
                            <ReactFlowContext>
                                <AuthProvider>
                                    <App />
                                </AuthProvider>
                            </ReactFlowContext>
                        </ConfirmContextProvider>
                    </SnackbarProvider>
                </BrowserRouter>
            </Provider>
            {/* React Query DevTools - only in development */}
            {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} position="bottom-right" />}
        </QueryClientProvider>
    </React.StrictMode>
)
