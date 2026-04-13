# sync.ps1 — Sincronizar cambios desde shanklish-erp-main hacia capsula-erp
# Uso: .\sync.ps1 -Source "C:\ruta\a\shanklish-erp-main"
# Uso con preview: .\sync.ps1 -Source "C:\ruta\a\shanklish-erp-main" -DryRun
#
# El script copia SOLO los archivos de plataforma compartida.
# Los archivos de instancia (secretos, migraciones, seeds, deploy) NO se tocan.
# Ver SYNC_FROM_SHANKLISH.md para la referencia completa.

param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [switch]$DryRun,

    [switch]$SkipSchemaCheck,

    [switch]$NoConfirm
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

function Write-Header([string]$Text) {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
}

function Write-Step([string]$Text) {
    Write-Host "▶ $Text" -ForegroundColor Yellow
}

function Write-Ok([string]$Text) {
    Write-Host "  ✓ $Text" -ForegroundColor Green
}

function Write-Skip([string]$Text) {
    Write-Host "  ⊘ $Text" -ForegroundColor DarkGray
}

function Write-Warn([string]$Text) {
    Write-Host "  ⚠ $Text" -ForegroundColor Magenta
}

function Write-Err([string]$Text) {
    Write-Host "  ✗ $Text" -ForegroundColor Red
}

function Copy-Item-Safe([string]$SrcPath, [string]$DstPath, [string]$Label) {
    if (-not (Test-Path $SrcPath)) {
        Write-Skip "No encontrado en origen: $Label"
        return
    }
    if ($DryRun) {
        Write-Ok "[DRY-RUN] Copiaría: $Label"
        return
    }
    $dir = Split-Path $DstPath -Parent
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    Copy-Item -Path $SrcPath -Destination $DstPath -Force
    Write-Ok "Copiado: $Label"
}

function Copy-Dir-Safe([string]$SrcDir, [string]$DstDir, [string]$Label) {
    if (-not (Test-Path $SrcDir)) {
        Write-Skip "No encontrado en origen: $Label"
        return
    }
    if ($DryRun) {
        Write-Ok "[DRY-RUN] Copiaría directorio: $Label"
        return
    }
    if (-not (Test-Path $DstDir)) {
        New-Item -ItemType Directory -Path $DstDir -Force | Out-Null
    }
    Copy-Item -Path "$SrcDir\*" -Destination $DstDir -Recurse -Force
    Write-Ok "Copiado directorio: $Label"
}

# ---------------------------------------------------------------------------
# Validaciones iniciales
# ---------------------------------------------------------------------------

Write-Header "sync.ps1 — Shanklish → Cápsula"

$Dest = $PSScriptRoot   # El script vive en la raíz de capsula-erp

