# Fase B.1 — Cohesión, complejidad y calidad NestJS

Fecha: 2026-11-09. Perfil **exigente**, guía actualizada 28/10/2026.
Unidad: `realtime/`, incluyendo tests/helpers; excluyendo dependencias, dist,
coverage y configuraciones de herramientas, igual que Fase B.

**Resultado local:** se reducen problemas reales, conservando las protecciones
de Fase B. No se declara aprobación oficial: **índice estimado 13/60 y EP 2/10
siguen sin cumplir**. Capas y extractor docente pendientes de confirmar.

Se leyeron la guía completa, `FASE_B.md`, los dos JSON históricos y todas las
suites actuales. Los snapshots históricos se preservan. El auditor
`scripts/audit_nestjs_quality.cjs` **no se modificó en B.1** y permanece fuera de
la unidad, sin diluir el denominador. La línea base es una nueva ejecución,
no la repetición de resultados históricos.

## 1. Resumen antes/después

| Métrica | B.1 inicial reproducida | B.1 final | Interpretación |
|---|---:|---:|---|
| Índice revisado, SQL confirmado 0 | **10** | **13** | Estimación; mínimo 60 no alcanzado |
| Índice crudo del auditor | 10 | 12 | Incluye falso positivo SQL |
| Cohesión, clases bajo 50 % elegibles | 3 | **1** | Nueva señal de PresenceService; ver §3 |
| Complejidad ≥6, total | 25 | **18** | Máximo final 20; también cumple el máximo inicial 19 |
| Complejidad ≥6, producción | 21 | **14** | Reducción absoluta, no por añadir tests al denominador |
| Complejidad ≥6, tests | 4 | 4 | Mismos casos; no se reescribieron para evitar regex |
| Acoplamiento, clases CBO ≥8 | 5 | 6 | Máximo final 8; también cumple máximo inicial 7 |
| Tamaño, hallazgos | 35 | **30** | Máximo final 40; también cumple máximo inicial 38 |
| Métodos largos / funciones largas / firmas >4 params | 8 / 24 / 3 | 3 / 25 / 2 | Categorías y callbacks conservados |
| Duplicación única | 222/2.820 = **7,87 %** | 202/2.964 = **6,82 %** | Bajo 15 %; 20 líneas afectadas menos |
| Cobertura de líneas, todo src incluido main | 640/694 = **92,21 %** | 705/728 = **96,84 %** | Medida ejecutando Jest |
| SEC / DBG | 0 / 0 | 0 / 0 | Señales locales, no prueba de seguridad absoluta |
| SQL confirmado / sospechas regex | 0 / 1 | 0 / 1 | Buffer.from en HMAC no es SQL |
| Endpoints HTTP | 2 | 2 | No se agregaron rutas |
| LOC no vacías / archivos de código | 3.838 / 43 | 4.019 / 52 | Tests incluidos según guía |

Evidencia reproducible: [inicial](quality-b1-initial.json),
[final](quality-b1-final.json) y snapshots `quality-b1-step1.json` a
`quality-b1-step5.json`. Contienen inventarios completos de clases, funciones,
campos, tipos, ventanas repetidas, líneas únicas y hashes de archivos.
Resumen conservado de la ejecución de cobertura: [coverage-b1-final.json](coverage-b1-final.json).

## 2. Investigación del índice, anterior a las modificaciones

La guía §4.2 define el peso por **cada hallazgo**, no únicamente por criterios
en rojo. Que Acop o Tam estén dentro del límite de densidad no elimina su peso.
La clasificación sigue siendo **backend** por Nest, arranque y controllers.

```text
peso = 20*SEC + 15*SQL + 10*no_layering + 8*Coh + 8*CBO
     + 6*BigC + 5*métodos_largos + 5*complejas
     + 4*funciones_largas + 4*firmas_largas
     + 3*HTTP_en_componentes + 2*Any + 2*DBG + 1,5*duplicación_porcentual
índice = round(4000 / (peso + 40))
```

