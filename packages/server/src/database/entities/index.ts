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
import { Unik, UserUnik } from '@universo/uniks-srv'
import { Profile } from '@universo/profile-srv'
import { Metaverse, UserMetaverse, MetaverseLink } from '@universo/metaverse-srv'

const financeEntitiesObject = Object.fromEntries(
  financeEntities.map((entity) => [entity.name, entity])
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
  // Finance entities
  ...financeEntitiesObject,
  // Uniks entities
  Unik,
  UserUnik,
  // Profile entities
  Profile,
  // Metaverse entities
  Metaverse,
  UserMetaverse,
  MetaverseLink
}
