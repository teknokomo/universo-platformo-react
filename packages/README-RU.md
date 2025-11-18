# Каталог приложений Universo Platformo

Здесь расположены модульные приложения, расширяющие основную платформу Flowise без изменения её ядра.

## Текущая структура

```
packages/
├── analytics-frt/       # Фронтенд аналитики квизов
│   └── base/            # Ключевая функциональность аналитики
│       ├── src/         # Исходный код
│       │   ├── components/ # UI компоненты аналитики
│       │   ├── i18n/    # Интернационализация
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── auth-frt/            # UI примитивы аутентификации
│   └── base/            # Ключевая функциональность UI аутентификации
│       ├── src/         # Исходный код
│       │   ├── components/ # Компоненты аутентификации (LoginForm, SessionGuard)
│       │   ├── hooks/   # React хуки для аутентификации
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── auth-srv/            # Passport.js + Supabase сессии бекенд
│   └── base/            # Ключевая функциональность бекенда аутентификации
│       ├── src/         # Исходный код
│       │   ├── middleware/ # Стратегии Passport и обработчики сессий
│       │   ├── routes/  # Роуты аутентификации (login, logout, session)
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-chatmessage/ # Компоненты чат-сообщений
│   └── base/            # Переиспользуемые компоненты чат-интерфейса
│       ├── src/         # Исходный код
│       │   ├── components/ # 7 чат-компонентов (ChatPopUp, ChatMessage и т.д.)
│       │   ├── styles/  # Стили компонентов
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-components/  # Ключевые компоненты узлов Flowise
│   ├── src/             # Исходный код
│   │   ├── nodes/       # Реализации узлов
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── flowise-server/      # Серверная часть бекенда
│   ├── src/             # Исходный код
│   │   ├── database/    # TypeORM сущности и миграции
│   │   ├── routes/      # API роуты
│   │   ├── services/    # Бизнес-логика
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── flowise-store/       # Общее Redux хранилище
│   └── base/            # Конфигурация Redux хранилища
│       ├── src/         # Исходный код
│       │   ├── slices/  # Redux срезы
│       │   ├── store.ts # Настройка хранилища
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-template-mui/ # Библиотека компонентов Material-UI (unbundled)
│   └── base/            # MUI компоненты, извлечённые из flowise-ui
│       ├── src/         # Исходный код
│       │   ├── components/ # Layout, dialogs, forms, cards, pagination
│       │   ├── themes/  # Конфигурации тем MUI
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (17MB CJS, 5.2MB ESM, 5KB типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── flowise-ui/          # Основное UI приложение
│   ├── src/             # Исходный код
│   │   ├── ui-component/ # React компоненты
│   │   ├── views/       # Представления страниц
│       │   └── index.tsx    # Точка входа
│   ├── public/          # Статические файлы
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── metaverses-frt/      # Фронтенд управления метавселенными
│   └── base/            # Ключевая функциональность UI метавселенных
│       ├── src/         # Исходный код
│       │   ├── components/ # UI управления метавселенными
│       │   ├── i18n/    # Интернационализация
│       │   ├── pages/   # Компоненты страниц
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── metaverses-srv/      # Бекенд управления метавселенными
│   └── base/            # Ключевая функциональность бекенда метавселенных
│       ├── src/         # Исходный код
│       │   ├── routes/  # Express роуты для CRUD метавселенных
│       │   ├── database/ # TypeORM сущности и миграции
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── multiplayer-colyseus-srv/ # Мультиплеерный сервер Colyseus
│   ├── src/             # Исходный код
│   │   ├── rooms/       # Реализации комнат Colyseus
│   │   ├── schemas/     # Схемы состояний
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── profile-frt/         # Фронтенд управления профилем пользователя
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
├── profile-srv/         # Бекенд управления профилем (workspace-пакет)
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
├── publish-frt/         # Фронтенд системы публикаций для экспорта и шеринга
│   └── base/            # Ключевая функциональность фронтенда публикаций
│       ├── src/         # Исходный код
│       │   ├── api/     # HTTP клиенты к бекенду
│       │   │   ├── common.ts          # Основные утилиты API
│       │   │   ├── index.ts           # Центральные экспорты API
│       │   │   └── publication/       # API клиенты публикаций
│       │   │       ├── PublicationApi.ts        # Базовый API публикаций
│       │   │       ├── ARJSPublicationApi.ts    # API для AR.js
│       │   │       ├── StreamingPublicationApi.ts # API стриминга
│       │   │       └── index.ts       # Экспорты публикаций с совместимостью
│       │   ├── assets/  # Статические ресурсы (иконки, изображения)
│       │   ├── components/ # React компоненты
│       │   ├── features/   # Модули функциональности для различных технологий
│       │   ├── i18n/    # Локализация
│       │   ├── pages/   # Компоненты страниц
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       ├── gulpfile.ts
│       └── README.md
├── publish-srv/         # Бекенд системы публикаций (workspace-пакет)
│   └── base/            # Ключевая функциональность бекенда публикаций
│       ├── src/         # Исходный код
│       │   ├── controllers/ # Контроллеры Express
│       │   ├── services/    # Бизнес-логика (напр., FlowDataService)
│       │   ├── routes/      # Асинхронные фабрики роутов
│       │   ├── types/       # Общие определения типов UPDL
│       │   └── index.ts     # Точка входа пакета
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── space-builder-frt/   # UI Space Builder (промпт-в-поток)
│   └── base/            # Ключевая функциональность фронтенда Space Builder
│       ├── src/         # Исходный код
│       │   ├── components/ # Диалог промптов, FAB, селектор моделей
│       │   ├── i18n/    # Интернационализация
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── space-builder-srv/   # API Space Builder (промпт-в-поток)
│   └── base/            # Ключевая функциональность бекенда Space Builder
│       ├── src/         # Исходный код
│       │   ├── routes/  # Эндпоинты generate, health, config
│       │   ├── services/ # Интеграция LLM и валидация графов
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── spaces-frt/          # Фронтенд Spaces/Canvases
│   └── base/            # Ключевая функциональность UI пространств
│       ├── src/         # Исходный код
│       │   ├── components/ # UI компоненты Canvas
│       │   ├── i18n/    # Интернационализация
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── spaces-srv/          # Бекенд домена Spaces
│   └── base/            # Ключевая функциональность бекенда пространств
│       ├── src/         # Исходный код
│       │   ├── routes/  # Express роуты для CRUD пространств
│       │   ├── database/ # TypeORM сущности и миграции
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── template-mmoomm/     # Пакет шаблона PlayCanvas MMOOMM
│   └── base/            # Функциональность шаблона MMOOMM
│       ├── src/         # Исходный код
│       │   ├── playcanvas/ # PlayCanvas специфичные реализации
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── template-quiz/       # Пакет шаблона AR.js квизов
│   └── base/            # Функциональность шаблона квизов
│       ├── src/         # Исходный код
│       │   ├── arjs/    # AR.js специфичные реализации
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── uniks-frt/           # Фронтенд управления рабочими пространствами
│   └── base/            # Ключевая функциональность рабочих пространств
│       ├── src/         # Исходный код
│       │   ├── i18n/    # Интернационализация
│       │   ├── pages/   # Компоненты страниц (UnikList, UnikDetail, UnikDialog)
│       │   ├── menu-items/ # Конфигурации меню
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── uniks-srv/           # Бекенд управления рабочими пространствами (workspace-пакет)
│   └── base/            # Ключевая функциональность рабочих пространств
│       ├── src/         # Исходный код
│       │   ├── routes/  # Express роуты для CRUD операций Uniks
│       │   ├── database/ # TypeORM сущности и миграции
│       │   ├── types/   # TypeScript декларации
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-api-client/ # TypeScript API клиент
│   ├── src/             # Исходный код
│   │   ├── clients/     # Реализации API клиентов
│   │   ├── types/       # Типы запросов/ответов
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод (CJS, ESM, типы)
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── universo-i18n/       # Централизованный экземпляр i18n
│   ├── src/             # Исходный код
│   │   ├── locales/     # Файлы переводов
│   │   ├── i18n.ts      # Конфигурация i18next
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── universo-rest-docs/  # Сервер документации API
│   ├── src/             # Исходный код
│   │   ├── swagger/     # Спецификации OpenAPI
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
├── universo-template-mui/ # Реализация шаблона Material-UI
│   └── base/            # Ключевая функциональность шаблона MUI
│       ├── src/         # Исходный код
│       │   ├── layouts/ # Компоненты макетов
│       │   ├── themes/  # Конфигурации тем
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-types/      # Общие TypeScript типы и интерфейсы
│   └── base/            # Основные определения типов
│       ├── src/         # Исходный код
│       │   ├── interfaces/ # UPDL и платформенные интерфейсы
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── universo-utils/      # Общие утилиты и процессоры
│   └── base/            # Основные утилитарные функции
│       ├── src/         # Исходный код
│       │   ├── updl/    # Утилиты обработки UPDL (UPDLProcessor)
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
├── updl/                # Система узлов UPDL для создания универсальных 3D/AR/VR пространств
│   └── base/            # Ключевая функциональность UPDL
│       ├── src/         # Исходный код
│       │   ├── assets/  # Статические ресурсы (иконки, изображения)
│       │   ├── i18n/    # Интернационализация
│       │   ├── interfaces/ # TypeScript типы
│       │   ├── nodes/   # Определения узлов UPDL
│       │   └── index.ts # Точка входа
│       ├── dist/        # Скомпилированный вывод (CJS, ESM, типы)
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
└── README.md            # Данная документация
```

