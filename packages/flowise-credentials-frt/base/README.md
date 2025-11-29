# @universo/flowise-credentials-frt

Frontend package for Credentials management in Universo Platformo.

## Overview

This package provides React components for managing encrypted credentials used to authenticate with third-party services in AI workflows. Users can securely store API keys, OAuth tokens, and other authentication data.

## Package Information

- **Package**: `@universo/flowise-credentials-frt`
- **Version**: `0.1.0`
- **Type**: Frontend (Modern)
- **Framework**: React, Material-UI, TypeScript
- **Dependencies**: `@universo/api-client`, `@flowise/template-mui`

## Key Features

### 📄 Pages
- **CredentialsPage**: Main page for viewing and managing credentials
- **CredentialDialog**: Dialog component for creating/editing credentials

### 🌐 Internationalization
- English (en) and Russian (ru) translations
- Integration with `@universo/i18n` namespace system

### 🎨 UI Components
- Data table with search and filtering
- Credential type selector with icons
- Secure password input fields

## Installation

```bash
pnpm add @universo/flowise-credentials-frt
```

## Usage

```jsx
import { CredentialsPage } from '@universo/flowise-credentials-frt'

// In your router
<Route path="/unik/:unikId/credentials" element={<CredentialsPage />} />
```

### i18n Registration

```jsx
// Register translations (side-effect import)
import '@universo/flowise-credentials-frt/i18n'
```

## Exports

### Pages
- `CredentialsPage` - Main credentials management page

### i18n
- `credentialsTranslations` - Translation resources
- `getCredentialsTranslations` - Function to get translations by locale

## File Structure

```
packages/flowise-credentials-frt/
├── base/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Credentials.jsx # Main page component
│   │   ├── i18n/
│   │   │   ├── index.ts        # i18n registration
│   │   │   └── locales/
│   │   │       ├── en/         # English translations
│   │   │       └── ru/         # Russian translations
│   │   └── index.ts            # Entry point
│   ├── package.json
│   ├── README.md               # This file
│   └── README-RU.md            # Russian documentation
└── package.json                # Workspace configuration
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
