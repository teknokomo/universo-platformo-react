# Conversational Retrieval QA Chain

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

Цепочка для выполнения задач вопросов-ответов с компонентом извлечения.

<figure><img src="../../../.gitbook/assets/image (6) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

## Определения

**Цепочка вопросов-ответов на основе извлечения**, которая интегрируется с компонентом извлечения и позволяет настраивать входные параметры и выполнять задачи вопросов-ответов.\
**Чат-боты на основе извлечения:** Чат-боты на основе извлечения - это чат-боты, которые генерируют ответы, выбирая предопределенные ответы из базы данных или набора возможных ответов. Они "извлекают" наиболее подходящий ответ на основе входных данных от пользователя.\
**QA (Вопросы-Ответы):** Системы QA предназначены для ответов на вопросы, заданные на естественном языке. Они обычно включают понимание вопроса и поиск или генерацию подходящего ответа.

## Входные данные

* [Языковая модель](../chat-models/)
* [Извлекатель векторного хранилища](../vector-stores/)
* [Память (опционально)](../memory/)

## Параметры

| Название                | Описание                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Return Source Documents | Возвращать цитаты/источники, которые использовались для построения ответа                                                                                |
| System Message          | Инструкция для LLM о том, как отвечать на запрос                                                                                                         |
| Chain Option            | Метод суммирования, ответов на вопросы и извлечения информации из документов. Читать [подробнее](https://js.langchain.com/docs/modules/chains/document/) |

## Выходные данные

| Название                           | Описание                          |
| ---------------------------------- | --------------------------------- |
| ConversationalRetrievalQAChain     | Финальный узел для возврата ответа |
