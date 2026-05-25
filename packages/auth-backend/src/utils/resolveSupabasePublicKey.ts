const trimEnv = (value: string | undefined): string | null => {
    if (typeof value !== 'string') {
        return null
    }

    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

export function resolveSupabasePublicKey(): string {
    const publishableKey = trimEnv(process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY)
    if (publishableKey) {
        return publishableKey
    }

    const legacyAnonKey = trimEnv(process.env.SUPABASE_ANON_KEY)
    if (legacyAnonKey) {
        return legacyAnonKey
    }

    throw new Error('Missing Supabase public key. Set SUPABASE_PUBLISHABLE_DEFAULT_KEY or SUPABASE_ANON_KEY.')
}
