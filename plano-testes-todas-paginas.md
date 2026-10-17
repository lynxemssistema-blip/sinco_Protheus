# Plano Mestre de Testes de Todas as Telas e Módulos - SINCO ERP & Corporativo

> **Documento de Auditoria e QA:** `plano-testes-todas-paginas.md`  
> **Ambiente Local Ativo:** Frontend `http://localhost:5173/` | Backend `http://localhost:3002/`  
> **Banco Exclusivo:** `u494795077_SINCO` (Hostinger MySQL 100% Autônomo)  
> **Tenant Padrão de Teste:** `IdEmpresa = 1` (Delta Parafusos)  
> **Data:** Outubro de 2026 | **Agentes Responsáveis:** `@[project-planner]` & `@[testing-patterns]`  
> **Auditoria de APIs:** **76 de 76 Endpoints Testados e Aprovados (100.0% Taxa de Sucesso)**

---

## 🎯 Objetivo do Plano

Cobrir **100% das telas, rotas e módulos integrados** do ecossistema SINCO, validando:
1. **Renderização Visual & Responsividade:** Ausência de tela branca (erros de runtime React), layout íntegro e carregamento correto de componentes, tabelas e modais.
2. **Conectividade de Dados:** Resposta 200 OK nas rotas do backend (`/api/*`) alimentadas exclusivamente pelo banco `u494795077_SINCO`.
3. **Isolamento de Tenant:** Garantia de que todos os filtros e registros respeitam `IdEmpresa = 1`.
4. **Interatividade e CRUD:** Testes de filtros, paginação, modais, exportação PDF/Excel e submissão de formulários.

---

## 📊 Matriz Resumo por Módulos

| # | Módulo | Qtd Telas | Rotas Principais | Status Backend (APIs) | Status Frontend (Visual) |
|---|---|:---:|---|:---:|:---:|
| 1 | **Público & Autenticação** | 4 | `/`, `/login`, `/ajuda`, `/novas-funcionalidades` | 🟢 100% Aprovado | 🟢 Ativo |
| 2 | **SINCO ERP Nativo & Cadastros** | 5 | `/erp/produtos`, `/cadastros/basicos`, `/erp/pedidos`, `/erp/clientes`, `/erp/producao` | 🟢 100% Aprovado | 🟢 Validado |
| 3 | **Comercial & Faturamento** | 7 | `/visao-geral`, `/vendas/itens-faturar`, `/comercial/dashboard-faturamento`, `/comercial/atrasos` | 🟢 100% Aprovado | 🟢 Em Navegação |
| 4 | **Engenharia de Produto & BOM** | 9 | `/produtos`, `/estrutura/:codigo`, `/bom-generator`, `/engenharia/pedidos` | 🟢 100% Aprovado | 🟢 Validado |
| 5 | **PCP Geral & Fábrica** | 16 | `/pcp/visao-fabrica`, `/visao-producao`, `/planejamento-gantt`, `/pcp/setores`, `/pcp/recursos` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 6 | **PCP Refinado & OPs Fracionadas** | 6 | `/pcp-refinado/capacidade`, `/pcp-refinado/ocupacao`, `/ind-pcp-release`, `/ind-apontamento` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 7 | **Logística, Expedição & Estoque** | 5 | `/romaneios`, `/fornecedor/romaneios`, `/recebimentos`, `/saldo-materiais` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 8 | **Suprimentos & Compras** | 6 | `/solicitacoes-compras`, `/pedidos-compras-pv`, `/suprimentos/requisicoes`, `/auditoria-pc` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 9 | **Financeiro** | 5 | `/financeiro/dashboard`, `/financeiro/fluxo-caixa`, `/financeiro/faturamento`, `/financeiro/balancete` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 10 | **Qualidade & SGQ** | 10 | `/sgq`, `/sgq/ativos`, `/sgq/caixas`, `/sgq/romaneios`, `/sgq/gestao-rncs`, `/sgq/calibracoes` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 11 | **Recursos Humanos (RH)** | 6 | `/rh/pasta-colaborador`, `/rh/portal-colaborador`, `/rh/vagas`, `/rh/curriculos`, `/rh/offboarding` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 12 | **Segurança & Benefícios (SST)** | 6 | `/sst`, `/sst/cesta-basica`, `/sst/cipa`, `/sst/cipa/urna`, `/sst/brigada` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 13 | **Portaria & Controle de Acesso** | 3 | `/portaria/guarita`, `/portaria/gerencial`, `/portaria/turnos` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 14 | **Salas de Reunião & TI** | 3 | `/salas`, `/salas/totem/:salaId`, `/suporte` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 15 | **Manutenção de Equipamentos** | 7 | `/manutencao/dashboard`, `/manutencao/maquinas`, `/manutencao/checklists`, `/manutencao/ordens` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| 16 | **Superadmin** | 2 | `/admin/super-empresas`, `/admin/proposta-comercial` | 🟢 100% Aprovado | ⏳ Pronto p/ Teste |
| **TOTAL** | **16 Módulos** | **100 Telas/Visões** | **Todo o Ecossistema SINCO** | **100.0% Aprovado (76/76 APIs)** | **Ambiente 100% Operacional** |

