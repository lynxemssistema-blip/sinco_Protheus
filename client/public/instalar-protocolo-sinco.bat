@echo off
chcp 65001 >nul
echo ========================================================
echo   Instalador de Protocolo de Rede Seguro - SINCO ERP
echo ========================================================
echo.

set "DEST_DIR=%LOCALAPPDATA%\SINCO"
if not exist "%DEST_DIR%" mkdir "%DEST_DIR%"

echo [1/2] Copiando script de seguranca para %DEST_DIR%...
copy /y "%~dp0open-sinco-folder.cmd" "%DEST_DIR%\open-sinco-folder.cmd" >nul

echo [2/2] Registrando protocolo sinco-folder:// no Windows...
reg add "HKCU\Software\Classes\sinco-folder" /ve /t REG_SZ /d "URL:SINCO Folder Protocol" /f >nul
reg add "HKCU\Software\Classes\sinco-folder" /v "URL Protocol" /t REG_SZ /d "" /f >nul
reg add "HKCU\Software\Classes\sinco-folder\shell\open\command" /ve /t REG_SZ /d "cmd.exe /c \"\"%LOCALAPPDATA%\SINCO\open-sinco-folder.cmd\" \"%%1\"\"" /f >nul

if %errorlevel% equ 0 (
    echo.
    echo [SUCESSO] Protocolo SINCO registrado com sucesso!
    echo Agora os links de abertura de pastas no Windows Explorer
    echo funcionarao de forma segura e protegida contra injecoes.
) else (
    echo.
    echo [AVISO] Houve um problema ao registrar. Tente executar como Administrador.
)
echo.
pause
