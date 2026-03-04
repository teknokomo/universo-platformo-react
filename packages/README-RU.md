# Каталог приложений Universo Platformo

Здесь расположены модульные приложения и общие библиотеки Universo Platformo, обеспечивающие дополнительную функциональность в модульной архитектуре.

## Текущая структура

```
packages/
├── admin-backend/            # Бекенд панели администрирования
│   └── base/            # Ключевая функциональность бекенда администрирования
│       ├── src/         # Исходный код
│       │   ├── database/ # TypeORM сущности и миграции
│       │   ├── guards/  # Гуарды авторизации
│       │   ├── routes/  # Express роуты для операций администрирования
│       │   ├── schemas/ # Схемы валидации
│       │   ├── services/ # Бизнес-логика
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── admin-frontend/           # Фронтенд панели администрирования
│   └── base/            # Ключевая функциональность фронтенда администрирования
│       ├── src/         # Исходный код
│       │   ├── api/     # API клиенты
│       │   ├── components/ # UI компоненты администрирования
│       │   ├── hooks/   # React хуки
│       │   ├── i18n/    # Интернационализация
│       │   ├── pages/   # Компоненты страниц
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── applications-backend/     # Бекенд управления приложениями
│   └── base/            # Ключевая функциональность бекенда приложений
│       ├── src/         # Исходный код
│       │   ├── database/ # TypeORM сущности и миграции
│       │   ├── routes/  # Express роуты
│       │   ├── schemas/ # Схемы валидации
│       │   ├── services/ # Бизнес-логика
│       │   ├── tests/   # Тестовые файлы
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── applications-frontend/    # Фронтенд управления приложениями
│   └── base/            # Ключевая функциональность фронтенда приложений
│       ├── src/         # Исходный код
│       │   ├── api/     # API клиенты
│       │   ├── components/ # UI компоненты приложений
│       │   ├── hooks/   # React хуки
│       │   ├── i18n/    # Интернационализация
│       │   ├── pages/   # Компоненты страниц
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── apps-template-mui/        # Шаблон приложений MUI с общими макетами и темами
│       ├── src/         # Исходный код
│       │   ├── components/ # Общие MUI компоненты
│       │   ├── layouts/ # Компоненты макетов
│       │   ├── shared-theme/ # Конфигурации тем
│       │   └── index.ts # Точка входа
│       ├── package.json
│       └── README.md
├── auth-backend/             # Passport.js + Supabase сессии бекенд
│   └── base/            # Ключевая функциональность бекенда аутентификации
│       ├── src/         # Исходный код
│       │   ├── middleware/ # Стратегии Passport и обработчики сессий
│       │   ├── routes/  # Роуты аутентификации (login, logout, session)
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── auth-frontend/            # UI примитивы аутентификации
│   └── base/            # Ключевая функциональность UI аутентификации
│       ├── src/         # Исходный код
│       │   ├── components/ # Компоненты аутентификации (LoginForm, SessionGuard)
│       │   ├── hooks/   # React хуки для аутентификации
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── metahubs-backend/         # Бекенд управления MetaHubs
│   └── base/            # Ключевая функциональность бекенда MetaHubs
│       ├── src/         # Исходный код
│       │   ├── database/ # TypeORM сущности и миграции
│       │   ├── domains/ # Модули доменной логики
│       │   ├── services/ # Бизнес-логика
│       │   ├── tests/   # Тестовые файлы
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── metahubs-frontend/        # Фронтенд управления MetaHubs
│   └── base/            # Ключевая функциональность фронтенда MetaHubs
│       ├── src/         # Исходный код
│       │   ├── components/ # UI компоненты MetaHubs
│       │   ├── domains/ # Доменные модули функциональности
│       │   ├── hooks/   # React хуки
│       │   ├── i18n/    # Интернационализация
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── migration-guard-shared/   # Общие утилиты миграционной защиты
│   └── base/            # Ключевая функциональность миграционной защиты
│       ├── src/         # Исходный код
│       │   ├── MigrationGuardShell.tsx # Компонент оболочки защиты
│       │   ├── utils.ts # Утилитарные функции
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── profile-backend/          # Бекенд управления профилем пользователя
│   └── base/            # Ключевая функциональность профиля
│       ├── src/         # Исходный код
│       │   ├── routes/  # Express роуты для операций с профилем
│       │   ├── database/ # TypeORM сущности и миграции
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       ├── README.md
│       └── README-RU.md
├── profile-frontend/         # Фронтенд управления профилем пользователя
│   └── base/            # Ключевая функциональность профиля
│       ├── src/         # Исходный код
│       │   ├── i18n/    # Локализация
│       │   ├── pages/   # Компоненты страниц
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       ├── README.md
│       └── README-RU.md
├── schema-ddl/               # Утилиты Schema DDL
│   └── base/            # Ключевая функциональность Schema DDL
│       ├── src/         # Исходный код
│       │   ├── SchemaGenerator.ts # Генерация схем в рантайме
│       │   ├── SchemaMigrator.ts  # Логика миграции схем
│       │   ├── diff.ts  # Вычисление различий схем
│       │   ├── __tests__/ # Тестовые файлы
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── start-backend/            # Бекенд онбординга/стартовой страницы
│   └── base/            # Ключевая функциональность бекенда стартовой страницы
│       ├── src/         # Исходный код
│       │   ├── routes/  # Express роуты
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── start-frontend/           # Фронтенд онбординга/стартовой страницы
│   └── base/            # Ключевая функциональность фронтенда стартовой страницы
│       ├── src/         # Исходный код
│       │   ├── api/     # API клиенты
│       │   ├── components/ # UI компоненты стартовой страницы
│       │   ├── hooks/   # React хуки
│       │   ├── i18n/    # Интернационализация
│       │   ├── views/   # Компоненты отображения
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-api-client/      # TypeScript API клиент
│   └── base/            # Ключевая функциональность API клиента
│       ├── src/         # Исходный код
│       │   ├── clients/ # Реализации API клиентов
│       │   ├── types/   # Типы запросов/ответов
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-core-backend/    # Основной бекенд-сервер (бывший flowise-server)
│   └── base/            # Ключевая функциональность бекенда
│       ├── src/         # Исходный код
│       │   ├── database/ # TypeORM сущности и миграции
│       │   ├── routes/  # API роуты
│       │   ├── middlewares/ # Express мидлвары
│       │   ├── utils/   # Утилитарные функции
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-core-frontend/   # Основной фронтенд UI (бывший flowise-ui)
│   └── base/            # Ключевая функциональность фронтенда
│       ├── src/         # Исходный код
│       │   ├── components/ # React компоненты
│       │   ├── api/     # API клиенты
│       │   └── index.jsx # Точка входа
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-i18n/            # Централизованный экземпляр i18n
│   └── base/            # Ключевая функциональность i18n
│       ├── src/         # Исходный код
│       │   ├── locales/ # Файлы переводов
│       │   ├── i18n.ts  # Конфигурация i18next
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-rest-docs/       # Сервер документации API
│       ├── src/         # Исходный код
│       │   ├── swagger/ # Спецификации OpenAPI
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-store/           # Общее Redux хранилище (бывший flowise-store)
│   └── base/            # Конфигурация Redux хранилища
│       ├── src/         # Исходный код
│       │   ├── reducers/ # Redux редюсеры
│       │   ├── context/ # React контекст
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-template-mui/    # Реализация шаблона Material-UI
│   └── base/            # Ключевая функциональность шаблона MUI
│       ├── src/         # Исходный код
│       │   ├── layouts/ # Компоненты макетов
│       │   ├── themes/  # Конфигурации тем
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-types/           # Общие TypeScript типы и интерфейсы
│   └── base/            # Основные определения типов
│       ├── src/         # Исходный код
│       │   ├── interfaces/ # Платформенные интерфейсы
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-utils/           # Общие утилиты и процессоры
│   └── base/            # Основные утилитарные функции
│       ├── src/         # Исходный код
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
└── README.md                 # Данная документация
```

