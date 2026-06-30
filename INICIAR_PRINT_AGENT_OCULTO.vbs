Set objShell = CreateObject("WScript.Shell")
Set objFSO = CreateObject("Scripting.FileSystemObject")

' Pega a pasta exata onde este arquivo .vbs está rodando
strPath = Wscript.ScriptFullName
Set objFile = objFSO.GetFile(strPath)
strFolder = objFSO.GetParentFolderName(objFile)

' Define o diretório atual de execução
objShell.CurrentDirectory = strFolder

' Executa o comando node rodando o print-agent.js
' O parâmetro 0 significa "Hide Window" (Janela oculta)
' O parâmetro False significa "Não espere o comando terminar para liberar o script"
objShell.Run "cmd /c node print-agent.js", 0, False
