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
    TreeEntity,
    TreeEntityDisplay,
    TreeEntityRef,
    LinkedCollectionEntity,
    LinkedCollectionDisplay,
    ValueGroupEntity,
    ValueGroupDisplay,
    OptionListEntity,
    OptionListDisplay,
    OptionValue,
    OptionValueDisplay,
    FieldDefinition,
    FieldDefinitionDisplay,
    FixedValue,
    FixedValueDisplay,
    RecordItem,
    RecordItemDisplay
} from './types'

// ============ SHARED HELPERS ============

/** Map hub references to display-ready objects with localized names */
function mapHubRefs(
    treeEntities: TreeEntityRef[] | undefined,
    locale: string
): Array<{ id: string; name: string; codename: string }> | undefined {
    return treeEntities?.map((hub) => ({
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

/** Convert OptionValue to OptionValueDisplay for table rendering */
export function toOptionValueDisplay(value: OptionValue, locale = 'en'): OptionValueDisplay {
    const base = mapBaseVlcFields(value, locale)
    return {
        ...base,
        sortOrder: value.effectiveSortOrder ?? value.sortOrder,
        effectiveSortOrder: value.effectiveSortOrder,
        isShared: value.isShared,
        isActive: value.isActive,
        isExcluded: value.isExcluded,
        sharedBehavior: value.sharedBehavior
    }
}

// ============ NAME-FALLBACK CONVERTERS ============

/** Convert MetahubLayout to MetahubLayoutDisplay for table/card rendering */
export function toMetahubLayoutDisplay(layout: MetahubLayout, locale = 'en'): MetahubLayoutDisplay {
    const base = mapBaseVlcFields(layout, locale)
    return { ...base, name: base.name || base.templateKey }
}

/** Convert TreeEntity to TreeEntityDisplay for table rendering */
export function toTreeEntityDisplay(hub: TreeEntity, locale = 'en'): TreeEntityDisplay {
    const base = mapBaseVlcFields(hub, locale)
    return { ...base, name: base.name || base.codename }
}

// ============ HUB-MAPPING CONVERTERS ============

/** Convert LinkedCollectionEntity to LinkedCollectionDisplay for table rendering */
export function toLinkedCollectionDisplay(catalog: LinkedCollectionEntity, locale = 'en'): LinkedCollectionDisplay {
    const base = mapBaseVlcFields(catalog, locale)
    return { ...base, name: base.name || base.codename, treeEntities: mapHubRefs(catalog.treeEntities, locale) }
}

/** Convert Set to ValueGroupDisplay for table rendering. */
export function toValueGroupDisplay(set: ValueGroupEntity, locale = 'en'): ValueGroupDisplay {
    const base = mapBaseVlcFields(set, locale)
    return { ...base, name: base.name || base.codename, treeEntities: mapHubRefs(set.treeEntities, locale) }
}

/** Convert OptionListEntity to OptionListDisplay for table rendering */
export function toOptionListDisplay(enumeration: OptionListEntity, locale = 'en'): OptionListDisplay {
    const base = mapBaseVlcFields(enumeration, locale)
    return { ...base, name: base.name || base.codename, treeEntities: mapHubRefs(enumeration.treeEntities, locale) }
}

// ============ SPECIAL CONVERTERS ============

/** Convert FieldDefinition to FieldDefinitionDisplay for table rendering */
export function toFieldDefinitionDisplay(attr: FieldDefinition, locale = 'en'): FieldDefinitionDisplay {
    return {
        ...attr,
        sortOrder: attr.effectiveSortOrder ?? attr.sortOrder,
        effectiveSortOrder: attr.effectiveSortOrder,
        codename: getLocalizedContentText(ensureEntityCodenameContent(attr, locale, attr.codename), locale, attr.codename),
        name: getVLCString(attr.name, locale),
        isShared: attr.isShared,
        isActive: attr.isActive,
        isExcluded: attr.isExcluded,
        sharedBehavior: attr.sharedBehavior
    }
}

/** Convert FixedValue to FixedValueDisplay for table rendering. */
export function toFixedValueDisplay(constant: FixedValue, locale = 'en'): FixedValueDisplay {
    return {
        ...constant,
        sortOrder: constant.effectiveSortOrder ?? constant.sortOrder,
        effectiveSortOrder: constant.effectiveSortOrder,
        codename: getLocalizedContentText(ensureEntityCodenameContent(constant, locale, constant.codename), locale, constant.codename),
        name: getVLCString(constant.name, locale),
        isShared: constant.isShared,
        isActive: constant.isActive,
        isExcluded: constant.isExcluded,
        sharedBehavior: constant.sharedBehavior
    }
}

/** Convert RecordItem to RecordItemDisplay for table rendering */
export function toRecordItemDisplay(element: RecordItem, fieldDefinitions: FieldDefinition[] = [], locale = 'en'): RecordItemDisplay {
    const displayAttr = fieldDefinitions.find((a) => a.isDisplayAttribute)
    const fallbackAttr = fieldDefinitions.find((a) => a.dataType === 'STRING')
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
