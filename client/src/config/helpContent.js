// ─────────────────────────────────────────────────────────────────────────────
// helpContent.js  –  Conteúdo de Ajuda Contextual por rota
// Fonte para o script de migração: server/scripts/migrateHelpToDb.js
// ─────────────────────────────────────────────────────────────────────────────
export const HELP_CONTENT = {

  // ── Dashboard / Home ────────────────────────────────────────────────────────
  '/': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Dashboard Principal',
    icon: 'LayoutDashboard',
    description: 'Visão geral de todas as operações do sistema MetalFisa PCP. Acompanhe indicadores de produção, pedidos em aberto e alertas em tempo real.',
    steps: [
      'Consulte os cards de resumo no topo para ver ordens abertas, itens a faturar e alertas.',
      'Clique em qualquer card para navegar diretamente ao módulo correspondente.',
      'Use o menu lateral para acessar qualquer módulo do sistema.',
      'O painel atualiza automaticamente a cada poucos minutos.',
    ],
    tips: [
      'Fixe a barra de ajuda para ter acesso rápido sem fechar o painel.',
      'Use os atalhos de teclado para navegar entre módulos rapidamente.',
    ],
    links: [
      { path: '/producao', label: 'Produção' },
      { path: '/relatorios', label: 'Relatórios' },
    ],
  },

  // ── Catálogo de Produtos ─────────────────────────────────────────────────────
  '/produtos': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Catálogo de Produtos',
    icon: 'Package',
    description: 'Gerencie todos os produtos e matérias-primas cadastrados. Visualize estruturas, associe documentos e referências de clientes.',
    steps: [
      'Use a barra de pesquisa para filtrar por descrição ou código do produto.',
      'Selecione o tipo (MP, PI, PA) e a unidade de medida nos filtros de topo.',
      'Clique no ícone de estrutura (camadas) para visualizar a BOM do produto.',
      'Clique no ícone de documento para abrir os documentos associados.',
      'Use o botão EXCEL para exportar a lista filtrada para planilha.',
      'O botão XLSX importa produtos em lote a partir de uma planilha.',
      'O botão IA auxilia na geração de descrições e classificações automáticas.',
    ],
    tips: [
      'Produtos com a badge laranja no ícone de documento possuem arquivos não visualizados.',
      'A coluna REF. CLIENTE exibe a referência do cliente associada ao produto — passe o mouse para ver detalhes.',
      'Use o filtro "Todos (Estoque)" para ver apenas itens com saldo disponível.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/bom-generator', label: 'Gerador de BOM' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Estrutura do Produto ─────────────────────────────────────────────────────
  '/estrutura/:codigo': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Estrutura do Produto (BOM)',
    icon: 'GitBranch',
    description: 'Visualize e edite a lista de materiais (BOM) de um produto. Navegue pelos níveis da estrutura e acesse os componentes.',
    steps: [
      'A árvore exibe todos os componentes e subconjuntos do produto selecionado.',
      'Clique em uma linha para expandir os filhos do componente.',
      'Use o botão "+ Adicionar" para incluir um novo componente na estrutura.',
      'Clique no ícone de edição para alterar quantidade ou operação de um item.',
      'O botão "Explosão" exibe todos os componentes até o nível mais baixo (folha).',
      'Exporte a estrutura para Excel pelo botão no canto superior direito.',
    ],
    tips: [
      'Componentes em vermelho indicam que não possuem saldo em estoque.',
      'Passe o mouse sobre o código do componente para ver a descrição completa.',
    ],
    links: [
      { path: '/produtos', label: 'Catálogo de Produtos' },
      { path: '/bom-generator', label: 'Gerador de BOM' },
    ],
  },

  // ── Gerador de BOM ───────────────────────────────────────────────────────────
  '/bom-generator': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Gerador de BOM',
    icon: 'FileSpreadsheet',
    description: 'Gere listas de materiais (BOM) a partir de modelos ou estruturas existentes. Exporte para Excel ou envie direto ao ERP.',
    steps: [
      'Selecione o produto base pelo campo de busca no topo.',
      'Defina a quantidade desejada e o tipo de explosão (1 nível ou completa).',
      'Clique em "Gerar BOM" para calcular os materiais necessários.',
      'Revise a lista gerada e ajuste quantidades se necessário.',
      'Exporte para Excel ou confirme o envio ao ERP.',
    ],
    tips: [
      'A explosão completa calcula o saldo líquido considerando o estoque atual.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Produção ─────────────────────────────────────────────────────────────────
  '/producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Ordens de Produção',
    icon: 'Factory',
    description: 'Gerencie todas as ordens de produção abertas e em andamento. Acompanhe status, datas e apontamentos.',
    steps: [
      'Filtre as ordens por status (Abertas, Em andamento, Encerradas) nos filtros de topo.',
      'Clique no número da OP para ver detalhes e componentes da ordem.',
      'Use o botão "Apontar" para registrar produção parcial ou total.',
      'Altere a data de entrega prevista clicando no campo de data.',
      'Exporte a lista de OPs para Excel pelo ícone no canto superior.',
    ],
    tips: [
      'OPs em vermelho estão atrasadas em relação à data prevista.',
      'Use o filtro por cliente para visualizar apenas ordens de um determinado cliente.',
    ],
    links: [
      { path: '/producao/op', label: 'Detalhes da OP' },
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
    ],
  },

  // ── OP Detalhes ──────────────────────────────────────────────────────────────
  '/producao/op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Detalhes da Ordem de Produção',
    icon: 'ClipboardList',
    description: 'Visualize os detalhes completos de uma ordem de produção, incluindo operações, componentes e histórico de apontamentos.',
    steps: [
      'Pesquise pelo número da OP no campo de busca.',
      'Consulte as operações e o status de cada etapa produtiva.',
      'Verifique os componentes necessários e o saldo disponível.',
      'Registre apontamentos parciais ou finais diretamente nesta tela.',
    ],
    tips: [
      'O histórico de apontamentos fica disponível na aba "Histórico".',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ── Pedidos de Engenharia ────────────────────────────────────────────────────
  '/engenharia/pedidos': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Pedidos de Engenharia',
    icon: 'Ruler',
    description: 'Acompanhe os pedidos de desenvolvimento e revisão de engenharia. Controle prazos e entregas de documentação técnica.',
    steps: [
      'Visualize todos os pedidos abertos e seu status atual.',
      'Clique em um pedido para ver os detalhes e responsáveis.',
      'Atualize o status conforme o avanço do desenvolvimento.',
      'Anexe documentos e desenhos diretamente ao pedido.',
    ],
    tips: [
      'Pedidos com prazo vencido aparecem destacados em vermelho.',
    ],
    links: [
      { path: '/produtos', label: 'Catálogo de Produtos' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
    ],
  },

  // ── Romaneios ────────────────────────────────────────────────────────────────
  '/romaneios': {
    category: 'Logística',
    categoryColor: '#ef4444',
    title: 'Romaneios de Expedição',
    icon: 'Truck',
    description: 'Crie e gerencie romaneios de expedição de produtos acabados. Controle o que foi enviado, para qual cliente e quando.',
    steps: [
      'Clique em "+ Novo Romaneio" para iniciar uma expedição.',
      'Selecione o cliente e o endereço de entrega.',
      'Adicione os itens a expedir, informando quantidade e lote.',
      'Confirme e imprima o romaneio para acompanhar a carga.',
      'Após expedição, altere o status para "Enviado".',
    ],
    tips: [
      'Romaneios podem ser exportados em PDF para envio por e-mail ao cliente.',
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  // ── Recebimentos ────────────────────────────────────────────────────────────
  '/recebimentos': {
    category: 'Materiais',
    categoryColor: '#10b981',
    title: 'Recebimentos de Materiais',
    icon: 'PackageCheck',
    description: 'Registre e acompanhe o recebimento de materiais e componentes. Faça a conferência física e libere para o estoque.',
    steps: [
      'Consulte os pedidos de compra pendentes de recebimento.',
      'Selecione o pedido e informe as quantidades recebidas.',
      'Confira os dados da nota fiscal com o que foi pedido.',
      'Confirme o recebimento para dar entrada no estoque.',
    ],
    tips: [
      'Recebimentos parciais são permitidos — o saldo restante continua em aberto.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
    ],
  },

  // ── Saldo de Materiais ───────────────────────────────────────────────────────
  '/saldo-materiais': {
    category: 'Materiais',
    categoryColor: '#10b981',
    title: 'Saldo de Materiais',
    icon: 'BarChart3',
    description: 'Consulte o saldo de estoque de todos os materiais e componentes. Visualize posição atual, reservas e disponibilidade.',
    steps: [
      'Pesquise pelo código ou descrição do material.',
      'Veja o saldo atual, quantidade reservada e saldo disponível.',
      'Filtre por tipo de material (MP, PI, PA) para facilitar a análise.',
      'Exporte o saldo para Excel para análise externa.',
    ],
    tips: [
      'Saldo disponível = Saldo atual − Reservas em OPs abertas.',
      'Itens com saldo negativo indicam necessidade urgente de compra ou recebimento.',
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Solicitações de Compra ───────────────────────────────────────────────────
  '/solicitacoes-compras': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Solicitações de Compra',
    icon: 'ShoppingCart',
    description: 'Crie e gerencie solicitações de compra de materiais. Controle o fluxo de aprovação até a emissão do pedido de compra.',
    steps: [
      'Clique em "+ Nova Solicitação" para criar uma SC.',
      'Informe o material, quantidade e justificativa.',
      'Submeta para aprovação do responsável.',
      'Acompanhe o status até a conversão em Pedido de Compra.',
    ],
    tips: [
      'Solicitações aprovadas são automaticamente vinculadas ao pedido de compra.',
    ],
    links: [
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Pedidos de Compra ────────────────────────────────────────────────────────
  '/pedidos-compras-pv': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Pedidos de Compra',
    icon: 'FileText',
    description: 'Gerencie pedidos de compra emitidos para fornecedores. Acompanhe status de entrega e confirme recebimentos.',
    steps: [
      'Pesquise pedidos por número, fornecedor ou material.',
      'Clique no pedido para ver todos os itens e condições.',
      'Atualize o status conforme recebimento parcial ou total.',
      'Emita o PDF do pedido para enviar ao fornecedor.',
    ],
    tips: [
      'Pedidos vencidos são destacados em vermelho — entre em contato com o fornecedor.',
    ],
    links: [
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/fluxo-compras-nf', label: 'Fluxo Compras / NF' },
    ],
  },

  // ── Fluxo Compras / NF ───────────────────────────────────────────────────────
  '/fluxo-compras-nf': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Fluxo Compras / Nota Fiscal',
    icon: 'Receipt',
    description: 'Visualize o fluxo completo de compras desde a solicitação até a entrada da nota fiscal e recebimento físico.',
    steps: [
      'Acompanhe o status de cada etapa: SC → PC → NF → Recebimento.',
      'Filtre por período para análise mensal.',
      'Clique em qualquer etapa para abrir os detalhes.',
    ],
    tips: [
      'Use este módulo para identificar gargalos no processo de compras.',
    ],
    links: [
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
      { path: '/recebimentos', label: 'Recebimentos' },
    ],
  },

  // ── Suprimentos / Requisições ────────────────────────────────────────────────
  '/suprimentos/requisicoes': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Requisições de Suprimentos',
    icon: 'ClipboardCheck',
    description: 'Gerencie as requisições internas de materiais e suprimentos para o chão de fábrica.',
    steps: [
      'Crie requisições informando o material, quantidade e destino.',
      'Acompanhe o status de atendimento pela equipe de almoxarifado.',
      'Confirme a entrega física após recebimento.',
    ],
    tips: [
      'Requisições urgentes podem ser marcadas com prioridade alta.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Controle de Produção ─────────────────────────────────────────────────────
  '/controle-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Controle de Produção',
    icon: 'Gauge',
    description: 'Painel centralizado de controle do chão de fábrica. Visualize o avanço das OPs, eficiência e gargalos em tempo real.',
    steps: [
      'Selecione o período de análise no filtro de datas.',
      'Visualize o painel Kanban com as OPs por etapa produtiva.',
      'Clique em uma OP para ver detalhes e registrar apontamentos.',
      'Use os gráficos para identificar gargalos e ineficiências.',
    ],
    tips: [
      'O painel é atualizado automaticamente a cada 5 minutos.',
      'Arraste OPs entre colunas para atualizar o status diretamente.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/producao-matrix', label: 'Matriz de Produção' },
    ],
  },

  // ── Matriz de Produção ───────────────────────────────────────────────────────
  '/producao-matrix': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Matriz de Produção',
    icon: 'Grid',
    description: 'Visualize a carga de trabalho por máquina/centro de custo em formato de matriz. Identifique sobrecarga e capacidade ociosa.',
    steps: [
      'Selecione o período desejado.',
      'Analise as células da matriz: cores indicam % de ocupação.',
      'Clique numa célula para ver as OPs alocadas naquele centro/período.',
      'Redistribua cargas arrastando OPs entre períodos, se necessário.',
    ],
    tips: [
      'Células vermelhas indicam sobrecarga — revise o planejamento.',
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/planejamento-gantt', label: 'Planejamento Gantt' },
    ],
  },

  // ── Apontamento Vertical ─────────────────────────────────────────────────────
  '/pcp/apontamento-vertical': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento Vertical',
    icon: 'ListChecks',
    description: 'Registre apontamentos de produção de forma ágil por operação e operador. Ideal para uso no chão de fábrica.',
    steps: [
      'Selecione a OP e a operação a apontar.',
      'Informe o operador, quantidade produzida e tempo gasto.',
      'Confirme o apontamento — ele será refletido imediatamente no controle.',
      'Para apontamentos de refugo, marque a opção "Refugo" e informe a causa.',
    ],
    tips: [
      'Apontamentos podem ser feitos diretamente pelo tablet no chão de fábrica.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/pcp/conferencia', label: 'Conferência de Apontamentos' },
    ],
  },

  // ── Conferência de Apontamentos ──────────────────────────────────────────────
  '/pcp/conferencia': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Conferência de Apontamentos',
    icon: 'CheckSquare',
    description: 'Revise e valide os apontamentos de produção registrados. Corrija inconsistências antes do fechamento do período.',
    steps: [
      'Filtre os apontamentos por data e operador.',
      'Revise cada linha e clique em "Aprovar" ou "Rejeitar".',
      'Apontamentos rejeitados retornam para correção pelo operador.',
      'Exporte o relatório consolidado ao final do período.',
    ],
    tips: [
      'Apontamentos com tempo muito acima da média são destacados para revisão.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/evolucao-apontamento', label: 'Evolução dos Apontamentos' },
    ],
  },

  // ── Evolução de Apontamentos ─────────────────────────────────────────────────
  '/pcp/evolucao-apontamento': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Evolução dos Apontamentos',
    icon: 'TrendingUp',
    description: 'Gráficos e tabelas de evolução histórica dos apontamentos de produção por período, operador e operação.',
    steps: [
      'Selecione o período para análise (semana, mês, trimestre).',
      'Filtre por operador ou operação para análises específicas.',
      'Analise os gráficos de tendência e volume de produção.',
      'Exporte os dados para Excel.',
    ],
    tips: [
      'Compare períodos diferentes usando o filtro de comparação.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // ── Visão de Produção ────────────────────────────────────────────────────────
  '/visao-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Visão Geral de Produção',
    icon: 'Eye',
    description: 'Dashboard executivo de produção com KPIs, OEE e indicadores de desempenho do chão de fábrica.',
    steps: [
      'Visualize os KPIs principais: eficiência, disponibilidade e qualidade.',
      'Clique em qualquer indicador para ver o detalhamento.',
      'Selecione o período de análise no filtro superior.',
    ],
    tips: [
      'Configure metas para cada KPI nas configurações do módulo.',
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  '/analytics/evolucao': {
    category: 'Analytics',
    categoryColor: '#0ea5e9',
    title: 'Analytics – Evolução',
    icon: 'LineChart',
    description: 'Análises avançadas e gráficos de evolução de produção, compras, estoque e faturamento.',
    steps: [
      'Selecione o módulo de análise desejado (Produção, Compras, Estoque).',
      'Defina o período e a granularidade (diário, semanal, mensal).',
      'Use os filtros para segmentar por produto, cliente ou centro de custo.',
      'Exporte gráficos em PNG ou dados em Excel.',
    ],
    tips: [
      'Combine múltiplas séries para análise comparativa.',
    ],
    links: [
      { path: '/visao-producao', label: 'Visão de Produção' },
      { path: '/relatorios', label: 'Relatórios' },
    ],
  },

  // ── Planejamento Gantt ───────────────────────────────────────────────────────
  '/planejamento-gantt': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Planejamento Gantt',
    icon: 'GanttChart',
    description: 'Visualize e planeje a sequência de produção em formato Gantt. Ajuste datas e prioridades de forma visual e interativa.',
    steps: [
      'As barras representam cada OP com início e fim planejados.',
      'Arraste as barras para reprogramar datas.',
      'Redimensione as barras para ajustar a duração prevista.',
      'Cores indicam status: azul (planejado), verde (em andamento), vermelho (atrasado).',
      'Salve o planejamento clicando em "Confirmar Programação".',
    ],
    tips: [
      'Use a visão por semana para planejamento de curto prazo.',
      'O Gantt respeita as restrições de capacidade configuradas.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Matriz de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ── Relatórios ───────────────────────────────────────────────────────────────
  '/relatorios': {
    category: 'Relatórios',
    categoryColor: '#6366f1',
    title: 'Relatórios',
    icon: 'FileBarChart',
    description: 'Acesse todos os relatórios gerenciais e operacionais do sistema. Exporte em PDF ou Excel.',
    steps: [
      'Selecione o relatório desejado na lista de categorias.',
      'Configure os parâmetros (período, filtros, agrupamentos).',
      'Clique em "Gerar" para visualizar o relatório.',
      'Exporte para PDF ou Excel conforme necessário.',
    ],
    tips: [
      'Relatórios frequentes podem ser salvos como favoritos.',
      'Agende relatórios para envio automático por e-mail.',
    ],
    links: [
      { path: '/analytics/evolucao', label: 'Analytics' },
      { path: '/visao-producao', label: 'Visão de Produção' },
    ],
  },

  // ── Configurações ─────────────────────────────────────────────────────────────
  '/configuracoes': {
    category: 'Administração',
    categoryColor: '#64748b',
    title: 'Configurações do Sistema',
    icon: 'Settings',
    description: 'Gerencie usuários, permissões, parâmetros do sistema e integrações com outros sistemas.',
    steps: [
      'Acesse a aba "Usuários" para criar e gerenciar contas de acesso.',
      'Configure permissões por perfil em "Perfis de Acesso".',
      'Defina parâmetros globais do sistema em "Parâmetros".',
      'Configure integrações com ERP em "Integrações".',
    ],
    tips: [
      'Apenas administradores têm acesso a esta tela.',
      'Alterações em parâmetros críticos requerem confirmação dupla.',
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // ── SGQ ──────────────────────────────────────────────────────────────────────
  '/sgq': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Sistema de Gestão da Qualidade',
    icon: 'Award',
    description: 'Central do SGQ com acesso a todos os módulos de qualidade: processos, documentos, não conformidades, treinamentos e auditorias.',
    steps: [
      'Navegue pelos módulos de qualidade no menu lateral.',
      'Acesse "Mapeamento de Processos" para visualizar os fluxos.',
      'Registre não conformidades em "Não Conformidades".',
      'Gerencie documentos do sistema em "Documentos".',
    ],
    tips: [
      'Indicadores de qualidade são atualizados diariamente.',
    ],
    links: [
      { path: '/sgq/mapeamento-processos', label: 'Mapeamento de Processos' },
      { path: '/sgq/documentos', label: 'Documentos SGQ' },
      { path: '/sgq/nao-conformidades', label: 'Não Conformidades' },
    ],
  },

  // ── SGQ Mapeamento ───────────────────────────────────────────────────────────
  '/sgq/mapeamento-processos': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Mapeamento de Processos SGQ',
    icon: 'Map',
    description: 'Visualize e edite os processos do sistema de qualidade. Configure a ajuda contextual de cada tela do sistema.',
    steps: [
      'Selecione uma tela do sistema na lista de processos.',
      'Edite o conteúdo de ajuda contextual: descrição, passos e dicas.',
      'Salve as alterações para que fiquem disponíveis na ajuda das telas.',
      'Use "Recarregar Ajuda" para ver as mudanças sem reiniciar o sistema.',
    ],
    tips: [
      'As alterações feitas aqui aparecem instantaneamente na Central de Ajuda.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // ── SGQ Documentos ───────────────────────────────────────────────────────────
  '/sgq/documentos': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Documentos SGQ',
    icon: 'FolderOpen',
    description: 'Repositório de documentos do sistema de gestão da qualidade: procedimentos, instruções de trabalho, formulários e registros.',
    steps: [
      'Navegue pelas categorias de documentos no painel esquerdo.',
      'Use a busca para encontrar documentos por nome ou código.',
      'Clique em um documento para visualizar ou baixar.',
      'Faça upload de novos documentos pelo botão "+ Novo Documento".',
      'Controle revisões e histórico de versões na aba "Revisões".',
    ],
    tips: [
      'Documentos obsoletos são arquivados automaticamente ao aprovar nova versão.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/mapeamento-processos', label: 'Mapeamento de Processos' },
    ],
  },

  // ── SGQ Não Conformidades ────────────────────────────────────────────────────
  '/sgq/nao-conformidades': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Não Conformidades',
    icon: 'AlertTriangle',
    description: 'Registre, acompanhe e trate não conformidades internas e externas. Defina ações corretivas e preventivas.',
    steps: [
      'Clique em "+ Registrar NC" para abrir uma nova não conformidade.',
      'Descreva o problema, origem e impacto.',
      'Defina as ações corretivas e os responsáveis.',
      'Acompanhe o status até o fechamento da NC.',
      'Registre a eficácia da ação após implementação.',
    ],
    tips: [
      'NCs abertas há mais de 30 dias sem tratativa são destacadas.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/indicadores', label: 'Indicadores SGQ' },
    ],
  },

  // ── SGQ Treinamento ──────────────────────────────────────────────────────────
  '/sgq/treinamento': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Treinamentos',
    icon: 'GraduationCap',
    description: 'Gerencie o programa de treinamento e desenvolvimento de colaboradores. Controle matrizes de competências e certificações.',
    steps: [
      'Visualize a matriz de treinamentos por colaborador e função.',
      'Registre a realização de treinamentos com data e participantes.',
      'Gere relatórios de conformidade de treinamentos.',
      'Configure alertas para treinamentos com prazo de revalidade.',
    ],
    tips: [
      'Treinamentos vencidos são destacados em vermelho na matriz.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // ── SGQ Auditorias ───────────────────────────────────────────────────────────
  '/sgq/auditorias': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Auditorias',
    icon: 'Search',
    description: 'Planeje e gerencie auditorias internas e externas do sistema de qualidade. Registre achados e acompanhe o tratamento.',
    steps: [
      'Crie um plano de auditoria com datas, escopo e auditores.',
      'Registre os achados durante a auditoria.',
      'Classifique: Conformidade, Observação ou Não Conformidade.',
      'Defina ações de tratamento para cada achado.',
      'Acompanhe o fechamento de todas as pendências.',
    ],
    tips: [
      'Use o histórico de auditorias para identificar tendências de problemas.',
    ],
    links: [
      { path: '/sgq/nao-conformidades', label: 'Não Conformidades' },
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // ── SGQ Calibrações ──────────────────────────────────────────────────────────
  '/sgq/calibracoes': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Calibrações de Instrumentos',
    icon: 'Wrench',
    description: 'Controle o plano de calibração de instrumentos de medição. Gerencie certificados e alertas de vencimento.',
    steps: [
      'Cadastre os instrumentos com código, descrição e periodicidade.',
      'Registre calibrações realizadas com data e resultado.',
      'Anexe os certificados de calibração.',
      'Receba alertas automáticos antes do vencimento.',
    ],
    tips: [
      'Instrumentos fora do prazo são bloqueados automaticamente para uso em medições críticas.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // ── SGQ Indicadores ──────────────────────────────────────────────────────────
  '/sgq/indicadores': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Indicadores SGQ',
    icon: 'BarChart2',
    description: 'Dashboard de indicadores do sistema de gestão da qualidade. Acompanhe metas e tendências dos principais KPIs de qualidade.',
    steps: [
      'Visualize os indicadores com metas e resultados atuais.',
      'Filtre por período para análise histórica.',
      'Clique em um indicador para ver o detalhamento.',
      'Configure metas e limites de alerta em "Editar Indicador".',
    ],
    tips: [
      'Indicadores abaixo da meta aparecem em vermelho com alerta.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/nao-conformidades', label: 'Não Conformidades' },
    ],
  },

  // ── Avisos ───────────────────────────────────────────────────────────────────
  '/avisos': {
    category: 'Comunicação',
    categoryColor: '#fbbf24',
    title: 'Avisos e Comunicados',
    icon: 'Bell',
    description: 'Central de comunicados internos da empresa. Publique e visualize avisos importantes para a equipe.',
    steps: [
      'Clique em "+ Novo Aviso" para criar um comunicado.',
      'Defina o título, conteúdo e destinatários (todos ou por setor).',
      'Publique imediatamente ou agende para uma data futura.',
      'Acompanhe quem visualizou o aviso na lista de leituras.',
    ],
    tips: [
      'Avisos urgentes podem ser marcados como "Prioritário" e aparecem em destaque.',
    ],
    links: [],
  },

  // ── Vendas / Itens a Faturar ─────────────────────────────────────────────────
  '/vendas/itens-faturar': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Itens a Faturar',
    icon: 'DollarSign',
    description: 'Lista de itens prontos para faturamento. Selecione os itens, gere a nota fiscal e registre o faturamento.',
    steps: [
      'Visualize todos os itens liberados para faturamento.',
      'Filtre por cliente ou pedido de venda.',
      'Selecione os itens desejados e clique em "Faturar Selecionados".',
      'Confirme os dados fiscais e gere a NF.',
    ],
    tips: [
      'Itens com restrição fiscal ficam destacados — consulte o departamento fiscal.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/romaneios', label: 'Romaneios' },
    ],
  },

  // ── Faturamento ──────────────────────────────────────────────────────────────
  '/comercial/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Faturamento',
    icon: 'FileInvoice',
    description: 'Gestão de notas fiscais emitidas. Acompanhe o status de transmissão à SEFAZ, cancelamentos e reimpressões.',
    steps: [
      'Consulte as NFs emitidas pelo período, cliente ou número.',
      'Verifique o status: Aguardando, Autorizada, Cancelada.',
      'Reimprima o DANFE clicando no ícone de impressão.',
      'Solicite cancelamento quando necessário (respeitando o prazo legal).',
    ],
    tips: [
      'NFs rejeitadas pela SEFAZ exibem o motivo da rejeição em destaque.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
      { path: '/financeiro/faturamento', label: 'Financeiro / Faturamento' },
    ],
  },

  // ── Histórico de Faturamento ─────────────────────────────────────────────────
  '/vendas/faturamento-historico': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Histórico de Faturamento',
    icon: 'History',
    description: 'Consulte o histórico completo de faturamento por período, cliente e produto.',
    steps: [
      'Defina o período de análise nos filtros de data.',
      'Filtre por cliente, produto ou representante.',
      'Analise os gráficos de evolução de faturamento.',
      'Exporte para Excel para análise detalhada.',
    ],
    tips: [
      'Compare o faturamento de diferentes períodos usando a opção de comparação.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // ── Financeiro / Faturamento ─────────────────────────────────────────────────
  '/financeiro/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Financeiro – Faturamento',
    icon: 'Wallet',
    description: 'Controle financeiro do faturamento: contas a receber, títulos em aberto e fluxo de caixa das vendas.',
    steps: [
      'Visualize os títulos em aberto por cliente e vencimento.',
      'Registre baixas de pagamentos recebidos.',
      'Acompanhe o fluxo de caixa previsto e realizado.',
      'Gere relatórios de inadimplência e aging.',
    ],
    tips: [
      'Títulos vencidos há mais de 30 dias são destacados em vermelho.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/relatorios', label: 'Relatórios' },
    ],
  },

  // ── Gestão de Materiais ──────────────────────────────────────────────────────
  '/pcp/gestao-materiais': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Gestão de Materiais',
    icon: 'Boxes',
    description: 'Planejamento e controle de necessidades de materiais (MRP simplificado). Identifique faltas e excesso de estoque.',
    steps: [
      'Execute o cálculo de necessidades para o período selecionado.',
      'Analise os materiais críticos (saldo abaixo do mínimo).',
      'Gere solicitações de compra automaticamente para os itens em falta.',
      'Ajuste os parâmetros de estoques mínimo e máximo.',
    ],
    tips: [
      'Execute o cálculo semanalmente para manter o planejamento atualizado.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Onde Usado ───────────────────────────────────────────────────────────────
  '/pcp/onde-usado': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Onde Usado',
    icon: 'Search',
    description: 'Pesquise em quais produtos e estruturas um componente ou material é utilizado.',
    steps: [
      'Informe o código ou descrição do componente.',
      'O sistema lista todos os produtos que utilizam este componente.',
      'Clique em um produto para abrir a estrutura correspondente.',
      'Exporte a lista para análise de impacto de mudanças.',
    ],
    tips: [
      'Útil para avaliar o impacto de alterações em componentes compartilhados.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/produtos', label: 'Catálogo de Produtos' },
    ],
  },

  // ── SINCO OS ─────────────────────────────────────────────────────────────────
  '/engenharia/sinco/os': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO – Ordens de Serviço',
    icon: 'FileText',
    description: 'Gerencie as ordens de serviço de engenharia integradas ao SINCO SolidEdge. Acompanhe desenhos, revisões e aprovações.',
    steps: [
      'Visualize todas as OS abertas e seus status.',
      'Clique em uma OS para ver detalhes e arquivos vinculados.',
      'Aprove ou rejeite desenhos diretamente nesta tela.',
      'Acompanhe o histórico de revisões de cada documento.',
    ],
    tips: [
      'OS aprovadas são automaticamente enviadas para o ERP Protheus.',
    ],
    links: [
      { path: '/engenharia/sinco/estrutura', label: 'SINCO – Estrutura' },
      { path: '/sinco/desenho-ativo', label: 'Desenho Ativo' },
    ],
  },

  // ── SINCO Estrutura ──────────────────────────────────────────────────────────
  '/engenharia/sinco/estrutura': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO – Estrutura de Produtos',
    icon: 'GitBranch',
    description: 'Visualize e sincronize a estrutura de produtos originada do SolidEdge SINCO com o ERP.',
    steps: [
      'Selecione o produto para visualizar a estrutura sincronizada do SINCO.',
      'Compare com a estrutura atual do ERP para identificar divergências.',
      'Aprove a sincronização para atualizar o ERP.',
      'Registre os motivos de alterações para rastreabilidade.',
    ],
    tips: [
      'Sincronize após cada revisão de projeto para manter o ERP atualizado.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/engenharia/sinco/os', label: 'SINCO – OS' },
    ],
  },

  // ── SINCO Apontamento ────────────────────────────────────────────────────────
  '/engenharia/sinco/apontamento': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO – Apontamento de Engenharia',
    icon: 'PenTool',
    description: 'Registre apontamentos de horas de engenharia por projeto e OS.',
    steps: [
      'Selecione a OS e a atividade de engenharia.',
      'Informe o engenheiro responsável e as horas trabalhadas.',
      'Confirme o apontamento para atualizar o custo da OS.',
    ],
    tips: [
      'Apontamentos são a base para o cálculo de custo de desenvolvimento.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO – OS' },
      { path: '/engenharia/sinco/apontamento-matrix', label: 'SINCO – Matrix' },
    ],
  },

  // ── SINCO Apontamento Matrix ─────────────────────────────────────────────────
  '/engenharia/sinco/apontamento-matrix': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO – Matriz de Apontamentos',
    icon: 'Grid',
    description: 'Visualize a carga de trabalho da equipe de engenharia em formato de matriz.',
    steps: [
      'Selecione o período de análise.',
      'Visualize as horas apontadas por engenheiro e projeto.',
      'Identifique sobrecarga e capacidade disponível.',
    ],
    tips: [
      'Use para planejar a alocação de recursos de engenharia.',
    ],
    links: [
      { path: '/engenharia/sinco/apontamento', label: 'SINCO – Apontamento' },
      { path: '/engenharia/sinco/os', label: 'SINCO – OS' },
    ],
  },

  // ── SINCO Materiais ──────────────────────────────────────────────────────────
  '/engenharia/sinco/materiais': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO – Materiais de Engenharia',
    icon: 'Package',
    description: 'Gerencie os materiais e componentes utilizados nos projetos de engenharia.',
    steps: [
      'Consulte o consumo de materiais por projeto/OS.',
      'Registre requisições de materiais especiais para projetos.',
      'Acompanhe o status de compra de materiais especificados.',
    ],
    tips: [
      'Materiais especificados em projeto têm prioridade no processo de compras.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO – OS' },
      { path: '/solicitacoes-compras', label: 'Solicitações de Compra' },
    ],
  },

  // ── Desenho Ativo ────────────────────────────────────────────────────────────
  '/sinco/desenho-ativo': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'Desenho Ativo',
    icon: 'Layers',
    description: 'Consulte e gerencie os desenhos técnicos ativos do sistema SINCO SolidEdge.',
    steps: [
      'Pesquise o desenho por código ou descrição.',
      'Visualize a revisão atual e o histórico de alterações.',
      'Faça download do arquivo do desenho.',
      'Solicite revisão clicando em "Nova Revisão".',
    ],
    tips: [
      'Apenas a revisão mais recente aprovada é considerada "ativa".',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO – OS' },
      { path: '/engenharia/sinco/estrutura', label: 'SINCO – Estrutura' },
    ],
  },

  // ── Apontamento por Usuário ──────────────────────────────────────────────────
  '/pcp/apontamento-por-usuario': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por Usuário',
    icon: 'User',
    description: 'Visualize e gerencie os apontamentos de produção consolidados por operador/usuário.',
    steps: [
      'Selecione o operador e o período de análise.',
      'Visualize todos os apontamentos do operador no período.',
      'Identifique inconsistências e corrija quando necessário.',
      'Exporte o relatório para folha de ponto ou RH.',
    ],
    tips: [
      'Compare a produtividade entre operadores do mesmo turno.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/conferencia', label: 'Conferência de Apontamentos' },
    ],
  },

  // ── Apontamento por Usuário OP ───────────────────────────────────────────────
  '/pcp/apontamento-por-usuario-op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por Usuário / OP',
    icon: 'UserCheck',
    description: 'Visualize os apontamentos cruzados por usuário e ordem de produção.',
    steps: [
      'Selecione o período e os filtros desejados.',
      'Analise a contribuição de cada operador por OP.',
      'Exporte para análise de custo de mão de obra.',
    ],
    tips: [
      'Use para calcular o custo real de mão de obra por ordem.',
    ],
    links: [
      { path: '/pcp/apontamento-por-usuario', label: 'Apontamento por Usuário' },
      { path: '/producao', label: 'Ordens de Produção' },
    ],
  },

  // ── SWorks ───────────────────────────────────────────────────────────────────
  '/sworks': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'SWorks – Shop Floor',
    icon: 'Monitor',
    description: 'Interface de chão de fábrica para operadores. Visualize e registre operações de forma simplificada.',
    steps: [
      'O operador faz login com seu código.',
      'Selecione a OP e a operação a executar.',
      'Inicie o timer ao começar a operação.',
      'Finalize registrando a quantidade produzida.',
    ],
    tips: [
      'Interface otimizada para touchscreen e tablets industriais.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ── VMI Forecast ─────────────────────────────────────────────────────────────
  '/vmi/forecast': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'VMI – Forecast',
    icon: 'TrendingUp',
    description: 'Previsão de demanda e forecast de vendas para planejamento de produção e compras.',
    steps: [
      'Visualize o forecast atual por produto e período.',
      'Ajuste as previsões manualmente quando necessário.',
      'Compare forecast com consumo real.',
      'Exporte para uso no planejamento de produção.',
    ],
    tips: [
      'Forecasts são atualizados automaticamente com base no histórico de pedidos.',
    ],
    links: [
      { path: '/vmi/pedido', label: 'VMI – Pedido' },
      { path: '/vmi/dashboard', label: 'VMI – Dashboard' },
    ],
  },

  // ── VMI Pedido ───────────────────────────────────────────────────────────────
  '/vmi/pedido': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'VMI – Pedido',
    icon: 'ShoppingBag',
    description: 'Gestão de pedidos no modelo VMI (Vendor Managed Inventory).',
    steps: [
      'Visualize os pedidos VMI recebidos dos clientes.',
      'Confirme disponibilidade e datas de entrega.',
      'Gere ordens de produção a partir dos pedidos VMI.',
    ],
    tips: [
      'No modelo VMI, o fornecedor gerencia o estoque do cliente automaticamente.',
    ],
    links: [
      { path: '/vmi/forecast', label: 'VMI – Forecast' },
      { path: '/vmi/dashboard', label: 'VMI – Dashboard' },
    ],
  },

  // ── VMI Leitura ──────────────────────────────────────────────────────────────
  '/vmi/leitura': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'VMI – Leitura de Estoque',
    icon: 'BarcodeScan',
    description: 'Leitura e atualização do estoque VMI no cliente via coleta de dados.',
    steps: [
      'Importe o arquivo de inventário recebido do cliente.',
      'Confira as divergências entre o esperado e o informado.',
      'Confirme a leitura para atualizar o sistema.',
    ],
    tips: [
      'A leitura periódica garante a acuracidade do VMI.',
    ],
    links: [
      { path: '/vmi/pedido', label: 'VMI – Pedido' },
      { path: '/vmi/estrategia', label: 'VMI – Estratégia' },
    ],
  },

  // ── VMI Dashboard ────────────────────────────────────────────────────────────
  '/vmi/dashboard': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'VMI – Dashboard',
    icon: 'LayoutDashboard',
    description: 'Dashboard executivo do programa VMI com KPIs de nível de serviço, cobertura e giro.',
    steps: [
      'Visualize o nível de serviço atual vs. meta.',
      'Analise a cobertura de estoque por produto.',
      'Identifique itens críticos (abaixo do ponto de reposição).',
    ],
    tips: [
      'Um nível de serviço abaixo de 95% requer atenção imediata.',
    ],
    links: [
      { path: '/vmi/forecast', label: 'VMI – Forecast' },
      { path: '/vmi/historico', label: 'VMI – Histórico' },
    ],
  },

  // ── VMI Estratégia ───────────────────────────────────────────────────────────
  '/vmi/estrategia': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'VMI – Estratégia',
    icon: 'Target',
    description: 'Defina os parâmetros estratégicos do VMI: pontos de reposição, lotes mínimos e metas de cobertura.',
    steps: [
      'Configure o ponto de reposição para cada produto VMI.',
      'Defina o lote mínimo de abastecimento.',
      'Estabeleça as metas de cobertura de estoque.',
      'Salve as configurações para ativar o cálculo automático.',
    ],
    tips: [
      'Revise os parâmetros trimestralmente conforme mudanças de demanda.',
    ],
    links: [
      { path: '/vmi/dashboard', label: 'VMI – Dashboard' },
      { path: '/vmi/forecast', label: 'VMI – Forecast' },
    ],
  },

  // ── VMI Histórico ────────────────────────────────────────────────────────────
  '/vmi/historico': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'VMI – Histórico',
    icon: 'History',
    description: 'Consulte o histórico de movimentações e reposições VMI por período e produto.',
    steps: [
      'Selecione o período e o cliente VMI.',
      'Analise o histórico de pedidos e reposições.',
      'Compare consumo real vs. forecast.',
      'Exporte para relatórios de gestão.',
    ],
    tips: [
      'Use para análise de sazonalidade e ajuste do forecast.',
    ],
    links: [
      { path: '/vmi/dashboard', label: 'VMI – Dashboard' },
      { path: '/vmi/forecast', label: 'VMI – Forecast' },
    ],
  },

  // ── Admin Protheus ───────────────────────────────────────────────────────────
  '/admin/protheus-estudo': {
    category: 'Administração',
    categoryColor: '#64748b',
    title: 'Admin – Protheus (Estudo)',
    icon: 'Database',
    description: 'Área administrativa para análise e estudo de integração com o ERP Protheus.',
    steps: [
      'Acesso restrito a administradores do sistema.',
      'Use para testar e analisar a integração com o Protheus.',
      'Consulte logs de sincronização e erros de integração.',
    ],
    tips: [
      'Área técnica — não utilize em produção sem aprovação.',
    ],
    links: [
      { path: '/configuracoes', label: 'Configurações' },
    ],
  },

};
