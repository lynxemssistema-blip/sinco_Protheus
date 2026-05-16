# Plano: Módulo de Gestão de Ativos e Calibração (SGQ) + Refatoração SGQ

## 1. Análise
O objetivo é consolidar todas as funcionalidades do Sistema de Gestão da Qualidade (SGQ) em um módulo padronizado (semelhante ao de Manutenção) dentro de `client/src/pages/sgq/` e implementar o PRD de Gestão de Ativos e Calibração.

## 2. Fases de Implementação

### FASE 1: Refatoração do Módulo SGQ (Arquitetura de Módulo)
- [ ] Mover `SGQDashboard.jsx` para `client/src/pages/sgq/Dashboard.jsx`.
- [ ] Mover `SGQDocuments.jsx` para `client/src/pages/sgq/Documentos.jsx`.
- [ ] Mover `SGQTraining.jsx` para `client/src/pages/sgq/Treinamentos.jsx`.
- [ ] Atualizar todas as importações e rotas em `client/src/App.jsx`.
- [ ] Padronizar o Sidebar (ou Menu de Navegação) para apontar para o novo módulo.

### FASE 2: Modelagem de Banco de Dados (Gestão de Ativos e Calibração)
- [ ] Tabela `sgq_assets`: (id, patrimonio, nome, modelo, serial, status, validade_calibracao, etc).
- [ ] Tabela `sgq_toolboxes`: (id, nome, colaborador_cpf).
- [ ] Tabela `sgq_asset_toolbox`: Relacionamento Many-to-Many entre ativos e caixas.
- [ ] Tabela `sgq_calibrations`: Histórico de calibração, romaneios, link de certificado (anexo) e requisição de NF.
- [ ] Triggers: Bloquear ordens de produção caso ativo esteja "pending_certificate".

### FASE 3: Backend (Node.js) API
- [ ] Rota `POST /api/sgq/assets/bulk`: Para funcionalidade de Clonagem (gerar N IDs).
- [ ] Rotas CRUD completas para Ativos, Caixas e Colaboradores.
- [ ] Rota para upload de anexos de certificados (`/uploads/certificados`).
- [ ] Integração com Faturamento para solicitação automática de Nota Fiscal (Remessa).

### FASE 4: Frontend (Interfaces React)
- [x] `GestaoAtivos.jsx`: Inventário inteligente, status e clonagem.
- [x] `CaixasFerramenta.jsx`: Atribuição de caixas a colaboradores e checklists de auto-inspeção.
- [x] `ControleCalibracao.jsx`: Alertas de vencimento, emissão de romaneio e upload de certificados.
- [x] `OffboardingRH.jsx`: Aba dedicada para conferência de itens no desligamento.

## 3. Critérios de Aceite
1. O SGQ é um módulo isolado e padronizado.
2. É possível cadastrar 10 itens clonados com 10 IDs distintos em 1 clique.
3. Certificados de calibração são de envio obrigatório para retornar itens ao status "Disponível".
4. RH tem trava para desligamento se o usuário possuir ferramentas não devolvidas.
5. Checklists quinzenais geram alertas automáticos.