Después se aplican los topes por duplicación (≥15: 50, ≥30: 30, ≥50: 15).
Aquí no se activa ninguno. Cobertura y EP son criterios independientes, no se
añadió un peso inexistente por EP ni se omitieron pesos porque una densidad pase.
Any tiene peso 2 por archivo cuando aplica; aquí su conteo es cero. HTTP/BigC
son señales frontend no aplicables.

**Hallazgos no duplicados incorrectamente:** un método puede ser largo,
complejo y tener demasiados parámetros; §4.4 lo permite expresamente. El auditor
clasifica métodos y funciones como categorías mutuamente excluyentes para
longitud. Las líneas duplicadas usan un conjunto `archivo:línea`, no la suma de
ventanas superpuestas.

**Sobreconteo real de atribución:** la regex de complejidad lee el cuerpo
completo incluyendo funciones anidadas. En `presence.e2e.spec.ts` las líneas
128, 129 y 134 atribuyen las mismas cinco decisiones a tres niveles: `beforeAll`,
callback HTTP y callback `end`. Son tres atribuciones, dos de ellas heredadas.
También el `describe` de `app.e2e.spec.ts:243` hereda las decisiones de sus tests.
No equivale a tres defectos de producción. Se mantienen esos cuatro hallazgos
crudos tanto antes como después; no se cambió el extractor para subir la nota.
Una corrección exclusiva de funciones anidadas requeriría otro inventario y
confirmación docente, no modificar silenciosamente los históricos.

La sospecha SQL de `src/common/hmac.ts:6` combina `Buffer.from` e interpolación
de texto HMAC: **no contiene SQL ni ejecución de consultas**. Se descuenta
explícitamente su peso 15 para el índice revisado, como en Fase B.

```text
Inicial: 3*8 + 5*8 + 8*5 + 25*5 + 24*4 + 3*4 + 7,8723404255*1,5
       = 348,8085106383 → round(4000/388,8085106383) = 10
Final:   1*8 + 6*8 + 3*5 + 18*5 + 25*4 + 2*4 + 6,8151147099*1,5
       = 279,2226720648 → round(4000/319,2226720648) = 13
```

El crudo final conserva peso **294,2226720648**, índice **12**. Si el matcher
oficial rechazara capas se agregarían otros 10: índice revisado **12**. Si además
se descartara manualmente el hallazgo de PresenceService, revisado redondea
igualmente a **13**; no se usa esa interpretación para declarar Coh=0.
Los números dependen del extractor local, no del motor oficial inaccesible.

## 3. Refactors arquitectónicos incrementales

### Identidad: transporte y validación frente a consistencia de caché

`IdentityVerifierService` mezclaba firma/HTTP, estados del upstream, validación
de datos y ciclo de caché/consultas pendientes. Se extrajeron:

- `FlaskIdentityClient`: contrato HTTP/HMAC con Flask, timeout, estados y política
  de indisponibilidad; devuelve `null` para fail-open, nunca una membresía válida.
- `identity-response.ts`: validación pura de identidad, equipo y rol no confiables.
- El servicio original conserva **juntos** caché e invalidación de consultas
  pendientes. Tras `await`, comprueba el AbortSignal antes de devolver o cachear,
  incluso si el cliente devuelve fail-open. La invalidación aborta todas las pestañas.

No se crearon servicios de caché genéricos ni se separó su invalidación de las
consultas pendientes. No se cachean respuestas fail-open, errores HTTP o JSON
inválido. Se preservan expiración TTL y coincidencia de username.

### Gateway: frontera de seguridad y ciclo de presencia

- `SocketAuthenticationService`: middleware de handshake, JWT, verificación de
  identidad, límites y protección de la vida del socket. Helpers de
  `socket-session.ts` conservan IP confiable detrás de nginx, token solo auth o
  bearer, errores sanitizados y timer de vencimiento JWT (incluido límite de Node).