## Приложения

### Основные пакеты платформы

#### Universo Core Backend (@universo/core-backend)

Основной бекенд-сервер Universo Platformo, предоставляющий API эндпоинты, управление базой данных и бизнес-логику.

**Ключевые возможности:**

-   REST API на основе Express
-   Интеграция TypeORM для PostgreSQL
-   Интеграция аутентификации Supabase
-   Система регистрации сущностей и миграций
-   Асинхронная инициализация роутов

**Документация:** См. [packages/universo-core-backend/base/README.md](./universo-core-backend/base/README.md)

#### Universo Core Frontend (@universo/core-frontend)

Основное React фронтенд-приложение.

**Ключевые возможности:**

-   Библиотека компонентов Material-UI
-   Выполнение потоков в реальном времени
-   Управление учётными данными и конфигурацией
-   Поддержка множественных рабочих пространств

**Документация:** См. [packages/universo-core-frontend/base/README.md](./universo-core-frontend/base/README.md)

### Общие инфраструктурные пакеты

#### Universo Store (@universo/store)

Общая конфигурация Redux хранилища для приложений Universo Platformo.

**Ключевые возможности:**

-   Централизованное управление состоянием
-   Redux редюсеры и контекст
-   Переиспользуемая логика состояния между фронтенд-пакетами
-   Поддержка TypeScript

