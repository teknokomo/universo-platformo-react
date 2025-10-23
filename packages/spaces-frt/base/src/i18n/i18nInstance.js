import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Universo Platformo | Import main files
import enTranslation from './locales/en.json'
import ruTranslation from './locales/ru.json'

// Universo Platformo | Import auth namespaces
import enAuthTranslation from './locales/en/views/auth.json'
import ruAuthTranslation from './locales/ru/views/auth.json'

// Universo Platformo | Import admin namespaces
import enAdminTranslation from './locales/en/views/admin.json'
import ruAdminTranslation from './locales/ru/views/admin.json'

// Universo Platformo | Import menu namespaces
import enMenuTranslation from './locales/en/views/menu.json'
import ruMenuTranslation from './locales/ru/views/menu.json'

// Universo Platformo | Import assistants namespaces
import enAssistantsTranslation from './locales/en/views/assistants.json'
import ruAssistantsTranslation from './locales/ru/views/assistants.json'

// Universo Platformo | Import vector-store namespaces
import enVectorStoreTranslation from './locales/en/views/vector-store.json'
import ruVectorStoreTranslation from './locales/ru/views/vector-store.json'

// Universo Platformo | Import document-store namespaces
import enDocumentStoreTranslation from './locales/en/views/document-store.json'
import ruDocumentStoreTranslation from './locales/ru/views/document-store.json'

// Universo Platformo | Import credentials namespaces
import enCredentialsTranslation from './locales/en/views/credentials.json'
import ruCredentialsTranslation from './locales/ru/views/credentials.json'

// Universo Platformo | Import api-keys namespaces
import enApiKeysTranslation from './locales/en/views/api-keys.json'
import ruApiKeysTranslation from './locales/ru/views/api-keys.json'

// Universo Platformo | Import variables namespaces
import enVariablesTranslation from './locales/en/views/variables.json'
import ruVariablesTranslation from './locales/ru/views/variables.json'

// Universo Platformo | Import tools namespaces
import enToolsTranslation from './locales/en/views/tools.json'
import ruToolsTranslation from './locales/ru/views/tools.json'

// Universo Platformo | Import templates namespaces
import enTemplatesTranslation from './locales/en/views/templates.json'
import ruTemplatesTranslation from './locales/ru/views/templates.json'

// Canvas translations now come from spaces-frt module

// Universo Platformo | Import canvases namespaces
import enCanvasesTranslation from './locales/en/views/canvases.json'
import ruCanvasesTranslation from './locales/ru/views/canvases.json'

// Universo Platformo | Import chatmessage namespaces
import enChatmessageTranslation from './locales/en/views/chatmessage.json'
import ruChatmessageTranslation from './locales/ru/views/chatmessage.json'

// Universo Platformo | Import flowList namespaces
import enFlowListTranslation from './locales/en/views/flowList.json'
import ruFlowListTranslation from './locales/ru/views/flowList.json'

// Universo Platformo | Import publish module translations
// Using alias @packages/publish/base/i18n for correct path resolution
import { publishTranslations } from '@universo/publish-frt/i18n'

// Universo Platformo | Import analytics module translations
import { analyticsTranslations } from '@universo/analytics-frt/i18n'
// Universo Platformo | Import profile module translations
import { profileTranslations } from '@universo/profile-frt/i18n'
import { uniksTranslations } from '@universo/uniks-frt/i18n'
import { metaversesTranslations } from '@universo/metaverses-frt/i18n'
import { templateMmoommTranslations } from '@universo/template-mmoomm/i18n'
import { templateQuizTranslations } from '@universo/template-quiz/i18n'
// Spaces FRt translations - import directly from local files to avoid circular dependency
import canvasEn from './en/canvas.json'
import canvasRu from './ru/canvas.json'

// Build spacesFrtTranslations locally to avoid circular dependency
const spacesFrtTranslations = {
    en: {
        spaces: {},
        canvas: canvasEn
    },
    ru: {
        spaces: {},
        canvas: canvasRu
    }
}

const GLOBAL_I18N_KEY = '__universo_i18n__instance'
const globalScope = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {}

const instance = globalScope[GLOBAL_I18N_KEY] ?? i18n

