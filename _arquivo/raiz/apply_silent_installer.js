const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'client/src/components/settings/LabelPrinterTab.jsx');
let content = fs.readFileSync(file, 'utf8');

const newMethod = `        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const downloadSilentInstaller = () => {
        const origin = window.location.origin;
        const agentUrl = \`\${origin}/api/labels/download-agent\`;

        const batContent = \`@echo off
echo ========================================================
echo Instalando o MetalFisa Print Agent (Silencioso)...
echo ========================================================
echo.
set "AGENT_DIR=%APPDATA%\\\\MetalFisaAgent"
if not exist "%AGENT_DIR%" mkdir "%AGENT_DIR%"
cd /d "%AGENT_DIR%"

echo Baixando o agente do servidor...
powershell -Command "Invoke-WebRequest -Uri '\${agentUrl}' -OutFile 'MetalFisa-Print-Agent.exe'"

echo Criando script de execucao invisivel...
echo Set objShell = CreateObject("WScript.Shell") > run_hidden.vbs
echo objShell.Run "cmd /c MetalFisa-Print-Agent.exe", 0, False >> run_hidden.vbs

echo Configurando para iniciar com o Windows...
set "STARTUP_FOLDER=%APPDATA%\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\\\\MetalFisaPrintAgent.lnk"
powershell -Command "$wshell = New-Object -ComObject WScript.Shell; $s = $wshell.CreateShortcut('%SHORTCUT_PATH%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\\"%AGENT_DIR%\\\\run_hidden.vbs\\"'; $s.WorkingDirectory = '%AGENT_DIR%'; $s.WindowStyle = 1; $s.Save()"

echo Iniciando o agente agora...
wscript run_hidden.vbs

echo.
echo ========================================================
echo Instalacao concluida! O Print Agent ja esta rodando
echo de forma oculta e vai iniciar sempre com o Windows.
echo Voce ja pode fechar esta janela (fechara em 5s).
echo ========================================================
timeout /t 5 >nul
\`;

        const blob = new Blob([batContent], { type: 'application/bat' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Instalar-Print-Agent-Silencioso.bat';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };`;
content = content.replace(/        document\.body\.removeChild\(a\);\r?\n        URL\.revokeObjectURL\(url\);\r?\n    };/, newMethod);

const newInstructions = `                                    <li>Clique no botão ao lado para baixar o instalador automático.</li>
                                    <li>Execute o arquivo <strong>Instalar-Print-Agent-Silencioso.bat</strong> que foi baixado.</li>
                                    <li>Uma tela preta vai aparecer rapidamente, baixar o agente e configurar tudo sozinho.</li>
                                    <li>Pronto! Ele já estará rodando em silêncio e iniciará junto com o Windows.</li>
                                    <li>Recarregue esta página para verificar se ficou online!</li>`;
content = content.replace(/                                    <li>Baixe o arquivo <strong>MetalFisa-Print-Agent\.ems<\/strong><\/li>[\s\S]*?<li>Recarregue esta página para verificar o status<\/li>/, newInstructions);

const newButtons = `                    {/* Botão de download */}
                    <div className="flex-shrink-0 flex flex-col gap-2">
                        <button
                            onClick={downloadSilentInstaller}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors shadow-sm"
                        >
                            <Download className="h-4 w-4" />
                            Instalação Automática (Silencioso)
                        </button>
                        <a
                            href="/api/labels/download-agent"
                            download="MetalFisa-Print-Agent.ems"
                            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-xs font-semibold transition-colors shadow-sm"
                        >
                            Baixar manual (.ems)
                        </a>
                        <p className="text-[10px] text-gray-400 mt-1 text-center">
                            Apenas para especialistas
                        </p>
                    </div>`;
content = content.replace(/                    \{\/\* Botão de download \*\/\}[\s\S]*?<\/div>/, newButtons);

fs.writeFileSync(file, content, 'utf8');
console.log('Script aplicado.');
