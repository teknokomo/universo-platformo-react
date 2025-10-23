# Profile Frontend (profile-frt)

Frontend module for user profile management and authentication in Universo Platformo.

## Project Structure

The project follows a unified structure for applications in the monorepo:

```
packages/profile-frt/base/
├── package.json
├── tsconfig.json
├── gulpfile.ts
└── src/
   ├── i18n/                # Localization
   │  └── locales/          # Language files (en, ru)
   ├── pages/               # Page components
   │  └── Profile.jsx       # Main profile management page
   └── index.ts             # Entry point
```

## Features

-   **Email Update**: Change user email address through Supabase auth system
-   **Secure Password Update**: Change user password with current password verification
-   **Authentication Integration**: JWT token-based authentication with Supabase
-   **Form Validation**: Client-side validation for email and password formats with password confirmation
-   **Error Handling**: Comprehensive error messages and user feedback with full internationalization
-   **Internationalization**: Multi-language support (English/Russian) including server error translation
-   **Security Features**: Current password verification, bcrypt hashing, minimum password requirements
-   **Responsive Design**: Mobile-friendly user interface

## Authentication Architecture

### Frontend Authentication Flow

The Profile component handles user authentication and profile updates through a secure token-based system:

1. **Token Storage**: JWT tokens stored in localStorage
2. **API Communication**: All requests include Authorization header with Bearer token
3. **Error Handling**: Graceful handling of authentication failures and validation errors
4. **User Feedback**: Real-time status updates during profile operations

### Backend Integration

The frontend communicates with the backend through REST API endpoints:

#### Email Update Endpoint

```
PUT /api/v1/auth/email
Headers: Authorization: Bearer <jwt_token>
Body: { "email": "new@example.com" }
```

#### Password Update Endpoint

```
PUT /api/v1/auth/password
Headers: Authorization: Bearer <jwt_token>
Body: {
    "currentPassword": "oldpassword123",
    "newPassword": "newpassword123"
}
```

### Supabase Integration

The profile management system uses Supabase authentication with custom SQL functions for secure user data updates.

#### SQL Functions in Database

The authentication system uses SQL functions with `SECURITY DEFINER` privileges to update user data:

**Email Update Function:**

```sql
CREATE OR REPLACE FUNCTION update_user_email(user_id uuid, new_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE auth.users SET email = new_email WHERE id = user_id;
END;
$$;
```

**Password Verification Function:**

```sql
CREATE OR REPLACE FUNCTION verify_user_password(password text)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id uuid;
BEGIN
    user_id := auth.uid();

    RETURN EXISTS (
        SELECT id
        FROM auth.users
        WHERE id = user_id
        AND encrypted_password = crypt(password::text, auth.users.encrypted_password)
    );
END;
$$;
```

**Secure Password Update Function:**

```sql
CREATE OR REPLACE FUNCTION change_user_password_secure(
    current_password text,
    new_password text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_id uuid;
    is_valid_password boolean;
BEGIN
    -- Get current user ID
    user_id := auth.uid();

    -- Verify current password
    SELECT verify_user_password(current_password) INTO is_valid_password;

    IF NOT is_valid_password THEN
        RAISE EXCEPTION 'Current password is incorrect';
    END IF;

    -- Update password
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = user_id;

    RETURN json_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;
```

#### Backend Implementation

The backend controllers use these SQL functions via Supabase RPC calls:

```typescript
// Email update
const { error } = await supabase.rpc('update_user_email', {
    user_id: userId,
    new_email: email
})

// Secure password update with current password verification
const { data, error } = await supabase.rpc('change_user_password_secure', {
    current_password: currentPassword,
    new_password: newPassword
})
```

## Database Migration

The profile management system now has its own dedicated migration structure, maintaining proper separation of concerns between profile functionality and other system components.

### Profile Service Migration

The profile system uses a dedicated migration `packages/profile-srv/base/src/database/migrations/postgres/1741277504477-AddProfile.ts` that includes:

-   **Profile table schema**: Complete user profile data structure
-   **Row Level Security (RLS) policies**: Secure access control for profile data
-   **User profile SQL functions**: Authentication and profile management functions
-   **Database triggers**: Automatic profile creation on user registration

### Integration with Main Platform

The profile service integrates with the main Flowise platform through:

-   **Entity Integration**: Profile entities are automatically included in the main database schema
-   **Migration System**: Profile migrations are integrated into the PostgreSQL migration system
-   **Shared Authentication**: Uses the same Supabase authentication system as the main platform

## User Interface

### Profile Management Form

The Profile component provides an intuitive interface for user account management:

-   **Email Section**: Current email display with update form
-   **Password Section**: Secure password change form
-   **Validation**: Real-time form validation with error messages
-   **Feedback**: Success/error notifications for all operations
-   **Loading States**: Visual indicators during API operations

### Form Validation

Client-side validation includes:

-   **Email Format**: Valid email address format checking
-   **Password Requirements**: Minimum length (6+ characters) and strength validation
-   **Current Password Verification**: Required verification of current password before changes
-   **Password Confirmation**: New password confirmation to prevent typos
-   **Required Fields**: Prevention of empty form submissions
-   **Error Display**: Clear error messages for invalid inputs with full internationalization

