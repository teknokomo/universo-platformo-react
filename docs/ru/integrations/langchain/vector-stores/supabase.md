# Supabase

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

## Предварительные требования

1. Зарегистрируйте аккаунт в [Supabase](https://supabase.com/)
2. Нажмите **New project**

<figure><img src="../../../.gitbook/assets/image (8) (2) (1).png" alt=""><figcaption></figcaption></figure>

3. Введите обязательные поля

| Название поля             | Описание                                          |
| ------------------------- | ------------------------------------------------- |
| **Name**                  | имя создаваемого проекта (например, Flowise)     |
| **Database** **Password** | пароль к вашей базе данных postgres              |

<figure><img src="../../../.gitbook/assets/image (25) (1) (1).png" alt=""><figcaption></figcaption></figure>

4. Нажмите **Create new project** и дождитесь завершения настройки проекта
5. Нажмите **SQL Editor**

<figure><img src="../../../.gitbook/assets/image (7) (2) (2).png" alt=""><figcaption></figcaption></figure>

6. Нажмите **New query**

<figure><img src="../../../.gitbook/assets/image (36) (1).png" alt=""><figcaption></figcaption></figure>

7. Скопируйте и вставьте приведенный ниже SQL запрос и выполните его с помощью `Ctrl + Enter` или нажмите **RUN**. Обратите внимание на имя таблицы и имя функции.

* **Имя таблицы**: `documents`
* **Имя запроса**: `match_documents`

```plsql
-- Включить расширение pgvector для работы с векторами эмбеддингов
create extension vector;

-- Создать таблицу для хранения ваших документов
create table documents (
  id bigserial primary key,
  content text, -- соответствует Document.pageContent
  metadata jsonb, -- соответствует Document.metadata
  embedding vector(1536) -- 1536 работает для эмбеддингов OpenAI, измените при необходимости
);

-- Создать функцию для поиска документов
create function match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

```

В некоторых случаях вы можете использовать [Менеджер записей](../record-managers.md) для отслеживания загрузок и предотвращения дублирования. Поскольку менеджер записей генерирует случайный UUID для каждого эмбеддинга, вам нужно будет изменить сущность столбца id на text:

```sql
-- Включить расширение pgvector для работы с векторами эмбеддингов
create extension vector;

-- Создать таблицу для хранения ваших документов
create table documents (
  id text primary key, -- ИЗМЕНИТЬ НА TEXT
  content text,
  metadata jsonb,
  embedding vector(1536)
);

-- Создать функцию для поиска документов
create function match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  filter jsonb DEFAULT '{}'
) returns table (
  id text, -- ИЗМЕНИТЬ НА TEXT
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
#variable_conflict use_column
begin
  return query
  select
    id,
    content,
    metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where metadata @> filter
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;

```

<figure><img src="../../../.gitbook/assets/image (19) (1) (1) (1) (2).png" alt=""><figcaption></figcaption></figure>

## Настройка

1. Нажмите **Project Settings**

<figure><img src="../../../.gitbook/assets/image (30) (1).png" alt=""><figcaption></figcaption></figure>

2. Получите ваш **Project URL & API Key**

<figure><img src="../../../.gitbook/assets/image (2) (3).png" alt=""><figcaption></figcaption></figure>

3. Скопируйте и вставьте каждую деталь (_API ключ, URL, имя таблицы, имя запроса_) в узел **Supabase**

<figure><img src="../../../.gitbook/assets/image (85).png" alt="" width="331"><figcaption></figcaption></figure>

4. **Document** может быть подключен к любому узлу из категории [**Document Loader**](../document-loaders/)
5. **Embeddings** может быть подключен к любому узлу из категории [**Embeddings**](../embeddings/)

## Фильтрация

Допустим, у вас есть разные документы, загруженные с уникальным значением под ключом метаданных `{source}`

<figure><img src="../../../.gitbook/assets/Untitled.png" alt=""><figcaption></figcaption></figure>

Вы можете использовать фильтрацию метаданных для запроса конкретных метаданных:

**UI**

<figure><img src="../../../.gitbook/assets/image (9) (1) (1) (1) (1) (2) (1).png" alt="" width="232"><figcaption></figcaption></figure>

**API**

```json
"overrideConfig": {
    "supabaseMetadataFilter": {
        "source": "henry"
    }
}
```

## Ресурсы

* [LangChain JS Supabase](https://js.langchain.com/docs/modules/indexes/vector_stores/integrations/supabase)
* [Пост в блоге Supabase](https://supabase.com/blog/openai-embeddings-postgres-vector)
* [Фильтрация метаданных](https://js.langchain.com/docs/integrations/vectorstores/supabase#metadata-filtering)
