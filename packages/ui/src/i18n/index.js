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

// Universo Platformo | Import chatflows namespaces
import enChatflowsTranslation from './locales/en/views/chatflows.json'
import ruChatflowsTranslation from './locales/ru/views/chatflows.json'

// Universo Platformo | Import chatmessage namespaces
import enChatmessageTranslation from './locales/en/views/chatmessage.json'
import ruChatmessageTranslation from './locales/ru/views/chatmessage.json'

// Universo Platformo | Import flowList namespaces
import enFlowListTranslation from './locales/en/views/flowList.json'
import ruFlowListTranslation from './locales/ru/views/flowList.json'

// Universo Platformo | Import publish module translations
// Using alias @apps/publish/base/i18n for correct path resolution
import { publishTranslations } from '@apps/publish-frt/base/src/i18n'

// Universo Platformo | Import analytics module translations
import { analyticsTranslations } from '@apps/analytics-frt/base/src/i18n'
// Universo Platformo | Import profile module translations
import { profileTranslations } from '@apps/profile-frt/base/src/i18n'
// Universo Platformo | Import finance module translations
import { financeTranslations } from '@apps/finance-frt/base/src/i18n'
import { uniksTranslations } from '@apps/uniks-frt/base/src/i18n'
import { resourcesTranslations } from '@universo/resources-frt'
import { metaversesTranslations } from '@universo/metaverses-frt'
import { templateMmoommTranslations } from '@apps/template-mmoomm/base/src/i18n'
import { templateQuizTranslations } from '@universo/template-quiz'
// Spaces FRt translations (namespaces spaces/canvas). Initially empty, extended over time.
import { spacesFrtTranslations } from '@apps/spaces-frt/base/src/i18n'

// Universo Platformo | i18next initialization with namespaces support
i18n.use(LanguageDetector)
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
                    // Use the nested object to avoid double key level (chatflows.chatflows.*)
                    chatflows: enChatflowsTranslation?.chatflows || enChatflowsTranslation,
                    chatmessage: enChatmessageTranslation,
                    flowList: enFlowListTranslation.flowList || enFlowListTranslation,
                    publish: publishTranslations.en.publish,
                    templateMmoomm: templateMmoommTranslations.en.templateMmoomm,
                    templateQuiz: templateQuizTranslations.en.templateQuiz,
                    // Spaces/Canvas extracted app namespaces
                    spaces: spacesFrtTranslations.en.spaces,
                    canvas: spacesFrtTranslations.en.canvas,
                    finance: financeTranslations.en.finance,
                    analytics: analyticsTranslations.en.analytics,
                    profile: profileTranslations.en.profile,
                    resources: resourcesTranslations.en.resources,
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
                    chatflows: ruChatflowsTranslation?.chatflows || ruChatflowsTranslation,
                    chatmessage: ruChatmessageTranslation,
                    flowList: ruFlowListTranslation.flowList || ruFlowListTranslation,
                    publish: publishTranslations.ru.publish,
                    templateMmoomm: templateMmoommTranslations.ru.templateMmoomm,
                    templateQuiz: templateQuizTranslations.ru.templateQuiz,
                    // Spaces/Canvas extracted app namespaces
                    spaces: spacesFrtTranslations.ru.spaces,
                    canvas: spacesFrtTranslations.ru.canvas,
                    finance: financeTranslations.ru.finance,
                    analytics: analyticsTranslations.ru.analytics,
                    profile: profileTranslations.ru.profile,
                    resources: resourcesTranslations.ru.resources,
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
                'chatflows',
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

export default i18n