## Приложения

### Основные пакеты платформы

#### Flowise Components (flowise-components)

Реализации основных компонентов узлов Flowise для визуального программирования.

**Ключевые возможности:**

-   Полная библиотека узлов для рабочих процессов Flowise
-   Интеграция с LangChain и другими AI инструментами
-   Пользовательские реализации узлов UPDL
-   Двойная система сборки (tsdown): выводы CJS + ESM

**Документация:** См. [packages/flowise-components/README.md](./flowise-components/README.md)

#### Flowise Server (flowise-server)

Основной бекенд-сервер Universo Platformo, предоставляющий API эндпоинты, управление базой данных и бизнес-логику.

**Ключевые возможности:**

-   REST API на основе Express
-   Интеграция TypeORM для PostgreSQL
-   Интеграция аутентификации Supabase
-   Система регистрации сущностей и миграций
-   Асинхронная инициализация роутов

**Документация:** См. [packages/flowise-server/README.md](./flowise-server/README.md)

#### Flowise UI (flowise-ui)

Основное React фронтенд-приложение с интерфейсом визуального программирования.

**Ключевые возможности:**

-   Редактор canvas на основе React Flow
-   Библиотека компонентов Material-UI
-   Выполнение потоков в реальном времени
-   Управление учётными данными и конфигурацией
-   Поддержка множественных рабочих пространств

