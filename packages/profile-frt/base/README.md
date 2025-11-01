# @universo/profile-frt

> 🏗️ **Modern Package** - TypeScript-first architecture with dual build system (CJS + ESM)

React frontend for user profile management and authentication in Universo Platformo.

## Package Information

- **Version**: 0.1.0
- **Type**: Frontend React Package (TypeScript)
- **Status**: ✅ Active Development
- **Architecture**: Modern with dual build system (CJS + ESM)

## Key Features

### User Profile Management
- **Profile Data**: Display and edit user nickname, first name, last name
- **Email Updates**: Secure email address changes through Supabase auth
- **Password Management**: Secure password updates with current password verification
- **Real-time Validation**: Client-side form validation with immediate feedback

### Security & Authentication
- **JWT Token Integration**: Bearer token authentication with automatic refresh
- **Current Password Verification**: Required verification before password changes
- **Secure API Communication**: All requests authenticated and encrypted
- **Input Validation**: Comprehensive client-side and server-side validation

### User Experience
- **Internationalization**: Multi-language support (English/Russian)
- **Responsive Design**: Mobile-friendly Material-UI components
- **Loading States**: Visual indicators for all asynchronous operations
- **Error Handling**: Comprehensive error messages with localization
- **Success Feedback**: Clear confirmation messages for successful operations

## Installation

```bash
# Install from workspace root
pnpm install

# Build the package
pnpm --filter @universo/profile-frt build
```

## File Structure

```
packages/profile-frt/base/
├── src/
│   ├── i18n/              # Internationalization
│   │   └── locales/       # Language files (en, ru)
│   ├── pages/             # React page components
│   │   ├── Profile.jsx    # Main profile management component
│   │   └── __tests__/     # Component tests
│   └── index.ts           # Package exports
├── dist/                  # Compiled output (CJS, ESM, types)
├── package.json
├── tsconfig.json
├── tsdown.config.ts       # Build configuration
├── vitest.config.ts       # Test configuration
├── README.md              # This file
└── README-RU.md           # Russian documentation
```

## Usage

### Basic Component Integration
```tsx
import { ProfilePage } from '@universo/profile-frt'

// Use in your React application
function UserProfileRoute() {
  return <ProfilePage />
}
```

### With Router Integration
```tsx
import { Routes, Route } from 'react-router-dom'
import { ProfilePage } from '@universo/profile-frt'

function AppRoutes() {
  return (
    <Routes>
      <Route path="/profile" element={<ProfilePage />} />
    </Routes>
  )
}
```

### Authentication Required
```tsx
import { ProfilePage } from '@universo/profile-frt'
import { useAuth } from '@universo/auth-frt'

function ProtectedProfile() {
  const { user, isAuthenticated } = useAuth()
  
  if (!isAuthenticated) {
    return <div>Please log in to view your profile</div>
  }
  
  return <ProfilePage />
}
```

## API Integration

### Profile Data Endpoints
```http
# Get user profile
GET /api/v1/profile/:userId
Authorization: Bearer <jwt_token>

# Update profile information
PUT /api/v1/profile/:userId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "nickname": "newNickname",
  "first_name": "John",
  "last_name": "Doe"
}
```

### Authentication Endpoints
```http
# Update user email
PUT /api/v1/auth/email
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "new@example.com"
}

# Update user password
PUT /api/v1/auth/password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePassword456"
}
```

### Response Handling
```typescript
// API response handling with proper error management
const handleApiResponse = async (response: Response) => {
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || data.message || 'Operation failed')
  }
  
  return data
}

// Example usage
try {
  const response = await fetch('/api/v1/profile/123', {
    headers: { Authorization: `Bearer ${token}` }
  })
  const result = await handleApiResponse(response)
  console.log('Profile data:', result.data)
} catch (error) {
  console.error('Profile fetch failed:', error.message)
}
```

## Component Architecture

### Profile Page Structure
```tsx
// Main Profile component structure
const Profile = () => {
  // State management
  const [profile, setProfile] = useState({
    nickname: '',
    first_name: '',
    last_name: ''
  })
  
  // Authentication integration
  const { user, getAccessToken } = useAuth()
  const { t } = useTranslation('profile')
  
  // Form sections
  return (
    <MainCard title={t('title')}>
      <ProfileSection />
      <EmailSection />
      <PasswordSection />
    </MainCard>
  )
}
```

