# Flowise Chat Message Components (Legacy) 🏗️

> **⚠️ Legacy Package Notice**  
> This is a **legacy Flowise package** that will be **phased out and removed** as part of Universo Platformo's architecture modernization. The chat functionality is being refactored into a new, more scalable architecture using modern design patterns.
>
> **Migration Timeline**: This package is planned for removal after Q2 2026 when the new chat system is fully implemented.  
> **New Architecture**: Modern chat components will be built as standalone `@universo/chat-*` packages with improved TypeScript support, better performance, and cleaner API design.

## Overview

Legacy chat message components for the original Flowise platform, providing real-time chat interface with AI streaming, file uploads, and voice recording capabilities. Built with Material-UI and Redux for state management.

## Current Features

- **ChatMessage** - Main chat component with streaming AI responses
- **ChatPopUp** - Floating popup chat window  
- **ChatExpandDialog** - Full-screen chat dialog
- **Audio Recording** - Voice message recording and playback
- **File Uploads** - Image and document attachment support
- **Chat History** - Input history navigation with up/down arrows
- **Streaming Support** - Real-time AI response streaming via Server-Sent Events
- **Markdown Rendering** - Rich text formatting with LaTeX math support

## Legacy Architecture

### Technology Stack
- **React 18+** with hooks and functional components
- **Material-UI 5.15.0** for UI components and theming
- **Redux + React-Redux** for global state management  
- **Server-Sent Events** via `@microsoft/fetch-event-source` for streaming
- **React Markdown** with LaTeX support (rehype-mathjax, remark-math)
- **Audio Recording** via native MediaRecorder API

### Dependencies
- `@flowise/template-mui` - Legacy UI component library (also being phased out)
- `@flowise/store` - Legacy Redux store (being replaced)
- `@universo/api-client` - Modern API client (will remain)
- `@universo/auth-frontend` - Modern authentication (will remain)
- `@universo/i18n` - Modern internationalization (will remain)

## Current Usage (Legacy)

```javascript
import { ChatPopUp, ChatMessage, ChatExpandDialog } from '@flowise/chatmessage'

// Floating chat popup
<ChatPopUp 
    canvasId={canvasId} 
    isAgentCanvas={false} 
    unikId={unikId}
    spaceId={spaceId} 
/>

// Embedded chat component  
<ChatMessage
    canvasId={canvasId}
    isDialog={false}
    isAgentCanvas={false}
    previews={previews}
    setPreviews={setPreviews}
/>

// Full-screen chat dialog
<ChatExpandDialog
    show={showDialog}
    dialogProps={dialogProps}
    isAgentCanvas={false}
    onClear={handleClear}
    onCancel={handleCancel}
    previews={previews}
    setPreviews={setPreviews}
/>
```

## Component Reference

### ChatPopUp
Floating action button that opens a popup chat interface.

**Key Props:**
- `canvasId: string` - AI Canvas/Flow identifier 
- `isAgentCanvas: boolean` - Determines agent-specific behavior
- `unikId?: string` - Workspace identifier (optional)
- `spaceId?: string` - Space identifier (optional)

**Features:**
- Floating action button with chat icon
- Click-away listener for auto-close
- Popup positioning and transitions
- Clear chat history functionality
- Expand to full-screen dialog

### ChatMessage  
Core chat interface component with full conversation UI.

**Key Props:**
- `canvasId: string` - AI Canvas/Flow identifier
- `isDialog?: boolean` - Renders differently in dialogs vs embedded
- `isAgentCanvas: boolean` - Agent-specific UI variations
- `previews: FilePreview[]` - File attachment previews
- `setPreviews: (previews: FilePreview[]) => void` - File preview state setter

**Features:**
- Message history with user/AI avatars
- Real-time streaming responses with typing indicators
- File upload (images, documents) with preview
- Audio recording with playback controls  
- Message copy/download functionality
- LaTeX math rendering in messages
- Input history navigation (up/down arrows)
- Regenerate response capability
- Agent avatar support (supervisor/worker modes)

### ChatExpandDialog
Material-UI Dialog wrapper for full-screen chat experience.

**Key Props:**
- `show: boolean` - Dialog visibility state
- `dialogProps: object` - Additional Material-UI Dialog props
- `onClear: () => void` - Clear chat history callback
- `onCancel: () => void` - Close dialog callback
- All ChatMessage props passed through

**Features:**
- Full-screen responsive dialog  
- Header with clear and expand actions
- Embedded ChatMessage component
- Proper dialog lifecycle management