**Документация:** См. [packages/flowise-ui/README.md](./flowise-ui/README.md)

### Общие UI компоненты

#### Flowise Template MUI (@flowise/template-mui)

Библиотека компонентов Material-UI, извлечённая из монолита flowise-ui с использованием паттерна unbundled source.

**Ключевые возможности:**

-   Извлечённые MUI компоненты (Layout, Dialogs, Forms, Cards, Pagination)
-   Паттерн unbundled source: распространяет сырые `.tsx` файлы
-   Большой вывод сборки: 17MB CJS, 5.2MB ESM, 5KB типы
-   Устраняет дублирование между фронтенд пакетами
-   Конфигурации и кастомизации тем

**Документация:** См. [packages/flowise-template-mui/base/README.md](./flowise-template-mui/base/README.md)

#### Flowise Chat Message (@flowise/chatmessage)

Переиспользуемые компоненты чат-интерфейса с поддержкой стриминга, записи аудио и загрузки файлов.

**Ключевые возможности:**

-   7 чат-компонентов: ChatPopUp, ChatMessage, ChatExpandDialog и т.д.
-   Устранено ~7692 строк дублирования (3 копии → 1 пакет)
-   Поддержка стриминговых сообщений
-   Функциональность записи аудио
-   Интеграция загрузки файлов
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/flowise-chatmessage/base/README.md](./flowise-chatmessage/base/README.md)

#### Flowise Store (@flowise/store)

Общая конфигурация Redux хранилища для Flowise приложений.

**Ключевые возможности:**

-   Централизованное управление состоянием
-   Интеграция Redux Toolkit
-   Переиспользуемые срезы между фронтенд пакетами
-   Поддержка TypeScript
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/flowise-store/base/README.md](./flowise-store/base/README.md)

### Общие инфраструктурные пакеты

#### Universo Platformo Types (@universo/types)

Общий пакет, содержащий все определения типов TypeScript и интерфейсы, используемые на платформе.

**Ключевые возможности:**

-   **UPDL интерфейсы**: Полные определения типов для узлов UPDL, пространств и данных потоков
-   **Платформенные типы**: Общие типы для публикации, аутентификации и API коммуникации
-   **Двойная система сборки**: Компилируется в CommonJS и ES модули для максимальной совместимости
-   **Только типы**: Чистые определения TypeScript без runtime зависимостей

