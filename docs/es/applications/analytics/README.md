# Sistema de Análisis

> **📋 Aviso**: Esta documentación está basada en la documentación original de Flowise y actualmente se está adaptando para Universo Platformo React. Algunas secciones pueden aún hacer referencia a funcionalidades de Flowise que no han sido completamente actualizadas para las características específicas de Universo Platformo.

Módulo frontend para mostrar análisis de cuestionarios en Universo Platformo.

## Descripción

El sistema de análisis proporciona herramientas completas para analizar el rendimiento de cuestionarios, la interacción del usuario y las métricas de participación. Este módulo se integra con la plataforma principal de Flowise para proporcionar análisis detallados del contenido publicado.

## Arquitectura

La aplicación de análisis está construida como un módulo frontend ligero:

```
apps/analytics-frt/base/
├── src/
│   └── pages/
│       └── Analytics.jsx    # Página principal de análisis
├── package.json
├── tsconfig.json
└── README.md
```

## Características Clave

### Análisis de Cuestionarios
- **Métricas de Rendimiento**: Seguimiento de tasas de éxito y finalización de cuestionarios
- **Análisis de Respuestas**: Análisis detallado de respuestas de usuarios y patrones
- **Análisis Temporal**: Tendencias de rendimiento a lo largo del tiempo
- **Análisis Comparativo**: Comparación entre diferentes cuestionarios y períodos

### Métricas de Interacción del Usuario
- **Indicadores de Participación**: Tiempo pasado en cuestionarios y niveles de interacción
- **Rutas de Usuario**: Análisis de cómo los usuarios navegan a través del contenido
- **Tasas de Abandono**: Identificación de puntos donde los usuarios abandonan los cuestionarios
- **Análisis Demográfico**: Comprensión de la audiencia y segmentación de usuarios

### Visualización de Datos
- **Gráficos Interactivos**: Visualizaciones dinámicas para exploración de datos
- **Paneles de Control**: Paneles personalizables para diferentes métricas
- **Exportación de Informes**: Capacidad de exportar datos de análisis para análisis posterior
- **Filtrado en Tiempo Real**: Filtros interactivos para análisis detallado

## Integración

### Integración con la Plataforma Principal
El módulo de análisis se integra con el frontend principal de Flowise a través del sistema de alias:

```javascript
// Importación en la aplicación principal de Flowise
import { AnalyticsPage } from '@apps/analytics-frt'
```

### Fuentes de Datos
- **Base de Datos Supabase**: Consultas directas a tablas de leads y resultados de cuestionarios
- **Integración API**: API RESTful para obtener datos agregados
- **Caché en Tiempo Real**: Consultas de datos optimizadas para rendimiento

## Componentes

### AnalyticsPage
El componente principal que proporciona:

- **Panel de Resumen**: Métricas de alto nivel y KPI
- **Informes Detallados**: Análisis en profundidad de cuestionarios específicos
- **Filtros y Búsqueda**: Herramientas para segmentación de datos
- **Exportación de Datos**: Funcionalidad de exportación en varios formatos

## Uso

### Integración Básica
```javascript
import React from 'react'
import { AnalyticsPage } from '@apps/analytics-frt'

function App() {
  return (
    <div>
      <AnalyticsPage 
        quizId="quiz-123"
        dateRange={{ start: "2024-01-01", end: "2024-12-31" }}
        filters={{ deviceType: "mobile" }}
      />
    </div>
  )
}
```

### Configuración de Filtros
```javascript
const analyticsFilters = {
  dateRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  },
  quizTypes: ['ar-quiz', 'playcanvas-quiz'],
  userSegments: ['new-users', 'returning-users'],
  deviceTypes: ['mobile', 'desktop', 'tablet']
}
```

## Métricas y KPI

### Indicadores Clave de Rendimiento
- **Tasa de Finalización**: Porcentaje de usuarios que completan cuestionarios
- **Puntuación Promedio**: Rendimiento promedio en todos los intentos
- **Tiempo de Participación**: Tiempo promedio pasado en cuestionarios
- **Tasa de Retención**: Porcentaje de usuarios que regresan para cuestionarios adicionales

### Métricas Avanzadas
- **Análisis de Cohortes**: Seguimiento de grupos de usuarios a lo largo del tiempo
- **Embudo de Conversión**: Análisis del recorrido del usuario desde el inicio hasta la finalización
- **Segmentación A/B**: Comparación del rendimiento de diferentes versiones de cuestionarios
- **Análisis Predictivo**: Predicciones de tendencias futuras basadas en datos históricos

## Desarrollo

### Configuración
```bash
# Instalar dependencias
pnpm install

# Ejecutar en modo desarrollo
pnpm --filter analytics-frt dev
```

### Construcción
```bash
# Construir para producción
pnpm --filter analytics-frt build
```

### Pruebas
```bash
# Ejecutar pruebas
pnpm --filter analytics-frt test

# Ejecutar linter
pnpm --filter analytics-frt lint
```

## Configuración

### Variables de Entorno
```bash
# Endpoints de API
REACT_APP_ANALYTICS_API_URL=https://api.example.com/analytics
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# Configuraciones de análisis
REACT_APP_ANALYTICS_REFRESH_INTERVAL=30000
REACT_APP_MAX_DATA_POINTS=1000
```

## Seguridad

### Control de Acceso
- **Autenticación**: Requiere tokens JWT válidos para acceder a los datos
- **Autorización**: Los usuarios solo pueden ver análisis de sus cuestionarios
- **Filtrado de Datos**: Filtrado automático basado en permisos de usuario

### Privacidad de Datos
- **Anonimización**: Los datos personales de usuarios se anonimizan en informes
- **Cumplimiento GDPR**: Adherencia a regulaciones de protección de datos
- **Registros de Auditoría**: Seguimiento del acceso a datos analíticos

## Rendimiento

### Optimización
- **Carga Perezosa**: Los componentes se cargan bajo demanda
- **Caché de Datos**: Caché inteligente para reducir llamadas API
- **Virtualización**: Renderizado eficiente de grandes conjuntos de datos
- **Debouncing**: Interacciones de usuario optimizadas

## Mejoras Futuras

- **Aprendizaje Automático**: Integración ML para análisis predictivo
- **Visualización Avanzada**: Tipos adicionales de gráficos y visualizaciones
- **Exportación de Informes**: Generación y programación automática de informes
- **Integración con Herramientas Externas**: Conexión a Google Analytics, Mixpanel, etc.
- **Aplicación Móvil**: Aplicación móvil nativa para análisis sobre la marcha

## Siguientes Pasos

- [Sistema UPDL](../updl/README.md) - Aprende sobre el Lenguaje Universal de Definición de Plataformas
- [Sistema de Publicación](../publish/README.md) - Explora la publicación y compartición de contenido
- [Gestión de Perfiles](../profile/README.md) - Comprende las capacidades de gestión de usuarios
