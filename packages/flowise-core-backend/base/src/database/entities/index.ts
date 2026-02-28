import { ChatMessage, ChatMessageFeedback } from '@flowise/chatmessage-backend'
import { Credential } from '@flowise/credentials-backend'
import { Tool } from '@flowise/tools-backend'
import { Variable } from '@flowise/variables-backend'
import { ApiKey } from '@flowise/apikey-backend'
import { Assistant } from '@flowise/assistants-backend'
import { Lead } from '@flowise/leads-backend'
import { Execution } from '@flowise/executions-backend'
import { DocumentStore, DocumentStoreFileChunk, UpsertHistory } from '@flowise/docstore-backend'
import { CustomTemplate } from '@flowise/customtemplates-backend'
import { Unik, UnikUser } from '@universo/uniks-backend'
import { AuthUser } from '@universo/auth-backend'
import { Profile } from '@universo/profile-backend'
import { metaversesEntities } from '@universo/metaverses-backend'
import { metahubsEntities } from '@universo/metahubs-backend'
import { applicationsEntities } from '@universo/applications-backend'
import { Space, Canvas, SpaceCanvas } from '@universo/spaces-backend'
import { PublishCanvas } from '@universo/publish-backend'
import { adminEntities } from '@universo/admin-backend'

// TypeORM entities here are constructor functions/classes; we only need their names and references
const metaversesEntitiesObject = Object.fromEntries(metaversesEntities.map((entity) => [entity.name, entity]))

const metahubsEntitiesObject = Object.fromEntries(metahubsEntities.map((entity) => [entity.name, entity]))

const applicationsEntitiesObject = Object.fromEntries(applicationsEntities.map((entity) => [entity.name, entity]))

const adminEntitiesObject = Object.fromEntries(adminEntities.map((entity) => [entity.name, entity]))

export const entities = {
    ChatMessage,
    ChatMessageFeedback,
    Credential,
    Tool,
    Assistant,
    Variable,
    DocumentStore,
    DocumentStoreFileChunk,
    Lead,
    Execution,
    UpsertHistory,
    ApiKey,
    CustomTemplate,
    // Metaverses service entities
    ...metaversesEntitiesObject,
    // Metahubs service entities
    ...metahubsEntitiesObject,
    // Applications service entities
    ...applicationsEntitiesObject,
    // Uniks entities
    Unik,
    UnikUser,
    AuthUser,
    // Profile entities
    Profile,
    // Spaces entities
    Space,
    Canvas,
    SpaceCanvas,
    PublishCanvas,
    // Admin RBAC entities
    ...adminEntitiesObject
}
