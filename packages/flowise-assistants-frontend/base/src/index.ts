// Universo Platformo | Assistants Frontend Package
// Main entry point

// Export custom assistant components
export { default as AddCustomAssistantDialog } from './pages/custom/AddCustomAssistantDialog'
export { default as CustomAssistantConfigurePreview } from './pages/custom/CustomAssistantConfigurePreview'
export { default as CustomAssistantLayout } from './pages/custom/CustomAssistantLayout'
export { toolAgentFlow } from './pages/custom/toolAgentFlow'

// Export OpenAI assistant components
export { default as AssistantDialog } from './pages/openai/AssistantDialog'
export { default as AssistantVectorStoreDialog } from './pages/openai/AssistantVectorStoreDialog'
export { default as DeleteConfirmDialog } from './pages/openai/DeleteConfirmDialog'
export { default as LoadAssistantDialog } from './pages/openai/LoadAssistantDialog'
export { default as OpenAIAssistantLayout } from './pages/openai/OpenAIAssistantLayout'

// Export main index
export { default as Assistants } from './pages/index'

// Export i18n resources
export {
    assistantsNamespace,
    assistantsResources,
    getAssistantsTranslations,
    enAssistantsTranslation,
    ruAssistantsTranslation
} from './i18n'
