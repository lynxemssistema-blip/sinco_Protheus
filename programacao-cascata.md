# Programação Finita (Cascata Automática)

## Goal
Implementar o agendamento de capacidade finita (Programação em Cascata) no `ProductionControl.jsx`, garantindo que a data de início de cada operação dependa da conclusão da operação anterior, utilizando a capacidade diária dos recursos definidos em `app_recursos_capacidade`.

## Tasks
- [ ] Task 1: Criar/Adaptar a rota de backend para fornecer a capacidade diária e os tempos unitários (já integrados via fallback no PCP Refinado) para a lógica de sequenciamento da cascata. → Verify: Endpoint retorna os tempos em minutos/horas por OP e a capacidade diária.
- [ ] Task 2: Modificar `ProductionControl.jsx` (ou seu módulo filho de agendamento) para adicionar um botão/modal de "Programação em Cascata Automática". → Verify: Botão visível e abre o modal/gaveta para definir a prioridade dos pedidos.
- [ ] Task 3: Implementar a lógica matemática no Frontend (ou Backend via Batch) que itera as OPs respeitando a árvore: para cada OP, calcular a carga total (Qtd * Tempo Padrão + Setup). Dividir essa carga pela capacidade diária do recurso para determinar os Dias Necessários. → Verify: Logs mostram a carga alocada sem ultrapassar a capacidade diária.
- [ ] Task 4: Adicionar a lógica de precedência (Cascata): A operação filha `Y` não pode começar até que a operação pai `X` atinja uma data de fim ou um saldo mínimo produtivo. O agendamento `Start Date` de `Y` = `End Date` de `X` (em caso de fluxo restrito). → Verify: Gantt/Lista mostra datas encadeadas cronologicamente.
- [ ] Task 5: Salvar o cronograma gerado (Datas Planejadas Início/Fim) no banco através do endpoint `saveProductionPlanBatch`. → Verify: O BD atualiza as datas em `app_production_planning`.

## Done When
- [ ] A tela de Controle de Produção permitir que o usuário ordene a prioridade.
- [ ] O sistema calcular sozinho as datas de todas as operações filhas e pais respeitando a capacidade máxima configurada no PCP Refinado.
- [ ] O resultado refletir um sequenciamento lógico que impossibilite que a solda termine antes da dobra começar, por exemplo.
