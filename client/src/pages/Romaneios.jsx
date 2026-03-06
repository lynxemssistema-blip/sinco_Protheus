import React, { useState, useEffect } from 'react';
import { Plus, Truck, Search, Eye, Trash2, Filter, Edit, Printer } from 'lucide-react';
import { getRomaneios, deleteRomaneio, updateRomaneioStatus } from '../services/api';
import RomaneioForm from '../components/RomaneioForm';
import useStickyState from '../hooks/useStickyState';

export default function Romaneios() {
    const [view, setView] = useStickyState('list', '@metalfisa:roma_view'); // list | form
    const [romaneios, setRomaneios] = useState([]);
    const [selectedId, setSelectedId] = useStickyState(null, '@metalfisa:roma_selectedId');
    const [initialStep, setInitialStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useStickyState({
        search: '',
        status: '',
        startDate: '',
        endDate: ''
    }, '@metalfisa:roma_filters');

    useEffect(() => {
        if (view === 'list') fetchRomaneios();
    }, [view, filters]); // Reload when filters change (debouncing might be needed for text, but simple for now)

    const fetchRomaneios = async () => {
        setLoading(true);
        try {
            const data = await getRomaneios(filters);
            setRomaneios(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedId(null);
        setInitialStep(1);
        setView('form');
    };

    const handleEdit = (id) => {
        setSelectedId(id);
        setInitialStep(1);
        setView('form');
    };

    const handleView = (id) => {
        setSelectedId(id);
        setInitialStep(2);
        setView('form');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este romaneio?')) return;
        try {
            await deleteRomaneio(id);
            fetchRomaneios();
        } catch (err) {
            alert('Erro ao excluir: ' + err.message);
        }
    };

    const handleSuccess = () => {
        setView('list');
        fetchRomaneios();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Truck className="w-8 h-8 text-blue-600" />
                        Romaneios de Saída
                    </h2>
                    <p className="text-slate-500">Gestão de envios de material (Entrega, Manutenção, etc).</p>
                </div>
                {view === 'list' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setView('product_search')}
                            className="text-slate-600 bg-white border border-slate-300 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 shadow-sm"
                        >
                            <Search className="w-4 h-4" />
                            Localizar Produto
                        </button>
                        <button
                            onClick={handleCreate}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 shadow-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Romaneio
                        </button>
                    </div>
                )}
                {(view === 'form' || view === 'product_search') && (
                    <button
                        onClick={() => setView('list')}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                    >
                        Voltar para Lista
                    </button>
                )}
            </div>

            {/* Product Search View */}
            {view === 'product_search' && <ProductSearch />}

            {/* Filters Bar */}
            {view === 'list' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Buscar (Fornecedor/ID)</label>
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <input
                                className="w-full pl-10 p-2 border rounded-lg text-sm"
                                placeholder="Nome do fornecedor ou ID..."
                                value={filters.search}
                                onChange={e => setFilters({ ...filters, search: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="w-40">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Status</label>
                        <select
                            className="w-full p-2 border rounded-lg text-sm"
                            value={filters.status}
                            onChange={e => setFilters({ ...filters, status: e.target.value })}
                        >
                            <option value="">Todos</option>
                            <option value="Rascunho">Rascunho</option>
                            <option value="Finalizado">Finalizado</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Data Liberação (De)</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded-lg text-sm"
                            value={filters.startDate}
                            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-xs font-bold text-slate-500 mb-1">Data Liberação (Até)</label>
                        <input
                            type="date"
                            className="w-full p-2 border rounded-lg text-sm"
                            value={filters.endDate}
                            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                        />
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setFilters({ search: '', status: '', startDate: '', endDate: '' })}
                            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            title="Limpar Filtros"
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {view === 'list' ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-medium uppercase text-xs">
                            <tr>
                                <th className="p-4">ID</th>
                                <th className="p-4">Rev</th>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Tipo</th>
                                <th className="p-4">Liberação</th>
                                <th className="p-4">Prev. Retorno</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Carregando...</td></tr>
                            ) : !Array.isArray(romaneios) || romaneios.length === 0 ? (
                                <tr><td colSpan="7" className="p-8 text-center text-slate-400">Nenhum romaneio encontrado.</td></tr>
                            ) : (
                                romaneios.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="p-4 font-mono text-slate-600">#{r.id}</td>
                                        <td className="p-4 font-mono text-slate-500 text-xs">v{r.current_revision || 1}</td>
                                        <td className="p-4 font-medium text-slate-900">
                                            {r.cliente_nome}
                                            <div className="text-xs text-slate-400 font-normal">Loja {r.cliente_loja}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs">{r.tipo_descricao}</span>
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium text-sm">
                                            {r.data_liberacao ? new Date(r.data_liberacao).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4 text-slate-600 font-medium text-sm">
                                            {r.data_previsao_retorno ? new Date(r.data_previsao_retorno).toLocaleDateString() : '-'}
                                        </td>
                                        <td className="p-4">
                                            <select
                                                className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer outline-none focus:ring-2 focus:ring-blue-200
                                                    ${r.status === 'Rascunho' ? 'bg-yellow-50 text-yellow-700' : ''}
                                                    ${r.status === 'Finalizado' ? 'bg-green-50 text-green-700' : ''}
                                                    ${r.status === 'Cancelado' ? 'bg-red-50 text-red-700' : ''}
                                                `}
                                                value={r.status}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value;
                                                    if (!window.confirm(`Mudar status para ${newStatus}?`)) return;
                                                    try {
                                                        await updateRomaneioStatus(r.id, newStatus);
                                                        fetchRomaneios();
                                                    } catch (err) {
                                                        alert('Erro: ' + err.message);
                                                    }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <option value="Rascunho">Rascunho</option>
                                                <option value="Finalizado">Finalizado</option>
                                                <option value="Cancelado">Cancelado</option>
                                            </select>
                                        </td>
                                        <td className="p-4 text-right flex justify-end gap-2">
                                            <button
                                                onClick={() => handleView(r.id)}
                                                className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                title="Ver Detalhes"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleEdit(r.id)}
                                                className="text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
                                                title="Editar Cabeçalho"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(r.id)}
                                                className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            ) : view === 'form' ? (
                <RomaneioForm
                    romaneioId={selectedId}
                    initialStep={initialStep}
                    onSuccess={handleSuccess}
                />
            ) : null}
        </div>
    );
}

// Inline Component to keep file count low, or could be separate.
// Keeping it simple here:
import { searchRomaneioItems } from '../services/api';

function ProductSearch() {
    const [q, setQ] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const printRef = React.useRef();

    const handleSearch = async (e) => {
        e.preventDefault();
        if (q.length < 3) return alert('Digite pelo menos 3 caracteres');
        setLoading(true);
        try {
            const data = await searchRomaneioItems(q);
            setResults(data);
        } catch (err) { alert('Erro: ' + err.message); } finally { setLoading(false); }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-lg font-bold mb-4">Localizar Produto em Romaneios</h2>
            <form onSubmit={handleSearch} className="flex gap-4 mb-6">
                <input
                    className="flex-1 p-2 border rounded-lg"
                    placeholder="Código ou Descrição..."
                    value={q}
                    onChange={e => setQ(e.target.value)}
                />
                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold">
                    {loading ? 'Buscando...' : 'Buscar'}
                </button>
                {results.length > 0 && (
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 print:hidden"
                    >
                        <Printer className="w-4 h-4" />
                        Gerar Relatório PDF
                    </button>
                )}
            </form>

            {results.length > 0 ? (
                <>
                    {/* Print Header - Only visible when printing */}
                    <div className="hidden print:block mb-6">
                        <h1 className="text-2xl font-bold text-center mb-2">Relatório de Localização de Produtos em Romaneios</h1>
                        <p className="text-center text-sm text-slate-600">
                            Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}
                        </p>
                        <p className="text-center text-sm text-slate-600 mb-4">
                            Busca: "{q}" | Total de resultados: {results.length}
                        </p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 uppercase text-xs text-slate-500">
                                <tr>
                                    <th className="p-3">Romaneio</th>
                                    <th className="p-3">Data Envio</th>
                                    <th className="p-3">Prev. Retorno</th>
                                    <th className="p-3">Fornecedor</th>
                                    <th className="p-3">Pedido/OP</th>
                                    <th className="p-3">Código</th>
                                    <th className="p-3">Descrição</th>
                                    <th className="p-3 text-right">Qtd</th>
                                    <th className="p-3 print:hidden">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {results.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold">#{r.romaneio_id}</td>
                                        <td className="p-3">{new Date(r.data_liberacao).toLocaleDateString('pt-BR')}</td>
                                        <td className="p-3">{r.data_previsao_retorno ? new Date(r.data_previsao_retorno).toLocaleDateString('pt-BR') : '-'}</td>
                                        <td className="p-3">{r.cliente_nome}</td>
                                        <td className="p-3 font-mono text-xs">
                                            {r.pedido ? `${r.pedido}${r.item_pedido ? `/${r.item_pedido}` : ''}` : '-'}
                                        </td>
                                        <td className="p-3 font-mono">{r.codigo_produto}</td>
                                        <td className="p-3">{r.descricao_produto}</td>
                                        <td className="p-3 text-right font-bold">{r.quantidade}</td>
                                        <td className="p-3 print:hidden"><span className="bg-slate-100 px-2 py-1 rounded text-xs">{r.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Print Footer */}
                    <div className="hidden print:block mt-6 text-center text-xs text-slate-500">
                        <p>MetalFisa - Sistema de Gestão de Romaneios</p>
                    </div>
                </>
            ) : (
                <div className="text-center text-slate-400 py-8">
                    {loading ? 'Pesquisando...' : 'Nenhum resultado para exibir. Tente buscar pelo código ou parte do nome.'}
                </div>
            )}

            {/* Print Stylesheet */}
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .bg-white, .bg-white * {
                        visibility: visible;
                    }
                    .bg-white {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                    table {
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            `}</style>
        </div>
    );
}
