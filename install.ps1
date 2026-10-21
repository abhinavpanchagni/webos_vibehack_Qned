<#
.SYNOPSIS
    Windows installer for webos-vibehack — an Apple TV-style home screen for LG TVs.

.DESCRIPTION
    PowerShell equivalent of install.sh. Syncs your TV apps, converts the launcher icon,
    packages the webOS app (.ipk), installs it on the TV, and launches it.

    Prerequisites (one-time, before running this):
      1. Create a free LG developer account at https://webostv.developer.lge.com
      2. Install the "Developer Mode" app on the TV from the LG Content Store.
         Sign in, enable "Dev Mode Status" (TV restarts), re-open, enable "Key Server".
         Note the IP address and Passphrase shown in the app.
      3. Run one-time device pairing (replace <TV_IP> and <PASSPHRASE>):

         $env:TV_HOST = "192.168.1.50"

         npx -y -p @webos-tools/cli ares-setup-device `
             -a lgtv -i "{'host':'$env:TV_HOST','port':'9922','username':'prisoner'}"

         npx -y -p @webos-tools/cli ares-novacom --device lgtv --getkey
             # When prompted, type the Passphrase shown in the Developer Mode app.

         npx -y -p @webos-tools/cli ares-setup-device `
             -m lgtv -i "{'privatekey':'lgtv_webos','passphrase':'<PASSPHRASE>'}"

.PARAMETER TvHost
    IP address of the LG TV (e.g. 192.168.1.50).
    If omitted, $env:TV_HOST is used.

.PARAMETER Device
    The ares device profile name (default: lgtv).

.PARAMETER DryRun
    Validate prerequisites and show what would happen without touching the TV.

.PARAMETER Validate
    Alias for -DryRun.

.EXAMPLE
    .\install.ps1 -TvHost 192.168.1.50

.EXAMPLE
    .\install.ps1 -DryRun
    Validate environment without connecting to the TV.

.EXAMPLE
    $env:TV_HOST = "192.168.1.50"; .\install.ps1
#>

