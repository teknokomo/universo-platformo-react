# Бэкенд сервиса профилей (profile-srv)

Бэкенд-сервис для управления профилями пользователей и аутентификации в Universo Platformo.

## Структура проекта

Проект соответствует единой структуре для бэкенд-сервисов в монорепозитории:

```
apps/profile-srv/base/
├── package.json
├── tsconfig.json
└── src/
   ├── database/
   │  ├── entities/
   │  │  └── Profile.ts          # Сущность профиля TypeORM
   │  └── migrations/postgres/
   │     ├── 1741277504477-AddProfile.ts  # Миграция профиля
   │     └── index.ts            # Экспорт миграций
   ├── controllers/
   │  └── profileController.ts   # Контроллер REST API
   ├── services/
   │  └── profileService.ts      # Бизнес-логика
   ├── routes/
   │  └── profileRoutes.ts       # Маршруты Express
   ├── types/
   │  └── index.ts              # Типы TypeScript
   └── index.ts                 # Точка входа
```

## Функциональность

-   **Управление профилями**: Полные CRUD-операции для профилей пользователей
-   **Интеграция с аутентификацией**: Аутентификация на основе JWT-токенов с использованием Supabase
-   **Безопасность на уровне строк (RLS)**: Безопасность на уровне базы данных с политиками RLS
-   **Автоматическое создание профиля**: Профили создаются автоматически при регистрации пользователя
-   **SQL-функции**: Безопасное обновление данных пользователя через SQL-функции
-   **Интеграция с TypeORM**: Типобезопасные операции с базой данных
-   **RESTful API**: Стандартные REST-эндпоинты для операций с профилями
-   **Обработка ошибок**: Комплексная обработка ошибок и валидация

## Архитектура базы данных

### Схема таблицы профилей

| Поле         | Тип          | Описание                                    |
| ------------ | ------------ | ------------------------------------------- |
| `id`         | UUID         | Первичный ключ (автоматически генерируемый) |
| `user_id`    | UUID         | Внешний ключ к auth.users (уникальный)      |
| `nickname`   | VARCHAR(50)  | Псевдоним пользователя (необязательно)      |
| `first_name` | VARCHAR(100) | Имя пользователя (необязательно)            |
| `last_name`  | VARCHAR(100) | Фамилия пользователя (необязательно)        |
| `created_at` | TIMESTAMP    | Временная метка создания                    |
| `updated_at` | TIMESTAMP    | Временная метка последнего обновления       |

### Функции безопасности

-   **Безопасность на уровне строк (RLS)**: Включена для всех операций
-   **Политики доступа**: Пользователи могут просматривать/изменять только свои собственные профили
-   **Триггеры базы данных**: Автоматическое создание профиля при регистрации пользователя
-   **Безопасность SQL-функций**: Привилегии `SECURITY DEFINER` для безопасных операций

### Функции базы данных

Система профилей включает SQL-функции для безопасного управления данными пользователей:

**Автоматическое создание профиля:**

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

**Обновление email пользователя:**

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

**Проверка пароля:**

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

**Безопасное обновление пароля:**

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
        RAISE EXCEPTION 'Текущий пароль неверен';
    END IF;

    UPDATE auth.users
    SET encrypted_password = crypt(new_password, gen_salt('bf'))
    WHERE id = user_id;

    RETURN json_build_object('success', true, 'message', 'Пароль успешно обновлен');
END;
$$;
```

## API Эндпоинты

### Операции с профилями

Сервис предоставляет RESTful API эндпоинты для управления профилями:

#### Получить профиль пользователя

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

#### Создать профиль

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
  "message": "Профиль успешно создан"
}
```

#### Обновить профиль

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
  "message": "Профиль успешно обновлен"
}
```

#### Удалить профиль

```
DELETE /api/profile/:userId
Headers: Authorization: Bearer <jwt_token>
Response: {
  "success": true,
  "message": "Профиль успешно удален"
}
```

#### Получить все профили (Администратор)

```
GET /api/profiles
Headers: Authorization: Bearer <admin_jwt_token>
Response: {
  "success": true,
  "data": [ ... ],
  "message": "Профили успешно получены"
}
```

## Типы TypeScript

Сервис использует строго типизированные интерфейсы для всех операций:

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

## Архитектура сервиса

### Слой сервиса профилей

Класс `ProfileService` обрабатывает всю бизнес-логику:

-   **Проверки существования профиля**: Проверка существования профиля перед выполнением операций
-   **CRUD-операции**: Создание, чтение, обновление, удаление профилей
-   **Валидация данных**: Валидация и очистка входных данных
-   **Обработка ошибок**: Комплексное управление ошибками
-   **Транзакции базы данных**: Атомарные операции для обеспечения согласованности данных

### Слой контроллера

`ProfileController` обрабатывает HTTP-запросы и ответы:

-   **Парсинг запросов**: Извлечение и валидация данных запроса
-   **Аутентификация**: Валидация JWT-токенов
-   **Интеграция с сервисами**: Делегирование бизнес-логики сервисному слою
-   **Форматирование ответов**: Стандартизированные ответы API
-   **Обработка ошибок**: Коды ошибок HTTP и сообщения

### Конфигурация маршрутов

Маршруты Express настроены для всех эндпоинтов профиля:

-   **Интеграция Middleware**: Middleware для аутентификации и валидации
-   **Параметры маршрута**: Динамические параметры маршрута для идентификации пользователя
-   **Методы HTTP**: Операции GET, POST, PUT, DELETE
-   **Обработка ошибок**: Обработка ошибок на уровне маршрута

## Интеграция

### Интеграция с платформой Flowise

Сервис профилей без проблем интегрируется с основной платформой Flowise:

1.  **Интеграция сущностей**: Сущность профиля автоматически включается в основной индекс сущностей
2.  **Интеграция миграций**: Миграции профилей включены в систему миграций PostgreSQL
3.  **Система сборки**: Включено в процесс сборки монорепозитория
4.  **Аутентификация**: Использует общую систему аутентификации JWT

### Интеграция с Supabase

-   **Аутентификация**: Использует таблицу auth.users Supabase
-   **Безопасность на уровне строк**: Использует политики RLS Supabase
-   **Функции реального времени**: Поддерживает подписки реального времени Supabase
-   **SQL-функции**: Пользовательские SQL-функции для безопасных операций

## Разработка

### Установка

```bash
# Установка зависимостей
pnpm install

