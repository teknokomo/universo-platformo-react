import { MARKETING_SEMANTIC_KEY_PATTERN } from '@universo-react/types'
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
    ...options
})

export const mediaComponent = (codename: string, nameEn: string, nameRu: string): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'JSON',
        uiConfig: { widget: 'resourceSource', gridHidden: true }
    })

export const localizedComponent = (codename: string, nameEn: string, nameRu: string, maxLength = 500): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        validationRules: { maxLength, localized: true, versioned: true }
    })

export const plainComponent = (codename: string, nameEn: string, nameRu: string, maxLength = 500): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        validationRules: { maxLength }
    })

/**
 * Semantic record keys are duplicated by copy or by re-typing, so they carry
 * both the canonical lowercase pattern and the uniqueness rule that the
 * records service enforces inside the metahub.
 */
export const keyComponent = (codename: string, nameEn: string, nameRu: string, maxLength = 64): TemplateSeedComponent =>
    marketingComponent(codename, nameEn, nameRu, {
        dataType: 'STRING',
        validationRules: { maxLength, unique: true, pattern: MARKETING_SEMANTIC_KEY_PATTERN.source }
    })

export const resourceSource = (url: string) => ({ type: 'url' as const, url, launchMode: 'inline' as const })
