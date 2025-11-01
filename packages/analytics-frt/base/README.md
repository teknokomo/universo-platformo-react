# Analytics Frontend (@universo/analytics-frt)

React frontend package for displaying comprehensive quiz analytics and lead tracking in Universo Platformo ecosystem.

## Overview

The Analytics Frontend provides detailed insights into quiz performance, participant engagement, and lead collection data. It integrates seamlessly with the Universo platform's space-canvas architecture to deliver contextual analytics for educational and business applications.

## Key Features

- **Comprehensive Analytics Dashboard**: Visual metrics cards showing total participants, average/maximum scores, and total points
- **Lead Management**: Detailed participant data with contact information and completion tracking  
- **Hierarchical Data Navigation**: Space → Canvas → Quiz selection workflow for organized data access
- **Real-time Search & Filtering**: Dynamic participant filtering by name or email
- **Multi-language Support**: Full i18n integration with English and Russian translations
- **Responsive Design**: Material-UI components optimized for desktop and mobile experiences
- **Data Visualization**: Interactive table views with sorting and comprehensive participant profiles

## Architecture

### Data Flow
```
Unik → Spaces → Canvases → Quiz Analytics → Lead Data
```

### Core Components

- **Analytics.jsx**: Main dashboard component with metrics cards and participant table
- **Space/Canvas Selectors**: Hierarchical navigation for quiz selection
- **Metrics Cards**: Visual KPI displays using Material-UI Cards and Tabler icons
- **Leads Table**: Detailed participant data with search and filtering capabilities

### Integration Points

- **@flowise/template-mui**: UI components (MainCard, ViewHeader, useApi hook)
- **@universo/api-client**: Modern API client for spaces/canvases data
- **@flowise/store**: Redux integration for global state management
- **Legacy leadsApi**: Direct lead data fetching (to be migrated)

## Structure

```
src/
├── pages/
│   ├── Analytics.jsx          # Main analytics dashboard component
│   └── __tests__/
│       └── Analytics.test.tsx # Comprehensive component tests
├── i18n/                      # Internationalization module
│   ├── index.ts              # Translation exports and utilities
│   └── locales/
│       ├── en/main.json      # English translations
│       └── ru/main.json      # Russian translations
└── index.ts                   # Package entry point
```

## API Integration

### Modern API Clients
```typescript
// Spaces data (via @universo/api-client)
const spacesApi = api.spaces
const spaces = await spacesApi.getSpaces(unikId)
const canvases = await spacesApi.getCanvases(unikId, spaceId)

// Lead data (legacy API - scheduled for migration)
const leads = await leadsApi.getCanvasLeads(canvasId)
```

### Data Processing
```typescript
// Analytics calculation with backward compatibility
const resolveLeadPoints = (lead) => {
  if (typeof lead?.points === 'number') return lead.points
  if (lead?.phone) {
    const pts = parseInt(lead.phone, 10)
    if (!isNaN(pts)) return pts
  }
  return 0
}

const calculateAnalytics = (leadsData) => ({
  totalLeads: leadsData.length,
  averagePoints: Math.round((totalPoints / validLeads.length) * 100) / 100,
  maxPoints: Math.max(...points),
  totalPoints: points.reduce((a, b) => a + b, 0)
})
```

## Component Usage

### In Main Application
```jsx
// Route configuration (flowise-template-mui)
const Analytics = Loadable(lazy(() => import('@universo/analytics-frt/pages/Analytics')))

// i18n registration (flowise-ui)
import '@universo/analytics-frt/i18n'
```

### Standalone Import
```typescript
import { AnalyticsPage } from '@universo/analytics-frt'

// With translation utilities
import { analyticsTranslations, getAnalyticsTranslations } from '@universo/analytics-frt/i18n'
```

## Development

### Prerequisites
- Node.js 18+
- PNPM workspace environment
- Access to Universo platform APIs

### Commands
```bash
# Install dependencies (from project root)
pnpm install

# Build the package
pnpm --filter @universo/analytics-frt build

# Development mode with hot reload  
pnpm --filter @universo/analytics-frt dev

# Run tests
pnpm --filter @universo/analytics-frt test

# Lint code
pnpm --filter @universo/analytics-frt lint
```

### Testing Strategy

The package includes comprehensive tests covering:
- **API Integration**: Mocked responses for spaces, canvases, and leads data
- **Metrics Calculation**: Backward compatibility with points/phone field mapping
- **Component Rendering**: Full dashboard rendering with real-world data scenarios
- **User Interactions**: Space/canvas selection and data filtering workflows

### Development Notes

- **Legacy API Migration**: Lead data still uses legacy `leadsApi` - migration to `@universo/api-client` planned
- **Error Handling**: Comprehensive error boundaries and loading states for production resilience
- **Performance**: Efficient state management with useApi hook pattern prevents unnecessary re-renders
- **Accessibility**: Full ARIA labels and semantic HTML structure for screen readers

## Internationalization

### Translation Structure
```json
{
  "analytics": {
    "title": "Quiz Analytics",
    "metrics": {
      "totalParticipants": "Total Participants",
      "averageScore": "Average Score"
    },
    "table": {
      "name": "Name",
      "email": "Email",
      "points": "Points"
    }
  }
}
```

### Usage in Components
```jsx
const { t } = useTranslation(['analytics'])

return (
  <Typography variant="h4">
    {t('title')} {/* Renders: "Quiz Analytics" */}
  </Typography>
)
```

## Data Models

### Lead Data Structure
```typescript
interface Lead {
  name?: string
  email?: string
  phone?: string
  points?: number          // Preferred field
  createdDate: string
  canvasId?: string
  canvasid?: string       // Legacy field
}
```

### Analytics Metrics
```typescript
interface AnalyticsMetrics {
  totalLeads: number
  averagePoints: number
  maxPoints: number
  totalPoints: number
}
```

## Related Documentation

- [Universo Platform Architecture](../../../docs/en/universo-platformo/README.md)
- [Flowise Template MUI Components](../../flowise-template-mui/base/README.md)
- [API Client Integration](../../universo-api-client/README.md)
- [Spaces Frontend Package](../../spaces-frt/base/README.md)

---

**Universo Platformo | Analytics Frontend Package**