**Документация:** См. [packages/universo-store/base/README.md](./universo-store/base/README.md)

#### Universo Platformo Types (@universo/types)

Общий пакет, содержащий все определения типов TypeScript и интерфейсы, используемые на платформе.

**Ключевые возможности:**

-   **Платформенные интерфейсы**: Общие типы для всех операций платформы
-   **Двойная система сборки**: Компилируется в CommonJS и ES модули для максимальной совместимости
-   **Только типы**: Чистые определения TypeScript без runtime зависимостей

**Документация:** См. [packages/universo-types/base/README.md](./universo-types/base/README.md)

#### Universo Platformo Utils (@universo/utils)

Общий пакет, содержащий утилитарные функции и процессоры, используемые в нескольких приложениях.

**Ключевые возможности:**

-   Общие утилитарные функции для операций платформы
-   **Двойная система сборки**: Компилируется в CommonJS и ES модули (tsdown)

**Документация:** См. [packages/universo-utils/base/README.md](./universo-utils/base/README.md)

#### Universo API Client (@universo/api-client)

TypeScript API клиент для бекенд-сервисов Universo Platformo.

**Ключевые возможности:**

-   Типобезопасные API клиенты для всех бекенд-сервисов
-   HTTP коммуникация на основе Axios
-   Определения типов запросов/ответов
-   Обработка ошибок и логика повторов
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/universo-api-client/base/README.md](./universo-api-client/base/README.md)

#### Universo i18n (@universo/i18n)

Централизованный экземпляр i18next для интернационализации всех пакетов Universo Platformo.

**Ключевые возможности:**

-   Общая конфигурация i18next
-   Управление файлами переводов
-   Определение и переключение языков
-   Поддержка пространств имён для модульных переводов

**Документация:** См. [packages/universo-i18n/base/README.md](./universo-i18n/base/README.md)

#### Universo Template MUI (@universo/template-mui)

Реализация шаблона Material-UI для React приложений Universo Platformo.

**Ключевые возможности:**

-   Переиспользуемые компоненты макетов
-   Единообразные конфигурации тем
-   Паттерны отзывчивого дизайна
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/universo-template-mui/base/README.md](./universo-template-mui/base/README.md)

#### Apps Template MUI (@universo/apps-template-mui)

Шаблон приложений на основе MUI с общими макетами, темами и компонентами дашбордов.

**Ключевые возможности:**