---

## 📋 Detalhamento dos Roteiros de Teste por Módulo

---

### 1. Módulo Público, Autenticação & Sistema

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/` | **Landing Page Oficial** | `/api/health` | Carrossel institucional, botões de ação e redirecionamento. | [x] 200 OK |
| `/login` | **Tela de Login & Autenticação** | `/api/auth/login` | Login com usuário master (`edson@lynxems.com.br`) e superadmin (`edson`). | [x] 200 OK |
| `/ajuda` | **Central de Ajuda (Help Center)** | `/api/company` | Visualização de tópicos, busca contextual e FAQ. | [x] 200 OK |
| `/novas-funcionalidades` | **Novas Funcionalidades ✨** | Frontend estático | Exibição de cards de releases e histórico de melhorias. | [x] 200 OK |
| `/avisos` | **Histórico de Avisos** | `/api/avisos/nao-concluidos/242` | Notificações push, avisos popup e comunicados por usuário/grupo. | [x] 200 OK |
| `/configuracoes` | **Configurações Gerais** | `/api/company`, `/api/users` | Perfil da empresa, usuários ativos e controle de permissões. | [x] 200 OK |

---

### 2. Módulo SINCO ERP Nativo & Cadastros Mestres

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/erp/produtos` | **Cadastro de Produtos** | `/api/erp/produtos` | Listar os 12 produtos industriais (PAs, PIs e MPs) sincronizados com `sb1010`. | [x] 200 OK (12 itens) |
| `/cadastros/basicos` | **Hub de Cadastros Básicos** | `/api/cadastros-basicos/*` | 4 abas: Prefixos/Famílias, Tipos de Produto, Unidades e Armazéns. | [x] 200 OK (Todas abas) |
| `/erp/pedidos` | **Pedidos de Venda ERP** | `/api/erp/pedidos` | Listar pedidos `000001`, `000002` e `000003` sincronizados com `sc5010`/`sc6010`. | [x] 200 OK (3 pedidos) |
| `/erp/clientes` | **Cadastro de Clientes** | `/api/erp/clientes` | Listar os 4 clientes industriais cadastrados em `sa1010`. | [x] 200 OK (4 clientes) |
| `/erp/producao` | **Ordens de Produção ERP** | `/api/producao/ordens` | Acompanhamento de OPs abertas, status e vínculo de pedidos. | [x] 200 OK |

---

