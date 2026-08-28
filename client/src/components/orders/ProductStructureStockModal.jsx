import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Boxes, Search, Layers, RefreshCw, AlertCircle, CheckCircle2, 
    ChevronRight, Package, ArrowDownRight, Filter, Info, Eye, ExternalLink,
    FileText, FileSpreadsheet, Download
} from 'lucide-react';
import { getProductStructureStock } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { exportProductStructureStockPDF, exportProductStructureStockExcel } from '../../services/productStructureStockReportGenerator';
import { toast } from 'react-toastify';

export default function ProductStructureStockModal({ 
    productCode, 
    productDesc, 
    orderNum, 
    orderItem, 
    orderQty, 
    clientName,
    onClose 
}) {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'WITH_STOCK' | 'FABRICA' | 'PROTHEUS' | 'NO_STOCK'

    const fetchStructureStock = async () => {
        if (!productCode) return;
        setLoading(true);
        try {
            const res = await getProductStructureStock(productCode);
            setData(res);
        } catch (err) {
            console.error('Erro ao buscar estoque da estrutura:', err);
            toast.error('Erro ao consultar estoque da estrutura do produto.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStructureStock();
    }, [productCode]);

    const estrutura = data?.estrutura || [];

    // Estatísticas dinâmicas
    const stats = useMemo(() => {
        if (!estrutura.length) return { total: 0, fabrica: 0, protheus: 0, semEstoque: 0 };
        return {
            total: estrutura.length,
            fabrica: estrutura.filter(i => i.saldo_fabrica > 0).length,
            protheus: estrutura.filter(i => i.saldo_protheus > 0).length,
            semEstoque: estrutura.filter(i => !i.tem_estoque).length
        };
    }, [estrutura]);

    // Filtragem dos itens
    const filteredItems = useMemo(() => {
        return estrutura.filter(item => {
            // Filtro por texto
            const matchesSearch = !searchTerm || 
                item.codigo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.descricao.toLowerCase().includes(searchTerm.toLowerCase());

            if (!matchesSearch) return false;

            // Filtro por modo
            if (filterMode === 'WITH_STOCK') return item.tem_estoque;
            if (filterMode === 'FABRICA') return item.saldo_fabrica > 0;
            if (filterMode === 'PROTHEUS') return item.saldo_protheus > 0;
            if (filterMode === 'NO_STOCK') return !item.tem_estoque;
            return true;
        });
    }, [estrutura, searchTerm, filterMode]);

    const reportMeta = {
        productCode: productCode || data?.codigo_pai,
        productDesc: productDesc || data?.descricao_pai,
        orderNum,
        orderItem,
        orderQty,
        clientName
    };

    const handleExportPDF = () => {
        try {
            if (!filteredItems.length) {
                toast.warn('Nenhum item para exportar no relatório.');
                return;
            }
            exportProductStructureStockPDF(filteredItems, reportMeta, user);
            toast.success('Relatório PDF gerado com sucesso!');
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            toast.error('Erro ao emitir relatório em PDF.');
        }
    };

    const handleExportExcel = () => {
        try {
            if (!filteredItems.length) {
                toast.warn('Nenhum item para exportar na planilha.');
                return;
            }
            exportProductStructureStockExcel(filteredItems, reportMeta, user);
            toast.success('Planilha Excel gerada com sucesso!');
        } catch (err) {
            console.error('Erro ao gerar Excel:', err);
            toast.error('Erro ao emitir relatório em Excel.');
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl xl:max-w-7xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
                
                {/* Header */}
                <div className="bg-slate-900 px-6 py-5 text-white flex justify-between items-center relative shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                    
                    <div className="relative z-10 flex items-center gap-3.5">
                        <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                            <Boxes size={26} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h3 className="text-xl font-black tracking-tight">{productCode}</h3>
                                {orderNum && (
                                    <span className="text-xs bg-indigo-950 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-800 font-mono">
                                        Pedido: {orderNum} {orderItem ? `(Item ${orderItem})` : ''}
                                    </span>
                                )}
                                {orderQty && (
                                    <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-bold">
                                        Demanda: {orderQty} un
                                    </span>
                                )}
                            </div>
                            <p className="text-slate-400 text-xs sm:text-sm mt-0.5 truncate max-w-2xl">
                                {productDesc || data?.descricao_pai || 'Estrutura de Componentes e Saldos de Estoque'}
                                {clientName && <span className="text-slate-500 ml-2 font-medium">• Cliente: {clientName}</span>}
                            </p>
                        </div>
                    </div>

                    <div className="relative z-10 flex items-center gap-2 flex-wrap">
                        {/* Botões de Relatório no Topo */}
                        <button
                            type="button"
                            onClick={handleExportPDF}
                            disabled={loading || filteredItems.length === 0}
                            title="Exportar Relatório em PDF (Padrão MetalFisa)"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <FileText size={15} />
                            <span className="hidden sm:inline">PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={loading || filteredItems.length === 0}
                            title="Exportar Relatório em Excel (Padrão MetalFisa)"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <FileSpreadsheet size={15} />
                            <span className="hidden sm:inline">Excel</span>
                        </button>

                        <div className="h-6 w-px bg-slate-700 mx-1 hidden sm:block"></div>

                        <button
                            onClick={fetchStructureStock}
                            disabled={loading}
                            title="Recarregar saldos"
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                        >
                            <RefreshCw size={18} className={loading ? 'animate-spin text-emerald-400' : ''} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* KPI Summary Cards */}
                <div className="bg-slate-100/70 px-6 py-4 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Itens BOM</span>
                            <span className="text-xl font-black text-slate-900">{stats.total}</span>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                            <Layers size={18} />
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Saldo em Fábrica</span>
                            <span className="text-xl font-black text-emerald-700">{stats.fabrica}</span>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 size={18} />
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">Saldo Protheus ERP</span>
                            <span className="text-xl font-black text-blue-700">{stats.protheus}</span>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            <Package size={18} />
                        </div>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
                        <div>
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Sem Estoque</span>
                            <span className="text-xl font-black text-slate-600">{stats.semEstoque}</span>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                            <AlertCircle size={18} />
                        </div>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shrink-0">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar código ou descrição na estrutura..."
                            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        <button
                            type="button"
                            onClick={() => setFilterMode('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                filterMode === 'ALL'
                                    ? 'bg-slate-900 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Todos ({stats.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('WITH_STOCK')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                filterMode === 'WITH_STOCK'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                            }`}
                        >
                            Com Estoque ({stats.fabrica + stats.protheus > 0 ? (stats.total - stats.semEstoque) : 0})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('FABRICA')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                filterMode === 'FABRICA'
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Fábrica ({stats.fabrica})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('PROTHEUS')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                filterMode === 'PROTHEUS'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Protheus ({stats.protheus})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('NO_STOCK')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                                filterMode === 'NO_STOCK'
                                    ? 'bg-slate-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            Sem Estoque ({stats.semEstoque})
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400">
                            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                            <p className="text-sm font-bold text-slate-700">Carregando árvore de estrutura e consultando estoques...</p>
                            <p className="text-xs text-slate-400 mt-1">Varrendo componentes no banco Protheus e levantamentos físicos.</p>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="py-16 text-center bg-white rounded-xl border border-slate-200 p-8">
                            <Info className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                            <p className="font-bold text-slate-800 text-sm">Nenhum componente encontrado para os filtros selecionados.</p>
                            <p className="text-xs text-slate-500 mt-1">Tente alternar o modo de filtro para "Todos" ou limpar a busca.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
                            <table className="w-full min-w-[960px] text-left border-collapse">
                                <thead className="sticky top-0 z-20">
                                    <tr className="bg-slate-900 text-slate-200 text-[11px] uppercase tracking-wider font-bold shadow-xs">
                                        <th className="py-3 px-4 w-16 text-center">Nível</th>
                                        <th className="py-3 px-4 min-w-[280px]">Componente / Descrição</th>
                                        <th className="py-3 px-3 text-center w-20">Tipo</th>
                                        <th className="py-3 px-3 text-right w-24">Qtd Unit.</th>
                                        {orderQty && <th className="py-3 px-3 text-right w-28">Necess. Ped.</th>}
                                        <th className="py-3 px-4 text-center w-36 bg-emerald-950/80 text-emerald-300">Saldo Fábrica</th>
                                        <th className="py-3 px-4 text-center w-36 bg-blue-950/80 text-blue-300">Saldo Protheus</th>
                                        <th className="py-3 px-4 text-center w-36 min-w-[140px]">Disponibilidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredItems.map((item, idx) => {
                                        const isParent = item.nivel === 0;
                                        const totalReq = orderQty ? (parseFloat(orderQty) * item.qtd_unitaria) : null;
                                        const hasFabricaStock = item.saldo_fabrica > 0;
                                        const hasProtheusStock = item.saldo_protheus > 0;

                                        return (
                                            <tr 
                                                key={item.id || idx}
                                                className={`transition-colors hover:bg-slate-50/80 ${
                                                    isParent ? 'bg-indigo-50/40 font-bold' : ''
                                                }`}
                                            >
                                                {/* Nível */}
                                                <td className="py-3 px-4 text-center">
                                                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-[11px] font-mono font-bold ${
                                                        isParent 
                                                            ? 'bg-indigo-600 text-white' 
                                                            : item.nivel === 1 
                                                                ? 'bg-slate-200 text-slate-800' 
                                                                : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                        {item.nivel}
                                                    </span>
                                                </td>

                                                {/* Componente / Descrição */}
                                                <td className="py-3 px-4">
                                                    <div 
                                                        className="flex items-center gap-2" 
                                                        style={{ paddingLeft: `${item.nivel * 16}px` }}
                                                    >
                                                        {item.nivel > 0 && (
                                                            <ArrowDownRight size={14} className="text-slate-400 shrink-0" />
                                                        )}
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-mono font-black text-slate-900 text-xs">
                                                                    {item.codigo}
                                                                </span>
                                                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                                                                    {item.unidade}
                                                                </span>
                                                            </div>
                                                            <p className="text-slate-600 text-xs truncate max-w-sm" title={item.descricao}>
                                                                {item.descricao}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Tipo */}
                                                <td className="py-3 px-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                        item.tipo === 'PI' ? 'bg-amber-100 text-amber-800' :
                                                        item.tipo === 'MP' ? 'bg-blue-100 text-blue-800' :
                                                        item.tipo === 'PA' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {item.tipo || 'PI'}
                                                    </span>
                                                </td>

                                                {/* Qtd Unitária */}
                                                <td className="py-3 px-3 text-right font-mono font-medium text-slate-700">
                                                    {Number(item.qtd_unitaria.toFixed(4))}
                                                </td>

                                                {/* Necessidade Pedido */}
                                                {orderQty && (
                                                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                                                        {Number(totalReq.toFixed(2))} <span className="text-[10px] text-slate-500 font-normal">{item.unidade}</span>
                                                    </td>
                                                )}

                                                {/* Saldo Fábrica */}
                                                <td className="py-3 px-4 text-center bg-emerald-50/30">
                                                    {hasFabricaStock ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                            <CheckCircle2 size={12} className="text-emerald-600" />
                                                            {item.saldo_fabrica} {item.unidade}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs font-mono">0 {item.unidade}</span>
                                                    )}
                                                </td>

                                                {/* Saldo Protheus */}
                                                <td className="py-3 px-4 text-center bg-blue-50/30">
                                                    {hasProtheusStock ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300">
                                                            <Package size={12} className="text-blue-600" />
                                                            {Number(item.saldo_protheus.toFixed(2))} {item.unidade}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs font-mono">
                                                            {item.saldo_protheus < 0 ? `${Number(item.saldo_protheus.toFixed(2))} ${item.unidade}` : `0 ${item.unidade}`}
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Disponibilidade Status */}
                                                <td className="py-3 px-4 text-center">
                                                    {hasFabricaStock ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                                                            Pronto em Fábrica
                                                        </span>
                                                    ) : hasProtheusStock ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 whitespace-nowrap">
                                                            Disponível ERP
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 whitespace-nowrap">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-100/90 px-6 py-3.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Info size={14} className="text-slate-400" />
                        <span>Consulta informativa em tempo real de saldos físicos (Fábrica) e Protheus ERP.</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={handleExportPDF}
                            disabled={loading || filteredItems.length === 0}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer disabled:opacity-40"
                        >
                            <FileText size={14} />
                            <span>Exportar PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={loading || filteredItems.length === 0}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer disabled:opacity-40"
                        >
                            <FileSpreadsheet size={14} />
                            <span>Exportar Excel</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 sm:flex-initial px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow transition-colors cursor-pointer"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