-   Макеты дашбордов и CRUD
-   Общие конфигурации тем MUI
-   Инфраструктура маршрутизации
-   Шаблоны блога и маркетинговых страниц

**Документация:** См. [packages/apps-template-mui/README.md](./apps-template-mui/README.md)

#### Universo REST Docs (@universo/rest-docs)

Сервер документации API с использованием спецификаций OpenAPI/Swagger.

**Ключевые возможности:**

-   Интерактивная документация API
-   Спецификации OpenAPI 3.0
-   Интеграция Swagger UI
-   Автоматическая генерация из TypeScript типов

**Документация:** См. [packages/universo-rest-docs/README.md](./universo-rest-docs/README.md)

#### Schema DDL (@universo/schema-ddl)

Утилиты Schema DDL для генерации схем в рантайме, миграции и вычисления различий.

**Ключевые возможности:**

-   Генерация схем в рантайме (SchemaGenerator)
-   Логика миграции схем (SchemaMigrator)
-   Вычисление различий схем
-   Утилиты блокировки и снимков базы данных

**Документация:** См. [packages/schema-ddl/base/README.md](./schema-ddl/base/README.md)

#### Migration Guard Shared (@universo/migration-guard-shared)

Общие утилиты и компоненты миграционной защиты для MetaHubs и приложений.

**Ключевые возможности:**

-   React компонент MigrationGuardShell
-   Утилиты запросов статуса миграции
-   Логика определения серьёзности
-   Общий для модулей metahubs и applications

**Документация:** См. [packages/migration-guard-shared/base/README.md](./migration-guard-shared/base/README.md)

### Система аутентификации

#### Auth Frontend (@universo/auth-frontend)

Общие UI примитивы аутентификации для Universo Platformo.

**Ключевые возможности:**

-   LoginForm, SessionGuard и другие компоненты аутентификации
-   React хуки для состояния аутентификации
-   UI сессионной аутентификации
-   Интеграция с Supabase auth
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/auth-frontend/base/README.md](./auth-frontend/base/README.md)

#### Auth Server (@universo/auth-backend)

Набор инструментов Passport.js + Supabase сессии для бекенд-аутентификации.

**Ключевые возможности:**

-   Стратегии Passport.js (local, JWT)
-   Управление сессиями Supabase
-   Middleware сессий для Express
-   Роуты login, logout и валидации сессий
-   Двойная система сборки (tsdown): CJS + ESM

**Документация:** См. [packages/auth-backend/base/README.md](./auth-backend/base/README.md)

### Доменные модули

#### Admin (Глобальное управление пользователями)

Приложение Admin обеспечивает функциональность глобального управления пользователями для администраторов платформы. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Admin Frontend (@universo/admin-frontend)

**Ключевые возможности:**

-   Интерфейс глобального управления пользователями
-   UI панели администрирования с компонентами Material-UI
-   Поддержка интернационализации
-   Операции администрирования через API

**Документация:** См. [packages/admin-frontend/base/README.md](./admin-frontend/base/README.md)

##### Admin Server (@universo/admin-backend)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/admin-backend`), отвечающий за операции глобального управления пользователями.

**Ключевые возможности:**

-   Express роуты для CRUD операций администрирования
-   TypeORM сущности для управления данными администрирования
-   Гуарды авторизации для контроля доступа администратора
-   Схемы валидации входных данных

**Документация:** См. [packages/admin-backend/base/README.md](./admin-backend/base/README.md)

#### Applications

Модуль Applications обеспечивает функциональность управления жизненным циклом приложений. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Applications Frontend (@universo/applications-frontend)

**Ключевые возможности:**

-   Интерфейс создания и управления приложениями
-   Перечень приложений с интеграцией в меню
-   Отзывчивый дизайн с компонентами Material-UI
-   Поддержка интернационализации (английский и русский)
-   Комплексное покрытие тестами

**Документация:** См. [packages/applications-frontend/base/README.md](./applications-frontend/base/README.md)

