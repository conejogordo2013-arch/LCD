# SYSTEM.md — Cómo funciona todo el sistema

## 1) Componentes
- `DisplayDriver`: dibuja matriz 32x12 con segmentos.
- `VFS`: sistema de archivos virtual en `localStorage`.
- `Parser`: tokeniza, procesa `@DEFINE/@INCLUDE` y etiquetas.
- `VM`: ejecuta LCDL instrucción por instrucción.
- `Terminal`: entrada por teclado + comandos (`HELP`, `LS`, `RUN`, etc.).

## 2) Flujo de ejecución
1. Carga `index.html`.
2. `app.js` crea Display, VFS, Parser, VM, Terminal.
3. Terminal arranca en `BOOT` y puede ejecutar scripts.
4. Bucle de runtime: procesa input + `vm.step()` periódicamente.

## 3) Sistema de archivos (VFS)
- Rutas permitidas: `/sys`, `/app`, `/var`, `/tmp`.
- Métodos:
  - `read(path)`
  - `writeAtomic(path,data,type,flags)`
  - `list(prefix)`
  - `del(path)`
- Usa journal para recuperación simple de escrituras incompletas.

## 4) Estados VM
- `IDLE`, `LOADING`, `RUNNING`, `PAUSED`, `STOPPING`, `FAULT`.
- Watchdog evita loops infinitos (`maxOpsTotal`).

## 5) Comandos terminal útiles
- `HELP`, `LS`, `CAT <path>`, `START/RUN <path>`
- `WRITE <path> <contenido>`, `DEL <path>`
- `STATUS`, `STOP`, `PAUSE`, `CONT`, `RESET`, `TRACE`, `STEP`

## 6) Archivos de aprendizaje y prueba
- `learning/01_basico.lcdl`
- `learning/02_control_flujo.lcdl`
- `learning/03_archivos_y_arrays.lcdl`
- `run_learning_tests.js` (valida scripts de aprendizaje)
