# Fase B — Auditoría local y correcciones de NestJS

Fecha: 2026-11-09. Unidad analizada: **`realtime/` como backend independiente**,
no Flask/React ni el monorepo completo. Estimación según la guía
`COMO-ESTIMAR-TUS-METRICAS-ALUMNOS.md`, actualización 28/10/2026, leída completa
desde Downloads. También se revisaron los informes Etapas 1–4, Etapas 5–8,
Fase A.2 y su cierre rectificado.

**No es cumplimiento oficial.** El usuario confirmó que el repositorio GitHub
independiente todavía no existe. Se midió el working directory; no se crearon
repositorios, commits ni push. La clasificación y las métricas oficiales de
`main` quedan pendientes de publicación y ejecución del analizador docente.

## 1. Duplicación: medida antes de modificar producción

| Medición | Archivos | Normalizadas | Duplicadas únicas | % único | Incidencias solapadas | % por suma incorrecta |
|---|---:|---:|---:|---:|---:|---:|
| Informe anterior | Sin inventario | No publicado | No publicado | **20,97 % informado, no validado** | No publicado | No reconstruible |
| Inicio de Fase B | 42 | 2.670 | 222 | **8,31 %** | 445 | 16,67 % |
| Final de Fase B | 43 | 2.820 | 222 | **7,87 %** | 445 | 15,78 % |

Evidencias: [antes](quality-before.json) y [después](quality-after.json), con
hash de cada archivo, todas las ventanas repetidas, ocurrencias y líneas
marcadas. Hay **41 grupos de ventanas repetidas**. Cada identificador
`archivo:línea` se cuenta una sola vez en el numerador correcto.

Método reproducido de §4.5:

1. Código soportado de la unidad completa, incluidos tests/helpers; sin
   dependencias, dist/build/coverage, configuraciones de herramientas ni >1 MB.
2. Comentarios eliminados preservando posiciones; imports completos, también
   multilínea, eliminados mediante el AST de TypeScript. Espacios normalizados.
3. Descartar líneas vacías, de símbolos, imports/requires y controles sueltos.
4. Ventanas consecutivas de cinco líneas normalizadas **dentro de cada archivo**;
   comparar su texto exacto en toda la unidad, también dentro del mismo archivo.
5. Si una ventana se repite, añadir sus cinco líneas de cada ocurrencia a un
   conjunto. Porcentaje = tamaño del conjunto / total normalizado × 100.

No se refactorizó por duplicación: **ya cumplía al empezar**. Las 222 líneas
duplicadas y las 445 incidencias no cambiaron. La bajada 8,31 → 7,87 es de
denominador (+150 normalizadas en guardas de seguridad y pruebas), no de
eliminación de clones. No se presenta como una mejora de refactorización.

El 20,97 % previo no aporta líneas, inventario ni algoritmo ejecutable que
permitan reconstruir su resultado. El doble conteo explica una diferencia
comprobable entre 8,31 y 16,67 en el mismo snapshot, pero **no prueba por sí
solo toda la diferencia contra 20,97**. No se inventó esa atribución.

Desglose final de líneas únicas: producción **98**, tests/helpers **124**.

| Archivo | Duplicadas únicas |
|---|---:|
| `src/auth/identity-verifier.service.ts` | 10 |
| `src/events/event-payload.validator.ts` | 35 |
| `src/events/event.types.ts` | 5 |
| `src/notifications/notification.factory.ts` | 43 |
| `src/realtime/realtime.gateway.ts` | 5 |
| `test/e2e/app.e2e.spec.ts` | 27 |
| `test/e2e/presence.e2e.spec.ts` | 7 |
| `test/helpers/fixtures.ts` | 50 |
| `test/unit/event-validator.spec.ts` | 5 |
| `test/unit/identity-verifier.spec.ts` | 30 |
| `test/unit/notification-factory.spec.ts` | 5 |
| **Total** | **222** |

### Limitaciones del estimador

