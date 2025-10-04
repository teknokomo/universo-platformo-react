# Streamlit

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

[Python SDK](https://github.com/FlowiseAI/FlowisePy) может использоваться для создания приложения [Streamlit](https://streamlit.io/):

```python
import streamlit as st
from flowise import Flowise, PredictionData
import json

# Базовый URL приложения Flowise
base_url = st.secrets["APP_URL"] or "https://your-flowise-url.com"

# ID Canvas/Agentflow
flow_id = st.secrets["FLOW_ID"] or "abc"

# Показать заголовок и описание.
st.title("💬 Flowise Streamlit Чат")
st.write(
    "Это простой чат-бот, который использует Flowise Python SDK"
)

# Создать клиент Flowise.
client = Flowise(base_url=base_url)

# Создать переменную состояния сессии для хранения чат-сообщений. Это обеспечивает
# сохранение сообщений между перезапусками.
if "messages" not in st.session_state:
    st.session_state.messages = []

# Отобразить существующие чат-сообщения через `st.chat_message`.
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

def generate_response(prompt: str):
    print('генерация ответа')
    completion = client.create_prediction(
        PredictionData(
            canvasId=flow_id,
            question=prompt,
            overrideConfig={
                "sessionId": "session1234"
            },
            streaming=True
        )
    )

    for chunk in completion:
        print(chunk)
        parsed_chunk = json.loads(chunk)
        if (parsed_chunk['event'] == 'token' and parsed_chunk['data'] != ''):
            yield str(parsed_chunk['data'])

# Создать поле ввода чата, чтобы позволить пользователю ввести сообщение. Это будет
# автоматически отображаться внизу страницы.
if prompt := st.chat_input("Как дела?"):

    # Сохранить и отобразить текущий промпт.
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Потоково передать ответ в чат, используя `st.write_stream`, затем сохранить его в 
    # состоянии сессии.
    with st.chat_message("assistant"):
        response = generate_response(prompt)
        full_response = st.write_stream(response)
    st.session_state.messages.append({"role": "assistant", "content": full_response})
```

Полный репозиторий Github: [https://github.com/HenryHengZJ/flowise-streamlit](https://github.com/HenryHengZJ/flowise-streamlit)
