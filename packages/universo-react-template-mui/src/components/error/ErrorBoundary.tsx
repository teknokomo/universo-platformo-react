import { Component, ErrorInfo, ReactNode } from 'react'
import { Box, Typography, Button, Paper, Alert } from '@mui/material'

interface Props {
    children: ReactNode
    onError?: (error: Error, errorInfo: ErrorInfo) => void
    onRetry?: () => void
}

interface State {
    hasError: boolean
    error: Error | null
    errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error: Error): State {
        // Update state so the next render will show the fallback UI
        return { hasError: true, error, errorInfo: null }
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        // Log error details for debugging
        console.error('[ErrorBoundary] Caught error:', {
            error: error,
            errorName: error.name,
            errorMessage: error.message,
            errorStack: error.stack,
            errorInfo: errorInfo,
            componentStack: errorInfo.componentStack,
            currentLocation: window.location.pathname,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        })

        // Update state with error details
        this.setState({
            error: error,
            errorInfo: errorInfo
        })

        // Report to logging service if available
        if (this.props.onError) {
            this.props.onError(error, errorInfo)
        }
    }

    handleRetry = () => {
        // Clear error state to retry rendering
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        })

        // Optionally navigate to a safe route
        if (this.props.onRetry) {
            this.props.onRetry()
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box
                    sx={{
                        padding: 3,
                        maxWidth: 800,
                        margin: '0 auto',
                        minHeight: '50vh',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center'
                    }}
                >
                    <Paper elevation={3} sx={{ padding: 3 }}>
                        <Alert severity='error' sx={{ mb: 3 }}>
                            <Typography variant='h5' component='h1' gutterBottom>
                                Что-то пошло не так
                            </Typography>
                            <Typography variant='body1' gutterBottom>
                                Произошла ошибка при загрузке этой страницы. Детали ошибки записаны в консоль для диагностики.
                            </Typography>
                        </Alert>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant='h6' color='error' gutterBottom>
                                    Детали ошибки (только в режиме разработки):
                                </Typography>
                                <Paper
                                    variant='outlined'
                                    sx={{
                                        padding: 2,
                                        backgroundColor: '#f5f5f5',
                                        fontFamily: 'monospace',
                                        fontSize: '0.8rem',
                                        maxHeight: 200,
                                        overflow: 'auto'
                                    }}
                                >
                                    <Typography component='pre'>
                                        {this.state.error.name}: {this.state.error.message}
                                        {'\n\n'}
                                        {this.state.error.stack}
                                        {'\n\nComponent Stack:'}
                                        {this.state.errorInfo?.componentStack}
                                    </Typography>
                                </Paper>
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button variant='contained' color='primary' onClick={this.handleRetry}>
                                Повторить попытку
                            </Button>
                            <Button variant='outlined' onClick={() => (window.location.href = '/')}>
                                Вернуться на главную
                            </Button>
                        </Box>
                    </Paper>
                </Box>
            )
        }

        return this.props.children
    }
}

export default ErrorBoundary