El motor oficial no se distribuye con la guía. El auditor local usa el scanner
y el AST de TypeScript para localizar código, y regex para estimar decisiones.
La eliminación de comentarios tiene casos límite con regex/template literals;
no se renombra ni tokeniza el código para buscar clones. Una variable renombrada
rompe una coincidencia, como advierte la guía. No se crean ventanas entre el
final de un archivo y el siguiente. Las pruebas del auditor comprueban unión
de solapamientos (12 líneas, no 20), bloques menores de cinco, límites de
archivos e imports/comentarios, preservando URLs dentro de strings.

Para complejidad se incluyen callbacks y constructores; una regex sobre un
cuerpo puede contar lógica anidada o palabras de strings. La delimitación de
funciones del motor docente podría producir otros conteos. Se documenta la
aproximación, no se la presenta como implementación oficial exacta.

## 2. Clasificación, capas y endpoints

**Clasificación estimada: backend**, no app: dependencias `@nestjs/core`,
`@nestjs/platform-express`, arranque NestFactory, controllers HTTP y gateway
NestJS. La guía §4.1 menciona Nest como marcador backend. Usar Socket.IO no
convierte al servicio en app ni lo exime automáticamente de EP.

| Método | Ruta real | Declaración | Acceso |
|---|---|---|---|
| GET | `/health` | `HealthController`, decorador Get | Salud, sin secretos |
| POST | `/internal/events` | `EventsController`, decorador Post | HMAC, timestamp, nonce, validación y deduplicación |

Son **dos decoradores HTTP reconocidos por §4.7; EP = 2 < 10**.
`/realtime/health` es el proxy de nginx al mismo health, no otro endpoint Nest.
El gateway usa `/realtime/socket.io`, callbacks de conexión/desconexión y
emisiones a rooms privadas. No tiene handlers SubscribeMessage ni rutas REST
de negocio adicionales. El transporte HTTP interno de Engine.IO no se suma
como endpoints declarativos del backend. Los endpoints de Flask no se suman.

No se crearon ocho rutas artificiales. Readiness o métricas podrían ser
funcionales si apareciera una necesidad operativa real, pero no justifican
inflar el servicio a diez rutas. CRUD de usuarios/equipos/notificaciones
duplicaría responsabilidades de Flask. Corresponde consultar a la cátedra
si admite una excepción para este servicio especializado, no renombrarlo app.

**Capas:** hay presentación (`*.controller.ts`, gateway) y lógica
(`*.service.ts`, validadores). No tiene persistencia propia: PostgreSQL pertenece
a Flask. Son dos capas arquitectónicas reales, suficientes para el piso de dos.
Sin embargo, las carpetas son módulos por funcionalidad (`auth`, `events`, etc.),
no carpetas `controllers/` y `services/`: el chequeo estricto por directorios
da **cero marcadores convencionales**. La guía también menciona nombres de
archivo, pero no publica el matcher completo. **La detección oficial de capas
queda por confirmar**; no se crearon carpetas vacías ni se movieron archivos
solo para engañar la heurística.

## 3. Los 15 criterios — estimación final

LOC de calidad = **3.838 líneas no vacías**, incluidos tests; no confundir con
las 2.820 líneas normalizadas usadas exclusivamente para duplicación.

| # | Criterio | Umbral exigente | Medición local | Resultado estimado |
|---|---|---|---|---|
| 1 | Índice | ≥60 | **10** | No cumple |
| 2 | Duplicación | ≤15 % | **7,87 %** | Cumple |
| 3 | SEC | 0 líneas | 0 en producción | Cumple señal; clave operativa débil pendiente |
| 4 | SQL | 0 líneas | 0 confirmadas; 1 falso positivo de regex | Cumple tras revisión |
| 5 | Capas | ≥2 desde 150 LOC | 2 arquitectónicas; 0 directorios convencionales | Matcher oficial pendiente |
| 6 | HTTP en componente | 0 archivos | No hay componentes frontend | No aplica a backend |
| 7 | DBG | 0 líneas | 0; logger Nest operativo | Cumple |
| 8 | Any | ≤2 archivos con ≥3 usos | 0; señal definida para frontend TS | No aplica a backend; inventario 0 |
| 9 | BigC | ≤1 componente ≥150 líneas | 0 componentes frontend | No aplica a backend |
| 10 | Coh | 0 clases | **3** hallazgos de campos compartidos directos | No cumple heurística |
| 11 | Compl | ≤5/1000 LOC | **25**, 6,51/1000; máximo entero **19** | No cumple estimación |
| 12 | Tam | ≤10/1000 LOC | **35**, 9,12/1000; máximo entero **38** | Cumple |
| 13 | Acop | ≤2/1000 LOC | **5**, 1,30/1000; máximo entero **7** | Cumple |
| 14 | Cob | ≥80 % de líneas | **92,21 %**, 640/694 | Cumple |
| 15 | EP | ≥10 HTTP | **2** | No cumple |

