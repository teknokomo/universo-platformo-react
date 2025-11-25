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
import { Unik, UnikUser } from '@universo/uniks-srv'
import { AuthUser } from '@universo/auth-srv'
import { Profile } from '@universo/profile-srv'
import { metaversesEntities } from '@universo/metaverses-srv'
import { clustersEntities } from '@universo/clusters-srv'
import { projectsEntities } from '@universo/projects-srv'
import { campaignsEntities } from '@universo/campaigns-srv'
import { organizationsEntities } from '@universo/organizations-srv'
import { storagesEntities } from '@universo/storages-srv'
import { Space, Canvas, SpaceCanvas } from '@universo/spaces-srv'
import { PublishCanvas } from '@universo/publish-srv'

// TypeORM entities here are constructor functions/classes; we only need their names and references
const metaversesEntitiesObject = Object.fromEntries(metaversesEntities.map((entity) => [entity.name, entity]))

const clustersEntitiesObject = Object.fromEntries(clustersEntities.map((entity) => [entity.name, entity]))

const projectsEntitiesObject = Object.fromEntries(projectsEntities.map((entity) => [entity.name, entity]))

const campaignsEntitiesObject = Object.fromEntries(campaignsEntities.map((entity) => [entity.name, entity]))

const organizationsEntitiesObject = Object.fromEntries(organizationsEntities.map((entity) => [entity.name, entity]))

const storagesEntitiesObject = Object.fromEntries(storagesEntities.map((entity) => [entity.name, entity]))

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
    PublishCanvas
}
