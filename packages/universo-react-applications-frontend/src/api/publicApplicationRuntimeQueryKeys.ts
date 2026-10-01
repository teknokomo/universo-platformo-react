const normalizeLocaleForKey = (locale: string): string => locale.trim().split(/[-_]/)[0]?.toLowerCase() || 'en'

import type { PublicApplicationRuntimeTarget } from './publicApplicationRuntime'

const normalizeTargetForKey = (target?: PublicApplicationRuntimeTarget) => ({
    targetKind: target?.targetKind == null ? null : target.targetKind.trim().toLowerCase(),
    entityTypeId: target?.entityTypeId == null ? null : target.entityTypeId.trim().toLowerCase(),
    entityTypeCodename: target?.entityTypeCodename == null ? null : target.entityTypeCodename.trim()
})

export const publicApplicationRuntimeQueryKeys = {
    all: ['public-application-runtime'] as const,
    runtime: (applicationRef: string, locale: string, target?: PublicApplicationRuntimeTarget) =>
        [
            ...publicApplicationRuntimeQueryKeys.all,
            applicationRef.trim().toLowerCase(),
            normalizeLocaleForKey(locale),
            normalizeTargetForKey(target)
        ] as const
}