### 3. Módulo Comercial & Faturamento

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/visao-geral` | **Visão Geral / Pedidos de Venda** | `/api/pedidos` | Tabela mestra de pedidos, filtros rápidos, detalhes do pedido e clientes. | [x] 200 OK |
| `/vendas/itens-faturar` | **Itens a Faturar** | `/api/pedidos` | Visualização de itens pendentes de expedição e cálculo de faturamento. | [x] 200 OK |
| `/comercial/dashboard-faturamento` | **Dashboard de Faturamento** | `/api/faturamento/dashboard` | Indicadores de faturamento, curvas de vendas e gráficos gerenciais. | [x] 200 OK (7 métricas) |
| `/comercial/faturamento` | **Controle de Faturamento** | `/api/faturamento/solicitacoes` | Acompanhar pipeline de solicitações de faturamento enviadas à expedição. | [x] 200 OK |

---

### 4. Módulo Engenharia de Produto & BOM

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/produtos` | **Catálogo de Produtos** | `/api/produtos` | Catálogo visual com busca, badges de tipo (PA/PI/MP) e atalhos rápidos. | [x] 200 OK |
| `/estrutura/:codigo` | **Estrutura Técnica do Produto (BOM)** | `/api/produtos/MT2-0001/estrutura` | Árvore BOM multinível de `MT2-0001` (Níveis 1 e 2) sincronizada com `sg1010`. | [x] 200 OK (41 nós) |
| `/bom-generator` | **Gerador e Simulador de BOM** | `/api/stock/estrutura-saldo/MT2-0001` | Simulação da estrutura de produto com saldos de estoque Protheus (`sb2010`). | [x] 200 OK (7 itens) |
| `/engenharia/pedidos` | **Painel de Itens da Engenharia** | `/api/engineering-bom/000001/01` | Ficha técnica e conferência de liberação de itens do pedido. | [x] 200 OK |

---

### 5. Módulo PCP Geral & Fábrica

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/pcp/visao-fabrica` | **Visão Global da Fábrica** | `/api/production` | Visão tática consolidada das linhas de fabricação e pedidos ativos. | [x] 200 OK |
| `/visao-producao` | **Visão de Produção & OPs** | `/api/production` | Cards de OPs com acompanhamento em tempo real. | [x] 200 OK |
| `/planejamento-gantt` | **Planejamento Gantt** | `/api/production` | Cronograma de operações, linhas de tempo e sequenciamento produtivo. | [x] 200 OK |
| `/producao-matrix` | **Matriz de Produção** | `/api/production/matrix?pedido=000001` | Visão matricial das peças versus operações das OPs. | [x] 200 OK |
| `/pcp/apontamento-vertical` | **Apontamento Vertical** | `/api/producao/vertical-pendencias?pedido=000001` | Grade de apontamento rápido sequencial por código de barras. | [x] 200 OK |
| `/pcp/apontamento-por-usuario-op` | **Apontamento por Operador** | `/api/production/analytics/apontamento-usuario` | Histórico analítico de apontamentos de horas e peças por colaborador. | [x] 200 OK |
| `/pcp/onde-usado` | **Onde é Usado (Explosão Reversa)** | `/api/stock/cadastro/onde-usado/MT2-0002` | Busca de matéria-prima listando todos os produtos pais onde ela é aplicada. | [x] 200 OK (3 produtos pais) |
| `/pcp/setores` | **Cadastro de Setores** | `/api/pcp-setores` | 4 setores industriais ativos (Corte, Usinagem, Trat. Térmico, Montagem). | [x] 200 OK (4 setores) |
| `/pcp/recursos` | **Cadastro de Recursos / Máquinas**| `/api/pcp-setores/catalogo-recursos` | 7 máquinas industriais cadastradas (`RO0001` a `RO0007`). | [x] 200 OK (7 recursos) |

---

### 6. Módulo PCP Refinado & Fracionamento

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/pcp-refinado/ocupacao` | **Taxa de Ocupação** | `/api/pcp-refinado/taxa-ocupacao` | Cálculo e gráficos de taxa de ocupação dos recursos. | [x] 200 OK |
| `/ind-pcp-release` | **Liberação PCP (Mescla de Lotes)** | `/api/ind_pcp/pending-ops` | Fracionamento de ordens em lotes parciais de entrega. | [x] 200 OK (5 OPs candidatas) |
| `/ind-factory-floor` | **Painel da Fábrica (Terminal Local)**| `/api/ind_pcp/dashboard` | Terminal touch para operador acompanhar lote atual. | [x] 200 OK |
| `/ind-apontamento` | **Apontamento Fracionado** | `/api/ind_pcp/active-lotes` | Registro de produção de lotes parciais. | [x] 200 OK |

