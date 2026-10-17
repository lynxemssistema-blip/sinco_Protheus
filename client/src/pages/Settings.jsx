import React, { useState, useEffect, useCallback } from 'react';

import { useAuth } from '../contexts/AuthContext';

import { UserPlus, ShieldAlert, UserX, Save, Building2, Menu, Edit, X, Camera, Upload, Printer, FileText, Download, Bot, Shield, Check, ChevronDown, ChevronRight, ChevronUp, Mail, Send, Loader2, EyeOff, Users, Plus, Trash2, MessageSquare, Activity, Package, Bug, Database, Calendar, Info, Play, Factory, Wrench, Truck, ShoppingCart, Award, Clock, Layers, Cpu, Tag, CheckSquare, TrendingUp, Box, ClipboardList, Landmark, Monitor, ShieldCheck, Flame, Search, CheckCircle2, XCircle, SlidersHorizontal } from 'lucide-react';

import { createUser, getUsers, deleteUser, updateUser, bulkUpdateUserProfile, getCompanySettings, updateCompanySettings, updateMenuSettings, updateGeneralSettings, getUserPermissions, saveUserPermissions, setRomaneioInitialNumber, getRomaneioInitialNumber, sendUserCredentials, getPedidosStatusSettings, togglePedidosStatusGlobal, getPedidosStatusList, togglePedidoStatus, getProtheusFornecedores, getProtheusClientes, getSincoProcessosList } from '../services/api';

import api from '../services/api';

import { MENU_GROUPS } from '../config/menuItems';

import PCPMetalConfig from './PCPMetalConfig';


import MonitoringDashboard from '../components/MonitoringDashboard';

import DBAMonitoringTab from '../components/DBAMonitoringTab';

import ErrorListTab from '../components/ErrorListTab';

import WinSCPTab from '../components/WinSCPTab';

import LynxConfigTab from '../components/LynxConfigTab';

import LabelPrinterTab from '../components/settings/LabelPrinterTab';

import AjusteApontamentoTab from '../components/settings/AjusteApontamentoTab';

import CompanyProfileForm from '../components/settings/CompanyProfileForm';

import { applyCompanyBranding } from '../services/companyBranding';



const MODULE_CATEGORIES = [
    { id: 'ALL', label: 'Todos os Módulos' },
    { id: 'Produção & Fábrica', label: 'Produção & Fábrica' },
    { id: 'Engenharia & Modelagem', label: 'Engenharia & Modelagem' },
    { id: 'Qualidade & SGQ', label: 'Qualidade & SGQ' },
    { id: 'Manutenção', label: 'Manutenção' },
    { id: 'Comercial & ERP', label: 'Comercial & ERP' },
    { id: 'Suprimentos & Logística', label: 'Suprimentos & Logística' },
    { id: 'Financeiro', label: 'Financeiro' },
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
        icon: Factory,
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
    {
        id: 'op_fracionada',
        key: 'module_op_fracionada_active',
        name: 'OP Fracionada & Industrial',
        category: 'Produção & Fábrica',
        description: 'Liberação de PCP mescla, painel da fábrica local e apontamentos fracionados de produção por lote.',
        icon: CheckSquare,
        defaultActive: true,
        menuGroupId: 'op_fracionada',
        badge: 'Industrial'
    },
    {
        id: 'ronaldo',
        key: 'module_gestao_vista_active',
        name: 'Gestão à Vista & Analytics',
        category: 'Produção & Fábrica',
        description: 'Acompanhamento em tempo real da evolução dos apontamentos e gráficos dinâmicos de produtividade.',
        icon: TrendingUp,
        defaultActive: true,
        menuGroupId: 'ronaldo',
        badge: 'Dashboards'
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

    // 6. Suprimentos & Logística
    {
        id: 'suprimentos',
        key: 'module_suprimentos_active',
        name: 'Suprimentos & Compras',
        category: 'Suprimentos & Logística',
        description: 'Solicitações de compra, pedidos x PV de clientes, requisições internas, rastreamento SC -> NF e auditoria PC x XML.',
        icon: ClipboardList,
        defaultActive: true,
        menuGroupId: 'suprimentos',
        badge: 'Compras'
    },
    {
        id: 'logistica',
        key: 'module_logistica_active',
        name: 'Logística & Expedição',
        category: 'Suprimentos & Logística',
        description: 'Expedição com romaneios de entrega, portal de fornecedores terceirizados, recebimento de retornos e saldos de estoque.',
        icon: Truck,
        defaultActive: true,
        menuGroupId: 'logistica',
        badge: 'Expedição'
    },

    // 7. Financeiro
    {
        id: 'financeiro',
        key: 'module_financeiro_active',
        name: 'Financeiro & Controladoria',
        category: 'Financeiro',
        description: 'Acompanhamento do fluxo de caixa previsto e realizado, dashboards financeiros gerenciais e balancete dinâmico.',
        icon: Landmark,
        defaultActive: true,
        menuGroupId: 'financeiro',
        badge: 'Controladoria'
    },

    // 8. Gente & Segurança
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

    // 9. Acessos & Corporativo
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
    },
    {
        id: 'cliente',
        key: 'module_cliente_active',
        name: 'Portal do Cliente',
        category: 'Acessos & Corporativo',
        description: 'Acesso externo para clientes acompanharem o status de seus projetos e interface rápida via tablet para solicitações.',
        icon: Monitor,
        defaultActive: true,
        menuGroupId: 'cliente',
        badge: 'Acesso Externo'
    }
];

