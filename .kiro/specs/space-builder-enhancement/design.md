# Design Document

## Overview

This design document outlines the enhancement of the Space Builder functionality in Universo Platformo. The enhancement consists of four major components: extracting quiz functionality into a separate template package, fixing credentials integration, adding manual editing capabilities, and refactoring UPDL node processing to use only high-level nodes.

## Architecture

### Current Architecture Analysis

The current Space Builder consists of:
- **Frontend (`packages/space-builder-frt`)**: React components for UI interaction
- **Backend (`packages/space-builder-srv`)**: API endpoints and LLM integration
- **Quiz Template**: Currently embedded in `packages/publish-frt/base/src/builders/templates/quiz`
- **Credentials System**: Partially implemented with test mode fallback

### Target Architecture

The enhanced architecture will feature:
- **Modular Template System**: Quiz functionality extracted to `@universo/template-quiz`
- **Proper Credentials Integration**: Full user credential support following Flowise patterns
- **Enhanced UI**: Manual editing capabilities with validation
- **Modern UPDL Processing**: High-level nodes only (Space, Entity, Component, Event, Action, Data, Universo)

## Components and Interfaces

### 1. Template Quiz Package (`packages/template-quiz`)

#### Package Structure
```
packages/template-quiz/base/
├── src/
│   ├── arjs/                    # AR.js implementation
│   │   ├── builders/            # Quiz builders
│   │   ├── handlers/            # UPDL node handlers
│   │   └── generators/          # Content generators
│   ├── common/                  # Shared utilities
│   ├── i18n/                    # Internationalization
│   │   ├── locales/
│   │   │   ├── en/main.json
│   │   │   └── ru/main.json
│   │   └── index.js
│   └── index.ts                 # Main exports
├── package.json
├── tsconfig.json
├── tsconfig.esm.json
└── README.md
```

#### Key Interfaces
```typescript
// Template configuration
interface QuizTemplateConfig extends TemplateConfig {
  id: 'quiz-arjs'
  name: 'Quiz Template'
  technology: 'arjs'
  i18nNamespace: 'templateQuiz'
  supportedModes: ['quiz', 'survey']
}

// Quiz builder interface
interface ARJSQuizBuilder extends ITemplateBuilder {
  build(flowData: IFlowData, options?: BuildOptions): Promise<string>
  getTemplateInfo(): TemplateConfig
}
```

#### Migration Strategy
1. **Phase 1**: Copy existing code from `packages/publish-frt/base/src/builders/templates/quiz`
2. **Phase 2**: Adapt to independent package structure
3. **Phase 3**: Implement i18n integration following template-mmoomm pattern
4. **Phase 4**: Update publish-frt to use new package
5. **Phase 5**: Remove original code after verification

### 2. Credentials Integration Enhancement

#### Current Issue Analysis
The Space Builder has two working modes:
1. **Test Mode** (`SPACE_BUILDER_TEST_MODE=true`): Uses unencrypted API keys from `packages/flowise-server/.env` - this works correctly
2. **Credentials Mode** (`SPACE_BUILDER_DISABLE_USER_CREDENTIALS=false`): Should use encrypted credentials from the Credentials system - this currently fails

The problem is that when using user credentials, the Space Builder's `resolveCredential` function receives a `credentialId` but the current implementation in the main server only returns `cred.plainDataObj.apiKey`, which doesn't properly handle the decryption and extraction of the correct API key field for different providers.

In Flowise components (like ChatOpenAI), credentials are handled through:
1. `getCredentialData(credentialId, options)` - decrypts the credential data
2. `getCredentialParam('openAIApiKey', credentialData, nodeData)` - extracts the specific field

