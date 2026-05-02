export const SAFE_MENU_HREF_RE = /^(\/(?!\/)|https?:|mailto:|tel:|#)/i

export const sanitizeMenuHref = (href?: string | null): string | undefined => {
    if (!href) return undefined
    const trimmed = href.trim()
    return SAFE_MENU_HREF_RE.test(trimmed) ? trimmed : undefined
}

export const isSafeMenuHref = (href?: string | null): boolean => sanitizeMenuHref(href) !== undefined
