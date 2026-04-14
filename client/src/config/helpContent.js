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
    description: 'Visualize a lista de materiais (BOM) exportada do ERP. Exporte relatórios em PDF, consulte desenhos e elabore as liberações da engenharia.',
    steps: [
      'A árvore exibe todos os componentes e subconjuntos do produto selecionado.',
      'Clique em uma linha na tabela para expandir o Roteiro de Fabricação (operações, tempos padrão e de setup).',
      'O bloco "Relatórios" agrupa a exportação em PDF: clique em "Relatório Completo" para imprimir a árvore industrial de todos os níveis organizadamente.',
      'Use a função "Nível 1" para gerar um relatório de produção compacto focado nas metas primárias da montagem.',
      'Marque a caixa "Restrições (Nv.01+)" junto ao "Nível 1" para imprimir os alertas e restrições subjacentes vitais de montagem que não estariam visíveis.',
      'O botão verde "Desenhos" consolida todos os PDFs técnicos cadastrados num único arquivo, permitindo impressão em massa ágil ao chão de fábrica.',
      'A função "Liberação" permite conferir a revisão aplicável com o PCP.'
    ],
    tips: [
      'Qualquer produto filho (do nível 1 em diante) que possua arquivo de desenho técnico aparecerá com o ícone em vermelho. Basta clicar para visualizar a planta no navegador.',
      'A coluna laranja com botões de engrenagem e setas no módulo indica a expansão do processo fabril.',
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
    description: 'Acompanhe os pedidos de desenvolvimento e revisão de engenharia. Controle apontamento de horas e entregas de documentação.',
    steps: [
      'Use o botão Play ▶️ na coluna Ações para iniciar o apontamento de horas. O sistema pausará outros projetos ativos.',
      'Clique na engrenagem de controle para exibir opções avançadas, incluindo a aba "Apontamentos ⏱️".',
      'Na aba Apontamentos, visualize o extrato do tempo ou lance horas manualmente de forma retroativa.',
      'Anexe documentos, mude datas de previsão e crie o espelho para a Produção.',
    ],
    tips: [
      'Pedidos com prazo vencido aparecem destacados em vermelho.',
      'Não se preocupe em pausar: dar Play no Pedido B pausa automaticamente o Pedido A.',
    ],
    links: [
      { path: '/engenharia/relatorio-controle', label: 'Relatório Gerencial' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
    ],
  },

  // ── Relatório de Controle de Engenharia ──────────────────────────────────────
  '/engenharia/relatorio-controle': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Controle de Engenharia',
    icon: 'FileText',
    description: 'Acompanhamento gerencial consolidado do andamento dos projetos e carga de horas apontadas na engenharia.',
    steps: [
      'Acompanhe todas as datas de "Previsto VS Realizado".',
      'Visualize o total de "Horas" consumidas pelo projeto (soma de apontamentos automáticos e manuais).',
      'Exporte os resultados em Excel para controle financeiro da Engenharia.',
    ],
    tips: [
      'A coluna de Horas já converte os segundos de apontamento em frações fracionárias (Ex: 0.5h = 30min).',
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Painel de Engenharia' }
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
    description: 'Lista consolidada de itens para acompanhamento e solicitação de faturamento.',
    steps: [
      'A coluna Status indicará visualmente: 🟢 FATURADO 100%, 🟠 FAT. PARCIAL (se houver entrega parcial e saldo restante) ou ⚪ A FATURAR.',
      'Acompanhe as quantidades Totais, Entregues e o respectivo Saldo Pendente na mesma visão.',
      'Na coluna "Fat. Solicitados", visualize requisições exatas e empenhadas à programação (PCP) adequada, sem duplicações.',
      'Selecione as NFs diretamente pelos botões na coluna de NFs Anteriores.',
    ],
    tips: [
      'Pedidos divididos em várias datas de entrega no PCP terão suas Solicitações de Faturamento encaixadas precisamente em suas linhas (ID de programação).',
      'Filtrar por "Apenas Pendentes" remove rapidamente os que já possuem status 🟢 FATURADO 100%.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/romaneios', label: 'Romaneios' },
      { path: '/comercial/dashboard-faturamento', label: 'Dashboard Gerencial' },
    ],
  },

  // ── Comercial / Dashboard Gerencial de Faturamento ───────────────────────────
  '/comercial/dashboard-faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Dashboard de Faturamento',
    icon: 'PieChart',
    description: 'Painel gerencial consolidado para análise de desempenho financeiro e acompanhamento do status das solicitações de faturamento em tempo real.',
    steps: [
      'Visão Geral: Monitore KPls críticos como Valor Total Faturado, Notas Fiscais emitidas, e proporção do que ainda está em processo de faturamento.',
      'Filtros Globais: Utilize os filtros de data, status das solicitações, clientes ou produtos para refinar os indicadores de toda a tela simultaneamente.',
      'Análise por Categoria: Alterne o agrupamento principal entre "Por Cliente" ou "Por Produto" para identificar as maiores fontes de faturamento e engarrafamentos operativos.',
      'Acompanhamento de Status: Navegue pelos gráficos (barras e donuts) para visualizar de forma rápida a distribuição financeira e quantitativa dos status pendentes e finalizados.',
    ],
    tips: [
      'O gráfico de Top 10 rankeia imediatamente as maiores concentrações de valores, sendo ideal para focar o acompanhamento comercial ou priorização de liberações de faturamento.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ir para Itens a Faturar' },
      { path: '/comercial/faturamento', label: 'Gestão de Faturamento (NFs)' },
    ],
  },


  // ── Comercial / Visão Gerencial Atrasos ──────────────────────────────────────
  '/comercial/atrasos': {
    category: 'Comercial',
    categoryColor: '#ef4444',
    title: 'Visão Gerencial (Atrasos)',
    icon: 'Target',
    description: 'Espelho da fábrica com foco em itens pendentes de produção e entrega, cuja data de faturamento já encontra-se atrasada em relação à data atual.',
    steps: [
      'Acompanhe o valor de Risco Financeiro pendente (requer permissão de visualização financeira).',
      'Use os gráficos de Top Clientes e Atrasos por Mês para identificar os maiores gargalos.',
      'Acesse a tabela interativa para navegar na hierarquia Cliente > Mês > Lista de Itens individuais.',
      'Analise a Data de Entrada versus Data de Entrega para entender o lead time atrasado.',
    ],
    tips: [
      'Use a barra de pesquisa na tabela de espelho dinâmico para encontrar um produto ou cliente específico rapidamente.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  // ── PCP Geral / Visão Global (Fábrica Inteira) ──────────────────────────────
  '/pcp/visao-fabrica': {
    category: 'PCP Geral',
    categoryColor: '#4f46e5', // indigo-600
    title: 'Visão Global (Fábrica Inteira)',
    icon: 'Factory',
    description: 'Painel completo de Business Intelligence reunindo toda a carga fabril agrupada por Quinzenas contendo o futuro (dentro do prazo) e os atrasos (fora do prazo) de produção.',
    steps: [
      'Utilize as abas para separar a visão entre "Entregas Futuras" ou carregamento de "Atrasados".',
      'Abra a aba "Dashboard Financeiro" (se autorizado) para verificar o risco/valor bloqueado na fábrica.',
      'Clique gradualmente nas Quinzenas para expandí-las, exibindo todos os Produtos, e para cada Produto expanda os Pedidos e Clientes respectivos.',
      'Utilize o botão "Gerar PDF" para exportar a posição com o KPI do horário que antecede sua reunião tática de produção.',
      'Use o Snapshot BD para manter o registro perpétuo que construirá sua curva de evolução dos atrasos.',
    ],
    tips: [
      'Na aba de listagem (Tabela), a última coluna possui badges dinâmicos (Heatmap de prazo) exibindo exatamente as colorações críticas e os dias exatos remanescentes para entrega.',
      'Mesmo na barra expandida existe um filtro Rápido para você procurar um Part Number (Código) ou Cliente rapidamente.',
    ],
    links: [
      { path: '/comercial/atrasos', label: 'Visão Comercial de Atrasos' },
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

  // ── Financeiro / Dashboard ───────────────────────────────────────────────────
  '/financeiro/dashboard': {
    category: 'Financeiro',
    categoryColor: '#84cc16',
    title: 'Dashboard Financeiro',
    icon: 'PieChart',
    description: 'Visão consolidada da saúde financeira da empresa. Indicadores de faturamento, recebimentos, inadimplência e projeções.',
    steps: [
      'Selecione o limite de datas ou período (ex: Este Ano).',
      'Verifique os cards superiores com total faturado, saldo a receber e inadimplentes.',
      'Analise o fluxo de caixa consolidado SE1/SE2 nos gráficos.',
      'O dashboard possui filtros de competência que refletem imediatamente em todos os gráficos.'
    ],
    tips: [
      'Compare automaticamente o realizado com a previsão no gráfico de barras empilhadas.',
    ],
    links: [
      { path: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa' },
      { path: '/financeiro/faturamento', label: 'Financeiro / Faturamento' },
    ],
  },

  // ── Fluxo de Caixa ───────────────────────────────────────────────────────────
  '/financeiro/fluxo-caixa': {
    category: 'Financeiro',
    categoryColor: '#84cc16',
    title: 'Fluxo de Caixa',
    icon: 'ArrowRightLeft',
    description: 'Gestão detalhada do fluxo de caixa e integração com contas a pagar e a receber (SE1/SE2).',
    steps: [
      'Filtre o fluxo pelo horizonte de planejamento desejado.',
      'Verifique as previsões de entrada baseadas em pedidos aprovados e faturamento.',
      'Identifique "furos" de caixa (saldo negativo) nas projeções diárias.',
      'Exportação da malha do fluxo para análises extras no Excel.'
    ],
    tips: [
      'Projeções são atualizadas em tempo real com base no faturamento do ERP.',
    ],
    links: [
      { path: '/financeiro/dashboard', label: 'Dashboard Financeiro' },
    ],
  },

  // ── Relatório de Liberações (Engenharia) ─────────────────────────────────────
  '/engenharia/relatorio-liberacao': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Relatório de Liberações',
    icon: 'FileCheck',
    tabs: [
      {
        id: 'engenharia',
        label: 'Engenharia (ZEN)',
        description: 'Histórico técnico detalhado de todas as liberações de engenharia realizadas pelo módulo Pedidos de Engenharia.',
        steps: [
          'Códigos LEN (Ex: LEN-2024-00001) identificam unicamente cada pacote técnico liberado.',
          'Analise a coluna "Modo": "FULL" indica que toda a estrutura e desenhos foram anexados; "NÍVEL 1" indica que apenas o nível superior foi liberado.',
          'Rastreabilidade de Destino: Veja para quais e-mails automáticos a notificação foi enviada na coluna Detalhes.',
          'Acesso Direto: Clique no ícone de documento à direita para abrir o PDF original salvo automaticamente na rede.'
        ],
        tips: [
          'O modo "Nível 1" é ideal para revisões rápidas onde a estrutura interna não sofreu alterações.',
          'Todo registro nesta aba possui um "Audit Trail" imutável, garantindo conformidade com a ISO 9001.'
        ]
      },
      {
        id: 'pcp',
        label: 'PCP / Lotes (LPF)',
        description: 'Relatório de agrupamento de Ordens de Produção (Aglutinação) para fabricação seriada ou por lotes.',
        steps: [
          'Códigos LPF identificam Liberações PCP de Fabricação (Pacotes Aglutinados).',
          'Expansão de Lote: Clique na seta lateral (chevron) para ver todas as OPs contidas naquele lote específico.',
          'Documentação Consolidada: O ícone de arquivo verde abre o PDF que contém o espelho de todas as OPs do lote com seus respectivos desenhos.',
          'Verificação de Datas: A coluna "Data PCP" mostra a data de entrega programada que foi definida no momento da aglutinação.'
        ],
        tips: [
          'Liberações LPF são salvas automaticamente na pasta de rede da Engenharia para facilitar o acesso do PCP.',
          'Se uma OP foi aglutinada por erro, o registro histórico permanecerá aqui para auditoria, mesmo que a OP seja cancelada.'
        ]
      },
      {
        id: 'romaneio',
        label: 'Controle Romaneio',
        description: 'Gestão e rastreabilidade de embarques (Packing Lists) vinculados às liberações de engenharia e PCP.',
        steps: [
          'Status em Tempo Real: Acompanhe se o romaneio está em "Aberto", "Conferido" ou "Enviado".',
          'Rastreabilidade (Audit Trail): Visualize o histórico de quem alterou o status e a data exata da mudança.',
          'Busca por Cliente: Utilize o campo de busca geral para localizar romaneios por ID (#) ou nome do cliente.',
          'Acesso ao PDF: Clique no ícone de documento azul na coluna PDF para abrir o romaneio oficial salvo na rede.'
        ],
        tips: [
          'Cada alteração de status gera uma nova revisão (Rev) automática para auditoria.',
          'O romaneio é o elo final entre a produção (PCP) e a entrega ao cliente.'
        ]
      },
      {
        id: 'auditoria',
        label: 'Auditoria & Filtros',
        description: 'Ferramentas avançadas para busca de registros históricos e conformidade técnica.',
        steps: [
          'Filtro por Produto: Digite o código de um componente para ver todas as vezes que ele foi liberado ao longo do ano.',
          'Busca por Usuário: Identifique quem foi o responsável técnico pela liberação de um determinado projeto.',
          'Limpeza de Filtros: Use o botão "Limpar" para resetar a visão e ver as liberações mais recentes no topo.',
          'Exportação: Utilize as ferramentas de sistema para gerar relatórios em Excel para reuniões de análise crítica.'
        ],
        tips: [
          'Use o filtro de "Data de" e "Data Até" para auditorias mensais de produtividade do departamento.',
          'O sistema mantém logs de quem visualizou ou baixou os arquivos através deste relatório.'
        ]
      }
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Pedidos de Engenharia' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
    ],
  },

  // ── Vagas de RH ──────────────────────────────────────────────────────────────
  '/rh/vagas': {
    category: 'Recursos Humanos',
    categoryColor: '#f43f5e',
    title: 'Gestão de Vagas',
    icon: 'Briefcase',
    description: 'Portal para abertura, divulgação e fechamento de vagas de emprego do setor de RH.',
    steps: [
      'Clique em "+ Nova Vaga" para criar o descritivo de abertura.',
      'Descreva os requisitos técnicos, salário e área de atuação.',
      'Gerencie o status da vaga (Aberta, Em Andamento, Fechada).',
      'Vincule requisições de currículos diretamente.'
    ],
    tips: [
      'Mantenha os status da vaga atualizados para facilitar o pipeline dos recrutadores.',
    ],
    links: [
      { path: '/rh/curriculos', label: 'Análise de Currículos' },
      { path: '/sgq/cargos-funcoes', label: 'Cargos e Funções' },
    ],
  },

  // ── Currículos ───────────────────────────────────────────────────────────────
  '/rh/curriculos': {
    category: 'Recursos Humanos',
    categoryColor: '#f43f5e',
    title: 'Análise de Currículos',
    icon: 'Users',
    description: 'Módulo inteligente para submissão, leitura automatizada (IA) e avaliação de currículos dos candidatos.',
    steps: [
      'Faça o upload dos currículos recebidos no sistema.',
      'Confirme se as informações tabuladas pela Inteligência Artificial estão coerentes com o arquivo original.',
      'Filtre os currículos baseados nas competências de uma vaga pré-cadastrada.',
      'Avalie o candidato com notas nos critérios e avance o funil.'
    ],
    tips: [
      'A análise de IA otimiza o tempo de leitura incrivelmente: dedique seu tempo com foco redobrado para a entrevista!',
    ],
    links: [
      { path: '/rh/vagas', label: 'Gestão de Vagas' },
    ],
  },

  // ── Cargos e Funções (SGQ/RH) ────────────────────────────────────────────────
  '/sgq/cargos-funcoes': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Cargos e Funções',
    icon: 'Contact',
    description: 'Base de conhecimento e normatização de descritivos de cargos, funções da CBO e organograma corporativo.',
    steps: [
      'Visualize a árvore do organograma na interface principal.',
      'Selecione um cargo para definir ou rever a sua "Descrição de Cargo".',
      'Vincule quais são as funções críticas do cargo, riscos (EPIs e ambientais) e requisitos.',
      'Aprove o descritivo em revisões rastreadas pelo SGQ.'
    ],
    tips: [
      'Descritivos consolidados frequentemente facilitam o compliance imediato em auditorias da Norma ISO 9001 e de Segurança no Trabalho.',
    ],
    links: [
      { path: '/sgq/treinamento', label: 'Treinamentos' },
      { path: '/rh/vagas', label: 'Gestão de Vagas' },
    ],
  },

  // ── SINCO - Formulário Principal ─────────────────────────────────────────────
  '/engenharia/sinco/formulario': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'Formulário SINCO',
    icon: 'FormInput',
    description: 'Cadastros e formulários de apoio originados diretamente do software de engenharia.',
    steps: [
      'Utilize esta tela para inputs de parâmetros adicionais não cobertos na árvore principal de engenharia.',
      'Acompanhe o lançamento final gerado pelas macro/tarefas no Solid Edge.',
      'Exiba os formulários finais para garantir a qualidade de lançamento das peças.'
    ],
    tips: [
      'Confira os formulários após alterações estruturais de projetos customizados SINCO para confirmar persistência perante o banco de dados.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO – OS' },
    ],
  },

  // ── Protheus Overview ────────────────────────────────────────────────────────
  '/protheus': {
    category: 'Administração',
    categoryColor: '#64748b',
    title: 'Protheus Overview',
    icon: 'Database',
    description: 'Dashboard principal de acompanhamento da saúde da integração, fila e endpoints do ambiente ERP Protheus e do sistema.',
    steps: [
      'Observe os alertas globais no painel para certificar sua integridade sistêmica.',
      'Analise a fila pendente de migrações: Estruturas ou apontamentos.',
      'Se for um administrador técnico, dispare o reenvio manual para fluxos vitais pendentes por interrupções.'
    ],
    tips: [
      'Mantenha comunicação aberta sobre janelas de manutenção de infraestrutura para evitar falhas durante altas transações de chão de fábrica.',
    ],
    links: [
      { path: '/admin/protheus-estudo', label: 'Admin – Protheus (Estudo)' },
      { path: '/configuracoes', label: 'Configurações' },
    ],
  },

  // ── Login / Acesso ──────────────────────────────────────────────────────────
  '/login': {
    category: 'Administração',
    categoryColor: '#64748b',
    title: 'Portal de Acesso',
    icon: 'LogIn',
    tabs: [
      {
        id: 'acesso',
        label: 'Acesso',
        description: 'Credenciais de acesso ao sistema MetalFisa PCP.',
        steps: [
          'Utilize seu nome de usuário (ex: pcp01) ou e-mail corporativo.',
          'Insira sua senha de segurança definida no primeiro acesso.',
          'Clique em "Entrar no Sistema".',
          'A sessão permanecerá ativa enquanto o navegador estiver aberto.'
        ],
        tips: [
          'Não compartilhe sua senha. Toda ação no sistema é rastreada pelo seu login.',
          'Caso erre a senha 5 vezes, sua conta será bloqueada temporariamente.'
        ]
      },
      {
        id: 'recuperacao',
        label: 'Recuperação',
        description: 'Esqueceu sua senha? Veja como recuperar o acesso.',
        steps: [
          'Clique em "Esqueceu a senha?" na tela de login.',
          'Informe seu e-mail corporativo cadastrado (@metalfisa.com.br).',
          'Clique em "Receber Senha por E-mail".',
          'Sua senha atual será enviada imediatamente para sua caixa de entrada.'
        ],
        tips: [
          'Caso não receba o e-mail em 2 minutos, verifique sua pasta de SPAM.',
          'Se o problema persistir, entre em contato com o suporte de TI.'
        ]
      },
      {
        id: 'cadastro',
        label: 'Novo Usuário',
        description: 'Solicitação de novo cadastro para colaboradores.',
        steps: [
          'Clique em "Criar Conta" na parte inferior.',
          'Preencha seu nome completo e e-mail corporativo.',
          'Escolha um login fácil de lembrar (ex: primeiro nome + sobrenome).',
          'Clique em "Solicitar Cadastro".'
        ],
        tips: [
          'Novos cadastros precisam ser aprovados manualmente pela administração.',
          'Você receberá uma notificação quando seu acesso for liberado.'
        ]
      }
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // ── Central de Ajuda ─────────────────────────────────────────────────────────
  '/ajuda': {
    category: 'Comunicação',
    categoryColor: '#fbbf24',
    title: 'Central de Ajuda',
    icon: 'HelpCircle',
    description: 'Catálogo de manuais operacionais e centro de documentação virtual projetada para instruir a funcionalidade das telas.',
    steps: [
      'Pesquise as ferramentas por palavra-chave na tela principal para um acesso intuitivo.',
      'Revise atentamente "O que faz" (Passos e Dicas) para tirar potenciais dúvidas ou limitações da interface.',
      'Siga os links secundários para alternar entre relatórios correlacionados no mesmo departamento.'
    ],
    tips: [
      'Dica mestre: Em qualquer local de acesso, seja onde estiver na plataforma — o botão azul (?) flutuante no canto inferior acessa as mesmas explicações adaptadas contextualmente ao seu monitor focado atual!',
    ],
    links: [
      { path: '/avisos', label: 'Avisos e Comunicados' },
      { path: '/', label: 'Dashboard Principal' },
    ],
  },

};