**Документация:** См. [packages/universo-types/base/README.md](./universo-types/base/README.md)

#### Universo Platformo Utils (@universo/utils)

Общий пакет, содержащий утилитарные функции и процессоры, используемые в нескольких приложениях.

**Ключевые возможности:**

-   **UPDLProcessor**: Основной процессор для конвертации данных потоков в UPDL структуры
-   **Поддержка мультисцен**: Обрабатывает как одиночные пространства, так и мультисценовые UPDL потоки
-   **Независимость от шаблонов**: Предоставляет основу для всех билдеров шаблонов
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

**Документация:** См. [packages/universo-api-client/README.md](./universo-api-client/README.md)

#### Universo i18n (@universo/i18n)

Централизованный экземпляр i18next для интернационализации всех пакетов Universo Platformo.

**Ключевые возможности:**

-   Общая конфигурация i18next
-   Управление файлами переводов
-   Определение и переключение языков
-   Поддержка пространств имён для модульных переводов

**Документация:** См. [packages/universo-i18n/README.md](./universo-i18n/README.md)

#### Universo Template MUI (@universo/template-mui)

Реализация шаблона Material-UI для React приложений Universo Platformo.

**Ключевые возможности:**

-   Переиспользуемые компоненты макетов
-   Единообразные конфигурации тем
-   Паттерны отзывчивого дизайна
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/universo-template-mui/base/README.md](./universo-template-mui/base/README.md)

#### Universo REST Docs (universo-rest-docs)

Сервер документации API с использованием спецификаций OpenAPI/Swagger.

**Ключевые возможности:**

-   Интерактивная документация API
-   Спецификации OpenAPI 3.0
-   Интеграция Swagger UI
-   Автоматическая генерация из TypeScript типов

**Документация:** См. [packages/universo-rest-docs/README.md](./universo-rest-docs/README.md)

### Система аутентификации

#### Auth Frontend (@universo/auth-frt)

Общие UI примитивы аутентификации для Universo Platformo.

**Ключевые возможности:**

-   LoginForm, SessionGuard и другие компоненты аутентификации
-   React хуки для состояния аутентификации
-   UI сессионной аутентификации
-   Интеграция с Supabase auth
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/auth-frt/base/README.md](./auth-frt/base/README.md)

#### Auth Server (@universo/auth-srv)

Набор инструментов Passport.js + Supabase сессии для бекенд-аутентификации.

**Ключевые возможности:**

-   Стратегии Passport.js (local, JWT)
-   Управление сессиями Supabase
-   Middleware сессий для Express
-   Роуты login, logout и валидации сессий
-   Двойная система сборки (tsdown): CJS + ESM

**Документация:** См. [packages/auth-srv/base/README.md](./auth-srv/base/README.md)

### Пакеты шаблонов

#### Quiz Template (@universo/template-quiz)

Специализированный пакет шаблона для создания образовательных AR.js квизов со сбором лидов.

**Ключевые возможности:**

-   **Интеграция AR.js**: Полная реализация AR.js квиза с отслеживанием маркеров
-   **Мультисценовые квизы**: Поддержка последовательных потоков вопросов
-   **Сбор лидов**: Встроенные формы для сбора информации пользователей
-   **Система очков**: Автоматический подсчёт и отображение результатов
-   **Модульная архитектура**: Отдельные обработчики для различных типов узлов UPDL
-   **Двойная система сборки**: tsdown (CJS + ESM + Типы)

**Документация:** См. [packages/template-quiz/base/README.md](./template-quiz/base/README.md)

#### MMOOMM Template (@universo/template-mmoomm)

Специализированный пакет шаблона для создания PlayCanvas космических MMO опытов.

**Ключевые возможности:**

-   **Космическое MMO окружение**: Полная 3D космическая симуляция с физикой
-   **Промышленная добыча**: Система лазерной добычи с авто-таргетингом
-   **Система сущностей**: Корабли, астероиды, станции и врата
-   **Поддержка мультиплеера**: Реальное время сетевое взаимодействие с Colyseus
-   **Продвинутое управление**: Движение WASD+QZ с кватернионным вращением
-   **Двойная система сборки**: tsdown (CJS + ESM + Типы)

**Документация:** См. [packages/template-mmoomm/base/README.md](./template-mmoomm/base/README.md)

### Мультиплеерная инфраструктура

