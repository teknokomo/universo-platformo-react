# Пакеты шаблонов

Пакеты шаблонов — это специализированные модули, которые обрабатывают конвертацию структур UPDL в конкретные целевые платформы и форматы. Они предоставляют модульный, поддерживаемый подход к поддержке различных технологий экспорта.

## Обзор

Пакеты шаблонов расширяют экосистему Universo Platformo, предоставляя выделенные реализации для конкретных случаев использования:

- **AR.js квизы**: Образовательный контент с AR на основе маркеров
- **PlayCanvas MMO**: 3D космические симуляционные игры
- **Будущие шаблоны**: Расширяемая архитектура для новых платформ

## Архитектура

### Система реестра шаблонов

Система шаблонов использует паттерн реестра для динамической загрузки:

```typescript
// Регистрация
TemplateRegistry.registerTemplate({
  id: 'quiz',
  name: 'AR.js Quiz',
  builder: ARJSQuizBuilder
})

// Использование
const builder = TemplateRegistry.createBuilder('quiz')
const result = await builder.buildFromFlowData(flowData)
```

### Структура пакета

Каждый пакет шаблона следует стандартизированной структуре:

```
template-name/
├── base/
│   ├── src/
│   │   ├── platform/        # Платформо-специфичные реализации
│   │   ├── handlers/        # Обработчики узлов UPDL
│   │   ├── builders/        # Основные классы билдеров
│   │   ├── common/          # Общие утилиты
│   │   └── index.ts         # Точка входа пакета
│   ├── dist/                # Скомпилированный вывод (CJS, ESM, типы)
│   ├── package.json
│   └── README.md
```

## Основные пакеты шаблонов

### Шаблон квизов (`@universo/template-quiz`)

**Назначение**: Создаёт образовательные квизы AR.js со сбором лидов

**Ключевые возможности**:
- Мультисценные потоки квизов
- AR отслеживание на основе маркеров
- Автоматическая система подсчёта очков
- Сбор данных лидов
- Отображение результатов

**Использование**:
```typescript
import { ARJSQuizBuilder } from '@universo/template-quiz'

const builder = new ARJSQuizBuilder()
const result = await builder.buildFromFlowData(flowDataString)
```

**Поддерживаемые узлы UPDL**:
- Space: Сцены квизов и результаты
- Data: Вопросы и ответы
- Object: AR маркеры и 3D объекты
- Event: Пользовательские взаимодействия
- Action: Навигация и подсчёт очков

### Шаблон MMOOMM (`@universo/template-mmoomm`)

**Назначение**: Создаёт космические MMO-опыты PlayCanvas

**Ключевые возможности**:
- 3D космическая симуляция
- Движение на основе физики
- Промышленный лазерный майнинг
- Мультиплеер в реальном времени
- Система компонентов сущностей

**Использование**:
```typescript
import { PlayCanvasMMOOMMBuilder } from '@universo/template-mmoomm'

const builder = new PlayCanvasMMOOMMBuilder()
const result = await builder.buildFromFlowData(flowDataString)
```

**Поддерживаемые узлы UPDL**:
- Space: Игровые миры и регионы
- Entity: Корабли, астероиды, станции
- Component: Физика, рендеринг, поведение
- Event: Игровые события и триггеры
- Action: Действия игрока и ответы

## Создание новых пакетов шаблонов

### Шаг 1: Настройка пакета

Создайте структуру пакета:

```bash
mkdir -p apps/template-mytemplate/base/src
cd apps/template-mytemplate/base
```

Инициализируйте `package.json`:

```json
{
  "name": "@universo/template-mytemplate",
  "version": "1.0.0",
  "main": "dist/cjs/index.js",
  "module": "dist/esm/index.js",
  "types": "dist/types/index.d.ts",
  "dependencies": {
    "@universo-platformo/types": "workspace:*",
    "@universo-platformo/utils": "workspace:*"
  }
}
```

### Шаг 2: Реализация класса билдера

Создайте основной класс билдера:

```typescript
// src/MyTemplateBuilder.ts
import { ITemplateBuilder, IFlowData, BuildOptions, BuildResult } from '@universo-platformo/types'
import { UPDLProcessor } from '@universo-platformo/utils'

export class MyTemplateBuilder implements ITemplateBuilder {
  getTemplateInfo() {
    return {
      id: 'mytemplate',
      name: 'Мой шаблон',
      description: 'Описание пользовательского шаблона',
      version: '1.0.0',
      technology: 'web'
    }
  }

  async buildFromFlowData(flowDataString: string, options: BuildOptions = {}): Promise<BuildResult> {
    // Обработка данных потока
    const result = UPDLProcessor.processFlowData(flowDataString)
    
    // Создание структуры данных потока
    const flowData: IFlowData = {
      flowData: flowDataString,
      updlSpace: result.updlSpace,
      multiScene: result.multiScene
    }
    
    // Сборка шаблона
    const html = await this.build(flowData, options)
    
    return {
      success: true,
      html,
      metadata: {
        templateId: 'mytemplate',
        buildTime: Date.now()
      }
    }
  }

  private async build(flowData: IFlowData, options: BuildOptions): Promise<string> {
    // Реализуйте логику вашего шаблона здесь
    return '<html><!-- Вывод вашего шаблона --></html>'
  }
}
```

