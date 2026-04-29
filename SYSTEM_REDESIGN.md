# LCD Terminal v1 — Rediseño para uso diario en entorno embebido

## 1) Diagnóstico del sistema actual (crítico)

### 1.1 Arquitectura
- **Monolito único en `Index.html`**: render, parser, runtime, FS e input están acoplados en una sola unidad. Esto impide pruebas, aislamiento de fallos y evolución controlada.
- **Sin fronteras de módulo**: no existe un contrato entre subsistemas (UI, VM, FS), por lo que un cambio en una capa rompe otras fácilmente.
- **Recursión de `RUN` sin control**: `RUN` llama `exec` anidado sin límites de profundidad ni cuota de instrucciones; riesgo de bloqueo/agotamiento.

### 1.2 Lenguaje
- **Sintaxis parcialmente implícita**: mezcla de comandos ad-hoc (`IF ... THEN`, etiquetas con `:`) sin gramática formal.
- **Tipos ambiguos**: coerciones implícitas (`n(v)`) hacen que una variable cambie de número a string sin aviso.
- **Errores silenciosos**: muchos comandos fallan sin código de error estructurado (p.ej., `VAR` mal formado no reporta causa).
- **Control de flujo frágil**: `IF` inserta líneas en tiempo de ejecución (`splice`) en vez de saltos explícitos; no es predecible ni trazable.

### 1.3 Ejecución
- **No determinista por temporización global**: `speed` altera `wait`, afectando semántica temporal sin separación entre scheduler y VM.
- **Sin watchdog ni budget**: bucles infinitos/alta frecuencia pueden congelar la UI y consumir CPU.
- **Estados de ejecución poco formales**: `running/stop` son flags globales sin máquina de estados robusta (`IDLE`, `RUN`, `PAUSE`, `FAULT`).

### 1.4 Sistema de archivos
- **FS plano sobre `localStorage`**: usa map string→contenido, sin metadatos (tamaño, checksum, mtime, permisos lógicos).
- **No hay transacciones**: escrituras parciales o corrupción JSON pueden dejar estado inconsistente.
- **Directorio simulado** con `/.dir`, sin validación estructural.

### 1.5 UI 7 segmentos
- **Capacidad visual desaprovechada**: se intenta imprimir texto largo generalista en una interfaz no apta para narrativa extensa.
- **Sin modelo de vistas**: mezcla consola libre con datos operativos; falta codificación de estado compacta y estable.

---

## 2) Arquitectura propuesta en capas

## 2.1 Mapa de capas
1. **HAL/Display Driver**
   - Responsabilidad: mapa de segmentos, doble buffer, dirty rectangles.
   - API: `setCell(x,y,symbol)`, `flush()`.
2. **UI Service (Terminal LCD)**
   - Responsabilidad: vistas de estado, widgets de línea, paginación y cursor.
   - No interpreta scripts.
3. **Runtime Core (VM)**
   - Responsabilidad: ciclo fetch-decode-execute, budget por tick, máquina de estados, trazas.
4. **Language Frontend**
   - Lexer + parser + validador estático.
   - Genera bytecode/IR compacto.
5. **FS Service**
   - Árbol lógico, journal simple, API atómica.
6. **Device API / Syscalls**
   - `READ`, `WRITE`, `TIME`, `PIN`, `NET?` (si aplica), con sandbox.

## 2.2 Contratos mínimos
- `RuntimeCore.run(programId, entryLabel)`
- `RuntimeCore.step(maxOps)`
- `RuntimeCore.signal(STOP|PAUSE|RESET)`
- `FS.read(path) -> {ok,data,err}`
- `FS.writeAtomic(path,data)`
- `UI.renderFrame(model)`

## 2.3 Máquina de estados de ejecución
- Estados: `IDLE`, `LOADING`, `RUNNING`, `PAUSED`, `STOPPING`, `FAULT`.
- Transiciones válidas estrictas (ejemplo):
  - `RUNNING -> FAULT` solo por error no recuperable.
  - `PAUSED -> RUNNING` por comando `CONT`.
  - `RUNNING -> STOPPING -> IDLE` por `STOP`.

