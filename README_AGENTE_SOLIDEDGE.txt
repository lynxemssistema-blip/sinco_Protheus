# GUIA DE INSTALAÇÃO - SOLIDEGE AGENT (PYTHON VERSION)

O "SolidEdge Agent" é um pequeno programa que deve rodar no computador de QUEM DESENHA (Engenharia/Projetos).
Ele serve para conectar o SolidEdge ao sistema web MetalFisa.

## 📋 Pré-requisitos
1. **SolidEdge** instalado e aberto.
2. **Python 3.8+** instalado (https://www.python.org/downloads/).
   - ⚠️ MARQUE A OPÇÃO "Add Python to PATH" DURANTE A INSTALAÇÃO.

## 🚀 Como instalar/rodar
1. Abra a pasta `solidedge-agent`.
2. Execute `INSTALAR_AGENT.bat` (apenas na primeira vez, para instalar dependências).
3. Execute `INICIAR_AGENT.bat` (diariamente).

## ⚠️ Solução de Problemas
- **Erro "Python não encontrado"**: Reinstale o Python e não esqueça de marcar "Add to PATH".
- **Erro de Porta**: Se a porta 8080 estiver ocupada, edite o arquivo `agent.py` e mude a variável `PORT`.

## ✅ Como testar
Abra no navegador:
http://localhost:8080/api/solidedge/status

Se aparecer JSON com "status: online", está funcionando!
