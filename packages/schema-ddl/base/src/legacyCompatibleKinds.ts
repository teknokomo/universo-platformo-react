import { getLegacyCompatibleObjectKind, getLegacyCompatibleObjectKindForKindKey } from '@universo/types'

export type LegacyCompatibleKind = 'catalog' | 'hub' | 'set' | 'enumeration'

const isLegacyCompatibleKind = (kind: unknown): kind is LegacyCompatibleKind =>
    kind === 'catalog' || kind === 'hub' || kind === 'set' || kind === 'enumeration'

export const resolveLegacyCompatibleKind = (kind: unknown, config?: unknown): LegacyCompatibleKind | null => {
    if (isLegacyCompatibleKind(kind)) {
        return kind
    }

    const fromConfig = getLegacyCompatibleObjectKind(config)
    if (fromConfig && fromConfig !== 'document') {
        return fromConfig
    }

    const fromKindKey = getLegacyCompatibleObjectKindForKindKey(kind)
    return fromKindKey && fromKindKey !== 'document' ? fromKindKey : null
}

export const isNonPhysicalLegacyCompatibleEntity = (entity: { kind: unknown; config?: unknown }): boolean => {
    const legacyKind = resolveLegacyCompatibleKind(entity.kind, entity.config)
    return legacyKind === 'hub' || legacyKind === 'set' || legacyKind === 'enumeration'
}

export const isEnumerationCompatibleKind = (kind: unknown, config?: unknown): boolean =>
    resolveLegacyCompatibleKind(kind, config) === 'enumeration'

export const isSetCompatibleKind = (kind: unknown, config?: unknown): boolean => resolveLegacyCompatibleKind(kind, config) === 'set'