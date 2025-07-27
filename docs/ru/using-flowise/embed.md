---
description: Узнайте, как настроить и встроить наш чат-виджет
---

# Встраивание

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

Вы можете легко добавить чат-виджет на свой веб-сайт. Просто скопируйте предоставленный скрипт виджета и вставьте его в любое место между тегами `<body>` и `</body>` вашего HTML файла.

<figure><img src="../.gitbook/assets/image (8) (2) (1) (1).png" alt=""><figcaption></figcaption></figure>

## Что такое встраиваемый чат-виджет?

Встраиваемый чат-виджет - это готовое решение для интеграции AI-ассистента на ваш веб-сайт, которое предоставляет:

- **Простую интеграцию** - один скрипт для подключения
- **Полную настройку** - темы, цвета, поведение
- **Адаптивный дизайн** - работает на всех устройствах
- **Богатую функциональность** - файлы, обратная связь, история
- **Безопасность** - защищенное соединение с API

### Архитектура виджета

```
Веб-сайт → Виджет → Flowise API → LLM → Ответ пользователю
    ↓         ↓         ↓          ↓         ↓
HTML/CSS → JavaScript → HTTP → AI Model → UI Update
```

## Настройка виджета

Следующее видео показывает, как внедрить скрипт виджета в любую веб-страницу.

{% embed url="https://github.com/FlowiseAI/Flowise/assets/26460777/c128829a-2d08-4d60-b821-1e41a9e677d0" %}

### Базовая интеграция

```html
<!-- Простейший способ интеграции -->
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'https://your-flowise-instance.com',
  })
</script>
```

### Интеграция с проверкой загрузки

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  
  // Проверка готовности DOM
  document.addEventListener('DOMContentLoaded', function() {
    try {
      Chatbot.init({
        chatflowid: 'your-chatflowid-here',
        apiHost: 'https://your-flowise-instance.com',
      });
      console.log('Чат-виджет успешно инициализирован');
    } catch (error) {
      console.error('Ошибка инициализации чат-виджета:', error);
    }
  });
</script>
```

## Использование конкретной версии

Вы можете указать версию flowise-embed's `web.js` для использования. Полный список версий: [https://www.npmjs.com/package/flowise-embed](https://www.npmjs.com/package/flowise-embed)

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed@<some-version>/dist/web.js';
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'your-apihost-here',
  })
</script>
```

{% hint style="warning" %}
В Flowise **v2.1.0** мы изменили способ работы потоковой передачи. Если ваша версия Flowise ниже этой, вы можете обнаружить, что ваш встроенный чатбот не может получать сообщения.

Вы можете либо обновить Flowise до **v2.1.0** и выше

Или, если по какой-то причине вы предпочитаете не обновлять Flowise, вы можете указать последнюю версию **v1.x.x** [Flowise-Embed](https://www.npmjs.com/package/flowise-embed?activeTab=versions). Последняя поддерживаемая версия `web.js` - **v1.3.14.**

Например:

`https://cdn.jsdelivr.net/npm/flowise-embed@1.3.14/dist/web.js`
{% endhint %}

### Управление версиями в продакшене

```html
<script type="module">
  // Рекомендуемый подход для продакшена
  const FLOWISE_EMBED_VERSION = '2.1.5'; // Зафиксированная версия
  
  import(`https://cdn.jsdelivr.net/npm/flowise-embed@${FLOWISE_EMBED_VERSION}/dist/web.js`)
    .then(({ default: Chatbot }) => {
      Chatbot.init({
        chatflowid: 'your-chatflowid-here',
        apiHost: 'https://your-flowise-instance.com',
      });
    })
    .catch(error => {
      console.error('Не удалось загрузить чат-виджет:', error);
      // Fallback или уведомление пользователя
    });
</script>
```

## Конфигурация чат-потока

Вы можете передать JSON объект `chatflowConfig` для переопределения существующей конфигурации. Это то же самое, что [Broken link](broken-reference "mention") в API.

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'your-apihost-here',
    chatflowConfig: {
      "sessionId": "123",
      "returnSourceDocuments": true
    }
  })
</script>
```

### Продвинутая конфигурация

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'https://your-flowise-instance.com',
    chatflowConfig: {
      // Управление сессией
      "sessionId": `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      
      // Возврат источников
      "returnSourceDocuments": true,
      "returnIntermediateSteps": true,
      
      // Переопределение переменных
      "vars": {
        "user_language": "ru",
        "user_timezone": "Europe/Moscow",
        "company_name": "Ваша Компания"
      },
      
      // Настройки модели
      "temperature": 0.7,
      "maxTokens": 1000,
      
      // Фильтрация контента
      "topK": 5,
      "scoreThreshold": 0.8
    }
  })
</script>
```

## Конфигурация наблюдателей

Это позволяет выполнять код в родительском элементе на основе наблюдений сигналов внутри чатбота.

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'your-apihost-here',
    observersConfig: {
      // Пользовательский ввод изменился
      observeUserInput: (userInput) => {
        console.log({ userInput });
      },
      // Стек сообщений бота изменился
      observeMessages: (messages) => {
        console.log({ messages });
      },
      // Сигнал загрузки бота изменился
      observeLoading: (loading) => {
        console.log({ loading });
      },
    },
  })