##### Applications Server (@universo/applications-backend)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/applications-backend`), отвечающий за обработку данных и операций приложений.

**Ключевые возможности:**

-   Express роуты для CRUD операций приложений
-   TypeORM сущности для управления БД
-   Схемы валидации
-   Покрытие тестами с Jest

**Документация:** См. [packages/applications-backend/base/README.md](./applications-backend/base/README.md)

#### MetaHubs

Приложение MetaHubs обеспечивает функциональность управления метахабами, включая управление схемами, настройками и перечислениями. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### MetaHubs Frontend (@universo/metahubs-frontend)

**Ключевые возможности:**

-   UI управления MetaHub с доменно-ориентированной архитектурой
-   Управление схемами, настройками и перечислениями
-   Отзывчивый дизайн с Material-UI
-   Поддержка интернационализации
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/metahubs-frontend/base/README.md](./metahubs-frontend/base/README.md)

##### MetaHubs Server (@universo/metahubs-backend)

Это бекенд-сервис для управления MetaHub.

**Ключевые возможности:**

-   Доменно-ориентированная сервисная архитектура
-   TypeORM сущности для данных MetaHub
-   Миграции базы данных PostgreSQL
-   Покрытие тестами с Jest

**Документация:** См. [packages/metahubs-backend/base/README.md](./metahubs-backend/base/README.md)

#### Profile

Приложение Profile обеспечивает функциональность управления профилем пользователя. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Profile Frontend (@universo/profile-frontend)

**Ключевые возможности:**

-   JWT token-based аутентификация с Supabase
-   Функциональность обновления email и пароля
-   Мобильно-дружественный отзывчивый дизайн
-   Поддержка интернационализации (английский и русский)

**Документация:** См. [packages/profile-frontend/base/README.md](./profile-frontend/base/README.md)

##### Profile Server (@universo/profile-backend)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/profile-backend`), отвечающий за безопасную обработку данных профиля пользователя.

**Ключевые возможности:**

-   Безопасные эндпоинты для управления данными пользователя
-   Использует пользовательские SQL функции с `SECURITY DEFINER` для безопасных обновлений данных
-   Асинхронная инициализация роутов для предотвращения race conditions с подключением к БД

**Документация:** См. [packages/profile-backend/base/README.md](./profile-backend/base/README.md)

#### Start (Онбординг)

Приложение Start обеспечивает функциональность онбординга и стартовой страницы. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Start Frontend (@universo/start-frontend)

**Ключевые возможности:**

-   UI мастера онбординга и стартовой страницы
-   Компоненты отображения для начальной настройки
-   Загрузка контента через API
-   Поддержка интернационализации

**Документация:** См. [packages/start-frontend/base/README.md](./start-frontend/base/README.md)

##### Start Server (@universo/start-backend)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/start-backend`), отвечающий за данные онбординга и стартовой страницы.

**Ключевые возможности:**

-   Express роуты для операций стартовой страницы
-   Интеграция с сервисами платформы

**Документация:** См. [packages/start-backend/base/README.md](./start-backend/base/README.md)

## Архитектура для будущего расширения

При расширении функциональности приложения вы можете создавать дополнительные директории, следуя этой структуре:

```
app-name/
├── base/                # Ключевая функциональность
│   ├── src/             # Исходный код
│   │   ├── api/         # API клиенты (для фронтенда)
│   │   ├── assets/      # Статические ресурсы (иконки, изображения)
│   │   ├── components/  # React компоненты (для фронтенда)
│   │   ├── configs/     # Конфигурационные константы
│   │   ├── controllers/ # Express контроллеры (для бекенда)
│   │   ├── database/    # TypeORM сущности и миграции (для бекенда)
│   │   ├── domains/     # Модули доменной логики
│   │   ├── features/    # Модули функциональности
│   │   ├── hooks/       # React хуки (для фронтенда)
│   │   ├── i18n/        # Ресурсы интернационализации
│   │   ├── interfaces/  # TypeScript интерфейсы и типы
│   │   ├── middlewares/ # Обработчики middleware (для бекенда)
│   │   ├── models/      # Модели данных (для бекенда)
│   │   ├── routes/      # REST API роуты (для бекенда)
│   │   ├── services/    # Бизнес-логика (для бекенда)
│   │   ├── store/       # Управление состоянием (для фронтенда)
│   │   ├── utils/       # Утилиты
│   │   ├── validators/  # Валидация входных данных (для бекенда)
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
```

