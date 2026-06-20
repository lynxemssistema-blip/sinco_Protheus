import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, ShieldAlert, Save, Building2, Menu, Edit, X, Camera, Upload, Printer, FileText, Download, Bot, Shield, Check, ChevronDown, ChevronRight, Mail, Send, Loader2, EyeOff, Users, Plus, Trash2, MessageSquare, Activity, Package, Bug, Database, Calendar } from 'lucide-react';
import { createUser, getUsers, deleteUser, updateUser, getCompanySettings, updateCompanySettings, updateMenuSettings, updateGeneralSettings, getUserPermissions, saveUserPermissions, setRomaneioInitialNumber, getRomaneioInitialNumber, sendUserCredentials, getPedidosStatusSettings, togglePedidosStatusGlobal, getPedidosStatusList, togglePedidoStatus } from '../services/api';
import api from '../services/api';
import { MENU_GROUPS } from '../config/menuItems';
import PCPMetalConfig from './PCPMetalConfig';
import EmailClient from '../components/EmailClient';
import MonitoringDashboard from '../components/MonitoringDashboard';
import DBAMonitoringTab from '../components/DBAMonitoringTab';
import ErrorListTab from '../components/ErrorListTab';
import WinSCPTab from '../components/WinSCPTab';
import LynxConfigTab from '../components/LynxConfigTab';

