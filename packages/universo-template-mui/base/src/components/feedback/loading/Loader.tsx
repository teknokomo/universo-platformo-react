import React from 'react'
import { LinearProgress } from '@mui/material'
import { styled } from '@mui/material/styles'

/**
 * Styled wrapper for the fixed position loader
 * Uses theme.zIndex.modal to ensure it appears above most content
 */
const LoaderWrapper = styled('div')(({ theme }) => ({
    position: 'fixed',
    top: 0,
    left: 0,
    zIndex: theme.zIndex.modal,
    width: '100%'
}))

/**
 * Full-width loader component displayed at the top of the viewport
 * 
 * Used for:
 * - Lazy-loaded route transitions
 * - Global loading states
 * - Suspense fallback UI
 * 
 * @example
 * ```tsx
 * import { Loader } from '@universo/template-mui'
 * 
 * <Suspense fallback={<Loader />}>
 *   <LazyComponent />
 * </Suspense>
 * ```
 */
export const Loader: React.FC = () => (
    <LoaderWrapper>
        <LinearProgress color="primary" />
    </LoaderWrapper>
)