## Legacy Technical Details

### State Management (Redux)
```javascript
// Global chat state stored in @flowise/store
const chatState = {
    messages: [], // Chat message history
    loading: false, // Streaming state
    error: null // Error state
}
```

### API Integration
```javascript
// Uses @universo/api-client for HTTP requests
// Server-Sent Events for streaming responses
import { fetchEventSource } from '@microsoft/fetch-event-source'

// Streaming endpoint pattern
const streamUrl = `/api/v1/prediction/${canvasId}`
```

### File Upload System
```javascript
// File preview structure
interface FilePreview {
    data: string // Base64 data
    type: string // MIME type  
    name: string // Original filename
    size: number // File size in bytes
}
```

### Audio Recording
```javascript
// Native MediaRecorder integration
const mediaRecorder = new MediaRecorder(stream)
// Saves as WebM/OGG format
// Converts to base64 for API transmission
```

## Migration Strategy

### Phase 1: Analysis & Planning (Q1 2026)
- [ ] **Audit Current Usage**: Map all ChatMessage component usages across codebase
- [ ] **API Dependency Mapping**: Document all chat-related API endpoints
- [ ] **State Management Analysis**: Identify Redux state dependencies
- [ ] **Feature Requirements**: Define new chat system requirements

### Phase 2: Modern Architecture Design (Q1 2026)  
- [ ] **New Package Structure**: Design `@universo/chat-*` package architecture
- [ ] **TypeScript-First**: Define strict interfaces and types
- [ ] **State Management**: Replace Redux with React Context + useReducer
- [ ] **API Layer**: Design new chat API with better error handling
- [ ] **Component API**: Design cleaner, more composable component interfaces

### Phase 3: Implementation (Q2 2026)
- [ ] **Core Chat Engine**: Build new streaming chat engine
- [ ] **UI Components**: Implement modern chat components with better accessibility
- [ ] **File Upload**: Redesign file handling with better performance
- [ ] **Audio System**: Implement new audio recording with format options

### Phase 4: Migration & Cleanup (Q2 2026)
- [ ] **Gradual Migration**: Replace ChatMessage usage one module at a time
- [ ] **Testing**: Comprehensive testing of new vs old behavior  
- [ ] **Documentation**: Complete migration guide and new API docs
- [ ] **Package Removal**: Remove @flowise/chatmessage from codebase

## Development (Current)

### Prerequisites
- Node.js 18+
- PNPM workspace environment
- Access to legacy Flowise dependencies

### Commands
```bash
# Build package (dual CJS/ESM output)
pnpm --filter @flowise/chatmessage build

# Development mode with watch
pnpm --filter @flowise/chatmessage dev

# Clean build artifacts
pnpm --filter @flowise/chatmessage clean
```

### File Structure
```
src/
├── components/
│   ├── ChatMessage.jsx        # Main chat component (2659 lines)
│   ├── ChatPopUp.jsx          # Popup wrapper (248 lines)  
│   ├── ChatExpandDialog.jsx   # Dialog wrapper
│   ├── ChatInputHistory.js    # Input history utility
│   ├── audio-recording.js     # Audio recording logic
│   ├── ChatMessage.css        # Chat-specific styles
│   └── audio-recording.css    # Audio UI styles
└── index.js                   # Package exports
```

## Known Issues & Limitations

### Performance Issues
- **Large Message History**: Performance degrades with 100+ messages
- **File Upload Memory**: Large files can cause memory spikes
- **Redux Store Bloat**: Chat state grows without cleanup

### Technical Debt
- **Legacy Code**: Mixed JavaScript/JSX without TypeScript
- **Monolithic Components**: ChatMessage.jsx is 2659 lines (too large)
- **Inline Styles**: Mix of CSS files and sx props creates inconsistency
- **Error Handling**: Insufficient error boundaries and recovery

### Browser Compatibility
- **Audio Recording**: MediaRecorder not supported in older browsers
- **File Upload**: Large file handling varies by browser
- **Streaming**: Server-Sent Events require modern browser support

## Related Documentation

- [Flowise Store (Legacy)](../flowise-store/README.md)
- [Flowise Template MUI (Legacy)](../flowise-template-mui/README.md)
- [API Client (Modern)](../universo-api-client/README.md)
- [Authentication (Modern)](../auth-frontend/base/README.md)
- [Architecture Roadmap](../../docs/en/roadmap/README.md)

---

**Universo Platformo | Legacy Chat Components**  
*⚠️ Scheduled for replacement with modern @universo/chat-* packages*
