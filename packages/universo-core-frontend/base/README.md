# Universo Core Frontend

✅ **Modern Package** — `@universo/core-frontend`

## Overview

The main React frontend application for Universo Platformo. This is the entry point that bootstraps the entire web UI — it wires together authentication, routing, state management, i18n, and all feature packages into a single-page application served by Vite.

## Package Information

- **Package**: `@universo/core-frontend`
- **Version**: `0.1.0`
- **Type**: React Frontend Application (Modern)
- **Framework**: React 18 + Vite + MUI v7 + TanStack Query v5
- **Language**: TypeScript (TSX)
- **Pattern**: Shell application that composes `@universo/*` feature packages
- **Build System**: Vite (production build to `build/`)

## Key Features

### 🏗️ Application Shell
- **Provider Composition**: Redux store, React Query, Auth, Router, Snackbar, Confirm dialogs
- **Conditional StrictMode**: Enabled in development only to avoid Router context loss in production
- **Bootstrap Error Boundary**: Catch-all error boundary with diagnostics logging
- **Global Diagnostics**: `window.onerror` / `unhandledrejection` listeners for early boot errors

### 🌐 Internationalization
- **Runtime Locale Sync**: HTML `lang` attribute and `<meta>` tags updated on language change
- **Alternate Locales**: `<link rel="alternate" hreflang="...">` tags auto-generated
- **Package Namespaces**: Each feature package registers its own i18n namespace

### 🔌 Integrated Feature Packages
- **Authentication**: `@universo/auth-frontend` — login, session, protected routes
- **Profile**: `@universo/profile-frontend` — user profile management
- **Applications**: `@universo/applications-frontend` — application CRUD
- **Metahubs**: `@universo/metahubs-frontend` — metadata hub management
- **API Client**: `@universo/api-client` — centralized Axios-based API layer
- **UI Components**: `@universo/template-mui` — shared MUI theme, layout, navigation

### 🔧 Development
- **Hot Reloading**: Vite dev server with proxy to backend
- **React Query DevTools**: Enabled in development builds
- **Service Worker**: Optional PWA support (not enabled by default)

## Architecture

### Entry Point Chain

```
index.tsx                     → Bootstrap providers & render
  ├─ diagnostics/             → Global error listeners (before React)
  ├─ config/queryClient.ts    → TanStack Query v5 client factory
  ├─ components/BootstrapErrorBoundary.tsx → Catch-all error boundary
  ├─ App.tsx                  → Theme, i18n meta, routes
  └─ api/client.ts            → Axios API client instance
```

### Provider Stack (inside → outside)

```
<StrictMode>                  (dev only)
  <BootstrapErrorBoundary>
    <QueryClientProvider>
      <Provider store={store}>
        <BrowserRouter>
          <SnackbarProvider>
            <ConfirmContextProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ConfirmContextProvider>
          </SnackbarProvider>
        </BrowserRouter>
      </Provider>
    </QueryClientProvider>
  </BootstrapErrorBoundary>
</StrictMode>
```

### Key Dependencies

| Dependency | Purpose |
|---|---|
| `@universo/store` | Redux store + ConfirmContextProvider |
| `@universo/template-mui` | Shared MUI theme, layout, SCSS |
| `@universo/auth-frontend` | AuthProvider + session hooks |
| `@universo/api-client` | Axios wrapper with interceptors |
| `@universo/i18n` | i18next initialization singleton |
| `@tanstack/react-query` | Server state management |
| `react-router-dom` | Client-side routing |
| `notistack` | Snackbar notifications |

## File Structure

```
packages/universo-core-frontend/
└── base/
    ├── public/                # Static assets & index.html
    ├── scripts/               # Build-time scripts (sync-supported-langs)
    ├── src/
    │   ├── api/               # API client instance
    │   ├── components/        # BootstrapErrorBoundary
    │   ├── config/            # queryClient factory
    │   ├── diagnostics/       # Global error listeners
    │   ├── App.tsx            # Root component (theme, i18n meta, routes)
    │   ├── index.tsx          # Entry point (provider composition)
    │   └── serviceWorker.ts   # Optional PWA registration
    ├── vite.config.js         # Vite configuration with aliases & proxy
    ├── package.json
    ├── README.md
    └── README-RU.md
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `VITE_PORT` | No | Dev server port (default: from Vite config) |
| `PUBLIC_URL` | No | Base URL for asset loading |

### Vite Aliases

The `@/` prefix resolves to `src/` directory. All workspace package imports use `@universo/` scope via PNPM workspace resolution.

## Development

```bash
# From project root
pnpm install
pnpm build              # Full workspace build
pnpm dev                # Start dev servers (resource-intensive)
```

> **Note**: Always run commands from the project root. Individual package builds are for validation only — use `pnpm build` at root to propagate changes.

## Related Packages

- [universo-core-backend](../../universo-core-backend/base/README.md) — Express backend server
- [universo-template-mui](../../universo-template-mui/base/README.md) — Shared UI components and theme
- [universo-i18n](../../universo-i18n/base/README.md) — Internationalization system
- [auth-frontend](../../auth-frontend/base/README.md) — Authentication UI