#### Solution Design
```typescript
// Enhanced credential resolution in main server
router.use('/space-builder', 
  upAuth.ensureAuth, 
  spaceBuilderLimiter, 
  createSpaceBuilderRouter({
    resolveCredential: async (credentialId: string) => {
      const cred = await credentialsService.getCredentialById(credentialId)
      const decryptedData = cred.plainDataObj
      
      // Extract the appropriate API key based on credential type
      if (cred.credentialName === 'openAIApi') {
        return decryptedData.openAIApiKey
      } else if (cred.credentialName === 'groqApi') {
        return decryptedData.groqApiKey
      }
      // Add other providers as needed
      
      throw new Error(`Unsupported credential type: ${cred.credentialName}`)
    }
  })
)

// Space Builder service enhancement - no changes needed
interface SelectedChatModel {
  provider: string
  modelName: string
  credentialId?: string  // Required when not in test mode
}
```

#### Integration Points
1. **Credential Discovery**: Fetch available credentials from `/api/v1/credentials` filtered by supported credential types (openAIApi, groqApi, etc.)
2. **Model Selection**: Enhanced UI to show credential-based models alongside test mode models
3. **Credential Resolution**: Proper decryption and field extraction following Flowise patterns (`getCredentialData` + `getCredentialParam`)
4. **Provider Mapping**: Map credential types to the correct API key field names
5. **Error Handling**: Clear messages when credentials are missing/invalid/unsupported

### 3. Manual Editing Enhancement

#### UI Components Design
```typescript
// Enhanced preview step component
interface PreviewStepProps {
  quizPlan: QuizPlan
  onRevise: (instructions: string) => void
  onEdit: (editedContent: string) => void
  isEditing: boolean
  onToggleEdit: () => void
}

// Manual editing component
interface ManualEditingProps {
  content: string
  onChange: (content: string) => void
  onInsertCorrectMarker: () => void
}
```

#### Editing Workflow
1. **Display Mode**: Show AI-generated questions/answers in read-only format
2. **Edit Mode**: Convert to editable textarea with formatting instructions
3. **Validation**: Process edited content through cleanup prompt
4. **Integration**: Seamless transition back to generation step

#### Cleanup Prompt Design
```typescript
const getCleanupPrompt = (editedContent: string) => `
You are a quiz content processor. Your task is to clean up manually edited quiz content and ensure it maintains the required JSON structure.

Input content (may contain formatting issues or structural problems):
${editedContent}

Requirements:
1. Maintain the exact JSON structure: { items: [{ question: string, answers: [{ text: string, isCorrect: boolean }] }] }
2. Identify correct answers marked with ✅ or [V] and set isCorrect: true
3. Clean up formatting and grammar while preserving meaning
4. Ensure each question has exactly one correct answer
5. Remove any invalid or duplicate content

Output only the cleaned JSON structure.
`
```

### 4. UPDL Node Architecture Refactoring

#### Current State Analysis
The quiz template currently uses a mix of:
- **Legacy Object nodes**: For answer graphics and interactions
- **High-level nodes**: Space, Data for quiz structure

#### Target Architecture
```typescript
// High-level node structure for quiz
interface QuizUPDLStructure {
  spaces: Space[]           // Quiz questions/screens
  entities: Entity[]        // Answer buttons, UI elements
  components: Component[]   // Render, interaction components
  events: Event[]          // Click, selection events
  actions: Action[]        // Navigation, scoring actions
  data: Data[]             // Questions, answers, scores
}

// Entity + Component pattern for answer graphics
interface AnswerEntity extends Entity {
  id: string
  type: 'answer-button'
  components: ComponentReference[]
}

interface RenderComponent extends Component {
  componentType: 'render'
  props: {
    primitive: 'box' | 'sphere' | 'cylinder'
    color: string | { r: number, g: number, b: number }
    material?: MaterialConfig
  }
}
```

#### Migration Strategy
1. **Analysis**: Map current Object-based implementations to Entity+Component patterns
2. **Handler Updates**: Modify handlers to process high-level nodes only
3. **Builder Logic**: Update quiz builder to generate Entity+Component structures
4. **Testing**: Verify AR.js output maintains functionality
5. **Cleanup**: Remove all Object node references

## Data Models

