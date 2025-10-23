# UPDL (Lenguaje Universal de Definición de Plataformas)

> **📋 Aviso**: Esta documentación está basada en la documentación original de Flowise y actualmente se está adaptando para Universo Platformo React. Algunas secciones pueden aún hacer referencia a funcionalidades de Flowise que no han sido completamente actualizadas para las características específicas de Universo Platformo.

Sistema de definiciones de nodos para crear espacios universales 3D/AR/VR en Flowise.

## Descripción

UPDL proporciona un conjunto de definiciones de nodos especializadas para el editor Flowise, permitiendo a los usuarios crear descripciones abstractas de alto nivel de espacios 3D. Estas descripciones pueden luego ser exportadas a varias tecnologías (AR.js, PlayCanvas y otras) a través de aplicaciones de publicación.

## Arquitectura

UPDL es un módulo puro de definiciones de nodos que se integra perfectamente con Flowise:

- **Solo Definiciones de Nodos**: Contiene únicamente definiciones de clases de nodos de Flowise
- **Sin Lógica de Exportación**: Toda la funcionalidad de construcción de espacios y exportación es manejada por el sistema de publicación
- **Integración Limpia**: Se carga en Flowise a través del mecanismo `NodesPool` desde el directorio `dist/nodes`
- **Dependencias Mínimas**: Solo contiene dependencias requeridas para definiciones de nodos

## Estructura del Proyecto

El código fuente tiene una estructura modular, con cada nodo de alto nivel en su propio directorio:

```
packages/updl/base/src/
├── assets/              # Recursos estáticos (iconos)
│   └── icons/
├── i18n/                # Recursos de internacionalización
├── interfaces/          # Interfaces TypeScript principales para el ecosistema UPDL
│   └── UPDLInterfaces.ts
├── nodes/               # Definiciones de nodos UPDL
│   ├── action/          # ActionNode: ejecuta una acción de juego
│   ├── base/            # BaseUPDLNode: clase base compartida para todos los nodos UPDL
│   ├── camera/          # CameraNode: define el punto de vista
│   ├── component/       # ComponentNode: adjunta comportamiento a una Entity
│   ├── data/            # DataNode: almacenamiento de datos clave-valor
│   ├── entity/          # EntityNode: representa un objeto de juego en tiempo de ejecución
│   ├── event/           # EventNode: dispara acciones basadas en eventos
│   ├── light/           # LightNode: define iluminación para el espacio
│   ├── object/          # ObjectNode (Heredado): define un objeto 3D simple
│   ├── space/           # SpaceNode: el contenedor raíz para una escena
│   ├── universo/        # UniversoNode: configuraciones globales para MMOOMM
│   └── interfaces.ts    # Interfaces comunes para nodos
└── index.ts             # Punto de entrada principal - exporta todas las clases de nodos e interfaces
```

## Integración de Nodos

El módulo UPDL proporciona definiciones de nodos que se integran con el editor Flowise.

### Tipos de Nodos Soportados

El sistema UPDL está construido alrededor de **7 nodos principales de alto nivel** que proporcionan un marco completo para describir experiencias interactivas 3D/AR/VR:

| Nodo          | Propósito                                                        | Campos Clave                           |
| ------------- | ---------------------------------------------------------------- | -------------------------------------- |
| **Space**     | Contenedores de escena/pantalla. Pueden ser anidados             | id, type (root/module/block), settings |
| **Entity**    | Objeto/actor posicionado dentro del Espacio                      | transform, tags                        |
| **Component** | Añade datos/comportamiento a Entity (render, sonido, script)     | type, props                            |
| **Event**     | Disparador (OnStart, OnClick, OnTimer...)                        | eventType, source                      |
| **Action**    | Ejecutor (Move, PlaySound, SetData...)                           | actionType, target, params             |
| **Data**      | Almacenamiento de valores; ámbito como Local, Space, Global      | key, scope, value                      |
| **Universo**  | Puerta de enlace a la red global Kiberplano (GraphQL, MQTT UNS, OPC UA) | transports, discovery, security        |

### Soporte de Nodos UPDL Principales

El sistema de plantillas está diseñado principalmente para procesar los 7 nodos principales de alto nivel de UPDL:

- **Space**: Contenedores de escena/pantalla
- **Entity**: Objetos/actores posicionados
- **Component**: Adjuntos de comportamiento/datos
- **Event**: Disparadores (OnStart, OnClick, etc.)
- **Action**: Ejecutores (Move, PlaySound, etc.)
- **Data**: Almacenamiento clave-valor
- **Universo**: Conectividad de red global

**Nota**: Otros nodos (Object, Camera, Light) son nodos heredados/de prueba y pueden ser significativamente cambiados o eliminados en versiones futuras. Enfoque el desarrollo en los 7 nodos principales.

### Relaciones de Nodos

En una escena típica, las **Entities** actúan como contenedores para **Components** que añaden comportamiento o elementos visuales. Los **Events** adjuntos a una Entity disparan **Actions** cuando ocurren ciertas condiciones. Esta cadena `Entity → Component → Event → Action` define la lógica interactiva del espacio.

## Guía de Implementación de Conectores

Para asegurar que los nodos se conecten correctamente en el lienzo de Flowise, siga estas reglas:

1. **Conectores de Entrada**: Para permitir que un nodo padre acepte un nodo hijo, defina la conexión en el array `inputs` de la clase del nodo padre. El `type` en la definición de entrada debe coincidir con el `name` del nodo hijo (ej., `type: 'UPDLEntity'`).

2. **Conectores de Salida**: Para obtener un conector de salida estándar, simplemente asegúrese de que el array `outputs` en la clase del nodo esté vacío (`this.outputs = [];`). Flowise lo generará automáticamente. **No** intente añadir una salida por defecto en una clase base, ya que esto romperá el mecanismo.

