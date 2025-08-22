// Common utilities for template system

/**
 * Sanitize player name for safe usage in HTML and network
 */
export function sanitizePlayerName(name: string): string {
    return name
        .trim()
        .slice(0, 32)
        .replace(/[<>"'&]/g, '')
        .replace(/\s+/g, ' ')
}

/**
 * Escape HTML content to prevent XSS
 */
export function escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
}

/**
 * Validate server URL format
 */
export function validateServerUrl(url: string): boolean {
    try {
        const parsed = new URL(url)
        return ['ws:', 'wss:', 'http:', 'https:'].includes(parsed.protocol)
    } catch {
        return false
    }
}

/**
 * Generate unique ID for entities
 */
export function generateEntityId(): string {
    return `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Deep clone object utility
 */
export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    if (obj instanceof Date) {
        return new Date(obj.getTime()) as unknown as T
    }

    if (obj instanceof Array) {
        return obj.map(item => deepClone(item)) as unknown as T
    }

    if (typeof obj === 'object') {
        const cloned = {} as T
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = deepClone(obj[key])
            }
        }
        return cloned
    }

    return obj
}