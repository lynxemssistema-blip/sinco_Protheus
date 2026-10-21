import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
    Package, 
    Building2, 
    Menu as MenuIcon, 
    Send, 
    Bot, 
    ShieldAlert, 
    Search, 
    Check, 
    Save, 
    Sparkles, 
    ShieldCheck, 
    Layers,
    Sliders,
    Cpu,
    Clock,
    Calendar,
    Users,
    Tag,
    Award,
    Wrench,
    ShoppingCart,
    Database,
    Truck,
    Box,
    CheckSquare,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import api, { getCompanySettings, updateGeneralSettings, updateMenuSettings } from '../../services/api';
import { MENU_GROUPS } from '../../config/menuItems';
import SuperadminEmpresas from './SuperadminEmpresas';
import WinSCPTab from '../../components/WinSCPTab';
import LynxConfigTab from '../../components/LynxConfigTab';

const MODULE_CATEGORIES = [
    { id: 'ALL', label: 'Todos os Módulos' },
    { id: 'Produção & Fábrica', label: 'Produção & Fábrica' },
    { id: 'Engenharia & Modelagem', label: 'Engenharia & Modelagem' },
    { id: 'Qualidade & SGQ', label: 'Qualidade & SGQ' },
    { id: 'Manutenção', label: 'Manutenção' },
    { id: 'Comercial & ERP', label: 'Comercial & ERP' },
    { id: 'Logística', label: 'Logística' },
    { id: 'Gente & Segurança', label: 'Gente & Segurança' },
    { id: 'Acessos & Corporativo', label: 'Acessos & Corporativo' }
];