[CmdletBinding(SupportsShouldProcess)]
param(
    [string] $TvHost,
    [string] $Device   = "lgtv",
    [switch] $DryRun,
    [switch] $Validate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---- helpers -----------------------------------------------------------------------------------

function Write-Header([string]$text) {
    Write-Host ""
    Write-Host "==> $text" -ForegroundColor Cyan
}

function Write-Ok([string]$text) {
    Write-Host "  [OK]   $text" -ForegroundColor Green
}

function Write-Warn([string]$text) {
    Write-Host "  [WARN] $text" -ForegroundColor Yellow
}

function Write-Fail([string]$text) {
    Write-Host "  [FAIL] $text" -ForegroundColor Red
}

function Write-Info([string]$text) {
    Write-Host "  $text" -ForegroundColor Gray
}

function Exit-Error([string]$msg) {
    Write-Host ""
    Write-Fail $msg
    Write-Host ""
    exit 1
}

# ---- working directory -------------------------------------------------------------------------

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptRoot
Write-Info "Working directory: $ScriptRoot"

# ---- dry-run flag ------------------------------------------------------------------------------

$IsDryRun = $DryRun -or $Validate
if ($IsDryRun) {
    Write-Host ""
    Write-Host "*** DRY-RUN / VALIDATION MODE — no TV connection, no files installed ***" `
        -ForegroundColor Magenta
}

# ---- TV host resolution ------------------------------------------------------------------------

if (-not $TvHost) { $TvHost = $env:TV_HOST }

if ($IsDryRun -and -not $TvHost) {
    $TvHost = "0.0.0.0"
    Write-Warn "No -TvHost or `$env:TV_HOST set; using placeholder 0.0.0.0 for dry-run."
}

if (-not $TvHost) {
    Exit-Error ("TV IP not specified. Use -TvHost <IP> or set `$env:TV_HOST.`n" +
        "  Example:  .\install.ps1 -TvHost 192.168.1.50")
}

$APP_ID = "com.gathin.tvhome"

# ---- validate parameters -----------------------------------------------------------------------

Write-Header "Validating parameters"

if ($TvHost -ne "0.0.0.0" -and $TvHost -notmatch '^\d{1,3}(\.\d{1,3}){3}$') {
    Write-Warn "TvHost '$TvHost' doesn't look like an IPv4 address — continuing anyway."
} else {
    Write-Ok "TV host    : $TvHost"
}
Write-Ok "Device     : $Device"
Write-Ok "App ID     : $APP_ID"

# ---- Python detection --------------------------------------------------------------------------

Write-Header "Detecting Python 3"

function Find-Python {
    # Priority: local venv > 'python' in PATH > 'python3' in PATH
    $venvPy = Join-Path $ScriptRoot "venv\Scripts\python.exe"
    if (Test-Path $venvPy) { return $venvPy }

    foreach ($cmd in @("python", "python3")) {
        try {
            $ver = & $cmd --version 2>&1
            if ($LASTEXITCODE -eq 0 -and "$ver" -match "Python 3") { return $cmd }
        } catch { }
    }
    return $null
}

$PY = Find-Python
if (-not $PY) {
    Exit-Error ("Python 3 not found.`n" +
        "  Install from https://www.python.org or the Microsoft Store.")
}

$pyVer = & $PY --version 2>&1
Write-Ok "Python     : $PY  ($pyVer)"

# ---- Python dependency checks ------------------------------------------------------------------

Write-Header "Checking Python packages"

function Test-PyModule([string]$module) {
    $out = & $PY -c "import $module; print('ok')" 2>&1
    return ("$out" -match "ok")
}

$missingModules = [System.Collections.Generic.List[string]]::new()

if (Test-PyModule "websockets") {
    $wsVer = (& $PY -c "import websockets; print(websockets.__version__)" 2>&1) -join ""
    Write-Ok "websockets : $wsVer"
} else {
    $missingModules.Add("websockets")
    Write-Fail "websockets : NOT FOUND"
}

if (Test-PyModule "PIL") {
    $pilVer = (& $PY -c "from PIL import __version__; print(__version__)" 2>&1) -join ""
    Write-Ok "Pillow     : $pilVer  (icon conversion)"
} else {
    $missingModules.Add("Pillow")
    Write-Fail "Pillow     : NOT FOUND"
}

if ($missingModules.Count -gt 0) {
    $pkgs = $missingModules -join " "
    Exit-Error ("Missing Python packages: $pkgs`n" +
        "  Install with:  $PY -m pip install $pkgs")
}

# ---- Node.js / npx check -----------------------------------------------------------------------

Write-Header "Checking Node.js and npx"

try {
    $nodeVer = (node --version 2>&1) -join ""
    if ($LASTEXITCODE -ne 0) { throw "node exited $LASTEXITCODE" }
    Write-Ok "Node.js    : $nodeVer"
} catch {
    Exit-Error ("Node.js not found.`n" +
        "  Install from https://nodejs.org (required for LG's ares-* tools via npx).")
}

try {
    $npxVer = (npx --version 2>&1) -join ""
    if ($LASTEXITCODE -ne 0) { throw "npx exited $LASTEXITCODE" }
    Write-Ok "npx        : $npxVer"
} catch {
    Exit-Error "npx not found — it ships with Node.js, check your installation."
}

# ---- required project files check --------------------------------------------------------------

Write-Header "Checking required project files"

$requiredFiles = @(
    "assets\icon.jpg",
    "app\appinfo.json",
    "app\index.html",
    "app\app.js",
    "app\style.css",
    "app\config.js",
    "sync-apps.py",
    "lgtv.py"
)

$missingFiles = [System.Collections.Generic.List[string]]::new()
foreach ($f in $requiredFiles) {
    $path = Join-Path $ScriptRoot $f
    if (Test-Path $path) {
        Write-Ok $f
    } else {
        Write-Fail "$f  (MISSING)"
        $missingFiles.Add($f)
    }
}

if ($missingFiles.Count -gt 0) {
    Exit-Error ("Missing project files: $($missingFiles -join ', ')`n" +
        "  Make sure you cloned the complete repository.")
}

# ---- ares CLI wrapper --------------------------------------------------------------------------

function Invoke-Ares {
    <#
    .SYNOPSIS
        Run an ares-* sub-command, using PATH if available, otherwise fetching via npx.
    #>
    param(
        [Parameter(Mandatory)][string]   $Sub,
        [string[]]                       $AresArgs = @()
    )

    $cmd = "ares-$Sub"

    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
        Write-Info "(using $cmd from PATH)"
        & $cmd @AresArgs
    } else {
        Write-Info "(fetching @webos-tools/cli via npx ...)"
        npx -y -p @webos-tools/cli $cmd @AresArgs
    }

    if ($LASTEXITCODE -ne 0) {
        Exit-Error "'$cmd' failed with exit code $LASTEXITCODE."
    }
}

# ---- dry-run: stop here ------------------------------------------------------------------------

