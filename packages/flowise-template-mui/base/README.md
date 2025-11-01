# Flowise Template MUI

🚨 **LEGACY CODE WARNING** 🚨  
This package is part of the legacy Flowise architecture and is scheduled for removal/refactoring after the Universo Platformo migration is complete (estimated Q2 2026). New features should be developed in the modern `@universo/*` packages instead.

## Overview

Material-UI component library extracted from Flowise UI, providing a comprehensive set of reusable UI components, layouts, themes, and utilities for building Flowise-based applications. This package uses an "unbundled source pattern" where components are consumed directly from source files rather than built artifacts.

## Package Information

- **Package**: `@flowise/template-mui`
- **Version**: `0.1.0` (legacy version)
- **Type**: UI Component Library (Legacy)
- **Framework**: React + Material-UI 5.15.0 + Emotion
- **Pattern**: Unbundled source components (no build step)
- **Dependencies**: Material-UI, Framer Motion, CodeMirror, workspace packages

## Key Features

### 🎨 UI Component Library
- **50+ Components**: Comprehensive set of Material-UI based components
- **Dialog System**: 20+ specialized dialog components for various use cases
- **Form Controls**: Input, dropdown, checkbox, slider, and switch components
- **Data Display**: Tables, cards, grids, and data visualization components
- **Navigation**: Layout components, routing guards, and menu systems

### 🎭 Theming System
- **Dark/Light Modes**: Complete theme switching support
- **Material-UI Integration**: Custom theme configurations with Material-UI
- **SCSS Variables**: Centralized color and styling variables
- **Component Overrides**: Consistent styling across all components

### 🔧 Utility Systems
- **Custom Hooks**: API calls, notifications, confirmations, and state management
- **Error Boundaries**: React error boundary components
- **Loading States**: Backdrop loaders, skeleton loading, and transition components
- **Code Editor**: CodeMirror integration with syntax highlighting

### 🏗️ Architecture Pattern
- **Source-Only Package**: No build step, components consumed directly from source
- **Granular Exports**: Fine-grained export paths for optimal tree shaking
- **Workspace Integration**: Uses modern `@universo/*` packages for APIs and i18n

## Installation & Setup

### Prerequisites
```bash
# Peer dependencies
React ^18.3.1
React DOM ^18.3.1
```

### Installation
```bash
# Install in workspace
pnpm install @flowise/template-mui

# No build needed - source-only package
```

### Basic Setup
```jsx
import { ThemeProvider } from '@mui/material/styles'
import { theme } from '@flowise/template-mui/themes'
import { MainCard, AnimateButton } from '@flowise/template-mui'

function App() {
  const customization = { isDarkMode: false, borderRadius: 12 }
  
  return (
    <ThemeProvider theme={theme(customization)}>
      <MainCard title="Example">
        <AnimateButton>Click me</AnimateButton>
      </MainCard>
    </ThemeProvider>
  )
}
```

## Component Categories

### Button Components
```jsx
import { 
  AnimateButton, 
  CopyToClipboardButton, 
  StyledButton,
  ThumbsUpButton,
  ThumbsDownButton 
} from '@flowise/template-mui'
```

### Dialog Components
```jsx
import { 
  ConfirmDialog, 
  SaveCanvasDialog, 
  AddEditCredentialDialog,
  ExpandTextDialog,
  NodeInfoDialog 
} from '@flowise/template-mui'
```

### Form Components
```jsx
import { 
  Input, 
  Dropdown, 
  MultiDropdown, 
  CheckboxInput, 
  SwitchInput,
  InputSlider 
} from '@flowise/template-mui'
```

### Layout Components
```jsx
import { 
  MainLayout, 
  MinimalLayout, 
  ViewHeaderMUI,
  AuthGuard 
} from '@flowise/template-mui'
```

### Data Display Components
```jsx
import { 
  DataGrid, 
  FlowListTable, 
  MainCard, 
  ItemCard,
  StatsCard 
} from '@flowise/template-mui'
```

## Custom Hooks

