# @universo/flowise-tools-frontend

Frontend package for Tools management in Universo Platformo.

## Overview

This package provides React components for managing custom tools that can be used in AI workflows. Tools allow integration of external APIs and custom JavaScript functions into chatflows and agentflows.

## Package Information

- **Package**: `@universo/flowise-tools-frontend`
- **Version**: `0.1.0`
- **Type**: Frontend (Modern)
- **Framework**: React, Material-UI, TypeScript
- **Dependencies**: `@universo/api-client`, `@flowise/template-mui`

## Key Features

### 📄 Pages
- **ToolsPage**: Main page for viewing and managing tools
- **ToolDialog**: Dialog component for creating/editing tools

### 🌐 Internationalization
- English (en) and Russian (ru) translations
- Integration with `@universo/i18n` namespace system

### 🎨 UI Components
- Data table with search and filtering
- Tool configuration dialogs
- JavaScript code editor integration

## Installation

```bash
pnpm add @universo/flowise-tools-frontend
```

## Usage

```jsx
import { ToolsPage } from '@universo/flowise-tools-frontend'

// In your router
<Route path="/unik/:unikId/tools" element={<ToolsPage />} />
```

### i18n Registration

```jsx
// Register translations (side-effect import)
import '@universo/flowise-tools-frontend/i18n'
```

## Exports

### Pages
- `ToolsPage` - Main tools management page

### i18n
- `toolsTranslations` - Translation resources
- `getToolsTranslations` - Function to get translations by locale

## File Structure

```
packages/flowise-tools-frontend/
├── base/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Tools.jsx      # Main page component
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
