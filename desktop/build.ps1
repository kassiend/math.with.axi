# Build Axi.exe.
#
#   powershell -ExecutionPolicy Bypass -File desktop\build.ps1
#
# Uses the C# compiler that ships with the .NET Framework, present on every Windows 10/11 install.
# No SDK, no NuGet, no npm package: the output is one portable .exe that needs nothing beside it.
# It does need Node at run time — it is a front end for `node core/worker/index.mjs`, not a copy
# of it.
$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src = Join-Path $here 'Axi.cs'
$dist = Join-Path $here 'dist'
$exe = Join-Path $dist 'Axi.exe'

$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) {
    $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
}
if (-not (Test-Path $csc)) {
    throw "No C# compiler found. Expected csc.exe under $env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\."
}

if (-not (Test-Path $dist)) { New-Item -ItemType Directory -Path $dist | Out-Null }

# /target:winexe so launching it does not also open a console window behind the form.
& $csc `
    /nologo `
    /target:winexe `
    /optimize+ `
    /out:$exe `
    /reference:System.dll `
    /reference:System.Drawing.dll `
    /reference:System.Windows.Forms.dll `
    $src

if ($LASTEXITCODE -ne 0) { throw "csc failed with exit code $LASTEXITCODE" }

$size = [math]::Round((Get-Item $exe).Length / 1KB, 1)
Write-Output "built $exe ($size KB)"