- `PresenceService`: snapshot, debounce por equipo, emisión y limpieza de timers
  al destruir el módulo. No autentica ni modifica membresías.
- `RealtimeGateway`: transporte y coordinación **sincrónica** de registro/rooms.
  Se mantiene la secuencia invalidar → abandonar room anterior → entrar a nueva
  room → publicar; expulsiones abandonan antes de entregar actividad privada.
  No se añadió un `await` entre estas operaciones ni un endpoint nuevo.

Se conservaron las interfaces de emisiones y `presenceMessage`, y se registraron
los nuevos providers en los módulos Nest. E2E recorre el contenedor DI real.

### Registro: índices encapsulados, consistencia aún centralizada

Se conservó un único `SocketRegistryService` como dueño de conexiones, usuario,
IP y membresía. Los helpers que recibían mapas ajenos pasaron a `SocketIndex<Key>`,
un multimap reutilizado por usuario/IP. No son dos servicios con escrituras
independientes. Register/unregister siguen siendo sincrónicos y actualizan ambos.
Los listados de IDs son copias, no exponen los conjuntos internos.

`updateTeamForUser` ahora separa obtener estados, calcular el cambio y aplicar
la mutación a todas las pestañas. No cambia semántica de previousTeamId/changed.
Se probaron reemplazo de socket, IP compartida, múltiples pestañas, usuarios
distintos y cambios repetidos sin modificación.

### Validaciones complejas de producción

- JWT: verificación criptográfica separada de claims tipados (`jwt-claims.ts`).
  Se eliminó una rama redundante de JsonWebTokenError cuyo resultado era idéntico
  al catch genérico; errores expirados siguen diferenciados. Solo HS256, firma y
  tolerancia existentes, claims y vida exp>iat conservados.
- Eventos: etapas explícitas de sobre, ventana temporal, destinatarios y
  consistencia de recurso/equipo/actor. El catálogo cerrado de payloads no cambió.
- HMAC: lectura de headers requeridos, formato, ventana y firma del cuerpo exacto
  separados de consumir nonce. **Nunca** se consume antes de validar la firma;
  ReplayStore conserva el rechazo 503 sin expulsar nonces vigentes.

No se introdujeron nuevos métodos/funciones **de producción** ≥30 líneas. Los
callbacks contenedores de las dos nuevas suites sí son largos para el auditor;
se contabilizan, no se borran ni fragmentan artificialmente los tests.

### Cohesión directa medida

| Clase | Antes (pares compartidos) | Después (pares compartidos) |
|---|---|---|
| IdentityVerifierService | 30 % (3/10) | **66,67 % (4/6)** |
| RealtimeGateway | 46,97 % (31/66) | **75,56 % (34/45)** |
| SocketRegistryService | 46,67 % (56/120) | **53,33 % (56/105)** |
| ConnectionLimiterService | 66,67 % (4/6) | 66,67 % (4/6) |
| SocketAuthenticationService, nuevo | — | 66,67 % (4/6) |
| PresenceService, nuevo | — | **20 % (2/10), hallazgo conservado** |

El incremento del registro no implica que ahora tenga más pares compartidos:
se quitaron operaciones genéricas de indexación sin campos propios y se añadió
la consulta de estados; se justifica por encapsulación, no por la fracción.

PresenceService tiene cuatro campos y cinco métodos. Snapshot usa registry,
schedule usa config/timers, broadcast usa server, y schedule→broadcast→snapshot
es delegación real que la métrica directa no sigue. Es **candidato a falso
positivo**, no una exención demostrada. No se añadieron lecturas artificiales
de campos ni se dividió otra vez para salir del mínimo de elegibilidad.

FlaskIdentityClient tiene dos campos y cuatro métodos: no es elegible con el
mínimo de tres campos. Se informa esa limitación, no un porcentaje aprobado;
su frontera es el protocolo HTTP, no la intención de evitar el analizador.