export default function Settings() {

    const { user, isAdmin, hasPermission } = useAuth();

    const canViewEtiquetas = isAdmin || hasPermission('config_etiquetas', 'view');

    const [activeTab, setActiveTab] = useState(isAdmin ? 'general' : 'etiquetas');

    const tabs = isAdmin ? [

        { id: 'general', label: 'Geral', icon: Building2 },

        { id: 'ajuste_apontamento', label: 'Ajustando o Apontamento', icon: Play },

        { id: 'orders_visibility', label: 'Visibilidade de Pedidos', icon: EyeOff },

        ...(user?.tipo === 'SA' ? [{ id: 'menu', label: 'Menu & Navegação', icon: Menu }] : []),

        { id: 'modules', label: 'Módulos', icon: Package },

        { id: 'profiles', label: 'Perfis de Acesso', icon: Users },

        { id: 'users', label: 'Usuários', icon: UserPlus },

        { id: 'pending', label: 'Aprovações Pendentes', icon: ShieldAlert },

        { id: 'permissions', label: 'Permissões', icon: Shield },


        { id: 'automations', label: 'Automações & Avisos', icon: Send },

        { id: 'ai', label: 'Inteligência Artificial', icon: Bot },

        { id: 'errors', label: 'Lista de Erros', icon: Bug },


        { id: 'notifications', label: 'Histórico de Notificações', icon: MessageSquare },

        { id: 'monitoring', label: 'Monitoramento do Sistema', icon: Activity },

        ...(user?.tipo === 'SA' ? [{ id: 'winscp', label: 'Processo WinSCP', icon: Send }] : []),

        ...(user?.tipo === 'SA' ? [{ id: 'lynx', label: 'Agente lynx', icon: Bot }] : []),

        { id: 'etiquetas', label: 'Etiquetas', icon: Printer },

    ] : canViewEtiquetas ? [

        { id: 'etiquetas', label: 'Etiquetas', icon: Printer },

    ] : [];



    const formatPhone = (val) => {

        if (!val) return '';

        const raw = val.replace(/\D/g, '');

        if (raw.length <= 2) return `(${raw}`;

        if (raw.length <= 6) return `(${raw.slice(0, 2)}) ${raw.slice(2)}`;

        if (raw.length <= 10) return `(${raw.slice(0, 2)}) ${raw.slice(2, 6)}-${raw.slice(6)}`;

        return `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;

    };



    // User Form State

    const [userForm, setUserForm] = useState({
        nome: '',
        telefone: '',
        whatsapp: '',
        login: '',
        senha: '',
        tipo: 'U',
        setor: '',
        funcao: '',
        email: '',
        observacoes: '',
        tem_pc: false,
        foto: null,
        idFornecedor: '',
        lojaFornecedor: '',
        idCliente: '',
        lojaCliente: '',
        tipoExterno: 'fornecedor',
        pedidos_autorizados: ''
    });
    const [editingUser, setEditingUser] = useState(null);
    const [profileForm, setProfileForm] = useState({ code: '', name: '', isAdmin: false, tipoPerfil: 'interno' });

    const [editingProfile, setEditingProfile] = useState(null);



    // Users List

    const [usersList, setUsersList] = useState([]);

    const [userFilter, setUserFilter] = useState('');

    const [pcFilter, setPcFilter] = useState('all');

    const [typeFilter, setTypeFilter] = useState('all');

    const [selectedUsers, setSelectedUsers] = useState(new Set());

    const [sendingCredentials, setSendingCredentials] = useState(false);
    const [bulkProfileModalOpen, setBulkProfileModalOpen] = useState(false);
    const [bulkTargetProfile, setBulkTargetProfile] = useState('U');
    const [bulkCopyPermissions, setBulkCopyPermissions] = useState(true);
    const [bulkUpdating, setBulkUpdating] = useState(false);



    const [protheusFornecedores, setProtheusFornecedores] = useState([]);
    const [protheusClientes, setProtheusClientes] = useState([]);
    
    const [processosList, setProcessosList] = useState([]);
    const [showSgqModal, setShowSgqModal] = useState(false);
    const [showProtheusInfo, setShowProtheusInfo] = useState(false);
    const [showPerdasInfo, setShowPerdasInfo] = useState(false);
    const [webhookLog, setWebhookLog] = useState([]);



    const loadUsers = async () => {

        try {

            const data = await getUsers();

            setUsersList(data);

        } catch (error) {

            console.error(error);

        }

    };



    const loadFornecedores = async () => {

        try {

            const res = await getProtheusFornecedores();

            setProtheusFornecedores(res || []);

        } catch (error) {

            console.error('Erro ao carregar fornecedores', error);

        }

    };

    const loadClientes = async () => {
        try {
            const res = await getProtheusClientes();
            setProtheusClientes(res || []);
        } catch (error) {
            console.error('Erro ao carregar clientes', error);
        }
    };



    useEffect(() => {
        if (activeTab === 'general' || activeTab === 'users' || activeTab === 'permissions' || activeTab === 'pending') {
            loadUsers();
        }
        if (activeTab === 'users' && protheusFornecedores.length === 0) {
            loadFornecedores();
        }
        if (activeTab === 'users' && protheusClientes.length === 0) {
            loadClientes();
        }
        if (activeTab === 'automations' && processosList.length === 0) {
            getSincoProcessosList().then(setProcessosList).catch(console.error);
        }
    }, [activeTab]);



    // ──── Permissions state ──────────────────────────────────────────────────────

    const [permSelectedUser, setPermSelectedUser] = useState(null);

    const [permMatrix, setPermMatrix] = useState({}); // { page_id: { can_view, can_create, can_edit, can_delete } }

    const [permLoading, setPermLoading] = useState(false);

    const [permSaving, setPermSaving] = useState(false);

    const [permExpandedGroups, setPermExpandedGroups] = useState({});



    const loadUserPermissions = async (userId) => {

        setPermLoading(true);

        try {

            const data = await getUserPermissions(userId);

            const map = {};

            if (Array.isArray(data)) {
                data.forEach(p => {
                    if (p && p.page_id) {
                        map[p.page_id] = {
                            can_view: !!p.can_view,
                            can_create: !!p.can_create,
                            can_edit: !!p.can_edit,
                            can_delete: !!p.can_delete
                        };
                    }
                });
            }

            setPermMatrix(map);

        } catch (err) {

            console.error('Erro ao carregar permissões:', err);

        } finally {

            setPermLoading(false);

        }

    };



    const handlePermUserChange = (userId) => {

        if (!userId) {

            setPermSelectedUser(null);

            setPermMatrix({});

            return;

        }



        if (userId.startsWith('PROFILE_')) {

            setPermSelectedUser(userId);

            const profileType = userId.replace('PROFILE_', '');

            const targetUsers = usersList.filter(u => u.TipoUsuario === profileType);

            

            if (targetUsers.length > 0) {

                // Load permissions from the first user of this profile as a template

                loadUserPermissions(targetUsers[0].idUsuario);

            } else {

                setPermMatrix({}); // Empty matrix if no users exist in this profile

            }

            return;

        }



        const uid = parseInt(userId);

        setPermSelectedUser(uid || null);

        if (uid) loadUserPermissions(uid);

        else setPermMatrix({});

    };



    const togglePerm = (pageId, action) => {

        setPermMatrix(prev => {

            const curr = prev[pageId] || { can_view: false, can_create: false, can_edit: false, can_delete: false };

            const updated = { ...curr, [`can_${action}`]: !curr[`can_${action}`] };

            // If toggling view OFF, also turn off all others

            if (action === 'view' && !updated.can_view) {

                updated.can_create = false;

                updated.can_edit = false;

                updated.can_delete = false;

            }

            // If toggling other ON, ensure view is also ON

            if (action !== 'view' && updated[`can_${action}`]) {

                updated.can_view = true;

            }

            return { ...prev, [pageId]: updated };

        });

    };



    const toggleGroupAll = (groupItems, enable) => {

        setPermMatrix(prev => {

            const next = { ...prev };

            groupItems.forEach(item => {

                next[item.id] = {

                    can_view: enable,

                    can_create: enable,

                    can_edit: enable,

                    can_delete: enable

                };

            });

            return next;

        });

    };



    const setAllPermissions = (enable) => {

        const next = {};

        MENU_GROUPS.forEach(g => {

            g.items.forEach(item => {

                next[item.id] = {

                    can_view: enable,

                    can_create: enable,

                    can_edit: enable,

                    can_delete: enable

                };

            });

        });

        setPermMatrix(next);

    };



    const handleSavePermissions = async () => {

        if (!permSelectedUser) return;

        setPermSaving(true);

        try {

            const permsArray = Object.entries(permMatrix)

                .filter(([_, p]) => p.can_view || p.can_create || p.can_edit || p.can_delete)

                .map(([page_id, p]) => ({ page_id, ...p }));



            if (typeof permSelectedUser === 'string' && permSelectedUser.startsWith('PROFILE_')) {

                const profileType = permSelectedUser.replace('PROFILE_', '');

                const targetUsers = usersList.filter(u => u.TipoUsuario === profileType);

                

                if (targetUsers.length === 0) {

                    alert('Nenhum usuário encontrado neste perfil para aplicar as permissões.');

                    setPermSaving(false);

                    return;

                }



                for (const user of targetUsers) {

                    await saveUserPermissions(user.idUsuario, permsArray);

                }

                alert(`Permissões salvas com sucesso para todos os ${targetUsers.length} usuários do perfil selecionado!`);

            } else {

                await saveUserPermissions(permSelectedUser, permsArray);

                alert('Permissões salvas com sucesso!');

            }

        } catch (err) {

            alert('Erro ao salvar permissões: ' + err.message);

        } finally {

            setPermSaving(false);

        }

    };



    const DEFAULT_PROFILES = [

        { code: 'A', name: 'Administrador (Total)', isAdmin: true },

        { code: 'SA', name: 'SuperAdmin', isAdmin: true },

        { code: 'U', name: 'Usuário (Padrão)', isAdmin: false },

        { code: 'C', name: 'Conferente', isAdmin: false },

        { code: 'AP', name: 'Apontador de Fábrica', isAdmin: false },

        { code: 'CLI', name: 'Cliente (Acesso Externo)', isAdmin: false }

    ];



    // Company Form State

    const [companyForm, setCompanyForm] = useState({

        razao_social: '',

        cnpj: '',

        endereco: '',

        telefone: '',

        menu_config: {}, // will hold { itemId: boolean }

        general_config: {} // kv pairs

    });



        // Custom Profiles array from general_config or default

    const customProfiles = companyForm.general_config?.custom_profiles || DEFAULT_PROFILES;

    const availableProfiles = customProfiles.filter(p => p.code !== 'SA' || user?.tipo === 'SA');



    const [loading, setLoading] = useState(false);

    const [loadingCompany, setLoadingCompany] = useState(false);

    

    // Pedidos Status State

    const [hideInactiveOrders, setHideInactiveOrders] = useState(false);

    const [inactiveOrdersList, setInactiveOrdersList] = useState([]);

    const [pedidosSearch, setPedidosSearch] = useState('');

    const [loadingPedidos, setLoadingPedidos] = useState(false);



    useEffect(() => {

        if (isAdmin) {

            loadCompany();

        }

    }, [user, isAdmin]);



    const loadCompany = async () => {

        try {

            const data = await getCompanySettings();

            // Parse JSON if needed

            let menuConfig = {};

            if (data.menu_config) {

                menuConfig = typeof data.menu_config === 'string' ? JSON.parse(data.menu_config) : data.menu_config;

            }

            // Ensure defaults if empty (everything true initially if needed, logic is handled in Sidebar too)

            // Ensure defaults if empty (everything true initially if needed, logic is handled in Sidebar too)

            // Parse General Config

            let generalConfig = {};

            if (data.general_config) {

                generalConfig = typeof data.general_config === 'string' ? JSON.parse(data.general_config) : data.general_config;

            }



            setCompanyForm({ ...data, menu_config: menuConfig, general_config: generalConfig });



            // Fetch Romaneio Number

            const romNumData = await getRomaneioInitialNumber();

            if (romNumData && romNumData.current_number) {

                setRomaneioNumberForm(romNumData.current_number);

            }



            // Load RNC numbering config

            const rncCfg = generalConfig?.sgq_rnc_config;

            if (rncCfg) {

                if (rncCfg.format) setRncFormatForm(rncCfg.format);

                if (rncCfg.next_seq) setRncNumberForm(String(rncCfg.next_seq));

            }

            

            // Fetch Pedidos Status

            loadPedidosStatus();

        } catch (err) {

            console.error(err);

        }

    };



    const loadPedidosStatus = async (search = '') => {

        try {

            setLoadingPedidos(true);

            const settings = await getPedidosStatusSettings();

            setHideInactiveOrders(settings.hideInactive === true || settings.hideInactive === 1);

            

            const list = await getPedidosStatusList(search);

            setInactiveOrdersList(list);

        } catch (err) {

            console.error("Erro ao carregar configurações de pedidos inativos", err);

        } finally {

            setLoadingPedidos(false);

        }

    };



    useEffect(() => {

        if (!user || !isAdmin) return;

        

        const delayDebounceFn = setTimeout(() => {

            if (activeTab === 'orders_visibility') {

                loadPedidosStatus(pedidosSearch);

            }

        }, 500);



        return () => clearTimeout(delayDebounceFn);

    }, [pedidosSearch, activeTab, user]);



    const handleToggleGlobalPedidosStatus = async () => {

        try {

            setLoadingPedidos(true);

            const newValue = !hideInactiveOrders;

            await togglePedidosStatusGlobal(newValue);

            setHideInactiveOrders(newValue);

            alert(`Filtro global de pedidos inativos ${newValue ? 'ATIVADO' : 'DESATIVADO'}.`);

        } catch (err) {

            alert('Erro ao alterar status global de pedidos: ' + (err.response?.data?.error || err.message));

        } finally {

            setLoadingPedidos(false);

        }

    };



    const handleTogglePedidoStatus = async (pedido, isCurrentlyActive) => {

        try {

            // Optimistic update

            setInactiveOrdersList(prev => prev.map(p => 

                p.pedido === pedido ? { ...p, ativo: !isCurrentlyActive } : p

            ));

            

            await togglePedidoStatus(pedido, !isCurrentlyActive);

        } catch (err) {

            alert('Erro ao alterar status do pedido: ' + (err.response?.data?.error || err.message));

            loadPedidosStatus(); // Revert on error

        }

    };



    // ADMIN GUARD

    if (!isAdmin && !canViewEtiquetas) {

        return (

            <div className="flex flex-col items-center justify-center h-full text-center p-8">

                <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />

                <h2 className="text-2xl font-bold text-slate-800">Acesso Negado</h2>

                <p className="text-slate-500 mt-2">Você não tem permissão para acessar esta página.</p>

            </div>

        );

    }



    // Toggle Menu Item

    const toggleMenuItem = (itemId) => {

        setCompanyForm(prev => ({

            ...prev,

            menu_config: {

                ...prev.menu_config,

                [itemId]: prev.menu_config[itemId] === undefined ? false : !prev.menu_config[itemId]

            }

        }));

    };



    const handleUserSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const isExternal = availableProfiles.find(p => p.code === userForm.tipo)?.tipoPerfil === 'externo';
            let dataToSubmit = { ...userForm };
            
            if (isExternal) {
                if (dataToSubmit.tipoExterno === 'cliente') {
                    dataToSubmit.idFornecedor = '';
                    dataToSubmit.lojaFornecedor = '';
                } else if (dataToSubmit.tipoExterno === 'fornecedor') {
                    dataToSubmit.idCliente = '';
                    dataToSubmit.lojaCliente = '';
                }
            } else {
                dataToSubmit.idFornecedor = '';
                dataToSubmit.lojaFornecedor = '';
                dataToSubmit.idCliente = '';
                dataToSubmit.lojaCliente = '';
                dataToSubmit.tipoExterno = 'fornecedor';
            }

            if (editingUser) {
                await updateUser(editingUser.idUsuario, dataToSubmit);
                alert('Usuário atualizado com sucesso!');
                setEditingUser(null);
            } else {
                await createUser(dataToSubmit);
                alert('Usuário cadastrado com sucesso!');
            }
            setUserForm({ nome: '', telefone: '', whatsapp: '', login: '', senha: '', tipo: 'U', setor: '', funcao: '', email: '', observacoes: '', tem_pc: false, foto: null, idFornecedor: '', lojaFornecedor: '', idCliente: '', lojaCliente: '', tipoExterno: 'fornecedor', pedidos_autorizados: '' });

            loadUsers();

        } catch (err) {

            const msg = err.response?.data?.error || err.message || 'Erro desconhecido.';

            alert(msg);

        } finally {

            setLoading(false);

        }

    };



    const [romaneioNumberForm, setRomaneioNumberForm] = useState('');



    // SGQ RNC Numbering Config

    const [rncNumberForm, setRncNumberForm] = useState('1');

    const [rncFormatForm, setRncFormatForm] = useState('RNC-{YEAR}-{SEQ:4}');



    const handleRncConfigSubmit = async () => {

        const num = parseInt(rncNumberForm, 10);

        if (!rncNumberForm || isNaN(num) || num < 1) {

            return alert('Digite um número inicial válido (>= 1)!');

        }

        if (!rncFormatForm.includes('{SEQ')) {

            return alert('O formato deve conter o marcador {SEQ} ou {SEQ:N} para a sequência numérica.');

        }

        if (!confirm(`Confirmar? O sistema usará o formato "${rncFormatForm}" e o próximo número sequencial será ${num}.`)) return;

        setLoadingCompany(true);

        try {

            const newConfig = {

                ...companyForm.general_config,

                sgq_rnc_config: { format: rncFormatForm, next_seq: num }

            };

            await updateGeneralSettings({ general_config: newConfig });

            setCompanyForm(prev => ({ ...prev, general_config: newConfig }));

            alert('Configuração de numeração de RNC salva com sucesso!');

        } catch (err) {

            alert('Erro: ' + (err.response?.data?.error || err.message));

        } finally {

            setLoadingCompany(false);

        }

    };

    // Modules Management States & Handlers
    const [moduleSearch, setModuleSearch] = useState('');
    const [moduleCategoryFilter, setModuleCategoryFilter] = useState('ALL');
    const [expandedModuleSettings, setExpandedModuleSettings] = useState({ qualidade: false });

    const isModuleActive = (mod) => {
        const val = companyForm.general_config?.[mod.key];
        if (val !== undefined && val !== null) return !!val;
        return mod.defaultActive;
    };

    const handleToggleModule = async (modKey, modName, currentActive) => {
        const newValue = !currentActive;
        const newGeneralConfig = { ...companyForm.general_config, [modKey]: newValue };
        try {
            setLoadingCompany(true);
            await updateGeneralSettings({ general_config: newGeneralConfig });
            setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
            if (window.confirm(`Módulo "${modName}" ${newValue ? 'ativado' : 'desativado'} com sucesso!\n\nA página será recarregada para atualizar o menu de navegação e as rotas. Deseja recarregar agora?`)) {
                window.location.reload();
            }
        } catch (err) {
            alert('Erro ao alterar status do módulo: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingCompany(false);
        }
    };

    const handleToggleSubmodule = async (subKey, subName, currentActive) => {
        const newValue = !currentActive;
        const newGeneralConfig = { ...companyForm.general_config, [subKey]: newValue };
        try {
            setLoadingCompany(true);
            await updateGeneralSettings({ general_config: newGeneralConfig });
            setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
        } catch (err) {
            alert('Erro ao alterar status do submódulo: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoadingCompany(false);
        }
    };



    const handleRomaneioNumberSubmit = async () => {

        if (!romaneioNumberForm || isNaN(romaneioNumberForm)) {

            return alert('Digite um número válido!');

        }

        

        if (!confirm(`Atenção: O próximo Romaneio gerado automaticamente assumirá o número ${romaneioNumberForm}. Deseja confirmar?`)) {

            return;

        }



        setLoadingCompany(true);

        try {

            const res = await setRomaneioInitialNumber(romaneioNumberForm);

            alert(res.message);

            setRomaneioNumberForm('');

        } catch (err) {

            alert('Erro: ' + (err.response?.data?.error || err.message));

        } finally {

            setLoadingCompany(false);

        }

    };



        const startEditing = (u) => {

        if (u.TipoUsuario === 'SA' && user?.tipo !== 'SA') {

            alert('Acesso Negado: Apenas SuperAdmins podem editar outros usuários SuperAdmin (SA).');

            return;

        }

        setEditingUser(u);

        setUserForm({

            nome: u.NomeCompleto,

            telefone: u.telefone || '',

            whatsapp: u.whatsapp || '',

            login: u.Login,

            senha: '',

            tipo: u.TipoUsuario,

            setor: u.Setor || '',

            funcao: u.Funcao || '',

            email: u.email || '',

            observacoes: u.Observacoes || '',

            tem_pc: u.TemPC === 1,

            foto: u.fotoUsuario || null,
            idFornecedor: u.idFornecedor || '',
            lojaFornecedor: u.lojaFornecedor || '',
            idCliente: u.idCliente || '',
            lojaCliente: u.lojaCliente || '',
            tipoExterno: u.tipoExterno || 'fornecedor',
            pedidos_autorizados: u.pedidos_autorizados || ''
        });

    };



    const cancelEditing = () => {

        setEditingUser(null);

        setUserForm({ nome: '', telefone: '', whatsapp: '', login: '', senha: '', tipo: 'U', setor: '', funcao: '', email: '', observacoes: '', tem_pc: false, foto: null, idFornecedor: '', lojaFornecedor: '', idCliente: '', lojaCliente: '', tipoExterno: 'fornecedor', pedidos_autorizados: '' });

    };



    const toggleGeneralConfig = (key) => {

        setCompanyForm(prev => ({

            ...prev,

            general_config: {

                ...prev.general_config,

                [key]: !prev.general_config?.[key]

            }

        }));

    };



    const handleMenuSubmit = async (e) => {

        e.preventDefault();

        setLoadingCompany(true);

        try {

            await updateMenuSettings({ menu_config: companyForm.menu_config });

            alert('Menu atualizado! A página será recarregada.');

            window.location.reload();

        } catch (err) {

            alert('Erro ao atualizar menu: ' + err.message);

        } finally {

            setLoadingCompany(false);

        }

    };



    const handleCompanySubmit = async (e) => {

        e.preventDefault();

        setLoadingCompany(true);

        try {

            // Sends everything, but backend only ignores menu_config here

            await updateCompanySettings(companyForm);

            applyCompanyBranding(companyForm);

            // Also update general settings

            if (companyForm.general_config) {

                await updateGeneralSettings({ general_config: companyForm.general_config });

            }



            alert('Dados da empresa atualizados!');

        } catch (err) {

            console.error(err);

            const msg = err.response?.data?.error || err.message;

            alert('Erro: ' + msg);

        } finally {

            setLoadingCompany(false);

        }

    };



    const compressImage = (file) => {

        return new Promise((resolve) => {

            const reader = new FileReader();

            reader.readAsDataURL(file);

            reader.onload = (event) => {

                const img = new Image();

                img.src = event.target.result;

                img.onload = () => {

                    const canvas = document.createElement('canvas');

                    const MAX_WIDTH = 300;

                    const MAX_HEIGHT = 300;

                    let width = img.width;

                    let height = img.height;



                    if (width > height) {

                        if (width > MAX_WIDTH) {

                            height *= MAX_WIDTH / width;

                            width = MAX_WIDTH;

                        }

                    } else {

                        if (height > MAX_HEIGHT) {

                            width *= MAX_HEIGHT / height;

                            height = MAX_HEIGHT;

                        }

                    }



                    canvas.width = width;

                    canvas.height = height;

                    const ctx = canvas.getContext('2d');

                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL('image/jpeg', 0.7)); // Compress to 70% quality

                };

            };

        });

    };



    const handlePhotoUpload = async (e) => {

        const file = e.target.files[0];

        if (file) {

            try {

                const compressed = await compressImage(file);

                setUserForm({ ...userForm, foto: compressed });

            } catch (err) {

                console.error("Erro ao processar imagem", err);

                alert("Erro ao processar imagem.");

            }

        }

    };



    // Native Mobile Camera Support via HTML5 capture="environment" replaces WebRTC



    const handlePrintReport = () => {

        // We will rely on CSS print media queries to format the page correctly

        window.print();

    };



    const filteredUsers = usersList.filter(u => u.aprovado === 1).filter(u => {

        const matchesSearch = (u.NomeCompleto || '').toLowerCase().includes(userFilter.toLowerCase()) ||

            (u.Login || '').toLowerCase().includes(userFilter.toLowerCase());

        const matchesPc = pcFilter === 'all' || (pcFilter === 'yes' ? u.TemPC === 1 : u.TemPC !== 1);

        const matchesType = typeFilter === 'all' || u.TipoUsuario === typeFilter;

        return matchesSearch && matchesPc && matchesType;

    });



    const toggleUserSelection = (userId) => {

        setSelectedUsers(prev => {

            const next = new Set(prev);

            if (next.has(userId)) next.delete(userId);

            else next.add(userId);

            return next;

        });

    };



    const toggleSelectAll = () => {

        if (selectedUsers.size === filteredUsers.length) {

            setSelectedUsers(new Set());

        } else {

            setSelectedUsers(new Set(filteredUsers.map(u => u.idUsuario)));

        }

    };



    const handleSendCredentials = async (method = 'email') => {

        if (selectedUsers.size === 0) return;



        const selectedList = usersList.filter(u => selectedUsers.has(u.idUsuario));

        const missingContact = method === 'whatsapp' 

            ? selectedList.filter(u => !u.whatsapp)

            : selectedList.filter(u => !u.email);

            

        const withContact = method === 'whatsapp'

            ? selectedList.filter(u => u.whatsapp)

            : selectedList.filter(u => u.email);



        if (withContact.length === 0) {

            alert(`Nenhum dos usuários selecionados possui ${method === 'whatsapp' ? 'WhatsApp' : 'e-mail'} cadastrado.`);

            return;

        }



        let confirmMsg = `Deseja enviar os dados de acesso por ${method === 'whatsapp' ? 'WhatsApp' : 'e-mail'} para ${withContact.length} usuário(s)?`;

        if (missingContact.length > 0) {

            confirmMsg += `\n\n⚠️ ${missingContact.length} usuário(s) SEM ${method === 'whatsapp' ? 'WhatsApp' : 'e-mail'} serão ignorados:\n` + missingContact.map(u => `  • ${u.NomeCompleto}`).join('\n');

        }

        confirmMsg += `\n\nSerão enviados para:\n` + withContact.map(u => `  ${method === 'whatsapp' ? '📱' : '✉️'} ${u.NomeCompleto} → ${method === 'whatsapp' ? u.whatsapp : u.email}`).join('\n');



        if (!window.confirm(confirmMsg)) return;



        const passwordDisplay = window.prompt(

            "⚠️ ATENÇÃO: Enviar as credenciais irá REDEFINIR a senha do(s) usuário(s).\n\n" +

            "Se você quer definir uma nova senha específica (ex: '123456'), digite-a abaixo.\n\n" +

            "Se você deixar em branco, o sistema gerará uma senha aleatória de 6 dígitos para cada usuário.", 

            "123456"

        );



        if (passwordDisplay === null) return; // User cancelled prompt



        setSendingCredentials(method);

        try {

            const result = await sendUserCredentials([...selectedUsers], method, passwordDisplay);

            let msg = `✅ ${result.results.success.length} mensagem(ns) enviada(s) com sucesso via ${method === 'whatsapp' ? 'WhatsApp' : 'E-mail'}!`;

            if (result.results.failed.length > 0) {

                msg += `\n\n❌ ${result.results.failed.length} falharam:\n` + result.results.failed.map(f => `  • ${f.nome}: ${f.reason}`).join('\n');

            }

            alert(msg);

            setSelectedUsers(new Set());

        } catch (err) {

            alert('Erro ao enviar credenciais: ' + (err.response?.data?.error || err.message));

        } finally {
            setSendingCredentials(null);
        }
    };

    const handleBulkProfileChange = async () => {
        if (selectedUsers.size === 0) return;
        if (!bulkTargetProfile) {
            alert('Selecione um grupo de permissão.');
            return;
        }

        const targetProfileObj = availableProfiles.find(p => p.code === bulkTargetProfile);
        const profileName = targetProfileObj?.name || bulkTargetProfile;

        if (!window.confirm(`Tem certeza que deseja alterar o Grupo de Permissão de ${selectedUsers.size} usuário(s) selecionado(s) para "${profileName}"?`)) {
            return;
        }

        setBulkUpdating(true);
        try {
            const res = await bulkUpdateUserProfile([...selectedUsers], bulkTargetProfile, bulkCopyPermissions);
            alert(res.message || 'Grupo de permissão atualizado com sucesso!');
            setBulkProfileModalOpen(false);
            setSelectedUsers(new Set());
            loadUsers();
        } catch (err) {
            console.error(err);
            alert('Erro ao alterar perfil em lote: ' + (err.response?.data?.error || err.message));
        } finally {
            setBulkUpdating(false);
        }
    };

    const pendingUsers = usersList.filter(u => u.aprovado === 0);



    const handleApproveUser = async (u, newRole) => {

        if (window.confirm(`Tem certeza que deseja aprovar o acesso de ${u.NomeCompleto}?`)) {

            setLoading(true);

            try {

                await updateUser(u.idUsuario, {

                    nome: u.NomeCompleto,

                    login: u.Login,

                    tipo: newRole || u.TipoUsuario || 'U',

                    aprovado: 1,

                    email: u.email

                });

                alert('Usuário aprovado com sucesso! O acesso está liberado.');

                loadUsers();

            } catch (e) {

                alert('Erro ao aprovar: ' + (e.response?.data?.error || e.message));

            } finally {

                setLoading(false);

            }

        }

    };





    return (

        <div className="space-y-6">

            <div>

                <h1 className="text-2xl font-bold tracking-tight text-slate-900">Configurações do Sistema</h1>

                <p className="text-slate-500">Gerencie parâmetros globais, acessos e interface.</p>

            </div>



            {/* TAB HEADER */}

            <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex flex-wrap gap-x-8 gap-y-2" aria-label="Tabs">
                    {tabs.map((tab) => {

                        const Icon = tab.icon;

                        return (

                            <button

                                key={tab.id}

                                onClick={() => setActiveTab(tab.id)}

                                className={`

                                    group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all

                                    ${activeTab === tab.id

                                        ? 'border-blue-500 text-blue-600'

                                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}

                                `}

                            >

                                <Icon className={`

                                    -ml-0.5 mr-2 h-5 w-5

                                    ${activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}

                                `} />

                                {tab.label}

                            </button>

                        );

                    })}

                </nav>

            </div>



            {/* TAB CONTENT */}

            <div className="mt-6">



                {/* ERROR LIST TAB */}

                {activeTab === 'errors' && (

                    <ErrorListTab />

                )}



                {/* MONITORING TAB */}

                {activeTab === 'monitoring' && (

                    <div className="space-y-6">

                        <MonitoringDashboard />

                        <DBAMonitoringTab />

                    </div>

                )}



                {/* LABEL PRINTER TAB */}

                {activeTab === 'etiquetas' && (
                    <LabelPrinterTab />
                )}



                {/* AJUSTANDO O APONTAMENTO TAB */}

                {activeTab === 'ajuste_apontamento' && (
                    <AjusteApontamentoTab />
                )}



                {/* GENERAL TAB */}

                {activeTab === 'general' && (

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 w-full">

                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6 border-b pb-4">

                            <Building2 className="w-6 h-6 text-blue-600" />

                            Configurações da Empresa

                        </h2>

                        <h3 className="text-lg font-bold text-slate-800 mb-1">Dados Corporativos</h3>
                        <p className="text-xs text-slate-500 mb-4">Empresa que utiliza o sistema. Estes dados e o logo aparecem em todos os relatórios gerados.</p>
                        <CompanyProfileForm
                            companyForm={companyForm}
                            setCompanyForm={setCompanyForm}
                            onSubmit={handleCompanySubmit}
                            loading={loadingCompany}
                        />



                        {/* General System Configs Section */}

                        <div className="mt-8 pt-8 border-t border-slate-200">

                            <h3 className="text-lg font-bold text-slate-800 mb-4">Configurações do Sistema</h3>

                            <div className="space-y-4">

                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">

                                    <div>

                                        <h4 className="font-medium text-slate-800">Fluxo de Compras - Detalhes da NF</h4>

                                        <p className="text-sm text-slate-500">Mostrar colunas de valor unitário e total no tooltip da Nota Fiscal.</p>

                                    </div>

                                    <button

                                        type="button"

                                        onClick={() => toggleGeneralConfig('show_purchase_values')}

                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.show_purchase_values ? 'bg-blue-600' : 'bg-slate-200'}`}

                                    >

                                        <span

                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.show_purchase_values ? 'translate-x-6' : 'translate-x-1'}`}

                                        />

                                    </button>

                                </div>



                                {/* Flow de Produção */}

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-4">

                                    <div className="flex items-center justify-between">

                                        <div>

                                            <h4 className="font-medium text-slate-800">Fluxo de Produção - Módulo de Conferência</h4>

                                            <p className="text-sm text-slate-500">Exige que apontamentos de operários sejam aprovados por um usuário Conferente (Tipo 'C').</p>

                                        </div>

                                        <button

                                            type="button"

                                            onClick={() => toggleGeneralConfig('enable_production_verification')}

                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.enable_production_verification ? 'bg-blue-600' : 'bg-slate-200'}`}

                                        >

                                            <span

                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.enable_production_verification ? 'translate-x-6' : 'translate-x-1'}`}

                                            />

                                        </button>

                                    </div>



                                    {companyForm.general_config?.enable_production_verification && (

                                        <div className="pl-4 border-l-2 border-blue-200 pt-2 pb-2">

                                            <label className="block text-sm font-medium text-slate-700 mb-1">Comportamento do Saldo (Estoque Virtual)</label>

                                            <select

                                                className="w-full md:w-2/3 p-2 border rounded-lg bg-white text-sm"

                                                value={companyForm.general_config?.verification_mode || 'INDIRECT'}

                                                onChange={e => setCompanyForm(prev => ({

                                                    ...prev,

                                                    general_config: {

                                                        ...prev.general_config,

                                                        verification_mode: e.target.value

                                                    }

                                                }))}

                                            >

                                                <option value="INDIRECT">Padrão - Peças caem no saldo imediatamente e ficam PENDENTES de conferência</option>

                                                <option value="QUARANTINE">Quarentena - Peças NÃO caem no saldo até que o conferente aprove o apontamento</option>

                                            </select>

                                            <p className="text-xs text-slate-500 mt-1">Este modo altera a visualização da barra de progresso em toda a fábrica e nos relatórios de OP.</p>

                                        </div>

                                    )}

                                </div>



                                {/* Controle de Apontamento de Produção */}

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">

                                    <h4 className="font-medium text-slate-800 mb-1">Controle de Apontamento de Produção</h4>

                                    <p className="text-sm text-slate-500 mb-3">

                                        Define como o sistema valida um novo apontamento em relação ao roteiro de produção.

                                    </p>

                                    <select

                                        className="w-full md:w-2/3 p-2 border rounded-lg bg-white text-sm"

                                        value={companyForm.general_config?.production_appointment_mode || 'free'}

                                        onChange={e => setCompanyForm(prev => ({

                                            ...prev,

                                            general_config: {

                                                ...prev.general_config,

                                                production_appointment_mode: e.target.value

                                            }

                                        }))}

                                    >

                                        <option value="free">Livre — Aponta sem restrições de sequência ou saldo</option>

                                        <option value="balance">Saldo — Bloqueia se o saldo planejado já foi atingido</option>

                                        <option value="sequence">Sequência — Bloqueia se a operação anterior não foi 100% concluída</option>

                                    </select>

                                    <p className="text-xs text-slate-400 mt-2">

                                        O modo "Livre" é o padrão. Alterações entram em vigor imediatamente após salvar.

                                    </p>

                                </div>







                                {/* Romaneio Config */}

                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">

                                    <h4 className="font-medium text-slate-800 mb-2">Numeração Automática do Romaneio</h4>

                                    <p className="text-sm text-slate-500 mb-4">Caso prefira começar a numeração automática a partir de um valor específico, você pode alterar abaixo. O sistema começará a contar a partir de agora do número configurado.</p>

                                    <div className="flex gap-2 items-center max-w-sm">

                                        <input 

                                            type="number"

                                            className="w-full p-2 border rounded-lg text-sm"

                                            placeholder="Ex: 7500"

                                            value={romaneioNumberForm}

                                            onChange={e => setRomaneioNumberForm(e.target.value)}

                                        />

                                        <button 

                                            type="button"

                                            disabled={loadingCompany}

                                            onClick={handleRomaneioNumberSubmit}
                                            className="bg-blue-600 text-white font-medium p-2 px-4 rounded-lg hover:bg-blue-700 whitespace-nowrap text-sm disabled:opacity-50"
                                        >
                                            Definir Número Inicial
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* AUTOMAÇÕES TAB */}
                {activeTab === 'automations' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-4xl animate-fadeIn">
                        <div className="flex items-center justify-between gap-3 mb-6 border-b pb-4">
                            <div className="flex items-center gap-3">
                                <Send className="w-6 h-6 text-indigo-600" />
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Automações & Avisos (WhatsApp)</h2>
                                    <p className="text-sm text-slate-500">Ative ou desative o envio automático de avisos, resumos e alertas gerados pelo sistema.</p>
                                </div>
                            </div>
                            <button 
                                type="button"
                                disabled={loadingCompany}
                                onClick={async () => {
                                    try {
                                        setLoadingCompany(true);
                                        await updateGeneralSettings({ general_config: companyForm.general_config });
                                        alert('Configurações de automações salvas com sucesso!');
                                    } catch (err) {
                                        alert('Erro ao salvar automações: ' + err.message);
                                    } finally {
                                        setLoadingCompany(false);
                                    }
                                }}
                                className="bg-blue-600 text-white font-medium p-2 px-4 rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" />
                                Salvar Alterações
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Notificações Meu Canal */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Notificação Meu Canal (Performance)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Resumo diário enviado por E-mail/WhatsApp às 06:00 e 15:00.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.meu_canal_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, meu_canal_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.meu_canal_active !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.meu_canal_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Agente de IA WhatsApp */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Resumo Diário (Agente de IA)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Resumo das atividades enviado para grupos do WhatsApp às 15:00.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.ai_whatsapp_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, ai_whatsapp_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.ai_whatsapp_active !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.ai_whatsapp_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Visão Gerencial Faturamento */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Visão Gerencial (Faturamento)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Alerta noturno sobre solicitações de faturamento em aberto (18:01).</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.visao_gerencial_faturamento_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, visao_gerencial_faturamento_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.visao_gerencial_faturamento_active !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.visao_gerencial_faturamento_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                
                                {/* Suporte Lynx - Detecção Automática */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Suporte Lynx - Detecção Automática</h4>
                                        <p className="text-xs text-slate-500 mt-1">Avisa automaticamente o usuário no WhatsApp ao detectar erros no sistema.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.suporte_lynx_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, suporte_lynx_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.suporte_lynx_active !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.suporte_lynx_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                
                                {/* Integração Protheus */}
                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex flex-col justify-between shadow-sm md:col-span-2">
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h4 className="font-bold text-indigo-900">Integração de Baixa Protheus (Apontamento)</h4>
                                            <p className="text-xs text-indigo-700 mt-1">Aciona automaticamente a API de baixa do Protheus ao apontar processos selecionados.</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const current = companyForm.general_config?.apontamento_simples_protheus_active === true;
                                                setCompanyForm(prev => ({
                                                    ...prev,
                                                    general_config: { ...prev.general_config, apontamento_simples_protheus_active: !current }
                                                }));
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.apontamento_simples_protheus_active === true ? 'bg-indigo-600' : 'bg-slate-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.apontamento_simples_protheus_active === true ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    {companyForm.general_config?.apontamento_simples_protheus_active === true && (
                                        <div className="mt-2 border-t border-indigo-100 pt-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="block text-sm font-semibold text-indigo-900">
                                                    Processos que ativam a baixa
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowProtheusInfo(!showProtheusInfo)}
                                                    className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-xs font-medium bg-indigo-100 hover:bg-indigo-200 px-2 py-1 rounded"
                                                >
                                                    <Info className="w-3.5 h-3.5" />
                                                    Como isso funciona?
                                                </button>
                                            </div>
                                            
                                            {showProtheusInfo && (
                                                <div className="mb-4 p-3 bg-white border border-indigo-200 rounded-lg text-sm text-slate-700 shadow-sm animate-fadeIn">
                                                    <h5 className="font-bold text-indigo-800 mb-1">Como a baixa acontece?</h5>
                                                    <p className="mb-2">Ao apontar um dos processos marcados abaixo no módulo PCP/Chão de Fábrica, o sistema enviará um pacote invisível para a API do Protheus contendo a OP, o Código do Produto e a Quantidade Apontada.</p>
                                                    <h5 className="font-bold text-indigo-800 mb-1">Gera saldo de estoque no Protheus?</h5>
                                                    <p><b>Sim.</b> O Protheus (via MATA680/NOPER: 3) fará a entrada automática do produto pai no estoque (credita a quantidade apontada) e consumirá os insumos/componentes empenhados na OP.</p>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                                                {processosList.map(proc => {
                                                    const current = companyForm.general_config?.apontamento_simples_processos || '';
                                                    const selectedArr = current.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                                                    const procIdStr = proc.Codigo ? proc.Codigo.trim().toUpperCase() : '';
                                                    const isChecked = procIdStr ? selectedArr.includes(procIdStr) : false;
                                                    
                                                    return (
                                                        <label key={proc.IdProcesso} className="flex items-center gap-2 p-2 bg-white border border-indigo-100 rounded hover:bg-indigo-50 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                                                                checked={isChecked}
                                                                onChange={(e) => {
                                                                    if (!proc.Codigo) return; // Se não tiver código, não permite selecionar
                                                                    const arr = current.split(',').map(s => s.trim()).filter(Boolean);
                                                                    let updated;
                                                                    if (e.target.checked) {
                                                                        updated = [...arr, proc.Codigo.trim()].join(', ');
                                                                    } else {
                                                                        updated = arr.filter(p => p.toUpperCase() !== proc.Codigo.trim().toUpperCase()).join(', ');
                                                                    }
                                                                    setCompanyForm(prev => ({
                                                                        ...prev,
                                                                        general_config: { ...prev.general_config, apontamento_simples_processos: updated }
                                                                    }));
                                                                }}
                                                            />
                                                            <span className="text-xs font-medium text-slate-700">
                                                                {proc.Codigo ? `${proc.Codigo} — ` : ''}{proc.Descricao}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                                {processosList.length === 0 && (
                                                    <div className="col-span-full p-4 text-center text-sm text-slate-500">
                                                        Carregando processos...
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Integração Protheus (Perdas MATA685) */}
                                <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex flex-col justify-between shadow-sm md:col-span-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-red-900">Integração de Perdas Protheus (RNC)</h4>
                                            <p className="text-xs text-red-700 mt-1">Aciona automaticamente a API de perdas (MATA685) ao salvar uma RNC com "Nova Peça" marcada.</p>
                                        </div>
                                        <button 
                                            type="button"
                                            onClick={() => {
                                                const current = companyForm.general_config?.apontamento_perdas_protheus_active === true;
                                                setCompanyForm(prev => ({
                                                    ...prev,
                                                    general_config: { ...prev.general_config, apontamento_perdas_protheus_active: !current }
                                                }));
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.apontamento_perdas_protheus_active === true ? 'bg-red-600' : 'bg-slate-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.apontamento_perdas_protheus_active === true ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    {companyForm.general_config?.apontamento_perdas_protheus_active === true && (
                                        <div className="mt-2 border-t border-red-100 pt-3">
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPerdasInfo(!showPerdasInfo)}
                                                    className="text-red-600 hover:text-red-800 flex items-center gap-1 text-xs font-medium bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
                                                >
                                                    <Info className="w-3.5 h-3.5" />
                                                    Como isso funciona?
                                                </button>
                                            </div>
                                            
                                            {showPerdasInfo && (
                                                <div className="mt-2 p-3 bg-white border border-red-200 rounded-lg text-sm text-slate-700 shadow-sm animate-fadeIn">
                                                    <h5 className="font-bold text-red-800 mb-1">Apontamento de Perda e Estorno</h5>
                                                    <p className="mb-2">Quando um apontador cria uma Tratativa de RNC no módulo SGQ marcando a opção <b>"Nova Peça"</b> e insere a Quantidade e Operação, o sistema envia o apontamento de perda para o Protheus (NOPER: 3) e registra o número RECNO gerado.</p>
                                                    <p>Se o usuário desmarcar a "Nova Peça" em uma RNC que já foi enviada, o sistema usa o RECNO salvo para realizar automaticamente o <b>Estorno</b> da perda no Protheus (NOPER: 6).</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Alertas SGQ */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Alertas SGQ (Calibração)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Avisos diários matinais sobre vencimento da calibração de instrumentos.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.sgq_alerts_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, sgq_alerts_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.sgq_alerts_active !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.sgq_alerts_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Relatórios de Faturamento/Compras */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Relatórios Diários (Fat./Compras)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Relatório consolidado via WhatsApp/E-mail nos horários programados.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.relatorios_faturamento_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, relatorios_faturamento_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.relatorios_faturamento_active !== false ? 'bg-green-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.relatorios_faturamento_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>


                            <div className="flex items-center gap-3 mt-8 mb-4">
                                <div className="p-2 bg-indigo-100 rounded-lg">
                                    <Mail className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Automações & Avisos (E-mail)</h2>
                                    <p className="text-sm text-slate-500">Controle independente para disparo de relatórios e alertas por e-mail.</p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Notificações Meu Canal (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Notificação Meu Canal (Performance)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Resumo diário enviado por E-mail às 06:00 e 15:00.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.meu_canal_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, meu_canal_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.meu_canal_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.meu_canal_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Visão Gerencial Faturamento (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Visão Gerencial (Faturamento)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Alerta noturno sobre solicitações em aberto por E-mail (18:01).</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.visao_gerencial_faturamento_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, visao_gerencial_faturamento_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.visao_gerencial_faturamento_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.visao_gerencial_faturamento_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Alertas SGQ (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Alertas SGQ (Calibração)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Avisos diários matinais sobre vencimento por E-mail.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.sgq_alerts_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, sgq_alerts_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.sgq_alerts_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.sgq_alerts_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>

                                {/* Relatórios de Faturamento/Compras (Email) */}
                                <div className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm">
                                    <div>
                                        <h4 className="font-medium text-slate-800">Relatórios Diários (Fat./Compras)</h4>
                                        <p className="text-xs text-slate-500 mt-1">Relatório consolidado por E-mail nos horários programados.</p>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            const current = companyForm.general_config?.automations?.relatorios_faturamento_email_active !== false;
                                            setCompanyForm(prev => ({
                                                ...prev,
                                                general_config: { ...prev.general_config, automations: { ...prev.general_config?.automations, relatorios_faturamento_email_active: !current } }
                                            }));
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.automations?.relatorios_faturamento_email_active !== false ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.automations?.relatorios_faturamento_email_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Notificações de Faturamento por E-mail */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mt-6">
                                <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2"><Mail className="w-5 h-5 text-indigo-500" /> Notificações de Solicitações de Faturamento</h4>
                                <p className="text-sm text-slate-500 mb-4">Selecione os usuários que receberão um e-mail automático com os detalhes das novas solicitações criadas pela Expedição.</p>
                                <div className="max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2">
                                    {usersList.filter(u => u.aprovado === 1 && u.email).map(u => {
                                        const isChecked = (companyForm.general_config?.faturamento_emails || []).includes(u.idUsuario);
                                        return (
                                            <label key={u.idUsuario} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition-colors border-b border-gray-50 last:border-0">
                                                <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const currentEmails = companyForm.general_config?.faturamento_emails || [];
                                                        let newEmails = e.target.checked ? [...currentEmails, u.idUsuario] : currentEmails.filter(id => id !== u.idUsuario);
                                                        setCompanyForm(prev => ({
                                                            ...prev,
                                                            general_config: { ...prev.general_config, faturamento_emails: newEmails }
                                                        }));
                                                    }}
                                                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                                                />
                                                <div className="flex flex-col cursor-pointer">
                                                    <span className="text-sm font-medium text-slate-700">{u.NomeCompleto}</span>
                                                    <span className="text-xs text-slate-500">{u.email}</span>
                                                </div>
                                            </label>
                                        );
                                    })}
                                    {usersList.filter(u => u.aprovado === 1 && u.email).length === 0 && (
                                        <p className="text-sm text-slate-400 p-2 text-center">Nenhum usuário com e-mail válido cadastrado.</p>
                                    )}
                                </div>
                            </div>

                            {/* Automação: Relatório de Faturamento Diário */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mt-4">
                                <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2"><Calendar className="w-5 h-5 text-emerald-500" /> Automação de Relatório (Faturamento, Compras, Acumulado)</h4>
                                <p className="text-sm text-slate-500 mb-4">Configure o grupo de usuários e os horários para o envio automático do consolidado diário via E-mail e WhatsApp.</p>
                                
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Horário de Envio (Ex: 15:00)</label>
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="time" 
                                                className="p-2 border rounded-lg text-sm bg-white focus:ring-emerald-500 focus:border-emerald-500"
                                                value={(companyForm.general_config?.faturamento_automation?.times || ['15:00'])[0]}
                                                onChange={(e) => {
                                                    const newVal = e.target.value;
                                                    setCompanyForm(prev => ({
                                                        ...prev,
                                                        general_config: { 
                                                            ...prev.general_config, 
                                                            faturamento_automation: { 
                                                                ...(prev.general_config?.faturamento_automation || { days: [1,2,3,4,5], users: [] }), 
                                                                times: [newVal] 
                                                            } 
                                                        }
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Dias da Semana</label>
                                        <div className="flex gap-1 flex-wrap">
                                            {[{id: 1, label: 'Seg'}, {id: 2, label: 'Ter'}, {id: 3, label: 'Qua'}, {id: 4, label: 'Qui'}, {id: 5, label: 'Sex'}, {id: 6, label: 'Sáb'}, {id: 0, label: 'Dom'}].map(day => {
                                                const activeDays = companyForm.general_config?.faturamento_automation?.days || [1,2,3,4,5];
                                                const isActive = activeDays.includes(day.id);
                                                return (
                                                    <button
                                                        key={day.id}
                                                        type="button"
                                                        onClick={() => {
                                                            let newDays = isActive ? activeDays.filter(d => d !== day.id) : [...activeDays, day.id];
                                                            setCompanyForm(prev => ({
                                                                ...prev,
                                                                general_config: { 
                                                                    ...prev.general_config, 
                                                                    faturamento_automation: { 
                                                                        ...(prev.general_config?.faturamento_automation || { times: ['15:00'], users: [] }), 
                                                                        days: newDays 
                                                                    } 
                                                                }
                                                            }));
                                                        }}
                                                        className={`px-2 py-1 text-xs font-medium rounded border ${isActive ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-white border-slate-200 text-slate-500'}`}
                                                    >
                                                        {day.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>

                                <label className="block text-xs font-bold text-slate-700 uppercase mb-2">Usuários e Canais de Recebimento</label>
                                <div className="max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2">
                                    {usersList.filter(u => u.aprovado === 1).map(u => {
                                        const autoConfig = companyForm.general_config?.faturamento_automation || { times: ['15:00'], days: [1,2,3,4,5], users: [] };
                                        const userPref = autoConfig.users.find(x => x.id === u.idUsuario);
                                        const isInGroup = !!userPref;
                                        
                                        return (
                                            <div key={u.idUsuario} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded border-b border-gray-50 last:border-0">
                                                <label className="flex items-center gap-3 cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isInGroup}
                                                        onChange={(e) => {
                                                            let newUsers = [...autoConfig.users];
                                                            if (e.target.checked) {
                                                                newUsers.push({ id: u.idUsuario, email: true, whatsapp: true });
                                                            } else {
                                                                newUsers = newUsers.filter(x => x.id !== u.idUsuario);
                                                            }
                                                            setCompanyForm(prev => ({
                                                                ...prev,
                                                                general_config: { ...prev.general_config, faturamento_automation: { ...autoConfig, users: newUsers } }
                                                            }));
                                                        }}
                                                        className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-700">{u.NomeCompleto}</span>
                                                        <span className="text-xs text-slate-500">{u.email || 'Sem e-mail'} | {u.telefone || 'Sem telefone'}</span>
                                                    </div>
                                                </label>
                                                
                                                {isInGroup && (
                                                    <div className="flex items-center gap-4 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={userPref.email}
                                                                disabled={!u.email}
                                                                onChange={(e) => {
                                                                    const newUsers = autoConfig.users.map(x => x.id === u.idUsuario ? { ...x, email: e.target.checked } : x);
                                                                    setCompanyForm(prev => ({
                                                                        ...prev,
                                                                        general_config: { ...prev.general_config, faturamento_automation: { ...autoConfig, users: newUsers } }
                                                                    }));
                                                                }}
                                                                className="w-3.5 h-3.5 text-indigo-500 rounded border-gray-300"
                                                            /> E-mail
                                                        </label>
                                                        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={userPref.whatsapp}
                                                                disabled={!u.telefone}
                                                                onChange={(e) => {
                                                                    const newUsers = autoConfig.users.map(x => x.id === u.idUsuario ? { ...x, whatsapp: e.target.checked } : x);
                                                                    setCompanyForm(prev => ({
                                                                        ...prev,
                                                                        general_config: { ...prev.general_config, faturamento_automation: { ...autoConfig, users: newUsers } }
                                                                    }));
                                                                }}
                                                                className="w-3.5 h-3.5 text-green-500 rounded border-gray-300"
                                                            /> WhatsApp
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={loadingCompany}
                                        onClick={async () => {
                                            try {
                                                setLoadingCompany(true);
                                                await updateGeneralSettings({ general_config: companyForm.general_config });
                                                alert('Configurações de notificação do Faturamento salvas com sucesso!');
                                            } catch (err) {
                                                alert('Erro ao salvar notificações do Faturamento: ' + err.message);
                                            } finally {
                                                setLoadingCompany(false);
                                            }
                                        }}
                                        className="bg-emerald-600 text-white font-medium px-5 py-2 rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 transition-colors"
                                    >
                                        {loadingCompany ? 'Salvando...' : 'Salvar Configurações de Faturamento'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* VISIBILIDADE DE PEDIDOS TAB */}

                {activeTab === 'orders_visibility' && (

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-4xl">

                        <div className="flex items-center justify-between gap-3 mb-6 border-b pb-4">

                            <div className="flex items-center gap-3">

                                <EyeOff className="w-6 h-6 text-indigo-600" />

                                <div>

                                    <h2 className="text-lg font-bold text-slate-800">Visibilidade de Pedidos</h2>

                                    <p className="text-sm text-slate-500">Controle a exibição de pedidos específicos em todos os módulos do sistema.</p>

                                </div>

                            </div>

                        </div>



                        <div className="space-y-6">

                            {/* Global Toggle para Ocultar Pedidos Inativos */}

                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">

                                <div className="flex items-center justify-between mb-4">

                                    <div>

                                        <h4 className="font-medium text-slate-800">Filtro Global de Pedidos (Ocultar Inativos)</h4>

                                        <p className="text-sm text-slate-500">

                                            Quando ativo, pedidos inativos não serão exibidos em nenhum módulo (Produção, PCP, Relatórios, etc).

                                        </p>

                                    </div>

                                    <button

                                        type="button"

                                        disabled={loadingPedidos}

                                        onClick={handleToggleGlobalPedidosStatus}

                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hideInactiveOrders ? 'bg-blue-600' : 'bg-slate-200'} ${loadingPedidos ? 'opacity-50 cursor-not-allowed' : ''}`}

                                    >

                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hideInactiveOrders ? 'translate-x-6' : 'translate-x-1'}`} />

                                    </button>

                                </div>

                                

                                <div className="border-t border-slate-200 pt-4 mt-4">

                                    <div className="flex items-center justify-between mb-4">

                                        <h5 className="text-sm font-medium text-slate-800">Status dos Pedidos (Visibilidade)</h5>

                                        <input 

                                            type="text"

                                            className="w-64 p-2 border rounded-lg text-sm"

                                            placeholder="Buscar PV ou Cliente..."

                                            value={pedidosSearch}

                                            onChange={e => setPedidosSearch(e.target.value)}

                                        />

                                    </div>

                                    

                                    <div className="max-h-[500px] overflow-y-auto bg-white border border-slate-200 rounded-lg">

                                        {inactiveOrdersList.length === 0 ? (

                                            <div className="p-4 text-center text-sm text-slate-500">

                                                {loadingPedidos ? 'Carregando pedidos...' : 'Nenhum pedido encontrado.'}

                                            </div>

                                        ) : (

                                            <table className="min-w-full divide-y divide-gray-200">

                                                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">

                                                    <tr>

                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Pedido</th>

                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Cliente</th>

                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Data Emissão</th>

                                                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status (Visível)</th>

                                                    </tr>

                                                </thead>

                                                <tbody className="bg-white divide-y divide-gray-200">

                                                    {inactiveOrdersList

                                                        .filter(p => !pedidosSearch || p.pedido.includes(pedidosSearch) || (p.cliente_nome && p.cliente_nome.toLowerCase().includes(pedidosSearch.toLowerCase())))

                                                        .slice(0, 100) // Render only top 100 to avoid lag

                                                        .map((item, index) => (

                                                        <tr key={`${item.pedido}-${index}`} className={item.ativo ? '' : 'bg-red-50'}>

                                                            <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{item.pedido}</td>

                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500 truncate max-w-[200px]" title={item.cliente_nome}>{item.cliente_nome || '-'}</td>

                                                            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-500">

                                                                {item.emissao ? item.emissao.replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1') : '-'}

                                                            </td>

                                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm font-medium">

                                                                <button

                                                                    type="button"

                                                                    disabled={loadingPedidos}

                                                                    onClick={() => handleTogglePedidoStatus(item.pedido, item.ativo)}

                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${item.ativo ? 'bg-green-500' : 'bg-red-400'} ${loadingPedidos ? 'opacity-50 cursor-not-allowed' : ''}`}

                                                                    title={item.ativo ? 'Ativo (Visível) - Clique para Ocultar' : 'Oculto - Clique para Exibir'}

                                                                >

                                                                    <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${item.ativo ? 'translate-x-5' : 'translate-x-1'}`} />

                                                                </button>

                                                            </td>

                                                        </tr>

                                                    ))}

                                                    {inactiveOrdersList.filter(p => !pedidosSearch || p.pedido.includes(pedidosSearch) || (p.cliente_nome && p.cliente_nome.toLowerCase().includes(pedidosSearch.toLowerCase()))).length > 100 && (

                                                        <tr>

                                                            <td colSpan="4" className="px-4 py-2 text-center text-xs text-gray-400 bg-gray-50">
                                                                Use a busca para encontrar mais pedidos...
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MÓDULOS TAB */}
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
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-5xl">
                            {/* Header Section */}
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-slate-200 pb-5">
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                                        <Package className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-800">Gestão de Módulos</h2>
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Ative ou desative módulos inteiros do sistema. Módulos inativos ocultam seus menus, atalhos e rotas para todos os usuários.
                                        </p>
                                    </div>
                                </div>

                                {/* Overview Metrics */}
                                <div className="flex items-center gap-2 self-start md:self-auto">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
                                        <Package className="w-3.5 h-3.5 text-slate-400" />
                                        <span>Total: <strong>{totalModulesCount}</strong></span>
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-700">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <span>Ativos: <strong>{activeModulesCount}</strong></span>
                                    </div>
                                    {inactiveModulesCount > 0 && (
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-700">
                                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                            <span>Ocultos: <strong>{inactiveModulesCount}</strong></span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Search and Category Filters */}
                            <div className="space-y-3 mb-6">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <div className="relative flex-1">
                                        <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                        <input
                                            type="text"
                                            value={moduleSearch}
                                            onChange={e => setModuleSearch(e.target.value)}
                                            placeholder="Buscar módulo por nome, palavra-chave ou funcionalidade..."
                                            className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        />
                                        {moduleSearch && (
                                            <button
                                                type="button"
                                                onClick={() => setModuleSearch('')}
                                                className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full w-5 h-5 flex items-center justify-center transition-colors"
                                                title="Limpar busca"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Category Chips */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                                    {MODULE_CATEGORIES.map(cat => {
                                        const isSelected = moduleCategoryFilter === cat.id;
                                        return (
                                            <button
                                                key={cat.id}
                                                type="button"
                                                onClick={() => setModuleCategoryFilter(cat.id)}
                                                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all font-medium ${
                                                    isSelected
                                                        ? 'bg-slate-900 text-white shadow-xs'
                                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                                                }`}
                                            >
                                                {cat.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Modules List Grouped by Category */}
                            {categoriesWithModules.length === 0 ? (
                                <div className="p-12 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                                    <p className="text-slate-600 font-medium text-sm">Nenhum módulo encontrado</p>
                                    <p className="text-slate-400 text-xs mt-1">Tente ajustar a busca ou o filtro de categoria selecionado.</p>
                                    <button
                                        type="button"
                                        onClick={() => { setModuleSearch(''); setModuleCategoryFilter('ALL'); }}
                                        className="mt-3 text-xs text-blue-600 hover:underline font-semibold"
                                    >
                                        Limpar todos os filtros
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {categoriesWithModules.map(category => (
                                        <div key={category.id} className="space-y-3">
                                            {/* Category Heading */}
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-1.5 h-4 rounded-full bg-blue-600 inline-block"></span>
                                                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                                                        {category.label}
                                                    </h3>
                                                    <span className="text-xs text-slate-400 font-medium">
                                                        ({category.modules.filter(m => isModuleActive(m)).length}/{category.modules.length} ativos)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Cards Grid */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                                {category.modules.map(mod => {
                                                    const isActive = isModuleActive(mod);
                                                    const ModIcon = mod.icon || Package;
                                                    const menuGroup = MENU_GROUPS.find(g => g.id === mod.menuGroupId);
                                                    const menuItemsCount = menuGroup?.items?.length || 0;
                                                    const isExpanded = !!expandedModuleSettings[mod.id];

                                                    return (
                                                        <div
                                                            key={mod.id}
                                                            className={`p-4 rounded-xl border transition-all ${
                                                                isActive
                                                                    ? 'bg-white border-slate-200 shadow-xs hover:border-slate-300'
                                                                    : 'bg-slate-50/80 border-slate-200/80'
                                                            }`}
                                                        >
                                                            {/* Top Row: Icon, Title, Status & Toggle */}
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                                                    <div className={`p-2.5 rounded-xl border flex-shrink-0 transition-colors ${
                                                                        isActive
                                                                            ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                                            : 'bg-slate-100 text-slate-400 border-slate-200'
                                                                    }`}>
                                                                        <ModIcon className="w-5 h-5" />
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-2 flex-wrap">
                                                                            <h4 className="font-bold text-slate-800 text-sm leading-tight">
                                                                                {mod.name}
                                                                            </h4>
                                                                            {mod.badge && (
                                                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                                                    {mod.badge}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="mt-1 flex items-center gap-2">
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold rounded-full ${
                                                                                isActive
                                                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                                            }`}>
                                                                                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                                                                                {isActive ? 'ATIVO NO SISTEMA' : 'DESATIVADO'}
                                                                            </span>
                                                                            {menuItemsCount > 0 && (
                                                                                <span className="text-[11px] text-slate-400">
                                                                                    • {menuItemsCount} {menuItemsCount === 1 ? 'tela' : 'telas'}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* iOS Toggle Switch */}
                                                                <button
                                                                    type="button"
                                                                    disabled={loadingCompany}
                                                                    onClick={() => handleToggleModule(mod.key, mod.name, isActive)}
                                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                                                                        isActive ? 'bg-emerald-600' : 'bg-slate-300'
                                                                    } ${loadingCompany ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                                    title={isActive ? `Clique para desativar ${mod.name}` : `Clique para ativar ${mod.name}`}
                                                                >
                                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                                                                        isActive ? 'translate-x-6' : 'translate-x-1'
                                                                    }`} />
                                                                </button>
                                                            </div>

                                                            {/* Description */}
                                                            <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                                                                {mod.description}
                                                            </p>

                                                            {/* Submodules: SST (CIPA & Brigada) */}
                                                            {mod.hasSstSubmodules && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                                                                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                                                        Sub-módulos e Normas de SST
                                                                    </div>
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                                        {/* CIPA NR-05 */}
                                                                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                                            <span className="text-slate-700 font-medium flex items-center gap-1.5">
                                                                                <Award className="w-3.5 h-3.5 text-amber-600" />
                                                                                CIPA (NR-05)
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                disabled={loadingCompany}
                                                                                onClick={() => handleToggleSubmodule('module_cipa_active', 'CIPA (NR-05)', companyForm.general_config?.module_cipa_active !== false)}
                                                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                                                    companyForm.general_config?.module_cipa_active !== false ? 'bg-emerald-600' : 'bg-slate-300'
                                                                                }`}
                                                                                title="Ativar/Desativar CIPA"
                                                                            >
                                                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                                                    companyForm.general_config?.module_cipa_active !== false ? 'translate-x-4.5' : 'translate-x-0.5'
                                                                                }`} />
                                                                            </button>
                                                                        </div>

                                                                        {/* Brigada de Incêndio NR-23 */}
                                                                        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                                            <span className="text-slate-700 font-medium flex items-center gap-1.5">
                                                                                <Flame className="w-3.5 h-3.5 text-rose-600" />
                                                                                Brigada (NR-23)
                                                                            </span>
                                                                            <button
                                                                                type="button"
                                                                                disabled={loadingCompany}
                                                                                onClick={() => handleToggleSubmodule('module_brigada_active', 'Brigada de Incêndio (NR-23)', companyForm.general_config?.module_brigada_active !== false)}
                                                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                                                    companyForm.general_config?.module_brigada_active !== false ? 'bg-emerald-600' : 'bg-slate-300'
                                                                                }`}
                                                                                title="Ativar/Desativar Brigada"
                                                                            >
                                                                                <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                                                    companyForm.general_config?.module_brigada_active !== false ? 'translate-x-4.5' : 'translate-x-0.5'
                                                                                }`} />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* SGQ Advanced Settings (Consolidated - Zero Duplication) */}
                                                            {mod.hasAdvancedSettings && (
                                                                <div className="mt-3 pt-3 border-t border-slate-100">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedModuleSettings(prev => ({ ...prev, [mod.id]: !prev[mod.id] }))}
                                                                        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                                                                    >
                                                                        <span className="flex items-center gap-2">
                                                                            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                                                                            Configurações Avançadas do SGQ (RNC & Notificações)
                                                                        </span>
                                                                        {isExpanded ? (
                                                                            <ChevronUp className="w-4 h-4 text-slate-500" />
                                                                        ) : (
                                                                            <ChevronDown className="w-4 h-4 text-slate-500" />
                                                                        )}
                                                                    </button>

                                                                    {isExpanded && (
                                                                        <div className="mt-3 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-5 text-xs">
                                                                            {/* Submódulo Controle Dimensional */}
                                                                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                                                                                <div>
                                                                                    <h5 className="font-bold text-slate-800">Controle Dimensional de Peças</h5>
                                                                                    <p className="text-slate-500 mt-0.5">Exibe planos de inspeção e histórico dimensional no SGQ.</p>
                                                                                </div>
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={loadingCompany}
                                                                                    onClick={() => handleToggleSubmodule('module_sgq_controle_dimensional', 'Controle Dimensional', companyForm.general_config?.module_sgq_controle_dimensional !== false)}
                                                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                                                                                        companyForm.general_config?.module_sgq_controle_dimensional !== false ? 'bg-emerald-600' : 'bg-slate-300'
                                                                                    }`}
                                                                                >
                                                                                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                                                                                        companyForm.general_config?.module_sgq_controle_dimensional !== false ? 'translate-x-4.5' : 'translate-x-0.5'
                                                                                    }`} />
                                                                                </button>
                                                                            </div>

                                                                            {/* RNC Numbering Config (Consolidated & Clean) */}
                                                                            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                                                                                <div>
                                                                                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                                                                                        <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                                                                                        Numeração Automática de RNC
                                                                                    </h5>
                                                                                    <p className="text-slate-500 mt-0.5">
                                                                                        Padrão gerado para novos relatórios de não conformidade. Marcadores: <code className="bg-slate-100 px-1 py-0.5 rounded">{'{YEAR}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">{'{MONTH}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded">{'{SEQ:4}'}</code>.
                                                                                    </p>
                                                                                </div>

                                                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                                    <div>
                                                                                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Formato do Número</label>
                                                                                        <input
                                                                                            type="text"
                                                                                            value={rncFormatForm}
                                                                                            onChange={e => setRncFormatForm(e.target.value)}
                                                                                            placeholder="Ex: RNC-{YEAR}-{SEQ:4}"
                                                                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                                                                                        />
                                                                                        <div className="mt-1 text-slate-500">
                                                                                            Prévia: <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                                                                                {rncFormatForm
                                                                                                    .replace('{YEAR}', new Date().getFullYear())
                                                                                                    .replace('{MONTH}', String(new Date().getMonth() + 1).padStart(2, '0'))
                                                                                                    .replace(/\{SEQ:(\d+)\}/, (_, n) => String(parseInt(rncNumberForm, 10) || 1).padStart(parseInt(n, 10), '0'))
                                                                                                    .replace('{SEQ}', String(parseInt(rncNumberForm, 10) || 1).padStart(4, '0'))
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>

                                                                                    <div>
                                                                                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Próximo Número Sequencial</label>
                                                                                        <input
                                                                                            type="number"
                                                                                            min="1"
                                                                                            value={rncNumberForm}
                                                                                            onChange={e => setRncNumberForm(e.target.value)}
                                                                                            className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                                                                                        />
                                                                                        <p className="mt-1 text-slate-400">A próxima RNC criada usará este sequencial.</p>
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex justify-end pt-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={loadingCompany}
                                                                                        onClick={handleRncConfigSubmit}
                                                                                        className="bg-teal-600 hover:bg-teal-700 text-white font-medium px-4 py-1.5 rounded-lg text-xs disabled:opacity-50 transition-colors shadow-xs"
                                                                                    >
                                                                                        {loadingCompany ? 'Salvando...' : 'Salvar Numeração de RNC'}
                                                                                    </button>
                                                                                </div>
                                                                            </div>

                                                                            {/* SGQ Notifications & Alerts */}
                                                                            <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                                                                                <div>
                                                                                    <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
                                                                                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                                                                                        Notificações e Alertas do SGQ
                                                                                    </h5>
                                                                                    <p className="text-slate-500 mt-0.5">
                                                                                        Usuários que receberão avisos de calibração vencendo e romaneios via E-mail / WhatsApp.
                                                                                    </p>
                                                                                </div>

                                                                                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                                                                    {usersList.filter(u => u.aprovado === 1).map(u => {
                                                                                        const sgqAlerts = companyForm.general_config?.sgq_alerts_users || [];
                                                                                        const userPref = sgqAlerts.find(x => x.id === u.idUsuario);
                                                                                        const isInGroup = !!userPref;

                                                                                        return (
                                                                                            <div key={u.idUsuario} className="flex items-center justify-between p-1.5 hover:bg-slate-50 rounded border-b border-slate-100 last:border-0">
                                                                                                <label className="flex items-center gap-2 cursor-pointer min-w-0">
                                                                                                    <input
                                                                                                        type="checkbox"
                                                                                                        checked={isInGroup}
                                                                                                        onChange={(e) => {
                                                                                                            let newUsers = [...sgqAlerts];
                                                                                                            if (e.target.checked) {
                                                                                                                newUsers.push({ id: u.idUsuario, email: true, whatsapp: true });
                                                                                                            } else {
                                                                                                                newUsers = newUsers.filter(x => x.id !== u.idUsuario);
                                                                                                            }
                                                                                                            setCompanyForm(prev => ({
                                                                                                                ...prev,
                                                                                                                general_config: { ...prev.general_config, sgq_alerts_users: newUsers }
                                                                                                            }));
                                                                                                        }}
                                                                                                        className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                                                                                                    />
                                                                                                    <span className="font-medium text-slate-700 truncate">{u.NomeCompleto}</span>
                                                                                                </label>

                                                                                                {isInGroup && (
                                                                                                    <div className="flex items-center gap-3 bg-slate-100 px-2 py-1 rounded border border-slate-200 text-[11px]">
                                                                                                        <label className="flex items-center gap-1 cursor-pointer">
                                                                                                            <input
                                                                                                                type="checkbox"
                                                                                                                checked={userPref.email}
                                                                                                                disabled={!u.email}
                                                                                                                onChange={(e) => {
                                                                                                                    const newUsers = sgqAlerts.map(x => x.id === u.idUsuario ? { ...x, email: e.target.checked } : x);
                                                                                                                    setCompanyForm(prev => ({
                                                                                                                        ...prev,
                                                                                                                        general_config: { ...prev.general_config, sgq_alerts_users: newUsers }
                                                                                                                    }));
                                                                                                                }}
                                                                                                                className="w-3 h-3 text-blue-600 rounded border-slate-300"
                                                                                                            /> E-mail
                                                                                                        </label>
                                                                                                        <label className="flex items-center gap-1 cursor-pointer">
                                                                                                            <input
                                                                                                                type="checkbox"
                                                                                                                checked={userPref.whatsapp}
                                                                                                                disabled={!u.telefone}
                                                                                                                onChange={(e) => {
                                                                                                                    const newUsers = sgqAlerts.map(x => x.id === u.idUsuario ? { ...x, whatsapp: e.target.checked } : x);
                                                                                                                    setCompanyForm(prev => ({
                                                                                                                        ...prev,
                                                                                                                        general_config: { ...prev.general_config, sgq_alerts_users: newUsers }
                                                                                                                    }));
                                                                                                                }}
                                                                                                                className="w-3 h-3 text-blue-600 rounded border-slate-300"
                                                                                                            /> WhatsApp
                                                                                                        </label>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        );
                                                                                    })}
                                                                                </div>

                                                                                {/* Message Templates */}
                                                                                <div className="space-y-2 pt-2">
                                                                                    <div>
                                                                                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Template WhatsApp</label>
                                                                                        <textarea
                                                                                            value={companyForm.general_config?.sgq_alerts_template_whatsapp || '⚠️ *Alerta SGQ - Calibração* ⚠️\nO instrumento {name} (Patrimônio: {patrimonio}) vencerá em {validade} ({dias} dias).'}
                                                                                            onChange={(e) => setCompanyForm(prev => ({
                                                                                                ...prev,
                                                                                                general_config: { ...prev.general_config, sgq_alerts_template_whatsapp: e.target.value }
                                                                                            }))}
                                                                                            rows={2}
                                                                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                                                                        />
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Template E-mail</label>
                                                                                        <textarea
                                                                                            value={companyForm.general_config?.sgq_alerts_template_email || 'Prezado(a),\n\nInformamos que o instrumento {name} (Patrimônio: {patrimonio}) possui calibração válida apenas até {validade} ({dias} dias restantes).\n\nPor favor, providencie a calibração.'}
                                                                                            onChange={(e) => setCompanyForm(prev => ({
                                                                                                ...prev,
                                                                                                general_config: { ...prev.general_config, sgq_alerts_template_email: e.target.value }
                                                                                            }))}
                                                                                            rows={2}
                                                                                            className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                                                                                        />
                                                                                    </div>
                                                                                </div>

                                                                                <div className="flex justify-end pt-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={loadingCompany}
                                                                                        onClick={async () => {
                                                                                            try {
                                                                                                setLoadingCompany(true);
                                                                                                await updateGeneralSettings({ general_config: companyForm.general_config });
                                                                                                alert('Configurações de notificação do SGQ salvas com sucesso!');
                                                                                            } catch (err) {
                                                                                                alert('Erro ao salvar notificações do SGQ: ' + err.message);
                                                                                            } finally {
                                                                                                setLoadingCompany(false);
                                                                                            }
                                                                                        }}
                                                                                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded-lg text-xs disabled:opacity-50 transition-colors shadow-xs"
                                                                                    >
                                                                                        {loadingCompany ? 'Salvando...' : 'Salvar Notificações do SGQ'}
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* MENU TAB */}



                {/* MENU TAB */}

                {activeTab === 'menu' && (

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-4xl">

                        <div className="flex items-center justify-between gap-3 mb-6 border-b pb-4">

                            <div className="flex items-center gap-3">

                                <Menu className="w-6 h-6 text-indigo-600" />

                                <div>

                                    <h2 className="text-lg font-bold text-slate-800">Personalização do Menu</h2>

                                    <p className="text-sm text-slate-500">Escolha quais módulos aparecem na barra lateral.</p>

                                </div>

                            </div>

                            <button

                                onClick={handleMenuSubmit}

                                disabled={loadingCompany}

                                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium transition-colors text-sm"

                            >

                                <Save className="w-4 h-4" />

                                {loadingCompany ? 'Salvando...' : 'Aplicar Mudanças'}

                            </button>

                        </div>



                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                            {MENU_GROUPS.map(group => (

                                <div key={group.id} className="bg-slate-50 p-4 rounded-lg border border-slate-100">

                                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-200 pb-2">{group.label}</h3>

                                    <div className="space-y-3">

                                        {group.items.map(item => {

                                            const isVisible = companyForm.menu_config?.[item.id] !== false;

                                            return (

                                                <div key={item.id} className="flex items-center justify-between">

                                                    <div className="flex items-center gap-2">

                                                        <item.icon className="w-4 h-4 text-slate-400" />

                                                        <span className="text-sm text-slate-700 font-medium">{item.label}</span>

                                                    </div>

                                                    <label className="relative inline-flex items-center cursor-pointer">

                                                        <input

                                                            type="checkbox"

                                                            className="sr-only peer"

                                                            checked={isVisible}

                                                            onChange={() => toggleMenuItem(item.id)}

                                                            disabled={item.id === 'config'}

                                                        />

                                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>

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



                {/* NOTIFICATIONS HISTORY TAB */}

                {activeTab === 'notifications' && <NotificationsHistoryTab />}



                {/* PENDING / APROVAÇÕES TAB */}

                {activeTab === 'pending' && (

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

                        <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-3">

                            <ShieldAlert className="w-6 h-6 text-orange-500" />

                            <div>

                                <h2 className="text-lg font-bold text-slate-800">Contas Aguardando Aprovação</h2>

                                <p className="text-sm text-slate-500">

                                    Estes perfis foram criados pela tela de Login, mas não possuem acesso ao sistema até que você aprove.

                                </p>

                            </div>

                        </div>

                        <div className="p-0 overflow-auto max-h-[600px]">

                            {pendingUsers.length === 0 ? (

                                <div className="p-12 text-center flex flex-col items-center">

                                    <Check className="w-12 h-12 text-green-300 mb-2" />

                                    <p className="text-slate-500 font-medium text-lg">Nenhum cadastro pendente!</p>

                                    <p className="text-slate-400 text-sm">Todos os usuários criados já foram avaliados.</p>

                                </div>

                            ) : (

                                <table className="w-full text-left text-sm text-slate-600">

                                    <thead className="bg-white text-xs uppercase font-semibold text-slate-500 sticky top-0 border-b border-slate-100">

                                        <tr>

                                            <th className="px-6 py-4">Nome Registrado</th>

                                            <th className="px-6 py-4">Login Desejado</th>

                                            <th className="px-6 py-4">E-mail Cadastrado</th>

                                            <th className="px-6 py-4">Tipo de Acesso (Assinar cargo)</th>

                                            <th className="px-6 py-4 text-right">Ação</th>

                                        </tr>

                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {pendingUsers.map(u => (

                                            <tr key={u.idUsuario} className="hover:bg-slate-50 transition">

                                                <td className="px-6 py-4 font-bold text-slate-800">{u.NomeCompleto}</td>

                                                <td className="px-6 py-4"><span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono text-xs">{u.Login}</span></td>

                                                <td className="px-6 py-4 text-blue-600">{u.email || '-'}</td>

                                                <td className="px-6 py-4">

                                                    <select 

                                                        className="w-full max-w-[200px] border border-slate-300 rounded p-1.5 focus:ring-2 focus:ring-blue-500 outline-none select-role-temp"

                                                        defaultValue={u.TipoUsuario || 'U'}

                                                        id={`role-${u.idUsuario}`}

                                                    >

                                                        {availableProfiles.map(p => (

                                                            <option key={p.code} value={p.code}>{p.name}</option>

                                                        ))}

                                                    </select>

                                                </td>

                                                <td className="px-6 py-4 text-right">

                                                    <div className="flex justify-end gap-2">

                                                        <button 
                                                            disabled={loading}
                                                            onClick={async () => {
                                                                if (window.confirm("Isso rejeitará a solicitação mantendo o usuário inativo. Tem certeza?")) {
                                                                    setLoading(true);
                                                                    try {
                                                                        await deleteUser(u.idUsuario);
                                                                        loadUsers();
                                                                    } catch (e) {
                                                                        alert('Erro ao rejeitar: ' + (e.response?.data?.error || e.message));
                                                                    } finally { setLoading(false); }
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 p-2 text-xs font-medium border border-transparent hover:border-red-200 rounded-lg bg-red-50"
                                                        >
                                                            Rejeitar
                                                        </button>

                                                        <button 

                                                            disabled={loading}

                                                            onClick={() => {

                                                                const selectedRole = document.getElementById(`role-${u.idUsuario}`).value;

                                                                handleApproveUser(u, selectedRole);

                                                            }}

                                                            className="bg-green-600 hover:bg-green-700 text-white font-medium p-2 px-4 rounded-lg flex items-center gap-2 transition"

                                                        >

                                                            {loading ? 'Aguarde...' : <><Check className="w-4 h-4"/> Aprovar e Dar Acesso</>}

                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        ))}

                                    </tbody>

                                </table>

                            )}

                        </div>

                    </div>

                )}



                {/* PROFILES TAB */}

                {activeTab === 'profiles' && (

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Form */}

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">

                            <div className="flex items-center gap-3 mb-6 border-b pb-4">

                                <Users className="w-6 h-6 text-indigo-600" />

                                <h2 className="text-lg font-bold text-slate-800">

                                    {editingProfile ? 'Editar Perfil' : 'Adicionar Perfil'}

                                </h2>

                            </div>

                            <form onSubmit={async (e) => {

                                e.preventDefault();

                                const { code, name, isAdmin, tipoPerfil } = profileForm;

                                const formattedCode = code.toUpperCase();

                                

                                if (!formattedCode || !name) return;

                                

                                const originalCode = editingProfile ? editingProfile.code : formattedCode;

                                const newProfiles = [...customProfiles.filter(p => p.code !== originalCode), { code: formattedCode, name, isAdmin, tipoPerfil }];

                                const newGeneralConfig = { ...companyForm.general_config, custom_profiles: newProfiles };

                                

                                try {

                                    setLoadingCompany(true);

                                    await updateGeneralSettings({ general_config: newGeneralConfig });

                                    setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));

                                    setProfileForm({ code: '', name: '', isAdmin: false, tipoPerfil: 'interno' });

                                    setEditingProfile(null);

                                    alert('Perfil salvo com sucesso!');

                                } catch (err) {

                                    alert('Erro ao salvar perfil: ' + err.message);

                                } finally {

                                    setLoadingCompany(false);

                                }

                            }} className="space-y-4">

                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Código (Ex: VEN)</label>

                                    <input required name="code" className="w-full p-2 border rounded-lg uppercase" placeholder="Código curto..." value={profileForm.code} onChange={e => setProfileForm({ ...profileForm, code: e.target.value })} />

                                </div>

                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Perfil</label>

                                    <input required name="name" className="w-full p-2 border rounded-lg" placeholder="Ex: Vendedor" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} />

                                </div>

                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Perfil</label>

                                    <select name="tipoPerfil" className="w-full p-2 border rounded-lg bg-white" value={profileForm.tipoPerfil} onChange={e => setProfileForm({ ...profileForm, tipoPerfil: e.target.value })}>

                                        <option value="interno">Interno (Funcionários)</option>

                                        <option value="externo">Externo (Fornecedores/Clientes)</option>

                                    </select>

                                </div>

                                <div className="flex items-center gap-2 mt-2">

                                    <input type="checkbox" name="isAdmin" id="isAdmin" className="w-4 h-4 text-indigo-600 rounded border-gray-300" checked={profileForm.isAdmin} onChange={e => setProfileForm({ ...profileForm, isAdmin: e.target.checked })} />

                                    <label htmlFor="isAdmin" className="text-sm text-slate-700">Acesso Total (Admin)</label>

                                </div>

                                <button

                                    type="submit"

                                    disabled={loadingCompany}

                                    className="w-full bg-indigo-600 text-white px-6 py-2 rounded-lg flex justify-center items-center gap-2 font-medium hover:bg-indigo-700 mt-4"

                                >

                                    {editingProfile ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}

                                    {loadingCompany ? 'Salvando...' : (editingProfile ? 'Atualizar Perfil' : 'Salvar Perfil')}

                                </button>

                                {editingProfile && (

                                    <button

                                        type="button"

                                        onClick={() => {

                                            setEditingProfile(null);

                                            setProfileForm({ code: '', name: '', isAdmin: false, tipoPerfil: 'interno' });

                                        }}

                                        className="w-full bg-slate-100 text-slate-600 px-6 py-2 rounded-lg hover:bg-slate-200 flex justify-center items-center gap-2 font-medium"

                                    >

                                        <X className="w-4 h-4" />

                                        Cancelar Edição

                                    </button>

                                )}

                            </form>

                        </div>

                        

                        {/* Profiles List */}

                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200">

                            <div className="p-6 border-b border-slate-100">

                                <h3 className="text-lg font-bold text-slate-800">Perfis de Acesso Cadastrados</h3>

                                <p className="text-sm text-slate-500">Controle e crie novos níveis de acesso para vincular aos usuários.</p>

                            </div>

                            <div className="p-0 overflow-auto">

                                <table className="w-full text-left text-sm text-slate-600">

                                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500">

                                        <tr>

                                            <th className="px-6 py-3">Código</th>

                                            <th className="px-6 py-3">Nome do Perfil</th>

                                            <th className="px-6 py-3 text-center">Tipo</th>

                                            <th className="px-6 py-3 text-center">Admin?</th>

                                            <th className="px-6 py-3 text-right">Ações</th>

                                        </tr>

                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {availableProfiles.map(p => (

                                            <tr key={p.code} className="hover:bg-slate-50 transition-colors">

                                                <td className="px-6 py-3 font-mono font-bold text-slate-700">{p.code}</td>

                                                <td className="px-6 py-3 font-medium text-slate-900">{p.name}</td>

                                                <td className="px-6 py-3 text-center">

                                                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${p.tipoPerfil === 'externo' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>

                                                        {p.tipoPerfil === 'externo' ? 'Externo' : 'Interno'}

                                                    </span>

                                                </td>

                                                <td className="px-6 py-3 text-center">

                                                    {p.isAdmin ? (

                                                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">Sim</span>

                                                    ) : (

                                                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">Não</span>

                                                    )}

                                                </td>

                                                <td className="px-6 py-3 text-right">

                                                    <div className="flex items-center justify-end gap-2">

                                                        <button

                                                            onClick={() => {

                                                                setEditingProfile(p);

                                                                setProfileForm({

                                                                    code: p.code,

                                                                    name: p.name,

                                                                    isAdmin: !!p.isAdmin,

                                                                    tipoPerfil: p.tipoPerfil || 'interno'

                                                                });

                                                            }}

                                                            className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-full transition-colors"

                                                            title="Editar perfil"

                                                        >

                                                            <Edit className="w-4 h-4" />

                                                        </button>

                                                        <button

                                                            onClick={async () => {

                                                                if (window.confirm(`Tem certeza que deseja remover o perfil ${p.name}?`)) {

                                                                    const newProfiles = customProfiles.filter(prof => prof.code !== p.code);

                                                                    const newGeneralConfig = { ...companyForm.general_config, custom_profiles: newProfiles };

                                                                    try {

                                                                        setLoadingCompany(true);

                                                                        await updateGeneralSettings({ general_config: newGeneralConfig });

                                                                        setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));

                                                                        if (editingProfile && editingProfile.code === p.code) {

                                                                            setEditingProfile(null);

                                                                            setProfileForm({ code: '', name: '', isAdmin: false, tipoPerfil: 'interno' });

                                                                        }

                                                                    } catch (err) {

                                                                        alert('Erro ao excluir: ' + err.message);

                                                                    } finally {

                                                                        setLoadingCompany(false);

                                                                    }

                                                                }

                                                            }}

                                                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"

                                                            title="Remover perfil"

                                                        >

                                                            <Trash2 className="w-4 h-4" />

                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        ))}

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    </div>

                )}



                {/* USERS TAB */}

                {activeTab === 'users' && (
                    <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* Form */}

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">

                            <div className="flex items-center gap-3 mb-6 border-b pb-4">

                                <UserPlus className="w-6 h-6 text-green-600" />

                                <h2 className="text-lg font-bold text-slate-800">

                                    {editingUser ? 'Editar Usuário' : 'Novo Usuário'}

                                </h2>

                            </div>



                            <form onSubmit={handleUserSubmit} className="space-y-4">



                                {/* Photo Section */}

                                <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-slate-50">

                                    <div className="relative">

                                        {userForm.foto ? (

                                            <img src={userForm.foto} alt="Preview da Foto do Usuário" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />

                                        ) : (

                                            <div className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">

                                                <Camera className="w-8 h-8" />

                                            </div>

                                        )}

                                        {userForm.foto && (

                                            <button

                                                type="button"

                                                onClick={() => setUserForm({ ...userForm, foto: null })}

                                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600"

                                                title="Remover foto"

                                            >

                                                <X className="w-3 h-3" />

                                            </button>

                                        )}

                                    </div>



                                    <div className="flex gap-2 w-full">

                                        <label className="flex-1 cursor-pointer bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center justify-center gap-2 transition-colors">

                                            <Upload className="w-4 h-4" />

                                            Upload

                                            <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />

                                        </label>

                                        <label className="flex-1 cursor-pointer bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-200 flex items-center justify-center gap-2 transition-colors">

                                            <Camera className="w-4 h-4" />

                                            Câmera

                                            <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handlePhotoUpload} />

                                        </label>

                                    </div>

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>

                                    <input

                                        required

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.nome}

                                        onChange={e => setUserForm({ ...userForm, nome: e.target.value })}

                                        placeholder="Ex: João Silva"

                                    />

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone (Opcional)</label>

                                    <input

                                        type="tel"

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.telefone}

                                        onChange={e => setUserForm({ ...userForm, telefone: formatPhone(e.target.value) })}

                                        onBlur={e => {

                                            if (!userForm.whatsapp && userForm.telefone) {

                                                setUserForm({ ...userForm, whatsapp: userForm.telefone });

                                            }

                                        }}

                                        placeholder="(99) 99999-9999"

                                        maxLength="15"

                                    />

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (Alertas automáticos)</label>

                                    <input

                                        type="tel"

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.whatsapp}

                                        onChange={e => setUserForm({ ...userForm, whatsapp: formatPhone(e.target.value) })}

                                        placeholder="(99) 99999-9999"

                                        maxLength="15"

                                    />

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Login</label>

                                    <input

                                        required

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.login}

                                        onChange={e => setUserForm({ ...userForm, login: e.target.value })}

                                        placeholder="usuario.sistema"

                                    />

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">

                                        Senha {editingUser && <span className="text-xs font-normal text-slate-400">(Deixe em branco para manter)</span>}

                                    </label>

                                    <input

                                        required={!editingUser}

                                        type="password"

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.senha}

                                        onChange={e => setUserForm({ ...userForm, senha: e.target.value })}

                                        placeholder={editingUser ? "****** (Sem alteração)" : "******"}

                                    />

                                </div>



                                {(() => {

                                    const isExternal = availableProfiles.find(p => p.code === userForm.tipo)?.tipoPerfil === 'externo';

                                    return (

                                        <>

                                            <div>

                                                <label className="block text-sm font-medium text-slate-700 mb-1">Permissão</label>

                                                <select

                                                    className="w-full p-2 border rounded-lg bg-white"

                                                    value={userForm.tipo}

                                                    onChange={e => setUserForm({ ...userForm, tipo: e.target.value })}

                                                >

                                                    {availableProfiles.map(p => (

                                                        <option key={p.code} value={p.code}>{p.name} {p.tipoPerfil === 'externo' ? '(Externo)' : ''}</option>

                                                    ))}

                                                </select>

                                            </div>



                                            {isExternal && (
                                                <>
                                                    <div className="mt-4">
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Vínculo Externo</label>
                                                        <div className="flex gap-4">
                                                            <label className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name="tipoExterno"
                                                                    value="fornecedor"
                                                                    checked={userForm.tipoExterno === 'fornecedor'}
                                                                    onChange={e => setUserForm({ ...userForm, tipoExterno: e.target.value })}
                                                                />
                                                                Fornecedor
                                                            </label>
                                                            <label className="flex items-center gap-2">
                                                                <input
                                                                    type="radio"
                                                                    name="tipoExterno"
                                                                    value="cliente"
                                                                    checked={userForm.tipoExterno === 'cliente'}
                                                                    onChange={e => setUserForm({ ...userForm, tipoExterno: e.target.value })}
                                                                />
                                                                Cliente
                                                            </label>
                                                        </div>
                                                    </div>

                                                    {userForm.tipoExterno === 'fornecedor' ? (
                                                        <div className="mt-4">
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">Fornecedor Associado (Protheus)</label>
                                                            <select
                                                                className="w-full p-2 border rounded-lg bg-white"
                                                                value={`${userForm.idFornecedor}|${userForm.lojaFornecedor}`}
                                                                onChange={e => {
                                                                    const [id, loja] = e.target.value.split('|');
                                                                    setUserForm({ ...userForm, idFornecedor: id || '', lojaFornecedor: loja || '' });
                                                                }}
                                                                required={isExternal && userForm.tipoExterno === 'fornecedor'}
                                                            >
                                                                <option value="|">Selecione o Fornecedor...</option>
                                                                {protheusFornecedores.map(f => (
                                                                    <option key={`${f.a2_cod}|${f.a2_loja}`} value={`${f.a2_cod}|${f.a2_loja}`}>
                                                                        {f.a2_cod} - {f.a2_nome} (Loja {f.a2_loja})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    ) : (
                                                        <div className="mt-4">
                                                            <label className="block text-sm font-medium text-slate-700 mb-1">Cliente Associado (Protheus)</label>
                                                            <select
                                                                className="w-full p-2 border rounded-lg bg-white"
                                                                value={`${userForm.idCliente}|${userForm.lojaCliente}`}
                                                                onChange={e => {
                                                                    const [id, loja] = e.target.value.split('|');
                                                                    setUserForm({ ...userForm, idCliente: id || '', lojaCliente: loja || '' });
                                                                }}
                                                                required={isExternal && userForm.tipoExterno === 'cliente'}
                                                            >
                                                                <option value="|">Selecione o Cliente...</option>
                                                                {protheusClientes.map(c => (
                                                                    <option key={`${c.a1_cod}|${c.a1_loja}`} value={`${c.a1_cod}|${c.a1_loja}`}>
                                                                        {c.a1_cod} - {c.a1_nome} (Loja {c.a1_loja})
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}



                                                    <div className="mt-4">
                                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                                            Pedidos Lynx Autorizados (Separados por vírgula)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            className="w-full p-2 border rounded-lg bg-white"
                                                            placeholder="Ex: 004618, 004619, 004620"
                                                            value={userForm.pedidos_autorizados || ''}
                                                            onChange={e => setUserForm({ ...userForm, pedidos_autorizados: e.target.value })}
                                                        />
                                                        <p className="text-[11px] text-slate-500 mt-1">
                                                            Pedidos extras para acesso manual. Caso "Tipo de Vínculo" seja "Cliente", o usuário já terá acesso padrão a todos os pedidos daquele respectivo cliente no Protheus.
                                                        </p>
                                                    </div>

                                                </>

                                            )}

                                        </>

                                    );

                                })()}



                                <div className="grid grid-cols-2 gap-4">

                                    <div>

                                        <label className="block text-sm font-medium text-slate-700 mb-1">Setor</label>

                                        <input

                                            className="w-full p-2 border rounded-lg"

                                            value={userForm.setor}

                                            onChange={e => setUserForm({ ...userForm, setor: e.target.value })}

                                            placeholder="Ex: Projeto"

                                        />

                                    </div>

                                    <div>

                                        <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>

                                        <input

                                            className="w-full p-2 border rounded-lg"

                                            value={userForm.funcao}

                                            onChange={e => setUserForm({ ...userForm, funcao: e.target.value })}

                                            placeholder="Ex: Projetista"

                                        />

                                    </div>

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">

                                        E-mail Corporativo {availableProfiles.find(p => p.code === userForm.tipo)?.tipoPerfil === 'externo' && <span className="text-red-500">*</span>}

                                    </label>

                                    <input

                                        type="email"

                                        required={availableProfiles.find(p => p.code === userForm.tipo)?.tipoPerfil === 'externo'}

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.email}

                                        onChange={e => setUserForm({ ...userForm, email: e.target.value })}

                                        placeholder="usuario@lynxems.com.br"

                                    />

                                </div>



                                <div>

                                    <label className="block text-sm font-medium text-slate-700 mb-1">Observações / Descrição</label>

                                    <textarea

                                        className="w-full p-2 border rounded-lg"

                                        value={userForm.observacoes}

                                        onChange={e => setUserForm({ ...userForm, observacoes: e.target.value })}

                                        placeholder="Informações adicionais..."

                                        rows="3"

                                    />

                                </div>



                                <div className="flex items-center gap-2">

                                    <input

                                        type="checkbox"

                                        id="tem_pc"

                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"

                                        checked={userForm.tem_pc}

                                        onChange={e => setUserForm({ ...userForm, tem_pc: e.target.checked })}

                                    />

                                    <label htmlFor="tem_pc" className="text-sm font-medium text-slate-700 select-none">

                                        Possui Computador?

                                    </label>

                                </div>



                                <div className="pt-4 space-y-2">

                                    <button

                                        type="submit"

                                        disabled={loading}

                                        className={`w-full text-white px-6 py-2 rounded-lg flex justify-center items-center gap-2 font-medium ${editingUser ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}

                                    >

                                        {editingUser ? <Save className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}

                                        {loading ? 'Salvando...' : (editingUser ? 'Atualizar Usuário' : 'Cadastrar Usuário')}

                                    </button>



                                    {editingUser && (

                                        <button

                                            type="button"

                                            onClick={cancelEditing}

                                            className="w-full bg-slate-100 text-slate-600 px-6 py-2 rounded-lg hover:bg-slate-200 flex justify-center items-center gap-2 font-medium"

                                        >

                                            <X className="w-4 h-4" />

                                            Cancelar Edição

                                        </button>

                                    )}

                                </div>

                            </form>

                        </div>



                        {/* User List */}

                        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[calc(100vh-14rem)]">

                            <div className="p-6 border-b border-slate-100">

                                <div className="flex justify-between items-center mb-4 print:hidden">

                                    <h3 className="text-lg font-bold text-slate-800">Usuários Cadastrados</h3>

                                    <div className="flex items-center gap-3">

                                        {selectedUsers.size > 0 && (

                                            <div className="flex items-center gap-2 border-r border-slate-200 pr-3">

                                                <button

                                                    onClick={() => handleSendCredentials('email')}

                                                    disabled={!!sendingCredentials}

                                                    className="bg-sky-600 text-white pl-3 pr-4 py-1.5 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-60 flex items-center gap-2 transition-all shadow-sm"

                                                    title={`Enviar por E-mail para ${selectedUsers.size} usuário(s)`}

                                                >

                                                    {sendingCredentials === 'email' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}

                                                    {sendingCredentials === 'email' ? 'Enviando...' : `E-mail`}

                                                </button>

                                                <button

                                                    onClick={() => handleSendCredentials('whatsapp')}

                                                    disabled={!!sendingCredentials}

                                                    className="bg-emerald-600 text-white pl-3 pr-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 flex items-center gap-2 transition-all shadow-sm"

                                                    title={`Enviar por WhatsApp para ${selectedUsers.size} usuário(s)`}

                                                >

                                                    {sendingCredentials === 'whatsapp' ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                                                    {sendingCredentials === 'whatsapp' ? 'Enviando...' : `WhatsApp`}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setBulkTargetProfile(availableProfiles[0]?.code || 'U');
                                                        setBulkProfileModalOpen(true);
                                                    }}
                                                    disabled={!!sendingCredentials || bulkUpdating}
                                                    className="bg-indigo-600 text-white pl-3 pr-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2 transition-all shadow-sm"
                                                    title={`Trocar Grupo de Permissão de ${selectedUsers.size} usuário(s)`}
                                                >
                                                    <Shield className="w-4 h-4" />
                                                    <span>Grupo de Permissão ({selectedUsers.size})</span>
                                                </button>
                                            </div>
                                        )}

                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full">

                                            {filteredUsers.length} de {usersList.length} Usuários

                                        </span>

                                        <button

                                            onClick={handlePrintReport}

                                            className="bg-slate-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-slate-900 flex items-center gap-2 transition-colors"

                                            title="Gerar Relatório PDF"

                                        >

                                            <Printer className="w-4 h-4" />

                                            Relatório

                                        </button>

                                    </div>

                                </div>



                                {/* Print Header (Only visible when printing) */}

                                <div className="hidden print:block text-center mb-8 border-b-2 border-slate-800 pb-4">

                                    <h2 className="text-2xl font-bold text-slate-900 uppercase tracking-widest">Relatório de Usuários</h2>

                                    <p className="text-slate-500 mt-2">Documento Oficial - {new Date().toLocaleDateString('pt-BR')}</p>

                                    <p className="text-slate-500 text-sm mt-1">Total de {filteredUsers.length} usuário(s) listado(s)</p>

                                </div>



                                {/* Filters */}

                                <div className="flex flex-col md:flex-row gap-3 print:hidden">

                                    <div className="relative flex-1">

                                        <input

                                            type="text"

                                            placeholder="Buscar por nome ou login..."

                                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"

                                            value={userFilter}

                                            onChange={(e) => setUserFilter(e.target.value)}

                                        />

                                        <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />

                                        </svg>

                                        {userFilter && (

                                            <button

                                                onClick={() => setUserFilter('')}

                                                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"

                                            >

                                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />

                                                </svg>

                                            </button>

                                        )}

                                    </div>

                                    <select

                                        className="w-full md:w-36 py-2 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"

                                        value={pcFilter}

                                        onChange={(e) => setPcFilter(e.target.value)}

                                    >

                                        <option value="all">Tem PC? (Todos)</option>

                                        <option value="yes">Sim</option>

                                        <option value="no">Não</option>

                                    </select>

                                    <select

                                        className="w-full md:w-36 py-2 px-3 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"

                                        value={typeFilter}

                                        onChange={(e) => setTypeFilter(e.target.value)}

                                    >

                                        <option value="all">Tipo (Todos)</option>

                                        {customProfiles.map(p => (

                                            <option key={p.code} value={p.code}>{p.name}</option>

                                        ))}

                                    </select>

                                    {(userFilter || pcFilter !== 'all' || typeFilter !== 'all') && (

                                        <button

                                            onClick={() => {

                                                setUserFilter('');

                                                setPcFilter('all');

                                                setTypeFilter('all');

                                            }}

                                            className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 shrink-0 flex items-center transition-colors"

                                            title="Limpar filtros"

                                        >

                                            <X className="w-5 h-5" />

                                        </button>

                                    )}

                                </div>

                            </div>



                            <div className="flex-1 overflow-auto p-0">

                                <table className="w-full text-left text-sm text-slate-600">

                                    <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 sticky top-0">

                                        <tr>

                                            <th className="px-3 py-3 w-10 print:hidden">

                                                <input

                                                    type="checkbox"

                                                    className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500 cursor-pointer"

                                                    checked={filteredUsers.length > 0 && selectedUsers.size === filteredUsers.length}

                                                    onChange={toggleSelectAll}

                                                    title="Selecionar/Desmarcar todos"

                                                />

                                            </th>

                                            <th className="px-6 py-3">Nome</th>

                                            <th className="px-6 py-3">Login</th>

                                            <th className="px-6 py-3">WhatsApp</th>

                                            <th className="px-6 py-3">E-mail</th>

                                            <th className="px-6 py-3">Setor/Função</th>

                                            <th className="px-6 py-3 min-w-[150px]">Observações</th>

                                            <th className="px-6 py-3 text-center">Tem PC?</th>

                                            <th className="px-6 py-3">Tipo</th>

                                            <th className="px-6 py-3 text-right print:hidden">Ações</th>

                                        </tr>

                                    </thead>

                                    <tbody className="divide-y divide-slate-100">

                                        {filteredUsers.map(u => (

                                            <tr key={u.idUsuario} className={`transition-colors ${selectedUsers.has(u.idUsuario) ? 'bg-sky-50/60' : editingUser?.idUsuario === u.idUsuario ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>

                                                <td className="px-3 py-3 print:hidden">

                                                    <input

                                                        type="checkbox"

                                                        className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500 cursor-pointer"

                                                        checked={selectedUsers.has(u.idUsuario)}

                                                        onChange={() => toggleUserSelection(u.idUsuario)}

                                                    />

                                                </td>

                                                <td className="px-6 py-3 font-medium text-slate-900">

                                                    <div className="flex items-center gap-3">

                                                        {u.fotoUsuario ? (

                                                            <img src={u.fotoUsuario} alt="Foto do Usuário na Lista" className="w-8 h-8 rounded-full object-cover border border-slate-200" />

                                                        ) : (

                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs ring-1 ring-slate-200">

                                                                {(u.NomeCompleto || 'U').charAt(0).toUpperCase()}

                                                            </div>

                                                        )}

                                                        <div>

                                                            <div>{u.NomeCompleto}</div>

                                                        </div>

                                                    </div>

                                                </td>

                                                <td className="px-6 py-3">{u.Login}</td>

                                                <td className="px-6 py-3 whitespace-nowrap">{u.whatsapp || '-'}</td>

                                                <td className="px-6 py-3 whitespace-nowrap">{u.email || '-'}</td>

                                                <td className="px-6 py-3 text-xs w-48">

                                                    <div className="text-slate-700 font-medium">{u.Setor || '-'}</div>

                                                    <div className="text-slate-500">{u.Funcao || '-'}</div>

                                                </td>

                                                <td className="px-6 py-3 text-xs">

                                                    <div className="text-slate-500 max-w-[200px] break-words whitespace-normal leading-relaxed" title={u.Observacoes}>

                                                        {u.Observacoes || '-'}

                                                    </div>

                                                </td>

                                                <td className="px-6 py-3 text-center">

                                                    {u.TemPC === 1

                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">Sim</span>

                                                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">Não</span>

                                                    }

                                                </td>

                                                <td className="px-6 py-3">

                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${customProfiles.find(p => p.code === u.TipoUsuario)?.isAdmin ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-800'}`}>

                                                        {customProfiles.find(p => p.code === u.TipoUsuario)?.name || u.TipoUsuario}

                                                    </span>

                                                </td>

                                                <td className="px-6 py-3 text-right print:hidden">

                                                    <div className="flex justify-end gap-2">

                                                        <button

                                                            onClick={() => startEditing(u)}

                                                            className="text-blue-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-full transition-colors"

                                                            title="Editar usuário"

                                                        >

                                                            <Edit className="w-4 h-4" />

                                                        </button>

                                                        <button

                                                            onClick={async () => {

                                                                if (u.TipoUsuario === 'SA' && user?.tipo !== 'SA') {

                                                                     alert('Acesso Negado: Apenas SuperAdmins podem desativar usuários SuperAdmin (SA).');

                                                                     return;

                                                                }

                                                                if (window.confirm(`Tem certeza que deseja desativar o usuário ${u.NomeCompleto}?`)) {

                                                                   try {

                                                                       await deleteUser(u.idUsuario);

                                                                       loadUsers();

                                                                   } catch (e) {

                                                                       alert('Erro ao desativar: ' + (e.response?.data?.error || e.message));

                                                                   }

                                                                }

                                                            }}

                                                            className="text-amber-500 hover:text-amber-700 p-2 hover:bg-amber-50 rounded-full transition-colors"
                                                            title="Desativar usuário"
                                                        >
                                                            <UserX className="w-4 h-4" />
                                                        </button>

                                                    </div>

                                                </td>

                                            </tr>

                                        ))}

                                        {filteredUsers.length === 0 && (

                                            <tr>

                                                <td colSpan="8" className="px-6 py-12 text-center text-slate-400">

                                                    Nenhum usuário encontrado.

                                                </td>

                                            </tr>

                                        )}

                                    </tbody>

                                </table>

                            </div>

                        </div>

                    </div>

                    {/* Modal para Trocar Grupo de Permissão em Lote */}
                    {bulkProfileModalOpen && (
                        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-fadeIn">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 text-base">Alterar Grupo de Permissão</h3>
                                            <p className="text-xs text-slate-500 font-medium">
                                                {selectedUsers.size} usuário(s) selecionado(s)
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setBulkProfileModalOpen(false)}
                                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="mt-5 space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider">
                                            Novo Grupo / Perfil de Acesso:
                                        </label>
                                        <select
                                            value={bulkTargetProfile}
                                            onChange={(e) => setBulkTargetProfile(e.target.value)}
                                            className="w-full border border-slate-300 rounded-xl p-3 text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-medium"
                                        >
                                            {availableProfiles.map(p => (
                                                <option key={p.code} value={p.code}>
                                                    {p.name} ({p.code})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100">
                                        <label className="flex items-start gap-2.5 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={bulkCopyPermissions}
                                                onChange={(e) => setBulkCopyPermissions(e.target.checked)}
                                                className="mt-0.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                            />
                                            <div className="text-xs">
                                                <span className="font-semibold text-indigo-950 block">Sincronizar permissões de telas</span>
                                                <span className="text-indigo-800/80 leading-relaxed block mt-0.5">
                                                    Copia a matriz de permissões das telas do grupo selecionado para todos os usuários escolhidos.
                                                </span>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={() => setBulkProfileModalOpen(false)}
                                            disabled={bulkUpdating}
                                            className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBulkProfileChange}
                                            disabled={bulkUpdating}
                                            className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 shadow-sm disabled:opacity-60 transition-all"
                                        >
                                            {bulkUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            {bulkUpdating ? 'Aplicando...' : 'Aplicar Alterações'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    </>
                )}






                {/* AI TAB */}

                {activeTab === 'ai' && (

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

                        <PCPMetalConfig />

                    </div>

                )}



                {/* PERMISSIONS TAB */}

                {activeTab === 'permissions' && (

                    <div className="space-y-6 max-w-6xl animate-fadeIn">

                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

                            <div className="flex items-center justify-between gap-3 mb-6 border-b pb-4">

                                <div className="flex items-center gap-3">

                                    <Shield className="w-6 h-6 text-indigo-600" />

                                    <div>

                                        <h2 className="text-lg font-bold text-slate-800">Permissões por Usuário</h2>

                                        <p className="text-sm text-slate-500">Defina o que cada usuário pode acessar e fazer em cada tela.</p>

                                    </div>

                                </div>

                                    {permSelectedUser && (

                                        <button

                                            onClick={handleSavePermissions}

                                            disabled={permSaving}

                                            className="bg-indigo-600 text-white px-5 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2 font-medium transition-colors text-sm shadow-sm"

                                        >

                                            <Save className="w-4 h-4" />

                                            {permSaving ? 'Salvando...' : (typeof permSelectedUser === 'string' && permSelectedUser.startsWith('PROFILE_') ? 'Salvar para Todos do Perfil' : 'Salvar Permissões')}

                                        </button>

                                    )}

                            </div>



                            {/* User selector */}

                            <div className="mb-6">

                                <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Usuário ou Perfil (Lote):</label>

                                <select

                                    className="w-full md:w-96 p-3 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

                                    value={permSelectedUser || ''}

                                    onChange={(e) => handlePermUserChange(e.target.value)}

                                >

                                    <option value="">-- Selecione --</option>

                                    

                                    <optgroup label="Aplicar a todos de um Perfil (Lote)">

                                        {availableProfiles.map(p => (

                                            <option key={`PROFILE_${p.code}`} value={`PROFILE_${p.code}`}>Todos os(as) {p.name}</option>

                                        ))}

                                    </optgroup>



                                    <optgroup label="Usuários Individuais">

                                    {usersList.filter(u => !(customProfiles.find(p => p.code === u.TipoUsuario)?.isAdmin || u.TipoUsuario === 'A' || u.TipoUsuario === 'SA') && (u.TipoUsuario !== 'SA' || user?.tipo === 'SA')).map(u => (

                                        <option key={u.idUsuario} value={u.idUsuario}>

                                            {u.NomeCompleto} ({u.Login}) - {customProfiles.find(p => p.code === u.TipoUsuario)?.name || u.TipoUsuario}

                                        </option>

                                    ))}

                                    </optgroup>

                                    <optgroup label="Administradores (acesso total)">

                                        {usersList.filter(u => (customProfiles.find(p => p.code === u.TipoUsuario)?.isAdmin || u.TipoUsuario === 'A' || u.TipoUsuario === 'SA') && (u.TipoUsuario !== 'SA' || user?.tipo === 'SA')).map(u => (

                                            <option key={u.idUsuario} value={u.idUsuario}>

                                                {u.NomeCompleto} ({u.Login}) - {customProfiles.find(p => p.code === u.TipoUsuario)?.name || (u.TipoUsuario === 'SA' ? 'SuperAdmin' : 'Admin')}

                                            </option>

                                        ))}

                                    </optgroup>

                                </select>

                            </div>



                            {/* Quick actions */}

                            {permSelectedUser && !permLoading && (

                                <div className="flex gap-3 mb-6">

                                    <button

                                        onClick={() => setAllPermissions(true)}

                                        className="px-4 py-2 text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"

                                    >

                                        ✅ Dar Acesso Total

                                    </button>

                                    <button

                                        onClick={() => setAllPermissions(false)}

                                        className="px-4 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"

                                    >

                                        🚫 Remover Tudo

                                    </button>

                                </div>

                            )}



                            {/* Permission Matrix */}

                            {permLoading ? (

                                <div className="flex items-center justify-center py-16">

                                    <div className="h-8 w-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />

                                </div>

                            ) : permSelectedUser ? (

                                <div className="space-y-4">

                                    {MENU_GROUPS.map(group => {

                                        const isExpanded = permExpandedGroups[group.id] !== false;

                                        const allItems = group.items.filter(i => i.id !== 'config');

                                        if (allItems.length === 0) return null;

                                        const allChecked = allItems.every(i => permMatrix[i.id]?.can_view);



                                        return (

                                            <div key={group.id} className="border border-slate-200 rounded-xl overflow-hidden">

                                                {/* Group Header */}

                                                <div

                                                    className="flex items-center justify-between px-5 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"

                                                    onClick={() => setPermExpandedGroups(prev => ({ ...prev, [group.id]: !isExpanded }))}

                                                >

                                                    <div className="flex items-center gap-3">

                                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}

                                                        <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">{group.label}</span>

                                                        <span className="text-[10px] text-slate-400 bg-slate-200 px-2 py-0.5 rounded-full">

                                                            {allItems.filter(i => permMatrix[i.id]?.can_view).length}/{allItems.length}

                                                        </span>

                                                    </div>

                                                    <button

                                                        onClick={(e) => { e.stopPropagation(); toggleGroupAll(allItems, !allChecked); }}

                                                        className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${allChecked ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'

                                                            }`}

                                                    >

                                                        {allChecked ? 'Desmarcar Todos' : 'Marcar Todos'}

                                                    </button>

                                                </div>



                                                {/* Items */}

                                                {isExpanded && (

                                                    <div className="divide-y divide-slate-100">

                                                        {/* Header row */}

                                                        <div className="grid grid-cols-[1fr_80px_80px_80px_80px] px-5 py-2 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">

                                                            <span>Página</span>

                                                            <span className="text-center">Ver</span>

                                                            <span className="text-center">Criar</span>

                                                            <span className="text-center">Editar</span>

                                                            <span className="text-center">Excluir</span>

                                                        </div>

                                                        {allItems.map(item => {

                                                            const p = permMatrix[item.id] || { can_view: false, can_create: false, can_edit: false, can_delete: false };

                                                            return (

                                                                <div key={item.id} className="grid grid-cols-[1fr_80px_80px_80px_80px] px-5 py-3 items-center hover:bg-slate-50 transition-colors">

                                                                    <div className="flex items-center gap-2">

                                                                        <item.icon className="w-4 h-4 text-slate-400" />

                                                                        <span className="text-sm text-slate-700 font-medium">{item.label}</span>

                                                                    </div>

                                                                    {['view', 'create', 'edit', 'delete'].map(action => (

                                                                        <div key={action} className="flex justify-center">

                                                                            <button

                                                                                onClick={() => togglePerm(item.id, action)}

                                                                                className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${p[`can_${action}`]

                                                                                    ? 'bg-indigo-600 border-indigo-600 text-white'

                                                                                    : 'bg-white border-slate-300 text-transparent hover:border-indigo-300'

                                                                                    }`}

                                                                            >

                                                                                <Check className="w-4 h-4" />

                                                                            </button>

                                                                        </div>

                                                                    ))}

                                                                </div>

                                                            );

                                                        })}

                                                    </div>

                                                )}

                                            </div>

                                        );

                                    })}



                                    {/* Ações Especiais / Permissões de Produção */}

                                    <div className="border border-slate-200 rounded-xl overflow-hidden mt-6">

                                        <div className="flex items-center justify-between px-5 py-3 bg-indigo-50 border-b border-slate-200">

                                            <div className="flex items-center gap-3">

                                                <span className="text-sm font-bold text-indigo-800 uppercase tracking-wider">Ações de Produção / PCP</span>

                                            </div>

                                        </div>

                                        <div className="divide-y divide-slate-100">

                                            <div className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors">

                                                <div>

                                                    <span className="text-sm text-slate-700 font-bold block">Apontamento Multi-Operação (Baixa Automática)</span>

                                                    <span className="text-xs text-slate-500">Permitir que este usuário/perfil aponte operações anteriores pendentes da OP de uma só vez.</span>

                                                </div>

                                                <button

                                                    onClick={(e) => { e.stopPropagation(); togglePerm('action_pcp_multi_appointment', 'view'); }}

                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${permMatrix['action_pcp_multi_appointment']?.can_view ? 'bg-indigo-600' : 'bg-slate-200'}`}

                                                >

                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${permMatrix['action_pcp_multi_appointment']?.can_view ? 'translate-x-6' : 'translate-x-1'}`} />

                                                </button>

                                            </div>

                                        </div>

                                    </div>



                                </div>

                            ) : (

                                <div className="flex flex-col items-center justify-center py-16 text-center">

                                    <Shield className="w-12 h-12 text-slate-300 mb-3" />

                                    <p className="text-slate-400 font-medium">Selecione um usuário acima para gerenciar suas permissões.</p>

                                    <p className="text-xs text-slate-400 mt-1">Administradores (Admin) possuem acesso total automaticamente caso não tenham permissões específicas definidas. Exceção: os itens de "Acessos Sensíveis (RH/Financeiro)" precisam ser marcados manualmente mesmo para Admin.</p>

                                </div>

                            )}

                        </div>

                    </div>

                )}



                {/* WINSCP TAB */}

                {activeTab === 'winscp' && (

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

                        <WinSCPTab />

                    </div>

                )}



                {/* lynx TAB */}

                {activeTab === 'lynx' && (

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

                        <LynxConfigTab />

                    </div>

                )}



            </div>

        </div>

    );

}



