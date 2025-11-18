# Profile Service Backend (@universo/profile-srv)

> 🧬 **TypeScript-first** | Modern Express.js backend service for user profile management

Бэкенд-сервис для управления профилями пользователей и аутентификации в Universo Platformo с TypeORM интеграцией и Supabase аутентификацией.

## Информация о пакете

| Свойство          | Значение                 |
| ----------------- | ----------------------- |
| **Версия**        | `0.1.0`                 |
| **Тип пакета**    | Workspace Package       |
| **Статус**        | ✅ Активная разработка   |

### Ключевые особенности
- 🔐 JWT-аутентификация и управление профилями пользователей
- 🗄️ TypeORM интеграция с PostgreSQL через Supabase
- 🛡️ Row Level Security (RLS) для безопасности данных
- 🔄 Автоматическое создание профилей при регистрации
- 🧪 SQL-функции для безопасных операций с базой данных
- 📦 Workspace package архитектура для модульности

## Архитектура проекта

```
packages/profile-srv/base/
├── src/
│   ├── database/
│   │   ├── entities/
│   │   │   └── Profile.ts          # TypeORM сущность профиля
│   │   └── migrations/postgres/
│   │       ├── 1741277504477-AddProfile.ts  # Миграция базы данных
│   │       └── index.ts            # Экспорт миграций
│   ├── controllers/
│   │   └── profileController.ts   # REST API контроллеры
│   ├── services/
│   │   └── profileService.ts      # Бизнес-логика
│   ├── routes/
│   │   └── profileRoutes.ts       # Express маршруты
│   ├── types/
│   │   └── index.ts              # TypeScript типы
│   └── index.ts                  # Главная точка входа
├── package.json                  # Конфигурация пакета
└── tsconfig.json                # TypeScript конфигурация
```

## Использование

### Интеграция в основной сервер
```typescript
// В файле основного сервера (packages/flowise-server/src/index.ts)
import { Profile, profileMigrations, createProfileRoutes } from '@universo/profile-srv'

// Регистрация сущности
export { Profile } from '@universo/profile-srv'

// Включение миграций в основной массив
export const allMigrations = [
  ...existingMigrations,
  ...profileMigrations
]

// Подключение маршрутов
const profileRoutes = await createProfileRoutes()
app.use('/api/v1/profile', authenticate, profileRoutes)
```

### Использование сервиса профилей
```typescript
import { ProfileService } from '@universo/profile-srv'

const profileService = new ProfileService()

// Создание профиля
const newProfile = await profileService.createProfile({
  user_id: '123e4567-e89b-12d3-a456-426614174000',
  nickname: 'johndoe',
  first_name: 'Иван',
  last_name: 'Иванов'
})

// Получение профиля пользователя
const profile = await profileService.getUserProfile('user-id')

// Обновление профиля
const updatedProfile = await profileService.updateProfile('user-id', {
  first_name: 'Петр'
})
```

## API документация

### Эндпоинты профиля

#### Получить профиль пользователя
```http
GET /api/v1/profile/:userId
Authorization: Bearer <jwt_token>

# Успешный ответ
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "456e7890-e89b-12d3-a456-426614174000",
    "nickname": "ivan_petrov",
    "first_name": "Иван",
    "last_name": "Петров",
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T12:45:00Z"
  }
}
```

#### Обновить профиль
```http
PUT /api/v1/profile/:userId
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "nickname": "new_nickname",
  "first_name": "Новое",
  "last_name": "Имя"
}

# Успешный ответ
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "user_id": "456e7890-e89b-12d3-a456-426614174000",
    "nickname": "new_nickname",
    "first_name": "Новое",
    "last_name": "Имя",
    "updated_at": "2025-01-15T14:20:00Z"
  },
  "message": "Профиль успешно обновлен"
}
```

#### Аутентификационные эндпоинты
```http
# Обновление email
PUT /api/v1/auth/email
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "email": "newemail@example.com"
}

# Обновление пароля
PUT /api/v1/auth/password
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "currentPassword": "старыйПароль123",
  "newPassword": "новыйБезопасныйПароль456"
}
```

### Обработка ошибок
```typescript
// Примеры обработки различных типов ошибок
try {
  const profile = await profileService.getUserProfile('invalid-id')
} catch (error) {
  switch (error.message) {
    case 'Profile not found':
      // Профиль не найден
      res.status(404).json({ success: false, error: 'Профиль не найден' })
      break
    case 'Current password is incorrect':
      // Неверный текущий пароль
      res.status(400).json({ success: false, error: 'Текущий пароль неверен' })
      break
    default:
      // Общая ошибка сервера
      res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' })
  }
}
```

## Архитектура базы данных

### Схема таблицы Profile
```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nickname VARCHAR(50) UNIQUE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE UNIQUE INDEX idx_profiles_nickname ON profiles(nickname) WHERE nickname IS NOT NULL;
```

