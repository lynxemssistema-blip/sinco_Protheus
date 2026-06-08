# Plano de Integração: Agente Hermes Nativamente no Node.js

## 1. Visão Geral
Este plano descreve a integração do **Agente Hermes** (acionado pelo Gemini) diretamente no ecossistema atual do aplicativo MetalFisa (Node.js/React/MySQL), descartando a necessidade de serviços paralelos (como um script Python isolado no `systemd`).

## 2. Objetivos Principais
1. **Memória no MySQL:** Todo o histórico de conversa e configurações de memória do Hermes serão gravados e lidos a partir do nosso banco MySQL, permitindo um estado contínuo.
2. **Painel Super Admin:** A página de `/configuracoes` ganhará uma nova aba blindada usando a lógica de permissões existente do app, garantindo que só os super administradores acessem o controle do agente.
3. **Parametrização Dinâmica:** Uma interface dedicada permitirá alterar o "System Prompt" (as instruções principais), "Temperature" (criatividade), e definir o comportamento do Hermes em tempo real.
4. **Capacidades Analíticas (Banco de Dados):** O Hermes não será apenas conversacional; ele será configurado (via *Function Calling* ou ferramentas de banco) para consultar o PostgreSQL e MySQL quando necessário para basear suas respostas em dados reais da MetalFisa.

## 3. Arquitetura Proposta
### Backend (Node.js)
- Instalar SDK oficial do Google Gen AI: `@google/genai` (ou `@google/generative-ai`).
- **Tabelas MySQL a criar:**
  - `hermes_config`: Para armazenar os parâmetros do agente (System Prompt, model="gemini-1.5-pro", temperature, etc.).
  - `hermes_chat_memory`: Para armazenar a "memória" (histórico de mensagens entre Admin e Hermes).
- **Controlador (`server/controllers/hermesController.js`):**
  - Rota `GET /api/hermes/config` e `POST /api/hermes/config`.
  - Rota `POST /api/hermes/chat` que enviará mensagens ao Gemini passando o System Prompt dinâmico, recuperando as últimas mensagens da memória do MySQL para enviar o contexto ao modelo.
- **Integração de Ferramentas (Tools):**
  - Configurar funções descritivas no SDK do Gemini que mapeiem para funções SQL existentes no backend, caso o Hermes precise buscar informações da fábrica.

### Frontend (React)
- **`client/src/pages/Configuracoes.jsx`:**
  - Adicionar a aba "Hermes Agente".
  - Proteger a aba via verificação do contexto do usuário atual (usando a mesma lógica das rotas restritas).
- **Componente `HermesAgentPanel.jsx`:**
  - Lado Esquerdo: Formulário com os parâmetros (System Prompt grande, Temperatura, Top P, Modelo).
  - Lado Direito: Interface de chat com balões de mensagem imitando um mensageiro para o admin testar e validar o funcionamento das diretrizes.

## 4. Fases de Implementação

- [ ] **Fase 1: Preparação do Banco de Dados**
  - Criar script/migração para as tabelas `hermes_config` e `hermes_chat_memory` no MySQL.
  - Inserir um registro padrão de configuração para o Hermes inicializar.

- [ ] **Fase 2: Backend - Configurações e Persistência**
  - Criar rotas protegidas no Node.js (`/api/hermes/config` e `/api/hermes/chat`).
  - Implementar o middleware de autenticação da MetalFisa nestas rotas.
  - Integrar o `@google/generative-ai` SDK com inicialização baseada nos parâmetros do banco.

- [ ] **Fase 3: Frontend - UI de Controle e Chat**
  - Atualizar `Configuracoes.jsx` adicionando a nova aba e componente.
  - Construir a interface para alteração de configuração e a janela de chat.

- [ ] **Fase 4: Injeção de "Skills" (Ferramentas de DB)**
  - Adicionar a lógica que permite ao modelo rodar ou solicitar "ferramentas" para investigar dados nas tabelas do sistema, permitindo que a "Missão" ditada no frontend se conecte com o banco real.

## 5. Próximos Passos Imediatos
1. Auditar o banco MySQL e criar a sintaxe da tabela para armazenar as configs e o chat.
2. Analisar a tela de `/configuracoes` para mapear onde encaixar o componente.
