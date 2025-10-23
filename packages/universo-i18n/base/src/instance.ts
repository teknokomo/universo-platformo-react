import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import all base translation files
import en from './locales/en.json'
import ru from './locales/ru.json'

import adminEn from './locales/en/views/admin.json'
import adminRu from './locales/ru/views/admin.json'

import apiKeysEn from './locales/en/views/api-keys.json'
import apiKeysRu from './locales/ru/views/api-keys.json'

import assistantsEn from './locales/en/views/assistants.json'
import assistantsRu from './locales/ru/views/assistants.json'

import authEn from './locales/en/views/auth.json'
import authRu from './locales/ru/views/auth.json'

import canvasesEn from './locales/en/views/canvases.json'
import canvasesRu from './locales/ru/views/canvases.json'

import canvasEn from './locales/en/views/canvas.json'
import canvasRu from './locales/ru/views/canvas.json'

import chatmessageEn from './locales/en/views/chatmessage.json'
import chatmessageRu from './locales/ru/views/chatmessage.json'

import credentialsEn from './locales/en/views/credentials.json'
import credentialsRu from './locales/ru/views/credentials.json'

import documentStoreEn from './locales/en/views/document-store.json'
import documentStoreRu from './locales/ru/views/document-store.json'

import flowListEn from './locales/en/views/flowList.json'
import flowListRu from './locales/ru/views/flowList.json'

import menuEn from './locales/en/views/menu.json'
import menuRu from './locales/ru/views/menu.json'

import templatesEn from './locales/en/views/templates.json'
import templatesRu from './locales/ru/views/templates.json'

import toolsEn from './locales/en/views/tools.json'
import toolsRu from './locales/ru/views/tools.json'

import variablesEn from './locales/en/views/variables.json'
import variablesRu from './locales/ru/views/variables.json'

import vectorStoreEn from './locales/en/views/vector-store.json'
import vectorStoreRu from './locales/ru/views/vector-store.json'

declare global {
    // eslint-disable-next-line no-var
    var __universo_i18n__instance: typeof i18n | undefined
}

export function getInstance(): typeof i18n {
    if (!globalThis.__universo_i18n__instance) {
        const instance = i18n.createInstance()

        instance
            .use(LanguageDetector)
            .use(initReactI18next)
            .init({
                resources: {
                    en: {
                        translation: en,
                        admin: adminEn,
                        'api-keys': apiKeysEn,
                        assistants: assistantsEn,
                        auth: authEn,
                        canvases: canvasesEn,
                        canvas: canvasEn,
                        chatmessage: chatmessageEn,
                        credentials: credentialsEn,
                        'document-store': documentStoreEn,
                        flowList: flowListEn,
                        menu: menuEn,
                        templates: templatesEn,
                        tools: toolsEn,
                        variables: variablesEn,
                        'vector-store': vectorStoreEn
                    },
                    ru: {
                        translation: ru,
                        admin: adminRu,
                        'api-keys': apiKeysRu,
                        assistants: assistantsRu,
                        auth: authRu,
                        canvases: canvasesRu,
                        canvas: canvasRu,
                        chatmessage: chatmessageRu,
                        credentials: credentialsRu,
                        'document-store': documentStoreRu,
                        flowList: flowListRu,
                        menu: menuRu,
                        templates: templatesRu,
                        tools: toolsRu,
                        variables: variablesRu,
                        'vector-store': vectorStoreRu
                    }
                },
                fallbackLng: 'en',
                debug: false,
                interpolation: {
                    escapeValue: false
                }
            })

        globalThis.__universo_i18n__instance = instance
    }

    return globalThis.__universo_i18n__instance
}
