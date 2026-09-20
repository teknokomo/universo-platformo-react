const normalizeLocaleForKey = (locale: string): string => locale.trim().split(/[-_]/)[0]?.toLowerCase() || 'en'

export const publicApplicationRuntimeQueryKeys = {
    all: ['public-application-runtime'] as const,
    runtime: (applicationRef: string, locale: string) =>
        [...publicApplicationRuntimeQueryKeys.all, applicationRef.trim().toLowerCase(), normalizeLocaleForKey(locale)] as const
}
