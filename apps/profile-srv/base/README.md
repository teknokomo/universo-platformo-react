# Profile Service Backend (profile-srv)

Backend service for user profile management and authentication in Universo Platformo.

## Project Structure

The project follows a unified structure for backend services in the monorepo:

```
apps/profile-srv/base/
├── package.json
├── tsconfig.json
└── src/
   ├── database/
   │  ├── entities/
   │  │  └── Profile.ts          # TypeORM profile entity
   │  └── migrations/postgres/
   │     ├── 1741277504477-AddProfile.ts  # Profile migration
   │     └── index.ts            # Migration exports
   ├── controllers/
   │  └── profileController.ts   # REST API controller
   ├── services/
   │  └── profileService.ts      # Business logic
   ├── routes/
   │  └── profileRoutes.ts       # Express routes
   ├── types/
   │  └── index.ts              # TypeScript types
   └── index.ts                 # Entry point
```

## Features

-   **Profile Management**: Complete CRUD operations for user profiles
-   **Authentication Integration**: JWT token-based authentication with Supabase
-   **Row Level Security**: Database-level security with RLS policies
-   **Automatic Profile Creation**: Profiles created automatically on user registration
-   **SQL Functions**: Secure user data updates through SQL functions
-   **TypeORM Integration**: Type-safe database operations
-   **RESTful API**: Standard REST endpoints for profile operations
-   **Error Handling**: Comprehensive error handling and validation

## Database Architecture

### Profile Table Schema

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

-   **Row Level Security (RLS)**: Enabled for all operations
-   **Access Policies**: Users can only view/modify their own profiles
-   **Database Triggers**: Automatic profile creation on user registration
-   **SQL Function Security**: `SECURITY DEFINER` privileges for secure operations

### Database Functions

The profile system includes SQL functions for secure user data management:

**Automatic Profile Creation:**

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

**User Email Update:**

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

**Password Verification:**

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

**Secure Password Update:**

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

## API Endpoints

### Profile Operations

The service provides RESTful API endpoints for profile management:

#### Get User Profile

```
GET /api/profile/:userId
Headers: Authorization: Bearer <jwt_token>
Response: {
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "nickname": "string",
    "first_name": "string",
    "last_name": "string",
    "created_at": "timestamp",
    "updated_at": "timestamp"
  }
}
```

#### Create Profile

```
POST /api/profile
Headers: Authorization: Bearer <jwt_token>
Body: {
  "user_id": "uuid",
  "nickname": "string",
  "first_name": "string",
  "last_name": "string"
}
Response: {
  "success": true,
  "data": { ... },
  "message": "Profile created successfully"
}
```

#### Update Profile

```
PUT /api/profile/:userId
Headers: Authorization: Bearer <jwt_token>
Body: {
  "nickname": "string",
  "first_name": "string",
  "last_name": "string"
}
Response: {
  "success": true,
  "data": { ... },
  "message": "Profile updated successfully"
}
```

#### Delete Profile

```
DELETE /api/profile/:userId
Headers: Authorization: Bearer <jwt_token>
Response: {
  "success": true,
  "message": "Profile deleted successfully"
}
```

#### Get All Profiles (Admin)

```
GET /api/profiles
Headers: Authorization: Bearer <admin_jwt_token>
Response: {
  "success": true,
  "data": [ ... ],
  "message": "Profiles retrieved successfully"
}
```

## TypeScript Types

The service uses strongly typed interfaces for all operations:

```typescript
interface CreateProfileDto {
    user_id: string
    nickname?: string
    first_name?: string
    last_name?: string
}

interface UpdateProfileDto {
    nickname?: string
    first_name?: string
    last_name?: string
}

interface ProfileResponse {
    id: string
    user_id: string
    nickname?: string
    first_name?: string
    last_name?: string
    created_at: Date
    updated_at: Date
}

interface ApiResponse<T = any> {
    success: boolean
    data?: T
    message?: string
    error?: string
}
```

## Service Architecture

### Profile Service Layer

The `ProfileService` class handles all business logic:

-   **Profile Existence Checks**: Verify profile exists before operations
-   **CRUD Operations**: Create, read, update, delete profiles
-   **Data Validation**: Input validation and sanitization
-   **Error Handling**: Comprehensive error management
-   **Database Transactions**: Atomic operations for data consistency

### Controller Layer

The `ProfileController` handles HTTP requests and responses:

