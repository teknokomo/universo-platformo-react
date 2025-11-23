# Analytics System

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific capabilities.

Frontend module for displaying quiz analytics in Universo Platformo.

## Description

The Analytics System provides comprehensive tools for analyzing quiz performance, user engagement, and interaction metrics. This module integrates with the core Flowise platform to provide detailed analytics on published content.

## Architecture

The analytics application is built as a lightweight frontend module:

```
packages/analytics-frt/base/
├── src/
│   └── pages/
│       └── Analytics.jsx    # Main analytics page
├── package.json
├── tsconfig.json
└── README.md
```

## Key Features

### Quiz Analytics
- **Performance Metrics**: Track quiz success and completion rates
- **Answer Analysis**: Detailed analysis of user responses and patterns
- **Temporal Analytics**: Performance trends over time
- **Comparative Analytics**: Comparison between different quizzes and periods

### User Engagement Metrics
- **Engagement Indicators**: Time spent on quizzes and interaction levels
- **User Paths**: Analysis of how users navigate through content
- **Bounce Rates**: Identification of points where users abandon quizzes
- **Demographic Analytics**: Audience understanding and user segmentation

### Data Visualization
- **Interactive Charts**: Dynamic visualizations for data exploration
- **Dashboards**: Customizable dashboards for various metrics
- **Report Export**: Ability to export analytics data for further analysis
- **Real-time Filtering**: Interactive filters for detailed analysis

## Integration

### Core Platform Integration
The analytics module integrates with the core Flowise frontend through the alias system:

```javascript
// Import in the main Flowise application
import { AnalyticsPage } from '@packages/analytics-frt'
```

### Data Sources
- **Supabase Database**: Direct queries to leads and quiz results tables
- **API Integration**: RESTful API for retrieving aggregated data
- **Real-time Caching**: Optimized data queries for performance

## Components

### AnalyticsPage
The main component that provides:

- **Overview Dashboard**: High-level metrics and KPIs
- **Detailed Reports**: In-depth analysis of specific quizzes
- **Filters and Search**: Tools for data segmentation
- **Data Export**: Export functionality in various formats

### Analytics Types

#### Quiz Performance Analytics
```javascript
{
  quizId: "string",
  totalAttempts: number,
  completionRate: number,
  averageScore: number,
  timeSpent: number,
  questionAnalysis: [
    {
      questionId: "string",
      correctAnswers: number,
      incorrectAnswers: number,
      skipRate: number
    }
  ]
}
```

#### User Metrics
```javascript
{
  userId: "string",
  sessionDuration: number,
  quizzesCompleted: number,
  averageScore: number,
  lastActivity: "timestamp",
  deviceType: "string",
  location: "string"
}
```

## Usage

### Basic Integration
```javascript
import React from 'react'
import { AnalyticsPage } from '@packages/analytics-frt'

function App() {
  return (
    <div>
      <AnalyticsPage 
        quizId="quiz-123"
        dateRange={{ start: "2024-01-01", end: "2024-12-31" }}
        filters={{ deviceType: "mobile" }}
      />
    </div>
  )
}
```

### Filter Configuration
```javascript
const analyticsFilters = {
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  },
  quizTypes: ['ar-quiz', 'playcanvas-quiz'],
  userSegments: ['new-users', 'returning-users'],
  deviceTypes: ['mobile', 'desktop', 'tablet']
}
```

## Metrics and KPIs

### Key Performance Indicators
- **Completion Rate**: Percentage of users who complete quizzes
- **Average Score**: Average performance across all attempts
- **Engagement Time**: Average time spent on quizzes
- **Retention Rate**: Percentage of users returning for additional quizzes

### Advanced Metrics
- **Cohort Analysis**: Tracking user groups over time
- **Conversion Funnel**: Analyzing user journey from start to completion
- **A/B Segmentation**: Comparing performance of different quiz versions
- **Predictive Analytics**: Forecasting future trends based on historical data

## Development

### Setup
```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm --filter analytics-frt dev
```

### Build
```bash
# Build for production
pnpm --filter analytics-frt build
```

### Testing
```bash
# Run tests
pnpm --filter analytics-frt test

# Run linter
pnpm --filter analytics-frt lint
```

## Configuration

### Environment Variables
```bash
# API endpoints
REACT_APP_ANALYTICS_API_URL=https://api.example.com/analytics
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Analytics settings
REACT_APP_ANALYTICS_REFRESH_INTERVAL=30000
REACT_APP_MAX_DATA_POINTS=1000
```

### Default Settings
```javascript
const defaultConfig = {
  refreshInterval: 30000, // 30 seconds
  maxDataPoints: 1000,
  defaultDateRange: 30, // days
  enableRealTimeUpdates: true,
  cacheTimeout: 300000 // 5 minutes
}
```

## Security

### Access Control
- **Authentication**: Requires valid JWT tokens for data access
- **Authorization**: Users can only view analytics for their quizzes
- **Data Filtering**: Automatic filtering based on user permissions

### Data Privacy
- **Anonymization**: User personal data is anonymized in reports
- **GDPR Compliance**: Adherence to data protection regulations
- **Audit Logs**: Tracking access to analytical data

## Performance

### Optimization
- **Lazy Loading**: Components loaded on demand
- **Data Caching**: Intelligent caching to reduce API calls
- **Virtualization**: Efficient rendering of large datasets
- **Debouncing**: Optimized user interactions

### Monitoring
- **Performance Metrics**: Tracking load times and responsiveness
- **Error Tracking**: Automatic error and issue reporting
- **Usage Analytics**: Understanding how users interact with analytics

## Future Enhancements

- **Machine Learning**: Integration of ML for predictive analytics
- **Advanced Visualization**: Additional chart types and visualizations
- **Report Export**: Automated report generation and scheduling
- **External Tool Integration**: Connection to Google Analytics, Mixpanel, etc.
- **Mobile Application**: Native mobile app for analytics on the go

## Next Steps

- [UPDL System](../updl/README.md) - Explore the Universal Platform Definition Language
- [Publishing System](../publish/README.md) - Explore content publishing and sharing
- [Profile Management](../profile/README.md) - Understand user management capabilities
