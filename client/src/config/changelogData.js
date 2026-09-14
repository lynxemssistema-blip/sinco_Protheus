// ─────────────────────────────────────────────────────────────────────────────
// changelogData.js — Registro Oficial de Novas Funcionalidades
// Marco Inicial: 09/09/2026 (Data Oficial de Entrega do APP MetalFisa)
// ─────────────────────────────────────────────────────────────────────────────

export const CHANGELOG_MODULES = [
    { id: 'todos', label: 'Todos os Módulos' },
    { id: 'sinco', label: 'SINCO & Engenharia' },
    { id: 'sistema', label: 'Sistema & Infraestrutura' },
    { id: 'wabtec', label: 'WabTec' },
    { id: 'pcp', label: 'PCP & Chão de Fábrica' },
    { id: 'sgq', label: 'SGQ & Qualidade' },
    { id: 'comercial', label: 'Comercial & Faturamento' }
];

export const CHANGELOG_TYPES = [
    { id: 'todos', label: 'Todos os Tipos' },
    { id: 'nova_feature', label: 'Nova Funcionalidade' },
    { id: 'resiliencia', label: 'Resiliência & Segurança' },
    { id: 'melhoria', label: 'Melhoria de Performance' }
];

export const CHANGELOG_DATA = [
    {
        id: '2026-09-14-arvore-completa-sinco-multinivel',
        data: '14/09/2026',
        dataIso: '2026-09-14',
        versao: 'v2026.4.5',
        modulo: 'sinco',
        moduloLabel: 'SINCO & Engenharia',
        tipo: 'nova_feature',
        tipoLabel: 'Engenharia SINCO & Estrutura Multinível',
        badgeColor: 'emerald',
        titulo: '🌳 Estrutura Completa em Árvore Multinível (N0 a N4+) & Gestão 360° em Qualquer Nível',
        resumo: 'Nova aba dedicada "Estrutura em Árvore Completa" no Formulário de Engenharia SINCO com varredura hierárquica recursiva total da BOM (PostgreSQL CTE), 3 modos de visualização selecionáveis pelo usuário (Accordion, Drawer Lateral e Janela Modal 360°) e gestão direta de Materiais, Clientes, Roteiros e Restrições em qualquer nível selecionado.',
        destaques: [
            'Explosão Recursiva de Todos os Níveis: Varredura profunda automática via CTE SQL da estrutura do produto, exibindo a hierarquia completa de subconjuntos e matérias-primas (N0, N1, N2, N3, N4...) com badge de nível colorido e cálculo de quantidade acumulada.',
            '3 Modos Visuais à Escolha do Usuário: Flexibilidade operacional permitindo alternar em 1 clique entre Linha Expansível (Accordion embutido na tabela), Painel Lateral Deslizante (Drawer) e Janela Modal Ampla 360°.',
            'Gestão e Adição em Qualquer Nível: Painel unificado (SincoNodeManager) permitindo consultar, incluir e editar em qualquer componente da árvore: Árvore do Produto / Materiais (SG1), Produto Metalfisa/Cliente (SZ1), Roteiro de Fabricação / Operações (SG2) e Restrições de Engenharia (SZ0).',
            'Sincronização e Gravação Oficial Protheus: Alterações e novos vínculos inseridos em qualquer subnível gravam diretamente no banco Protheus, mantendo paridade com as rotinas do ERP.',
            'Produtividade e Filtros Rápidos: Busca textual instantânea nos nós da árvore, botões de Expandir Tudo / Recolher Tudo e indicação de status de validação técnica.'
        ],
        linkAcao: '/engenharia/sinco/formulario',
        linkLabel: 'Acessar Árvore no Formulário SINCO',
        autor: 'Engenharia de Produto & SINCO'
    },
    {
        id: '2026-09-14-layout-widescreen-msmetal',
        data: '14/09/2026',
        dataIso: '2026-09-14',
        versao: 'v2026.4.4',
        modulo: 'sinco',
        moduloLabel: 'SINCO & Engenharia',
        tipo: 'melhoria',
        tipoLabel: 'Aproveitamento Widescreen & Layout',
        badgeColor: 'blue',
        titulo: '🖥️ Catálogo MS Metal Otimizado para Monitores Widescreen & Coluna de Código de Desenho',
        resumo: 'Reestruturação ergonômica da tela de Catálogo de Produtos MS Metal (/engenharia/msmetal/produtos) para aproveitar 100% da largura útil de monitores Full HD, Ultrawide e 4K, eliminando espaços ociosos e adicionando nova coluna dedicada de Código de Desenho com filtros persistentes.',
        destaques: [
            'Aproveitamento Total da Tela (Widescreen): Remoção de limites rígidos de largura (max-w), permitindo que tabelas e painéis expandam fluidamente em monitores de alta resolução.',
            'Coluna Dedicada de Código de Desenho: Exibição explícita do código do desenho técnico com formatação mono destacada ao lado da descrição.',
            'Controles e Paginação Responsiva: Barra superior compacta com busca multi-termo integrada e seletores rápidos de paginação (25, 50, 100 itens por página).'
        ],
        linkAcao: '/engenharia/msmetal/produtos',
        linkLabel: 'Ver Catálogo Otimizado',
        autor: 'Engenharia & UI/UX'
    },
    {
        id: '2026-09-14-catalogo-msmetal-firebird',
        data: '14/09/2026',
        dataIso: '2026-09-14',
        versao: 'v2026.4.3',
        modulo: 'sinco',
        moduloLabel: 'SINCO & Engenharia',
        tipo: 'nova_feature',
        tipoLabel: 'Catálogo & Estrutura MS Metal',
        badgeColor: 'blue',
        titulo: '🌲 Catálogo de Produtos e Estrutura BOM do MS Metal (Firebird) com Cruzamento Protheus',
        resumo: 'Novo módulo completo na seção de Engenharia que disponibiliza todo o acervo histórico de produtos e fichas técnicas do MS Metal (Firebird), com consulta paginada, página dedicada de estrutura BOM multinível, roteiro de operações e cruzamento automático com o Protheus.',
        destaques: [
            'Catálogo MS Metal com Paridade Protheus: Tela completa com busca multi-termo, filtros por Código, Ref. Desenho, Part Number do Cliente e Razão Social, além de exportação direta para XLSX.',
            'Vínculo Automático Protheus (SB1010): Identificação instantânea em tempo real indicando se cada produto do MS Metal já foi migrado/cadastrado no Protheus ou se permanece exclusivo do MS Metal.',
            'Origem do Desenho Técnico: Discriminação visual clara entre desenhos do legado MS Metal (desenho/revisão) e PDFs indexados no Protheus/SINCO.',
            'Página Dedicada de Estrutura (/engenharia/msmetal/estrutura/:id): Explosão técnica com abas para Matérias-Primas (com peso e consumo por peça), Roteiro de Operações de Fábrica (com tempos de preparação e operação), Subconjuntos e Vínculos com Clientes.',
            'Segurança e Read-Only: Conexão direta com o banco Firebird (192.168.1.253) protegida contra alterações, preservando 100% da integridade da base legada.'
        ],
        linkAcao: '/engenharia/msmetal/produtos',
        linkLabel: 'Acessar Catálogo MS Metal',
        autor: 'Engenharia & PCP'
    },
    {
        id: '2026-09-14-cadastro-protheus-sz1',
        data: '14/09/2026',
        dataIso: '2026-09-14',
        versao: 'v2026.4.2',
        modulo: 'sinco',
        moduloLabel: 'SINCO & Engenharia',
        tipo: 'nova_feature',
        tipoLabel: 'Integração & Amarração Protheus',
        badgeColor: 'emerald',
        titulo: '🔗 Cadastro Novo no Protheus & Amarração Automática SZ1010 (Produto x Cliente)',
        resumo: 'Aprimoramento do fluxo de cadastro de produtos no Protheus (Solid Edge / SINCO): abertura 100% limpa para novos cadastros e integração robusta com a tabela oficial SZ1010 via API Protheus TLPP.',
        destaques: [
            'Abertura Limpa do Modal: Ao clicar no botão "Cadastrar no Protheus", o formulário inicia totalmente zerado, sem contaminação por códigos ou clientes antigos da tela ativa, eliminando falsos alertas de desenho já existente.',
            'Amarração Oficial SZ1010: Integração com a API TLPP (/produto-cliente/editar) corrigida com envio estrito do atributo NOPER (3 para nova inclusão, 4 para alteração com RECNO), gravando os vínculos de Cliente x Desenho diretamente no Protheus.',
            'Vínculo Inteligente com Produtos Existentes: Ação de vincular a código Protheus existente agora sincroniza e grava a amarração na tabela SZ1010 de forma automática.',
            'Exibição Instantânea no Formulário: A tabela de Restrições (SZ1) do formulário Solid Edge/SINCO atualiza imediatamente após a geração do produto sem depender de latência de replicação de banco de dados.'
        ],
        linkAcao: '/sinco/formulario',
        linkLabel: 'Ver Formulário SINCO',
        autor: 'Engenharia de Software & Protheus'
    },
    {
        id: '2026-09-09-watchdog',
        data: '09/09/2026',
        dataIso: '2026-09-09',
        versao: 'v2026.4.1',
        modulo: 'sistema',
        moduloLabel: 'Sistema & Infraestrutura',
        tipo: 'resiliencia',
        tipoLabel: 'Resiliência & Segurança',
        badgeColor: 'amber',
        titulo: '⚡ Auto-Recuperação do Servidor ("Acordar o Servidor") & Watchdog Autônomo',
        resumo: 'Mecanismo inteligente na tela de login que permite ao usuário reiniciar o servidor de forma limpa e automática caso detecte lentidão ou indisponibilidade, sem depender do suporte técnico.',
        destaques: [
            'Watchdog Isolado: Microserviço em Node.js puro na porta 3008, imune a travamentos do backend principal ou banco de dados.',
            'Exibição 100% Condicional: Botão invisível no uso normal, surgindo apenas sob lentidão (> 3,5s) ou falha de resposta (500/timeout).',
            'Cooldown de 30 Minutos: Bloqueio contra múltiplos acionamentos acidentais para proteção da estabilidade do servidor.',
            'Feedback em Tempo Real: Contagem regressiva de 15 segundos com auto-ping até o restabelecimento completo do acesso.',
            'Guia na Central de Ajuda: Documentação contextual e orientações disponíveis no HelpCenter do sistema.'
        ],
        linkAcao: '/login',
        linkLabel: 'Ver na Tela de Login',
        autor: 'Equipe de Engenharia de Software'
    },
    {
        id: '2026-09-09-wabtec-bom',
        data: '09/09/2026',
        dataIso: '2026-09-09',
        versao: 'v2026.4.0',
        modulo: 'wabtec',
        moduloLabel: 'WabTec',
        tipo: 'nova_feature',
        tipoLabel: 'Nova Funcionalidade',
        badgeColor: 'emerald',
        titulo: '📊 Leitura Enriquecida da Estrutura WabTec & Vínculo Automático Protheus',
        resumo: 'Importação abrangente da planilha de BOM WabTec com persistência total dos atributos, conversão automática de revisões e cruzamento instantâneo com a base de dados do ERP Protheus.',
        destaques: [
            'Persistência Integral: Gravação de Find NO, UOM, Data de Liberação, Status, Item Pai e TCUID no banco de dados.',
            'Conversão Inteligente de Revisões: Tradução algorítmica de revisões em letras para padrão numérico de 2 dígitos (ex: D → 04, H → 08).',
            'Cruzamento Automático Protheus: Busca imediata nas tabelas SZ1010 e SB1010 pelo código do desenho WabTec.',
            'Comparativo em Tempo Real: Badges visuais indicando "Mesma Revisão" (verde), "Divergência de Revisão" (amarelo) ou "Não Encontrado" (cinza).',
            'Suporte a Unidades e A/R: Tratamento seguro para quantidades decimais e itens do tipo "As Required".'
        ],
        linkAcao: '/wabtec/estrutura',
        linkLabel: 'Acessar Módulo WabTec',
        autor: 'Equipe de Engenharia & PCP'
    },
    {
        id: '2026-09-09-marco-entrega',
        data: '09/09/2026',
        dataIso: '2026-09-09',
        versao: 'v2026.4.0',
        modulo: 'sistema',
        moduloLabel: 'Sistema & Infraestrutura',
        tipo: 'nova_feature',
        tipoLabel: 'Marco Oficial de Entrega',
        badgeColor: 'blue',
        titulo: '🚀 Entrega Oficial do Portal MetalFisa & Início do Changelog Contínuo',
        resumo: 'Conclusão e entrega do ecossistema completo de gestão industrial da MetalFisa, integrando PCP, SGQ, Comercial, Engenharia, Suprimentos e RH ao Protheus.',
        destaques: [
            '95+ Telas Operacionais Integradas cobrindo todo o ciclo fabril da MetalFisa.',
            'Painel de Controle de Execução e Apontamento de Produção em Tempo Real.',
            'Integração Completa Protheus (P12 / PostgreSQL) com replicações e leituras de alta performance.',
            'Inauguração da Tela Oficial de Novas Funcionalidades para auditoria e acompanhamento contínuo.'
        ],
        linkAcao: '/ajuda',
        linkLabel: 'Ver Relatório Geral na Ajuda',
        autor: 'Diretoria & Equipe Técnica MetalFisa'
    }
];
