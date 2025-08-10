<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Анализ функционала автоматического создания Flow в Flowise

## 1. Исследование функционала создания Flow в Flowise

### Местоположение в исходном коде

Функционал автоматического создания агентских потоков на основе текстового запроса в Flowise 3.0.4 реализован в следующих ключевых файлах:

**Frontend (UI)**:

- `/packages/ui/src/views/canvas/AddNodes.jsx` - основной компонент с кнопкой генерации[^1_1]
- `/packages/ui/src/ui-component/dialog/AgentflowGeneratorDialog.jsx` - диалог для ввода запроса[^1_2]

**Backend (Server)**:

- `/packages/server/src/routes/agentflowv2-generator/index.ts` - маршруты API[^1_3]
- `/packages/server/src/controllers/agentflowv2-generator/index.ts` - контроллер[^1_4]
- `/packages/server/src/services/agentflowv2-generator/index.ts` - основная бизнес-логика[^1_5]
- `/packages/server/src/services/agentflowv2-generator/prompt.ts` - системный промпт[^1_6]


### Как работает функционал

1. **Инициация процесса**: В компоненте `AddNodes.jsx` пользователь может нажать на кнопку с иконкой "искры" (IconSparkles), которая открывает диалог генерации[^1_1]
2. **Диалог ввода**: Диалог `AgentflowGeneratorDialog.jsx` позволяет:
    - Выбрать одну из предустановленных инструкций или ввести кастомную[^1_2]
    - Выбрать модель для генерации (OpenAI GPT и другие)[^1_2]
    - Настроить параметры выбранной модели[^1_2]
3. **API запрос**: При нажатии "Generate" отправляется POST запрос на `/api/v1/agentflowv2-generator/generate` с параметрами:

```json
{
  "question": "текст_запроса",
  "selectedChatModel": { объект_с_настройками_модели }
}
```

4. **Обработка на сервере**:
    - Контроллер проверяет наличие необходимых параметров[^1_4]
    - Сервис собирает контекст: доступные узлы, инструменты, шаблоны из marketplace[^1_5]
    - Формируется развернутый системный промпт с примерами[^1_6]
    - Вызывается LLM для генерации структуры потока[^1_5]
5. **Генерация структуры**: LLM возвращает JSON со структурой узлов (nodes) и связей (edges), который валидируется с помощью Zod-схемы[^1_5]
6. **Применение результата**: Сгенерированные узлы и связи устанавливаются в ReactFlow instance[^1_2]

### Настройка нейросети

Функционал позволяет выбрать любую поддерживаемую модель через компонент `selectedChatModel`. Система:[^1_2]

- Загружает список доступных chat-моделей через API `assistantsApi.getChatModels`[^1_2]
- Позволяет настроить параметры модели (temperature, API ключи и т.д.)[^1_2]
- Передает настройки модели в сервис генерации[^1_4]


## 2. Архитектурные предложения для вашего проекта

### Структура нового workspace-пакета

Рекомендую создать новый пакет по аналогии с существующим `agentflowv2-generator`:

```
apps/
├── quiz-generator/           # Новый пакет
│   ├── imp/                  # Implementation
│   │   ├── react/            # Frontend
│   │   │   ├── components/   
│   │   │   │   ├── QuizGeneratorDialog.tsx
│   │   │   │   ├── QuizGeneratorButton.tsx
│   │   │   │   └── QuizPreviewModal.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useQuizGenerator.ts
│   │   │   └── index.ts
│   │   └── express/          # Backend
│   │       ├── routes/
│   │       │   └── quiz-generator.ts
│   │       ├── controllers/
│   │       │   └── quiz-generator.ts
│   │       ├── services/
│   │       │   ├── quiz-generator.ts
│   │       │   └── quiz-prompts.ts
│   │       └── index.ts
│   ├── types/                # Общие типы
│   │   └── quiz.types.ts
│   └── package.json
```


### Интеграция с основным кодом Chatflow

**1. Frontend интеграция** (в `packages/ui/src/views/canvas/AddNodes.jsx`):

