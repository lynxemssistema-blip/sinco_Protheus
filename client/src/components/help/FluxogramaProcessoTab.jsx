import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Building2, Users, Shield, Cpu, Layers, GitBranch, 
    FileText, Calendar, CheckCircle2, ArrowRight, Truck, 
    Receipt, ChevronRight, Sparkles, ExternalLink, Download, 
    Maximize2, HelpCircle, Eye, Factory, Wrench, Package,
    Clock, AlertTriangle, ArrowDown, Database, CheckSquare, 
    TrendingUp, GitMerge, ListOrdered, Scale, Hash, Tag, ArrowLeftRight,
    Search, Filter, Play, Check, ShieldCheck, CornerDownRight, X, Info
} from 'lucide-react';
import flowchartImg from '../../assets/fluxograma_processo_sinco.jpg';

const FLUXO_STEPS = [
    {
        id: 'empresa',
        phaseId: 1,
        phase: 'Fase 1: Fundação & Governança',
        phaseBadge: 'Fundação',
        phaseColor: 'from-blue-600 to-cyan-600',
        borderColor: 'border-blue-500/40 hover:border-blue-400',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950/40',
        stepNum: '01',
        title: 'Cadastro da Empresa & Tenant',
        icon: Building2,
        route: '/settings',
        actionLabel: 'Configurar Unidade Fabril',
        tables: ['empresa', 'app_company_settings'],
        owner: 'Diretoria / Administrador Master',
        inputs: ['CNPJ & Razão Social', 'Inscrição Estadual', 'Logomarca Corporativa', 'Segmento Fabril'],
        outputs: ['IdEmpresa (Particionamento)', 'Parâmetros Fiscais', 'Identidade Visual de Relatórios'],
        summary: 'Ponto de partida absoluto do sistema. Define a identidade corporativa, parâmetros fiscais e isolamento multi-tenant.',
        prereq: 'Nenhum (Criado no Onboarding ou Cadastro Inicial)',
        items: [
            'Razão Social, Nome Fantasia, CNPJ e Inscrição Estadual da unidade fabril',
            'Segmento industrial (Caldeiraria, Usinagem, Laser, Estruturas Metálicas)',
            'Plano de assinatura ativo (Trial 14 dias ou Pro/Enterprise)',
            'Logomarca corporativa para ordens, romaneios e relatórios'
        ],
        skippedWarning: 'Sem a empresa cadastrada, nenhum dado pode ser isolado. O sistema bloqueia a criação de usuários e parâmetros.',
        impact: 'Garante o isolamento seguro dos dados. Todas as ordens, estoques e faturamentos passam a ser vinculados ao IdEmpresa.'
    },
    {
        id: 'colaboradores',
        phaseId: 1,
        phase: 'Fase 1: Fundação & Governança',
        phaseBadge: 'Fundação',
        phaseColor: 'from-blue-600 to-cyan-600',
        borderColor: 'border-cyan-500/40 hover:border-cyan-400',
        badgeBg: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-cyan-950/40',
        stepNum: '02',
        title: 'Colaboradores & Perfis de Acesso (RBAC)',
        icon: Users,
        route: '/empresa/colaboradores',
        actionLabel: 'Gerenciar Colaboradores',
        secondaryRoute: '/settings',
        secondaryLabel: 'Matriz de Permissões',
        tables: ['usuario', 'app_user_permissions', 'empresa_convites'],
        owner: 'Gestor de RH / Administrador Master',
        inputs: ['Nome do Colaborador', 'Login / E-mail / WhatsApp', 'Setor Fabril', 'Nível Hierárquico'],
        outputs: ['Credencial Individual', 'Permissão por Módulo', 'Crachá de Apontamento Chão de Fábrica'],
        summary: 'Cadastra os colaboradores e define exatamente o que cada perfil pode ver, editar ou aprovar no sistema.',
        prereq: 'Empresa cadastrada (Passo 01)',
        items: [
            'Usuário Master (Dono da conta, acesso irrestrito às parametrizações)',
            'Administradores e Líderes de PCP / Engenharia / Qualidade',
            'Operadores de chão de fábrica e apontadores de máquinas',
            'Matriz de permissões (leitura, escrita, edição e restrição financeira)'
        ],
        skippedWarning: 'Sem colaboradores cadastrados, os operadores não conseguem logar no tablet para apontar ordens e o PCP não tem responsáveis.',
        impact: 'Define quem pode criar pedidos, apontar horas, alterar roteiros ou liberar romaneios e faturamento.'
    },
    {
        id: 'cadastros_basicos',
        phaseId: 1,
        phase: 'Fase 1: Fundação & Governança',
        phaseBadge: 'Fundação',
        phaseColor: 'from-blue-600 to-cyan-600',
        borderColor: 'border-sky-500/40 hover:border-sky-400',
        badgeBg: 'bg-sky-100 text-sky-800 border-sky-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950/40',
        stepNum: '03',
        title: 'Cadastros Básicos (Almoxarifados, Unidades & Prefixos)',
        icon: Database,
        route: '/cadastros/basicos',
        actionLabel: 'Parametrizar Cadastros Básicos',
        tables: ['app_cad_armazens', 'app_cad_unidades_medida', 'app_cad_tipos_produto', 'app_cad_prefixos'],
        owner: 'PCP / Controladoria / Almoxarife',
        inputs: ['Unidades (KG, UN, M², MT)', 'Locais de Estoque', 'Tipos (PA, PI, MP)', 'Prefixos de Família'],
        outputs: ['Padrão de Engenharia', 'Armazéns Contábeis de Almoxarifado', 'Regras de Codificação Inteligente'],
        summary: 'Tabelas fundamentais de parametrização para classificação de materiais, unidades de engenharia e estoques.',
        prereq: 'Empresa e Colaboradores (Passos 01 e 02)',
        items: [
            'Unidades de Medida (KG, UN, MT, M², LT, PAR)',
            'Tipos de Produto (PA - Produto Acabado, PI - Intermediário, MP - Matéria-prima)',
            'Armazéns e Locais de Estoque (Almoxarifado Central, Chapas, Expedição)',
            'Prefixos e Famílias de Produtos para codificação inteligente'
        ],
        skippedWarning: 'Materiais e produtos não poderão ser criados sem unidade de medida ou armazém de estoque válido.',
        impact: 'Padroniza todas as conversões de engenharia e os movimentos contábeis de estoque do ERP.'
    },
    {
        id: 'recursos',
        phaseId: 2,
        phase: 'Fase 2: Engenharia Fabril & Recursos',
        phaseBadge: 'Engenharia',
        phaseColor: 'from-emerald-600 to-teal-600',
        borderColor: 'border-emerald-500/40 hover:border-emerald-400',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950/40',
        stepNum: '04',
        title: 'Setores Fabris & Recursos (Máquinas)',
        icon: Cpu,
        route: '/pcp/recursos',
        actionLabel: 'Cadastrar Máquinas & Recursos',
        secondaryRoute: '/pcp/setores',
        secondaryLabel: 'Setores Fabris',
        tables: ['pcp_setores', 'pcp_recursos', 'pcp_setor_recursos', 'app_recursos_capacidade'],
        owner: 'Gerente Industrial / Engenharia de Produção',
        inputs: ['Setores Físicos (Corte, Dobra, Solda)', 'Máquinas CNC / Bancadas', 'Horas Disponíveis/Dia', 'Custo Máquina/Hora'],
        outputs: ['Parque Fabril Cadastrado', 'Capacidade Instalada Horas/Mês', 'Centros de Trabalho para Roteiro'],
        summary: 'Mapeamento do parque fabril: máquinas, bancadas de trabalho e linhas de montagem disponíveis.',
        prereq: 'Cadastros Básicos (Passo 03)',
        items: [
            'Setores Fabris (Corte, Dobra, Caldeiraria, Solda, Usinagem, Pintura, Montagem)',
            'Máquinas de Corte (Laser Fibra, Plasma HD, Oxicorte, Serras)',
            'Prensas Dobradeiras CNC e Calandras com capacidade de tonelagem',
            'Postos de Soldagem e Centros de Usinagem CNC',
            'Capacidade nominal em horas/dia e custo/hora de cada recurso'
        ],
        skippedWarning: 'As ordens de produção não poderão ser alocadas em Carga Máquina. O cálculo de ocupação e o Gantt ficarão vazios.',
        impact: 'Alimenta o algoritmo de Carga Máquina e Sequenciamento do PCP (Gargalos, Ocupação e S&OP).'
    },
    {
        id: 'materiais',
        phaseId: 2,
        phase: 'Fase 2: Engenharia Fabril & Recursos',
        phaseBadge: 'Engenharia',
        phaseColor: 'from-emerald-600 to-teal-600',
        borderColor: 'border-teal-500/40 hover:border-teal-400',
        badgeBg: 'bg-teal-100 text-teal-800 border-teal-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950/40',
        stepNum: '05',
        title: 'Catálogo de Matérias-Primas & Insumos',
        icon: Package,
        route: '/saldo-materiais',
        actionLabel: 'Estoque & Saldos de Materiais',
        tables: ['material', 'sb1010', 'sb2010', 'erp_estoque_saldos'],
        owner: 'Compras / Almoxarifado Central',
        inputs: ['Especificação da Matéria-Prima', 'Dimensões (Espessura x Largura x Comprimento)', 'Estoque Mínimo', 'Custo Unitário'],
        outputs: ['Saldo Físico em Estoque', 'Disponibilidade para Empenho', 'Ponto de Pedido de Compras'],
        summary: 'Cadastro dos insumos essenciais que serão consumidos ou transformados no processo produtivo.',
        prereq: 'Unidades de Medida e Armazéns (Passo 03)',
        items: [
            'Chapas metálicas (Aço Carbono SAE 1020, ASTM A36, Inox 304, Alumínio)',
            'Perfis laminados, cantoneiras, vigas I/U e tubos industriais',
            'Fixadores, parafusos, arruelas, porcas e consumíveis de solda',
            'Tintas, solventes, vedantes e componentes comerciais comprados',
            'Estoque mínimo, armazém de estocagem e custo médio unitário'
        ],
        skippedWarning: 'A lista de materiais (BOM) não poderá ser montada porque não haverá matérias-primas cadastradas para compor as peças.',
        impact: 'Permite o empenho automático de estoque e a lista de corte/compra nas Ordens de Produção.'
    },
    {
        id: 'produtos_bom',
        phaseId: 2,
        phase: 'Fase 2: Engenharia Fabril & Recursos',
        phaseBadge: 'Engenharia',
        phaseColor: 'from-emerald-600 to-teal-600',
        borderColor: 'border-amber-500/40 hover:border-amber-400',
        badgeBg: 'bg-amber-100 text-amber-800 border-amber-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/40',
        stepNum: '06',
        title: 'Produtos & Árvore de Estrutura (BOM)',
        icon: Layers,
        route: '/erp/produtos',
        actionLabel: 'Cadastrar Produtos & Engenharia',
        secondaryRoute: '/bom-generator',
        secondaryLabel: 'Gerador de BOM Multinível',
        tables: ['erp_produtos', 'erp_estruturas_bom', 'produto_estrutura_item', 'sg1010'],
        owner: 'Engenheiro de Produto / Projetista CAD',
        inputs: ['Código do Produto Acabado', 'Desenho 2D/3D', 'Subconjuntos Soldados', 'Lista de Componentes Filhos'],
        outputs: ['Árvore de Produto Multinível (BOM)', 'Consumo Unitário por Componente', 'Fator de Aparas/Perdas'],
        summary: 'Engenharia do produto. Define os subconjuntos e a lista exata de materiais necessários para montar o produto final.',
        prereq: 'Matérias-primas e componentes cadastrados (Passo 05)',
        items: [
            'Produto Acabado (Código do item comercializado, peso e descrição)',
            'Subconjuntos soldados e peças semi-acabadas (níveis intermediários)',
            'Árvore Multinível (BOM): relacionamento PAI ➡️ FILHO',
            'Coeficiente de consumo e fator de perda por componente'
        ],
        skippedWarning: 'Ao lançar um pedido comercial, o sistema não saberá do que o produto é feito, impedindo a geração automática de OPs intermediárias.',
        impact: 'Ao lançar um pedido, o sistema "explode" a árvore de produto calculando toda a matéria-prima requerida.'
    },
    {
        id: 'roteiros',
        phaseId: 2,
        phase: 'Fase 2: Engenharia Fabril & Recursos',
        phaseBadge: 'Engenharia',
        phaseColor: 'from-emerald-600 to-teal-600',
        borderColor: 'border-orange-500/40 hover:border-orange-400',
        badgeBg: 'bg-orange-100 text-orange-800 border-orange-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950/40',
        stepNum: '07',
        title: 'Roteiros de Fabricação (Routing & Operações)',
        icon: GitBranch,
        route: '/pcp/planejamento-estrutura-routing',
        actionLabel: 'Roteiro & Sequência de Operações',
        secondaryRoute: '/pcp/fila-dependencias',
        secondaryLabel: 'Fila & Dependências Técnicas',
        tables: ['erp_roteiros_operacoes', 'processofabricacao', 'material_processo', 'sg2010'],
        owner: 'Engenharia de Processos / Métodos',
        inputs: ['Sequência Operacional (010, 020, 030)', 'Máquina Alocada', 'Tempo Setup Padrão', 'Tempo Unitário de Ciclo'],
        outputs: ['Ficha de Processo Fabril', 'Ordem de Fila por Máquina', 'Tempos Padrão de Fabricação'],
        summary: 'Sequência cronológica de operações que cada peça e conjunto deve percorrer no parque de máquinas.',
        prereq: 'Recursos fabris (Passo 04) e Produtos cadastrados (Passo 06)',
        items: [
            'Operações sequenciais (Ex: 010-Corte Laser ➡️ 020-Dobra ➡️ 030-Solda ➡️ 040-Pintura ➡️ 050-Montagem)',
            'Vínculo de cada operação ao Recurso/Máquina responsável',
            'Tempo padrão de Setup (preparação) e Tempo de Operação unitário',
            'Instruções técnicas de processo e desenhos técnicos vinculados'
        ],
        skippedWarning: 'As peças não terão rota fabril. O chão de fábrica não saberá qual máquina executa o trabalho e o tablet não terá operações para apontar.',
        impact: 'Determina a ordem exata de execução nas filas das máquinas e o cálculo de tempos de fabricação.'
    },
    {
        id: 'pedidos',
        phaseId: 3,
        phase: 'Fase 3: Demanda & Planejamento (PCP)',
        phaseBadge: 'Demanda & PCP',
        phaseColor: 'from-amber-600 to-orange-600',
        borderColor: 'border-blue-500/40 hover:border-blue-400',
        badgeBg: 'bg-blue-100 text-blue-800 border-blue-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950/40',
        stepNum: '08',
        title: 'Clientes & Carteira de Pedidos de Venda',
        icon: FileText,
        route: '/erp/pedidos',
        actionLabel: 'Carteira de Pedidos de Venda',
        secondaryRoute: '/erp/clientes',
        secondaryLabel: 'Cadastro de Clientes',
        tables: ['erp_clientes', 'erp_pedidos_venda', 'erp_pedidos_itens', 'sc5010', 'sc6010'],
        owner: 'Comercial / Vendas / Atendimento',
        inputs: ['Cliente (CNPJ / Local Entrega)', 'Itens Contratados', 'Preço Unitário Acordado', 'Data Prometida (Lead Time)'],
        outputs: ['Pedido de Venda Liberado', 'Necessidade de Fabricação Disparada', 'Controle de Saldo Comercial'],
        summary: 'Entrada da demanda real do cliente com os itens contratados, quantidades e datas limites de entrega.',
        prereq: 'Cadastro de Clientes e Produtos Acabados (Passo 06)',
        items: [
            'Dados do Cliente (Razão Social, CNPJ, Local de Entrega)',
            'Itens do Pedido, quantidades contratadas e preço acordado',
            'Data prometida de entrega (Lead Time comercial)',
            'Liberação comercial para planejamento fabril'
        ],
        impact: 'Dispara a necessidade de produção no PCP para cumprimento das datas de entrega contratadas.'
    },
    {
        id: 'pcp_ops',
        phaseId: 3,
        phase: 'Fase 3: Demanda & Planejamento (PCP)',
        phaseBadge: 'Demanda & PCP',
        phaseColor: 'from-amber-600 to-orange-600',
        borderColor: 'border-indigo-500/40 hover:border-indigo-400',
        badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950/40',
        stepNum: '09',
        title: 'PCP: Geração de OPs, Carga Máquina & Gantt',
        icon: Calendar,
        route: '/erp/producao',
        actionLabel: 'Painel de Ordens de Produção (OPs)',
        secondaryRoute: '/planejamento-gantt',
        secondaryLabel: 'Cronograma Gantt & Ocupação',
        tables: ['erp_ordens_producao', 'erp_ordens_producao_operacoes', 'sc2010', 'app_production_planning'],
        owner: 'Planejador PCP / Programador de Produção',
        inputs: ['Pedido de Venda', 'Árvore BOM Explodida', 'Roteiro Operacional', 'Capacidade Diária das Máquinas'],
        outputs: ['OPs Emitidas com Código de Barras / QR', 'Empenho Automático de Chapas', 'Fila Sequenciada no Gantt', 'Carga Máquina Balanceada'],
        summary: 'Planejamento e controle. Transforma pedidos em Ordens de Produção (OPs) e aloca nos recursos sem sobrecarga.',
        prereq: 'Pedidos de venda liberados, BOM e Roteiros ativos (Passos 06, 07 e 08)',
        items: [
            'Explosão das OPs por lote ou por pedido',
            'Cálculo de empenho automático de chapas e componentes',
            'Sequenciamento e balanceamento nas máquinas (Gantt & Carga Máquina)',
            'Emissão de Pré-Etiquetas com Código de Barras / QR Code'
        ],
        skippedWarning: 'Sem OPs geradas, o chão de fábrica não tem autorização para produzir e não há o que apontar nos terminais.',
        impact: 'Organiza a fila de trabalho de cada máquina garantindo a máxima produtividade e zero ociosidade.'
    },
    {
        id: 'chao_fabrica',
        phaseId: 4,
        phase: 'Fase 4: Chão de Fábrica (MES) & Qualidade',
        phaseBadge: 'Chão de Fábrica',
        phaseColor: 'from-slate-700 to-slate-900',
        borderColor: 'border-emerald-500/40 hover:border-emerald-400',
        badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950/40',
        stepNum: '10',
        title: 'Execução: Apontamento no Chão de Fábrica (MES) & Qualidade',
        icon: Factory,
        route: '/pcp/apontamento-vertical',
        actionLabel: 'Terminal de Apontamento Vertical',
        secondaryRoute: '/sgq/gestao-rncs',
        secondaryLabel: 'Gestão da Qualidade & RNCs',
        tables: ['ordemservicoitem', 'pcp_programas_execucoes', 'app_sgq_rncs'],
        owner: 'Operador de Máquina / Inspetor SGQ / Líder Fabril',
        inputs: ['OP Impressa / QR Code', 'Identificação do Operador', 'Leitura da Operação no Tablet'],
        outputs: ['Horas Reais Trabalhadas (Setup/Ciclo)', 'Peças Boas Produzidas', 'Refugos / Sucatas Registradas', 'Laudo Dimensional Aprovado'],
        summary: 'Registro em tempo real do avanço das peças em cada posto fabril através de tablets ou leitores industriais.',
        prereq: 'OPs liberadas para produção (Passo 09)',
        items: [
            'Início, pausas (setup, manutenção, almoço) e término por operador',
            'Registro de peças boas produzidas e perdas/refugos',
            'Inspeção da Qualidade (SGQ) com liberação dimensional e ensaios',
            'Controle de Não Conformidades (RNC) quando houver desvios'
        ],
        skippedWarning: 'Sem apontamentos, o sistema não sabe o que está pronto, gerando estoque fantasma e impossibilitando a expedição.',
        impact: 'Permite o rastreamento em tempo real do status físico de cada peça e o cálculo de eficiência (OEE).'
    },
    {
        id: 'expedicao_fat',
        phaseId: 5,
        phase: 'Fase 5: Expedição, Romaneio & NF-e',
        phaseBadge: 'Expedição & NF-e',
        phaseColor: 'from-slate-700 to-slate-900',
        borderColor: 'border-green-500/40 hover:border-green-400',
        badgeBg: 'bg-green-100 text-green-800 border-green-200',
        cardBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-green-950/40',
        stepNum: '11',
        title: 'Romaneio de Carga, Expedição & Faturamento (NF-e)',
        icon: Truck,
        route: '/romaneios',
        actionLabel: 'Módulo de Romaneios de Carga',
        secondaryRoute: '/comercial/faturamento',
        secondaryLabel: 'Auditoria de Faturamento & NF-e',
        tables: ['app_romaneios', 'app_romaneio_items', 'app_faturamento_solicitacoes', 'sf2010'],
        owner: 'Expedição / Faturamento / Fiscal',
        inputs: ['Peças Inspecionadas e Prontas', 'Dados do Veículo / Placa Transportadora', 'Pedido de Venda Original'],
        outputs: ['Romaneio de Carga Conferido', 'Etiquetas de Volume', 'Solicitação de Faturamento', 'Nota Fiscal Eletrônica (NF-e)'],
        summary: 'Fechamento do ciclo industrial: agrupamento das peças prontas, carregamento do caminhão e emissão da NF-e.',
        prereq: 'Ordens finalizadas e inspecionadas pela Qualidade (Passo 10)',
        items: [
            'Conferência física dos volumes e etiquetagem de expedição',
            'Geração do Romaneio de Carga e manifesto de transporte',
            'Abertura da Solicitação de Faturamento com vínculo ao Pedido',
            'Emissão da Nota Fiscal Eletrônica (NF-e) e auditoria de faturamento'
        ],
        skippedWarning: 'Sem romaneio e faturamento, o produto físico sai sem controle legal e o financeiro não recebe a receita.',
        impact: 'Garante que nenhuma carga saia sem nota e atualiza o saldo do cliente e o fechamento financeiro.'
    }
];

