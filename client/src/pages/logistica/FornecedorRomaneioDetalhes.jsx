import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, FileText, CheckCircle, Save, Settings, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveAppointment, getProductionStructureRouting } from '../../services/api';
import { toast } from 'react-toastify';

export default function FornecedorRomaneioDetalhes() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [romaneio, setRomaneio] = useState(null);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Modal state
    const [isApontamentoModalOpen, setIsApontamentoModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [routingOps, setRoutingOps] = useState([]);
    const [loadingRouting, setLoadingRouting] = useState(false);

    // Form state
    const [apontamentoForm, setApontamentoForm] = useState({
        operacao_codigo: '',
        op_sequencia: '',
        quantidade: '',
        observacao: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchDetails();
    }, [id]);

    const fetchDetails = async () => {
        try {
            const token = localStorage.getItem('@MetalFisa:token');
            const res = await fetch(`/api/romaneios/portal/details/${id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 401) throw new Error('Sessão expirada ou não autenticado. Faça login novamente.');
            if (res.status === 403) throw new Error('Acesso negado. Você não tem permissão para ver este romaneio.');
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erro ${res.status}: Falha ao carregar detalhes do romaneio`);
            }

            const data = await res.json();
            setRomaneio(data.romaneio);
            setItems(data.items);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenApontamento = async (item) => {
        setSelectedItem(item);
        setApontamentoForm({
            operacao_codigo: '',
            op_sequencia: '',
            quantidade: item.quantidade || '',
            observacao: ''
        });
        setRoutingOps([]);
        setIsApontamentoModalOpen(true);

        if (item.pedido) {
            setLoadingRouting(true);
            try {
                const route = await getProductionStructureRouting(item.pedido);
                if (route && Array.isArray(route)) {
                    setRoutingOps(route);
                }
            } catch (err) {
                toast.error('Erro ao buscar roteiro da OP.');
            } finally {
                setLoadingRouting(false);
            }
        }
    };

    const handleSaveApontamento = async (e) => {
        e.preventDefault();
        
        if (!apontamentoForm.operacao_codigo || !apontamentoForm.op_sequencia) {
            return toast.warn('Selecione a operação/recurso.');
        }

        if (Number(apontamentoForm.quantidade) <= 0) {
            return toast.warn('A quantidade deve ser maior que zero.');
        }

        setSaving(true);
        try {
            const payload = {
                op_numero: selectedItem.pedido,
                op_item: selectedItem.item_pedido || '01',
                op_sequencia: apontamentoForm.op_sequencia,
                operacao_codigo: apontamentoForm.operacao_codigo,
                usuario: user.login,
                quantidade: Number(apontamentoForm.quantidade),
                data_inicio: new Date().toISOString(),
                data_fim: new Date().toISOString(),
                observacao: apontamentoForm.observacao
            };

            await saveAppointment(payload);
            toast.success('Apontamento realizado com sucesso!');
            setIsApontamentoModalOpen(false);
            // Optionally refresh item status or something here if we track history locally
        } catch (err) {
            toast.error(err.response?.data?.error || err.message || 'Erro ao salvar apontamento');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (error || !romaneio) {
        return (
            <div className="p-4 md:p-8 w-full max-w-[1920px] mx-auto text-center">
                <div className="bg-red-50 text-red-700 p-4 rounded-xl inline-flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span>{error || 'Romaneio não encontrado'}</span>
                </div>
                <div className="mt-4">
                    <button onClick={() => navigate('/fornecedor/romaneios')} className="text-blue-600 hover:underline">
                        Voltar para lista
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 w-full max-w-[1920px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button 
                    onClick={() => navigate('/fornecedor/romaneios')}
                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Romaneio #{romaneio.id}
                    </h1>
                    <p className="text-gray-500 mt-1">Detalhes e itens para processamento.</p>
                </div>
                
                <div className="ml-auto flex items-center gap-3">
                    <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                        romaneio.status === 'Enviado' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        romaneio.status === 'Retornando' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                        romaneio.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' :
                        'bg-gray-50 text-gray-700 border-gray-200'
                    }`}>
                        {romaneio.status || 'Ativo'}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Info Card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm col-span-1">
                    <h3 className="font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Informações Gerais</h3>
                    <div className="space-y-4">
                        <div>
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Data de Liberação</span>
                            <div className="flex items-center gap-2 mt-1 text-gray-700">
                                <Calendar className="h-4 w-4 text-blue-500" />
                                {new Date(romaneio.data_liberacao).toLocaleDateString('pt-BR')}
                            </div>
                        </div>
                        {romaneio.observacao_geral && (
                            <div>
                                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Observações</span>
                                <div className="flex items-start gap-2 mt-1 text-gray-700 text-sm bg-gray-50 p-3 rounded-lg border border-gray-100">
                                    <FileText className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <span>{romaneio.observacao_geral}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Itens List */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm col-span-1 lg:col-span-2 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-600" />
                            Itens do Romaneio ({items.length})
                        </h3>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3">Código / Produto</th>
                                    <th className="px-4 py-3">OP (Pedido)</th>
                                    <th className="px-4 py-3 text-right">Qtd. Enviada</th>
                                    <th className="px-4 py-3 text-center">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map(item => (
                                    <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-mono text-blue-700 font-semibold">{item.codigo_produto}</div>
                                            <div className="text-gray-500 text-xs mt-0.5 truncate max-w-[200px]" title={item.descricao_produto}>
                                                {item.descricao_produto}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-mono font-medium text-gray-700">{item.pedido || '-'}</div>
                                            {item.item_pedido && <div className="text-xs text-gray-400">Item: {item.item_pedido}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                            {item.quantidade}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => handleOpenApontamento(item)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                                            >
                                                <CheckCircle className="h-3.5 w-3.5" />
                                                Apontar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                            Nenhum item vinculado a este romaneio.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal de Apontamento */}
            {isApontamentoModalOpen && selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-gray-100 flex flex-col max-h-[90vh]">
                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Settings className="h-5 w-5 text-blue-600" />
                                Apontamento de Produção
                            </h3>
                            <button onClick={() => setIsApontamentoModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                &times;
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveApontamento} className="p-5 overflow-y-auto space-y-4">
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                                <p className="text-sm text-blue-800">
                                    Apontando <strong>{selectedItem.codigo_produto}</strong><br/>
                                    OP: <strong>{selectedItem.pedido}</strong> (Qtd Total: {selectedItem.quantidade})
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Operação / Recurso
                                </label>
                                {loadingRouting ? (
                                    <div className="flex items-center gap-2 text-sm text-gray-500 py-2 border rounded-xl px-3 bg-gray-50">
                                        <div className="animate-spin h-4 w-4 border-b-2 border-gray-400 rounded-full"></div>
                                        Buscando roteiro...
                                    </div>
                                ) : routingOps.length > 0 ? (
                                    <select 
                                        className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                        required
                                        value={apontamentoForm.operacao_codigo}
                                        onChange={(e) => {
                                            const opCode = e.target.value;
                                            const op = routingOps.find(r => r.codigo_operacao === opCode);
                                            setApontamentoForm({
                                                ...apontamentoForm, 
                                                operacao_codigo: opCode,
                                                op_sequencia: op ? op.sequencia : ''
                                            });
                                        }}
                                    >
                                        <option value="">Selecione a operação...</option>
                                        {routingOps.map(op => (
                                            <option key={op.codigo_operacao} value={op.codigo_operacao}>
                                                Seq {op.sequencia} - {op.desc_operacao || op.recurso_codigo}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <div className="text-sm text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                        Nenhum roteiro encontrado para a OP {selectedItem.pedido}. Contate o PCP.
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Quantidade Concluída
                                </label>
                                <input 
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    required
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={apontamentoForm.quantidade}
                                    onChange={e => setApontamentoForm({...apontamentoForm, quantidade: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Observações (Opcional)
                                </label>
                                <textarea 
                                    rows="2"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                                    value={apontamentoForm.observacao}
                                    onChange={e => setApontamentoForm({...apontamentoForm, observacao: e.target.value})}
                                    placeholder="Ex: Peças com rebarba, máquina parou..."
                                ></textarea>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsApontamentoModalOpen(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || routingOps.length === 0}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {saving ? <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" /> : <Save className="h-4 w-4" />}
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