SEC/DBG ignoran tests, SQL también los inspecciona. HTTP/Any/BigC son señales
de frontend según §4.4; se muestran para completar la tabla, no se inventan
componentes Nest para aplicarlas. El único candidato SQL es la línea 6 de
`src/common/hmac.ts`: `Buffer.from` y la interpolación del prefijo HMAC.
**No es SQL**, no se alteró ese código para evitar la regex. Nest no consulta
PostgreSQL ni construye consultas SQL.

### Cohesión y acoplamiento efectivamente medidos

Se inspeccionaron **24 clases**; todas tienen inventario de campos, métodos,
pares compartidos y tipos externos en `quality-after.json`. Constructor no
incluido en pares; propiedades de constructor inyectadas sí cuentan como campos.

| Clase elegible Coh | Campos | Métodos | Pares compartidos / total | Cohesión |
|---|---:|---:|---:|---:|
| IdentityVerifierService | 4 | 5 | 3/10 | **30,00 %** |
| RealtimeGateway | 8 | 12 | 31/66 | **46,97 %** |
| SocketRegistryService | 3 | 16 | 56/120 | **46,67 %** |
| ConnectionLimiterService | 4 | 4 | 4/6 | 66,67 % |

Las otras clases no alcanzan los mínimos de 4 métodos y 3 campos. La métrica
directa no sigue delegaciones entre métodos ni detecta responsabilidades de
dominio; hay posibles falsos positivos, especialmente registro/índices y
coordinación del gateway. No se ocultaron ni se rotaron métodos solo para
sacarlos de la medición. Una eventual separación debe responder a
responsabilidades reales y conservar permisos, no a la búsqueda de un índice.

CBO ≥8: **InternalEventDto 17, RealtimeGateway 16, IdentityVerifierService 14,
HmacGuard 14, EventsController 13**. El estimador lexical incluye decoradores,
interfaces y algunos identificadores de constantes con mayúscula inicial;
son hallazgos ruidosos conforme §4.6. El inventario permite revisarlos, sin
deducir arbitrariamente todos los tipos de framework para subir el índice.

Tam: **8 métodos largos + 24 funciones/callbacks largos + 3 firmas >4
parámetros = 35**. No se omitieron tests para mejorar el resultado.

### Índice calculado, no supuesto

Aplicando los pesos de la guía al inventario, con SQL revisado a cero y sin
penalizar capas aún no resueltas por el motor:

```text
peso = 3*8 (Coh) + 5*8 (Acop) + 8*5 (métodos largos)
     + 25*5 (complejidad) + 24*4 (funciones largas) + 3*4 (parámetros)
     + (222/2820)*150
     = 348,8085
índice = round(4000 / (348,8085 + 40)) = 10
```

No hay tope por duplicación (<15 %). Con el falso positivo SQL sin revisar,
o una penalización de capas, el índice redondeado sigue en 10. El índice
previo ~60 no estaba respaldado por medición de las métricas transversales;
además, con su supuesto 20,97 % la guía habría impuesto tope de 50, no 60.
Las funciones largas de tests/callbacks pesan en esta estimación. No se asegura
que el extractor privado docente detecte exactamente las mismas funciones.

## 4. Correcciones justificadas y seguridad

Se añadieron cinco regresiones y se ejecutaron sobre el código anterior:
**las cinco fallaron**, reproduciendo los problemas; después pasan.

