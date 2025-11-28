import 'i18next'

// Import all JSON files to infer types from actual translation structure
// Core namespaces
import type common from './locales/en/core/common.json'
import type header from './locales/en/core/header.json'
import type spaces from './locales/en/core/spaces.json'
import type roles from './locales/en/core/roles.json'
import type access from './locales/en/core/access.json'

// View namespaces
import type admin from './locales/en/views/admin.json'
import type apiKeys from './locales/en/views/api-keys.json'
import type assistants from './locales/en/views/assistants.json'
import type auth from './locales/en/views/auth.json'
import type canvas from './locales/en/views/canvas.json'
import type canvases from './locales/en/views/canvases.json'
import type chatbot from './locales/en/views/chatbot.json'
import type chatmessage from './locales/en/views/chatmessage.json'
import type documentStore from './locales/en/views/document-store.json'
import type flowList from './locales/en/views/flowList.json'
import type menu from './locales/en/views/menu.json'
import type profileMenu from './locales/en/views/profile-menu.json'
import type templates from './locales/en/views/templates.json'
import type tools from './locales/en/views/tools.json'
import type variables from './locales/en/views/variables.json'
import type vectorStore from './locales/en/views/vector-store.json'

/**
 * Type augmentation for i18next to enable autocomplete and type-checking
 * for all translation keys across the application.
 *
 * This provides:
 * - Autocomplete for all translation keys in IDE
 * - Compile-time errors for non-existent keys
 * - Type-safe translation function calls
 */
declare module 'i18next' {
    interface CustomTypeOptions {
        // Specify default namespace for unprefixed keys
        defaultNS: 'common'

        // Define all available translation resources with proper types
        resources: {
            // Core namespaces (unwrapped from JSON structure)
            common: typeof common.common
            header: typeof header.header
            spaces: typeof spaces.spaces
            roles: typeof roles.roles
            access: typeof access.access

            // View namespaces
            // Flat files (no wrapper key in JSON)
            admin: typeof admin
            canvas: typeof canvas
            canvases: typeof canvases

            // Wrapped files (have wrapper key matching namespace)
            'api-keys': typeof apiKeys.apiKeys
            assistants: typeof assistants.assistants
            auth: typeof auth.auth
            chatbot: typeof chatbot.chatbot
            chatmessage: typeof chatmessage.chatmessage
            'document-store': typeof documentStore.documentStore
            flowList: typeof flowList.flowList
            menu: typeof menu.menu
            'profile-menu': typeof profileMenu.profileMenu
            templates: typeof templates.templates
            tools: typeof tools.tools
            variables: typeof variables.variables
            'vector-store': typeof vectorStore.vectorStore
        }

        // Return type configuration
        // Set to false to get actual translated string instead of string | null
        returnNull: false
    }
}
