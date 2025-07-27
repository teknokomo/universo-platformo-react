---
description: Узнайте, как развернуть Flowise на Azure
---

# Azure

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

## Flowise как Azure App Service с Postgres: Использование Terraform

### Предварительные требования

1. **Аккаунт Azure**: Убедитесь, что у вас есть аккаунт Azure с активной подпиской. Если у вас его нет, зарегистрируйтесь на [портале Azure](https://portal.azure.com/).
2. **Terraform**: Установите Terraform CLI на вашу машину. Скачайте его с [веб-сайта Terraform](https://www.terraform.io/downloads.html).
3. **Azure CLI**: Установите Azure CLI. Инструкции можно найти на [странице документации Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli).

### Настройка вашей среды

1. **Вход в Azure**: Откройте терминал или командную строку и войдите в Azure CLI, используя:

```bash
az login --tenant <Your Subscription ID> --use-device-code 
```

Следуйте подсказкам для завершения процесса входа.

2. **Установка подписки**: После входа установите подписку Azure, используя:

```bash
az account set --subscription <Your Subscription ID>
```

3. **Инициализация Terraform**:

Создайте файл `terraform.tfvars` в директории вашего Terraform проекта, если его еще нет, и добавьте следующее содержимое:

```hcl
subscription_name = "имя_подписки"
subscription_id = "id_подписки"
project_name = "имя_веб_приложения"
db_username = "ИмяПользователяPostgres"
db_password = "сильныйПарольPostgres"
flowise_secretkey_overwrite = "длинныйИСильныйСекретныйКлюч"
webapp_ip_rules = [
  {
    name = "РазрешенныйIP"
    ip_address = "X.X.X.X/32"
    headers = null
    virtual_network_subnet_id = null
    subnet_id = null
    priority = 100
    action = "Allow"
  }
]
```

4. **Инициализация и применение Terraform**:

```bash
# Инициализация Terraform
terraform init

# Планирование развертывания
terraform plan

# Применение конфигурации
terraform apply
```

### Основные компоненты развертывания

#### 1. Resource Group (Группа ресурсов)
```hcl
resource "azurerm_resource_group" "flowise_rg" {
  name     = "${var.project_name}-rg"
  location = var.location
}
```

#### 2. App Service Plan (План службы приложений)
```hcl
resource "azurerm_service_plan" "flowise_plan" {
  name                = "${var.project_name}-plan"
  resource_group_name = azurerm_resource_group.flowise_rg.name
  location           = azurerm_resource_group.flowise_rg.location
  os_type            = "Linux"
  sku_name           = "B1"
}
```

#### 3. PostgreSQL Database (База данных PostgreSQL)
```hcl
resource "azurerm_postgresql_flexible_server" "flowise_db" {
  name                   = "${var.project_name}-db"
  resource_group_name    = azurerm_resource_group.flowise_rg.name
  location              = azurerm_resource_group.flowise_rg.location
  version               = "13"
  administrator_login    = var.db_username
  administrator_password = var.db_password
  
  storage_mb = 32768
  sku_name   = "B_Standard_B1ms"
}
```

#### 4. Web App (Веб-приложение)
```hcl
resource "azurerm_linux_web_app" "flowise_app" {
  name                = var.project_name
  resource_group_name = azurerm_resource_group.flowise_rg.name
  location           = azurerm_resource_group.flowise_rg.location
  service_plan_id    = azurerm_service_plan.flowise_plan.id

  site_config {
    application_stack {
      docker_image     = "flowiseai/flowise"
      docker_image_tag = "latest"
    }
  }

  app_settings = {
    "DATABASE_TYPE"     = "postgres"
    "DATABASE_HOST"     = azurerm_postgresql_flexible_server.flowise_db.fqdn
    "DATABASE_PORT"     = "5432"
    "DATABASE_USER"     = var.db_username
    "DATABASE_PASSWORD" = var.db_password
    "DATABASE_NAME"     = "flowise"
    "DATABASE_SSL"      = "true"
    "FLOWISE_SECRETKEY_OVERWRITE" = var.flowise_secretkey_overwrite
  }
}
```

## Альтернативные методы развертывания

### Развертывание через Azure Portal

1. **Создание Resource Group:**
   - Войдите в Azure Portal
   - Создайте новую группу ресурсов
   - Выберите подходящий регион

2. **Создание PostgreSQL сервера:**
   - Перейдите в "Create a resource" > "Databases" > "Azure Database for PostgreSQL"
   - Выберите "Flexible server"
   - Настройте параметры подключения

3. **Создание App Service:**
   - Создайте новый App Service
   - Выберите "Docker Container" как источник публикации
   - Укажите образ: `flowiseai/flowise:latest`

4. **Настройка переменных окружения:**
   - В настройках App Service перейдите в "Configuration"
   - Добавьте необходимые переменные окружения

### Развертывание с использованием Azure CLI

```bash
# Создание группы ресурсов
az group create --name flowise-rg --location eastus

# Создание PostgreSQL сервера
az postgres flexible-server create \
  --resource-group flowise-rg \
  --name flowise-db \
  --admin-user flowiseadmin \
  --admin-password YourStrongPassword123! \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 13

# Создание App Service Plan
az appservice plan create \
  --name flowise-plan \
  --resource-group flowise-rg \
  --sku B1 \
  --is-linux

# Создание Web App
az webapp create \
  --resource-group flowise-rg \
  --plan flowise-plan \
  --name flowise-app \
  --deployment-container-image-name flowiseai/flowise:latest

# Настройка переменных окружения
az webapp config appsettings set \
  --resource-group flowise-rg \
  --name flowise-app \
  --settings \
    DATABASE_TYPE=postgres \
    DATABASE_HOST=flowise-db.postgres.database.azure.com \
    DATABASE_PORT=5432 \
    DATABASE_USER=flowiseadmin \
    DATABASE_PASSWORD=YourStrongPassword123! \
    DATABASE_NAME=flowise \
    DATABASE_SSL=true
```

## Настройка безопасности

### Сетевая безопасность

1. **Настройка брандмауэра PostgreSQL:**
```bash
# Разрешение доступа от App Service
az postgres flexible-server firewall-rule create \
  --resource-group flowise-rg \
  --name flowise-db \
  --rule-name AllowAppService \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0
```

2. **Ограничение доступа к App Service:**
```bash
# Добавление IP ограничений
az webapp config access-restriction add \
  --resource-group flowise-rg \
  --name flowise-app \
  --rule-name AllowMyIP \
  --action Allow \
  --ip-address YOUR.IP.ADDRESS.HERE/32 \
  --priority 100
```

### SSL/TLS настройка

1. **Включение HTTPS Only:**
```bash
az webapp update \
  --resource-group flowise-rg \
  --name flowise-app \
  --https-only true
```

2. **Настройка пользовательского домена:**
```bash
# Добавление пользовательского домена
az webapp config hostname add \
  --webapp-name flowise-app \
  --resource-group flowise-rg \
  --hostname yourdomain.com

# Привязка SSL сертификата
az webapp config ssl bind \
  --certificate-thumbprint THUMBPRINT \
  --ssl-type SNI \
  --name flowise-app \
  --resource-group flowise-rg
```

## Мониторинг и логирование

### Application Insights

1. **Создание Application Insights:**
```bash
az monitor app-insights component create \
  --app flowise-insights \
  --location eastus \
  --resource-group flowise-rg \
  --application-type web
```

2. **Подключение к App Service:**
```bash
az webapp config appsettings set \
  --resource-group flowise-rg \
  --name flowise-app \
  --settings APPINSIGHTS_INSTRUMENTATIONKEY=YOUR_INSTRUMENTATION_KEY
```

### Настройка логирования

```bash
# Включение логирования приложения
az webapp log config \
  --resource-group flowise-rg \
  --name flowise-app \
  --application-logging filesystem \
  --level information

# Просмотр логов
az webapp log tail \
  --resource-group flowise-rg \
  --name flowise-app
```

## Масштабирование

### Автоматическое масштабирование

```bash
# Создание правила автомасштабирования
az monitor autoscale create \
  --resource-group flowise-rg \
  --resource flowise-plan \
  --resource-type Microsoft.Web/serverfarms \
  --name flowise-autoscale \
  --min-count 1 \
  --max-count 3 \
  --count 1

# Добавление правила масштабирования по CPU
az monitor autoscale rule create \
  --resource-group flowise-rg \
  --autoscale-name flowise-autoscale \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1
```

## Резервное копирование

### Настройка резервного копирования

```bash
# Создание плана резервного копирования
az webapp config backup create \
  --resource-group flowise-rg \
  --webapp-name flowise-app \
  --backup-name daily-backup \
  --storage-account-url "https://yourstorageaccount.blob.core.windows.net/backups" \
  --frequency 1440 \
  --retain-one true
```

## Заключение

Azure предоставляет несколько способов развертывания Flowise:

- **Terraform** - для инфраструктуры как код
- **Azure Portal** - для визуального развертывания
- **Azure CLI** - для автоматизации через командную строку

Выберите метод, который лучше всего подходит для ваших потребностей и уровня экспертизы. Всегда следуйте лучшим практикам безопасности и мониторинга для продакшенных развертываний.