const SYSTEM_MODULES = [
    // 1. Produção & Fábrica
    {
        id: 'pcp',
        key: 'module_pcp_active',
        name: 'PCP Geral & Produção',
        category: 'Produção & Fábrica',
        description: 'Visão global da fábrica, controle de ordens de produção, apontamentos, matriz de produção, fila de dependências e relatórios fabris.',
        icon: FactoryIcon,
        defaultActive: true,
        menuGroupId: 'pcp',
        badge: 'Chão de Fábrica'
    },
    {
        id: 'pcp_refinado',
        key: 'module_pcp_refinado_active',
        name: 'PCP Refinado & Capacidade (CRP)',
        category: 'Produção & Fábrica',
        description: 'Gestão avançada de tempos padrão por máquina, cálculo de capacidade diária (CRP) e análise visual da taxa de ocupação dos recursos.',
        icon: Layers,
        defaultActive: false,
        menuGroupId: 'pcp_refinado',
        badge: 'Planejamento Avançado'
    },

    // 2. Engenharia & Modelagem
    {
        id: 'engenharia',
        key: 'module_engenharia_active',
        name: 'Engenharia de Produto',
        category: 'Engenharia & Modelagem',
        description: 'Painel de itens técnicos, catálogo de produtos, gerador de BOM (lista de materiais), integração SolidEdge e liberação técnica.',
        icon: Cpu,
        defaultActive: true,
        menuGroupId: 'engenharia',
        badge: 'Estruturas & BOM'
    },
    {
        id: 'analise_3d',
        key: 'module_analise3d_active',
        name: 'Análise 3D',
        category: 'Engenharia & Modelagem',
        description: 'Visualizador de modelos 3D (.stl) com suporte a rotação, zoom e inspeção visual de componentes de engenharia.',
        icon: Box,
        defaultActive: false,
        menuGroupId: 'analise_3d',
        badge: 'Visualizador CAD'
    },

    // 3. Qualidade & SGQ
    {
        id: 'qualidade',
        key: 'module_sgq_active',
        name: 'Qualidade (SGQ)',
        category: 'Qualidade & SGQ',
        description: 'Gestão de ativos e calibrações, caixas de ferramentas, romaneios SGQ, RNCs, treinamentos, mapeamento de processos e PPAPs.',
        icon: Award,
        defaultActive: false,
        menuGroupId: 'qualidade',
        badge: 'ISO 9001 / SGQ',
        hasAdvancedSettings: true
    },

    // 4. Manutenção Industrial
    {
        id: 'manutencao',
        key: 'module_maintenance_active',
        name: 'Manutenção de Equipamentos',
        category: 'Manutenção',
        description: 'Gerenciamento de ordens de manutenção preventivas e corretivas, checklists diários por máquina, controle de operadores e materiais.',
        icon: Wrench,
        defaultActive: false,
        menuGroupId: 'manutencao',
        badge: 'Preventiva & Corretiva'
    },

    // 5. Comercial & ERP
    {
        id: 'comercial',
        key: 'module_comercial_active',
        name: 'Comercial & Vendas',
        category: 'Comercial & ERP',
        description: 'Pedidos de venda, itens a faturar, dashboard de faturamento, controle de atrasos, fluxo comercial e gestão gerencial de OPs.',
        icon: ShoppingCart,
        defaultActive: true,
        menuGroupId: 'comercial',
        badge: 'Faturamento'
    },
    {
        id: 'sinco_erp',
        key: 'module_erp_active',
        name: 'SINCO ERP Nativo',
        category: 'Comercial & ERP',
        description: 'Módulo nativo do sistema para gerenciamento rápido de cadastros: produtos, pedidos, clientes e ordens de produção.',
        icon: Database,
        defaultActive: true,
        menuGroupId: 'sinco_erp',
        badge: 'ERP Integrado'
    },
    {
        id: 'cadastros_basicos',
        key: 'module_cadastros_basicos_active',
        name: 'Cadastros Básicos & Hub',
        category: 'Comercial & ERP',
        description: 'Centralização de cadastros de apoio: prefixos/famílias de produtos, tipos, unidades de medida e armazéns/almoxarifados.',
        icon: Tag,
        defaultActive: true,
        menuGroupId: 'cadastros_basicos',
        badge: 'Tabelas Mestras'
    },

    // 6. Logística
    {
        id: 'logistica',
        key: 'module_logistica_active',
        name: 'Logística & Expedição',
        category: 'Logística',
        description: 'Expedição com romaneios de entrega, portal de fornecedores terceirizados, recebimento de retornos e saldos de estoque.',
        icon: Truck,
        defaultActive: true,
        menuGroupId: 'logistica',
        badge: 'Expedição'
    },

    // 7. Gente & Segurança
    {
        id: 'rh',
        key: 'module_rh_active',
        name: 'Recursos Humanos (RH 360°)',
        category: 'Gente & Segurança',
        description: 'Pasta do colaborador 360°, portal de autoatendimento, gestão de vagas, triagem de currículos com IA, offboarding e cargos/funções.',
        icon: Users,
        defaultActive: true,
        menuGroupId: 'rh',
        badge: 'Gestão de Pessoas'
    },
    {
        id: 'sst',
        key: 'module_sst_active',
        name: 'Segurança do Trabalho (SST & NR-06)',
        category: 'Gente & Segurança',
        description: 'Gestão de EPIs, controle de entregas NR-06, eleições da CIPA (NR-05), brigada de incêndio (NR-23) e gestão de cesta básica.',
        icon: ShieldCheck,
        defaultActive: true,
        menuGroupId: 'sst',
        badge: 'Normas Regulamentadoras',
        hasSstSubmodules: true
    },

    // 8. Acessos & Corporativo
    {
        id: 'portaria',
        key: 'module_portaria_active',
        name: 'Portaria & Acessos',
        category: 'Acessos & Corporativo',
        description: 'Terminal guarita para registro de entradas/saídas de veículos e visitantes, painel gerencial de fluxo e cadastro de turnos.',
        icon: Clock,
        defaultActive: true,
        menuGroupId: 'portaria',
        badge: 'Controle de Entrada'
    },
    {
        id: 'corporativo',
        key: 'module_corporativo_active',
        name: 'Salas de Reunião & Suporte TI',
        category: 'Acessos & Corporativo',
        description: 'Sistema de reserva e totem de salas de reunião, e central de chamados para suporte de tecnologia.',
        icon: Calendar,
        defaultActive: true,
        menuGroupId: 'corporativo',
        badge: 'Facilities & TI'
    }
];

function FactoryIcon(props) {
    return (
        <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/>
            <path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>
        </svg>
    );
}