```typescript
// Добавить импорт
import QuizGeneratorButton from '@apps/quiz-generator/imp/react/components/QuizGeneratorButton'

// В компонент AddNodes добавить условную кнопку для UPDL узлов
{hasUpdlNodes && (
  <QuizGeneratorButton 
    onQuizGenerated={handleQuizGenerated}
    nodesData={nodesData}
  />
)}
```

**2. Backend интеграция** (в `packages/server/src/routes/index.ts`):

```typescript
import quizGeneratorRouter from '@apps/quiz-generator/imp/express'

// Добавить маршрут
router.use('/quiz-generator', quizGeneratorRouter)
```

**3. Расширение Canvas.jsx**:

```typescript
// Добавить обработчик для квизов
const handleQuizGenerated = (quizData) => {
  // Преобразовать данные квиза в UPDL узлы
  const updlNodes = transformQuizToUpdlNodes(quizData)
  
  // Добавить узлы на холст
  setNodes(prevNodes => [...prevNodes, ...updlNodes])
  setEdges(prevEdges => [...prevEdges, ...quizEdges])
}
```


### Архитектурные принципы

**1. Модульность**: Пакет должен быть самодостаточным с минимальными зависимостями от основного кода[^1_5]

**2. Типизация**: Использовать TypeScript и Zod для валидации структур данных, как в оригинале[^1_5]

**3. Масштабируемость**: Архитектура должна позволять легко добавлять новые типы генераторов (не только квизы)[^1_5]

**4. Совместимость**: Следовать паттернам существующей кодовой базы для упрощения поддержки[^1_1][^1_2]

**5. Переиспользование**: Максимально использовать существующие компоненты и утилиты из основного проекта[^1_1]

Эта архитектура обеспечит чистую интеграцию с существующим кодом при сохранении возможности независимого развития функционала генерации UPDL-узлов.

<div style="text-align: center">⁂</div>

[^1_1]: https://www.semanticscholar.org/paper/38824217a8ac578892a21893a3ecad3bd34e0d2c

[^1_2]: https://onlinelibrary.wiley.com/doi/10.1111/1468-0394.00046

[^1_3]: https://journals.lww.com/00006982-201612000-00023

[^1_4]: https://www.semanticscholar.org/paper/ede60a0de069c5cc642ef448e573e3b3e4d91137

[^1_5]: https://www.semanticscholar.org/paper/bec731f2c0defb2c84180ff707fa0dd7e6289598

[^1_6]: http://arxiv.org/pdf/2308.01285.pdf

[^1_7]: image.jpg

[^1_8]: https://github.com/teknokomo/universo-platformo-react

[^1_9]: https://journals.uic.edu/ojs/index.php/dad/article/view/10785

[^1_10]: https://www.semanticscholar.org/paper/5875caa50e329f48e81a3486f9486e0a54282a29

[^1_11]: https://www.semanticscholar.org/paper/6297853450aa807567a1938ea9a8c4b3587cf733

[^1_12]: https://www.semanticscholar.org/paper/b491ef3b6facecb49cf705bd1e0574db0bdd28eb

[^1_13]: https://arxiv.org/pdf/2412.16420.pdf

[^1_14]: https://arxiv.org/pdf/2205.11690.pdf

[^1_15]: https://arxiv.org/html/2501.07834

[^1_16]: https://arxiv.org/pdf/2403.15852.pdf

[^1_17]: http://arxiv.org/pdf/2407.12821.pdf

[^1_18]: https://arxiv.org/html/2503.23781v1

[^1_19]: https://arxiv.org/pdf/2308.08155.pdf

[^1_20]: http://arxiv.org/pdf/2411.08274.pdf

[^1_21]: http://arxiv.org/pdf/2406.04516.pdf

[^1_22]: https://arxiv.org/pdf/2409.07429.pdf

[^1_23]: https://redis.io/learn/howtos/solutions/flowise/conversational-agent

[^1_24]: https://docs.flowiseai.com/using-flowise/agentflowv2

[^1_25]: https://www.ycombinator.com/launches/NVQ-flowise-3-0-build-ai-agents-visually

