type ApiErrorPayload = {
    details?: unknown
    error?: unknown
    message?: unknown
    code?: unknown
}

type ApiErrorLike = {
    response?: {
        data?: ApiErrorPayload
    }
    message?: unknown
}

const getNonEmptyString = (value: unknown): string | null => {
    return typeof value === 'string' && value.trim().length > 0 ? value : null
}

const formatErrorDetails = (details: unknown): string | null => {
    const direct = getNonEmptyString(details)
    if (direct) {
        return direct
    }

    if (!details || typeof details !== 'object') {
        return null
    }

    const record = details as Record<string, unknown>
    const knownParts = ['importError', 'cleanupError', 'message', 'error', 'detail']
        .map((key) => getNonEmptyString(record[key]))
        .filter((value): value is string => Boolean(value))

    if (knownParts.length > 0) {
        return knownParts.join('; ')
    }

    try {
        return JSON.stringify(details)
    } catch {
        return null
    }
}

export const extractImportErrorMessage = (error: unknown, fallback = 'Snapshot import failed'): string => {
    const err = error as ApiErrorLike
    const data = err?.response?.data
    const details = formatErrorDetails(data?.details)
    const apiMessage = getNonEmptyString(data?.error) ?? getNonEmptyString(data?.message)

    if (apiMessage && details && details !== apiMessage) {
        return `${apiMessage}: ${details}`
    }

    return details ?? apiMessage ?? getNonEmptyString(err?.message) ?? fallback
}
