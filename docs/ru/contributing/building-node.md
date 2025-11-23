# Создание узла

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

### Установка Git

Сначала установите Git и клонируйте репозиторий Flowise. Вы можете следовать шагам из руководства [Начало работы](broken-reference).

### Структура

Flowise разделяет каждую интеграцию узла в папке `packages/flowise-components/nodes`. Давайте попробуем создать простой инструмент!

### Создание инструмента калькулятора

Создайте новую папку с именем `Calculator` в папке `packages/flowise-components/nodes/tools`. Затем создайте новый файл с именем `Calculator.ts`. Внутри файла мы сначала напишем базовый класс.

```javascript
import { INode } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'

class Calculator_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    author: string
    baseClasses: string[]

    constructor() {
        this.label = 'Calculator'
        this.name = 'calculator'
        this.version = 1.0
        this.type = 'Calculator'
        this.icon = 'calculator.svg'
        this.category = 'Tools'
        this.author = 'Your Name'
        this.description = 'Perform calculations on response'
        this.baseClasses = [this.type, ...getBaseClasses(Calculator)]
    }
}

module.exports = { nodeClass: Calculator_Tools }
```

Каждый узел будет реализовывать базовый класс `INode`. Разбор того, что означает каждое свойство:

<table><thead><tr><th width="271">Свойство</th><th>Описание</th></tr></thead><tbody><tr><td>label</td><td>Имя узла, которое появляется в пользовательском интерфейсе</td></tr><tr><td>name</td><td>Имя, которое используется кодом. Должно быть в <strong>camelCase</strong></td></tr><tr><td>version</td><td>Версия узла</td></tr><tr><td>type</td><td>Обычно то же самое, что и label. Для определения, какой узел может быть подключен к этому конкретному типу в пользовательском интерфейсе</td></tr><tr><td>icon</td><td>Иконка узла</td></tr><tr><td>category</td><td>Категория узла</td></tr><tr><td>author</td><td>Создатель узла</td></tr><tr><td>description</td><td>Описание узла</td></tr><tr><td>baseClasses</td><td>Базовые классы узла, поскольку узел может расширяться от базового компонента. Используется для определения, какой узел может быть подключен к этому узлу в пользовательском интерфейсе</td></tr></tbody></table>

### Определение класса

Теперь класс компонента частично завершен, мы можем перейти к определению фактического класса инструмента, в данном случае - `Calculator`.

Создайте новый файл в той же папке `Calculator` и назовите его `core.ts`

```javascript
import { Parser } from "expr-eval"
import { Tool } from "@langchain/core/tools"

export class Calculator extends Tool {
    name = "calculator"
    description = `Useful for getting the result of a math expression. The input to this tool should be a valid mathematical expression that could be executed by a simple calculator.`
 
    async _call(input: string) {
        try {
            return Parser.evaluate(input).toString()
        } catch (error) {
            return "I don't know how to do that."
        }
    }
}
```

### Завершение

Вернитесь к файлу `Calculator.ts`, мы можем завершить это, добавив функцию `async init`. В этой функции мы инициализируем класс Calculator, который мы создали выше. Когда поток выполняется, функция `init` в каждом узле будет вызвана, а функция `_call` будет выполнена, когда LLM решит вызвать этот инструмент.

```javascript
import { INode } from '../../../src/Interface'
import { getBaseClasses } from '../../../src/utils'
import { Calculator } from './core'

class Calculator_Tools implements INode {
    label: string
    name: string
    version: number
    description: string
    type: string
    icon: string
    category: string
    author: string
    baseClasses: string[]

    constructor() {
        this.label = 'Calculator'
        this.name = 'calculator'
        this.version = 1.0
        this.type = 'Calculator'
        this.icon = 'calculator.svg'
        this.category = 'Tools'
        this.author = 'Your Name'
        this.description = 'Perform calculations on response'
        this.baseClasses = [this.type, ...getBaseClasses(Calculator)]
    }
    
 
    async init() {
        return new Calculator()
    }
}

module.exports = { nodeClass: Calculator_Tools }
```

### Сборка и запуск

В файле `.env` внутри `packages/flowise-server` создайте новую переменную окружения:

```javascript
SHOW_COMMUNITY_NODES=true
```

Теперь мы можем использовать `pnpm build` и `pnpm start`, чтобы оживить компонент!

<figure><img src="../.gitbook/assets/image (1) (1) (1) (2).png" alt=""><figcaption></figcaption></figure>
