import en from './locales/en/main.json'
import ru from './locales/ru/main.json'

export const spaceBuilderTranslations: Record<string, any> = { en, ru }

export function registerSpaceBuilderI18n(i18nInstance: any): void {
    const ns = 'translation'
    for (const [lng, bundle] of Object.entries(spaceBuilderTranslations)) {
        const existing = i18nInstance.getResourceBundle(lng, ns) || {}
        i18nInstance.addResourceBundle(lng, ns, { ...existing, ...bundle }, true, true)
    }
}

export default spaceBuilderTranslations
