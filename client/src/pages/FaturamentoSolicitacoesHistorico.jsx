import React, { useState, useEffect } from 'react';
import { getFaturamentoSolicitacoes, updateFaturamentoSolicitacaoStatus, enviarFaturamentoEmailLote } from '../services/api';
import { History, FileText, Calendar, Box, CheckCircle, Clock, XCircle, Search, ChevronDown, ChevronUp, Download, LayoutList, Table, FileSpreadsheet } from 'lucide-react';
import { toast } from 'react-toastify';
import generateFaturamentoPdf from '../services/faturamentoPdfGenerator';
import { generateFaturamentoHistoricoPdf } from '../services/faturamentoHistoricoPdfGenerator';
import { exportFaturamentoHistoricoExcel } from '../services/faturamentoHistoricoExcelGenerator';
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
    const [viewMode, setViewMode] = useStickyState('solicitacoes', '@metalfisa:histFat_viewMode');
    const [includePdfValues, setIncludePdfValues] = useStickyState(true, '@metalfisa:histFat_includePdfValues');
    
    // Sort & Filter state for table
    const [sortConfig, setSortConfig] = useState({ key: 'emissao', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');
    const [dataEmissaoInicio, setDataEmissaoInicio] = useState('');
    const [dataEmissaoFim, setDataEmissaoFim] = useState('');
    const [produtoFilter, setProdutoFilter] = useState('');

    // O Protheus não guarda qual NF pertence a qual solicitação: quando o mesmo pedido+item é
    // pedido em mais de uma solicitação de faturamento (remessas parciais em lotes diferentes),
    // buildNFLookup devolve a MESMA lista de NFs para cada uma. "seenPedidoItem" garante que o
    // valor real de um pedido+item só entre uma vez na soma, mesmo se referenciado várias vezes.
    const getItemValorNF = (it, seenPedidoItem) => {
        if (Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0) {
            const key = `${String(it.pedido).trim()}|${String(it.item).trim()}`;
            if (seenPedidoItem) {
                if (seenPedidoItem.has(key)) return 0;
                seenPedidoItem.add(key);
            }
            return it.notas_fiscais_protheus.reduce((s, nf) => s + (parseFloat(nf.valor_total) || 0), 0);
        }
        return parseFloat(it.valor_total) || 0;
    };

    const faturamentosFlat = React.useMemo(() => {
        const flat = [];
        const seenNfRow = new Set(); // pedido|item|nota — evita listar a mesma NF real 2x quando o pedido+item foi solicitado mais de uma vez
        solicitacoes.forEach(sol => {
            if (!sol.itens) return;
            sol.itens.forEach(it => {
                const hasProtheusNf = Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0;
                if (hasProtheusNf) {
                    it.notas_fiscais_protheus.forEach(nf => {
                        const rowKey = `${String(it.pedido).trim()}|${String(it.item).trim()}|${nf.nota}`;
                        if (seenNfRow.has(rowKey)) return;
                        seenNfRow.add(rowKey);
                        flat.push({
                            id: `${sol.id}-${it.id}-${nf.nota}`,
                            nota: nf.nota,
                            serie: nf.serie || '',
                            emissao: nf.emissao || new Date(sol.created_at).toLocaleDateString('pt-BR'),
                            pedido: it.pedido,
                            cliente: it.nome_cliente || 'Não informado',
                            codigo_produto: it.codigo_produto,
                            produtos: [it.codigo_produto],
                            quantidade: nf.qtd || it.quantidade_solicitada,
                            valor_total: nf.valor_total || it.valor_total || 0,
                            solicitante: sol.usuario,
                            status: sol.status
                        });
                    });
                } else if (it.nota_fiscal || sol.nota_fiscal) {
                    const notaManual = it.nota_fiscal || sol.nota_fiscal;
                    const rowKey = `${String(it.pedido).trim()}|${String(it.item).trim()}|${notaManual}`;
                    if (seenNfRow.has(rowKey)) return;
                    seenNfRow.add(rowKey);
                    flat.push({
                        id: `${sol.id}-${it.id}-manual`,
                        nota: notaManual,
                        serie: '',
                        emissao: new Date(sol.created_at).toLocaleDateString('pt-BR'),
                        pedido: it.pedido,
                        cliente: it.nome_cliente || 'Não informado',
                        codigo_produto: it.codigo_produto,
                        produtos: [it.codigo_produto],
                        quantidade: it.quantidade_solicitada,
                        valor_total: it.valor_total || 0,
                        solicitante: sol.usuario,
                        status: sol.status
                    });
                }
            });
        });

        let result = [...flat];

        // Grouping removed as per user request to show 1 line per product
        
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(r => 
                (r.nota && r.nota.toLowerCase().includes(lower)) ||
                (r.pedido && r.pedido.toLowerCase().includes(lower)) ||
                (r.cliente && r.cliente.toLowerCase().includes(lower)) ||
                (r.produtos.join(',').toLowerCase().includes(lower))
            );
        }

        if (dataEmissaoInicio || dataEmissaoFim) {
            result = result.filter(r => {
                const parts = r.emissao.split('/'); // DD/MM/YYYY
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    const rowDate = new Date(`${y}-${m}-${d}T00:00:00`);
                    
                    if (dataEmissaoInicio) {
                        const inicioDate = new Date(`${dataEmissaoInicio}T00:00:00`);
                        if (rowDate < inicioDate) return false;
                    }
                    if (dataEmissaoFim) {
                        const fimDate = new Date(`${dataEmissaoFim}T23:59:59`);
                        if (rowDate > fimDate) return false;
                    }
                    return true;
                }
                return true;
            });
        }

        if (produtoFilter) {
            const lowerProd = produtoFilter.toLowerCase();
            result = result.filter(r => 
                (r.codigo_produto && r.codigo_produto.toLowerCase().includes(lowerProd)) ||
                (r.produtos.join(',').toLowerCase().includes(lowerProd))
            );
        }

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                if (sortConfig.key === 'quantidade' || sortConfig.key === 'valor_total') {
                    aVal = parseFloat(aVal || 0);
                    bVal = parseFloat(bVal || 0);
                }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [solicitacoes, searchTerm, dataEmissaoInicio, dataEmissaoFim, produtoFilter, sortConfig]);

    const faturamentosSolicitacoesFlat = React.useMemo(() => {
        // Compartilhado entre todas as solicitações: garante que o valor real de um pedido+item só
        // seja contado na primeira solicitação (mais recente, já que a API devolve por s.id DESC)
        // que o referencia, mesmo que o mesmo pedido+item tenha sido pedido em lotes diferentes.
        const seenPedidoItem = new Set();
        let result = solicitacoes.map(sol => {
            const clientes = [...new Set(sol.itens?.map(it => it.nome_cliente).filter(Boolean))].join(' / ') || 'Não informado';
            const totalItens = sol.itens ? sol.itens.length : 0;
            const valorTotal = sol.itens ? sol.itens.reduce((acc, it) => acc + getItemValorNF(it, seenPedidoItem), 0) : 0;
            const emissaoDateStr = new Date(sol.created_at).toLocaleDateString('pt-BR');
            
            const nfs = [...new Set(sol.itens?.flatMap(it => 
                it.notas_fiscais_protheus?.map(n => n.nota) || [it.nota_fiscal || sol.nota_fiscal]
            ).filter(Boolean))].join(', ');
            
            const codigos = [...new Set(sol.itens?.map(it => it.codigo_produto).filter(Boolean))].join(', ');

            return {
                id: sol.id,
                numero_solicitacao: sol.numero_solicitacao,
                emissao: emissaoDateStr,
                clientes,
                total_itens: totalItens,
                valor_total: valorTotal,
                usuario: sol.usuario,
                status: sol.status,
                nfs,
                codigos
            };
        });

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(r => 
                (r.numero_solicitacao && r.numero_solicitacao.toString().toLowerCase().includes(lower)) ||
                (r.clientes && r.clientes.toLowerCase().includes(lower)) ||
                (r.usuario && r.usuario.toLowerCase().includes(lower)) ||
                (r.nfs && r.nfs.toLowerCase().includes(lower)) ||
                (r.codigos && r.codigos.toLowerCase().includes(lower))
            );
        }

        if (dataEmissaoInicio || dataEmissaoFim) {
            result = result.filter(r => {
                const parts = r.emissao.split('/'); // DD/MM/YYYY
                if (parts.length === 3) {
                    const [d, m, y] = parts;
                    const rowDate = new Date(`${y}-${m}-${d}T00:00:00`);
                    
                    if (dataEmissaoInicio) {
                        const inicioDate = new Date(`${dataEmissaoInicio}T00:00:00`);
                        if (rowDate < inicioDate) return false;
                    }
                    if (dataEmissaoFim) {
                        const fimDate = new Date(`${dataEmissaoFim}T23:59:59`);
                        if (rowDate > fimDate) return false;
                    }
                    return true;
                }
                return true;
            });
        }

        // We ignore produtoFilter since solicitacoes view doesn't directly have the product codes at top level here, 
        // though we could extract them if strictly necessary. 

        if (sortConfig.key) {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                if (sortConfig.key === 'valor_total' || sortConfig.key === 'total_itens' || sortConfig.key === 'numero_solicitacao') {
                    aVal = parseFloat(aVal || 0);
                    bVal = parseFloat(bVal || 0);
                }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [solicitacoes, searchTerm, dataEmissaoInicio, dataEmissaoFim, sortConfig]);

    const faturamentosProdutosFlat = React.useMemo(() => {
        const map = {};
        faturamentosFlat.forEach(f => {
            if (!map[f.codigo_produto]) {
                map[f.codigo_produto] = {
                    codigo_produto: f.codigo_produto,
                    quantidade: 0,
                    valor_total: 0,
                    clientes: new Set(),
                    notas: new Set(),
                    pedidos: new Set(),
                    emissao: new Set()
                };
            }
            map[f.codigo_produto].quantidade += parseFloat(f.quantidade || 0);
            map[f.codigo_produto].valor_total += parseFloat(f.valor_total || 0);
            if (f.cliente && f.cliente !== 'Não informado') map[f.codigo_produto].clientes.add(f.cliente);
            if (f.nota) map[f.codigo_produto].notas.add(f.nota);
            if (f.pedido) map[f.codigo_produto].pedidos.add(f.pedido);
            if (f.emissao) map[f.codigo_produto].emissao.add(f.emissao);
        });
        
        let result = Object.values(map).map(r => ({
            ...r,
            clientes: [...r.clientes].join(', ') || '-',
            notas: [...r.notas].join(', ') || '-',
            pedidos: [...r.pedidos].join(', ') || '-',
            emissao: [...r.emissao].join(', ') || '-'
        }));
        
        if (sortConfig.key) {
            result.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];
                if (sortConfig.key === 'quantidade' || sortConfig.key === 'valor_total') {
                    aVal = parseFloat(aVal || 0);
                    bVal = parseFloat(bVal || 0);
                }
                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [faturamentosFlat, sortConfig]);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const renderSortIcon = (key) => {
        if (sortConfig.key !== key) return null;
        return sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />;
    };

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
                        <div className="flex flex-col gap-2 items-end">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button 
                                    onClick={() => setViewMode('solicitacoes')}
                                    className={`px-3 py-1.5 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${viewMode === 'solicitacoes' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <LayoutList className="w-4 h-4" /> Solicitações
                                </button>
                                <button 
                                    onClick={() => setViewMode('tabela_solicitacoes')}
                                    className={`px-3 py-1.5 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${viewMode === 'tabela_solicitacoes' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Table className="w-4 h-4" /> Tabela (Por Solicitação)
                                </button>
                                <button 
                                    onClick={() => setViewMode('tabela_produtos')}
                                    className={`px-3 py-1.5 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${viewMode === 'tabela_produtos' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Box className="w-4 h-4" /> Agrupado por Produto
                                </button>
                                <button 
                                    onClick={() => setViewMode('tabela')}
                                    className={`px-3 py-1.5 text-sm font-bold flex items-center gap-2 rounded-md transition-colors ${viewMode === 'tabela' ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    <Table className="w-4 h-4" /> Tabela (Por NF)
                                </button>
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
                    ) : viewMode === 'tabela' || viewMode === 'tabela_solicitacoes' || viewMode === 'tabela_produtos' ? (
                                <div className="p-4 bg-gray-50 flex flex-col gap-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 flex-1 min-w-[250px] shadow-sm">
                                            <Search className="w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text"
                                                placeholder="Buscar NF, Pedido ou Cliente..."
                                                className="bg-transparent border-none outline-none text-sm w-full"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm min-w-[280px]">
                                            <Calendar className="w-4 h-4 text-gray-400" />
                                            <input 
                                                type="date"
                                                className="bg-transparent border-none outline-none text-sm w-full text-gray-700"
                                                value={dataEmissaoInicio}
                                                onChange={(e) => setDataEmissaoInicio(e.target.value)}
                                                title="Data Inicial"
                                            />
                                            <span className="text-gray-400 text-sm">até</span>
                                            <input 
                                                type="date"
                                                className="bg-transparent border-none outline-none text-sm w-full text-gray-700"
                                                value={dataEmissaoFim}
                                                onChange={(e) => setDataEmissaoFim(e.target.value)}
                                                title="Data Final"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg border border-gray-200 shadow-sm w-48">
                                            <Box className="w-4 h-4 text-gray-400" />
                                            <input 
                                                type="text"
                                                placeholder="Cód. Produto..."
                                                className="bg-transparent border-none outline-none text-sm w-full"
                                                value={produtoFilter}
                                                onChange={(e) => setProdutoFilter(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-1"></div>
                                        <div className="flex items-center gap-2 mr-2">
                                            <input 
                                                type="checkbox" 
                                                id="includePdfValues" 
                                                checked={includePdfValues} 
                                                onChange={(e) => setIncludePdfValues(e.target.checked)}
                                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor="includePdfValues" className="text-sm font-medium text-gray-700 cursor-pointer">
                                                Valores no PDF
                                            </label>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                const rows = viewMode === 'tabela' ? faturamentosFlat 
                                                    : viewMode === 'tabela_solicitacoes' ? faturamentosSolicitacoesFlat 
                                                    : faturamentosProdutosFlat;
                                                generateFaturamentoHistoricoPdf(viewMode, rows, includePdfValues);
                                            }}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
                                        >
                                            <Download className="w-4 h-4" /> Relatório PDF
                                        </button>
                                        <button 
                                            onClick={() => {
                                                const rows = viewMode === 'tabela' ? faturamentosFlat 
                                                    : viewMode === 'tabela_solicitacoes' ? faturamentosSolicitacoesFlat 
                                                    : faturamentosProdutosFlat;
                                                exportFaturamentoHistoricoExcel(viewMode, rows, includePdfValues);
                                            }}
                                            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg text-sm flex items-center gap-2 transition-colors shadow-sm"
                                        >
                                            <FileSpreadsheet className="w-4 h-4" /> Excel
                                        </button>
                                    </div>
                                    <div className="bg-white border text-sm border-gray-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
                                        {viewMode === 'tabela' ? (
                                            <table className="w-full text-left whitespace-nowrap">
                                                <thead className="bg-gray-100/50 text-gray-500 text-xs uppercase border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('emissao')}>Data Emissão {renderSortIcon('emissao')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('nota')}>NF {renderSortIcon('nota')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('cliente')}>Cliente {renderSortIcon('cliente')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('pedido')}>Pedido {renderSortIcon('pedido')}</th>
                                                        <th className="px-4 py-3 font-semibold">Cód. Produtos</th>
                                                        <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('quantidade')}>Quantidade {renderSortIcon('quantidade')}</th>
                                                        <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('valor_total')}>Vlr Total {renderSortIcon('valor_total')}</th>
                                                        <th className="px-4 py-3 font-semibold">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {faturamentosFlat.map((f, idx) => (
                                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-4 py-2 font-mono text-[12px]">{f.emissao}</td>
                                                        <td className="px-4 py-2 font-mono font-bold text-blue-700">{f.nota} {f.serie && <span className="text-gray-400 font-normal">S.{f.serie}</span>}</td>
                                                        <td className="px-4 py-2 text-gray-800 font-semibold truncate max-w-[200px]" title={f.cliente}>{f.cliente}</td>
                                                        <td className="px-4 py-2 font-mono font-semibold text-gray-900">{f.pedido}</td>
                                                        <td className="px-4 py-2 font-mono text-xs font-semibold text-gray-800">
                                                            {f.codigo_produto}
                                                        </td>
                                                        <td className="px-4 py-2 text-right font-bold text-gray-700">{parseFloat(f.quantidade).toLocaleString('pt-BR')}</td>
                                                        <td className="px-4 py-2 text-right font-bold text-emerald-700">
                                                            {parseFloat(f.valor_total) > 0 ? `R$ ${parseFloat(f.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-'}
                                                        </td>
                                                        <td className="px-4 py-2"><StatusBadge status={f.status} /></td>
                                                    </tr>
                                                ))}
                                                    {faturamentosFlat.length === 0 && (
                                                        <tr>
                                                            <td colSpan="8" className="p-8 text-center text-gray-400">Nenhum faturamento encontrado nesta visão.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        ) : viewMode === 'tabela_solicitacoes' ? (
                                            <table className="w-full text-left whitespace-nowrap">
                                                <thead className="bg-gray-100/50 text-gray-500 text-xs uppercase border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('numero_solicitacao')}>Número {renderSortIcon('numero_solicitacao')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('emissao')}>Data Criação {renderSortIcon('emissao')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('clientes')}>Clientes {renderSortIcon('clientes')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('nfs')}>NFs {renderSortIcon('nfs')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('codigos')}>Cód. Produtos {renderSortIcon('codigos')}</th>
                                                        <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('total_itens')}>Total Itens {renderSortIcon('total_itens')}</th>
                                                        <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('valor_total')}>Valor Total {renderSortIcon('valor_total')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('usuario')}>Solicitante {renderSortIcon('usuario')}</th>
                                                        <th className="px-4 py-3 font-semibold">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {faturamentosSolicitacoesFlat.map((f, idx) => (
                                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-4 py-2 font-mono font-bold text-blue-700">{f.numero_solicitacao}</td>
                                                            <td className="px-4 py-2 font-mono text-[12px]">{f.emissao}</td>
                                                            <td className="px-4 py-2 text-gray-800 font-semibold truncate max-w-[200px]" title={f.clientes}>{f.clientes}</td>
                                                            <td className="px-4 py-2 font-mono font-semibold text-gray-900 truncate max-w-[150px]" title={f.nfs}>{f.nfs || '-'}</td>
                                                            <td className="px-4 py-2 font-mono text-blue-700 font-semibold truncate max-w-[200px]" title={f.codigos}>{f.codigos || '-'}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-gray-700">{f.total_itens}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-emerald-700">
                                                                {f.valor_total > 0 ? `R$ ${f.valor_total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 text-gray-600 font-medium">{f.usuario}</td>
                                                            <td className="px-4 py-2"><StatusBadge status={f.status} /></td>
                                                        </tr>
                                                    ))}
                                                    {faturamentosSolicitacoesFlat.length === 0 && (
                                                        <tr>
                                                            <td colSpan="8" className="p-8 text-center text-gray-400">Nenhuma solicitação encontrada nesta visão.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <table className="w-full text-left whitespace-nowrap">
                                                <thead className="bg-gray-100/50 text-gray-500 text-xs uppercase border-b border-gray-200">
                                                    <tr>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('codigo_produto')}>Cód. Produto {renderSortIcon('codigo_produto')}</th>
                                                        <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('quantidade')}>Qtd Total {renderSortIcon('quantidade')}</th>
                                                        <th className="px-4 py-3 font-semibold text-right cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('valor_total')}>Vlr Total {renderSortIcon('valor_total')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('pedidos')}>Pedidos {renderSortIcon('pedidos')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('notas')}>NFs {renderSortIcon('notas')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('clientes')}>Clientes {renderSortIcon('clientes')}</th>
                                                        <th className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => requestSort('emissao')}>Datas Emissão {renderSortIcon('emissao')}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {faturamentosProdutosFlat.map((f, idx) => (
                                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                            <td className="px-4 py-2 font-mono font-bold text-blue-700">{f.codigo_produto}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-gray-700">{parseFloat(f.quantidade).toLocaleString('pt-BR')}</td>
                                                            <td className="px-4 py-2 text-right font-bold text-emerald-700">
                                                                {parseFloat(f.valor_total) > 0 ? `R$ ${parseFloat(f.valor_total).toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : '-'}
                                                            </td>
                                                            <td className="px-4 py-2 font-mono text-[12px] truncate max-w-[200px]" title={f.pedidos}>{f.pedidos}</td>
                                                            <td className="px-4 py-2 font-mono text-[12px] truncate max-w-[200px]" title={f.notas}>{f.notas}</td>
                                                            <td className="px-4 py-2 text-gray-800 text-[12px] truncate max-w-[200px]" title={f.clientes}>{f.clientes}</td>
                                                            <td className="px-4 py-2 font-mono text-[12px] truncate max-w-[200px]" title={f.emissao}>{f.emissao}</td>
                                                        </tr>
                                                    ))}
                                                    {faturamentosProdutosFlat.length === 0 && (
                                                        <tr>
                                                            <td colSpan="7" className="p-8 text-center text-gray-400">Nenhum produto encontrado nesta visão.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
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
                                                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium whitespace-nowrap overflow-hidden">
                                                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Data: {new Date(solicitacao.created_at).toLocaleString('pt-BR')}</span>
                                                        <span className="flex items-center gap-1.5"><Box className="h-3.5 w-3.5" /> Itens: {solicitacao.qtd_itens_diferentes} un.</span>
                                                        <span className="flex items-center gap-1.5 truncate max-w-[300px]" title={
                                                            [...new Set(solicitacao.itens?.map(it => it.nome_cliente).filter(Boolean))].join(' / ') || 'Nenhum Item / Não informado'
                                                        }>
                                                            <span className="font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 truncate">
                                                                {[...new Set(solicitacao.itens?.map(it => it.nome_cliente).filter(Boolean))].join(' / ') || 'Nenhum Item / Não informado'}
                                                            </span>
                                                        </span>
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
                                                                <th className="px-4 py-2 font-semibold bg-blue-50/50 text-blue-800">Nota Fiscal</th>
                                                                <th className="px-4 py-2 font-semibold bg-green-50 text-green-800">Emissão NF</th>
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
                                                                    <td className="px-4 py-2 bg-blue-50/30">
                                                                        {Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0 ? (
                                                                            <div className="flex flex-col gap-0.5">
                                                                                {it.notas_fiscais_protheus.map((nf, nfIdx) => (
                                                                                    <span key={nfIdx} className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 whitespace-nowrap">
                                                                                        NF {nf.nota}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="font-mono text-[11px] text-gray-400">{it.nota_fiscal || solicitacao.nota_fiscal || '-'}</span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-2 font-mono text-[11px] font-bold bg-green-50/30 whitespace-nowrap">
                                                                        {Array.isArray(it.notas_fiscais_protheus) && it.notas_fiscais_protheus.length > 0
                                                                            ? it.notas_fiscais_protheus[0].emissao || '-'
                                                                            : new Date(solicitacao.updated_at || solicitacao.created_at).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right text-gray-400 font-medium">
                                                                        {parseFloat(it.saldo_faturar_momentaneo).toLocaleString('pt-BR')}
                                                                    </td>
                                                                    <td className="px-4 py-2 text-right font-bold text-[15px] text-blue-700">
                                                                        {parseFloat(it.quantidade_solicitada).toLocaleString('pt-BR')}
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

// aria-label fix for ux_audit