---

### 7. Módulo Logística, Expedição & Estoque

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/romaneios` | **Expedição & Romaneios** | `/api/romaneios` | Abertura de romaneios, inserção de volumes e impressão. | [x] 200 OK |
| `/saldo-materiais` | **Estoque & Saldos de Materiais** | `/api/stock/balances` | 8 saldos de matérias-primas no Almoxarifado 01 (`sb2010`). | [x] 200 OK (6 grupos) |
| `/pcp/gestao-materiais` | **Gestão de Materiais & Localizações** | `/api/stock/requisicoes` | Requisições e transferências internas de almoxarifado. | [x] 200 OK |

---

### 8. Módulo Suprimentos & Compras

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/solicitacoes-compras` | **Solicitações de Compras** | `/api/compras/solicitacoes` | Solicitações de compra cadastradas e acompanhamento de status. | [x] 200 OK (4 SCs) |
| `/pedidos-compras-pv` | **Pedidos de Compra x Pedido de Venda**| `/api/compras/pedidos-com-pv?pv_numero=000001` | Rastreio inteligente amarrando necessidade de compra ao pedido do cliente. | [x] 200 OK (5 itens) |

---

### 9. Módulo Financeiro

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/financeiro/dashboard` | **Dashboard Gerencial Financeiro** | `/api/financeiro/dashboard` | DRE, faturamento previsto e indicadores financeiros. | [x] 200 OK |
| `/financeiro/fluxo-caixa` | **Fluxo de Caixa** | `/api/financeiro/fluxo-caixa` | Lançamentos de entradas/saídas e saldo diário projetado. | [x] 200 OK |
| `/financeiro/balancete` | **Balancete Dinâmico** | `/api/financeiro/balancete` | Demonstrações contábeis e consolidação dinâmica. | [x] 200 OK |

---

### 10. Módulo Qualidade & SGQ

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/sgq` | **Dashboard SGQ** | `/api/sgq/rncs` | Gestão de RNCs com acompanhamento de planos de ação. | [x] 200 OK |
| `/sgq/ativos` | **Gestão de Ativos Fabris** | `/api/sgq/assets` | Manutenção preventiva e calibração de instrumentos de precisão. | [x] 200 OK |
| `/sgq/romaneios` | **Romaneios da Qualidade** | `/api/sgq/romaneios` | Inspeção visual de recebimento e liberação para produção. | [x] 200 OK |
| `/sgq/mapeamento-processos`| **Mapeamento de Processos** | `/api/sgq/processos` | POPs e fluxogramas de processos de usinagem e montagem. | [x] 200 OK |
| `/sgq/cargos-funcoes` | **Matriz de Cargos e Funções** | `/api/sgq/cargos-funcoes` | Competências, requisitos de formação e descrições de cargo. | [x] 200 OK |

---