export default function SuperAdminConfigPage() {
    const { isSuperAdmin } = useAuth();
    const [activeTab, setActiveTab] = useState('super_empresas');
    const [companyConfig, setCompanyConfig] = useState({});
    const [loading, setLoading] = useState(true);
    const [moduleSearch, setModuleSearch] = useState('');
    const [moduleCategoryFilter, setModuleCategoryFilter] = useState('ALL');
    const [expandedModuleSettings, setExpandedModuleSettings] = useState({});

    const tabs = [
        { id: 'super_empresas', label: 'Empresas & Assinaturas', icon: Building2 },
        { id: 'modules', label: 'Gestão de Módulos', icon: Package },
        { id: 'menu', label: 'Menu & Navegação', icon: MenuIcon },
        { id: 'winscp', label: 'Processo WinSCP', icon: Send },
        { id: 'lynx', label: 'Agente Lynx IA', icon: Bot }
    ];

    const carregarConfiguracoes = async () => {
        setLoading(true);
        try {
            const data = await getCompanySettings();
            setCompanyConfig(data || {});
        } catch (err) {
            console.error('Erro ao carregar configurações de superadmin:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperAdmin) {
            carregarConfiguracoes();
        }
    }, [isSuperAdmin]);

    if (!isSuperAdmin) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4">
                    <ShieldAlert className="w-8 h-8" />
                </div>
                <h1 className="text-2xl font-black text-slate-800 dark:text-white mb-2">
                    Acesso Restrito ao Superadministrador
                </h1>
                <p className="text-sm text-slate-500 max-w-md mb-6">
                    Esta central de configurações é de uso exclusivo da administração global da plataforma Lynx EMS.
                </p>
                <a
                    href="/visao-geral"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold hover:bg-slate-800 transition"
                >
                    Voltar ao Início
                </a>
            </div>
        );
    }

    const isModuleActive = (mod) => {
        const val = companyConfig.general_config?.[mod.key];
        if (val !== undefined && val !== null) return !!val;
        return mod.defaultActive;
    };

    const handleToggleModule = async (modKey, modName, currentActive) => {
        const newValue = !currentActive;
        const newGeneralConfig = { ...companyConfig.general_config, [modKey]: newValue };
        try {
            setLoading(true);
            await updateGeneralSettings({ general_config: newGeneralConfig });
            setCompanyConfig(prev => ({ ...prev, general_config: newGeneralConfig }));
            if (window.confirm(`Módulo "${modName}" ${newValue ? 'ativado' : 'desativado'} com sucesso!\n\nDeseja recarregar a página para aplicar a alteração no menu?`)) {
                window.location.reload();
            }
        } catch (err) {
            alert('Erro ao alterar módulo: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const handleMenuSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateMenuSettings({ menu_config: companyConfig.menu_config });
            alert('Menu atualizado com sucesso! Recarregando aplicação.');
            window.location.reload();
        } catch (err) {
            alert('Erro ao atualizar menu: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Topbar Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Sliders className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-bold tracking-tight text-white">Governança Superadmin</h1>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 tracking-wider">
                                Global SaaS
                            </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                            Central exclusiva de controle de módulos, personalização de menus, instâncias multitenant e integrações.
                        </p>
                    </div>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        Acesso Nível Raiz
                    </span>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isSelected = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                                isSelected
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-400'}`} />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* TAB CONTENT */}
            <div>
                {/* 1. EMPRESAS & ASSINATURAS */}
                {activeTab === 'super_empresas' && (
                    <SuperadminEmpresas />
                )}

                {/* 2. GESTÃO DE MÓDULOS */}
                {activeTab === 'modules' && (() => {
                    const activeModulesCount = SYSTEM_MODULES.filter(m => isModuleActive(m)).length;
                    const totalModulesCount = SYSTEM_MODULES.length;
                    const inactiveModulesCount = totalModulesCount - activeModulesCount;

                    const filteredModules = SYSTEM_MODULES.filter(mod => {
                        const matchesCategory = moduleCategoryFilter === 'ALL' || mod.category === moduleCategoryFilter;
                        const term = moduleSearch.toLowerCase().trim();
                        const matchesSearch = !term ||
                            mod.name.toLowerCase().includes(term) ||
                            mod.description.toLowerCase().includes(term) ||
                            mod.badge.toLowerCase().includes(term);
                        return matchesCategory && matchesSearch;
                    });

                    const categoriesWithModules = MODULE_CATEGORIES.filter(c => c.id !== 'ALL').map(cat => ({
                        ...cat,
                        modules: filteredModules.filter(m => m.category === cat.id)
                    })).filter(cat => cat.modules.length > 0);

                    return (
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Controle de Módulos da Plataforma</h2>
                                    <p className="text-xs text-slate-500 mt-1">
                                        Ative ou desative módulos do sistema. Módulos inativos ocultam seus menus e rotas globalmente.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                                        Total: <strong>{totalModulesCount}</strong>
                                    </div>
                                    <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                                        Ativos: <strong>{activeModulesCount}</strong>
                                    </div>
                                    {inactiveModulesCount > 0 && (
                                        <div className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
                                            Ocultos: <strong>{inactiveModulesCount}</strong>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Busca e Filtros */}
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                    <input
                                        type="text"
                                        value={moduleSearch}
                                        onChange={e => setModuleSearch(e.target.value)}
                                        placeholder="Buscar módulo por nome ou palavra-chave..."
                                        className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900 outline-none transition"
                                    />
                                </div>

                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                                    {MODULE_CATEGORIES.map(cat => (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setModuleCategoryFilter(cat.id)}
                                            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition font-medium ${
                                                moduleCategoryFilter === cat.id
                                                    ? 'bg-slate-900 text-white'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Lista de Módulos */}
                            <div className="space-y-6">
                                {categoriesWithModules.map(category => (
                                    <div key={category.id} className="space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                                                {category.label}
                                            </h3>
                                            <span className="text-xs text-slate-400 font-medium">
                                                ({category.modules.filter(m => isModuleActive(m)).length}/{category.modules.length} ativos)
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            {category.modules.map(mod => {
                                                const isActive = isModuleActive(mod);
                                                const ModIcon = mod.icon || Package;

                                                return (
                                                    <div
                                                        key={mod.id}
                                                        className={`p-4 rounded-xl border transition-all ${
                                                            isActive
                                                                ? 'bg-white border-slate-200 shadow-xs'
                                                                : 'bg-slate-50/80 border-slate-200/80'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                                                                    isActive
                                                                        ? 'bg-slate-900 text-emerald-400 border-slate-800'
                                                                        : 'bg-slate-100 text-slate-400 border-slate-200'
                                                                }`}>
                                                                    <ModIcon className="w-5 h-5" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <h4 className="font-bold text-slate-800 text-sm">
                                                                            {mod.name}
                                                                        </h4>
                                                                        {mod.badge && (
                                                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                                                {mod.badge}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">
                                                                        {mod.description}
                                                                    </p>
                                                                    <div className="mt-2 flex items-center gap-2">
                                                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                                                                            isActive
                                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                                        }`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                                            {isActive ? 'ATIVO NO SISTEMA' : 'DESATIVADO'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Toggle Switch */}
                                                            <button
                                                                type="button"
                                                                disabled={loading}
                                                                onClick={() => handleToggleModule(mod.key, mod.name, isActive)}
                                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                                                                    isActive ? 'bg-emerald-600' : 'bg-slate-300'
                                                                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                title={isActive ? `Desativar ${mod.name}` : `Ativar ${mod.name}`}
                                                            >
                                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                                                    isActive ? 'translate-x-6' : 'translate-x-1'
                                                                }`} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {/* 3. MENU & NAVEGAÇÃO */}
                {activeTab === 'menu' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-4xl space-y-6">
                        <div className="flex items-center justify-between border-b pb-4">
                            <div>
                                <h2 className="text-lg font-bold text-slate-800">Personalização Global do Menu</h2>
                                <p className="text-xs text-slate-500 mt-1">Configure quais itens de menu ficam acessíveis aos usuários.</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleMenuSubmit}
                                disabled={loading}
                                className="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 flex items-center gap-2 font-medium text-xs shadow-sm transition"
                            >
                                <Save className="w-4 h-4 text-emerald-400" />
                                {loading ? 'Salvando...' : 'Aplicar Mudanças'}
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {MENU_GROUPS.map(group => (
                                <div key={group.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">
                                        {group.label}
                                    </h3>
                                    <div className="space-y-2.5">
                                        {group.items.map(item => {
                                            const isVisible = companyConfig.menu_config?.[item.id] !== false;
                                            return (
                                                <div key={item.id} className="flex items-center justify-between text-xs">
                                                    <span className="text-slate-700 font-medium truncate pr-2">{item.label}</span>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={isVisible}
                                                            onChange={e => {
                                                                const checked = e.target.checked;
                                                                setCompanyConfig(prev => ({
                                                                    ...prev,
                                                                    menu_config: {
                                                                        ...prev.menu_config,
                                                                        [item.id]: checked
                                                                    }
                                                                }));
                                                            }}
                                                            className="sr-only peer"
                                                        />
                                                        <div className="w-8 h-4 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-emerald-600"></div>
                                                    </label>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 4. PROCESSO WINSCP */}
                {activeTab === 'winscp' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <WinSCPTab />
                    </div>
                )}

                {/* 5. AGENTE LYNX IA */}
                {activeTab === 'lynx' && (
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <LynxConfigTab />
                    </div>
                )}
            </div>
        </div>
    );
}
