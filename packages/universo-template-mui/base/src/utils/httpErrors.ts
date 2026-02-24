import { AxiosError } from 'axios'

export const isAccessDeniedError = (error: unknown): boolean => {
    if (error instanceof AxiosError) {
        const status = error.response?.status
        return status === 403 || status === 404
    }
    if (error && typeof error === 'object' && 'status' in error) {
        const status = (error as { status: number }).status
        return status === 403 || status === 404
    }
    return false
}