#### Multiplayer Colyseus Server (@universo/multiplayer-colyseus-srv)

Мультиплеерный сервер Colyseus для сетевого взаимодействия в реальном времени в MMOOMM опытах.

**Ключевые возможности:**

-   Реализации комнат Colyseus
-   Синхронизация состояний
-   Управление подключениями игроков
-   Репликация сущностей для кораблей, астероидов и снарядов
-   Интеграция с template-mmoomm

**Документация:** См. [packages/multiplayer-colyseus-srv/README.md](./multiplayer-colyseus-srv/README.md)

### Доменные модули

#### Uniks (Управление рабочими пространствами)

Приложение Uniks обеспечивает функциональность управления рабочими пространствами, позволяя пользователям создавать, управлять и организовывать свои рабочие пространства. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Uniks Frontend (@universo/uniks-frt)

**Ключевые возможности:**

-   Интерфейс создания и управления рабочими пространствами
-   Удобное перечисление и навигация по рабочим пространствам
-   Управление участниками рабочих пространств
-   Отзывчивый дизайн с компонентами Material-UI
-   Поддержка интернационализации (английский и русский)
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/uniks-frt/base/README.md](./uniks-frt/base/README.md)

##### Uniks Server (@universo/uniks-srv)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/uniks-srv`), отвечающий за обработку данных и операций рабочих пространств.

**Ключевые возможности:**

-   Express роуты для CRUD операций Uniks
-   TypeORM сущности (`Unik`, `UserUnik`) для управления БД
-   Миграции базы данных PostgreSQL
-   Интеграция Supabase для аутентификации
-   Вложенное монтирование роутов Flowise под префиксом `/:unikId`

**Документация:** См. [packages/uniks-srv/base/README.md](./uniks-srv/base/README.md)

#### Profile

Приложение Profile обеспечивает функциональность управления профилем пользователя. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Profile Frontend (@universo/profile-frt)

**Ключевые возможности:**

-   JWT token-based аутентификация с Supabase
-   Функциональность обновления email и пароля
-   Мобильно-дружественный отзывчивый дизайн
-   Поддержка интернационализации (английский и русский)

**Документация:** См. [packages/profile-frt/base/README.md](./profile-frt/base/README.md)

##### Profile Server (@universo/profile-srv)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/profile-srv`), отвечающий за безопасную обработку данных профиля пользователя.

**Ключевые возможности:**

-   Безопасные эндпоинты для управления данными пользователя
-   Использует пользовательские SQL функции с `SECURITY DEFINER` для безопасных обновлений данных
-   Асинхронная инициализация роутов для предотвращения race conditions с подключением к БД

**Документация:** См. [packages/profile-srv/base/README.md](./profile-srv/base/README.md)

#### Spaces (Управление Canvas)

Приложение Spaces обеспечивает функциональность управления canvas и потоками. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Spaces Frontend (@universo/spaces-frt)

**Ключевые возможности:**

-   UI компоненты Canvas, извлечённые из flowise-ui
-   Интерфейс управления потоками/пространствами
-   Интеграция с React Flow
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/spaces-frt/base/README.md](./spaces-frt/base/README.md)

##### Spaces Server (@universo/spaces-srv)

Это бекенд-сервис для управления пространствами и canvases.

**Ключевые возможности:**

-   Express роуты для CRUD операций пространств
-   TypeORM сущности для управления пространствами
-   Миграции базы данных PostgreSQL
-   Интеграция с flowise-server

**Документация:** См. [packages/spaces-srv/base/README.md](./spaces-srv/base/README.md)

#### Metaverses

Приложение Metaverses обеспечивает функциональность управления метавселенными. Состоит из фронтенд-приложения и бекенд workspace-пакета.

##### Metaverses Frontend (@universo/metaverses-frt)

**Ключевые возможности:**

-   UI создания и управления метавселенными
-   Перечисление и навигация метавселенных
-   Отзывчивый дизайн с Material-UI
-   Поддержка интернационализации
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/metaverses-frt/base/README.md](./metaverses-frt/base/README.md)

##### Metaverses Server (@universo/metaverses-srv)

Это бекенд-сервис для управления метавселенными.

**Ключевые возможности:**

-   Express роуты для CRUD операций метавселенных
-   TypeORM сущности для данных метавселенных
-   Миграции базы данных PostgreSQL
-   Интеграция с flowise-server

**Документация:** См. [packages/metaverses-srv/base/README.md](./metaverses-srv/base/README.md)

