# Profile Backend (`@universo/profile-backend`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Backend for managing  user via Supabase auth.

## REST API

```
GET    /api/v1/profile
PATCH  /api/v1/profile
POST   /api/v1/profile/change-password
POST   /api/v1/profile/update-email
POST   /api/v1/profile/upload-avatar
```

## Request Examples

**Update Profile:**
```json
POST /api/v1/profile
{
  "displayName": "John Doe",
  "bio": "Developer",
  "metadata": {...}
}
```

**Change Password:**
```json
POST /api/v1/profile/change-password
{
  "currentPassword": "old123",
  "newPassword": "new456"
}
```

## Integration with Supabase Auth

```typescript
import { supabase } from '@universo/flowise-server';

async function updateEmail(userId: string, newEmail: string) {
  const { error } = await supabase.auth.updateUser({
    email: newEmail
  });
  
  if (error) throw error;
}
```

## Related Documentation

- [Profile Frontend](frontend.md)
- [Profile Overview](README.md)
