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

import rolesEn from './locales/en/core/roles.json'
import rolesRu from './locales/ru/core/roles.json'

import accessEn from './locales/en/core/access.json'
import accessRu from './locales/ru/core/access.json'

import settingsEn from './locales/en/core/settings.json'
import settingsRu from './locales/ru/core/settings.json'
import metaEn from './locales/en/core/meta.json'
import metaRu from './locales/ru/core/meta.json'

// Import views
import adminEn from './locales/en/views/admin.json'
import adminRu from './locales/ru/views/admin.json'

// apiKeys translations removed - now in @flowise/apikey-frontend
// assistants translations removed - now in @flowise/assistants-frontend

import authEn from './locales/en/views/auth.json'
import authRu from './locales/ru/views/auth.json'

import canvasEn from './locales/en/views/canvas.json'
import canvasRu from './locales/ru/views/canvas.json'

import canvasesEn from './locales/en/views/canvases.json'
import canvasesRu from './locales/ru/views/canvases.json'

// chatmessage translations removed - now in @flowise/chatmessage-frontend
// document-store translations removed - now in @flowise/docstore-frontend

import flowListEn from './locales/en/views/flowList.json'
import flowListRu from './locales/ru/views/flowList.json'

import menuEn from './locales/en/views/menu.json'
import menuRu from './locales/ru/views/menu.json'

import profileMenuEn from './locales/en/views/profile-menu.json'
import profileMenuRu from './locales/ru/views/profile-menu.json'

import chatbotEn from './locales/en/views/chatbot.json'
import chatbotRu from './locales/ru/views/chatbot.json'

import templatesEn from './locales/en/views/templates.json'
import templatesRu from './locales/ru/views/templates.json'

// vector-store translations removed - now in @flowise/docstore-frontend

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

// Docstore/vector-store translations are provided by @flowise/docstore-frontend

declare global {
    // eslint-disable-next-line no-var
    var __universo_i18n__instance: typeof i18n | undefined
}

