# Chatbot Publication with Canvas

## Overview

The chatbot publication functionality has been updated to work with the new Canvas structure instead of the legacy Canvas structure. This document describes how chatbot publication works with Canvas and the migration from Canvas.

## Architecture Changes

### From Canvas to Canvas

- **Legacy**: Chatbots were published using `canvasId` from the `chat_flow` table
- **Current**: Chatbots are published using `canvasId` from the `canvases` table
- **Compatibility**: New endpoints expect `canvasId`; legacy `canvasId` parameters are deprecated

### Entity Mapping

The `Canvas` entity now maps to the `canvases` table:

```typescript
@Entity('canvases') // Refactored: Canvas now maps to canvases table
export class Canvas implements ICanvas {
    // ... entity fields
    @Column({ nullable: true, type: 'text' })
    chatbotConfig?: string
    // ... other fields
}
```

## Chatbot Configuration

### Configuration Structure

Chatbot configuration is stored in the `chatbotConfig` field of a Canvas as a JSON string:

```json
{
    "botType": "chat",
    "title": "My Chat Bot",
    "backgroundColor": "#ffffff",
    "textColor": "#303235",
    "allowedOrigins": ["https://example.com"],
    "allowedOriginsError": "This site is not allowed to access this chatbot"
}
```

### Configuration Fields

- `botType`: Type of bot (always "chat" for chatbots)
- `title`: Display title for the chatbot
- `backgroundColor`: Background color for the chat interface
- `textColor`: Text color for the chat interface
- `allowedOrigins`: Array of allowed domains for CORS
- `allowedOriginsError`: Custom error message for unauthorized origins

## API Endpoints

### Bot Configuration

```
GET /api/v1/bots/:canvasId/config
```

Returns the chatbot configuration for the specified canvas.

### Bot Rendering

```
GET /api/v1/bots/:canvasId
```

Renders the chatbot interface for the specified canvas.

### Bot Streaming

```
GET /api/v1/bots/:canvasId/stream/:sessionId?
```

Provides streaming chat functionality for the specified canvas.

## Publication System Integration

### Publish Service

The publication service (`packages/publish-backend`) supports both Canvas and legacy Canvas IDs:

```typescript
// New Canvas-based publication
POST /publish/canvas
{
    "canvasId": "uuid-of-canvas",
    "generationMode": "streaming",
    "isPublic": true,
    "projectName": "My Chatbot"
}

// Legacy Canvas support (deprecated)
POST /publish/arjs
{
    "canvasId": "uuid-of-canvas"
    "generationMode": "streaming",
    "isPublic": true,
    "projectName": "My Chatbot"
}
```

### Public URLs

Published chatbots are accessible via:

- **New format**: `/publish/canvas/public/:canvasId`
- **Legacy format**: `/publish/arjs/public/:publicationId` (redirects to new format)

## Migration Considerations

### Backward Compatibility

The system maintains backward compatibility by:

1. **Entity Mapping**: `Canvas` entity maps to `canvases` table
2. **ID Compatibility**: Canvas IDs are used where Canvas IDs were previously used
3. **API Support**: Public APIs now accept `canvasId` parameters
4. **URL Redirects**: Legacy URLs redirect to new Canvas-based URLs

### Data Migration

When migrating from Canvas to Canvas:

1. Each Canvas becomes a Canvas with the same ID
2. The `chatbotConfig` field is preserved as-is
3. All bot configurations continue to work without changes
4. Existing published bots remain accessible

## Testing

### Unit Tests

Test chatbot functionality with:

```bash
npm test -- chatbot-publication.test.ts
```

### Integration Testing

1. Create a Canvas with chatbot configuration
2. Verify bot configuration retrieval
3. Test bot rendering and streaming
4. Validate CORS and security settings

## Security Considerations

### Origin Validation

Chatbots validate allowed origins from the `chatbotConfig`:

```typescript
if (canvas.chatbotConfig) {
    const parsedConfig = JSON.parse(canvas.chatbotConfig)
    const isValidAllowedOrigins = parsedConfig.allowedOrigins?.length && parsedConfig.allowedOrigins[0] !== ''
    // ... origin validation logic
}
```

### Access Control

- Bots require proper authentication through the Universo Platformo system
- Canvas-level permissions apply to chatbot access
- Public bots respect the `isPublic` flag on the Canvas

## Best Practices

1. **Configuration Validation**: Always validate `chatbotConfig` JSON before parsing
2. **Error Handling**: Provide meaningful error messages for configuration issues
3. **Security**: Set appropriate `allowedOrigins` for production deployments
4. **Testing**: Test chatbot functionality after Canvas updates
5. **Monitoring**: Monitor chatbot usage and performance metrics

## Troubleshooting

### Common Issues

1. **Bot Not Found**: Verify Canvas exists and has `chatbotConfig` set
2. **CORS Errors**: Check `allowedOrigins` in `chatbotConfig`
3. **Configuration Errors**: Validate JSON structure in `chatbotConfig`
4. **Streaming Issues**: Ensure Canvas is marked as `deployed` and `isPublic`

### Debug Steps

1. Check Canvas exists: `SELECT * FROM canvases WHERE id = 'canvas-id'`
2. Validate configuration: Parse `chatbotConfig` JSON
3. Test bot endpoints: Use API testing tools
4. Check logs: Review server logs for error details