### Шаг 3: Создание обработчиков узлов

Реализуйте обработчики для различных типов узлов UPDL:

```typescript
// src/handlers/EntityHandler.ts
export class EntityHandler {
  process(entities: any[], options: BuildOptions = {}): string {
    return entities.map(entity => this.processEntity(entity, options)).join('\n')
  }

  private processEntity(entity: any, options: BuildOptions): string {
    const entityType = entity.data?.entityType || 'default'
    
    switch (entityType) {
      case 'player':
        return this.generatePlayerEntity(entity)
      case 'npc':
        return this.generateNPCEntity(entity)
      default:
        return this.generateDefaultEntity(entity)
    }
  }

  private generatePlayerEntity(entity: any): string {
    // Генерация кода для игрока
    return `<!-- Сущность игрока: ${entity.id} -->`
  }

  // ... другие генераторы сущностей
}
```

### Шаг 4: Конфигурация системы сборки

Добавьте конфигурации TypeScript для двойной сборки:

**tsconfig.json** (CommonJS):
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist/cjs",
    "module": "CommonJS",
    "target": "ES2020"
  },
  "include": ["src/**/*"]
}
```

**tsconfig.esm.json** (ES модули):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/esm",
    "module": "ES2020"
  }
}
```

**tsconfig.types.json** (объявления типов):
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist/types",
    "declaration": true,
    "emitDeclarationOnly": true
  }
}
```

### Шаг 5: Скрипты пакета

Добавьте скрипты сборки в `package.json`:

```json
{
  "scripts": {
    "build": "pnpm run build:cjs && pnpm run build:esm && pnpm run build:types",
    "build:cjs": "tsc -p tsconfig.json",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build:types": "tsc -p tsconfig.types.json",
    "clean": "rimraf dist"
  }
}
```

### Шаг 6: Регистрация

Зарегистрируйте ваш шаблон в основном приложении:

```typescript
// В publish-frt/src/builders/common/TemplateRegistry.ts
import { MyTemplateBuilder } from '@universo/template-mytemplate'

// Регистрация шаблона
const myTemplateInfo = new MyTemplateBuilder().getTemplateInfo()
TemplateRegistry.registerTemplate({
  id: myTemplateInfo.id,
  name: myTemplateInfo.name,
  description: myTemplateInfo.description,
  version: myTemplateInfo.version,
  technology: myTemplateInfo.technology,
  builder: MyTemplateBuilder
})
```

## Лучшие практики

### Организация кода

- **Разделение ответственности**: Используйте выделенные обработчики для разных типов узлов
- **Модульный дизайн**: Держите платформо-специфичный код изолированным
- **Общие утилиты**: Выносите общую функциональность в утилитарные модули

### Обработка ошибок

```typescript
try {
  const result = await builder.buildFromFlowData(flowData)
  return result
} catch (error) {
  return {
    success: false,
    error: error.message,
    html: this.generateErrorHTML(error)
  }
}
```

### Оптимизация производительности

- **Ленивая загрузка**: Загружайте тяжёлые зависимости только при необходимости
- **Кэширование**: Кэшируйте обработанные шаблоны для повторного использования
- **Потоковая передача**: Используйте потоки для больших выводов шаблонов

### Тестирование

Создайте всеобъемлющие тесты для вашего шаблона:

```typescript
// tests/MyTemplateBuilder.test.ts
import { MyTemplateBuilder } from '../src/MyTemplateBuilder'

describe('MyTemplateBuilder', () => {
  let builder: MyTemplateBuilder

  beforeEach(() => {
    builder = new MyTemplateBuilder()
  })

  test('должен собрать шаблон из данных потока', async () => {
    const flowData = '{"nodes": [], "edges": []}'
    const result = await builder.buildFromFlowData(flowData)
    
    expect(result.success).toBe(true)
    expect(result.html).toContain('<html>')
  })
})
```

## Интеграция с системой публикации

Пакеты шаблонов бесшовно интегрируются с системой публикации:

1. **Регистрация**: Шаблоны автоматически регистрируются при запуске
2. **Выбор**: Пользователи выбирают шаблоны через UI
3. **Обработка**: Система направляет данные потока в соответствующий шаблон
4. **Вывод**: Сгенерированный контент подаётся пользователям

## Миграция с встроенных шаблонов

При миграции с встроенных реализаций шаблонов:

1. **Извлечение логики**: Переместите специфичный для шаблона код в выделенные пакеты
2. **Обновление импортов**: Измените импорты для использования имён пакетов
3. **Удаление встроенного кода**: Удалите старые реализации шаблонов
4. **Обновление реестра**: Зарегистрируйте новые пакеты шаблонов
5. **Тестирование интеграции**: Проверьте функциональность с новыми пакетами

## Устранение неполадок

### Распространённые проблемы

- **Сбои сборки**: Проверьте конфигурацию TypeScript
- **Ошибки импорта**: Проверьте зависимости пакета
- **Проблемы регистрации**: Убедитесь в правильной регистрации шаблона

### Советы по отладке

- Используйте детальное логирование в билдерах шаблонов
- Тестируйте сначала с минимальными данными потока
- Проверяйте сгенерированный HTML вывод
- Проверяйте результаты обработки UPDL