**Примечание:** Не все директории требуются для каждого приложения. Создавайте только директории, необходимые для вашей конкретной функциональности:

-   **Фронтенд приложения** обычно нуждаются в: `api/`, `assets/`, `components/`, `hooks/`, `i18n/`, `pages/`, `utils/`
-   **Бекенд приложения** обычно нуждаются в: `database/`, `routes/`, `services/`, `utils/`

## Эволюция системы сборки

### Миграция на tsdown

Многие пакеты мигрировали с устаревшей системы сборки tsc+gulp на **tsdown** для более быстрых и эффективных сборок:

**Мигрированные пакеты (tsdown):**

-   `@universo/auth-frontend`
-   `@universo/auth-backend`
-   `@universo/store`
-   `@universo/metahubs-frontend`
-   `@universo/template-mui`
-   `@universo/types`
-   `@universo/utils`
-   `@universo/api-client`
-   `@universo/i18n`
-   `@universo/migration-guard-shared`

**Устаревшие пакеты (tsc или tsc+gulp):**

-   `@universo/profile-frontend` (имеет gulpfile.ts)

**Преимущества tsdown:**

-   Двойной вывод сборки: CommonJS + ES модули + TypeScript декларации
-   Более быстрое время сборки
-   Автоматическая обработка ассетов
-   Упрощённая конфигурация

## Взаимодействия

Приложения в этой директории спроектированы для совместной работы в модульной архитектуре:

```
┌─────────────────────────────────────────────────────┐
│                    Core Platform                     │
│  ┌─────────────────┐    ┌──────────────────────┐    │
│  │ Core Backend     │◄──►│ Core Frontend        │    │
│  │ (@universo/      │    │ (@universo/          │    │
│  │  core-backend)   │    │  core-frontend)      │    │
│  └────────┬─────────┘    └──────────┬───────────┘   │
└───────────┼──────────────────────────┼───────────────┘
            │                          │
            ▼                          ▼
┌───────────────────────┐  ┌──────────────────────────┐
│   Backend Modules     │  │   Frontend Modules       │
│ ┌───────────────────┐ │  │ ┌──────────────────────┐ │
│ │ admin-backend     │ │  │ │ admin-frontend       │ │
│ │ applications-bknd │ │  │ │ applications-frt     │ │
│ │ metahubs-backend  │ │  │ │ metahubs-frontend    │ │
│ │ profile-backend   │ │  │ │ profile-frontend     │ │
│ │ start-backend     │ │  │ │ start-frontend       │ │
│ └───────────────────┘ │  │ └──────────────────────┘ │
└───────────────────────┘  └──────────────────────────┘
            │                          │
            ▼                          ▼
┌─────────────────────────────────────────────────────┐
│              Shared Infrastructure                   │
│  @universo/types  @universo/utils  @universo/i18n   │
│  @universo/store  @universo/template-mui            │
│  @universo/api-client  @universo/schema-ddl         │
└─────────────────────────────────────────────────────┘
```

## Технические требования

**Основная платформа:**
- **Node.js**: >=18.15.0 <19.0.0 || ^20 (версии LTS обязательны для продакшена)
- **PNPM**: >=9 (менеджер пакетов для монорепо)

**Инструменты сборки:**
- **TypeScript**: Строгий режим включён во всех пакетах
- **tsdown**: v0.15.7 (бандлер на основе Rolldown + Oxc для пользовательских пакетов)
- **Turborepo**: Эффективная оркестрация сборки монорепо

