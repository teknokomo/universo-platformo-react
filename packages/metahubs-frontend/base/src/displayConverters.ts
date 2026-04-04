/**
 * Display converter functions for metahub entities.
 *
 * Converts VLC-based entity objects to flat-string Display variants
 * for table/card rendering. Uses mapBaseVlcFields as a building block
 * for the common codename/name/description extraction.
 */
import { getVLCString } from '@universo/utils/vlc'
import { mapBaseVlcFields } from '@universo/utils/vlc'
import type { VersatileLocalizedContent } from '@universo/utils/vlc'
import { ensureEntityCodenameContent, getLocalizedContentText } from './utils/localizedInput'
import type {
    Metahub,
    MetahubDisplay,
    MetahubBranch,
    MetahubBranchDisplay,
    MetahubLayout,
    MetahubLayoutDisplay,
    Hub,
    HubDisplay,
    HubRef,
    Catalog,
    CatalogDisplay,
    MetahubSet,
    MetahubSetDisplay,
    Enumeration,
    EnumerationDisplay,
    EnumerationValue,
    EnumerationValueDisplay,
    Attribute,
    AttributeDisplay,
    Constant,
    ConstantDisplay,
    HubElement,
    HubElementDisplay
} from './types'

// ============ SHARED HELPERS ============

/** Map hub references to display-ready objects with localized names */
function mapHubRefs(hubs: HubRef[] | undefined, locale: string): Array<{ id: string; name: string; codename: string }> | undefined {
    return hubs?.map((hub) => ({
        id: hub.id,
        name: getVLCString(hub.name, locale) || hub.codename,
        codename: hub.codename
    }))
}

// ============ SIMPLE CONVERTERS ============

/** Convert Metahub to MetahubDisplay for table rendering */
export function toMetahubDisplay(metahub: Metahub, locale = 'en'): MetahubDisplay {
    return mapBaseVlcFields(metahub, locale)
}

/** Convert Branch to BranchDisplay for table rendering */
export function toBranchDisplay(branch: MetahubBranch, locale = 'en'): MetahubBranchDisplay {
    return mapBaseVlcFields(branch, locale)
}

/** Convert EnumerationValue to EnumerationValueDisplay for table rendering */
export function toEnumerationValueDisplay(value: EnumerationValue, locale = 'en'): EnumerationValueDisplay {
    return mapBaseVlcFields(value, locale)
}

// ============ NAME-FALLBACK CONVERTERS ============

/** Convert MetahubLayout to MetahubLayoutDisplay for table/card rendering */
export function toMetahubLayoutDisplay(layout: MetahubLayout, locale = 'en'): MetahubLayoutDisplay {
    const base = mapBaseVlcFields(layout, locale)
    return { ...base, name: base.name || base.templateKey }
}

/** Convert Hub to HubDisplay for table rendering */
export function toHubDisplay(hub: Hub, locale = 'en'): HubDisplay {
    const base = mapBaseVlcFields(hub, locale)
    return { ...base, name: base.name || base.codename }
}

// ============ HUB-MAPPING CONVERTERS ============

/** Convert Catalog to CatalogDisplay for table rendering */
export function toCatalogDisplay(catalog: Catalog, locale = 'en'): CatalogDisplay {
    const base = mapBaseVlcFields(catalog, locale)
    return { ...base, name: base.name || base.codename, hubs: mapHubRefs(catalog.hubs, locale) }
}

/** Convert Set to MetahubSetDisplay for table rendering. */
export function toSetDisplay(set: MetahubSet, locale = 'en'): MetahubSetDisplay {
    const base = mapBaseVlcFields(set, locale)
    return { ...base, name: base.name || base.codename, hubs: mapHubRefs(set.hubs, locale) }
}

/** Convert Enumeration to EnumerationDisplay for table rendering */
export function toEnumerationDisplay(enumeration: Enumeration, locale = 'en'): EnumerationDisplay {
    const base = mapBaseVlcFields(enumeration, locale)
    return { ...base, name: base.name || base.codename, hubs: mapHubRefs(enumeration.hubs, locale) }
}

// ============ SPECIAL CONVERTERS ============

/** Convert Attribute to AttributeDisplay for table rendering */
export function toAttributeDisplay(attr: Attribute, locale = 'en'): AttributeDisplay {
    return {
        ...attr,
        codename: getLocalizedContentText(ensureEntityCodenameContent(attr, locale, attr.codename), locale, attr.codename),
        name: getVLCString(attr.name, locale)
    }
}

/** Convert Constant to ConstantDisplay for table rendering. */
export function toConstantDisplay(constant: Constant, locale = 'en'): ConstantDisplay {
    return {
        ...constant,
        codename: getLocalizedContentText(ensureEntityCodenameContent(constant, locale, constant.codename), locale, constant.codename),
        name: getVLCString(constant.name, locale)
    }
}

/** Convert HubElement to HubElementDisplay for table rendering */
export function toHubElementDisplay(element: HubElement, attributes: Attribute[] = [], locale = 'en'): HubElementDisplay {
    const displayAttr = attributes.find((a) => a.isDisplayAttribute)
    const fallbackAttr = attributes.find((a) => a.dataType === 'STRING')
    const selectedAttr = displayAttr || fallbackAttr
    const rawValue = selectedAttr ? element.data[selectedAttr.codename] : undefined
    const nameValue =
        selectedAttr && rawValue !== undefined && rawValue !== null
            ? getVLCString(rawValue as VersatileLocalizedContent, locale) || String(rawValue)
            : `Element ${element.id.slice(0, 8)}`

    return {
        ...element,
        name: nameValue,
        description: ''
    }
}
