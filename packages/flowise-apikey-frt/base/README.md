# @universo/flowise-apikey-frt

Frontend package for API Key management in Universo Platformo.

## Overview

This package provides React components for managing API keys used to authenticate external access to chatflows and agentflows. Users can create, view, and manage API keys for programmatic access to their published AI workflows.

## Package Information

- **Package**: `@universo/flowise-apikey-frt`
- **Version**: `0.1.0`
- **Type**: Frontend (Modern)
- **Framework**: React, Material-UI, TypeScript
- **Dependencies**: `@universo/api-client`, `@flowise/template-mui`

## Key Features

### 📄 Pages
- **APIKeyPage**: Main page for viewing and managing API keys
- **APIKeyDialog**: Dialog component for creating/editing API keys

### 🌐 Internationalization
- English (en) and Russian (ru) translations
- Integration with `@universo/i18n` namespace system

### 🎨 UI Components
- Data table with search and filtering
- Copy-to-clipboard functionality for API keys
- Key visibility toggle (show/hide)
- Usage statistics display

## Installation

```bash
pnpm add @universo/flowise-apikey-frt
```

## Usage

```jsx
import { APIKeyPage } from '@universo/flowise-apikey-frt'

// In your router
<Route path="/unik/:unikId/apikeys" element={<APIKeyPage />} />
```

### i18n Registration

```jsx
// Register translations (side-effect import)
import '@universo/flowise-apikey-frt/i18n'
```

## Exports

### Pages
- `APIKeyPage` - Main API key management page

### i18n
- `apikeyTranslations` - Translation resources
- `getApikeyTranslations` - Function to get translations by locale

## File Structure

```
packages/flowise-apikey-frt/
├── base/
│   ├── src/
│   │   ├── pages/
│   │   │   └── APIKey.jsx     # Main page component
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
- `@flowise/store`

## Development

```bash
# Install dependencies
pnpm install

# Run linting
pnpm lint
```

## License

Apache License Version 2.0 - See the [LICENSE](../../../LICENSE) file for details.