**Фронтенд:**
- **React**: Основная UI библиотека
- **Material-UI (MUI)**: v6 с ColorScheme API для поддержки тёмного режима
- **React Flow**: Инфраструктура визуального редактора на основе узлов

**Бекенд:**
- **Express**: Веб-фреймворк Node.js
- **TypeORM**: 0.3.20+ для доступа к базе данных (только PostgreSQL)
- **Supabase**: Аутентификация и бекенд базы данных

**Разработка:**
- **ESLint**: Контроль качества кода
- **Prettier**: Форматирование кода
- **i18next**: Интернационализация (поддержка EN/RU)

## Руководство по разработке

1. **Модульность:** Держите каждое приложение самодостаточным с чёткими интерфейсами
2. **Минимальные изменения ядра:** Избегайте модификаций основной кодовой базы бекенда/фронтенда
3. **Документация:** Поддерживайте README файлы в каждой директории приложения
4. **Общие типы:** Используйте общие определения типов для межприложенческой коммуникации
5. **Система сборки:** Предпочитайте tsdown для новых пакетов; мигрируйте устаревшие пакеты постепенно
6. **i18n:** Используйте `@universo/i18n` для централизованной интернационализации

## Сборка

Из корня проекта:

```bash
# Установка всех зависимостей для workspace
pnpm install

# Сборка всех приложений (и других пакетов в workspace)
pnpm build

# Сборка общих инфраструктурных пакетов
pnpm build --filter @universo/types
pnpm build --filter @universo/utils
pnpm build --filter @universo/api-client
pnpm build --filter @universo/i18n
pnpm build --filter @universo/store
pnpm build --filter @universo/template-mui
pnpm build --filter @universo/migration-guard-shared
pnpm build --filter @universo/schema-ddl

# Сборка пакетов аутентификации
pnpm build --filter @universo/auth-frontend
pnpm build --filter @universo/auth-backend

# Сборка доменных фронтенд приложений
pnpm build --filter @universo/admin-frontend
pnpm build --filter @universo/applications-frontend
pnpm build --filter @universo/metahubs-frontend
pnpm build --filter @universo/profile-frontend
pnpm build --filter @universo/start-frontend

# Сборка доменных бекенд приложений
pnpm build --filter @universo/admin-backend
pnpm build --filter @universo/applications-backend
pnpm build --filter @universo/metahubs-backend
pnpm build --filter @universo/profile-backend
pnpm build --filter @universo/start-backend

# Сборка основной платформы
pnpm build --filter @universo/core-backend
pnpm build --filter @universo/core-frontend
pnpm build --filter @universo/rest-docs
```

## Разработка

Для запуска конкретного приложения в режиме разработки (отслеживает изменения и пересобирает):

```bash
# Фронтенд пакеты
pnpm --filter @universo/admin-frontend dev
pnpm --filter @universo/applications-frontend dev
pnpm --filter @universo/auth-frontend dev
pnpm --filter @universo/metahubs-frontend dev
pnpm --filter @universo/profile-frontend dev
pnpm --filter @universo/start-frontend dev

# Бекенд пакеты
pnpm --filter @universo/admin-backend dev
pnpm --filter @universo/applications-backend dev
pnpm --filter @universo/auth-backend dev
pnpm --filter @universo/metahubs-backend dev
pnpm --filter @universo/profile-backend dev
pnpm --filter @universo/start-backend dev
```

**Примечание о ресурсах:** Для пакетов, всё ещё использующих gulp (устаревшая сборка), скрипты отслеживания не копируют SVG иконки автоматически. Если вы добавляете или изменяете SVG ресурсы во время разработки, запустите `pnpm build --filter <app>`, чтобы убедиться, что они правильно скопированы в директорию dist. Пакеты, использующие tsdown, обрабатывают ассеты автоматически.

---

_Universo Platformo | Документация приложений_