#### Analytics

Приложение Analytics обеспечивает функциональность аналитики квизов.

##### Analytics Frontend (@universo/analytics-frt)

**Ключевые возможности:**

-   Панель аналитики квизов
-   Компоненты визуализации данных
-   Поддержка интернационализации
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/analytics-frt/base/README.md](./analytics-frt/base/README.md)

### Space Builder (Промпт-в-поток)

Приложение Space Builder превращает промпты на естественном языке в графы потоков, составленные из узлов UPDL. Состоит из фронтенд-приложения и бекенд workspace-пакета.

#### Space Builder Frontend (@universo/space-builder-frt)

**Ключевые возможности:**

-   Генерация промпт-в-поток (MUI диалог + FAB)
-   Выбор модели из Credentials; опциональный режим Test (через server env)
-   Режимы Append/Replace на canvas
-   Интеграция i18n
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Документация:** См. [packages/space-builder-frt/base/README.md](./space-builder-frt/base/README.md)

#### Space Builder Server (@universo/space-builder-srv)

Это бекенд-сервис, структурированный как workspace-пакет (`@universo/space-builder-srv`), отвечающий за вызов LLM и безопасный возврат JSON графа.

**Ключевые возможности:**

-   Эндпоинты: `/api/v1/space-builder/health`, `/config`, `/generate`
-   Мета-промпт → вызов провайдера → извлечение RAW JSON
-   Разрешение Credential интегрировано с сервисами платформы
-   Валидация на основе Zod и серверная нормализация

**Документация:** См. [packages/space-builder-srv/base/README.md](./space-builder-srv/base/README.md)

### UPDL (Universal Platform Definition Language)

Приложение UPDL предоставляет единую систему узлов для описания 3D/AR/VR пространств, которые могут быть экспортированы на множество целевых платформ. Определяет стандартизированный слой промежуточного представления, абстрагирующий специфику различных движков рендеринга.

#### UPDL (@universo/updl)

**Ключевые возможности:**

-   7 ключевых высокоуровневых узлов для универсального описания 3D/AR/VR сцен
-   Устаревшие узлы (Object, Camera, Light) для обратной совместимости
-   Определения узлов и иконки
-   Чистая интеграция с Flowise
-   TypeScript интерфейсы
-   Двойная система сборки (tsdown): CJS + ESM + Типы

**Архитектура интерфейсов:**

-   **Основные UPDL интерфейсы** (`UPDLInterfaces.ts`): Полные определения экосистемы для потоков, графов и детальных свойств узлов
-   **Интеграционные интерфейсы** (`Interface.UPDL.ts`): Упрощённые интерфейсы для интеграции бекенд/фронтенд через алиас `@server/interface`

**Документация:** См. [packages/updl/base/README.md](./updl/base/README.md)

### Publish

Приложение Publish предоставляет механизмы для экспорта UPDL пространств в AR.js и публикации их с шарируемыми URL.

#### Publish Frontend (@universo/publish-frt)

Фронтенд-приложение отвечает за весь пользовательский рабочий процесс публикации, включая финальную конвертацию данных в просматриваемые AR.js и PlayCanvas форматы.

**Ключевые возможности:**

-   **Клиентская обработка UPDL**: Использует общий `UPDLProcessor` из `@universo/utils` для конвертации сырых `flowData` из бекенда в валидные AR.js и PlayCanvas опыты
-   **Система реестра шаблонов**: Модульная система шаблонов, динамически загружающая специализированные пакеты шаблонов (`@universo/template-quiz`, `@universo/template-mmoomm`)
-   **Общая система типов**: Использует `@universo/types` для единообразных определений типов по всем шаблонам и билдерам
-   **Пакеты шаблонов**: Делегирует специфичную функциональность специализированным пакетам шаблонов для поддерживаемости и модульности
-   **Интеграция Supabase**: Сохраняет конфигурации публикаций
-   **Поддержка множественных технологий**: Поддерживает AR.js квизы и PlayCanvas MMO опыты через выделенные пакеты шаблонов

**Документация:** См. [packages/publish-frt/base/README.md](./publish-frt/base/README.md)

#### Publish Backend (@universo/publish-srv)

Это бекенд-сервис, рефакторенный в workspace-пакет (`@universo/publish-srv`), с единственной ответственностью: предоставление данных фронтенду.

**Ключевые возможности:**