---

## 3) Lenguaje serio: LCDL (LCD Language) v1

## 3.1 Principios
- Sintaxis **lineal y explícita**, amigable para terminal.
- Tipado simple, sin coerción silenciosa.
- Errores con código y línea.

## 3.2 Tipos
- `NUM` (entero 32-bit)
- `STR` (ASCII en mayúsculas, longitud máx configurable, ej. 32)
- `BOOL` (0/1)
- `STATE` (enum corto para paneles: `OK/WARN/ERR/BOOT/...`)

## 3.3 Gramática (resumen)
- Declaración: `LET <id>:<type> = <expr>`
- Asignación: `SET <id> = <expr>`
- Flujo:
  - `IF <expr> THEN <label>`
  - `GOTO <label>`
  - `CALL <label>` / `RET`
  - `FOR <id> = <a> TO <b> STEP <s>` / `NEXT <id>`
- IO:
  - `PRINT <expr>`
  - `SHOW <slot>, <expr>` (slot de vista)
- Sistema:
  - `SLEEP <ms>`
  - `STOP`, `PAUSE`, `RESET`
- Etiquetas: `@NAME`

## 3.4 Reglas consistentes
- Identificadores `[A-Z_][A-Z0-9_]*`
- Strings: comillas simples `'TEMP HIGH'`
- Comparaciones tipadas: error si `NUM` vs `STR` sin cast explícito.
- Operaciones aritméticas solo en `NUM`.

## 3.5 Modelo de errores
- Formato: `E<clase><código> L<línea> <detalle>`
  - `EP100`: parse error
  - `ET200`: type mismatch
  - `ER300`: runtime overflow/div0
  - `EF400`: filesystem
- Política:
  - Error fatal: VM a `FAULT`.
  - Error recuperable: set de bandera `LAST_ERR`, continúa si script lo decide.

---

## 4) Modelo de visualización 7 segmentos

## 4.1 Qué sí mostrar
- Números, códigos cortos, estados compactos, barras discretas.
- Tiempos (`HHMMSS`), contadores, IDs, alarmas (`ALM1`, `OVHT`).
- Telemetría resumida: `TMP=072`, `RPM=1450`.

## 4.2 Qué no mostrar
- Párrafos, logs largos, JSON/XML, nombres extensos.
- Mensajes ambiguos con caracteres no representables.

## 4.3 Convenciones de codificación
- **Formato fijo por fila** (evita jitter):
  - Fila 0: modo/sistema
  - Filas 1–8: métricas
  - Fila 9: alarmas
  - Fila 10: comando actual
  - Fila 11: estado VM (`RUN/PAUS/FLT`)
- **Diccionario de tokens** cortos:
  - `OK`, `WRN`, `ERR`, `BOOT`, `SYNC`, `DISC`
- **Escalas compactas**:
  - `PWR 0..100` mostrado como `PWR=087`

## 4.4 Ejemplos de representación
- Temperatura alta: `TMP=089 WRN`
- Error sensor 2: `S2 ERR C14`
- Script activo: `JOB=CAL1 PC=034`

---

## 5) Casos de uso reales

## 5.1 Monitoreo operativo
- Lectura cíclica de variables de proceso, con umbrales y alarmas latcheadas.
- Vista principal de 6–10 métricas críticas en formato fijo.

## 5.2 Debug rápido en campo
- Comandos cortos: `PEEK`, `POKE`, `TRACE ON`, `STEP`.
- Congelar ejecución (`PAUSE`) y observar `PC`, variables y último error.

## 5.3 Ejecución programada de scripts
- Script `boot.lcdl` para inicialización.
- Scripts por tarea (`diag.lcdl`, `cal.lcdl`, `watch.lcdl`) con retorno de código.

## 5.4 Panel de estado
- Heartbeat, uptime, estado IO, consumo estimado, cola de eventos.

---

## 6) Sistema de archivos mejorado

## 6.1 Estructura
- `/sys` (sistema, solo lectura lógica)
- `/app` (scripts de usuario)
- `/var` (estado persistente, logs compactos)
- `/tmp` (volátil)

