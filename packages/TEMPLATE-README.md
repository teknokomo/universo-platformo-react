# {Package Name}

{LEGACY_WARNING_SECTION_IF_APPLICABLE}
{MODERN_PACKAGE_INDICATOR_IF_APPLICABLE}

## Overview

{Brief description of the package's purpose and role in the Universo Platformo ecosystem}

## Package Information

- **Package**: `{package-name}` or `@universo/{package-name}`
- **Version**: `{version}` {(frozen legacy version) if applicable}
- **Type**: {Frontend/Backend/Library/Components} ({Modern/Legacy} if applicable)
- **Framework**: {Main technologies and frameworks used}
- **Dependencies**: {Key dependency relationships}

## Key Features

### 🎯 {Primary Feature Category}
- **Feature 1**: Description of the feature
- **Feature 2**: Description of the feature
- **Feature 3**: Description of the feature

### 🔧 {Secondary Feature Category (if applicable)}
- **Feature 1**: Description of the feature
- **Feature 2**: Description of the feature

### 🏗️ {Architecture/Integration Category (if applicable)}
- **Integration Point 1**: Description
- **Integration Point 2**: Description

## Installation & Setup

### Prerequisites
```bash
# List any prerequisites
Node.js >= 18.0.0
pnpm >= 8.0.0
```

### Installation
```bash
# For workspace packages
pnpm install

# For external usage (if applicable)
pnpm add @universo/{package-name}
```

### Configuration
```bash
# Environment variables (if applicable)
{ENV_VAR_1}=value1
{ENV_VAR_2}=value2
```

## Usage

### Basic Usage
```{language}
// Basic usage example
import { ComponentName } from '@universo/{package-name}'

// Usage code
```

### Advanced Usage
```{language}
// Advanced usage example
// More complex implementation
```

## Architecture

### Core Components
- **Component 1**: Purpose and functionality
- **Component 2**: Purpose and functionality
- **Component 3**: Purpose and functionality

### Dependencies
```json
{
  "dependency1": "^x.y.z",
  "dependency2": "^x.y.z"
}
```

## File Structure

```
packages/{package-name}/
{STRUCTURE_FOR_MODERN_PACKAGES}
├── base/                   # Default implementation
│   ├── src/               # Source code
│   │   ├── components/    # Main components
│   │   ├── hooks/         # Custom hooks (for React packages)
│   │   ├── utils/         # Utility functions
│   │   ├── types/         # TypeScript definitions
│   │   └── index.ts       # Entry point
│   ├── dist/              # Compiled output (CJS, ESM, types)
│   ├── i18n/              # Internationalization (for frontend)
│   │   ├── en/            # English translations
│   │   └── ru/            # Russian translations
│   ├── package.json
│   ├── tsconfig.json
│   ├── README.md          # This file
│   └── README-RU.md       # Russian documentation
├── package.json           # Workspace package configuration
└── README.md              # Package overview

{STRUCTURE_FOR_LEGACY_PACKAGES}
├── src/                   # Source code
│   ├── {specific-dirs}/   # Package-specific directories
│   └── index.ts           # Entry point
├── dist/                  # Compiled output
├── package.json
├── README.md              # This file
└── README-RU.md           # Russian documentation
```

{LEGACY_STATUS_SECTION_IF_APPLICABLE}
## Legacy Status & Migration Plan

### Current State (2024)
- ✅ **Status**: Current operational status
- ✅ **Integration**: Integration status with modern packages
- ⚠️ **Maintenance**: Maintenance mode notice

### Migration Timeline
- **Q1 2025**: Migration planning and preparation
- **Q2 2025**: Begin feature migration to modern packages
- **Q3 2025**: Deprecation warnings and migration documentation
- **Q4 2025**: Feature freeze and migration preparation
- **Q1 2026**: Begin package refactoring
- **Q2 2026**: Complete migration and legacy removal

### Replacement Strategy
1. **Feature Migration**: Identify features to migrate to modern packages
2. **API Compatibility**: Maintain compatibility during transition
3. **Documentation**: Provide migration guides and examples
4. **Testing**: Ensure feature parity in modern implementations

{TESTING_SECTION}
## Testing

### Test Setup
```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch
```

### Test Structure
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API and workflow testing
- **E2E Tests**: End-to-end user flow testing (if applicable)

{DEVELOPMENT_SECTION}
## Development

### Local Development
```bash
# Install dependencies
pnpm install

# Start development server (if applicable)
pnpm dev

# Build project
pnpm build

# Run linting
pnpm lint

# Run type checking
pnpm type-check
```

{MODERN_PACKAGE_DEVELOPMENT_NOTES}
### Development Guidelines
- Follow TypeScript-first development
- Use workspace imports for cross-package dependencies
- Implement dual-build system (CJS + ESM) for frontend packages
- Follow repository coding standards and linting rules

{LEGACY_PACKAGE_DEVELOPMENT_NOTES}
### Adding New Features (Legacy Package)
⚠️ **Important**: This is legacy code. New features should be developed in modern `@universo/*` packages when possible.

If you must add features to this legacy package:
1. Follow existing patterns and architecture
2. Ensure compatibility with modern packages
3. Add appropriate deprecation notices
4. Document migration path for the feature

## Integration Points

### Modern Package Integration
- **Package 1**: Integration description
- **Package 2**: Integration description

### Legacy Package Dependencies (if applicable)
- **Legacy Package 1**: Dependency description
- **Legacy Package 2**: Dependency description

## API Reference

### Main Components/Functions
{API_DOCUMENTATION_SECTION}

## Configuration

### Environment Variables
```bash
# Configuration options
{CONFIG_VAR_1}=default_value  # Description
{CONFIG_VAR_2}=default_value  # Description
```

### Configuration Files
- **File 1**: Purpose and structure
- **File 2**: Purpose and structure

## Documentation

- **API Documentation**: Link to detailed API docs
- **Integration Guides**: Links to integration documentation
- **Migration Guides**: Links to migration documentation (for legacy packages)

## Contributing

{MODERN_PACKAGE_CONTRIBUTING}
### Development Workflow
1. Create feature branch from `main`
2. Implement changes following coding standards
3. Add appropriate tests for new functionality
4. Update documentation as needed
5. Submit pull request for review

{LEGACY_PACKAGE_CONTRIBUTING}
⚠️ **Legacy Package Notice**: This package is in maintenance mode. For new contributions:
1. Consider if the feature belongs in a modern `@universo/*` package instead
2. Follow existing code patterns if changes are necessary
3. Add appropriate tests for any modifications
4. Document the migration path for new features

## License

Apache License Version 2.0 - See the [LICENSE](../../LICENSE) file for details.

---

{MIGRATION_SUPPORT_FOOTER_IF_LEGACY}
**Migration Support**: If you need help migrating features from this legacy package to modern alternatives, please refer to the migration documentation or create an issue for guidance.

{SUPPORT_FOOTER_IF_MODERN}
**Support**: For questions, issues, or feature requests, please refer to the project documentation or create an issue in the repository.