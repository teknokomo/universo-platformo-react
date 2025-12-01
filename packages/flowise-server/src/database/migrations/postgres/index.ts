import { Init1693891895163 } from './1693891895163-Init'
import { ModifyChatFlow1693995626941 } from './1693995626941-ModifyChatFlow'
// ModifyChatMessage removed - consolidated into @flowise/chatmessage-srv
// ModifyCredential removed - consolidated into @flowise/credentials-srv
// ModifyTool removed - consolidated into @flowise/tools-srv
import { AddApiConfig1694099183389 } from './1694099183389-AddApiConfig'
import { AddAnalytic1694432361423 } from './1694432361423-AddAnalytic'
// AddChatHistory removed - consolidated into @flowise/chatmessage-srv
// AddAssistantEntity removed - consolidated into @flowise/assistants-srv
// AddUsedToolsToChatMessage removed - consolidated into @flowise/chatmessage-srv
import { AddCategoryToChatFlow1699900910291 } from './1699900910291-AddCategoryToChatFlow'
// AddFileAnnotationsToChatMessage removed - consolidated into @flowise/chatmessage-srv
// AddFileUploadsToChatMessage removed - consolidated into @flowise/chatmessage-srv
// AddVariableEntity removed - consolidated into @flowise/variables-srv
import { AddSpeechToText1706364937060 } from './1706364937060-AddSpeechToText'
// AddFeedback removed - consolidated into @flowise/chatmessage-srv
// AddUpsertHistoryEntity removed - consolidated into @flowise/docstore-srv
// FieldTypes removed - consolidated into @flowise/assistants-srv
// AddLead removed - consolidated into @flowise/leads-srv
// AddLeadToChatMessage removed - consolidated into @flowise/chatmessage-srv
// AddVectorStoreConfigToDocStore removed - consolidated into @flowise/docstore-srv
import { leadsMigrations } from '@flowise/leads-srv'
import { chatMessageMigrations } from '@flowise/chatmessage-srv'
// AddDocumentStore removed - consolidated into @flowise/docstore-srv
import { docstoreMigrations } from '@flowise/docstore-srv'
// AddAgentReasoningToChatMessage removed - consolidated into @flowise/chatmessage-srv
import { AddTypeToChatFlow1716300000000 } from './1716300000000-AddTypeToChatFlow'
// AddApiKey removed - consolidated into @flowise/apikey-srv
// AddActionToChatMessage removed - consolidated into @flowise/chatmessage-srv
import { AddCustomTemplate1725629836652 } from './1725629836652-AddCustomTemplate'
// AddArtifactsToChatMessage removed - consolidated into @flowise/chatmessage-srv
// AddFollowUpPrompts removed - consolidated into @flowise/chatmessage-srv
// AddTypeToAssistant removed - consolidated into @flowise/assistants-srv
import { uniksMigrations } from '@universo/uniks-srv'
import { toolsMigrations } from '@flowise/tools-srv'
import { credentialsMigrations } from '@flowise/credentials-srv'
import { variablesMigrations } from '@flowise/variables-srv'
import { apikeyMigrations } from '@flowise/apikey-srv'
import { assistantsMigrations } from '@flowise/assistants-srv'
import { profileMigrations } from '@universo/profile-srv'
import { metaversesMigrations } from '@universo/metaverses-srv'
import { clustersMigrations } from '@universo/clusters-srv'
import { projectsMigrations } from '@universo/projects-srv'
import { campaignsMigrations } from '@universo/campaigns-srv'
import { organizationsMigrations } from '@universo/organizations-srv'
import { storagesMigrations } from '@universo/storages-srv'
import { spacesMigrations } from '@universo/spaces-srv'
import { publishMigrations } from '@universo/publish-srv'

export const postgresMigrations = [
    Init1693891895163,
    ...chatMessageMigrations, // Creates chat_message and chat_message_feedback tables - must come right after Init
    ...toolsMigrations, // Creates tool table
    ...credentialsMigrations, // Creates credential table
    ModifyChatFlow1693995626941,
    AddApiConfig1694099183389,
    AddAnalytic1694432361423,
    ...assistantsMigrations, // Creates assistant table with type column
    AddCategoryToChatFlow1699900910291,
    ...variablesMigrations, // Creates variable table
    AddSpeechToText1706364937060,
    ...docstoreMigrations, // Creates document_store, document_store_file_chunk, upsert_history tables
    ...leadsMigrations, // Creates lead table
    AddTypeToChatFlow1716300000000,
    ...apikeyMigrations, // Creates apikey table
    AddCustomTemplate1725629836652,
    ...uniksMigrations, // Adds unik_id to tool and other Flowise tables
    ...profileMigrations,
    ...metaversesMigrations,
    ...clustersMigrations,
    ...projectsMigrations,
    ...campaignsMigrations,
    ...organizationsMigrations,
    ...storagesMigrations,
    ...spacesMigrations,
    ...publishMigrations
]
