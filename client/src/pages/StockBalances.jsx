import React, { useState, useEffect } from 'react';
import useStickyState from '../hooks/useStickyState';
import { Search, Filter, Printer, Box, FileText, Sparkles } from 'lucide-react';
import { getStockMainBalances, getFileUrl } from '../services/api';
import CadastroAnaliseTab from '../components/CadastroAnaliseTab';

export default function StockBalances() {
    const [activeTab, setActiveTab] = useStickyState('saldo', '@lynxems:stock_activeTab');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [filters, setFilters] = useStickyState({
        empresa: '',
        filial: '',
        almoxarifado: '',
        codigo: '',
        descricao: '',
        grupo: '',
        tipo: ''
    }, '@lynxems:stock_filters');

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getStockMainBalances(filters);
            setData(result);
        } catch (error) {
            console.error(error);
            alert('Erro ao buscar saldos.');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-4 md:p-6 w-full max-w-[1920px] mx-auto">
            {/* Header + Tabs - Hidden on Print */}
            <div className="print:hidden mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Box className="w-8 h-8 text-[#425750]" />
                        Saldo de Materiais
                    </h1>
                    {activeTab === 'saldo' && (
                        <button
                            onClick={handlePrint}
                            className="bg-[#425750] hover:bg-[#32423D] text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors"
                        >
                            <Printer className="w-4 h-4 text-[#E0E800]" /> Imprimir / PDF
                        </button>
                    )}
                </div>
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setActiveTab('saldo')}
                        className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 -mb-px ${
                            activeTab === 'saldo' ? 'border-[#425750] text-[#32423D] font-black' : 'border-transparent text-gray-500 hover:text-[#425750]'
                        }`}
                    >
                        <Box className="w-4 h-4" /> Saldo de Materiais
                    </button>
                    <button
                        onClick={() => setActiveTab('analise')}
                        className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 -mb-px ${
                            activeTab === 'analise' ? 'border-[#425750] text-[#32423D] font-black' : 'border-transparent text-gray-500 hover:text-[#425750]'
                        }`}
                    >
                        <Sparkles className="w-4 h-4 text-[#E0E800]" /> Análise de Cadastro (IA)
                    </button>
                </div>
            </div>

            {activeTab === 'analise' && <CadastroAnaliseTab />}

            {activeTab === 'saldo' && (
            <>
            {/* Filters - Hidden on Print */}
            <div className="print:hidden mb-6 space-y-4">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Empresa</label>
                        <select
                            className="w-full border rounded p-2 text-sm"
                            value={filters.empresa}
                            onChange={e => setFilters({ ...filters, empresa: e.target.value })}
                        >
                            <option value="">Todas</option>
                            <option value="010">010 - Matriz</option>
                            <option value="990">990 - Filial</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Filial</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.filial}
                            onChange={e => setFilters({ ...filters, filial: e.target.value })}
                            placeholder="Ex: 01"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Almoxarifado</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.almoxarifado}
                            onChange={e => setFilters({ ...filters, almoxarifado: e.target.value })}
                            placeholder="Ex: 01, AL"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Código Produto</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.codigo}
                            onChange={e => setFilters({ ...filters, codigo: e.target.value })}
                            placeholder="Pesquisar código..."
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-600 mb-1">Descrição</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.descricao}
                            onChange={e => setFilters({ ...filters, descricao: e.target.value })}
                            placeholder="Contém..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Grupo</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.grupo}
                            onChange={e => setFilters({ ...filters, grupo: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filters.tipo}
                            onChange={e => setFilters({ ...filters, tipo: e.target.value })}
                            placeholder="Ex: PA, MP, PI"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="bg-blue-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50"
                    >
                        <Search className="w-4 h-4" /> Buscar Saldos
                    </button>
                </div>
            </div>

            {/* Print Header (Visible only on print) */}
            <div className="hidden print:block mb-8">
                <h2 className="text-2xl font-bold">Relatório de Saldo de Materiais</h2>
                <p className="text-sm text-gray-500">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                <div className="mt-2 text-xs border-t pt-2">
                    Filtros: {Object.entries(filters).filter(([k, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'Nenhum'}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b print:bg-white print:border-black">
                        <tr>
                            <th className="p-3">Emp</th>
                            <th className="p-3">Fil</th>
                            <th className="p-3">Loc</th>
                            <th className="p-3">Código</th>
                            <th className="p-3">Descrição</th>
                            <th className="p-3">UM</th>
                            <th className="p-3 text-right">Saldo Atual</th>
                            <th className="p-3 text-right">Empenho</th>
                            <th className="p-3 text-right">Disponível</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan="9" className="p-8 text-center text-slate-400">Carregando...</td></tr>
                        ) : data.length === 0 ? (
                            <tr><td colSpan="9" className="p-8 text-center text-slate-400">Nenhum registro encontrado.</td></tr>
                        ) : (
                            data.map((row, idx) => (
                                <tr key={idx} className="hover:bg-slate-50 print:hover:bg-transparent break-inside-avoid">
                                    <td className="p-3 text-slate-500">{row.empresa}</td>
                                    <td className="p-3 text-slate-500">{row.filial}</td>
                                    <td className="p-3 text-slate-500">{row.almoxarifado}</td>
                                    <td className="p-3 font-medium">
                                        <div className="flex items-center gap-2">
                                            {row.tem_arquivos ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (row.primeiro_arquivo) {
                                                            window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(row.primeiro_arquivo)}`), '_blank');
                                                        }
                                                    }}
                                                    className="hover:bg-red-50 p-0.5 rounded transition-colors"
                                                    title="Abrir Desenho/PDF"
                                                >
                                                    <FileText className="w-4 h-4 text-red-500 shrink-0" />
                                                </button>
                                            ) : (
                                                <FileText className="w-4 h-4 text-gray-300 shrink-0" />
                                            )}
                                            <span>{row.cod_produto || row.cod_producto}</span>
                                        </div>
                                    </td>
                                    <td className="p-3 max-w-[300px] truncate print:whitespace-normal">{row.descricao}</td>
                                    <td className="p-3">{row.unidade}</td>
                                    <td className="p-3 text-right font-bold text-slate-700">{Number(row.saldo_atual).toFixed(2)}</td>
                                    <td className="p-3 text-right text-red-600">{Number(row.empenho || 0).toFixed(2)}</td>
                                    <td className="p-3 text-right font-bold text-blue-700">
                                        {(Number(row.saldo_atual) - Number(row.empenho || 0)).toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            </>
            )}
        </div>
    );
}
