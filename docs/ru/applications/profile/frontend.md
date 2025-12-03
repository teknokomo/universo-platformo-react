# Profile Frontend (`@universo/profile-frontend`)

> **📋 Уведомление**: Данная документация адаптируется для Universo Platformo.

## Обзор

Frontend для управления профилем пользователя (email, password, настройки).

## Технологический стек

- React 18 + TypeScript + Material-UI v5
- React Hook Form + Zod
- React Query
- i18next (EN/RU)

## Основные компоненты

- **ProfileSettings**: Общие настройки профиля
- **PasswordChange**: Изменение пароля
- **EmailUpdate**: Обновление email
- **AvatarUpload**: Загрузка аватара

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

## Связанная документация

- [Profile Backend](backend.md)
- [Profile Overview](README.md)
- [Auth](../auth/README.md)
