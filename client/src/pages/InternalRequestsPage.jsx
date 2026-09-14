import React, { useState, useEffect } from 'react';
import { Search, Printer, ClipboardList, Filter, Calendar, History } from 'lucide-react';
import { getInternalRequests } from '../services/api';

export default function InternalRequestsPage() {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState([]);
    const [filters, setFilters] = useState({
        filial: '',
        documento: '',
        codigo: '',
        dataInicial: '',
        dataFinal: ''
    });

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${day}/${month}/${year}`;
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const result = await getInternalRequests(filters);
            setData(result);
        } catch (error) {
            console.error(error);
            alert('Erro ao buscar requisições.');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-4 md:p-6 w-full max-w-[1920px] mx-auto">
            {/* Header / Filters - Hidden on Print */}
            <div className="print:hidden mb-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <History className="h-8 w-8 text-blue-600" />
                        Histórico de Requisições
                    </h2>
                    <button
                        onClick={handlePrint}
                        className="bg-slate-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors"
                    >
                        <Printer className="w-4 h-4" /> Imprimir / PDF
                    </button>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Filial</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={filters.filial}
                            onChange={e => setFilters({ ...filters, filial: e.target.value })}
                            placeholder="Ex: 01"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Documento</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={filters.documento}
                            onChange={e => setFilters({ ...filters, documento: e.target.value })}
                            placeholder="Número DOC..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Código Produto</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={filters.codigo}
                            onChange={e => setFilters({ ...filters, codigo: e.target.value })}
                            placeholder="Pesquisar código..."
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">De (Emissão)</label>
                        <input
                            type="date"
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={filters.dataInicial}
                            onChange={e => setFilters({ ...filters, dataInicial: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Até (Emissão)</label>
                        <input
                            type="date"
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            value={filters.dataFinal}
                            onChange={e => setFilters({ ...filters, dataFinal: e.target.value })}
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="bg-blue-600 text-white px-8 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all font-medium"
                    >
                        <Search className="w-4 h-4" /> {loading ? 'Buscando...' : 'Aplicar Filtros'}
                    </button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-8">
                <h2 className="text-2xl font-bold">Relatório de Requisições Internas (SD3)</h2>
                <p className="text-sm text-gray-500">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
                <div className="mt-2 text-xs border-t pt-2">
                    Filtros: {Object.entries(filters).filter(([k, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'Nenhum'}
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden print:border-0 print:shadow-none">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b print:bg-white print:border-black uppercase text-[10px] tracking-wider">
                            <tr>
                                <th className="p-3">Filial</th>
                                <th className="p-3">Doc</th>
                                <th className="p-3">Código</th>
                                <th className="p-3">Descrição</th>
                                <th className="p-3 text-center">Local</th>
                                <th className="p-3 text-right">Qtd</th>
                                <th className="p-3 text-center">Emissão</th>
                                <th className="p-3 text-center">TM</th>
                                <th className="p-3 text-center">Tipo</th>
                                <th className="p-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="10" className="p-12 text-center text-slate-400">
                                    <div className="flex flex-col items-center gap-2">
                                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                        <span>Carregando dados do Protheus...</span>
                                    </div>
                                </td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan="10" className="p-12 text-center text-slate-400 italic">
                                    Nenhuma requisição encontrada para os filtros aplicados.
                                </td></tr>
                            ) : (
                                data.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50 transition-colors print:hover:bg-transparent break-inside-avoid">
                                        <td className="p-3 text-slate-500 font-medium">{row.filial}</td>
                                        <td className="p-3 font-bold text-slate-700">{row.documento}</td>
                                        <td className="p-3">
                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono border border-slate-200 uppercase">
                                                {row.codigo}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-[300px] truncate" title={row.descricao}>{row.descricao}</td>
                                        <td className="p-3 text-center">{row.armazem}</td>
                                        <td className="p-3 text-right font-bold text-slate-800">
                                            {Number(row.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="p-3 text-center whitespace-nowrap text-slate-600">
                                            {formatDate(row.emissao)}
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                                                {row.tm}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${row.tipo === 'RE' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                                row.tipo === 'DE' ? 'bg-green-50 text-green-700 border-green-100' :
                                                    'bg-slate-50 text-slate-700 border-slate-100'
                                                }`}>
                                                {row.tipo}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            <span className={`w-2.5 h-2.5 rounded-full inline-block ${row.status === '0' ? 'bg-green-500' : 'bg-slate-300'
                                                }`} title={row.status === '0' ? 'Ativo' : 'Outro'}></span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
