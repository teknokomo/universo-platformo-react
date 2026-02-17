import type { ComponentType, ReactNode } from 'react'

/**
 * Route object compatible with react-router-dom v6 useRoutes / createBrowserRouter.
 */
export interface AppRouteObject {
    path: string
    element: ReactNode
    children?: AppRouteObject[]
}

/**
 * Configuration for creating an application runtime route.
 */
export interface AppRuntimeRouteConfig {
    /** Route path pattern. Default: 'a/:applicationId/*' */
    path?: string
    /** The runtime page component to render */
    component: ComponentType
    /** Optional guard wrapper (e.g. AuthGuard) */
    guard?: ComponentType<{ children: ReactNode }>
}

/**
 * Creates a route configuration for the application runtime view.
 * The runtime route renders a full-screen CRUD dashboard (MinimalLayout, no main sidebar).
 *
 * @example
 * ```tsx
 * import { createAppRuntimeRoute } from '@universo/apps-template-mui'
 *
 * const runtimeRoute = createAppRuntimeRoute({
 *   component: ApplicationRuntime,
 *   guard: AuthGuard,
 * })
 *
 * // Spread into MinimalRoutes children:
 * // children: [...otherRoutes, runtimeRoute]
 * ```
 */
export function createAppRuntimeRoute(config: AppRuntimeRouteConfig): AppRouteObject {
    const { path = 'a/:applicationId/*', component: Component, guard: Guard } = config

    return {
        path,
        element: Guard ? (
            <Guard>
                <Component />
            </Guard>
        ) : (
            <Component />
        )
    }
}
