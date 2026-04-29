# Contador LCDL directo en terminal (sin crear archivos en VFS)

Ejecuta estas líneas una por una en la terminal LCD (Enter por línea):

LET C:NUM = 0
LET KEY:STR = ''
@L
SHOW 0,'COUNTER'
SHOW 1,'1:+  -:-  0:RST'
SHOW 2,'C='+C
IF KEY=='1' THEN @I
IF KEY=='-' THEN @D
IF KEY=='0' THEN @R
SLEEP 30
GOTO @L
@I
ADD C,1
SET KEY=''
GOTO @L
@D
SUB C,1
SET KEY=''
GOTO @L
@R
SET C=0
SET KEY=''
GOTO @L

Uso:
- Presiona `1` para sumar.
- Presiona `-` para restar.
- Presiona `0` para reiniciar.
