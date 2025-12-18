# @flowise/executions-frontend

Frontend package for agent execution tracking in Universo Platformo.

## Overview

This package provides React components and pages for viewing and managing agent flow executions. Adapted from Flowise 3.0.12.

## Features

- **Executions List**: View all executions with filtering and pagination
- **Execution Details**: Detailed view of execution data and logs
- **Node Execution Details**: View individual node execution information
- **Share Dialog**: Share public execution links
- **i18n Support**: English and Russian translations

## Installation

```bash
pnpm add @flowise/executions-frontend
```

## Usage

### Executions Page

```jsx
import { Executions } from '@flowise/executions-frontend/pages/Executions'

function App() {
    return <Executions canvasId={canvasId} />
}
```

### i18n Integration

```typescript
import { executionsEn, executionsRu } from '@flowise/executions-frontend/i18n'
import { registerNamespace } from '@universo/i18n'

registerNamespace('executions', { en: executionsEn, ru: executionsRu })
```

## Components

- `Executions.jsx`: Main executions list page
- `ExecutionDetails.jsx`: Detailed execution view
- `NodeExecutionDetails.jsx`: Node-level execution details
- `ShareExecutionDialog.jsx`: Dialog for sharing executions
- `ExecutionsListTable.jsx`: Table component for executions list

## License

Apache 2.0 (see LICENSE-Flowise.md for attribution)
