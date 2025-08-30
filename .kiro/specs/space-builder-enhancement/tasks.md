# Implementation Plan

- [ ] 1. Create template-quiz package structure and basic setup
  - Create directory structure following template-mmoomm pattern
  - Set up package.json with dual build system (CommonJS + ESM)
  - Configure TypeScript compilation (tsconfig.json and tsconfig.esm.json)
  - Create basic README.md documentation
  - _Requirements: 1.1, 1.7_

- [x] 1.1 Copy existing quiz functionality from publish-frt
  - Copy all files from `apps/publish-frt/base/src/builders/templates/quiz` to `apps/template-quiz/base/src`
  - Preserve directory structure and file organization
  - Ensure all handlers, builders, and utilities are included
  - _Requirements: 1.2_

- [x] 1.2 Adapt copied code to independent package structure
  - Update import paths to work as standalone package
  - Modify exports to follow template-mmoomm pattern
  - Update interfaces and types for package independence
  - Ensure proper module boundaries and dependencies
  - _Requirements: 1.3_

- [x] 1.3 Implement i18n integration for template-quiz
  - Create i18n directory structure with locales/en and locales/ru
  - Implement translation files following template-mmoomm pattern
  - Add i18nNamespace: 'templateQuiz' to template configuration
  - Create translation export functions matching template-mmoomm
  - _Requirements: 1.4_

- [x] 1.4 Update publish-frt to use new template-quiz package
  - Add @universo/template-quiz dependency to publish-frt package.json
  - Update TemplateRegistry to import from new package
  - Modify TypeScript path mappings for new package
  - Update template references in builders
  - _Requirements: 1.5_

- [x] 1.5 Verify integration and remove original quiz code
  - Test that quiz generation works with new package
  - Verify AR.js output matches original functionality
  - Run full build and test cycle
  - Remove original quiz code from publish-frt after verification
  - _Requirements: 1.6_

- [ ] 2. Fix credentials integration in Space Builder
  - Analyze current credential resolution implementation in main server
  - Identify the specific issue with encrypted credential handling
  - Map credential types to API key field names (openAIApi -> openAIApiKey, etc.)
  - _Requirements: 2.3, 2.5_

- [ ] 2.1 Enhance credential resolution in main server
  - Update resolveCredential function in packages/server/src/routes/index.ts
  - Implement proper credential type detection and field extraction
  - Add support for multiple provider credential types (OpenAI, Groq, etc.)
  - Handle decryption errors and provide meaningful error messages
  - _Requirements: 2.1, 2.2_

- [ ] 2.2 Update Space Builder credential handling
  - Ensure credentialId is properly passed through API calls
  - Verify ModelFactory.ts correctly uses resolved credentials
  - Test credential resolution with different provider types
  - Add error handling for unsupported credential types
  - _Requirements: 2.4_

- [ ] 2.3 Test credentials integration with real user credentials
  - Create test credentials for different providers in the system
  - Verify Space Builder can use OpenAI credentials for generation
  - Test Groq and other supported provider credentials
  - Ensure proper error messages for invalid/missing credentials
  - _Requirements: 2.1, 2.4_

- [ ] 3. Implement manual editing capability in Space Builder frontend
  - Add edit mode state management to preview step component
  - Create editable textarea component for questions and answers
  - Implement toggle between read-only and edit modes
  - Add UI instructions for marking correct answers with ✅ or [V]
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [ ] 3.1 Create cleanup prompt for edited content processing
  - Design AI prompt for validating and cleaning manually edited content
  - Implement content structure validation and correction
  - Handle correct answer marker detection (✅ and [V])
  - Ensure output maintains required JSON structure for builder
  - _Requirements: 3.6, 3.7_

- [ ] 3.2 Integrate manual editing with existing workflow
  - Connect edit mode with Space Builder API endpoints
  - Implement content processing through cleanup prompt
  - Add validation and error handling for edited content
  - Ensure seamless transition from editing back to generation
  - _Requirements: 3.8_

- [ ] 3.3 Add insert button for correct answer markers
  - Implement cursor position detection in textarea
  - Create insert button that adds ✅ emoji at cursor position
  - Add keyboard shortcut support for quick marker insertion
  - Test marker insertion functionality across different browsers
  - _Requirements: 3.5_

- [ ] 4. Refactor UPDL processing to use high-level nodes only
  - Analyze current Object node usage in quiz template
  - Map Object-based implementations to Entity + Component patterns
  - Study MMOOMM template example for Entity + Component(Render) usage
  - Plan migration strategy for answer graphics generation
  - _Requirements: 4.1, 4.2, 4.4_

- [ ] 4.1 Update quiz handlers to process high-level nodes
  - Modify EntityHandler to create answer button entities
  - Update ComponentHandler to process Component(Render) for answer graphics
  - Implement Entity + Component pattern for visual answer elements
  - Remove all Object node processing from handlers
  - _Requirements: 4.3, 4.5_

- [ ] 4.2 Implement Entity + Component(Render) for answer visualization
  - Create answer entities with proper component references
  - Implement Component(Render) with color and primitive configuration
  - Support box, sphere, cylinder primitives for answer options
  - Ensure color configuration works with hex and RGB values
  - _Requirements: 4.5_

- [ ] 4.3 Update quiz builder to generate high-level node graphs
  - Modify quiz plan to UPDL conversion logic
  - Generate Entity nodes for answer buttons instead of Object nodes
  - Create Component(Render) nodes for answer visualization
  - Ensure proper node relationships and connections
  - _Requirements: 4.6_

- [ ] 4.4 Test and verify AR.js output with new architecture
  - Generate test quizzes using new high-level node architecture
  - Verify AR.js HTML output maintains visual functionality
  - Test answer interaction and selection behavior
  - Compare output with original Object-based implementation
  - _Requirements: 4.7_

- [ ] 4.5 Remove legacy Object node references
  - Clean up all Object node handlers and processors
  - Remove Object node type definitions and interfaces
  - Update documentation to reflect new architecture
  - Ensure no legacy code remains in quiz template
  - _Requirements: 4.2_

- [ ] 5. Integration testing and final verification
  - Test complete workflow from text input to AR.js generation
  - Verify credentials work with all supported providers
  - Test manual editing with various content types and structures
  - Ensure new UPDL architecture produces functional quizzes
  - _Requirements: All requirements verification_

- [ ] 5.1 Performance testing and optimization
  - Test template-quiz package loading and initialization time
  - Verify credential resolution performance with multiple users
  - Test manual editing with large content processing
  - Optimize UPDL graph generation for complex quizzes
  - _Requirements: Performance and scalability_

- [ ] 5.2 Documentation and deployment preparation
  - Update README files for template-quiz package
  - Document new credential integration process
  - Create user guide for manual editing features
  - Prepare deployment and migration instructions
  - _Requirements: Documentation and maintenance_