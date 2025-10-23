import '@/diagnostics/bootstrapDiagnostics'
import React from 'react'
import * as ReactJsxRuntime from 'react/jsx-runtime'
import * as ReactJsxDevRuntime from 'react/jsx-dev-runtime'
import App from '@/App'
import { store, ConfirmContextProvider, ReactFlowContext } from '@flowise/store'
import { createRoot } from 'react-dom/client'
import { AuthProvider } from '@universo/auth-frt'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { createGlobalQueryClient } from '@/config/queryClient'
import client from '@/api/client'
import BootstrapErrorBoundary from '@/components/BootstrapErrorBoundary'

// i18n initialization - global singleton
import '@universo/i18n'

// FRT package i18n registration
import '@universo/spaces-frt/i18n'
import '@universo/publish-frt/i18n'
import '@universo/analytics-frt/i18n'
import '@universo/profile-frt/i18n'
import '@universo/uniks-frt/i18n'
import '@universo/metaverses-frt/i18n'
import '@universo/template-mmoomm/i18n'
import '@universo/template-quiz/i18n'
import '@universo/template-mui/i18n'

// style + assets
import '@flowise/template-mui/assets/scss/style.scss'

// third party
import { BrowserRouter } from 'react-router-dom'
import { Provider } from 'react-redux'
import { SnackbarProvider } from 'notistack'
import { setupBuilders } from '@universo/publish-frt/builders'

const browserModuleMap = {
    react: React,
    'react/jsx-runtime': ReactJsxRuntime,
    'react/jsx-dev-runtime': ReactJsxDevRuntime
}

if (typeof window !== 'undefined' && typeof window.require === 'undefined') {
    window.require = (moduleId) => {
        if (moduleId in browserModuleMap) {
            return browserModuleMap[moduleId]
        }

        const error = new Error(`Unsupported browser require invoked for "${moduleId}"`)
        console.error('[ui-debug] window.require called', { moduleId, stack: error.stack })
        throw error
    }
}

// eslint-disable-next-line no-console
console.info('[bootstrap-env]', {
    nodeEnv: process.env.NODE_ENV,
    publicUrl: process.env.PUBLIC_URL,
})

const container = document.getElementById('root')

if (!container) {
    // eslint-disable-next-line no-console
    console.error('[bootstrap-error]', { message: 'Root container #root not found' })
    throw new Error('Root container #root not found')
}

// eslint-disable-next-line no-console
console.info('[bootstrap-container]', { found: Boolean(container) })

const root = createRoot(container)

// Universo Platformo | initialize UPDL builders
// eslint-disable-next-line no-console
console.time('[bootstrap-render]')

setupBuilders()

// Create global QueryClient instance (following TanStack Query v5 best practices)
// This single instance is shared across the entire application for optimal caching
const queryClient = createGlobalQueryClient()

const routerConfig = {
    basename: (typeof window !== 'undefined' && window.__APP_BASEPATH__) || process.env.PUBLIC_URL || '/',
}

// eslint-disable-next-line no-console
console.info('[bootstrap-router]', routerConfig)

root.render(
    <React.StrictMode>
        <BootstrapErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <Provider store={store}>
                    <BrowserRouter basename={routerConfig.basename}>
                        <SnackbarProvider>
                            <ConfirmContextProvider>
                                <ReactFlowContext>
                                    <AuthProvider client={client}>
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
        </BootstrapErrorBoundary>
    </React.StrictMode>
)

// eslint-disable-next-line no-console
console.timeEnd('[bootstrap-render]')

// Schedule a post-render tick to see if React reached commit phase
setTimeout(() => {
    // eslint-disable-next-line no-console
    console.info('[bootstrap-post-render] first tick')
}, 0)
