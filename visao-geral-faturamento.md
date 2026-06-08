# Plan: Visão Geral - Saldo a Faturar Automático

## 1. Overview
O objetivo deste plano é alterar o comportamento da página "Visão Geral" (`/visao-geral`, componente `OrdersTable`) para que ela carregue automaticamente os dados ao ser aberta, sem exigir que o usuário preencha filtros e clique em buscar. A listagem deve vir filtrada por padrão exibindo apenas Pedidos de Venda Ativos e itens que possuam Saldo a Faturar. Para garantir a performance devido ao volume de dados, a paginação deverá ser implementada tanto no frontend quanto na consulta do backend.

## 2. Project Type
**WEB** (React frontend + Node.js backend)

## 3. Success Criteria
- A página `/visao-geral` carrega dados automaticamente no primeiro acesso.
- A consulta padrão (quando nenhum filtro manual é aplicado) retorna apenas pedidos de venda ativos.
- A consulta padrão retorna apenas itens cujo saldo a faturar seja maior que zero.
- A tabela apresenta paginação (ex: 50 ou 100 itens por página) para manter a tela rápida.
- Os dados podem ser ordenados dinamicamente por Data do Pedido ou Data de Entrega do PCP (ascendente/descendente).
- Os filtros existentes continuam funcionando normalmente caso o usuário queira buscar algo específico.

## 4. Tech Stack
- **Frontend:** React, Tailwind CSS (para paginação/UI), Fetch/Axios.
- **Backend:** Node.js, Express, MySQL/Protheus.

## 5. File Structure
- `client/src/components/OrdersTable.jsx` (Componente da tabela e filtros)
- `server/routes/...` (Rota que alimenta a OrdersTable - a confirmar com o backend-specialist)
- `server/controllers/ou/queries/...` (Lógica de busca e paginação no DB)

## 6. Task Breakdown

### Tarefa 1: Atualizar a Consulta no Backend (Paginação e Filtros Padrão)
- **Agent:** `backend-specialist`
- **Skill:** `api-patterns`
- **INPUT:** Rota da API que alimenta a `OrdersTable`.
- **OUTPUT:** Endpoint atualizado para aceitar parâmetros de paginação (`page`, `limit`) e ordenação (`sortBy`, `sortOrder`). Deve aplicar os filtros "Pedido Ativo" e "Saldo a Faturar > 0" no banco de dados.
- **VERIFY:** Acessar a rota via cURL/Postman sem filtros e confirmar que retorna uma lista limitada de itens com `saldo > 0` e testar os parâmetros de ordenação pelas datas solicitadas.

### Tarefa 2: Implementar Auto-Load e Estado de Paginação no Frontend
- **Agent:** `frontend-specialist`
- **Skill:** `react-best-practices`
- **INPUT:** `client/src/components/OrdersTable.jsx` e o endpoint atualizado da Tarefa 1.
- **OUTPUT:** Componente refatorado com `useEffect` para buscar os dados ao montar (com página 1), e controle de estado para a página atual (`currentPage`).
- **VERIFY:** Abrir a tela `/visao-geral` e confirmar que a tabela é preenchida automaticamente com os primeiros registros sem clicar em "Buscar".

### Tarefa 3: Adicionar Controles de Paginação na UI
- **Agent:** `frontend-specialist`
- **Skill:** `frontend-design`
- **INPUT:** `client/src/components/OrdersTable.jsx` (com dados do backend com paginação).
- **OUTPUT:** Botões ou componente de paginação (Anterior, Próxima, Página X de Y) renderizados abaixo da tabela. Ao clicar, deve chamar a API para a página correspondente.
- **VERIFY:** Clicar em "Próxima Página" e garantir que os dados da tabela são atualizados para os próximos registros.

### Tarefa 4: Adicionar Controles de Ordenação (Sorting) na UI
- **Agent:** `frontend-specialist`
- **Skill:** `react-best-practices`
- **INPUT:** `client/src/components/OrdersTable.jsx`
- **OUTPUT:** Implementar seletores de ordenação nos cabeçalhos da tabela ou um dropdown dedicado para permitir a escolha entre "Data do Pedido" e "Data de Entrega PCP" de forma crescente ou decrescente, acionando uma nova busca no backend.
- **VERIFY:** Clicar na ordenação por Data de Entrega PCP e confirmar que a tabela reflete a ordem correta, inclusive respeitando a paginação.

## 7. ✅ Phase X: Verification Checklist (MANDATORY)
Ao finalizar as tarefas acima, o desenvolvedor DEVE executar:
- [ ] `npm run lint` no frontend e backend.
- [ ] `python .agent/scripts/checklist.py .` para checar vulnerabilidades.
- [ ] Teste manual de performance: Carregar a tela inicial e verificar se o tempo de resposta do auto-load é menor que 2 segundos.
- [ ] Teste de Regressão: Utilizar os filtros manuais para garantir que eles substituem/agem em conjunto com o filtro padrão sem quebrar a lógica original.