[^1_26]: https://www.youtube.com/watch?v=w3wAhZHIGFQ

[^1_27]: https://www.youtube.com/watch?v=9TaRksXuLWY

[^1_28]: https://www.youtube.com/watch?v=GE9IlksvGiU

[^1_29]: https://www.youtube.com/watch?v=GPsKnsYJPiI

[^1_30]: https://github.com/FlowiseAI/FlowiseDocs/blob/main/en/using-flowise/agentflows/multi-agents.md

[^1_31]: https://docs.flowiseai.com/tutorials/agent-as-tool

[^1_32]: https://www.youtube.com/watch?v=SLVVDUIbIBE

[^1_33]: https://www.codecademy.com/article/flowise-ai-tutorial

[^1_34]: https://github.com/FlowiseAI/Flowise/issues/4952

[^1_35]: https://www.youtube.com/watch?v=TbZaj5SZcbM

[^1_36]: https://flowiseai.com

[^1_37]: https://github.com/FlowiseAI/Flowise

[^1_38]: https://docs.flowiseai.com/using-flowise/agentflowv1/sequential-agents

[^1_39]: https://x.com/flowiseai

[^1_40]: https://www.semanticscholar.org/paper/4ab2507035e03a93695b00c5b6bf8a9019e4b595

[^1_41]: https://www.semanticscholar.org/paper/76b9a7beaa3c34c2cc899a2944a0b5d0886427a3

[^1_42]: https://www.semanticscholar.org/paper/582b6e913937ab4e6ac393ca4ab4fca4320b2bcb

[^1_43]: https://www.semanticscholar.org/paper/efb1312925e0ecc6a53ec13078b4f5b1ebbda306

[^1_44]: https://www.semanticscholar.org/paper/fcc2ad1af88693b2fd80ba54b8b78be6f2cf38c4

[^1_45]: https://www.semanticscholar.org/paper/748255225956057b9019d485488f526a5ca6b731

[^1_46]: https://www.acpjournals.org/doi/10.7326/M17-0284

[^1_47]: https://arxiv.org/pdf/2410.10762.pdf

[^1_48]: https://arxiv.org/html/2503.15520

[^1_49]: http://arxiv.org/pdf/2305.02483.pdf

[^1_50]: https://arxiv.org/pdf/2411.19485.pdf

[^1_51]: https://www.youtube.com/watch?v=kMtf9sNIcao

[^1_52]: https://www.youtube.com/watch?v=YEs-ossypsk

[^1_53]: https://ytscribe.com/de/v/V7uBy3VQJAc

[^1_54]: https://docs.flowiseai.com

[^1_55]: https://www.youtube.com/watch?v=NZRvpbwSBxY

[^1_56]: https://n8n.io/workflows/4651-create-a-branded-ai-chatbot-for-websites-with-flowise-multi-agent-chatflows/

[^1_57]: https://www.youtube.com/watch?v=h9N9wCrP9u4

[^1_58]: https://www.youtube.com/watch?v=FpHa9YdIanE

[^1_59]: https://www.reddit.com/r/flowise/comments/1bpgta5/flowise_help_for_beginners/

[^1_60]: https://de.scribd.com/document/791354233/Flowise-AI-Tutorial-3-File-Loaders-Text-Splitters-Embeddings-Vector-Stores

[^1_61]: https://arxiv.org/abs/2305.05845

[^1_62]: https://www.semanticscholar.org/paper/04fc307304529fdb4d64e97a7c04134479ddfd64

[^1_63]: https://www.semanticscholar.org/paper/10ac33cbfa4da3d05b6716b1e02f6856af8e521e

[^1_64]: https://www.semanticscholar.org/paper/e1e9512e469051d910c17e9c330bfbd51c7ab13f

[^1_65]: https://pubs.usgs.gov/publication/ofr20191090

[^1_66]: https://arxiv.org/pdf/2302.12014.pdf

[^1_67]: https://arxiv.org/html/2406.16177v1

[^1_68]: https://arxiv.org/html/2411.07506

[^1_69]: https://arxiv.org/html/2503.21889v1