</script>
```

### Продвинутые наблюдатели

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'https://your-flowise-instance.com',
    observersConfig: {
      // Отслеживание пользовательского ввода
      observeUserInput: (userInput) => {
        // Аналитика пользовательского поведения
        if (typeof gtag !== 'undefined') {
          gtag('event', 'chat_user_input', {
            'input_length': userInput.length,
            'timestamp': new Date().toISOString()
          });
        }
        
        // Валидация ввода
        if (userInput.length > 1000) {
          console.warn('Слишком длинный пользовательский ввод');
        }
      },
      
      // Отслеживание сообщений
      observeMessages: (messages) => {
        const lastMessage = messages[messages.length - 1];
        
        // Сохранение истории чата
        localStorage.setItem('chat_history', JSON.stringify(messages));
        
        // Уведомления о новых сообщениях
        if (lastMessage && lastMessage.type === 'apiMessage') {
          // Показать уведомление, если окно не в фокусе
          if (document.hidden) {
            showNotification('Новое сообщение от ассистента');
          }
        }
        
        // Автоматическая прокрутка страницы
        if (messages.length > 10) {
          document.querySelector('#chat-container')?.scrollIntoView({ 
            behavior: 'smooth' 
          });
        }
      },
      
      // Отслеживание состояния загрузки
      observeLoading: (loading) => {
        // Показать/скрыть индикатор загрузки на странице
        const pageLoader = document.querySelector('#page-loader');
        if (pageLoader) {
          pageLoader.style.display = loading ? 'block' : 'none';
        }
        
        // Изменение курсора
        document.body.style.cursor = loading ? 'wait' : 'default';
        
        // Аналитика времени ответа
        if (loading) {
          window.chatLoadStartTime = Date.now();
        } else if (window.chatLoadStartTime) {
          const responseTime = Date.now() - window.chatLoadStartTime;
          console.log(`Время ответа: ${responseTime}ms`);
          
          // Отправка метрик
          if (typeof gtag !== 'undefined') {
            gtag('event', 'chat_response_time', {
              'response_time': responseTime,
              'timestamp': new Date().toISOString()
            });
          }
        }
      },
      
      // Кастомные события
      observeError: (error) => {
        console.error('Ошибка чата:', error);
        
        // Уведомление пользователя
        showErrorNotification('Произошла ошибка. Попробуйте позже.');
        
        // Отправка ошибки в систему мониторинга
        if (typeof Sentry !== 'undefined') {
          Sentry.captureException(error);
        }
      }
    }
  });
  
  // Вспомогательные функции
  function showNotification(message) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Чат-ассистент', {
        body: message,
        icon: '/favicon.ico'
      });
    }
  }
  
  function showErrorNotification(message) {
    // Создание toast уведомления
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #f44336;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
</script>

<style>
@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}
</style>
```

## Темы оформления

Вы можете изменить полный внешний вид встроенного чатбота и включить функциональности, такие как подсказки, отказы от ответственности, пользовательские приветственные сообщения и многое другое, используя свойство theme. Это позволяет глубоко настроить внешний вид виджета, включая:

* **Кнопка:** Позиция, размер, цвет, иконка, поведение перетаскивания и автоматическое открытие.
* **Подсказка:** Видимость, текст сообщения, цвет фона, цвет текста и размер шрифта.
* **Отказ от ответственности:** Заголовок, сообщение, цвета для текста, кнопок и фона, включая опцию размытого наложения.
* **Окно чата:** Заголовок, отображение сообщений агента/пользователя, приветственные/ошибочные сообщения, цвет/изображение фона, размеры, размер шрифта, стартовые промпты, рендеринг HTML, стилизация сообщений (цвета, аватары), поведение текстового ввода (заполнитель, цвета, ограничения символов, звуки), опции обратной связи, отображение даты/времени и настройка подвала.
* **Пользовательский CSS:** Прямое внедрение CSS кода для еще более тонкого контроля над внешним видом, переопределяя стили по умолчанию по мере необходимости ([см. руководство по инструкциям ниже](embed.md#custom-css-modification))

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'your-apihost-here',
    theme: {
      button: {
        backgroundColor: '#3B81F6',
        right: 20,
        bottom: 20,
        size: 48, // small | medium | large | number
        dragAndDrop: true,
        iconColor: 'white',
        customIconSrc: 'https://raw.githubusercontent.com/walkxcode/dashboard-icons/main/svg/google-messages.svg',
        autoWindowOpen: {
          autoOpen: true, //параметр для управления автоматическим открытием окна
          openDelay: 2, // Необязательный параметр для времени задержки в секундах
          autoOpenOnMobile: false, //параметр для управления автоматическим открытием окна на мобильных устройствах
        },
      }
    }
  })