# Normalizar rutas
$Source = $Source.TrimEnd('\').TrimEnd('/')
$Dest   = $Dest.TrimEnd('\').TrimEnd('/')

Write-Step "Validando rutas..."

if (-not (Test-Path $Source)) {
    Write-Err "El directorio origen no existe: $Source"
    exit 1
}

if (-not (Test-Path "$Source\package.json")) {
    Write-Err "El origen no parece un proyecto Next.js válido (no se encontró package.json): $Source"
    exit 1
}

if (-not (Test-Path "$Dest\SYNC_FROM_SHANKLISH.md")) {
    Write-Err "El destino no parece capsula-erp (no se encontró SYNC_FROM_SHANKLISH.md): $Dest"
    exit 1
}

Write-Ok "Origen : $Source"
Write-Ok "Destino: $Dest"

if ($DryRun) {
    Write-Warn "Modo DRY-RUN activo — no se realizará ningún cambio real."
}

# ---------------------------------------------------------------------------
# Confirmación
# ---------------------------------------------------------------------------

if (-not $NoConfirm -and -not $DryRun) {
    Write-Host ""
    Write-Host "  ¿Continuar con la sincronización? [s/N] " -ForegroundColor White -NoNewline
    $resp = Read-Host
    if ($resp -notmatch '^[sS]$') {
        Write-Host "  Cancelado." -ForegroundColor DarkGray
        exit 0
    }
}

# ---------------------------------------------------------------------------
# 1. Archivos raíz de configuración del proyecto
# ---------------------------------------------------------------------------

Write-Header "1/6 — Archivos de configuración del proyecto"

$rootFiles = @(
    @{ File = "next.config.js";     Label = "next.config.js" },
    @{ File = "tailwind.config.ts"; Label = "tailwind.config.ts" },
    @{ File = "tsconfig.json";      Label = "tsconfig.json" },
    @{ File = "postcss.config.js";  Label = "postcss.config.js" },
    @{ File = "middleware.ts";      Label = "middleware.ts" }
)

foreach ($item in $rootFiles) {
    Copy-Item-Safe "$Source\$($item.File)" "$Dest\$($item.File)" $item.Label
}

# ---------------------------------------------------------------------------
# 2. package.json — copiar dependencias pero preservar "name"
# ---------------------------------------------------------------------------

Write-Header "2/6 — package.json (preservando name = capsula-erp)"

$srcPkg  = "$Source\package.json"
$dstPkg  = "$Dest\package.json"
$lockSrc = "$Source\package-lock.json"
$lockDst = "$Dest\package-lock.json"

if (Test-Path $srcPkg) {
    if ($DryRun) {
        Write-Ok "[DRY-RUN] Actualizaría package.json (preservando name)"
    } else {
        $srcJson = Get-Content $srcPkg -Raw | ConvertFrom-Json
        $dstJson = Get-Content $dstPkg -Raw | ConvertFrom-Json

        # Preservar el nombre de Cápsula
        $srcJson.name = $dstJson.name

        $srcJson | ConvertTo-Json -Depth 10 | Set-Content $dstPkg -Encoding UTF8
        Write-Ok "package.json actualizado (name preservado: $($dstJson.name))"
    }
}

Copy-Item-Safe $lockSrc $lockDst "package-lock.json"

# ---------------------------------------------------------------------------
# 3. Código fuente — src/
# ---------------------------------------------------------------------------

Write-Header "3/6 — Código fuente src/"

$srcDirs = @(
    @{ Src = "src\app\actions";     Dst = "src\app\actions";     Label = "src/app/actions/ (Server Actions)" },
    @{ Src = "src\app\api";         Dst = "src\app\api";         Label = "src/app/api/ (API Routes)" },
    @{ Src = "src\app\dashboard";   Dst = "src\app\dashboard";   Label = "src/app/dashboard/ (páginas)" },
    @{ Src = "src\app\kitchen";     Dst = "src\app\kitchen";     Label = "src/app/kitchen/" },
    @{ Src = "src\app\login";       Dst = "src\app\login";       Label = "src/app/login/" },
    @{ Src = "src\components";      Dst = "src\components";      Label = "src/components/" },
    @{ Src = "src\lib";             Dst = "src\lib";             Label = "src/lib/" },
    @{ Src = "src\server";          Dst = "src\server";          Label = "src/server/" },
    @{ Src = "src\types";           Dst = "src\types";           Label = "src/types/" }
)

$srcRootFiles = @(
    @{ File = "src\app\layout.tsx";    Label = "src/app/layout.tsx" },
    @{ File = "src\app\globals.css";   Label = "src/app/globals.css" },
    @{ File = "src\app\page.tsx";      Label = "src/app/page.tsx" }
)

foreach ($item in $srcDirs) {
    Copy-Dir-Safe "$Source\$($item.Src)" "$Dest\$($item.Dst)" $item.Label
}

foreach ($item in $srcRootFiles) {
    Copy-Item-Safe "$Source\$($item.File)" "$Dest\$($item.File)" $item.Label
}

# ---------------------------------------------------------------------------
# 4. Prisma schema
# ---------------------------------------------------------------------------

Write-Header "4/6 — Prisma schema"

if (-not $SkipSchemaCheck) {
    # Comparar schemas para advertir de cambios
    $srcSchema = "$Source\prisma\schema.prisma"
    $dstSchema = "$Dest\prisma\schema.prisma"

    if ((Test-Path $srcSchema) -and (Test-Path $dstSchema)) {
        $srcHash = (Get-FileHash $srcSchema -Algorithm MD5).Hash
        $dstHash = (Get-FileHash $dstSchema -Algorithm MD5).Hash

        if ($srcHash -ne $dstHash) {
            Write-Warn "schema.prisma DIFIERE del actual."
            Write-Warn "Después de sincronizar ejecuta: npx prisma migrate dev --name '<descripcion>'"
            Write-Warn "NUNCA uses 'prisma db push' en producción."
            if (-not $NoConfirm -and -not $DryRun) {
                Write-Host "  ¿Sincronizar schema.prisma de todas formas? [s/N] " -ForegroundColor Magenta -NoNewline
                $resp = Read-Host
                if ($resp -notmatch '^[sS]$') {
                    Write-Skip "schema.prisma omitido por el usuario."
                    goto SkipSchema
                }
            }
        } else {
            Write-Ok "schema.prisma sin cambios — no es necesario migrar."
        }
    }
}

Copy-Item-Safe "$Source\prisma\schema.prisma"        "$Dest\prisma\schema.prisma"        "prisma/schema.prisma"
Copy-Item-Safe "$Source\prisma\schema.prisma-append" "$Dest\prisma\schema.prisma-append" "prisma/schema.prisma-append"

# Etiqueta de salto para omitir schema (workaround PowerShell sin goto real)
:SkipSchema

# ---------------------------------------------------------------------------
# 5. Assets públicos
# ---------------------------------------------------------------------------

Write-Header "5/6 — Assets públicos (public/)"

if (Test-Path "$Source\public") {
    Copy-Dir-Safe "$Source\public" "$Dest\public" "public/"
} else {
    Write-Skip "No existe public/ en el origen."
}

# ---------------------------------------------------------------------------
# 6. Resumen y pasos siguientes
# ---------------------------------------------------------------------------

Write-Header "6/6 — Resumen"

if ($DryRun) {
    Write-Warn "DRY-RUN completado. Ningún archivo fue modificado."
} else {
    Write-Ok "Sincronización completada."
}

Write-Host ""
Write-Host "  Pasos siguientes recomendados:" -ForegroundColor White
Write-Host "  1. Revisar: git diff -- prisma/schema.prisma" -ForegroundColor DarkGray
Write-Host "  2. Si schema cambió: npx prisma migrate dev --name '<descripcion>'" -ForegroundColor DarkGray
Write-Host "  3. Si package.json cambió: npm install" -ForegroundColor DarkGray
Write-Host "  4. Probar localmente: npm run dev" -ForegroundColor DarkGray
Write-Host "  5. Commit y push a la rama de Cápsula" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Archivos que NUNCA se sincronizan (ver SYNC_FROM_SHANKLISH.md):" -ForegroundColor White
Write-Host "  • .env* (secretos de Cápsula)" -ForegroundColor DarkGray
Write-Host "  • prisma/migrations/ (historial de BD de Cápsula)" -ForegroundColor DarkGray
Write-Host "  • prisma/seed*.ts (datos de Shanklish)" -ForegroundColor DarkGray
Write-Host "  • scripts/ (scripts one-off de Shanklish)" -ForegroundColor DarkGray
Write-Host "  • render.yaml / deploy-aws.ps1 / Dockerfile (deploy de Cápsula)" -ForegroundColor DarkGray
Write-Host ""