-   **Workspace пакет**: Предоставляет общие типы и сервисы как `@universo/publish-srv`
-   **Провайдер сырых данных**: Предоставляет сырые `flowData` из базы данных, делегируя всю обработку UPDL фронтенду
-   **Источник истины для типов**: Экспортирует все общие UPDL и связанные с публикацией TypeScript типы
-   **Асинхронная инициализация роутов**: Предотвращает race conditions, инициализируя роуты только после установки подключения к БД

**Документация:** См. [packages/publish-srv/base/README.md](./publish-srv/base/README.md)

## Архитектура для будущего расширения

При расширении функциональности приложения вы можете создавать дополнительные директории, следуя этой структуре:

```
app-name/
├── base/                # Ключевая функциональность
│   ├── src/             # Исходный код
│   │   ├── api/         # API клиенты (для фронтенда)
│   │   ├── assets/      # Статические ресурсы (иконки, изображения)
│   │   ├── builders/    # Билдеры UPDL в целевую платформу (для фронтенда)
│   │   ├── components/  # React компоненты (для фронтенда)
│   │   ├── configs/     # Конфигурационные константы
│   │   ├── controllers/ # Express контроллеры (для бекенда)
│   │   ├── features/    # Модули функциональности (бывшие мини-приложения)
│   │   ├── hooks/       # React хуки (для фронтенда)
│   │   ├── i18n/        # Ресурсы интернационализации
│   │   ├── interfaces/  # TypeScript интерфейсы и типы
│   │   ├── middlewares/ # Обработчики middleware (для бекенда)
│   │   ├── models/      # Модели данных (для бекенда)
│   │   ├── nodes/       # Определения узлов UPDL
│   │   ├── routes/      # REST API роуты (для бекенда)
│   │   ├── services/    # Бизнес-логика (для бекенда)
│   │   ├── store/       # Управление состоянием (для фронтенда)
│   │   ├── utils/       # Утилиты
│   │   ├── validators/  # Валидация входных данных (для бекенда)
│   │   └── index.ts     # Точка входа
│   ├── dist/            # Скомпилированный вывод
│   ├── package.json
│   ├── tsconfig.json
│   ├── gulpfile.ts      # (для фронтенд модулей с ассетами)
│   └── README.md
```

**Примечание:** Не все директории требуются для каждого приложения. Создавайте только директории, необходимые для вашей конкретной функциональности:

-   **Фронтенд приложения** обычно нуждаются в: `api/`, `assets/`, `components/`, `features/`, `pages/`, `utils/`, `gulpfile.ts`
-   **Бекенд приложения** обычно нуждаются в: `controllers/`, `routes/`, `utils/`
-   **UPDL модули** обычно нуждаются в: `assets/`, `interfaces/`, `nodes/`, `gulpfile.ts`

## Эволюция системы сборки

### Миграция на tsdown

Многие пакеты мигрировали с устаревшей системы сборки tsc+gulp на **tsdown** для более быстрых и эффективных сборок:

**Мигрированные пакеты (tsdown):**

-   `@universo/analytics-frt`
-   `@universo/auth-frt`
-   `@universo/auth-srv`
-   `@flowise/chatmessage`
-   `@flowise/store`
-   `@universo/metaverses-frt`
-   `@universo/spaces-frt`
-   `@universo/space-builder-frt`
-   `@universo/template-mmoomm`
-   `@universo/template-quiz`
-   `@universo/template-mui`
-   `@universo/types`
-   `@universo/uniks-frt`
-   `@universo/updl`
-   `@universo/utils`
-   `@universo/api-client`
-   `flowise-components`

**Устаревшие пакеты (tsc+gulp):**

-   `@universo/profile-frt` (имеет gulpfile.ts)
-   `@universo/publish-frt` (имеет gulpfile.ts)

**Преимущества tsdown:**

-   Двойной вывод сборки: CommonJS + ES модули + TypeScript декларации
-   Более быстрое время сборки
-   Автоматическая обработка ассетов
-   Упрощённая конфигурация

## Взаимодействия

Приложения в этой директории спроектированы для совместной работы в модульной архитектуре:

```
┌──────────────┐       ┌────────────────┐        ┌────────────────┐
│              │       │                │        │                │
│   Flowise    │──────▶│  UPDL Module   │───────▶│ Publish Module │
│   Editor     │       │  (Space Graph) │        │  (Export/Share)│
│              │       │                │        │                │
└──────────────┘       └────────────────┘        └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  Public URL    │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

В текущей архитектуре:

```
┌──────────────┐
│              │
│   Flowise    │
│   Editor     │
│              │
└──────┬───────┘
       │
       ▼
