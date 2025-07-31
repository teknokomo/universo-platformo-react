---
description: Узнайте, как загружать изображения, аудио и другие файлы
---

# Загрузки

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

Flowise позволяет загружать изображения, аудио и другие файлы из чата. В этом разделе вы узнаете, как включить и использовать эти функции.

## Изображения

Определенные модели чата позволяют вводить изображения. Всегда обращайтесь к официальной документации LLM, чтобы подтвердить, поддерживает ли модель ввод изображений.

* [ChatOpenAI](../integrations/llamaindex/chat-models/chatopenai.md)
* [AzureChatOpenAI](../integrations/llamaindex/chat-models/azurechatopenai.md)
* [ChatAnthropic](../integrations/langchain/chat-models/chatanthropic.md)
* [AWSChatBedrock](../integrations/langchain/chat-models/aws-chatbedrock.md)
* [ChatGoogleGenerativeAI](../integrations/langchain/chat-models/google-ai.md)
* [ChatOllama](../integrations/llamaindex/chat-models/chatollama.md)
* [Google Vertex AI](../integrations/langchain/llms/googlevertex-ai.md)

{% hint style="warning" %}
Обработка изображений работает только с определенными цепочками/агентами в чат-потоке.

[LLMChain](../integrations/langchain/chains/llm-chain.md), [Conversation Chain](../integrations/langchain/chains/conversation-chain.md), [ReAct Agent](../integrations/langchain/agents/react-agent-chat.md), [Conversational Agent](../integrations/langchain/agents/conversational-agent.md), [Tool Agent](../integrations/langchain/agents/tool-agent.md)
{% endhint %}

Если вы включите **Разрешить загрузку изображений**, вы можете загружать изображения из интерфейса чата.

<div align="center"><figure><img src="../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" width="255"><figcaption></figcaption></figure> <figure><img src="../.gitbook/assets/Screenshot 2024-02-29 011714.png" alt="" width="290"><figcaption></figcaption></figure></div>

Для загрузки изображений через API:

{% tabs %}
{% tab title="Python" %}
```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "question": "Можете ли вы описать изображение?",
    "uploads": [
        {
            "data": "data:image/png;base64,iVBORw0KGgdM2uN0", # base64 строка или url
            "type": "file", # file | url
            "name": "Flowise.png",
            "mime": "image/png"
        }
    ]
})
```
{% endtab %}

{% tab title="Javascript" %}
```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "Можете ли вы описать изображение?",
    "uploads": [
        {
            "data": "data:image/png;base64,iVBORw0KGgdM2uN0", //base64 строка или url
            "type": "file", // file | url
            "name": "Flowise.png",
            "mime": "image/png"
        }
    ]
}).then((response) => {
    console.log(response);
});
```
{% endtab %}
{% endtabs %}

## Аудио

В конфигурации чат-потока вы можете выбрать модуль преобразования речи в текст. Поддерживаемые интеграции включают:

* OpenAI
* AssemblyAI
* [LocalAI](../integrations/langchain/chat-models/chatlocalai.md)

Когда это включено, пользователи могут говорить прямо в микрофон. Их речь будет транскрибирована в текст.

<div align="left"><figure><img src="../.gitbook/assets/image (2) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" width="563"><figcaption></figcaption></figure> <figure><img src="../.gitbook/assets/Screenshot 2024-02-29 012538.png" alt="" width="431"><figcaption></figcaption></figure></div>

Для загрузки аудио через API:

{% tabs %}
{% tab title="Python" %}
```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()
    
output = query({
    "uploads": [
        {
            "data": "data:audio/webm;codecs=opus;base64,GkXf", # base64 строка
            "type": "audio",
            "name": "audio.wav",
            "mime": "audio/webm"
        }
    ]
})
```
{% endtab %}

