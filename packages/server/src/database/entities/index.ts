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
import { financeEntities } from '@universo/finance-srv'
import { Unik, UnikUser } from '@universo/uniks-srv'
import { Profile } from '@universo/profile-srv'
import { metaversesEntities } from '@universo/metaverses-srv'
import { resourcesEntities } from '@universo/resources-srv'
import { Space, Canvas, SpaceCanvas } from '@universo/spaces-srv'

// TypeORM entities here are constructor functions/classes; we only need their names and references
const financeEntitiesObject = Object.fromEntries(
  financeEntities.map((entity: any) => [entity.name, entity])
)
const metaversesEntitiesObject = Object.fromEntries(
  metaversesEntities.map((entity) => [entity.name, entity])
)
const resourcesEntitiesObject = Object.fromEntries(
  resourcesEntities.map((entity) => [entity.name, entity])
)

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
  // Metaverses service entities
  ...metaversesEntitiesObject,
  // Finance entities
  ...financeEntitiesObject,
  // Resources entities
  ...resourcesEntitiesObject,
  // Uniks entities
  Unik,
  UnikUser,
  // Profile entities
  Profile,
  // Spaces entities
  Space,
  Canvas,
  SpaceCanvas
}
