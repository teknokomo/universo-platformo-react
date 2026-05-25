export type TranslationVariables = Record<string, string | number | boolean>

export interface I18nAPI {
    getLocale(): Promise<string>
    translate(key: string, fallback?: string, variables?: TranslationVariables): Promise<string>
}