## 4. Mediciones por paso y pruebas después de cada refactor

Todos los pasos ejecutaron `npm run test:coverage -- --silent`, incluidos los
E2E originales. SEC=0, DBG=0, SQL confirmado=0 y dos endpoints en cada snapshot.

| Snapshot | Cambio | Coh | Compl | CBO | Tam | Dup. | Tests | Cob. líneas |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| initial | Reproducción | 3 | 25 | 5 | 35 | 7,87 % | 78 | 92,21 % |
| step1 | Identidad | 2 | 24 | 6 | 34 | 7,12 % | 88 | 93,33 % |
| step2 | Gateway/seguridad/presencia | 2 | 23 | 6 | 32 | 7,10 % | 90 | 95,06 % |
| step3 | Registro/índices | 1 | 22 | 6 | 32 | 7,02 % | 92 | 95,26 % |
| step4 | JWT/etapas de eventos/token | 1 | 19 | 6 | 30 | 7,00 % | 92 | 95,59 % |
| step5 = final | Etapas HMAC/pruebas de seguridad | 1 | 18 | 6 | 30 | 6,82 % | 100 | 96,84 % |

Los límites por LOC se recalcularon en cada snapshot; siempre se mantuvieron
Tam y CBO por debajo de sus límites. La cantidad compleja final también cumple
**con el denominador inicial congelado**. El aumento de LOC no se presenta como
una eliminación de complejidad. Los controllers y servicios siguen separando
presentación/lógica en todos los pasos; el reconocimiento privado de capas no
se puede confirmar con esta herramienta.

## 5. Inventario completo de los 25 hallazgos iniciales

Rutas relativas a `realtime/`. Líneas y complejidad iniciales tomadas de
`quality-b1-initial.json`; las líneas finales están en `quality-b1-final.json`.
Los tests se nombran relativos a `test/`. Cada fila registra responsabilidad,
refactor posible y decisión tomada, no solo el resultado de una regex.

