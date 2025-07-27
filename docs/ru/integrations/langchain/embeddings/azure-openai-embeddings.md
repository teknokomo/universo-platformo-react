# Azure OpenAI Embeddings

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

## Предварительные требования

1. [Войдите](https://portal.azure.com/) или [зарегистрируйтесь](https://azure.microsoft.com/en-us/free/) в Azure
2. [Создайте](https://portal.azure.com/#create/Microsoft.CognitiveServicesOpenAI) ваш Azure OpenAI и дождитесь одобрения примерно 10 рабочих дней
3. Ваш API ключ будет доступен в **Azure OpenAI** > нажмите **name\_azure\_openai** > нажмите **Click here to manage keys**

<figure><img src="../../../.gitbook/assets/azure/azure-general/1.png" alt=""><figcaption></figcaption></figure>

## Настройка

### Azure OpenAI Embeddings

1. Нажмите **Go to Azure OpenaAI Studio**

<figure><img src="../../../.gitbook/assets/azure/azure-general/2.png" alt=""><figcaption></figcaption></figure>

2. Нажмите **Deployments**

<figure><img src="../../../.gitbook/assets/azure/azure-general/3.png" alt=""><figcaption></figcaption></figure>

3. Нажмите **Create new deployment**

<figure><img src="../../../.gitbook/assets/azure/azure-general/4.png" alt=""><figcaption></figcaption></figure>

4. Выберите как показано ниже и нажмите **Create**

<figure><img src="../../../.gitbook/assets/azure/azure-openai-embeddings/1.png" alt="" width="559"><figcaption></figcaption></figure>

5. Успешно создан **Azure OpenAI Embeddings**

* Имя развертывания: `text-embedding-ada-002`
* Имя экземпляра: `правый верхний угол`

<figure><img src="../../../.gitbook/assets/azure/azure-openai-embeddings/2.png" alt=""><figcaption></figcaption></figure>

### Flowise

1. **Embeddings** > перетащите узел **Azure OpenAI Embeddings**

<figure><img src="../../../.gitbook/assets/azure/azure-openai-embeddings/3.png" alt="" width="563"><figcaption></figcaption></figure>

2. **Connect Credential** > нажмите **Create New**

<figure><img src="../../../.gitbook/assets/azure/azure-openai-embeddings/4.png" alt="" width="386"><figcaption></figcaption></figure>

3. Скопируйте и вставьте каждую деталь (API ключ, экземпляр и имя развертывания, [версия API](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#chat-completions)) в учетные данные **Azure OpenAI Embeddings**

<figure><img src="../../../.gitbook/assets/azure/azure-openai-embeddings/5.png" alt="" width="554"><figcaption></figcaption></figure>

4. Вуаля [🎉](https://emojipedia.org/party-popper/), вы создали **узел Azure OpenAI Embeddings** в Flowise

<figure><img src="../../../.gitbook/assets/azure/azure-general/5.png" alt=""><figcaption></figcaption></figure>

## Ресурсы

* [LangChain JS Azure OpenAI Embeddings](https://js.langchain.com/docs/modules/data\_connection/text\_embedding/integrations/azure\_openai)
* [Справочник REST API службы Azure OpenAI](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)
