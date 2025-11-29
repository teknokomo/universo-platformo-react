# @universo/flowise-variables-frt

Frontend package for Variables management in Universo Platformo.

## Overview

This package provides React components for managing variables that can be used across AI workflows. Variables allow storing reusable values like prompts, configurations, and dynamic data that can be referenced in chatflows and agentflows.

## Package Information

- **Package**: `@universo/flowise-variables-frt`
- **Version**: `0.1.0`
- **Type**: Frontend (Modern)
- **Framework**: React, Material-UI, TypeScript
- **Dependencies**: `@universo/api-client`, `@flowise/template-mui`

## Key Features

### 📄 Pages
- **VariablesPage**: Main page for viewing and managing variables
- **VariableDialog**: Dialog component for creating/editing variables

### 🌐 Internationalization
- English (en) and Russian (ru) translations
- Integration with `@universo/i18n` namespace system

### 🎨 UI Components
- Data table with search and filtering
- Variable type selector (static, runtime)
- Inline editing support

## Installation

```bash
pnpm add @universo/flowise-variables-frt
```

## Usage

```jsx
import { VariablesPage } from '@universo/flowise-variables-frt'

// In your router
<Route path="/unik/:unikId/variables" element={<VariablesPage />} />
```

### i18n Registration

```jsx
// Register translations (side-effect import)
import '@universo/flowise-variables-frt/i18n'
```

## Exports

### Pages
- `VariablesPage` - Main variables management page

### i18n
- `variablesTranslations` - Translation resources
- `getVariablesTranslations` - Function to get translations by locale

## File Structure

```
packages/flowise-variables-frt/
├── base/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Variables.jsx  # Main page component
│   │   ├── i18n/
│   │   │   ├── index.ts       # i18n registration
│   │   │   └── locales/
│   │   │       ├── en/        # English translations
│   │   │       └── ru/        # Russian translations
│   │   └── index.ts           # Entry point
│   ├── package.json
│   ├── README.md              # This file
│   └── README-RU.md           # Russian documentation
└── package.json               # Workspace configuration
```

## Dependencies

### Peer Dependencies
- `react` >= 18
- `react-dom` >= 18
- `@mui/material` >= 5
- `@universo/api-client`
- `@universo/i18n`
- `@flowise/template-mui`

## Development

```bash
# Install dependencies
pnpm install

# Run linting
pnpm lint
```

## License

Apache License Version 2.0 - See the [LICENSE](../../../LICENSE) file for details.