[^1_70]: https://arxiv.org/html/2405.07510v4

[^1_71]: https://arxiv.org/html/2412.00100v1

[^1_72]: https://arxiv.org/abs/1401.4125

[^1_73]: https://arxiv.org/html/2503.17671v1

[^1_74]: https://arxiv.org/pdf/2312.13225.pdf

[^1_75]: https://arxiv.org/pdf/1405.3240.pdf

[^1_76]: https://arxiv.org/html/2409.13588v2

[^1_77]: https://www.youtube.com/watch?v=vd6DvHASgzU

[^1_78]: https://vibecoder.me/tools/flowise

[^1_79]: https://www.youtube.com/watch?v=MLTzD8phSps

[^1_80]: https://github.com/FlowiseAI/FlowiseChatEmbed

[^1_81]: https://www.youtube.com/watch?v=WRiVMiRI7iU

[^1_82]: https://docs.flowiseai.com/getting-started

[^1_83]: https://github.com/FlowiseAI/Flowise/releases

[^1_84]: https://chatbotdesign.substack.com/p/experimenting-with-generative-workflows

[^1_85]: https://github.com/orgs/FlowiseAI/repositories

[^1_86]: https://github.com/FlowiseAI/Flowise/blob/main/packages/ui/src/views/agentflowsv2/Canvas.jsx

[^1_87]: https://github.com/FlowiseAI/Flowise/blob/main/packages/ui/src/views/canvas/AddNodes.jsx

[^1_88]: https://github.com/FlowiseAI/Flowise/blob/main/packages/ui/src/ui-component/dialog/AgentflowGeneratorDialog.jsx

[^1_89]: https://github.com/FlowiseAI/Flowise/tree/main/packages/ui/src/views/agentflowsv2

[^1_90]: https://github.com/FlowiseAI/Flowise/tree/main/packages/ui/src/views/canvas

[^1_91]: https://github.com/FlowiseAI/Flowise/tree/main/packages/server/src

[^1_92]: https://arxiv.org/html/2408.15247v1

[^1_93]: https://arxiv.org/pdf/2502.17443.pdf

[^1_94]: http://arxiv.org/pdf/2412.15660.pdf

[^1_95]: https://arxiv.org/pdf/2503.11069.pdf

[^1_96]: https://arxiv.org/abs/2502.07373

[^1_97]: https://arxiv.org/pdf/2410.16464.pdf

[^1_98]: https://arxiv.org/pdf/2106.00583.pdf

[^1_99]: https://arxiv.org/html/2411.15004

[^1_100]: https://arxiv.org/pdf/2310.10634.pdf

[^1_101]: https://www.youtube.com/watch?v=LhN560DhlzU

[^1_102]: https://www.youtube.com/watch?v=284Z8k7yJRE

[^1_103]: https://github.com/FlowiseAI/Flowise/discussions/2581

[^1_104]: https://www.youtube.com/watch?v=9R5zo3IVkqU

[^1_105]: https://docs.tavily.com/documentation/integrations/flowise

[^1_106]: https://github.com/FlowiseAI/Flowise/issues/4686

[^1_107]: https://docs.flowiseai.com/tutorials/interacting-with-api

[^1_108]: https://github.com/FlowiseAI/Flowise/issues/3425

[^1_109]: https://github.com/FlowiseAI/Flowise/discussions/2181

[^1_110]: https://stackoverflow.com/questions/tagged/flowise

[^1_111]: https://www.youtube.com/watch?v=7FClI-QM3tk

[^1_112]: https://www.youtube.com/watch?v=_K9xJqEgnrU

[^1_113]: https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/controllers/agentflowv2-generator/index.ts

[^1_114]: https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/services/agentflowv2-generator/index.ts

[^1_115]: https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/routes/agentflowv2-generator/index.ts

[^1_116]: https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/services/agentflowv2-generator/prompt.ts

[^1_117]: https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/routes/index.ts

[^1_118]: https://github.com/FlowiseAI/Flowise/blob/main/packages/server/src/routes/chatflows/index.ts

