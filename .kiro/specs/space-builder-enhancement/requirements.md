# Requirements Document

## Introduction

This specification outlines the enhancement of the Space Builder functionality in Universo Platformo. The Space Builder currently generates UPDL node graphs for quizzes based on text input. The enhancement involves four major phases: extracting quiz functionality into a separate template package, fixing credentials integration, adding manual editing capabilities, and refactoring UPDL node processing to use only high-level nodes.

## Requirements

### Requirement 1: Extract Quiz Template to Separate Package

**User Story:** As a developer, I want the quiz functionality to be extracted from the publish-frt package into a separate template-quiz package, so that the architecture follows the same modular pattern as template-mmoomm.

#### Acceptance Criteria

1. WHEN the quiz template extraction is complete THEN a new package `packages/template-quiz` SHALL exist with the same structure as `packages/template-mmoomm`
2. WHEN the basic package structure is created THEN the existing working code SHALL be copied from `packages/publish-frt/base/src/builders/templates/quiz` to preserve functionality and avoid rewriting from scratch
3. WHEN the code is copied THEN it SHALL be adapted to work as an independent package following the template-mmoomm pattern
4. WHEN the new package is created THEN it SHALL include proper i18n integration following the same pattern as template-mmoomm with namespace `templateQuiz`
5. WHEN the extraction is complete THEN `packages/publish-frt` SHALL import and use the quiz template from `@universo/template-quiz` package
6. WHEN the integration is verified and working THEN the original quiz code in `packages/publish-frt/base/src/builders/templates/quiz` SHALL be removed
7. WHEN the package is built THEN it SHALL support dual build system (CommonJS + ESM) like template-mmoomm

### Requirement 2: Fix Credentials Integration in Space Builder

**User Story:** As a user, I want to use my own API keys stored in the system credentials when generating spaces in Space Builder, so that I don't have to rely on shared test mode credentials.

#### Acceptance Criteria

1. WHEN a user has saved credentials in the system THEN Space Builder SHALL properly decrypt and extract the API keys for LLM provider calls
2. WHEN Space Builder is not in test mode THEN it SHALL use user-specific encrypted credentials following the same pattern as ChatOpenAI and other Flowise components
3. WHEN credentials are decrypted THEN the system SHALL extract the correct API key field based on credential type (openAIApiKey for openAIApi, groqApiKey for groqApi, etc.)
4. WHEN credentials are missing, invalid, or of unsupported type THEN Space Builder SHALL provide clear error messages to the user
5. WHEN the credentials system is working THEN it SHALL use the same `getCredentialData` and field extraction patterns as other Flowise components
6. WHEN multiple providers are available THEN users SHALL be able to select which credential to use for generation from the available credential-based models

### Requirement 3: Add Manual Editing Capability to Space Builder

**User Story:** As a user, I want to manually edit the AI-generated questions and answers in Space Builder, so that I can customize the content before generating the final UPDL graph.

#### Acceptance Criteria

1. WHEN the AI generates questions and answers THEN there SHALL be an "Edit" button that enables manual editing mode
2. WHEN manual editing is enabled THEN the questions and answers SHALL be displayed in an editable text field
3. WHEN users edit the content THEN they SHALL be able to mark correct answers using ✅ emoji or [V] text
4. WHEN manual editing mode is active THEN there SHALL be instructions displayed: "Для обозначения правильного ответа используйте ✅ или [V]"
5. WHEN manual editing mode is active THEN there SHALL be an "Insert" button that adds ✅ emoji at cursor position
6. WHEN users submit edited content THEN it SHALL be processed by a new AI prompt designed for cleanup and structure validation
7. WHEN the cleanup prompt processes content THEN it SHALL ensure the output maintains the required JSON structure for the builder
8. WHEN editing is complete THEN users SHALL be able to proceed to the generation step with the modified content

### Requirement 4: Refactor UPDL Node Processing to High-Level Architecture

**User Story:** As a developer, I want the quiz template to use only high-level UPDL nodes (Space, Entity, Component, Event, Action, Data, Universo) and remove the old Object-based implementation, so that the architecture is consistent and modern.

#### Acceptance Criteria

1. WHEN the refactoring is complete THEN the quiz template SHALL use only the high-level UPDL nodes: Space, Entity, Component, Event, Action, Data, Universo
2. WHEN the old Object-based implementation is removed THEN all references to Object nodes SHALL be eliminated from the quiz template
3. WHEN graphical primitives for answer options are needed THEN they SHALL be implemented using Entity + Component(Render) pattern
4. WHEN the new architecture is implemented THEN it SHALL follow the same pattern as the MMOOMM template example in .cursor/Universo-MMOOMM-Chatflow-2025-08-19.json
5. WHEN Component(Render) is used THEN it SHALL support color and primitive shape configuration for answer visualization
6. WHEN the refactoring is complete THEN the quiz generation SHALL produce graphs using only the new high-level node architecture
7. WHEN the new implementation is tested THEN it SHALL generate functional AR.js quizzes with visual answer elements
