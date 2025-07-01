<!-- markdownlint-disable MD030 -->

# Flowise Components

Apps integration for Flowise. Contain Nodes and Credentials.

![Flowise](https://github.com/FlowiseAI/Flowise/blob/main/images/flowise.gif?raw=true)

Install:

```bash
npm i flowise-components
```

## TypeScript Compatibility Updates

The following files have been enhanced for compatibility with newer TypeScript and library versions:

### Core Utilities & Interfaces

-   `src/Interface.ts` - Added 8 new type-safe interfaces (IAssistantDetails, IToolData, ICredentialData, ISessionData, IUploadResponse, IDocumentStoreData, IMessageContent, IParsedJSON)
-   `src/utils.ts` - Added 6 new type-safe utilities (safeJSONParse, bufferToUint8Array, safeCast, hasProperty, safeGet)
-   `src/storageUtils.ts` - Fixed Buffer→Uint8Array compatibility issues
-   `src/handler.ts` - Enhanced with safe property access patterns

### Node Implementations

-   `nodes/agents/AutoGPT/AutoGPT.ts` - Fixed LangChain ObjectTool type compatibility
-   `nodes/tools/ChatflowTool/ChatflowTool.ts` - Enhanced with safe chatflow property access
-   `nodes/tools/CustomTool/CustomTool.ts` - Added safe type casting and error handling
-   `nodes/sequentialagents/ExecuteFlow/ExecuteFlow.ts` - Fixed unknown types in flow execution

### OpenAI & Assistant Integration

-   `nodes/agents/OpenAIAssistant/OpenAIAssistant.ts` - Fixed getBaseClasses import and JSON parsing
-   `nodes/chains/ConversationalRetrievalQAChain/ConversationalRetrievalQAChain.ts` - Added safe message content access

### Document Loaders

-   `nodes/documentloaders/DocumentStore/DocStoreLoader.ts` - Enhanced with safe JSON parsing for metadata
-   `nodes/documentloaders/Epub/Epub.ts` - Fixed Buffer→Uint8Array conversion
-   `nodes/documentloaders/S3File/S3File.ts` - Fixed Buffer compatibility in file handling
-   `nodes/documentloaders/S3Directory/S3Directory.ts` - Enhanced Buffer handling for S3 operations

### Memory Systems

-   `nodes/memory/BufferMemory/BufferMemory.ts` - Added safe property access for chat messages
-   `nodes/memory/BufferWindowMemory/BufferWindowMemory.ts` - Enhanced with safe message handling
-   `nodes/memory/DynamoDb/DynamoDb.ts` - Fixed StoredMessage type compatibility and safe property access
-   `nodes/memory/MongoDBMemory/MongoDBMemory.ts` - Enhanced with safe document property access
-   `nodes/memory/ConversationSummaryMemory/ConversationSummaryMemory.ts` - Added safe message property handling
-   `nodes/memory/Mem0/Mem0.ts` - Fixed unknown type errors in chat message processing

### Agent Memory Systems

-   `nodes/memory/AgentMemory/MySQLAgentMemory/mysqlSaver.ts` - Enhanced with safe property access
-   `nodes/memory/AgentMemory/PostgresAgentMemory/pgSaver.ts` - Added safe message handling
-   `nodes/memory/AgentMemory/SQLiteAgentMemory/sqliteSaver.ts` - Fixed unknown type errors

### Vector Stores

-   `nodes/vectorstores/DocumentStoreVS/DocStoreVector.ts` - Enhanced with safe JSON parsing and property access

### Type Safety Enhancements

All updates maintain backward compatibility while adding comprehensive error handling and type safety. The changes ensure graceful degradation when encountering unknown properties or malformed data, improving overall system stability.

## Related Server Updates

Following the TypeScript modernization in components, additional compatibility fixes were required in the main server:

### Queue Management

-   `../server/src/queue/QueueManager.ts` - Fixed BullMQAdapter type compatibility issues with bull-board integration

### API Security

-   `../server/src/utils/apiKey.ts` - Enhanced Buffer→Uint8Array conversion for timingSafeEqual crypto operations

These server-side changes were necessary to maintain compatibility with the stricter TypeScript compilation and updated dependency versions introduced by the component modernization.

## License

Source code in this repository is made available under the [Apache License Version 2.0](https://github.com/FlowiseAI/Flowise/blob/master/LICENSE.md).
