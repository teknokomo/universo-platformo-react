import { slugify } from '@justrelate/slugify'

export const slugifyCodename = (value: string) => {
    if (!value) return ''

    const normalized = slugify(String(value))

    return normalized
        .replace(/_+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
}
