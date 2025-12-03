# Profile Management

> **📋 Notice**: This documentation is based on the original Flowise documentation and is currently being adapted for Universo Platformo. Some sections may still reference Flowise functionality that has not yet been fully updated for Universo Platformo-specific capabilities.

Complete user profile and authentication system with secure data management.

## System Overview

The profile management system consists of two main components:

- **Frontend (profile-frontend)**: User interface for profile management
- **Backend (profile-backend)**: Secure APIs and data management

## Frontend (profile-frontend)

Frontend module for user profile management and authentication in Universo Platformo.

### Key Features

- **Email Update**: Change user email address through Supabase authentication system
- **Secure Password Update**: Change user password with current password verification
- **Authentication Integration**: JWT token-based authentication with Supabase
- **Form Validation**: Client-side validation for email formats and password with confirmation
- **Error Handling**: Comprehensive error messages and user feedback with full internationalization
- **Internationalization**: Multi-language support (English/Russian) including server error translation
- **Security Features**: Current password verification, bcrypt hashing, minimum password requirements
- **Responsive Design**: Mobile-friendly user interface

### Authentication Architecture

#### Frontend Authentication Flow

The Profile component handles user authentication and profile updates through a secure token-based system:

1. **Token Storage**: JWT tokens stored in localStorage
2. **API Communication**: All requests include Authorization header with Bearer token
3. **Error Handling**: Graceful handling of authentication failures and validation errors
4. **User Feedback**: Real-time status updates during profile operations

### API Endpoints

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

## Backend (profile-backend)

Backend service for user profile management and authentication, implemented as a workspace package for clean integration and future modularity.

### Key Features

- **Profile Management**: Full CRUD operations for user profiles
- **Authentication Integration**: JWT token-based authentication with Supabase
- **Row-Level Security**: Database-level security with RLS policies
- **Automatic Profile Creation**: Profiles created automatically on user registration
- **SQL Functions**: Secure user data updates through SQL functions
- **TypeORM Integration**: Type-safe database operations
- **RESTful API**: Standard REST endpoints for profile operations
- **Error Handling**: Comprehensive error handling and validation

### Database Architecture

#### Profiles Table Schema

| Field        | Type         | Description                        |
| ------------ | ------------ | ---------------------------------- |
| `id`         | UUID         | Primary key (auto-generated)       |
| `user_id`    | UUID         | Foreign key to auth.users (unique) |
| `nickname`   | VARCHAR(50)  | User nickname (optional)           |
| `first_name` | VARCHAR(100) | User first name (optional)         |
| `last_name`  | VARCHAR(100) | User last name (optional)          |
| `created_at` | TIMESTAMP    | Creation timestamp                 |
| `updated_at` | TIMESTAMP    | Last update timestamp              |

### Security Features

- **Row-Level Security (RLS)**: Enabled for all operations
- **Access Policies**: Users can only view/modify their own profiles
- **Database Triggers**: Automatic profile creation on user registration
- **SQL Function Security**: `SECURITY DEFINER` privileges for secure operations

### SQL Functions

#### Automatic Profile Creation
```sql
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW());
    RETURN NEW;
END;
$$;
```

#### Update User Email
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

#### Secure Password Update
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
    user_id := auth.uid();
    SELECT verify_user_password(current_password) INTO is_valid_password;

    IF NOT is_valid_password THEN
        RAISE EXCEPTION 'Current password is incorrect';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = user_id;

    RETURN json_build_object('success', true, 'message', 'Password updated successfully');
END;
$$;
```

## Integration

### Workspace Package Integration

The profile service integrates with the core Flowise platform as a **workspace package**:

1. **Package Import**: Main server imports via `import { Profile, profileMigrations, createProfileRoutes } from '@universo/profile-backend'`
2. **Entity Integration**: Profile entity automatically included in main entity index
3. **Migration Integration**: Profile migrations included in PostgreSQL migration system via spread operator
4. **Route Integration**: Profile routes mounted at `/api/v1/profile` with authentication middleware
5. **Build System**: Automatic dependency resolution and build order via pnpm workspace
6. **Authentication**: Uses shared JWT authentication system

### Supabase Integration

- **Authentication**: Uses Supabase auth.users table
- **Row-Level Security**: Uses Supabase RLS policies
- **Real-time Features**: Supports Supabase real-time subscriptions
- **SQL Functions**: Custom SQL functions for secure operations

## Development

### Setup
```bash
# Install dependencies (from project root)
pnpm install

# Build workspace package
pnpm --filter @universo/profile-backend build
```

### Development Mode
```bash
# Development with watch mode
pnpm --filter @universo/profile-backend dev
```

### Build
```bash
# Clean build
pnpm --filter @universo/profile-backend clean
pnpm --filter @universo/profile-backend build
```

## Security Considerations

### Authentication and Authorization
- JWT token-based authentication
- Server-side token validation
- Operations restricted to authenticated user's data
- Separate admin-only endpoints with elevated permissions

### Database Security
- Row-level security for database-level access control
- SQL injection protection through parameterized queries and ORM protection
- Function security via `SECURITY DEFINER` for elevated database operations
- Data encryption with secure bcrypt password hashing

### API Security
- Comprehensive request validation
- Secure error messages without exposing sensitive data
- Built-in rate limiting protection
- Proper CORS handling for cross-origin requests

## Future Enhancements

- **Profile Images**: Avatar upload and management
- **Extended Fields**: Additional profile information fields
- **Profile Validation**: Advanced profile data validation rules
- **Audit Trail**: Profile change history and logging
- **Bulk Operations**: Batch profile operations for admin users
- **Search and Filtering**: Profile search and filtering capabilities
- **Profile Privacy**: Privacy settings and visibility controls

## Next Steps

- [UPDL System](../updl/README.md) - Explore the Universal Platform Definition Language
- [Publishing System](../publish/README.md) - Explore content publishing and sharing
- [Analytics System](../analytics/README.md) - Discover analytics capabilities
