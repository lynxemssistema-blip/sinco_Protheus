# Plano Mestre de Testes e Correções Gerais - SINCO Autônomo (Emulação Protheus)

> **Documento:** `plano-testes-correcoes-sinco.md`  
> **Status:** Ativo / Fase 1 em Execução  
> **Banco Exclusivo:** `u494795077_SINCO` (MySQL 100% Autônomo - Hostinger)  
> **Data:** 17 de Outubro de 2026  
> **Agente Líder:** `@[project-planner]` & `@[backend-specialist]`  

---

## 1. Diretrizes Confirmadas pelo Usuário (Socratic Gate)

| Parâmetro | Decisão do Usuário |
|---|---|
| **Ponto de Partida** | **Fase 1: Auditoria das telas de Cadastros Mestres e Engenharia (Produtos, BOM e Roteiros)** |
| **Baixa de Estoque em Produção** | **Baixa automática de materiais empenhados (Backflush) na conclusão da operação/OP** |
| **Escopo Inicial de Dados** | **IdEmpresa = 1 (Delta Parafusos) e ecossistema MT2-0001 / MT2-0003 / MT2-0002** |

---

## 2. Visão Geral e Entendimento Técnico

O **SINCO PROTHEUS** agora roda de forma **100% autônoma** no banco `u494795077_SINCO` (Hostinger MySQL).
O TOTVS Protheus está completamente espelhado em tabelas nativas (`sb1010`, `sg1010`, `sg2010`, `sc2010`, `sd4010`, `sc6010`, `sh6010`, `sb2010`, etc.), integradas com as tabelas de alta produtividade do SINCO (`erp_*`, `pcp_*`, `app_*`).

O objetivo deste plano é garantir que **todo o fluxo industrial funcione exatamente como se estivesse conectado ao ERP Protheus oficial**:
1. Cadastros Mestres e Engenharia (BOM Multinível + Roteiros de Fabricação);
2. Pedidos de Venda e Fracionamento de Lotes no PCP;
3. Explosão de OPs Multinível (instanciando OPs-filhas, todos os empenhos e todas as operações);
4. Visualização e Gestão de Chão de Fábrica (PCP Refinado, Gantt, Capacidade);
5. Apontamentos de Produção com baixa automática (Backflush) dos materiais empenhados;
6. Expedição, Romaneios e Faturamento com encerramento de pedidos.

---

## 3. Matriz de Tarefas por Fases

### 🟢 FASE 1: Cadastros Mestres & Engenharia (Produtos, BOM e Roteiros) [EM ANDAMENTO]
* **Objetivo:** Garantir integridade técnica dos itens pais, filhos, matérias-primas e roteiros operacionais.
* **Tarefas & Status:**
  - [x] **T1.1 - Collation e Catálogo de Recursos:** Resolvido erro 500 de collation entre `pcp_recursos`, `pcp_setor_recursos` e `pcp_setores`. Rota `/api/pcp-setores/catalogo-recursos` retornando 200 OK com 3 recursos (`RO0001`, `RO0002`, `RO-0001`).
  - [x] **T1.2 - Sincronização da Estrutura BOM (`MT2-0001`):**
    - `MT2-0001` -> `MT2-0003` (Qtd: 2.0, Nível 1)
    - `MT2-0001` -> `MT2-0002` (Qtd: 2.5, Nível 1)
    - `MT2-0003` -> `MT2-0003` (Qtd: 1.0, Nível 2 - Matéria-prima base homônima)
    - `MT2-0003` -> `MT2-0002` (Qtd: 1.0, Nível 2)
    - Validado: 100% idêntico em `erp_estruturas_bom` e `sg1010`.
  - [x] **T1.3 - Correção de Reatribuição de `const` em `/api/produtos/:codigo/roteiro`:** Corrigido bug em `produtos.js` onde `const [opRows]` impedia fallback para `sg2010`.
  - [ ] **T1.4 - Cadastro e Sincronização do Roteiro de `MT2-0003`:** `MT2-0003` possui Sub-OP na explosão, mas ainda não possui operação cadastrada em `erp_roteiros_operacoes` e `sg2010`. Cadastrar Operação 10 no recurso `RO0001` (Serra) ou `RO0002` (Torno).
  - [ ] **T1.5 - Validação Visual no Frontend:** Auditar tela `ErpProdutosPage.jsx` e `ProductStructure.jsx` com expansão da árvore e exibição dos roteiros de cada nível.

---

### ⏳ FASE 2: Gestão Comercial & Fracionamento de Pedidos no PCP
* **Objetivo:** Pedido de venda limpo e fracionamento flexível para ordens de entrega.
* **Tarefas:**
  - [ ] **T2.1 - Pedido `000001`:** Validar itens 01 (32 UN), 02 (5 UN) e 03 (23 UN) em `erp_pedidos_itens` e `sc6010`.
  - [ ] **T2.2 - Fracionamento no PCP:** Testar divisão em lotes (ex: 12 UN e 6 UN) via `app_pcp_delivery_forecasts`.

---

### ⏳ FASE 3: Motor de Explosão de OPs & PCP Refinado
* **Objetivo:** Geração completa da árvore de fabricação sem pontas soltas.
* **Tarefas:**
  - [ ] **T3.1 - Explosão Multinível:** Gerar OPs do Pedido `000001`. Verificar instanciação da OP mãe (`00000101A`), sub-OP (`00000101A002`), 4 empenhos em `erp_ordens_producao_materiais`/`sd4010` e operações em `erp_ordens_producao_operacoes`.
  - [ ] **T3.2 - Visualização no PCP Refinado & Gantt:** Conferir se todas as OPs e operações aparecem ordenadas por setor e centro de trabalho.

---

### ⏳ FASE 4: Apontamento de Produção & Baixa de Materiais (Backflush)
* **Objetivo:** Chão de fábrica autônomo com consumo de estoque.
* **Tarefas:**
  - [ ] **T4.1 - Apontamento de Horas e Peças:** Testar apontamento em `sh6010` e `sinco_apontamentos`.
  - [ ] **T4.2 - Backflush Automático:** Ao concluir a operação/OP, abater automaticamente os estoques das matérias-primas empenhadas (`sb2010` / `sd3010`) e dar entrada no produto fabricado.

---

### ⏳ FASE 5: Expedição, Romaneios & Faturamento
* **Objetivo:** Conclusão do ciclo de pedido.
* **Tarefas:**
  - [ ] **T5.1 - Romaneio de Expedição:** Gerar romaneio com itens prontos do pedido.
  - [ ] **T5.2 - Faturamento e Fechamento:** Espelhar faturamento em `sf2010`/`sd2010` e atualizar pedido para status faturado.

---

## 4. Phase X: Critérios Finais de Aceite
- [ ] Conexão 100% no MySQL `u494795077_SINCO`.
- [ ] Isolamento de tenant garantido (`IdEmpresa = 1`).
- [ ] Script de deploy `powershell ./sync-deployment.ps1` executado com sucesso.
- [ ] Nenhuma inconsistência ou tabela órfã no banco.