### SQL функции безопасности
```sql
-- Автоматическое создание профиля при регистрации
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, created_at, updated_at)
    VALUES (NEW.id, NOW(), NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Триггер для автоматического создания профиля
CREATE TRIGGER create_profile_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_user_profile();

-- Функция безопасного обновления пароля
CREATE OR REPLACE FUNCTION change_user_password_secure(
    current_password text,
    new_password text
) RETURNS json AS $$
DECLARE
    user_id uuid;
    is_valid_password boolean;
BEGIN
    user_id := auth.uid();
    
    -- Проверка текущего пароля
    SELECT verify_user_password(current_password) INTO is_valid_password;
    
    IF NOT is_valid_password THEN
        RAISE EXCEPTION 'Текущий пароль неверен';
    END IF;

    -- Обновление пароля с шифрованием
    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = user_id;

    RETURN json_build_object(
        'success', true, 
        'message', 'Пароль успешно обновлен'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Row Level Security (RLS)
```sql
-- Включение RLS на таблице профилей
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Политика: пользователи могут видеть только свои профили
CREATE POLICY profiles_user_policy ON profiles
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Политика для администраторов
CREATE POLICY profiles_admin_policy ON profiles
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE user_id = auth.uid() 
            AND is_admin = true
        )
    );
```

## Разработка

### Предварительные требования
- Node.js 18+
- pnpm 8+
- PostgreSQL 14+ (через Supabase)
- TypeScript 5+

### Доступные скрипты
```bash
# Разработка
pnpm build                      # Компиляция TypeScript
pnpm dev                        # Режим разработки с наблюдением
pnpm clean                      # Очистка dist/ директории

# Тестирование и проверка качества
pnpm lint                       # ESLint проверка
pnpm type-check                 # Проверка типов TypeScript
pnpm test                       # Выполнение тестов (если настроены)

# Workspace команды
pnpm --filter @universo/profile-srv build    # Сборка только этого пакета
pnpm --filter @universo/profile-srv lint     # Линтинг только этого пакета
```

### Структура конфигурации
```typescript
// tsconfig.json - строгая TypeScript конфигурация
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Процесс разработки
```bash
# 1. Установка зависимостей
pnpm install

# 2. Разработка с автоперезагрузкой
pnpm --filter @universo/profile-srv dev

# 3. В другом терминале, проверка типов
pnpm --filter @universo/profile-srv type-check

# 4. Линтинг перед коммитом
pnpm --filter @universo/profile-srv lint

# 5. Финальная сборка
pnpm --filter @universo/profile-srv build
```

## Тестирование

### Jest тестирование
```typescript
// Пример теста для ProfileService
import { ProfileService } from '../services/profileService'

describe('ProfileService', () => {
  let profileService: ProfileService

  beforeEach(() => {
    profileService = new ProfileService()
  })

  test('должен создать профиль пользователя', async () => {
    const profileData = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      nickname: 'testuser',
      first_name: 'Тест',
      last_name: 'Пользователь'
    }

    const result = await profileService.createProfile(profileData)
    
    expect(result).toBeDefined()
    expect(result.user_id).toBe(profileData.user_id)
    expect(result.nickname).toBe(profileData.nickname)
  })

  test('должен обработать ошибку при создании дублирующего никнейма', async () => {
    const profileData = {
      user_id: '123e4567-e89b-12d3-a456-426614174000',
      nickname: 'duplicate'
    }

    await expect(
      profileService.createProfile(profileData)
    ).rejects.toThrow('Nickname already exists')
  })
})
```

### Интеграционные тесты
```bash
# Запуск полного набора тестов
pnpm test

# Запуск тестов с покрытием
pnpm test -- --coverage

# Запуск конкретного теста
pnpm test -- --testNamePattern="ProfileService"
```

## Безопасность

### Аутентификация и авторизация
- **JWT валидация**: Все эндпоинты требуют действительный JWT токен
- **Контекст пользователя**: Операции ограничены данными аутентифицированного пользователя  
- **RLS политики**: Защита на уровне базы данных
- **Права администратора**: Специальные эндпоинты для админов

### Защита данных
- **Хеширование паролей**: bcrypt с генерацией соли
- **SQL-инъекции**: Защита через TypeORM параметризованные запросы
- **Валидация входных данных**: Проверка всех входящих данных
- **Безопасные функции**: Использование SECURITY DEFINER для SQL функций

### Рекомендации по безопасности
```typescript
// Пример безопасной обработки паролей
const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12
  return await bcrypt.hash(password, saltRounds)
}

// Валидация входных данных
const validateProfileData = (data: any) => {
  const errors = []
  
  if (data.nickname && data.nickname.length > 50) {
    errors.push('Никнейм не может быть длиннее 50 символов')
  }
  
  if (data.first_name && data.first_name.length > 100) {
    errors.push('Имя не может быть длиннее 100 символов')
  }
  
  return errors
}
```

## Интеграция и развертывание

### Переменные окружения
```bash
# Обязательные переменные
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your-super-secret-jwt-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# Опциональные
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
```

### Docker развертывание
```dockerfile
# Dockerfile для profile-srv
FROM node:18-alpine

WORKDIR /app

# Копирование package.json и установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование исходного кода и сборка
COPY . .
RUN npm run build

# Запуск приложения
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

### Мониторинг и логи
```typescript
// Настройка логирования
import winston from 'winston'

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

// Логирование операций профиля
logger.info('Profile created', { 
  userId: profile.user_id, 
  profileId: profile.id 
})
```

## Связанные пакеты
- [`@universo/profile-frt`](../profile-frt/base/README-RU.md) - Фронтенд для управления профилями
- [`@universo/auth-frt`](../auth-frt/base/README-RU.md) - Фронтенд аутентификации  
- [`@universo/types`](../universo-types/base/README-RU.md) - Общие TypeScript типы

---
*Часть [Universo Platformo](../../../README-RU.md) - Комплексная платформа управления мета-вселенными*