### Quiz Template Data Models
```typescript
interface QuizPlan {
  items: QuizItem[]
}

interface QuizItem {
  question: string
  answers: QuizAnswer[]
}

interface QuizAnswer {
  text: string
  isCorrect: boolean
  pointsValue?: number
  enablePoints?: boolean
}

interface EditedQuizContent {
  rawText: string
  processedPlan: QuizPlan
  validationErrors?: string[]
}
```

### Credentials Data Models
```typescript
interface CredentialInfo {
  id: string
  name: string
  credentialName: string
  provider: string
  isValid: boolean
}

interface ModelWithCredential {
  id: string
  provider: string
  modelName: string
  label: string
  credentialId?: string
  isTestMode: boolean
}
```

## Error Handling

### Credentials Error Handling
```typescript
class CredentialError extends Error {
  constructor(
    public credentialId: string,
    public provider: string,
    message: string
  ) {
    super(`Credential error for ${provider}: ${message}`)
  }
}

// Error scenarios:
// 1. Credential not found
// 2. Invalid API key
// 3. Provider authentication failure
// 4. Rate limiting
```

### Manual Editing Error Handling
```typescript
interface EditingValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  processedContent?: QuizPlan
}

// Validation scenarios:
// 1. Invalid JSON structure after cleanup
// 2. Missing correct answers
// 3. Multiple correct answers per question
// 4. Empty questions or answers
```

### Template Package Error Handling
```typescript
// Package loading errors
// Build process errors
// i18n integration errors
// Dependency resolution errors
```

## Testing Strategy

### Unit Testing
1. **Template Quiz Package**
   - Builder functionality
   - Handler processing
   - i18n integration
   - Export/import functions

2. **Credentials Integration**
   - Credential resolution
   - Provider authentication
   - Error scenarios
   - Fallback mechanisms

3. **Manual Editing**
   - Content validation
   - Cleanup prompt processing
   - UI state management
   - Error handling

### Integration Testing
1. **End-to-End Workflows**
   - Complete quiz generation with user credentials
   - Manual editing and regeneration
   - Template package integration
   - UPDL node processing

2. **Cross-Package Integration**
   - Template quiz package in publish-frt
   - Space Builder with credentials
   - i18n system integration
   - Build system compatibility

### Performance Testing
1. **Template Loading**: Package import and initialization
2. **Credentials Resolution**: API response times
3. **Manual Editing**: Large content processing
4. **UPDL Processing**: Complex graph generation

## Implementation Phases

### Phase 1: Template Quiz Package Creation (Week 1)
- Create package structure
- Copy existing quiz code
- Implement basic build system
- Add i18n integration

### Phase 2: Credentials Integration Fix (Week 2)
- Analyze current credential flow
- Implement proper credential resolution
- Update UI for credential selection
- Add error handling

### Phase 3: Manual Editing Implementation (Week 2-3)
- Design editing UI components
- Implement cleanup prompt
- Add validation logic
- Integrate with existing workflow

### Phase 4: UPDL Architecture Refactoring (Week 3-4)
- Map Object nodes to Entity+Component patterns
- Update handlers and builders
- Test AR.js output
- Remove legacy code

### Phase 5: Integration and Testing (Week 4)
- End-to-end testing
- Performance optimization
- Documentation updates
- Deployment preparation

## Dependencies and Integration Points

### External Dependencies
- `@universo/template-mmoomm`: Reference implementation for template patterns
- `@universo/publish-srv`: UPDL type definitions
- `@universo/space-builder-srv`: Backend API integration
- Main Flowise credentials system

### Integration Points
- **Template Registry**: Register quiz template in publish-frt
- **Credentials Service**: Main server credential resolution
- **i18n System**: Translation integration
- **Build System**: Workspace compilation and packaging

## Security Considerations

### Credentials Security
- Encrypted credential storage
- Secure credential resolution
- API key protection in transit
- User isolation (credentials per unik)

### Content Validation
- Input sanitization for manual editing
- LLM prompt injection prevention
- JSON structure validation
- XSS prevention in generated content

### Package Security
- Dependency vulnerability scanning
- Secure build processes
- Code isolation between templates
- Runtime permission controls