### 11. Módulo Recursos Humanos (RH)

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/rh/pasta-colaborador` | **Pasta do Colaborador 360°** | `/api/rh/pasta/colaboradores` | Dossiê funcional completo de colaboradores. | [x] 200 OK |
| `/rh/portal-colaborador`| **Portal de Autoatendimento** | `/api/rh/autoatendimento/pendentes` | Autoatendimento de colaboradores para solicitações internas. | [x] 200 OK |
| `/rh/vagas` | **Gestão de Vagas** | `/api/rh/vagas` | Processos seletivos e requisições de pessoal. | [x] 200 OK |
| `/rh/curriculos` | **Análise de Currículos com IA** | `/api/rh/curriculos` | Upload e triagem automática de currículos com Google Gemini. | [x] 200 OK |

---

### 12. Módulo Segurança do Trabalho (SST) & Benefícios

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/sst` | **Central SST (NR-06 - EPIs)** | `/api/sst/epis` e `/api/sst/fichas` | Entrega de EPIs com controle de CA e fichas assinadas. | [x] 200 OK |
| `/sst/cesta-basica` | **Cesta Básica & Benefícios** | `/api/sst/cesta/periodos` | Períodos de entrega e regras de assiduidade. | [x] 200 OK |
| `/sst/cipa` | **Gestão da CIPA (NR-05)** | `/api/cipa/gestoes` | Composição da comissão, atas e calendário de reuniões. | [x] 200 OK |
| `/sst/cipa/urna` | **Urna Totem de Votação CIPA** | `/api/cipa/colaboradores-disponiveis` | Votação touch-screen e apuração de votos. | [x] 200 OK |
| `/sst/brigada` | **Brigada de Incêndio (NR-23)** | `/api/sst/brigada/dashboard` | Membros da brigada, rotas de fuga e inventário de extintores. | [x] 200 OK |

---

### 13. Módulo Portaria & Controle de Acesso

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/portaria/guarita` | **Terminal da Portaria (Guarita)** | `/api/portaria/acessos/ativos` | Registro com webcam e controle de visitantes/veículos. | [x] 200 OK |
| `/portaria/gerencial` | **Dashboard Gerencial da Portaria** | `/api/portaria/dashboard` | Fluxo de acessos, permanência e gráficos de tráfego. | [x] 200 OK |
| `/portaria/turnos` | **Cadastro de Turnos & Escalas** | `/api/portaria/turnos` | Jornadas permitidas e controle de horários. | [x] 200 OK |

---

### 14. Módulo Salas de Reunião & TI Corporativo

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/salas` | **Gestão de Salas de Reunião** | `/api/salas-reuniao` | Agendamentos, disponibilidade e totens interativos. | [x] 200 OK |
| `/suporte` | **Central de Suporte & Chamados TI**| `/api/suporte/chamados` | Abertura de chamados técnicos e fila de atendimento. | [x] 200 OK |

---

### 15. Módulo Manutenção de Equipamentos

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/manutencao/dashboard` | **Dashboard de Manutenção** | `/api/manutencao/ordens` | Acompanhamento de intervenções preventivas e corretivas. | [x] 200 OK |
| `/manutencao/maquinas` | **Cadastro de Máquinas & Equipamentos**| `/api/manutencao/maquinas` | Ficha técnica das 7 máquinas industriais. | [x] 200 OK |
| `/manutencao/checklists`| **Checklists Diários de Máquina** | `/api/manutencao/checklists/modelos` | Modelos de inspeção pré-operacional diária. | [x] 200 OK |
| `/manutencao/atividades`| **Atividades Padrão de Manutenção** | `/api/manutencao/atividades` | Procedimentos padronizados e planos de lubrificação. | [x] 200 OK |
| `/manutencao/tecnicos` | **Equipe Técnica de Manutenção** | `/api/manutencao/tecnicos` | Especialidades e escalas de atendimento técnico. | [x] 200 OK |
| `/manutencao/materiais` | **Gestão de Peças de Reposição** | `/api/manutencao/materiais` | Almoxarifado de peças sobressalentes. | [x] 200 OK |

---

### 16. Módulo Superadmin & Multi-Tenant

| Rota | Tela | APIs Principais | Critérios de Teste | Status Backend |
|---|---|---|---|:---:|
| `/admin/super-empresas`| **Gestão Multi-Empresas (Tenants)** | `/api/superadmin/empresas` | Empresas contratantes, limites de usuários e módulos liberados. | [x] 200 OK |
| `/admin/proposta-comercial`| **Gerador de Propostas Comerciais** | `/api/propostas` | Geração de propostas comerciais de implantação com IA. | [x] 200 OK |

---