| Archivo y función, línea inicial | CC | Responsabilidad / decisión de refactor | Tests existentes |
|---|---:|---|---|
| `src/auth/identity-verifier.service.ts` verify:40 | 7 | Cache y consulta; separar lectura/cache de transporte. Final verify 3, cachedIdentity 4, lookup 5. | unit/identity-verifier, E2E presencia |
| mismo archivo, fetchIdentity:64 | 14 | HMAC/HTTP/status/datos/cache; cliente HTTP + validador puro. Cliente lookup 6 (pendiente), request 1/readBody 2. | unit/identity-verifier; integración Flask |
| mismo archivo, parseTeamId:149 | 7 | Equipo opcional válido; Number.isSafeInteger expresa la restricción. identity-response teamId 6, guardas conservadas. | unit/identity-verifier |
| mismo archivo, parseRole:162 | 6 | Rol opcional acotado; trasladado a validación pura, sigue 6. No ocultar guardas. | unit/identity-verifier |
| `src/auth/jwt-verifier.service.ts` verify:17 | 19 | Criptografía + claims. Final verify 3, verifySignature 3; validadores claims ≤4. | unit/jwt-verifier; E2E autenticación/expiración |
| `src/config/realtime-config.ts` readSecret:31 | 6 | Entorno o archivo; guardas/error seguro, posible separar proveedores si creciera. Sin cambio. | unit/config |
| mismo archivo, loadConfig:74 | 9 | Configuración completa/defaults/validación; posible agrupar validación por dominio. Se conserva, no refactor general. | unit/config; bootstrap/E2E |
| `src/events/event-payload.validator.ts` exactKeys:33 | 6 | Claves cerradas requeridas/opcionales. Simple bucle explícito; conservar en esta fase. | unit/event-validator; E2E eventos |
| mismo archivo, text:50 | 6 | Longitud/tipo/control chars; extraer opciones no aporta claridad aquí. Sin cambio. | unit/event-validator |
| mismo archivo, validatePayload:142 | 9 | Catálogo discriminado de 7 payloads; posible catálogo tipado futuro, no sustituir por mapa no seguro. Sin cambio. | unit/event-validator cubre los 7 tipos |
| mismo archivo, validateInternalEvent:288 | 16 | Sobre/tiempo/recipients/consistencia; etapas independientes. Final función 1, helpers ≤5. | unit/event-validator; E2E eventos |
| `src/events/events.controller.ts` receive:30 | 6 | JSON, traducción HTTP, event_id, dispatch. Posible parser de petición futuro; sin cambio. | E2E API interna |
| `src/events/events.service.ts` applyMembershipChange:75 | 7 | Decisión de membresía por actividad. Switch explícito evita mezclar usuarios; posible parser de comando futuro. Sin cambio. | unit/events-service; E2E altas/bajas/expulsión/rol |
| `src/events/hmac.guard.ts` canActivate:38 | 11 | Headers/tiempo/firma/nonce; etapas separadas sin cambiar orden. Final 2, helpers ≤4. | unit/hmac/replay-store; E2E API interna |
| `src/notifications/notification.factory.ts` build:35 | 8 | Catálogo de mensajes de siete tipos. Posible factories tipadas por evento futuro; sin cambio general. | unit/notification-factory; E2E rooms |
| `src/realtime/realtime-io.adapter.ts` originAllowed:45 | 6 | Política Origin; guardas explícitas preservadas. Posible política pura si creciera. | E2E Origin rechazado |
| `src/realtime/realtime.gateway.ts` clientIp:58 | 9 | Cabeceras proxy; separar lectura de última IP. socket-session clientIp 6, forwardedIp 3. | E2E conexiones; nueva unit/socket-security |
| mismo archivo, handleConnection:134 | 7 | Registrar/proteger/bienvenida/equipo. Delegación por responsabilidad. Final 4, welcomeTeam 2. | E2E autenticación/presencia/expiración/reconexión |
| mismo archivo, syncTeamMembership:211 | 7 | Cambio de índices y rooms. Extracción común de traslado seguro. Final 3; moveUserRooms 6 (nuevo hallazgo, visible). | E2E presencia y actividad; unit/events-service |
| mismo archivo, authenticate:282 | 11 | Intento/token/JWT/identidad/límites. Servicio de autenticación y parser token. Final authenticate 3; parser y helpers ≤4. | E2E JWT/query/rooms; unit/jwt-verifier/connection-limiter |
| `src/realtime/socket-registry.service.ts` updateTeamForUser:131 | 8 | Cambio para todas las pestañas. Separar selección/cálculo/mutación. Final 2, membershipChange 4, statesForUser 3. | unit/socket-registry; E2E equipos |
| `test/e2e/app.e2e.spec.ts` callback describe:243 | 6 | Agrupa escenarios Socket.IO; atribuye decisiones anidadas. No refactorizar suite para el contador. Sigue 6. | Es el propio conjunto E2E |
| `test/e2e/presence.e2e.spec.ts` callback beforeAll:128 | 6 | Ciclo fixture identidad/Nest; lógica heredada. Separar fixture solo si reutilizado, sin cambio. | Todos los E2E de presencia |
| mismo archivo, callback HTTP:129 | 6 | Lee request del servidor simulado; hereda callback end. Sin cambio. | Todos los E2E de presencia |
| mismo archivo, callback end:134 | 6 | Parseo y respuesta de identidad simulada; decisiones reales del fixture, no producción. Sin cambio. | Todos los E2E de presencia |

Los **18 finales** se componen de 14 en producción y estos cuatro callbacks.
Los de producción son: FlaskIdentityClient.lookup (6), identity-response.teamId
(6), identity-response.role (6), readSecret (6), loadConfig (9), exactKeys (6),
text (6), validatePayload (9), EventsController.receive (6),
EventsService.applyMembershipChange (7), NotificationFactory.build (8),
RealtimeIoAdapter.originAllowed (6), RealtimeGateway.moveUserRooms (6) y
socket-session.clientIp (6). No se asegura haber resuelto toda complejidad.

