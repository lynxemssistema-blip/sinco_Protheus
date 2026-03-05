import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, ShieldAlert, Save, Building2, Menu, Edit, X, Camera, Upload, Printer, FileText, Download, Bot, Shield, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { createUser, getUsers, deleteUser, updateUser, getCompanySettings, updateCompanySettings, updateMenuSettings, updateGeneralSettings, getUserPermissions, saveUserPermissions } from '../services/api';
import { MENU_GROUPS } from '../config/menuItems';
import PCPMetalConfig from './PCPMetalConfig';

export default function Settings() {
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Geral', icon: Building2 },
        { id: 'menu', label: 'Menu & Navegação', icon: Menu },
        { id: 'users', label: 'Usuários', icon: UserPlus },
        { id: 'permissions', label: 'Permissões', icon: Shield },
        { id: 'reports', label: 'Relatórios', icon: FileText },
        { id: 'ai', label: 'Inteligência Artificial', icon: Bot },
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
        login: '',
        senha: '',
        tipo: 'U',
        setor: '',
        funcao: '',
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

    const loadUsers = async () => {
        try {
            const data = await getUsers();
            setUsersList(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (activeTab === 'users' || activeTab === 'permissions') {
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
            await saveUserPermissions(permSelectedUser, permsArray);
            alert('Permissões salvas com sucesso!');
        } catch (err) {
            alert('Erro ao salvar permissões: ' + err.message);
        } finally {
            setPermSaving(false);
        }
    };

    // Company Form State
    const [companyForm, setCompanyForm] = useState({
        razao_social: '',
        cnpj: '',
        endereco: '',
        telefone: '',
        menu_config: {}, // will hold { itemId: boolean }
        general_config: {} // kv pairs
    });

    const [loading, setLoading] = useState(false);
    const [loadingCompany, setLoadingCompany] = useState(false);

    useEffect(() => {
        if (user?.tipo === 'A') {
            loadCompany();
        }
    }, [user]);

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
        } catch (err) {
            console.error(err);
        }
    };

    // ADMIN GUARD
    if (user?.tipo !== 'A') {
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
            setUserForm({ nome: '', telefone: '', login: '', senha: '', tipo: 'U', setor: '', funcao: '', observacoes: '', tem_pc: false, foto: null });
            loadUsers();
        } catch (err) {
            alert('Erro: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    const startEditing = (u) => {
        setEditingUser(u);
        setUserForm({
            nome: u.NomeCompleto,
            telefone: u.telefone || '',
            login: u.Login,
            senha: '', // Don't fill password
            tipo: u.TipoUsuario,
            setor: u.Setor || '',
            funcao: u.Funcao || '',
            observacoes: u.Observacoes || '',
            tem_pc: u.TemPC === 1,
            foto: u.fotoUsuario || null
        });
    };

    const cancelEditing = () => {
        setEditingUser(null);
        setUserForm({ nome: '', telefone: '', login: '', senha: '', tipo: 'U', setor: '', funcao: '', observacoes: '', tem_pc: false, foto: null });
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

    const filteredUsers = usersList.filter(u => {
        const matchesSearch = (u.NomeCompleto || '').toLowerCase().includes(userFilter.toLowerCase()) ||
            (u.Login || '').toLowerCase().includes(userFilter.toLowerCase());
        const matchesPc = pcFilter === 'all' || (pcFilter === 'yes' ? u.TemPC === 1 : u.TemPC !== 1);
        const matchesType = typeFilter === 'all' || u.TipoUsuario === typeFilter;
        return matchesSearch && matchesPc && matchesType;
    });

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
                            </div>
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
                                        <option value="U">Usuário (Padrão)</option>
                                        <option value="A">Administrador (Total)</option>
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
                                        <option value="A">Admin</option>
                                        <option value="U">Usuário</option>
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
                                            <th className="px-6 py-3">Nome</th>
                                            <th className="px-6 py-3">Login</th>
                                            <th className="px-6 py-3">Setor/Função</th>
                                            <th className="px-6 py-3 min-w-[150px]">Observações</th>
                                            <th className="px-6 py-3 text-center">Tem PC?</th>
                                            <th className="px-6 py-3">Tipo</th>
                                            <th className="px-6 py-3 text-right print:hidden">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredUsers.map(u => (
                                            <tr key={u.idUsuario} className={`transition-colors ${editingUser?.idUsuario === u.idUsuario ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                                                <td className="px-6 py-3 font-medium text-slate-900 flex items-center gap-3">
                                                    {u.fotoUsuario ? (
                                                        <img src={u.fotoUsuario} alt="Foto do Usuário na Lista" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs ring-1 ring-slate-200">
                                                            {(u.NomeCompleto || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                    {u.NomeCompleto}
                                                </td>
                                                <td className="px-6 py-3">{u.Login}</td>
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
                                                    {u.TipoUsuario === 'A'
                                                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 print:bg-transparent print:border print:border-indigo-800">Admin</span>
                                                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 print:bg-transparent print:border print:border-green-800">Usuário</span>
                                                    }
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
                                                <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
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
                                <p className="text-2xl font-bold text-indigo-600">{usersList.filter(u => u.TipoUsuario === 'A').length}</p>
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
                                        {permSaving ? 'Salvando...' : 'Salvar Permissões'}
                                    </button>
                                )}
                            </div>

                            {/* User selector */}
                            <div className="mb-6">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Selecione o Usuário:</label>
                                <select
                                    className="w-full md:w-96 p-3 border border-slate-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    value={permSelectedUser || ''}
                                    onChange={(e) => handlePermUserChange(e.target.value)}
                                >
                                    <option value="">-- Selecione um usuário --</option>
                                    {usersList.filter(u => u.TipoUsuario !== 'A').map(u => (
                                        <option key={u.idUsuario} value={u.idUsuario}>{u.NomeCompleto} ({u.Login})</option>
                                    ))}
                                    <optgroup label="Administradores (acesso total)">
                                        {usersList.filter(u => u.TipoUsuario === 'A').map(u => (
                                            <option key={u.idUsuario} value={u.idUsuario} disabled>{u.NomeCompleto} ({u.Login}) — Admin</option>
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
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-16 text-center">
                                    <Shield className="w-12 h-12 text-slate-300 mb-3" />
                                    <p className="text-slate-400 font-medium">Selecione um usuário acima para gerenciar suas permissões.</p>
                                    <p className="text-xs text-slate-400 mt-1">Administradores (Admin) possuem acesso total automaticamente.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