┌──────────────┐       ┌────────────────┐       ┌────────────────┐
│              │       │                │       │                │
│     UPDL     │──────▶│ PUBLISH-FRT    │──────▶│  PUBLISH-SRV   │
│   (Nodes)    │       │   Frontend     │       │    Backend     │
│              │       │                │       │                │
└──────────────┘       └────────────────┘       └────────┬───────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │                │
                                                 │  Public URL    │
                                                 │  /p/{uuid}     │
                                                 │                │
                                                 └────────────────┘
```

## Технические требования

**Основная платформа:**
- **Node.js**: >=18.15.0 <19.0.0 || ^20 (версии LTS обязательны для продакшена)
- **PNPM**: >=9 (менеджер пакетов для монорепо)
- **Flowise AI**: 2.2.8 (базовая платформа визуального программирования)

**Инструменты сборки:**
- **TypeScript**: Строгий режим включён во всех пакетах
- **tsdown**: v0.15.7 (бандлер на основе Rolldown + Oxc для пользовательских пакетов)
- **Turborepo**: Эффективная оркестрация сборки монорепо

**Фронтенд:**
- **React**: Основная UI библиотека (версия управляется Flowise)
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
2. **Минимальные изменения ядра:** Избегайте модификаций основной кодовой базы Flowise
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

# Сборка общих UI компонентов
pnpm build --filter @flowise/template-mui
pnpm build --filter @flowise/chatmessage
pnpm build --filter @flowise/store
pnpm build --filter @universo/template-mui

# Сборка пакетов шаблонов
pnpm build --filter @universo/template-quiz
pnpm build --filter @universo/template-mmoomm

# Сборка пакетов аутентификации
pnpm build --filter @universo/auth-frt
pnpm build --filter @universo/auth-srv

# Сборка доменных фронтенд приложений
pnpm build --filter @universo/analytics-frt
pnpm build --filter @universo/metaverses-frt
pnpm build --filter @universo/profile-frt
pnpm build --filter @universo/publish-frt
pnpm build --filter @universo/space-builder-frt
pnpm build --filter @universo/spaces-frt
pnpm build --filter @universo/uniks-frt
pnpm build --filter @universo/updl

# Сборка доменных бекенд приложений
pnpm build --filter @universo/metaverses-srv
pnpm build --filter @universo/profile-srv
pnpm build --filter @universo/publish-srv
pnpm build --filter @universo/space-builder-srv
pnpm build --filter @universo/spaces-srv
pnpm build --filter @universo/uniks-srv
pnpm build --filter @universo/multiplayer-colyseus-srv

# Сборка основной платформы
pnpm build --filter flowise-components
pnpm build --filter flowise-server
pnpm build --filter flowise-ui
pnpm build --filter universo-rest-docs
```

## Разработка

Для запуска конкретного приложения в режиме разработки (отслеживает изменения и пересобирает):

```bash
# Фронтенд пакеты (режим отслеживания tsdown)
pnpm --filter @universo/analytics-frt dev
pnpm --filter @universo/auth-frt dev
pnpm --filter @flowise/chatmessage dev
pnpm --filter @universo/metaverses-frt dev
pnpm --filter @universo/profile-frt dev
pnpm --filter @universo/publish-frt dev
pnpm --filter @universo/space-builder-frt dev
pnpm --filter @universo/spaces-frt dev
pnpm --filter @universo/uniks-frt dev
pnpm --filter @universo/updl dev

# Бекенд пакеты
pnpm --filter @universo/auth-srv dev
pnpm --filter @universo/metaverses-srv dev
pnpm --filter @universo/profile-srv dev
pnpm --filter @universo/publish-srv dev
pnpm --filter @universo/space-builder-srv dev
pnpm --filter @universo/spaces-srv dev
pnpm --filter @universo/uniks-srv dev
pnpm --filter @universo/multiplayer-colyseus-srv dev
```

**Примечание о ресурсах:** Для пакетов, всё ещё использующих gulp (устаревшая сборка), скрипты отслеживания не копируют SVG иконки автоматически. Если вы добавляете или изменяете SVG ресурсы во время разработки, запустите `pnpm build --filter <app>`, чтобы убедиться, что они правильно скопированы в директорию dist. Пакеты, использующие tsdown, обрабатывают ассеты автоматически.

---

_Universo Platformo | Документация приложений_
