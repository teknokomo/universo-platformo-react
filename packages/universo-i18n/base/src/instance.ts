import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import core translations
import commonEn from './locales/en/core/common.json'
import commonRu from './locales/ru/core/common.json'

import headerEn from './locales/en/core/header.json'
import headerRu from './locales/ru/core/header.json'

import spacesEn from './locales/en/core/spaces.json'
import spacesRu from './locales/ru/core/spaces.json'

import canvasesEn from './locales/en/core/canvases.json'
import canvasesRu from './locales/ru/core/canvases.json'

// Import views
import adminEn from './locales/en/views/admin.json'
import adminRu from './locales/ru/views/admin.json'

import apiKeysEn from './locales/en/views/api-keys.json'
import apiKeysRu from './locales/ru/views/api-keys.json'

import assistantsEn from './locales/en/views/assistants.json'
import assistantsRu from './locales/ru/views/assistants.json'

import authEn from './locales/en/views/auth.json'
import authRu from './locales/ru/views/auth.json'

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

// Import dialogs
import aboutEn from './locales/en/dialogs/about.json'
import aboutRu from './locales/ru/dialogs/about.json'

import allowedDomainsEn from './locales/en/dialogs/allowed-domains.json'
import allowedDomainsRu from './locales/ru/dialogs/allowed-domains.json'

import chatFeedbackEn from './locales/en/dialogs/chat-feedback.json'
import chatFeedbackRu from './locales/ru/dialogs/chat-feedback.json'

import confirmEn from './locales/en/dialogs/confirm.json'
import confirmRu from './locales/ru/dialogs/confirm.json'

import conditionEn from './locales/en/dialogs/condition.json'
import conditionRu from './locales/ru/dialogs/condition.json'

import expandTextEn from './locales/en/dialogs/expand-text.json'
import expandTextRu from './locales/ru/dialogs/expand-text.json'

import exportTemplateEn from './locales/en/dialogs/export-template.json'
import exportTemplateRu from './locales/ru/dialogs/export-template.json'

import formatPromptEn from './locales/en/dialogs/format-prompt.json'
import formatPromptRu from './locales/ru/dialogs/format-prompt.json'

import loginEn from './locales/en/dialogs/login.json'
import loginRu from './locales/ru/dialogs/login.json'

import manageLinksEn from './locales/en/dialogs/manage-links.json'
import manageLinksRu from './locales/ru/dialogs/manage-links.json'

import nodeInfoEn from './locales/en/dialogs/node-info.json'
import nodeInfoRu from './locales/ru/dialogs/node-info.json'

import nvidiaNIMEn from './locales/en/dialogs/nvidia-nim.json'
import nvidiaNIMRu from './locales/ru/dialogs/nvidia-nim.json'

import promptLangsmithHubEn from './locales/en/dialogs/prompt-langsmith-hub.json'
import promptLangsmithHubRu from './locales/ru/dialogs/prompt-langsmith-hub.json'

import saveChatflowEn from './locales/en/dialogs/save-chatflow.json'
import saveChatflowRu from './locales/ru/dialogs/save-chatflow.json'

import sourceDocEn from './locales/en/dialogs/source-doc.json'
import sourceDocRu from './locales/ru/dialogs/source-doc.json'

import speechToTextDialogEn from './locales/en/dialogs/speech-to-text.json'
import speechToTextDialogRu from './locales/ru/dialogs/speech-to-text.json'

import starterPromptsEn from './locales/en/dialogs/starter-prompts.json'
import starterPromptsRu from './locales/ru/dialogs/starter-prompts.json'

import tagEn from './locales/en/dialogs/tag.json'
import tagRu from './locales/ru/dialogs/tag.json'

import viewLeadsEn from './locales/en/dialogs/view-leads.json'
import viewLeadsRu from './locales/ru/dialogs/view-leads.json'

import viewMessagesEn from './locales/en/dialogs/view-messages.json'
import viewMessagesRu from './locales/ru/dialogs/view-messages.json'

