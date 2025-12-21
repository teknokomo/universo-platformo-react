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
import { clustersEntities } from '@universo/clusters-backend'
import { projectsEntities } from '@universo/projects-backend'
import { campaignsEntities } from '@universo/campaigns-backend'
import { organizationsEntities } from '@universo/organizations-backend'
import { storagesEntities } from '@universo/storages-backend'
import { Space, Canvas, SpaceCanvas } from '@universo/spaces-backend'
import { PublishCanvas } from '@universo/publish-backend'
import { adminEntities } from '@universo/admin-backend'
import { metahubsEntities } from '@universo/metahubs-backend'

// TypeORM entities here are constructor functions/classes; we only need their names and references
const metaversesEntitiesObject = Object.fromEntries(metaversesEntities.map((entity) => [entity.name, entity]))

const clustersEntitiesObject = Object.fromEntries(clustersEntities.map((entity) => [entity.name, entity]))

const projectsEntitiesObject = Object.fromEntries(projectsEntities.map((entity) => [entity.name, entity]))

const campaignsEntitiesObject = Object.fromEntries(campaignsEntities.map((entity) => [entity.name, entity]))

const organizationsEntitiesObject = Object.fromEntries(organizationsEntities.map((entity) => [entity.name, entity]))

const storagesEntitiesObject = Object.fromEntries(storagesEntities.map((entity) => [entity.name, entity]))

const adminEntitiesObject = Object.fromEntries(adminEntities.map((entity) => [entity.name, entity]))

const metahubsEntitiesObject = Object.fromEntries(metahubsEntities.map((entity) => [entity.name, entity]))

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
    // Clusters service entities
    ...clustersEntitiesObject,
    // Projects service entities
    ...projectsEntitiesObject,
    // Campaigns service entities
    ...campaignsEntitiesObject,
    // Organizations service entities
    ...organizationsEntitiesObject,
    // Storages service entities
    ...storagesEntitiesObject,
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
    ...adminEntitiesObject,
    // MetaHubs MDA entities
    ...metahubsEntitiesObject
}
