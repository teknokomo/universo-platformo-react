# Flowise AI Node Components (Legacy) 🤖

> **⚠️ Legacy Package Notice**  
> This is a **legacy Flowise package** containing the original AI node system that will be **phased out and removed** as part of Universo Platformo's architecture modernization. The AI node system is being refactored into a new, more maintainable architecture with better TypeScript support and modern patterns.
>
> **Migration Timeline**: This package is planned for removal after Q2 2026 when the new node system is fully implemented.  
> **New Architecture**: Modern AI components will be built as standalone `@universo/ai-*` packages with improved performance, better error handling, and cleaner integration APIs.

![Flowise](https://github.com/FlowiseAI/Flowise/blob/main/images/flowise.gif?raw=true)

## Overview

Legacy AI node components library for the original Flowise platform, containing 200+ integrations with AI models, vector stores, document loaders, and tools. Built on LangChain and LlamaIndex frameworks with comprehensive support for AI workflows and orchestration.

**Current Version**: `2.2.8` (frozen - no new features, maintenance only)

## Legacy AI Node Categories

### LangChain Integration (Primary Framework)
- **Agents** - Autonomous AI agents with tool capabilities
- **Chat Models** - 50+ chat-based AI models (GPT, Claude, Gemini, etc.)
- **LLMs** - Language models for text completion
- **Chains** - Pre-built AI workflow chains
- **Tools** - 100+ integrations (APIs, databases, web scraping)
- **Vector Stores** - 20+ vector database integrations
- **Document Loaders** - File processors (PDF, Word, CSV, etc.)
- **Embeddings** - Text embedding models
- **Memory** - Conversation memory systems
- **Text Splitters** - Document chunking strategies
- **Retrievers** - Information retrieval systems
- **Output Parsers** - Response formatting utilities
- **Prompts** - Prompt template management

### LlamaIndex Integration (Secondary Framework)
- **Agents** - LlamaIndex-based agents
- **Chat Models** - LlamaIndex chat interfaces
- **Embeddings** - LlamaIndex embedding models
- **Engine** - Query and chat engines
- **Response Synthesizers** - Answer generation
- **Tools** - LlamaIndex-specific tools
- **Vector Stores** - LlamaIndex vector integrations

### Utility Components
- **Custom JS Function** - JavaScript code execution
- **Set/Get Variable** - State management
- **If Else** - Conditional logic
- **Sticky Note** - Documentation nodes

### Disabled Components
5 AI model nodes are automatically disabled due to SDK compatibility issues:
- ChatFireworks, ChatTogetherAI, ChatIBMWatsonx, IBMWatsonxEmbedding, IBMWatsonx

## Legacy Architecture Details

### Node System Architecture
```typescript
interface INode {
    label: string
    name: string
    version: number
    type: string
    icon: string
    category: string
    description: string
    baseClasses: string[]
    inputs?: INodeParams[]
    outputs?: INodeParams[]
    init?: (nodeData: INodeData) => Promise<any>
}
```

### Runtime Execution Model
- **Dynamic Loading**: Nodes loaded at runtime via NodesPool system
- **Credential Management**: Secure credential storage and injection
- **Model Loading**: Dynamic AI model configuration from JSON registry
- **Error Handling**: Try-catch patterns with fallback mechanisms
- **Memory Management**: Buffer/Uint8Array compatibility for large files

## TypeScript Modernization (Current State)

The following files have been enhanced for compatibility with newer TypeScript and library versions:

### Core Utilities & Interfaces

-   `src/Interface.ts` - Added 8 new type-safe interfaces (IAssistantDetails, IToolData, ICredentialData, ISessionData, IUploadResponse, IDocumentStoreData, IMessageContent, IParsedJSON)
-   `src/utils.ts` - Added 6 new type-safe utilities (safeJSONParse, bufferToUint8Array, safeCast, hasProperty, safeGet)
-   `src/storageUtils.ts` - Fixed Buffer→Uint8Array compatibility issues
-   `src/handler.ts` - Enhanced with safe property access patterns

### Node Implementations

-   `nodes/agents/AutoGPT/AutoGPT.ts` - Fixed LangChain ObjectTool type compatibility
-   `nodes/tools/CanvasTool/CanvasTool.ts` - Enhanced with safe canvas property access
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

## Zod/LangChain typing note (build stability)

Context: During migration and TypeScript upgrades, builds could fail with:

- `TS2344` – Zod type conflict across multiple installed versions (private field `_cached` differs).
- `TS2589` – "Type instantiation is excessively deep and possibly infinite" when using `withStructuredOutput` and `StructuredOutputParser.fromZodSchema` with complex Zod schemas.

What we changed for stability (current state):

- Unified Zod to a single version across the monorepo: `zod@3.25.76` (pinned via root `pnpm.overrides` and explicit package deps).
- Relaxed type pressure in two hotspots to avoid cross-version Zod generic unification and deep generic expansion:
  - `nodes/tools/RetrieverTool/RetrieverTool.ts`:
    - `DynamicStructuredTool` now extends `StructuredTool<any>` and treats `schema` as a runtime-only contract.
    - Parsing uses `(schema as any).parseAsync(...)` to avoid leaking Zod generics into public types.
  - `src/followUpPrompts.ts`:
    - Calls to `withStructuredOutput(FollowUpPromptType)` and `StructuredOutputParser.fromZodSchema(FollowUpPromptType)` use narrow casts (`as any`) to prevent excessive type instantiation.

How to verify:

- Ensure a single Zod version is installed: `pnpm ls zod` (should show only `3.25.76`).
- Build this package: `pnpm --filter flowise-components run build`.

Guidance for re‑enabling strict generics later:

- Keep exactly one Zod in the graph (pin versions in root `pnpm.overrides` and avoid `^` in package manifests).
- Align LangChain packages (`@langchain/core`, `@langchain/openai`, etc.) to mutually compatible versions used in this repo.
- If builds remain stable, you can revert the relaxations:
  - In `RetrieverTool`, restore `StructuredTool<T>` and strict Zod bounds for `T`.
  - In `followUpPrompts`, remove `as any` casts around `withStructuredOutput`/`StructuredOutputParser`.

Trade‑off:

- The current approach preserves runtime validation and behavior, while reducing TypeScript’s generic complexity. It intentionally avoids exporting Zod‑heavy types from public APIs to keep compilation deterministic.

## Migration Strategy

### Phase 1: Analysis & Audit (Q1 2026)
- [ ] **Node Usage Mapping**: Map all 200+ nodes used across Universo Platformo
- [ ] **Dependency Analysis**: Identify critical LangChain/LlamaIndex dependencies
- [ ] **Performance Assessment**: Analyze current node system bottlenecks
- [ ] **Integration Points**: Document all external system integrations

### Phase 2: New Architecture Design (Q1 2026)
- [ ] **Modern Node System**: Design TypeScript-first node architecture
- [ ] **Plugin Architecture**: Create modular plugin system for AI integrations
- [ ] **State Management**: Replace Redux with modern state solutions
- [ ] **Error Boundaries**: Implement comprehensive error handling
- [ ] **Performance Optimization**: Design for better memory and CPU usage

### Phase 3: Core Infrastructure (Q2 2026)
- [ ] **Base AI Engine**: Build new `@universo/ai-engine` package
- [ ] **Node Registry**: Implement modern node discovery and loading
- [ ] **Credential System**: Secure credential management with encryption
- [ ] **Model Management**: Dynamic model loading with caching

### Phase 4: Component Migration (Q2 2026)
- [ ] **Essential Nodes**: Migrate most-used 50 nodes first
- [ ] **Chat Models**: Priority migration of OpenAI, Anthropic, Google models
- [ ] **Vector Stores**: Migrate Pinecone, Chroma, Weaviate integrations
- [ ] **Tools**: Migrate critical API and database tools
- [ ] **Testing Suite**: Comprehensive testing for migrated components

### Phase 5: Legacy Cleanup (Q2 2026)
- [ ] **Gradual Replacement**: Replace flowise-components usage across codebase
- [ ] **Compatibility Layer**: Temporary compatibility for unmigrated flows
- [ ] **Documentation**: Complete migration guide and new API docs
- [ ] **Package Removal**: Remove flowise-components from dependencies

## Current Development (Legacy Maintenance)

### Prerequisites
- Node.js 18+
- PNPM workspace environment
- Access to LangChain/LlamaIndex APIs
- AI model API keys (OpenAI, Anthropic, etc.)

### Commands
```bash
# Install package
npm i flowise-components

# Build package (dual CJS/ESM output)
pnpm --filter flowise-components build

# Lint TypeScript
pnpm --filter flowise-components lint

# Clean build artifacts
pnpm --filter flowise-components clean
```

### Package Structure
```
flowise-components/
├── nodes/                    # 200+ AI integration nodes
│   ├── agents/              # Autonomous AI agents
│   ├── chatmodels/          # Chat-based AI models  
│   ├── chains/              # Pre-built workflows
│   ├── tools/               # API and service integrations
│   ├── vectorstores/        # Vector database integrations
│   ├── documentloaders/     # File processing components
│   └── ...                  # 20+ other categories
├── credentials/             # Authentication configurations
├── src/                     # Core utilities and interfaces
│   ├── Interface.ts         # Type definitions
│   ├── utils.ts            # Utility functions
│   ├── handler.ts          # Node execution logic
│   └── modelLoader.ts      # AI model management
├── models.json             # AI model registry
└── package.json            # Package configuration
```

## Known Issues & Technical Debt

### Performance Issues
- **Memory Leaks**: Long-running flows can accumulate memory
- **Large Dependencies**: Package size ~50MB due to AI SDK dependencies
- **Startup Time**: Node discovery takes 2-3 seconds on first load
- **Bundle Size**: Client bundles include unnecessary server-side code

### Maintenance Challenges
- **Dependency Hell**: 100+ dependencies with frequent breaking changes
- **SDK Compatibility**: AI provider SDKs often break with updates
- **Type Safety**: Mixed JavaScript/TypeScript creates type holes
- **Error Handling**: Inconsistent error patterns across 200+ nodes

### Architecture Limitations
- **Monolithic Package**: Single package contains all integrations
- **Tight Coupling**: Nodes deeply coupled to Flowise runtime
- **No Versioning**: No semantic versioning for individual nodes
- **Testing Gaps**: Limited test coverage across node implementations

### Browser Compatibility
- **Node.js APIs**: Many nodes use server-only APIs
- **Binary Dependencies**: Some vector stores require native binaries
- **Memory Usage**: Browser environments struggle with large models

## Alternative Solutions

### Option 1: Use Modern AI Frameworks
- **Vercel AI SDK**: Modern TypeScript-first AI framework
- **LangChain.js**: Latest version with better TypeScript support
- **Ollama**: Local model serving with simple APIs

### Option 2: Direct API Integration
- **OpenAI SDK**: Direct integration with OpenAI APIs
- **Anthropic SDK**: Direct Claude API integration
- **Google AI SDK**: Direct Gemini integration

### Option 3: Wait for Migration
- Continue using current system until new architecture is ready
- Apply only critical security patches
- Plan migration timeline based on business needs

## Support & Resources

### Legacy Documentation
- [Node Categories Overview](../../docs/en/integrations/README.md)
- [Disabled Nodes Reference](DISABLED_NODES.md)
- [LangChain Integration Guide](../../docs/en/integrations/langchain/)
- [LlamaIndex Integration Guide](../../docs/en/integrations/llamaindex/)

### Migration Resources
- [Architecture Roadmap](../../docs/en/roadmap/target-architecture/README.md)
- [Current System Analysis](../../docs/en/roadmap/current-architecture/packages-analysis.md)
- [Migration Strategy](../../docs/en/roadmap/implementation-plan/migration-strategy.md)

### Community & Support
- **Issues**: Report bugs in main repository
- **Discussions**: Architecture discussions in project Discord
- **Migration Help**: Contact team for migration assistance

## License

Source code in this repository is made available under the Apache License Version 2.0.

---

**Universo Platformo | Legacy AI Node Components**  
*⚠️ Scheduled for replacement with modern @universo/ai-* packages*