export default function FluxogramaProcessoTab() {
    const navigate = useNavigate();
    const [selectedStep, setSelectedStep] = useState(FLUXO_STEPS[0]);
    const [viewMode, setViewMode] = useState('diagram'); // 'diagram' | 'interactive_tree' | 'reality_matrix'
    const [filterPhase, setFilterPhase] = useState('all'); // 'all' | 1 | 2 | 3 | 4 | 5
    const [searchFilter, setSearchFilter] = useState('');
    const [drawerStep, setDrawerStep] = useState(null); // Step inspecionado no drawer lateral

    // Filtrar passos dinamicamente
    const filteredSteps = useMemo(() => {
        return FLUXO_STEPS.filter(step => {
            const matchesPhase = filterPhase === 'all' || step.phaseId === Number(filterPhase);
            const matchesSearch = !searchFilter.trim() || 
                step.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
                step.route.toLowerCase().includes(searchFilter.toLowerCase()) ||
                step.summary.toLowerCase().includes(searchFilter.toLowerCase()) ||
                step.tables.some(t => t.toLowerCase().includes(searchFilter.toLowerCase())) ||
                step.inputs.some(i => i.toLowerCase().includes(searchFilter.toLowerCase())) ||
                step.outputs.some(o => o.toLowerCase().includes(searchFilter.toLowerCase()));
            return matchesPhase && matchesSearch;
        });
    }, [filterPhase, searchFilter]);

    // Executar navegação direta para a tela do sistema
    const handleNavigate = (route) => {
        navigate(route);
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* ── BANNER PRINCIPAL DO FLUXOGRAMA ── */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl border border-slate-700/60 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black uppercase tracking-wider mb-3 border border-amber-500/30">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            A Verdade do Processo Fabril SINCO
                        </div>
                        <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
                            Fluxograma Operacional Dinâmico & Interativo
                        </h2>
                        <p className="text-slate-300 text-sm md:text-base mt-2 leading-relaxed">
                            Mapeamento real e navegável: cada caixinha abaixo representa o processo exato executado no sistema. 
                            <strong> Clique em qualquer etapa para ir direto para a página correspondente</strong> ou inspecionar suas entradas, saídas e tabelas SQL.
                        </p>
                    </div>

                    {/* Botões de visualização */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            id="view-btn-diagram"
                            onClick={() => setViewMode('diagram')}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                viewMode === 'diagram'
                                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 ring-2 ring-amber-400 font-black'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                            }`}
                        >
                            <GitBranch className="w-4 h-4" />
                            Diagrama Dinâmico
                        </button>

                        <button
                            id="view-btn-interactive_tree"
                            onClick={() => setViewMode('interactive_tree')}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                viewMode === 'interactive_tree'
                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400 font-black'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                            }`}
                        >
                            <ListOrdered className="w-4 h-4" />
                            Árvore do Processo Real
                        </button>

                        <button
                            id="view-btn-reality_matrix"
                            onClick={() => setViewMode('reality_matrix')}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                                viewMode === 'reality_matrix'
                                    ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30 ring-2 ring-cyan-400 font-black'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                            }`}
                        >
                            <AlertTriangle className="w-4 h-4" />
                            Matriz de Dependências
                        </button>
                    </div>
                </div>
            </div>

            {/* ── MODO 1: DIAGRAMA VISUAL DINÂMICO & INTERATIVO (CANVAS NAVEGÁVEL) ── */}
            {viewMode === 'diagram' && (
                <div className="space-y-6">
                    {/* Barra de Ferramentas / Filtros do Fluxograma */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                        {/* Filtros de Fase */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-black uppercase text-slate-500 mr-2 flex items-center gap-1">
                                <Filter className="w-3.5 h-3.5 text-slate-400" />
                                Filtrar Fase:
                            </span>
                            {[
                                { id: 'all', label: 'Todas (11 Etapas)' },
                                { id: '1', label: 'Fase 1: Fundação' },
                                { id: '2', label: 'Fase 2: Engenharia' },
                                { id: '3', label: 'Fase 3: PCP' },
                                { id: '4', label: 'Fase 4: Fábrica MES' },
                                { id: '5', label: 'Fase 5: Expedição' },
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    onClick={() => setFilterPhase(btn.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                                        filterPhase === btn.id
                                            ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-800'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>

                        {/* Busca Rápida no Fluxo */}
                        <div className="relative w-full md:w-72">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Buscar no processo (ex: Laser, BOM, OP)..."
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    {/* Dica de Navegação Rápida */}
                    <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-950 font-medium">
                        <div className="flex items-center gap-2.5">
                            <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span>
                                <strong>Dica de Navegação:</strong> Cada caixinha é um nó interativo real. Clique no botão <strong>"Ir para Tela ➔"</strong> para abrir a página funcional do sistema no seu navegador.
                            </span>
                        </div>
                        <span className="hidden sm:inline-block bg-amber-200/60 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase text-amber-900">
                            100% Rotas Reais
                        </span>
                    </div>

                    {/* ── CANVAS DO FLUXO: PIPELINE DE ETAPAS INTERLIGADAS ── */}
                    <div className="space-y-4">
                        {filteredSteps.map((step, idx) => {
                            const IconComponent = step.icon;
                            const isLast = idx === filteredSteps.length - 1;

                            return (
                                <React.Fragment key={step.id}>
                                    <div 
                                        className={`rounded-2xl p-5 md:p-6 shadow-md border transition-all duration-200 relative overflow-hidden group hover:shadow-xl bg-white ${step.borderColor}`}
                                    >
                                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                                            {/* Bloco 1: Número, Ícone & Identificação */}
                                            <div className="flex items-start gap-4 max-w-xl">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-105 transition-transform border border-slate-700">
                                                    <IconComponent className="w-6 h-6 text-amber-400" />
                                                </div>

                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-950 text-white text-[11px] font-black tracking-wider uppercase">
                                                            Passo {step.stepNum}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${step.badgeBg}`}>
                                                            {step.phaseBadge}
                                                        </span>
                                                        <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                                                            <Users className="w-3 h-3 text-slate-400" />
                                                            {step.owner}
                                                        </span>
                                                    </div>

                                                    <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors">
                                                        {step.title}
                                                    </h3>
                                                    <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                                                        {step.summary}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Bloco 2: Entradas, Saídas & Tabelas */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto lg:min-w-[420px] bg-slate-50/80 p-3.5 rounded-xl border border-slate-100">
                                                {/* Entradas ➔ Saídas */}
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                                        Entradas ➔ Saídas
                                                    </span>
                                                    <div className="text-xs text-slate-700 space-y-0.5">
                                                        <div className="truncate font-medium text-slate-600">
                                                            <strong className="text-slate-800">In:</strong> {step.inputs.slice(0, 2).join(', ')}
                                                        </div>
                                                        <div className="truncate font-semibold text-emerald-700">
                                                            <strong>Out:</strong> {step.outputs.slice(0, 2).join(', ')}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Rota & Tabelas SQL */}
                                                <div>
                                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                                        Banco & Rota
                                                    </span>
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-mono text-[10px] font-bold border border-blue-200">
                                                            {step.route}
                                                        </span>
                                                    </div>
                                                    <div className="text-[10px] font-mono text-slate-500 mt-1 truncate">
                                                        Tabelas: {step.tables.slice(0, 2).join(', ')}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bloco 3: Botões de Ação Direta */}
                                            <div className="flex flex-row lg:flex-col items-center gap-2 w-full lg:w-auto flex-shrink-0">
                                                <button
                                                    onClick={() => handleNavigate(step.route)}
                                                    className="w-full lg:w-44 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-blue-600 text-white text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md transform active:scale-95 group/btn"
                                                    title={`Ir direto para a tela ${step.route}`}
                                                >
                                                    <span>Ir para Tela</span>
                                                    <ArrowRight className="w-3.5 h-3.5 text-amber-400 group-hover/btn:translate-x-1 transition-transform" />
                                                </button>

                                                <button
                                                    onClick={() => setDrawerStep(step)}
                                                    className="w-full lg:w-44 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                                                >
                                                    <Info className="w-3.5 h-3.5 text-slate-500" />
                                                    <span>Ver Detalhes</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Conector Visual de Fluxo (Seta Vertical com Pulso) */}
                                    {!isLast && (
                                        <div className="flex items-center justify-center my-1 py-1">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <div className="w-0.5 h-4 bg-gradient-to-b from-slate-400 to-amber-500"></div>
                                                <div className="w-6 h-6 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center shadow-xs border border-slate-700">
                                                    <ArrowDown className="w-3 h-3 animate-bounce" />
                                                </div>
                                                <div className="w-0.5 h-4 bg-gradient-to-b from-amber-500 to-slate-400"></div>
                                            </div>
                                        </div>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── MODO 2: ÁRVORE DO PROCESSO REAL (DETALHADA) ── */}
            {viewMode === 'interactive_tree' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Lista Vertical dos Passos */}
                    <div className="lg:col-span-5 space-y-2.5">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                Sequência Real do SINCO ERP
                            </span>
                            <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                11 Etapas Interligadas
                            </span>
                        </div>

                        {FLUXO_STEPS.map((step) => {
                            const isSelected = selectedStep.id === step.id;
                            const IconComponent = step.icon;
                            return (
                                <div
                                    key={step.id}
                                    onClick={() => setSelectedStep(step)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500'
                                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                                            isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-700'
                                        }`}>
                                            {step.stepNum}
                                        </span>
                                        <div className="text-left">
                                            <h4 className="font-bold text-sm leading-tight">{step.title}</h4>
                                            <span className={`text-[11px] block mt-0.5 ${
                                                isSelected ? 'text-slate-300' : 'text-slate-500'
                                            }`}>
                                                {step.phaseBadge} · {step.route}
                                            </span>
                                        </div>
                                    </div>
                                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${
                                        isSelected ? 'text-amber-400' : 'text-slate-400'
                                    }`} />
                                </div>
                            );
                        })}
                    </div>

                    {/* Detalhes do Passo Selecionado */}
                    <div className="lg:col-span-7 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 flex flex-col justify-between">
                        <div className="space-y-6">
                            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
                                <div>
                                    <span className="text-xs font-black uppercase tracking-wider text-blue-600 block mb-1">
                                        {selectedStep.phase}
                                    </span>
                                    <h3 className="text-2xl font-black text-slate-900">
                                        {selectedStep.title}
                                    </h3>
                                    <p className="text-slate-600 text-sm mt-2 leading-relaxed">
                                        {selectedStep.summary}
                                    </p>
                                </div>
                            </div>

                            {/* Entradas & Saídas */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <span className="text-xs font-black uppercase text-slate-500 tracking-wider block mb-2">
                                        Entradas Necessárias
                                    </span>
                                    <ul className="space-y-1.5 text-xs text-slate-700">
                                        {selectedStep.inputs.map((inp, idx) => (
                                            <li key={idx} className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                                <span>{inp}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                                    <span className="text-xs font-black uppercase text-emerald-800 tracking-wider block mb-2">
                                        Saídas & Resultados Gerados
                                    </span>
                                    <ul className="space-y-1.5 text-xs text-emerald-900">
                                        {selectedStep.outputs.map((out, idx) => (
                                            <li key={idx} className="flex items-center gap-2">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                <span className="font-semibold">{out}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>

                            {/* O que é cadastrado */}
                            <div>
                                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">
                                    Itens Cadastrados & Parâmetros
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {selectedStep.items.map((it, idx) => (
                                        <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-start gap-2.5 text-xs text-slate-700">
                                            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                            <span>{it}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            )}

            {/* ── MODO 3: MATRIZ DE DEPENDÊNCIAS & IMPACTO ── */}
            {viewMode === 'reality_matrix' && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                    <div>
                        <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Matriz de Dependências & Causa e Efeito
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">
                            A verdade operacional: o que acontece no sistema se você tentar criar uma etapa sem a anterior estar pronta.
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider font-black">
                                    <th className="py-3 px-4">Passo</th>
                                    <th className="py-3 px-4">Etapa</th>
                                    <th className="py-3 px-4">Pré-requisito Obrigatório</th>
                                    <th className="py-3 px-4">Se for ignorado (Falha Operacional)</th>
                                    <th className="py-3 px-4">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {FLUXO_STEPS.map(step => (
                                    <tr key={step.id} className="hover:bg-slate-50 transition">
                                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                            #{step.stepNum}
                                        </td>
                                        <td className="py-3 px-4 font-bold text-slate-800">
                                            {step.title}
                                            <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                                {step.route}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600">
                                            {step.prereq}
                                        </td>
                                        <td className="py-3 px-4 text-rose-700 font-medium">
                                            {step.skippedWarning}
                                        </td>
                                        <td className="py-3 px-4">
                                            <button
                                                onClick={() => handleNavigate(step.route)}
                                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-blue-600 text-white font-bold text-[11px] transition flex items-center gap-1"
                                            >
                                                <span>Abrir</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── DRAWER LATERAL DE DETALHES TÉCNICOS DA ETAPA ── */}
            {drawerStep && (
                <div className="fixed inset-0 z-[999] flex justify-end bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
                    <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 sm:p-8 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200">
                        <div className="space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-lg bg-slate-900 text-amber-400 flex items-center justify-center font-black text-xs">
                                        {drawerStep.stepNum}
                                    </span>
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-blue-600 block">
                                            {drawerStep.phaseBadge}
                                        </span>
                                        <h3 className="text-lg font-black text-slate-900">{drawerStep.title}</h3>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setDrawerStep(null)}
                                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <p className="text-sm text-slate-600 leading-relaxed">
                                {drawerStep.summary}
                            </p>

                            {/* Informações detalhadas */}
                            <div className="space-y-3">
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                                    <span className="text-[11px] font-black uppercase text-slate-500 block mb-1">
                                        Responsável / Operador
                                    </span>
                                    <span className="text-xs font-bold text-slate-800">{drawerStep.owner}</span>
                                </div>

                                <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200">
                                    <span className="text-[11px] font-black uppercase text-blue-800 block mb-1">
                                        Entradas Necessárias (Input)
                                    </span>
                                    <ul className="text-xs text-blue-900 space-y-1">
                                        {drawerStep.inputs.map((inp, i) => (
                                            <li key={i} className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                <span>{inp}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200">
                                    <span className="text-[11px] font-black uppercase text-emerald-800 block mb-1">
                                        Saídas & Entregáveis (Output)
                                    </span>
                                    <ul className="text-xs text-emerald-900 space-y-1">
                                        {drawerStep.outputs.map((out, i) => (
                                            <li key={i} className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                <span className="font-semibold">{out}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900">
                                    <span className="font-bold block mb-1 text-rose-950 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                        Impacto se For Ignorado:
                                    </span>
                                    <p className="leading-relaxed text-rose-800">
                                        {drawerStep.skippedWarning}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Botão de Ação no Drawer */}
                        <div className="pt-6 border-t border-slate-100 flex items-center gap-3">
                            <button
                                onClick={() => {
                                    setDrawerStep(null);
                                    handleNavigate(drawerStep.route);
                                }}
                                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md transition"
                            >
                                <span>Abrir Tela {drawerStep.route}</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setDrawerStep(null)}
                                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
