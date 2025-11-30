import { Init1693891895163 } from './1693891895163-Init'
import { ModifyChatFlow1693995626941 } from './1693995626941-ModifyChatFlow'
// ModifyChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
// ModifyCredential removed - consolidated into @universo/flowise-credentials-srv
// ModifyTool removed - consolidated into @universo/flowise-tools-srv
import { AddApiConfig1694099183389 } from './1694099183389-AddApiConfig'
import { AddAnalytic1694432361423 } from './1694432361423-AddAnalytic'
// AddChatHistory removed - consolidated into @universo/flowise-chatmessage-srv
// AddAssistantEntity removed - consolidated into @universo/flowise-assistants-srv
// AddUsedToolsToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
import { AddCategoryToChatFlow1699900910291 } from './1699900910291-AddCategoryToChatFlow'
// AddFileAnnotationsToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
// AddFileUploadsToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
// AddVariableEntity removed - consolidated into @universo/flowise-variables-srv
import { AddSpeechToText1706364937060 } from './1706364937060-AddSpeechToText'
// AddFeedback removed - consolidated into @universo/flowise-chatmessage-srv
import { AddUpsertHistoryEntity1709814301358 } from './1709814301358-AddUpsertHistoryEntity'
// FieldTypes removed - consolidated into @universo/flowise-assistants-srv
// AddLead removed - consolidated into @universo/flowise-leads-srv
// AddLeadToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
import { AddVectorStoreConfigToDocStore1715861032479 } from './1715861032479-AddVectorStoreConfigToDocStore'
import { leadsMigrations } from '@universo/flowise-leads-srv'
import { chatMessageMigrations } from '@universo/flowise-chatmessage-srv'
import { AddDocumentStore1711637331047 } from './1711637331047-AddDocumentStore'
// AddAgentReasoningToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
import { AddTypeToChatFlow1716300000000 } from './1716300000000-AddTypeToChatFlow'
// AddApiKey removed - consolidated into @universo/flowise-apikey-srv
// AddActionToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
import { AddCustomTemplate1725629836652 } from './1725629836652-AddCustomTemplate'
// AddArtifactsToChatMessage removed - consolidated into @universo/flowise-chatmessage-srv
// AddFollowUpPrompts removed - consolidated into @universo/flowise-chatmessage-srv
// AddTypeToAssistant removed - consolidated into @universo/flowise-assistants-srv
import { uniksMigrations } from '@universo/uniks-srv'
import { toolsMigrations } from '@universo/flowise-tools-srv'
import { credentialsMigrations } from '@universo/flowise-credentials-srv'
import { variablesMigrations } from '@universo/flowise-variables-srv'
import { apikeyMigrations } from '@universo/flowise-apikey-srv'
import { assistantsMigrations } from '@universo/flowise-assistants-srv'
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
    AddUpsertHistoryEntity1709814301358,
    AddDocumentStore1711637331047,
    ...leadsMigrations, // Creates lead table
    AddTypeToChatFlow1716300000000,
    AddVectorStoreConfigToDocStore1715861032479,
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
