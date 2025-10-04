---
description: Узнайте, как работает потоковая передача в Flowise
---

# Потоковая передача

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

Если потоковая передача установлена при выполнении предсказания, токены будут отправляться как [server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#Event_stream_format) только с данными по мере их появления.

## Что такое потоковая передача?

Потоковая передача (streaming) - это технология, которая позволяет получать ответы от AI модели по частям в реальном времени, вместо ожидания полного ответа. Это обеспечивает:

- **Лучший пользовательский опыт** - пользователи видят ответ по мере его генерации
- **Снижение воспринимаемой задержки** - ответ начинает появляться быстрее
- **Интерактивность** - возможность прервать генерацию при необходимости
- **Эффективность** - меньшее использование памяти для длинных ответов

## Использование библиотек Python/TypeScript

Flowise предоставляет 2 библиотеки:

* [Python](https://pypi.org/project/flowise/): `pip install flowise`
* [TypeScript](https://www.npmjs.com/package/flowise-sdk): `npm install flowise-sdk`

### Python SDK

{% tabs %}
{% tab title="Python" %}
```python
from flowise import Flowise, PredictionData

def test_streaming():
    client = Flowise()

    # Тест потоковой передачи предсказания
    completion = client.create_prediction(
        PredictionData(
            canvasId="<flow-id>",
            question="Расскажи анекдот!",
            streaming=True
        )
    )

    # Обработка и вывод каждого потокового фрагмента
    print("Потоковый ответ:")
    for chunk in completion:
        # {event: "token", data: "привет"}
        print(chunk)

if __name__ == "__main__":
    test_streaming()
```
{% endtab %}

{% tab title="TypeScript" %}
```javascript
import { FlowiseClient } from 'flowise-sdk'

async function test_streaming() {
  const client = new FlowiseClient({ baseUrl: 'http://localhost:3000' });

  try {
    // Для потокового предсказания
    const prediction = await client.createPrediction({
      canvasId: '<flow-id>',
      question: 'Какая столица Франции?',
      streaming: true,
    });

    for await (const chunk of prediction) {
      // {event: "token", data: "Париж"}
      console.log(chunk);
    }
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

test_streaming();
```
{% endtab %}
{% endtabs %}

## Прямое использование API

### Базовый пример потоковой передачи

```javascript
// JavaScript/Node.js
async function streamingRequest() {
    const response = await fetch('http://localhost:3000/api/v1/prediction/your-canvas-id', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: "Напиши длинную историю о космических путешествиях",
            streaming: true
        })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                    console.log('\nПотоковая передача завершена');
                    return;
                }
                
                try {
                    const parsed = JSON.parse(data);
                    process.stdout.write(parsed.text || '');
                } catch (e) {
                    // Игнорируем ошибки парсинга
                }
            }
        }
    }
}
```

### Python с обработкой ошибок

```python
import requests
import json
import time

def streaming_request_with_error_handling():
    url = "http://localhost:3000/api/v1/prediction/your-canvas-id"
    data = {
        "question": "Объясни квантовую механику простыми словами",
        "streaming": True
    }
    
    try:
        response = requests.post(url, json=data, stream=True, timeout=60)
        response.raise_for_status()
        
        print("Начало потоковой передачи...")
        
        for line in response.iter_lines(decode_unicode=True):
            if line:
                if line.startswith('data: '):
                    data_part = line[6:]  # Убираем 'data: '
                    
                    if data_part == '[DONE]':
                        print("\n\nПотоковая передача завершена")
                        break
                    
                    try:
                        parsed = json.loads(data_part)
                        text = parsed.get('text', '')
                        if text:
                            print(text, end='', flush=True)
                    except json.JSONDecodeError:
                        continue
                        
    except requests.exceptions.Timeout:
        print("Превышено время ожидания")
    except requests.exceptions.RequestException as e:
        print(f"Ошибка запроса: {e}")
    except KeyboardInterrupt:
        print("\nПотоковая передача прервана пользователем")
```

## Продвинутые техники потоковой передачи

### 1. Буферизация и обработка фрагментов

```python
class StreamBuffer:
    def __init__(self, chunk_size=50):
        self.buffer = ""
        self.chunk_size = chunk_size
        self.complete_sentences = []
    
    def add_text(self, text):
        self.buffer += text
        
        # Проверяем на завершенные предложения
        while '.' in self.buffer or '!' in self.buffer or '?' in self.buffer:
            # Находим конец предложения
            end_indices = [
                self.buffer.find('.'),
                self.buffer.find('!'),
                self.buffer.find('?')
            ]
            end_indices = [i for i in end_indices if i != -1]
            
            if end_indices:
                end_pos = min(end_indices) + 1
                sentence = self.buffer[:end_pos].strip()
                if sentence:
                    self.complete_sentences.append(sentence)
                self.buffer = self.buffer[end_pos:].strip()
            else:
                break
    
    def get_complete_sentences(self):
        sentences = self.complete_sentences.copy()
        self.complete_sentences.clear()
        return sentences
    
    def get_remaining_buffer(self):
        return self.buffer

# Использование
buffer = StreamBuffer()

def process_streaming_response():
    # ... код для получения потока ...
    
    for chunk in stream:
        if chunk.get('text'):
            buffer.add_text(chunk['text'])
            
            # Обработка завершенных предложений
            sentences = buffer.get_complete_sentences()
            for sentence in sentences:
                print(f"Завершенное предложение: {sentence}")
    
    # Обработка оставшегося буфера
    remaining = buffer.get_remaining_buffer()
    if remaining:
        print(f"Оставшийся текст: {remaining}")
```

### 2. Потоковая передача с метаданными

```python
def enhanced_streaming():
    url = "http://localhost:3000/api/v1/prediction/your-canvas-id"
    data = {
        "question": "Создай подробный план проекта",
        "streaming": True,
        "overrideConfig": {
            "returnSourceDocuments": True,
            "returnIntermediateSteps": True
        }
    }
    
    response = requests.post(url, json=data, stream=True)
    
    current_step = None
    accumulated_text = ""
    
    for line in response.iter_lines(decode_unicode=True):
        if line and line.startswith('data: '):
            data_part = line[6:]
            
            if data_part == '[DONE]':
                break
            
            try:
                parsed = json.loads(data_part)
                
                # Обработка различных типов событий
                event_type = parsed.get('event', 'token')
                
                if event_type == 'token':
                    text = parsed.get('text', '')
                    accumulated_text += text
                    print(text, end='', flush=True)
                
                elif event_type == 'step':
                    step_info = parsed.get('data', {})
                    current_step = step_info.get('step')
                    print(f"\n[Шаг: {current_step}]")
                
                elif event_type == 'source':
                    sources = parsed.get('data', [])
                    print(f"\n[Источники: {len(sources)} документов]")
                
                elif event_type == 'error':
                    error_msg = parsed.get('data', 'Неизвестная ошибка')
                    print(f"\n[Ошибка: {error_msg}]")
                    
            except json.JSONDecodeError:
                continue
    
    return accumulated_text
```

### 3. Потоковая передача с сохранением в файл

```python
import os
from datetime import datetime

def streaming_to_file():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"streaming_output_{timestamp}.txt"
    
    url = "http://localhost:3000/api/v1/prediction/your-canvas-id"
    data = {
        "question": "Напиши подробную статью о машинном обучении",
        "streaming": True
    }
    
    response = requests.post(url, json=data, stream=True)
    
    with open(filename, 'w', encoding='utf-8') as file:
        print(f"Сохранение потока в файл: {filename}")
        
        for line in response.iter_lines(decode_unicode=True):
            if line and line.startswith('data: '):
                data_part = line[6:]
                
                if data_part == '[DONE]':
                    break
                
                try:
                    parsed = json.loads(data_part)
                    text = parsed.get('text', '')
                    
                    if text:
                        # Вывод в консоль
                        print(text, end='', flush=True)
                        
                        # Сохранение в файл
                        file.write(text)
                        file.flush()  # Принудительная запись
                        
                except json.JSONDecodeError:
                    continue
    
    print(f"\n\nПоток сохранен в файл: {filename}")
    return filename
```

## Обработка различных типов событий

### Структура событий

```python
# Типы событий в потоковой передаче
EVENT_TYPES = {
    'token': 'Текстовый токен',
    'start': 'Начало генерации',
    'end': 'Конец генерации', 
    'error': 'Ошибка',
    'step': 'Промежуточный шаг',
    'source': 'Источники данных',
    'metadata': 'Метаданные'
}

def handle_streaming_events():
    for line in response.iter_lines(decode_unicode=True):
        if line and line.startswith('data: '):
            data_part = line[6:]
            
            if data_part == '[DONE]':
                handle_stream_end()
                break
            
            try:
                event = json.loads(data_part)
                event_type = event.get('event', 'token')
                
                if event_type == 'token':
                    handle_token(event.get('data', ''))
                elif event_type == 'start':
                    handle_stream_start(event.get('data', {}))
                elif event_type == 'error':
                    handle_stream_error(event.get('data', {}))
                elif event_type == 'step':
                    handle_intermediate_step(event.get('data', {}))
                elif event_type == 'source':
                    handle_source_documents(event.get('data', []))
                elif event_type == 'metadata':
                    handle_metadata(event.get('data', {}))
                    
            except json.JSONDecodeError as e:
                print(f"Ошибка парсинга JSON: {e}")

def handle_token(text):
    print(text, end='', flush=True)

def handle_stream_start(data):
    print(f"[Начало генерации: {data.get('timestamp')}]")

def handle_stream_end():
    print("\n[Генерация завершена]")

def handle_stream_error(error_data):
    print(f"\n[Ошибка: {error_data.get('message', 'Неизвестная ошибка')}]")

def handle_intermediate_step(step_data):
    step_name = step_data.get('step', 'Неизвестный шаг')
    print(f"\n[Выполняется: {step_name}]")

def handle_source_documents(sources):
    print(f"\n[Найдено источников: {len(sources)}]")
    for i, source in enumerate(sources[:3]):  # Показываем первые 3
        title = source.get('metadata', {}).get('title', f'Документ {i+1}')
        print(f"  - {title}")

def handle_metadata(metadata):
    tokens_used = metadata.get('tokens_used', 0)
    model = metadata.get('model', 'Неизвестно')
    print(f"\n[Метаданные: Модель={model}, Токенов={tokens_used}]")
```

## Оптимизация производительности

### 1. Пулинг соединений

```python
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

class OptimizedStreamingClient:
    def __init__(self, base_url, max_retries=3):
        self.base_url = base_url
        self.session = requests.Session()
        
        # Настройка retry стратегии
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504],
        )
        
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
    
    def stream_prediction(self, canvas_id, question, **kwargs):
        url = f"{self.base_url}/api/v1/prediction/{canvas_id}"
        data = {
            "question": question,
            "streaming": True,
            **kwargs
        }
        
        response = self.session.post(url, json=data, stream=True, timeout=60)
        response.raise_for_status()
        
        return self._process_stream(response)
    
    def _process_stream(self, response):
        for line in response.iter_lines(decode_unicode=True):
            if line and line.startswith('data: '):
                data_part = line[6:]
                
                if data_part == '[DONE]':
                    break
                
                try:
                    yield json.loads(data_part)
                except json.JSONDecodeError:
                    continue

# Использование
client = OptimizedStreamingClient("http://localhost:3000")

for event in client.stream_prediction("your-canvas-id", "Расскажи о Python"):
    if event.get('text'):
        print(event['text'], end='', flush=True)
```

### 2. Асинхронная обработка

```python
import asyncio
import aiohttp
import json

async def async_streaming_request():
    url = "http://localhost:3000/api/v1/prediction/your-canvas-id"
    data = {
        "question": "Объясни асинхронное программирование",
        "streaming": True
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=data) as response:
            async for line in response.content:
                line_str = line.decode('utf-8').strip()
                
                if line_str.startswith('data: '):
                    data_part = line_str[6:]
                    
                    if data_part == '[DONE]':
                        break
                    
                    try:
                        event = json.loads(data_part)
                        text = event.get('text', '')
                        if text:
                            print(text, end='', flush=True)
                    except json.JSONDecodeError:
                        continue

# Запуск
asyncio.run(async_streaming_request())
```

## Заключение

Потоковая передача в Flowise обеспечивает отличный пользовательский опыт за счет мгновенного отображения результатов генерации. Правильная реализация потоковой передачи с обработкой ошибок, буферизацией и оптимизацией производительности позволяет создавать отзывчивые и надежные приложения.

Ключевые принципы успешного использования потоковой передачи:
- **Обрабатывайте все типы событий** для полной функциональности
- **Реализуйте graceful error handling** для стабильности
- **Используйте буферизацию** для оптимизации отображения
- **Мониторьте производительность** и оптимизируйте узкие места
- **Тестируйте на различных сценариях** включая медленные соединения