3. **Nodos Terminales**: Para nodos como `ActionNode` que se configuran internamente y no se conectan a otros nodos, defina tanto `inputs` como `outputs` como arrays vacíos.

## Arquitectura de Interfaces

UPDL proporciona dos niveles de interfaces TypeScript:

### Interfaces UPDL Principales (`UPDLInterfaces.ts`)
Definiciones completas del ecosistema para flujos, grafos y propiedades detalladas de nodos:

- **IUPDLFlow**: Estructura completa de flujo con nodos y aristas
- **IUPDLGraph**: Representación de grafo para procesamiento
- **IUPDLSpace**: Nodo de espacio con todas las propiedades
- **IUPDLEntity**: Nodo de entidad con transformación y componentes
- **IUPDLComponent**: Adjuntos y comportamientos de componentes
- **IUPDLEvent**: Disparadores y condiciones de eventos
- **IUPDLAction**: Ejecutores y parámetros de acciones
- **IUPDLData**: Almacenamiento y ámbito de datos
- **IUPDLUniverso**: Configuración de puerta de enlace de red

### Interfaces de Integración (`Interface.UPDL.ts`)
Interfaces simplificadas para integración backend/frontend a través del alias `@server/interface`:

- Versiones simplificadas de interfaces principales
- Optimizadas para comunicación API
- Complejidad reducida para escenarios de integración

## Proceso de Construcción

El proceso de construcción consiste en dos etapas:

1. **Compilación TypeScript**: Compila archivos TypeScript (`.ts`) a JavaScript (`.js`)
2. **Tareas Gulp**: Copia todos los recursos estáticos (como iconos SVG) desde los directorios fuente a la carpeta `dist`, preservando la estructura de directorios

### Scripts Disponibles

- `pnpm clean` - Limpia el directorio `dist`
- `pnpm build` - Construye el paquete (ejecuta compilación TypeScript y tareas Gulp)
- `pnpm dev` - Ejecuta la construcción en modo desarrollo con observación de archivos
- `pnpm lint` - Verifica el código con el linter

## Integración con Flowise

Los nodos UPDL se integran perfectamente con la funcionalidad existente de Flowise:

- **Carga de Pool de Nodos**: Los nodos se cargan automáticamente en Flowise a través del mecanismo NodesPool
- **Editor Visual**: Todos los nodos aparecen en el editor visual de Flowise con iconos y conexiones apropiadas
- **Procesamiento de Flujos**: Los flujos UPDL pueden procesarse junto con flujos regulares de Flowise
- **Seguridad de Tipos**: Soporte completo de TypeScript con interfaces exhaustivas

## Ejemplos de Uso

### Creación de Espacio Básico

```typescript
// Crear un espacio simple con una entidad
const spaceNode = new SpaceNode();
spaceNode.data = {
    id: "main-space",
    type: "root",
    settings: {
        physics: true,
        lighting: "dynamic"
    }
};

const entityNode = new EntityNode();
entityNode.data = {
    transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
    },
    tags: ["player", "interactive"]
};
```

### Adjunto de Componente

```typescript
// Añadir comportamiento a una entidad
const componentNode = new ComponentNode();
componentNode.data = {
    type: "movement",
    props: {
        speed: 5.0,
        acceleration: 2.0
    }
};

// Conectar componente a entidad
entityNode.inputs.push({
    type: "UPDLComponent",
    node: componentNode
});
```

### Cadena Evento-Acción

```typescript
// Crear disparador de evento
const eventNode = new EventNode();
eventNode.data = {
    eventType: "OnClick",
    source: "entity"
};

// Crear respuesta de acción
const actionNode = new ActionNode();
actionNode.data = {
    actionType: "Move",
    target: "entity",
    params: {
        destination: { x: 10, y: 0, z: 0 },
        duration: 2.0
    }
};

// Conectar evento a acción
eventNode.outputs.push({
    type: "UPDLAction",
    node: actionNode
});
```

## Enfoque del Módulo

Este módulo está intencionalmente enfocado **solo en definiciones de nodos**:

- **Sin Constructores de Espacios**: Manejado por el sistema de publicación (`publish-frt`)
- **Sin Lógica de Exportación**: Manejado por aplicaciones de publicación
- **Sin Clientes API**: No necesarios para definiciones de nodos
- **Sin Gestión de Estado**: Los nodos son definiciones sin estado

Esta separación limpia asegura arquitectura óptima y mantenibilidad.

## Directrices de Desarrollo

### Añadir Nuevos Nodos

1. Crear un nuevo directorio bajo `src/nodes/`
2. Implementar la clase de nodo extendiendo `BaseUPDLNode`
3. Añadir interfaces TypeScript apropiadas
4. Incluir icono SVG en `assets/icons/`
5. Exportar el nodo en `index.ts`
6. Actualizar documentación

### Principios de Diseño de Nodos

- **Responsabilidad Única**: Cada nodo debe tener un propósito claro
- **Composabilidad**: Los nodos deben funcionar bien juntos
- **Seguridad de Tipos**: Usar interfaces TypeScript para todas las estructuras de datos
- **Claridad Visual**: Proporcionar iconos y descripciones claras
- **Documentación**: Incluir comentarios JSDoc exhaustivos

## Siguientes Pasos

- [Sistema de Publicación](../publish/README.md) - Aprende cómo los nodos UPDL se exportan a diferentes plataformas
- [Sistema de Nodos UPDL](../../universo-platformo/updl-nodes/README.md) - Documentación detallada de cada tipo de nodo
- [Plantillas MMOOMM](../../universo-platformo/mmoomm-templates/README.md) - Plantillas pre-construidas usando nodos UPDL
