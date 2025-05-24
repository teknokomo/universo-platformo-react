# Publish Server (AR.js MVP)

Minimal server application for publishing AR.js spaces based on UPDL nodes, integrated with the main Flowise server.

## MVP Functionality

The module provides API for:

-   Publishing AR.js applications through UPDL space streaming generation
-   Extracting UPDL space data for AR.js rendering

## Project Structure (MVP)

```
apps/publish-srv/base/
└─ src/
   ├─ controllers/       # AR.js publication controllers
   ├─ routes/            # API routes
   ├─ interfaces/        # TypeScript interfaces for UPDL
   ├─ middlewares/       # Error handlers
   ├─ utils/             # Logger
   ├─ server.ts          # Route initialization
   └─ index.ts           # Entry point and exports
```

## REST API (MVP)

### Endpoints:

-   `POST /api/v1/publish/arjs` - Create AR.js publication (streaming generation)
-   `GET /api/v1/publish/arjs/public/:publicationId` - Get AR.js publication data
-   `GET /api/v1/publish/arjs/stream/:chatflowId` - Direct request to UPDL space

### Examples:

#### AR.js Publication:

```bash
POST /api/v1/publish/arjs
{
  "chatflowId": "778d565f-e9cc-4dd8-b8ef-7a097ecb18f3",
  "generationMode": "streaming",
  "isPublic": true,
  "projectName": "UPDL+AR.js"
}
```

#### Get Space Data:

```bash
GET /api/v1/publish/arjs/public/778d565f-e9cc-4dd8-b8ef-7a097ecb18f3
```

## Integration with Flowise

The module integrates with the main Flowise server:

1. Exports `initializePublishServer` function for adding routes
2. Uses `utilBuildUPDLflow` from the main server for space generation

## AR.js Publication Process

1. User creates Chatflow with UPDL nodes (Space, Object, etc.)
2. In the interface clicks "Publication and Export" → "AR.js" → "Make Public"
3. Gets a link in format `/p/:chatflowId`
4. At this link, frontend requests space data and displays AR.js application

## Demo Mode

Demo mode is implemented only on the frontend side (`ARJSPublisher.jsx` component) through `DEMO_MODE = true/false` constant. In demo mode, frontend doesn't send requests to API, but uses predefined links.

## Dependencies

-   **Main Flowise Server**: publication integrates with it
-   **`utilBuildUPDLflow` Function**: builds UPDL space from chatflow nodes

---

_Universo Platformo | AR.js Publisher_
