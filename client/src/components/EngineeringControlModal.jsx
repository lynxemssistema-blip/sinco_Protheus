
import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, User, FileText, CheckCircle, Search, Plus, Trash2, History, Package, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { getUsers } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const EngineeringControlModal = ({ isOpen, onClose, orderId: orderIdProp, pedido, item, onSave }) => {
    const orderId = orderIdProp || pedido;
    const { user } = useAuth();
    const isAdmin = user?.tipo === 'A';
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [designers, setDesigners] = useState([]);
    const [history, setHistory] = useState({});

    // BOM states
    const [bomItems, setBomItems] = useState([]);
    const [bomHistory, setBomHistory] = useState([]);
    const [bomLoading, setBomLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [showNewItemForm, setShowNewItemForm] = useState(false);
    const [showBomHistory, setShowBomHistory] = useState(false);
    const [newItem, setNewItem] = useState({ descricao: '', quantidade: '', unidade: 'UN', observacao: '' });
    const [searchCode, setSearchCode] = useState('');
    const [searchDesc, setSearchDesc] = useState('');
    const [searchFilters, setSearchFilters] = useState({ type: '', client: '', pdf_status: '', group: '' });
    const [editingItem, setEditingItem] = useState(null); // {id, quantidade}

    // Timesheet states
    const [timesheets, setTimesheets] = useState([]);
    const [manualEntry, setManualEntry] = useState({ date: new Date().toISOString().split('T')[0], hours: '', obs: '' });

    useEffect(() => {
        // Load designers
        getUsers({ setor: 'ENGENHARIA' }).then(users => {
            setDesigners(users);
        }).catch(err => console.error('Error loading designers:', err));
    }, []);

    useEffect(() => {
        if (isOpen && item) {
            // Load history
            api.get(`/pedidos/${orderId}/items/${item.item}/history`)
                .then(res => setHistory(res.data))
                .catch(err => console.error('Error loading history:', err));

            setFormData({
                project_type: item.project_type || '',
                engineering_start_date: item.engineering_start_date ? item.engineering_start_date.split('T')[0] : '',

                bom_prepared_by: item.bom_prepared_by || '',
                bom_prepared_at: item.bom_prepared_at ? item.bom_prepared_at.split('T')[0] : '',
                bom_released_at: item.bom_released_at ? item.bom_released_at.split('T')[0] : '',
                bom_notes: item.bom_notes || '',

                designer_name: item.designer_name || '',
                designer_start_forecast: item.designer_start_forecast ? item.designer_start_forecast.split('T')[0] : '',
                designer_end_forecast: item.designer_end_forecast ? item.designer_end_forecast.split('T')[0] : '',
                designer_start_real: item.designer_start_real ? item.designer_start_real.split('T')[0] : '',
                designer_end_real: item.designer_end_real ? item.designer_end_real.split('T')[0] : '',
                designer_production_release_date: item.designer_production_release_date ? item.designer_production_release_date.split('T')[0] : '',
                designer_notes: item.designer_notes || '',

                pcp_mat_req_date: item.pcp_mat_req_date ? item.pcp_mat_req_date.split('T')[0] : '',
                pcp_mat_req_user: item.pcp_mat_req_user || '',
                pcp_mech_start_date: item.pcp_mech_start_date ? item.pcp_mech_start_date.split('T')[0] : '',
                pcp_mech_start_user: item.pcp_mech_start_user || '',
                pcp_cut_rel_date: item.pcp_cut_rel_date ? item.pcp_cut_rel_date.split('T')[0] : '',
                pcp_cut_rel_user: item.pcp_cut_rel_user || '',
                pcp_notes: item.pcp_notes || ''
            });

            // Load BOM
            loadBom();
        }
    }, [isOpen, item, orderId]);

    const loadBom = async () => {
        if (!orderId || !item) return;
        setBomLoading(true);
        try {
            const res = await api.get(`/engineering-bom/${orderId}/${item.item}`);
            setBomItems(res.data);

            const histRes = await api.get(`/engineering-bom/${orderId}/${item.item}/history`);
            setBomHistory(histRes.data);
        } catch (error) {
            console.error('Error loading BOM:', error);
        } finally {
            setBomLoading(false);
        }
    };

    const handleSearchMaterials = async () => {
        if (!searchCode.trim() && !searchDesc.trim() && !searchFilters.type && !searchFilters.client && !searchFilters.pdf_status && !searchFilters.group) return;
        setSearching(true);
        try {
            let url = `/produtos?limit=25`;
            if (searchCode.trim()) url += `&code=${searchCode.trim()}`;
            if (searchDesc.trim()) url += `&search=${searchDesc.trim()}`;
            if (searchFilters.type) url += `&type=${searchFilters.type}`;
            if (searchFilters.client) url += `&client=${searchFilters.client}`;
            if (searchFilters.pdf_status) url += `&pdf_status=${searchFilters.pdf_status}`;
            if (searchFilters.group) url += `&group=${searchFilters.group}`;

            const res = await api.get(url);
            setSearchResults(res.data.data || []);
        } catch (error) {
            console.error('Error searching materials:', error);
        } finally {
            setSearching(false);
        }
    };

    const loadTimesheets = async () => {
        try {
            const res = await api.get(`/engineering-timesheets/${orderId}/${item.item}`);
            setTimesheets(res.data);
        } catch (error) {
            console.error('Error loading timesheets', error);
        }
    };

    const handleManualEntry = async (e) => {
        e.preventDefault();
        try {
            await api.post('/engineering-timesheets/manual', {
                pedido: orderId,
                item: item.item,
                date: manualEntry.date,
                hours: manualEntry.hours,
                obs: manualEntry.obs
            });
            setManualEntry({ date: new Date().toISOString().split('T')[0], hours: '', obs: '' });
            loadTimesheets();
        } catch (error) {
            alert('Erro ao incluir apontamento manual: ' + (error.response?.data?.error || error.message));
        }
    };

    const handleDeleteTimesheet = async (id) => {
        if (!window.confirm('Excluir este apontamento?')) return;
        try {
            await api.delete(`/engineering-timesheets/${id}`);
            loadTimesheets();
        } catch (error) {
            alert('Erro ao excluir apontamento.');
        }
    };

    useEffect(() => {
        if (activeTab === 'bom') {
            loadBom();
            loadBomHistory();
        } else if (activeTab === 'timesheet') {
            loadTimesheets();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab]);

    const addMaterialToBom = async (product) => {
        const qty = window.prompt(`Adicionar ${product.descricao}. Qual a quantidade?`, "1");
        if (qty === null) return;
        const numQty = parseFloat(qty.replace(',', '.'));
        if (isNaN(numQty) || numQty <= 0) {
            alert("Quantidade inválida.");
            return;
        }

        try {
            await api.post(`/engineering-bom/${orderId}/${item.item}`, {
                codigo: product.codigo,
                descricao: product.descricao,
                quantidade: numQty,
                unidade: product.unidade || 'UN',
                is_novo: false,
                usuario: user?.nome || user?.username
            });
            // Don't clear search to allow adding more
            loadBom();
        } catch (error) {
            alert('Erro ao adicionar material.');
        }
    };

    const addCustomMaterial = async () => {
        if (!newItem.descricao || !newItem.quantidade) {
            alert('Preencha descrição e quantidade.');
            return;
        }
        try {
            await api.post(`/engineering-bom/${orderId}/${item.item}`, {
                ...newItem,
                is_novo: true,
                usuario: user?.nome || user?.username
            });
            setNewItem({ descricao: '', quantidade: '', unidade: 'UN' });
            setShowNewItemForm(false);
            loadBom();
        } catch (error) {
            alert('Erro ao adicionar novo material.');
        }
    };

    const updateBomItem = async (bomItem, newQty) => {
        try {
            await api.put(`/engineering-bom/${bomItem.id}`, {
                descricao: bomItem.descricao,
                quantidade: newQty,
                unidade: bomItem.unidade,
                observacao: bomItem.observacao,
                usuario: user?.nome || user?.username
            });
            setEditingItem(null);
            loadBom();
        } catch (error) {
            alert('Erro ao atualizar quantidade.');
        }
    };

    const removeBomItem = async (id) => {
        if (!window.confirm('Tem certeza que deseja remover este item da lista?')) return;
        try {
            await api.delete(`/engineering-bom/${id}?usuario=${user?.nome || user?.username}`);
            loadBom();
        } catch (error) {
            alert('Erro ao remover item.');
        }
    };

    const exportToExcel = () => {
        if (bomItems.length === 0) return alert("A lista está vazia.");

        const data = bomItems.map(b => ({
            'Identificação': `${orderId}-${item?.item || ''}`,
            'Pedido': orderId,
            'Item PV': item?.item || '',
            'Produto Pai': item?.codigo || '',
            'Código': b.codigo || 'Novo',
            'Descrição': b.descricao,
            'Quantidade': parseFloat(b.quantidade),
            'Unidade': b.unidade,
            'Observação': b.observacao || '',
            'Tipo': b.is_novo ? 'NOVO' : 'PROTHEUS',
            'Criado por': b.criado_por,
            'Data': new Date(b.criado_em).toLocaleDateString('pt-BR')
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "BOM");
        XLSX.writeFile(wb, `BOM_${orderId}_${item.item}.xlsx`);
    };

    const exportToPDF = () => {
        if (bomItems.length === 0) return alert("A lista está vazia.");

        const doc = new jsPDF();

        // Header
        doc.setFontSize(16);
        doc.text('Lista de Materiais (BOM)', 14, 20);

        doc.setFontSize(10);
        doc.text(`Pedido: ${orderId} | Item: ${item?.item}`, 14, 30);
        doc.text(`Produto: ${item?.codigo} - ${item?.descricao || ''}`, 14, 35);
        doc.text(`Data de Emissão: ${new Date().toLocaleString('pt-BR')}`, 14, 40);

        const tableColumn = ["ID Ref.", "Ped.", "It.", "Código", "Descrição", "Obs", "Qtd", "Un"];
        const tableRows = bomItems.map(b => [
            `${orderId}-${item?.item || ''}`,
            orderId,
            item?.item || '',
            b.codigo || 'Novo',
            b.descricao,
            b.observacao || '',
            parseFloat(b.quantidade).toLocaleString('pt-BR'),
            b.unidade
        ]);

        doc.autoTable({
            startY: 45,
            head: [tableColumn],
            body: tableRows,
            theme: 'striped',
            headStyles: { fillColor: [59, 130, 246] } // Blue-500
        });

        doc.save(`BOM_${orderId}_${item.item}.pdf`);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post(`/pedidos/${orderId}/items/${item.item}/notes`, formData);

            if (onSave) onSave(orderId, item.item, formData);
            onClose();
        } catch (error) {
            console.error('Error saving engineering controls:', error);
            alert('Erro ao salvar dados.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh]">

                {/* Header */}
                <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">Controle de engenharia</h3>
                        <p className="text-sm text-gray-500">
                            Pedido: <span className="font-mono font-medium text-gray-700">{orderId}</span> |
                            Item: <span className="font-mono font-medium text-gray-700">{item?.item}</span> |
                            Prod: <span className="font-mono font-medium text-blue-600">{item?.codigo}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 overflow-x-auto whitespace-nowrap">
                    {['general', 'bom', 'designer', 'pcp', 'timesheet'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 min-w-[120px] py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab
                                ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {tab === 'general' && 'Geral'}
                            {tab === 'bom' && 'Lista de material'}
                            {tab === 'designer' && 'Projetista'}
                            {tab === 'pcp' && 'PCP (Corte)'}
                            {tab === 'timesheet' && 'Apontamentos ⏱️'}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">

                    {activeTab === 'general' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
                            <InputGroup history={history.engineering_start_date} label="Início engenharia" name="engineering_start_date" type="date" value={formData.engineering_start_date} onChange={handleChange} />
                        </div>
                    )}

                    {activeTab === 'bom' && (
                        <div className="flex flex-col h-full animate-fadeIn min-h-[500px]">
                            {/* BOM Header Info */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <InputGroup history={history.bom_prepared_by} label="Quem fez (LM)" name="bom_prepared_by" value={formData.bom_prepared_by} onChange={handleChange} />
                                <InputGroup history={history.bom_prepared_at} label="Data feito" name="bom_prepared_at" type="date" value={formData.bom_prepared_at} onChange={handleChange} />
                                <InputGroup history={history.bom_released_at} label="Data liberado" name="bom_released_at" type="date" value={formData.bom_released_at} onChange={handleChange} />
                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={() => setShowBomHistory(!showBomHistory)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${showBomHistory ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        <History className="w-4 h-4" />
                                        {showBomHistory ? 'Ocultar Histórico' : 'Ver Histórico'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                                {/* Left Side: Search & Filters */}
                                <div className="col-span-5 flex flex-col gap-4 border-r border-gray-100 pr-6">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                <Search className="w-4 h-4 text-blue-600" /> Buscar Materiais (Protheus)
                                            </h4>
                                            <button
                                                type="button"
                                                onClick={() => setShowNewItemForm(!showNewItemForm)}
                                                className={`text-[10px] font-bold px-2 py-1 rounded-md transition-colors ${showNewItemForm ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}
                                            >
                                                {showNewItemForm ? 'CANCELAR NOVO' : '+ CRIAR NOVO'}
                                            </button>
                                        </div>

                                        {showNewItemForm ? (
                                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 space-y-3 animate-fadeIn">
                                                <div className="grid grid-cols-1 gap-2">
                                                    <label className="text-[10px] font-bold text-green-700 uppercase">Descrição do Material</label>
                                                    <input
                                                        placeholder="Ex: Porca 1/2..."
                                                        className="w-full text-xs border border-green-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-green-400 font-semibold"
                                                        value={newItem.descricao}
                                                        onChange={(e) => setNewItem({ ...newItem, descricao: e.target.value })}
                                                    />
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-green-700 uppercase">Qtd</label>
                                                        <input
                                                            type="number"
                                                            className="w-full text-xs border border-green-200 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-green-400"
                                                            value={newItem.quantidade}
                                                            onChange={(e) => setNewItem({ ...newItem, quantidade: e.target.value })}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-green-700 uppercase">UM</label>
                                                        <select
                                                            className="w-full text-xs border border-green-200 rounded px-1 py-1.5 outline-none focus:ring-1 focus:ring-green-400 bg-white"
                                                            value={newItem.unidade}
                                                            onChange={(e) => setNewItem({ ...newItem, unidade: e.target.value })}
                                                        >
                                                            <option value="UN">UN</option>
                                                            <option value="PC">PC</option>
                                                            <option value="KG">KG</option>
                                                            <option value="MT">MT</option>
                                                            <option value="M2">M2</option>
                                                            <option value="LT">LT</option>
                                                        </select>
                                                    </div>
                                                    <div className="flex items-end">
                                                        <button
                                                            type="button"
                                                            onClick={addCustomMaterial}
                                                            className="w-full bg-green-600 text-white rounded flex items-center justify-center hover:bg-green-700 py-1.5 font-bold text-xs shadow-sm"
                                                        >
                                                            ADICIONAR
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 gap-1">
                                                    <label className="text-[10px] font-bold text-green-700 uppercase">Observação</label>
                                                    <textarea
                                                        placeholder="Notas adicionais sobre o material..."
                                                        rows={2}
                                                        className="w-full text-[10px] border border-green-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-green-400 resize-none"
                                                        value={newItem.observacao}
                                                        onChange={(e) => setNewItem({ ...newItem, observacao: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div className="relative">
                                                        <input
                                                            placeholder="Cód..."
                                                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                            value={searchCode}
                                                            onChange={(e) => setSearchCode(e.target.value)}
                                                            onKeyPress={(e) => e.key === 'Enter' && handleSearchMaterials()}
                                                        />
                                                        <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
                                                    </div>
                                                    <div className="relative">
                                                        <input
                                                            placeholder="Desc..."
                                                            className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                            value={searchDesc}
                                                            onChange={(e) => setSearchDesc(e.target.value)}
                                                            onKeyPress={(e) => e.key === 'Enter' && handleSearchMaterials()}
                                                        />
                                                        <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-gray-400" />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-3 gap-2">
                                                    <select
                                                        value={searchFilters.type}
                                                        onChange={(e) => setSearchFilters({ ...searchFilters, type: e.target.value })}
                                                        className="text-[10px] border border-gray-300 rounded px-1 py-1 bg-white"
                                                    >
                                                        <option value="">Tipo</option>
                                                        <option value="MP">MP</option>
                                                        <option value="PA">PA</option>
                                                        <option value="PI">PI</option>
                                                        <option value="GG">GG</option>
                                                    </select>
                                                    <select
                                                        value={searchFilters.pdf_status}
                                                        onChange={(e) => setSearchFilters({ ...searchFilters, pdf_status: e.target.value })}
                                                        className="text-[10px] border border-gray-300 rounded px-1 py-1 bg-white"
                                                    >
                                                        <option value="">PDF</option>
                                                        <option value="with_pdf">Com</option>
                                                        <option value="without_pdf">Sem</option>
                                                    </select>
                                                    <input
                                                        placeholder="Grupo..."
                                                        className="w-full text-[10px] border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                                                        value={searchFilters.group}
                                                        onChange={(e) => setSearchFilters({ ...searchFilters, group: e.target.value })}
                                                        onKeyPress={(e) => e.key === 'Enter' && handleSearchMaterials()}
                                                    />
                                                </div>

                                                <input
                                                    placeholder="Filtrar por Cliente..."
                                                    className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-blue-400"
                                                    value={searchFilters.client}
                                                    onChange={(e) => setSearchFilters({ ...searchFilters, client: e.target.value })}
                                                    onKeyPress={(e) => e.key === 'Enter' && handleSearchMaterials()}
                                                />

                                                <button
                                                    type="button"
                                                    onClick={handleSearchMaterials}
                                                    disabled={searching}
                                                    className="w-full bg-blue-600 text-white text-xs font-bold py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                                                >
                                                    {searching ? 'Pesquisando...' : (
                                                        <>
                                                            <Search className="w-3.5 h-3.5" /> PESQUISAR MATERIAIS
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Search Results Area */}
                                    <div className="flex-1 overflow-y-auto min-h-0 bg-white border border-gray-200 rounded-xl">
                                        {searchResults.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                                                <div className="p-3 bg-gray-50 rounded-full mb-3">
                                                    <Search className="w-6 h-6 text-gray-300" />
                                                </div>
                                                <p className="text-xs text-gray-400">Pesquise materiais para adicionar à lista.</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100">
                                                {searchResults.map(p => (
                                                    <div key={p.codigo} className="p-3 hover:bg-blue-50/50 transition-colors flex items-center justify-between group">
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{p.codigo}</span>
                                                                <span className="text-[9px] text-gray-400 font-bold uppercase">{p.tipo}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-700 font-medium truncate" title={p.descricao}>{p.descricao}</p>
                                                            {p.grupo && <p className="text-[9px] text-gray-400 mt-0.5">Grupo: {p.grupo}</p>}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => addMaterialToBom(p)}
                                                            className="p-2 bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-md hover:scale-105"
                                                            title="Adicionar à lista"
                                                        >
                                                            <Plus className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Right Side: Current List or History */}
                                <div className="col-span-7 flex flex-col min-h-0">
                                    {showBomHistory ? (
                                        <div className="flex flex-col h-full bg-orange-50/30 rounded-xl border border-orange-100 overflow-hidden animate-fadeIn">
                                            <div className="px-4 py-3 border-b border-orange-100 bg-orange-50 flex justify-between items-center">
                                                <h5 className="text-sm font-bold text-orange-800 flex items-center gap-2">
                                                    <History className="w-4 h-4" /> Histórico de Alterações (BOM)
                                                </h5>
                                                <button onClick={() => setShowBomHistory(false)} className="text-[10px] text-orange-600 hover:underline">Ocultar</button>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                {bomHistory.length === 0 ? (
                                                    <p className="text-sm text-gray-400 italic text-center py-10">Nenhum histórico disponível para este item.</p>
                                                ) : (
                                                    bomHistory.map(h => (
                                                        <div key={h.id} className="bg-white p-3 rounded-lg shadow-sm border-l-4 border-orange-400">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-xs font-bold text-gray-800">{h.usuario}</span>
                                                                <span className="text-[10px] text-gray-400">{new Date(h.data_hora).toLocaleString('pt-BR')}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-600 leading-relaxed">{h.detalhes}</p>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <Package className="w-4 h-4 text-blue-600" />
                                                    <h4 className="text-sm font-bold text-gray-700">Lista Atual</h4>
                                                    <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">
                                                        {bomItems.length} ITENS
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={exportToExcel}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors border border-green-100"
                                                        title="Exportar para Excel"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" /> EXCEL
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={exportToPDF}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors border border-red-100"
                                                        title="Exportar para PDF"
                                                    >
                                                        <FileText className="w-3.5 h-3.5" /> PDF
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={async () => {
                                                            const sourcePedido = window.prompt("Copiar lista de qual pedido?");
                                                            const sourceItem = window.prompt("E de qual item (ex: 01)?");
                                                            if (sourcePedido && sourceItem) {
                                                                if (window.confirm(`Isso irá substituir a lista atual por itens do pedido ${sourcePedido} item ${sourceItem}. Continuar?`)) {
                                                                    try {
                                                                        const res = await api.get(`/engineering-bom/${sourcePedido}/${sourceItem}`);
                                                                        for (const it of res.data) {
                                                                            await api.post(`/engineering-bom/${orderId}/${item.item}`, {
                                                                                ...it,
                                                                                usuario: user?.nome || user?.username
                                                                            });
                                                                        }
                                                                        loadBom();
                                                                    } catch (e) { alert("Erro ao copiar lista."); }
                                                                }
                                                            }
                                                        }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors border border-blue-100"
                                                        title="Copiar lista de outro modelo"
                                                    >
                                                        <Package className="w-3.5 h-3.5" /> COPIAR MODELO
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="sticky top-0 bg-gray-50 text-gray-500 text-[10px] uppercase font-bold border-b border-gray-100 z-10">
                                                        <tr>
                                                            <th className="px-4 py-3">Especificação do Material</th>
                                                            <th className="px-4 py-3 w-32 text-center">Quantidade</th>
                                                            <th className="px-4 py-3 w-20 text-center">Remover</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-50">
                                                        {bomLoading ? (
                                                            <tr><td colSpan="3" className="text-center py-10 text-xs text-gray-400">Carregando lista...</td></tr>
                                                        ) : bomItems.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="3" className="text-center py-20">
                                                                    <div className="flex flex-col items-center opacity-40">
                                                                        <Package className="w-12 h-12 mb-3" />
                                                                        <p className="text-xs italic">Nenhum material adicionado ainda.</p>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            bomItems.map(b => (
                                                                <tr key={b.id} className="hover:bg-gray-50/50 transition-colors group">
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex flex-col">
                                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                                {b.is_novo ? (
                                                                                    <span className="bg-green-100 text-green-700 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase border border-green-200">NOVO</span>
                                                                                ) : (
                                                                                    <span className="font-mono text-[10px] text-blue-600 font-bold bg-blue-50 px-1 rounded">{b.codigo}</span>
                                                                                )}
                                                                            </div>
                                                                            <span className="text-xs text-gray-800 font-semibold leading-tight">{b.descricao}</span>
                                                                            {b.observacao && (
                                                                                <span className="text-[10px] text-gray-400 italic mt-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 w-fit">
                                                                                    Obs: {b.observacao}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {editingItem?.id === b.id ? (
                                                                            <div className="flex items-center justify-center gap-1">
                                                                                <input
                                                                                    type="number"
                                                                                    autoFocus
                                                                                    className="w-16 px-2 py-1 border border-blue-400 rounded text-xs text-center outline-none bg-blue-50 font-bold"
                                                                                    value={editingItem.quantidade}
                                                                                    onChange={(e) => setEditingItem({ ...editingItem, quantidade: e.target.value })}
                                                                                    onBlur={() => updateBomItem(b, editingItem.quantidade)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') updateBomItem(b, editingItem.quantidade);
                                                                                        if (e.key === 'Escape') setEditingItem(null);
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        ) : (
                                                                            <div
                                                                                onClick={() => setEditingItem({ id: b.id, quantidade: b.quantidade })}
                                                                                className="inline-flex items-center px-2 py-1 bg-gray-100 rounded-lg font-mono text-xs font-bold text-gray-700 cursor-pointer hover:bg-blue-100 transition-colors"
                                                                                title="Clique para editar quantidade"
                                                                            >
                                                                                {parseFloat(b.quantidade).toLocaleString('pt-BR')} <span className="ml-1 text-[9px] text-gray-400">{b.unidade}</span>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeBomItem(b.id)}
                                                                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            <div className="p-4 bg-gray-50 border-t border-gray-100">
                                                <TextAreaGroup history={history.bom_notes} label="Considerações Adicionais para a Lista" name="bom_notes" value={formData.bom_notes} onChange={handleChange} className="bg-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'designer' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-600">Projetista responsável</label>
                                <select
                                    name="designer_name"
                                    value={formData.designer_name}
                                    onChange={handleChange}
                                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                                >
                                    <option value="">Selecione...</option>
                                    {designers.map(d => (
                                        <option key={d.idUsuario} value={d.NomeCompleto}>
                                            {d.NomeCompleto}
                                        </option>
                                    ))}
                                </select>
                                {history.designer_name && <HistoryFooter entry={history.designer_name} />}
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                <h4 className="text-xs font-bold text-blue-800 mb-3 flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Previsão
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-600">Início previsto</label>
                                        <input
                                            type="date"
                                            name="designer_start_forecast"
                                            value={formatDateForInput(formData.designer_start_forecast)}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className={`border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                                        />
                                        {history.designer_start_forecast && <HistoryFooter entry={history.designer_start_forecast} />}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-600">Fim previsto</label>
                                        <input
                                            type="date"
                                            name="designer_end_forecast"
                                            value={formatDateForInput(formData.designer_end_forecast)}
                                            onChange={handleChange}
                                            disabled={!isAdmin}
                                            className={`border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${!isAdmin ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
                                        />
                                        {history.designer_end_forecast && <HistoryFooter entry={history.designer_end_forecast} />}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                                <h4 className="text-xs font-bold text-green-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> Realizado
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <InputGroup history={history.designer_start_real} label="Início real" name="designer_start_real" type="date" value={formData.designer_start_real} onChange={handleChange} className="bg-white" />
                                    <InputGroup history={history.designer_end_real} label="Fim real" name="designer_end_real" type="date" value={formData.designer_end_real} onChange={handleChange} className="bg-white" />
                                </div>
                            </div>

                            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                                <h4 className="text-xs font-bold text-indigo-800 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Engenharia
                                </h4>
                                <div className="grid grid-cols-1">
                                    <InputGroup history={history.designer_production_release_date} label="Liberado Engenharia" name="designer_production_release_date" type="date" value={formData.designer_production_release_date} onChange={handleChange} className="bg-white" />
                                </div>
                            </div>

                            <TextAreaGroup history={history.designer_notes} label="Observações do projeto" name="designer_notes" value={formData.designer_notes} onChange={handleChange} />
                        </div>
                    )}

                    {activeTab === 'pcp' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                                <h4 className="text-xs font-bold text-orange-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Requisição de material
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-600">Data requisição</label>
                                        <input
                                            type="date"
                                            name="pcp_mat_req_date"
                                            value={formatDateForInput(formData.pcp_mat_req_date)}
                                            onChange={handleChange}
                                            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {history.pcp_mat_req_date && <HistoryFooter entry={history.pcp_mat_req_date} />}
                                    </div>
                                    <InputGroup history={history.pcp_mat_req_user} label="Quem requisitou" name="pcp_mat_req_user" value={formData.pcp_mat_req_user} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                                <h4 className="text-xs font-bold text-orange-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Início mecanização
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-600">Data início</label>
                                        <input
                                            type="date"
                                            name="pcp_mech_start_date"
                                            value={formatDateForInput(formData.pcp_mech_start_date)}
                                            onChange={handleChange}
                                            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {history.pcp_mech_start_date && <HistoryFooter entry={history.pcp_mech_start_date} />}
                                    </div>
                                    <InputGroup history={history.pcp_mech_start_user} label="Liberado por" name="pcp_mech_start_user" value={formData.pcp_mech_start_user} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                                <h4 className="text-xs font-bold text-green-800 mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Liberação para corte
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1">
                                        <label className="text-xs font-semibold text-gray-600">Data liberação</label>
                                        <input
                                            type="date"
                                            name="pcp_cut_rel_date"
                                            value={formatDateForInput(formData.pcp_cut_rel_date)}
                                            onChange={handleChange}
                                            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        />
                                        {history.pcp_cut_rel_date && <HistoryFooter entry={history.pcp_cut_rel_date} />}
                                    </div>
                                    <InputGroup history={history.pcp_cut_rel_user} label="Liberado por" name="pcp_cut_rel_user" value={formData.pcp_cut_rel_user} onChange={handleChange} />
                                </div>
                            </div>

                            <TextAreaGroup history={history.pcp_notes} label="Observações gerais PCP" name="pcp_notes" value={formData.pcp_notes} onChange={handleChange} />
                        </div>
                    )}

                </form>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Salvando...' : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar alterações
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
};

const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    return dateString.split('T')[0];
};

const formatHistoryDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('pt-BR');
};

const HistoryFooter = ({ entry }) => {
    if (!entry) return null;
    return (
        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-end italic">
            Aj. por {entry.user} em {formatHistoryDate(entry.date)}
        </div>
    );
};

const InputGroup = ({ label, name, type = "text", value, onChange, className = "", history }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        <label className="text-xs font-semibold text-gray-600 font-medium">{label}</label>
        <input
            type={type}
            name={name}
            value={value}
            onChange={onChange} // Passes the event 'e' directly
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {history && <HistoryFooter entry={history} />}
    </div>
);

const TextAreaGroup = ({ label, name, value, onChange, className = "", history }) => (
    <div className={`flex flex-col gap-1 ${className}`}>
        <label className="text-xs font-semibold text-gray-600 font-medium">{label}</label>
        <textarea
            name={name}
            value={value}
            onChange={onChange}
            rows={3}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none"
        />
        {history && <HistoryFooter entry={history} />}
    </div>
);

export default EngineeringControlModal;
