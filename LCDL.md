# LCDL.md — Guía paso a paso

## 1) ¿Qué es LCDL?
LCDL es el lenguaje que ejecuta la VM del sistema LCD. Sirve para mostrar texto en filas del display, manejar variables, hacer lógica, bucles, llamadas y acceso a archivos virtuales.

## 2) Estructura básica
```lcdl
LET C:NUM = 0
@LOOP
SHOW 0,'HOLA'
SHOW 1,'C='+C
ADD C,1
SLEEP 100
GOTO @LOOP
```

## 3) Funciones/comandos LCDL (paso a paso)

### Variables
- `LET NOMBRE:TIPO = VALOR` crea variable tipada.
- Tipos: `NUM`, `STR`, `BOOL`, `STATE`, `ARR`.
- `SET NOMBRE = EXPR` actualiza variable.

### Pantalla
- `PRINT EXPR` imprime en cursor.
- `SHOW FILA, EXPR` escribe en fila (0..11).

### Flujo
- Etiquetas: `@LOOP`, `@END`.
- `GOTO @LABEL` salto.
- `IF COND THEN @LABEL` salto condicional.
- Condiciones: `== != > < >= <=`.

### Pausa/control
- `SLEEP ms` pausa ejecución.
- `STOP`, `PAUSE`, `RESET`, `STATUS`.

### Subrutinas
- `CALL @SUB` entra a subrutina.
- `RET` vuelve.

### Bucles FOR
- `FOR I = 1 TO 10 STEP 1`
- `NEXT I`

### Archivos virtuales
- `WRITE('k','valor')` guarda en `/var/k`.
- `READ('k')` lee `/var/k`.

### Utilidades
- `TIME` imprime timestamp.
- Matemática: `ADD`, `SUB`, `MUL`, `DIV`, `MOD`, y funciones `SIN(x)`, `COS(x)`, `TAN(x)`, `ABS(x)`, `MIN(a,b...)`, `MAX(a,b...)`.
- Arrays: `APUSH`, `ALEN`, `AGET`.
- Punteros simples: `REF P,VAR`, `DEREF P,OUT`, `SETPTR P,EXPR`.
- Flujo extendido: `WHILE cond DO @LABEL`.

## 4) Cómo programar bien
1. Define variables con `LET` al inicio.
2. Usa `SHOW` para depuración visual.
3. Mantén un loop principal con `@LOOP` + `SLEEP`.
4. Separa lógica con etiquetas/subrutinas (`CALL/RET`).

## 5) Ejemplo contador mínimo
```lcdl
LET C:NUM = 0
LET KEY:STR = ''
@L
SHOW 0,'COUNTER'
SHOW 1,'1:+  -:-  0:RST'
SHOW 2,'C='+C
IF KEY=='1' THEN @P
IF KEY=='-' THEN @M
IF KEY=='0' THEN @Z
SLEEP 20
GOTO @L
@P
ADD C,1
SET KEY=''
GOTO @L
@M
SUB C,1
SET KEY=''
GOTO @L
@Z
SET C=0
SET KEY=''
GOTO @L
```
