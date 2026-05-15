import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { Package, Plus, Search, User, Wrench, Calendar, Link as LinkIcon, Trash2, X, Save, Edit2, LayoutGrid, List, Camera, FileText, Download } from 'lucide-react';

export default function CaixasFerramenta() {
    const [toolboxes, setToolboxes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [availableAssets, setAvailableAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState(() => localStorage.getItem('@MetalFisa:sgq_toolbox_search') || '');
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('@MetalFisa:sgq_toolbox_view') || 'card');

    useEffect(() => {
        localStorage.setItem('@MetalFisa:sgq_toolbox_search', searchTerm);
    }, [searchTerm]);

    useEffect(() => {
        localStorage.setItem('@MetalFisa:sgq_toolbox_view', viewMode);
    }, [viewMode]);

    // Modal states for creating/editing a toolbox
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        employee_cpf: ''
    });

    // Custom user select states
    const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const dropdownRef = useRef(null);

    // Modal states for managing a toolbox's assets
    const [selectedToolbox, setSelectedToolbox] = useState(null);
    const [toolboxAssets, setToolboxAssets] = useState([]);
    const [isManageModalOpen, setIsManageModalOpen] = useState(false);

    // Modal states for viewing attachments (PDFs)
    const [selectedAssetForPdfs, setSelectedAssetForPdfs] = useState(null);
    const [assetAttachments, setAssetAttachments] = useState([]);
    const [loadingAttachments, setLoadingAttachments] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsUserDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const [tbRes, userRes, assetsRes] = await Promise.all([
                api.get('/sgq/assets/toolboxes'),
                api.get('/users').catch(() => ({ data: [] })),
                api.get('/sgq/assets')
            ]);
            setToolboxes(tbRes.data);
            setUsuarios(userRes.data);
            setAvailableAssets(assetsRes.data.filter(a => a.status === 'available'));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const getNextToolboxName = () => {
        let maxNum = 0;
        toolboxes.forEach(tb => {
            const match = tb.name.match(/^CX-METAL-(\d+)$/i);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxNum) maxNum = num;
            }
        });
        return `CX-METAL-${String(maxNum + 1).padStart(4, '0')}`;
    };

    const handleOpenCreateModal = (tb = null) => {
        if (tb) {
            setFormData({ id: tb.id, name: tb.name, employee_cpf: tb.employee_cpf });
        } else {
            setFormData({ id: null, name: getNextToolboxName(), employee_cpf: '' });
        }
        setUserSearchTerm('');
        setIsUserDropdownOpen(false);
        setIsCreateModalOpen(true);
    };

    const handleSaveToolbox = async (e) => {
        e.preventDefault();
        if (!formData.employee_cpf) {
            alert("Selecione um colaborador!");
            return;
        }
        try {
            setSaving(true);
            if (formData.id) {
                await api.put(`/sgq/assets/toolboxes/${formData.id}`, formData);
            } else {
                await api.post('/sgq/assets/toolboxes', formData);
            }
            setIsCreateModalOpen(false);
            loadData();
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.error) {
                alert(err.response.data.error);
            } else {
                alert("Erro ao salvar caixa de ferramentas.");
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteToolbox = async (id, name) => {
        if (!window.confirm(`Tem certeza que deseja excluir a caixa "${name}"?`)) return;
        try {
            await api.delete(`/sgq/assets/toolboxes/${id}`);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Erro ao excluir caixa.");
        }
    };

    const loadToolboxAssets = async (toolboxId) => {
        try {
            const res = await api.get(`/sgq/assets/toolboxes/${toolboxId}/assets`);
            setToolboxAssets(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleManageToolbox = (toolbox) => {
        setSelectedToolbox(toolbox);
        loadToolboxAssets(toolbox.id);
        setIsManageModalOpen(true);
    };

    const handleAssignAsset = async (assetId) => {
        if (!selectedToolbox) return;
        try {
            await api.post('/sgq/assets/assign', {
                asset_id: assetId,
                toolbox_id: selectedToolbox.id
            });
            setAvailableAssets(prev => prev.filter(a => a.id !== assetId));
            loadToolboxAssets(selectedToolbox.id);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Erro ao atribuir ativo.");
        }
    };

    const handleUnassignAsset = async (assetId) => {
        if (!selectedToolbox) return;
        try {
            await api.delete(`/sgq/assets/assign/${selectedToolbox.id}/${assetId}`);
            loadToolboxAssets(selectedToolbox.id);
            loadData();
        } catch (err) {
            console.error(err);
            alert("Erro ao remover ativo da caixa.");
        }
    };

    const handleViewPdfs = async (asset) => {
        setSelectedAssetForPdfs(asset);
        setLoadingAttachments(true);
        try {
            const res = await api.get(`/sgq/assets/${asset.id}/attachments`);
            setAssetAttachments(res.data.filter(a => a.file_type === 'pdf'));
        } catch (err) {
            console.error(err);
            alert("Erro ao carregar anexos do ativo.");
        } finally {
            setLoadingAttachments(false);
        }
    };

    const getUserName = (cpfOrId) => {
        const user = usuarios.find(u => u.idUsuario.toString() === cpfOrId?.toString() || u.cpf === cpfOrId);
        return user ? user.NomeCompleto : cpfOrId;
    };
    
    const getUserObj = (cpfOrId) => {
        return usuarios.find(u => u.idUsuario.toString() === cpfOrId?.toString() || u.cpf === cpfOrId);
    };

    const filteredToolboxes = toolboxes.filter(tb => 
        (tb.name && tb.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (tb.employee_cpf && getUserName(tb.employee_cpf).toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredUsers = usuarios.filter(u => 
        u.NomeCompleto.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    const renderAssetImage = (asset) => {
        if (asset.main_photo_id) {
            return (
                <img 
                    src={`/api/sgq/assets/attachments/${asset.main_photo_id}/download?token=${localStorage.getItem('@MetalFisa:token')}`} 
                    alt={asset.name} 
                    className="w-10 h-10 object-cover rounded shadow-sm border border-slate-200"
                />
            );
        }
        return (
            <div className="w-10 h-10 bg-slate-50 rounded border border-slate-200 flex items-center justify-center flex-shrink-0">
                <Camera className="w-4 h-4 text-slate-300" />
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-3 rounded-lg">
                        <Package className="w-6 h-6 text-indigo-700" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Caixas de Ferramenta (Custódia)</h1>
                        <p className="text-sm text-slate-500">Gestão de kits atribuídos a colaboradores</p>
                    </div>
                </div>
                <button 
                    onClick={() => handleOpenCreateModal()}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    <Plus size={18} /> Nova Caixa
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nome da caixa ou colaborador..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center bg-white border border-slate-300 rounded-lg p-1">
                        <button
                            onClick={() => setViewMode('card')}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'card' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="Visualização em Cards"
                        >
                            <LayoutGrid size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`}
                            title="Visualização em Lista"
                        >
                            <List size={18} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                    </div>
                ) : filteredToolboxes.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <p className="font-medium text-lg text-slate-700">Nenhuma caixa encontrada.</p>
                        <p className="text-sm">Crie uma nova caixa de ferramentas para atribuir ativos.</p>
                    </div>
                ) : viewMode === 'card' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                        {filteredToolboxes.map(tb => {
                            const uObj = getUserObj(tb.employee_cpf);
                            return (
                                <div key={tb.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col group">
                                    <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex-1 relative">
                                        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleOpenCreateModal(tb)} className="p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500 hover:text-indigo-600"><Edit2 size={14}/></button>
                                            <button onClick={() => handleDeleteToolbox(tb.id, tb.name)} className="p-1.5 bg-white border border-slate-200 rounded shadow-sm text-slate-500 hover:text-red-600"><Trash2 size={14}/></button>
                                        </div>
                                        <div className="flex justify-between items-start mb-3 pr-16">
                                            <h3 className="font-bold text-lg text-slate-800 line-clamp-1">{tb.name}</h3>
                                        </div>
                                        <div className="flex items-center gap-3 text-sm text-slate-600 mb-2">
                                            {uObj?.fotoUsuario ? (
                                                <img src={api.defaults.baseURL.replace('/api', '') + uObj.fotoUsuario} alt="User" className="w-8 h-8 rounded-full object-cover border border-slate-200"/>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><User size={14} className="text-slate-500"/></div>
                                            )}
                                            <span className="font-medium text-slate-700 leading-tight">{getUserName(tb.employee_cpf)}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white flex justify-between items-center">
                                        <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-1 rounded border border-indigo-100">ID: #{tb.id}</span>
                                        <button 
                                            onClick={() => handleManageToolbox(tb)}
                                            className="text-indigo-600 hover:text-indigo-800 text-sm font-bold flex items-center gap-1.5 transition-colors"
                                        >
                                            <Wrench size={16} /> Gerenciar Ativos
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-800">
                                <tr>
                                    <th className="p-4 font-semibold uppercase text-xs">ID</th>
                                    <th className="p-4 font-semibold uppercase text-xs">Nome da Caixa</th>
                                    <th className="p-4 font-semibold uppercase text-xs">Responsável</th>
                                    <th className="p-4 font-semibold uppercase text-xs text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredToolboxes.map(tb => {
                                    const uObj = getUserObj(tb.employee_cpf);
                                    return (
                                        <tr key={tb.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-4 font-bold text-indigo-700">#{tb.id}</td>
                                            <td className="p-4 font-bold text-slate-800">{tb.name}</td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {uObj?.fotoUsuario ? (
                                                        <img src={api.defaults.baseURL.replace('/api', '') + uObj.fotoUsuario} alt="User" className="w-6 h-6 rounded-full object-cover"/>
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><User size={12} className="text-slate-500"/></div>
                                                    )}
                                                    <span className="font-medium">{getUserName(tb.employee_cpf)}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 flex gap-2 justify-end">
                                                <button onClick={() => handleManageToolbox(tb)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1"><Wrench size={14}/> Ativos</button>
                                                <button onClick={() => handleOpenCreateModal(tb)} className="text-slate-500 hover:text-indigo-600 bg-white border border-slate-200 shadow-sm p-1.5 rounded"><Edit2 size={14}/></button>
                                                <button onClick={() => handleDeleteToolbox(tb.id, tb.name)} className="text-slate-500 hover:text-red-600 bg-white border border-slate-200 shadow-sm p-1.5 rounded"><Trash2 size={14}/></button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Criação/Edição de Caixa */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Package className="w-5 h-5 text-indigo-600" /> {formData.id ? 'Editar Caixa' : 'Nova Caixa'}
                            </h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-red-500">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <form id="create-toolbox-form" onSubmit={handleSaveToolbox} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Caixa *</label>
                                    <input 
                                        required
                                        type="text" 
                                        value={formData.name}
                                        onChange={e => setFormData({...formData, name: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        placeholder="Ex: Kit Instalador 01"
                                    />
                                </div>
                                <div className="relative" ref={dropdownRef}>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">Colaborador Responsável *</label>
                                    
                                    <div 
                                        onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white cursor-pointer flex justify-between items-center"
                                    >
                                        {formData.employee_cpf ? (
                                            <div className="flex items-center gap-2">
                                                {getUserObj(formData.employee_cpf)?.fotoUsuario ? (
                                                    <img src={api.defaults.baseURL.replace('/api', '') + getUserObj(formData.employee_cpf).fotoUsuario} className="w-6 h-6 rounded-full object-cover" alt="User" />
                                                ) : (
                                                    <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center"><User size={12}/></div>
                                                )}
                                                <span className="text-sm font-medium">{getUserName(formData.employee_cpf)}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400 text-sm">Clique para buscar colaborador...</span>
                                        )}
                                        <Search size={16} className="text-slate-400" />
                                    </div>

                                    {isUserDropdownOpen && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 flex flex-col">
                                            <div className="p-2 border-b border-slate-100">
                                                <input 
                                                    type="text" 
                                                    autoFocus
                                                    placeholder="Buscar colaborador..." 
                                                    value={userSearchTerm}
                                                    onChange={e => setUserSearchTerm(e.target.value)}
                                                    className="w-full text-sm border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-indigo-400"
                                                />
                                            </div>
                                            <div className="overflow-y-auto flex-1 p-1">
                                                {filteredUsers.length === 0 && <div className="p-3 text-xs text-slate-400 text-center">Nenhum encontrado.</div>}
                                                {filteredUsers.map(u => (
                                                    <div 
                                                        key={u.idUsuario}
                                                        onClick={() => {
                                                            setFormData({...formData, employee_cpf: u.idUsuario.toString()});
                                                            setIsUserDropdownOpen(false);
                                                            setUserSearchTerm('');
                                                        }}
                                                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${formData.employee_cpf === u.idUsuario.toString() ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                                    >
                                                        {u.fotoUsuario ? (
                                                            <img src={api.defaults.baseURL.replace('/api', '') + u.fotoUsuario} className="w-8 h-8 rounded-full object-cover shadow-sm" alt="User" />
                                                        ) : (
                                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center"><User size={14} className="text-slate-500"/></div>
                                                        )}
                                                        <span className="text-sm font-medium text-slate-700">{u.NomeCompleto}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button 
                                type="button"
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit"
                                form="create-toolbox-form"
                                disabled={saving}
                                className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : <><Save size={18} /> Salvar Caixa</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Gerenciamento de Ativos na Caixa */}
            {isManageModalOpen && selectedToolbox && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh]">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                    <Wrench className="w-5 h-5 text-indigo-600" /> Gerenciar Ativos: {selectedToolbox.name}
                                </h2>
                                <div className="flex items-center gap-1 mt-1 text-slate-500">
                                    <span className="text-sm">Resp: {getUserName(selectedToolbox.employee_cpf)}</span>
                                </div>
                            </div>
                            <button onClick={() => setIsManageModalOpen(false)} className="text-slate-400 hover:text-red-500 bg-white p-1 rounded-full shadow-sm border border-slate-200">
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                            {/* Esquerda: Ativos na Caixa */}
                            <div className="w-full md:w-1/2 border-r border-slate-200 flex flex-col bg-white">
                                <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-700">Ativos na Caixa ({toolboxAssets.length})</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {toolboxAssets.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 text-sm">Nenhum ativo nesta caixa.</div>
                                    ) : (
                                        toolboxAssets.map(a => (
                                            <div key={a.id} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex justify-between items-center group hover:border-red-200 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    {renderAssetImage(a)}
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-800">{a.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{a.patrimonio || `S/N: ${a.serial_number}`}</div>
                                                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                            <Calendar size={12} /> Add: {new Date(a.assigned_at).toLocaleDateString('pt-BR')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1">
                                                    <button 
                                                        onClick={() => handleViewPdfs(a)}
                                                        className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors"
                                                        title="Ver Manuais / PDFs"
                                                    >
                                                        <FileText size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleUnassignAsset(a.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Remover da Caixa"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            
                            {/* Direita: Ativos Disponíveis */}
                            <div className="w-full md:w-1/2 flex flex-col bg-slate-50/30">
                                <div className="p-4 bg-slate-50 border-b border-slate-200">
                                    <h3 className="font-bold text-slate-700">Adicionar Ativo à Caixa</h3>
                                    <p className="text-xs text-slate-500 mt-0.5">Mostrando apenas ativos disponíveis ({availableAssets.length})</p>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {availableAssets.length === 0 ? (
                                        <div className="text-center py-8 text-slate-400 text-sm">Nenhum ativo disponível para atribuição.</div>
                                    ) : (
                                        availableAssets.map(a => (
                                            <div key={a.id} className="border border-slate-200 rounded-lg p-3 bg-white shadow-sm flex justify-between items-center group hover:border-indigo-300 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    {renderAssetImage(a)}
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-800">{a.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono mt-0.5">{a.patrimonio || `S/N: ${a.serial_number}`}</div>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleAssignAsset(a.id)}
                                                    className="p-1.5 text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-200 rounded transition-colors flex items-center gap-1 text-xs font-bold"
                                                >
                                                    <LinkIcon size={14} /> Atribuir
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sub-Modal de Visualização de PDFs */}
            {selectedAssetForPdfs && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-600" /> Manuais e Anexos
                            </h2>
                            <button onClick={() => setSelectedAssetForPdfs(null)} className="text-slate-400 hover:text-red-500 bg-white p-1 rounded-full shadow-sm border border-slate-200">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6">
                            <p className="text-sm font-bold text-slate-700 mb-4">{selectedAssetForPdfs.name}</p>
                            {loadingAttachments ? (
                                <div className="flex justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                </div>
                            ) : assetAttachments.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm font-medium">Nenhum PDF associado a este ativo.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                                    {assetAttachments.map(att => (
                                        <div key={att.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors bg-slate-50">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileText className="w-5 h-5 text-red-500 flex-shrink-0" />
                                                <span className="text-sm text-slate-700 font-medium truncate" title={att.original_name}>{att.original_name}</span>
                                            </div>
                                            <a 
                                                href={`/api/sgq/assets/attachments/${att.id}/download?token=${localStorage.getItem('@MetalFisa:token')}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="text-indigo-600 hover:text-indigo-800 bg-white border border-slate-200 p-2 rounded shadow-sm hover:shadow transition-all"
                                                title="Fazer Download"
                                            >
                                                <Download size={16} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
