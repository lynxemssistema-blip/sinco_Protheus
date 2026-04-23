import {
    LayoutDashboard, ShoppingCart, Settings as SettingsIcon, Menu, Package,
    Factory, Truck, LogOut, BarChart, Calendar, FileText, Building2,
    TrendingUp, Monitor, Network, Grid, Users, MessageSquare,
    Database, ClipboardList, ClipboardCheck, ArrowLeftRight, HelpCircle, Layers,
    FileUp, Target, History, GitMerge, Inbox, ShieldCheck, ListOrdered, Box, BarChart2
} from 'lucide-react';

export const MENU_GROUPS = [

    {
        id: 'comercial',
        label: 'Comercial',
        items: [
            { id: 'vendas', label: 'Pedidos de Venda', path: '/', icon: ShoppingCart },
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
            { id: 'bom', label: 'Gerador de BOM', path: '/bom-generator', icon: Database },
            { id: 'sinco_estrutura', label: 'Verificar Estrutura SINCO', path: '/engenharia/sinco/estrutura', icon: Network },
            { id: 'sinco_formulario', label: 'SolidEdeg', path: '/engenharia/sinco/formulario', icon: Box },
            { id: 'controle_engenharia', label: 'Controle de Engenharia', path: '/engenharia/relatorio-controle', icon: FileText },
            { id: 'relatorio_liberacao', label: 'Relatório de Liberação', path: '/engenharia/relatorio-liberacao', icon: ClipboardList }
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
            { id: 'planejamento_gantt', label: 'Planejamento Gantt', path: '/planejamento-gantt', icon: Calendar },
            { id: 'pcp_apontamento_vertical', label: 'Apontamento Vertical', path: '/pcp/apontamento-vertical', icon: ListOrdered },
            { id: 'extrato_op', label: 'Tempo das OP', path: '/pcp/extrato-op', icon: History },
            { id: 'onde_usado', label: 'Onde é Usado', path: '/pcp/onde-usado', icon: Network },
            { id: 'analytics', label: 'Analytics da Fábrica', path: '/pcp/analytics', icon: BarChart },
            { id: 'apontamento_usuario_op', label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario-op', icon: Users },
            { id: 'planejamento_estrutura_routing', label: 'Explosão BOM + Roteiro (Pull)', path: '/pcp/planejamento-estrutura-routing', icon: GitMerge },
            { id: 'painel_controle', label: 'Painel de Controle', path: '/controle-producao', icon: LayoutDashboard },
            { id: 'producao_matrix', label: 'Matriz de Produção', path: '/producao-matrix', icon: Grid },
            { id: 'consulta_op', label: 'Consulta Detalhada OP', path: '/producao/op', icon: FileText }
        ]
    },
    {
        id: 'op_fracionada',
        label: 'OP Fracionada',
        items: [
            { id: 'ind_pcp_release', label: 'Liberação PCP (Mescla)', path: '/ind-pcp-release', icon: Layers },
            { id: 'ind_factory_floor', label: 'Apontamento Ativo (Local)', path: '/ind-factory-floor', icon: Factory }
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
            { id: 'rastreio_sc', label: 'Rastreio SC -> NF', path: '/fluxo-compras-nf', icon: ArrowLeftRight }
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
            { id: 'sgq_mapeamento', label: 'Mapeamento de Processos', path: '/sgq/mapeamento-processos', icon: Network },
            { id: 'treinamentos', label: 'Treinamentos', path: '/sgq/treinamento', icon: ClipboardCheck },
            { id: 'relatorios', label: 'Relatórios Gerais', path: '/relatorios', icon: FileText }
        ]
    },
    {
        id: 'rh',
        label: 'Recursos Humanos',
        items: [
            { id: 'rh_vagas', label: 'Gestão de Vagas', path: '/rh/vagas', icon: ClipboardList },
            { id: 'rh_curriculos', label: 'Análise de Currículos (IA)', path: '/rh/curriculos', icon: FileText },
            { id: 'sgq_cargos_funcoes', label: 'Cargos e Funções', path: '/sgq/cargos-funcoes', icon: Users }
        ]
    },
    {
        id: 'vmi',
        label: 'VMI',
        items: [
            { id: 'vmi_demanda', label: 'VMI Forecast', path: '/vmi/forecast', icon: ClipboardList },
            { id: 'vmi_pedido', label: 'VMI Pedido', path: '/vmi/pedido', icon: ListOrdered },
            { id: 'vmi_leitura', label: 'Leitura de Planilha', path: '/vmi/leitura', icon: FileUp },
            { id: 'vmi_dashboard', label: 'Visão de Entrega', path: '/vmi/dashboard', icon: Target },
            { id: 'vmi_estrategia', label: 'Estratégia de Produção', path: '/vmi/estrategia', icon: GitMerge },
            { id: 'vmi_historico', label: 'Histórico & Evolução', path: '/vmi/historico', icon: History }
        ]
    },
    {
        id: 'sistema',
        label: 'Sistema',
        items: [
            { id: 'avisos', label: 'Avisos e Mensagens', path: '/avisos', icon: MessageSquare },
            { id: 'config', label: 'Configurações', path: '/configuracoes', icon: SettingsIcon },
            { id: 'protheus-estudo', label: 'Estudo SQL Protheus', path: '/admin/protheus-estudo', icon: Database },
            { id: 'ajuda', label: 'Central de Ajuda', path: '/ajuda', icon: HelpCircle }
        ]
    },
    {
        id: 'financeiro_sensivel',
        label: 'Acessos Sensíveis (RH/Financeiro)',
        items: [
            { id: 'valores_financeiros', label: 'Visualizar Valores Financeiros (R$)', path: '#', icon: BarChart, hidden: true }
        ]
    }
];