export function getInstance(): typeof i18n {
    if (!globalThis.__universo_i18n__instance) {
        // Use the default i18next singleton instead of creating a separate instance.
        // This ensures react-i18next hooks (useTranslation) are bound without needing a Provider.
        const instance = i18n

        instance
            .use(LanguageDetector)
            .use(initReactI18next)
            .init({
                resources: {
                    en: {
                        // Core
                        common: commonEn.common,
                        header: headerEn.header,
                        spaces: spacesEn.spaces,
                        roles: rolesEn.roles,
                        access: accessEn.access,
                        settings: settingsEn.settings,
                        meta: metaEn.meta,
                        // Views
                        admin: adminEn.admin,
                        // apiKeys: now in @flowise/apikey-frontend
                        // assistants: now in @flowise/assistants-frontend
                        auth: authEn.auth,
                        canvas: canvasEn.canvas,
                        canvases: canvasesEn.canvases,
                        // chatmessage: now in @flowise/chatmessage-frontend
                        chatbot: chatbotEn.chatbot,
                        // 'document-store': now in @flowise/docstore-frontend
                        flowList: flowListEn.flowList,
                        menu: menuEn.menu,
                        'profile-menu': profileMenuEn.profileMenu,
                        templates: templatesEn.templates,
                        // 'vector-store': now in @flowise/docstore-frontend
                        // Dialogs
                        about: aboutEn.about,
                        allowedDomains: allowedDomainsEn.allowedDomains,
                        chatFeedback: chatFeedbackEn.chatFeedback,
                        confirm: confirmEn.confirm,
                        condition: conditionEn.condition,
                        expandText: expandTextEn.expandText,
                        exportTemplate: exportTemplateEn.exportTemplate,
                        formatPrompt: formatPromptEn.formatPrompt,
                        login: loginEn.login,
                        manageLinks: manageLinksEn.manageLinks,
                        nodeInfo: nodeInfoEn.nodeInfo,
                        nvidiaNIM: nvidiaNIMEn.nvidiaNIM,
                        promptLangsmithHub: promptLangsmithHubEn.promptLangsmithHub,
                        saveChatflow: saveChatflowEn.saveChatflow,
                        sourceDoc: sourceDocEn.sourceDoc,
                        speechToTextDialog: speechToTextDialogEn.speechToText,
                        starterPrompts: starterPromptsEn.starterPrompts,
                        tag: tagEn.tag,
                        viewLeads: viewLeadsEn.viewLeads,
                        viewMessages: viewMessagesEn.viewMessages,
                        saveCanvas: saveCanvasEn.saveCanvas,
                        // Features
                        promptGenerator: promptGeneratorEn.promptGenerator,
                        speechToText: speechToTextEn.speechToText
                    },
                    ru: {
                        // Core
                        common: commonRu.common,
                        header: headerRu.header,
                        spaces: spacesRu.spaces,
                        roles: rolesRu.roles,
                        access: accessRu.access,
                        settings: settingsRu.settings,
                        meta: metaRu.meta,
                        // Views
                        admin: adminRu.admin,
                        // apiKeys: now in @flowise/apikey-frontend
                        // assistants: now in @flowise/assistants-frontend
                        auth: authRu.auth,
                        canvas: canvasRu.canvas,
                        canvases: canvasesRu.canvases,
                        // chatmessage: now in @flowise/chatmessage-frontend
                        chatbot: chatbotRu.chatbot,
                        // 'document-store': now in @flowise/docstore-frontend
                        flowList: flowListRu.flowList,
                        menu: menuRu.menu,
                        'profile-menu': profileMenuRu.profileMenu,
                        templates: templatesRu.templates,
                        // 'vector-store': now in @flowise/docstore-frontend
                        // Dialogs
                        about: aboutRu.about,
                        allowedDomains: allowedDomainsRu.allowedDomains,
                        chatFeedback: chatFeedbackRu.chatFeedback,
                        confirm: confirmRu.confirm,
                        condition: conditionRu.condition,
                        expandText: expandTextRu.expandText,
                        exportTemplate: exportTemplateRu.exportTemplate,
                        formatPrompt: formatPromptRu.formatPrompt,
                        login: loginRu.login,
                        manageLinks: manageLinksRu.manageLinks,
                        nodeInfo: nodeInfoRu.nodeInfo,
                        nvidiaNIM: nvidiaNIMRu.nvidiaNIM,
                        promptLangsmithHub: promptLangsmithHubRu.promptLangsmithHub,
                        saveChatflow: saveChatflowRu.saveChatflow,
                        sourceDoc: sourceDocRu.sourceDoc,
                        speechToTextDialog: speechToTextDialogRu.speechToText,
                        starterPrompts: starterPromptsRu.starterPrompts,
                        tag: tagRu.tag,
                        viewLeads: viewLeadsRu.viewLeads,
                        viewMessages: viewMessagesRu.viewMessages,
                        saveCanvas: saveCanvasRu.saveCanvas,
                        // Features
                        promptGenerator: promptGeneratorRu.promptGenerator,
                        speechToText: speechToTextRu.speechToText
                    }
                },
                fallbackLng: 'en',
                defaultNS: 'common',
                fallbackNS: ['common', 'header', 'spaces'],
                load: 'languageOnly', // Use only 'ru' instead of 'ru-RU'
                debug: false,
                interpolation: {
                    escapeValue: false
                }
            })

        // CRITICAL: Force language to use only the base code (ru instead of ru-RU)
        // This is necessary because i18n.language stays as 'ru-RU' even with load: 'languageOnly'
        const detectedLang = instance.language
        const baseLang = detectedLang.split('-')[0] // 'ru-RU' -> 'ru'
        if (detectedLang !== baseLang) {
            instance.changeLanguage(baseLang)
        }

        // Debug: log language detection
        console.log('[i18n-instance] Initialized:', {
            detectedLanguage: detectedLang,
            baseLang: baseLang,
            currentLanguage: instance.language,
            resolvedLanguage: instance.resolvedLanguage,
            languages: instance.languages,
            hasEnCommon: instance.hasResourceBundle('en', 'common'),
            hasRuCommon: instance.hasResourceBundle('ru', 'common')
        })

        globalThis.__universo_i18n__instance = instance
    }

    return globalThis.__universo_i18n__instance
}
