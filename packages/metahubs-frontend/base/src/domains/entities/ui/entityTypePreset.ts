import type { CodenameAlphabet, CodenameStyle, ComponentManifest, EntityTypePresetManifest } from '@universo/types'

import { getVLCString } from '../../../types'
import { ensureLocalizedContent } from '../../../utils/localizedInput'
import { normalizeCodenameForStyle } from '../../../utils/codename'

const normalizePresetComponents = (value: ComponentManifest): ComponentManifest => ({
    ...value
})

const stringifyJson = (value: unknown): string => JSON.stringify(value ?? {}, null, 2)

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const isEntityTypePresetManifest = (manifest: unknown): manifest is EntityTypePresetManifest => {
    return Boolean(
        manifest &&
            typeof manifest === 'object' &&
            '$schema' in manifest &&
            (manifest as { $schema?: string }).$schema === 'entity-type-preset/v1'
    )
}

export const buildEntityTypePresetFormPatch = (
    manifest: EntityTypePresetManifest,
    uiLocale: string,
    codenameStyle: CodenameStyle,
    codenameAlphabet: CodenameAlphabet
) => {
    const presentation = isRecord(manifest.entityType.presentation) ? manifest.entityType.presentation : {}
    const presetName = manifest.entityType.ui.nameKey.trim() || getVLCString(manifest.name, uiLocale) || manifest.codename
    const presetDescription = manifest.entityType.ui.descriptionKey?.trim() || getVLCString(manifest.description, uiLocale) || ''
    const presetCodenameText =
        getVLCString(manifest.entityType.codename, manifest.entityType.codename?._primary ?? uiLocale) || manifest.entityType.kindKey
    const normalizedCodename = normalizeCodenameForStyle(presetCodenameText, codenameStyle, codenameAlphabet)

    return {
        nameVlc: ensureLocalizedContent(presentation.name ?? manifest.name, uiLocale, presetName),
        descriptionVlc: presetDescription
            ? ensureLocalizedContent(presentation.description ?? manifest.description, uiLocale, presetDescription)
            : null,
        codename: ensureLocalizedContent(
            manifest.entityType.codename,
            manifest.entityType.codename?._primary ?? uiLocale,
            normalizedCodename || manifest.entityType.kindKey
        ),
        codenameTouched: false,
        kindKey: manifest.entityType.kindKey,
        iconName: manifest.entityType.ui.iconName,
        tabs: [...manifest.entityType.ui.tabs],
        customTabsInput: '',
        sidebarSection: manifest.entityType.ui.sidebarSection,
        sidebarOrder: manifest.entityType.ui.sidebarOrder ?? '',
        resourceSurfaces: manifest.entityType.ui.resourceSurfaces ? [...manifest.entityType.ui.resourceSurfaces] : [],
        components: normalizePresetComponents(manifest.entityType.components),
        presentationText: stringifyJson(manifest.entityType.presentation ?? {}),
        configText: stringifyJson(manifest.entityType.config ?? {}),
        published: true
    }
}
