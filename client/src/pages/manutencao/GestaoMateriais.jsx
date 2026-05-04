import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Package, Search, Filter, Save, Calendar, ArrowRight, Wrench, Truck, Clock, ShoppingCart } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '../../contexts/AuthContext';
import ManutencaoPurchaseRequestModal from '../../components/ManutencaoPurchaseRequestModal';

const STATUS_COLORS = {
    'SOLICITADO': 'bg-slate-100 text-slate-700 border-slate-300',
    'COMPRAS': 'bg-blue-100 text-blue-700 border-blue-300',
    'AGUARDANDO_ENTREGA': 'bg-amber-100 text-amber-700 border-amber-300',
    'RECEBIDO': 'bg-indigo-100 text-indigo-700 border-indigo-300',
    'PRONTO_PARA_USO': 'bg-emerald-100 text-emerald-700 border-emerald-300'
};

const STATUS_OPTIONS = [
    { value: 'SOLICITADO', label: 'Solicitado na O.M.' },
    { value: 'COMPRAS', label: 'Em Cotação / Compras' },
    { value: 'AGUARDANDO_ENTREGA', label: 'Aguardando Entrega' },
    { value: 'RECEBIDO', label: 'Recebido no Almoxarifado' },
    { value: 'PRONTO_PARA_USO', label: 'Pronto p/ Montagem' }
];

