import React from 'react'

const defaultFallback = (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
        <h2>Something went wrong during initialization.</h2>
        <p>Please check the browser console for diagnostic details.</p>
    </div>
)

class BootstrapErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError() {
        return { hasError: true }
    }

    componentDidCatch(error, info) {
        // eslint-disable-next-line no-console
        console.error('[bootstrap-boundary]', {
            message: error?.message,
            stack: error?.stack,
            componentStack: info?.componentStack,
        })
    }

    render() {
        if (this.state.hasError) {
            return defaultFallback
        }

        return this.props.children
    }
}

export default BootstrapErrorBoundary
