# Consulta técnica a la cátedra — EP en backend especializado WebSocket

**Borrador para enviar al profesor; no enviado ni aprobado.** Fecha: 2026-11-09.

En CS2 Manager usamos dos backends con responsabilidades diferentes:

- **Flask:** fuente de verdad de usuarios, equipos, permisos y datos persistentes;
  API REST, emisión de JWT HS256 y eventos internos firmados con HMAC.
- **NestJS (`realtime/`):** valida JWT, confirma identidad/membresía con Flask,
  mantiene sockets y presencia por usuario/equipo y entrega notificaciones y
  actividad exclusivamente a rooms privadas. No duplica persistencia ni CRUD.
- **React:** consume la API y los mensajes Socket.IO; no decide destinatarios ni
  el equipo autorizado del socket. nginx limita Origin/proxy y no publica la API
  de eventos internos.

El backend NestJS declara exactamente:

| Decorador | Ruta | Función |
|---|---|---|
| `@Get('health')` | `GET /health` | Estado operativo sin secretos |
| `@Post('events')` + controller `internal` | `POST /internal/events` | Recepción autenticada de eventos Flask |

El gateway Socket.IO utiliza `/realtime/socket.io`, autentica conexiones y emite
`session.ready`, `notification`, `presence.snapshot`, `presence.updated` y
`team.activity`. El transporte Engine.IO y el proxy `/realtime/health` no son
declaraciones HTTP adicionales de negocio. No hay handlers de negocio entrantes
`@SubscribeMessage`; el navegador no puede pedir acceso a una room arbitraria.

**Según la guía exigente (28/10/2026), §4.1 y §4.7:** Nest es un marcador de
backend y los decoradores HTTP suman EP. La documentación disponible no establece
una excepción para WebSockets ni una equivalencia entre emisiones Socket.IO y
endpoints HTTP. Por eso informamos **backend, EP 2/10, no aprobado**. No tenemos
el código del analizador docente ni una respuesta del profesor que autorice
otra interpretación.

¿Podría confirmarnos la cátedra:

1. Si este servicio especializado, entregado en un repositorio separado de
   Flask, debe satisfacer igualmente el mínimo de diez endpoints HTTP.
2. Si existe una excepción documentada o una evaluación funcional alternativa
   para backends WebSocket, y qué evidencia y alcance tendría.
3. Cómo reconoce las capas en módulos Nest organizados por funcionalidad:
   archivos `*.controller.ts` / `*.service.ts` sin carpetas convencionales
   `controllers/` y `services/`.

Agregar ocho rutas artificiales no incorporaría funcionalidad; duplicar la API
REST de Flask crearía dos fuentes de verdad y más superficie de seguridad.
Readiness o métricas operativas solo se justificarían por una necesidad real,
no para llenar el contador. **No solicitamos que se cuenten emisiones como rutas
sin un criterio explícito ni declaramos una excepción concedida.**

El repositorio GitHub independiente todavía no está creado según la aclaración
del usuario. Las mediciones adjuntas son locales sobre `realtime/`; la comparación
contra `main` y la ejecución oficial quedan pendientes.
