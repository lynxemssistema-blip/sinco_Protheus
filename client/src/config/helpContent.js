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

  // ── Controle de Produção ─────────────────────────────────────────────────────
  '/controle-producao': {
    category: 'PCP',
    categoryColor: '#f59e0b',
    title: 'Monitor de Planejamento Macro (Gantt Estratégico)',
    icon: 'Gauge',
    description: 'Interface balística para alocação de carga-máquina (Planejamento Automático por Recurso). Substitui macros do Excel para injetar agendamentos finos diretamente na restrição de planta ERP.',
    steps: [
      'Visão de Drag-and-Drop: Na listagem de OPs já liberadas, você pode clicar e arrastar blocos para cima e para baixo. O sistema recalcula automaticamente o término da operação com base na restrição do centro de custo selecionado.',
      'Modal de Planejamento Automático: Identifique o ícone "Flash" num recurso. O Modal permitirá duas matemáticas: Cálculo para Frente (baseado na data inicial e DSR saltando fins de semana) ou Cálculo Trás (amarrando à Data de Entrega do pedido forçando D-1).',
      'Congelamento do Setup: Ao arrastar 1 OP para depois da OP 2, o sistema deduz se haverá Setup embutido ou se as matrizes e produtos são da mesma família de Setup-Livre.',
      'Persistência de Linha Base (Baseline): Antes de comitar a simulação, ative o "Salvar Layout/Simulação". O botão visual mostrará "Tons de cor Ghost/Esmaecido" permitindo analisar o plano Original VS seu plano de simulação arrastado.',
    ],
    tips: [
      'Lembre-se: O planejamento só desce pro "Ind_Factory" ou pro "ERP" quando você aperta o Botão de Salvar verde no final. Arrastar os itens pela tela é apenas Simular Capacidade.',
      'O sistema utiliza DSR Oficial nativo: feriados e finais de semana prolongados na tabela de calendário empurram o lote para a próxima data útil validada.',
    ],
    links: [
      { path: '/producao-matrix', label: 'Carga Máquina Total' },
      { path: '/pcp/apontamento-vertical', label: 'Lançamentos (Ponta a Ponta)' },
    ],
  },

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
    category: 'Administração Core',
    categoryColor: '#64748b', // slate-500
    title: 'Configurações de Instância ERP',
    icon: 'Settings',
    description: 'Painel Master de governança. Daqui nascem todas as macros que controlam disparos automáticos, travas de edição de Comercial/Faturamento e emails gerenciais de apontamentos diários.',
    steps: [
      'Configuração de Email Base: Na guia de Sistema, defina os emails destino que receberão o extrato de Relatórios Diários às 18:01 de faturamento (Automação Node-Cron).',
      'Painel de Usuários (Auth): Edite senhas via bcrypt, adicione novos funcionários às permissões do sistema.',
      'Auditoria de Alterações: Abaixo da tela, cheque o monitor Master Logs, listando quem modificou o quê (Ex: Quem reverteu o Lote "Faturado Parcial").',
    ],
    tips: [
      'A aba Configurações de Servidor é sensível e mapeada via WebSocket. Alterá-la derruba conexões falsas.',
    ],
    links: [
      { path: '/ajuda', label: 'Central de Ajuda Master' },
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
    title: 'Monitor de Itens a Faturar (Romaneios)',
    icon: 'DollarSign',
    description: 'Interface tática do almoxarifado e do faturamento para despachar blocos faturáveis oriundos da balança comercial e ordens do PCP. Substitui planilhas offline gerando lotes 100% integrados à fila de carregamento.',
    steps: [
      'Geração de Requisição: Marque (checkbox) os itens que você quer faturar, coloque a Quantidade Solicitada, e clique no botão azul no rodapé "Solicitar Faturamento". Isso criará um Pacote na fila de controle.',
      'Semaforização (Status): A coluna Status exibirá a realidade do ERP instantaneamente: 🟢 FATURADO 100% (cargas sem saldo), 🟠 FAT. PARCIAL (quando se emitiu faturamento menor que o total comprado pelo cliente) ou ⚪ A FATURAR.',
      'Rastreio de Qtd e Saldo: Acompanhe as quantidades Totais de PV, o que já foi efetivamente entregue no ERP e o Saldo Remanescente disponível. O sistema impede solicitar saldo negativo fisicamente.',
      'Empenho Duplo (Prevenção): Na coluna "Fat. Solicitados", observe se algum parceiro de setor já solicitou faturamento para aquela mesma linha (mesmo id). Você não mandará uma mesma linha se ela já tiver sido pendurada.',
      'Filtro de Ruído: Utilize "Apenas Pendentes" ou "Ocultar Faturados 100%" para focar exclusivamente nos romaneios pendurados ou que o caminhão ainda precisa faturar.',
      'Histórico de NFs: A bateria de notas fiscais lançadas pro item é mapeada e unificada no botão "Ver NFs".',
    ],
    tips: [
      'Pedidos fragmentados em N datas de entrega pelo cronograma fabril terão os IDs perfeitamente espelhados aqui em linhas separadas.',
      'Gatilho bloqueador: Caso haja saldo excedido (tentando enviar 200 pro faturamento de um pedido que só tinha 100 de saldo líquido da embalagem), o sistema disparará Toast de erro bloqueando a ação na raiz.',
    ],
    links: [
      { path: '/comercial/faturamento', label: 'Monitor de NFs (Controle)' },
      { path: '/romaneios', label: 'Romaneios Embalagem' },
      { path: '/comercial/dashboard-faturamento', label: 'Dashboard Gerencial' },
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

};
