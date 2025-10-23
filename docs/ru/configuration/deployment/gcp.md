---
description: Узнайте, как развернуть Flowise на GCP
---

# GCP (Google Cloud Platform)

> **📋 Уведомление**: Данная документация основана на оригинальной документации Flowise и в настоящее время адаптируется для Universo Platformo React. Некоторые разделы могут все еще ссылаться на функциональность Flowise, которая еще не была полностью обновлена для специфичных возможностей Universo Platformo.

> **🔄 Статус перевода**: Этот документ переведен с английского языка и проходит процесс адаптации для русскоязычной аудитории. Если вы заметили неточности в переводе или терминологии, пожалуйста, создайте issue в репозитории.

***

## Предварительные требования

1. Запишите ваш Google Cloud [ProjectId]
2. Установите [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
3. Установите [Google Cloud CLI](https://cloud.google.com/sdk/docs/install-sdk)
4. Установите [Docker Desktop](https://docs.docker.com/desktop/)

## Настройка кластера Kubernetes

1. Создайте кластер Kubernetes, если у вас его нет.

<figure><img src="../../.gitbook/assets/gcp/1.png" alt=""><figcaption><p>Нажмите `Clusters` чтобы создать кластер.</p></figcaption></figure>

2. Назовите кластер, выберите правильное расположение ресурсов, используйте режим `Autopilot` и оставьте все остальные конфигурации по умолчанию.
3. После создания кластера нажмите меню 'Connect' в меню действий

<figure><img src="../../.gitbook/assets/gcp/2.png" alt=""><figcaption></figcaption></figure>

4. Скопируйте команду и вставьте в ваш терминал, нажмите enter для подключения к кластеру.
5. Выполните команду ниже и выберите правильное имя контекста, которое выглядит как `gke_[ProjectId]_[DataCenter]_[ClusterName]`

```bash
kubectl config get-contexts
```

6. Установите текущий контекст

```bash
kubectl config use-context gke_[ProjectId]_[DataCenter]_[ClusterName]
```

## Сборка и отправка Docker образа

Выполните следующие команды для сборки и отправки Docker образа в GCP Container Registry.

1. Клонируйте Flowise

```bash
git clone https://github.com/FlowiseAI/Flowise.git
cd Flowise
```

2. Соберите Flowise

```bash
# Сборка проекта
npm install
npm run build

# Создание Docker образа
docker build -t gcr.io/[ProjectId]/flowise:latest .
```

3. Настройте аутентификацию Docker для GCR

```bash
gcloud auth configure-docker
```

4. Отправьте образ в Container Registry

```bash
docker push gcr.io/[ProjectId]/flowise:latest
```

## Развертывание с использованием Kubernetes

### 1. Создание файлов конфигурации

Создайте файл `flowise-deployment.yaml`:

```yaml
apiVersion: packages/v1
kind: Deployment
metadata:
  name: flowise-deployment
  labels:
    app: flowise
spec:
  replicas: 2
  selector:
    matchLabels:
      app: flowise
  template:
    metadata:
      labels:
        app: flowise
    spec:
      containers:
      - name: flowise
        image: gcr.io/[ProjectId]/flowise:latest
        ports:
        - containerPort: 3000
        env:
        - name: PORT
          value: "3000"
        - name: DATABASE_TYPE
          value: "postgres"
        - name: DATABASE_HOST
          value: "postgres-service"
        - name: DATABASE_PORT
          value: "5432"
        - name: DATABASE_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: DATABASE_NAME
          value: "flowise"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: flowise-service
spec:
  selector:
    app: flowise
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

### 2. Настройка PostgreSQL

Создайте файл `postgres-deployment.yaml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
type: Opaque
data:
  username: Zmxvd2lzZQ==  # base64 encoded 'flowise'
  password: cGFzc3dvcmQ=  # base64 encoded 'password' - замените на ваш пароль
---
apiVersion: packages/v1
kind: Deployment
metadata:
  name: postgres-deployment
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:13
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: "flowise"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
spec:
  selector:
    app: postgres
  ports:
    - protocol: TCP
      port: 5432
      targetPort: 5432
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

### 3. Развертывание приложения

```bash
# Развертывание PostgreSQL
kubectl apply -f postgres-deployment.yaml

# Ожидание готовности PostgreSQL
kubectl wait --for=condition=ready pod -l app=postgres --timeout=300s

# Развертывание Flowise
kubectl apply -f flowise-deployment.yaml

# Проверка статуса развертывания
kubectl get deployments
kubectl get services
kubectl get pods
```

## Альтернативное развертывание с Cloud Run

### 1. Подготовка образа для Cloud Run

```bash
# Сборка образа для Cloud Run
docker build -t gcr.io/[ProjectId]/flowise-cloudrun:latest .

# Отправка образа
docker push gcr.io/[ProjectId]/flowise-cloudrun:latest
```

### 2. Создание Cloud SQL экземпляра

```bash
# Создание PostgreSQL экземпляра
gcloud sql instances create flowise-db \
    --database-version=POSTGRES_13 \
    --tier=db-f1-micro \
    --region=us-central1

# Создание базы данных
gcloud sql databases create flowise --instance=flowise-db

# Создание пользователя
gcloud sql users create flowiseuser \
    --instance=flowise-db \
    --password=your-secure-password
```

### 3. Развертывание в Cloud Run

```bash
# Развертывание сервиса
gcloud run deploy flowise \
    --image gcr.io/[ProjectId]/flowise-cloudrun:latest \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars="DATABASE_TYPE=postgres,DATABASE_HOST=/cloudsql/[ProjectId]:us-central1:flowise-db,DATABASE_USER=flowiseuser,DATABASE_PASSWORD=your-secure-password,DATABASE_NAME=flowise" \
    --add-cloudsql-instances [ProjectId]:us-central1:flowise-db \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10
```

## Настройка мониторинга

### 1. Включение мониторинга GKE

```bash
# Включение мониторинга для кластера
gcloud container clusters update [ClusterName] \
    --zone=[Zone] \
    --enable-cloud-monitoring \
    --enable-cloud-logging
```

### 2. Настройка алертов

Создайте файл `monitoring-policy.yaml`:

```yaml
displayName: "Flowise High CPU Usage"
conditions:
  - displayName: "CPU usage above 80%"
    conditionThreshold:
      filter: 'resource.type="k8s_container" resource.labels.container_name="flowise"'
      comparison: COMPARISON_GREATER_THAN
      thresholdValue: 0.8
      duration: 300s
      aggregations:
        - alignmentPeriod: 60s
          perSeriesAligner: ALIGN_RATE
          crossSeriesReducer: REDUCE_MEAN
          groupByFields:
            - resource.labels.pod_name
notificationChannels:
  - projects/[ProjectId]/notificationChannels/[ChannelId]
```

## Настройка безопасности

### 1. Настройка IAM

```bash
# Создание сервисного аккаунта
gcloud iam service-accounts create flowise-sa \
    --display-name="Flowise Service Account"

# Назначение ролей
gcloud projects add-iam-policy-binding [ProjectId] \
    --member="serviceAccount:flowise-sa@[ProjectId].iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"
```

### 2. Настройка сетевой безопасности

```bash
# Создание правила брандмауэра
gcloud compute firewall-rules create allow-flowise \
    --allow tcp:3000 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow access to Flowise"
```

## Масштабирование

### 1. Горизонтальное автомасштабирование

Создайте файл `hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: flowise-hpa
spec:
  scaleTargetRef:
    apiVersion: packages/v1
    kind: Deployment
    name: flowise-deployment
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

Примените конфигурацию:

```bash
kubectl apply -f hpa.yaml
```

## Резервное копирование

### 1. Настройка резервного копирования Cloud SQL

```bash
# Включение автоматического резервного копирования
gcloud sql instances patch flowise-db \
    --backup-start-time=03:00 \
    --enable-bin-log
```

### 2. Резервное копирование Kubernetes конфигураций

```bash
# Экспорт всех ресурсов
kubectl get all -o yaml > flowise-backup.yaml

# Резервное копирование секретов
kubectl get secrets -o yaml > secrets-backup.yaml
```

## Мониторинг затрат

### 1. Настройка бюджетных алертов

```bash
# Создание бюджета
gcloud billing budgets create \
    --billing-account=[BillingAccountId] \
    --display-name="Flowise Budget" \
    --budget-amount=100USD \
    --threshold-rules-percent=50,90 \
    --threshold-rules-spend-basis=CURRENT_SPEND
```

## Заключение

GCP предоставляет несколько вариантов развертывания Flowise:

- **GKE (Google Kubernetes Engine)** - для полного контроля и масштабируемости
- **Cloud Run** - для serverless развертывания с автоматическим масштабированием
- **Compute Engine** - для традиционного развертывания на виртуальных машинах

Выберите подходящий вариант в зависимости от ваших требований к производительности, масштабируемости и бюджета. Всегда следуйте лучшим практикам безопасности и мониторинга.