### API Hook
```jsx
import { useApi } from '@flowise/template-mui/hooks'

function MyComponent() {
  const api = useApi()
  
  const fetchData = async () => {
    const result = await api.get('/api/chatflows')
    return result.data
  }
}
```

### Notification Hook
```jsx
import { useNotifier } from '@flowise/template-mui/hooks'

function MyComponent() {
  const { enqueueSnackbar } = useNotifier()
  
  const showSuccess = () => {
    enqueueSnackbar({
      message: 'Success!',
      options: { variant: 'success' }
    })
  }
}
```

### Confirmation Hook
```jsx
import { useConfirm } from '@flowise/template-mui/hooks'

function MyComponent() {
  const { confirm } = useConfirm()
  
  const handleDelete = async () => {
    const result = await confirm({
      title: 'Delete Item',
      description: 'Are you sure?'
    })
    if (result) {
      // Delete logic
    }
  }
}
```

## Theming

### Theme Configuration
```jsx
import { theme } from '@flowise/template-mui/themes'

const customization = {
  isDarkMode: true,
  borderRadius: 8,
  fontFamily: 'Roboto',
  isOpen: false,
  opened: true
}

const customTheme = theme(customization)
```

### Custom Theme Colors
```scss
// Access SCSS variables
@import '~@flowise/template-mui/src/assets/scss/_themes-vars.module.scss';

.custom-component {
  background-color: $primary200;
  color: $grey900;
}
```

## Architecture

### Export Structure
```javascript
// Granular exports for tree shaking
'./hooks': './src/hooks/index.ts'
'./layout': './src/layout/index.js'
'./themes': './src/themes/index.js'
'./ui-components/*': './src/ui-components/*'
'./utils/*': './src/utils/*'
```

### Component Organization
```
src/
├── ui-components/          # Main component library
│   ├── button/            # Button variants
│   ├── dialog/            # Modal dialogs
│   ├── cards/             # Card components
│   ├── input/             # Form inputs
│   ├── table/             # Data tables
│   ├── loading/           # Loading states
│   └── ...
├── layout/                # Layout components
├── themes/                # Theme system
├── hooks/                 # Custom hooks
├── assets/                # Images, icons, styles
└── types/                 # TypeScript definitions
```

## File Structure

```
packages/flowise-template-mui/
├── base/                   # Package implementation
│   ├── src/
│   │   ├── ui-components/  # Main component library (15+ categories)
│   │   │   ├── button/     # Button components
│   │   │   ├── dialog/     # 20+ dialog components
│   │   │   ├── cards/      # Card components
│   │   │   ├── input/      # Form inputs
│   │   │   ├── table/      # Data tables
│   │   │   ├── loading/    # Loading components
│   │   │   ├── markdown/   # Markdown rendering
│   │   │   ├── editor/     # Code editor
│   │   │   └── ...         # And more categories
│   │   ├── layout/         # Layout components
│   │   │   ├── MainLayout/ # Main application layout
│   │   │   └── MinimalLayout/ # Minimal layout
│   │   ├── themes/         # Theme system
│   │   │   ├── palette.js  # Color palettes
│   │   │   ├── typography.js # Typography settings
│   │   │   └── compStyleOverride.js # Component overrides
│   │   ├── hooks/          # Custom hooks
│   │   │   ├── useApi.js   # API hook
│   │   │   ├── useNotifier.js # Notification hook
│   │   │   └── useConfirm.js  # Confirmation hook
│   │   ├── assets/         # Static assets
│   │   │   ├── images/     # Image assets
│   │   │   └── scss/       # SCSS theme variables
│   │   ├── routes/         # Route components
│   │   ├── menu-items/     # Menu configuration
│   │   ├── config.js       # Configuration
│   │   ├── constants.ts    # Constants
│   │   ├── ErrorBoundary.jsx # Error boundary
│   │   └── index.ts        # Main exports
│   ├── package.json
│   ├── tsconfig.json
│   └── LICENSE-Flowise.md
└── README.md              # This file
```

## Legacy Status & Migration Plan

