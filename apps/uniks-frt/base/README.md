# Uniks Frontend (uniks-frt)

Frontend application for workspace management functionality in the Universo Platformo ecosystem.

## Overview

The Uniks Frontend application provides a user-friendly interface for creating, managing, and organizing workspaces. It offers workspace listing, creation, editing, and member management capabilities with full internationalization support.

## Key Features

-   **Workspace Management**: Create, edit, and delete workspaces
-   **User Interface**: Responsive Material-UI based interface
-   **Member Management**: Add and remove workspace members
-   **Internationalization**: Full support for English and Russian languages
-   **Navigation**: Seamless integration with main platform navigation

## Structure

```
src/
├── i18n/           # Internationalization resources
│   ├── locales/    # Language-specific translations
│   └── index.js    # i18n configuration
├── pages/          # React page components
│   ├── UnikList.jsx    # Workspace listing page
│   ├── UnikDetail.jsx  # Workspace detail view
│   └── UnikDialog.jsx  # Workspace creation/editing dialog
├── menu-items/     # Menu configuration
│   └── unikDashboard.js # Dashboard menu items
└── index.js        # Application entry point
```

## Components

### UnikList.jsx

Main workspace listing page that displays all user workspaces with filtering and search capabilities.

### UnikDetail.jsx

Detailed view of a specific workspace showing workspace information and member management.

### UnikDialog.jsx

Modal dialog for creating new workspaces or editing existing ones.

## Internationalization

The application supports multiple languages through the i18n system:

-   **English**: Default language with complete translations
-   **Russian**: Full Russian localization

Translation keys are organized under the `uniks` namespace.

## Integration

This application integrates with:

-   **Main UI Package**: Provides workspace management functionality to the main platform
-   **Uniks Backend**: Communicates with `@universo/uniks-srv` for data operations
-   **Supabase**: Uses authentication and user management services

## Development

### Prerequisites

-   Node.js 18+
-   PNPM package manager
-   Access to the Universo Platformo workspace

### Installation

```bash
# Install dependencies
pnpm install

# Build the application
pnpm build

# Run in development mode
pnpm dev
```

### Build Commands

```bash
# Build for production
pnpm build

# Build with watch mode
pnpm dev

# Build specific components
pnpm build --filter @universo/uniks-frt
```

## Configuration

The application uses the following configuration:

-   **TypeScript**: Strict type checking enabled
-   **Material-UI**: Component library for UI elements
-   **i18next**: Internationalization framework
-   **React**: Frontend framework

## Dependencies

### Core Dependencies

-   `react`: Frontend framework
-   `@mui/material`: Material-UI component library
-   `@mui/icons-material`: Material-UI icons
-   `i18next`: Internationalization framework
-   `react-i18next`: React integration for i18next

### Development Dependencies

-   `typescript`: TypeScript compiler
-   `@types/react`: TypeScript definitions for React
-   `gulp`: Build tool for asset processing

## API Integration

The application communicates with the backend through the main UI package integration, which handles:

-   Workspace CRUD operations
-   Member management
-   User authentication
-   Data synchronization

## Contributing

When contributing to this application:

1. Follow the established TypeScript patterns
2. Maintain internationalization support
3. Use Material-UI components for consistency
4. Test with both English and Russian languages
5. Follow the project's coding standards

## Related Documentation

-   [Main Apps Documentation](../README.md)
-   [Uniks Backend Documentation](../uniks-srv/base/README.md)
-   [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | Uniks Frontend Application**