1. **Vigencia JWT durante la sesión:** el handshake validaba expiración pero
   dejaba el socket activo indefinidamente. Ahora se desconecta al vencer el
   JWT, limpiando el timer al desconectar; JWT con vigencias largas respetan
   el límite de setTimeout de Node. Sin cambiar firma HS256 ni claves Flask.
2. **Saturación anti-replay:** se expulsaba la entrada más antigua aunque su
   nonce siguiera vigente. Ahora se conserva y se rechaza nueva inserción con
   **503**, sin permitir replay. Se liberan entradas por TTL como antes.
3. **Ventana anti-replay:** un TTL configurable demasiado corto permitía volver
   a usar una firma aún válida. Ahora nonce TTL debe **superar dos veces** la
   edad máxima aceptada del timestamp; defaults 900/300 siguen siendo válidos.
4. **Membresía concurrente:** invalidar la caché no invalidaba una petición HTTP
   pendiente que podía reintroducir el equipo anterior. Se rastrean y abortan
   consultas pendientes del usuario y se rechaza el resultado invalidado,
   también con fail-open configurado. No se reingresa a una room con ese resultado.
5. **Errores sanitizados:** enteros de configuración inválidos ya no incluyen
   su valor en la excepción; también se rechazan enteros no seguros.
6. **Logs:** `main.ts` usa `Logger` NestJS en lugar del bypass anterior con
   stdout. El error de arranque no imprime la excepción/configuración. Una
   clave existente <32 bytes genera advertencia sin valor ni rotación.
7. **Dependencias:** `@nestjs/platform-express` 11.1.28 → **11.2.9** (Multer
   **2.5.0**, peers compatibles con Nest 11); CLI 11.0.10 → **11.0.24** y
   actualizaciones transitivas compatibles de lockfile. No se usó
   `npm audit fix --force` ni se pasó a otra versión mayor.

Verificado además: JWT solo desde auth/bearer, no query; algoritmo permitido
HS256, claims y expiración; HMAC sobre bytes exactos con comparación de tiempo
constante; timestamp, nonce y event_id; validación cerrada de eventos; rooms
asignadas por identidad de Flask, no por IDs enviados por el navegador;
privacidad entre equipos y usuarios; eliminación de room antes de actividad
de salida/expulsión; límites por usuario/IP/mensajes y validación de Origin.
Los headers proxy se consideran confiables solo detrás del nginx que los
normaliza; el puerto Docker continúa limitado a loopback.

`npm audit`: antes **20** entradas (incluidas **2 altas de producción**);
después **11 solo de desarrollo** (8 bajas, 3 moderadas). Producción:
**0 vulnerabilidades reportadas**. Evidencia: [dependency-audit.json](dependency-audit.json).
No equivale a demostrar ausencia de vulnerabilidades desconocidas. Este servicio
no expone uploads multipart, pero sí incluía la dependencia Multer vulnerable.

## 5. Pruebas finales y despliegue

| Comprobación | Resultado |
|---|---|
| Jest unitarios | **11 suites / 60 passed** |
| Jest E2E | **2 suites / 18 passed** |
| Jest completo con coverage tras actualizar dependencias | **13 suites / 78 passed** |
| Líneas de producción, incluido main.ts | **92,21 % (640/694)** |
| Statements / funciones / ramas | 90,89 % / 96,39 % / 79,23 % |
| Type checking | `tsc --noEmit`, correcto; incluye src y test |
| Build local y Docker | Correctos; Docker instala con npm ci |
| Integración Flask/NestJS | **1 passed**: socket Nest real, JWT Flask y endpoint de identidad HMAC Flask real; SQLite temporal |
| Reconexión | Manual y automática tras pérdida de transporte; nueva sesión y room privada restaurada |
| Permisos | Destinatarios privados, equipos ajenos, salida/expulsión, Origin y JWT inválidos cubiertos en E2E |
| Auditor de métricas | **4 comprobaciones correctas** |
| Dependencias de producción | `npm audit --omit=dev`: **0** |

La cobertura se exige con un threshold global de líneas del **80 %**. Ahora
incluye `main.ts`, antes excluido; no se interpreta la variación frente a
91,88 % como una mejora bajo idéntico alcance. No se exige 80 % de ramas en
la guía: su 79,23 % se informa por separado, no se oculta.

