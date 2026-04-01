import React, { useState, useEffect } from 'react';
import { X, Calendar, Save, Trash2, Plus, AlertCircle, Package, Pencil, XCircle } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-toastify';

const EMPTY_FORM = {
    data_entrega_pcp: '',
    quantidade_pcp: '',
    observacao: '',
    numero_serie: '',
    serie_cliente: '',
    serie_metalfisa: '',
    lote: '',
    numero_lote: ''
};

const ProgForm = ({ value, onChange, onSubmit, onCancel, saving, qtdDisponivel, qtdTotal, isEdit }) => (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data Entrega *</label>
            <input type="date" required
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.data_entrega_pcp}
                onChange={e => onChange(p => ({ ...p, data_entrega_pcp: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Quantidade *</label>
            <input type="number" step="0.01" min="0.01" required placeholder="0.00"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.quantidade_pcp}
                onChange={e => onChange(p => ({ ...p, quantidade_pcp: e.target.value }))} />
            {qtdTotal > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">Disponível: {qtdDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</p>
            )}
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Série Cliente</label>
            <input type="text" placeholder="Ex: SC-001"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.serie_cliente}
                onChange={e => onChange(p => ({ ...p, serie_cliente: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Série MetalFisa</label>
            <input type="text" placeholder="Ex: SM-001"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.serie_metalfisa}
                onChange={e => onChange(p => ({ ...p, serie_metalfisa: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número de Série</label>
            <input type="text" placeholder="Ex: NS-12345"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.numero_serie}
                onChange={e => onChange(p => ({ ...p, numero_serie: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Lote</label>
            <input type="text" placeholder="Ex: L-2026-001"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.lote}
                onChange={e => onChange(p => ({ ...p, lote: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número do Lote</label>
            <input type="text" placeholder="Ex: 001"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                value={value.numero_lote}
                onChange={e => onChange(p => ({ ...p, numero_lote: e.target.value }))} />
        </div>
        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observação</label>
            <textarea rows={2} placeholder="Observações adicionais..."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                value={value.observacao}
                onChange={e => onChange(p => ({ ...p, observacao: e.target.value }))} />
        </div>

        <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving}
                className={`flex-1 disabled:opacity-50 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${isEdit ? 'bg-amber-500 hover:bg-amber-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                {saving ? 'Salvando...' : <><Save className="h-4 w-4" /> {isEdit ? 'Salvar Alterações' : 'Adicionar'}</>}
            </button>
            {isEdit && onCancel && (
                <button type="button" onClick={onCancel}
                    className="px-3 py-2.5 border border-gray-300 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium">
                    <XCircle className="h-4 w-4" /> Cancelar
                </button>
            )}
        </div>
    </form>
);

const PCPForecastModal = ({ isOpen, onClose, item, onSaveSuccess }) => {
    const { user } = useAuth();
    const [programacoes, setProgramacoes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [editingId, setEditingId] = useState(null);   // id da prog em edição
    const [editForm, setEditForm] = useState(EMPTY_FORM);

    const pedido = item?.pedido || item?.pedido_id;
    const itemNum = item?.item;
    const qtdTotal = parseFloat(item?.quantidade || 0);
    const qtdTotalStr = qtdTotal.toLocaleString('pt-BR');

    const qtdProgramada = programacoes.reduce((s, p) => s + parseFloat(p.quantidade_pcp || 0), 0);
    const qtdDisponivel = qtdTotal - qtdProgramada;
    const pctProgramado = qtdTotal > 0 ? Math.min(100, (qtdProgramada / qtdTotal) * 100) : 0;

    // Disponível para edição (exclui a prog sendo editada)
    const qtdDisponivelEdit = (prog) => {
        const outrosProg = programacoes.filter(p => p.id !== prog.id).reduce((s, p) => s + parseFloat(p.quantidade_pcp || 0), 0);
        return qtdTotal - outrosProg;
    };

    useEffect(() => {
        if (isOpen && pedido && itemNum) {
            loadProgramacoes();
            setFormData(EMPTY_FORM);
            setEditingId(null);
        }
    }, [isOpen, pedido, itemNum]);

    const loadProgramacoes = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/pedidos/items/${pedido}/${itemNum}/pcp-forecasts/history`);
            setProgramacoes(res.data || []);
        } catch (err) {
            console.error('Erro ao carregar programações:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formData.data_entrega_pcp || !formData.quantidade_pcp) {
            toast.warning('Data e Quantidade são obrigatórios.');
            return;
        }
        const novaQtd = parseFloat(formData.quantidade_pcp);
        if (novaQtd <= 0) { toast.warning('Quantidade deve ser maior que zero.'); return; }
        if (qtdTotal > 0 && qtdProgramada + novaQtd > qtdTotal) {
            toast.error(`Quantidade excede o disponível. Disponível: ${qtdDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
            return;
        }
        setSaving(true);
        try {
            await api.post('/pedidos/pcp-forecasts', {
                pedido, item: itemNum,
                data_entrega_pcp: formData.data_entrega_pcp,
                quantidade_pcp: novaQtd,
                usuario: user?.nome || user?.name || user?.login || 'Usuário',
                observacao: formData.observacao || null,
                numero_serie: formData.numero_serie || null,
                serie_cliente: formData.serie_cliente || null,
                serie_metalfisa: formData.serie_metalfisa || null,
                lote: formData.lote || null,
                numero_lote: formData.numero_lote || null,
                qtd_total_item: qtdTotal > 0 ? qtdTotal : undefined
            });
            toast.success('Programação adicionada!');
            setFormData(EMPTY_FORM);
            await loadProgramacoes();
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao salvar.');
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (prog) => {
        setEditingId(prog.id);
        setEditForm({
            data_entrega_pcp: prog.data_entrega_pcp ? prog.data_entrega_pcp.split('T')[0] : '',
            quantidade_pcp: String(parseFloat(prog.quantidade_pcp || 0)),
            observacao: prog.observacao || '',
            numero_serie: prog.numero_serie || '',
            serie_cliente: prog.serie_cliente || '',
            serie_metalfisa: prog.serie_metalfisa || '',
            lote: prog.lote || '',
            numero_lote: prog.numero_lote || '',
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditForm(EMPTY_FORM);
    };

    const handleUpdate = async (e, prog) => {
        e.preventDefault();
        if (!editForm.data_entrega_pcp || !editForm.quantidade_pcp) {
            toast.warning('Data e Quantidade são obrigatórios.');
            return;
        }
        const novaQtd = parseFloat(editForm.quantidade_pcp);
        if (novaQtd <= 0) { toast.warning('Quantidade deve ser maior que zero.'); return; }
        const dispEdit = qtdDisponivelEdit(prog);
        if (qtdTotal > 0 && novaQtd > dispEdit) {
            toast.error(`Quantidade excede o disponível. Disponível para este item: ${dispEdit.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`);
            return;
        }
        setSaving(true);
        try {
            await api.put(`/pedidos/pcp-forecasts/${prog.id}`, {
                data_entrega_pcp: editForm.data_entrega_pcp,
                quantidade_pcp: novaQtd,
                observacao: editForm.observacao || null,
                numero_serie: editForm.numero_serie || null,
                serie_cliente: editForm.serie_cliente || null,
                serie_metalfisa: editForm.serie_metalfisa || null,
                lote: editForm.lote || null,
                numero_lote: editForm.numero_lote || null,
                usuario: user?.nome || user?.name || user?.login || 'Usuário',
                qtd_total_item: qtdTotal > 0 ? qtdTotal : undefined
            });
            toast.success('Programação atualizada!');
            cancelEdit();
            await loadProgramacoes();
            if (onSaveSuccess) onSaveSuccess();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao atualizar.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remover esta programação?')) return;
        try {
            await api.delete(`/pedidos/pcp-forecasts/${id}`);
            toast.success('Removido.');
            if (editingId === id) cancelEdit();
            await loadProgramacoes();
            if (onSaveSuccess) onSaveSuccess();
        } catch {
            toast.error('Erro ao remover.');
        }
    };

    const fmtDate = (d) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
    };

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
                    <div className="flex items-center gap-3">
                        <Calendar className="h-6 w-6" />
                        <div>
                            <h2 className="text-lg font-bold">Programações de Entrega PCP</h2>
                            <p className="text-indigo-100 text-xs">
                                Pedido {pedido} · Item {itemNum} · {item.codigo} — {item.descricao}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-indigo-500 rounded-full transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Progresso */}
                <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-100 shrink-0">
                    <div className="flex items-center justify-between text-xs text-indigo-700 font-medium mb-1">
                        <span>Total programado: <strong>{qtdProgramada.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong> / {qtdTotalStr}</span>
                        <span className={qtdDisponivel < 0 ? 'text-red-600 font-bold' : ''}>
                            Disponível: <strong>{qtdDisponivel.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</strong>
                        </span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${pctProgramado >= 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${pctProgramado}%` }} />
                    </div>
                </div>

                <div className="flex flex-col md:flex-row overflow-hidden flex-1 min-h-0">
                    {/* Painel esquerdo: Adicionar nova */}
                    <div className="w-full md:w-80 shrink-0 p-5 border-r border-gray-100 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-1 border-b mb-3">
                            <Plus className="h-4 w-4 text-indigo-600" /> Nova Programação
                        </h3>
                        <ProgForm
                            value={formData}
                            onChange={setFormData}
                            onSubmit={handleAdd}
                            saving={saving && !editingId}
                            qtdDisponivel={qtdDisponivel}
                            qtdTotal={qtdTotal}
                            isEdit={false}
                        />
                    </div>

                    {/* Lista de Programações */}
                    <div className="flex-1 p-5 overflow-y-auto">
                        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pb-1 border-b mb-4">
                            <Package className="h-4 w-4 text-indigo-600" />
                            Programações ({programacoes.length})
                        </h3>

                        {loading ? (
                            <div className="text-gray-400 text-sm text-center py-8">Carregando...</div>
                        ) : programacoes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
                                <AlertCircle className="h-10 w-10 mb-2 opacity-30" />
                                <span className="text-sm">Nenhuma programação cadastrada.</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {programacoes.map((prog, idx) => (
                                    <div key={prog.id}
                                        className={`rounded-xl border p-4 transition-all ${editingId === prog.id ? 'border-amber-400 bg-amber-50 shadow-md' : 'bg-gray-50 border-gray-200 hover:border-indigo-200'}`}>

                                        {/* Cabeçalho da prog */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">#{idx + 1}</span>
                                                {editingId !== prog.id && (
                                                    <>
                                                        <span className="text-sm font-bold text-gray-800">{fmtDate(prog.data_entrega_pcp)}</span>
                                                        <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded">
                                                            {parseFloat(prog.quantidade_pcp).toLocaleString('pt-BR')} un
                                                        </span>
                                                    </>
                                                )}
                                                {editingId === prog.id && (
                                                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Editando...</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {editingId !== prog.id && (
                                                    <button onClick={() => startEdit(prog)}
                                                        className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors rounded"
                                                        title="Editar programação">
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(prog.id)}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors rounded"
                                                    title="Remover">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Modo visualização */}
                                        {editingId !== prog.id && (
                                            <>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                                                    {prog.serie_cliente && <span><strong>Série Cli:</strong> {prog.serie_cliente}</span>}
                                                    {prog.serie_metalfisa && <span><strong>Série MF:</strong> {prog.serie_metalfisa}</span>}
                                                    {prog.numero_serie && <span><strong>Nº Série:</strong> {prog.numero_serie}</span>}
                                                    {prog.lote && <span><strong>Lote:</strong> {prog.lote}</span>}
                                                    {prog.numero_lote && <span><strong>Nº Lote:</strong> {prog.numero_lote}</span>}
                                                    {prog.observacao && <span className="col-span-2 italic text-gray-400"><strong>Obs:</strong> {prog.observacao}</span>}
                                                </div>
                                                <div className="mt-2 text-[10px] text-gray-400 flex justify-between">
                                                    <span>{prog.usuario}</span>
                                                    <span>{new Date(prog.created_at).toLocaleString('pt-BR')}</span>
                                                </div>
                                            </>
                                        )}

                                        {/* Modo edição inline */}
                                        {editingId === prog.id && (
                                            <div className="mt-2 border-t border-amber-200 pt-3">
                                                <ProgForm
                                                    value={editForm}
                                                    onChange={setEditForm}
                                                    onSubmit={(e) => handleUpdate(e, prog)}
                                                    onCancel={cancelEdit}
                                                    saving={saving && !!editingId}
                                                    qtdDisponivel={qtdDisponivelEdit(prog)}
                                                    qtdTotal={qtdTotal}
                                                    isEdit={true}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-gray-50 px-6 py-3 border-t flex justify-end shrink-0">
                    <button onClick={onClose} className="text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors">
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PCPForecastModal;
