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

## Integration with Main Flowise Server

**Critical**: This publish server is integrated directly into the main Flowise server for optimal performance and resource sharing:

### Static Libraries Service

The main Flowise server (`packages/server/src/index.ts`) serves static AR.js libraries directly:

```typescript
// Main Flowise server configuration
const publishFrtAssetsPath = path.join(__dirname, '../../../apps/publish-frt/base/dist/assets')
this.app.use('/assets', express.static(publishFrtAssetsPath))
```

#### Benefits:

-   **Single Server Architecture**: No separate static file server needed
-   **CDN Blocking Solution**: Local libraries accessible when external CDNs are blocked
-   **Performance**: Direct serving from main Flowise instance
-   **Maintenance**: Libraries bundled with frontend distribution

#### Library Paths:

-   **A-Frame**: `/assets/libs/aframe/1.7.1/aframe.min.js`
-   **AR.js**: `/assets/libs/arjs/3.4.7/aframe-ar.js`
-   **Source**: Served from `apps/publish-frt/base/dist/assets/libs/`

### Server Integration Points

1. **Route Registration**: Publication routes added to main Flowise server via `initializePublishServer()`
2. **Database Access**: Uses main Flowise database connection through `utilBuildUPDLflow`
3. **Authentication**: Inherits main server's authentication middleware
4. **Static Assets**: AR.js libraries served through main server's static file handler
5. **Logging**: Integrated with main server's logging system

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
  "projectName": "UPDL+AR.js",
  "libraryConfig": {
    "arjs": { "version": "3.4.7", "source": "kiberplano" },
    "aframe": { "version": "1.7.1", "source": "official" }
  }
}
```

#### Get Space Data:

```bash
GET /api/v1/publish/arjs/public/778d565f-e9cc-4dd8-b8ef-7a097ecb18f3
```

Returns:

```json
{
    "success": true,
    "updlSpace": {
        /* UPDL space data */
    },
    "libraryConfig": {
        "arjs": { "version": "3.4.7", "source": "kiberplano" },
        "aframe": { "version": "1.7.1", "source": "official" }
    }
}
```

## Integration with Flowise

The module integrates seamlessly with the main Flowise server:

1. **Route Registration**: Exports `initializePublishServer` function for adding routes to main server
2. **Database Integration**: Uses `utilBuildUPDLflow` from the main server for space generation
3. **Library Configuration**: Returns `libraryConfig` from chatflow's `chatbotConfig` for user-selected library sources
4. **Static File Serving**: Main server handles static AR.js library files through `/assets` route

## AR.js Publication Process

1. User creates Chatflow with UPDL nodes (Space, Object, etc.)
2. In the interface, user configures library sources (official CDN vs local Kiberplano server)
3. User clicks "Publication and Export" → "AR.js" → "Make Public"
4. Server creates publication with user's library configuration
5. User gets a link in format `/p/:chatflowId`
6. At this link, frontend requests space data including `libraryConfig`
7. AR.js HTML is generated with user-selected library sources
8. **Critical**: Frontend renders HTML using iframe approach for proper script execution

### Quiz Points and Leads

The publication backend also handles quiz results. When a user completes an AR quiz,
their score is returned to the frontend and temporarily saved in the Supabase `lead` table
inside the `phone` field. A dedicated field for quiz results will be added later.

## Library Configuration Flow

The server now supports user-selectable library sources to solve CDN blocking:

1. **Frontend Selection**: User chooses library sources through UI controls
2. **Configuration Storage**: Settings stored in `chatbotConfig.arjs.libraryConfig`
3. **Server Response**: `utilBuildUPDLflow` extracts and returns library configuration
4. **HTML Generation**: Frontend `ARJSBuilder` uses configuration to generate appropriate script tags

### Supported Sources:

-   **Official (CDN)**: External CDN sources (aframe.io, raw.githack.com)
-   **Kiberplano (Local)**: Local files served by main Flowise server at `/assets/libs/`

## Demo Mode

Demo mode is implemented only on the frontend side (`ARJSPublisher.jsx` component) through `DEMO_MODE = true/false` constant. In demo mode, frontend doesn't send requests to API, but uses predefined links.

## Dependencies

-   **Main Flowise Server**: Publication system integrates directly with main server
-   **`utilBuildUPDLflow` Function**: Builds UPDL space from chatflow nodes and extracts library configuration
-   **Static Asset Serving**: Main server serves AR.js libraries through `/assets` route

## Key Architecture Benefits

1. **Unified Infrastructure**: Single server handles API, static files, and authentication
2. **CDN Independence**: Local library serving solves regional CDN blocking issues
3. **User Choice**: Library source selection without code changes
4. **Performance**: Optimized serving through main Flowise infrastructure
5. **Maintenance**: Simplified deployment and updates

---

_Universo Platformo | AR.js Publisher_