## 6. Acoplamiento, tamaño y duplicación

CBO lexical ≥8 final: **InternalEventDto 17, EventsController 13,
RealtimeGateway 11, FlaskIdentityClient 10, IdentityVerifierService 9, HmacGuard 9**.
Antes: 17, 13, 16, 14 y 14 en las cinco clases originales. La extracción crea un
sexto candidato, pero reduce dependencias por clase en gateway/identidad/guard.
El conteo incluye interfaces, decoradores y constantes; por ejemplo `Inject`,
`REALTIME_CONFIG`, `MAX_SAFE_INTEGER` no equivalen todos a dependencias de negocio.
Se conservó esa aproximación conservadora sin borrar tipos para bajar CBO.
Final **1,49 hallazgos/1000 LOC**, máximo 2; antes 1,30/1000.

Tam final **7,46/1000 LOC**, máximo 10. Quedan tres métodos largos de producción
(receive, applyMembershipChange y NotificationFactory.build), dos funciones
largas de producción (loadConfig, validatePayload), y 23 funciones/callbacks
largos de tests/helpers. Dos firmas largas: verifyHmac y registry.register.
Las nuevas suites añaden callbacks contenedores largos, contados en 25; no
desaparecen mediante exclusión de tests. El tamaño por líneas también depende
del formato, por eso no se usa solo su descenso como prueba arquitectónica.

Duplicación: ventanas consecutivas de cinco líneas, comentarios/imports quitados
y espacios normalizados, unión de líneas afectadas. **41→39 grupos** y
**445→425 incidencias solapadas**, pero el numerador correcto es **222→202**.
La extracción elimina la repetición de ramas de identidad; los restantes
cambios del porcentaje incluyen el denominador y el formato. No se afirma que
todo el descenso porcentual represente eliminación de clones. No se refactorizó
el catálogo de notificaciones por una duplicación que ya cumple.

## 7. Verificaciones finales y seguridad

| Ejecución | Resultado verificado |
|---|---|
| Coverage completo final | **15 suites, 100 tests aprobados** |
| Unitarios separados | **13 suites, 82 aprobados** |
| E2E separados | **2 suites, 18 aprobados** |
| Líneas / statements / funciones / ramas | **96,84 % / 95,24 % / 98,69 % / 84,77 %** |
| TypeScript | `npm run lint` (`tsc --noEmit`) correcto, src + test |
| Build | `npm run build` correcto; Docker build correcto |
| Integración aislada | Pytest **1 passed**, socket Nest real + JWT y endpoint identidad HMAC Flask reales, SQLite temporal |
| Auditor de duplicación | Sus 4 comprobaciones correctas |
| Producción audit | `npm audit --omit=dev --json`: **0 vulnerabilidades reportadas** |
| Docker | Rebuild y recreate **solo realtime**, `--no-deps --wait`: **healthy** |

**Incidencias no ocultadas:** una ejecución posterior, en paralelo de Docker
build + Jest unitarios + E2E + integración, agotó el timeout de 60 s del subprocess
de integración y el límite externo de 180 s de unitarios. E2E y Docker terminaron.
Al repetir aisladamente, sin cambiar timeouts ni código, integración pasó en
67,90 s totales Pytest (subprocess dentro de su límite), y unitarios en 46,337 s.
La contención de recursos es la explicación compatible con esos resultados,
no una demostración de que nunca pueda haber flakiness. La corrida completa
final de coverage había pasado antes de esos intentos.

