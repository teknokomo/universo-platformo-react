# @flowise/chatmessage

Reusable chat message components for Flowise platform.

## Features

- **ChatMessage** - Main chat component with streaming support
- **ChatPopUp** - Popup chat window
- **ChatExpandDialog** - Full-screen chat dialog
- **Audio Recording** - Voice message support
- **File Uploads** - Image and file attachment support
- **Chat History** - Input history navigation

## Usage

```javascript
import { ChatPopUp, ChatMessage, ChatExpandDialog } from '@flowise/chatmessage'

// Use in your component
<ChatPopUp canvasId={canvasId} isAgentCanvas={false} />
```

## Dependencies

Requires:
- `@flowise/template-mui` - UI components
- `@flowise/store` - Redux store
- `@universo/api-client` - API client
- `@universo/auth-frt` - Authentication
- `@universo/i18n` - Internationalization
- React 18+

## Components

### ChatPopUp
Floating chat button with popup message interface.

**Props:**
- `canvasId` - Canvas/Flow ID
- `isAgentCanvas` - Whether this is an agent canvas
- `unikId` - Unik identifier (optional)
- `spaceId` - Space identifier (optional)

### ChatMessage
Main chat interface with message history, streaming, and input.

**Props:**
- `canvasId` - Canvas/Flow ID
- `isDialog` - Whether rendered in dialog
- `isAgentCanvas` - Agent canvas flag
- `open` - Dialog open state
- `unikId` - Unik identifier (optional)
- `spaceId` - Space identifier (optional)
- `previews` - File previews array
- `setPreviews` - Set previews callback

### ChatExpandDialog
Full-screen dialog wrapper for ChatMessage.

**Props:**
- `show` - Show dialog
- `dialogProps` - Dialog properties
- `isAgentCanvas` - Agent canvas flag
- `onClear` - Clear chat callback
- `onCancel` - Cancel callback
- `previews` - File previews
- `setPreviews` - Set previews callback

## Development

This package is part of the Flowise monorepo and uses workspace dependencies.
