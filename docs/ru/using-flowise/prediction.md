# Предсказания

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

Prediction API является основной конечной точкой для взаимодействия с вашими потоками Flowise и ассистентами. Он позволяет отправлять сообщения в выбранный поток и получать ответы обратно. Этот API обрабатывает основную функциональность чата, включая:

* **Взаимодействие в чате**: Отправка вопросов или сообщений в ваш поток и получение ответов, сгенерированных ИИ
* **Потоковые ответы**: Получение ответов в реальном времени для лучшего пользовательского опыта
* **Память разговора**: Поддержание контекста между несколькими сообщениями в рамках сессии
* **Обработка файлов**: Загрузка и обработка изображений, аудио и других файлов как части ваших запросов
* **Динамическая конфигурация**: Переопределение настроек чат-потока и передача переменных во время выполнения

Для подробностей смотрите [справочник API конечной точки Prediction](../api-reference/prediction.md).

## Базовый URL и аутентификация

**Базовый URL**: `http://localhost:3000` (или URL вашего экземпляра Flowise)

**Конечная точка**: `POST /api/v1/prediction/:id`

**Аутентификация**: Обратитесь к [аутентификации для потоков](../configuration/authorization/canvas-level.md)

## Формат запроса

#### Базовая структура запроса

```json
{
    "question": "Ваше сообщение здесь",
    "streaming": false,
    "overrideConfig": {},
    "history": [],
    "uploads": [],
    "form": {}
}
```

#### Параметры

| Параметр         | Тип     | Обязательный                | Описание                                    |
| ---------------- | ------- | --------------------------- | ------------------------------------------- |
| `question`       | string  | Да                          | Сообщение/вопрос для отправки в поток       |
| `form`           | object  | Либо `question`, либо `form` | Объект формы для отправки в поток           |
| `streaming`      | boolean | Нет                         | Включить потоковые ответы (по умолчанию: false) |
| `overrideConfig` | object  | Нет                         | Переопределить конфигурацию потока          |
| `history`        | array   | Нет                         | Предыдущие сообщения разговора              |
| `uploads`        | array   | Нет                         | Файлы для загрузки (изображения, аудио и т.д.) |
| `humanInput`     | object  | Нет                         | Вернуть обратную связь человека и возобновить выполнение |

## SDK библиотеки

Flowise предоставляет официальные SDK для Python и TypeScript/JavaScript:

#### Установка

**Python**: `pip install flowise`

**TypeScript/JavaScript**: `npm install flowise-sdk`

## Основные примеры использования

### 1. Простой запрос

```python
# Python
import requests

url = "http://localhost:3000/api/v1/prediction/your-canvas-id"
data = {
    "question": "Привет! Как дела?"
}

response = requests.post(url, json=data)
result = response.json()
print(result["text"])
```

```javascript
// JavaScript
const response = await fetch('http://localhost:3000/api/v1/prediction/your-canvas-id', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        question: "Привет! Как дела?"
    })
});

const result = await response.json();
console.log(result.text);
```

### 2. Потоковый ответ

```python
# Python с потоковой передачей
import requests
import json

url = "http://localhost:3000/api/v1/prediction/your-canvas-id"
data = {
    "question": "Расскажи длинную историю",
    "streaming": True
}

response = requests.post(url, json=data, stream=True)

for line in response.iter_lines():
    if line:
        chunk = line.decode('utf-8')
        if chunk.startswith('data: '):
            data = chunk[6:]  # Убираем 'data: '
            if data != '[DONE]':
                try:
                    parsed = json.loads(data)
                    print(parsed.get('text', ''), end='', flush=True)
                except json.JSONDecodeError:
                    continue
```

```javascript
// JavaScript с потоковой передачей
const response = await fetch('http://localhost:3000/api/v1/prediction/your-canvas-id', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        question: "Расскажи длинную историю",
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
            if (data !== '[DONE]') {
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

### 3. Запрос с историей разговора

```python
# Python с историей
data = {
    "question": "А что насчет Python?",
    "history": [
        {
            "role": "user",
            "content": "Расскажи о языках программирования"
        },
        {
            "role": "assistant", 
            "content": "Языки программирования - это формальные языки для создания программ..."
        }
    ]
}

response = requests.post(url, json=data)
```

### 4. Переопределение конфигурации

```python
# Переопределение настроек во время выполнения
data = {
    "question": "Объясни квантовую физику",
    "overrideConfig": {
        "temperature": 0.1,  # Более детерминированные ответы
        "maxTokens": 500,    # Ограничить длину ответа
        "systemMessage": "Ты физик-теоретик. Объясняй сложные концепции простым языком.",
        "sessionId": "user_123"  # Для разделения сессий
    }
}
```

### 5. Загрузка файлов

```python
# Загрузка изображения для анализа
import base64

# Кодирование изображения в base64
with open("image.jpg", "rb") as image_file:
    encoded_image = base64.b64encode(image_file.read()).decode('utf-8')

