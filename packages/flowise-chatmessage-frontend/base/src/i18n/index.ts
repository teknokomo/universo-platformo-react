// Universo Platformo | Chat Message module i18n
// Export translations for use in the main application

import { registerNamespace } from '@universo/i18n'
import chatmessageEn from './en/chatmessage.json'
import chatmessageRu from './ru/chatmessage.json'

type LanguageCode = 'en' | 'ru'

interface ChatmessageTranslation {
    chatmessage: Record<string, unknown>
}

interface TranslationsMap {
    [key: string]: ChatmessageTranslation
}

/**
 * Chatmessage namespace constant for i18n
 */
export const chatmessageNamespace = 'chatmessage'

/**
 * Chatmessage translations object for integration with the main i18n system
 * Format: { [language]: { chatmessage: [translations] } }
 */
export const chatmessageResources: TranslationsMap = {
    en: {
        chatmessage: chatmessageEn
    },
    ru: {
        chatmessage: chatmessageRu
    }
}

// Side-effect: register the 'chatmessage' namespace with the global i18n instance
// Ensures translations are available when the Chat components are rendered
registerNamespace('chatmessage', {
    en: chatmessageEn,
    ru: chatmessageRu
})

/**
 * Get Chatmessage translations for a specific language
 * @param language - Language code (e.g., 'en', 'ru')
 * @returns Translations for the specified language
 */
export function getChatmessageTranslations(language: LanguageCode): Record<string, unknown> {
    return chatmessageResources[language]?.chatmessage || chatmessageResources.en.chatmessage
}

// Re-export for consumers
export { chatmessageEn, chatmessageRu }
