import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, History, Save, AlertCircle } from 'lucide-react';
import { getStockBalance, getStockMovements, addStockMovement } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function StockModal({ isOpen, onClose, productCode, productName }) {
    const { user } = useAuth();
    const [balanceProtheus, setBalanceProtheus] = useState(0);
    const [balanceFabrica, setBalanceFabrica] = useState(0);
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Form State
    const [type, setType] = useState('E'); // E = Entrada, S = Saída
    const [quantity, setQuantity] = useState('');
    const [observation, setObservation] = useState('');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && productCode) {
            loadData();
            // Reset form
            setQuantity('');
            setObservation('');
            setType('E');
            setError(null);
        }
    }, [isOpen, productCode]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [balanceData, movementsData] = await Promise.all([
                getStockBalance(productCode),
                getStockMovements(productCode)
            ]);
            setBalanceProtheus(balanceData.saldoProtheus || 0);
            setBalanceFabrica(balanceData.saldoFabrica || 0);
            setMovements(movementsData);
        } catch (err) {
            console.error(err);
            setError('Falha ao carregar dados do estoque.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!quantity || parseFloat(quantity) <= 0) return;

        setSubmitting(true);
        setError(null);
        try {
            await addStockMovement({
                produto_codigo: productCode,
                tipo: type,
                quantidade: parseFloat(quantity),
                observacao: observation,
                usuario: user?.nome || user?.login || 'Usuário Desconhecido'
            });
            await loadData(); // Reload data
            setQuantity('');
            setObservation('');
            // Optional: Close modal or show success message?
        } catch (err) {
            setError('Erro ao salvar movimentação.');
        } finally {
            setSubmitting(false);
        }
    };

    const formatMovementDate = (dateString) => {
        if (!dateString) return '-';
        if (/^\d{8}$/.test(dateString)) {
            const year = dateString.substring(0, 4);
            const month = dateString.substring(4, 6);
            const day = dateString.substring(6, 8);
            return `${day}/${month}/${year}`;
        }
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return String(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Controle de Estoque</h3>
                        <p className="text-sm text-gray-500 font-mono mt-0.5">
                            {productCode} <span className="mx-1">•</span> {productName}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {/* Saldos Banners */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-sm text-gray-500 font-medium uppercase tracking-wider">Saldo ERP (Protheus)</span>
                                <div className={`text-4xl font-bold mt-1 ${balanceProtheus < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                                    {(balanceProtheus || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                    <span className="text-lg text-gray-400 font-normal ml-2">unidades</span>
                                </div>
                            </div>
                            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${balanceProtheus > 0 ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                <History className="h-6 w-6" />
                            </div>
                        </div>

                        <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
                            <div>
                                <span className="text-sm text-blue-600 font-medium uppercase tracking-wider">Saldo Local (Fábrica)</span>
                                <div className={`text-4xl font-bold mt-1 ${balanceFabrica < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                                    {(balanceFabrica || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}
                                    <span className="text-lg text-blue-400 font-normal ml-2">unidades</span>
                                </div>
                            </div>
                            <div className={`h-12 w-12 rounded-full flex items-center justify-center ${balanceFabrica > 0 ? 'bg-blue-200 text-blue-700' : 'bg-blue-100 text-blue-400'}`}>
                                <Save className="h-6 w-6" />
                            </div>
                        </div>
                    </div>

                    {/* Formulário de Movimentação */}
                    <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm mb-6">
                        <h4 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <Save className="h-4 w-4 text-blue-500" />
                            Nova Movimentação
                        </h4>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-4">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                                <div className="flex bg-gray-100 p-1 rounded-lg">
                                    <button
                                        type="button"
                                        onClick={() => setType('E')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${type === 'E' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <TrendingUp className="h-4 w-4" /> Entrada
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setType('S')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${type === 'S' ? 'bg-white text-red-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        <TrendingDown className="h-4 w-4" /> Saída
                                    </button>
                                </div>
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Quantidade</label>
                                <input
                                    type="number"
                                    step="0.0001"
                                    min="0.0001"
                                    required
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="md:col-span-5">
                                <label className="block text-xs font-semibold text-gray-500 mb-1">Observação</label>
                                <input
                                    type="text"
                                    value={observation}
                                    onChange={e => setObservation(e.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                                    placeholder="Motivo (opcional)"
                                />
                            </div>

                            <div className="md:col-span-12 flex justify-end mt-2">
                                <button
                                    type="submit"
                                    disabled={submitting || !quantity}
                                    className="bg-slate-900 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                                >
                                    {submitting ? 'Salvando...' : 'Registrar Movimento'}
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Histórico */}
                    <div>
                        <h4 className="text-sm font-semibold text-gray-800 mb-3 ml-1">Histórico Recente</h4>
                        {loading && movements.length === 0 ? (
                            <div className="text-center py-8 text-gray-400 text-sm">Carregando histórico...</div>
                        ) : movements.length === 0 ? (
                            <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400 text-sm">
                                Nenhuma movimentação registrada.
                            </div>
                        ) : (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase">
                                        <tr>
                                            <th className="px-4 py-3">Data</th>
                                            <th className="px-4 py-3">Usuário</th>
                                            <th className="px-4 py-3 text-center">Tipo</th>
                                            <th className="px-4 py-3 text-right">Qtd</th>
                                            <th className="px-4 py-3">Obs</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {movements.map((mov) => (
                                            <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 text-gray-600 font-medium">
                                                    {formatMovementDate(mov.data_movimento)}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600 truncate max-w-[120px]" title={mov.usuario}>
                                                    {mov.id?.toString().startsWith('PROT-') ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600 mr-2">ERP</span>
                                                    ) : mov.id?.toString().startsWith('FAB-') ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700 mr-2">FÁB</span>
                                                    ) : null}
                                                    {mov.usuario || '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${mov.tipo === 'E'
                                                        ? 'bg-green-50 text-green-700 border-green-100'
                                                        : 'bg-red-50 text-red-700 border-red-100'
                                                        }`}>
                                                        {mov.tipo === 'E' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                        {mov.tipo === 'E' ? 'Entrada' : 'Saída'}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-right font-mono font-medium ${mov.tipo === 'E' ? 'text-green-700' : 'text-red-700'
                                                    }`}>
                                                    {mov.tipo === 'S' ? '-' : '+'}{parseFloat(mov.quantidade).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]" title={mov.observacao}>
                                                    {mov.observacao || '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
