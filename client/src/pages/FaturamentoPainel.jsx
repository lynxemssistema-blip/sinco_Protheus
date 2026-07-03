import React, { useState, useEffect } from 'react';
import { 
    getFaturamentoSolicitacoes, 
    updateFaturamentoSolicitacaoStatus, 
    updateFaturamentoSolicitacaoNotaFiscal,
    getFaturamentoAuditoria,
    updateFaturamentoSolicitacaoItem,
    deleteFaturamentoSolicitacaoItem,
    insertFaturamentoSolicitacaoItem 
} from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { getPedidosFlat } from '../services/api';
import { FileText, Plus, Trash2, Edit3, Save, X, History, Clock, CheckCircle, Search, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';

const FaturamentoPainel = () => {
    const { user } = useAuth();
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSolicitacao, setSelectedSolicitacao] = useState(null);
    const [auditoria, setAuditoria] = useState([]);

    // Filtros
    const [statusFilter, setStatusFilter] = useState('Pendente');

    // UI States
    const [globalNf, setGlobalNf] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [editForm, setEditForm] = useState({});
    
    // Modal Add Item
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addSearchText, setAddSearchText] = useState('');
    const [addSearchResults, setAddSearchResults] = useState([]);
    const [isAddSearching, setIsAddSearching] = useState(false);
    const [candidateItem, setCandidateItem] = useState(null);
    const [addQtdForm, setAddQtdForm] = useState('');

    useEffect(() => {
        fetchSolicitacoes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter]);

    const fetchSolicitacoes = async () => {
        setLoading(true);
        try {
            const res = await getFaturamentoSolicitacoes({ limit: 100, page: 1, status: statusFilter });
            setSolicitacoes(res.data || []);
            // Update selected if open
            if (selectedSolicitacao) {
                const updated = res.data.find(s => s.id === selectedSolicitacao.id);
                if (updated) setSelectedSolicitacao(updated);
                else setSelectedSolicitacao(null);
            }
        } catch (err) {
            toast.error('Erro ao carregar solicitações do financeiro.');
        } finally {
            setLoading(false);
        }
    };

    const loadAuditoria = async (id) => {
        try {
            const res = await getFaturamentoAuditoria(id);
            setAuditoria(res);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelect = (solicitacao) => {
        setSelectedSolicitacao(solicitacao);
        setGlobalNf(solicitacao.nota_fiscal || '');
        loadAuditoria(solicitacao.id);
        setEditingItem(null);
    };

    const handleMarkAsFaturado = async (id) => {
        if(!window.confirm("Confirmar fechamento de Faturamento dessa solicitação?")) return;
        try {
            await updateFaturamentoSolicitacaoStatus(id, 'Atendido');
            toast.success("Solicitação baixada como faturada!");
            setSelectedSolicitacao(null);
            fetchSolicitacoes();
        } catch (err) {
            toast.error("Erro ao fechar solicitação.");
        }
    };

    const handleSaveGlobalNF = async () => {
        if(!selectedSolicitacao) return;
        try {
            await updateFaturamentoSolicitacaoNotaFiscal(selectedSolicitacao.id, { nota_fiscal: globalNf, usuario: user?.nome || 'Financeiro' });
            toast.success("NF Header salva!");
            fetchSolicitacoes();
            loadAuditoria(selectedSolicitacao.id);
        } catch (err) {
            toast.error("Erro ao salvar NF.");
        }
    };

    // ITEM CRUD
    const handleEditClick = (it) => {
        setEditingItem(it.id);
        setEditForm({ quantidade_solicitada: it.quantidade_solicitada, nota_fiscal: it.nota_fiscal || '' });
    };

    const handleSaveItemEdit = async (itemId) => {
        try {
            await updateFaturamentoSolicitacaoItem(selectedSolicitacao.id, itemId, {
                quantidade_solicitada: editForm.quantidade_solicitada,
                nota_fiscal: editForm.nota_fiscal,
                usuario: user?.nome || 'Financeiro'
            });
            toast.success("Item atualizado!");
            setEditingItem(null);
            fetchSolicitacoes();
            loadAuditoria(selectedSolicitacao.id);
        } catch(err) {
            toast.error("Erro ao atualizar item.");
        }
    };

    const handleDeleteItem = async (it) => {
        if(!window.confirm(`Excluir ${it.pedido}-${it.item} da solicitação?`)) return;
        try {
            await deleteFaturamentoSolicitacaoItem(selectedSolicitacao.id, it.id, { usuario: user?.nome || 'Financeiro' });
            toast.success("Item removido!");
            fetchSolicitacoes();
            loadAuditoria(selectedSolicitacao.id);
        } catch(err) {
            toast.error("Erro ao remover item.");
        }
    };

    // SEARCH NEW ITEMS
    const handleSearchAdd = async () => {
        if(addSearchText.length < 3) {
            toast.warning("Digite ao menos 3 caracteres (Pedido, Cliente ou Produto)");
            return;
        }
        setIsAddSearching(true);
        setCandidateItem(null);
        try {
            const res = await getPedidosFlat({ pedido: addSearchText, limit: 15, page: 1, only_active: 'true' });
            setAddSearchResults(res.data || []);
        } catch(err) {
            toast.error("Erro ao buscar base do Protheus.");
        } finally {
            setIsAddSearching(false);
        }
    };

    const handleConfirmAddItem = async () => {
        if(!candidateItem) return;
        if(!addQtdForm || addQtdForm <= 0) return toast.warning('Quantidade inválida.');
        if(addQtdForm > candidateItem.qtd_faturar) return toast.warning('Excede o saldo do Pedido!');

        try {
            await insertFaturamentoSolicitacaoItem(selectedSolicitacao.id, {
                pedido: candidateItem.pedido,
                item: candidateItem.item,
                codigo_produto: candidateItem.codigo,
                quantidade_solicitada: parseFloat(addQtdForm),
                saldo_faturar_momentaneo: parseFloat(candidateItem.qtd_faturar),
                nota_fiscal: '',
                ped_cliente: candidateItem.ped_cliente,
                ref_cliente: candidateItem.ref_cliente,
                usuario: user?.nome || 'Financeiro'
            });
            toast.success("Item incluído!");
            setIsAddModalOpen(false);
            setCandidateItem(null);
            fetchSolicitacoes();
            loadAuditoria(selectedSolicitacao.id);
        } catch(err) {
            toast.error("Erro ao inserir item na solicitação.");
        }
    };

    const TranslateAcao = (acao, detalhes) => {
        switch(acao) {
            case 'CRIACAO': return `Criou a solicitação de faturamento com ${detalhes?.qtd_itens || 0} itens.`;
            case 'ALTERACAO_ITEM': return `Alterou a quantidade do item de ${detalhes?.qtd_de} para ${detalhes?.qtd_para}.`;
            case 'EXCLUSAO_ITEM': return `Removeu o produto ${detalhes?.codigo} (Ped: ${detalhes?.pedido}-${detalhes?.item}).`;
            case 'INCLUSAO_ITEM': return `Inseriu produto ${detalhes?.codigo} (Qtd: ${detalhes?.qtd}).`;
            case 'VINCULO_NF': return `Vinculou Nota Fiscal Global: ${detalhes?.nota_fiscal}.`;
            case 'VINCULO_NF_ITEM': return `Alterou a Nota Fiscal do item de ${detalhes?.nf_de || 'N/D'} para ${detalhes?.nf_para}.`;
            default: return acao;
        }
    };

    return (
        <div className="p-4 md:p-6 bg-gray-50 min-h-[calc(100vh-64px)] flex flex-col md:flex-row gap-6 animate-fadeIn">
            {/* Esquerda: Lista de Solicitações */}
            <div className="w-full md:w-1/3 bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col h-[calc(100vh-120px)]">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-indigo-600" /> Maleta do Financeiro
                    </h2>
                </div>
                
                <div className="flex bg-gray-100 rounded-lg p-1 mb-4 shrink-0">
                    <button onClick={() => setStatusFilter('Pendente')} className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'Pendente' ? 'bg-white shadow text-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>Pendente</button>
                    <button onClick={() => setStatusFilter('Atendido')} className={`flex-1 px-3 py-1.5 text-xs font-bold rounded-md ${statusFilter === 'Atendido' ? 'bg-white shadow text-green-700' : 'text-gray-500 hover:text-gray-700'}`}>Faturado</button>
                </div>

                <div className="overflow-y-auto flex-1 scrollbar-thin pr-1 space-y-2">
                    {loading ? (
                        <div className="text-center p-4 text-gray-400">Carregando...</div>
                    ) : solicitacoes.length === 0 ? (
                        <div className="text-center p-4 text-gray-400 text-sm">Nenhuma solicitação encontrada.</div>
                    ) : (
                        solicitacoes.map(sol => (
                            <div 
                                key={sol.id} 
                                onClick={() => handleSelect(sol)}
                                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedSolicitacao?.id === sol.id ? 'border-indigo-400 bg-indigo-50/30 shadow-sm' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-bold text-gray-900">{sol.numero_solicitacao}</span>
                                    {sol.status === 'Pendente' ? 
                                        <span className="bg-yellow-100 text-yellow-800 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1"><Clock className="w-3 h-3"/> Aguardando</span>
                                        : 
                                        <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Faturado</span>
                                    }
                                </div>
                                <div className="text-xs text-gray-500 mb-1">
                                    <span className="font-semibold text-gray-700">Por:</span> {sol.usuario}
                                </div>
                                <div className="text-xs text-gray-400 flex justify-between">
                                    <span>{new Date(sol.created_at).toLocaleDateString('pt-BR')}</span>
                                    <span>{sol.qtd_itens_diferentes || 0} Itens</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Direita: Workspace / View */}
            <div className="w-full md:w-2/3 flex flex-col gap-6 h-[calc(100vh-120px)] overflow-y-auto scrollbar-thin pr-1">
                {selectedSolicitacao ? (
                    <>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-gray-100 pb-4">
                                <div>
                                    <h1 className="text-2xl font-black text-gray-800">{selectedSolicitacao.numero_solicitacao}</h1>
                                    <p className="text-sm text-gray-500">Expedição solicitou o faturamento.</p>
                                </div>
                                {selectedSolicitacao.status === 'Pendente' && (
                                    <button 
                                        onClick={() => handleMarkAsFaturado(selectedSolicitacao.id)}
                                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                                    >
                                        <CheckCircle className="w-4 h-4" /> Concluir e Baixar
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nota Fiscal (Macro / Cabeçalho)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="text" 
                                            value={globalNf} 
                                            onChange={e => setGlobalNf(e.target.value)}
                                            placeholder="Ex: NF-00213"
                                            className="flex-1 w-full text-sm border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
                                            disabled={selectedSolicitacao.status !== 'Pendente'}
                                        />
                                        {selectedSolicitacao.status === 'Pendente' && (
                                            <button onClick={handleSaveGlobalNF} className="px-3 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50" title="Salvar NF Global">
                                                <Save className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                    <label className="block text-xs font-bold text-yellow-800 uppercase mb-1">Observações da Expedição</label>
                                    <p className="text-sm text-yellow-900 whitespace-pre-wrap">{selectedSolicitacao.observacao || 'Nenhuma observação.'}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-bold text-gray-800 text-lg">Itens na Confirmação</h3>
                                {selectedSolicitacao.status === 'Pendente' && (
                                    <button 
                                        onClick={() => setIsAddModalOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-md border border-indigo-200 transition-colors"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Adicionar Item Esquecido
                                    </button>
                                )}
                            </div>

                            <div className="overflow-x-auto border border-gray-200 rounded-lg rounded-t-none">
                                <table className="w-full text-sm text-left whitespace-nowrap">
                                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Ped-Item</th>
                                            <th className="px-4 py-3 font-semibold">Produto</th>
                                            <th className="px-4 py-3 font-semibold bg-indigo-50/50 text-indigo-800">Ped. Cli</th>
                                            <th className="px-4 py-3 font-semibold bg-indigo-50/50 text-indigo-800">Desenho Cli.</th>
                                            <th className="px-4 py-3 font-semibold bg-emerald-50 text-emerald-800">Prev. PCP</th>
                                            <th className="px-4 py-3 font-semibold bg-emerald-50 text-emerald-800">Lote / Série</th>
                                            <th className="px-4 py-3 font-semibold text-right">Qtd Solicitada</th>
                                            <th className="px-4 py-3 font-semibold">NF Item</th>
                                            {selectedSolicitacao.status === 'Pendente' && <th className="px-4 py-3 font-semibold text-center w-24">Ações</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {selectedSolicitacao.itens?.map(it => (
                                            <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 font-mono text-gray-900 font-medium bg-gray-50/50">{it.pedido}-{it.item}</td>
                                                <td className="px-4 py-3 text-indigo-700 font-semibold">{it.codigo_produto}</td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-gray-600 bg-indigo-50/30 whitespace-nowrap">{it.pedido_cliente || '-'}</td>
                                                <td className="px-4 py-3 font-mono text-[11px] text-indigo-900 font-bold bg-indigo-50/30 whitespace-nowrap">{it.desenho_cliente || '-'}</td>
                                                <td className="px-4 py-3 text-[11px] font-bold text-emerald-700 bg-emerald-50/30 whitespace-nowrap">
                                                    {it.pcp_data_entrega ? format(parseISO(it.pcp_data_entrega), 'dd/MM/yy') : '-'}
                                                </td>
                                                <td className="px-4 py-3 text-[10px] text-emerald-900 bg-emerald-50/30 whitespace-nowrap">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{it.pcp_lote || '-'}</span>
                                                        <span className="text-[9px] text-emerald-600">{it.pcp_numero_serie || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {editingItem === it.id ? (
                                                        <input 
                                                            type="number" 
                                                            className="w-20 text-right p-1 text-sm border-indigo-300 rounded focus:ring-indigo-500"
                                                            value={editForm.quantidade_solicitada}
                                                            onChange={e => setEditForm({...editForm, quantidade_solicitada: e.target.value})}
                                                            min="0"
                                                            max={it.saldo_faturar_momentaneo}
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-gray-800">{parseFloat(it.quantidade_solicitada).toLocaleString('pt-BR')}</span>
                                                            <span className="text-[10px] text-gray-400">Máx: {parseFloat(it.saldo_faturar_momentaneo).toLocaleString('pt-BR')}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {editingItem === it.id ? (
                                                        <input 
                                                            type="text" 
                                                            className="w-28 p-1 text-sm border-indigo-300 rounded focus:ring-indigo-500"
                                                            value={editForm.nota_fiscal}
                                                            placeholder="Global"
                                                            onChange={e => setEditForm({...editForm, nota_fiscal: e.target.value})}
                                                        />
                                                    ) : (
                                                        <>
                                                            {Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0 ? (
                                                                <div className="flex flex-col gap-0.5">
                                                                    {it.notas_fiscais_protheus.map((nf, nfIdx) => (
                                                                        <div key={nfIdx} className="flex flex-col">
                                                                            <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                                                                NF {nf.nota}
                                                                            </span>
                                                                            {nf.emissao && <span className="text-[9px] text-gray-400 pl-0.5">Em: {nf.emissao} | Qtd: {nf.qtd}</span>}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <span className={it.nota_fiscal ? 'text-gray-800 font-semibold font-mono text-sm' : 'text-gray-400 italic text-xs'}>
                                                                    {it.nota_fiscal || globalNf || 'Sem NF'}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                                {selectedSolicitacao.status === 'Pendente' && (
                                                    <td className="px-4 py-3 text-center">
                                                        {editingItem === it.id ? (
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => handleSaveItemEdit(it.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4"/></button>
                                                                <button onClick={() => setEditingItem(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"><X className="w-4 h-4"/></button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center justify-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
                                                                <button onClick={() => handleEditClick(it)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar Qt/NF"><Edit3 className="w-4 h-4"/></button>
                                                                <button onClick={() => handleDeleteItem(it)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Excluir da Solicitação"><Trash2 className="w-4 h-4"/></button>
                                                            </div>
                                                        )}
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                        {(!selectedSolicitacao.itens || selectedSolicitacao.itens.length === 0) && (
                                            <tr>
                                                <td colSpan="5" className="text-center p-6 text-gray-500 text-sm">Vazio. Todos os itens foram removidos.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Aba Auditoria */}
                        <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 p-5 overflow-hidden">
                            <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2 mb-4">
                                <History className="w-5 h-5 text-indigo-400" /> Diário de Auditoria (Rastreabilidade)
                            </h3>
                            <div className="relative border-l-2 border-slate-700 ml-3 pl-4 pb-4 space-y-6">
                                {auditoria.map(log => {
                                    let dt = null;
                                    try { dt = JSON.parse(log.detalhes) } catch(e){}
                                    return (
                                        <div key={log.id} className="relative">
                                            <div className="absolute -left-[23px] top-1 w-3 h-3 bg-indigo-500 rounded-full ring-4 ring-slate-900"></div>
                                            <div className="flex flex-col">
                                                <div className="flex items-baseline gap-2 mb-1">
                                                    <span className="text-indigo-400 font-bold text-sm">{log.usuario}</span>
                                                    <span className="text-slate-500 text-[10px]">{new Date(log.created_at).toLocaleString('pt-BR')}</span>
                                                </div>
                                                <div className="text-slate-300 text-xs">
                                                    {TranslateAcao(log.acao, dt)}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {auditoria.length === 0 && <div className="text-slate-500 text-xs italic">Nenhum evento registrado.</div>}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-white rounded-xl shadow-sm border border-gray-100 border-dashed">
                        <FileText className="w-16 h-16 mb-4 opacity-20" />
                        <p>Selecione uma solicitação no painel para iniciar o trabalho.</p>
                    </div>
                )}
            </div>

            {/* ADD ITEM MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-slideUp">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Incluir Item Existente (Saldos)</h3>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-red-500"><X className="w-5 h-5"/></button>
                        </div>
                        
                        <div className="p-4 bg-white border-b border-gray-100 flex gap-2">
                            <input 
                                type="text"
                                placeholder="Busque por Pedido, Cód. Cliente ou Produto..."
                                className="flex-1 border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                value={addSearchText}
                                onChange={e => setAddSearchText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSearchAdd()}
                            />
                            <button 
                                onClick={handleSearchAdd}
                                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-sm hover:bg-indigo-700"
                            >
                                Procurar
                            </button>
                        </div>

                        <div className="h-64 overflow-y-auto bg-gray-50/50 p-2">
                            {isAddSearching ? <div className="text-center p-6 text-gray-500 text-sm">Buscando no Protheus...</div> : null}
                            {!isAddSearching && addSearchResults.length === 0 ? <div className="text-center p-6 text-gray-400 text-sm">Use a busca acima.</div> : null}
                            {!isAddSearching && addSearchResults.map((rst, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => setCandidateItem(candidateItem === rst ? null : rst)}
                                    className={`p-3 bg-white border rounded-lg mb-2 cursor-pointer transition-colors flex justify-between items-center ${candidateItem === rst ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'}`}
                                >
                                    <div>
                                        <div className="font-mono text-sm font-bold text-gray-800">{rst.pedido}-{rst.item} <span className="ml-2 text-indigo-700">{rst.codigo}</span></div>
                                        <div className="text-xs text-gray-500 mt-1">{rst.nome_cliente || rst.ref_cliente}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-400 font-bold uppercase">Saldo a Faturar</div>
                                        <div className="font-black text-gray-900 text-lg">{parseFloat(rst.qtd_faturar).toLocaleString('pt-BR')} <span className="text-xs font-normal text-gray-500">{rst.unidade}</span></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {candidateItem && (
                            <div className="p-4 bg-indigo-50 border-t border-indigo-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-bold text-indigo-900 mb-1">Confirmar Qtd. (Máx: {parseFloat(candidateItem.qtd_faturar)})</p>
                                    <input 
                                        type="number"
                                        className="w-32 border-indigo-300 rounded text-sm focus:ring-indigo-500"
                                        value={addQtdForm}
                                        onChange={e => setAddQtdForm(e.target.value)}
                                        placeholder="Qtd Faturar"
                                    />
                                </div>
                                <button 
                                    onClick={handleConfirmAddItem}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm"
                                >
                                    Adicionar à Solicitação
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FaturamentoPainel;
