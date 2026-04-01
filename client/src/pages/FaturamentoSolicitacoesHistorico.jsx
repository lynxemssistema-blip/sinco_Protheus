import React, { useState, useEffect } from 'react';
import { getFaturamentoSolicitacoes, updateFaturamentoSolicitacaoStatus, enviarFaturamentoEmailLote } from '../services/api';
import { History, FileText, Calendar, Box, CheckCircle, Clock, XCircle, Search, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { toast } from 'react-toastify';
import generateFaturamentoPdf from '../services/faturamentoPdfGenerator';
import { useAuth } from '../contexts/AuthContext';
import useStickyState from '../hooks/useStickyState';

const FaturamentoSolicitacoesHistorico = () => {
    const { user } = useAuth();
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedRows, setExpandedRows] = useState({});

    // Multiselection
    const [selectedItems, setSelectedItems] = useState([]);
    const [loadingEmail, setLoadingEmail] = useState(false);

    // Simple filters
    const [statusFilter, setStatusFilter] = useStickyState('', '@metalfisa:histFat_status');

    const fetchHistorico = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getFaturamentoSolicitacoes({ limit: 100, page: 1, status: statusFilter });
            setSolicitacoes(res.data || []);
        } catch (err) {
            console.error(err);
            setError('Erro ao carregar o histórico de solicitações.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistorico();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const toggleRow = (id) => {
        setExpandedRows(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleUpdateStatus = async (id, novoStatus) => {
        if (!window.confirm(`Deseja alterar o status para ${novoStatus}?`)) return;
        try {
            await updateFaturamentoSolicitacaoStatus(id, novoStatus);
            toast.success('Status atualizado!');
            fetchHistorico();
        } catch (err) {
            toast.error('Erro ao atualizar status.');
        }
    };

    const toggleSelection = (id) => {
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSendEmailLote = async () => {
        try {
            setLoadingEmail(true);
            await enviarFaturamentoEmailLote({
                ids: selectedItems,
                usuario: user?.nome || 'Sistema'
            });
            
            toast.success(`E-mail com ${selectedItems.length} faturamento(s) enviado com sucesso!`);
            setSelectedItems([]);
        } catch (err) {
            toast.error('Erro ao enviar e-mail em lote.');
        } finally {
            setLoadingEmail(false);
        }
    };

    const StatusBadge = ({ status }) => {
        switch (status) {
            case 'Pendente':
                return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-bold rounded-md flex items-center gap-1 w-fit"><Clock className="w-3 h-3" /> Pendente</span>;
            case 'Atendido':
                return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-md flex items-center gap-1 w-fit"><CheckCircle className="w-3 h-3" /> Faturado/Atendido</span>;
            case 'Cancelado':
                return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-bold rounded-md flex items-center gap-1 w-fit"><XCircle className="w-3 h-3" /> Cancelado</span>;
            default:
                return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-bold rounded-md">{status}</span>;
        }
    };

    return (
        <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto animate-fadeIn relative">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">
                <div className="p-5 border-b border-gray-100 bg-white">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <History className="h-6 w-6 text-blue-600" />    
                                Histórico de Solicitações
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">Acompanhe os pedidos de faturamento enviados pela expedição.</p>
                        </div>
                        <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-200">
                            <button 
                                onClick={() => setStatusFilter('')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === '' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Todas
                            </button>
                            <button 
                                onClick={() => setStatusFilter('Pendente')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === 'Pendente' ? 'bg-white shadow-sm text-yellow-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Pendentes
                            </button>
                            <button 
                                onClick={() => setStatusFilter('Atendido')}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${statusFilter === 'Atendido' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                                Atendidas
                            </button>
                        </div>
                    </div>
                </div>

                <div className="p-0">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-500 gap-4">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                            Carregando histórico...
                        </div>
                    ) : error ? (
                        <div className="p-12 text-center text-red-500">{error}</div>
                    ) : solicitacoes.length === 0 ? (
                        <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                            <FileText className="h-12 w-12 opacity-20" />
                            <p>Nenhuma solicitação encontrada.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {solicitacoes.map(solicitacao => {
                                const isExpanded = !!expandedRows[solicitacao.id];
                                return (
                                    <div key={solicitacao.id} className="group flex flex-col">
                                        {/* CABEÇALHO DA SOLICITAÇÃO */}
                                        <div 
                                            className={`flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}
                                            onClick={() => toggleRow(solicitacao.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <input 
                                                    type="checkbox"
                                                    className="w-5 h-5 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedItems.includes(solicitacao.id)}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        toggleSelection(solicitacao.id);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <div className="bg-blue-50 text-blue-700 p-2.5 rounded-lg border border-blue-100">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-bold text-gray-900 text-lg">{solicitacao.numero_solicitacao}</span>
                                                        <StatusBadge status={solicitacao.status} />
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium whitespace-nowrap">
                                                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Data: {new Date(solicitacao.created_at).toLocaleString('pt-BR')}</span>
                                                        <span className="flex items-center gap-1.5"><Box className="h-3.5 w-3.5" /> Itens: {solicitacao.qtd_itens_diferentes} un.</span>
                                                        <span>Usuário: {solicitacao.usuario}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-6">
                                                {/* Botões rápidos de ação administrativa */}
                                                <div className="hidden md:flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <button 
                                                        onClick={() => generateFaturamentoPdf(solicitacao, user)}
                                                        className="text-xs font-bold px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 rounded-md transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Download className="w-3.5 h-3.5" /> PDF
                                                    </button>
                                                    {solicitacao.status === 'Pendente' && (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(solicitacao.id, 'Atendido')}
                                                            className="text-xs font-bold px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 rounded-md transition-colors"
                                                        >
                                                            Marcar Atendido
                                                        </button>
                                                    )}
                                                    {solicitacao.status === 'Pendente' && (
                                                        <button 
                                                            onClick={() => handleUpdateStatus(solicitacao.id, 'Cancelado')}
                                                            className="text-xs font-bold px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-md transition-colors"
                                                        >
                                                            Cancelar
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="text-gray-400 p-1">
                                                    {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                                </div>
                                            </div>
                                        </div>

                                        {/* DETALHES EXPANDIDOS */}
                                        {isExpanded && (
                                            <div className="p-4 pt-2 pb-6 pl-[72px] bg-gray-50/50 border-t border-gray-100">
                                                {solicitacao.observacao && (
                                                    <div className="mb-4 p-3 bg-yellow-50/50 border border-yellow-100 rounded-md text-sm text-yellow-800">
                                                        <span className="font-bold mr-2">Observações: </span>
                                                        {solicitacao.observacao}
                                                    </div>
                                                )}
                                                
                                                <div className="bg-white border text-sm border-gray-200 rounded-lg overflow-hidden shadow-sm">
                                                    <table className="w-full text-left whitespace-nowrap">
                                                        <thead className="bg-gray-100/50 text-gray-500 text-xs uppercase border-b border-gray-200">
                                                            <tr>
                                                                <th className="px-4 py-2 font-semibold">T.</th>
                                                                <th className="px-4 py-2 font-semibold">Pedido/Item</th>
                                                                <th className="px-4 py-2 font-semibold">Cód. Produto</th>
                                                                <th className="px-4 py-2 font-semibold bg-blue-50/50 text-blue-800">Ped. Cli</th>
                                                                <th className="px-4 py-2 font-semibold bg-blue-50/50 text-blue-800">Desenho Cli.</th>
                                                                <th className="px-4 py-2 font-semibold text-right">Saldo Faturar</th>
                                                                <th className="px-4 py-2 font-semibold text-right text-blue-700">Qtd. a Faturar</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {solicitacao.itens?.map((it, idx) => (
                                                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                                    <td className="px-4 py-2">
                                                                        <div className="px-1 rounded border border-gray-300 text-[9px] font-bold text-center text-gray-500 w-fit uppercase">
                                                                            ITM
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-2 font-mono text-gray-900">{it.pedido} <span className="text-gray-400 mx-1">-</span> {it.item}</td>
                                                                    <td className="px-4 py-2 font-mono text-blue-700 font-semibold">{it.codigo_produto}</td>
                                                                    <td className="px-4 py-2 font-mono text-[11px] text-gray-600 bg-blue-50/30 whitespace-nowrap">{it.pedido_cliente || '-'}</td>
                                                                    <td className="px-4 py-2 font-mono text-[11px] text-blue-900 font-bold bg-blue-50/30 whitespace-nowrap">{it.desenho_cliente || '-'}</td>
                                                                    <td className="px-4 py-2 text-right text-gray-400 font-medium">
                                                                        {parseFloat(it.saldo_faturar_momentaneo).toLocaleString()}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-bold text-[15px] text-blue-700">
                                                                        {parseFloat(it.quantidade_solicitada).toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
            {/* FLOATING ACTION BAR PARA ENVIO DE E-MAIL LOTE */}
            {selectedItems.length > 0 && (
                <div className="fixed bottom-6 right-6 bg-blue-600 text-white p-4 rounded-xl shadow-2xl flex items-center gap-4 z-50 animate-fadeIn">
                    <div>
                        <span className="font-bold text-lg">{selectedItems.length}</span> selecionados
                    </div>
                    <button 
                        onClick={handleSendEmailLote}
                        disabled={loadingEmail}
                        className="bg-white text-blue-700 px-4 py-2 rounded-lg font-bold hover:bg-blue-50 transition-colors flex items-center gap-2"
                    >
                        {loadingEmail ? 'Enviando...' : 'Enviar por E-mail'}
                    </button>
                    <button onClick={() => setSelectedItems([])} className="text-blue-200 hover:text-white transition-colors">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default FaturamentoSolicitacoesHistorico;
