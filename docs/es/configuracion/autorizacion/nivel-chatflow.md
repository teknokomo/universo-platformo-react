---
description: Aprende cómo configurar el control de acceso a nivel de canvas para tus instancias de Flowise
---

# Canvas Level

***

Después de haber construido un canvas / agentflow, por defecto, tu flow está disponible al público. Cualquiera que tenga acceso al Canvas ID puede ejecutar prediction a través de Embed o API.

En casos donde quieras permitir que solo ciertas personas puedan acceder e interactuar con él, puedes hacerlo asignando una API key para ese canvas específico.

## API Key

En el dashboard, navega a la sección API Keys, y deberías poder ver una DefaultKey creada. También puedes add o delete cualquier key.

<figure><img src="../../.gitbook/assets/image (6) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

## Canvas

Navigate al canvas, y ahora puedes seleccionar la API Key que quieres usar para proteger el canvas.

<figure><img src="../../.gitbook/assets/image (3) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

Después de asignar una API key, solo se puede acceder al canvas API cuando se proporciona el Authorization header con la API key correcta especificada durante una HTTP call.

```json
"Authorization": "Bearer <your-api-key>"
```

Un ejemplo de llamar al API usando POSTMAN

<figure><img src="../../.gitbook/assets/image (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1) (1).png" alt=""><figcaption></figcaption></figure>

