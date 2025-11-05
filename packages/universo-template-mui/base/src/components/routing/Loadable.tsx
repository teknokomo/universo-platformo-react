import React, { Suspense } from 'react'

// Local imports - use universo version instead of flowise
import { Loader } from '../feedback/loading'

/**
 * Higher-Order Component (HOC) for lazy-loaded components with Suspense fallback
 *
 * Automatically wraps lazy-loaded components in React.Suspense with a Loader fallback.
 * Preserves component props and TypeScript types.
 *
 * @template P - Component props type (extends object)
 *
 * @param Component - Lazy-loaded React component (from React.lazy())
 * @returns HOC that renders Component with Suspense + Loader fallback
 *
 * @example
 * ```tsx
 * import { lazy } from 'react'
 * import { Loadable } from '@universo/template-mui'
 *
 * const LazyPage = Loadable(lazy(() => import('./pages/MyPage')))
 *
 * // In routes:
 * <Route path="/my-page" element={<LazyPage />} />
 * ```
 *
 * @example With TypeScript props
 * ```tsx
 * interface MyPageProps {
 *   userId: string
 * }
 *
 * const LazyPage = Loadable<MyPageProps>(
 *   lazy(() => import('./pages/MyPage'))
 * )
 *
 * <Route path="/my-page" element={<LazyPage userId="123" />} />
 * ```
 */
export function Loadable<P extends object = object>(Component: React.ComponentType<P>): React.FC<P> {
    const LoadableComponent: React.FC<P> = (props) => (
        <Suspense fallback={<Loader />}>
            <Component {...props} />
        </Suspense>
    )

    // Set displayName for React DevTools
    LoadableComponent.displayName = `Loadable(${Component.displayName || Component.name || 'Component'})`

    return LoadableComponent
}
