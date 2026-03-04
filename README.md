# MetalFisa PCP - Sistema de Gestão de Produção

Sistema integrado para controle de produção, gestão de estoque local e integração de desenhos técnicos para a rede local da MetalFisa.

## 🚀 Como Iniciar

### 1. Servidor Backend
O servidor gerencia a API e o banco de dados.
- **Arquivo:** `INICIAR_SISTEMA.bat`
- **Acesso:** `http://192.168.1.169:3001`

### 2. Frontend (Build)
O sistema já está compilado na pasta `client/dist`. O servidor backend serve esses arquivos automaticamente.

### 3. Agente SolidEdge (Engenharia)
Necessário apenas para extrair metadados de desenhos técnicos abertos no SolidEdge.
- **Guia:** [GUIA_INSTALACAO_AGENT.md](file:///c:/Users/adm/Desktop/MetalFisa%20Anty/GUIA_INSTALACAO_AGENT.md)

## 📚 Documentação e Guias Rápidos

- [GUIA_RAPIDO_DISPONIBILIZACAO.md](file:///c:/Users/adm/Desktop/MetalFisa%20Anty/GUIA_RAPIDO_DISPONIBILIZACAO.md) - Passo a passo para colocar no ar.
- [GUIA_ACESSO_USUARIOS.md](file:///c:/Users/adm/Desktop/MetalFisa%20Anty/GUIA_ACESSO_USUARIOS.md) - Instruções para os colaboradores.
- [VERSAO_PRODUCAO.md](file:///c:/Users/adm/Desktop/MetalFisa%20Anty/VERSAO_PRODUCAO.md) - Notas da versão e histórico de alterações.

## 🛠️ Tecnologias
- **Frontend:** React + Vite + Tailwind CSS
- **Backend:** Node.js + Express
- **Banco de Dados:** MySQL (Local/App) + PostgreSQL (Protheus)

---
**MetalFisa Anty - 2026**
