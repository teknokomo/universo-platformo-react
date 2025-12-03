# Profile Frontend (`@universo/profile-frontend`)

> **📋 Notice**: This documentation is being adapted for Universo Platformo.

## Overview

Frontend for managing  user (email, password, settings).

## Technology Stack

- React 18 + TypeScript + Material-UI v5
- React Hook Form + Zod
- React Query
- i18next (EN/RU)

## Main Components

- **ProfileSettings**:  profile settings
- **PasswordChange**:  password
- **EmailUpdate**: Email update
- **AvatarUpload**:  

## Forms

```typescript
// Email update
const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

// Password change
const schema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(8),
  confirmPassword: z.string()
});
```

## Hooks

```typescript
const { profile, updateProfile } = useProfile();
const { changePassword } = usePasswordChange();
const { updateEmail } = useEmailUpdate();
```

## Related Documentation

- [Profile Backend](backend.md)
- [Profile Overview](README.md)
- [Auth](../auth/README.md)
