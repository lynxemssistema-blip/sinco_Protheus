import {
    LayoutDashboard, ShoppingCart, Settings as SettingsIcon, Menu, Package,
    Factory, Truck, LogOut, BarChart, Calendar, FileText, Building2,
    TrendingUp, Monitor, Network, Grid, Users, MessageSquare,
    Database, ClipboardList, ClipboardCheck, ArrowLeftRight, HelpCircle, Layers
} from 'lucide-react';

export const MENU_GROUPS = [
    {
        id: 'comercial',
        label: 'Comercial',
        items: [
            { id: 'vendas', label: 'Pedidos de Venda', path: '/', icon: ShoppingCart }
        ]
    },
    {
        id: 'engenharia',
        label: 'Engenharia',
        items: [
            { id: 'eng_pedidos', label: 'Painel de Itens (Engenharia)', path: '/engenharia/pedidos', icon: Layers },
            { id: 'produtos', label: 'Catálogo de Produtos', path: '/produtos', icon: Package },
            { id: 'bom', label: 'Gerador de BOM', path: '/bom-generator', icon: Database },
            { id: 'sinco_estrutura', label: 'Verificar Estrutura SINCO', path: '/engenharia/sinco/estrutura', icon: Network }
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
            { id: 'apontamento_usuario', label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario', icon: Users }
        ]
    },
    {
        id: 'pcp',
        label: 'PCP & Fábrica',
        items: [
            { id: 'painel', label: 'Painel de Controle', path: '/controle-producao', icon: LayoutDashboard },
            { id: 'matriz', label: 'Matriz de Produção', path: '/producao-matrix', icon: Grid },
            { id: 'gantt', label: 'Planejamento Gantt', path: '/planejamento-gantt', icon: Calendar },
            { id: 'ops', label: 'Ordens de Produção', path: '/producao', icon: Factory },
            { id: 'ops_detalhe', label: 'Consulta Detalhada OP', path: '/producao/op', icon: ClipboardCheck },
            { id: 'materiais_pcp', label: 'Gestão de Materiais', path: '/pcp/gestao-materiais', icon: ClipboardList },
            { id: 'onde_usado', label: 'Onde é Usado', path: '/pcp/onde-usado', icon: Network },
            { id: 'analytics', label: 'Analytics da Fábrica', path: '/visao-producao', icon: BarChart },
            { id: 'tracking_evolution', label: 'Evolução Apontamento', path: '/pcp/evolucao-apontamento', icon: TrendingUp },
            { id: 'apontamento_usuario_op', label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario-op', icon: Users }
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
            { id: 'estoque', label: 'Estoque & Saldos', path: '/saldo-materiais', icon: Package }
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
        id: 'qualidade',
        label: 'Qualidade',
        items: [
            { id: 'sgq', label: 'Gestão SGQ', path: '/sgq', icon: Building2 },
            { id: 'treinamentos', label: 'Treinamentos', path: '/sgq/treinamento', icon: ClipboardCheck },
            { id: 'relatorios', label: 'Relatórios Gerais', path: '/relatorios', icon: FileText }
        ]
    },
    {
        id: 'sistema',
        label: 'Sistema',
        items: [
            { id: 'avisos', label: 'Avisos e Mensagens', path: '/avisos', icon: MessageSquare },
            { id: 'config', label: 'Configurações', path: '/configuracoes', icon: SettingsIcon },
            { id: 'ajuda', label: 'Central de Ajuda', path: '/ajuda', icon: HelpCircle }
        ]
    }
];