-   **Request Parsing**: Extract and validate request data
-   **Authentication**: JWT token validation
-   **Service Integration**: Delegate business logic to service layer
-   **Response Formatting**: Standardized API responses
-   **Error Handling**: HTTP error codes and messages

### Route Configuration

Express routes are configured for all profile endpoints:

-   **Middleware Integration**: Authentication and validation middleware
-   **Route Parameters**: Dynamic route parameters for user identification
-   **HTTP Methods**: GET, POST, PUT, DELETE operations
-   **Error Handling**: Route-level error handling

## Integration

### Flowise Platform Integration

The profile service integrates seamlessly with the main Flowise platform:

1. **Entity Integration**: Profile entity automatically included in main entities index
2. **Migration Integration**: Profile migrations included in PostgreSQL migration system
3. **Build System**: Included in monorepo build process
4. **Authentication**: Uses shared JWT authentication system

### Supabase Integration

-   **Authentication**: Leverages Supabase auth.users table
-   **Row Level Security**: Uses Supabase RLS policies
-   **Real-time Features**: Supports Supabase real-time subscriptions
-   **SQL Functions**: Custom SQL functions for secure operations

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Build the service
pnpm --filter profile-srv build
```

### Development Mode

```bash
# Development with watch mode
pnpm --filter profile-srv dev
```

### Building

```bash
# Clean build
pnpm --filter profile-srv clean
pnpm --filter profile-srv build
```

### Testing

```bash
# Run linting
pnpm --filter profile-srv lint
```

## Dependencies

### Production Dependencies

-   **express**: ^4.18.2 - Web framework for Node.js
-   **typeorm**: ^0.3.20 - TypeScript ORM for database operations
-   **typescript**: ^5.4.5 - TypeScript language support
-   **@supabase/supabase-js**: ^2.39.0 - Supabase client library

### Development Dependencies

-   **@types/express**: ^4.17.21 - TypeScript types for Express
-   **@types/node**: ^20.11.17 - TypeScript types for Node.js
-   **eslint**: ^8.56.0 - Code linting and formatting
-   **rimraf**: ^5.0.5 - Cross-platform rm -rf utility

## Security Considerations

### Authentication & Authorization

-   **JWT Tokens**: Secure token-based authentication
-   **Token Validation**: Server-side token verification
-   **User Context**: Operations limited to authenticated user's data
-   **Admin Endpoints**: Separate admin-only endpoints with elevated permissions

### Database Security

-   **Row Level Security**: Database-level access control
-   **SQL Injection Protection**: Parameterized queries and ORM protection
-   **Function Security**: `SECURITY DEFINER` for elevated database operations
-   **Data Encryption**: Secure password hashing with bcrypt

### API Security

-   **Input Validation**: Comprehensive request validation
-   **Error Handling**: Secure error messages without sensitive data exposure
-   **Rate Limiting**: Built-in protection against abuse
-   **CORS Configuration**: Proper cross-origin request handling

## Deployment

### Build Process

The service compiles to standard JavaScript for deployment:

1. **TypeScript Compilation**: Converts TypeScript to JavaScript
2. **Type Definitions**: Generates .d.ts files for type checking
3. **Asset Management**: Copies necessary files to dist directory
4. **Clean Build**: Removes previous build artifacts

### Environment Configuration

-   **Database Connection**: Configured through environment variables
-   **JWT Secrets**: Secure token signing configuration
-   **Supabase Configuration**: API keys and project settings
-   **Port Configuration**: Configurable service port

## Monitoring & Logging

-   **Request Logging**: All API requests logged for monitoring
-   **Error Tracking**: Comprehensive error logging and tracking
-   **Performance Metrics**: Response time and throughput monitoring
-   **Database Queries**: Query performance and optimization tracking

## Future Enhancements

-   **Profile Pictures**: Avatar upload and management
-   **Extended Fields**: Additional profile information fields
-   **Profile Validation**: Advanced profile data validation rules
-   **Audit Trail**: Profile change history and logging
-   **Bulk Operations**: Batch profile operations for admin users
-   **Search & Filtering**: Profile search and filtering capabilities
-   **Profile Privacy**: Privacy settings and visibility controls

---

**Author**: Vladimir Levadnij and Teknokomo  
**License**: Omsk Open License  
**Version**: 0.1.0

_Universo Platformo | Profile Service Backend_
