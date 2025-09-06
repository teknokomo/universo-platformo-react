# Analytics Frontend (analytics-frt)

Frontend module for displaying quiz analytics in Universo Platformo.

This app exposes a single React component **AnalyticsPage** located in `src/pages/Analytics.jsx`.
It is imported in the main Flowise frontend via the `@apps/analytics-frt` alias.

## API Usage

Use the shared `useApi` hook for data fetching. Include the returned `request` function in effect dependency arrays to keep requests to a single execution on mount:

```javascript
const { request } = useApi(fetchList)

useEffect(() => {
    request()
}, [request])
```
