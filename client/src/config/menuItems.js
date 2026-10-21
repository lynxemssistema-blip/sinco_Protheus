import {
    LayoutDashboard, ShoppingCart, Settings as SettingsIcon, Menu, Package, Printer,
    Factory, Truck, LogOut, BarChart, Calendar, FileText, Building2,
    TrendingUp, Monitor, Network, Grid, Users, MessageSquare,
    Database, ClipboardList, ClipboardCheck, ArrowLeftRight, HelpCircle, Layers,
    FileUp, Target, History, GitMerge, Inbox, ShieldCheck, ListOrdered, Box, BarChart2,
    Landmark, Link, PieChart, CheckSquare, Wrench, UserMinus, AlertTriangle, Play, FileCheck, Award, Smartphone, AlertOctagon, Sparkles, Cpu,
    Tag, Scale, Hash, Flame, Shield, Clock, Palette, Sliders
} from 'lucide-react';

export const MENU_GROUPS = [

    {
        id: 'sinco_erp',
        label: 'SINCO ERP Nativo',
        items: [
            { id: 'erp_produtos', label: 'Cadastro de Produtos', path: '/erp/produtos', icon: Package },
            { id: 'erp_pedidos', label: 'Orçamentos', path: '/erp/pedidos', icon: ShoppingCart },
            { id: 'erp_clientes', label: 'Cadastro de Clientes', path: '/erp/clientes', icon: Users },
            { id: 'erp_producao', label: 'Ordens de Produção', path: '/erp/producao', icon: Factory }
        ]
    },
    {
        id: 'cadastros_basicos',
        label: 'Cadastros Básicos',
        items: [
            { id: 'cadastro_prefixos', label: 'Prefixos (Famílias)', path: '/cadastros/prefixos', icon: Hash },
            { id: 'cadastro_tipos', label: 'Tipos de Produto', path: '/cadastros/tipos-produto', icon: Tag },
            { id: 'cadastro_unidades', label: 'Unidades de Medida', path: '/cadastros/unidades-medida', icon: Scale },
            { id: 'cadastro_armazens', label: 'Armazéns / Locais', path: '/cadastros/armazens', icon: Building2 },
            { id: 'cadastro_cores_aco', label: 'Codificação de Aço (Cores)', path: '/cadastros/cores-aco', icon: Palette },
            { id: 'cadastro_templates_produto', label: 'Form. Específicos (Matriz)', path: '/cadastros/templates-produto', icon: Sliders },
            { id: 'setores_cadastro', label: 'Cadastro de Setores', path: '/pcp/setores', icon: Landmark },
            { id: 'recursos_cadastro', label: 'Cadastro de Recursos', path: '/pcp/recursos', icon: Cpu },
            { id: 'setores_recursos', label: 'Recursos por Setor', path: '/pcp/setores/recursos', icon: Link }
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
            { id: 'controle_faturamento', label: 'Controle de Faturamento', path: '/comercial/faturamento', icon: FileText }
        ]
    },
    {
        id: 'engenharia',
        label: 'Engenharia',
        items: [
            { id: 'produtos', label: 'Catálogo de Produtos', path: '/produtos', icon: Package },
            { id: 'bom', label: 'Gerador de BOM', path: '/bom-generator', icon: Database },

            { id: 'sinco_formulario', label: 'SolidEdeg', path: '/engenharia/sinco/formulario', icon: Box },
            { id: 'controle_engenharia', label: 'Controle de Engenharia', path: '/engenharia/relatorio-controle', icon: FileText },
            { id: 'relatorio_liberacao', label: 'Relatório de Liberação', path: '/engenharia/relatorio-liberacao', icon: ClipboardList }
        ]
    },

    {
        id: 'pcp',
        label: 'PCP Geral',
        items: [
            { id: 'visao_fabrica', label: 'Visão Global (Fábrica)', path: '/pcp/visao-fabrica', icon: Factory },
            { id: 'curva_s_pedido', label: 'Curva S (Pedido)', path: '/pcp/curva-s', icon: TrendingUp },
            { id: 'pcp_apontamento_vertical', label: 'Apontamento Vertical', path: '/pcp/apontamento-vertical', icon: ListOrdered },
            { id: 'extrato_op', label: 'Tempo das OP', path: '/pcp/extrato-op', icon: History },
            { id: 'onde_usado', label: 'Onde é Usado', path: '/pcp/onde-usado', icon: Network },
            { id: 'analytics', label: 'Analytics da Fábrica', path: '/pcp/analytics', icon: BarChart },
            { id: 'apontamento_usuario_op', label: 'Apontamento por Usuário', path: '/pcp/apontamento-por-usuario-op', icon: Users },
            { id: 'planejamento_estrutura_routing', label: 'Explosão BOM + Roteiro (Pull)', path: '/pcp/planejamento-estrutura-routing', icon: GitMerge },
            { id: 'producao_matrix', label: 'Matriz de Produção', path: '/producao-matrix', icon: Grid },
            { id: 'bom_appointment', label: 'Apontamento por Estrutura', path: '/pcp/apontamento-estrutura', icon: Network },
            { id: 'visao_setores', label: 'Visão Gerencial por Setor', path: '/pcp/visao-setores', icon: PieChart },
            { id: 'pcp_fila_dependencias', label: 'Fila e Dependências (WIP)', path: '/pcp/fila-dependencias', icon: ArrowLeftRight }
        ]
    },
    {
        id: 'pcp_refinado',
        label: 'PCP Refinado',
        items: [
            { id: 'pcp_ocupacao_recursos', label: 'Taxa de Ocupação', path: '/pcp-refinado/ocupacao', icon: BarChart2 },
            { id: 'rastreabilidade_pedidos', label: 'Rastreio de Faturamento', path: '/pcp-refinado/rastreabilidade', icon: Network }
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
        id: 'qualidade',
        label: 'Qualidade',
        items: [
            { id: 'sgq', label: 'Gestão SGQ', path: '/sgq', icon: Building2 },
            { id: 'sgq_ativos', label: 'Gestão de Ativos', path: '/sgq/ativos', icon: Wrench },
            { id: 'sgq_caixas', label: 'Caixas de Ferramenta', path: '/sgq/caixas', icon: Package },
            { id: 'sgq_romaneios', label: 'Romaneios SGQ', path: '/sgq/romaneios', icon: Truck },
            { id: 'sgq_mapeamento', label: 'Mapeamento de Processos', path: '/sgq/mapeamento-processos', icon: Network },
            { id: 'treinamentos', label: 'Treinamentos', path: '/sgq/treinamento', icon: ClipboardCheck },
            { id: 'sgq_rncs', label: 'Gestão de RNCs', path: '/sgq/gestao-rncs', icon: AlertTriangle }
        ]
    },
    {
        id: 'rh',
        label: 'Recursos Humanos',
        items: [
            { id: 'rh_pasta_colaborador', label: 'Pasta do Colaborador (360°)', path: '/rh/pasta-colaborador', icon: Award },
            { id: 'rh_portal_colaborador', label: 'Portal Autoatendimento', path: '/rh/portal-colaborador', icon: Smartphone },
            { id: 'rh_vagas', label: 'Gestão de Vagas', path: '/rh/vagas', icon: ClipboardList },
            { id: 'rh_curriculos', label: 'Análise de Currículos (IA)', path: '/rh/curriculos', icon: FileText },
            { id: 'rh_offboarding', label: 'Offboarding (Custódia)', path: '/rh/offboarding', icon: UserMinus },
            { id: 'sgq_cargos_funcoes', label: 'Cargos e Funções', path: '/sgq/cargos-funcoes', icon: Users }
        ]
    },
    {
        id: 'sst',
        label: 'Segurança & Benefícios',
        items: [
            { id: 'sst_central', label: 'Gestão SST (NR-06)', path: '/sst', icon: ShieldCheck },
            { id: 'sst_cipa', label: 'CIPA & Eleição (NR-05)', path: '/sst/cipa', icon: Award },
            { id: 'sst_brigada', label: 'Brigada de Incêndio (NR-23)', path: '/sst/brigada', icon: Flame },
            { id: 'sst_cesta', label: 'Cesta Básica & Benefícios', path: '/sst/cesta-basica', icon: FileCheck }
        ]
    },
    {
        id: 'portaria',
        label: 'Portaria & Acesso',
        items: [
            { id: 'portaria_guarita', label: 'Portaria (Guarita / Terminal)', path: '/portaria/guarita', icon: ShieldCheck },
            { id: 'portaria_gerencial', label: 'Portaria Gerencial (Dashboard)', path: '/portaria/gerencial', icon: Shield },
            { id: 'portaria_turnos', label: 'Cadastro de Turnos', path: '/portaria/turnos', icon: Clock }
        ]
    },
    {
        id: 'corporativo',
        label: 'Salas & Suporte TI',
        items: [
            { id: 'salas_reuniao', label: 'Salas de Reunião & Totem', path: '/salas', icon: Calendar },
            { id: 'suporte_central', label: 'Central de Suporte TI', path: '/suporte', icon: HelpCircle }
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
