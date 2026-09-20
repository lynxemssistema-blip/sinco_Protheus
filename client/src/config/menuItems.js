import {
    LayoutDashboard, ShoppingCart, Settings as SettingsIcon, Menu, Package, Printer,
    Factory, Truck, LogOut, BarChart, Calendar, FileText, Building2,
    TrendingUp, Monitor, Network, Grid, Users, MessageSquare,
    Database, ClipboardList, ClipboardCheck, ArrowLeftRight, HelpCircle, Layers,
    FileUp, Target, History, GitMerge, Inbox, ShieldCheck, ListOrdered, Box, BarChart2,
    Landmark, Link, PieChart, CheckSquare, Wrench, UserMinus, AlertTriangle, Play, FileCheck, Award, Smartphone, AlertOctagon, Sparkles
} from 'lucide-react';

export const MENU_GROUPS = [

    {
        id: 'cliente',
        label: 'Acesso Cliente',
        items: [
            { id: 'canal_cliente', label: 'Meus Projetos (Portal)', path: '/portal-cliente', icon: Monitor },
            { id: 'canal_cliente_tablet', label: 'Solicitação Rápida (Tablet)', path: '/portal-cliente/tablet', icon: Smartphone }
        ]
    },
    {
        id: 'pessoal',
        label: 'Meu Painel',
        items: [
            { id: 'meu_canal', label: 'Meu Canal (KPIs)', path: '/dashboard', icon: BarChart2 },
            { id: 'calendario_atividades', label: 'Calendário de Atividades', path: '/calendario-atividades', icon: Calendar },
            { id: 'painel_tv', label: 'Painel de TV (Frontend)', path: '/painel-producao', icon: Monitor }
        ]
    },
    {
        id: 'sinco_erp',
        label: 'SINCO ERP Nativo',
        items: [
            { id: 'erp_produtos', label: 'Cadastro de Produtos', path: '/erp/produtos', icon: Package },
            { id: 'erp_pedidos', label: 'Pedidos de Venda', path: '/erp/pedidos', icon: ShoppingCart },
            { id: 'erp_clientes', label: 'Cadastro de Clientes', path: '/erp/clientes', icon: Users },
            { id: 'erp_producao', label: 'Ordens de Produção', path: '/erp/producao', icon: Factory }
        ]
    },
    {
        id: 'comercial',
        label: 'Comercial',
        items: [
            { id: 'vendas', label: 'Pedidos de Venda', path: '/visao-geral', icon: ShoppingCart },
            { id: 'itens_faturar', label: 'Itens a Faturar', path: '/vendas/itens-faturar', icon: ListOrdered },
            { id: 'dashboard_faturamento', label: 'Dashboard de Faturamento', path: '/comercial/dashboard-faturamento', icon: BarChart2 },
            { id: 'visao_gerencial', label: 'Visão Gerencial (Atrasos)', path: '/comercial/atrasos', icon: Target },
            { id: 'controle_faturamento', label: 'Controle de Faturamento', path: '/comercial/faturamento', icon: FileText },
            { id: 'gestao_ops', label: 'Gestão de OPs', path: '/comercial/gestao-ops', icon: Layers }
        ]
    },
    {
        id: 'engenharia',
        label: 'Engenharia',
        items: [
            { id: 'eng_pedidos', label: 'Painel de Itens (Engenharia)', path: '/engenharia/pedidos', icon: Layers },
            { id: 'produtos', label: 'Catálogo de Produtos', path: '/produtos', icon: Package },
            { id: 'produtos_msmetal', label: 'Catálogo MS Metal', path: '/engenharia/msmetal/produtos', icon: Database },
            { id: 'bom', label: 'Gerador de BOM', path: '/bom-generator', icon: Database },
            { id: 'sinco_estrutura', label: 'Verificar Estrutura SINCO', path: '/engenharia/sinco/estrutura', icon: Network },
            { id: 'sinco_formulario', label: 'SolidEdeg', path: '/engenharia/sinco/formulario', icon: Box },
            { id: 'sinco_estrutura_completa', label: 'SolidEdeg Estrutura', path: '/engenharia/sinco/estrutura-completa', icon: Layers },
            { id: 'controle_engenharia', label: 'Controle de Engenharia', path: '/engenharia/relatorio-controle', icon: FileText },
            { id: 'relatorio_liberacao', label: 'Relatório de Liberação', path: '/engenharia/relatorio-liberacao', icon: ClipboardList }
        ]
    },
    {
        id: 'analise_3d',
        label: 'Análise 3D',
        items: [
            { id: 'visualizador_3d', label: 'Visualizador de Modelos', path: '/analise-3d', icon: Box }
        ]
    },
    {
        id: 'sinco',
        label: 'SINCO',
        items: [
            { id: 'sinco_os', label: 'Ordens de Serviço (Sinco)', path: '/engenharia/sinco/os', icon: ClipboardList },
            { id: 'sinco_apontamento', label: 'Apontamento de Produção - OS (Sinco)', path: '/engenharia/sinco/apontamento', icon: ClipboardCheck },
            { id: 'sinco_apontamento_matriz', label: 'Apontamento Matriz - OS (Sinco)', path: '/engenharia/sinco/apontamento-matrix', icon: Grid },
            { id: 'sinco_materiais', label: 'Materiais por OS (Sinco)', path: '/engenharia/sinco/materiais', icon: Database },
            { id: 'sinco_desenho', label: 'Desenho Ativo SE', path: '/sinco/desenho-ativo', icon: Monitor },
            { id: 'sworks', label: 'SolidWorks Connect', path: '/sworks', icon: Box },
            { id: 'apontamento_usuario', label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario', icon: Users }
        ]
    },

    {
        id: 'pcp',
        label: 'PCP Geral',
        items: [
            { id: 'visao_fabrica', label: 'Visão Global (Fábrica)', path: '/pcp/visao-fabrica', icon: Factory },
            { id: 'producao', label: 'Ordens de Produção', path: '/producao', icon: Factory },
            { id: 'relatorios_producao', label: 'Relatórios de Produção', path: '/producao/relatorios', icon: BarChart },
            { id: 'pcp_conferencia', label: 'Conferência de Apont.', path: '/pcp/conferencia', icon: ClipboardCheck },
            { id: 'evolucao_apontamentos', label: 'Evolução dos Apontamentos', path: '/pcp/evolucao-apontamento', icon: TrendingUp },
            { id: 'visao_producao', label: 'Visão de Produção', path: '/visao-producao', icon: Target },
            { id: 'curva_s_pedido', label: 'Curva S (Pedido)', path: '/pcp/curva-s', icon: TrendingUp },
            { id: 'planejamento_gantt', label: 'Planejamento Gantt', path: '/planejamento-gantt', icon: Calendar },
            { id: 'pcp_apontamento_vertical', label: 'Apontamento Vertical', path: '/pcp/apontamento-vertical', icon: ListOrdered },
            { id: 'extrato_op', label: 'Tempo das OP', path: '/pcp/extrato-op', icon: History },
            { id: 'onde_usado', label: 'Onde é Usado', path: '/pcp/onde-usado', icon: Network },
            { id: 'analytics', label: 'Analytics da Fábrica', path: '/pcp/analytics', icon: BarChart },
            { id: 'apontamento_usuario_op', label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario-op', icon: Users },
            { id: 'planejamento_estrutura_routing', label: 'Explosão BOM + Roteiro (Pull)', path: '/pcp/planejamento-estrutura-routing', icon: GitMerge },
            { id: 'painel_controle', label: 'Painel de Controle', path: '/controle-producao', icon: LayoutDashboard },
            { id: 'planejador_avancado', label: 'Planejamento Estratégico', path: '/pcp/planejador-avancado', icon: GitMerge },
            { id: 'producao_matrix', label: 'Matriz de Produção', path: '/producao-matrix', icon: Grid },
            { id: 'bom_appointment', label: 'Apontamento por Estrutura', path: '/pcp/apontamento-estrutura', icon: Network },
            { id: 'consulta_op', label: 'Consulta Detalhada OP', path: '/producao/op', icon: FileText },
            { id: 'visao_setores', label: 'Visão Gerencial por Setor', path: '/pcp/visao-setores', icon: PieChart },
            { id: 'setores_cadastro', label: 'Cadastro de Setores', path: '/pcp/setores', icon: Landmark },
            { id: 'setores_recursos', label: 'Recursos por Setor', path: '/pcp/setores/recursos', icon: Link },
            { id: 'pcp_fila_dependencias', label: 'Fila e Dependências (WIP)', path: '/pcp/fila-dependencias', icon: ArrowLeftRight },
            { id: 'pcp_controle_execucao', label: 'Controle de Execução', path: '/pcp/controle-execucao', icon: Play },
            { id: 'pcp_programas_ncn', label: 'Programa CNC', path: '/pcp/programas-ncn', icon: FileText },
            { id: 'montagem_solicitacoes', label: 'Pendências da Montagem', path: '/pcp/montagem-solicitacoes', icon: ClipboardList }
        ]
    },
    {
        id: 'pcp_refinado',
        label: 'PCP Refinado',
        items: [
            { id: 'pcp_cadastro_capacidade', label: 'Cadastro de Capacidade', path: '/pcp-refinado/capacidade', icon: Layers },
            { id: 'pcp_ocupacao_recursos', label: 'Taxa de Ocupação', path: '/pcp-refinado/ocupacao', icon: BarChart2 },
            { id: 'rastreabilidade_pedidos', label: 'Rastreio de Faturamento', path: '/pcp-refinado/rastreabilidade', icon: Network }
        ]
    },
    {
        id: 'op_fracionada',
        label: 'OP Fracionada',
        items: [
            { id: 'ind_pcp_release', label: 'Liberação PCP (Mescla)', path: '/ind-pcp-release', icon: Layers },
            { id: 'ind_factory_floor', label: 'Painel da Fábrica (Local)', path: '/ind-factory-floor', icon: Factory },
            { id: 'ind_apontamento', label: 'Apontamento Fracionado', path: '/ind-apontamento', icon: CheckSquare }
        ]
    },
    {
        id: 'ronaldo',
        label: 'Gestão a Vista',
        items: [
            { id: 'evolucao_apontamento', label: 'Evolução Apontamentos', path: '/analytics/evolucao', icon: TrendingUp }
        ]
    },
    {
        id: 'logistica',
        label: 'Logística',
        items: [
            { id: 'romaneios', label: 'Expedição (Romaneios)', path: '/romaneios', icon: Truck },
            { id: 'portal_fornecedor', label: 'Portal do Fornecedor', path: '/fornecedor/romaneios', icon: Truck },
            { id: 'recebimentos', label: 'Recebimento de Retornos', path: '/recebimentos', icon: Inbox },
            { id: 'estoque', label: 'Estoque & Saldos', path: '/saldo-materiais', icon: Package }
        ]
    },
    {
        id: 'financeiro',
        label: 'Financeiro',
        items: [
            { id: 'fluxo_caixa', label: 'Fluxo de Caixa', path: '/financeiro/fluxo-caixa', icon: TrendingUp },
            { id: 'dashboard_financeiro', label: 'Dashboard Gerencial', path: '/financeiro/dashboard', icon: Database },
            { id: 'balancete', label: 'Balancete Dinâmico', path: '/financeiro/balancete', icon: Layers }
        ]
    },
    {
        id: 'suprimentos',
        label: 'Suprimentos',
        items: [
            { id: 'solicitacoes', label: 'Solicitações', path: '/solicitacoes-compras', icon: ShoppingCart },
            { id: 'pedidos_pv', label: 'Pedidos x PV Cliente', path: '/pedidos-compras-pv', icon: FileText },
            { id: 'requisicoes_internas', label: 'Requisições Internas', path: '/suprimentos/requisicoes', icon: ClipboardList },
            { id: 'rastreio_sc', label: 'Rastreio SC -> NF', path: '/fluxo-compras-nf', icon: ArrowLeftRight },
            { id: 'espelho_nf', label: 'Ver Espelho da NF', path: '/suprimentos/espelho-nf', icon: FileText },
            { id: 'auditoria_pc', label: 'Auditoria PC x XML', path: '/auditoria-pc', icon: ShieldCheck }
        ]
    },
    {
        id: 'protheus',
        label: 'Proteus (ERP)',
        items: [
            { id: 'protheus_dashboard', label: 'Visão Geral / Formulários', path: '/protheus', icon: Database }
        ]
    },
    {
        id: 'qualidade',
        label: 'Qualidade',
        items: [
            { id: 'sgq', label: 'Gestão SGQ', path: '/sgq', icon: Building2 },
            { id: 'sgq_ativos', label: 'Gestão de Ativos', path: '/sgq/ativos', icon: Wrench },
            { id: 'sgq_caixas', label: 'Caixas de Ferramenta', path: '/sgq/caixas', icon: Package },
            { id: 'sgq_romaneios', label: 'Romaneios SGQ', path: '/sgq/romaneios', icon: Truck },
            { id: 'sgq_mapeamento', label: 'Mapeamento de Processos', path: '/sgq/mapeamento-processos', icon: Network },
            { id: 'treinamentos', label: 'Treinamentos', path: '/sgq/treinamento', icon: ClipboardCheck },
            { id: 'sgq_rncs', label: 'Gestão de RNCs', path: '/sgq/gestao-rncs', icon: AlertTriangle },
            { id: 'ppaps_buscar_produto', label: 'Buscar Produto (PPAPs)', path: '/ppaps/buscar-produto', icon: Database },
            { id: 'relatorios', label: 'Relatórios Gerais', path: '/relatorios', icon: FileText }
        ]
    },
    {
        id: 'rh',
        label: 'Recursos Humanos',
        items: [
            { id: 'rh_vagas', label: 'Gestão de Vagas', path: '/rh/vagas', icon: ClipboardList },
            { id: 'rh_curriculos', label: 'Análise de Currículos (IA)', path: '/rh/curriculos', icon: FileText },
            { id: 'rh_offboarding', label: 'Offboarding (Custódia)', path: '/rh/offboarding', icon: UserMinus },
            { id: 'sgq_cargos_funcoes', label: 'Cargos e Funções', path: '/sgq/cargos-funcoes', icon: Users }
        ]
    },
    {
        id: 'vmi',
        label: 'VMI',
        items: [
            { id: 'vmi_demanda', label: 'VMI Forecast', path: '/vmi/forecast', icon: ClipboardList },
            { id: 'vmi_demanda_mes', label: 'Demanda Mês', path: '/vmi/demanda-mes', icon: Calendar },
            { id: 'vmi_criticos', label: 'Tabela de Críticos', path: '/vmi/criticos', icon: AlertOctagon },
            { id: 'vmi_pedido', label: 'VMI Pedido', path: '/vmi/pedido', icon: ListOrdered },
            { id: 'vmi_leitura', label: 'Leitura de Planilha', path: '/vmi/leitura', icon: FileUp },
            { id: 'vmi_dashboard', label: 'Visão de Entrega', path: '/vmi/dashboard', icon: Target },
            { id: 'vmi_estrategia', label: 'Estratégia de Produção', path: '/vmi/estrategia', icon: GitMerge },
            { id: 'vmi_historico', label: 'Histórico & Evolução', path: '/vmi/historico', icon: History }
        ]
    },

    {
        id: 'wabtec',
        label: 'WabTec',
        items: [
            { id: 'wabtec_ppaps', label: "PPAP's", path: '/wabtec/ppaps', icon: Award },
            { id: 'wabtec_escopo', label: 'Escopo de Fornecimento', path: '/wabtec/escopo', icon: FileText },
            { id: 'wabtec_estrutura', label: 'Estrutura (Importação)', path: '/wabtec/estrutura', icon: GitMerge },
            { id: 'wabtec_datas_solicitacao', label: 'Datas de Solicitação', path: '/wabtec/datas-solicitacao', icon: Calendar }
        ]
    },
    {
        id: 'engetron',
        label: 'Engetron',
        items: [
            { id: 'engetron_dashboard', label: 'Demandas Engetron', path: '/engetron/dashboard', icon: LayoutDashboard }
        ]
    },
    {
        id: 'manutencao',
        label: 'Manutenção de Equip.',
        items: [
            { id: 'manutencao_dashboard', label: 'Gestão Manutenção', path: '/manutencao/dashboard', icon: BarChart },
            { id: 'manutencao_maquinas', label: 'Máquinas & Equips.', path: '/manutencao/maquinas', icon: Factory },
            { id: 'manutencao_checklists', label: 'Checklists Diários', path: '/manutencao/checklists', icon: ClipboardCheck },
            { id: 'manutencao_ordens', label: 'Ordens de Manutenção', path: '/manutencao/ordens', icon: FileText },
            { id: 'manutencao_materiais', label: 'Gestão de Materiais', path: '/manutencao/materiais', icon: Package },
            { id: 'manutencao_tecnicos', label: 'Técnicos de Manutenção', path: '/manutencao/tecnicos', icon: Users },
            { id: 'manutencao_atividades', label: 'Atividades Padrão', path: '/manutencao/atividades', icon: Layers }
        ]
    },
    {
        id: 'sistema',
        label: 'Sistema',
        items: [
            { id: 'avisos', label: 'Avisos e Mensagens', path: '/avisos', icon: MessageSquare },
            { id: 'novas_funcionalidades', label: 'Novas Funcionalidades ✨', path: '/novas-funcionalidades', icon: Sparkles },
            { id: 'config', label: 'Configurações', path: '/configuracoes', icon: SettingsIcon },
            { id: 'config_etiquetas', label: 'Configurações: Aba Etiquetas', path: '#', icon: Printer, hidden: true },
            { id: 'protheus-estudo', label: 'Estudo SQL Protheus', path: '/admin/protheus-estudo', icon: Database },
            { id: 'ajuda', label: 'Central de Ajuda', path: '/ajuda', icon: HelpCircle }
        ]
    },
    {
        id: 'financeiro_sensivel',
        label: 'Acessos Sensíveis (RH/Financeiro)',
        items: [
            { id: 'valores_financeiros', label: 'Visualizar Valores Financeiros (R$)', path: '#', icon: BarChart, hidden: true },
            { id: 'aba_financeiro_faturar', label: 'Visualizar Aba Financeira (Itens a Faturar)', path: '#', icon: BarChart, hidden: true }
        ]
    }
];