if ($IsDryRun) {
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host "  Dry-run complete — all checks passed!  " -ForegroundColor Magenta
    Write-Host "==========================================" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "To install for real:" -ForegroundColor White
    Write-Host "  1. Complete device pairing (see .DESCRIPTION in this script)." -ForegroundColor Gray
    Write-Host "  2. Run:  .\install.ps1 -TvHost <TV_IP>" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

# ========================= LIVE INSTALL (TV required beyond this point) =========================

# ---- sync apps from TV -------------------------------------------------------------------------

Write-Header "Syncing apps from TV (sync-apps.py)"
Write-Info "Connecting to $TvHost ..."

& $PY (Join-Path $ScriptRoot "sync-apps.py") $TvHost
if ($LASTEXITCODE -ne 0) {
    Exit-Error ("sync-apps.py failed.  Common causes:`n" +
        "  - TV not reachable — check IP address and Wi-Fi`n" +
        "  - Developer Mode / Key Server not enabled on the TV`n" +
        "  - Not paired yet — run ares-setup-device + ares-novacom first`n" +
        "  Use -DryRun to validate prerequisites without connecting to the TV.")
}

# ---- convert launcher icon (replaces macOS 'sips') ---------------------------------------------

Write-Header "Converting launcher icon"

$iconSrc   = Join-Path $ScriptRoot "assets\icon.jpg"
$iconSmall = Join-Path $ScriptRoot "app\icon.png"
$iconLarge = Join-Path $ScriptRoot "app\largeIcon.png"

if ((Test-Path $iconSmall) -and (Test-Path $iconLarge)) {
    Write-Ok "Icons already exist — skipping conversion."
    Write-Info "(Delete app\icon.png and app\largeIcon.png to force re-conversion.)"
} else {
    Write-Info "Converting icon.jpg -> icon.png (80x80) and largeIcon.png (130x130) ..."

    # Inline Python using Pillow. LANCZOS gives best quality for downscaling.
    $convertScript = @"
from PIL import Image
import sys, pathlib

src  = pathlib.Path(sys.argv[1])
dsts = [(80, pathlib.Path(sys.argv[2])), (130, pathlib.Path(sys.argv[3]))]

img = Image.open(src).convert('RGBA')
for size, dest in dsts:
    out = img.resize((size, size), Image.LANCZOS)
    out.save(dest, 'PNG')
    print(f'    Saved {dest} ({size}x{size})')
"@

    & $PY -c $convertScript $iconSrc $iconSmall $iconLarge
    if ($LASTEXITCODE -ne 0) {
        Exit-Error "Icon conversion failed."
    }
    Write-Ok "Icons converted."
}

# ---- package the app ---------------------------------------------------------------------------

Write-Header "Packaging app (ares-package)"

$buildDir = Join-Path $ScriptRoot "build"
if (Test-Path $buildDir) {
    Remove-Item -Recurse -Force $buildDir
    Write-Info "Removed old build\ directory."
}
New-Item -ItemType Directory -Path $buildDir | Out-Null

$appDir = Join-Path $ScriptRoot "app"
Invoke-Ares "package" -AresArgs @($appDir, "-o", $buildDir)

# Locate the produced .ipk
$ipk = Get-ChildItem -Path $buildDir -Filter "${APP_ID}_*.ipk" -File |
       Sort-Object LastWriteTime -Descending |
       Select-Object -First 1

if (-not $ipk) {
    Exit-Error "No ${APP_ID}_*.ipk found in build\ after packaging."
}
Write-Ok "Package: $($ipk.Name)"

# ---- close running instance on TV --------------------------------------------------------------

Write-Header "Checking if launcher is currently running on TV"
$runningApps = ""
if (Get-Command "ares-launch" -ErrorAction SilentlyContinue) {
    $runningApps = & ares-launch -d $Device -r
} else {
    $runningApps = npx -y -p @webos-tools/cli ares-launch -d $Device -r
}

if ($runningApps -match [regex]::Escape($APP_ID)) {
    Write-Info "Launcher is currently running - closing it for a fresh reload..."
    Invoke-Ares "launch" -AresArgs @("-d", $Device, "-c", $APP_ID)
} else {
    Write-Info "Launcher is not currently running."
}

# ---- install on TV -----------------------------------------------------------------------------

Write-Header "Installing on TV (ares-install)"
Write-Info "Target device: $Device"
Invoke-Ares "install" -AresArgs @("-d", $Device, $ipk.FullName)

# ---- launch the launcher -----------------------------------------------------------------------

Write-Header "Launching launcher (ares-launch)"
Invoke-Ares "launch" -AresArgs @("-d", $Device, $APP_ID)

# ---- done --------------------------------------------------------------------------------------

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host "  Installed and launched successfully!" -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Tip: With the launcher open, hold a number key on the" -ForegroundColor White
Write-Host "     Magic Remote to assign a one-press shortcut." -ForegroundColor White
Write-Host ""
Write-Host "Re-run .\install.ps1 whenever you install or remove" -ForegroundColor Gray
Write-Host "apps on the TV to keep the app grid up to date." -ForegroundColor Gray
Write-Host ""