export default function GestaoMateriais() {
    const { user } = useAuth();
    const [materiais, setMateriais] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [showPurchaseModal, setShowPurchaseModal] = useState(false);

    // Modal Planejamento
    const [editingMat, setEditingMat] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadMateriais();
    }, []);

    const loadMateriais = async () => {
        try {
            setLoading(true);
            const res = await api.get('/manutencao/materiais');
            setMateriais(res.data || []);
        } catch (error) {
            console.error("Erro ao carregar materiais:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleAll = (visibleIds) => {
        if (selectedIds.length === visibleIds.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(visibleIds);
        }
    };

    const handleSavePlanejamento = async () => {
        if (!editingMat) return;
        try {
            setSaving(true);
            await api.put(`/manutencao/materiais/${editingMat.id}/planejamento`, {
                status: editingMat.status,
                data_prevista_compras: editingMat.data_prevista_compras || null,
                data_prevista_chegada: editingMat.data_prevista_chegada || null,
                data_prevista_montagem: editingMat.data_prevista_montagem || null,
                obs_compras: editingMat.obs_compras || null,
                obs_chegada: editingMat.obs_chegada || null,
                obs_montagem: editingMat.obs_montagem || null,
                descricao_planejamento: editingMat.descricao_planejamento || null,
                usuario_id: user?.idUsuario,
                usuario_nome: user?.NomeCompleto
            });
            await loadMateriais();
            setEditingMat(null);
        } catch (error) {
            alert('Erro ao salvar planejamento. Tente novamente.');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '--';
        try {
            return format(parseISO(dateStr), 'dd/MM/yyyy');
        } catch {
            return dateStr;
        }
    };

    const filtered = materiais.filter(m => {
        const matchesSearch = 
            (m.descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
            (m.maquina_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.ordem_id?.toString() || '').includes(searchTerm);
        
        const matchesStatus = statusFilter ? m.status === statusFilter : true;
        
        // Esconder materiais de O.Ms concluídas ou canceladas por padrão, a menos que pesquisado explicitamente
        const isOrdemAtiva = m.ordem_status !== 'CONCLUIDA' && m.ordem_status !== 'CANCELADA';
        const showCompleted = searchTerm !== '' || statusFilter !== '';
        
        return matchesSearch && matchesStatus && (showCompleted || isOrdemAtiva);
    });

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Package className="text-indigo-600" /> Gestão de Materiais O.M.
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Acompanhamento, status de compras e datas de montagem</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-[300px]">
                        <Search className="text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar por material, máquina ou O.M..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent border-none focus:ring-0 text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="text-slate-400" size={18} />
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="text-sm border-slate-200 rounded-md"
                        >
                            <option value="">Todos os Status</option>
                            {STATUS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto pb-16">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <input 
                                        type="checkbox" 
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                        onChange={() => toggleAll(filtered.map(m => m.id))}
                                    />
                                </th>
                                <th className="px-4 py-3">O.M. / Máquina</th>
                                <th className="px-4 py-3">Material</th>
                                <th className="px-4 py-3 text-center">Qtd</th>
                                <th className="px-4 py-3">Status Atual</th>
                                <th className="px-4 py-3">Datas Previstas</th>
                                <th className="px-4 py-3 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                                        <div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-indigo-600 rounded-full" role="status" aria-label="loading"></div>
                                        <p className="mt-2">Carregando materiais...</p>
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                                        Nenhum material encontrado com os filtros atuais.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(mat => (
                                    <tr key={mat.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(mat.id) ? 'bg-indigo-50/30' : ''}`}>
                                        <td className="px-4 py-3">
                                            <input 
                                                type="checkbox" 
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={selectedIds.includes(mat.id)}
                                                onChange={() => toggleSelection(mat.id)}
                                            />
                                        </td>
                                        <td className="px-4 py-3 align-top">
                                            <div className="font-bold text-slate-800 text-[13px]">O.M. #{mat.ordem_id}</div>
                                            <div className="text-xs font-medium text-slate-600 mt-1 line-clamp-2" title={mat.maquina_tag || mat.maquina_nome || 'S/ Máquina'}>
                                                {mat.maquina_tag || mat.maquina_nome || 'S/ Máquina'}
                                            </div>
                                            {mat.setor_nome && (
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5" title={mat.setor_nome}>
                                                    {mat.setor_nome}
                                                </div>
                                            )}
                                            {mat.prioridade_ordem === 'CRITICA' && (
                                                <span className="inline-block mt-1.5 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">O.M. CRÍTICA</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-800">{mat.descricao}</div>
                                            <div className="text-xs text-slate-500">{mat.codigo ? `Cód: ${mat.codigo}` : 'S/ Código'}</div>
                                            <div className="text-xs text-slate-400 mt-1">Sol: {formatDate(mat.criado_em)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-slate-700">
                                            {mat.quantidade} {mat.unidade}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${STATUS_COLORS[mat.status] || STATUS_COLORS['SOLICITADO']}`}>
                                                {STATUS_OPTIONS.find(o => o.value === mat.status)?.label || mat.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 min-w-[220px]">
                                            <div className="flex flex-col gap-2 bg-slate-50 border border-slate-100 rounded-lg p-2.5">
                                                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                                                    <Calendar size={14} className="text-blue-500 shrink-0" />
                                                    <span className="w-16">Compras:</span> 
                                                    <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{formatDate(mat.data_prevista_compras)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                                                    <Truck size={14} className="text-amber-500 shrink-0" />
                                                    <span className="w-16">Chegada:</span> 
                                                    <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{formatDate(mat.data_prevista_chegada)}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-[13px] text-slate-600">
                                                    <Wrench size={14} className="text-emerald-500 shrink-0" />
                                                    <span className="w-16">Montagem:</span> 
                                                    <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{formatDate(mat.data_prevista_montagem)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => setEditingMat({...mat})}
                                                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                                            >
                                                Planejar
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Planejamento Premium */}
            {editingMat && (
                <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                    <Clock className="text-indigo-600" />
                                    Planejamento Estratégico de Material
                                </h3>
                                <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                                    <span className="font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-xs">O.M. #{editingMat.ordem_id}</span>
                                    <span>{editingMat.descricao}</span>
                                </p>
                            </div>
                            <button onClick={() => setEditingMat(null)} className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-2 rounded-full transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Column: Status & Global Description */}
                                <div className="space-y-6">
                                    <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
                                        <h4 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                            Informações Gerais
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Status de Atendimento</label>
                                                <select 
                                                    className="w-full border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 py-2.5"
                                                    value={editingMat.status}
                                                    onChange={e => setEditingMat({...editingMat, status: e.target.value})}
                                                >
                                                    {STATUS_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição do Planejamento</label>
                                                <textarea 
                                                    rows={4}
                                                    placeholder="Adicione notas gerais sobre a estratégia de compra, prioridade, etc."
                                                    className="w-full border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400"
                                                    value={editingMat.descricao_planejamento || ''}
                                                    onChange={e => setEditingMat({...editingMat, descricao_planejamento: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Timeline */}
                                <div>
                                    <div className="bg-slate-50/50 border border-slate-200 p-5 rounded-xl h-full">
                                        <h4 className="font-semibold text-slate-800 mb-6 flex items-center gap-2">
                                            <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
                                            Cronograma & Prazos
                                        </h4>
                                        
                                        <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                                            
                                            {/* Step 1: Compras */}
                                            <div className="relative flex flex-col gap-2">
                                                <div className="absolute left-[-24px] top-1 w-7 h-7 bg-white border-2 border-blue-500 rounded-full flex items-center justify-center z-10 shadow-sm">
                                                    <Calendar size={12} className="text-blue-600" />
                                                </div>
                                                <label className="text-sm font-bold text-slate-700 pl-4">Solicitação de Compras</label>
                                                <div className="pl-4 space-y-2">
                                                    <input 
                                                        type="date" 
                                                        className="w-full border-slate-300 rounded-md text-sm py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                                                        value={editingMat.data_prevista_compras ? editingMat.data_prevista_compras.split('T')[0] : ''}
                                                        onChange={e => setEditingMat({...editingMat, data_prevista_compras: e.target.value})}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Obs. (Ex: Cotação com fornecedor X)" 
                                                        className="w-full border-slate-200 rounded-md text-[13px] py-1.5 text-slate-600 bg-white/50 focus:bg-white focus:ring-1 focus:ring-blue-500"
                                                        value={editingMat.obs_compras || ''}
                                                        onChange={e => setEditingMat({...editingMat, obs_compras: e.target.value})}
                                                    />
                                                </div>
                                            </div>

                                            {/* Step 2: Chegada */}
                                            <div className="relative flex flex-col gap-2">
                                                <div className="absolute left-[-24px] top-1 w-7 h-7 bg-white border-2 border-amber-500 rounded-full flex items-center justify-center z-10 shadow-sm">
                                                    <Truck size={12} className="text-amber-600" />
                                                </div>
                                                <label className="text-sm font-bold text-slate-700 pl-4">Chegada no Almoxarifado</label>
                                                <div className="pl-4 space-y-2">
                                                    <input 
                                                        type="date" 
                                                        className="w-full border-slate-300 rounded-md text-sm py-1.5 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 bg-white shadow-sm"
                                                        value={editingMat.data_prevista_chegada ? editingMat.data_prevista_chegada.split('T')[0] : ''}
                                                        onChange={e => setEditingMat({...editingMat, data_prevista_chegada: e.target.value})}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Obs. (Ex: Previsão transportadora TotalExpress)" 
                                                        className="w-full border-slate-200 rounded-md text-[13px] py-1.5 text-slate-600 bg-white/50 focus:bg-white focus:ring-1 focus:ring-amber-500"
                                                        value={editingMat.obs_chegada || ''}
                                                        onChange={e => setEditingMat({...editingMat, obs_chegada: e.target.value})}
                                                    />
                                                </div>
                                            </div>

                                            {/* Step 3: Montagem */}
                                            <div className="relative flex flex-col gap-2">
                                                <div className="absolute left-[-24px] top-1 w-7 h-7 bg-white border-2 border-emerald-500 rounded-full flex items-center justify-center z-10 shadow-sm">
                                                    <Wrench size={12} className="text-emerald-600" />
                                                </div>
                                                <label className="text-sm font-bold text-slate-700 pl-4">Montagem / Substituição</label>
                                                <div className="pl-4 space-y-2">
                                                    <input 
                                                        type="date" 
                                                        className="w-full border-slate-300 rounded-md text-sm py-1.5 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white shadow-sm"
                                                        value={editingMat.data_prevista_montagem ? editingMat.data_prevista_montagem.split('T')[0] : ''}
                                                        onChange={e => setEditingMat({...editingMat, data_prevista_montagem: e.target.value})}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="Obs. (Ex: Parada de máquina no sábado às 10h)" 
                                                        className="w-full border-slate-200 rounded-md text-[13px] py-1.5 text-slate-600 bg-white/50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                                                        value={editingMat.obs_montagem || ''}
                                                        onChange={e => setEditingMat({...editingMat, obs_montagem: e.target.value})}
                                                    />
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3 rounded-b-2xl">
                            <button 
                                onClick={() => setEditingMat(null)}
                                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 hover:text-slate-800 rounded-xl transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleSavePlanejamento}
                                disabled={saving}
                                className="px-6 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 rounded-xl shadow-md flex items-center gap-2 transition-all disabled:opacity-50 disabled:transform-none"
                            >
                                {saving ? (
                                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> Salvando...</>
                                ) : (
                                    <><Save size={18} /> Confirmar Planejamento</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Shopping Cart Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 md:left-[260px] bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] p-4 flex justify-between items-center z-40">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-full">
                            <ShoppingCart size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{selectedIds.length} material(is) selecionado(s)</p>
                            <p className="text-xs text-slate-500 hidden sm:block">Você pode gerar uma única solicitação de compras para estes itens.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setSelectedIds([])}
                            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={() => setShowPurchaseModal(true)}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm rounded-lg flex items-center gap-2 transition-colors"
                        >
                            Criar Solicitação
                        </button>
                    </div>
                </div>
            )}

            <ManutencaoPurchaseRequestModal 
                isOpen={showPurchaseModal}
                onClose={() => setShowPurchaseModal(false)}
                selectedMaterials={materiais.filter(m => selectedIds.includes(m.id))}
                onComplete={() => {
                    setSelectedIds([]);
                    loadMateriais();
                }}
            />
        </div>
    );
}
