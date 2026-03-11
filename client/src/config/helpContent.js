/**
 * helpContent.js
 * Central help database for MetalFisa PCP.
 * Maps route paths to rich help documentation objects.
 */

export const HELP_CONTENT = {
    // =============================================================
    // COMERCIAL
    // =============================================================
    '/': {
        id: 'pedidos-venda',
        category: 'Comercial',
        categoryColor: '#2563eb',
        title: 'Pedidos de Venda',
        icon: 'ShoppingCart',
        description: 'Monitor em tempo real dos pedidos do ERP Protheus. Sincroniza automaticamente a cada intervalo configurado.',
        steps: [
            'Use a barra de busca para filtrar por Nº do Pedido (PV), cliente ou produto.',
            'Pedidos com fundo VERDE estão abertos sem OP. AMARELO indica OP lançada. VERMELHO = faturado.',
            'Clique na seta (▶) para expandir os itens do pedido com detalhes de produção.',
            'Use o ícone de "post-it" (📝) para registrar observações na Ata Viva.',
            'Clique no ícone de Engenharia (⚙️) para visualizar o histórico de liberações de engenharia.',
            'Filtre por status, período de entrega ou responsável usando os filtros no topo da tela.',
            'Use o botão "Espelho OP" para exportar uma visão agrupada em PDF ou Excel.',
        ],
        tips: [
            'Atalho: Pressione ESC para limpar filtros rapidamente.',
            'A visão "Faturados" é ocultada por padrão para focar nos pedidos em aberto.',
            'O agrupamento de "Código do Cliente" consolida múltiplos códigos na mesma linha automaticamente.',
        ],
        links: [
            { label: 'Ordens de Produção', path: '/producao' },
            { label: 'Pedidos de Engenharia', path: '/engenharia/pedidos' },
        ],
    },

    // =============================================================
    // PRODUÇÃO / PCP
    // =============================================================
    '/producao': {
        id: 'ordens-producao',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Ordens de Produção (OP)',
        icon: 'Factory',
        description: 'Visão consolidada de todas as Ordens de Produção abertas, agrupadas por pedido de venda.',
        steps: [
            'Filtre OPs pelo número do pedido, produto ou centro de trabalho.',
            'OPs com status "Firmadas" ainda podem ser editadas. "Liberadas" estão em produção.',
            'Clique no ícone de Sequência para visualizar o roteiro de processo da OP.',
            'Use o filtro de período (data de entrega) para priorizar o planejamento semanal.',
        ],
        tips: [
            'A coluna "Atraso" calcula automaticamente os dias em relação à data de entrega do pedido.',
            'Para ver OPs agrupadas por Operação, acesse "OPs por Operação" no menu lateral.',
        ],
        links: [
            { label: 'OPs por Operação', path: '/producao/op' },
            { label: 'Controle de Produção', path: '/controle-producao' },
            { label: 'Matriz de Produção', path: '/producao-matrix' },
        ],
    },

    '/producao/op': {
        id: 'ops-por-operacao',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'OPs por Operação (Espelho)',
        icon: 'Layers',
        description: 'Visão do Espelho da OP: agrupa as operações por centro de trabalho, mostrando carga de cada posto.',
        steps: [
            'Selecione o período desejado para filtrar as OPs.',
            'As OPs são agrupadas por Operação (corte, dobra, solda, etc.).',
            'Clique em "Exportar PDF" para gerar o relatório imprimível do Espelho da OP.',
            'Clique em "Exportar Excel" para baixar a planilha com todos os dados agrupados.',
        ],
        tips: [
            'O Espelho da OP é o principal documento de chão-de-fábrica para priorização.',
            'Cada operação exibe a quantidade total planejada e o tempo estimado de processo.',
        ],
        links: [
            { label: 'Ordens de Produção', path: '/producao' },
            { label: 'Planejamento Gantt', path: '/planejamento-gantt' },
        ],
    },

    '/controle-producao': {
        id: 'controle-producao',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Controle de Produção',
        icon: 'ClipboardList',
        description: 'Painel central de acompanhamento de produção com apontamento de horas por OP e operação.',
        steps: [
            'Filtre pelo número da OP ou produto para localizar o item desejado.',
            'Clique no ícone de Apontamento (▶) para registrar início de operação.',
            'O timer global inicia e permanece visível na tela mesmo ao navegar para outra página.',
            'Ao finalizar, clique Stop (⏹) e confirme as horas apontadas.',
            'O sistema impede apontamentos em OPs já finalizadas ou com quantidade excedida.',
        ],
        tips: [
            'O widget flutuante de timer garante que você não perca o apontamento ao trocar de tela.',
            'Você pode pausar e retomar o timer. O tempo acumulado é preservado.',
        ],
        links: [
            { label: 'Ordens de Produção', path: '/producao' },
            { label: 'Matriz de Produção', path: '/producao-matrix' },
        ],
    },

    '/producao-matrix': {
        id: 'matriz-producao',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Matriz de Produção',
        icon: 'Grid',
        description: 'Visão matricial cruzando OPs x Operações para controle simultâneo de múltiplos postos de trabalho.',
        steps: [
            'Cada linha representa uma OP; cada coluna, uma operação do roteiro.',
            'Clique em uma célula para registrar ou consultar o apontamento daquela operação.',
            'Células em verde = concluído. Azul = em andamento. Cinza = não iniciado.',
            'Use o filtro de data para ver a carga do dia ou semana.',
        ],
        tips: [
            'A Matriz é ideal para supervisores que precisam visão geral de múltiplas OPs simultâneas.',
            'Cores de célula são atualizadas em tempo real via WebSocket — sem necessidade de recarregar.',
        ],
        links: [
            { label: 'Controle de Produção', path: '/controle-producao' },
            { label: 'Evolução do Apontamento', path: '/pcp/evolucao-apontamento' },
        ],
    },

    '/planejamento-gantt': {
        id: 'gantt',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Planejamento Gantt',
        icon: 'Calendar',
        description: 'Visualização gráfica de OPs em linha do tempo. Arraste e solte para replanejar.',
        steps: [
            'Selecione o período e o centro de trabalho para filtrar o gráfico.',
            'Cada barra representa uma OP. A cor indica o status (aberta, em produção, atrasada).',
            'Arraste uma barra para reprogramar a data de início da OP.',
            'Passe o mouse sobre uma barra para ver detalhes do item e prazo de entrega.',
        ],
        tips: [
            'O Gantt integra automaticamente com as OPs do Protheus — sem necessidade de entrada manual.',
            'Barras vermelhas indicam OPs com data de entrega já ultrapassada.',
        ],
        links: [
            { label: 'Ordens de Produção', path: '/producao' },
            { label: 'Controle de Produção', path: '/controle-producao' },
        ],
    },

    '/visao-producao': {
        id: 'analytics-producao',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Visão Analítica de Produção',
        icon: 'BarChart',
        description: 'Gráficos e indicadores de desempenho de produção: eficiência, atrasos, carga por CT.',
        steps: [
            'Selecione o período desejado (dia, semana, mês).',
            'Os gráficos são atualizados automaticamente com os dados do banco.',
            'Clique em uma barra do gráfico para filtrar os dados correspondentes.',
        ],
        tips: [
            'Combine os filtros de período + centro de trabalho para análises mais precisas.',
        ],
        links: [
            { label: 'Evolução do Apontamento', path: '/pcp/evolucao-apontamento' },
            { label: 'Ordens de Produção', path: '/producao' },
        ],
    },

    '/pcp/evolucao-apontamento': {
        id: 'evolucao-apontamento',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Evolução do Apontamento',
        icon: 'TrendingUp',
        description: 'Histórico e evolução dos apontamentos por usuário, OP e operação ao longo do tempo.',
        steps: [
            'Selecione o intervalo de datas para visualizar o histórico.',
            'Filtre por usuário para analisar produtividade individual.',
            'A linha do gráfico mostra a evolução diária de horas apontadas vs. planejadas.',
        ],
        tips: [
            'Ideal para reuniões diárias de PCP para analisar desvios de programação.',
        ],
        links: [
            { label: 'Controle de Produção', path: '/controle-producao' },
            { label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario' },
        ],
    },

    '/pcp/apontamento-por-usuario': {
        id: 'apontamento-usuario',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Apontamento por Usuário',
        icon: 'User',
        description: 'Painel de apontamentos filtrados por colaborador.',
        steps: [
            'Selecione o usuário/colaborador no filtro superior.',
            'A lista mostra todas as OPs apontadas no período.',
            'Cada registro mostra: OP, operação, tempo total e data.',
        ],
        links: [
            { label: 'Evolução do Apontamento', path: '/pcp/evolucao-apontamento' },
        ],
    },

    '/pcp/apontamento-vertical': {
        id: 'apontamento-vertical',
        category: 'PCP',
        categoryColor: '#d97706',
        title: 'Apontamento Vertical (Fila Mestre)',
        icon: 'List',
        description: 'Fila vertical contínua para apontamentos massivos e rastreabilidade visual.',
        steps: [
            'Filtre pelas OPs, Pedidos, Clientes ou Produtos desejados.',
            'A lista apresenta em coluna o progresso exato de cada peça.',
            'Clique em APONTAR para lançar quantidades usando o Autofocus do formulário.',
            'Visualize o último operador e a data de apontamento abaixo da meta de Planejamento.',
            'Ícones vermelhos de PDF permitem abrir os desenhos diretamente da engenharia.'
        ],
        tips: [
            'A Fila Vertical possui filtro rigoroso para prevenir tráfego excessivo de rede, use barras de busca.',
        ],
        links: [
            { label: 'Matriz de Produção', path: '/producao-matrix' },
            { label: 'Controle de Produção', path: '/controle-producao' },
        ],
    },

    // =============================================================
    // ENGENHARIA
    // =============================================================
    '/engenharia/pedidos': {
        id: 'pedidos-engenharia',
        category: 'Engenharia',
        categoryColor: '#7c3aed',
        title: 'Pedidos de Engenharia',
        icon: 'Settings',
        description: 'Controle das liberações de engenharia para os itens dos pedidos de venda.',
        steps: [
            'Aqui você controla a data de Liberação Planejada e Realizada de Engenharia para cada item.',
            'Use o ícone de Engenharia (⚙️) para abrir o modal de controle de datas.',
            'A coluna "Lib. Engenharia" exibe as duas datas: planejada (cinza) e realizada (verde).',
            'Use o filtro de status para ver apenas itens "Pendentes", "Liberados" ou "Em Atraso".',
            'O ícone de Planejamento (📆) abre o modal para definir a data planejada de engenharia.',
        ],
        tips: [
            'Itens em vermelho estão com a data de liberação planejada já ultrapassada.',
            'O histórico de alterações de datas é auditado automaticamente pelo sistema.',
            'Você pode exportar a lista de pedidos para Excel clicando no botão "Exportar".',
        ],
        links: [
            { label: 'Pedidos de Venda', path: '/' },
            { label: 'SINCO: Estrutura de Produto', path: '/engenharia/sinco/estrutura' },
        ],
    },

    // =============================================================
    // SINCO
    // =============================================================
    '/engenharia/sinco/estrutura': {
        id: 'sinco-estrutura',
        category: 'SINCO / Engenharia',
        categoryColor: '#0891b2',
        title: 'SINCO: Estrutura de Produto',
        icon: 'Package',
        description: 'Árvore hierárquica do produto com BOM, roteiros e materiais de consumo.',
        steps: [
            'Pesquise pelo código ou nome do produto para carregar sua estrutura.',
            'Itens com fundo AZUL são Conjuntos (possuem sub-níveis). Fundo BRANCO = Componente simples.',
            'Expanda o "+" ao lado de cada conjunto para ver os sub-componentes.',
            'O ícone de PDF (vermelho) indica que o desenho existe no servidor. Cinza = não encontrado.',
            'Use o ícone de balão (💬) para ver/criar revisões pendentes de engenharia.',
            'Acesse "Exportar Estrutura" para gerar um PDF da BOM completa.',
            'O botão "Ficha Técnica PDF" gera o documento técnico para a Ordem de Fabricação.',
        ],
        tips: [
            'O vínculo de materiais é feito via nome de arquivo (case-insensitive), conectando o .asm aos consumíveis da viewmontapeca.',
            'Materiais de tinta, eletrodos e chapas são puxados automaticamente da tabela de consumíveis.',
        ],
        links: [
            { label: 'Ordens de Serviço SINCO', path: '/engenharia/sinco/os' },
            { label: 'Onde é Usado?', path: '/pcp/onde-usado' },
            { label: 'BOM Generator', path: '/bom-generator' },
        ],
    },

    '/engenharia/sinco/os': {
        id: 'sinco-os',
        category: 'SINCO / Engenharia',
        categoryColor: '#0891b2',
        title: 'Ordens de Serviço (SINCO)',
        icon: 'ClipboardList',
        description: 'Gestão das OS do SINCO: abertura, apontamento e finalização.',
        steps: [
            'Filtre as OS por status (abertas, em andamento, concluídas).',
            'Clique em uma OS para ver seus itens e roteiro de fabricação.',
            'Use "Apontamento" para registrar o progresso de produção na OS.',
            'O status é atualizado automaticamente conforme os apontamentos.',
        ],
        links: [
            { label: 'Apontamento SINCO', path: '/engenharia/sinco/apontamento' },
            { label: 'Materiais da OS', path: '/engenharia/sinco/materiais' },
        ],
    },

    '/engenharia/sinco/apontamento': {
        id: 'sinco-apontamento',
        category: 'SINCO / Engenharia',
        categoryColor: '#0891b2',
        title: 'Apontamento SINCO (Lista)',
        icon: 'CheckSquare',
        description: 'Registro de produção por item das OS do SINCO em formato de lista.',
        steps: [
            'Selecione a OS para ver os itens disponíveis para apontamento.',
            'Informe a quantidade produzida e confirme o apontamento.',
            'Apontamentos parciais são permitidos; o sistema acumula o total.',
        ],
        links: [
            { label: 'Matriz de Apontamento SINCO', path: '/engenharia/sinco/apontamento-matrix' },
            { label: 'Ordens de Serviço', path: '/engenharia/sinco/os' },
        ],
    },

    '/engenharia/sinco/apontamento-matrix': {
        id: 'sinco-matrix',
        category: 'SINCO / Engenharia',
        categoryColor: '#0891b2',
        title: 'Matriz de Apontamento SINCO',
        icon: 'Grid',
        description: 'Visão matricial para apontamento simultâneo de múltiplas OS do SINCO.',
        steps: [
            'Cada linha = uma OS; cada coluna = uma operação ou item.',
            'Clique na célula para registrar o apontamento daquele item/operação.',
            'Filtre por período ou usuário para personalizar a visualização.',
        ],
        links: [
            { label: 'Apontamento por Lista', path: '/engenharia/sinco/apontamento' },
            { label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario' },
        ],
    },

    '/engenharia/sinco/materiais': {
        id: 'sinco-materiais',
        category: 'SINCO / Engenharia',
        categoryColor: '#0891b2',
        title: 'Materiais da OS (SINCO)',
        icon: 'Layers',
        description: 'Controle de entrega e consumo de materiais vinculados às OS do SINCO.',
        steps: [
            'Selecione a OS para ver os materiais necessários.',
            'Registre a quantidade entregue ao chão de fábrica.',
            'O sistema compara entregue vs. necessário e exibe a diferença.',
        ],
        links: [
            { label: 'Ordens de Serviço', path: '/engenharia/sinco/os' },
            { label: 'Gestão de Materiais PCP', path: '/pcp/gestao-materiais' },
        ],
    },

    '/sinco/desenho-ativo': {
        id: 'sinco-desenho-ativo',
        category: 'SINCO / Engenharia',
        categoryColor: '#0891b2',
        title: 'Desenho Ativo (SINCO)',
        icon: 'FileText',
        description: 'Consulta ao desenho técnico ativo vinculado a um código de produto SINCO.',
        steps: [
            'Pesquise pelo código do produto para localizar o desenho técnico ativo.',
            'Clique no botão de PDF para abrir o desenho diretamente do servidor de engenharia.',
            'O ícone vermelho confirma que o arquivo físico existe no servidor mapeado.',
        ],
        links: [
            { label: 'Estrutura SINCO', path: '/engenharia/sinco/estrutura' },
        ],
    },

    // =============================================================
    // MATERIAIS / COMPRAS
    // =============================================================
    '/saldo-materiais': {
        id: 'saldo-materiais',
        category: 'Materiais',
        categoryColor: '#059669',
        title: 'Saldo de Materiais (Estoque)',
        icon: 'Database',
        description: 'Consulta de saldos de estoque em tempo real via integração com banco Protheus.',
        steps: [
            'Pesquise pelo código ou descrição do material.',
            'O saldo exibido é reflexo direto do banco de dados do ERP Protheus.',
            'Use o filtro de armazém para diferenciar estoques por depósito.',
        ],
        tips: [
            'Para saldos negativos (reserva), o sistema exibirá o valor destacado em vermelho.',
        ],
        links: [
            { label: 'Gestão de Materiais PCP', path: '/pcp/gestao-materiais' },
            { label: 'Onde é Usado?', path: '/pcp/onde-usado' },
        ],
    },

    '/pcp/gestao-materiais': {
        id: 'gestao-materiais',
        category: 'Materiais',
        categoryColor: '#059669',
        title: 'Gestão de Materiais (PCP)',
        icon: 'Layers',
        description: 'Controle de demanda de materiais gerada pelas OPs abertas vs. estoque disponível.',
        steps: [
            'A tela cruza as necessidades de materiais das OPs com o saldo atual de estoque.',
            'Itens em vermelho estão com saldo insuficiente para atender a demanda.',
            'Use o botão "Exportar" para enviar a necessidade de compras ao setor de Suprimentos.',
        ],
        links: [
            { label: 'Saldo de Materiais', path: '/saldo-materiais' },
            { label: 'Solicitações de Compras', path: '/solicitacoes-compras' },
        ],
    },

    '/pcp/onde-usado': {
        id: 'onde-usado',
        category: 'Materiais',
        categoryColor: '#059669',
        title: 'Onde é Usado? (BOM Invertida)',
        icon: 'Search',
        description: 'Consulta reversa: informe um componente e veja em quais produtos ele é utilizado.',
        steps: [
            'Digite o código do componente (matéria-prima, sub-conjunto) na busca.',
            'O sistema lista todos os produtos pai que utilizam esse componente.',
            'Exibe a quantidade e o nível da estrutura onde o componente aparece.',
        ],
        links: [
            { label: 'Estrutura SINCO', path: '/engenharia/sinco/estrutura' },
            { label: 'BOM Generator', path: '/bom-generator' },
        ],
    },

    '/solicitacoes-compras': {
        id: 'solicitacoes-compras',
        category: 'Compras',
        categoryColor: '#b45309',
        title: 'Solicitações de Compras',
        icon: 'ShoppingBag',
        description: 'Gestão de solicitações de compra geradas pelo PCP ou por outros departamentos.',
        steps: [
            'Filtre as solicitações por status (pendente, aprovada, cancelada).',
            'Cada solicitação mostra o material, quantidade, urgência e solicitante.',
            'Aprove ou reprove solicitações diretamente nesta tela.',
        ],
        links: [
            { label: 'Pedidos de Compras (por PV)', path: '/pedidos-compras-pv' },
            { label: 'Fluxo Compras → NF', path: '/fluxo-compras-nf' },
        ],
    },

    '/pedidos-compras-pv': {
        id: 'pedidos-compras-pv',
        category: 'Compras',
        categoryColor: '#b45309',
        title: 'Pedidos de Compras (por PV)',
        icon: 'FileText',
        description: 'Rastreabilidade de pedidos de compra vinculados a Pedidos de Venda.',
        steps: [
            'Associa cada pedido de compra ao PV que gerou a necessidade.',
            'Filtre por PV ou Fornecedor para localizar o pedido de compra.',
            'O status de entrega do fornecedor é atualizado via integração.',
        ],
        links: [
            { label: 'Solicitações de Compras', path: '/solicitacoes-compras' },
            { label: 'Fluxo Compras → NF', path: '/fluxo-compras-nf' },
        ],
    },

    '/fluxo-compras-nf': {
        id: 'fluxo-compras-nf',
        category: 'Compras',
        categoryColor: '#b45309',
        title: 'Fluxo Compras → NF',
        icon: 'Truck',
        description: 'Rastreabilidade do ciclo de compra completo: da solicitação à entrada da NF.',
        steps: [
            'Visualize o status de cada pedido de compra: Emitido, Parcialmente Entregue, Concluído.',
            'Verifique a NF de entrada vinculada ao pedido quando já recebida.',
            'Identifique atrasos de fornecedores comparando data prevista vs. recebimento.',
        ],
        links: [
            { label: 'Pedidos de Compras', path: '/pedidos-compras-pv' },
            { label: 'Saldo de Materiais', path: '/saldo-materiais' },
        ],
    },

    '/suprimentos/requisicoes': {
        id: 'requisicoes-internas',
        category: 'Compras',
        categoryColor: '#b45309',
        title: 'Requisições Internas',
        icon: 'ClipboardList',
        description: 'Controle de requisições internas de materiais entre departamentos.',
        steps: [
            'Crie uma requisição indicando o material, quantidade e destino.',
            'O responsável pelo almoxarifado atende ou recusa a requisição.',
            'Histórico completo de todas as movimentações internas.',
        ],
        links: [
            { label: 'Saldo de Materiais', path: '/saldo-materiais' },
            { label: 'Gestão de Materiais PCP', path: '/pcp/gestao-materiais' },
        ],
    },

    // =============================================================
    // PRODUTOS / CATÁLOGO
    // =============================================================
    '/produtos': {
        id: 'catalogo-produtos',
        category: 'Produtos',
        categoryColor: '#6d28d9',
        title: 'Catálogo de Produtos',
        icon: 'Package',
        description: 'Repositório central de produtos com documentos, imagens e estrutura técnica.',
        steps: [
            'Pesquise por código, descrição ou família do produto.',
            'Clique no ícone de Documento (📄) para gerenciar os PDFs técnicos vinculados.',
            'Use "Importação em Massa" para vincular PDFs de uma pasta de rede inteira.',
            'O caminho pode ser um drive mapeado (Q:\\...) ou caminho UNC (\\\\servidor\\...).',
            'Clique na miniatura para expandir a imagem do produto.',
        ],
        tips: [
            'O sistema converte drives mapeados (Q:) para caminhos UNC automaticamente.',
            'O vínculo PDF→Produto é feito pelo nome do arquivo (case-insensitive).',
        ],
        links: [
            { label: 'BOM Generator', path: '/bom-generator' },
            { label: 'Estrutura SINCO', path: '/engenharia/sinco/estrutura' },
        ],
    },

    '/bom-generator': {
        id: 'bom-generator',
        category: 'Produtos',
        categoryColor: '#6d28d9',
        title: 'Gerador de BOM',
        icon: 'Layers',
        description: 'Criação e edição de Listas de Materiais (BOM) manualmente ou via importação.',
        steps: [
            'Selecione o produto pai para criar/editar sua BOM.',
            'Adicione componentes manualmente pelo código ou importe via planilha.',
            'Defina quantidade e unidade de medida para cada componente.',
            'A BOM é salva automaticamente e disponibilizada em toda a estrutura do produto.',
        ],
        links: [
            { label: 'Estrutura SINCO', path: '/engenharia/sinco/estrutura' },
            { label: 'Catálogo de Produtos', path: '/produtos' },
        ],
    },

    '/estrutura/:codigo': {
        id: 'estrutura-produto',
        category: 'Produtos',
        categoryColor: '#6d28d9',
        title: 'Estrutura do Produto',
        icon: 'Package',
        description: 'Visão da BOM de um produto específico com links para sub-níveis.',
        steps: [
            'Acesse diretamente via Catálogo de Produtos clicando no código do produto.',
            'A estrutura é exibida em formato de árvore expansível.',
            'Clique em qualquer sub-componente para navegar para sua própria estrutura.',
        ],
        links: [
            { label: 'Catálogo de Produtos', path: '/produtos' },
            { label: 'Onde é Usado?', path: '/pcp/onde-usado' },
        ],
    },

    // =============================================================
    // LOGÍSTICA
    // =============================================================
    '/romaneios': {
        id: 'romaneios',
        category: 'Logística',
        categoryColor: '#dc2626',
        title: 'Romaneios de Entrega',
        icon: 'Truck',
        description: 'Criação e impressão de romaneios de carga para expedição de produtos.',
        steps: [
            'Clique em "Novo Romaneio" para iniciar uma lista de entrega.',
            'Adicione itens ao romaneio pelo código do pedido ou produto.',
            'Defina o veículo, motorista e data prevista de entrega.',
            'Imprima o romaneio para acompanhar a carga no transporte.',
            'Gere etiquetas de volume para rastreabilidade dos volumes.',
        ],
        tips: [
            'Um romaneio pode conter itens de múltiplos pedidos de venda.',
            'O status do romaneio é sincronizado de volta com o ERP Protheus.',
        ],
        links: [
            { label: 'Pedidos de Venda', path: '/' },
        ],
    },

    // =============================================================
    // VMI (VENDOR MANAGED INVENTORY)
    // =============================================================
    '/vmi/forecast': {
        id: 'vmi-demanda',
        category: 'Comercial',
        categoryColor: '#2563eb',
        title: 'VMI Forecast',
        icon: 'Layers',
        description: 'Interface para importar demandas de clientes, gerenciar a base de itens VMI e realizar o mapeamento com o Protheus.',
        steps: [
            'A página é dividida em duas abas principais no topo: "1. Importação e Base" e "2. Mapeamento Protheus".',
            'Sincronia Manual: Por segurança e performance, os dados não carregam automaticamente ao entrar. Clique sempre no botão "Atualizar" (ícone de setas circulares) para visualizar as informações.',
            'Importação: Na primeira aba, clique em "Importar Planilha" para subir o Excel do cliente. O sistema abrirá um modo de Pré-visualização; revise os dados e clique em "Confirmar e Gravar" se estiver correto.',
            'Lotes de Importação: À esquerda, cada arquivo importado gera um "card". Selecione o card para ver apenas os dados daquele arquivo ou clique em "Ver Tudo" para a base completa.',
            'Agrupamento: Use o seletor no topo da tabela para mudar a visão entre "Lista Plana", "Por Produto Pai" (Equipamento) ou "Por Pedido de Venda".',
            'Colunas de Status: A coluna "Tipo" mostra a classificação atual do item no Protheus (PCP, Novo, Revisão, Restrição) com cores distintas.',
            'Vínculo Protheus: A coluna "Cód. Protheus" exibe o B1_COD associado ao item após o mapeamento ser concluído.',
            'Limpeza de Dados: No topo, o botão "Limpar Base" remove todos os dados. Ações de exclusão agora solicitam confirmação em uma janela centralizada antes de prosseguir.',
            'Exportação: O botão "Exportar Excel" gera um arquivo com 3 abas detalhando a demanda de forma geral, por equipamento e por pedido.',
        ],
        tips: [
            'Ao realizar o mapeamento na aba 2, você pode usar o botão "Sugerir Vínculos" para que o sistema busque automaticamente os melhores matches no Protheus.',
            'Passe o mouse sobre as siglas de "Tipo" para ver a descrição detalhada e o status da peça na engenharia.',
        ],
        links: [
            { label: 'VMI Dashboard', path: '/vmi/dashboard' },
            { label: 'VMI Estratégia', path: '/vmi/estrategia' },
        ],
    },

    '/vmi': {
        id: 'vmi-dashboard',
        category: 'Comercial',
        categoryColor: '#2563eb',
        title: 'VMI Dashboard',
        icon: 'BarChart',
        description: 'Painel Central do VMI (Estoque Gerenciado pelo Fornecedor).',
        steps: [
            'Acesse o Dashboard para verificar a saúde dos níveis de estoque dos clientes.',
            'Verifique alertas de ruptura (estoque baixo) ou excesso.',
            'Acompanhe o consumo médio diário e a cobertura de dias restantes.',
        ],
        links: [
            { label: 'VMI Estratégia', path: '/vmi/estrategia' },
            { label: 'VMI Upload', path: '/vmi/upload' },
        ],
    },

    '/vmi/estrategia': {
        id: 'vmi-estrategia',
        category: 'Comercial',
        categoryColor: '#2563eb',
        title: 'VMI Estratégia',
        icon: 'TrendingUp',
        description: 'Análise aprofundada da estratégia de abastecimento via Kanban VMI.',
        steps: [
            'Revise os parâmetros Min, Max e de Segurança acordados com o cliente.',
            'Acompanhe simulações visuais da queima em tempo real frente aos Lead Times VMI.'
        ],
        links: [
            { label: 'VMI Dashboard', path: '/vmi' },
        ],
    },

    '/vmi/historico': {
        id: 'vmi-historico',
        category: 'Comercial',
        categoryColor: '#2563eb',
        title: 'VMI Histórico',
        icon: 'History',
        description: 'Histórico cronológico de movimentações e envios programados VMI.',
        steps: [
            'Consulte um log auditável das leituras do cliente.',
            'Analise a progressão exata antes das reposições de produtos.',
        ],
        links: [
            { label: 'VMI Dashboard', path: '/vmi' },
        ],
    },

    '/vmi/upload': {
        id: 'vmi-upload',
        category: 'Comercial',
        categoryColor: '#2563eb',
        title: 'VMI Upload de Dados',
        icon: 'UploadCloud',
        description: 'Envio em lote (planilha/csv) de contagens periódicas do estoque do cliente.',
        steps: [
            'Gere e faça upload do relatório padronizado do cliente.',
            'O sistema processa colunas SKU e Quantidade para gerar alertas na matriz VMI.'
        ],
        links: [
            { label: 'VMI Dashboard', path: '/vmi' },
        ],
    },

    // =============================================================
    // QUALIDADE (SGQ)
    // =============================================================
    '/sgq': {
        id: 'sgq-dashboard',
        category: 'SGQ',
        categoryColor: '#0f766e',
        title: 'SGQ: Painel de Qualidade',
        icon: 'ShieldCheck',
        description: 'Painel central do Sistema de Gestão de Qualidade com indicadores e acesso rápido.',
        steps: [
            'Visualize o resumo de todos os módulos do SGQ: NC, Treinamentos, Auditorias, Calibrações.',
            'Clique em cada card para acessar o módulo específico.',
            'Os indicadores são atualizados em tempo real.',
        ],
        links: [
            { label: 'Documentos SGQ', path: '/sgq/documentos' },
            { label: 'Treinamentos', path: '/sgq/treinamento' },
        ],
    },

    '/sgq/documentos': {
        id: 'sgq-documentos',
        category: 'SGQ',
        categoryColor: '#0f766e',
        title: 'Documentos SGQ',
        icon: 'FileText',
        description: 'Repositório de documentos normativos: procedimentos, instruções de trabalho e formulários.',
        steps: [
            'Navegue pelas pastas de documentos ou use a busca por título/código.',
            'Clique no documento para visualizar o PDF diretamente no navegador.',
            'A versão e data de revisão são exibidas para cada documento.',
            'Documentos vencidos ou próximos ao vencimento são destacados automaticamente.',
        ],
        links: [
            { label: 'Painel SGQ', path: '/sgq' },
            { label: 'Treinamentos', path: '/sgq/treinamento' },
        ],
    },

    '/sgq/treinamento': {
        id: 'sgq-treinamento',
        category: 'SGQ',
        categoryColor: '#0f766e',
        title: 'Treinamentos SGQ',
        icon: 'BookOpen',
        description: 'Gestão de registro e controle de treinamentos de qualidade dos colaboradores.',
        steps: [
            'Registre novos treinamentos com nome, data, instrutor e participantes.',
            'Cada colaborador possui um histórico de treinamentos realizados.',
            'Alertas automáticos para treinamentos próximos ao vencimento.',
        ],
        links: [
            { label: 'Painel SGQ', path: '/sgq' },
            { label: 'Documentos SGQ', path: '/sgq/documentos' },
        ],
    },

    // =============================================================
    // RELATÓRIOS
    // =============================================================
    '/relatorios': {
        id: 'relatorios',
        category: 'Relatórios',
        categoryColor: '#1e40af',
        title: 'Relatórios',
        icon: 'FileText',
        description: 'Central de geração de relatórios gerenciais e operacionais.',
        steps: [
            'Selecione o tipo de relatório na lista à esquerda.',
            'Configure os filtros de período, produto, pedido ou responsável.',
            'Clique em "Gerar PDF" para baixar o relatório formatado.',
            'Use "Exportar Excel" para análise posterior em planilhas.',
        ],
        links: [
            { label: 'Pedidos de Venda', path: '/' },
            { label: 'Ordens de Produção', path: '/producao' },
        ],
    },

    // =============================================================
    // CONFIGURAÇÕES
    // =============================================================
    '/configuracoes': {
        id: 'configuracoes',
        category: 'Administração',
        categoryColor: '#374151',
        title: 'Configurações do Sistema',
        icon: 'Settings',
        description: 'Gestão de usuários, permissões, parâmetros do sistema e integrações.',
        steps: [
            'Acesse "Usuários" para criar, editar ou desativar colaboradores.',
            'Em "Permissões", defina quais módulos cada usuário (ou grupo) pode acessar.',
            'Configure as integrações com o ERP Protheus na aba "Integração".',
            'Use "Parâmetros" para ajustar configurações globais como sincronização e prefixos.',
        ],
        tips: [
            'Apenas administradores têm acesso a esta tela.',
            'Alterações de permissão entram em vigor no próximo login do usuário.',
        ],
        links: [],
    },

    // =============================================================
    // AVISOS
    // =============================================================
    '/avisos': {
        id: 'avisos',
        category: 'Comunicação',
        categoryColor: '#f59e0b',
        title: 'Avisos e Comunicados',
        icon: 'Bell',
        description: 'Central de avisos, comunicados e notificações do sistema.',
        steps: [
            'Visualize todos os avisos publicados para o seu grupo de acesso.',
            'Marque avisos como "Lido" para limpar da lista de pendentes.',
            'Administradores podem criar novos avisos com texto rico, imagens e áudio.',
            'Avisos com prazo de validade expiram automaticamente.',
        ],
        tips: [
            'O ícone de sino 🔔 na sidebar mostra o número de avisos não lidos.',
            'Avisos importantes podem ser configurados com alerta sonoro.',
        ],
        links: [],
    },

    // =============================================================
    // ANALYTICS
    // =============================================================
    '/analytics/evolucao': {
        id: 'evolucao-producao',
        category: 'Analytics',
        categoryColor: '#0284c7',
        title: 'Evolução da Produção',
        icon: 'TrendingUp',
        description: 'Gráficos de evolução comparando programado vs. realizado ao longo do tempo.',
        steps: [
            'Selecione o intervalo de análise (semana, mês, trimestre).',
            'O gráfico compara a produção planejada com a efetivamente apontada.',
            'Identifique padrões de eficiência ou gargalos recorrentes por período.',
        ],
        links: [
            { label: 'Evolução do Apontamento', path: '/pcp/evolucao-apontamento' },
            { label: 'Controle de Produção', path: '/controle-producao' },
        ],
    },
};

/**
 * Returns the help content for a given path.
 * Supports dynamic routes like /estrutura/:codigo and /bom/:codigo
 */
export function getHelpByPath(pathname) {
    if (!pathname) return null;

    // Direct match
    if (HELP_CONTENT[pathname]) return HELP_CONTENT[pathname];

    // Dynamic route match (e.g. /estrutura/XA100 → /estrutura/:codigo)
    const dynamicPatterns = [
        { regex: /^\/estrutura\/.+$/, key: '/estrutura/:codigo' },
        { regex: /^\/bom\/.+$/, key: '/bom-generator' },
    ];

    for (const pattern of dynamicPatterns) {
        if (pattern.regex.test(pathname)) {
            return HELP_CONTENT[pattern.key] || null;
        }
    }

    return null;
}

/**
 * Returns all help modules as a flat array for search/listing.
 */
export function getAllHelpModules() {
    return Object.entries(HELP_CONTENT)
        .filter(([key]) => !key.includes(':')) // exclude dynamic patterns
        .map(([path, content]) => ({ path, ...content }));
}