if (!instance.isInitialized) {
    if (process.env.NODE_ENV !== 'production') {
        console.info('[i18n] Initializing shared instance', {
            reuse: Boolean(globalScope[GLOBAL_I18N_KEY]),
            detector: 'LanguageDetector',
            hasInitReactI18next: typeof initReactI18next === 'object' || typeof initReactI18next === 'function'
        })
    }
    // Universo Platformo | i18next initialization with namespaces support
    instance.use(LanguageDetector)
        .use(initReactI18next)
        .init(
        {
            resources: {
                en: {
                    translation: enTranslation,
                    auth: enAuthTranslation,
                    uniks: uniksTranslations.en.uniks,
                    admin: enAdminTranslation,
                    menu: enMenuTranslation,
                    assistants: enAssistantsTranslation,
                    'vector-store': enVectorStoreTranslation,
                    'document-store': enDocumentStoreTranslation,
                    credentials: enCredentialsTranslation,
                    'api-keys': enApiKeysTranslation,
                    variables: enVariablesTranslation,
                    tools: enToolsTranslation,
                    templates: enTemplatesTranslation,
                    // canvas translations provided by spacesFrtTranslations below
                    canvases: enCanvasesTranslation?.canvases || enCanvasesTranslation,
                    chatmessage: enChatmessageTranslation,
                    flowList: enFlowListTranslation.flowList || enFlowListTranslation,
                    publish: publishTranslations.en.publish,
                    templateMmoomm: templateMmoommTranslations.en.templateMmoomm,
                    templateQuiz: templateQuizTranslations.en.templateQuiz,
                    // Spaces/Canvas extracted app namespaces
                    spaces: spacesFrtTranslations.en.spaces,
                    canvas: spacesFrtTranslations.en.canvas,
                    analytics: analyticsTranslations.en.analytics,
                    profile: profileTranslations.en.profile,
                    metaverses: metaversesTranslations.en.metaverses
                },
                ru: {
                    translation: ruTranslation,
                    auth: ruAuthTranslation,
                    uniks: uniksTranslations.ru.uniks,
                    admin: ruAdminTranslation,
                    menu: ruMenuTranslation,
                    assistants: ruAssistantsTranslation,
                    'vector-store': ruVectorStoreTranslation,
                    'document-store': ruDocumentStoreTranslation,
                    credentials: ruCredentialsTranslation,
                    'api-keys': ruApiKeysTranslation,
                    variables: ruVariablesTranslation,
                    tools: ruToolsTranslation,
                    templates: ruTemplatesTranslation,
                    // canvas translations provided by spacesFrtTranslations below
                    canvases: ruCanvasesTranslation?.canvases || ruCanvasesTranslation,
                    chatmessage: ruChatmessageTranslation,
                    flowList: ruFlowListTranslation.flowList || ruFlowListTranslation,
                    publish: publishTranslations.ru.publish,
                    templateMmoomm: templateMmoommTranslations.ru.templateMmoomm,
                    templateQuiz: templateQuizTranslations.ru.templateQuiz,
                    // Spaces/Canvas extracted app namespaces
                    spaces: spacesFrtTranslations.ru.spaces,
                    canvas: spacesFrtTranslations.ru.canvas,
                    analytics: analyticsTranslations.ru.analytics,
                    profile: profileTranslations.ru.profile,
                    metaverses: metaversesTranslations.ru.metaverses
                }
            },
            fallbackLng: 'en',
            // Detection configuration ensures manual selection persists
            // and has priority over browser language
            detection: {
                // Prefer persisted user choice over browser
                order: ['localStorage', 'navigator', 'htmlTag'],
                // Persist user choice between sessions
                caches: ['localStorage'],
                lookupLocalStorage: 'i18nextLng'
            },
            ns: [
                'translation',
                'auth',
                'uniks',
                'admin',
                'menu',
                'assistants',
                'vector-store',
                'document-store',
                'credentials',
                'api-keys',
                'variables',
                'tools',
                'templates',
                'spaces',
                'canvas',
                'canvases',
                'chatmessage',
                'flowList',
                'publish',
                'finance',
                'analytics',
                'profile',
                'metaverse',
                'templateMmoomm',
                'templateQuiz',
                'resources',
                'metaverses'
            ],
            defaultNS: 'translation',
            fallbackNS: 'translation',
            interpolation: { escapeValue: false },
            debug: process.env.NODE_ENV === 'development',
            react: {
                useSuspense: false
            }
        },
        (err) => {
            if (err) {
                console.error('i18next initialization error:', err)
            }
        }
        )
}

if (!globalScope[GLOBAL_I18N_KEY]) {
    globalScope[GLOBAL_I18N_KEY] = instance
}

if (process.env.NODE_ENV !== 'production') {
    console.debug('[i18n] Module ready', {
        isInitialized: instance.isInitialized,
        language: instance.language,
        modules: Object.keys(instance?.modules ?? {})
    })
}

export default instance
