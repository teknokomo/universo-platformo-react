import '@/diagnostics/bootstrapDiagnostics'
import React from 'react'
import App from '@/App'
import { store, ConfirmContextProvider } from '@universo/store'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@universo/auth-frontend'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createGlobalQueryClient } from '@/config/queryClient'
import client from '@/api/client'
import BootstrapErrorBoundary from '@/components/BootstrapErrorBoundary'

// i18n initialization - global singleton
import '@universo/i18n'

// Package i18n registration (kept packages only)
import '@universo/profile-frontend/i18n'
import '@universo/applications-frontend/i18n'
import '@universo/metahubs-frontend/i18n'

// style + assets
import '@universo/template-mui/assets/scss/style.scss'

// third party
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { SnackbarProvider } from 'notistack'

const container = document.getElementById('root')

if (!container) {
    throw new Error('Root container #root not found')
}

const root = createRoot(container)

// Create global QueryClient instance (following TanStack Query v5 best practices)
const queryClient = createGlobalQueryClient()

const routerConfig = {
    basename: (typeof window !== 'undefined' && window.__APP_BASEPATH__) || process.env.PUBLIC_URL || '/'
}

/**
 * React StrictMode Wrapper - Development Only
 *
 * **Why conditional StrictMode?**
 * React.StrictMode intentionally double-renders components in development to detect side effects.
 * However, this causes Router context loss in production builds, breaking navigation after auth state changes.
 *
 * **Issue Details:**
 * - StrictMode in production → BrowserRouter unmounts/remounts → Router context becomes null
 * - Manifests as: "useRoutes() must be called within a Router" error after successful authentication
 * - Related: https://github.com/remix-run/react-router/issues/7870
 *
 * **Solution:**
 * - Development: Use React.StrictMode to catch side effects and unsafe patterns
 * - Production: Use React.Fragment (no-op wrapper) to prevent double-render issues
 *
 * **Benefits:**
 * - ✅ Development: Full StrictMode debugging capabilities
 * - ✅ Production: Stable Router context, no performance penalty
 * - ✅ Best practice: StrictMode should be development-only per React documentation
 *
 * @see https://react.dev/reference/react/StrictMode#strictmode
 */
const AppWrapper = process.env.NODE_ENV === 'development' ? React.StrictMode : React.Fragment

// Simple Router wrapper without logging
function RouterWrapper({ children, basename }) {
    return React.createElement(BrowserRouter, { basename }, children)
}

root.render(
    <AppWrapper>
        <BootstrapErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <Provider store={store}>
                    <RouterWrapper basename={routerConfig.basename}>
                        <SnackbarProvider>
                            <ConfirmContextProvider>
                                <AuthProvider client={client}>
                                    <App />
                                </AuthProvider>
                            </ConfirmContextProvider>
                        </SnackbarProvider>
                    </RouterWrapper>
                </Provider>
                {/* React Query DevTools - only in development */}
                {process.env.NODE_ENV === 'development' && <ReactQueryDevtools initialIsOpen={false} position='bottom-right' />}
            </QueryClientProvider>
        </BootstrapErrorBoundary>
    </AppWrapper>
)