### Current State (2024)
- ✅ **Functional**: Complete Material-UI component library
- ✅ **Integrated**: Used by `flowise-ui` and related legacy components
- ⚠️ **Frozen**: No new components, maintenance mode only
- ⚠️ **Unbundled**: Uses source-only pattern which may cause issues

### Migration Timeline
- **Q1 2025**: Assess modern component library alternatives
- **Q2 2025**: Begin migration to modern component solutions
- **Q3 2025**: Create modern component library in `@universo/ui` package
- **Q4 2025**: Deprecate legacy template usage
- **Q1 2026**: Complete migration to modern component library
- **Q2 2026**: Remove legacy template package

### Replacement Strategy
1. **Modern Component Library**: Replace with modern component system
2. **Design System**: Implement consistent design tokens and system
3. **TypeScript First**: Full TypeScript implementation
4. **Build Optimization**: Proper build system with tree shaking
5. **Performance**: Optimize bundle size and runtime performance

## Dependencies

### Core Dependencies
```json
{
  "@emotion/react": "^11.11.4",
  "@emotion/styled": "^11.11.5",
  "@mui/material": "5.15.0",
  "@mui/icons-material": "^5.0.3",
  "@mui/x-data-grid": "^5.17.26",
  "framer-motion": "^10.16.4"
}
```

### Workspace Dependencies
```json
{
  "@flowise/store": "workspace:*",
  "@universo/api-client": "workspace:*",
  "@universo/i18n": "workspace:*"
}
```

### Code Editor Dependencies
```json
{
  "@uiw/react-codemirror": "^4.23.0",
  "@uiw/codemirror-theme-sublime": "^4.23.0",
  "@uiw/codemirror-theme-vscode": "^4.23.0"
}
```

## Development

### Local Development
```bash
# Install dependencies
pnpm install

# Type checking
pnpm typecheck

# Linting
pnpm lint

# No build needed (source-only package)
echo 'No build needed for source-only package'
```

### Adding New Features (Legacy Package)
⚠️ **Important**: This is legacy code. New UI components should be developed in modern `@universo/*` packages when possible.

If you must add components to this legacy package:
1. Follow existing Material-UI patterns
2. Maintain backward compatibility
3. Add appropriate TypeScript definitions
4. Follow the existing export structure
5. Document migration path for new components

## Integration Points

### Legacy Package Integration
- **flowise-ui**: Primary consumer of all components
- **flowise-chatmessage**: Uses dialog and card components
- **flowise-store**: Integrates with hooks and state management

### Modern Package Integration
- **@universo/api-client**: Used by API hooks
- **@universo/i18n**: Used for internationalization
- **@universo/types**: Type definitions (if available)

## Known Limitations

1. **Unbundled Source**: Components consumed directly from source files
2. **Mixed File Extensions**: Inconsistent .js/.jsx/.ts/.tsx usage
3. **Large Bundle**: No proper tree shaking due to source pattern
4. **Material-UI Version**: Locked to specific MUI version
5. **Build Complexity**: Source pattern can cause build issues

## Migration Guide

### From Legacy Components
```jsx
// Old pattern (legacy)
import { MainCard } from '@flowise/template-mui'

// New pattern (future)
import { Card } from '@universo/ui'
```

### Component Mapping
- `MainCard` → `@universo/ui/Card`
- `AnimateButton` → `@universo/ui/Button`
- `ConfirmDialog` → `@universo/ui/Dialog`
- `Input` → `@universo/ui/TextField`

## Contributing

⚠️ **Legacy Package Notice**: This package is in maintenance mode. For new contributions:
1. Consider implementing UI components in modern `@universo/*` packages instead
2. Follow existing Material-UI patterns if changes are necessary
3. Maintain backward compatibility with existing consumers
4. Add proper TypeScript definitions for new components
5. Document migration path for any new UI elements

## License

SEE LICENSE IN LICENSE-Flowise.md - Apache License Version 2.0

---

**Migration Support**: If you need help migrating UI components from this legacy package to modern alternatives, please refer to the migration documentation or create an issue for guidance.