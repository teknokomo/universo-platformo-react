# Flowise Store

🚨 **LEGACY CODE WARNING** 🚨  
This package is part of the legacy Flowise architecture and is scheduled for removal/refactoring after the Universo Platformo migration is complete (estimated Q2 2026). New features should be developed in the modern `@universo/*` packages instead.

## Overview

Shared Redux store configuration for Flowise applications, providing centralized state management across the legacy Flowise UI ecosystem. This package manages application-wide state including canvas data, customization settings, notifications, and dialog states.

## Package Information

- **Package**: `@universo/store`
- **Version**: `0.1.0` (legacy version)
- **Type**: Redux Store Library (Legacy)
- **Framework**: Redux + React Context API
- **Dependencies**: Redux 5.0.1, React Redux peer dependency
- **Build System**: tsdown (TypeScript + ESM output)

## Key Features

### 🏪 Store Management
- **Redux Store**: Centralized state management with Redux
- **Combined Reducers**: Modular reducer architecture
- **Context Providers**: React Context integration for complex operations
- **Action Creators**: Type-safe action creators for state updates

### 🎨 State Domains
- **Canvas State**: Flow editor state and dirty tracking
- **Customization State**: UI theme and layout preferences  
- **Notification State**: Snackbar and alert management
- **Dialog State**: Modal and confirmation dialog state

### ⚛️ React Integration
- **React Flow Context**: Advanced flow operations (duplicate, delete nodes/edges)
- **Confirm Context**: Modal confirmation dialog management
- **Redux Provider**: Store integration with React components

## Store Structure

### Canvas Reducer
```javascript
// Canvas state management
{
  isDirty: false,              // Track unsaved changes
  currentCanvas: null,         // Active canvas data
  canvasDialogShow: false,     // Dialog visibility state
  componentNodes: [],          // Available node components
  componentCredentials: []     // Node credential configurations
}
```

### Customization Reducer
```javascript
// UI customization state
{
  isOpen: false,              // Menu state
  fontFamily: 'Roboto',       // Typography
  borderRadius: 12,           // UI border radius
  opened: true,               // Initial menu state
  darkMode: false            // Theme preference
}
```

### Notification System
```javascript
// Snackbar notification management
{
  notifications: []           // Queue of active notifications
}
```

## Installation & Setup

### Prerequisites
```bash
# Peer dependencies required
React ^18.3.1
React Redux ^9.1.0
```

### Installation
```bash
# Install in workspace
pnpm install @universo/store

# Build the package
pnpm build
```

## Usage

### Basic Store Setup
```jsx
import { store } from '@universo/store'
import { Provider } from 'react-redux'

function App() {
  return (
    <Provider store={store}>
      <YourComponents />
    </Provider>
  )
}
```

### Using Context Providers
```jsx
import { ReactFlowContext, ConfirmContextProvider } from '@universo/store'

function FlowEditor() {
  return (
    <ReactFlowContext>
      <ConfirmContextProvider>
        <FlowCanvas />
      </ConfirmContextProvider>
    </ReactFlowContext>
  )
}
```

### Dispatching Actions
```jsx
import { useDispatch } from 'react-redux'
import { SET_CANVAS, SET_DIRTY } from '@universo/store'

function CanvasComponent() {
  const dispatch = useDispatch()
  
  const updateCanvas = (canvasData) => {
    dispatch({ type: SET_CANVAS, canvas: canvasData })
    dispatch({ type: SET_DIRTY })
  }
}
```

### Using React Flow Context
```jsx
import { useContext } from 'react'
import { flowContext } from '@universo/store'

function FlowToolbar() {
  const { duplicateNode, deleteNode } = useContext(flowContext)
  
  const handleDuplicate = (nodeId) => {
    duplicateNode(nodeId)
  }
}
```

## Architecture

### Store Configuration
- **Store Creation**: Basic Redux store with combined reducers
- **No Middleware**: Simple store without Redux Toolkit or middleware
- **Persistence**: Basic persister configuration (set to 'Free')

### Reducer Structure
```
reducers/
├── canvasReducer.js       # Canvas and flow state
├── customizationReducer.js # UI preferences
├── dialogReducer.js       # Modal dialogs
└── notifierReducer.js     # Notifications
```

### Context Architecture
```
context/
├── ReactFlowContext.jsx   # Flow operations
├── ConfirmContext.jsx     # Confirmation dialogs
└── ConfirmContextProvider.jsx # Dialog provider
```

## Action Types

### Canvas Actions
```javascript
SET_DIRTY                    // Mark canvas as modified
REMOVE_DIRTY                 // Mark canvas as saved
SET_CANVAS                   // Update current canvas
SHOW_CANVAS_DIALOG          // Show canvas dialog
HIDE_CANVAS_DIALOG          // Hide canvas dialog
SET_COMPONENT_NODES         // Update available nodes
SET_COMPONENT_CREDENTIALS   // Update credentials
```

