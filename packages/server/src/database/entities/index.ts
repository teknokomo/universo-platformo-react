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
import { Unik, UserUnik } from '@universo/uniks-srv'

// Profile entities
import { Profile } from '@universo/profile-srv'

// Metaverse entities
import { Metaverse, UserMetaverse, MetaverseLink } from '@universo/metaverse-srv'

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
    UserUnik,
    // Profile entities
    Profile,
    // Metaverse entities
    Metaverse,
    UserMetaverse,
    MetaverseLink
}
