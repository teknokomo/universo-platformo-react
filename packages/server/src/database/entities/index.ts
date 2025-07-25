import { ChatFlow } from './ChatFlow'
import { ChatMessage } from './ChatMessage'
import { ChatMessageFeedback } from './ChatMessageFeedback'
import { Credential } from './Credential'
import { Tool } from './Tool'
import { Assistant } from './Assistant'
import { Variable } from './Variable'
import { DocumentStore } from './DocumentStore'
import { DocumentStoreFileChunk } from './DocumentStoreFileChunk'
import { Lead } from './Lead'
import { UpsertHistory } from './UpsertHistory'
import { ApiKey } from './ApiKey'
import { CustomTemplate } from './CustomTemplate'

// New entities
import { Unik } from './Unik'
import { User } from './User'
import { UserUnik } from './UserUnik'

// Profile entities
import { Profile } from '@universo/profile-srv'

export const entities = {
    ChatFlow,
    ChatMessage,
    ChatMessageFeedback,
    Credential,
    Tool,
    Assistant,
    Variable,
    DocumentStore,
    DocumentStoreFileChunk,
    Lead,
    UpsertHistory,
    ApiKey,
    CustomTemplate,
    // New entities
    Unik,
    User,
    UserUnik,
    // Profile entities
    Profile
}
