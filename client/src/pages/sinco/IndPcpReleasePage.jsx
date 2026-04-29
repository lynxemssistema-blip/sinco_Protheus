import React, { useState, useEffect } from 'react';
import { Layers, Search, SplitSquareHorizontal, CheckCircle, RefreshCcw, Loader2, X, CheckSquare, Factory } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';
import IndApontamentoPage from './IndApontamentoPage';

const IndPcpReleasePage = () => {
    const [ops, setOps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedOp, setSelectedOp] = useState(null);
    const [stats, setStats] = useState({ total_pendentes: 0, total_ja_liberadas: 0 });

    const [activeTab, setActiveTab] = useState('pendentes'); // 'pendentes' | 'apontamento'
    const [selectedRows, setSelectedRows] = useState([]);
    const [batchSubmitting, setBatchSubmitting] = useState(false);
    const [isBatchMode, setIsBatchMode] = useState(false);

    // Estado do Modal de Fracionamento
    const [fracoesCount, setFracoesCount] = useState(1);
    const [fracoesDetalhe, setFracoesDetalhe] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    const fetchOps = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/ind_pcp/pending-ops');
            if (data.success) {
                setOps(data.data);
                setStats({
                    total_pendentes: data.total_pendentes,
                    total_ja_liberadas: data.total_ja_liberadas
                });
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao carregar OPs pendentes do Protheus.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOps();
    }, []);

    const openReleaseModal = (op) => {
        setIsBatchMode(false);
        setSelectedOp(op);
        setFracoesCount(1);
        setFracoesDetalhe([{ suf: '', qtde: op.quantidade }]);
        setModalOpen(true);
    };

    const openBatchReleaseModal = () => {
        if (selectedRows.length === 0) return;
        setIsBatchMode(true);
        setSelectedOp(null);
        setFracoesCount(1);
        setFracoesDetalhe([{ suf: '' }]);
        setModalOpen(true);
    };

    const handleFracoesChangeInput = (e) => {
        let count = parseInt(e.target.value);
        if (isNaN(count) || count < 1) count = 1;
        if (count > 26) count = 26; // max A-Z
        setFracoesCount(count);

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const novasFracoes = [];

        if (isBatchMode) {
            for (let i = 0; i < count; i++) {
                novasFracoes.push({
                    suf: count === 1 ? '' : `-${alphabet[i]}`
                });
            }
        } else {
            if (!selectedOp) return;
            const totalQtde = selectedOp.quantidade;
            let baseQtde = Math.floor(totalQtde / count);
            let resto = totalQtde - (baseQtde * count); // Distribui +1 nas primeiras

            for (let i = 0; i < count; i++) {
                let currentQtde = baseQtde;
                if (resto > 0) {
                    currentQtde += 1;
                    resto -= 1;
                }
                
                novasFracoes.push({
                    suf: count === 1 ? '' : `-${alphabet[i]}`,
                    qtde: currentQtde
                });
            }
        }
        setFracoesDetalhe(novasFracoes);
    };

    const handleFracaoDetailChange = (index, value) => {
        const val = parseFloat(value) || 0;
        const newFracoes = [...fracoesDetalhe];
        newFracoes[index].qtde = val;
        setFracoesDetalhe(newFracoes);
    };

    const handleRelease = async () => {
        if (!isBatchMode) {
            // Validação da soma
            const soma = fracoesDetalhe.reduce((acc, curr) => acc + curr.qtde, 0);
            if (selectedOp && selectedOp.quantidade > 0 && Math.abs(soma - selectedOp.quantidade) > 0.01) {
                toast.warning(`A soma das frações (${soma}) deve ser igual a quantidade total da OP (${selectedOp.quantidade}).`);
                return;
            }

            setSubmitting(true);
            try {
                const payload = {
                    op_base: selectedOp.op_base,
                    produto: selectedOp.produto,
                    descricao: selectedOp.descricao,
                    quantidade_total: selectedOp.quantidade,
                    fracoes: fracoesDetalhe
                };

                const { data } = await api.post('/ind_pcp/release-op', payload);
                if (data.success) {
                    toast.success(data.message);
                    setModalOpen(false);
                    fetchOps(); // Recarrega a tela
                }
            } catch (error) {
                console.error(error);
                toast.error("Erro ao liberar/fracionar OP.");
            } finally {
                setSubmitting(false);
            }
        } else {
            setSubmitting(true);
            try {
                let successCount = 0;
                const selectedOpsData = ops.filter(op => selectedRows.includes(op.op_base));

                for (const op of selectedOpsData) {
                    const totalQtde = op.quantidade;
                    let baseQtde = Math.floor(totalQtde / fracoesCount);
                    let resto = totalQtde - (baseQtde * fracoesCount);
                    
                    const currentFracoes = fracoesDetalhe.map((f, index) => {
                        let currentQtde = baseQtde;
                        if (resto > 0) {
                            currentQtde += 1;
                            resto -= 1;
                        }
                        return {
                            suf: f.suf,
                            qtde: currentQtde
                        };
                    });

                    const payload = {
                        op_base: op.op_base,
                        produto: op.produto,
                        descricao: op.descricao,
                        quantidade_total: op.quantidade,
                        fracoes: currentFracoes
                    };
                    
                    await api.post('/ind_pcp/release-op', payload);
                    successCount++;
                }

                toast.success(`${successCount} OPs liberadas e fracionadas com sucesso!`);
                setSelectedRows([]); // limpar seleção
                setModalOpen(false);
                fetchOps();
            } catch (error) {
                console.error(error);
                toast.error("Erro ao liberar OPs em lote.");
            } finally {
                setSubmitting(false);
            }
        }
    };

    const handleBatchRelease = async () => {
        if (selectedRows.length === 0) return;
        setBatchSubmitting(true);
        
        try {
            let successCount = 0;
            const selectedOpsData = ops.filter(op => selectedRows.includes(op.op_base));

            // Executa liberações em série (lote 1:1)
            for (const op of selectedOpsData) {
                const payload = {
                    op_base: op.op_base,
                    produto: op.produto,
                    descricao: op.descricao,
                    quantidade_total: op.quantidade,
                    fracoes: [{ suf: '', qtde: op.quantidade }]
                };
                
                await api.post('/ind_pcp/release-op', payload);
                successCount++;
            }

            toast.success(`${successCount} OPs liberadas com sucesso!`);
            setSelectedRows([]); // limpar seleção
            fetchOps(); // Recarrega
            // Switch tab to let them plan right away
            setActiveTab('apontamento');

        } catch (error) {
            console.error(error);
            toast.error("Erro durante a liberação em lote.");
        } finally {
            setBatchSubmitting(false);
        }
    };

    const toggleRowSelection = (op_base) => {
        setSelectedRows(prev => 
            prev.includes(op_base) ? prev.filter(id => id !== op_base) : [...prev, op_base]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRows.length === filteredOps.length) {
            setSelectedRows([]);
        } else {
            setSelectedRows(filteredOps.map(op => op.op_base));
        }
    };

    const filteredOps = ops.filter(op => 
        op.op_base.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.produto.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (op.pedido && op.pedido.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (op.pedcli && op.pedcli.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 md:p-8 max-w-[1400px] mx-auto">
            {/* Header Tabs */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                        <Layers className="text-indigo-600 h-6 w-6" />
                        Fracionamento e Liberação
                    </h1>
                    <p className="text-slate-500 mt-2">
                        Selecione as OPs brutas vindas do ERP, fraciona em lotes e direcione para a fábrica.
                    </p>
                </div>
                
                <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm cursor-pointer">
                    <div 
                        onClick={() => setActiveTab('pendentes')}
                        className={`px-6 py-3 border-r border-slate-200 text-center transition-colors ${activeTab === 'pendentes' ? 'bg-indigo-50 border-b-2 border-b-indigo-500' : 'bg-slate-50 hover:bg-slate-100'}`}
                    >
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Abertas (ERP)</p>
                        <p className={`text-xl font-bold ${activeTab === 'pendentes' ? 'text-indigo-700' : 'text-slate-800'}`}>{stats.total_pendentes}</p>
                    </div>
                    <div 
                        onClick={() => setActiveTab('apontamento')}
                        className={`px-6 py-3 text-center transition-colors ${activeTab === 'apontamento' ? 'bg-emerald-50 border-b-2 border-b-emerald-500' : 'hover:bg-slate-50'}`}
                    >
                        <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide">Fábrica (Apontar)</p>
                        <p className={`text-xl font-bold ${activeTab === 'apontamento' ? 'text-emerald-700' : 'text-emerald-600'}`}>{stats.total_ja_liberadas}</p>
                    </div>
                </div>
            </div>

            {/* Content Based on Tab */}
            {activeTab === 'apontamento' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 relative overflow-hidden min-h-[60vh]">
                    {/* Renderizamos a página de Apontamento diretamente aqui, aproveitando que ela já faz tudo */}
                    <IndApontamentoPage embedded={true} />
                </div>
            ) : (
                <>
                    {/* Toolbar Pendentes */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input 
                                    type="text"
                                    placeholder="Buscar por OP, Produto ou Pedido..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <button 
                                onClick={fetchOps}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm whitespace-nowrap"
                            >
                                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                Sincronizar
                            </button>
                        </div>
                        
                        {selectedRows.length > 0 && (
                            <button 
                                onClick={openBatchReleaseModal}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors whitespace-nowrap"
                            >
                                <CheckSquare className="h-4 w-4" />
                                Liberar e Fracionar {selectedRows.length} {selectedRows.length === 1 ? 'OP' : 'OPs'} em Lote
                            </button>
                        )}
                    </div>

                    {/* Content Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200">
                                        <th className="px-4 py-4 w-12 text-center">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedRows.length > 0 && selectedRows.length === filteredOps.length}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                            />
                                        </th>
                                        <th className="px-4 py-4 font-semibold">Venda / Cliente</th>
                                        <th className="px-4 py-4 font-semibold">Ped. Cli</th>
                                        <th className="px-4 py-4 font-semibold">OP Base</th>
                                        <th className="px-4 py-4 font-semibold">Produto</th>
                                        <th className="px-4 py-4 font-semibold text-right">Saldo Fat.</th>
                                        <th className="px-4 py-4 font-semibold text-right">Qtde OP</th>
                                        <th className="px-4 py-4 font-semibold text-center">Prev. OP</th>
                                        <th className="px-4 py-4 font-semibold text-center">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {loading ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                                <div className="flex flex-col items-center justify-center gap-3">
                                                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                                                    <span>Lendo OPs no PostgreSQL (ERP)...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredOps.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                                Nenhuma OP pendente encontrada com esses filtros.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredOps.map((op) => (
                                            <tr 
                                                key={op.op_base} 
                                                onClick={() => toggleRowSelection(op.op_base)}
                                                className={`transition-colors cursor-pointer ${selectedRows.includes(op.op_base) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                                            >
                                                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <input 
                                                        type="checkbox"
                                                        checked={selectedRows.includes(op.op_base)}
                                                        onChange={() => toggleRowSelection(op.op_base)}
                                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-800">{op.pedido} <span className="text-slate-400 font-normal">/{op.item_pedido}</span></div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[150px]" title={op.cliente}>{op.cliente}</div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-600">{op.pedcli || '-'}</td>
                                                <td className="px-4 py-3 font-semibold text-indigo-700">{op.op_base}</td>
                                                <td className="px-4 py-3">
                                                    <div className="text-slate-800 font-medium">{op.produto}</div>
                                                    <div className="text-xs text-slate-500 truncate max-w-[200px]" title={op.descricao}>{op.descricao}</div>
                                                </td>
                                                <td className="px-4 py-3 font-medium text-right text-emerald-600">{op.qtd_saldo_faturar}</td>
                                                <td className="px-4 py-3 font-bold text-right text-slate-700">{op.quantidade}</td>
                                                <td className="px-4 py-3 text-center text-slate-500">
                                                    {op.data_prevista ? new Date(op.data_prevista + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => openReleaseModal(op)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded-md transition-colors text-xs"
                                                    >
                                                        <SplitSquareHorizontal className="h-3.5 w-3.5" />
                                                        Fracionar Lote
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* Modal de Fracionamento */}
            {modalOpen && (
                <div className="fixed inset-0 z-[990] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 flex flex-col max-h-[90vh]">
                        
                        <div className="flex items-center justify-between p-5 border-b border-slate-100">
                            <div>
                                <h3 className="text-lg font-bold text-slate-800">Fracionamento e Liberação</h3>
                                <p className="text-sm text-slate-500">
                                    {isBatchMode ? `Liberando ${selectedRows.length} OPs em Lote` : `OP Base: `}
                                    {!isBatchMode && <span className="font-semibold text-slate-700">{selectedOp?.op_base}</span>}
                                </p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 flex justify-between items-center">
                                <div>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Produto</p>
                                    <p className="font-medium text-slate-800">{isBatchMode ? `Lote de ${selectedRows.length} OPs Selecionadas` : selectedOp?.produto}</p>
                                    <p className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{isBatchMode ? 'Fracionamento aplicado igualmente a todos os itens' : selectedOp?.descricao}</p>
                                </div>
                                {!isBatchMode && (
                                    <div className="text-right">
                                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total a Fracionar</p>
                                        <p className="text-lg font-bold text-indigo-700">{selectedOp?.quantidade}</p>
                                    </div>
                                )}
                            </div>

                            <div className="mb-5">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Número de Lotes (Frações):</label>
                                <div className="flex items-center gap-3">
                                    <input 
                                        type="number" 
                                        min="1" 
                                        max="26"
                                        value={fracoesCount}
                                        onChange={handleFracoesChangeInput}
                                        className="w-24 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-center"
                                    />
                                    <span className="text-sm text-slate-500">Frações (Max 26)</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Distribuição de Quantidades:</label>
                                {fracoesDetalhe.map((f, index) => (
                                    <div key={index} className="flex items-center gap-4 bg-white border border-slate-200 p-3 rounded-lg shadow-sm">
                                        <div className="flex-1 font-mono text-sm font-semibold text-slate-700">
                                            {isBatchMode ? `Fração ${f.suf || 'Única'}` : `${selectedOp?.op_base}${f.suf || ''}`}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isBatchMode ? (
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={f.qtde}
                                                    onChange={(e) => handleFracaoDetailChange(index, e.target.value)}
                                                    className="w-24 px-2 py-1.5 border border-slate-300 rounded text-right font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-slate-500">Divisão Automática</span>
                                            )}
                                            <span className="text-xs text-slate-400 font-medium w-6">UN</span>
                                        </div>
                                    </div>
                                ))}

                                {!isBatchMode && fracoesCount > 1 && (
                                    <div className="pt-2 flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Soma atual:</span>
                                        <span className={`font-bold ${Math.abs(fracoesDetalhe.reduce((a,b)=>a+b.qtde,0) - (selectedOp?.quantidade || 0)) > 0.01 ? 'text-red-500' : 'text-emerald-500'}`}>
                                            {fracoesDetalhe.reduce((a,b)=>a+b.qtde,0).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
                            <button 
                                onClick={() => setModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleRelease}
                                disabled={submitting}
                                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-70"
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                                Criar e Liberar Lotes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IndPcpReleasePage;