</script>
```

### Полная конфигурация темы

```html
<script type="module">
  import Chatbot from 'https://cdn.jsdelivr.net/npm/flowise-embed/dist/web.js';
  
  Chatbot.init({
    chatflowid: 'your-chatflowid-here',
    apiHost: 'your-apihost-here',
    theme: {
      // Настройки кнопки
      button: {
        backgroundColor: '#2563eb',
        right: 20,
        bottom: 20,
        size: 'medium', // small | medium | large | number
        dragAndDrop: true,
        iconColor: 'white',
        customIconSrc: '/chat-icon.svg',
        autoWindowOpen: {
          autoOpen: false,
          openDelay: 3,
          autoOpenOnMobile: false,
        },
      },
      
      // Подсказка при наведении
      tooltip: {
        showTooltip: true,
        tooltipMessage: 'Привет! 👋 Есть вопросы?',
        tooltipBackgroundColor: '#1f2937',
        tooltipTextColor: 'white',
        tooltipFontSize: 14,
      },
      
      // Отказ от ответственности
      disclaimer: {
        title: 'Важная информация',
        message: 'Этот чат-бот предоставляет информацию в справочных целях. Для получения точной информации обратитесь к специалисту.',
        textColor: '#374151',
        buttonColor: '#2563eb',
        buttonText: 'Понятно',
        buttonTextColor: 'white',
        blurredBackgroundColor: 'rgba(0, 0, 0, 0.4)',
        backgroundColor: 'white',
      },
      
      // Окно чата
      chatWindow: {
        showTitle: true,
        title: 'Ассистент поддержки',
        titleAvatarSrc: '/company-logo.png',
        showAgentMessages: true,
        welcomeMessage: 'Добро пожаловать! Как я могу помочь вам сегодня?',
        errorMessage: 'Извините, произошла ошибка. Попробуйте позже.',
        backgroundColor: '#ffffff',
        backgroundImage: 'url(/chat-background.png)',
        height: 600,
        width: 400,
        fontSize: 14,
        
        // Стартовые промпты
        starterPrompts: [
          'Как работает ваш сервис?',
          'Какие у вас тарифы?',
          'Как связаться с поддержкой?'
        ],
        starterPromptsLabel: 'Популярные вопросы:',
        
        // Настройки сообщений
        userMessage: {
          backgroundColor: '#2563eb',
          textColor: 'white',
          showAvatar: true,
          avatarSrc: '/user-avatar.png',
        },
        
        botMessage: {
          backgroundColor: '#f3f4f6',
          textColor: '#1f2937',
          showAvatar: true,
          avatarSrc: '/bot-avatar.png',
        },
        
        // Поле ввода
        textInput: {
          placeholder: 'Введите ваш вопрос...',
          backgroundColor: 'white',
          textColor: '#1f2937',
          sendButtonColor: '#2563eb',
          maxChars: 1000,
          maxCharsWarningMessage: 'Достигнут лимит символов',
          autoFocus: true,
          sendMessageSound: true,
          receiveMessageSound: true,
        },
        
        // Обратная связь
        feedback: {
          color: '#6b7280',
        },
        
        // Отображение времени
        dateTimeToggle: {
          date: true,
          time: true,
        },
        
        // Подвал
        footer: {
          textColor: '#6b7280',
          text: 'Работает на Flowise',
          company: 'Ваша Компания',
          companyLink: 'https://yourcompany.com',
        }
      }
    }
  })
</script>
```

## Заключение

Встраиваемый чат-виджет Flowise предоставляет мощное и гибкое решение для интеграции AI-ассистента на ваш веб-сайт. Богатые возможности настройки, система наблюдателей и темы оформления позволяют создать уникальный пользовательский опыт, полностью соответствующий вашему бренду и требованиям.

Ключевые принципы успешного использования виджета:
- **Тестируйте на разных устройствах** и браузерах
- **Настраивайте тему** в соответствии с дизайном сайта
- **Используйте наблюдатели** для аналитики и улучшения UX
- **Фиксируйте версии** для стабильности в продакшене
- **Мониторьте производительность** и ошибки
- **Обеспечивайте доступность** для всех пользователей
