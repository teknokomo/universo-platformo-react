# Finance Frontend (finance-frt)

Frontend application providing financial management UI for Universo Platformo workspaces.

## Overview

The Finance Frontend offers components and API helpers for managing accounts and currencies within a workspace.

## Key Features

- **Account Management**: List, create, update and delete accounts
- **Currency Management**: Maintain workspace currencies and exchange rates
- **Internationalization**: English and Russian translations using `finance` namespace
- **Navigation**: Integrates with main platform menus

## Structure

```
src/
├── api/finance/    # REST API helpers
├── i18n/           # Translation resources
├── menu-items/     # Menu configuration
└── pages/          # React components
```

## Integration

This package integrates with:

- **Main UI Package**: Provides finance functionality to the platform
- **Finance Backend**: Communicates with `@universo/finance-srv`

## Development

### Prerequisites

- Node.js 18+
- PNPM package manager

### Installation

```bash
pnpm install
pnpm build
pnpm dev
```

### Build Commands

```bash
pnpm build
pnpm dev
pnpm build --filter @universo/finance-frt
```

### API Usage

Server requests should use the shared `useApi` hook. Include the returned `request` function in effect dependency arrays to ensure calls run only once when components mount:

```javascript
const { request } = useApi(fetchList)

useEffect(() => {
    request()
}, [request])
```

## Related Documentation

- [Finance Backend Documentation](../finance-srv/base/README.md)
- [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | Finance Frontend Application**

See also: Creating New Apps/Packages (best practices)

- ../../../docs/en/universo-platformo/shared-guides/creating-apps.md