Nuevas pruebas de identidad: todas las consultas pendientes invalidadas, incluso
fail-open; resultados fail-open no cacheados; 403/404 no autorizan, JSON inválido
rechazado; límites de equipo/rol. Nuevas pruebas de registro: reemplazo atómico,
IP compartida y actualización de todas las pestañas. Presencia: debounce usa el
snapshot actual y cancela timers al destruir módulo. Seguridad de socket:
freno de intentos antes del JWT, límite activo después de identidad, errores
inesperados sanitizados, desconexión por mensajes, IP de proxy y bearer/query,
timer JWT largo y limpieza al desconectar. Se preservaron todos los tests previos.

Fase B conservada: HS256 y expiración de sesión, HMAC sobre cuerpo exacto y
comparación constante, nonces/event_id/TTL y saturación cerrada, membresía
concurrente, rooms privadas, sanitización, Origin, conexiones y mensajes.
La revalidación de pertenencia procede de Flask, no del navegador.

Salud final: Nest directo `/health`, nginx `/realtime/health`, Flask `/api/health`
**200**; `/internal/events` por nginx **404**; Nest directo sin HMAC **401**.
Nest, Flask, frontend y PostgreSQL estaban **healthy** al inspeccionarlos.
Solo se consultó salud de los otros servicios: no se reconstruyeron ni modificaron.

## 8. Endpoints y consulta separada

Siguen **GET /health y POST /internal/events**, clase estimada backend.
No hay evidencia de excepción docente WebSocket en la guía disponible ni una
aprobación del profesor. [Consulta técnica preparada](CONSULTA_CATEDRA_EP_WEBSOCKETS.md)
explica la arquitectura, gateway y razones para no crear ocho rutas artificiales.
Está **sin enviar**, EP permanece **2/10**, no aprobado. No se trasladó REST de
Flask a Nest para inflar el contador.

## 9. Archivos afectados en B.1

Producción modificada:

- `src/auth/auth.module.ts`, `src/auth/identity-verifier.service.ts`,
  `src/auth/jwt-verifier.service.ts`.
- `src/events/event-payload.validator.ts`, `src/events/hmac.guard.ts`.
- `src/realtime/realtime.gateway.ts`, `src/realtime/realtime.module.ts`,
  `src/realtime/socket-registry.service.ts`.

Producción nueva:

- `src/auth/flask-identity.client.ts`, `src/auth/identity-response.ts`,
  `src/auth/jwt-claims.ts`.
- `src/realtime/socket-authentication.service.ts`, `src/realtime/socket-session.ts`,
  `src/realtime/presence.service.ts`, `src/realtime/socket-index.ts`.

Pruebas modificadas: `test/unit/identity-verifier.spec.ts`,
`test/unit/socket-registry.spec.ts`. Nuevas: `test/unit/presence.spec.ts`,
`test/unit/socket-security.spec.ts`. Todas las otras suites y fixtures intactos.

Documentación nueva: este informe, consulta EP y JSON B.1 inicial, step1–5 y
final. Cobertura y dist fueron regenerados; no son nuevos archivos fuente para
la métrica. Package/lockfile, `.env`, Dockerfile, Flask, React y auditor sin
cambios en esta fase.

## 10. Limitaciones y pendientes

1. Índice **13 <60**: el peso sigue dominado por funciones/callbacks largos,
   complejidad y CBO. No se ocultan tests ni se elimina su peso para lograr 60.
   **Cota inferior demostrable con este denominador:** aunque se eliminaran todos
   los hallazgos de cohesión, acoplamiento, métodos largos, complejidad, firmas y
   SQL, quedarían las 25 funciones largas (25×4 = 100) y la duplicación
   (6,8151×1,5 = 10,2227), es decir, peso ≥ 110,2227 → índice máximo
   `round(4000/(110,2227+40)) = 27`. Si además se refactorizaran las dos funciones
   largas de producción, quedan 23 callbacks de tests/helpers: peso ≥ 102,2227 →
   índice máximo **28**. Para llegar a 60 el peso total debe ser ≤ 26,67; solo la
   duplicación ya aporta 10,22 y cuatro funciones largas aportan 16. El umbral es
   inalcanzable sin fragmentar artificialmente las suites o alterar el denominador,
   acciones que la guía y este trabajo rechazan. Si el motor oficial excluyera
   callbacks o tests, el cálculo cambiaría; no se dispone de ese motor.
