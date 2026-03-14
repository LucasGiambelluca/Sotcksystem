# CONTEXTO DEL PROYECTO: Sotcksystem

Este archivo sirve como memoria persistente del progreso del sistema para permitir la limpieza del contexto de los agentes de IA sin perder información crítica.

## 1. Resumen del Sistema
**Sotcksystem** es una plataforma integral de gestión de stock y ventas para locales gastronómicos, compuesta por:
- **Bot de WhatsApp**: Motor de flujos dinámico para toma de pedidos.
- **Backend**: Supabase (DB + Edge Functions).
- **Frontend**: Panel de administración para gestión de inventario y pedidos.
- **Infraestructura**: Desplegado en VPS con soporte para dominios personalizados y certificados SSL.

## 2. Arquitectura Técnica
- **Motor de Flujos**: `FlowEngine.ts` (Core logic), `SessionRepository.ts` (Persistencia en Supabase).
- **Base de Datos**: Esquema relacional en Supabase con tablas para `flows`, `flow_executions`, `products`, `orders`, etc.
- **Procesamiento**: Encolamiento de mensajes por sesión para evitar condiciones de carrera.

## 3. Estado Actual y Progreso Reciente
- **Sesiones de WhatsApp**: Se implementó una lógica de `forceReset` y limpieza de duplicados para evitar errores `PGRST1116`.
- **Despliegue**: El sistema está operativo en VPS. Se resolvieron problemas de DNS y cortafuegos.
- **Alertas**: Se mejoraron las notificaciones de pedidos entrantes en el panel administrativo.
- **Flujo de Stock**: Implementado el rastreo desde depósito hasta producción.

## 4. Diagnóstico Bot (14-03-2026)
Se ha generado un archivo específico `DIAGNOSTICO_BOT.md` que detalla por qué el bot a veces "pierde el hilo". Los puntos clave son:
- **Aislamiento de Variables**: Las variables no se heredan automáticamente entre flujos linkeados.
- **Fuzzy Matching**: El `ConditionExecutor` tiene reglas de coincidencia que pueden inducir a error.
- **Inconsistencia de Sesiones**: Posibles duplicados en `flow_executions` no archivados correctamente.

## 5. Plan de Mejora Ejecutado (Completado 14-03-2026)
Todas las fases del diagnóstico han sido implementadas exitosamente:

- **Fase 1 (Saneamiento)**: Sesiones con `expires_at` y recuperación de estado mejorada.
- **Fase 2 (Parser)**: `ConditionExecutor` con Regex y normalización de texto.
- **Fase 3 (Persistencia)**: Variables globales funcionales entre flujos.
- **Fase 4 (Trazabilidad)**: Logging no bloqueante y visualización de rutas de debug.
- **Estabilización Final**: 
    - Corregida inyección de `OrderService` en `FlowEngine`.
    - Eliminado el bucle de "override" en pedidos de catálogo para una compra directa y fluida.
    - Sincronización completa del esquema de base de datos.

---
*Estado del sistema: ESTABLE y OPERATIVO.*