Se reconstruyó y recreó **solo realtime**, esperando su healthcheck. Estado:
NestJS, Flask, PostgreSQL y frontend **healthy**. HTTP final:

- GET directo Nest `/health`: **200**.
- GET nginx `/realtime/health`: **200**.
- GET Flask `/api/health`: **200**.
- POST nginx `/internal/events`: **404** (no expuesto).
- POST directo Nest `/internal/events` sin HMAC: **401**.

No se generaron usuarios/eventos de prueba en PostgreSQL real. La integración
usa puertos efímeros, claves temporales y SQLite desechable. No se rotaron
credenciales ni se cambiaron archivos `.env` reales, Flask o React.

## 6. Archivos afectados

- `src/main.ts`
- `src/auth/identity-verifier.service.ts`
- `src/common/replay-store.service.ts`
- `src/config/realtime-config.ts`
- `src/realtime/realtime.gateway.ts`
- `test/unit/bootstrap.spec.ts` (nuevo)
- `test/unit/config.spec.ts`
- `test/unit/identity-verifier.spec.ts`
- `test/unit/replay-store.spec.ts`
- `test/e2e/app.e2e.spec.ts`
- `package.json`, `package-lock.json`, `jest.config.json`, `.env.example`
- Este informe, JSON antes/después y audit de dependencias; cobertura y dist
  regenerados por las herramientas.
- Auditor externo a la unidad: `scripts/audit_nestjs_quality.cjs` en la raíz
  del workspace. No se agrega su LOC al backend para diluir métricas.

## 7. Pendientes reales

1. **EP 2/10**, **Coh 3/0**, **Compl 25/19** e **índice estimado 10/60**.
   Deben revisarse con el motor docente y, donde corresponda, con extracciones
   por responsabilidades reales. No se hicieron refactors masivos ni cambios
   de nombres para esconder resultados.
2. Confirmar el matcher oficial de capas para módulos Nest por funcionalidad.
3. **11 avisos de dependencias de desarrollo**: deepmerge y cadena Jest/CLI,
   glob/minimatch. La reparación automática restante propone cambios mayores
   o downgrades incompatibles; se dejó pendiente, sin forzarlos.
4. Clave operativa existente débil/placeholder, ya advertida en Fase A. No se
   rotó: requiere autorización y coordinación con Flask/datos cifrados.
5. Presencia, cachés y replay viven en memoria de una instancia. No garantizan
   continuidad de replay entre reinicios ni coordinación entre réplicas; Redis
   o almacenamiento compartido exigirían otro cambio arquitectónico. Los
   timestamps limitan la ventana, pero no sustituyen esa persistencia.
6. Las actualizaciones de membresía son eventos firmados del backend de verdad;
   no hay versionado/orden global de eventos para resolver cualquier entrega
   fuera de orden entre sistemas. La regresión corregida cubre la carrera de
   consulta de identidad en curso, no demuestra resolver todo orden posible.
7. Repo independiente GitHub/main aún no creado por decisión del usuario: sin
   comparación remota ni aprobación oficial.

**Sin regresiones detectadas en las suites ejecutadas. No commits ni push.**

## Reproducción

Desde `realtime/`:

```text
npm ci
npm run test:unit
npm run test:e2e
npm run test:coverage
npm run lint
npm run build
npm audit --omit=dev
npm audit
```

Desde la raíz del workspace, sin ejecutar operaciones sobre datos reales:

```text
node scripts/audit_nestjs_quality.cjs --self-test
node scripts/audit_nestjs_quality.cjs realtime/docs/quality-after.json
python -m pytest scripts/tests/test_flask_nestjs_integration.py -q
```

El auditor usa TypeScript instalado en `realtime/node_modules` y publica solo
hashes, posiciones y conteos, no contenidos de `.env`. Para comparar antes y
después usar los JSON guardados; no sobrescribir `quality-before.json` con el
estado nuevo. Los avisos del registry pueden cambiar con nuevas publicaciones.