## Usage Examples

### Basic Profile Update Flow

Here's a typical user interaction flow for updating profile information:

```javascript
// 1. User opens profile page
// 2. Current email is displayed automatically
// 3. User enters new email and submits form

const updateEmail = async (newEmail) => {
    const token = localStorage.getItem('token')
    const response = await fetch('/api/v1/auth/email', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: newEmail })
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update email')
    }

    // Success feedback to user
    return await response.json()
}
```

### Error Handling Example

```javascript
try {
    await updateEmail('new@example.com')
    setSuccess('Email updated successfully!')
} catch (error) {
    setError(`Failed to update email: ${error.message}`)
}
```

## API Architecture

### Authentication Headers

All API requests include proper authentication:

```javascript
const token = localStorage.getItem('token')
const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`
}
```

### Error Handling

Comprehensive error handling for various scenarios:

-   **401 Unauthorized**: Invalid or expired tokens
-   **400 Bad Request**: Validation errors or missing data
-   **500 Server Error**: Database or system errors
-   **Network Errors**: Connection issues and timeouts

### Response Processing

All API responses are processed with proper error checking:

```javascript
const response = await fetch(url, { method, headers, body })
const data = await response.json()

if (!response.ok) {
    throw new Error(data.error || 'Operation failed')
}
```

## Security Features

### Token-Based Authentication

-   **JWT Tokens**: Secure token-based authentication
-   **Token Validation**: Server-side token verification
-   **Automatic Expiry**: Token expiration handling
-   **Secure Storage**: localStorage with proper cleanup
-   **Current Password Verification**: Required verification before password changes
-   **Server Error Translation**: Automatic mapping of server errors to localized messages

### SQL Function Security

-   **SECURITY DEFINER**: Elevated privileges for database operations
-   **Input Validation**: Protection against SQL injection
-   **User Isolation**: Operations limited to authenticated user's data
-   **Audit Trail**: All operations logged for security monitoring

### Password Security

-   **Bcrypt Hashing**: Industry-standard password hashing
-   **Salt Generation**: Unique salts for each password
-   **Secure Transmission**: HTTPS-only password transmission
-   **No Plain Text**: Passwords never stored in plain text

## Development

### Setup

```bash
pnpm install
```

### Development Mode

```bash
pnpm --filter profile-frt dev
```

### Building

```bash
pnpm --filter profile-frt build
```

### Build Process

1. **TypeScript Compilation**: Compiles TypeScript files to JavaScript
2. **Gulp Tasks**: Copies static assets (JSON, CSS, etc.) to dist folder

## Dependencies

The application uses minimal dependencies for optimal performance:

-   **React 18**: Modern React for component development
-   **TypeScript**: Type safety and enhanced development experience
-   **Build Tools**: Gulp for asset management, rimraf for cleanup

## Integration with Main Platform

The profile frontend integrates seamlessly with the main Flowise platform:

-   **Consistent Authentication**: Uses same JWT token system as main platform
-   **Shared API Base**: Leverages existing backend infrastructure
-   **Modular Architecture**: Independent deployment and development
-   **Theme Consistency**: Follows main platform design guidelines

## Current Limitations

-   **Single User Context**: Currently designed for individual user management
-   **Basic Validation**: Limited client-side validation rules
-   **No Avatar Support**: Profile pictures not yet implemented

## Future Enhancements

-   **Profile Pictures**: Avatar upload and management
-   **Extended Validation**: Advanced password strength requirements
-   **User Preferences**: Additional profile settings and preferences
-   **Social Login**: Integration with social authentication providers
-   **Two-Factor Authentication**: Enhanced security options
-   **Profile History**: Audit log for profile changes

## Recent Updates (June 2025)

### Profile Architecture Improvements

1. **Nickname & Email Display** – The frontend now correctly fetches and displays the user nickname from the `profiles` table alongside the authenticated email.
2. **Secure Password Flow** – Password-change requests are forwarded to a new backend endpoint (`PUT /api/v1/auth/password`) that validates the current password through a secure Supabase SQL function.
3. **Token Handling** – All profile operations create an Authorization header with the JWT token retrieved from `AuthProvider.getAccessToken()`.
4. **Error Feedback** – The component surfaces precise error messages (e.g. _Current password is incorrect_) returned by the backend.

### Why Indexes Were Added in `Profile.ts`

The backend `Profile` entity now includes two explicit indexes:

| Index                   | Column     | Purpose                                                                                                               |
| ----------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `idx_profiles_user_id`  | `user_id`  | Guarantees a one-to-one relationship between `auth.users` and `public.profiles`, and accelerates look-ups by user id. |
| `idx_profiles_nickname` | `nickname` | Enforces nickname uniqueness and supports fast availability checks when users choose or change their nickname.        |

These indexes greatly reduce query latency for profile retrieval and nickname availability checks that are executed by the frontend during initial page load and nickname validation.

---

_Universo Platformo | Profile Frontend Module_
