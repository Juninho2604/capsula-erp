ENTORNO: Windows 10/11 con PowerShell. Si usás comandos Unix (diff, grep, head, ls),
traducilos a equivalentes de PowerShell (Compare-Object, Select-String, 
Select-Object -First, Get-ChildItem) O usá Git Bash si está disponible 
(git --exec-path devuelve la ruta y ahí dentro tenés bash.exe). 
Para diffs de archivos grandes, preferí usar `git diff --no-index <archivo1> <archivo2>` 
que funciona igual en Windows.

AUTORIZACIÓN Y ALCANCE

Tenés permisos para leer ambos repos, ejecutar git, diff, grep, find. NO modificás 
ningún archivo. NO hacés commits. NO tocás ramas. Este prompt es 100% de solo lectura.

Objetivo: generar un reporte comparativo entre dos repos hermanos para decidir 
cuál es el código base del producto final "Cápsula" y qué features hay que portar 
del otro.

CONTEXTO

Estás parado en un directorio padre que contiene dos subcarpetas:
  - capsula-erp/       (rama main — el que va a ser el producto final)
  - shanklish-erp-main/ (rama master — el que tiene trabajo reciente que puede faltar en el otro)

Ambos son Next.js 14 + Prisma + PostgreSQL + TypeScript, compartían origen hace 
meses y divergieron.

DIAGNÓSTICO REQUERIDO

Generá un archivo `./DIVERGENCE_REPORT.md` con las siguientes secciones. Todos los 
comandos se ejecutan desde el directorio padre que contiene ambos repos.

## 1. Commits exclusivos de cada repo

Ejecutá en cada repo:
  git log --oneline origin/master 2>/dev/null || git log --oneline origin/main
  git log --oneline --since="6 months ago" --pretty=format:"%h %ad %s" --date=short

Reportá:
- Últimos 30 commits de capsula-erp (con fecha)
- Últimos 30 commits de shanklish-erp-main (con fecha)
- Cuál tuvo actividad más reciente

## 2. Último commit común (divergence point)

Como no podés hacer merge entre repos directamente, usá este método:
  cd shanklish-erp-main
  git remote add capsula ../capsula-erp
  git fetch capsula
  git merge-base master capsula/main  # o capsula/master según cómo se llame la rama

Reportá el SHA del punto común, su fecha, y su mensaje. Cuántos commits divergieron 
de cada lado desde ese punto.

NOTA: después de fetch, NO hagas merge, checkout ni nada que modifique estado. 
El remote queda agregado solo para comparar.

## 3. Diff estructural de src/

Ejecutá:
  diff -rq capsula-erp/src shanklish-erp-main/src | head -200

Clasificá las diferencias en:
- Archivos que SOLO existen en capsula-erp (→ estos son posibles features que 
  capsula tiene y shanklish no)
- Archivos que SOLO existen en shanklish-erp-main (→ estos son posibles features 
  que shanklish tiene y capsula no)
- Archivos que existen en ambos pero son distintos (→ necesitan comparación 
  detallada)

Para cada archivo "solo en X", si es un archivo chico (<200 líneas), mostrá su 
primera línea descriptiva (comentario inicial o nombre de la función exportada) 
para entender qué hace.

## 4. Schema Prisma

Diff completo entre:
  capsula-erp/prisma/schema.prisma
  shanklish-erp-main/prisma/schema.prisma

Identificá:
- Modelos que están en uno pero no en el otro
- Modelos comunes con campos distintos
- Enums diferentes
- Índices / uniques diferentes

Esto es crítico: si los schemas divergieron, la migración de datos de AWS RDS 
a Contabo va a necesitar transformaciones.

## 5. Migraciones de Prisma

Listá las migraciones aplicadas en cada repo:
  ls -la capsula-erp/prisma/migrations/
  ls -la shanklish-erp-main/prisma/migrations/

Reportá migraciones que existen en uno pero no en el otro. Si shanklish tiene 
migraciones más recientes, son cambios de schema que hay que traer a Cápsula.

## 6. Módulos de código detectados

Listá las carpetas principales bajo src/app/ en cada repo:
  ls capsula-erp/src/app/
  ls shanklish-erp-main/src/app/

  ls capsula-erp/src/components/
  ls shanklish-erp-main/src/components/

  ls capsula-erp/src/lib/
  ls shanklish-erp-main/src/lib/

Destacá módulos presentes en uno y ausentes en el otro.

## 7. Dependencias

Diff de package.json:
  diff capsula-erp/package.json shanklish-erp-main/package.json

Reportá dependencias (y versiones) que difieren.

## 8. Branding y UI

Buscá en ambos repos referencias a:
  grep -rn "CAPSULA\|Cápsula\|CÁPSULA" capsula-erp/src
  grep -rn "CAPSULA\|Cápsula\|CÁPSULA" shanklish-erp-main/src
  grep -rn "Shanklish\|shanklish" capsula-erp/src
  grep -rn "Shanklish\|shanklish" shanklish-erp-main/src

Contá hits de cada uno para saber cuán presente está cada marca en el código de cada repo.

## 9. Sistema de permisos (específico a esta conversación)

Verificá en cada repo si existen estos archivos (del sistema de 4 capas que 
venimos trabajando):
  src/lib/permissions/catalog.ts
  src/lib/permissions/role-defaults.ts
  src/lib/permissions/has-permission.ts
  src/lib/permissions/api-guard.ts
  src/lib/permissions/action-guard.ts
  src/lib/permissions/use-permission.ts

Reportá en cuál repo están y cuál está más completo.

## 10. CI/CD

Inspeccioná:
  capsula-erp/.github/workflows/
  shanklish-erp-main/.github/workflows/

Si existe al menos un archivo de workflow en alguno, pegá su contenido 
completo en el reporte (para que revisemos qué hace).

## 11. Archivos basura sueltos en la raíz

Listá todos los archivos de la raíz de cada repo que NO son configuración 
estándar (excluir: package.json, tsconfig.json, next.config.js, tailwind.config.ts, 
postcss.config.js, .gitignore, .env.example, README.md, Dockerfile, .dockerignore, 
vitest.config.ts).

En ambos repos vi archivos raros como: test-db.js, test-tcp.js, list-items.ts, 
cloud-sql-proxy.x64.exe, menu_delivery_temp.pdf, arqueo-descargado.xlsx, 
COSTO.xlsx, cambios-erp-sesion.patch, deploy-aws.ps1, ts_errors.log, etc. 
Listá todos los que haya en cada repo.

## 12. Conclusión y recomendación

Al final del reporte, escribí tu conclusión:
- ¿Qué repo tiene código más avanzado a nivel de features? (cuantificá si podés)
- ¿Qué features de un repo hay que portar al otro?
- ¿El schema de Prisma es compatible entre ambos o hay breaking changes?
- ¿Cuál es tu recomendación sobre qué repo usar como base para "Cápsula producto final"?

ENTREGABLE

Al terminar, mostrame:
  cat ./DIVERGENCE_REPORT.md

No hagas commits. No modifiques nada. Solo generá el reporte.