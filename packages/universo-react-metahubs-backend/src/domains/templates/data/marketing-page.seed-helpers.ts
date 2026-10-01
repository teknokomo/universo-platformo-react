import { MARKETING_SAFE_HREF_PATTERN_SOURCE, MARKETING_SEMANTIC_KEY_PATTERN } from '@universo-react/types'
import type { TemplateSeedComponent } from '@universo-react/types'
import { vlc } from './basic.template'

export const marketingComponent = (
    codename: string,
    nameEn: string,
    nameRu: string,
    options: Partial<Omit<TemplateSeedComponent, 'codename' | 'name'>> = {}
): TemplateSeedComponent => ({
    codename,
    name: vlc(nameEn, nameRu),
    dataType: 'STRING',
    isRequired: options.isRequired ?? false,
    ...options
})

export const mediaComponent = (codename: string, nameEn: string, nameRu: string, isRequired = false): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'JSON',
        isRequired,
        validationRules: { format: 'marketingMediaReference' },
        uiConfig: { widget: 'resourceSource', gridHidden: true }
    })

export const localizedComponent = (
    codename: string,
    nameEn: string,
    nameRu: string,
    maxLength = 500,
    isRequired = false
): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        isRequired,
        validationRules: { maxLength, localized: true, versioned: true }
    })

export const plainComponent = (
    codename: string,
    nameEn: string,
    nameRu: string,
    maxLength = 500,
    isRequired = false
): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        isRequired,
        validationRules: { maxLength }
    })

export const marketingHrefComponent = (
    codename: string,
    nameEn: string,
    nameRu: string,
    maxLength = 500,
    isRequired = false
): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        isRequired,
        validationRules: { maxLength, pattern: MARKETING_SAFE_HREF_PATTERN_SOURCE, format: 'marketingHref' }
    })

/**
 * Semantic record keys are duplicated by copy or by re-typing, so they carry
 * both the canonical lowercase pattern and the uniqueness rule that the
 * records service enforces inside the metahub.
 */
export const keyComponent = (codename: string, nameEn: string, nameRu: string, maxLength = 64): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        isRequired: true,
        validationRules: { maxLength, unique: true, pattern: MARKETING_SEMANTIC_KEY_PATTERN.source },
        uiConfig: { hidden: true, gridHidden: true, autoGenerateSemanticKey: true }
    })

export const resourceSource = (url: string) => ({ type: 'url' as const, url, launchMode: 'inline' as const })