export default function Settings() {
    const { user, isAdmin } = useAuth();

    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Geral', icon: Building2 },
        { id: 'orders_visibility', label: 'Visibilidade de Pedidos', icon: EyeOff },
        ...(user?.tipo === 'SA' ? [{ id: 'menu', label: 'Menu & Navegação', icon: Menu }] : []),
        { id: 'modules', label: 'Módulos', icon: Package },
        { id: 'profiles', label: 'Perfis de Acesso', icon: Users },
        { id: 'users', label: 'Usuários', icon: UserPlus },
        { id: 'pending', label: 'Aprovações Pendentes', icon: ShieldAlert },
        { id: 'permissions', label: 'Permissões', icon: Shield },
        { id: 'reports', label: 'Relatórios', icon: FileText },
        { id: 'ai', label: 'Inteligência Artificial', icon: Bot },
        { id: 'errors', label: 'Lista de Erros', icon: Bug },
        { id: 'email', label: 'E-mail Corporativo', icon: Mail },
        { id: 'notifications', label: 'Histórico de Notificações', icon: MessageSquare },
        { id: 'monitoring', label: 'Monitoramento do Sistema', icon: Activity },
        ...(user?.tipo === 'SA' ? [{ id: 'winscp', label: 'Processo WinSCP', icon: Send }] : []),
        ...(user?.tipo === 'SA' ? [{ id: 'lynx', label: 'Agente lynx', icon: Bot }] : []),
    ];

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
        foto: null
    });
    const [editingUser, setEditingUser] = useState(null);

    // Users List
    const [usersList, setUsersList] = useState([]);
    const [userFilter, setUserFilter] = useState('');
    const [pcFilter, setPcFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [sendingCredentials, setSendingCredentials] = useState(false);

    const loadUsers = async () => {
        try {
            const data = await getUsers();
            setUsersList(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (activeTab === 'general' || activeTab === 'users' || activeTab === 'permissions' || activeTab === 'pending') {
            loadUsers();
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
            (data || []).forEach(p => {
                map[p.page_id] = {
                    can_view: !!p.can_view,
                    can_create: !!p.can_create,
                    can_edit: !!p.can_edit,
                    can_delete: !!p.can_delete
                };
            });
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
    if (!isAdmin) {
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
            if (editingUser) {
                await updateUser(editingUser.idUsuario, userForm);
                alert('Usuário atualizado com sucesso!');
                setEditingUser(null);
            } else {
                await createUser(userForm);
                alert('Usuário cadastrado com sucesso!');
            }
            setUserForm({ nome: '', telefone: '', whatsapp: '', login: '', senha: '', tipo: 'U', setor: '', funcao: '', email: '', observacoes: '', tem_pc: false, foto: null });
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
            foto: u.fotoUsuario || null
        });
    };

    const cancelEditing = () => {
        setEditingUser(null);
        setUserForm({ nome: '', telefone: '', whatsapp: '', login: '', senha: '', tipo: 'U', setor: '', funcao: '', email: '', observacoes: '', tem_pc: false, foto: null });
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
            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8" aria-label="Tabs">
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

                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-2xl">
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2 mb-6 border-b pb-4">
                            <Building2 className="w-6 h-6 text-blue-600" />
                            Configurações da Empresa
                        </h2>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Dados Corporativos</h3>
                        <form onSubmit={handleCompanySubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Razão Social</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={companyForm.razao_social || ''}
                                    onChange={e => setCompanyForm({ ...companyForm, razao_social: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <input
                                        className="w-full p-2 border rounded-lg"
                                        value={companyForm.cnpj || ''}
                                        onChange={e => setCompanyForm({ ...companyForm, cnpj: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                    <input
                                        className="w-full p-2 border rounded-lg"
                                        value={companyForm.telefone || ''}
                                        onChange={e => setCompanyForm({ ...companyForm, telefone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Endereço Completo</label>
                                <input
                                    className="w-full p-2 border rounded-lg"
                                    value={companyForm.endereco || ''}
                                    onChange={e => setCompanyForm({ ...companyForm, endereco: e.target.value })}
                                    onClick={(e) => e.target.value = e.target.value} // Fix focus issues
                                />
                            </div>
                            <div className="pt-4">
                                <button
                                    type="submit"
                                    disabled={loadingCompany}
                                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
                                >
                                    <Save className="w-4 h-4" />
                                    {loadingCompany ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>

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
                                

                                {/* Notificações de Faturamento por E-mail */}
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                    <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2"><Mail className="w-5 h-5 text-indigo-500" /> Notificações de Faturamento</h4>
                                    <p className="text-sm text-slate-500 mb-4">Selecione os usuários que receberão um e-mail automático com os detalhes das novas solicitações de faturamento criadas pela Expedição.</p>
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
                                                            let newEmails;
                                                            if (e.target.checked) {
                                                                newEmails = [...currentEmails, u.idUsuario];
                                                            } else {
                                                                newEmails = currentEmails.filter(id => id !== u.idUsuario);
                                                            }
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
                                            <p className="text-sm text-slate-400 p-2 text-center">Nenhum usuário com e-mail válido cadastrado no sistema.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Automação: Relatório de Faturamento Diário */}
                                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 mt-4">
                                    <h4 className="font-medium text-slate-800 mb-2 flex items-center gap-2"><Calendar className="w-5 h-5 text-emerald-500" /> Automação de Relatório Faturamento Diário</h4>
                                    <p className="text-sm text-slate-500 mb-4">Configure o grupo de usuários e os horários para o envio automático do consolidado diário de faturamento via E-mail e WhatsApp.</p>
                                    
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
                                                                let newDays;
                                                                if (isActive) newDays = activeDays.filter(d => d !== day.id);
                                                                else newDays = [...activeDays, day.id];
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
                {activeTab === 'modules' && (
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 max-w-4xl">
                        <div className="flex items-center justify-between gap-3 mb-6 border-b pb-4">
                            <div className="flex items-center gap-3">
                                <Package className="w-6 h-6 text-indigo-600" />
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800">Gestão de Módulos</h2>
                                    <p className="text-sm text-slate-500">Ative ou desative módulos inteiros do sistema. Oculta menus, rotas e interfaces de todos os usuários.</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Módulo de Manutenção */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg">Módulo de Manutenção</h4>
                                        <p className="text-sm text-slate-500">
                                            Gerenciamento de ordens de manutenção preventivas e corretivas, checklists diários por máquina e controle de operadores.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={loadingCompany}
                                        onClick={async () => {
                                            const newValue = !companyForm.general_config?.module_maintenance_active;
                                            const newGeneralConfig = { ...companyForm.general_config, module_maintenance_active: newValue };
                                            try {
                                                setLoadingCompany(true);
                                                await updateGeneralSettings({ general_config: newGeneralConfig });
                                                setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
                                                // Alerting that the page will reload so Sidebar and Routes re-evaluate
                                                if (window.confirm('Módulo ' + (newValue ? 'Ativado' : 'Desativado') + ' com sucesso! A página será recarregada para aplicar as mudanças de menu. OK?')) {
                                                    window.location.reload();
                                                }
                                            } catch (err) {
                                                alert('Erro ao alterar status do módulo: ' + err.message);
                                            } finally {
                                                setLoadingCompany(false);
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.module_maintenance_active ? 'bg-green-600' : 'bg-slate-300'} ${loadingCompany ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={companyForm.general_config?.module_maintenance_active ? 'Módulo Ativo - Clique para Desativar' : 'Módulo Inativo - Clique para Ativar'}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.module_maintenance_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <span className={`px-2 py-1 text-xs font-bold rounded ${companyForm.general_config?.module_maintenance_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                        Status: {companyForm.general_config?.module_maintenance_active ? 'ATIVO NO SISTEMA' : 'DESATIVADO'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Módulo SGQ */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg">Módulo de Qualidade (SGQ)</h4>
                                        <p className="text-sm text-slate-500">
                                            Controle de ativos, certificados de calibração, manuais e documentações de treinamento.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={loadingCompany}
                                        onClick={async () => {
                                            const newValue = !companyForm.general_config?.module_sgq_active;
                                            const newGeneralConfig = { ...companyForm.general_config, module_sgq_active: newValue };
                                            try {
                                                setLoadingCompany(true);
                                                await updateGeneralSettings({ general_config: newGeneralConfig });
                                                setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
                                                if (window.confirm('Módulo ' + (newValue ? 'Ativado' : 'Desativado') + ' com sucesso! A página será recarregada para aplicar as mudanças de menu. OK?')) {
                                                    window.location.reload();
                                                }
                                            } catch (err) {
                                                alert('Erro ao alterar status do módulo: ' + err.message);
                                            } finally {
                                                setLoadingCompany(false);
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.module_sgq_active ? 'bg-green-600' : 'bg-slate-300'} ${loadingCompany ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={companyForm.general_config?.module_sgq_active ? 'Módulo Ativo - Clique para Desativar' : 'Módulo Inativo - Clique para Ativar'}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.module_sgq_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <span className={`px-2 py-1 text-xs font-bold rounded ${companyForm.general_config?.module_sgq_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                        Status: {companyForm.general_config?.module_sgq_active ? 'ATIVO NO SISTEMA' : 'DESATIVADO'}
                                    </span>
                                </div>

                                {/* RNC Numbering Config */}
                                <div className="mt-5 pt-4 border-t border-slate-200">
                                    <h5 className="font-semibold text-slate-700 text-sm mb-1 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-teal-500 inline-block"></span>
                                        Numeração Automática de RNC
                                    </h5>
                                    <p className="text-xs text-slate-500 mb-4">
                                        Define o padrão de número gerado automaticamente para cada nova RNC aberta no sistema.
                                        Use os marcadores: <code className="bg-slate-100 px-1 rounded">{'{YEAR}'}</code> (ano), <code className="bg-slate-100 px-1 rounded">{'{MONTH}'}</code> (mês), <code className="bg-slate-100 px-1 rounded">{'{SEQ:N}'}</code> (sequência com N dígitos).
                                    </p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Format */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Formato do Número</label>
                                            <input
                                                type="text"
                                                className="w-full p-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none"
                                                placeholder="Ex: RNC-{YEAR}-{SEQ:4}"
                                                value={rncFormatForm}
                                                onChange={e => setRncFormatForm(e.target.value)}
                                            />
                                            {/* Live Preview */}
                                            <div className="mt-1.5 text-xs text-slate-500">
                                                Prévia: <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                                                    {rncFormatForm
                                                        .replace('{YEAR}', new Date().getFullYear())
                                                        .replace('{MONTH}', String(new Date().getMonth() + 1).padStart(2, '0'))
                                                        .replace(/\{SEQ:(\d+)\}/, (_, n) => String(parseInt(rncNumberForm) || 1).padStart(parseInt(n), '0'))
                                                        .replace('{SEQ}', String(parseInt(rncNumberForm) || 1).padStart(4, '0'))
                                                    }
                                                </span>
                                            </div>
                                        </div>
                                        {/* Starting Number */}
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Próximo Número Sequencial</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full p-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-400 focus:border-teal-500 outline-none"
                                                placeholder="Ex: 1"
                                                value={rncNumberForm}
                                                onChange={e => setRncNumberForm(e.target.value)}
                                            />
                                            <p className="mt-1.5 text-xs text-slate-500">A próxima RNC criada usará este número.</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            type="button"
                                            disabled={loadingCompany}
                                            onClick={handleRncConfigSubmit}
                                            className="bg-teal-600 text-white font-medium px-5 py-2 rounded-lg hover:bg-teal-700 text-sm disabled:opacity-50 transition-colors"
                                        >
                                            {loadingCompany ? 'Salvando...' : 'Salvar Configuração de Numeração'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Módulo Análise 3D */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg">Módulo de Análise 3D</h4>
                                        <p className="text-sm text-slate-500">
                                            Visualizador de modelos 3D (.stl) com suporte a manipulação, zoom e inspeção visual de componentes de engenharia.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={loadingCompany}
                                        onClick={async () => {
                                            const newValue = !companyForm.general_config?.module_analise3d_active;
                                            const newGeneralConfig = { ...companyForm.general_config, module_analise3d_active: newValue };
                                            try {
                                                setLoadingCompany(true);
                                                await updateGeneralSettings({ general_config: newGeneralConfig });
                                                setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
                                                if (window.confirm('Módulo ' + (newValue ? 'Ativado' : 'Desativado') + ' com sucesso! A página será recarregada para aplicar as mudanças de menu. OK?')) {
                                                    window.location.reload();
                                                }
                                            } catch (err) {
                                                alert('Erro ao alterar status do módulo: ' + err.message);
                                            } finally {
                                                setLoadingCompany(false);
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.module_analise3d_active ? 'bg-green-600' : 'bg-slate-300'} ${loadingCompany ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={companyForm.general_config?.module_analise3d_active ? 'Módulo Ativo - Clique para Desativar' : 'Módulo Inativo - Clique para Ativar'}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.module_analise3d_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <span className={`px-2 py-1 text-xs font-bold rounded ${companyForm.general_config?.module_analise3d_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                        Status: {companyForm.general_config?.module_analise3d_active ? 'ATIVO NO SISTEMA' : 'DESATIVADO'}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Módulo PCP Refinado */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg">Módulo PCP Refinado</h4>
                                        <p className="text-sm text-slate-500">
                                            Gestão avançada de planejamento de produção, permitindo o cadastro de tempos padrão por máquina, cálculo de capacidade diária (CRP) e análise visual da taxa de ocupação dos recursos na fábrica.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={loadingCompany}
                                        onClick={async () => {
                                            const newValue = !companyForm.general_config?.module_pcp_refinado_active;
                                            const newGeneralConfig = { ...companyForm.general_config, module_pcp_refinado_active: newValue };
                                            try {
                                                setLoadingCompany(true);
                                                await updateGeneralSettings({ general_config: newGeneralConfig });
                                                setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
                                                if (window.confirm('Módulo ' + (newValue ? 'Ativado' : 'Desativado') + ' com sucesso! A página será recarregada para aplicar as mudanças de menu. OK?')) {
                                                    window.location.reload();
                                                }
                                            } catch (err) {
                                                alert('Erro ao alterar status do módulo: ' + err.message);
                                            } finally {
                                                setLoadingCompany(false);
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${companyForm.general_config?.module_pcp_refinado_active ? 'bg-green-600' : 'bg-slate-300'} ${loadingCompany ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        title={companyForm.general_config?.module_pcp_refinado_active ? 'Módulo Ativo - Clique para Desativar' : 'Módulo Inativo - Clique para Ativar'}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${companyForm.general_config?.module_pcp_refinado_active ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                                <div className="mt-4 flex gap-2">
                                    <span className={`px-2 py-1 text-xs font-bold rounded ${companyForm.general_config?.module_pcp_refinado_active ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                                        Status: {companyForm.general_config?.module_pcp_refinado_active ? 'ATIVO NO SISTEMA' : 'DESATIVADO'}
                                    </span>
                                </div>
                            </div>

                            {/* Módulo SGQ - Configuração RNC */}
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-lg">Módulo SGQ - Numeração de RNC</h4>
                                        <p className="text-sm text-slate-500">
                                            Configure a numeração automática para os relatórios de não conformidade (RNC).
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Formato da Numeração</label>
                                        <input 
                                            type="text" 
                                            value={companyForm.general_config?.sgq_rnc_config?.format || 'RNC-{YEAR}{MONTH}-{SEQ:4}'}
                                            onChange={(e) => {
                                                const v = e.target.value;
                                                setCompanyForm(prev => ({
                                                    ...prev,
                                                    general_config: {
                                                        ...prev.general_config,
                                                        sgq_rnc_config: {
                                                            ...prev.general_config?.sgq_rnc_config,
                                                            format: v
                                                        }
                                                    }
                                                }));
                                            }}
                                            placeholder="Ex: RNC-{YEAR}{MONTH}-{SEQ:4}"
                                            className="w-full p-2 border rounded-lg"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Variáveis: {'{YEAR}'}, {'{MONTH}'}, {'{SEQ:4}'} (4 é o nº de dígitos)</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Próximo Número (Inicial)</label>
                                        <input 
                                            type="number" 
                                            value={companyForm.general_config?.sgq_rnc_config?.next_seq || 1}
                                            onChange={(e) => {
                                                const v = parseInt(e.target.value, 10);
                                                setCompanyForm(prev => ({
                                                    ...prev,
                                                    general_config: {
                                                        ...prev.general_config,
                                                        sgq_rnc_config: {
                                                            ...prev.general_config?.sgq_rnc_config,
                                                            next_seq: isNaN(v) ? 1 : v
                                                        }
                                                    }
                                                }));
                                            }}
                                            className="w-full p-2 border rounded-lg"
                                        />
                                    </div>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button
                                        type="button"
                                        disabled={loadingCompany}
                                        onClick={async () => {
                                            const newGeneralConfig = companyForm.general_config;
                                            try {
                                                setLoadingCompany(true);
                                                await updateGeneralSettings({ general_config: newGeneralConfig });
                                                alert('Configuração RNC salva com sucesso!');
                                            } catch (err) {
                                                alert('Erro ao salvar configuração RNC: ' + err.message);
                                            } finally {
                                                setLoadingCompany(false);
                                            }
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium p-2 px-4 rounded-lg flex items-center gap-2 transition"
                                    >
                                        {loadingCompany ? 'Aguarde...' : 'Salvar Numeração RNC'}
                                    </button>
                                </div>
                            </div>

                            {/* Pode adicionar novos módulos aqui no futuro */}
                        </div>
                    </div>
                )}

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

                {/* EMAIL TAB */}
                {activeTab === 'email' && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden" style={{ minHeight: '600px' }}>
                        <EmailClient />
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
                                                                if (window.confirm("Isso excluirá a solicitação. Tem certeza?")) {
                                                                    setLoading(true);
                                                                    try {
                                                                        await deleteUser(u.idUsuario);
                                                                        loadUsers();
                                                                    } finally { setLoading(false); }
                                                                }
                                                            }}
                                                            className="text-red-500 hover:text-red-700 p-2 text-xs font-medium border border-transparent hover:border-red-200 rounded-lg bg-red-50"
                                                        >
                                                            Rejeitar (Excluir)
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
                                    Adicionar Perfil
                                </h2>
                            </div>
                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                const code = e.target.code.value.toUpperCase();
                                const name = e.target.name.value;
                                const isAdmin = e.target.isAdmin.checked;
                                
                                if (!code || !name) return;
                                
                                const newProfiles = [...customProfiles.filter(p => p.code !== code), { code, name, isAdmin }];
                                const newGeneralConfig = { ...companyForm.general_config, custom_profiles: newProfiles };
                                
                                try {
                                    setLoadingCompany(true);
                                    await updateGeneralSettings({ general_config: newGeneralConfig });
                                    setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
                                    e.target.reset();
                                    alert('Perfil salvo com sucesso!');
                                } catch (err) {
                                    alert('Erro ao salvar perfil: ' + err.message);
                                } finally {
                                    setLoadingCompany(false);
                                }
                            }} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Código (Ex: VEN)</label>
                                    <input required name="code" className="w-full p-2 border rounded-lg uppercase" placeholder="Código curto..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Perfil</label>
                                    <input required name="name" className="w-full p-2 border rounded-lg" placeholder="Ex: Vendedor" />
                                </div>
                                <div className="flex items-center gap-2 mt-2">
                                    <input type="checkbox" name="isAdmin" id="isAdmin" className="w-4 h-4 text-indigo-600 rounded border-gray-300" />
                                    <label htmlFor="isAdmin" className="text-sm text-slate-700">Acesso Total (Admin)</label>
                                </div>
                                <button
                                    type="submit"
                                    disabled={loadingCompany}
                                    className="w-full bg-indigo-600 text-white px-6 py-2 rounded-lg flex justify-center items-center gap-2 font-medium hover:bg-indigo-700 mt-4"
                                >
                                    <Plus className="w-4 h-4" /> {loadingCompany ? 'Salvando...' : 'Salvar Perfil'}
                                </button>
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
                                                    {p.isAdmin ? (
                                                        <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">Sim</span>
                                                    ) : (
                                                        <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">Não</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-3 text-right">
                                                    <button
                                                        onClick={async () => {
                                                            if (window.confirm(`Tem certeza que deseja remover o perfil ${p.name}?`)) {
                                                                const newProfiles = customProfiles.filter(prof => prof.code !== p.code);
                                                                const newGeneralConfig = { ...companyForm.general_config, custom_profiles: newProfiles };
                                                                try {
                                                                    setLoadingCompany(true);
                                                                    await updateGeneralSettings({ general_config: newGeneralConfig });
                                                                    setCompanyForm(prev => ({ ...prev, general_config: newGeneralConfig }));
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

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Permissão</label>
                                    <select
                                        className="w-full p-2 border rounded-lg bg-white"
                                        value={userForm.tipo}
                                        onChange={e => setUserForm({ ...userForm, tipo: e.target.value })}
                                    >
                                        {availableProfiles.map(p => (
                                            <option key={p.code} value={p.code}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

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
                                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail Corporativo</label>
                                    <input
                                        type="email"
                                        className="w-full p-2 border rounded-lg"
                                        value={userForm.email}
                                        onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                                        placeholder="usuario@metalfisa.com.br"
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
                                                                     alert('Acesso Negado: Apenas SuperAdmins podem remover usuários SuperAdmin (SA).');
                                                                     return;
                                                                 }
                                                                 if (window.confirm(`Tem certeza que deseja remover ${u.NomeCompleto}?`)) {
                                                                    try {
                                                                        await deleteUser(u.idUsuario);
                                                                        loadUsers();
                                                                    } catch (e) {
                                                                        alert('Erro ao deletar: ' + e.message);
                                                                    }
                                                                }
                                                            }}
                                                            className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-full transition-colors"
                                                            title="Remover usuário"
                                                        >
                                                            <ShieldAlert className="w-4 h-4" />
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
                )}

                {/* REPORTS TAB */}
                {activeTab === 'reports' && (
                    <div className="space-y-6 max-w-4xl animate-fadeIn">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-6 border-b pb-4">
                                <FileText className="w-6 h-6 text-blue-600" />
                                Relatórios Administrativos
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* User Report Card */}
                                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 bg-blue-100 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <UserPlus className="w-6 h-6" />
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Usuários</span>
                                            <p className="text-2xl font-black text-slate-800">{usersList.length}</p>
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-800 mb-1">Listagem Geral de Usuários</h3>
                                    <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                                        Gere um arquivo Excel contendo todos os usuários, permissões, setores e acessos ao sistema.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setActiveTab('users')}
                                            className="flex-1 bg-white text-slate-700 border border-slate-300 px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
                                        >
                                            Ver Usuários
                                        </button>
                                        <button
                                            onClick={() => {
                                                const url = `http://${window.location.hostname}:3001/api/reports/users/xlsx`;
                                                window.open(url, '_blank');
                                            }}
                                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 shadow-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            Exportar Excel
                                        </button>
                                    </div>
                                </div>

                                {/* Placeholder for more reports */}
                                <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 border-dashed flex flex-col items-center justify-center text-center opacity-60">
                                    <div className="p-3 bg-slate-200 text-slate-400 rounded-lg mb-2">
                                        <ShieldAlert className="w-6 h-6" />
                                    </div>
                                    <p className="text-sm font-bold text-slate-400">Novos Relatórios em Breve</p>
                                </div>
                            </div>
                        </div>

                        {/* Summary Info */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-sm font-medium text-slate-500">Administradores</p>
                                <p className="text-2xl font-bold text-indigo-600">{usersList.filter(u => customProfiles.find(p => p.code === u.TipoUsuario)?.isAdmin).length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-sm font-medium text-slate-500">Usuários Padrão</p>
                                <p className="text-2xl font-bold text-emerald-600">{usersList.filter(u => u.TipoUsuario === 'U').length}</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                                <p className="text-sm font-medium text-slate-500">Acesso via PC</p>
                                <p className="text-2xl font-bold text-blue-600">{usersList.filter(u => u.TemPC === 1).length}</p>
                            </div>
                        </div>
                    </div>
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
                                    <p className="text-xs text-slate-400 mt-1">Administradores (Admin) possuem acesso total automaticamente caso não tenham permissões específicas definidas.</p>
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