data = {
    "question": "Что изображено на этой картинке?",
    "uploads": [
        {
            "data": f"data:image/jpeg;base64,{encoded_image}",
            "type": "file",
            "name": "image.jpg",
            "mime": "image/jpeg"
        }
    ]
}
```

## Продвинутые возможности

### 1. Работа с переменными

```python
# Передача переменных в чат-поток
data = {
    "question": "Создай отчет для клиента",
    "overrideConfig": {
        "vars": {
            "client_name": "ООО Рога и Копыта",
            "report_type": "monthly",
            "api_key": "secret_key_123"
        }
    }
}
```

### 2. Обработка форм

```python
# Отправка структурированных данных через форму
data = {
    "form": {
        "customer_info": {
            "name": "Иван Иванов",
            "email": "ivan@example.com",
            "phone": "+7-123-456-7890"
        },
        "request_type": "support",
        "priority": "high",
        "description": "Проблема с авторизацией в системе"
    }
}
```

### 3. Human-in-the-loop

```python
# Возобновление выполнения после вмешательства человека
data = {
    "question": "",  # Пустой для возобновления
    "humanInput": {
        "action": "approve",
        "feedback": "Одобрено для выполнения",
        "data": {
            "approved_amount": 50000,
            "approval_code": "APPR-2024-001"
        }
    }
}
```

## Обработка ошибок

### Типичные ошибки и их обработка

```python
import requests
from requests.exceptions import RequestException, Timeout

def safe_prediction_request(url, data, timeout=30):
    try:
        response = requests.post(url, json=data, timeout=timeout)
        response.raise_for_status()  # Вызовет исключение для HTTP ошибок
        
        result = response.json()
        
        # Проверка на ошибки в ответе
        if 'error' in result:
            print(f"Ошибка API: {result['error']}")
            return None
            
        return result
        
    except Timeout:
        print("Превышено время ожидания запроса")
        return None
        
    except RequestException as e:
        print(f"Ошибка сети: {e}")
        return None
        
    except ValueError as e:
        print(f"Ошибка парсинга JSON: {e}")
        return None
        
    except Exception as e:
        print(f"Неожиданная ошибка: {e}")
        return None

# Использование
result = safe_prediction_request(url, data)
if result:
    print(result.get('text', 'Нет текста в ответе'))
```

### Retry логика

```python
import time
import random

def prediction_with_retry(url, data, max_retries=3, backoff_factor=2):
    for attempt in range(max_retries):
        try:
            response = requests.post(url, json=data, timeout=30)
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise e
                
            wait_time = backoff_factor ** attempt + random.uniform(0, 1)
            print(f"Попытка {attempt + 1} неудачна. Повтор через {wait_time:.2f} сек...")
            time.sleep(wait_time)
    
    return None
```

## Мониторинг и логирование

### Логирование запросов

```python
import logging
import time
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('flowise_requests.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

def logged_prediction(url, data, canvas_id):
    start_time = time.time()
    request_id = f"req_{int(time.time())}_{random.randint(1000, 9999)}"
    
    logger.info(f"[{request_id}] Начало запроса к {canvas_id}")
    logger.debug(f"[{request_id}] Данные запроса: {data}")
    
    try:
        response = requests.post(url, json=data)
        response.raise_for_status()
        result = response.json()
        
        duration = time.time() - start_time
        logger.info(f"[{request_id}] Запрос выполнен успешно за {duration:.2f}с")
        
        return result
        
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"[{request_id}] Ошибка запроса за {duration:.2f}с: {e}")
        raise
```

### Метрики производительности

```python
class PredictionMetrics:
    def __init__(self):
        self.requests_count = 0
        self.total_duration = 0
        self.error_count = 0
        self.response_times = []
    
    def record_request(self, duration, success=True):
        self.requests_count += 1
        self.total_duration += duration
        self.response_times.append(duration)
        
        if not success:
            self.error_count += 1
    
    def get_stats(self):
        if self.requests_count == 0:
            return {"message": "Нет данных"}
        
        avg_response_time = self.total_duration / self.requests_count
        success_rate = (self.requests_count - self.error_count) / self.requests_count * 100
        
        return {
            "total_requests": self.requests_count,
            "success_rate": f"{success_rate:.2f}%",
            "avg_response_time": f"{avg_response_time:.2f}s",
            "min_response_time": f"{min(self.response_times):.2f}s",
            "max_response_time": f"{max(self.response_times):.2f}s"
        }

# Использование
metrics = PredictionMetrics()

def tracked_prediction(url, data):
    start_time = time.time()
    success = False
    
    try:
        result = requests.post(url, json=data).json()
        success = True
        return result
    finally:
        duration = time.time() - start_time
        metrics.record_request(duration, success)
```

## Заключение

Prediction API предоставляет мощный и гибкий интерфейс для взаимодействия с вашими чат-потоками Flowise. Правильное использование всех возможностей API, включая потоковую передачу, управление сессиями, обработку файлов и переопределение конфигураций, позволяет создавать богатые интерактивные приложения.

Ключевые принципы успешного использования:
- **Обрабатывайте ошибки gracefully** с retry логикой
- **Используйте потоковую передачу** для лучшего UX
- **Логируйте запросы** для отладки и мониторинга
- **Оптимизируйте производительность** с помощью кэширования и пулинга соединений
- **Тестируйте различные сценарии** перед развертыванием в продакшене
