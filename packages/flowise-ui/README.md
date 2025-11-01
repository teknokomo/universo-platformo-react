# Flowise UI

🚨 **LEGACY CODE WARNING** 🚨  
This package is part of the legacy Flowise architecture and is scheduled for removal/refactoring after the Universo Platformo migration is complete (estimated Q2 2026). New features should be developed in the modern `@universo/*` packages instead.

## Overview

The main React frontend application for the Universo Platformo visual programming interface, providing a comprehensive web-based UI for building, managing, and deploying AI workflows. This is the primary user interface that integrates all Flowise functionality with modern Universo features.

## Package Information

- **Package**: `flowise-ui`
- **Version**: `2.2.8` (frozen legacy version)
- **Type**: React Frontend Application (Legacy)
- **Framework**: React 18 + Vite + Material-UI + React Flow
- **Pattern**: Main application that consumes all other packages
- **Build System**: Vite with 8GB memory allocation

## Key Features

### 🎨 Visual Programming Interface
- **React Flow Canvas**: Drag-and-drop node-based visual programming
- **200+ AI Node Components**: Complete library of LangChain and AI integration nodes
- **Real-time Execution**: Live workflow execution with streaming results
- **Template System**: Reusable workflow templates and marketplace integration

### 🏗️ Application Architecture
- **Multi-View Interface**: Canvas editor, chatbot testing, credentials management
- **Component Integration**: Uses `@flowise/template-mui` for all UI components
- **State Management**: Redux integration via `@flowise/store`
- **Modern Package Integration**: Incorporates all `@universo/*` packages

### 🌐 Universo Platform Features
- **Authentication**: Modern auth system via `@universo/auth-frt`
- **Spaces**: Workspace management via `@universo/spaces-frt`
- **Publishing**: Content publishing via `@universo/publish-frt`
- **Metaverses**: Virtual world integration via `@universo/metaverses-frt`
- **Space Builder**: 3D space creation via `@universo/space-builder-frt`
- **Templates**: Quiz and interactive templates

### 🔧 Development Features
- **Hot Reloading**: Vite-powered development server
- **TypeScript Support**: Mixed JS/TS with gradual migration
- **Internationalization**: Multi-language support via `@universo/i18n`
- **API Integration**: Centralized API client via `@universo/api-client`

## Installation & Setup

### Prerequisites
```bash
# System requirements
Node.js >= 18.0.0
PNPM >= 8.0.0
8GB+ RAM (for build process)
```

### Development Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Clean build artifacts
pnpm clean
```

### Environment Configuration
```bash
# Copy example environment
cp .env.example .env.local

# Configure environment variables
VITE_PORT=3000
VITE_API_BASE_URL=http://localhost:3001
# Add other configuration as needed
```

## Architecture

### Application Structure
```
src/
├── views/                  # Main application views
│   ├── canvas/            # Visual flow editor
│   ├── chatbot/           # Chat interface
│   ├── credentials/       # API credentials management
│   ├── agentflows/        # AI agent workflows
│   ├── publish/           # Publishing interface
│   ├── up-auth/           # Authentication views
│   ├── up-admin/          # Admin interface
│   └── ...
├── components/            # Shared components
├── api/                   # API integration layer
├── config/                # Configuration
├── shims/                 # Compatibility shims
└── App.jsx                # Main application component
```

### Package Integration
- **UI Components**: `@flowise/template-mui` - Complete Material-UI library
- **State Management**: `@flowise/store` - Redux store configuration
- **Node Components**: `flowise-components` - AI workflow nodes
- **Modern Features**: All `@universo/*` packages for new functionality

### Build Configuration
```javascript
// vite.config.js - Optimized for large-scale application
{
  build: {
    rollupOptions: {
      output: {
        manualChunks: { /* optimized chunking */ }
      }
    }
  }
}
```

## Views & Features

### Canvas Editor (`/canvas`)
- Visual workflow editor with React Flow
- Drag-and-drop node placement
- Real-time connection validation
- Workflow execution and testing

### Chatbot Interface (`/chatbot`)
- Interactive chat testing
- Conversation history
- Message feedback system
- Streaming response handling

### Credentials Management (`/credentials`)
- API key management
- Service authentication
- Secure credential storage
- Integration testing

### Publishing Platform (`/publish`)
- Content creation and management
- Publication workflow
- Template system integration

### Administrative Interface (`/up-admin`)
- User management
- System configuration
- Analytics and monitoring

## API Integration

### useApi Hook Pattern
```javascript
import { useApi } from '@flowise/template-mui/hooks'

function MyComponent() {
  const { request } = useApi(fetchList)
  
  useEffect(() => {
    request()
  }, [request])
}
```

### API Client Integration
```javascript
import { useApiClient } from '@universo/api-client'