// ──── Histórico unificado de notificações (Email + WhatsApp) ─────────────────

function NotificationsHistoryTab() {

    const [logs, setLogs]       = useState([]);

    const [total, setTotal]     = useState(0);

    const [loading, setLoading] = useState(true);

    const [offset, setOffset]   = useState(0);

    const [channel, setChannel] = useState('all');

    const LIMIT = 100;



    const load = useCallback(async (off = 0, ch = channel) => {

        setLoading(true);

        try {

            const { data } = await api.get(`/whatsapp/logs?limit=${LIMIT}&offset=${off}&channel=${ch}`);

            setLogs(data.rows || []);

            setTotal(data.total || 0);

            setOffset(off);

        } catch (e) {

            console.error(e);

        } finally {

            setLoading(false);

        }

    }, [channel]);



    useEffect(() => { load(0, channel); }, [channel]);



    const channelBadge = (ch) => ch === 'whatsapp'

        ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">📱 WhatsApp</span>

        : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">✉️ E-mail</span>;



    const statusBadge = (s) => s === 'ok'

        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">Enviado</span>

        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">Falhou</span>;



    const CHANNELS = [

        { value: 'all',      label: 'Todos' },

        { value: 'email',    label: 'E-mail' },

        { value: 'whatsapp', label: 'WhatsApp' },

    ];



    return (

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

            <div className="p-5 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">

                <div className="flex items-center gap-3">

                    <MessageSquare className="w-6 h-6 text-indigo-500" />

                    <div>

                        <h2 className="text-lg font-bold text-slate-800">Histórico de Notificações</h2>

                        <p className="text-sm text-slate-500">E-mails automáticos e mensagens WhatsApp enviados pelo sistema</p>

                    </div>

                </div>

                <div className="flex items-center gap-2">

                    <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">

                        {CHANNELS.map(c => (

                            <button

                                key={c.value}

                                onClick={() => setChannel(c.value)}

                                className={`px-3 py-1.5 transition-colors ${channel === c.value ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}

                            >{c.label}</button>

                        ))}

                    </div>

                    <button onClick={() => load(0, channel)} className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50">

                        <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />

                    </button>

                </div>

            </div>



            {loading && logs.length === 0 ? (

                <div className="flex items-center justify-center py-16"><Loader2 className="w-8 h-8 text-slate-300 animate-spin" /></div>

            ) : logs.length === 0 ? (

                <div className="flex flex-col items-center justify-center py-16">

                    <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />

                    <p className="text-slate-400">Nenhuma notificação enviada ainda.</p>

                </div>

            ) : (

                <>

                    <div className="overflow-x-auto">

                        <table className="w-full text-sm">

                            <thead className="bg-slate-50 border-b border-slate-200 text-left">

                                <tr>

                                    <th className="px-4 py-3 font-medium text-slate-600 whitespace-nowrap">Data/Hora</th>

                                    <th className="px-4 py-3 font-medium text-slate-600">Canal</th>

                                    <th className="px-4 py-3 font-medium text-slate-600">Destinatário</th>

                                    <th className="px-4 py-3 font-medium text-slate-600">Assunto</th>

                                    <th className="px-4 py-3 font-medium text-slate-600">Status</th>

                                    <th className="px-4 py-3 font-medium text-slate-600">Prévia</th>

                                </tr>

                            </thead>

                            <tbody className="divide-y divide-slate-100">

                                {logs.map((log, i) => (

                                    <tr key={`${log.channel}-${log.id}-${i}`} className="hover:bg-slate-50">

                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap text-xs">

                                            {new Date(log.sent_at).toLocaleString('pt-BR')}

                                        </td>

                                        <td className="px-4 py-3">{channelBadge(log.channel)}</td>

                                        <td className="px-4 py-3 text-slate-700 max-w-[180px] truncate" title={log.recipient}>{log.recipient || '—'}</td>

                                        <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate" title={log.subject}>{log.subject || '—'}</td>

                                        <td className="px-4 py-3">{statusBadge(log.status)}</td>

                                        <td className="px-4 py-3 text-slate-400 text-xs max-w-[240px] truncate" title={log.body_preview}>{log.body_preview || '—'}</td>

                                    </tr>

                                ))}

                            </tbody>

                        </table>

                    </div>

                    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">

                        <span>{total} registro(s) no total</span>

                        <div className="flex gap-2">

                            <button disabled={offset === 0} onClick={() => load(Math.max(0, offset - LIMIT), channel)}

                                className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-slate-50">← Anterior</button>

                            <button disabled={offset + LIMIT >= total} onClick={() => load(offset + LIMIT, channel)}

                                className="px-3 py-1 rounded border disabled:opacity-40 hover:bg-slate-50">Próximo →</button>

                        </div>

                    </div>

                </>

            )}

        </div>

    );

}