## 6.2 Metadatos mínimos por archivo
- `size`, `mtime`, `crc16`, `type` (`SRC`, `BIN`, `CFG`), `flags`.

## 6.3 Operaciones seguras
- `WRITE_ATOMIC(path,data)` = write temp + fsync lógico + rename.
- Journal circular de operaciones (`N` entradas).
- Recuperación en boot: replay o rollback del último commit incompleto.

## 6.4 Cuotas y límites
- Tamaño máximo por archivo.
- Máximo de archivos por directorio.
- Prevención de fragmentación lógica (compacción por lotes).

---

## 7) Mejoras técnicas propuestas

## 7.1 Renderizado
- Doble buffer de celdas y máscara dirty por fila/columna.
- Tabla precomputada símbolo→bitmask de segmentos (7 bits).
- Flush incremental por frame budget (p.ej. 2 ms/tick).

## 7.2 Input
- Cola de eventos desacoplada (`kbd`, `cmd`, `sys`).
- Debounce y rate-limit de teclas repetidas.
- Modo comando modal: edición local + commit por `ENTER`.

## 7.3 Control de ejecución
- Scheduler cooperativo con `maxOpsPerTick`.
- Watchdog de script (`maxMs`, `maxOps`, `maxDepth`).
- Comandos de control:
  - `START <script>`
  - `STOP [grace|force]`
  - `RESET VM|APP|ALL`
  - `STATUS` (estado + métricas runtime)

---

## 8) Ejemplos reales

## 8.1 Script de monitoreo
```txt
LET TMP:NUM = 0
LET FAN:STATE = OK
@LOOP
SET TMP = READ('TEMP1')
IF TMP > 80 THEN @HOT
SHOW 1, 'TMP=' + TMP
SHOW 2, 'FAN=OK'
SLEEP 200
GOTO @LOOP
@HOT
SHOW 9, 'ALM TMP HIGH'
SET FAN = WARN
CALL @ACT_FAN
SLEEP 200
GOTO @LOOP
@ACT_FAN
WRITE('FAN1',1)
RET
```

## 8.2 Script de diagnóstico rápido
```txt
LET C:NUM = 0
@TEST
SET C = C + 1
SHOW 10, 'PING ' + C
IF C % 10 == 0 THEN @BEEP
SLEEP 100
GOTO @TEST
@BEEP
BEEP 1200,40
RET
```

## 8.3 Flujo diario completo
1. Boot carga `/sys/boot.lcdb`.
2. Runtime valida firma/checksum de `/app/watch.lcdb`.
3. VM entra en `RUNNING`, ejecuta 500 ops/s con budget fijo.
4. UI muestra panel estable (métricas + alarmas).
5. Operador envía `PAUSE`, revisa `STATUS`, corrige variable, `CONT`.
6. Evento de error genera `ER3xx`, log en `/var/err.log`, vuelve a `RUNNING` o `FAULT` según severidad.

---

## 9) Plan de implementación incremental (accionable)

## Fase 1 — Estabilización (1-2 semanas)
- Extraer módulos: `display.js`, `vm.js`, `fs.js`, `lang.js`.
- Introducir máquina de estados VM.
- Añadir budget por tick + `STOP/PAUSE/RESET` robustos.

## Fase 2 — Lenguaje v1 (2-3 semanas)
- Definir lexer/parser formal.
- Chequeo estático básico (tipos, labels, stack depth).
- Errores con códigos normalizados.

## Fase 3 — FS confiable (1-2 semanas)
- API atómica y journal.
- Metadatos y utilidades de integridad (`fsck` ligero).

## Fase 4 — UX operativa 7-seg (1-2 semanas)
- Vistas fijas por fila.
- Diccionario de estados y convenciones de codificación.
- Comandos de campo (`STATUS`, `TRACE`, `STEP`).

## Métricas de aceptación
- MTBF > 72h en lazo continuo.
- Latencia de comando < 100 ms p95.
- Corrupción de FS recuperable al 100% en pruebas de corte.
- CPU estable bajo budget definido.