function DataComponent() {
  const api = useApiClient()
  
  const fetchData = async () => {
    const response = await api.get('/api/chatflows')
    return response.data
  }
}
```

## File Structure

```
packages/flowise-ui/
├── public/                 # Static assets
├── src/
│   ├── views/             # Application views (15+ modules)
│   │   ├── canvas/        # Visual flow editor
│   │   ├── chatbot/       # Chat interface
│   │   ├── credentials/   # Credentials management
│   │   ├── agentflows/    # Agent workflows
│   │   ├── assistants/    # AI assistants
│   │   ├── docstore/      # Document storage
│   │   ├── marketplaces/  # Template marketplace
│   │   ├── publish/       # Publishing platform
│   │   ├── settings/      # Application settings
│   │   ├── tools/         # Tool management
│   │   ├── up-admin/      # Admin interface
│   │   ├── up-auth/       # Authentication
│   │   └── variables/     # Variable management
│   ├── components/        # Shared components
│   │   └── BootstrapErrorBoundary.jsx
│   ├── api/              # API integration
│   ├── config/           # Configuration
│   ├── diagnostics/      # Debug utilities
│   ├── shims/            # Compatibility layers
│   ├── App.jsx           # Main application
│   └── index.jsx         # Application entry point
├── .env.example          # Environment template
├── vite.config.js        # Vite configuration
├── package.json
├── README.md             # This file
└── LICENSE-Flowise.md
```

## Legacy Status & Migration Plan

### Current State (2024)
- ✅ **Functional**: Complete working React application
- ✅ **Integrated**: Successfully incorporates all modern `@universo/*` packages
- ✅ **Maintained**: Active development with modern feature integration
- ⚠️ **Mixed Architecture**: Combines legacy Flowise with modern Universo features

### Migration Timeline
- **Q1 2025**: Complete integration of remaining `@universo/*` packages
- **Q2 2025**: Begin gradual migration away from legacy Flowise components
- **Q3 2025**: Create new modern UI application structure
- **Q4 2025**: Deprecate legacy views and components
- **Q1 2026**: Launch new modern UI application
- **Q2 2026**: Complete migration and retire legacy UI

### Replacement Strategy
1. **Modern UI Framework**: New React application with modern architecture
2. **Component Migration**: Gradual replacement of legacy components
3. **View Modernization**: Rebuild views with modern design system
4. **Performance Optimization**: Optimize bundle size and runtime performance
5. **Developer Experience**: Improve development workflow and tooling

## Dependencies

### Core React Dependencies
```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "react-router-dom": "~6.3.0",
  "react-redux": "^8.0.5"
}
```

### Material-UI Dependencies
```json
{
  "@mui/material": "5.15.0",
  "@mui/icons-material": "5.0.3",
  "@mui/x-data-grid": "6.8.0"
}
```

### Modern Universo Packages
```json
{
  "@universo/auth-frt": "workspace:*",
  "@universo/api-client": "workspace:*",
  "@universo/i18n": "workspace:*",
  "@universo/spaces-frt": "workspace:*",
  "@universo/publish-frt": "workspace:*"
}
```

### Legacy Flowise Packages
```json
{
  "@flowise/store": "workspace:*",
  "@flowise/template-mui": "workspace:*"
}
```

## Development

### Development Server
```bash
# Start development server
pnpm dev

# Server will start at http://localhost:3000
# Hot reloading enabled
```

### Build Process
```bash
# Production build (requires 8GB RAM)
NODE_OPTIONS='--max-old-space-size=8192' pnpm build

# Build outputs to build/ directory
# Optimized for production deployment
```

### Adding New Features
⚠️ **Development Guidelines**:
1. **Prefer Modern Packages**: Use `@universo/*` packages for new features
2. **Component Reuse**: Utilize `@flowise/template-mui` components when possible
3. **State Management**: Use Redux store via `@flowise/store`
4. **API Integration**: Use `@universo/api-client` for backend communication
5. **Internationalization**: Support multiple languages via `@universo/i18n`

## Integration Points

### Modern Package Integration
- **Authentication**: `@universo/auth-frt` for login/logout flows
- **API Client**: `@universo/api-client` for backend communication
- **Internationalization**: `@universo/i18n` for multi-language support
- **Spaces**: `@universo/spaces-frt` for workspace management
- **Publishing**: `@universo/publish-frt` for content creation

### Legacy Package Dependencies
- **UI Library**: `@flowise/template-mui` for all UI components
- **State Store**: `@flowise/store` for Redux state management
- **Node System**: Direct integration with `flowise-components`

## Performance Considerations

### Build Optimization
- **Memory Allocation**: 8GB heap size for complex builds
- **Code Splitting**: Vite-based chunk optimization
- **Bundle Analysis**: Regular bundle size monitoring
- **Tree Shaking**: Optimized imports for smaller bundles

### Runtime Performance
- **React Query**: Caching and data synchronization
- **Virtualization**: Large list handling in data grids
- **Lazy Loading**: Route-based code splitting
- **Memoization**: Component and calculation optimization

## Known Limitations

1. **Large Bundle Size**: Complex application with many dependencies
2. **Mixed Architecture**: Legacy and modern code coexistence
3. **Memory Requirements**: High memory usage during build
4. **Component Complexity**: Deep component hierarchy
5. **Legacy Dependencies**: Reliance on legacy Flowise packages

## Contributing

🔄 **Active Development**: This package is actively developed but with migration planning:
1. **New Features**: Should integrate modern `@universo/*` packages
2. **Legacy Code**: Maintain compatibility with existing functionality
3. **Migration Preparation**: Document and plan for future migration
4. **Performance**: Monitor and optimize application performance
5. **Modern Patterns**: Use modern React patterns for new code

## License

SEE LICENSE IN LICENSE-Flowise.md - Apache License Version 2.0

---

**Migration Support**: This UI application is the primary integration point for the entire platform. Migration planning is crucial for maintaining functionality while modernizing the architecture.