import saveCanvasEn from './locales/en/dialogs/save-canvas.json'
import saveCanvasRu from './locales/ru/dialogs/save-canvas.json'

// Import features
import promptGeneratorEn from './locales/en/features/prompt-generator.json'
import promptGeneratorRu from './locales/ru/features/prompt-generator.json'

import speechToTextEn from './locales/en/features/speech-to-text.json'
import speechToTextRu from './locales/ru/features/speech-to-text.json'

import docstoreEn from './locales/en/features/docstore.json'
import docstoreRu from './locales/ru/features/docstore.json'

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
                        // Core
                        translation: {
                            ...commonEn,
                            ...headerEn,
                            ...spacesEn,
                            ...canvasesEn
                        },
                        // Views
                        admin: adminEn,
                        'api-keys': apiKeysEn,
                        assistants: assistantsEn,
                        auth: authEn,
                        canvas: canvasEn,
                        chatmessage: chatmessageEn,
                        credentials: credentialsEn,
                        'document-store': documentStoreEn,
                        flowList: flowListEn,
                        menu: menuEn,
                        templates: templatesEn,
                        tools: toolsEn,
                        variables: variablesEn,
                        'vector-store': vectorStoreEn,
                        // Dialogs
                        about: aboutEn,
                        allowedDomains: allowedDomainsEn,
                        chatFeedback: chatFeedbackEn,
                        confirm: confirmEn,
                        condition: conditionEn,
                        expandText: expandTextEn,
                        exportTemplate: exportTemplateEn,
                        formatPrompt: formatPromptEn,
                        login: loginEn,
                        manageLinks: manageLinksEn,
                        nodeInfo: nodeInfoEn,
                        nvidiaNIM: nvidiaNIMEn,
                        promptLangsmithHub: promptLangsmithHubEn,
                        saveChatflow: saveChatflowEn,
                        sourceDoc: sourceDocEn,
                        speechToTextDialog: speechToTextDialogEn,
                        starterPrompts: starterPromptsEn,
                        tag: tagEn,
                        viewLeads: viewLeadsEn,
                        viewMessages: viewMessagesEn,
                        saveCanvas: saveCanvasEn,
                        // Features
                        promptGenerator: promptGeneratorEn,
                        speechToText: speechToTextEn,
                        docstore: docstoreEn
                    },
                    ru: {
                        // Core
                        translation: {
                            ...commonRu,
                            ...headerRu,
                            ...spacesRu,
                            ...canvasesRu
                        },
                        // Views
                        admin: adminRu,
                        'api-keys': apiKeysRu,
                        assistants: assistantsRu,
                        auth: authRu,
                        canvas: canvasRu,
                        chatmessage: chatmessageRu,
                        credentials: credentialsRu,
                        'document-store': documentStoreRu,
                        flowList: flowListRu,
                        menu: menuRu,
                        templates: templatesRu,
                        tools: toolsRu,
                        variables: variablesRu,
                        'vector-store': vectorStoreRu,
                        // Dialogs
                        about: aboutRu,
                        allowedDomains: allowedDomainsRu,
                        chatFeedback: chatFeedbackRu,
                        confirm: confirmRu,
                        condition: conditionRu,
                        expandText: expandTextRu,
                        exportTemplate: exportTemplateRu,
                        formatPrompt: formatPromptRu,
                        login: loginRu,
                        manageLinks: manageLinksRu,
                        nodeInfo: nodeInfoRu,
                        nvidiaNIM: nvidiaNIMRu,
                        promptLangsmithHub: promptLangsmithHubRu,
                        saveChatflow: saveChatflowRu,
                        sourceDoc: sourceDocRu,
                        speechToTextDialog: speechToTextDialogRu,
                        starterPrompts: starterPromptsRu,
                        tag: tagRu,
                        viewLeads: viewLeadsRu,
                        viewMessages: viewMessagesRu,
                        saveCanvas: saveCanvasRu,
                        // Features
                        promptGenerator: promptGeneratorRu,
                        speechToText: speechToTextRu,
                        docstore: docstoreRu
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
