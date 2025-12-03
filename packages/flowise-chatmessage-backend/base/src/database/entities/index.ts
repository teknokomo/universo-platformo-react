/**
 * Database entities exports
 */
import { ChatMessage } from './ChatMessage'
import { ChatMessageFeedback } from './ChatMessageFeedback'

export { ChatMessage }
export { ChatMessageFeedback }

/**
 * Array of all ChatMessage entities for TypeORM registration
 */
export const chatMessageEntities = [ChatMessage, ChatMessageFeedback]
