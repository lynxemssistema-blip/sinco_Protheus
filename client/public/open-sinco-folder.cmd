@echo off
setlocal
set "URL=%~1"
if "%URL%"=="" exit /b 0

powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$u = $env:URL; if ($u -match '^sinco-folder:(.+)$') { $p = [System.Uri]::UnescapeDataString($matches[1]).TrimEnd('/', [char]92); if (Test-Path -LiteralPath $p) { Start-Process explorer.exe -ArgumentList ('`\"{0}`\"' -f $p) } }"
exit /b 0
