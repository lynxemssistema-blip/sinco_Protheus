// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// helpContent.js  â€“  ConteÃºdo de Ajuda Contextual por rota
// Fonte para o script de migraÃ§Ã£o: server/scripts/migrateHelpToDb.js
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const HELP_CONTENT = {

  // â”€â”€ ðŸ¤– Diretrizes e Persona do Agente de IA (Metalfisa - Suporte Lynx) â”€â”€â”€â”€â”€â”€â”€
  '_AI_SYSTEM_INSTRUCTIONS_': {
    category: 'InteligÃªncia Artificial',
    categoryColor: '#8b5cf6',
    title: 'InstruÃ§Ãµes Mestre - Suporte Lynx',
    icon: 'Bot',
    description: 'Bloco de sistema dedicado a alinhar o comportamento do agente de WhatsApp integrado Ã  plataforma.',
    steps: [
      'PERSONA: VocÃª Ã© a IA de "Suporte do Grupo Lynx". Seja prestativo, sempre use um tom educado, cordial e corporativo.',
      'RESTRIÃ‡ÃƒO DE GRUPO: VocÃª atende exclusivamente o grupo "Metalfisa - Suporte Lynx". Se acionado fora dele, deve se recusar a interagir.',
      'DOMÃNIO DE CONHECIMENTO: VocÃª domina todos os mÃ³dulos deste arquivo. Quando um usuÃ¡rio perguntar "Como eu aponto uma O.P.?" ou "Para que serve a curva S?", busque nestas chaves a resposta exata.',
      'TRATATIVA DE ERROS: Ao identificar que o usuÃ¡rio encontrou um erro no sistema, oriente de forma prÃ¡tica usando as dicas cadastradas neste documento (ex: erros de 401, falta de estrutura, erro na integraÃ§Ã£o do Protheus).',
      'FORMATAÃ‡ÃƒO: Envie respostas bonitas para o WhatsApp, utilizando *negrito* para botÃµes e menus, listas com emojis adequados e evite respostas extremamente longas se puder resumir.'
    ],
    tips: [
      'Inicie os atendimentos com "OlÃ¡! Aqui Ã© o Suporte do Grupo Lynx..." e encerre colocando-se Ã  disposiÃ§Ã£o.'
    ],
    links: []
  },

  // â”€â”€ Dashboard / Home â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Dashboard Principal',
    icon: 'LayoutDashboard',
    description: 'VisÃ£o geral de todas as operaÃ§Ãµes do sistema MetalFisa PCP. Acompanhe indicadores de produÃ§Ã£o, pedidos em aberto e alertas em tempo real.',
    steps: [
      'Consulte os cards de resumo no topo para ver ordens abertas, itens a faturar e alertas.',
      'Clique em qualquer card para navegar diretamente ao mÃ³dulo correspondente.',
      'Use o menu lateral para acessar qualquer mÃ³dulo do sistema.',
      'O painel atualiza automaticamente a cada poucos minutos.',
    ],
    tips: [
      'Fixe a barra de ajuda para ter acesso rÃ¡pido sem fechar o painel.',
      'Use os atalhos de teclado para navegar entre mÃ³dulos rapidamente.',
    ],
    links: [
      { path: '/producao', label: 'ProduÃ§Ã£o' },
      { path: '/relatorios', label: 'RelatÃ³rios' },
    ],
  },

  // â”€â”€ ManutenÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/manutencao/execucao-modal': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: '#4f46e5',
    title: 'Painel de ExecuÃ§Ã£o de ManutenÃ§Ã£o',
    icon: 'Play',
    description: 'Este modal centraliza todas as aÃ§Ãµes necessÃ¡rias para executar e registrar uma manutenÃ§Ã£o na fÃ¡brica.',
    tabs: [
      {
        id: 'execucao',
        label: 'Aba de ExecuÃ§Ã£o',
        description: 'Registre tempo, tÃ©cnicos e detalhes da execuÃ§Ã£o.',
        steps: [
          'CronÃ´metro: Permite medir exatamente o tempo gasto na manutenÃ§Ã£o. Pressione Play ao iniciar e Pause ao interromper.',
          'TÃ©cnicos: Ã‰ obrigatÃ³rio selecionar ao menos um tÃ©cnico envolvido na atividade.',
          'Atividades: Descreva os reparos, peÃ§as ajustadas e testes realizados.',
          'Fotos PÃ³s-ManutenÃ§Ã£o: Anexe evidÃªncias do reparo concluÃ­do ou das peÃ§as substituÃ­das.',
          'Problema Resolvido: Define se a mÃ¡quina pode voltar a operar ou se a ordem continuarÃ¡ pendente.'
        ]
      },
      {
        id: 'materiais',
        label: 'SolicitaÃ§Ã£o de Materiais',
        description: 'Solicite peÃ§as necessÃ¡rias para o reparo.',
        steps: [
          'Caso precise de peÃ§as, solicite por aqui. O almoxarifado (ou compras) serÃ¡ notificado e o item entrarÃ¡ no fluxo de GestÃ£o de Materiais.'
        ]
      },
      {
        id: 'historico',
        label: 'HistÃ³rico',
        description: 'Acompanhe a rastreabilidade da ordem.',
        steps: [
          'Registra todas as interaÃ§Ãµes da Ordem (abertura, solicitaÃ§Ãµes, pausas, finalizaÃ§Ãµes) com usuÃ¡rio e horÃ¡rio exatos, garantindo a rastreabilidade (Log de Auditoria).'
        ]
      }
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de ManutenÃ§Ã£o' },
      { path: '/manutencao/atividades', label: 'GestÃ£o de Atividades' }
    ]
  },

  // â”€â”€ Faturamento e Comercial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Nota: entrada principal detalhada definida abaixo (linha ~1139). Esta Ã© uma referÃªncia simplificada.
  '/vendas/itens-faturar-ref': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Itens a Faturar (ReferÃªncia)',
    icon: 'ListOrdered',
    description: 'Consulte a entrada principal desta pÃ¡gina para documentaÃ§Ã£o completa das regras de saldo, programaÃ§Ãµes PCP e fluxo de solicitaÃ§Ã£o de faturamento.',
    steps: [],
    tips: [],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ver documentaÃ§Ã£o completa' },
    ],
  },

  '/comercial/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Controle de Faturamento',
    icon: 'FileText',
    description: 'Painel operacional para expedidores e faturistas tratarem as solicitaÃ§Ãµes criadas pela equipe comercial.',
    steps: [
      'No painel esquerdo, navegue entre as abas "Pendente" (aguardando emissÃ£o da Nota) e "Faturado".',
      'Selecione uma solicitaÃ§Ã£o para carregar os detalhes (itens, quantidades, valores e desenhos) no painel principal.',
      'Preencha o campo "Nota Fiscal (Macro / CabeÃ§alho)" e clique em "Salvar NF". Sem este campo, o sistema bloqueia a transiÃ§Ã£o para Faturado.',
      'FaÃ§a o Check (âœ…) em cada item da lista (obrigatÃ³rio) para confirmar a separaÃ§Ã£o fÃ­sica.',
      'Clique no botÃ£o "Faturado" no cabeÃ§alho para finalizar e travar a ediÃ§Ã£o da remessa.',
      'Use a aba "DiÃ¡rio de Auditoria" no rodapÃ© para visualizar a rastreabilidade completa (quem criou, alterou quantidades ou vinculou NF).'
    ],
    tips: [
      'Para exportar uma romaneio, utilize os botÃµes "Excel" ou "PDF" no canto superior direito do painel da solicitaÃ§Ã£o.',
      'VocÃª pode despachar os XMLs/PDFs tÃ©cnicos automaticamente marcando as faturas e clicando no botÃ£o flutuante "E-mail em Lote".',
      'Somente o usuÃ¡rio que faturou a nota (ou um Administrador) pode reverter o status ou editar quantidades apÃ³s o faturamento.'
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  '/comercial/dashboard-faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Dashboard de Faturamento',
    icon: 'BarChart2',
    description: 'Visão executiva (Analytics) do faturamento da empresa, consolidando as notas emitidas e as metas financeiras mensais.',
    steps: [
      'Acompanhe o velocímetro de "Meta Atingida" e os KPIs principais: Faturamento do Mês, Ticket Médio e Comparativo com mês anterior.',
      'O gráfico "Evolução do Faturamento" plota o faturamento diário contra a Linha de Meta Diária.',
      'O gráfico "Top Clientes" ajuda a identificar concentração de receita (Pareto).',
      'Use o filtro de "Mês/Ano" no topo para analisar o histórico passado do sistema.'
    ],
    tips: [
      'A meta mensal é configurável. Clique no botão de engrenagem próximo ao velocímetro para ajustá-la.',
      'A tabela de "Últimos Faturamentos" na parte inferior permite auditar quais OPs/Pedidos geraram a receita do dia.'
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  '/comercial/atrasos': {
    category: 'Comercial / PCP',
    categoryColor: '#ef4444',
    title: 'Visão Gerencial (Atrasos)',
    icon: 'Target',
    description: 'Espelho dinâmico da fábrica, focado 100% em itens pendentes com data de entrega inferior a hoje.',
    steps: [
      'Escolha a perspectiva no topo: "Logística & Qtds" (foco em peças físicas) ou "Dashboard Financeiro" (foco no Risco em R$).',
      'O painel resume o Total de Itens Atrasados, Quantidade Física Pendente, e a Média de Atraso em dias.',
      'Os gráficos (Top 5 Clientes e Atrasos por Mês) refletem dinamicamente a perspectiva escolhida (Volume vs. Dinheiro).',
      'A tabela "Espelho Dinâmico" agrupa os gargalos em uma hierarquia de: Cliente > Mês de Atraso > Itens Individuais.'
    ],
    tips: [
      'O botão "Gerar PDF (Resumo)" exporta um snapshot da tela para ser usado em reuniões de diretoria.',
      'Você pode abrir e fechar as "pastas" na tabela clicando nas setas (Chevron) ao lado dos clientes e meses para detalhar pedidos e operações paradas.',
      'A visualização "Dashboard Financeiro" é restrita apenas a usuários com permissão "valores_financeiros".'
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  '/visao-geral': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Pedidos de Venda (Visão Geral)',
    icon: 'ShoppingCart',
    description: 'Interface principal de acompanhamento global dos pedidos de venda abertos ou encerrados. Reúne quatro abas especializadas: Listagem Geral, Cronograma Gantt de Pedidos (timeline visual por cliente/produto), Exportação de Materiais PCP e Detalhamento por OP.',
    tabs: [
      {
        id: 'geral',
        label: 'Aba: Listagem Geral',
        description: 'Tabela principal com todos os pedidos de venda.',
        steps: [
          'Busque pedidos específicos utilizando a barra de pesquisa superior (por número de pedido, cliente ou produto).',
          'Utilize os filtros de status para alternar entre pedidos abertos, faturados parcialmente ou totalmente encerrados.',
          'Clique sobre um pedido para expandir os itens atrelados e ver o status de atendimento de cada linha.',
          'Use os filtros de data (Emissão / Entrega / NF) para focar em um período específico de análise.',
          'Exporte a listagem atual clicando no botão Excel no cabeçalho — gera planilha com todos os pedidos filtrados.'
        ]
      },
      {
        id: 'cronograma',
        label: 'Aba: Cronograma (Timeline de Pedidos)',
        description: 'Visualização Gantt dos pedidos de venda agrupados por cliente e produto, com linha do tempo horizontal.',
        steps: [
          'Selecione o período desejado no filtro de datas no topo da aba para definir o intervalo do cronograma.',
          'A linha do tempo exibe cada item de pedido como uma barra horizontal posicionada entre sua data de emissão e data de entrega prevista.',
          'As cores das barras indicam o status: Verde = Entregue, Laranja = Pendente, Vermelho = Atrasado (data de entrega já passou).',
          'Passe o mouse sobre uma barra para ver um tooltip com os detalhes completos: pedido, cliente, produto, quantidade e datas.',
          'Imprimir o Cronograma em PDF (Padrão MetalFisa): Clique no botão "Exportar PDF" (ícone de impressora) no canto superior direito da aba. O sistema gera automaticamente um arquivo .pdf no formato A4 Paisagem (297×210 mm) com:',
          '  — Cabeçalho corporativo MetalFisa com o logo oficial da empresa no bloco azul marinho (RGB 30, 58, 95).',
          '  — Bloco de título cinza com o período coberto pelo cronograma e a data de geração.',
          '  — Tabela de itens com colunas: Pedido, Cliente, Produto, Descrição, Qtd, Unidade, Data Emissão, Data Entrega, Status.',
          '  — Header persistente em todas as páginas: o cabeçalho MetalFisa reaparece automaticamente em cada nova folha do PDF, garantindo identificação corporativa em relatórios de várias páginas.',
          '  — Rodapé com número de páginas (Página X de Y) e identificação do relatório.',
          '  — Linhas alternadas em zebra para facilitar leitura em impressões físicas no chão de fábrica.',
          'O arquivo é baixado automaticamente com o nome no formato: Cronograma_Pedidos_AAAAMMDD_HHMM.pdf'
        ]
      }
    ],
    steps: [
      'Navegue entre as abas no topo: "Pedidos" (listagem geral), "Cronograma" (timeline visual), "Exportação Materiais" e "Detalhamento".',
      'Na aba Cronograma, use o filtro de período para focar nas entregas do mês ou da semana atual.',
      'Use o botão "Exportar PDF" na aba Cronograma para gerar o relatório no padrão corporativo MetalFisa em A4 paisagem.',
    ],
    tips: [
      'A aba Cronograma é ideal para reuniões de planejamento: o PDF gerado já vem formatado com o logo e o cabeçalho MetalFisa, pronto para apresentação.',
      'O PDF do cronograma inclui header persistente — em relatórios com muitas páginas, o cabeçalho MetalFisa aparece em todas as folhas automaticamente.',
      'Esta visão oferece uma perspectiva mais focada no comercial/entrega, diferente do Controle de Produção que foca nas operações fabris.',
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
      { path: '/pcp/exportacao-materiais', label: 'Exportação de Materiais PCP' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  '/pcp-refinado/capacidade': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Cadastro de Capacidade e Tempos (PCP Refinado)',
    icon: 'Layers',
    description: 'Definição do tempo padrão de operação e a capacidade diária por recurso (máquina ou centro de trabalho). Estes valores são a base matemática para o cálculo de carga do CRP.',
    steps: [
      '1. Visão Geral: A tabela lista todos os recursos disponíveis carregados do ERP Protheus.',
      '2. Tempo Padrão: Define quantos minutos (ou fração) a máquina gasta para processar 1 peça/batida.',
      '3. Capacidade Diária: Quantos minutos por dia a máquina está disponível (Ex: 8 horas = 480 minutos).',
    ],
    tips: [
      'Lembre-se de salvar suas alterações: a linha ficará com borda amarela enquanto não for salva.',
      'Recursos com Capacidade = 0 ou Tempo = 0 não vão constar adequadamente nos cálculos de ocupação!',
    ],
    links: [
      { path: '/pcp-refinado/ocupacao', label: 'Ver Taxa de Ocupação' }
    ],
  },

  '/pcp-refinado/ocupacao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Taxa de Ocupação Diária (CRP)',
    icon: 'Activity',
    description: 'Painel visual de análise de carga versus capacidade dos recursos de fábrica (CRP). Ele permite visualizar gargalos de produção dia a dia baseados nas OPs planejadas.',
    steps: [
      '1. Modos de Visualização: Alterne entre Tabela (Detalhado), Mapa de Calor (Visão estendida) ou Gráfico (Gantt) usando os botões superiores.',
      '2. Filtro Pesado: Desative a chave "Apenas Pendentes" para incluir ordens já executadas e faturadas nos dias anteriores.',
      '3. Detalhamento e Ajustes: Clique em "Detalhar OPs" na tabela ou na barra do gráfico para abrir as ordens que compõem a carga do dia. Você pode re-planejar datas individualmente ou em lote.',
      '4. Relatório em PDF: É possível imprimir qualquer uma das visões formatadas para A4.',
    ],
    tips: [
      'Dias em vermelho escuro no Mapa de Calor ou barras que passam de 100% indicam que o recurso está sendo planejado acima da sua capacidade configurada.',
      'Qualquer alteração de data dentro do Detalhamento da OP afeta o planejamento global de imediato.',
    ],
    links: [
      { path: '/pcp-refinado/capacidade', label: 'Ajustar Capacidade (Recursos)' }
    ],
  },

  '/pcp/analytics': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Analytics da Fábrica',
    icon: 'BarChart',
    description: 'Painel gerencial de indicadores de produção, OEE (Overall Equipment Effectiveness) e capacidade instalada.',
    steps: [
      'Acompanhe o painel superior para ver o OEE consolidado da fábrica no período selecionado.',
      'O gráfico de carga máquina mostra os recursos que estão sobrecarregados (gargalos) ou ociosos.',
      'Utilize os filtros de Setor e Data para refinar os gráficos.',
      'Acompanhe a tabela de "Top Rejeições" para entender onde ocorrem as maiores perdas de qualidade.'
    ],
    tips: [
      'O Analytics é atualizado a cada 1 hora com base nos apontamentos de produção e encerramentos de OPs.'
    ],
    links: [
      { path: '/pcp/visao-fabrica', label: 'Visão Global (Fábrica)' },
      { path: '/pcp/evolucao-apontamento', label: 'Evolução dos Apontamentos' },
    ],
  },

  '/ind-apontamento': {
    category: 'Chão de Fábrica',
    categoryColor: '#8b5cf6',
    title: 'Apontamento Fracionado',
    icon: 'CheckSquare',
    description: 'Tela simplificada e otimizada para operadores de máquina realizarem apontamentos de produção em terminais (tablets/monitores).',
    steps: [
      'O operador deve digitar ou bipar o código de barras da OP Fracionada.',
      'O sistema exibirá apenas a operação em que a peça se encontra atualmente.',
      'Informe a Quantidade Produzida, Quantidade Rejeitada (se houver, com motivo), e clique em Registrar.',
      'O registro é imediato e atualiza o saldo da OP na matriz.'
    ],
    tips: [
      'Esta interface tem fontes maiores e botões expandidos para facilitar o uso com luvas ou telas touch.',
      'O sistema impede que o operador aponte uma quantidade superior ao saldo liberado pela operação anterior.'
    ],
    links: [
      { path: '/ind-pcp-release', label: 'Liberação PCP' },
      { path: '/ind-factory-floor', label: 'Painel da Fábrica (Local)' },
    ],
  },

  '/ppaps/buscar-produto': {
    category: 'Qualidade',
    categoryColor: '#ec4899',
    title: 'Buscar Produto (PPAPs)',
    icon: 'Database',
    description: 'Central de busca de Processos de Aprovação de Peças de Produção (PPAP) associados aos produtos.',
    steps: [
      'Digite o código do produto ou referência do cliente.',
      'O sistema retornará o histórico de submissões de PPAP para aquele item.',
      'Visualize o status de aprovação (Aprovado, Reprovado, Aprovado com Desvio) e acesse os documentos atrelados.',
      'Caso não exista um PPAP ativo, inicie uma nova submissão a partir do botão Novo PPAP.'
    ],
    tips: [
      'Produtos que possuem PPAPs expirados ou com desvios vencidos aparecerão com um alerta em vermelho.'
    ],
    links: [
      { path: '/sgq', label: 'Gestão SGQ' },
      { path: '/produtos', label: 'Catálogo de Produtos' },
    ],
  },

  // ————————————————— Gestão de OPs / Pedidos de Venda ———————————————————————————————————————————
  '/comercial/gestao-ops': {
    category: 'Comercial / PCP',
    categoryColor: '#3b82f6',
    title: 'Pedidos de Venda e Gestão de OPs',
    icon: 'List',
    description: 'Interface principal que conecta as vendas (PVs) ao PCP (OPs). Visualize pedidos de clientes, libere ordens de produção, e tenha acesso a todas as opções avançadas de impressão e planejamento de fábrica.',
    steps: [
      'Visão de Tabela: Explore os pedidos abertos usando os filtros no topo (Pesquisa por Número, Cliente, ou Status).',
      'Filtros de Data: Selecione a chave de filtro de data (Emissão, Previsão de OP, ou Entrega) para focar na métrica que importa para o seu departamento.',
      'Menu de Ações (3 Pontinhos): Clique no menu "Mais Ações" na última coluna da tabela para acessar as ferramentas de gestão e impressão.',
      'Aba de Impressões (OPs): Dentro do Menu de Ações, o botão "Imprimir OP..." abre opções ricas: "OP Espelho" (apenas capa simples), "Opção A: OP + Desenhos Agrupados" (folhas de desenho juntas no final), e "Opção B: OP + Desenhos Misturados/Roteirizados" (desenhos intercalados por etapa produtiva).',
      'Impressão do PV (Pedido de Venda): Utilize o botão "Imprimir PV" no Menu de Ações para gerar um PDF com todas as informações do pedido focado na visão comercial.',
      'Ata Viva (Engenharia): O botão "Engenharia / Restrições" abre a trilha de controle de projetos e desenha pendências diretamente ligadas ao item.',
      'Planejamento Sequencial: Clique no ícone de "Planejamento Sequencial" para abrir o Gantt onde você gerencia as datas e durações produtivas do lote.',
    ],
    tips: [
      'O Menu de Ações agora é inteligente e não fica mais cortado pelo fundo da tabela; se o item estiver muito embaixo, o menu abre para cima automaticamente.',
      'O ícone da prancheta laranja sinaliza se o pedido já foi recebido no Totvs / PCP, exibindo o status atual do processamento ao passar o mouse.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Monitor de Faturamento' },
      { path: '/planejamento-gantt', label: 'Planejamento Gantt' },
    ],
  },

  // ————————————————— Catálogo de Produtos ——————————————————————————————————————————————————————
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

  // ————————————————— Estrutura do Produto ——————————————————————————————————————————————————————
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

  // ————————————————— Gerador de BOM ————————————————————————————————————————————————————————————
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

  // ————————————————— Produção ——————————————————————————————————————————————————————————————————
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
      'Modos de Apontamento (Livre, Sequência ou Saldo): Observe o indicador no topo. "Livre" permite apontar qualquer etapa sem amarras; "Sequência" trava o início até que a operação anterior acabe; "Saldo" limita a quantidade máxima ao saldo disponível da operação anterior.',
    ],
    links: [
      { path: '/producao/op', label: 'Detalhes da OP' },
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
    ],
  },

  // ————————————————— OP Detalhes ————————————————————————————————————————————————————————————————
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
      'Modos de Apontamento: O indicador no topo dita a regra da fábrica. "Livre" = Sem amarras. "Sequência" = Obriga concluir a anterior. "Saldo" = Não deixa apontar peças que ainda não passaram pela operação anterior.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ————————————————— Controle de Produção e Lote de Planejamento ——————————————————————————————
  '/controle-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Controle de Produção',
    icon: 'LayoutDashboard',
    description: 'Dashboard principal de PCP para acompanhamento e programação das Ordens de Produção (OPs). Permite filtrar, visualizar o status de cada operação e sequenciar planejamentos em lote com Gantt interativo. Inclui geração de Relatório de Impressão no Padrão Corporativo MetalFisa (PDF A4 Paisagem) com sub-paginação por recurso/máquina.',
    steps: [
      '— FILTROS —',
      'OP: Filtra pelo número EXATO da Ordem de Produção (ex: 005473). Para pesquisar várias OPs de uma vez, separe-as por vírgula.',
      'Item: Filtra pelo número do item dentro da OP (ex: 01). Útil quando uma OP possui múltiplos itens de produto.',
      'Seq: Filtra pelo número de sequência da operação dentro do roteiro da OP (ex: 001, 002). Cada passo do processo de fabricação tem uma sequência.',
      'Produto: Filtra pelo código EXATO do produto (ex: MT2-1783). Para garantir o máximo de performance na pesquisa, não são mais permitidos trechos de descrição.',
      'Pedido: Filtra pelo número EXATO do Pedido de Venda (PV) do cliente no Protheus (ex: 003752).',
      'Cliente: Filtra pelo nome do cliente vinculado ao pedido de venda.',
      'Selecione mÃºltiplas OPs usando os checkboxes. Geralmente selecione OPs do mesmo Recurso/MÃ¡quina para criar um pacote de trabalho coeso.',
      'Com OPs selecionadas, clique em "Sequenciar Planejamento". O modal Gantt abrirÃ¡ com todas as operaÃ§Ãµes agrupadas por recurso.',
      'No Gantt, defina datas, arraste barras, edite duraÃ§Ãµes e escolha entre cÃ¡lculo progressivo (frente) ou regressivo (trÃ¡s). Ao salvar, todas as operaÃ§Ãµes recebem datas planejadas de uma sÃ³ vez.',
      'Clique em "Limpar" para desmarcar todas as OPs selecionadas sem precisar percorrer a lista.',
    ],
    tips: [
      'EstratÃ©gia de uso: Filtre por Recurso especÃ­fico (ex: MO0012) + status "NÃ£o Iniciados" para ver a fila de trabalho daquela mÃ¡quina e planejar em sequÃªncia.',
      'Linhas com fundo azul representam a sequÃªncia 001 (operaÃ§Ã£o raiz do roteiro) â€” em geral Ã© a primeira etapa da fabricaÃ§Ã£o daquele item.',
      'A coluna "ProduÃ§Ã£o" (ex: 6/6) mostra apontamentos jÃ¡ registrados no chÃ£o de fÃ¡brica. Quando chega em 100%, o status vira "ConcluÃ­da" automaticamente.',
      'OperaÃ§Ãµes "Atrasadas" (vermelho) indicam que o prazo de entrega ao cliente jÃ¡ venceu â€” priorize essas no planejamento.',
      'O filtro "Com saldo pendente" Ã© o padrÃ£o recomendado: mantÃ©m a lista limpa, mostrando apenas o que ainda precisa de atenÃ§Ã£o do PCP.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/relatorios', label: 'RelatÃ³rios de ProduÃ§Ã£o' },
    ],
  },

  // â”€â”€ ExportaÃ§Ã£o de Lista de Materiais (PCP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/exportacao-materiais': {
    category: 'PCP / Engenharia',
    categoryColor: '#6366f1',
    title: 'ExportaÃ§Ã£o de Lista de Materiais',
    icon: 'FileSpreadsheet',
    description: 'Esta ferramenta permite compilar todas as matÃ©rias-primas necessÃ¡rias para produzir uma determinada seleÃ§Ã£o de itens de pedido, agrupando itens idÃªnticos e somando quantidades para enviar a compras e ao almoxarifado.',
    steps: [
      'Filtrar Pedidos Pendentes: Utilize a barra de filtros no topo para buscar os pedidos. Por padrÃ£o, ele lista apenas os pedidos com saldo pendente (chave Pendentes). Ao preencher os filtros, clique no botÃ£o Buscar.',
      'Selecionar Itens na Tabela: Marque as caixas de seleÃ§Ã£o na primeira coluna para os produtos que vocÃª deseja produzir. VocÃª pode selecionar um por um, ou usar o botÃ£o Selecionar todos no cabeÃ§alho da tabela.',
      'Processar e Exportar: Assim que selecionar pelo menos 1 item, uma barra flutuante azul aparecerÃ¡ na parte inferior da tela. Clique em Gerar Lista de Materiais.',
      'O Resultado AutomÃ¡tico (Excel): O sistema farÃ¡ a "explosÃ£o" de toda a Ã¡rvore de produtos em segundo plano, atÃ© o Ãºltimo nÃ­vel (matÃ©ria-prima final). EntÃ£o farÃ¡ a multiplicaÃ§Ã£o pela quantidade a faturar do pedido e consolidarÃ¡ todas as matÃ©rias-primas unificando pela descriÃ§Ã£o e cÃ³digo. Um arquivo Excel pronto serÃ¡ baixado automaticamente!',
    ],
    tips: [
      'AtenÃ§Ã£o aos itens destacados em vermelho e com a marcaÃ§Ã£o "Sem estrutura". Itens sem estrutura nÃ£o gerarÃ£o consumo de matÃ©ria-prima na exportaÃ§Ã£o, pois a engenharia nÃ£o cadastrou seus componentes no sistema.',
      'Exemplo PrÃ¡tico de Agrupamento: Se vocÃª selecionou Item A (Qtd: 10) que possui 4 Un de Parafuso e Item B (Qtd: 5) que possui 2 Un do mesmo Parafuso, a planilha listarÃ¡ apenas uma linha para o "Parafuso" com a quantidade total igual a 50 (10x4 + 5x2).',
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'GestÃ£o de OPs' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // â”€â”€ Pedidos de Engenharia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/pedidos': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Ata Viva (Pedidos de Engenharia)',
    icon: 'Ruler',
    description: 'Interface de Ata Viva departamental (PCP/ProduÃ§Ã£o e Engenharia). Esta janela quebra a barreira entre as Ã¡reas, mantendo um log rigoroso do que estÃ¡ em desenvolvimento, pausado ou reprovado pelo PCP.',
    steps: [
      'Apontamento Inteligente (CronÃ´metro): Na coluna de AÃ§Ãµes, o botÃ£o Play â–¶ï¸ dispara o cronÃ´metro do seu usuÃ¡rio para esta tarefa. O sistema fecha/pausa todos os seus outros apontamentos automaticamente. Nada de "esquecer ligado".',
      'Coluna Dupla de Entrega: A tabela exibe sempre lado a lado a "Data Prazo Acordada" e a "Data Real Entregue". Esta matemÃ¡tica alimenta os painÃ©is de diretoria evidenciando gargalos sistÃªmicos de atraso.',
      'PersistÃªncia de VisÃ£o (CustomizaÃ§Ã£o): Arraste as colunas da tabela pelo Header para reordenar. Esconda colunas que vocÃª nÃ£o quer ler no botÃ£o de engrenagem. Tudo isso fica salvo no cache da sua mÃ¡quina e nunca mais se perde.',
      'AdiÃ§Ã£o RÃ¡pida Multi-Filtros: Os botÃµes pÃ­lulas coloridos (Amarelo = Em Processo, Verde = Aprovado) no cabeÃ§alho filtram instantaneamente a pilha.',
    ],
    tips: [
      'SanitizaÃ§Ã£o AutomÃ¡tica: Evite digitar aspas ou caracteres especiais pesados no campo "Resumo/RestriÃ§Ã£o". O motor que sobe os dados pro Totvs os transforma obrigatoriamente para UPPERCASE e os higieniza pra salvar a tabela SZ0 de corrupÃ§Ã£o.',
      'Para apontar horas do passado ou reverter um esquecimento, clique no modal de detalhes engrenagem => aba "Apontamentos â±ï¸" e inclua carga manual fracionÃ¡ria.',
    ],
    links: [
      { path: '/engenharia/relatorio-controle', label: 'Relatórios Nível 1' },
      { path: '/estrutura/:codigo', label: 'Verificar Escopo (Estrutura)' },
    ],
  },

  // ── Formulário SINCO (Integração Totvs) ──────────────────────────────────
  '/engenharia/sinco/formulario': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Formulário SINCO',
    icon: 'FileCode',
    description: 'Interface unificada para construção e manipulação da engenharia do produto diretamente conectada ao ERP Protheus. A partir desta tela, você edita a Estrutura (BOM), o Roteiro de Fabricação e as amarrações de Produto x Cliente (SZ1).',
    steps: [
      '1. Consulta Mestra: No cabeçalho, digite o código do produto (Ex: MT2-1234) e clique em "Buscar" para carregar as informações em tempo real do banco.',
      '2. Árvore do Produto (SG1): Lista de materiais/componentes (BOM). Em modo de Edição, é possível modificar a estrutura, o tipo e a quantidade dos itens, impactando os consumos e empenhos da fábrica.',
      '3. Operações (Roteiro - SG2): Roteirização fabril. Ao editar, ajuste a descrição, mude o tempo de Setup/Padrão (importante para o PCP) e direcione para um novo Recurso (setor/máquina).',
      '4. Produto Metalfisa/Cliente (SZ1): Relaciona o código e nome comercial usados pelo Cliente com o nosso código interno, com controle de Revisão. A busca inteligente de cliente (botão lupa) garante exatidão de cadastro e exibe os principais parceiros por padrão.',
    ],
    tips: [
      'Atenção ao Salvar: Suas modificações nos grids (como incluir linhas ou apagar) só serão validadas e enviadas ao Protheus após o clique no botão "Salvar" referente a cada bloco.',
      'Lupa de Consultas: Os ícones de lupa nas células de Componente, Recurso e Cliente são atalhos super eficientes para pesquisar e carregar dados do banco diretamente na sua célula ativa.',
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Ata Viva' },
      { path: '/produtos', label: 'Catálogo de Produtos' },
    ],
  },

  // â”€â”€ RelatÃ³rio de Controle de Engenharia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/relatorio-controle': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'RelatÃ³rio NÃ­vel 1 (Controle Engenharia)',
    icon: 'FileText',
    description: 'GeraÃ§Ã£o do formato tradicional "RelatÃ³rio NÃ­vel 1" adaptado. Consumo cru, apenas visualizando requisiÃ§Ãµes (SZ0) em status sÃ³lido e Aprovadas para auditoria de entrega.',
    steps: [
      'Filtro RÃ­gido de Aprovados: A tabela traz internamente um hook embutido que descarta O.S reprovadas ou em andamento. SÃ³ aparecem cargas sÃ³lidas prontas.',
      'Consumo Financeiro de HH: Observe as engrenagens de Apontamento - as "Horas Totais" nÃ£o vÃªm secas. Elas agregam a soma do cronÃ´metro automatizado mais todas injeÃ§Ãµes manuais feitas pela equipe em dias passados.',
      'ExportaÃ§Ã£o para XLS: Uma vez com a malha filtrada em tela, clique no botÃ£o para vazar o dado pro Excel que a diretoria usa p/ fechar folha ou precificar OP.',
    ],
    tips: [
      'Para os cÃ¡lculos de HH no Totvs, 0.5h equivale a 30 minutos na vida real. A exportaÃ§Ã£o mantÃ©m o formato de engenharia para multiplicar pelo custo da hora/homem sem erro.',
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Corrigir LanÃ§amento no Pedido' }
    ],
  },

  // â”€â”€ Romaneios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/romaneios': {
    category: 'LogÃ­stica',
    categoryColor: '#ef4444',
    title: 'Romaneios de ExpediÃ§Ã£o',
    icon: 'Truck',
    description: 'Crie e gerencie romaneios de expediÃ§Ã£o de produtos acabados. Controle o que foi enviado, para qual cliente e quando.',
    steps: [
      'Clique em "+ Novo Romaneio" para iniciar uma expediÃ§Ã£o.',
      'Selecione o cliente e o endereÃ§o de entrega.',
      'Adicione os itens a expedir, informando quantidade e lote.',
      'Confirme e imprima o romaneio para acompanhar a carga.',
      'ApÃ³s expediÃ§Ã£o, altere o status para "Enviado".',
    ],
    tips: [
      'Romaneios podem ser exportados em PDF para envio por e-mail ao cliente.',
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  // â”€â”€ Recebimentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/recebimentos': {
    category: 'Materiais',
    categoryColor: '#10b981',
    title: 'Recebimentos de Materiais',
    icon: 'PackageCheck',
    description: 'Registre e acompanhe o recebimento de materiais e componentes. FaÃ§a a conferÃªncia fÃ­sica e libere para o estoque.',
    steps: [
      'Consulte os pedidos de compra pendentes de recebimento.',
      'Selecione o pedido e informe as quantidades recebidas.',
      'Confira os dados da nota fiscal com o que foi pedido.',
      'Confirme o recebimento para dar entrada no estoque.',
    ],
    tips: [
      'Recebimentos parciais sÃ£o permitidos â€” o saldo restante continua em aberto.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
    ],
  },

  // â”€â”€ Saldo de Materiais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/saldo-materiais': {
    category: 'Materiais',
    categoryColor: '#10b981',
    title: 'Saldo de Materiais',
    icon: 'BarChart3',
    description: 'Consulte o saldo de estoque de todos os materiais e componentes. Visualize posiÃ§Ã£o atual, reservas e disponibilidade.',
    steps: [
      'Pesquise pelo cÃ³digo ou descriÃ§Ã£o do material.',
      'Veja o saldo atual, quantidade reservada e saldo disponÃ­vel.',
      'Filtre por tipo de material (MP, PI, PA) para facilitar a anÃ¡lise.',
      'Exporte o saldo para Excel para anÃ¡lise externa.',
    ],
    tips: [
      'Saldo disponÃ­vel = Saldo atual âˆ’ Reservas em OPs abertas.',
      'Itens com saldo negativo indicam necessidade urgente de compra ou recebimento.',
    ],
    links: [
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/solicitacoes-compras', label: 'SolicitaÃ§Ãµes de Compra' },
    ],
  },

  // â”€â”€ SolicitaÃ§Ãµes de Compra â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/solicitacoes-compras': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'SolicitaÃ§Ãµes de Compra',
    icon: 'ShoppingCart',
    description: 'Crie e gerencie solicitaÃ§Ãµes de compra de materiais. Controle o fluxo de aprovaÃ§Ã£o atÃ© a emissÃ£o do pedido de compra.',
    steps: [
      'Clique em "+ Nova SolicitaÃ§Ã£o" para criar uma SC.',
      'Informe o material, quantidade e justificativa.',
      'Submeta para aprovaÃ§Ã£o do responsÃ¡vel.',
      'Acompanhe o status atÃ© a conversÃ£o em Pedido de Compra.',
    ],
    tips: [
      'SolicitaÃ§Ãµes aprovadas sÃ£o automaticamente vinculadas ao pedido de compra.',
    ],
    links: [
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // â”€â”€ Pedidos de Compra â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pedidos-compras-pv': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Pedidos de Compra',
    icon: 'FileText',
    description: 'Gerencie pedidos de compra emitidos para fornecedores. Acompanhe status de entrega e confirme recebimentos.',
    steps: [
      'Pesquise pedidos por nÃºmero, fornecedor ou material.',
      'Clique no pedido para ver todos os itens e condiÃ§Ãµes.',
      'Atualize o status conforme recebimento parcial ou total.',
      'Emita o PDF do pedido para enviar ao fornecedor.',
    ],
    tips: [
      'Pedidos vencidos sÃ£o destacados em vermelho â€” entre em contato com o fornecedor.',
    ],
    links: [
      { path: '/solicitacoes-compras', label: 'SolicitaÃ§Ãµes de Compra' },
      { path: '/recebimentos', label: 'Recebimentos' },
      { path: '/fluxo-compras-nf', label: 'Fluxo Compras / NF' },
    ],
  },

  // â”€â”€ Fluxo Compras / NF â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/fluxo-compras-nf': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'Fluxo Compras / Nota Fiscal',
    icon: 'Receipt',
    description: 'Visualize o fluxo completo de compras desde a solicitaÃ§Ã£o atÃ© a entrada da nota fiscal e recebimento fÃ­sico.',
    steps: [
      'Acompanhe o status de cada etapa: SC â†’ PC â†’ NF â†’ Recebimento.',
      'Filtre por perÃ­odo para anÃ¡lise mensal.',
      'Clique em qualquer etapa para abrir os detalhes.',
    ],
    tips: [
      'Use este mÃ³dulo para identificar gargalos no processo de compras.',
    ],
    links: [
      { path: '/pedidos-compras-pv', label: 'Pedidos de Compra' },
      { path: '/recebimentos', label: 'Recebimentos' },
    ],
  },

  // â”€â”€ Suprimentos / RequisiÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/suprimentos/requisicoes': {
    category: 'Compras',
    categoryColor: '#f97316',
    title: 'RequisiÃ§Ãµes de Suprimentos',
    icon: 'ClipboardCheck',
    description: 'Gerencie as requisiÃ§Ãµes internas de materiais e suprimentos para o chÃ£o de fÃ¡brica.',
    steps: [
      'Crie requisiÃ§Ãµes informando o material, quantidade e destino.',
      'Acompanhe o status de atendimento pela equipe de almoxarifado.',
      'Confirme a entrega fÃ­sica apÃ³s recebimento.',
    ],
    tips: [
      'RequisiÃ§Ãµes urgentes podem ser marcadas com prioridade alta.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/solicitacoes-compras', label: 'SolicitaÃ§Ãµes de Compra' },
    ],
  },

  // â”€â”€ Controle de ProduÃ§Ã£o (entrada duplicada removida â€” mantida acima) â”€â”€â”€â”€â”€â”€â”€â”€

  // â”€â”€ Planejamento Sequencial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/planejamento-sequencial': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Planejamento Sequencial de OPs',
    icon: 'GanttChart',
    description: 'Interface de planejamento refinado e sequencial. Permite agendar as operaÃ§Ãµes de uma Ordem de ProduÃ§Ã£o considerando a duraÃ§Ã£o inclusiva de cada etapa, saltando dias nÃ£o Ãºteis (ou forÃ§ando sÃ¡bados) e criando um encadeamento progressivo ou regressivo.',
    steps: [
      'Escolha a DireÃ§Ã£o do CÃ¡lculo: No topo, defina se o cÃ¡lculo serÃ¡ "Progressivo" (A partir de uma data inicial) ou "Regressivo" (De trÃ¡s para frente, garantindo a data de entrega).',
      'Ajuste o CalendÃ¡rio: Alterne entre "Corridos" (considera todos os dias da semana) ou "Ãšteis" (ignora SÃ¡bado e Domingo). No modo "Ãšteis", vocÃª pode forÃ§ar a inclusÃ£o do SÃ¡bado marcando a caixa "Incluir SÃ¡bado".',
      'Arraste e Solte (Drag & Drop): Clique sobre a faixa colorida de uma operaÃ§Ã£o e arraste para os lados para deslocar livremente aquela etapa.',
      'EdiÃ§Ã£o de DuraÃ§Ã£o: A primeira cÃ©lula de cada barra contÃ©m um pequeno campo numÃ©rico (ex: 3 d). Clique ali para digitar os dias estimados; o grÃ¡fico recalcularÃ¡ o encadeamento das prÃ³ximas etapas automaticamente.',
      'Incluir ServiÃ§os de Terceiro (ST): Marque "Incluir ST" se desejar que serviÃ§os externos travem o fluxo do Gantt, alongando a entrega.',
    ],
    tips: [
      'A linha base em tons acinzentados fica visÃ­vel por trÃ¡s das barras principais, mostrando o planejamento anterior, permitindo comparar a sua simulaÃ§Ã£o atual com o que jÃ¡ estava salvo no banco.',
      'Ao alterar a data de entrega (CÃ¡lculo Regressivo), todas as operaÃ§Ãµes sÃ£o empurradas para trÃ¡s respeitando os dias informados de trÃ¡s pra frente.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Carga MÃ¡quina Total' },
      { path: '/planejamento-gantt', label: 'Gantt Master' },
    ],
  },

  // â”€â”€ Matriz de ProduÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/producao-matrix': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Matriz de ProduÃ§Ã£o',
    icon: 'Grid',
    description: 'Visualize a carga de trabalho por mÃ¡quina/centro de custo em formato de matriz. Identifique sobrecarga e capacidade ociosa.',
    steps: [
      'Selecione o perÃ­odo desejado.',
      'Analise as cÃ©lulas da matriz: cores indicam % de ocupaÃ§Ã£o.',
      'Clique numa cÃ©lula para ver as OPs alocadas naquele centro/perÃ­odo.',
      'Redistribua cargas arrastando OPs entre perÃ­odos, se necessÃ¡rio.',
    ],
    tips: [
      'CÃ©lulas vermelhas indicam sobrecarga â€” revise o planejamento.',
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de ProduÃ§Ã£o' },
      { path: '/planejamento-gantt', label: 'Planejamento Gantt' },
    ],
  },

  // â”€â”€ Apontamento Vertical e Multi-OperaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/apontamento-vertical': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento Vertical & Multi-OperaÃ§Ã£o',
    icon: 'ListChecks',
    description: 'Central Ã¡gil para registro de produÃ§Ã£o. O novo recurso de Apontamento Multi-OperaÃ§Ã£o permite dar baixa sistÃªmica em vÃ¡rias etapas do roteiro de uma sÃ³ vez, ideal para fechar saldos de processos que ocorreram em sequÃªncia.',
    steps: [
      'Busca RÃ¡pida: Utilize os filtros no topo (Pedido, OP, CÃ³digo do Produto ou MÃ¡quina) para localizar exatamente a operaÃ§Ã£o que vocÃª vai apontar.',
      'Abrindo o Modal: Clique no Ã­cone verde de "Apontar" (CheckSquare) na Ãºltima coluna da operaÃ§Ã£o desejada.',
      'Apontamento Multi-OperaÃ§Ã£o: Ao abrir o modal, o sistema nÃ£o exibirÃ¡ apenas a etapa atual. Ele listarÃ¡ todas as operaÃ§Ãµes ANTERIORES do roteiro daquele produto, informando o Saldo (peÃ§as pendentes de apontamento) de cada uma.',
      'Auto-Preenchimento Inteligente (A MÃ¡gica): Quando vocÃª digita uma quantidade na "OperaÃ§Ã£o Atual", o sistema automaticamente preenche as operaÃ§Ãµes anteriores. Ele limita o valor copiado ao mÃ¡ximo permitido pelo Saldo de cada etapa anterior.',
      'Exemplo de Auto-Preenchimento: Se a OperaÃ§Ã£o 10 tem 50 de saldo, a 20 tem 20 de saldo, e a 30 (Atual) tem 50 de saldo. Ao digitar "50" na atual, a etapa 20 serÃ¡ preenchida com "20" (limite dela) e a 10 com "50".',
      'Auditoria de Operador: O seu usuÃ¡rio logado ficarÃ¡ gravado no HistÃ³rico de todas as operaÃ§Ãµes apontadas. PorÃ©m, para as etapas anteriores que foram auto-preenchidas, o sistema gravarÃ¡ seu nome com a tag "(Baixa Auto)", garantindo total transparÃªncia de quem operou a mÃ¡quina versus quem fez a baixa sistÃªmica.',
      'Tempos (CronÃ´metro): VocÃª pode usar o "CronÃ´metro de OperaÃ§Ã£o" no topo para marcar o tempo exato (InÃ­cio e Fim). O mesmo tempo serÃ¡ replicado para as baixas automÃ¡ticas anteriores que ocorrem no mesmo lote.',
    ],
    tips: [
      'Se o valor preenchido automaticamente na etapa anterior ficar com erro (vermelho), Ã© porque ultrapassou o Saldo. O botÃ£o de salvar serÃ¡ bloqueado atÃ© a correÃ§Ã£o.',
      'Para apontar apenas a operaÃ§Ã£o atual sem mexer nas anteriores, basta zerar manualmente os campos das operaÃ§Ãµes anteriores antes de clicar em Confirmar.',
      'Regra de Apontamento: Observe a etiqueta no topo do Modal (Livre, SequÃªncia ou Saldo) para entender as restriÃ§Ãµes impostas pela fÃ¡brica.',
      'ConfiguraÃ§Ã£o das Regras: O recurso de baixar operaÃ§Ãµes em lote pode ser habilitado/desabilitado pelos Administradores no menu "ConfiguraÃ§Ãµes" > aba "Geral", ativando ou nÃ£o o "Apontamento Multi-OperaÃ§Ã£o".',
    ],
    links: [
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
      { path: '/pcp/conferencia', label: 'ConferÃªncia de Apontamentos' },
    ],
  },

  // â”€â”€ Fila e DependÃªncias por Recurso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/fila-dependencias': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Fila e DependÃªncias por Recurso',
    icon: 'ListOrdered',
    description: 'Interface gerencial para acompanhamento dinÃ¢mico das Ordens de ProduÃ§Ã£o alocadas em um recurso (mÃ¡quina/setor). Permite entender rapidamente nÃ£o sÃ³ o que precisa ser feito, mas de onde a peÃ§a vem (origem) e para onde vai (destino).',
    steps: [
      'Escolha do Recurso: Utilize o seletor no topo para definir qual mÃ¡quina ou setor vocÃª quer analisar (ex: Embalagem, Solda).',
      'Aba "Depende de (Inbound)": Foca no que precisa CHEGAR na sua mÃ¡quina. A Ãºltima coluna mostra qual Ã© a operaÃ§Ã£o anterior que estÃ¡ segurando ou fornecendo o material.',
      'Aba "PrÃ³xima Fila (Outbound)": Foca no que vai SAIR da sua mÃ¡quina. A Ãºltima coluna mostra qual Ã© a prÃ³xima etapa que estÃ¡ aguardando o seu trabalho.',
      'Acompanhamento de Progresso: A barra de apontamentos mostra o quanto jÃ¡ foi produzido. Quando a quantidade pendente chega a zero (apÃ³s arredondamento), o status muda automaticamente para "ConcluÃ­da".',
      'AÃ§Ãµes: VocÃª pode visualizar PDFs tÃ©cnicos clicando no Ã­cone do documento (quando em vermelho).',
      'ImpressÃ£o: A pÃ¡gina possui formataÃ§Ã£o otimizada para impressÃ£o em paisagem (A4) utilizando o atalho do navegador (Ctrl+P).'
    ],
    tips: [
      'Pedidos de venda com saldo jÃ¡ finalizado e entregue sÃ£o bloqueados pelo sistema, garantindo que a fila contenha apenas o que Ã© estritamente necessÃ¡rio.',
      'Itens sem pedido de venda associado sÃ£o indicados pela tag "OP de Estoque".'
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de ProduÃ§Ã£o' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' }
    ]
  },

  // â”€â”€ ConferÃªncia de Apontamentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/conferencia': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'ConferÃªncia de Apontamentos',
    icon: 'CheckSquare',
    description: 'Revise e valide os apontamentos de produÃ§Ã£o registrados. Corrija inconsistÃªncias antes do fechamento do perÃ­odo.',
    steps: [
      'Filtre os apontamentos por data e operador.',
      'Revise cada linha e clique em "Aprovar" ou "Rejeitar".',
      'Apontamentos rejeitados retornam para correÃ§Ã£o pelo operador.',
      'Exporte o relatÃ³rio consolidado ao final do perÃ­odo.',
    ],
    tips: [
      'Apontamentos com tempo muito acima da mÃ©dia sÃ£o destacados para revisÃ£o.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/evolucao-apontamento', label: 'EvoluÃ§Ã£o dos Apontamentos' },
    ],
  },

  // â”€â”€ EvoluÃ§Ã£o de Apontamentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/evolucao-apontamento': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'EvoluÃ§Ã£o dos Apontamentos',
    icon: 'TrendingUp',
    description: 'GrÃ¡ficos e tabelas de evoluÃ§Ã£o histÃ³rica dos apontamentos de produÃ§Ã£o por perÃ­odo, operador e operaÃ§Ã£o.',
    steps: [
      'Selecione o perÃ­odo para anÃ¡lise (semana, mÃªs, trimestre).',
      'Filtre por operador ou operaÃ§Ã£o para anÃ¡lises especÃ­ficas.',
      'Analise os grÃ¡ficos de tendÃªncia e volume de produÃ§Ã£o.',
      'Exporte os dados para Excel.',
    ],
    tips: [
      'Compare perÃ­odos diferentes usando o filtro de comparaÃ§Ã£o.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // â”€â”€ Onde Ã© Usado (Where-Used) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/onde-usado': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Onde Ã© Usado (Where-Used)',
    icon: 'Network',
    description: 'Ferramenta de busca reversa para descobrir em quais produtos um determinado componente ou matÃ©ria-prima Ã© utilizado. Essencial para anÃ¡lises de impacto de substituiÃ§Ã£o, engenharia reversa e estudos de custo.',
    steps: [
      'Insira o cÃ³digo do produto ou componente no campo de busca e pressione Enter (ou clique em Buscar).',
      'O sistema varrerÃ¡ a Ã¡rvore de estruturas (BOM) e apresentarÃ¡ o total de usos encontrados.',
      'Os resultados sÃ£o organizados em blocos por NÃ­vel, permitindo que vocÃª veja quÃ£o profundo na estrutura o seu componente estÃ¡ inserido (NÃ­vel 1, 2, etc).',
      'Para cada produto pai listado nos resultados, vocÃª tem a opÃ§Ã£o de acessar diretamente a estrutura daquele produto clicando no botÃ£o azul.',
      'Se o produto pai possuir um desenho tÃ©cnico (PDF) cadastrado, o botÃ£o vermelho de PDF estarÃ¡ disponÃ­vel para visualizaÃ§Ã£o imediata.',
    ],
    tips: [
      'Esta tela Ã© vital antes de descontinuar ou alterar um componente: vocÃª saberÃ¡ exatamente quais produtos finais serÃ£o afetados pela mudanÃ§a tÃ©cnica.',
      'Utilize os botÃµes de atalho em cada card para acessar rapidamente os Desenhos ou a VisÃ£o de Estrutura (BOM) do produto pai.',
    ],
    links: [
      { path: '/produtos', label: 'CatÃ¡logo de Produtos' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // â”€â”€ VisÃ£o de ProduÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/visao-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'VisÃ£o Geral de ProduÃ§Ã£o',
    icon: 'Eye',
    description: 'Dashboard executivo de produÃ§Ã£o com KPIs, OEE e indicadores de desempenho do chÃ£o de fÃ¡brica.',
    steps: [
      'Visualize os KPIs principais: eficiÃªncia, disponibilidade e qualidade.',
      'Clique em qualquer indicador para ver o detalhamento.',
      'Selecione o perÃ­odo de anÃ¡lise no filtro superior.',
    ],
    tips: [
      'Configure metas para cada KPI nas configuraÃ§Ãµes do mÃ³dulo.',
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de ProduÃ§Ã£o' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/analytics/evolucao': {
    category: 'Analytics',
    categoryColor: '#0ea5e9',
    title: 'Analytics â€“ EvoluÃ§Ã£o',
    icon: 'LineChart',
    description: 'AnÃ¡lises avanÃ§adas e grÃ¡ficos de evoluÃ§Ã£o de produÃ§Ã£o, compras, estoque e faturamento.',
    steps: [
      'Selecione o mÃ³dulo de anÃ¡lise desejado (ProduÃ§Ã£o, Compras, Estoque).',
      'Defina o perÃ­odo e a granularidade (diÃ¡rio, semanal, mensal).',
      'Use os filtros para segmentar por produto, cliente ou centro de custo.',
      'Exporte grÃ¡ficos em PNG ou dados em Excel.',
    ],
    tips: [
      'Combine mÃºltiplas sÃ©ries para anÃ¡lise comparativa.',
    ],
    links: [
      { path: '/visao-producao', label: 'VisÃ£o de ProduÃ§Ã£o' },
      { path: '/relatorios', label: 'RelatÃ³rios' },
    ],
  },

  // â”€â”€ Planejamento Gantt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/planejamento-gantt': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Planejamento Gantt',
    icon: 'GanttChart',
    description: 'Visualize e planeje a sequÃªncia de produÃ§Ã£o em formato Gantt. Ajuste datas e prioridades de forma visual e interativa.',
    steps: [
      'As barras representam cada OP com inÃ­cio e fim planejados.',
      'Arraste as barras para reprogramar datas.',
      'Redimensione as barras para ajustar a duraÃ§Ã£o prevista.',
      'Cores indicam status: azul (planejado), verde (em andamento), vermelho (atrasado).',
      'Salve o planejamento clicando em "Confirmar ProgramaÃ§Ã£o".',
    ],
    tips: [
      'Use a visÃ£o por semana para planejamento de curto prazo.',
      'O Gantt respeita as restriÃ§Ãµes de capacidade configuradas.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Matriz de ProduÃ§Ã£o' },
      { path: '/controle-producao', label: 'Controle de ProduÃ§Ã£o' },
    ],
  },

  // â”€â”€ RelatÃ³rios PCP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/relatorios': {
    category: 'RelatÃ³rios / PCP',
    categoryColor: '#6366f1',
    title: 'RelatÃ³rios de ProduÃ§Ã£o e PCP',
    icon: 'FileBarChart',
    description: 'Central de relatÃ³rios gerenciais e operacionais do PCP. ReÃºne trÃªs anÃ¡lises estratÃ©gicas em abas: (1) Espelho de ProduÃ§Ã£o â€” visÃ£o operacional detalhada de cada OP; (2) EvoluÃ§Ã£o por Recurso â€” matriz de progresso produtivo por centro de trabalho e pedido/produto; e (3) Saldo de Estoque â€” posiÃ§Ã£o atual de materiais. Os filtros superiores sÃ£o compartilhados entre as abas e persistem durante a sessÃ£o de navegaÃ§Ã£o.',
    steps: [
      'â”€â”€ ABA: ESPELHO DE PRODUÃ‡ÃƒO â”€â”€',
      'Esta aba exibe, linha a linha, todas as Ordens de ProduÃ§Ã£o (OPs) que se enquadram nos filtros selecionados. Cada linha representa uma OP individual com seus dados completos.',
      'Coluna "OP / Item": CÃ³digo da Ordem de ProduÃ§Ã£o gerada no ERP Protheus (campo C2_NUM + C2_ITEM). Identifica unicamente cada lote de produÃ§Ã£o dentro de um pedido.',
      'Coluna "Produto / DescriÃ§Ã£o": CÃ³digo do produto (C2_PRODUTO) e sua descriÃ§Ã£o comercial registrada no cadastro do item (SB1). Permite identificar o que estÃ¡ sendo produzido.',
      'Coluna "Pedido de Venda (PV)": NÃºmero do pedido de venda (C2_PEDIDO) ao qual esta OP estÃ¡ vinculada. Um PV pode conter mÃºltiplas OPs para diferentes itens ou lotes.',
      'Coluna "Cliente": Nome do cliente final (SA1) para quem o produto serÃ¡ entregue, extraÃ­do automaticamente atravÃ©s do PV vinculado.',
      'Coluna "Qtd Planejada": Quantidade total de peÃ§as a produzir nesta OP conforme planejamento original do ERP (C2_QUANT). Ã‰ a meta de produÃ§Ã£o do lote.',
      'Coluna "Data InÃ­cio Planejada": Data prevista para inÃ­cio da produÃ§Ã£o desta OP no ERP Protheus (C2_DATPRI, formato YYYYMMDD convertido). Representa quando o PCP programou o inÃ­cio do trabalho.',
      'â”€â”€ ABA: EVOLUÃ‡ÃƒO POR RECURSO â”€â”€',
      'Esta Ã© a anÃ¡lise mais estratÃ©gica: uma matriz cruzada onde as LINHAS representam pedidos ou produtos, e as COLUNAS representam cada RECURSO/MÃQUINA/CENTRO DE TRABALHO da fÃ¡brica.',
      'Como ler a matriz: Cada cÃ©lula no cruzamento linha Ã— coluna mostra o progresso de produÃ§Ã£o daquele grupo (pedido/produto) naquele recurso especÃ­fico.',
      'Barra de progresso (dentro de cada cÃ©lula): Representa percentualmente quanto jÃ¡ foi produzido em relaÃ§Ã£o ao total planejado para aquele recurso. Ex: 75% = 750 pÃ§s apontadas de 1000 planejadas. A barra fica verde ao completar 100%.',
      'RÃ³tulo "Plan. DD/MM a DD/MM" (azul): Intervalo de datas planejadas de inÃ­cio para as OPs deste grupo neste recurso, extraÃ­do do campo C2_DATPRI do Protheus. Quando todas as OPs tÃªm a mesma data planejada, aparece data Ãºnica; quando hÃ¡ OPs com datas diferentes (ex: lotes escalonados), aparece o intervalo "01/04 a 15/04", indicando a janela de produÃ§Ã£o prevista.',
      'RÃ³tulo "InÃ­cio DD/MM" (verde): Data real do primeiro apontamento de produÃ§Ã£o registrado no sistema para este recurso neste grupo. Representa quando a fÃ¡brica efetivamente comeÃ§ou a trabalhar neste lote. A diferenÃ§a entre "Plan." e "InÃ­cio" evidencia se a produÃ§Ã£o comeÃ§ou antes, na data ou apÃ³s o planejamento.',
      'CabeÃ§alho da coluna (recurso): Exibe o cÃ³digo do recurso em negrito (ex: MO0002) e abaixo a descriÃ§Ã£o do centro de trabalho ou mÃ¡quina (ex: PUNCIONADEIRA). Esses recursos sÃ£o extraÃ­dos do roteiro de fabricaÃ§Ã£o (SG2/SH1) cadastrado no Protheus.',
      'CÃ©lulas vazias (â€”): Indicam que aquele grupo (pedido/produto) nÃ£o possui operaÃ§Ãµes planejadas ou apontamentos para aquele recurso especÃ­fico. Pode significar que o produto nÃ£o passa por aquela mÃ¡quina.',
      'Arrastar e reorganizar colunas: Clique e arraste o Ã­cone de 6 pontos (â ¿) no cabeÃ§alho de qualquer coluna para reordenar os recursos conforme a sequÃªncia do processo produtivo real da sua fÃ¡brica. A ordem Ã© salva automaticamente por usuÃ¡rio.',
      'BotÃ£o "Salvar Ordem" (admin): Administradores podem salvar a ordem de colunas como padrÃ£o global para todos os usuÃ¡rios da empresa.',
      'BotÃ£o "Resetar Ordem": Retorna a ordem das colunas ao padrÃ£o original (ordenaÃ§Ã£o alfabÃ©tica por cÃ³digo de recurso).',
      'Agrupamento "Agrupar por": Defina se as LINHAS da matriz representarÃ£o Pedidos de Venda (visÃ£o comercial â€” cada linha = 1 cliente/pedido), Produtos (visÃ£o fabril â€” cada linha = 1 cÃ³digo de produto com total acumulado) ou OPs individuais (visÃ£o detalhada â€” cada linha = 1 lote especÃ­fico).',
      'â”€â”€ FILTROS COMPARTILHADOS â”€â”€',
      'Data InÃ­cio / Data Fim: Filtra as OPs pela data planejada de inÃ­cio (C2_DATPRI). Permite focar na programaÃ§Ã£o de um perÃ­odo especÃ­fico, como "ver apenas o que estÃ¡ planejado para abril".',
      'Cliente: Texto livre que filtra pelo nome do cliente. Ãštil para ver toda a carga de produÃ§Ã£o de um cliente especÃ­fico.',
      'Pedido de Venda: NÃºmero exato ou parcial do PV para filtrar um pedido especÃ­fico.',
      'Produto: CÃ³digo ou descriÃ§Ã£o parcial do produto para anÃ¡lises por item.',
    ],
    tips: [
      'InterpretaÃ§Ã£o estratÃ©gica da cÃ©lula: Se "Plan. 01/04 a 15/04" mas "InÃ­cio" estÃ¡ vazio, significa que a produÃ§Ã£o para aquele recurso ainda nÃ£o comeÃ§ou â€” verificar se hÃ¡ atraso ou se o perÃ­odo ainda nÃ£o chegou.',
      'Se "InÃ­cio" for anterior ao "Plan.", a produÃ§Ã£o comeÃ§ou antes do planejado â€” positivo em termos de antecipaÃ§Ã£o.',
      'A barra de progresso usa a quantidade planejada por recurso (baseada no roteiro SG2 Ã— quantidade da OP). Caso o produto nÃ£o tenha roteiro cadastrado, o sistema usa a quantidade total da OP como base.',
      'Produtos sem roteiro de fabricaÃ§Ã£o completo no Protheus (SG2) ainda aparecem na matriz quando possuem apontamentos registrados â€” a data planejada Ã© extraÃ­da diretamente da OP.',
      'A persistÃªncia dos filtros usa sessionStorage: fechar o navegador limpa os filtros; navegar entre pÃ¡ginas dentro do sistema mantÃ©m os valores preenchidos.',
      'Para anÃ¡lises de capacidade de um recurso especÃ­fico, ordene aquela coluna para a esquerda e use agrupamento por "Pedido" para ver todos os clientes aguardando aquela mÃ¡quina.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
      { path: '/producao-matrix', label: 'Matriz de ProduÃ§Ã£o (Carga MÃ¡quina)' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  '/producao/relatorios': {
    category: 'RelatÃ³rios / PCP',
    categoryColor: '#6366f1',
    title: 'RelatÃ³rios de ProduÃ§Ã£o e PCP',
    icon: 'FileBarChart',
    description: 'Acesso alternativo aos relatÃ³rios de produÃ§Ã£o. Consulte a entrada "/relatorios" para documentaÃ§Ã£o completa de todas as abas e campos disponÃ­veis.',
    steps: [
      'Esta rota exibe o mesmo painel da rota /relatorios.',
      'Consulte a ajuda de "/relatorios" para instruÃ§Ãµes detalhadas sobre cada aba, campo e indicador.',
    ],
    tips: [
      'Os filtros persistem ao navegar entre /relatorios e /producao/relatorios dentro da mesma sessÃ£o.',
    ],
    links: [
      { path: '/relatorios', label: 'RelatÃ³rios PCP (Principal)' },
      { path: '/producao-matrix', label: 'Matriz de ProduÃ§Ã£o' },
    ],
  },


  // â”€â”€ ConfiguraÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/configuracoes': {
    category: 'AdministraÃ§Ã£o Core',
    categoryColor: '#64748b', // slate-500
    title: 'Painel de ConfiguraÃ§Ãµes Master',
    icon: 'Settings',
    description: 'Central de controle absoluto do MetalFisa PCP. Aqui o administrador gerencia desde a identidade visual da empresa atÃ© o monitoramento de desempenho dos servidores em tempo real, organizados em abas de fÃ¡cil acesso.',
    steps: [
      'â”€â”€ GERAL â”€â”€',
      'Configura a identidade da empresa (Nome, CNPJ, EndereÃ§o, Telefones e Logo) que sairÃ¡ nos cabeÃ§alhos dos relatÃ³rios em PDF. Aqui tambÃ©m se define a numeraÃ§Ã£o de base para criar os prÃ³ximos Romaneios e o controle global de Apontamento Multi-OperaÃ§Ã£o (permitir ou nÃ£o baixas em lote no chÃ£o de fÃ¡brica).',
      'â”€â”€ VISIBILIDADE DE PEDIDOS â”€â”€',
      'Permite ligar ou desligar a visualizaÃ§Ã£o de status especÃ­ficos de pedidos (ex: "Faturado", "Aguardando ProduÃ§Ã£o"). O interruptor global Master pode ocultar instantaneamente lotes encerrados das tabelas de todo o sistema.',
      'â”€â”€ MENU & NAVEGAÃ‡ÃƒO â”€â”€',
      'Controle modular da plataforma. Ative ou oculte mÃ³dulos e ferramentas do sistema (ex: VMI, ProduÃ§Ã£o, Compras, Almoxarifado) no menu lateral para otimizar a visÃ£o de todos.',
      'â”€â”€ PERFIS DE ACESSO & USUÃRIOS â”€â”€',
      'Em "Perfis de Acesso", crie agrupamentos de cargos (Ex: Operador, Comercial, PCP). Na aba "UsuÃ¡rios", vocÃª cadastra novos funcionÃ¡rios, gera senhas de entrada, bloqueia contas e edita dados bÃ¡sicos.',
      'â”€â”€ APROVAÃ‡Ã•ES PENDENTES â”€â”€',
      'Lista de usuÃ¡rios que solicitaram cadastro via tela de login e estÃ£o bloqueados aguardando a liberaÃ§Ã£o oficial do Administrador para acessar o chÃ£o de fÃ¡brica.',
      'â”€â”€ PERMISSÃ•ES â”€â”€',
      'Matriz fina de seguranÃ§a. Permite ligar chaves de acesso a nÃ­vel microscÃ³pico ("Visualizar", "Editar", "Excluir") tela a tela, de acordo com cada perfil da empresa.',
      'â”€â”€ RELATÃ“RIOS â”€â”€',
      'Configura o motor de envio automÃ¡tico e regras do PCP. Defina os e-mails da diretoria que receberÃ£o o resumo de faturamentos e acompanhamentos da fÃ¡brica automaticamente no fim do dia.',
      'â”€â”€ INTELIGÃŠNCIA ARTIFICIAL â”€â”€',
      'Ajustes do agente autÃ´nomo e do orquestrador de automaÃ§Ãµes sistÃªmicas integrados para suporte inteligente aos colaboradores.',
      'â”€â”€ E-MAIL CORPORATIVO & NOTIFICAÃ‡Ã•ES â”€â”€',
      'Na aba "E-mail Corporativo", configure a conta SMTP de envio. Na aba "NotificaÃ§Ãµes", vocÃª ganha um log de auditoria detalhado de todos os alertas disparados no dia.',
      'â”€â”€ MONITORAMENTO â”€â”€',
      'Painel avanÃ§ado de Observabilidade. Traz dados vitais do servidor como UsuÃ¡rios Conectados (Socket), carga de processador (CPU), MemÃ³ria RAM, sobrecarga do Banco de Dados (Consultas Hora) e trÃ¡fego de Rede. O histÃ³rico retÃ©m a progressÃ£o e permite avaliar gargalos.'
    ],
    tips: [
      'As alteraÃ§Ãµes de PermissÃµes ou Menu de NavegaÃ§Ã£o entram em vigor imediatamente na prÃ³xima requisiÃ§Ã£o do funcionÃ¡rio afetado.',
      'A aba de "Monitoramento" acumula amostras a cada hora. Use-a ativamente para auditar se o seu servidor nÃ£o estÃ¡ sendo sobrecarregado no horÃ¡rio de pico do PCP.'
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda Master' },
      { path: '/sgq/mapeamento-processos', label: 'Gerenciar Ajuda do Sistema' },
    ],
  },

  // â”€â”€ SGQ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq': {
    category: 'GestÃ£o de Qualidade',
    categoryColor: '#14b8a6', // teal-500
    title: 'ISO 9001 - Central de Qualidade',
    icon: 'Award',
    description: 'SuÃ­te completa desenhada seguindo a mÃ©trica da ISO 9001 (Documentos, NÃ£o Conformidades (RNC), AÃ§Ãµes Corretivas e Preventivas e Treinamentos). O Hub gerencial converte planilhas estÃ¡ticas num PDCA dinÃ¢mico.',
    steps: [
      'Ouvidoria de Qualidade: Acompanhe os cards flutuantes. Se houver RNC nÃ£o respondida por um departamento num prazo de SLA (ex: 5 dias para contenÃ§Ã£o), ela brilharÃ¡ em vermelho.',
      'ConvergÃªncia com FabricaÃ§Ã£o: Qualquer peÃ§a reportada como "Refugo" na tela Apontamentos V2 pelo Operador abre automaticamente trilha preenchida neste mÃ³dulo.',
      'Monitoria de Treinamento: Avalie por Organograma (Setor > Gestor > Operador) quais matrizes de habilidade estÃ£o "vencendo" validade e exigem Re-Treinamento.',
    ],
    tips: [
      'A aba de documentos versiona com trava de revisÃ£o. Nunca Ã© possÃ­vel excluir uma matriz antiga, ela cai para o "Obsoleto".',
    ],
    links: [
      { path: '/sgq/mapeamento-processos', label: 'VPOP - Visualizar Fluxo' },
      { path: '/sgq/nao-conformidades', label: 'RNC (Aberturas)' },
    ],
  },

  // â”€â”€ SGQ Mapeamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/mapeamento-processos': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Mapeamento de Processos SGQ',
    icon: 'Map',
    description: 'Visualize e edite os processos do sistema de qualidade. Configure a ajuda contextual de cada tela do sistema.',
    steps: [
      'Selecione uma tela do sistema na lista de processos.',
      'Edite o conteÃºdo de ajuda contextual: descriÃ§Ã£o, passos e dicas.',
      'Salve as alteraÃ§Ãµes para que fiquem disponÃ­veis na ajuda das telas.',
      'Use "Recarregar Ajuda" para ver as mudanÃ§as sem reiniciar o sistema.',
    ],
    tips: [
      'As alteraÃ§Ãµes feitas aqui aparecem instantaneamente na Central de Ajuda.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // â”€â”€ SGQ Documentos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/documentos': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Documentos SGQ',
    icon: 'FolderOpen',
    description: 'RepositÃ³rio de documentos do sistema de gestÃ£o da qualidade: procedimentos, instruÃ§Ãµes de trabalho, formulÃ¡rios e registros.',
    steps: [
      'Navegue pelas categorias de documentos no painel esquerdo.',
      'Use a busca para encontrar documentos por nome ou cÃ³digo.',
      'Clique em um documento para visualizar ou baixar.',
      'FaÃ§a upload de novos documentos pelo botÃ£o "+ Novo Documento".',
      'Controle revisÃµes e histÃ³rico de versÃµes na aba "RevisÃµes".',
    ],
    tips: [
      'Documentos obsoletos sÃ£o arquivados automaticamente ao aprovar nova versÃ£o.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/mapeamento-processos', label: 'Mapeamento de Processos' },
    ],
  },

  // â”€â”€ SGQ NÃ£o Conformidades â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/nao-conformidades': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'NÃ£o Conformidades',
    icon: 'AlertTriangle',
    description: 'Registre, acompanhe e trate nÃ£o conformidades internas e externas. Defina aÃ§Ãµes corretivas e preventivas.',
    steps: [
      'Clique em "+ Registrar NC" para abrir uma nova nÃ£o conformidade.',
      'Descreva o problema, origem e impacto.',
      'Defina as aÃ§Ãµes corretivas e os responsÃ¡veis.',
      'Acompanhe o status atÃ© o fechamento da NC.',
      'Registre a eficÃ¡cia da aÃ§Ã£o apÃ³s implementaÃ§Ã£o.',
    ],
    tips: [
      'NCs abertas hÃ¡ mais de 30 dias sem tratativa sÃ£o destacadas.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/indicadores', label: 'Indicadores SGQ' },
    ],
  },

  // â”€â”€ SGQ Treinamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/treinamento': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Treinamentos',
    icon: 'GraduationCap',
    description: 'Gerencie o programa de treinamento e desenvolvimento de colaboradores. Controle matrizes de competÃªncias e certificaÃ§Ãµes.',
    steps: [
      'Visualize a matriz de treinamentos por colaborador e funÃ§Ã£o.',
      'Registre a realizaÃ§Ã£o de treinamentos com data e participantes.',
      'Gere relatÃ³rios de conformidade de treinamentos.',
      'Configure alertas para treinamentos com prazo de revalidade.',
    ],
    tips: [
      'Treinamentos vencidos sÃ£o destacados em vermelho na matriz.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // â”€â”€ SGQ Auditorias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/auditorias': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Auditorias',
    icon: 'Search',
    description: 'Planeje e gerencie auditorias internas e externas do sistema de qualidade. Registre achados e acompanhe o tratamento.',
    steps: [
      'Crie um plano de auditoria com datas, escopo e auditores.',
      'Registre os achados durante a auditoria.',
      'Classifique: Conformidade, ObservaÃ§Ã£o ou NÃ£o Conformidade.',
      'Defina aÃ§Ãµes de tratamento para cada achado.',
      'Acompanhe o fechamento de todas as pendÃªncias.',
    ],
    tips: [
      'Use o histÃ³rico de auditorias para identificar tendÃªncias de problemas.',
    ],
    links: [
      { path: '/sgq/nao-conformidades', label: 'NÃ£o Conformidades' },
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // â”€â”€ SGQ CalibraÃ§Ãµes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/calibracoes': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'CalibraÃ§Ãµes de Instrumentos',
    icon: 'Wrench',
    description: 'Controle o plano de calibraÃ§Ã£o de instrumentos de mediÃ§Ã£o. Gerencie certificados e alertas de vencimento.',
    steps: [
      'Cadastre os instrumentos com cÃ³digo, descriÃ§Ã£o e periodicidade.',
      'Registre calibraÃ§Ãµes realizadas com data e resultado.',
      'Anexe os certificados de calibraÃ§Ã£o.',
      'Receba alertas automÃ¡ticos antes do vencimento.',
    ],
    tips: [
      'Instrumentos fora do prazo sÃ£o bloqueados automaticamente para uso em mediÃ§Ãµes crÃ­ticas.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
    ],
  },

  // â”€â”€ SGQ Indicadores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/indicadores': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Indicadores SGQ',
    icon: 'BarChart2',
    description: 'Dashboard de indicadores do sistema de gestÃ£o da qualidade. Acompanhe metas e tendÃªncias dos principais KPIs de qualidade.',
    steps: [
      'Visualize os indicadores com metas e resultados atuais.',
      'Filtre por perÃ­odo para anÃ¡lise histÃ³rica.',
      'Clique em um indicador para ver o detalhamento.',
      'Configure metas e limites de alerta em "Editar Indicador".',
    ],
    tips: [
      'Indicadores abaixo da meta aparecem em vermelho com alerta.',
    ],
    links: [
      { path: '/sgq', label: 'SGQ Principal' },
      { path: '/sgq/nao-conformidades', label: 'NÃ£o Conformidades' },
    ],
  },

  // â”€â”€ Avisos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/avisos': {
    category: 'ComunicaÃ§Ã£o',
    categoryColor: '#fbbf24',
    title: 'Avisos e Comunicados',
    icon: 'Bell',
    description: 'Central de comunicados internos da empresa. Publique e visualize avisos importantes para a equipe.',
    steps: [
      'Clique em "+ Novo Aviso" para criar um comunicado.',
      'Defina o tÃ­tulo, conteÃºdo e destinatÃ¡rios (todos ou por setor).',
      'Publique imediatamente ou agende para uma data futura.',
      'Acompanhe quem visualizou o aviso na lista de leituras.',
    ],
    tips: [
      'Avisos urgentes podem ser marcados como "PrioritÃ¡rio" e aparecem em destaque.',
    ],
    links: [],
  },

  // â”€â”€ Vendas / Itens a Faturar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vendas/itens-faturar': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Itens a Faturar',
    icon: 'DollarSign',
    description: 'VisÃ£o consolidada de todos os saldos pendentes de faturamento. Cada linha representa uma programaÃ§Ã£o PCP vinculada a uma OP de produÃ§Ã£o â€” permitindo selecionar itens prontos, ajustar quantidades e gerar solicitaÃ§Ãµes formais de faturamento com rastreabilidade completa.',
    steps: [
      'Entendendo o Saldo a Faturar: A coluna "Saldo" exibe o saldo real do ERP (SC6010: quantidade total do pedido menos o que jÃ¡ foi faturado/entregue). Apenas itens com Saldo > 0 podem ser selecionados. Por padrÃ£o a tela jÃ¡ filtra somente esses itens (toggle "Apenas Pendentes" ativo).',
      'Linhas por ProgramaÃ§Ã£o PCP: Quando um item de pedido possui uma programaÃ§Ã£o PCP registrada, ele aparece como uma linha individual com data de entrega, sÃ©rie do cliente, sÃ©rie MetalFisa, nÂº de sÃ©rie, lote e nÂº lote. Isso significa que um mesmo item pode gerar mÃºltiplas linhas se tiver mÃºltiplas programaÃ§Ãµes â€” cada uma representando um lote ou sÃ©rie distinto a ser faturado.',
      'Filtro "Mostrar Apenas Prontos (Produzidos)": Filtra client-side, exibindo somente linhas onde o Saldo Produzido (quantidade jÃ¡ fabricada pela produÃ§Ã£o) seja maior que zero. Use esse filtro para identificar o que pode ser faturado IMEDIATAMENTE pois jÃ¡ saiu da fÃ¡brica.',
      'Filtro por Data PCP: Use os campos "De/AtÃ©" da seÃ§Ã£o roxa para filtrar por data de entrega programada pelo PCP, independente da data do pedido de venda.',
      'Selecionando Itens: Clique na linha ou no checkbox para selecionar. Uma barra flutuante aparecerÃ¡ no rodapÃ© mostrando quantos itens estÃ£o selecionados e o valor total acumulado. Clique em "AvanÃ§ar e Revisar" para abrir o modal de confirmaÃ§Ã£o.',
      'Revisando no Modal: No modal de revisÃ£o, cada item exibe seu Saldo Faturar (mÃ¡ximo permitido) e um campo "Qtd. Solicitada" editÃ¡vel. O sistema bloqueia quantidades maiores que o saldo disponÃ­vel. Preencha uma observaÃ§Ã£o opcional e clique em "Gerar SolicitaÃ§Ã£o de Faturamento".',
      'SemaforizaÃ§Ã£o (Status): âšª A FATURAR = nenhuma entrega ainda. ðŸŸ  FAT. PARCIAL = jÃ¡ houve faturamento anterior mas ainda resta saldo. ðŸŸ¢ FATURADO 100% = saldo zerado no ERP (normalmente oculto pelo toggle "Apenas Pendentes").',
      'Coluna "Fat. Solicitados": Exibe as solicitaÃ§Ãµes de faturamento jÃ¡ abertas para aquela linha. Use isso para evitar duplicidade: se outro setor jÃ¡ gerou uma solicitaÃ§Ã£o para o mesmo item/programaÃ§Ã£o, vocÃª verÃ¡ o nÃºmero aqui antes de criar uma nova.',
      'Coluna "NFs Anteriores": Mostra os nÃºmeros das Notas Fiscais jÃ¡ emitidas para esse item no ERP. Clique no botÃ£o da NF para ver os detalhes completos (sÃ©rie, chave, datas, valores).',
      'VisualizaÃ§Ã£o de Desenho TÃ©cnico: Se houver PDF cadastrado na nuvem para o produto, o Ã­cone de documento (vermelho) na coluna PDF estarÃ¡ ativo. Clique para abrir o arquivo.',
    ],
    tips: [
      'O Saldo a Faturar vem direto do Protheus (SC6010): Ã© a diferenÃ§a entre c6_qtdven (qtd pedida) e c6_qtdent (qtd jÃ¡ entregue/faturada no ERP). Ele sÃ³ cai apÃ³s a emissÃ£o efetiva da Nota Fiscal no Protheus â€” gerar uma solicitaÃ§Ã£o aqui NÃƒO reduz o saldo imediatamente.',
      'Um pedido com produÃ§Ã£o fracionada em vÃ¡rias OPs aparecerÃ¡ em linhas separadas, uma por OP/programaÃ§Ã£o. Cada linha tem seu prÃ³prio conjunto de dados PCP (sÃ©rie, lote, data de entrega), refletindo exatamente o que o PCP planejou para aquela fraÃ§Ã£o.',
      'Use o filtro por NÂº do Pedido com busca manual (botÃ£o "Buscar Dados") para carregar todos os itens de um pedido especÃ­fico de uma vez â€” o sistema remove a paginaÃ§Ã£o e traz atÃ© 5.000 registros quando o campo Pedido estÃ¡ preenchido.',
      'Para saber se um item jÃ¡ estÃ¡ pronto para faturar: ative "Mostrar Apenas Prontos" e filtre por data PCP. Isso cruza produÃ§Ã£o jÃ¡ executada com a programaÃ§Ã£o comercial, mostrando o que pode sair hoje.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Monitor de NFs (Controle)' },
      { path: '/romaneios', label: 'Romaneios Embalagem' },
      { path: '/comercial/dashboard-faturamento', label: 'Dashboard Gerencial de Faturamento' },
      { path: '/vendas/faturamento-historico', label: 'HistÃ³rico de SolicitaÃ§Ãµes' },
    ],
  },

  // â”€â”€ Comercial / Dashboard Gerencial de Faturamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/comercial/dashboard-faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Dashboard de Faturamento',
    icon: 'PieChart',
    description: 'Cockpit financeiro-operacional em tempo real. LÃª todo o pool de faturamentos pendentes ou efetuados na data, cruza com as Metas de Carregamento da empresa e exibe grÃ¡ficos analÃ­ticos gerenciais.',
    steps: [
      'AnÃ¡lise em Tempo Real (KPIs): No topo estÃ£o os Tickers principais. Eles apontam o Volume de Dinheiro Faturado nas notas VS o Financeiro parado nos caminhÃµes ("Pendente").',
      'Matriz de Status de SolicitaÃ§Ãµes: O grÃ¡fico de Pizza (Donut) Ã  esquerda quebra as estatÃ­sticas, dizendo se o financeiro estÃ¡ travado em "Cancelamentos" ou aguardando "Atendimento".',
      'Ouvidoria de Dados DinÃ¢micos: Todo o teto de gastos da interface muda dinamicamente Ã  medida que vocÃª altera as Datas de CompetÃªncia ou Filtra Clientes na Sidebar de configuraÃ§Ãµes Ã  frente.',
      'Top Clusters: O painel bar graphic exibe o "Top 10" agressores de ranking (seja agrupando por Top 10 Clientes Faturados ou Top Produtos da Linha que renderam o financeiro no recorte).',
    ],
    tips: [
      'O grÃ¡fico de Top 10, quando virado "Por Cliente" no select principal, pode ajudar a diretoria a priorizar o carregamento de carretas na doca logÃ­stica priorizando as OPs mais caras.',
      'Leva alguns milissegundos, mas a tela faz um bypass por todo o legado ERP para validar cancelamentos falsos. O nÃºmero exibido Ã© 100% LÃ­quido e livre de estornos indevidos.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ver Itens a Faturar (Base de Dados)' },
      { path: '/comercial/faturamento', label: 'Ir GestÃ£o de NFs' },
    ],
  },


  // â”€â”€ Comercial / VisÃ£o Gerencial Atrasos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/comercial/atrasos': {
    category: 'Comercial',
    categoryColor: '#ef4444',
    title: 'VisÃ£o Gerencial (Atrasos)',
    icon: 'Target',
    description: 'Espelho da fÃ¡brica com foco em itens pendentes de produÃ§Ã£o e entrega, cuja data de faturamento jÃ¡ encontra-se atrasada em relaÃ§Ã£o Ã  data atual.',
    steps: [
      'Acompanhe o valor de Risco Financeiro pendente (requer permissÃ£o de visualizaÃ§Ã£o financeira).',
      'Use os grÃ¡ficos de Top Clientes e Atrasos por MÃªs para identificar os maiores gargalos.',
      'Acesse a tabela interativa para navegar na hierarquia Cliente > MÃªs > Lista de Itens individuais.',
      'Analise a Data de Entrada versus Data de Entrega para entender o lead time atrasado.',
    ],
    tips: [
      'Use a barra de pesquisa na tabela de espelho dinÃ¢mico para encontrar um produto ou cliente especÃ­fico rapidamente.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
    ],
  },

  // â”€â”€ PCP Geral / VisÃ£o Global (FÃ¡brica Inteira) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/visao-fabrica': {
    category: 'PCP Geral',
    categoryColor: '#4f46e5', // indigo-600
    title: 'VisÃ£o Global (FÃ¡brica Inteira)',
    icon: 'Factory',
    description: 'Painel completo de Business Intelligence reunindo toda a carga fabril agrupada por Quinzenas contendo o futuro (dentro do prazo) e os atrasos (fora do prazo) de produÃ§Ã£o.',
    steps: [
      'Utilize as abas para separar a visÃ£o entre "Entregas Futuras" ou carregamento de "Atrasados".',
      'Abra a aba "Dashboard Financeiro" (se autorizado) para verificar o risco/valor bloqueado na fÃ¡brica.',
      'Clique gradualmente nas Quinzenas para expandÃ­-las, exibindo todos os Produtos, e para cada Produto expanda os Pedidos e Clientes respectivos.',
      'Utilize o botÃ£o "Gerar PDF" para exportar a posiÃ§Ã£o com o KPI do horÃ¡rio que antecede sua reuniÃ£o tÃ¡tica de produÃ§Ã£o.',
      'Use o Snapshot BD para manter o registro perpÃ©tuo que construirÃ¡ sua curva de evoluÃ§Ã£o dos atrasos.',
    ],
    tips: [
      'Na aba de listagem (Tabela), a Ãºltima coluna possui badges dinÃ¢micos (Heatmap de prazo) exibindo exatamente as coloraÃ§Ãµes crÃ­ticas e os dias exatos remanescentes para entrega.',
      'Mesmo na barra expandida existe um filtro RÃ¡pido para vocÃª procurar um Part Number (CÃ³digo) ou Cliente rapidamente.',
    ],
    links: [
      { path: '/comercial/atrasos', label: 'VisÃ£o Comercial de Atrasos' },
    ],
  },

  // â”€â”€ Faturamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/comercial/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Controle de Faturamento',
    icon: 'FileInvoice',
    description: 'Central corporativa de liberaÃ§Ã£o e controle de Faturas e ExpediÃ§Ã£o. Realize a vinculaÃ§Ã£o das NFs e o fechamento ou estorno final de solicitaÃ§Ãµes abertas.',
    steps: [
      'Controle Visual: Utilize a aba de filtros para navegar entre cargas "Pendentes", "Faturadas" ou "Canceladas".',
      'Trava de SeguranÃ§a: Lotes marcados como "Faturado" sofrem congelamento automÃ¡tico. Apenas o usuÃ¡rio que realizou e assinou o fechamento do lote tem permissÃ£o para editÃ¡-lo, remover itens ou estornÃ¡-lo.',
      'Auditoria de AlteraÃ§Ãµes: O painel lateral monitora toda a linha do tempo (timeline) cronolÃ³gica exibindo quem, o quÃª e quando alguma quantidade ou status de faturamento foi reescrito.',
      'O sistema inclui um Agendador Noturno que dispara um RelatÃ³rio Gerencial consolidado via e-mail corporativo (para a equipe cadastrada) sempre Ã s 18h01 com a carga pendente total.',
    ],
    tips: [
      'A automaÃ§Ã£o diÃ¡ria das 18h01 de notificaÃ§Ã£o pode ser desligada caso os e-mails na aba de configuraÃ§Ãµes na tabela da grid sejam removidos.',
      'Caso necessite alterar a Nota Fiscal de um lote travado de outra pessoa, vocÃª precisarÃ¡ pedir que o dono do lote faÃ§a a mudanÃ§a ou reset.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
      { path: '/financeiro/faturamento', label: 'Financeiro / Faturamento' },
    ],
  },

  // â”€â”€ HistÃ³rico de Faturamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vendas/faturamento-historico': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'HistÃ³rico de Faturamento',
    icon: 'History',
    description: 'Consulte o histÃ³rico completo de faturamento por perÃ­odo, cliente e produto.',
    steps: [
      'Defina o perÃ­odo de anÃ¡lise nos filtros de data.',
      'Filtre por cliente, produto ou representante.',
      'Analise os grÃ¡ficos de evoluÃ§Ã£o de faturamento.',
      'Exporte para Excel para anÃ¡lise detalhada.',
    ],
    tips: [
      'Compare o faturamento de diferentes perÃ­odos usando a opÃ§Ã£o de comparaÃ§Ã£o.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/analytics/evolucao', label: 'Analytics' },
    ],
  },

  // â”€â”€ Financeiro / Faturamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/financeiro/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Financeiro â€“ Faturamento',
    icon: 'Wallet',
    description: 'Controle financeiro do faturamento: contas a receber, tÃ­tulos em aberto e fluxo de caixa das vendas.',
    steps: [
      'Visualize os tÃ­tulos em aberto por cliente e vencimento.',
      'Registre baixas de pagamentos recebidos.',
      'Acompanhe o fluxo de caixa previsto e realizado.',
      'Gere relatÃ³rios de inadimplÃªncia e aging.',
    ],
    tips: [
      'TÃ­tulos vencidos hÃ¡ mais de 30 dias sÃ£o destacados em vermelho.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Faturamento' },
      { path: '/relatorios', label: 'RelatÃ³rios' },
    ],
  },

  // â”€â”€ GestÃ£o de Materiais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/gestao-materiais': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'GestÃ£o de Materiais',
    icon: 'Boxes',
    description: 'Planejamento e controle de necessidades de materiais (MRP simplificado). Identifique faltas e excesso de estoque.',
    steps: [
      'Execute o cÃ¡lculo de necessidades para o perÃ­odo selecionado.',
      'Analise os materiais crÃ­ticos (saldo abaixo do mÃ­nimo).',
      'Gere solicitaÃ§Ãµes de compra automaticamente para os itens em falta.',
      'Ajuste os parÃ¢metros de estoques mÃ­nimo e mÃ¡ximo.',
    ],
    tips: [
      'Execute o cÃ¡lculo semanalmente para manter o planejamento atualizado.',
    ],
    links: [
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
      { path: '/solicitacoes-compras', label: 'SolicitaÃ§Ãµes de Compra' },
    ],
  },

  // â”€â”€ Onde Usado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/onde-usado': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Onde Usado',
    icon: 'Search',
    description: 'Pesquise em quais produtos e estruturas um componente ou material Ã© utilizado.',
    steps: [
      'Informe o cÃ³digo ou descriÃ§Ã£o do componente.',
      'O sistema lista todos os produtos que utilizam este componente.',
      'Clique em um produto para abrir a estrutura correspondente.',
      'Exporte a lista para anÃ¡lise de impacto de mudanÃ§as.',
    ],
    tips: [
      'Ãštil para avaliar o impacto de alteraÃ§Ãµes em componentes compartilhados.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/produtos', label: 'CatÃ¡logo de Produtos' },
    ],
  },

  // â”€â”€ SINCO OS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/sinco/os': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Ordens de ServiÃ§o',
    icon: 'FileText',
    description: 'Gerencie as ordens de serviÃ§o de engenharia integradas ao SINCO SolidEdge. Acompanhe desenhos, revisÃµes e aprovaÃ§Ãµes.',
    steps: [
      'Visualize todas as OS abertas e seus status.',
      'Clique em uma OS para ver detalhes e arquivos vinculados.',
      'Aprove ou rejeite desenhos diretamente nesta tela.',
      'Acompanhe o histÃ³rico de revisÃµes de cada documento.',
    ],
    tips: [
      'OS aprovadas sÃ£o automaticamente enviadas para o ERP Protheus.',
    ],
    links: [
      { path: '/engenharia/sinco/estrutura', label: 'SINCO â€“ Estrutura' },
      { path: '/sinco/desenho-ativo', label: 'Desenho Ativo' },
    ],
  },

  // â”€â”€ SINCO Estrutura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/sinco/estrutura': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Estrutura de Produtos',
    icon: 'GitBranch',
    description: 'Visualize e sincronize a estrutura de produtos originada do SolidEdge SINCO com o ERP.',
    steps: [
      'Selecione o produto para visualizar a estrutura sincronizada do SINCO.',
      'Compare com a estrutura atual do ERP para identificar divergÃªncias.',
      'Aprove a sincronizaÃ§Ã£o para atualizar o ERP.',
      'Registre os motivos de alteraÃ§Ãµes para rastreabilidade.',
    ],
    tips: [
      'Sincronize apÃ³s cada revisÃ£o de projeto para manter o ERP atualizado.',
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto' },
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
    ],
  },

  // â”€â”€ SINCO Apontamento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/sinco/apontamento': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Apontamento de Engenharia',
    icon: 'PenTool',
    description: 'Registre apontamentos de horas de engenharia por projeto e OS.',
    steps: [
      'Selecione a OS e a atividade de engenharia.',
      'Informe o engenheiro responsÃ¡vel e as horas trabalhadas.',
      'Confirme o apontamento para atualizar o custo da OS.',
    ],
    tips: [
      'Apontamentos sÃ£o a base para o cÃ¡lculo de custo de desenvolvimento.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
      { path: '/engenharia/sinco/apontamento-matrix', label: 'SINCO â€“ Matrix' },
    ],
  },

  // â”€â”€ SINCO Apontamento Matrix â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/sinco/apontamento-matrix': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Matriz de Apontamentos',
    icon: 'Grid',
    description: 'Visualize a carga de trabalho da equipe de engenharia em formato de matriz.',
    steps: [
      'Selecione o perÃ­odo de anÃ¡lise.',
      'Visualize as horas apontadas por engenheiro e projeto.',
      'Identifique sobrecarga e capacidade disponÃ­vel.',
    ],
    tips: [
      'Use para planejar a alocaÃ§Ã£o de recursos de engenharia.',
    ],
    links: [
      { path: '/engenharia/sinco/apontamento', label: 'SINCO â€“ Apontamento' },
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
    ],
  },

  // â”€â”€ SINCO Materiais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/sinco/materiais': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'SINCO â€“ Materiais de Engenharia',
    icon: 'Package',
    description: 'Gerencie os materiais e componentes utilizados nos projetos de engenharia.',
    steps: [
      'Consulte o consumo de materiais por projeto/OS.',
      'Registre requisiÃ§Ãµes de materiais especiais para projetos.',
      'Acompanhe o status de compra de materiais especificados.',
    ],
    tips: [
      'Materiais especificados em projeto tÃªm prioridade no processo de compras.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
      { path: '/solicitacoes-compras', label: 'SolicitaÃ§Ãµes de Compra' },
    ],
  },

  // â”€â”€ Desenho Ativo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sinco/desenho-ativo': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'Desenho Ativo',
    icon: 'Layers',
    description: 'Consulte e gerencie os desenhos tÃ©cnicos ativos do sistema SINCO SolidEdge.',
    steps: [
      'Pesquise o desenho por cÃ³digo ou descriÃ§Ã£o.',
      'Visualize a revisÃ£o atual e o histÃ³rico de alteraÃ§Ãµes.',
      'FaÃ§a download do arquivo do desenho.',
      'Solicite revisÃ£o clicando em "Nova RevisÃ£o".',
    ],
    tips: [
      'Apenas a revisÃ£o mais recente aprovada Ã© considerada "ativa".',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
      { path: '/engenharia/sinco/estrutura', label: 'SINCO â€“ Estrutura' },
    ],
  },

  // â”€â”€ Apontamento por UsuÃ¡rio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/apontamento-por-usuario': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por UsuÃ¡rio',
    icon: 'User',
    description: 'Visualize e gerencie os apontamentos de produÃ§Ã£o consolidados por operador/usuÃ¡rio.',
    steps: [
      'Selecione o operador e o perÃ­odo de anÃ¡lise.',
      'Visualize todos os apontamentos do operador no perÃ­odo.',
      'Identifique inconsistÃªncias e corrija quando necessÃ¡rio.',
      'Exporte o relatÃ³rio para folha de ponto ou RH.',
    ],
    tips: [
      'Compare a produtividade entre operadores do mesmo turno.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/pcp/conferencia', label: 'ConferÃªncia de Apontamentos' },
    ],
  },

  // â”€â”€ Apontamento por UsuÃ¡rio OP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/apontamento-por-usuario-op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento por UsuÃ¡rio / OP',
    icon: 'UserCheck',
    description: 'Visualize os apontamentos cruzados por usuÃ¡rio e ordem de produÃ§Ã£o.',
    steps: [
      'Selecione o perÃ­odo e os filtros desejados.',
      'Analise a contribuiÃ§Ã£o de cada operador por OP.',
      'Exporte para anÃ¡lise de custo de mÃ£o de obra.',
    ],
    tips: [
      'Use para calcular o custo real de mÃ£o de obra por ordem.',
    ],
    links: [
      { path: '/pcp/apontamento-por-usuario', label: 'Apontamento por UsuÃ¡rio' },
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
    ],
  },

  // â”€â”€ SWorks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sworks': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'SWorks â€“ Shop Floor',
    icon: 'Monitor',
    description: 'Interface de chÃ£o de fÃ¡brica para operadores. Visualize e registre operaÃ§Ãµes de forma simplificada.',
    steps: [
      'O operador faz login com seu cÃ³digo.',
      'Selecione a OP e a operaÃ§Ã£o a executar.',
      'Inicie o timer ao comeÃ§ar a operaÃ§Ã£o.',
      'Finalize registrando a quantidade produzida.',
    ],
    tips: [
      'Interface otimizada para touchscreen e tablets industriais.',
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/controle-producao', label: 'Controle de ProduÃ§Ã£o' },
    ],
  },

  // â”€â”€ VMI Forecast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vmi/forecast': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Monitor de Consumo e PrevisÃµes (Forecast)',
    icon: 'TrendingUp',
    description: 'Interface avanÃ§ada para prever matematicamente a necessidade diÃ¡ria de consumo das montadoras baseada no giro histÃ³rico. Este painel dita o ritmo de reposiÃ§Ã£o da MetalFisa.',
    steps: [
      'VisualizaÃ§Ã£o Mensal/DiÃ¡ria: Navegue entre a "VisÃ£o DiÃ¡ria" (focada nas entregas do dia D e da semana) e a "VisÃ£o Mensal" agregada.',
      'Ajuste SensÃ­vel de PrevisÃ£o: Digite manualmente no input numÃ©rico se o cliente mandou uma quebra de projeÃ§Ã£o forÃ§ada. O sistema vai ignorar a mÃ©dia nativa e vai adotar sua cotaÃ§Ã£o.',
      'ComparaÃ§Ãµes Real vs Desejado: Cada linha de produto exibe o que estava previsto contra o Consumo Efetivo (Baixas por Notas Fiscais ou Reporte de Cliente).',
      'ExportaÃ§Ã£o TÃ¡tica: Utilize o botÃ£o Exportar para gerar um grid em Excel validado que as montadoras utilizam em suas reuniÃµes D-1 de abastecimento.',
    ],
    tips: [
      'MudanÃ§as feitas no forecast sÃ£o rastreadas e o sistema sempre avisa "Atualizado em" com o carimbo do usuÃ¡rio que realizou a Ãºltima sobreposiÃ§Ã£o matemÃ¡tica.',
      'Caso a previsÃ£o seja "zerada" a linha entra em modo ad-hoc (reposologia por pulo).',
    ],
    links: [
      { path: '/vmi/pedido', label: 'Monitor de Pedidos VMI' },
      { path: '/vmi/leitura', label: 'Importador Excel do Cliente' },
    ],
  },

  // â”€â”€ VMI Pedido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vmi/pedido': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Carga de Pedidos VMI e Necessidades',
    icon: 'ShoppingBag',
    description: 'Mesa de operaÃ§Ãµes focada na transformaÃ§Ã£o das projeÃ§Ãµes do fluxo de linha em Pedidos reais (necessidade de carregamento / empurrar estoque pro cliente).',
    steps: [
      'RecepÃ§Ã£o Passiva: Todo cliente VMI que roda seu MRP de planta mandarÃ¡ as ordens de EDI e elas caem neste painel.',
      'ValidaÃ§Ã£o de Cobertura: O botÃ£o verde / amarelo Ã  direita avalia instantaneamente se nÃ³s temos a peÃ§a no almoxarifado interno MetalFisa ou se estamos arriscando Parada de Linha do Cliente.',
      'Gatilho de ProduÃ§Ã£o: Sempre que um componente apresenta defasagem e o indicador Ponto de ReposiÃ§Ã£o estoura, um gatilho envia um "Sinal de FumaÃ§a" direto para a fila do planejamento de fÃ¡brica gerando SugestÃ£o de OP.',
    ],
    tips: [
      'As requisiÃ§Ãµes que caem aqui respeitam a curva ABC do VMI: componentes crÃ­ticos aparecem primeiro!',
      'VocÃª pode gerar faturamento diretamente dessa carga caso o item possua estoque fÃ­sico na planta em Embalagem/Faturamento.',
    ],
    links: [
      { path: '/vmi/forecast', label: 'Verificar Consumo Original' },
      { path: '/vmi/dashboard', label: 'Analisar Riscos no Dashboard' },
    ],
  },

  // â”€â”€ VMI Leitura â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vmi/leitura': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Importador (Leitura) de Excel dos Clientes',
    icon: 'BarcodeScan',
    description: 'Processo super flexÃ­vel para traduzir a planilha dos portais de clientes (CNH, Catterpillar, JD, etc) para a arquitetura do ERP MetalFisa.',
    steps: [
      'ImportaÃ§Ã£o em Duas Etapas: Ao fazer drag-and-drop da planilha de inventÃ¡rio do cliente, a tela primeiro exibe o Modo de PrÃ©-VisualizaÃ§Ã£o das mÃ©tricas. Sem salvar.',
      'IntersecÃ§Ã£o de CÃ³digos: Internamente o mÃ³dulo captura o famoso "Descr do Equipamento" (cÃ³digo descritivo extenso das colunas em texto) e aciona o motor regex.',
      'Expurgo Inteligente: O motor Regex engole os sufixos "-10", "-B", "-ZN" exigidos por clientes e converte pro CÃ³digo Base limpo registrado na aba SC2 da MetalFisa. Nenhuma falha manual entra na base.',
      'BotÃ£o Salvar / Commit: Apenas quando tudo estiver verde/OK e as validaÃ§Ãµes visuais nÃ£o apontarem linhas orfÃ£s, o botÃ£o Salvar grava o bloco de dados validado no sistema.',
    ],
    tips: [
      'Regra 401 de SeguranÃ§a: ApÃ³s o Login e o Auth vencerem (401), se der tela vermelha ou o envio falhar no Console, basta relogar. A API deste mÃ³dulo Ã© rigidamente restrita.',
      'As mensagens de retorno do Importador sÃ£o auditadas num cronÃ´metro.',
    ],
    links: [
      { path: '/vmi/dashboard', label: 'Impactos no Abastecimento' },
    ],
  },

  // â”€â”€ VMI Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vmi/dashboard': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Monitor de SaÃºde Preditiva (Dashboard VMI)',
    icon: 'LayoutDashboard',
    description: 'Dashboard executivo paramÃ©trico que mescla a Cobertura FÃ­sica (Almoxarifado) com a Demanda Futura do Cliente (Forecast). Este Ã© o termÃ´metro principal do programa.',
    steps: [
      'AnÃ¡lise de NÃ­vel de ServiÃ§o (SLA): Visualize o velocÃ­metro apontando o % de saÃºde dos suprimentos VMI em comparaÃ§Ã£o Ã  mÃ©trica do contrato.',
      'Matriz de Cobertura de Estoque: O grÃ¡fico de barras demonstra exatamente quantos DIAS DE SOBREVIVÃŠNCIA o cliente interno tem com o saldo projetado.',
      'GestÃ£o de Crise (Ruptura Eminente): O sistema acenderÃ¡ luzes laranjas e vermelhas nos itens abaixo do Ponto de Ruptura (estoque incapaz de cobrir o lead time da prÃ³xima remessa).',
    ],
    tips: [
      'As caixas e KPIs do dashboard sÃ£o filtrados em tempo real na dropdown do cliente. Ao reportar o status para a CNH, mude o Switch exclusivo deles.',
      'NÃ£o confunda "Ponto de ReposiÃ§Ã£o" (Aviso) com "Estoque MÃ­nimo" (SobrevivÃªncia).',
    ],
    links: [
      { path: '/vmi/forecast', label: 'Injetar Forecast TÃ¡tico' },
      { path: '/vmi/historico', label: 'EvoluÃ§Ã£o do Saldo' },
    ],
  },

  // â”€â”€ VMI EstratÃ©gia â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vmi/estrategia': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'ParametrizaÃ§Ã£o do Motor VMI',
    icon: 'Target',
    description: 'O cÃ©rebro matemÃ¡tico por trÃ¡s dos cÃ¡lculos automatizados. Aqui o Comercial define o grau agressivo de reposiÃ§Ã£o para que o motor crie Pedidos sozinhos.',
    steps: [
      'Aba Lote MÃ­nimo e MÃºltiplo: Informe se o produto sÃ³ pode ser empurrado pro cliente de 10 em 10 peÃ§as (caixas fechadas). O motor irÃ¡ arredondar requisiÃ§Ãµes quebradas pro nÃºmero exato.',
      'Coberturas Desejadas de Estoque (Safety Stock): Defina quantos dias de seguranÃ§a vocÃª deseja manter no teto do Cliente (Max) e o Piso de disparo (Min).',
      'Lead Time (Lead Time SLA): Cadastre aqui os dias que a MetalFisa leva pra injetar peÃ§a no cliente (do frete Ã  produÃ§Ã£o).',
      'PersistÃªncia em Massa: Use o botÃ£o de Salvamento LÃ³gico apÃ³s checar toda a grid. ModificaÃ§Ãµes aqui afetam todas as equaÃ§Ãµes do prÃ³ximo dia.',
    ],
    tips: [
      'As mudanÃ§as nÃ£o sÃ£o retroativas. Elas recalcularÃ£o a Demanda da Carga VMI do dia subsequente ou num ForÃ§ar AtualizaÃ§Ã£o.',
    ],
    links: [
      { path: '/vmi/dashboard', label: 'Painel TÃ¡tico' },
      { path: '/producao/relatorios', label: 'RelatÃ³rios Base' },
    ],
  },

  // â”€â”€ VMI HistÃ³rico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/vmi/historico': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Extrato ContÃ¡bil VMI',
    icon: 'History',
    description: 'Controle de prestaÃ§Ã£o de contas. Esta tela imita o "SaÃ­da e Entrada" bancÃ¡rio para confrontar se as requisiÃ§Ãµes geradas bateram com o que o cliente efetivamente consumiu da nossa carga mensal.',
    steps: [
      'Leitura de Snapshot: As tabelas listarÃ£o por CÃ³digo-RevisÃ£o cada pulso disparado pro cliente e a resposta de consumo da ponta oposta.',
      'InvestigaÃ§Ã£o de DesperdÃ­cio: Verificando "Consumo MÃ©dio" x "Enviado", caso haja discrepÃ¢ncia forte a linha apita para auditoria.',
      'RelatÃ³rios Retrospectivos: Filtre por ano e mÃªs para provar para reuniÃµes operacionais de que houve Abastecimento Full no perÃ­odo.',
    ],
    tips: [
      'Este relatÃ³rio cruza dados da tabela de Leituras (planilhas de estoque deles) fechando no "Liquidado".',
    ],
    links: [
      { path: '/vmi/leitura', label: 'Auditoria da Planilha' },
      { path: '/vendas/itens-faturar', label: 'Cruzar com ERP Interno' },
    ],
  },

  // â”€â”€ Admin Protheus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/admin/protheus-estudo': {
    category: 'AdministraÃ§Ã£o',
    categoryColor: '#64748b',
    title: 'Admin â€“ Protheus (Estudo)',
    icon: 'Database',
    description: 'Ãrea administrativa para anÃ¡lise e estudo de integraÃ§Ã£o com o ERP Protheus.',
    steps: [
      'Acesso restrito a administradores do sistema.',
      'Use para testar e analisar a integraÃ§Ã£o com o Protheus.',
      'Consulte logs de sincronizaÃ§Ã£o e erros de integraÃ§Ã£o.',
    ],
    tips: [
      'Ãrea tÃ©cnica â€” nÃ£o utilize em produÃ§Ã£o sem aprovaÃ§Ã£o.',
    ],
    links: [
      { path: '/configuracoes', label: 'ConfiguraÃ§Ãµes' },
    ],
  },

  // â”€â”€ Financeiro / Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/financeiro/dashboard': {
    category: 'Financeiro',
    categoryColor: '#84cc16',
    title: 'Dashboard Financeiro',
    icon: 'PieChart',
    description: 'VisÃ£o consolidada da saÃºde financeira da empresa. Indicadores de faturamento, recebimentos, inadimplÃªncia e projeÃ§Ãµes.',
    steps: [
      'Selecione o limite de datas ou perÃ­odo (ex: Este Ano).',
      'Verifique os cards superiores com total faturado, saldo a receber e inadimplentes.',
      'Analise o fluxo de caixa consolidado SE1/SE2 nos grÃ¡ficos.',
      'O dashboard possui filtros de competÃªncia que refletem imediatamente em todos os grÃ¡ficos.'
    ],
    tips: [
      'Compare automaticamente o realizado com a previsÃ£o no grÃ¡fico de barras empilhadas.',
    ],
    links: [
      { path: '/financeiro/fluxo-caixa', label: 'Fluxo de Caixa' },
      { path: '/financeiro/faturamento', label: 'Financeiro / Faturamento' },
    ],
  },

  // â”€â”€ Fluxo de Caixa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/financeiro/fluxo-caixa': {
    category: 'Financeiro',
    categoryColor: '#84cc16',
    title: 'Fluxo de Caixa',
    icon: 'ArrowRightLeft',
    description: 'GestÃ£o detalhada do fluxo de caixa e integraÃ§Ã£o com contas a pagar e a receber (SE1/SE2).',
    steps: [
      'Filtre o fluxo pelo horizonte de planejamento desejado.',
      'Verifique as previsÃµes de entrada baseadas em pedidos aprovados e faturamento.',
      'Identifique "furos" de caixa (saldo negativo) nas projeÃ§Ãµes diÃ¡rias.',
      'ExportaÃ§Ã£o da malha do fluxo para anÃ¡lises extras no Excel.'
    ],
    tips: [
      'ProjeÃ§Ãµes sÃ£o atualizadas em tempo real com base no faturamento do ERP.',
    ],
    links: [
      { path: '/financeiro/dashboard', label: 'Dashboard Financeiro' },
    ],
  },

  // â”€â”€ RelatÃ³rio de LiberaÃ§Ãµes (Engenharia) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/relatorio-liberacao': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'RelatÃ³rio de LiberaÃ§Ãµes',
    icon: 'FileCheck',
    tabs: [
      {
        id: 'engenharia',
        label: 'Engenharia (ZEN)',
        description: 'HistÃ³rico tÃ©cnico detalhado de todas as liberaÃ§Ãµes de engenharia realizadas pelo mÃ³dulo Pedidos de Engenharia.',
        steps: [
          'CÃ³digos LEN (Ex: LEN-2024-00001) identificam unicamente cada pacote tÃ©cnico liberado.',
          'Analise a coluna "Modo": "FULL" indica que toda a estrutura e desenhos foram anexados; "NÃVEL 1" indica que apenas o nÃ­vel superior foi liberado.',
          'Rastreabilidade de Destino: Veja para quais e-mails automÃ¡ticos a notificaÃ§Ã£o foi enviada na coluna Detalhes.',
          'Acesso Direto: Clique no Ã­cone de documento Ã  direita para abrir o PDF original salvo automaticamente na rede.'
        ],
        tips: [
          'O modo "NÃ­vel 1" Ã© ideal para revisÃµes rÃ¡pidas onde a estrutura interna nÃ£o sofreu alteraÃ§Ãµes.',
          'Todo registro nesta aba possui um "Audit Trail" imutÃ¡vel, garantindo conformidade com a ISO 9001.'
        ]
      },
      {
        id: 'pcp',
        label: 'PCP / Lotes (LPF)',
        description: 'RelatÃ³rio de agrupamento de Ordens de ProduÃ§Ã£o (AglutinaÃ§Ã£o) para fabricaÃ§Ã£o seriada ou por lotes.',
        steps: [
          'CÃ³digos LPF identificam LiberaÃ§Ãµes PCP de FabricaÃ§Ã£o (Pacotes Aglutinados).',
          'ExpansÃ£o de Lote: Clique na seta lateral (chevron) para ver todas as OPs contidas naquele lote especÃ­fico.',
          'DocumentaÃ§Ã£o Consolidada: O Ã­cone de arquivo verde abre o PDF que contÃ©m o espelho de todas as OPs do lote com seus respectivos desenhos.',
          'VerificaÃ§Ã£o de Datas: A coluna "Data PCP" mostra a data de entrega programada que foi definida no momento da aglutinaÃ§Ã£o.'
        ],
        tips: [
          'LiberaÃ§Ãµes LPF sÃ£o salvas automaticamente na pasta de rede da Engenharia para facilitar o acesso do PCP.',
          'Se uma OP foi aglutinada por erro, o registro histÃ³rico permanecerÃ¡ aqui para auditoria, mesmo que a OP seja cancelada.'
        ]
      },
      {
        id: 'romaneio',
        label: 'Controle Romaneio',
        description: 'GestÃ£o e rastreabilidade de embarques (Packing Lists) vinculados Ã s liberaÃ§Ãµes de engenharia e PCP.',
        steps: [
          'Status em Tempo Real: Acompanhe se o romaneio estÃ¡ em "Aberto", "Conferido" ou "Enviado".',
          'Rastreabilidade (Audit Trail): Visualize o histÃ³rico de quem alterou o status e a data exata da mudanÃ§a.',
          'Busca por Cliente: Utilize o campo de busca geral para localizar romaneios por ID (#) ou nome do cliente.',
          'Acesso ao PDF: Clique no Ã­cone de documento azul na coluna PDF para abrir o romaneio oficial salvo na rede.'
        ],
        tips: [
          'Cada alteraÃ§Ã£o de status gera uma nova revisÃ£o (Rev) automÃ¡tica para auditoria.',
          'O romaneio Ã© o elo final entre a produÃ§Ã£o (PCP) e a entrega ao cliente.'
        ]
      },
      {
        id: 'auditoria',
        label: 'Auditoria & Filtros',
        description: 'Ferramentas avanÃ§adas para busca de registros histÃ³ricos e conformidade tÃ©cnica.',
        steps: [
          'Filtro por Produto: Digite o cÃ³digo de um componente para ver todas as vezes que ele foi liberado ao longo do ano.',
          'Busca por UsuÃ¡rio: Identifique quem foi o responsÃ¡vel tÃ©cnico pela liberaÃ§Ã£o de um determinado projeto.',
          'Limpeza de Filtros: Use o botÃ£o "Limpar" para resetar a visÃ£o e ver as liberaÃ§Ãµes mais recentes no topo.',
          'ExportaÃ§Ã£o: Utilize as ferramentas de sistema para gerar relatÃ³rios em Excel para reuniÃµes de anÃ¡lise crÃ­tica.'
        ],
        tips: [
          'Use o filtro de "Data de" e "Data AtÃ©" para auditorias mensais de produtividade do departamento.',
          'O sistema mantÃ©m logs de quem visualizou ou baixou os arquivos atravÃ©s deste relatÃ³rio.'
        ]
      }
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Pedidos de Engenharia' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
    ],
  },

  // â”€â”€ Vagas de RH â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/rh/vagas': {
    category: 'Recursos Humanos',
    categoryColor: '#f43f5e',
    title: 'GestÃ£o de Vagas',
    icon: 'Briefcase',
    description: 'Portal para abertura, divulgaÃ§Ã£o e fechamento de vagas de emprego do setor de RH.',
    steps: [
      'Clique em "+ Nova Vaga" para criar o descritivo de abertura.',
      'Descreva os requisitos tÃ©cnicos, salÃ¡rio e Ã¡rea de atuaÃ§Ã£o.',
      'Gerencie o status da vaga (Aberta, Em Andamento, Fechada).',
      'Vincule requisiÃ§Ãµes de currÃ­culos diretamente.'
    ],
    tips: [
      'Mantenha os status da vaga atualizados para facilitar o pipeline dos recrutadores.',
    ],
    links: [
      { path: '/rh/curriculos', label: 'AnÃ¡lise de CurrÃ­culos' },
      { path: '/sgq/cargos-funcoes', label: 'Cargos e FunÃ§Ãµes' },
    ],
  },

  // â”€â”€ CurrÃ­culos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/rh/curriculos': {
    category: 'Recursos Humanos',
    categoryColor: '#f43f5e',
    title: 'AnÃ¡lise de CurrÃ­culos',
    icon: 'Users',
    description: 'MÃ³dulo inteligente para submissÃ£o, leitura automatizada (IA) e avaliaÃ§Ã£o de currÃ­culos dos candidatos.',
    steps: [
      'FaÃ§a o upload dos currÃ­culos recebidos no sistema.',
      'Confirme se as informaÃ§Ãµes tabuladas pela InteligÃªncia Artificial estÃ£o coerentes com o arquivo original.',
      'Filtre os currÃ­culos baseados nas competÃªncias de uma vaga prÃ©-cadastrada.',
      'Avalie o candidato com notas nos critÃ©rios e avance o funil.'
    ],
    tips: [
      'A anÃ¡lise de IA otimiza o tempo de leitura incrivelmente: dedique seu tempo com foco redobrado para a entrevista!',
    ],
    links: [
      { path: '/rh/vagas', label: 'GestÃ£o de Vagas' },
    ],
  },

  // â”€â”€ Cargos e FunÃ§Ãµes (SGQ/RH) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/cargos-funcoes': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'Cargos e FunÃ§Ãµes',
    icon: 'Contact',
    description: 'Base de conhecimento e normatizaÃ§Ã£o de descritivos de cargos, funÃ§Ãµes da CBO e organograma corporativo.',
    steps: [
      'Visualize a Ã¡rvore do organograma na interface principal.',
      'Selecione um cargo para definir ou rever a sua "DescriÃ§Ã£o de Cargo".',
      'Vincule quais sÃ£o as funÃ§Ãµes crÃ­ticas do cargo, riscos (EPIs e ambientais) e requisitos.',
      'Aprove o descritivo em revisÃµes rastreadas pelo SGQ.'
    ],
    tips: [
      'Descritivos consolidados frequentemente facilitam o compliance imediato em auditorias da Norma ISO 9001 e de SeguranÃ§a no Trabalho.',
    ],
    links: [
      { path: '/sgq/treinamento', label: 'Treinamentos' },
      { path: '/rh/vagas', label: 'GestÃ£o de Vagas' },
    ],
  },

  // â”€â”€ SINCO - FormulÃ¡rio Principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/engenharia/sinco/formulario': {
    category: 'SINCO / Engenharia',
    categoryColor: '#06b6d4',
    title: 'FormulÃ¡rio SINCO',
    icon: 'FormInput',
    description: 'VisualizaÃ§Ã£o e ediÃ§Ã£o avanÃ§ada de estruturas (BOM), operaÃ§Ãµes e restriÃ§Ãµes integradas ao Protheus.',
    steps: [
      'Edite a "Ãrvore do Produto" clicando em "Editar". O sistema permite alterar quantidades, remover peÃ§as e incluir novos materiais.',
      'Utilize a **Lupa de Busca** ao adicionar um novo componente para pesquisar materiais diretamente no Protheus por cÃ³digo ou descriÃ§Ã£o.',
      'Ao salvar a Ã¡rvore, o sistema executa validaÃ§Ãµes anti-duplicidade e anti-concorrÃªncia para garantir a integridade dos dados no Protheus.',
      'Adicione ou edite restriÃ§Ãµes tÃ©cnicas e acompanhe as macros originadas no Solid Edge.'
    ],
    tips: [
      'A busca pela Lupa exibe atÃ© 50 resultados em tempo real. Digite sempre pelo menos 3 letras ou nÃºmeros.',
      'O sistema bloqueia salvar estruturas caso detecte materiais com quantidade zero ou cÃ³digos nÃ£o cadastrados no Protheus.',
    ],
    links: [
      { path: '/engenharia/sinco/os', label: 'SINCO â€“ OS' },
    ],
  },

  // â”€â”€ Protheus Overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/protheus': {
    category: 'AdministraÃ§Ã£o',
    categoryColor: '#64748b',
    title: 'Protheus Overview',
    icon: 'Database',
    description: 'Dashboard principal de acompanhamento da saÃºde da integraÃ§Ã£o, fila e endpoints do ambiente ERP Protheus e do sistema.',
    steps: [
      'Observe os alertas globais no painel para certificar sua integridade sistÃªmica.',
      'Analise a fila pendente de migraÃ§Ãµes: Estruturas ou apontamentos.',
      'Se for um administrador tÃ©cnico, dispare o reenvio manual para fluxos vitais pendentes por interrupÃ§Ãµes.'
    ],
    tips: [
      'Mantenha comunicaÃ§Ã£o aberta sobre janelas de manutenÃ§Ã£o de infraestrutura para evitar falhas durante altas transaÃ§Ãµes de chÃ£o de fÃ¡brica.',
    ],
    links: [
      { path: '/admin/protheus-estudo', label: 'Admin â€“ Protheus (Estudo)' },
      { path: '/configuracoes', label: 'ConfiguraÃ§Ãµes' },
    ],
  },

  // â”€â”€ Login / Acesso â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/login': {
    category: 'AdministraÃ§Ã£o',
    categoryColor: '#64748b',
    title: 'Portal de Acesso',
    icon: 'LogIn',
    tabs: [
      {
        id: 'acesso',
        label: 'Acesso',
        description: 'Credenciais de acesso ao sistema MetalFisa PCP.',
        steps: [
          'Utilize seu nome de usuÃ¡rio (ex: pcp01) ou e-mail corporativo.',
          'Insira sua senha de seguranÃ§a definida no primeiro acesso.',
          'Clique em "Entrar no Sistema".',
          'A sessÃ£o permanecerÃ¡ ativa enquanto o navegador estiver aberto.'
        ],
        tips: [
          'NÃ£o compartilhe sua senha. Toda aÃ§Ã£o no sistema Ã© rastreada pelo seu login.',
          'Caso erre a senha 5 vezes, sua conta serÃ¡ bloqueada temporariamente.'
        ]
      },
      {
        id: 'recuperacao',
        label: 'RecuperaÃ§Ã£o',
        description: 'Esqueceu sua senha? Veja como recuperar o acesso.',
        steps: [
          'Clique em "Esqueceu a senha?" na tela de login.',
          'Informe seu e-mail corporativo cadastrado (@metalfisa.com.br).',
          'Clique em "Receber Senha por E-mail".',
          'Sua senha atual serÃ¡ enviada imediatamente para sua caixa de entrada.'
        ],
        tips: [
          'Caso nÃ£o receba o e-mail em 2 minutos, verifique sua pasta de SPAM.',
          'Se o problema persistir, entre em contato com o suporte de TI.'
        ]
      },
      {
        id: 'cadastro',
        label: 'Novo UsuÃ¡rio',
        description: 'SolicitaÃ§Ã£o de novo cadastro para colaboradores.',
        steps: [
          'Clique em "Criar Conta" na parte inferior.',
          'Preencha seu nome completo e e-mail corporativo.',
          'Escolha um login fÃ¡cil de lembrar (ex: primeiro nome + sobrenome).',
          'Clique em "Solicitar Cadastro".'
        ],
        tips: [
          'Novos cadastros precisam ser aprovados manualmente pela administraÃ§Ã£o.',
          'VocÃª receberÃ¡ uma notificaÃ§Ã£o quando seu acesso for liberado.'
        ]
      }
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda' },
    ],
  },

  // â”€â”€ Romaneios e Recebimento â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/romaneios': {
    category: 'LogÃ­stica',
    categoryColor: '#8b5cf6',
    title: 'GestÃ£o de Romaneios',
    icon: 'Package',
    description: 'GestÃ£o principal dos Romaneios de Remessa e Retorno de Terceiros.',
    steps: [
      'Esta Ã© a tela principal de listagem de romaneios.',
      'Acesse os detalhes de um romaneio especÃ­fico ou inicie o processo de recebimento clicando no botÃ£o de retorno.'
    ],
    tips: [
      'Filtre os romaneios por status para localizar envios pendentes de devoluÃ§Ã£o.'
    ],
    links: [
      { path: '/recebimentos', label: 'Tela de Recebimentos' },
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' }
    ]
  },

  '/recebimentos': {
    category: 'LogÃ­stica e PCP',
    categoryColor: '#8b5cf6',
    title: 'PÃ¡gina de Recebimentos de Romaneio',
    icon: 'DownloadCloud',
    description: 'Controle detalhado e apontamento de recebimento dos itens fÃ­sicos que retornaram dos serviÃ§os externos ou fornecedores.',
    tabs: [
      {
        id: 'recebimento-basico',
        label: 'Regras de Recebimento',
        description: 'Como funciona a entrada parcial ou total de peÃ§as.',
        steps: [
          'Na lista de itens do romaneio, localize o produto que acabou de chegar fisicamente.',
          'Clique no botÃ£o verde "Receber". O sistema prÃ©-carrega automaticamente o "Saldo Pendente" daquele envio original.',
          'VocÃª pode digitar uma quantidade menor (Recebimento Parcial) caso nÃ£o tenha retornado tudo.',
          'Regra de Quantidade: O sistema bloqueia recebimentos onde a quantidade informada seja superior ao saldo pendente do envio. NÃ£o Ã© possÃ­vel receber mais peÃ§as do que o enviado.'
        ],
        tips: [
          'Se for um recebimento parcial, o item continuarÃ¡ com o status de Pendente atÃ© que todo o saldo seja zerado em recebimentos futuros.',
          'O preenchimento de "Data" vem com a data atual por padrÃ£o, mas pode ser retroativo.'
        ]
      },
      {
        id: 'baixa-automatica',
        label: 'Baixa AutomÃ¡tica na ProduÃ§Ã£o',
        description: 'IntegraÃ§Ã£o em tempo real com as Ordens de ProduÃ§Ã£o do ERP.',
        steps: [
          'Ao abrir o modal de recebimento, vocÃª verÃ¡ um campo opcional chamado "Baixa AutomÃ¡tica na ProduÃ§Ã£o".',
          'Esse campo pesquisa no ERP o roteiro (operaÃ§Ãµes) atrelado a esse produto e a essa Ordem de ProduÃ§Ã£o.',
          'Selecione a operaÃ§Ã£o (ex: PINTURA, SOLDA) onde o item estava. Ao salvar, o sistema farÃ¡ o recebimento fÃ­sico do romaneio E tambÃ©m gravarÃ¡ a quantidade como "produzida" diretamente na OP.',
          'Regra de Saldo da OP: O sistema faz um cÃ¡lculo de seguranÃ§a. Se vocÃª tentar baixar uma quantidade que seja MAIOR do que o saldo que falta fabricar na OP para aquela operaÃ§Ã£o especÃ­fica, a aÃ§Ã£o serÃ¡ bloqueada com Erro 400.'
        ],
        tips: [
          'Se o campo de "Baixa AutomÃ¡tica" nÃ£o mostrar nenhuma operaÃ§Ã£o para selecionar, significa que o item nÃ£o tem um roteiro padrÃ£o cadastrado no ERP, ou a OP jÃ¡ foi finalizada/deletada.',
          'Essa funÃ§Ã£o Ã© opcional. Se deixar em branco, o sistema farÃ¡ apenas o retorno fÃ­sico do romaneio e nÃ£o apontarÃ¡ na OP.',
          'Todos os apontamentos gerados desta forma ficam registrados com a observaÃ§Ã£o "Baixa automÃ¡tica via Retorno de Romaneio".'
        ]
      }
    ],
    links: [
      { path: '/romaneios', label: 'Voltar aos Romaneios' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' }
    ]
  },

  // â”€â”€ Central de Ajuda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/ajuda': {
    category: 'ComunicaÃ§Ã£o',
    categoryColor: '#fbbf24',
    title: 'Central de Ajuda',
    icon: 'HelpCircle',
    description: 'CatÃ¡logo de manuais operacionais e centro de documentaÃ§Ã£o virtual projetada para instruir a funcionalidade das telas.',
    steps: [
      'Pesquise as ferramentas por palavra-chave na tela principal para um acesso intuitivo.',
      'Revise atentamente "O que faz" (Passos e Dicas) para tirar potenciais dÃºvidas ou limitaÃ§Ãµes da interface.',
      'Siga os links secundÃ¡rios para alternar entre relatÃ³rios correlacionados no mesmo departamento.'
    ],
    tips: [
      'Dica mestre: Em qualquer local de acesso, seja onde estiver na plataforma â€” o botÃ£o azul (?) flutuante no canto inferior acessa as mesmas explicaÃ§Ãµes adaptadas contextualmente ao seu monitor focado atual!',
    ],
    links: [
      { path: '/avisos', label: 'Avisos e Comunicados' },
      { path: '/', label: 'Dashboard Principal' },
    ],
  },
  
  // â”€â”€ MÃ³dulo PCP Independente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/ind-pcp-release': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'GestÃ£o de OP Fracionada',
    icon: 'PackagePlus',
    description: 'Interface exclusiva para a fragmentaÃ§Ã£o e liberaÃ§Ã£o isolada de Ordens de ProduÃ§Ã£o (SC2) antes do carregamento industrial. Este mÃ³dulo desvincula a restriÃ§Ã£o do SC2 oficial gravando o loteamento da fÃ¡brica diretamente na base segura local.',
    steps: [
      'AlternÃ¢ncia de VisÃ£o Visual: O painel oferece dois formatos â€“ "HierÃ¡rquico (Ãrvore)", Ãºtil para entender amarraÃ§Ãµes de conjunto, e "Lista Plana", feito para leitura crua de matriz produtiva.',
      'CritÃ©rio de Filtragem (Faturamento): Em ambas as visualizaÃ§Ãµes, a tabela apenas lista e acusa OPs filhas em que o seu Pedido de Venda contiver Saldo Remanescente (Quantidade Faturada menor que Original).',
      'InformaÃ§Ã£o EstratÃ©gica: Visualize a coluna "PrevisÃ£o de Entrega" espelhada diretamente da carga SC6/SC5. Isso ajuda o chÃ£o de fÃ¡brica a processar os pacotes respeitando a viabilidade comercial.',
      'LiberaÃ§Ã£o em Cotes: Utilize a aba de expansÃ£o e clique em "Liberar Qtd Personalizada" para descer uma O.P. de 1000 pÃ§s para um Kanban fabril com apenas 200 pÃ§s, por exemplo. O sistema deduzirÃ¡ o saldo do ERP temporariamente.',
    ],
    tips: [
      'NÃ£o se preocupe em "estragar" o ERP. Esta tela escreve no histÃ³rico da tabela autÃ´noma garantindo que a contagem do SC2 siga Ã­ntegra enquanto o chÃ£o de fÃ¡brica manipula uma O.P fantasma fracionada perfeitamente amarrada.',
      'Utilize os Filtros MultiseleÃ§Ã£o (bolhas acima da tabela) para focar sub-recursos.'
    ],
    links: [
      { path: '/ind-factory-floor', label: 'Kanban do ChÃ£o de FÃ¡brica' },
      { path: '/producao', label: 'O.Ps Tradicionais' },
    ],
  },

  '/ind-factory-floor': {
    category: 'PCP / FÃ¡brica',
    categoryColor: '#10b981', // green-500
    title: 'Apontamento Kanban (ChÃ£o de FÃ¡brica)',
    icon: 'HammerFocus',
    description: 'Tela viva e dinÃ¢mica de apontamentos. Uma vez que as OPs fracionadas sÃ£o geradas pela "GestÃ£o de OP Fracionada", elas caem diretamente neste funil para consumo livre dos operadores em campo.',
    steps: [
      'As OPs abertas ficarÃ£o listadas em esteiras/cartÃµes de acordo com o recurso/operaÃ§Ã£o corrente.',
      'A tela exibirÃ¡ as quantidades jÃ¡ apontadas via terminal e o progresso em relaÃ§Ã£o Ã  meta fracionada.',
      'Os operadores nÃ£o enxergam gargalos do TOTVS; a interface isola as restriÃ§Ãµes logando num banco dinÃ¢mico (com baixa final sincronizada de forma limpa).',
    ],
    tips: [
      'A leitura de CartÃµes na aba Kanban serve para varrer CÃ³digo de Barras dos lotes fÃ­sicos impressos pelo almoxarifado.',
    ],
    links: [
      { path: '/ind-pcp-release', label: 'GestÃ£o de OP Fracionada' },
    ],
  },

  // â”€â”€ ExplosÃ£o BOM + Roteiro (Pull) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/planejamento-estrutura-routing': {
    category: 'PCP / Engenharia',
    categoryColor: '#3b82f6',
    title: 'ExplosÃ£o BOM + Roteiro (Pull System)',
    icon: 'GitMerge',
    description: 'Ferramenta de planejamento estrutural que combina dois dados vitais do Protheus em uma Ãºnica tela: a Lista de Materiais (BOM â€“ SB1/SG1) e o Roteiro de FabricaÃ§Ã£o (SG2/SH1). A partir de qualquer Ordem de ProduÃ§Ã£o, o sistema explode toda a Ã¡rvore de componentes e mapeia quais operaÃ§Ãµes cada peÃ§a exige em quais mÃ¡quinas â€” respondendo de forma imediata Ã  pergunta: "O que precisa ser fabricado primeiro e em qual recurso?"',
    steps: [
      'â”€â”€ ETAPA 1: BUSCA DA OP â”€â”€',
      'NÂº da OP: Digite o nÃºmero exato ou parcial da Ordem de ProduÃ§Ã£o (campo C2_NUM do Protheus). A busca inicia automaticamente apÃ³s 600ms sem digitar (debounce) â€” nÃ£o Ã© necessÃ¡rio pressionar Enter.',
      'NÂº do Pedido: Filtra pelo Pedido de Venda (C2_PEDIDO) vinculado Ã  OP. Ãštil quando se sabe o nÃºmero do pedido do cliente mas nÃ£o o nÃºmero da OP.',
      'Cliente: Nome parcial ou completo do cliente para filtrar apenas as OPs de um cliente especÃ­fico.',
      'Produto / CÃ³digo: CÃ³digo ou parte da descriÃ§Ã£o do produto (C2_PRODUTO / SB1). Permite encontrar OPs de um item especÃ­fico mesmo sem saber o nÃºmero da OP.',
      'Prazo De / Prazo AtÃ©: Intervalo de datas de entrega do pedido. Use para filtrar apenas OPs com vencimento em um determinado perÃ­odo â€” ex: "quero ver tudo que vence essa semana".',
      'Cor do Prazo nos resultados: A data de entrega no resultado Ã© colorida automaticamente â€” VERDE = prazo > 7 dias; AMARELO = 4 a 7 dias; LARANJA = 1 a 3 dias; VERMELHO em negrito = prazo vencido.',
      'Clique em um resultado para carregar a estrutura completa da OP.',
      'â”€â”€ ETAPA 2: CABEÃ‡ALHO DA OP (apÃ³s seleÃ§Ã£o) â”€â”€',
      'NÃºmero da OP: Identificador Ãºnico da ordem no Protheus (ex: 000123). Exibido em destaque no topo.',
      'PV (Pedido de Venda): NÃºmero do pedido comercial ao qual esta OP estÃ¡ vinculada. Clique em "Voltar" para pesquisar outra OP.',
      'Cliente: RazÃ£o social do cliente final extraÃ­da da tabela SA1 via SC5.',
      'Prazo: Data de entrega comprometida com o cliente (SC6 / C6_ENTREG). Colorida pelo mesmo critÃ©rio de urgÃªncia descrito acima.',
      'Conjuntos: Quantos conjuntos/produtos pai a OP possui. OPs complexas com mÃºltiplos itens terÃ£o N conjuntos listados na Ã¡rvore.',
      'â”€â”€ ABA: POR MÃQUINA (VisÃ£o PadrÃ£o) â”€â”€',
      'Esta aba Ã© a mais usada no chÃ£o de fÃ¡brica. Ela agrupa TODAS as operaÃ§Ãµes de TODOS os componentes da OP por RECURSO (mÃ¡quina/centro de custo), criando uma "fila de trabalho" por equipamento.',
      'CabeÃ§alho do card (fundo escuro): Nome do recurso/mÃ¡quina em destaque. O contador Ã  direita mostra quantas tarefas (linhas de operaÃ§Ã£o) aquele equipamento tem nesta OP.',
      'Coluna "Seq": SequÃªncia da operaÃ§Ã£o no roteiro (SG2.G2_SEQUEN). Define a ordem em que as operaÃ§Ãµes devem ser executadas dentro daquela peÃ§a. Importante: duas peÃ§as diferentes podem ter seq=10 na mesma mÃ¡quina â€” elas sÃ£o independentes.',
      'Coluna "PeÃ§a": CÃ³digo e descriÃ§Ã£o do produto que precisa passar por esta mÃ¡quina. O badge "Conj." (azul) indica que Ã© o produto pai (conjunto final); sem badge indica que Ã© um componente filho (peÃ§a prÃ©-fabricada).',
      'Coluna "OperaÃ§Ã£o": DescriÃ§Ã£o da operaÃ§Ã£o a ser executada nesta mÃ¡quina para esta peÃ§a (SG2.G2_DESCRI / operaÃ§Ã£o do roteiro). Ex: "SOLDA MIG", "PUNCIONAMENTO", "PINTURA".',
      'Coluna "Qtd Total" (verde): Quantidade total de peÃ§as que precisam passar por esta operaÃ§Ã£o. Para componentes filhos, o cÃ¡lculo Ã© automÃ¡tico: Qtd_por_pai Ã— Qtd_da_OP. Ex: se o conjunto precisa de 3 suportes e a OP tem 10 conjuntos, a mÃ¡quina precisa processar 30 suportes.',
      'Coluna "Destino": Indica para onde vai a peÃ§a apÃ³s esta operaÃ§Ã£o. "FIM" (cinza) = produto final que vai direto para expediÃ§Ã£o. CÃ³digo em laranja = esta peÃ§a vai ser incorporada ao conjunto identificado por aquele cÃ³digo.',
      'â”€â”€ ABA: ÃRVORE (VisÃ£o HierÃ¡rquica) â”€â”€',
      'Esta aba exibe a estrutura BOM da OP em formato de Ã¡rvore hierÃ¡rquica indentada, espelhando a lista de materiais do Protheus (SG1/SB1).',
      'Card "Conjunto Pai" (borda azul, Ã­cone caixa): Representa o produto final que serÃ¡ entregue ao cliente. Mostra o cÃ³digo, descriÃ§Ã£o e a quantidade total a produzir nesta OP.',
      'Card "Componente Filho" (borda cinza, Ã­cone camadas): Representa uma peÃ§a prÃ©-fabricada que compÃµe o conjunto pai. Mostra a quantidade por unidade do pai (un/pai) â€” multiplicar pela qtd da OP dÃ¡ a quantidade total a fabricar.',
      'Roteiro do card (dentro de cada card): Lista de chips mostrando, em sequÃªncia (01, 02, 03â€¦), quais operaÃ§Ãµes e em qual recurso o produto deve passar. Cada chip tem o nÃºmero de sequÃªncia, o cÃ³digo/nome do recurso e a descriÃ§Ã£o da operaÃ§Ã£o.',
      'Badge laranja "Sem roteiro cadastrado": Aparece quando o produto nÃ£o tem roteiro (SG2) cadastrado no Protheus. Isso pode indicar que a peÃ§a Ã© comprada (nÃ£o fabricada) ou que o cadastro estÃ¡ incompleto.',
      'Aviso "PrÃ©-requisitos â€” fabricar antes de montar o PAI": SeÃ§Ã£o que lista todos os filhos que precisam estar concluÃ­dos ANTES que o roteiro do produto pai (ex: solda final, montagem) possa ser iniciado. Esta Ã© a lÃ³gica pull do sistema.',
      'LÃ³gica de dependÃªncia: A Ã¡rvore evidencia a sequÃªncia de fabricaÃ§Ã£o crÃ­tica. Exemplo: o conjunto "ESTRUTURA SOLDADA" (pai) sÃ³ pode entrar na operaÃ§Ã£o "SOLDA" depois que todos os seus filhos (chapas, cantoneiras, tubos) passaram por suas respectivas operaÃ§Ãµes de corte, dobra e furaÃ§Ã£o.',
    ],
    tips: [
      'Use a aba "Por MÃ¡quina" para responder "o que a PUNCIONADEIRA precisa fazer hoje?". Use a aba "Ãrvore" para entender "quais peÃ§as dependem de quais?".',
      'Se uma mÃ¡quina nÃ£o aparece na aba "Por MÃ¡quina", nenhum produto desta OP tem aquela operaÃ§Ã£o no roteiro SG2 â€” verifique se o roteiro estÃ¡ completo no Protheus.',
      'A "Qtd Total" em verde na visÃ£o por mÃ¡quina jÃ¡ considera a multiplicaÃ§Ã£o de todos os nÃ­veis da BOM â€” nÃ£o Ã© necessÃ¡rio calcular manualmente.',
      'O botÃ£o de Recarregar (Ã­cone circular) no canto superior direito busca os dados mais atualizados do Protheus sem precisar voltar Ã  busca e selecionar a OP novamente.',
      'OPs com prazo VENCIDO (vermelho) devem ser priorizadas. Use o filtro "Prazo AtÃ©: [data de hoje]" para listar somente as atrasadas.',
      'Componentes marcados como "Sem roteiro" que sÃ£o claramente matÃ©rias-primas compradas (ex: parafusos, chapas) sÃ£o normais. Componentes usinados ou soldados sem roteiro indicam necessidade de cadastro no Protheus.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
      { path: '/planejamento-sequencial', label: 'Planejamento Sequencial de OPs' },
    ],
  },

  // â”€â”€ VisÃ£o Gerencial por Setor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/visao-setores': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'VisÃ£o Gerencial por Setor',
    icon: 'PieChart',
    description: 'Painel matricial de acompanhamento da evoluÃ§Ã£o da produÃ§Ã£o organizado por setor fabril. Cada setor agrupa um conjunto de recursos (mÃ¡quinas/centros de custo) cadastrados, e para cada setor Ã© exibida a lista de Ordens de ProduÃ§Ã£o ativas com seu progresso real â€” calculado cruzando o roteiro do Protheus (SC2/SG2) com os apontamentos registrados pelos operadores no sistema (app_production_appointments). Este painel responde de imediato: "Onde estamos com cada OP, setor a setor?"',
    steps: [
      'â”€â”€ FILTROS DE BUSCA â”€â”€',
      'NÂº do Pedido: Filtra as OPs pelo nÃºmero do Pedido de Venda (C2_PEDIDO) ou pelo nÃºmero da OP (C2_NUM) no Protheus. Use para monitorar um pedido especÃ­fico de cliente em todos os setores simultaneamente.',
      'Cliente: Nome parcial ou completo do cliente. Mostra apenas as OPs vinculadas ao cliente informado.',
      'Produto: CÃ³digo ou descriÃ§Ã£o do produto fabricado (C2_PRODUTO). Permite focar em um item especÃ­fico em toda a fÃ¡brica.',
      'Data InÃ­cio / Data Fim: Filtra OPs pela data planejada de inÃ­cio (C2_DATPRI). Use para ver a carga de um perÃ­odo especÃ­fico.',
      'Apenas Pendentes (chave): Quando ativado, oculta OPs onde a quantidade jÃ¡ produzida (C2_QUJE) atingiu a quantidade total (C2_QUANT). MantÃ©m o foco somente no que ainda estÃ¡ em aberto.',
      'Clique em "Buscar" ou pressione Enter para aplicar os filtros.',
      'â”€â”€ CARDS DE SETOR â”€â”€',
      'Cada card representa um Setor Fabril cadastrado (ex: PreparaÃ§Ã£o, Solda, Pintura). O cabeÃ§alho do card exibe o nome do setor na cor configurada e os KPIs consolidados.',
      'KPI "Total": Quantidade total de OPs (itens Ãºnicos op + item) que possuem pelo menos uma operaÃ§Ã£o naquele setor.',
      'KPI "ConcluÃ­das": OPs cujo progresso atingiu 100% em todas as operaÃ§Ãµes do setor.',
      'KPI "Em Andamento": OPs com progresso entre 1% e 99% â€” produÃ§Ã£o iniciada mas nÃ£o finalizada.',
      'KPI "Atrasadas": OPs em andamento cuja data de entrega do pedido (SC6/C6_ENTREG) jÃ¡ passou.',
      'Barra de progresso do setor: MÃ©dia ponderada do progresso de todas as OPs do setor, calculada como (soma das peÃ§as apontadas) Ã· (soma das peÃ§as esperadas) Ã— 100.',
      'â”€â”€ TABELA DE OPs POR SETOR â”€â”€',
      'Coluna "OP / Item": NÃºmero da Ordem de ProduÃ§Ã£o + nÃºmero do item (ex: 004155/01). Identifica unicamente cada conjunto a ser fabricado.',
      'Coluna "Pedido": NÃºmero do Pedido de Venda (C2_PEDIDO) ao qual a OP estÃ¡ vinculada.',
      'Coluna "Produto": CÃ³digo e descriÃ§Ã£o do produto a fabricar (C2_PRODUTO / SB1.B1_DESC).',
      'Coluna "Cliente": RazÃ£o social do cliente final (SA1/SC5).',
      'Coluna "Prazo": Data de entrega comprometida com o cliente (SC6.C6_ENTREG). Colorida por urgÃªncia: VERDE = mais de 7 dias; AMARELO = 4 a 7 dias; LARANJA = 1 a 3 dias; VERMELHO = prazo vencido.',
      'Coluna "Qtd Total": Quantidade de peÃ§as a produzir nessa OP/item (C2_QUANT).',
      'Coluna "Esperado no Setor": Total de peÃ§as que devem passar pelas operaÃ§Ãµes deste setor. Calculado como: Qtd_Total Ã— NÃºmero_de_OperaÃ§Ãµes_no_Setor.',
      'Coluna "Apontado no Setor": Soma real das quantidades jÃ¡ apontadas pelos operadores para as operaÃ§Ãµes deste setor, extraÃ­da da tabela app_production_appointments.',
      'Coluna "Progresso": Percentual de conclusÃ£o da OP neste setor especÃ­fico = (Apontado Ã· Esperado) Ã— 100. A barra colorida facilita a leitura visual.',
      'Coluna "Status": Indicador visual do estado da OP â€” "Aguardando" (sem nenhum apontamento), "Em Andamento" (entre 1% e 99%), "ConcluÃ­da" (100%) ou "Atrasada" (em andamento + prazo vencido).',
      'â”€â”€ CARD "SETOR NÃƒO DEFINIDO" â”€â”€',
      'Exibido ao final da lista quando existem recursos no Protheus (SG2) que ainda nÃ£o foram vinculados a nenhum setor no cadastro de Setores. OPs que passam exclusivamente por esses recursos aparecem aqui.',
      'Identifique os recursos listados em "Recursos sem setor" e acesse "PCP â†’ Setores â†’ Recursos" para vinculÃ¡-los ao setor correto.',
      'â”€â”€ CÃLCULO DO PROGRESSO â”€â”€',
      'O progresso Ã© calculado 100% a partir dos dados reais de apontamento do sistema â€” nÃ£o usa dados do Protheus (SH6). Cada operaÃ§Ã£o de cada OP tem sua quantidade apontada somada; o resultado Ã© dividido pelo total esperado (Qtd_OP Ã— nÂº de operaÃ§Ãµes do setor).',
      'Exemplo: OP 004155/01, Qtd=3, passando por 2 operaÃ§Ãµes no setor Solda â†’ Esperado=6 peÃ§as. Se foram apontadas 3 â†’ Progresso=50%.',
    ],
    tips: [
      'Use o filtro "Apenas Pendentes" para focar a atenÃ§Ã£o somente no que ainda precisa ser feito â€” OPs 100% concluÃ­das sÃ£o ocultadas automaticamente.',
      'OPs com status "Atrasado" (vermelho) devem ser priorizadas. Acione o PCP para replanejamento imediato.',
      'Se uma OP nÃ£o aparece em nenhum setor, verifique se o produto possui roteiro (SG2) cadastrado no Protheus â€” sem roteiro, nÃ£o hÃ¡ operaÃ§Ãµes para vincular a recursos/setores.',
      'O card "Setor NÃ£o Definido" Ã© um sinal de aÃ§Ã£o: vincule os recursos listados ao setor correto em "PCP â†’ Setores â†’ Recursos" para que as OPs apareÃ§am no painel correto.',
      'O progresso exibido aqui Ã© calculado com dados reais do sistema (app_production_appointments) â€” nÃ£o Ã© uma estimativa. Ele reflete exatamente o que os operadores apontaram.',
      'Cada setor pode ter N recursos (mÃ¡quinas). Uma OP aparece em um setor se ao menos um dos seus recursos estiver vinculado Ã quele setor. A barra mostra o progresso mÃ©dio em todas as operaÃ§Ãµes desse setor.',
      'Use este painel para identificar gargalos: um setor com progresso mÃ©dio muito baixo enquanto os demais avanÃ§am indica acÃºmulo de trabalho â€” redistribua carga ou acione gestÃ£o.',
    ],
    links: [
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/setores/recursos', label: 'VinculaÃ§Ã£o de Recursos aos Setores' },
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
      { path: '/producao/relatorios', label: 'RelatÃ³rios de ProduÃ§Ã£o' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
    ],
  },

  // â”€â”€ Cadastro de Setores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/setores': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Cadastro de Setores Produtivos',
    icon: 'Landmark',
    description: 'Gerencie os Setores Fabris da fÃ¡brica MetalFisa. Um Setor agrupa mÃ¡quinas e centros de custo (Recursos) do Protheus sob um rÃ³tulo visual e operacional â€” por exemplo: "Solda", "Corte a Laser", "Pintura", "Montagem Final". Esta classificaÃ§Ã£o alimenta diretamente o painel "VisÃ£o Gerencial por Setor" e o relatÃ³rio de progresso por setor. Sem Setores configurados, a VisÃ£o Gerencial nÃ£o consegue agrupar as OPs corretamente.',
    steps: [
      'â”€â”€ COMO CRIAR UM NOVO SETOR â”€â”€',
      'BotÃ£o "Novo Setor" (azul, canto superior direito): Clique para abrir o modal de criaÃ§Ã£o. Preencha os campos e confirme.',
      'Campo "Nome do Setor" (obrigatÃ³rio): Digite o nome que identifica o setor na fÃ¡brica. Exemplos: "Solda MIG", "Corte a Laser", "Montagem". Este nome aparecerÃ¡ nos cards do painel VisÃ£o por Setor e nas listagens de recursos. MÃ¡ximo recomendado: 30 caracteres para nÃ£o truncar nas telas menores.',
      'Campo "DescriÃ§Ã£o" (opcional): Texto livre descrevendo a funÃ§Ã£o do setor, quais produtos passam por ele, turno de operaÃ§Ã£o, etc. Aparece em itÃ¡lico abaixo do nome do setor na listagem. Use para dar contexto ao PCP e gestores sobre o escopo do setor.',
      'Campo "Cor do Setor": Escolha entre as 10 cores prÃ©-definidas (bolinhas coloridas) ou clique no seletor de cor personalizado (quadrinho com gradiente) para escolher qualquer cor em hexadecimal. A cor Ã© usada como indicador visual em toda a plataforma â€” cards da VisÃ£o por Setor, barra lateral da listagem e indicadores na tela de Recursos. Use cores distintas para setores prÃ³ximos na linha de produÃ§Ã£o para facilitar a leitura visual.',
      'Preview em tempo real: Abaixo dos seletores de cor, uma linha mostra exatamente como o setor aparecerÃ¡ na interface â€” bolinha colorida + nome. Isso permite validar a legibilidade antes de salvar.',
      'BotÃ£o "Criar Setor" (azul): Confirma a criaÃ§Ã£o. O sistema salva no banco e recarrega a lista automaticamente. Caso o nome jÃ¡ exista, um erro serÃ¡ exibido.',
      'BotÃ£o "Cancelar": Fecha o modal sem salvar nenhuma alteraÃ§Ã£o.',
      'â”€â”€ LISTA DE SETORES â”€â”€',
      'Barra colorida vertical (lado esquerdo do card): Exibe a cor configurada para o setor. Permite identificar visualmente o setor de relance, mesmo em telas menores.',
      'Nome do Setor (negrito): Nome principal do setor. Setores inativos exibem a badge "INATIVO" em cinza ao lado do nome.',
      'Badge "N recursos" (azul): Indica quantas mÃ¡quinas/centros de custo (Recursos do Protheus) estÃ£o atualmente vinculados a este setor. Um setor com "0 recursos" nÃ£o aparecerÃ¡ corretamente no painel VisÃ£o por Setor â€” vincule recursos imediatamente apÃ³s criar o setor.',
      'Texto de descriÃ§Ã£o (cinza, abaixo do nome): Aparece quando a descriÃ§Ã£o foi preenchida. Truncado se muito longo â€” o texto completo pode ser visto ao editar o setor.',
      'â”€â”€ AÃ‡Ã•ES DE CADA SETOR â”€â”€',
      'BotÃ£o "Recursos â†’" (Ã­cone corrente + seta): Navega diretamente para a tela "Recursos por Setor" com este setor jÃ¡ selecionado. Use para vincular ou remover mÃ¡quinas/centros de custo sem precisar selecionar o setor manualmente na outra tela.',
      'BotÃ£o Editar (Ã­cone lÃ¡pis): Abre o modal de ediÃ§Ã£o com os dados do setor preenchidos. Todos os campos (Nome, DescriÃ§Ã£o e Cor) podem ser alterados. Clique em "Atualizar" para confirmar ou "Cancelar" para descartar.',
      'BotÃ£o Ativar/Desativar (Ã­cone power): Alterna o status do setor entre Ativo e Inativo. Setores inativos ficam esmaecidos na listagem e sÃ£o ocultados de certas visÃµes do painel. Ãštil quando um setor estÃ¡ em manutenÃ§Ã£o temporÃ¡ria ou foi incorporado a outro â€” desative em vez de excluir para preservar o histÃ³rico.',
      'BotÃ£o Excluir (Ã­cone lixeira): Remove permanentemente o setor do banco. ATENÃ‡ÃƒO: A exclusÃ£o sÃ³ Ã© permitida se o setor nÃ£o tiver nenhum recurso vinculado (badge "0 recursos"). Se o botÃ£o estiver esmaecido, Ã© porque ainda hÃ¡ recursos associados â€” acesse "Recursos" e remova todos antes de excluir. Esta regra protege a integridade do histÃ³rico de apontamentos.',
      'â”€â”€ BANNER INFORMATIVO (azul) â”€â”€',
      'O sistema exibe um lembrete no topo: apÃ³s criar os setores, acesse "Recursos por Setor" para associar as mÃ¡quinas e centros de custo do Protheus (ex: MO0013, MO0003) a cada setor. Sem este vÃ­nculo, as OPs nÃ£o aparecerÃ£o agrupadas corretamente no painel VisÃ£o por Setor.',
      'â”€â”€ FLUXO RECOMENDADO DE CONFIGURAÃ‡ÃƒO â”€â”€',
      'Passo 1 â€” Crie os setores aqui (nesta pÃ¡gina) com nome, descriÃ§Ã£o e cor.',
      'Passo 2 â€” Acesse "PCP â†’ Setores â†’ Recursos" e vincule as mÃ¡quinas/centros de custo do Protheus a cada setor criado.',
      'Passo 3 â€” Acesse "PCP â†’ VisÃ£o por Setores" para validar que as OPs aparecem agrupadas corretamente por setor.',
    ],
    tips: [
      'Use nomes curtos e objetivos para os setores â€” eles aparecem em cards e filtros em vÃ¡rias telas do sistema.',
      'Escolha cores com bom contraste entre si. Evite usar duas cores muito parecidas (ex: dois tons de azul) para setores diferentes â€” o objetivo Ã© distingui-los Ã  distÃ¢ncia no monitor de fÃ¡brica.',
      'Um setor com "0 recursos" nÃ£o gera nenhum dado na VisÃ£o por Setor. Sempre configure os recursos logo apÃ³s criar o setor.',
      'Setor inativo â‰  setor excluÃ­do. Prefira sempre desativar em vez de excluir â€” isso preserva o histÃ³rico de produÃ§Ã£o associado ao setor.',
      'A lixeira fica bloqueada (esmaecida) enquanto houver recursos vinculados. Isso Ã© uma trava de seguranÃ§a â€” remova os recursos antes de excluir o setor.',
    ],
    links: [
      { path: '/pcp/setores/recursos', label: 'Vincular Recursos aos Setores' },
      { path: '/pcp/visao-setores', label: 'VisÃ£o Gerencial por Setor' },
    ],
  },

  // â”€â”€ Recursos por Setor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/setores/recursos': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Recursos por Setor (VinculaÃ§Ã£o)',
    icon: 'Link',
    description: 'Esta tela Ã© o elo entre o Protheus e o sistema de Setores da MetalFisa. Aqui vocÃª define quais mÃ¡quinas, centros de custo e recursos de fabricaÃ§Ã£o (cadastrados no Protheus na tabela SH1) pertencem a cada setor produtivo. Esta vinculaÃ§Ã£o Ã© fundamental: o painel "VisÃ£o Gerencial por Setor" calcula o progresso das OPs usando exatamente essa associaÃ§Ã£o â€” se um recurso nÃ£o estiver vinculado a nenhum setor, as OPs que passam por ele aparecerÃ£o no card "Setor NÃ£o Definido".',
    steps: [
      'â”€â”€ PAINEL ESQUERDO â€” LISTA DE SETORES â”€â”€',
      'Lista de Setores (coluna esquerda): Exibe todos os setores produtivos cadastrados na tela "Cadastro de Setores". Cada item mostra a bolinha colorida do setor (cor configurada), o nome do setor em negrito e a contagem de recursos jÃ¡ vinculados ("N recursos").',
      'Selecionar um Setor: Clique em qualquer setor da lista para selecionÃ¡-lo. O item selecionado fica destacado em azul com um indicador "â€º" Ã  direita. O painel direito carrega automaticamente os recursos jÃ¡ vinculados a esse setor.',
      'Contagem "N recursos": Atualizada em tempo real a cada adiÃ§Ã£o ou remoÃ§Ã£o. Permite visualizar rapidamente quais setores ainda estÃ£o sem recursos configurados (mostram "0 recursos").',
      'Caso a lista de setores esteja vazia: Nenhum setor foi cadastrado ainda. Clique em "Criar setor â†’" (link azul) ou acesse "PCP â†’ Setores" para criar os setores antes de vincular recursos.',
      'â”€â”€ PAINEL DIREITO â€” CABEÃ‡ALHO DO SETOR â”€â”€',
      'ApÃ³s selecionar um setor, o painel direito exibe no topo um card com a bolinha colorida do setor, o nome em negrito e a descriÃ§Ã£o (se preenchida). Confirme que o setor correto estÃ¡ selecionado antes de adicionar ou remover recursos.',
      'â”€â”€ PAINEL DIREITO â€” ADICIONAR RECURSO (Duas abas) â”€â”€',
      'Aba "Buscar no Protheus" (aba padrÃ£o, Ã­cone lupa): Modo recomendado. Conecta-se ao Protheus em tempo real e busca recursos cadastrados na tabela SH1. Qualquer mÃ¡quina ou centro de custo registrado no ERP aparecerÃ¡ aqui.',
      'Campo de busca (aba Buscar no Protheus): Digite o cÃ³digo do recurso (ex: MO0013) ou parte do nome (ex: Solda, Laser, Punci...). A busca Ã© feita automaticamente apÃ³s 400ms de pausa na digitaÃ§Ã£o (debounce) â€” nÃ£o Ã© preciso pressionar Enter. Busca por cÃ³digo exato ou correspondÃªncia parcial no nome.',
      'Resultados da busca: Uma lista aparece abaixo do campo com os recursos encontrados. Cada item mostra o cÃ³digo do recurso em fonte monospace (ex: MO0013), o tipo (badge cinza, ex: MO = MÃ£o de Obra, MA = MÃ¡quina) e o nome/descriÃ§Ã£o do recurso no Protheus.',
      'Badge "JÃ¡ vinculado a este setor" (verde, Ã­cone âœ“): Indica que o recurso jÃ¡ foi adicionado ao setor selecionado. O botÃ£o "Adicionar" nÃ£o aparece nesses casos â€” evita duplicatas.',
      'BotÃ£o "+ Adicionar" (azul): Clique para vincular o recurso ao setor. O sistema confirma com um toast de sucesso, o recurso some da lista de resultados e aparece imediatamente na lista "Recursos Vinculados" abaixo. A contagem do setor Ã© atualizada instantaneamente.',
      'Mensagem "Nenhum recurso encontrado no Protheus": Aparece quando a busca nÃ£o retorna resultados. Pode ocorrer quando o recurso existe no Protheus mas com nomenclatura diferente, ou quando o recurso ainda nÃ£o foi cadastrado no SH1. Neste caso, use a aba "Digitar cÃ³digo".',
      'BotÃ£o "X" (limpar): Ao lado do campo de busca, limpa o texto digitado e os resultados. O Ã­cone de spinner azul aparece enquanto a busca estÃ¡ em andamento.',
      'Aba "Digitar cÃ³digo" (Ã­cone lÃ¡pis): Modo manual para quando o recurso nÃ£o Ã© encontrado na busca do Protheus, ou quando vocÃª conhece exatamente o cÃ³digo e quer adicionÃ¡-lo diretamente.',
      'Campo "CÃ³digo do Recurso" (obrigatÃ³rio, aba manual): Digite o cÃ³digo exato como cadastrado no Protheus, por exemplo: MO0013, MO0003, MA0005. O campo converte automaticamente para MAIÃšSCULAS. Este cÃ³digo Ã© o que o sistema usa para cruzar com as operaÃ§Ãµes do roteiro (SG2) â€” deve estar correto para que as OPs apareÃ§am corretamente no painel.',
      'Campo "DescriÃ§Ã£o" (opcional, aba manual): Nome descritivo do recurso. Exemplos: "Solda MIG", "Puncionadeira", "Torno CNC". Se nÃ£o preenchido, o sistema usa o cÃ³digo como descriÃ§Ã£o. A descriÃ§Ã£o serve apenas para identificaÃ§Ã£o visual na listagem â€” nÃ£o afeta o cruzamento de dados com o Protheus.',
      'BotÃ£o "Adicionar Recurso" (azul): Confirma o cadastro manual. Desabilitado enquanto o campo CÃ³digo estiver vazio. O spinner aparece durante o envio. Em caso de erro (ex: recurso jÃ¡ vinculado a outro setor), a mensagem de erro Ã© exibida em vermelho.',
      'â”€â”€ REGRA DE EXCLUSIVIDADE â”€â”€',
      'Um mesmo recurso (cÃ³digo) sÃ³ pode estar vinculado a UM setor por vez. Se vocÃª tentar adicionar um recurso que jÃ¡ pertence a outro setor, o sistema recusarÃ¡ com um erro explicativo. Para mover um recurso de setor, primeiro remova-o do setor atual e depois adicione no novo setor.',
      'â”€â”€ PAINEL DIREITO â€” RECURSOS VINCULADOS â”€â”€',
      'Card "Recursos Vinculados": Exibe a lista completa de recursos jÃ¡ associados ao setor selecionado. O cabeÃ§alho mostra o total de recursos vinculados ("N recursos").',
      'Cada linha de recurso: Mostra um ponto azul indicador, o cÃ³digo do recurso em fonte monospace negrito (ex: MO0013) e a descriÃ§Ã£o ao lado (ex: Solda MIG).',
      'BotÃ£o Remover (Ã­cone lixeira, vermelho ao passar o mouse): Aparece ao passar o mouse sobre a linha do recurso (efeito hover). Clique para desvincular o recurso do setor imediatamente. A remoÃ§Ã£o Ã© instantÃ¢nea â€” nÃ£o hÃ¡ confirmaÃ§Ã£o adicional. O recurso pode ser vinculado a outro setor apÃ³s removido.',
      'Estado vazio ("Nenhum recurso vinculado"): Exibido quando o setor ainda nÃ£o tem recursos. As instruÃ§Ãµes "Use os campos acima para adicionar recursos" orientam o prÃ³ximo passo.',
      'â”€â”€ ESTADO INICIAL (nenhum setor selecionado) â”€â”€',
      'Quando nenhum setor estÃ¡ selecionado, o painel direito exibe apenas o Ã­cone de corrente e a instruÃ§Ã£o "Selecione um setor". Clique em qualquer setor na lista esquerda para ativar o painel de gerenciamento.',
    ],
    tips: [
      'Prefira sempre a aba "Buscar no Protheus" â€” ela garante que o cÃ³digo do recurso existe no SH1 e evita erros de digitaÃ§Ã£o que causariam inconsistÃªncias nos painÃ©is de produÃ§Ã£o.',
      'Use a aba "Digitar cÃ³digo" apenas quando o recurso nÃ£o aparece na busca. Isso pode acontecer quando o recurso foi criado recentemente no Protheus e a sincronizaÃ§Ã£o ainda nÃ£o ocorreu, ou quando o cÃ³digo segue uma nomenclatura diferente.',
      'O cÃ³digo do recurso deve corresponder exatamente ao campo SH1_CODIGO (ou equivalente) do Protheus â€” incluindo zeros Ã  esquerda (ex: MO0013, nÃ£o MO13). Um cÃ³digo incorreto nÃ£o causarÃ¡ erro de tela, mas o recurso nÃ£o aparecerÃ¡ nas anÃ¡lises de progressÃ£o das OPs.',
      'Verifique sempre a contagem "N recursos" na lista de setores apÃ³s configurar. Setores com "0 recursos" sÃ£o invisÃ­veis no painel VisÃ£o por Setor.',
      'Para reorganizar recursos entre setores (ex: a puncionadeira foi transferida do Setor Corte para o Setor PreparaÃ§Ã£o): primeiro remova o recurso do setor atual, depois selecione o novo setor e adicione. A operaÃ§Ã£o Ã© reversÃ­vel a qualquer momento.',
      'O card "Setor NÃ£o Definido" na VisÃ£o por Setor indica recursos usados em roteiros de OPs que nÃ£o estÃ£o vinculados a nenhum setor aqui. Consulte quais recursos estÃ£o listados lÃ¡ e adicione-os ao setor correto.',
      'Esta tela pode ser acessada diretamente pelo botÃ£o "Recursos â†’" em cada card da tela "Cadastro de Setores" â€” o setor correspondente jÃ¡ vem prÃ©-selecionado, economizando tempo.',
    ],
    links: [
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/visao-setores', label: 'VisÃ£o Gerencial por Setor' },
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' },
    ],
  },

  // â”€â”€ BOM (Estrutura Alternativa) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/bom/:codigo': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'VisualizaÃ§Ã£o BOM / Estrutura',
    icon: 'Layers',
    description: 'Interface alternativa para visualizar a lista tÃ©cnica de materiais de um produto (BOM). Focada em exportaÃ§Ã£o e anÃ¡lise da explosÃ£o de componentes.',
    steps: [
      'Navegue pela estrutura em Ã¡rvore do produto.',
      'Analise as quantidades necessÃ¡rias para cada componente no nÃ­vel filho.',
      'Exporte os dados ou consulte o estoque disponÃ­vel.'
    ],
    tips: [
      'Utilize esta visÃ£o para conferÃªncias rÃ¡pidas do cadastro tÃ©cnico do ERP.'
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura Completa' }
    ]
  },

  // â”€â”€ Curva S (PCP) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/curva-s': {
    category: 'PCP / Analytics',
    categoryColor: '#0ea5e9',
    title: 'Curva S de ProduÃ§Ã£o',
    icon: 'LineChart',
    description: 'AnÃ¡lise grÃ¡fica do andamento da produÃ§Ã£o: compara o volume de peÃ§as Planejadas contra o Realizado (apontado) ao longo do tempo. Essencial para controle fÃ­sico e financeiro da OP.',
    steps: [
      'Utilize os filtros superiores para selecionar OperaÃ§Ã£o, Cliente ou Pedido.',
      'A linha azul (Planejado) demonstra a velocidade ideal de entrega da produÃ§Ã£o dentro do prazo.',
      'A linha laranja (Realizado) mostra o apontamento real. Ficar abaixo da linha azul indica atraso de produÃ§Ã£o.'
    ],
    tips: [
      'Os dados sÃ£o baseados nas quantidades diÃ¡rias; a Curva S ideal comeÃ§a suave, acelera no meio da execuÃ§Ã£o e suaviza perto do fim.',
      'Ordens sem data de previsÃ£o correta no Protheus podem gerar distorÃ§Ãµes na curva planejada.'
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de ProduÃ§Ã£o' },
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' }
    ]
  },

  // â”€â”€ Extrato OP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/pcp/extrato-op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Extrato da Ordem de ProduÃ§Ã£o',
    icon: 'FileText',
    description: 'VisÃ£o microscÃ³pica do histÃ³rico de apontamentos, paradas e movimentaÃ§Ãµes em uma OP especÃ­fica.',
    steps: [
      'Informe a OP e Item desejados.',
      'O extrato exibirÃ¡ toda a vida Ãºtil da OP, desde a liberaÃ§Ã£o, movimentaÃ§Ã£o por cada mÃ¡quina e saldos residuais.'
    ],
    tips: [
      'Use o extrato para auditar perdas (refugos) e encontrar inconsistÃªncias de digitaÃ§Ã£o por parte dos operadores.'
    ],
    links: [
      { path: '/producao/op', label: 'Detalhes da OP' }
    ]
  },

  // â”€â”€ Plano de Contas Financeiro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/financeiro/plano-contas': {
    category: 'Financeiro',
    categoryColor: '#10b981',
    title: 'Plano de Contas',
    icon: 'Book',
    description: 'Estrutura hierÃ¡rquica das contas contÃ¡beis e financeiras da empresa, definindo as naturezas de receita e despesa para alocaÃ§Ã£o correta de resultados.',
    steps: [
      'Visualize a estrutura em Ã¡rvore, navegando de contas sintÃ©ticas (pai) para analÃ­ticas (filhas).',
      'Analise a classificaÃ§Ã£o de cada nÃ­vel contÃ¡bil e seus respectivos saldos no perÃ­odo.'
    ],
    tips: [
      'Contas de receita geralmente comeÃ§am com prefixos especÃ­ficos no padrÃ£o contÃ¡bil; certifique-se de nÃ£o misturar despesas operacionais com despesas fixas.'
    ],
    links: [
      { path: '/financeiro/balancete', label: 'Balancete' }
    ]
  },

  // â”€â”€ Balancete Financeiro â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/financeiro/balancete': {
    category: 'Financeiro',
    categoryColor: '#10b981',
    title: 'Balancete Financeiro',
    icon: 'PieChart',
    description: 'RelatÃ³rio sintÃ©tico de DRE/Balancete que resume as receitas e despesas estruturadas pelo Plano de Contas no perÃ­odo escolhido.',
    steps: [
      'Filtre o perÃ­odo fiscal desejado.',
      'Acompanhe o Resultado Operacional bruto e lÃ­quido da fÃ¡brica.',
      'Expanda as contas para investigar onde o custo se concentrou.'
    ],
    tips: [
      'Resultados inconsistentes frequentemente provÃªm de OPs finalizadas sem apropriaÃ§Ã£o de custo no mÃ³dulo de PCP. Certifique-se de que a produÃ§Ã£o e o consumo de matÃ©ria-prima estÃ£o regulares.'
    ],
    links: [
      { path: '/financeiro/plano-contas', label: 'Plano de Contas' }
    ]
  },

  // â”€â”€ MÃ³dulo de ManutenÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/manutencao/ordens': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: '#4f46e5',
    title: 'GestÃ£o de Ordens de ManutenÃ§Ã£o (O.M.)',
    icon: 'PenTool',
    description: 'Central de comando da manutenÃ§Ã£o. Aqui vocÃª visualiza, cria e gerencia solicitaÃ§Ãµes de intervenÃ§Ã£o em mÃ¡quinas e equipamentos.',
    steps: [
      '1. Criar Ordem: Clique em "Nova Ordem", selecione a mÃ¡quina, relate o sintoma e defina tipo/prioridade.',
      '2. ExecuÃ§Ã£o: Clique sobre a O.M. na tabela. O tÃ©cnico deve preencher as atividades realizadas e fechar o status.',
      '3. Registro de Custos: Na aba Materiais do painel, adicione peÃ§as usadas (o custo serÃ¡ carregado via Protheus).',
      '4. ImpressÃ£o de RelatÃ³rio: No painel da O.M., clique em "Imprimir / PDF" para gerar a via oficial de assinaturas.'
    ],
    tips: [
      'Acompanhe no dashboard os KPIs de tempo de reparo (MTTR) e custo total das ordens concluÃ­das.',
      'Ordens "CRÃTICAS" indicam mÃ¡quina parada. Priorize-as no atendimento.'
    ],
    links: [
      { path: '/manutencao/maquinas', label: 'Cadastro de MÃ¡quinas' },
      { path: '/manutencao/checklists', label: 'Checklists (Poka-Yoke)' }
    ]
  },

  '/manutencao/maquinas': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: '#4f46e5',
    title: 'Cadastro de MÃ¡quinas e Equipamentos',
    icon: 'Database',
    description: 'GestÃ£o de todo o parque fabril. Ã‰ obrigatÃ³rio que a mÃ¡quina esteja cadastrada para receber Ordens de ManutenÃ§Ã£o.',
    steps: [
      'Use "Nova MÃ¡quina" para inserir tornos, injetoras, prensas ou ferramentas complexas.',
      'Preencha a Tag de IdentificaÃ§Ã£o correta, que serÃ¡ usada pelos operadores no chÃ£o de fÃ¡brica.',
      'Anexe Manuais TÃ©cnicos em PDF para que fiquem acessÃ­veis a qualquer tÃ©cnico durante a manutenÃ§Ã£o.'
    ],
    tips: [
      'VocÃª pode inativar mÃ¡quinas que foram vendidas para nÃ£o poluÃ­rem a lista de O.M. O histÃ³rico permanece salvo.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de ManutenÃ§Ã£o' }
    ]
  },

  '/manutencao/checklists': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: '#4f46e5',
    title: 'Checklists e Modelos (Poka-Yoke)',
    icon: 'CheckSquare',
    description: 'CriaÃ§Ã£o de modelos de inspeÃ§Ã£o diÃ¡ria, setups ou manutenÃ§Ã£o preventiva.',
    steps: [
      'Crie um "Novo Modelo" e defina o Tipo (DiÃ¡rio, Setup, Preventiva).',
      'Adicione perguntas com tipos de resposta (Sim/NÃ£o, Texto, Foto ObrigatÃ³ria).',
      'Vincule os modelos criados Ã s mÃ¡quinas no painel de "MÃ¡quinas e Equipamentos".'
    ],
    tips: [
      'Utilize o requisito "Foto ObrigatÃ³ria" para pontos crÃ­ticos de desgaste.'
    ],
    links: [
      { path: '/manutencao/maquinas', label: 'MÃ¡quinas e Equipamentos' }
    ]
  },

  '/manutencao/dashboard': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: '#4f46e5',
    title: 'Dashboard de ManutenÃ§Ã£o',
    icon: 'LayoutDashboard',
    description: 'Painel executivo com a visÃ£o global do departamento de manutenÃ§Ã£o, KPIs e grÃ¡ficos.',
    steps: [
      'Visualize o MTTR (Mean Time To Repair) e MTBF (Mean Time Between Failures).',
      'Acompanhe as Ordens CrÃ­ticas que precisam de atenÃ§Ã£o imediata.'
    ],
    tips: [
      'Estes dados sÃ£o gerados automaticamente baseados na abertura e encerramento das O.M.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ir para Ordens de ManutenÃ§Ã£o' }
    ]
  },

  '/manutencao/materiais': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: '#4f46e5',
    title: 'GestÃ£o de Materiais da O.M.',
    icon: 'Package',
    description: 'Acompanhe e faÃ§a o planejamento (follow-up) de todos os materiais solicitados nas Ordens de ManutenÃ§Ã£o.',
    steps: [
      'Busque um material pelo nome, mÃ¡quina ou ID da ordem.',
      'Clique em "Planejar" para alterar o status do material.',
      'Defina as datas de previsÃ£o de compras, chegada e montagem final.'
    ],
    tips: [
      'Ao alterar o planejamento, um registro ficarÃ¡ gravado no histÃ³rico da Ordem de ManutenÃ§Ã£o automaticamente.',
      'Filtre pelo status "Aguardando Entrega" para acompanhar prazos com suprimentos.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de ManutenÃ§Ã£o' },
      { path: '/manutencao/dashboard', label: 'Dashboard Gerencial' }
    ]
  },

  '/sgq/ativos': {
    category: 'Qualidade',
    categoryColor: 'bg-emerald-100 text-emerald-800',
    title: 'GestÃ£o de Ativos & CalibraÃ§Ã£o',
    icon: 'Wrench',
    description: 'MÃ³dulo dedicado ao controle do inventÃ¡rio fÃ­sico de equipamentos (paquÃ­metros, trenas, durÃ´metros) com rastreabilidade completa das certificaÃ§Ãµes e prazos de calibraÃ§Ã£o vigentes.',
    steps: [
      'Cadastrar Ativo: Utilize o formulÃ¡rio para registrar as especificaÃ§Ãµes tÃ©cnicas, fabricante, nÃºmero de sÃ©rie (nÂº de patrimÃ´nio) e tolerÃ¢ncias da norma.',
      'Definir CalibraÃ§Ã£o: Preencha as frequÃªncias exigidas para calibraÃ§Ã£o, laboratÃ³rio homologado, validade do Ãºltimo certificado e anexe a documentaÃ§Ã£o tÃ©cnica no formato PDF.',
      'Rastreabilidade: Todo ativo entra no "Painel de Controle", que alerta automaticamente os equipamentos com vencimento iminente ou expirado.',
      'SuspensÃ£o AutomÃ¡tica: Se a calibraÃ§Ã£o vencer, o sistema bloqueia o envio desse equipamento em novos Romaneios de SGQ para auditorias.'
    ],
    tips: [
      'Cadastre a foto real do equipamento; facilita muito a identificaÃ§Ã£o no chÃ£o de fÃ¡brica e na hora do embarque da caixa de ferramentas.',
      'Equipamentos em manutenÃ§Ã£o externa ou "perdidos" devem ter seu status alterado para evitar emissÃµes indevidas.'
    ],
    links: [
      { path: '/sgq/caixas', label: 'Caixas de Ferramenta' },
      { path: '/sgq/romaneios', label: 'Romaneios SGQ' }
    ]
  },

  '/sgq/caixas': {
    category: 'Qualidade',
    categoryColor: 'bg-emerald-100 text-emerald-800',
    title: 'Caixas de Ferramentas (Kits)',
    icon: 'Package',
    description: 'Sistema de gestÃ£o que permite agrupar diversos ativos e ferramentas em "Kits" (Caixas), vinculando-os a colaboradores ou frotas para otimizar auditorias e devoluÃ§Ãµes.',
    steps: [
      'Criar Caixa: Crie um registro com o nome ou numeraÃ§Ã£o da Caixa e designe um responsÃ¡vel direto (ex: Montador Externo X).',
      'Inserir Ativos: AtravÃ©s do menu da caixa, bipe ou selecione os ativos que compÃµem o kit (como Lixadeira, MultÃ­metro, etc).',
      'ValidaÃ§Ã£o de Compliance: Se algum equipamento da caixa estiver com a calibraÃ§Ã£o vencida, o sistema dispara um alerta crÃ­tico.',
      'IntegraÃ§Ã£o LogÃ­stica: Uma Caixa de Ferramentas pode ser enviada de forma consolidada dentro de um Romaneio de SGQ para equipes externas.'
    ],
    tips: [
      'Caixas sÃ£o Ã³timas para equipes de campo. Quando um funcionÃ¡rio devolve, o sistema audita instantaneamente se falta algum componente.',
      'Nunca inclua equipamentos descalibrados nas caixas, isso pode gerar RNC (NÃ£o Conformidade) na obra do cliente.'
    ],
    links: [
      { path: '/sgq/ativos', label: 'GestÃ£o de Ativos' },
      { path: '/sgq/romaneios', label: 'Romaneios SGQ' }
    ]
  },

  '/sgq/romaneios': {
    category: 'Qualidade',
    categoryColor: 'bg-emerald-100 text-emerald-800',
    title: 'Romaneios SGQ',
    icon: 'Truck',
    description: 'MÃ³dulo de expediÃ§Ã£o de qualidade focado no trÃ¢nsito de Instrumentos e Caixas de Ferramentas. Garante a integridade da entrega e devoluÃ§Ã£o dos ativos de auditoria e trabalho de campo.',
    steps: [
      'Gerar Romaneio: Inicie um romaneio informando o Destino, ResponsÃ¡vel pelo Envio e o Portador (quem estÃ¡ levando).',
      'Adicionar Itens: Insira no documento os Ativos avulsos ou as Caixas de Ferramentas completas que irÃ£o para o local.',
      'EmissÃ£o de Checklist: O romaneio consolida todos os itens e imprime um relatÃ³rio profissional. SÃ³ Ã© permitido enviar se todos os certificados obrigatÃ³rios estiverem em dia.',
      'Baixa / Retorno: Quando o material volta para a base, utilize a tela do Romaneio para confirmar a devoluÃ§Ã£o fÃ­sica (Check-in), garantindo que nada foi perdido na viagem.'
    ],
    tips: [
      'A rastreabilidade dos Romaneios Ã© exigÃªncia direta para auditorias de conformidade ISO-9001 e IATF.',
      'Sempre finalize e assine os Romaneios quando o retorno for concluÃ­do.'
    ],
    links: [
      { path: '/sgq/ativos', label: 'GestÃ£o de Ativos' },
      { path: '/sgq/caixas', label: 'Caixas de Ferramenta' }
    ]
  },

  '/manutencao/tecnicos': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: 'bg-orange-100 text-orange-800',
    title: 'TÃ©cnicos de ManutenÃ§Ã£o',
    icon: 'Users',
    description: 'GestÃ£o do corpo tÃ©cnico de manutenÃ§Ã£o. Centraliza informaÃ§Ãµes de disponibilidade, especialidades (MecÃ¢nica, ElÃ©trica, AutomaÃ§Ã£o) e apuraÃ§Ã£o de carga de trabalho para melhor alocaÃ§Ã£o das O.Ms.',
    steps: [
      'Registrar TÃ©cnico: Cadastre o profissional informando seu registro interno, nome, e-mail e funÃ§Ã£o.',
      'ClassificaÃ§Ã£o: Defina as Ã¡reas de atuaÃ§Ã£o (Especialidades) e turnos em que o tÃ©cnico opera.',
      'Acompanhamento de OS: Ao acessar o perfil de um tÃ©cnico, vocÃª pode visualizar todo o histÃ³rico de execuÃ§Ãµes de ordens (O.M) das quais ele participou.',
      'AnÃ¡lise de Demanda: Use essa tela para identificar quem estÃ¡ com sobrecarga de apontamentos e quem estÃ¡ disponÃ­vel para chamados corretivos.'
    ],
    tips: [
      'Mantenha o cadastro sempre atualizado. O sistema de ExecuÃ§Ã£o de ManutenÃ§Ã£o sÃ³ permite apontamento em nome de tÃ©cnicos ativos no banco.',
      'Associe a especialidade corretamente; o Dashboard filtra a produtividade cruzando HH e Setores.'
    ],
    links: [
      { path: '/manutencao/dashboard', label: 'GestÃ£o ManutenÃ§Ã£o' },
      { path: '/manutencao/ordens', label: 'Ordens de ManutenÃ§Ã£o' }
    ]
  },

  '/manutencao/atividades': {
    category: 'ManutenÃ§Ã£o',
    categoryColor: 'bg-orange-100 text-orange-800',
    title: 'Atividades PadrÃ£o',
    icon: 'Layers',
    description: 'Biblioteca central de atividades (instruÃ§Ãµes e tarefas repetitivas) utilizadas em Checklists Preventivos e Planos de ManutenÃ§Ã£o. Garante a padronizaÃ§Ã£o dos mÃ©todos tÃ©cnicos operacionais.',
    steps: [
      'Criar Atividade PadrÃ£o: Registre as tarefas (ex: "Troca de Ã“leo Lubrificante", "Aperto de Terminais", "Limpeza do Compressor").',
      'Definir Procedimento: Descreva o passo a passo seguro para aquela atividade e associe EPIs ou Ferramentas necessÃ¡rias.',
      'Tempo PadrÃ£o: Determine o tempo estimado (setup e execuÃ§Ã£o) para referÃªncia na O.M.',
      'AssociaÃ§Ã£o a Checklists: Estas atividades cadastradas ficarÃ£o disponÃ­veis para serem "puxadas" no momento em que vocÃª criar Planos Preventivos ou Checklists de Equipamentos.'
    ],
    tips: [
      'NÃ£o escreva tarefas genÃ©ricas ("Verificar mÃ¡quina"). Seja especÃ­fico ("Medir tensÃ£o das correias do eixo X").',
      'O uso de Atividades PadrÃ£o diminui o erro humano e acelera a criaÃ§Ã£o de ordens de serviÃ§o rotineiras.'
    ],
    links: [
      { path: '/manutencao/checklists', label: 'Checklists DiÃ¡rios' },
      { path: '/manutencao/ordens', label: 'Ordens de ManutenÃ§Ã£o' }
    ]
  },

  // â”€â”€ MÃ³dulo WabTec (ImportaÃ§Ã£o e Estrutura) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/wabtec/estrutura': {
    category: 'Engenharia / IntegraÃ§Ã£o',
    categoryColor: '#14b8a6',
    title: 'ImportaÃ§Ã£o de Estrutura WabTec',
    icon: 'FileSpreadsheet',
    description: 'MÃ³dulo dedicado Ã  importaÃ§Ã£o de planilhas Excel da WabTec para gerar e verificar estruturas (BOM) em paralelo com o ERP Protheus.',
    steps: [
      'Aba 1 (ImportaÃ§Ã£o e Base): FaÃ§a o upload da planilha Excel da WabTec. O sistema farÃ¡ a validaÃ§Ã£o obrigatÃ³ria das colunas (Level, ID, Revision, Name, Quantity).',
      'Aba 2 (Mapeamento Protheus): Nesta aba, clique em "Mapear c/ Protheus". O sistema cruzarÃ¡ os desenhos do cliente carregados no Excel com a base de dados para encontrar os cÃ³digos de produto equivalentes no ERP.',
      'Aba 3 (Lista de Materiais - BOM): Selecione o lote e clique em "Extrair / Atualizar do Protheus". O sistema irÃ¡ explodir a Ã¡rvore de cada produto mapeado em atÃ© 20 nÃ­veis para recuperar toda a matÃ©ria-prima e os componentes.',
      'VisÃµes (Aba 3): Alterne entre a visÃ£o "Detalhada" (nÃ­vel a nÃ­vel da engenharia) ou "Aglutinada" (soma das matÃ©rias-primas consolidadas).',
      'ExportaÃ§Ã£o (Aba 3): Utilize os botÃµes "Exportar Excel" para gerar uma planilha com as abas Detalhada e Resumo de Materiais, ou "Exportar PDF" para criar um documento formatado e pronto para impressÃ£o da visualizaÃ§Ã£o atual.'
    ],
    tips: [
      'Erros de Template: Se a planilha nÃ£o subir na Aba 1, verifique se a linha de cabeÃ§alho contÃ©m as palavras exatas em inglÃªs: "Level", "ID", "Revision", "Name" e "Quantity".',
      'OtimizaÃ§Ã£o de Performance: Uma vez extraÃ­da, a Lista de Materiais Ã© salva no servidor. Isso significa que exportar para Excel ou PDF Ã© um processo instantÃ¢neo e nÃ£o depende de novas consultas ao Protheus.',
      'A visÃ£o aglutinada Ã© excelente para o setor de compras e almoxarifado, pois unifica toda a quantidade requerida de cada componente em uma Ãºnica linha.'
    ],
    links: [
      { path: '/produtos', label: 'CatÃ¡logo de Produtos' },
      { path: '/estrutura', label: 'Consulta Estrutural PadrÃ£o' }
    ]
  },

  // â”€â”€ GestÃ£o de RNCs (RelatÃ³rio de NÃ£o Conformidade) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  '/sgq/gestao-rncs': {
    category: 'SGQ',
    categoryColor: '#14b8a6',
    title: 'GestÃ£o de RNCs',
    icon: 'ShieldAlert',
    description: 'Fluxo completo de registro, tratativa, 5W2H e controle de peÃ§as de reposiÃ§Ã£o para NÃ£o Conformidades.',
    tabs: [
      {
        id: 'lista',
        label: 'Aba: Lista de RNCs',
        description: 'Tabela principal com todas as RNCs registradas, filtros de status, exportaÃ§Ã£o e aÃ§Ãµes administrativas.',
        steps: [
          'Filtro de Status: Use o seletor no topo para filtrar a tabela entre "Todas as RNCs", "Abertas", "Em Andamento" ou "ConcluÃ­das".',
          'Coluna Status: Exibe badges visuais indicando a situaÃ§Ã£o da RNC (Aberto em vermelho, Em Andamento em amarelo, ConcluÃ­do em verde).',
          'Coluna ReposiÃ§Ã£o: Exibe se hÃ¡ solicitaÃ§Ã£o de nova peÃ§a ativa (ex: badge azul "Solicitado" ou cinza "NÃ£o Requerido").',
          'Rastreabilidade: A tabela mostra o cÃ³digo do Produto, DescriÃ§Ã£o, OP com item/sequÃªncia e o Pedido de Venda associado.',
          'Desenho TÃ©cnico (PDF): Se a RNC possuir um PDF anexado na abertura, um Ã­cone vermelho de PDF ficarÃ¡ disponÃ­vel na coluna Produto para visualizaÃ§Ã£o direta.',
          'Apontar Tempo (Ãcone RelÃ³gio): Permite lanÃ§ar minutos e observaÃ§Ãµes de trabalho dedicados a tratar e corrigir a RNC fÃ­sica.',
          'Tratar RNC (BotÃ£o): Abre o modal completo de tratativa (disposiÃ§Ã£o, anÃ¡lise 5W2H, plano de aÃ§Ã£o e eficÃ¡cia) para as RNCs pendentes.',
          'Enviar E-mail (Ãcone Envelope): Abre o modal de envio por e-mail para notificar os responsÃ¡veis pelo setor da qualidade ou fÃ¡brica.',
          'Imprimir PDF: Clique no topo da aba para exportar e baixar um relatÃ³rio PDF formatado com a listagem atual filtrada.'
        ],
        tips: [
          'A coluna ReposiÃ§Ã£o permite verificar a necessidade de novas peÃ§as para a produÃ§Ã£o sem precisar abrir o modal de tratativa.',
          'O apontamento de tempo Ã© cumulativo por RNC e serve para auditar o custo do retrabalho e o esforÃ§o de engenharia no desvio.'
        ]
      },
      {
        id: 'kpis',
        label: 'Aba: Painel de KPIs & GrÃ¡ficos',
        description: 'Indicadores gerenciais e grÃ¡ficos dinÃ¢micos para anÃ¡lise do desempenho de qualidade na fÃ¡brica.',
        steps: [
          'Cards de Resumo: Acompanhe no topo o total de RNCs, total de Abertas, total Em Andamento, ConcluÃ­das (com taxa de eficÃ¡cia) e RNCs com Prazo Excedido (Atrasadas).',
          'Top Defeitos (Pareto): Analise o grÃ¡fico de barras para identificar os tipos de nÃ£o conformidade mais frequentes.',
          'AnÃ¡lise de Recursos: GrÃ¡fico que quantifica e classifica os desvios agrupados por mÃ¡quina/operaÃ§Ã£o do Protheus.',
          'Tempo MÃ©dio de Ciclo: Acompanhe a mÃ©dia de dias/horas gastos desde a abertura atÃ© o encerramento da RNC.',
          'Filtros DinÃ¢micos: Filtre os dados por datas de abertura e setores para segmentar os grÃ¡ficos de perdas de qualidade.'
        ],
        tips: [
          'Se o card "Prazo Excedido" piscar em vermelho, indica que existem RNCs com a data limite ultrapassada que precisam de atenÃ§Ã£o urgente.',
          'A taxa de eficÃ¡cia reflete a qualidade dos planos de aÃ§Ã£o implementados. Valores baixos indicam que os desvios estÃ£o sendo recorrentes.'
        ]
      },
      {
        id: 'reposicoes',
        label: 'Aba: PeÃ§as Solicitadas',
        description: 'Painel administrativo para controle e liberaÃ§Ã£o de fabricaÃ§Ã£o de novas peÃ§as para reposiÃ§Ã£o de refugo.',
        steps: [
          'Rastreabilidade: A tabela lista o ID da RNC, desenho tÃ©cnico, cÃ³digo do produto, OP de origem, quantidade e data da solicitaÃ§Ã£o.',
          'Desenho TÃ©cnico (PDF): Clique no Ã­cone de arquivo na coluna "Desenho" para visualizar ou baixar o PDF tÃ©cnico para produÃ§Ã£o.',
          'Status da LiberaÃ§Ã£o: VisualizaÃ§Ãµes claras entre "Aguardando LiberaÃ§Ã£o" (badge vermelho/laranja) e "Liberada para FabricaÃ§Ã£o" (badge verde).',
          'LiberaÃ§Ã£o de FabricaÃ§Ã£o (BotÃ£o): O PCP/Qualidade clica em "Liberar FabricaÃ§Ã£o" para iniciar o processo de reposiÃ§Ã£o.',
          'VÃ­nculo de OP Protheus: Ao liberar a peÃ§a, insira obrigatoriamente o nÃºmero da OP gerada no Protheus para rastreabilidade.',
          'Detalhes da LiberaÃ§Ã£o: ApÃ³s liberar, o status atualiza exibindo a data, o nome do responsÃ¡vel e o nÃºmero da OP vinculada.'
        ],
        tips: [
          'A inserÃ§Ã£o da OP Ã© obrigatÃ³ria no momento da liberaÃ§Ã£o para garantir o vÃ­nculo de custos e produÃ§Ã£o no Protheus.',
          'O envio da solicitaÃ§Ã£o por e-mail na tratativa pode ser realizado mÃºltiplas vezes para o mesmo item caso ocorram mudanÃ§as no projeto ou quantidade.'
        ]
      },
      {
        id: 'modais',
        label: 'Processos (Abertura & Tratativa)',
        description: 'InstruÃ§Ãµes para os modais internos de registro de ocorrÃªncias e definiÃ§Ã£o de planos de aÃ§Ã£o.',
        steps: [
          'Modal Abertura (+ Nova RNC): Selecione a OP afetada (dados integrados ao Protheus) e o produto. Defina o recurso, defeito e prazo.',
          'Tratativa SeÃ§Ã£o 1 (DisposiÃ§Ã£o): Determine o destino do produto. Se escolher "Nova PeÃ§a", marque o checkbox para ativar o botÃ£o de envio.',
          'Tratativa SeÃ§Ã£o 2 (5W2H): Preencha a causa raiz respondendo Ã s perguntas fundamentais da metodologia 5W2H.',
          'Tratativa SeÃ§Ã£o 3 (Plano de AÃ§Ã£o): Detalhe as tarefas preventivas e corretivas com prazos e responsÃ¡veis.',
          'Tratativa SeÃ§Ã£o 4 (EficÃ¡cia): Confirme se as aÃ§Ãµes solucionaram o desvio e encerre a RNC.'
        ],
        tips: [
          'O botÃ£o "Enviar SolicitaÃ§Ã£o de FabricaÃ§Ã£o de Nova PeÃ§a" aparece na SeÃ§Ã£o 1 do modal de Tratativa apÃ³s marcar "Nova PeÃ§a" e serve para disparar o e-mail de fabricaÃ§Ã£o com o layout do sistema.',
          'Tanto a abertura quanto a tratativa aceitam o upload de anexos e fotos de evidÃªncias.'
        ]
      }
    ],
    links: [
      { path: '/sgq/cargos-funcoes', label: 'Cargos e FunÃ§Ãµes' },
      { path: '/sgq/romaneios', label: 'Romaneios SGQ' },
      { path: '/producao', label: 'Ordens de ProduÃ§Ã£o' }
    ]
  },

  // ── Planejamento Estratégico (Smart Planner) ────────────────────────────────────────────────
  '/pcp/planejador-avancado': {
    category: 'PCP',
    categoryColor: '#4f46e5',
    title: 'Planejamento Estratégico (Smart Planner)',
    icon: 'GitMerge',
    description: 'Ferramenta para definição sequencial e encadeada de ordens de produção (Cascata Automática) focada em visibilidade de longo prazo.',
    steps: [
      'Visualização: Utilize a barra de busca para localizar um Pedido de Venda ou OP. A OP será agrupada por recursos.',
      'Ordenação de Filas: Utilize as setas na primeira coluna para reordenar a sequência de recursos conforme sua estratégia de produção. Esta ordem será salva no banco para as próximas sessões.',
      'Dias Previstos: Na coluna "Dias Prev.", informe quantos dias aquele recurso especificamente levará.',
      'Cascata Automática: Clique no botão "Cascata Auto" no cabeçalho da OP e defina se o cálculo deve iniciar a partir da "Data de Início" (somando os dias previstos) ou "Data de Entrega" (regredindo os dias para descobrir quando começar).',
      'Salvamento Pontual ou Lote: Use o botão verde "Salvar OP" para registrar apenas aquela ordem, ou o "Salvar Alterações" no topo da página caso altere mais de uma OP simultaneamente.'
    ],
    tips: [
      'A função "Cascata Auto" ignora finais de semana (Sábados e Domingos) no cálculo, para gerar previsões de dias úteis reais.',
      'A sua ordenação preferida da fila (setas de arrastar) sempre volta restaurada ao abrir a OP no futuro.',
      'A "Data Fim" da operação X será automaticamente usada como a "Data Início" da próxima operação Y na cascata.'
    ],
    links: [
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/controle-producao', label: 'Controle de Produção' }
    ]
  }

};