### Customization Actions
```javascript
SET_MENU                    // Set menu state
MENU_TOGGLE                 // Toggle menu
MENU_OPEN                   // Open menu
SET_FONT_FAMILY            // Update typography
SET_BORDER_RADIUS          // Update border radius
SET_LAYOUT                 // Update layout
SET_DARKMODE               // Toggle dark mode
```

### Notification Actions
```javascript
ENQUEUE_SNACKBAR           // Add notification
CLOSE_SNACKBAR             // Close notification
REMOVE_SNACKBAR            // Remove notification
```

## File Structure

```
packages/flowise-store/
├── base/                   # Package implementation
│   ├── src/
│   │   ├── actions.js      # Action types and creators
│   │   ├── reducer.jsx     # Combined reducers
│   │   ├── index.jsx       # Store creation
│   │   ├── index.ts        # TypeScript exports
│   │   ├── constant.js     # Constants
│   │   ├── config.js       # Configuration
│   │   ├── context/        # React contexts
│   │   │   ├── ReactFlowContext.jsx
│   │   │   ├── ConfirmContext.jsx
│   │   │   └── ConfirmContextProvider.jsx
│   │   └── reducers/       # Individual reducers
│   │       ├── canvasReducer.js
│   │       ├── customizationReducer.js
│   │       ├── dialogReducer.js
│   │       └── notifierReducer.js
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsdown.config.ts    # Build configuration
│   └── LICENSE-Flowise.md
└── README.md              # This file
```

## Legacy Status & Migration Plan

### Current State (2024)
- ✅ **Functional**: Operational Redux store for legacy Flowise UI
- ✅ **Integrated**: Used by `flowise-ui` and related components
- ⚠️ **Frozen**: No new features, maintenance mode only
- ⚠️ **Outdated**: Uses legacy Redux patterns without Redux Toolkit

### Migration Timeline
- **Q1 2025**: Assess modern state management alternatives
- **Q2 2025**: Begin migration to modern state solutions
- **Q3 2025**: Create modern state management in `@universo/*` packages
- **Q4 2025**: Deprecate legacy store usage
- **Q1 2026**: Complete migration to modern state management
- **Q2 2026**: Remove legacy store package

### Replacement Strategy
1. **Modern State Management**: Replace with Redux Toolkit or Zustand
2. **Context Optimization**: Migrate React contexts to modern patterns
3. **TypeScript Migration**: Full TypeScript implementation
4. **Performance**: Implement state normalization and selectors
5. **Developer Experience**: Add DevTools integration and better debugging

## Dependencies

### Core Dependencies
```json
{
  "redux": "^5.0.1"
}
```

### Peer Dependencies
```json
{
  "react": "^18.3.1",
  "react-redux": "^9.1.0"
}
```

### Dev Dependencies
```json
{
  "tsdown": "^0.15.7",
  "typescript": "^5.8.3"
}
```

## Development

### Local Development
```bash
# Install dependencies
pnpm install

# Build in development mode
pnpm dev

# Build for production
pnpm build

# Clean build artifacts
pnpm clean
```

### Adding New Features (Legacy Package)
⚠️ **Important**: This is legacy code. New state management should be implemented in modern `@universo/*` packages when possible.

If you must modify this legacy package:
1. Follow existing Redux patterns
2. Maintain backward compatibility
3. Add appropriate deprecation notices
4. Document migration path for new state

## Integration Points

### Legacy Package Integration
- **flowise-ui**: Primary consumer of the store
- **flowise-chatmessage**: Uses notification system
- **flowise-template-mui**: May use customization state

### Modern Package Considerations
- **Future Integration**: Will be replaced by modern state management
- **Migration Path**: Gradual transition to new state patterns
- **Compatibility**: Ensure smooth migration for dependent packages

## Known Limitations

1. **No Redux Toolkit**: Uses legacy Redux patterns
2. **Mixed JS/JSX**: Inconsistent file extensions
3. **Basic Store**: No middleware or advanced Redux features
4. **Limited TypeScript**: Partial TypeScript implementation
5. **No Persistence**: Mock persister configuration

## Contributing

⚠️ **Legacy Package Notice**: This package is in maintenance mode. For new contributions:
1. Consider implementing state management in modern `@universo/*` packages instead
2. Follow existing Redux patterns if changes are necessary
3. Maintain backward compatibility with existing consumers
4. Document migration path for any new state requirements

## License

SEE LICENSE IN LICENSE-Flowise.md - Apache License Version 2.0

---

**Migration Support**: If you need help migrating state management from this legacy package to modern alternatives, please refer to the migration documentation or create an issue for guidance.