{% tab title="Javascript" %}
```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "uploads": [
        {
            "data": "data:audio/webm;codecs=opus;base64,GkXf", // base64 строка
            "type": "audio",
            "name": "audio.wav",
            "mime": "audio/webm"
        }
    ]
}).then((response) => {
    console.log(response);
});
```
{% endtab %}
{% endtabs %}

## Файлы

Вы можете загружать файлы двумя способами:

* Загрузка файлов для расширенной генерации поиска (RAG)
* Полная загрузка файлов

Когда обе опции включены, полная загрузка файлов имеет приоритет.

### Загрузка файлов RAG

Вы можете загружать загруженные файлы на лету в векторное хранилище. Чтобы включить загрузку файлов, убедитесь, что вы соответствуете этим предварительным условиям:

* Вы должны включить векторное хранилище, которое поддерживает загрузку файлов в чат-поток.
  * [Pinecone](../integrations/langchain/vector-stores/pinecone.md)
  * [Milvus](../integrations/langchain/vector-stores/milvus.md)
  * [Postgres](../integrations/langchain/vector-stores/postgres.md)
  * [Qdrant](../integrations/langchain/vector-stores/qdrant.md)
  * [Upstash](../integrations/langchain/vector-stores/upstash-vector.md)
* Если у вас есть несколько векторных хранилищ в чат-потоке, вы можете включить загрузку файлов только для одного векторного хранилища за раз.
* Вы должны подключить хотя бы один узел загрузчика документов к входу документа векторного хранилища.
* Поддерживаемые загрузчики документов:
  * [CSV File](../integrations/langchain/document-loaders/csv-file.md)
  * [Docx File](../integrations/langchain/document-loaders/docx-file.md)
  * [Json File](../integrations/langchain/document-loaders/json-file.md)
  * [Json Lines File](broken-reference)
  * [PDF File](../integrations/langchain/document-loaders/pdf-file.md)
  * [Text File](../integrations/langchain/document-loaders/text-file.md)
  * [Unstructured File](../integrations/langchain/document-loaders/unstructured-file-loader.md)

<figure><img src="../.gitbook/assets/image (2) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

Вы можете загрузить один или несколько файлов в чате:

<div align="left"><figure><img src="../.gitbook/assets/image (3) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt="" width="380"><figcaption></figcaption></figure> <figure><img src="../.gitbook/assets/Screenshot 2024-08-26 170456.png" alt=""><figcaption></figcaption></figure></div>

Вот как это работает:

1. Метаданные для загруженных файлов обновляются с chatId.
2. Это связывает файл с chatId.
3. При запросе применяется фильтр **ИЛИ**:

* Метаданные содержат `flowise_chatId`, и значение является текущим ID сессии чата
* Метаданные не содержат `flowise_chatId`

Пример векторного встраивания, загруженного в Pinecone:

<figure><img src="../.gitbook/assets/image (4) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

Чтобы сделать это с помощью API, выполните эти два шага:

1. Используйте [Vector Upsert API](broken-reference) с `formData` и `chatId`:

{% tabs %}
{% tab title="Python" %}
```python
import requests

API_URL = "http://localhost:3000/api/v1/vector/upsert/<chatflowid>"

# Используйте form data для загрузки файлов
form_data = {
    "files": ("state_of_the_union.txt", open("state_of_the_union.txt", "rb"))
}

body_data = {
    "chatId": "some-session-id"
}

def query(form_data):
    response = requests.post(API_URL, files=form_data, data=body_data)
    print(response)
    return response.json()

output = query(form_data)
print(output)
```
{% endtab %}

{% tab title="Javascript" %}
```javascript
// Используйте FormData для загрузки файлов
let formData = new FormData();
formData.append("files", input.files[0]);
formData.append("chatId", "some-session-id");

async function query(formData) {
    const response = await fetch(
        "http://localhost:3000/api/v1/vector/upsert/<chatflowid>",
        {
            method: "POST",
            body: formData
        }
    );
    const result = await response.json();
    return result;
}

query(formData).then((response) => {
    console.log(response);
});
```
{% endtab %}
{% endtabs %}

