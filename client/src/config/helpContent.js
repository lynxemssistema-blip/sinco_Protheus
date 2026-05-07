// ─────────────────────────────────────────────────────────────────────────────
// helpContent.js  –  Conteúdo de Ajuda Contextual por rota
// Fonte para o script de migração: server/scripts/migrateHelpToDb.js
// ─────────────────────────────────────────────────────────────────────────────
export const HELP_CONTENT = {

  // ── 🤖 Diretrizes e Persona do Agente de IA (Metalfisa - Suporte Lynx) ───────
  '_AI_SYSTEM_INSTRUCTIONS_': {
    category: 'Inteligência Artificial',
    categoryColor: '#8b5cf6',
    title: 'Instruções Mestre - Suporte Lynx',
    icon: 'Bot',
    description: 'Bloco de sistema dedicado a alinhar o comportamento do agente de WhatsApp integrado à plataforma.',
    steps: [
      'PERSONA: Você é a IA de "Suporte do Grupo Lynx". Seja prestativo, sempre use um tom educado, cordial e corporativo.',
      'RESTRIÇÃO DE GRUPO: Você atende exclusivamente o grupo "Metalfisa - Suporte Lynx". Se acionado fora dele, deve se recusar a interagir.',
      'DOMÍNIO DE CONHECIMENTO: Você domina todos os módulos deste arquivo. Quando um usuário perguntar "Como eu aponto uma O.P.?" ou "Para que serve a curva S?", busque nestas chaves a resposta exata.',
      'TRATATIVA DE ERROS: Ao identificar que o usuário encontrou um erro no sistema, oriente de forma prática usando as dicas cadastradas neste documento (ex: erros de 401, falta de estrutura, erro na integração do Protheus).',
      'FORMATAÇÃO: Envie respostas bonitas para o WhatsApp, utilizando *negrito* para botões e menus, listas com emojis adequados e evite respostas extremamente longas se puder resumir.'
    ],
    tips: [
      'Inicie os atendimentos com "Olá! Aqui é o Suporte do Grupo Lynx..." e encerre colocando-se à disposição.'
    ],
    links: []
  },

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

  // ── Manutenção ──────────────────────────────────────────────────────────────
  '/manutencao/execucao-modal': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Painel de Execução de Manutenção',
    icon: 'Play',
    description: 'Este modal centraliza todas as ações necessárias para executar e registrar uma manutenção na fábrica.',
    tabs: [
      {
        id: 'execucao',
        label: 'Aba de Execução',
        description: 'Registre tempo, técnicos e detalhes da execução.',
        steps: [
          'Cronômetro: Permite medir exatamente o tempo gasto na manutenção. Pressione Play ao iniciar e Pause ao interromper.',
          'Técnicos: É obrigatório selecionar ao menos um técnico envolvido na atividade.',
          'Atividades: Descreva os reparos, peças ajustadas e testes realizados.',
          'Fotos Pós-Manutenção: Anexe evidências do reparo concluído ou das peças substituídas.',
          'Problema Resolvido: Define se a máquina pode voltar a operar ou se a ordem continuará pendente.'
        ]
      },
      {
        id: 'materiais',
        label: 'Solicitação de Materiais',
        description: 'Solicite peças necessárias para o reparo.',
        steps: [
          'Caso precise de peças, solicite por aqui. O almoxarifado (ou compras) será notificado e o item entrará no fluxo de Gestão de Materiais.'
        ]
      },
      {
        id: 'historico',
        label: 'Histórico',
        description: 'Acompanhe a rastreabilidade da ordem.',
        steps: [
          'Registra todas as interações da Ordem (abertura, solicitações, pausas, finalizações) com usuário e horário exatos, garantindo a rastreabilidade (Log de Auditoria).'
        ]
      }
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' },
      { path: '/manutencao/atividades', label: 'Gestão de Atividades' }
    ]
  },

  // ── Faturamento e Comercial ──────────────────────────────────────────────────
  // Nota: entrada principal detalhada definida abaixo (linha ~1139). Esta é uma referência simplificada.
  '/vendas/itens-faturar-ref': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Itens a Faturar (Referência)',
    icon: 'ListOrdered',
    description: 'Consulte a entrada principal desta página para documentação completa das regras de saldo, programações PCP e fluxo de solicitação de faturamento.',
    steps: [],
    tips: [],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ver documentação completa' },
    ],
  },

  '/comercial/faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Controle de Faturamento',
    icon: 'FileText',
    description: 'Painel operacional para expedidores e faturistas tratarem as solicitações criadas pela equipe comercial.',
    steps: [
      'No painel esquerdo, navegue entre as abas "Pendente" (aguardando emissão da Nota) e "Faturado".',
      'Selecione uma solicitação para carregar os detalhes (itens, quantidades, valores e desenhos) no painel principal.',
      'Preencha o campo "Nota Fiscal (Macro / Cabeçalho)" e clique em "Salvar NF". Sem este campo, o sistema bloqueia a transição para Faturado.',
      'Faça o Check (✅) em cada item da lista (obrigatório) para confirmar a separação física.',
      'Clique no botão "Faturado" no cabeçalho para finalizar e travar a edição da remessa.',
      'Use a aba "Diário de Auditoria" no rodapé para visualizar a rastreabilidade completa (quem criou, alterou quantidades ou vinculou NF).'
    ],
    tips: [
      'Para exportar uma romaneio, utilize os botões "Excel" ou "PDF" no canto superior direito do painel da solicitação.',
      'Você pode despachar os XMLs/PDFs técnicos automaticamente marcando as faturas e clicando no botão flutuante "E-mail em Lote".',
      'Somente o usuário que faturou a nota (ou um Administrador) pode reverter o status ou editar quantidades após o faturamento.'
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
    description: 'Interface de listagem e acompanhamento global dos pedidos de venda abertos ou encerrados no sistema.',
    steps: [
      'Busque pedidos específicos utilizando a barra de pesquisa superior.',
      'Utilize os filtros de status para alternar entre pedidos abertos, faturados parcialmente ou totalmente encerrados.',
      'Clique sobre um pedido para visualizar os itens atrelados a ele e seu status de atendimento.',
      'Exporte a listagem atual clicando no botão Excel no cabeçalho.'
    ],
    tips: [
      'Esta tela oferece uma visão mais "limpa" focada estritamente no financeiro e no comercial, diferente da Gestão de OPs que foca na produção.'
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/vendas/itens-faturar', label: 'Itens a Faturar' },
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

  // ── Gestão de OPs / Pedidos de Venda ─────────────────────────────────────────
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
      'Modos de Apontamento (Livre, Sequência ou Saldo): Observe o indicador no topo. "Livre" permite apontar qualquer etapa sem amarras; "Sequência" trava o início até que a operação anterior acabe; "Saldo" limita a quantidade máxima ao saldo disponível da operação anterior.',
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
      'Modos de Apontamento: O indicador no topo dita a regra da fábrica. "Livre" = Sem amarras. "Sequência" = Obriga concluir a anterior. "Saldo" = Não deixa apontar peças que ainda não passaram pela operação anterior.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/controle-producao', label: 'Controle de Produção' },
    ],
  },

  // ── Controle de Produção e Lote de Planejamento ────────────────────────────
  '/controle-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Controle de Produção',
    icon: 'LayoutDashboard',
    description: 'Dashboard principal de PCP para acompanhamento e programação das Ordens de Produção (OPs). Permite filtrar, visualizar o status de cada operação e sequenciar planejamentos em lote com Gantt interativo.',
    steps: [
      '── FILTROS ──',
      'OP: Filtra pelo número da Ordem de Produção (ex: 005473). Aceita busca parcial.',
      'Item: Filtra pelo número do item dentro da OP (ex: 01). Útil quando uma OP possui múltiplos itens de produto.',
      'Seq: Filtra pelo número de sequência da operação dentro do roteiro da OP (ex: 001, 002). Cada passo do processo de fabricação tem uma sequência.',
      'Produto: Filtra pelo código ou descrição do produto (ex: MT2-1783 ou "CX FREIO").',
      'Cliente: Filtra pelo nome do cliente vinculado ao pedido de venda.',
      'Operação ou Recurso: Campo multiuso que filtra pelo código da operação (ex: 01) OU pelo código do recurso/máquina (ex: SOLDA, MO0012). Use para focar em um setor ou equipamento específico.',
      'Planejado (período): Filtra operações cujas datas planejadas de início e fim estejam dentro do intervalo informado. Útil para ver o que está programado para esta semana ou mês.',
      '── FILTROS DE STATUS (PILLS) ──',
      'Em Andamento (azul): Operações onde já foi registrado ao menos 1 apontamento de produção, mas a quantidade produzida ainda é menor que a planejada. A produção está ocorrendo.',
      'Concluídos (verde): Operações onde a quantidade produzida atingiu ou superou a quantidade planejada. O trabalho nesta etapa foi finalizado.',
      'Não Iniciados (cinza): Operações que ainda não possuem nenhum apontamento registrado. Podem estar planejadas (com datas) ou aguardando (sem datas definidas).',
      'Atrasadas (vermelho): Operações onde a data de entrega do pedido (prazo de entrega ao cliente) já passou e a produção ainda não foi concluída. Indica risco de atraso na entrega.',
      'Com saldo pendente (índigo): Quando ativado, exibe apenas OPs onde a quantidade produzida ainda é menor que a planejada. Remove da lista as operações 100% concluídas, focando no que ainda precisa ser feito.',
      '── COLUNAS DA TABELA ──',
      'Checkbox (primeira coluna): Permite selecionar uma ou mais OPs para sequenciar o planejamento em lote. O checkbox do cabeçalho seleciona/deseleciona todas as OPs visíveis de uma vez.',
      'Ordem de Produção: Exibe o número da OP (ex: 005473) e o Item (ex: Item 01). Linhas com fundo azul claro representam a operação principal (sequência 001 — primeira etapa do roteiro).',
      'Pedido: Número do Pedido de Venda (PV) do cliente no Protheus (ex: 003752) e abaixo o número do pedido do cliente (ex: 990478225). Permite rastrear qual demanda comercial originou esta OP.',
      'Cliente: Nome do cliente final para quem o produto será entregue. Truncado com reticências — passe o mouse para ver o nome completo.',
      'Produto: Código do produto (link clicável que abre a Estrutura/BOM) e abaixo a descrição do item. Clicar no código abre a árvore de componentes do produto.',
      'PDF (ícone): Indica se há desenho técnico (PDF) cadastrado para este produto. Ícone vermelho = PDF disponível, clique para abrir. Ícone cinza = sem documento cadastrado.',
      'Recurso: Código do recurso/máquina (ex: MO0012) em destaque e abaixo a descrição do centro de trabalho (ex: EMBALAGEM). É o equipamento ou setor onde esta operação será executada.',
      'Planejamento: Datas planejadas de início (I:) e fim (F:) desta operação, conforme registrado pelo PCP. Exibe "Não planejado" em cinza quando ainda não há datas definidas.',
      'Produção: Progresso da operação no formato "produzido / planejado" (ex: 0 / 1 ou 6 / 6). Acompanhado de uma barra de progresso visual. Chegando a 100% a barra fica verde.',
      'Status (badge): Resumo visual do estado atual da operação: "Planejada" (azul — tem datas definidas, ainda não iniciada), "Em Andamento" (azul escuro — produção iniciada), "Concluída" (verde — 100% produzido), "Atrasada" (vermelho — prazo ultrapassado).',
      'Ações: Botões de acesso rápido por linha: 📄 Impressão da OP, ☰ Histórico de planejamentos, 📊 Modal de Planejamento Sequencial (Gantt individual da OP).',
      '── SEQUENCIAMENTO EM LOTE ──',
      'Selecione múltiplas OPs usando os checkboxes. Geralmente selecione OPs do mesmo Recurso/Máquina para criar um pacote de trabalho coeso.',
      'Com OPs selecionadas, clique em "Sequenciar Planejamento". O modal Gantt abrirá com todas as operações agrupadas por recurso.',
      'No Gantt, defina datas, arraste barras, edite durações e escolha entre cálculo progressivo (frente) ou regressivo (trás). Ao salvar, todas as operações recebem datas planejadas de uma só vez.',
      'Clique em "Limpar" para desmarcar todas as OPs selecionadas sem precisar percorrer a lista.',
    ],
    tips: [
      'Estratégia de uso: Filtre por Recurso específico (ex: MO0012) + status "Não Iniciados" para ver a fila de trabalho daquela máquina e planejar em sequência.',
      'Linhas com fundo azul representam a sequência 001 (operação raiz do roteiro) — em geral é a primeira etapa da fabricação daquele item.',
      'A coluna "Produção" (ex: 6/6) mostra apontamentos já registrados no chão de fábrica. Quando chega em 100%, o status vira "Concluída" automaticamente.',
      'Operações "Atrasadas" (vermelho) indicam que o prazo de entrega ao cliente já venceu — priorize essas no planejamento.',
      'O filtro "Com saldo pendente" é o padrão recomendado: mantém a lista limpa, mostrando apenas o que ainda precisa de atenção do PCP.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' },
      { path: '/relatorios', label: 'Relatórios de Produção' },
    ],
  },

  // ── Exportação de Lista de Materiais (PCP) ───────────────────────────────────
  '/pcp/exportacao-materiais': {
    category: 'PCP / Engenharia',
    categoryColor: '#6366f1',
    title: 'Exportação de Lista de Materiais',
    icon: 'FileSpreadsheet',
    description: 'Esta ferramenta permite compilar todas as matérias-primas necessárias para produzir uma determinada seleção de itens de pedido, agrupando itens idênticos e somando quantidades para enviar a compras e ao almoxarifado.',
    steps: [
      'Filtrar Pedidos Pendentes: Utilize a barra de filtros no topo para buscar os pedidos. Por padrão, ele lista apenas os pedidos com saldo pendente (chave Pendentes). Ao preencher os filtros, clique no botão Buscar.',
      'Selecionar Itens na Tabela: Marque as caixas de seleção na primeira coluna para os produtos que você deseja produzir. Você pode selecionar um por um, ou usar o botão Selecionar todos no cabeçalho da tabela.',
      'Processar e Exportar: Assim que selecionar pelo menos 1 item, uma barra flutuante azul aparecerá na parte inferior da tela. Clique em Gerar Lista de Materiais.',
      'O Resultado Automático (Excel): O sistema fará a "explosão" de toda a árvore de produtos em segundo plano, até o último nível (matéria-prima final). Então fará a multiplicação pela quantidade a faturar do pedido e consolidará todas as matérias-primas unificando pela descrição e código. Um arquivo Excel pronto será baixado automaticamente!',
    ],
    tips: [
      'Atenção aos itens destacados em vermelho e com a marcação "Sem estrutura". Itens sem estrutura não gerarão consumo de matéria-prima na exportação, pois a engenharia não cadastrou seus componentes no sistema.',
      'Exemplo Prático de Agrupamento: Se você selecionou Item A (Qtd: 10) que possui 4 Un de Parafuso e Item B (Qtd: 5) que possui 2 Un do mesmo Parafuso, a planilha listará apenas uma linha para o "Parafuso" com a quantidade total igual a 50 (10x4 + 5x2).',
    ],
    links: [
      { path: '/comercial/gestao-ops', label: 'Gestão de OPs' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  // ── Pedidos de Engenharia ────────────────────────────────────────────────────
  '/engenharia/pedidos': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Ata Viva (Pedidos de Engenharia)',
    icon: 'Ruler',
    description: 'Interface de Ata Viva departamental (PCP/Produção e Engenharia). Esta janela quebra a barreira entre as áreas, mantendo um log rigoroso do que está em desenvolvimento, pausado ou reprovado pelo PCP.',
    steps: [
      'Apontamento Inteligente (Cronômetro): Na coluna de Ações, o botão Play ▶️ dispara o cronômetro do seu usuário para esta tarefa. O sistema fecha/pausa todos os seus outros apontamentos automaticamente. Nada de "esquecer ligado".',
      'Coluna Dupla de Entrega: A tabela exibe sempre lado a lado a "Data Prazo Acordada" e a "Data Real Entregue". Esta matemática alimenta os painéis de diretoria evidenciando gargalos sistêmicos de atraso.',
      'Persistência de Visão (Customização): Arraste as colunas da tabela pelo Header para reordenar. Esconda colunas que você não quer ler no botão de engrenagem. Tudo isso fica salvo no cache da sua máquina e nunca mais se perde.',
      'Adição Rápida Multi-Filtros: Os botões pílulas coloridos (Amarelo = Em Processo, Verde = Aprovado) no cabeçalho filtram instantaneamente a pilha.',
    ],
    tips: [
      'Sanitização Automática: Evite digitar aspas ou caracteres especiais pesados no campo "Resumo/Restrição". O motor que sobe os dados pro Totvs os transforma obrigatoriamente para UPPERCASE e os higieniza pra salvar a tabela SZ0 de corrupção.',
      'Para apontar horas do passado ou reverter um esquecimento, clique no modal de detalhes engrenagem => aba "Apontamentos ⏱️" e inclua carga manual fracionária.',
    ],
    links: [
      { path: '/engenharia/relatorio-controle', label: 'Relatórios Nível 1' },
      { path: '/estrutura/:codigo', label: 'Verificar Escopo (Estrutura)' },
    ],
  },

  // ── Relatório de Controle de Engenharia ──────────────────────────────────────
  '/engenharia/relatorio-controle': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Relatório Nível 1 (Controle Engenharia)',
    icon: 'FileText',
    description: 'Geração do formato tradicional "Relatório Nível 1" adaptado. Consumo cru, apenas visualizando requisições (SZ0) em status sólido e Aprovadas para auditoria de entrega.',
    steps: [
      'Filtro Rígido de Aprovados: A tabela traz internamente um hook embutido que descarta O.S reprovadas ou em andamento. Só aparecem cargas sólidas prontas.',
      'Consumo Financeiro de HH: Observe as engrenagens de Apontamento - as "Horas Totais" não vêm secas. Elas agregam a soma do cronômetro automatizado mais todas injeções manuais feitas pela equipe em dias passados.',
      'Exportação para XLS: Uma vez com a malha filtrada em tela, clique no botão para vazar o dado pro Excel que a diretoria usa p/ fechar folha ou precificar OP.',
    ],
    tips: [
      'Para os cálculos de HH no Totvs, 0.5h equivale a 30 minutos na vida real. A exportação mantém o formato de engenharia para multiplicar pelo custo da hora/homem sem erro.',
    ],
    links: [
      { path: '/engenharia/pedidos', label: 'Corrigir Lançamento no Pedido' }
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

  // ── Controle de Produção (entrada duplicada removida — mantida acima) ────────

  // ── Planejamento Sequencial ──────────────────────────────────────────────────
  '/planejamento-sequencial': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Planejamento Sequencial de OPs',
    icon: 'GanttChart',
    description: 'Interface de planejamento refinado e sequencial. Permite agendar as operações de uma Ordem de Produção considerando a duração inclusiva de cada etapa, saltando dias não úteis (ou forçando sábados) e criando um encadeamento progressivo ou regressivo.',
    steps: [
      'Escolha a Direção do Cálculo: No topo, defina se o cálculo será "Progressivo" (A partir de uma data inicial) ou "Regressivo" (De trás para frente, garantindo a data de entrega).',
      'Ajuste o Calendário: Alterne entre "Corridos" (considera todos os dias da semana) ou "Úteis" (ignora Sábado e Domingo). No modo "Úteis", você pode forçar a inclusão do Sábado marcando a caixa "Incluir Sábado".',
      'Arraste e Solte (Drag & Drop): Clique sobre a faixa colorida de uma operação e arraste para os lados para deslocar livremente aquela etapa.',
      'Edição de Duração: A primeira célula de cada barra contém um pequeno campo numérico (ex: 3 d). Clique ali para digitar os dias estimados; o gráfico recalculará o encadeamento das próximas etapas automaticamente.',
      'Incluir Serviços de Terceiro (ST): Marque "Incluir ST" se desejar que serviços externos travem o fluxo do Gantt, alongando a entrega.',
    ],
    tips: [
      'A linha base em tons acinzentados fica visível por trás das barras principais, mostrando o planejamento anterior, permitindo comparar a sua simulação atual com o que já estava salvo no banco.',
      'Ao alterar a data de entrega (Cálculo Regressivo), todas as operações são empurradas para trás respeitando os dias informados de trás pra frente.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Carga Máquina Total' },
      { path: '/planejamento-gantt', label: 'Gantt Master' },
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

  // ── Apontamento Vertical e Multi-Operação ─────────────────────────────────────
  '/pcp/apontamento-vertical': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Apontamento Vertical & Multi-Operação',
    icon: 'ListChecks',
    description: 'Central ágil para registro de produção. O novo recurso de Apontamento Multi-Operação permite dar baixa sistêmica em várias etapas do roteiro de uma só vez, ideal para fechar saldos de processos que ocorreram em sequência.',
    steps: [
      'Busca Rápida: Utilize os filtros no topo (Pedido, OP, Código do Produto ou Máquina) para localizar exatamente a operação que você vai apontar.',
      'Abrindo o Modal: Clique no ícone verde de "Apontar" (CheckSquare) na última coluna da operação desejada.',
      'Apontamento Multi-Operação: Ao abrir o modal, o sistema não exibirá apenas a etapa atual. Ele listará todas as operações ANTERIORES do roteiro daquele produto, informando o Saldo (peças pendentes de apontamento) de cada uma.',
      'Auto-Preenchimento Inteligente (A Mágica): Quando você digita uma quantidade na "Operação Atual", o sistema automaticamente preenche as operações anteriores. Ele limita o valor copiado ao máximo permitido pelo Saldo de cada etapa anterior.',
      'Exemplo de Auto-Preenchimento: Se a Operação 10 tem 50 de saldo, a 20 tem 20 de saldo, e a 30 (Atual) tem 50 de saldo. Ao digitar "50" na atual, a etapa 20 será preenchida com "20" (limite dela) e a 10 com "50".',
      'Auditoria de Operador: O seu usuário logado ficará gravado no Histórico de todas as operações apontadas. Porém, para as etapas anteriores que foram auto-preenchidas, o sistema gravará seu nome com a tag "(Baixa Auto)", garantindo total transparência de quem operou a máquina versus quem fez a baixa sistêmica.',
      'Tempos (Cronômetro): Você pode usar o "Cronômetro de Operação" no topo para marcar o tempo exato (Início e Fim). O mesmo tempo será replicado para as baixas automáticas anteriores que ocorrem no mesmo lote.',
    ],
    tips: [
      'Se o valor preenchido automaticamente na etapa anterior ficar com erro (vermelho), é porque ultrapassou o Saldo. O botão de salvar será bloqueado até a correção.',
      'Para apontar apenas a operação atual sem mexer nas anteriores, basta zerar manualmente os campos das operações anteriores antes de clicar em Confirmar.',
      'Regra de Apontamento: Observe a etiqueta no topo do Modal (Livre, Sequência ou Saldo) para entender as restrições impostas pela fábrica.',
      'Configuração das Regras: A ativação/desativação da trava de Saldo ou Sequência é feita pelos Administradores no menu "Configurações Globais" > aba "Regras de Negócio", no campo "Regra de Apontamento de Produção".',
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

  // ── Onde é Usado (Where-Used) ────────────────────────────────────────────────
  '/pcp/onde-usado': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Onde é Usado (Where-Used)',
    icon: 'Network',
    description: 'Ferramenta de busca reversa para descobrir em quais produtos um determinado componente ou matéria-prima é utilizado. Essencial para análises de impacto de substituição, engenharia reversa e estudos de custo.',
    steps: [
      'Insira o código do produto ou componente no campo de busca e pressione Enter (ou clique em Buscar).',
      'O sistema varrerá a árvore de estruturas (BOM) e apresentará o total de usos encontrados.',
      'Os resultados são organizados em blocos por Nível, permitindo que você veja quão profundo na estrutura o seu componente está inserido (Nível 1, 2, etc).',
      'Para cada produto pai listado nos resultados, você tem a opção de acessar diretamente a estrutura daquele produto clicando no botão azul.',
      'Se o produto pai possuir um desenho técnico (PDF) cadastrado, o botão vermelho de PDF estará disponível para visualização imediata.',
    ],
    tips: [
      'Esta tela é vital antes de descontinuar ou alterar um componente: você saberá exatamente quais produtos finais serão afetados pela mudança técnica.',
      'Utilize os botões de atalho em cada card para acessar rapidamente os Desenhos ou a Visão de Estrutura (BOM) do produto pai.',
    ],
    links: [
      { path: '/produtos', label: 'Catálogo de Produtos' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
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

  // ── Relatórios PCP ───────────────────────────────────────────────────────────
  '/relatorios': {
    category: 'Relatórios / PCP',
    categoryColor: '#6366f1',
    title: 'Relatórios de Produção e PCP',
    icon: 'FileBarChart',
    description: 'Central de relatórios gerenciais e operacionais do PCP. Reúne três análises estratégicas em abas: (1) Espelho de Produção — visão operacional detalhada de cada OP; (2) Evolução por Recurso — matriz de progresso produtivo por centro de trabalho e pedido/produto; e (3) Saldo de Estoque — posição atual de materiais. Os filtros superiores são compartilhados entre as abas e persistem durante a sessão de navegação.',
    steps: [
      '── ABA: ESPELHO DE PRODUÇÃO ──',
      'Esta aba exibe, linha a linha, todas as Ordens de Produção (OPs) que se enquadram nos filtros selecionados. Cada linha representa uma OP individual com seus dados completos.',
      'Coluna "OP / Item": Código da Ordem de Produção gerada no ERP Protheus (campo C2_NUM + C2_ITEM). Identifica unicamente cada lote de produção dentro de um pedido.',
      'Coluna "Produto / Descrição": Código do produto (C2_PRODUTO) e sua descrição comercial registrada no cadastro do item (SB1). Permite identificar o que está sendo produzido.',
      'Coluna "Pedido de Venda (PV)": Número do pedido de venda (C2_PEDIDO) ao qual esta OP está vinculada. Um PV pode conter múltiplas OPs para diferentes itens ou lotes.',
      'Coluna "Cliente": Nome do cliente final (SA1) para quem o produto será entregue, extraído automaticamente através do PV vinculado.',
      'Coluna "Qtd Planejada": Quantidade total de peças a produzir nesta OP conforme planejamento original do ERP (C2_QUANT). É a meta de produção do lote.',
      'Coluna "Data Início Planejada": Data prevista para início da produção desta OP no ERP Protheus (C2_DATPRI, formato YYYYMMDD convertido). Representa quando o PCP programou o início do trabalho.',
      '── ABA: EVOLUÇÃO POR RECURSO ──',
      'Esta é a análise mais estratégica: uma matriz cruzada onde as LINHAS representam pedidos ou produtos, e as COLUNAS representam cada RECURSO/MÁQUINA/CENTRO DE TRABALHO da fábrica.',
      'Como ler a matriz: Cada célula no cruzamento linha × coluna mostra o progresso de produção daquele grupo (pedido/produto) naquele recurso específico.',
      'Barra de progresso (dentro de cada célula): Representa percentualmente quanto já foi produzido em relação ao total planejado para aquele recurso. Ex: 75% = 750 pçs apontadas de 1000 planejadas. A barra fica verde ao completar 100%.',
      'Rótulo "Plan. DD/MM a DD/MM" (azul): Intervalo de datas planejadas de início para as OPs deste grupo neste recurso, extraído do campo C2_DATPRI do Protheus. Quando todas as OPs têm a mesma data planejada, aparece data única; quando há OPs com datas diferentes (ex: lotes escalonados), aparece o intervalo "01/04 a 15/04", indicando a janela de produção prevista.',
      'Rótulo "Início DD/MM" (verde): Data real do primeiro apontamento de produção registrado no sistema para este recurso neste grupo. Representa quando a fábrica efetivamente começou a trabalhar neste lote. A diferença entre "Plan." e "Início" evidencia se a produção começou antes, na data ou após o planejamento.',
      'Cabeçalho da coluna (recurso): Exibe o código do recurso em negrito (ex: MO0002) e abaixo a descrição do centro de trabalho ou máquina (ex: PUNCIONADEIRA). Esses recursos são extraídos do roteiro de fabricação (SG2/SH1) cadastrado no Protheus.',
      'Células vazias (—): Indicam que aquele grupo (pedido/produto) não possui operações planejadas ou apontamentos para aquele recurso específico. Pode significar que o produto não passa por aquela máquina.',
      'Arrastar e reorganizar colunas: Clique e arraste o ícone de 6 pontos (⠿) no cabeçalho de qualquer coluna para reordenar os recursos conforme a sequência do processo produtivo real da sua fábrica. A ordem é salva automaticamente por usuário.',
      'Botão "Salvar Ordem" (admin): Administradores podem salvar a ordem de colunas como padrão global para todos os usuários da empresa.',
      'Botão "Resetar Ordem": Retorna a ordem das colunas ao padrão original (ordenação alfabética por código de recurso).',
      'Agrupamento "Agrupar por": Defina se as LINHAS da matriz representarão Pedidos de Venda (visão comercial — cada linha = 1 cliente/pedido), Produtos (visão fabril — cada linha = 1 código de produto com total acumulado) ou OPs individuais (visão detalhada — cada linha = 1 lote específico).',
      '── FILTROS COMPARTILHADOS ──',
      'Data Início / Data Fim: Filtra as OPs pela data planejada de início (C2_DATPRI). Permite focar na programação de um período específico, como "ver apenas o que está planejado para abril".',
      'Cliente: Texto livre que filtra pelo nome do cliente. Útil para ver toda a carga de produção de um cliente específico.',
      'Pedido de Venda: Número exato ou parcial do PV para filtrar um pedido específico.',
      'Produto: Código ou descrição parcial do produto para análises por item.',
    ],
    tips: [
      'Interpretação estratégica da célula: Se "Plan. 01/04 a 15/04" mas "Início" está vazio, significa que a produção para aquele recurso ainda não começou — verificar se há atraso ou se o período ainda não chegou.',
      'Se "Início" for anterior ao "Plan.", a produção começou antes do planejado — positivo em termos de antecipação.',
      'A barra de progresso usa a quantidade planejada por recurso (baseada no roteiro SG2 × quantidade da OP). Caso o produto não tenha roteiro cadastrado, o sistema usa a quantidade total da OP como base.',
      'Produtos sem roteiro de fabricação completo no Protheus (SG2) ainda aparecem na matriz quando possuem apontamentos registrados — a data planejada é extraída diretamente da OP.',
      'A persistência dos filtros usa sessionStorage: fechar o navegador limpa os filtros; navegar entre páginas dentro do sistema mantém os valores preenchidos.',
      'Para análises de capacidade de um recurso específico, ordene aquela coluna para a esquerda e use agrupamento por "Pedido" para ver todos os clientes aguardando aquela máquina.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/producao-matrix', label: 'Matriz de Produção (Carga Máquina)' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
      { path: '/saldo-materiais', label: 'Saldo de Materiais' },
    ],
  },

  '/producao/relatorios': {
    category: 'Relatórios / PCP',
    categoryColor: '#6366f1',
    title: 'Relatórios de Produção e PCP',
    icon: 'FileBarChart',
    description: 'Acesso alternativo aos relatórios de produção. Consulte a entrada "/relatorios" para documentação completa de todas as abas e campos disponíveis.',
    steps: [
      'Esta rota exibe o mesmo painel da rota /relatorios.',
      'Consulte a ajuda de "/relatorios" para instruções detalhadas sobre cada aba, campo e indicador.',
    ],
    tips: [
      'Os filtros persistem ao navegar entre /relatorios e /producao/relatorios dentro da mesma sessão.',
    ],
    links: [
      { path: '/relatorios', label: 'Relatórios PCP (Principal)' },
      { path: '/producao-matrix', label: 'Matriz de Produção' },
    ],
  },


  // ── Configurações ─────────────────────────────────────────────────────────────
  '/configuracoes': {
    category: 'Administração Core',
    categoryColor: '#64748b', // slate-500
    title: 'Painel de Configurações Master',
    icon: 'Settings',
    description: 'Central de controle absoluto do MetalFisa PCP. Aqui o administrador gerencia desde a identidade visual da empresa até o monitoramento de desempenho dos servidores em tempo real, organizados em abas de fácil acesso.',
    steps: [
      '── GERAL ──',
      'Configura a identidade da empresa (Nome, CNPJ, Endereço, Telefones e Logo) que sairá nos cabeçalhos dos relatórios em PDF. Aqui também se define a numeração de base para criar os próximos Romaneios.',
      '── VISIBILIDADE DE PEDIDOS ──',
      'Permite ligar ou desligar a visualização de status específicos de pedidos (ex: "Faturado", "Aguardando Produção"). O interruptor global Master pode ocultar instantaneamente lotes encerrados das tabelas de todo o sistema.',
      '── MENU & NAVEGAÇÃO ──',
      'Controle modular da plataforma. Ative ou oculte módulos e ferramentas do sistema (ex: VMI, Produção, Compras, Almoxarifado) no menu lateral para otimizar a visão de todos.',
      '── PERFIS DE ACESSO & USUÁRIOS ──',
      'Em "Perfis de Acesso", crie agrupamentos de cargos (Ex: Operador, Comercial, PCP). Na aba "Usuários", você cadastra novos funcionários, gera senhas de entrada, bloqueia contas e edita dados básicos.',
      '── APROVAÇÕES PENDENTES ──',
      'Lista de usuários que solicitaram cadastro via tela de login e estão bloqueados aguardando a liberação oficial do Administrador para acessar o chão de fábrica.',
      '── PERMISSÕES ──',
      'Matriz fina de segurança. Permite ligar chaves de acesso a nível microscópico ("Visualizar", "Editar", "Excluir") tela a tela, de acordo com cada perfil da empresa.',
      '── RELATÓRIOS ──',
      'Configura o motor de envio automático e regras do PCP. Defina os e-mails da diretoria que receberão o resumo de faturamentos e acompanhamentos da fábrica automaticamente no fim do dia.',
      '── INTELIGÊNCIA ARTIFICIAL ──',
      'Ajustes do agente autônomo e do orquestrador de automações sistêmicas integrados para suporte inteligente aos colaboradores.',
      '── E-MAIL CORPORATIVO & NOTIFICAÇÕES ──',
      'Na aba "E-mail Corporativo", configure a conta SMTP de envio. Na aba "Notificações", você ganha um log de auditoria detalhado de todos os alertas disparados no dia.',
      '── MONITORAMENTO ──',
      'Painel avançado de Observabilidade. Traz dados vitais do servidor como Usuários Conectados (Socket), carga de processador (CPU), Memória RAM, sobrecarga do Banco de Dados (Consultas Hora) e tráfego de Rede. O histórico retém a progressão e permite avaliar gargalos.'
    ],
    tips: [
      'As alterações de Permissões ou Menu de Navegação entram em vigor imediatamente na próxima requisição do funcionário afetado.',
      'A aba de "Monitoramento" acumula amostras a cada hora. Use-a ativamente para auditar se o seu servidor não está sendo sobrecarregado no horário de pico do PCP.'
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda Master' },
      { path: '/sgq/mapeamento-processos', label: 'Gerenciar Ajuda do Sistema' },
    ],
  },

  // ── SGQ ──────────────────────────────────────────────────────────────────────
  '/sgq': {
    category: 'Gestão de Qualidade',
    categoryColor: '#14b8a6', // teal-500
    title: 'ISO 9001 - Central de Qualidade',
    icon: 'Award',
    description: 'Suíte completa desenhada seguindo a métrica da ISO 9001 (Documentos, Não Conformidades (RNC), Ações Corretivas e Preventivas e Treinamentos). O Hub gerencial converte planilhas estáticas num PDCA dinâmico.',
    steps: [
      'Ouvidoria de Qualidade: Acompanhe os cards flutuantes. Se houver RNC não respondida por um departamento num prazo de SLA (ex: 5 dias para contenção), ela brilhará em vermelho.',
      'Convergência com Fabricação: Qualquer peça reportada como "Refugo" na tela Apontamentos V2 pelo Operador abre automaticamente trilha preenchida neste módulo.',
      'Monitoria de Treinamento: Avalie por Organograma (Setor > Gestor > Operador) quais matrizes de habilidade estão "vencendo" validade e exigem Re-Treinamento.',
    ],
    tips: [
      'A aba de documentos versiona com trava de revisão. Nunca é possível excluir uma matriz antiga, ela cai para o "Obsoleto".',
    ],
    links: [
      { path: '/sgq/mapeamento-processos', label: 'VPOP - Visualizar Fluxo' },
      { path: '/sgq/nao-conformidades', label: 'RNC (Aberturas)' },
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
    description: 'Visão consolidada de todos os saldos pendentes de faturamento. Cada linha representa uma programação PCP vinculada a uma OP de produção — permitindo selecionar itens prontos, ajustar quantidades e gerar solicitações formais de faturamento com rastreabilidade completa.',
    steps: [
      'Entendendo o Saldo a Faturar: A coluna "Saldo" exibe o saldo real do ERP (SC6010: quantidade total do pedido menos o que já foi faturado/entregue). Apenas itens com Saldo > 0 podem ser selecionados. Por padrão a tela já filtra somente esses itens (toggle "Apenas Pendentes" ativo).',
      'Linhas por Programação PCP: Quando um item de pedido possui uma programação PCP registrada, ele aparece como uma linha individual com data de entrega, série do cliente, série MetalFisa, nº de série, lote e nº lote. Isso significa que um mesmo item pode gerar múltiplas linhas se tiver múltiplas programações — cada uma representando um lote ou série distinto a ser faturado.',
      'Filtro "Mostrar Apenas Prontos (Produzidos)": Filtra client-side, exibindo somente linhas onde o Saldo Produzido (quantidade já fabricada pela produção) seja maior que zero. Use esse filtro para identificar o que pode ser faturado IMEDIATAMENTE pois já saiu da fábrica.',
      'Filtro por Data PCP: Use os campos "De/Até" da seção roxa para filtrar por data de entrega programada pelo PCP, independente da data do pedido de venda.',
      'Selecionando Itens: Clique na linha ou no checkbox para selecionar. Uma barra flutuante aparecerá no rodapé mostrando quantos itens estão selecionados e o valor total acumulado. Clique em "Avançar e Revisar" para abrir o modal de confirmação.',
      'Revisando no Modal: No modal de revisão, cada item exibe seu Saldo Faturar (máximo permitido) e um campo "Qtd. Solicitada" editável. O sistema bloqueia quantidades maiores que o saldo disponível. Preencha uma observação opcional e clique em "Gerar Solicitação de Faturamento".',
      'Semaforização (Status): ⚪ A FATURAR = nenhuma entrega ainda. 🟠 FAT. PARCIAL = já houve faturamento anterior mas ainda resta saldo. 🟢 FATURADO 100% = saldo zerado no ERP (normalmente oculto pelo toggle "Apenas Pendentes").',
      'Coluna "Fat. Solicitados": Exibe as solicitações de faturamento já abertas para aquela linha. Use isso para evitar duplicidade: se outro setor já gerou uma solicitação para o mesmo item/programação, você verá o número aqui antes de criar uma nova.',
      'Coluna "NFs Anteriores": Mostra os números das Notas Fiscais já emitidas para esse item no ERP. Clique no botão da NF para ver os detalhes completos (série, chave, datas, valores).',
      'Visualização de Desenho Técnico: Se houver PDF cadastrado na nuvem para o produto, o ícone de documento (vermelho) na coluna PDF estará ativo. Clique para abrir o arquivo.',
    ],
    tips: [
      'O Saldo a Faturar vem direto do Protheus (SC6010): é a diferença entre c6_qtdven (qtd pedida) e c6_qtdent (qtd já entregue/faturada no ERP). Ele só cai após a emissão efetiva da Nota Fiscal no Protheus — gerar uma solicitação aqui NÃO reduz o saldo imediatamente.',
      'Um pedido com produção fracionada em várias OPs aparecerá em linhas separadas, uma por OP/programação. Cada linha tem seu próprio conjunto de dados PCP (série, lote, data de entrega), refletindo exatamente o que o PCP planejou para aquela fração.',
      'Use o filtro por Nº do Pedido com busca manual (botão "Buscar Dados") para carregar todos os itens de um pedido específico de uma vez — o sistema remove a paginação e traz até 5.000 registros quando o campo Pedido está preenchido.',
      'Para saber se um item já está pronto para faturar: ative "Mostrar Apenas Prontos" e filtre por data PCP. Isso cruza produção já executada com a programação comercial, mostrando o que pode sair hoje.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Monitor de NFs (Controle)' },
      { path: '/romaneios', label: 'Romaneios Embalagem' },
      { path: '/comercial/dashboard-faturamento', label: 'Dashboard Gerencial de Faturamento' },
      { path: '/vendas/faturamento-historico', label: 'Histórico de Solicitações' },
    ],
  },

  // ── Comercial / Dashboard Gerencial de Faturamento ───────────────────────────
  '/comercial/dashboard-faturamento': {
    category: 'Comercial',
    categoryColor: '#3b82f6',
    title: 'Dashboard de Faturamento',
    icon: 'PieChart',
    description: 'Cockpit financeiro-operacional em tempo real. Lê todo o pool de faturamentos pendentes ou efetuados na data, cruza com as Metas de Carregamento da empresa e exibe gráficos analíticos gerenciais.',
    steps: [
      'Análise em Tempo Real (KPIs): No topo estão os Tickers principais. Eles apontam o Volume de Dinheiro Faturado nas notas VS o Financeiro parado nos caminhões ("Pendente").',
      'Matriz de Status de Solicitações: O gráfico de Pizza (Donut) à esquerda quebra as estatísticas, dizendo se o financeiro está travado em "Cancelamentos" ou aguardando "Atendimento".',
      'Ouvidoria de Dados Dinâmicos: Todo o teto de gastos da interface muda dinamicamente à medida que você altera as Datas de Competência ou Filtra Clientes na Sidebar de configurações à frente.',
      'Top Clusters: O painel bar graphic exibe o "Top 10" agressores de ranking (seja agrupando por Top 10 Clientes Faturados ou Top Produtos da Linha que renderam o financeiro no recorte).',
    ],
    tips: [
      'O gráfico de Top 10, quando virado "Por Cliente" no select principal, pode ajudar a diretoria a priorizar o carregamento de carretas na doca logística priorizando as OPs mais caras.',
      'Leva alguns milissegundos, mas a tela faz um bypass por todo o legado ERP para validar cancelamentos falsos. O número exibido é 100% Líquido e livre de estornos indevidos.',
    ],
    links: [
      { path: '/vendas/itens-faturar', label: 'Ver Itens a Faturar (Base de Dados)' },
      { path: '/comercial/faturamento', label: 'Ir Gestão de NFs' },
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
    title: 'Controle de Faturamento',
    icon: 'FileInvoice',
    description: 'Central corporativa de liberação e controle de Faturas e Expedição. Realize a vinculação das NFs e o fechamento ou estorno final de solicitações abertas.',
    steps: [
      'Controle Visual: Utilize a aba de filtros para navegar entre cargas "Pendentes", "Faturadas" ou "Canceladas".',
      'Trava de Segurança: Lotes marcados como "Faturado" sofrem congelamento automático. Apenas o usuário que realizou e assinou o fechamento do lote tem permissão para editá-lo, remover itens ou estorná-lo.',
      'Auditoria de Alterações: O painel lateral monitora toda a linha do tempo (timeline) cronológica exibindo quem, o quê e quando alguma quantidade ou status de faturamento foi reescrito.',
      'O sistema inclui um Agendador Noturno que dispara um Relatório Gerencial consolidado via e-mail corporativo (para a equipe cadastrada) sempre às 18h01 com a carga pendente total.',
    ],
    tips: [
      'A automação diária das 18h01 de notificação pode ser desligada caso os e-mails na aba de configurações na tabela da grid sejam removidos.',
      'Caso necessite alterar a Nota Fiscal de um lote travado de outra pessoa, você precisará pedir que o dono do lote faça a mudança ou reset.',
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
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Monitor de Consumo e Previsões (Forecast)',
    icon: 'TrendingUp',
    description: 'Interface avançada para prever matematicamente a necessidade diária de consumo das montadoras baseada no giro histórico. Este painel dita o ritmo de reposição da MetalFisa.',
    steps: [
      'Visualização Mensal/Diária: Navegue entre a "Visão Diária" (focada nas entregas do dia D e da semana) e a "Visão Mensal" agregada.',
      'Ajuste Sensível de Previsão: Digite manualmente no input numérico se o cliente mandou uma quebra de projeção forçada. O sistema vai ignorar a média nativa e vai adotar sua cotação.',
      'Comparações Real vs Desejado: Cada linha de produto exibe o que estava previsto contra o Consumo Efetivo (Baixas por Notas Fiscais ou Reporte de Cliente).',
      'Exportação Tática: Utilize o botão Exportar para gerar um grid em Excel validado que as montadoras utilizam em suas reuniões D-1 de abastecimento.',
    ],
    tips: [
      'Mudanças feitas no forecast são rastreadas e o sistema sempre avisa "Atualizado em" com o carimbo do usuário que realizou a última sobreposição matemática.',
      'Caso a previsão seja "zerada" a linha entra em modo ad-hoc (reposologia por pulo).',
    ],
    links: [
      { path: '/vmi/pedido', label: 'Monitor de Pedidos VMI' },
      { path: '/vmi/leitura', label: 'Importador Excel do Cliente' },
    ],
  },

  // ── VMI Pedido ───────────────────────────────────────────────────────────────
  '/vmi/pedido': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Carga de Pedidos VMI e Necessidades',
    icon: 'ShoppingBag',
    description: 'Mesa de operações focada na transformação das projeções do fluxo de linha em Pedidos reais (necessidade de carregamento / empurrar estoque pro cliente).',
    steps: [
      'Recepção Passiva: Todo cliente VMI que roda seu MRP de planta mandará as ordens de EDI e elas caem neste painel.',
      'Validação de Cobertura: O botão verde / amarelo à direita avalia instantaneamente se nós temos a peça no almoxarifado interno MetalFisa ou se estamos arriscando Parada de Linha do Cliente.',
      'Gatilho de Produção: Sempre que um componente apresenta defasagem e o indicador Ponto de Reposição estoura, um gatilho envia um "Sinal de Fumaça" direto para a fila do planejamento de fábrica gerando Sugestão de OP.',
    ],
    tips: [
      'As requisições que caem aqui respeitam a curva ABC do VMI: componentes críticos aparecem primeiro!',
      'Você pode gerar faturamento diretamente dessa carga caso o item possua estoque físico na planta em Embalagem/Faturamento.',
    ],
    links: [
      { path: '/vmi/forecast', label: 'Verificar Consumo Original' },
      { path: '/vmi/dashboard', label: 'Analisar Riscos no Dashboard' },
    ],
  },

  // ── VMI Leitura ──────────────────────────────────────────────────────────────
  '/vmi/leitura': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Importador (Leitura) de Excel dos Clientes',
    icon: 'BarcodeScan',
    description: 'Processo super flexível para traduzir a planilha dos portais de clientes (CNH, Catterpillar, JD, etc) para a arquitetura do ERP MetalFisa.',
    steps: [
      'Importação em Duas Etapas: Ao fazer drag-and-drop da planilha de inventário do cliente, a tela primeiro exibe o Modo de Pré-Visualização das métricas. Sem salvar.',
      'Intersecção de Códigos: Internamente o módulo captura o famoso "Descr do Equipamento" (código descritivo extenso das colunas em texto) e aciona o motor regex.',
      'Expurgo Inteligente: O motor Regex engole os sufixos "-10", "-B", "-ZN" exigidos por clientes e converte pro Código Base limpo registrado na aba SC2 da MetalFisa. Nenhuma falha manual entra na base.',
      'Botão Salvar / Commit: Apenas quando tudo estiver verde/OK e as validações visuais não apontarem linhas orfãs, o botão Salvar grava o bloco de dados validado no sistema.',
    ],
    tips: [
      'Regra 401 de Segurança: Após o Login e o Auth vencerem (401), se der tela vermelha ou o envio falhar no Console, basta relogar. A API deste módulo é rigidamente restrita.',
      'As mensagens de retorno do Importador são auditadas num cronômetro.',
    ],
    links: [
      { path: '/vmi/dashboard', label: 'Impactos no Abastecimento' },
    ],
  },

  // ── VMI Dashboard ────────────────────────────────────────────────────────────
  '/vmi/dashboard': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Monitor de Saúde Preditiva (Dashboard VMI)',
    icon: 'LayoutDashboard',
    description: 'Dashboard executivo paramétrico que mescla a Cobertura Física (Almoxarifado) com a Demanda Futura do Cliente (Forecast). Este é o termômetro principal do programa.',
    steps: [
      'Análise de Nível de Serviço (SLA): Visualize o velocímetro apontando o % de saúde dos suprimentos VMI em comparação à métrica do contrato.',
      'Matriz de Cobertura de Estoque: O gráfico de barras demonstra exatamente quantos DIAS DE SOBREVIVÊNCIA o cliente interno tem com o saldo projetado.',
      'Gestão de Crise (Ruptura Eminente): O sistema acenderá luzes laranjas e vermelhas nos itens abaixo do Ponto de Ruptura (estoque incapaz de cobrir o lead time da próxima remessa).',
    ],
    tips: [
      'As caixas e KPIs do dashboard são filtrados em tempo real na dropdown do cliente. Ao reportar o status para a CNH, mude o Switch exclusivo deles.',
      'Não confunda "Ponto de Reposição" (Aviso) com "Estoque Mínimo" (Sobrevivência).',
    ],
    links: [
      { path: '/vmi/forecast', label: 'Injetar Forecast Tático' },
      { path: '/vmi/historico', label: 'Evolução do Saldo' },
    ],
  },

  // ── VMI Estratégia ───────────────────────────────────────────────────────────
  '/vmi/estrategia': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Parametrização do Motor VMI',
    icon: 'Target',
    description: 'O cérebro matemático por trás dos cálculos automatizados. Aqui o Comercial define o grau agressivo de reposição para que o motor crie Pedidos sozinhos.',
    steps: [
      'Aba Lote Mínimo e Múltiplo: Informe se o produto só pode ser empurrado pro cliente de 10 em 10 peças (caixas fechadas). O motor irá arredondar requisições quebradas pro número exato.',
      'Coberturas Desejadas de Estoque (Safety Stock): Defina quantos dias de segurança você deseja manter no teto do Cliente (Max) e o Piso de disparo (Min).',
      'Lead Time (Lead Time SLA): Cadastre aqui os dias que a MetalFisa leva pra injetar peça no cliente (do frete à produção).',
      'Persistência em Massa: Use o botão de Salvamento Lógico após checar toda a grid. Modificações aqui afetam todas as equações do próximo dia.',
    ],
    tips: [
      'As mudanças não são retroativas. Elas recalcularão a Demanda da Carga VMI do dia subsequente ou num Forçar Atualização.',
    ],
    links: [
      { path: '/vmi/dashboard', label: 'Painel Tático' },
      { path: '/producao/relatorios', label: 'Relatórios Base' },
    ],
  },

  // ── VMI Histórico ────────────────────────────────────────────────────────────
  '/vmi/historico': {
    category: 'VMI (Demanda)',
    categoryColor: '#3b82f6',
    title: 'Extrato Contábil VMI',
    icon: 'History',
    description: 'Controle de prestação de contas. Esta tela imita o "Saída e Entrada" bancário para confrontar se as requisições geradas bateram com o que o cliente efetivamente consumiu da nossa carga mensal.',
    steps: [
      'Leitura de Snapshot: As tabelas listarão por Código-Revisão cada pulso disparado pro cliente e a resposta de consumo da ponta oposta.',
      'Investigação de Desperdício: Verificando "Consumo Médio" x "Enviado", caso haja discrepância forte a linha apita para auditoria.',
      'Relatórios Retrospectivos: Filtre por ano e mês para provar para reuniões operacionais de que houve Abastecimento Full no período.',
    ],
    tips: [
      'Este relatório cruza dados da tabela de Leituras (planilhas de estoque deles) fechando no "Liquidado".',
    ],
    links: [
      { path: '/vmi/leitura', label: 'Auditoria da Planilha' },
      { path: '/vendas/itens-faturar', label: 'Cruzar com ERP Interno' },
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

  // ── Romaneios e Recebimento ────────────────────────────────────────────────────────────────
  '/romaneios': {
    category: 'Logística',
    categoryColor: '#8b5cf6',
    title: 'Gestão de Romaneios',
    icon: 'Package',
    description: 'Gestão principal dos Romaneios de Remessa e Retorno de Terceiros.',
    steps: [
      'Esta é a tela principal de listagem de romaneios.',
      'Acesse os detalhes de um romaneio específico ou inicie o processo de recebimento clicando no botão de retorno.'
    ],
    tips: [
      'Filtre os romaneios por status para localizar envios pendentes de devolução.'
    ],
    links: [
      { path: '/recebimentos', label: 'Tela de Recebimentos' },
      { path: '/producao', label: 'Ordens de Produção' }
    ]
  },

  '/recebimentos': {
    category: 'Logística e PCP',
    categoryColor: '#8b5cf6',
    title: 'Página de Recebimentos de Romaneio',
    icon: 'DownloadCloud',
    description: 'Controle detalhado e apontamento de recebimento dos itens físicos que retornaram dos serviços externos ou fornecedores.',
    tabs: [
      {
        id: 'recebimento-basico',
        label: 'Regras de Recebimento',
        description: 'Como funciona a entrada parcial ou total de peças.',
        steps: [
          'Na lista de itens do romaneio, localize o produto que acabou de chegar fisicamente.',
          'Clique no botão verde "Receber". O sistema pré-carrega automaticamente o "Saldo Pendente" daquele envio original.',
          'Você pode digitar uma quantidade menor (Recebimento Parcial) caso não tenha retornado tudo.',
          'Regra de Quantidade: O sistema bloqueia recebimentos onde a quantidade informada seja superior ao saldo pendente do envio. Não é possível receber mais peças do que o enviado.'
        ],
        tips: [
          'Se for um recebimento parcial, o item continuará com o status de Pendente até que todo o saldo seja zerado em recebimentos futuros.',
          'O preenchimento de "Data" vem com a data atual por padrão, mas pode ser retroativo.'
        ]
      },
      {
        id: 'baixa-automatica',
        label: 'Baixa Automática na Produção',
        description: 'Integração em tempo real com as Ordens de Produção do ERP.',
        steps: [
          'Ao abrir o modal de recebimento, você verá um campo opcional chamado "Baixa Automática na Produção".',
          'Esse campo pesquisa no ERP o roteiro (operações) atrelado a esse produto e a essa Ordem de Produção.',
          'Selecione a operação (ex: PINTURA, SOLDA) onde o item estava. Ao salvar, o sistema fará o recebimento físico do romaneio E também gravará a quantidade como "produzida" diretamente na OP.',
          'Regra de Saldo da OP: O sistema faz um cálculo de segurança. Se você tentar baixar uma quantidade que seja MAIOR do que o saldo que falta fabricar na OP para aquela operação específica, a ação será bloqueada com Erro 400.'
        ],
        tips: [
          'Se o campo de "Baixa Automática" não mostrar nenhuma operação para selecionar, significa que o item não tem um roteiro padrão cadastrado no ERP, ou a OP já foi finalizada/deletada.',
          'Essa função é opcional. Se deixar em branco, o sistema fará apenas o retorno físico do romaneio e não apontará na OP.',
          'Todos os apontamentos gerados desta forma ficam registrados com a observação "Baixa automática via Retorno de Romaneio".'
        ]
      }
    ],
    links: [
      { path: '/romaneios', label: 'Voltar aos Romaneios' },
      { path: '/pcp/apontamento-vertical', label: 'Apontamento Vertical' }
    ]
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
  
  // ── Módulo PCP Independente ──────────────────────────────────────────────────
  '/ind-pcp-release': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Gestão de OP Fracionada',
    icon: 'PackagePlus',
    description: 'Interface exclusiva para a fragmentação e liberação isolada de Ordens de Produção (SC2) antes do carregamento industrial. Este módulo desvincula a restrição do SC2 oficial gravando o loteamento da fábrica diretamente na base segura local.',
    steps: [
      'Alternância de Visão Visual: O painel oferece dois formatos – "Hierárquico (Árvore)", útil para entender amarrações de conjunto, e "Lista Plana", feito para leitura crua de matriz produtiva.',
      'Critério de Filtragem (Faturamento): Em ambas as visualizações, a tabela apenas lista e acusa OPs filhas em que o seu Pedido de Venda contiver Saldo Remanescente (Quantidade Faturada menor que Original).',
      'Informação Estratégica: Visualize a coluna "Previsão de Entrega" espelhada diretamente da carga SC6/SC5. Isso ajuda o chão de fábrica a processar os pacotes respeitando a viabilidade comercial.',
      'Liberação em Cotes: Utilize a aba de expansão e clique em "Liberar Qtd Personalizada" para descer uma O.P. de 1000 pçs para um Kanban fabril com apenas 200 pçs, por exemplo. O sistema deduzirá o saldo do ERP temporariamente.',
    ],
    tips: [
      'Não se preocupe em "estragar" o ERP. Esta tela escreve no histórico da tabela autônoma garantindo que a contagem do SC2 siga íntegra enquanto o chão de fábrica manipula uma O.P fantasma fracionada perfeitamente amarrada.',
      'Utilize os Filtros Multiseleção (bolhas acima da tabela) para focar sub-recursos.'
    ],
    links: [
      { path: '/ind-factory-floor', label: 'Kanban do Chão de Fábrica' },
      { path: '/producao', label: 'O.Ps Tradicionais' },
    ],
  },

  '/ind-factory-floor': {
    category: 'PCP / Fábrica',
    categoryColor: '#10b981', // green-500
    title: 'Apontamento Kanban (Chão de Fábrica)',
    icon: 'HammerFocus',
    description: 'Tela viva e dinâmica de apontamentos. Uma vez que as OPs fracionadas são geradas pela "Gestão de OP Fracionada", elas caem diretamente neste funil para consumo livre dos operadores em campo.',
    steps: [
      'As OPs abertas ficarão listadas em esteiras/cartões de acordo com o recurso/operação corrente.',
      'A tela exibirá as quantidades já apontadas via terminal e o progresso em relação à meta fracionada.',
      'Os operadores não enxergam gargalos do TOTVS; a interface isola as restrições logando num banco dinâmico (com baixa final sincronizada de forma limpa).',
    ],
    tips: [
      'A leitura de Cartões na aba Kanban serve para varrer Código de Barras dos lotes físicos impressos pelo almoxarifado.',
    ],
    links: [
      { path: '/ind-pcp-release', label: 'Gestão de OP Fracionada' },
    ],
  },

  // ── Explosão BOM + Roteiro (Pull) ────────────────────────────────────────────
  '/pcp/planejamento-estrutura-routing': {
    category: 'PCP / Engenharia',
    categoryColor: '#3b82f6',
    title: 'Explosão BOM + Roteiro (Pull System)',
    icon: 'GitMerge',
    description: 'Ferramenta de planejamento estrutural que combina dois dados vitais do Protheus em uma única tela: a Lista de Materiais (BOM – SB1/SG1) e o Roteiro de Fabricação (SG2/SH1). A partir de qualquer Ordem de Produção, o sistema explode toda a árvore de componentes e mapeia quais operações cada peça exige em quais máquinas — respondendo de forma imediata à pergunta: "O que precisa ser fabricado primeiro e em qual recurso?"',
    steps: [
      '── ETAPA 1: BUSCA DA OP ──',
      'Nº da OP: Digite o número exato ou parcial da Ordem de Produção (campo C2_NUM do Protheus). A busca inicia automaticamente após 600ms sem digitar (debounce) — não é necessário pressionar Enter.',
      'Nº do Pedido: Filtra pelo Pedido de Venda (C2_PEDIDO) vinculado à OP. Útil quando se sabe o número do pedido do cliente mas não o número da OP.',
      'Cliente: Nome parcial ou completo do cliente para filtrar apenas as OPs de um cliente específico.',
      'Produto / Código: Código ou parte da descrição do produto (C2_PRODUTO / SB1). Permite encontrar OPs de um item específico mesmo sem saber o número da OP.',
      'Prazo De / Prazo Até: Intervalo de datas de entrega do pedido. Use para filtrar apenas OPs com vencimento em um determinado período — ex: "quero ver tudo que vence essa semana".',
      'Cor do Prazo nos resultados: A data de entrega no resultado é colorida automaticamente — VERDE = prazo > 7 dias; AMARELO = 4 a 7 dias; LARANJA = 1 a 3 dias; VERMELHO em negrito = prazo vencido.',
      'Clique em um resultado para carregar a estrutura completa da OP.',
      '── ETAPA 2: CABEÇALHO DA OP (após seleção) ──',
      'Número da OP: Identificador único da ordem no Protheus (ex: 000123). Exibido em destaque no topo.',
      'PV (Pedido de Venda): Número do pedido comercial ao qual esta OP está vinculada. Clique em "Voltar" para pesquisar outra OP.',
      'Cliente: Razão social do cliente final extraída da tabela SA1 via SC5.',
      'Prazo: Data de entrega comprometida com o cliente (SC6 / C6_ENTREG). Colorida pelo mesmo critério de urgência descrito acima.',
      'Conjuntos: Quantos conjuntos/produtos pai a OP possui. OPs complexas com múltiplos itens terão N conjuntos listados na árvore.',
      '── ABA: POR MÁQUINA (Visão Padrão) ──',
      'Esta aba é a mais usada no chão de fábrica. Ela agrupa TODAS as operações de TODOS os componentes da OP por RECURSO (máquina/centro de custo), criando uma "fila de trabalho" por equipamento.',
      'Cabeçalho do card (fundo escuro): Nome do recurso/máquina em destaque. O contador à direita mostra quantas tarefas (linhas de operação) aquele equipamento tem nesta OP.',
      'Coluna "Seq": Sequência da operação no roteiro (SG2.G2_SEQUEN). Define a ordem em que as operações devem ser executadas dentro daquela peça. Importante: duas peças diferentes podem ter seq=10 na mesma máquina — elas são independentes.',
      'Coluna "Peça": Código e descrição do produto que precisa passar por esta máquina. O badge "Conj." (azul) indica que é o produto pai (conjunto final); sem badge indica que é um componente filho (peça pré-fabricada).',
      'Coluna "Operação": Descrição da operação a ser executada nesta máquina para esta peça (SG2.G2_DESCRI / operação do roteiro). Ex: "SOLDA MIG", "PUNCIONAMENTO", "PINTURA".',
      'Coluna "Qtd Total" (verde): Quantidade total de peças que precisam passar por esta operação. Para componentes filhos, o cálculo é automático: Qtd_por_pai × Qtd_da_OP. Ex: se o conjunto precisa de 3 suportes e a OP tem 10 conjuntos, a máquina precisa processar 30 suportes.',
      'Coluna "Destino": Indica para onde vai a peça após esta operação. "FIM" (cinza) = produto final que vai direto para expedição. Código em laranja = esta peça vai ser incorporada ao conjunto identificado por aquele código.',
      '── ABA: ÁRVORE (Visão Hierárquica) ──',
      'Esta aba exibe a estrutura BOM da OP em formato de árvore hierárquica indentada, espelhando a lista de materiais do Protheus (SG1/SB1).',
      'Card "Conjunto Pai" (borda azul, ícone caixa): Representa o produto final que será entregue ao cliente. Mostra o código, descrição e a quantidade total a produzir nesta OP.',
      'Card "Componente Filho" (borda cinza, ícone camadas): Representa uma peça pré-fabricada que compõe o conjunto pai. Mostra a quantidade por unidade do pai (un/pai) — multiplicar pela qtd da OP dá a quantidade total a fabricar.',
      'Roteiro do card (dentro de cada card): Lista de chips mostrando, em sequência (01, 02, 03…), quais operações e em qual recurso o produto deve passar. Cada chip tem o número de sequência, o código/nome do recurso e a descrição da operação.',
      'Badge laranja "Sem roteiro cadastrado": Aparece quando o produto não tem roteiro (SG2) cadastrado no Protheus. Isso pode indicar que a peça é comprada (não fabricada) ou que o cadastro está incompleto.',
      'Aviso "Pré-requisitos — fabricar antes de montar o PAI": Seção que lista todos os filhos que precisam estar concluídos ANTES que o roteiro do produto pai (ex: solda final, montagem) possa ser iniciado. Esta é a lógica pull do sistema.',
      'Lógica de dependência: A árvore evidencia a sequência de fabricação crítica. Exemplo: o conjunto "ESTRUTURA SOLDADA" (pai) só pode entrar na operação "SOLDA" depois que todos os seus filhos (chapas, cantoneiras, tubos) passaram por suas respectivas operações de corte, dobra e furação.',
    ],
    tips: [
      'Use a aba "Por Máquina" para responder "o que a PUNCIONADEIRA precisa fazer hoje?". Use a aba "Árvore" para entender "quais peças dependem de quais?".',
      'Se uma máquina não aparece na aba "Por Máquina", nenhum produto desta OP tem aquela operação no roteiro SG2 — verifique se o roteiro está completo no Protheus.',
      'A "Qtd Total" em verde na visão por máquina já considera a multiplicação de todos os níveis da BOM — não é necessário calcular manualmente.',
      'O botão de Recarregar (ícone circular) no canto superior direito busca os dados mais atualizados do Protheus sem precisar voltar à busca e selecionar a OP novamente.',
      'OPs com prazo VENCIDO (vermelho) devem ser priorizadas. Use o filtro "Prazo Até: [data de hoje]" para listar somente as atrasadas.',
      'Componentes marcados como "Sem roteiro" que são claramente matérias-primas compradas (ex: parafusos, chapas) são normais. Componentes usinados ou soldados sem roteiro indicam necessidade de cadastro no Protheus.',
    ],
    links: [
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/estrutura/:codigo', label: 'Estrutura do Produto (BOM)' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
      { path: '/planejamento-sequencial', label: 'Planejamento Sequencial de OPs' },
    ],
  },

  // ── Visão Gerencial por Setor ─────────────────────────────────────────────────
  '/pcp/visao-setores': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Visão Gerencial por Setor',
    icon: 'PieChart',
    description: 'Painel matricial de acompanhamento da evolução da produção organizado por setor fabril. Cada setor agrupa um conjunto de recursos (máquinas/centros de custo) cadastrados, e para cada setor é exibida a lista de Ordens de Produção ativas com seu progresso real — calculado cruzando o roteiro do Protheus (SC2/SG2) com os apontamentos registrados pelos operadores no sistema (app_production_appointments). Este painel responde de imediato: "Onde estamos com cada OP, setor a setor?"',
    steps: [
      '── FILTROS DE BUSCA ──',
      'Nº do Pedido: Filtra as OPs pelo número do Pedido de Venda (C2_PEDIDO) ou pelo número da OP (C2_NUM) no Protheus. Use para monitorar um pedido específico de cliente em todos os setores simultaneamente.',
      'Cliente: Nome parcial ou completo do cliente. Mostra apenas as OPs vinculadas ao cliente informado.',
      'Produto: Código ou descrição do produto fabricado (C2_PRODUTO). Permite focar em um item específico em toda a fábrica.',
      'Data Início / Data Fim: Filtra OPs pela data planejada de início (C2_DATPRI). Use para ver a carga de um período específico.',
      'Apenas Pendentes (chave): Quando ativado, oculta OPs onde a quantidade já produzida (C2_QUJE) atingiu a quantidade total (C2_QUANT). Mantém o foco somente no que ainda está em aberto.',
      'Clique em "Buscar" ou pressione Enter para aplicar os filtros.',
      '── CARDS DE SETOR ──',
      'Cada card representa um Setor Fabril cadastrado (ex: Preparação, Solda, Pintura). O cabeçalho do card exibe o nome do setor na cor configurada e os KPIs consolidados.',
      'KPI "Total": Quantidade total de OPs (itens únicos op + item) que possuem pelo menos uma operação naquele setor.',
      'KPI "Concluídas": OPs cujo progresso atingiu 100% em todas as operações do setor.',
      'KPI "Em Andamento": OPs com progresso entre 1% e 99% — produção iniciada mas não finalizada.',
      'KPI "Atrasadas": OPs em andamento cuja data de entrega do pedido (SC6/C6_ENTREG) já passou.',
      'Barra de progresso do setor: Média ponderada do progresso de todas as OPs do setor, calculada como (soma das peças apontadas) ÷ (soma das peças esperadas) × 100.',
      '── TABELA DE OPs POR SETOR ──',
      'Coluna "OP / Item": Número da Ordem de Produção + número do item (ex: 004155/01). Identifica unicamente cada conjunto a ser fabricado.',
      'Coluna "Pedido": Número do Pedido de Venda (C2_PEDIDO) ao qual a OP está vinculada.',
      'Coluna "Produto": Código e descrição do produto a fabricar (C2_PRODUTO / SB1.B1_DESC).',
      'Coluna "Cliente": Razão social do cliente final (SA1/SC5).',
      'Coluna "Prazo": Data de entrega comprometida com o cliente (SC6.C6_ENTREG). Colorida por urgência: VERDE = mais de 7 dias; AMARELO = 4 a 7 dias; LARANJA = 1 a 3 dias; VERMELHO = prazo vencido.',
      'Coluna "Qtd Total": Quantidade de peças a produzir nessa OP/item (C2_QUANT).',
      'Coluna "Esperado no Setor": Total de peças que devem passar pelas operações deste setor. Calculado como: Qtd_Total × Número_de_Operações_no_Setor.',
      'Coluna "Apontado no Setor": Soma real das quantidades já apontadas pelos operadores para as operações deste setor, extraída da tabela app_production_appointments.',
      'Coluna "Progresso": Percentual de conclusão da OP neste setor específico = (Apontado ÷ Esperado) × 100. A barra colorida facilita a leitura visual.',
      'Coluna "Status": Indicador visual do estado da OP — "Aguardando" (sem nenhum apontamento), "Em Andamento" (entre 1% e 99%), "Concluída" (100%) ou "Atrasada" (em andamento + prazo vencido).',
      '── CARD "SETOR NÃO DEFINIDO" ──',
      'Exibido ao final da lista quando existem recursos no Protheus (SG2) que ainda não foram vinculados a nenhum setor no cadastro de Setores. OPs que passam exclusivamente por esses recursos aparecem aqui.',
      'Identifique os recursos listados em "Recursos sem setor" e acesse "PCP → Setores → Recursos" para vinculá-los ao setor correto.',
      '── CÁLCULO DO PROGRESSO ──',
      'O progresso é calculado 100% a partir dos dados reais de apontamento do sistema — não usa dados do Protheus (SH6). Cada operação de cada OP tem sua quantidade apontada somada; o resultado é dividido pelo total esperado (Qtd_OP × nº de operações do setor).',
      'Exemplo: OP 004155/01, Qtd=3, passando por 2 operações no setor Solda → Esperado=6 peças. Se foram apontadas 3 → Progresso=50%.',
    ],
    tips: [
      'Use o filtro "Apenas Pendentes" para focar a atenção somente no que ainda precisa ser feito — OPs 100% concluídas são ocultadas automaticamente.',
      'OPs com status "Atrasado" (vermelho) devem ser priorizadas. Acione o PCP para replanejamento imediato.',
      'Se uma OP não aparece em nenhum setor, verifique se o produto possui roteiro (SG2) cadastrado no Protheus — sem roteiro, não há operações para vincular a recursos/setores.',
      'O card "Setor Não Definido" é um sinal de ação: vincule os recursos listados ao setor correto em "PCP → Setores → Recursos" para que as OPs apareçam no painel correto.',
      'O progresso exibido aqui é calculado com dados reais do sistema (app_production_appointments) — não é uma estimativa. Ele reflete exatamente o que os operadores apontaram.',
      'Cada setor pode ter N recursos (máquinas). Uma OP aparece em um setor se ao menos um dos seus recursos estiver vinculado àquele setor. A barra mostra o progresso médio em todas as operações desse setor.',
      'Use este painel para identificar gargalos: um setor com progresso médio muito baixo enquanto os demais avançam indica acúmulo de trabalho — redistribua carga ou acione gestão.',
    ],
    links: [
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/setores/recursos', label: 'Vinculação de Recursos aos Setores' },
      { path: '/producao', label: 'Ordens de Produção' },
      { path: '/producao/relatorios', label: 'Relatórios de Produção' },
      { path: '/controle-producao', label: 'Planejamento Macro (Gantt)' },
    ],
  },

  // ── Cadastro de Setores ───────────────────────────────────────────────────────
  '/pcp/setores': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Cadastro de Setores Produtivos',
    icon: 'Landmark',
    description: 'Gerencie os Setores Fabris da fábrica MetalFisa. Um Setor agrupa máquinas e centros de custo (Recursos) do Protheus sob um rótulo visual e operacional — por exemplo: "Solda", "Corte a Laser", "Pintura", "Montagem Final". Esta classificação alimenta diretamente o painel "Visão Gerencial por Setor" e o relatório de progresso por setor. Sem Setores configurados, a Visão Gerencial não consegue agrupar as OPs corretamente.',
    steps: [
      '── COMO CRIAR UM NOVO SETOR ──',
      'Botão "Novo Setor" (azul, canto superior direito): Clique para abrir o modal de criação. Preencha os campos e confirme.',
      'Campo "Nome do Setor" (obrigatório): Digite o nome que identifica o setor na fábrica. Exemplos: "Solda MIG", "Corte a Laser", "Montagem". Este nome aparecerá nos cards do painel Visão por Setor e nas listagens de recursos. Máximo recomendado: 30 caracteres para não truncar nas telas menores.',
      'Campo "Descrição" (opcional): Texto livre descrevendo a função do setor, quais produtos passam por ele, turno de operação, etc. Aparece em itálico abaixo do nome do setor na listagem. Use para dar contexto ao PCP e gestores sobre o escopo do setor.',
      'Campo "Cor do Setor": Escolha entre as 10 cores pré-definidas (bolinhas coloridas) ou clique no seletor de cor personalizado (quadrinho com gradiente) para escolher qualquer cor em hexadecimal. A cor é usada como indicador visual em toda a plataforma — cards da Visão por Setor, barra lateral da listagem e indicadores na tela de Recursos. Use cores distintas para setores próximos na linha de produção para facilitar a leitura visual.',
      'Preview em tempo real: Abaixo dos seletores de cor, uma linha mostra exatamente como o setor aparecerá na interface — bolinha colorida + nome. Isso permite validar a legibilidade antes de salvar.',
      'Botão "Criar Setor" (azul): Confirma a criação. O sistema salva no banco e recarrega a lista automaticamente. Caso o nome já exista, um erro será exibido.',
      'Botão "Cancelar": Fecha o modal sem salvar nenhuma alteração.',
      '── LISTA DE SETORES ──',
      'Barra colorida vertical (lado esquerdo do card): Exibe a cor configurada para o setor. Permite identificar visualmente o setor de relance, mesmo em telas menores.',
      'Nome do Setor (negrito): Nome principal do setor. Setores inativos exibem a badge "INATIVO" em cinza ao lado do nome.',
      'Badge "N recursos" (azul): Indica quantas máquinas/centros de custo (Recursos do Protheus) estão atualmente vinculados a este setor. Um setor com "0 recursos" não aparecerá corretamente no painel Visão por Setor — vincule recursos imediatamente após criar o setor.',
      'Texto de descrição (cinza, abaixo do nome): Aparece quando a descrição foi preenchida. Truncado se muito longo — o texto completo pode ser visto ao editar o setor.',
      '── AÇÕES DE CADA SETOR ──',
      'Botão "Recursos →" (ícone corrente + seta): Navega diretamente para a tela "Recursos por Setor" com este setor já selecionado. Use para vincular ou remover máquinas/centros de custo sem precisar selecionar o setor manualmente na outra tela.',
      'Botão Editar (ícone lápis): Abre o modal de edição com os dados do setor preenchidos. Todos os campos (Nome, Descrição e Cor) podem ser alterados. Clique em "Atualizar" para confirmar ou "Cancelar" para descartar.',
      'Botão Ativar/Desativar (ícone power): Alterna o status do setor entre Ativo e Inativo. Setores inativos ficam esmaecidos na listagem e são ocultados de certas visões do painel. Útil quando um setor está em manutenção temporária ou foi incorporado a outro — desative em vez de excluir para preservar o histórico.',
      'Botão Excluir (ícone lixeira): Remove permanentemente o setor do banco. ATENÇÃO: A exclusão só é permitida se o setor não tiver nenhum recurso vinculado (badge "0 recursos"). Se o botão estiver esmaecido, é porque ainda há recursos associados — acesse "Recursos" e remova todos antes de excluir. Esta regra protege a integridade do histórico de apontamentos.',
      '── BANNER INFORMATIVO (azul) ──',
      'O sistema exibe um lembrete no topo: após criar os setores, acesse "Recursos por Setor" para associar as máquinas e centros de custo do Protheus (ex: MO0013, MO0003) a cada setor. Sem este vínculo, as OPs não aparecerão agrupadas corretamente no painel Visão por Setor.',
      '── FLUXO RECOMENDADO DE CONFIGURAÇÃO ──',
      'Passo 1 — Crie os setores aqui (nesta página) com nome, descrição e cor.',
      'Passo 2 — Acesse "PCP → Setores → Recursos" e vincule as máquinas/centros de custo do Protheus a cada setor criado.',
      'Passo 3 — Acesse "PCP → Visão por Setores" para validar que as OPs aparecem agrupadas corretamente por setor.',
    ],
    tips: [
      'Use nomes curtos e objetivos para os setores — eles aparecem em cards e filtros em várias telas do sistema.',
      'Escolha cores com bom contraste entre si. Evite usar duas cores muito parecidas (ex: dois tons de azul) para setores diferentes — o objetivo é distingui-los à distância no monitor de fábrica.',
      'Um setor com "0 recursos" não gera nenhum dado na Visão por Setor. Sempre configure os recursos logo após criar o setor.',
      'Setor inativo ≠ setor excluído. Prefira sempre desativar em vez de excluir — isso preserva o histórico de produção associado ao setor.',
      'A lixeira fica bloqueada (esmaecida) enquanto houver recursos vinculados. Isso é uma trava de segurança — remova os recursos antes de excluir o setor.',
    ],
    links: [
      { path: '/pcp/setores/recursos', label: 'Vincular Recursos aos Setores' },
      { path: '/pcp/visao-setores', label: 'Visão Gerencial por Setor' },
    ],
  },

  // ── Recursos por Setor ───────────────────────────────────────────────────────
  '/pcp/setores/recursos': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Recursos por Setor (Vinculação)',
    icon: 'Link',
    description: 'Esta tela é o elo entre o Protheus e o sistema de Setores da MetalFisa. Aqui você define quais máquinas, centros de custo e recursos de fabricação (cadastrados no Protheus na tabela SH1) pertencem a cada setor produtivo. Esta vinculação é fundamental: o painel "Visão Gerencial por Setor" calcula o progresso das OPs usando exatamente essa associação — se um recurso não estiver vinculado a nenhum setor, as OPs que passam por ele aparecerão no card "Setor Não Definido".',
    steps: [
      '── PAINEL ESQUERDO — LISTA DE SETORES ──',
      'Lista de Setores (coluna esquerda): Exibe todos os setores produtivos cadastrados na tela "Cadastro de Setores". Cada item mostra a bolinha colorida do setor (cor configurada), o nome do setor em negrito e a contagem de recursos já vinculados ("N recursos").',
      'Selecionar um Setor: Clique em qualquer setor da lista para selecioná-lo. O item selecionado fica destacado em azul com um indicador "›" à direita. O painel direito carrega automaticamente os recursos já vinculados a esse setor.',
      'Contagem "N recursos": Atualizada em tempo real a cada adição ou remoção. Permite visualizar rapidamente quais setores ainda estão sem recursos configurados (mostram "0 recursos").',
      'Caso a lista de setores esteja vazia: Nenhum setor foi cadastrado ainda. Clique em "Criar setor →" (link azul) ou acesse "PCP → Setores" para criar os setores antes de vincular recursos.',
      '── PAINEL DIREITO — CABEÇALHO DO SETOR ──',
      'Após selecionar um setor, o painel direito exibe no topo um card com a bolinha colorida do setor, o nome em negrito e a descrição (se preenchida). Confirme que o setor correto está selecionado antes de adicionar ou remover recursos.',
      '── PAINEL DIREITO — ADICIONAR RECURSO (Duas abas) ──',
      'Aba "Buscar no Protheus" (aba padrão, ícone lupa): Modo recomendado. Conecta-se ao Protheus em tempo real e busca recursos cadastrados na tabela SH1. Qualquer máquina ou centro de custo registrado no ERP aparecerá aqui.',
      'Campo de busca (aba Buscar no Protheus): Digite o código do recurso (ex: MO0013) ou parte do nome (ex: Solda, Laser, Punci...). A busca é feita automaticamente após 400ms de pausa na digitação (debounce) — não é preciso pressionar Enter. Busca por código exato ou correspondência parcial no nome.',
      'Resultados da busca: Uma lista aparece abaixo do campo com os recursos encontrados. Cada item mostra o código do recurso em fonte monospace (ex: MO0013), o tipo (badge cinza, ex: MO = Mão de Obra, MA = Máquina) e o nome/descrição do recurso no Protheus.',
      'Badge "Já vinculado a este setor" (verde, ícone ✓): Indica que o recurso já foi adicionado ao setor selecionado. O botão "Adicionar" não aparece nesses casos — evita duplicatas.',
      'Botão "+ Adicionar" (azul): Clique para vincular o recurso ao setor. O sistema confirma com um toast de sucesso, o recurso some da lista de resultados e aparece imediatamente na lista "Recursos Vinculados" abaixo. A contagem do setor é atualizada instantaneamente.',
      'Mensagem "Nenhum recurso encontrado no Protheus": Aparece quando a busca não retorna resultados. Pode ocorrer quando o recurso existe no Protheus mas com nomenclatura diferente, ou quando o recurso ainda não foi cadastrado no SH1. Neste caso, use a aba "Digitar código".',
      'Botão "X" (limpar): Ao lado do campo de busca, limpa o texto digitado e os resultados. O ícone de spinner azul aparece enquanto a busca está em andamento.',
      'Aba "Digitar código" (ícone lápis): Modo manual para quando o recurso não é encontrado na busca do Protheus, ou quando você conhece exatamente o código e quer adicioná-lo diretamente.',
      'Campo "Código do Recurso" (obrigatório, aba manual): Digite o código exato como cadastrado no Protheus, por exemplo: MO0013, MO0003, MA0005. O campo converte automaticamente para MAIÚSCULAS. Este código é o que o sistema usa para cruzar com as operações do roteiro (SG2) — deve estar correto para que as OPs apareçam corretamente no painel.',
      'Campo "Descrição" (opcional, aba manual): Nome descritivo do recurso. Exemplos: "Solda MIG", "Puncionadeira", "Torno CNC". Se não preenchido, o sistema usa o código como descrição. A descrição serve apenas para identificação visual na listagem — não afeta o cruzamento de dados com o Protheus.',
      'Botão "Adicionar Recurso" (azul): Confirma o cadastro manual. Desabilitado enquanto o campo Código estiver vazio. O spinner aparece durante o envio. Em caso de erro (ex: recurso já vinculado a outro setor), a mensagem de erro é exibida em vermelho.',
      '── REGRA DE EXCLUSIVIDADE ──',
      'Um mesmo recurso (código) só pode estar vinculado a UM setor por vez. Se você tentar adicionar um recurso que já pertence a outro setor, o sistema recusará com um erro explicativo. Para mover um recurso de setor, primeiro remova-o do setor atual e depois adicione no novo setor.',
      '── PAINEL DIREITO — RECURSOS VINCULADOS ──',
      'Card "Recursos Vinculados": Exibe a lista completa de recursos já associados ao setor selecionado. O cabeçalho mostra o total de recursos vinculados ("N recursos").',
      'Cada linha de recurso: Mostra um ponto azul indicador, o código do recurso em fonte monospace negrito (ex: MO0013) e a descrição ao lado (ex: Solda MIG).',
      'Botão Remover (ícone lixeira, vermelho ao passar o mouse): Aparece ao passar o mouse sobre a linha do recurso (efeito hover). Clique para desvincular o recurso do setor imediatamente. A remoção é instantânea — não há confirmação adicional. O recurso pode ser vinculado a outro setor após removido.',
      'Estado vazio ("Nenhum recurso vinculado"): Exibido quando o setor ainda não tem recursos. As instruções "Use os campos acima para adicionar recursos" orientam o próximo passo.',
      '── ESTADO INICIAL (nenhum setor selecionado) ──',
      'Quando nenhum setor está selecionado, o painel direito exibe apenas o ícone de corrente e a instrução "Selecione um setor". Clique em qualquer setor na lista esquerda para ativar o painel de gerenciamento.',
    ],
    tips: [
      'Prefira sempre a aba "Buscar no Protheus" — ela garante que o código do recurso existe no SH1 e evita erros de digitação que causariam inconsistências nos painéis de produção.',
      'Use a aba "Digitar código" apenas quando o recurso não aparece na busca. Isso pode acontecer quando o recurso foi criado recentemente no Protheus e a sincronização ainda não ocorreu, ou quando o código segue uma nomenclatura diferente.',
      'O código do recurso deve corresponder exatamente ao campo SH1_CODIGO (ou equivalente) do Protheus — incluindo zeros à esquerda (ex: MO0013, não MO13). Um código incorreto não causará erro de tela, mas o recurso não aparecerá nas análises de progressão das OPs.',
      'Verifique sempre a contagem "N recursos" na lista de setores após configurar. Setores com "0 recursos" são invisíveis no painel Visão por Setor.',
      'Para reorganizar recursos entre setores (ex: a puncionadeira foi transferida do Setor Corte para o Setor Preparação): primeiro remova o recurso do setor atual, depois selecione o novo setor e adicione. A operação é reversível a qualquer momento.',
      'O card "Setor Não Definido" na Visão por Setor indica recursos usados em roteiros de OPs que não estão vinculados a nenhum setor aqui. Consulte quais recursos estão listados lá e adicione-os ao setor correto.',
      'Esta tela pode ser acessada diretamente pelo botão "Recursos →" em cada card da tela "Cadastro de Setores" — o setor correspondente já vem pré-selecionado, economizando tempo.',
    ],
    links: [
      { path: '/pcp/setores', label: 'Cadastro de Setores' },
      { path: '/pcp/visao-setores', label: 'Visão Gerencial por Setor' },
      { path: '/producao', label: 'Ordens de Produção' },
    ],
  },

  // ── BOM (Estrutura Alternativa) ────────────────────────────────────────────────
  '/bom/:codigo': {
    category: 'Engenharia',
    categoryColor: '#14b8a6',
    title: 'Visualização BOM / Estrutura',
    icon: 'Layers',
    description: 'Interface alternativa para visualizar a lista técnica de materiais de um produto (BOM). Focada em exportação e análise da explosão de componentes.',
    steps: [
      'Navegue pela estrutura em árvore do produto.',
      'Analise as quantidades necessárias para cada componente no nível filho.',
      'Exporte os dados ou consulte o estoque disponível.'
    ],
    tips: [
      'Utilize esta visão para conferências rápidas do cadastro técnico do ERP.'
    ],
    links: [
      { path: '/estrutura/:codigo', label: 'Estrutura Completa' }
    ]
  },

  // ── Curva S (PCP) ─────────────────────────────────────────────────────────────
  '/pcp/curva-s': {
    category: 'PCP / Analytics',
    categoryColor: '#0ea5e9',
    title: 'Curva S de Produção',
    icon: 'LineChart',
    description: 'Análise gráfica do andamento da produção: compara o volume de peças Planejadas contra o Realizado (apontado) ao longo do tempo. Essencial para controle físico e financeiro da OP.',
    steps: [
      'Utilize os filtros superiores para selecionar Operação, Cliente ou Pedido.',
      'A linha azul (Planejado) demonstra a velocidade ideal de entrega da produção dentro do prazo.',
      'A linha laranja (Realizado) mostra o apontamento real. Ficar abaixo da linha azul indica atraso de produção.'
    ],
    tips: [
      'Os dados são baseados nas quantidades diárias; a Curva S ideal começa suave, acelera no meio da execução e suaviza perto do fim.',
      'Ordens sem data de previsão correta no Protheus podem gerar distorções na curva planejada.'
    ],
    links: [
      { path: '/controle-producao', label: 'Controle de Produção' },
      { path: '/producao', label: 'Ordens de Produção' }
    ]
  },

  // ── Extrato OP ────────────────────────────────────────────────────────────────
  '/pcp/extrato-op': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Extrato da Ordem de Produção',
    icon: 'FileText',
    description: 'Visão microscópica do histórico de apontamentos, paradas e movimentações em uma OP específica.',
    steps: [
      'Informe a OP e Item desejados.',
      'O extrato exibirá toda a vida útil da OP, desde a liberação, movimentação por cada máquina e saldos residuais.'
    ],
    tips: [
      'Use o extrato para auditar perdas (refugos) e encontrar inconsistências de digitação por parte dos operadores.'
    ],
    links: [
      { path: '/producao/op', label: 'Detalhes da OP' }
    ]
  },

  // ── Plano de Contas Financeiro ────────────────────────────────────────────────
  '/financeiro/plano-contas': {
    category: 'Financeiro',
    categoryColor: '#10b981',
    title: 'Plano de Contas',
    icon: 'Book',
    description: 'Estrutura hierárquica das contas contábeis e financeiras da empresa, definindo as naturezas de receita e despesa para alocação correta de resultados.',
    steps: [
      'Visualize a estrutura em árvore, navegando de contas sintéticas (pai) para analíticas (filhas).',
      'Analise a classificação de cada nível contábil e seus respectivos saldos no período.'
    ],
    tips: [
      'Contas de receita geralmente começam com prefixos específicos no padrão contábil; certifique-se de não misturar despesas operacionais com despesas fixas.'
    ],
    links: [
      { path: '/financeiro/balancete', label: 'Balancete' }
    ]
  },

  // ── Balancete Financeiro ──────────────────────────────────────────────────────
  '/financeiro/balancete': {
    category: 'Financeiro',
    categoryColor: '#10b981',
    title: 'Balancete Financeiro',
    icon: 'PieChart',
    description: 'Relatório sintético de DRE/Balancete que resume as receitas e despesas estruturadas pelo Plano de Contas no período escolhido.',
    steps: [
      'Filtre o período fiscal desejado.',
      'Acompanhe o Resultado Operacional bruto e líquido da fábrica.',
      'Expanda as contas para investigar onde o custo se concentrou.'
    ],
    tips: [
      'Resultados inconsistentes frequentemente provêm de OPs finalizadas sem apropriação de custo no módulo de PCP. Certifique-se de que a produção e o consumo de matéria-prima estão regulares.'
    ],
    links: [
      { path: '/financeiro/plano-contas', label: 'Plano de Contas' }
    ]
  },

  // ── Módulo de Manutenção ─────────────────────────────────────────────────────
  '/manutencao/ordens': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Gestão de Ordens de Manutenção (O.M.)',
    icon: 'PenTool',
    description: 'Central de comando da manutenção. Aqui você visualiza, cria e gerencia solicitações de intervenção em máquinas e equipamentos.',
    steps: [
      '1. Criar Ordem: Clique em "Nova Ordem", selecione a máquina, relate o sintoma e defina tipo/prioridade.',
      '2. Execução: Clique sobre a O.M. na tabela. O técnico deve preencher as atividades realizadas e fechar o status.',
      '3. Registro de Custos: Na aba Materiais do painel, adicione peças usadas (o custo será carregado via Protheus).',
      '4. Impressão de Relatório: No painel da O.M., clique em "Imprimir / PDF" para gerar a via oficial de assinaturas.'
    ],
    tips: [
      'Acompanhe no dashboard os KPIs de tempo de reparo (MTTR) e custo total das ordens concluídas.',
      'Ordens "CRÍTICAS" indicam máquina parada. Priorize-as no atendimento.'
    ],
    links: [
      { path: '/manutencao/maquinas', label: 'Cadastro de Máquinas' },
      { path: '/manutencao/checklists', label: 'Checklists (Poka-Yoke)' }
    ]
  },

  '/manutencao/maquinas': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Cadastro de Máquinas e Equipamentos',
    icon: 'Database',
    description: 'Gestão de todo o parque fabril. É obrigatório que a máquina esteja cadastrada para receber Ordens de Manutenção.',
    steps: [
      'Use "Nova Máquina" para inserir tornos, injetoras, prensas ou ferramentas complexas.',
      'Preencha a Tag de Identificação correta, que será usada pelos operadores no chão de fábrica.',
      'Anexe Manuais Técnicos em PDF para que fiquem acessíveis a qualquer técnico durante a manutenção.'
    ],
    tips: [
      'Você pode inativar máquinas que foram vendidas para não poluírem a lista de O.M. O histórico permanece salvo.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' }
    ]
  },

  '/manutencao/checklists': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Checklists e Modelos (Poka-Yoke)',
    icon: 'CheckSquare',
    description: 'Criação de modelos de inspeção diária, setups ou manutenção preventiva.',
    steps: [
      'Crie um "Novo Modelo" e defina o Tipo (Diário, Setup, Preventiva).',
      'Adicione perguntas com tipos de resposta (Sim/Não, Texto, Foto Obrigatória).',
      'Vincule os modelos criados às máquinas no painel de "Máquinas e Equipamentos".'
    ],
    tips: [
      'Utilize o requisito "Foto Obrigatória" para pontos críticos de desgaste.'
    ],
    links: [
      { path: '/manutencao/maquinas', label: 'Máquinas e Equipamentos' }
    ]
  },

  '/manutencao/dashboard': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Dashboard de Manutenção',
    icon: 'LayoutDashboard',
    description: 'Painel executivo com a visão global do departamento de manutenção, KPIs e gráficos.',
    steps: [
      'Visualize o MTTR (Mean Time To Repair) e MTBF (Mean Time Between Failures).',
      'Acompanhe as Ordens Críticas que precisam de atenção imediata.'
    ],
    tips: [
      'Estes dados são gerados automaticamente baseados na abertura e encerramento das O.M.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ir para Ordens de Manutenção' }
    ]
  },

  '/manutencao/materiais': {
    category: 'Manutenção',
    categoryColor: '#4f46e5',
    title: 'Gestão de Materiais da O.M.',
    icon: 'Package',
    description: 'Acompanhe e faça o planejamento (follow-up) de todos os materiais solicitados nas Ordens de Manutenção.',
    steps: [
      'Busque um material pelo nome, máquina ou ID da ordem.',
      'Clique em "Planejar" para alterar o status do material.',
      'Defina as datas de previsão de compras, chegada e montagem final.'
    ],
    tips: [
      'Ao alterar o planejamento, um registro ficará gravado no histórico da Ordem de Manutenção automaticamente.',
      'Filtre pelo status "Aguardando Entrega" para acompanhar prazos com suprimentos.'
    ],
    links: [
      { path: '/manutencao/ordens', label: 'Ordens de Manutenção' },
      { path: '/manutencao/dashboard', label: 'Dashboard Gerencial' }
    ]
  }

};