### Form Validation
```typescript
// Client-side validation logic
const validateProfile = (data) => {
  const errors = {}
  
  if (!data.nickname?.trim()) {
    errors.nickname = 'Nickname is required'
  }
  
  if (data.email && !/\S+@\S+\.\S+/.test(data.email)) {
    errors.email = 'Invalid email format'
  }
  
  if (data.newPassword && data.newPassword.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  }
  
  return { isValid: Object.keys(errors).length === 0, errors }
}
```

## Development

### Prerequisites
- Node.js 18+
- pnpm 8+
- TypeScript 5+

### Available Scripts
```bash
# Development
pnpm build              # Build for production (dual CJS/ESM)
pnpm build:watch        # Build in watch mode
pnpm dev                # Development with TypeScript watch

# Testing
pnpm test               # Run Vitest test suite
pnpm lint               # Run ESLint

# Type checking
pnpm type-check         # TypeScript compilation check
```

### Build System
This package uses `tsdown` for dual-build output:
- **CommonJS**: `dist/index.js` (for legacy compatibility)
- **ES Modules**: `dist/index.mjs` (for modern bundlers)
- **Types**: `dist/index.d.ts` (TypeScript declarations)

### Development Workflow
```bash
# Start development mode
pnpm --filter @universo/profile-frt dev

# In another terminal, run tests
pnpm --filter @universo/profile-frt test

# Build for production
pnpm --filter @universo/profile-frt build
```

## Testing

### Test Structure
```
src/
├── pages/
│   ├── Profile.jsx
│   └── __tests__/
│       └── Profile.test.tsx
└── setupTests.ts
```

### Testing Approach
```typescript
// Example component test
import { render, screen, fireEvent } from '@testing-library/react'
import { Profile } from '../Profile'

describe('Profile Component', () => {
  test('renders profile form fields', () => {
    render(<Profile />)
    
    expect(screen.getByLabelText(/nickname/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
  })
  
  test('validates required fields', async () => {
    render(<Profile />)
    
    const submitButton = screen.getByRole('button', { name: /update/i })
    fireEvent.click(submitButton)
    
    expect(await screen.findByText(/nickname is required/i)).toBeInTheDocument()
  })
})
```

### Running Tests
```bash
pnpm test                    # Run all tests
pnpm test -- --watch         # Watch mode
pnpm test -- --coverage      # With coverage report
```

## Security Considerations

### Authentication Flow
- **JWT Token Management**: Automatic token refresh and validation
- **Secure API Communication**: All requests use HTTPS with Bearer tokens
- **Current Password Verification**: Required for password changes
- **Input Sanitization**: Client-side validation prevents XSS attacks

### Data Protection
- **Sensitive Data Handling**: Passwords never stored in component state
- **Secure Transmission**: All data encrypted in transit
- **User Isolation**: Each user can only access their own profile data
- **Error Information**: Error messages don't leak sensitive system information

## Integration Requirements

### Required Dependencies
```typescript
// Required peer dependencies
import { useAuth } from '@universo/auth-frt'
import { useTranslation } from '@universo/i18n'
import { MainCard } from '@flowise/template-mui'
```

### Environment Configuration
```bash
# Required API endpoints
REACT_APP_API_BASE_URL=https://api.example.com
REACT_APP_PROFILE_ENDPOINT=/api/v1/profile
REACT_APP_AUTH_ENDPOINT=/api/v1/auth
```

## Configuration

### TypeScript Configuration
The package uses strict TypeScript configuration:
- Strict null checks enabled
- No implicit any types
- Strict function types
- All compiler strict options enabled

### Build Configuration
```typescript
// tsdown.config.ts
export default {
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true
}
```

## Contributing

### Code Style
- Follow ESLint configuration
- Use TypeScript for new components
- Follow React best practices
- Write comprehensive tests

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes with tests
3. Update documentation
4. Submit PR with description

## Related Packages
- [`@universo/profile-srv`](../profile-srv/base/README.md) - Backend profile service
- [`@universo/auth-frt`](../auth-frt/base/README.md) - Authentication frontend
- [`@universo/i18n`](../universo-i18n/base/README.md) - Internationalization

---
*Part of [Universo Platformo](../../../README.md) - A comprehensive metaverse management platform*
