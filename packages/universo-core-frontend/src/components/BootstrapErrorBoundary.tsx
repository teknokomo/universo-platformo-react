import React, { type ErrorInfo, type ReactNode } from 'react'

const defaultFallback = (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h2>Something went wrong during initialization.</h2>
        <p>Please check the browser console for diagnostic details.</p>
    </div>
)

interface BootstrapErrorBoundaryProps {
    children: ReactNode
}

interface BootstrapErrorBoundaryState {
    hasError: boolean
}

class BootstrapErrorBoundary extends React.Component<BootstrapErrorBoundaryProps, BootstrapErrorBoundaryState> {
    constructor(props: BootstrapErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(): BootstrapErrorBoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, info: ErrorInfo): void {
        // eslint-disable-next-line no-console
        console.error('[bootstrap-boundary]', {
            message: error?.message,
            stack: error?.stack,
            componentStack: info?.componentStack
        })
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return defaultFallback
        }

        return this.props.children
    }
}

export default BootstrapErrorBoundary
