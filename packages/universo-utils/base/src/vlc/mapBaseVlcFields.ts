import { getVLCString, getVLCPrimaryString } from './getters'
import type { VersionedLocalizedContent } from '@universo/types'

interface VlcMappableEntity {
    codename?: VersionedLocalizedContent<string> | string | null
    name?: VersionedLocalizedContent<string> | null
    description?: VersionedLocalizedContent<string> | null
}

/**
 * Extracts VLC strings for the standard codename/name/description triple.
 * Use as a building block inside domain-specific toXxxDisplay() functions.
 *
 * Does NOT replace converters with entity-specific logic (nested hub mapping,
 * codename repair via ensureEntityCodenameContent, fallback chains).
 *
 * @example
 * ```ts
 * // Simple case — full replacement:
 * export const toMetahubDisplay = (m: Metahub, locale = 'en') => mapBaseVlcFields(m, locale)
 *
 * // Complex case — as building block:
 * export function toCatalogDisplay(catalog: Catalog, locale = 'en'): CatalogDisplay {
 *   const base = mapBaseVlcFields(catalog, locale)
 *   return { ...base, name: base.name || base.codename }
 * }
 * ```
 */
export function mapBaseVlcFields<T extends VlcMappableEntity>(
    entity: T,
    locale = 'en'
): T & { codename: string; name: string; description: string } {
    return {
        ...entity,
        codename: typeof entity.codename === 'string' ? entity.codename : entity.codename ? getVLCPrimaryString(entity.codename) : '',
        name: entity.name ? getVLCString(entity.name, locale) ?? '' : '',
        description: entity.description ? getVLCString(entity.description, locale) ?? '' : ''
    }
}
