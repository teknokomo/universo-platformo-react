export function getApiErrorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'response' in error && (error as any).response?.data?.error) {
        return String((error as any).response.data.error)
    }
    return String(error)
}
