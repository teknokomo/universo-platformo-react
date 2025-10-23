# MUI Dashboard Template (universo-template-mui)

Material-UI Dashboard template adapted for the Universo Platformo ecosystem, providing a modern and responsive user interface.

## Recent Changes (2025-01-25)

### UI Modernization Updates

- **Language Switcher Integration**: Added LanguageSwitcher component to Header with MUI v6 icons (replaces Tabler icons for better compatibility)
- **Temporarily Hidden Features**: Search field, date picker, and notification bell are commented out in Header for future implementation
- **Agent/Assistant Menu Items**: Temporarily hidden from navigation menu while functionality is being refactored (URLs remain functional for testing)
- **Enhanced Breadcrumbs**: NavbarBreadcrumbs now accepts dynamic breadcrumb items with internationalization support
- **Improved Navigation**: Enhanced menu active state detection for dashboard routes

### Architecture Improvements

- **Type Safety**: Added TypeScript interfaces for BreadcrumbItem and enhanced Header props
- **Internationalization**: Full i18n support for new UI components with fallback defaults
- **Modular Design**: Components designed for easy reuse across different sections (uniks, metaverses, clusters)

## Overview

The MUI Dashboard Template provides a comprehensive dashboard interface built on Material-UI v6, featuring:

- **Modern Design**: Material Design 3 with dark/light theme support
- **Responsive Layout**: Mobile-first responsive design
- **Internationalization**: Built-in support for multiple languages
- **Navigation System**: Dynamic breadcrumbs and sidebar navigation
- **Theme Customization**: Extensive MUI theme customizations

## Components

### Core Layout Components

- **MainLayoutMUI**: Main layout wrapper with sidebar, header, and content area
- **Header**: Top navigation with breadcrumbs, language switcher, and theme toggle
- **SideMenu**: Collapsible sidebar with navigation items
- **NavbarBreadcrumbs**: Dynamic breadcrumb navigation with i18n support

### Navigation Components

- **LanguageSwitcher**: Language selection dropdown with flag badges
- **ColorModeIconDropdown**: Theme mode selector (light/dark/system)
- **MenuContent**: Dynamic menu content rendering with React Router integration

### Recent Component Updates

#### LanguageSwitcher (NEW)
```tsx
// New component for language switching with MUI v6 icons
import LanguageSwitcher from '../shared/LanguageSwitcher';

// Usage in Header
<LanguageSwitcher />
```

#### Enhanced NavbarBreadcrumbs
```tsx
// Now accepts dynamic breadcrumb data
interface BreadcrumbItem {
  label: string;
  url?: string;
  isCurrentPage?: boolean;
}

<NavbarBreadcrumbs items={breadcrumbItems} />
```

## Features

### Internationalization

- **Language Support**: English and Russian with extensible architecture
- **Dynamic Loading**: Languages loaded from i18next resources
- **Fallback Handling**: Graceful fallbacks for missing translations
- **Namespace Support**: Organized translation keys by feature area

### Navigation System

- **Dynamic Breadcrumbs**: Auto-generated based on current route
- **Active State Management**: Proper highlighting of current page in navigation
- **Menu Configuration**: Centralized menu configuration with easy customization
- **Route Integration**: Full React Router v6 integration

### Theme System

- **Material Design 3**: Latest Material Design specifications
- **Custom Palette**: Universo Platformo brand colors
- **Component Overrides**: Consistent styling across all components
- **Responsive Breakpoints**: Mobile-first responsive design

## Configuration

### Menu Configuration

Menu items are configured in `src/navigation/menuConfigs.ts`:

```typescript
export const unikMenuConfig: MenuItemConfig[] = [
  {
    id: 'unik-dashboard',
    titleKey: 'menu.dashboard',
    urlPath: '',
    iconName: 'IconBuildingStore',
    type: 'item',
    breadcrumbs: false
  },
  // ... other menu items
];
```

### Breadcrumb Configuration

Breadcrumbs are auto-generated in `MainRoutesMUI.tsx` based on current route:

```typescript
const generateBreadcrumbs = (pathname: string, unikId?: string, t?: any): BreadcrumbItem[] => {
  // Dynamic breadcrumb generation logic
};
```

## Integration

### With Uniks Frontend

The template integrates with `@universo/uniks-frt` through:

- **Route Factory**: `createMainRoutes()` accepts component props
- **Navigation Hook**: `useUnikNavigation()` provides menu items
- **Translation Keys**: Shared translation namespace for consistency

### Component Props

```typescript
export interface MainLayoutMUIProps {
  disableCustomTheme?: boolean;
  mainItems?: Array<{ text: string; icon: React.ReactNode; url?: string; selected?: boolean }>;
  breadcrumbItems?: BreadcrumbItem[];
}
```

## Development

### Building

```bash
# Build the template package
pnpm --filter @universo/template-mui build

# Build with other dependent packages
pnpm --filter flowise-ui build
```

### Testing Navigation

Test the navigation system by visiting:

- Dashboard: `/unik/{id}` or `/unik/{id}/dashboard`
- Spaces: `/unik/{id}/spaces`
- Tools: `/unik/{id}/tools`
- Analytics: `/unik/{id}/analytics`

### Adding New Menu Items

1. Add item to `menuConfigs.ts`
2. Update translation keys in appropriate i18n files
3. Add route in `MainRoutesMUI.tsx`
4. Test navigation and active states

## Temporarily Hidden Features

These features are temporarily hidden but URLs remain functional:

### Menu Items (commented out in menuConfigs.ts)
- **Agent Flows**: `/unik/{id}/agentflows`
- **Assistants**: `/unik/{id}/assistants`

### Header Components (commented out in Header.tsx)
- **Search Field**: Global search functionality
- **Date Picker**: Date range selection
- **Notifications**: Notification center with badge

## Future Enhancements

- **Search Integration**: Global search across all content types
- **Advanced Notifications**: Real-time notification system
- **Date Filtering**: Global date range filtering
- **Mobile Optimizations**: Enhanced mobile navigation experience
- **Accessibility**: WCAG 2.1 AA compliance improvements

## Dependencies

### Core Dependencies

- `@mui/material`: Material-UI component library
- `@mui/icons-material`: Material-UI icons
- `react-router-dom`: Client-side routing
- `react-i18next`: Internationalization
- `i18next`: Translation framework

### Development Dependencies

- `typescript`: Type checking
- `@types/react`: React type definitions
- Modern build tooling for dual CJS/ESM output

## Contributing

When contributing to the template:

1. **Maintain Type Safety**: All new components should have proper TypeScript interfaces
2. **Follow i18n Patterns**: Add translation keys with English/Russian parity
3. **Test Responsive Design**: Verify components work on mobile and desktop
4. **Document Changes**: Update this README with significant modifications
5. **Preserve Accessibility**: Maintain keyboard navigation and screen reader support

## Related Documentation

- [Main Apps Documentation](../../../packages/README.md)
- [Uniks Frontend Documentation](../../uniks-frt/base/README.md)
- [Platform Architecture](../../../docs/en/applications/README.md)

---

**Universo Platformo | MUI Dashboard Template**
