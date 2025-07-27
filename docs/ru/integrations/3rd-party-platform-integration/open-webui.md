# Open WebUI

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

[Open WebUI](https://github.com/open-webui/open-webui) - это расширяемая, многофункциональная и удобная для пользователя _самостоятельно размещаемая AI платформа_, предназначенная для работы полностью в автономном режиме.

[Функции](https://docs.openwebui.com/features/plugin/functions/) подобны плагинам для Open WebUI. Мы можем создать пользовательскую [Pipe функцию](https://docs.openwebui.com/features/plugin/functions/pipe), которая обрабатывает входы и генерирует ответы, вызывая Flowise Prediction API перед возвратом результатов пользователю. Таким образом, Flowise может использоваться в Open WebUI.

## Настройка

1. Сначала запустите Open WebUI, вы можете обратиться к руководству [Быстрый старт](https://docs.openwebui.com/getting-started/quick-start/). В левом нижнем углу нажмите на ваш профиль и **Панель администратора**

<figure><img src="../../.gitbook/assets/image (4).png" alt="" width="235"><figcaption></figcaption></figure>

2. Откройте вкладку **Функции** и добавьте новую функцию.

<figure><img src="../../.gitbook/assets/image (1) (1) (1).png" alt="" width="423"><figcaption></figcaption></figure>

3. Назовите функцию и добавьте следующий код:

```python
"""
title: Интеграция Flowise для OpenWebUI
Requirements:
  - Flowise API URL (установить через FLOWISE_API_URL)
  - Flowise API Key (установить через FLOWISE_API_KEY)
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Union, Generator, Iterator
import requests
import json
import os


class Pipe:
    class Valves(BaseModel):
        flowise_url: str = Field(
            default=os.getenv("FLOWISE_API_URL", ""),
            description="Flowise URL",
        )
        flowise_api_key: str = Field(
            default=os.getenv("FLOWISE_API_KEY", ""),
            description="Flowise API ключ для аутентификации",
        )

    def __init__(self):
        self.type = "manifold"
        self.id = "flowise_chat"
        self.valves = self.Valves()

        # Проверка обязательных настроек
        if not self.valves.flowise_url:
            print(
                "⚠️ Пожалуйста, установите ваш Flowise URL, используя переменную окружения FLOWISE_API_URL"
            )
        if not self.valves.flowise_api_key:
            print(
                "⚠️ Пожалуйста, установите ваш Flowise API ключ, используя переменную окружения FLOWISE_API_KEY"
            )

    def pipes(self):
        if self.valves.flowise_api_key and self.valves.flowise_url:
            try:
                headers = {
                    "Authorization": f"Bearer {self.valves.flowise_api_key}",
                    "Content-Type": "application/json",
                }

                r = requests.get(
                    f"{self.valves.flowise_url}/api/v1/chatflows?type=AGENTFLOW",
                    headers=headers,
                )
                models = r.json()
                return [
                    {
                        "id": model["id"],
                        "name": model["name"],
                    }
                    for model in models
                ]

            except Exception as e:
                return [
                    {
                        "id": "error",
                        "name": e,
                    },
                ]
        else:
            return [
                {
                    "id": "error",
                    "name": "API ключ не предоставлен.",
                },
            ]

    def _process_message_content(self, message: dict) -> str:
        """Обработка содержимого сообщения, пока обрабатываем только текст"""
        if isinstance(message.get("content"), list):
            processed_content = []
            for item in message["content"]:
                if item["type"] == "text":
                    processed_content.append(item["text"])
            return " ".join(processed_content)
        return message.get("content", "")

    def pipe(
        self, body: dict, __user__: Optional[dict] = None, __metadata__: dict = None
    ) -> Union[str, Generator, Iterator]:
        """Обработка чат-сообщений через Flowise"""
        try:
            print("\nОбработка запроса Flowise:")
            print(f"Тело запроса: {json.dumps(body, indent=2)}")

            stream_enabled = body.get("stream", True)

            session_id = __metadata__['chat_id']

            # Извлечение id модели из имени модели
            model_id = body["model"][body["model"].find(".") + 1 :]

            # Извлечение сообщений из тела
            messages = body.get("messages", [])
            if not messages:
                raise Exception("Сообщения не найдены в теле запроса")

            # Получение текущего сообщения (последнее сообщение)
            current_message = messages[-1]
            question = self._process_message_content(current_message)

            # Подготовка полезной нагрузки запроса согласно формату Flowise API
            data = {
                "question": question,  # Текущее сообщение
                "overrideConfig": {
                    "sessionId": session_id
                },  # Опциональная конфигурация,
                "streaming": stream_enabled
            }

            headers = {
                "Authorization": f"Bearer {self.valves.flowise_api_key}",
                "Content-Type": "application/json",
            }

            print("\nВыполнение запроса к Flowise API:")
            print(f"URL: {self.valves.flowise_url}")
            print(f"Заголовки: {headers}")
            print(f"Данные: {json.dumps(data, indent=2)}")

            # Выполнение API запроса
            r = requests.post(
                url=f"{self.valves.flowise_url}/api/v1/prediction/{model_id}",
                json=data,
                headers=headers
            )
            r.raise_for_status()

            # Возврат ответа на основе предпочтения потоковой передачи
            if stream_enabled:
                for line in r.iter_lines(decode_unicode=True):
                    if line and line.startswith('data:'):
                        try:
                            # Удаление префикса 'data:' и парсинг JSON
                            json_data = line[5:]  # Удаление префикса 'data:'
                            response = json.loads(json_data)
                            
                            # Возврат только содержимого из событий токенов
                            if isinstance(response, dict) and response.get("event") == "token":
                                token_data = response.get("data", "")
                                if token_data:  # Возврат только непустых токенов
                                    yield token_data
                        except json.JSONDecodeError:
                            # Пропуск неправильно сформированных JSON строк
                            continue
            else:
                response = r.json()
                # Возврат только текстового поля из ответа
                if isinstance(response, dict) and "text" in response:
                    return response["text"]
                return ""

        except Exception as e:
            error_msg = f"Ошибка в Flowise pipe: {str(e)}"
            print(error_msg)
            return error_msg

```

4. После сохранения функции включите её и нажмите кнопку настроек, чтобы ввести ваш Flowise URL и Flowise API ключ:

<figure><img src="../../.gitbook/assets/image (2) (1) (1).png" alt="" width="563"><figcaption></figcaption></figure>

<figure><img src="../../.gitbook/assets/image (3) (1).png" alt="" width="431"><figcaption></figcaption></figure>

5. Теперь, когда вы обновите страницу и нажмете "Новый чат", вы сможете увидеть список потоков. Вы можете изменить код, чтобы показать:

* Только Agentflows V2: `f"{self.valves.flowise_url}/api/v1/chatflows?type=AGENTFLOW"`
* Только Chatflows: `f"{self.valves.flowise_url}/api/v1/chatflows?type=CHATFLOW"`
* Только Ассистентов: `f"{self.valves.flowise_url}/api/v1/chatflows?type=ASSISTANT"`

<figure><img src="../../.gitbook/assets/image (4) (1).png" alt=""><figcaption></figcaption></figure>

6. Тест:

<figure><img src="../../.gitbook/assets/image (5).png" alt=""><figcaption></figcaption></figure>