# Сборка сервиса
pnpm --filter profile-srv build
```

### Режим разработки

```bash
# Разработка с режимом отслеживания
pnpm --filter profile-srv dev
```

### Сборка

```bash
# Чистая сборка
pnpm --filter profile-srv clean
pnpm --filter profile-srv build
```

### Тестирование

```bash
# Запуск линтинга
pnpm --filter profile-srv lint
```

## Зависимости

### Производственные зависимости

-   **express**: ^4.18.2 - Веб-фреймворк для Node.js
-   **typeorm**: ^0.3.20 - TypeScript ORM для операций с базой данных
-   **typescript**: ^5.4.5 - Поддержка языка TypeScript
-   **@supabase/supabase-js**: ^2.39.0 - Клиентская библиотека Supabase

### Зависимости для разработки

-   **@types/express**: ^4.17.21 - Типы TypeScript для Express
-   **@types/node**: ^20.11.17 - Типы TypeScript для Node.js
-   **eslint**: ^8.56.0 - Линтинг и форматирование кода
-   **rimraf**: ^5.0.5 - Кроссплатформенная утилита rm -rf

## Вопросы безопасности

### Аутентификация и авторизация

-   **JWT-токены**: Безопасная аутентификация на основе токенов
-   **Валидация токенов**: Проверка токенов на стороне сервера
-   **Контекст пользователя**: Операции ограничены данными аутентифицированного пользователя
-   **Эндпоинты администратора**: Отдельные эндпоинты только для администраторов с повышенными правами

### Безопасность базы данных

-   **Безопасность на уровне строк**: Контроль доступа на уровне базы данных
-   **Защита от SQL-инъекций**: Параметризованные запросы и защита ORM
-   **Безопасность функций**: `SECURITY DEFINER` для повышенных операций с базой данных
-   **Шифрование данных**: Безопасное хеширование паролей с помощью bcrypt

### Безопасность API

-   **Валидация ввода**: Комплексная валидация запросов
-   **Обработка ошибок**: Безопасные сообщения об ошибках без раскрытия конфиденциальных данных
-   **Ограничение скорости**: Встроенная защита от злоупотреблений
-   **Конфигурация CORS**: Правильная обработка междоменных запросов

## Развертывание

### Процесс сборки

Сервис компилируется в стандартный JavaScript для развертывания:

1.  **Компиляция TypeScript**: Преобразует TypeScript в JavaScript
2.  **Определения типов**: Генерирует файлы .d.ts для проверки типов
3.  **Управление ресурсами**: Копирует необходимые файлы в каталог dist
4.  **Чистая сборка**: Удаляет предыдущие артефакты сборки

### Конфигурация среды

-   **Подключение к базе данных**: Настраивается через переменные окружения
-   **Секреты JWT**: Безопасная конфигурация подписи токенов
-   **Конфигурация Supabase**: API-ключи и настройки проекта
-   **Конфигурация порта**: Настраиваемый порт сервиса

## Мониторинг и логирование

-   **Логирование запросов**: Все запросы API логируются для мониторинга
-   **Отслеживание ошибок**: Комплексное логирование и отслеживание ошибок
-   **Метрики производительности**: Мониторинг времени отклика и пропускной способности
-   **Запросы к базе данных**: Отслеживание производительности и оптимизация запросов

## Будущие улучшения

-   **Изображения профиля**: Загрузка и управление аватарами
-   **Расширенные поля**: Дополнительные поля информации о профиле
-   **Валидация профиля**: Расширенные правила валидации данных профиля
-   **Аудиторский след**: История изменений профиля и логирование
-   **Массовые операции**: Пакетные операции с профилями для администраторов
-   **Поиск и фильтрация**: Возможности поиска и фильтрации профилей
-   **Приватность профиля**: Настройки приватности и видимости профиля

---

**Автор**: Владимир Левадный и Teknokomo  
**Лицензия**: Omsk Open License  
**Версия**: 0.1.0

_Universo Platformo | Бэкенд сервиса профилей_