2. Coh **1**, PresenceService candidato a falso positivo de delegación. El
   resultado oficial y la lectura docente podrían diferir; no se declara cero.
3. Complejidad léxica cuenta `?.`, `??`, operadores, palabras en strings y cuerpos
   anidados; la extracción oficial de callbacks/constructores no está disponible.
   Validaciones cortas con seis decisiones no se consideran automáticamente
   defectos que convenga fragmentar aún más.
4. Capas funcionales se conservan (controllers/gateway → servicios → adaptador
   HTTP/validadores, persistencia propia no necesaria), pero cero directorios
   convencionales `controllers/`/`services/`. La guía menciona archivos y carpetas;
   **no se puede certificar el reconocimiento oficial**. No se crearon carpetas
   vacías ni se reorganizó todo el proyecto para la regex.
5. EP **2/10**, consulta pendiente. Repo GitHub independiente aún no creado por
   decisión del usuario; sin comparación remota/main ni aprobación oficial.
6. Los **11 avisos de desarrollo** documentados en Fase B no se repararon mediante
   upgrades mayores; no hubo cambios de dependencias. El audit de producción
   volvió a comprobarse, cero conocidos no implica ausencia de vulnerabilidades.
7. Clave operativa débil existente no rotada. Configuración real y datos cifrados
   no se tocaron. Cachés/replay/presencia siguen siendo locales a una instancia:
   no se garantiza continuidad anti-replay entre reinicios ni múltiples réplicas.
8. Los eventos de membresía siguen sin versión global/orden total. Las pruebas
   de consulta invalidada no prueban resolver toda entrega fuera de orden posible.

**Sin commits, push, repos nuevos, autorías modificadas, tests eliminados,
secretos rotados, volúmenes eliminados ni operaciones sobre PostgreSQL real.**

### Reproducción

Desde la raíz: `node scripts/audit_nestjs_quality.cjs --self-test` y
`node scripts/audit_nestjs_quality.cjs realtime/docs/quality-b1-final.json`.
No sobrescribir snapshots iniciales/históricos. Integración aislada:
`python -m pytest scripts/tests/test_flask_nestjs_integration.py -q`.

Desde `realtime/`: `npm run test:unit`, `npm run test:e2e`,
`npm run test:coverage`, `npm run lint`, `npm run build`,
`npm audit --omit=dev --json`. Ejecutar corridas pesadas separadas en este equipo.
El build Docker instala con `npm ci` y no modifica el lockfile local.

## 11. Cierre de la fase

Fecha: 2026-11-10. El responsable del proyecto aceptó cerrar B.1 con los
resultados medidos: **índice local 13** y **EP 2/10**, ambos documentados como
no conformes con el perfil exigente. El cierre es una decisión de alcance, no
una aprobación de la cátedra ni una declaración de cumplimiento del índice 60.

Se verificó de nuevo, tras el cierre, que el informe y los snapshots describen
el mismo estado: auditor `--self-test` 4/4, duplicación 6,82 %, cobertura
96,84 % (15 suites, 100 tests), lint y build sin errores, 0 vulnerabilidades de
producción e integración Flask↔NestJS en verde. No se añadieron commits, push,
tests eliminados, secretos rotados ni cambios en Flask o React.

Pendientes fuera de B.1: respuesta de cátedra sobre EP en backends WebSocket y
reconocimiento de capas; repositorio independiente y ejecución del analizador
docente; Fase C (React) sin iniciar; en Flask, decidir si se acepta el 18,51 %
de duplicación o se autoriza un refactor de modelos SQLAlchemy.