2. Используйте [Prediction API](broken-reference) с `uploads` и `chatId` из шага 1:

{% tabs %}
{% tab title="Python" %}
```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()

output = query({
    "question": "О чем речь?",
    "chatId": "same-session-id-from-step-1",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:rag",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
})
```
{% endtab %}

{% tab title="Javascript" %}
```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "О чем речь?",
    "chatId": "same-session-id-from-step-1",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:rag",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
}).then((response) => {
    console.log(response);
});
```
{% endtab %}
{% endtabs %}

### Полная загрузка файлов

С загрузкой файлов RAG вы не можете работать со структурированными данными, такими как электронные таблицы или таблицы, и не можете выполнять полное резюмирование из-за отсутствия полного контекста. В некоторых случаях вы можете захотеть включить все содержимое файла непосредственно в промпт для LLM, особенно с моделями, такими как Gemini и Claude, которые имеют более длинные контекстные окна. [Эта исследовательская работа](https://arxiv.org/html/2407.16833v1) - одна из многих, которые сравнивают RAG с более длинными контекстными окнами.

Чтобы включить полную загрузку файлов, перейдите в **Конфигурацию чат-потока**, откройте вкладку **Загрузка файлов** и нажмите переключатель:

<figure><img src="../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

Вы можете увидеть кнопку **Прикрепление файла** в чате, где вы можете загрузить один или несколько файлов. Под капотом [File Loader](../integrations/langchain/document-loaders/file-loader.md) обрабатывает каждый файл и преобразует его в текст.

<figure><img src="../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (2).png" alt=""><figcaption></figcaption></figure>

Обратите внимание, что если ваш чат-поток использует узел Chat Prompt Template, входные данные должны быть созданы из **Format Prompt Values** для передачи данных файла. Указанное имя входных данных (например, {file}) должно быть включено в поле **Human Message**.

<figure><img src="../.gitbook/assets/chat-prompt-template-file-attachment.jpg" alt=""><figcaption></figcaption></figure>

Для загрузки файлов через API:

{% tabs %}
{% tab title="Python" %}
```python
import requests
API_URL = "http://localhost:3000/api/v1/prediction/<chatflowid>"

def query(payload):
    response = requests.post(API_URL, json=payload)
    return response.json()

output = query({
    "question": "О чем данные?",
    "chatId": "some-session-id",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:full",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
})
```
{% endtab %}

{% tab title="Javascript" %}
```javascript
async function query(data) {
    const response = await fetch(
        "http://localhost:3000/api/v1/prediction/<chatflowid>",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        }
    );
    const result = await response.json();
    return result;
}

query({
    "question": "О чем данные?",
    "chatId": "some-session-id",
    "uploads": [
        {
            "data": "data:text/plain;base64,TWFkYWwcy4=",
            "type": "file:full",
            "name": "state_of_the_union.txt",
            "mime": "text/plain"
        }
    ]
}).then((response) => {
    console.log(response);
});
```
{% endtab %}
{% endtabs %}

Как вы можете видеть в примерах, загрузки требуют строку base64. Чтобы получить строку base64 для файла, используйте [Create Attachments API](../api-reference/attachments.md).

### Разница между полной загрузкой и RAG загрузкой

Как полная, так и RAG (Retrieval-Augmented Generation) загрузка файлов служат разным целям.

* **Полная загрузка файла**: Этот метод парсит весь файл в строку и отправляет его в LLM (Large Language Model). Это полезно для резюмирования документа или извлечения ключевой информации. Однако с очень большими файлами модель может производить неточные результаты или "галлюцинации" из-за ограничений токенов.
* **RAG загрузка файла**: Рекомендуется, если вы стремитесь снизить затраты на токены, не отправляя весь текст в LLM. Этот подход подходит для задач Q&A по документам, но не идеален для резюмирования, поскольку ему не хватает полного контекста документа. Этот подход может занять больше времени из-за процесса загрузки.
