import React, { useState, useCallback, useEffect } from 'react';
import api from '../../services/api';
import {
    Search, FileSpreadsheet, CheckCircle, AlertTriangle,
    X, Loader2, ChevronDown, Package, HelpCircle
} from 'lucide-react';
import { useFilters } from '../../contexts/FilterContext';

// Use a relative path for the API to ensure it works in both dev and production
// ─────────────────────────────────────────────────────────────────────────────
// PCPExportTab — Aba de Exportação de Materiais para o PCP
// ─────────────────────────────────────────────────────────────────────────────
const PCPExportTab = () => {
    const { orderFilters, updateOrderFilters } = useFilters();

    const [filters, setFilters] = useState({
        dataInicial: orderFilters.dataInicial || '',
        dataFinal: orderFilters.dataFinal || '',
        cliente: orderFilters.cliente || '',
        pedido: orderFilters.pedido || '',
        produto: orderFilters.produto || '',
        dateType: orderFilters.dateType || 'pedido',
        only_active: orderFilters.only_active || 'true',
        estrutura: '',
    });

    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(new Set()); // chave: "pedido|item"
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState(null);
    const [showHelp, setShowHelp] = useState(false);

    // ── Pre-fetch on mount if filters exist ──────────────────────────────
    useEffect(() => {
        if (filters.pedido || filters.cliente) {
            handleSearch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Busca ────────────────────────────────────────────────────────────────
    const handleSearch = useCallback(async () => {
        setLoading(true);
        setError(null);
        setSelected(new Set());
        try {
            const params = {
                dataInicial: filters.dataInicial,
                dataFinal: filters.dataFinal,
                cliente: filters.cliente,
                pedido: filters.pedido,
                produto: filters.produto,
                dateType: filters.dateType,
                only_active: filters.only_active,
                estrutura: filters.estrutura
            };

            const { data } = await api.get('/pcp/orders', { params });
            setItems(data.data || []);
            setSearched(true);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao buscar pedidos.');
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSearch();
    };

    // ── Seleção ──────────────────────────────────────────────────────────────
    const itemKey = (it) => `${it.pedido}|${it.item}`;

    const toggleItem = (it) => {
        setSelected(prev => {
            const next = new Set(prev);
            const k = itemKey(it);
            next.has(k) ? next.delete(k) : next.add(k);
            return next;
        });
    };

    const allSelected = items.length > 0 && items.every(it => selected.has(itemKey(it)));
    const someSelected = !allSelected && items.some(it => selected.has(itemKey(it)));

    const toggleAll = () => {
        if (allSelected) {
            setSelected(new Set());
        } else {
            setSelected(new Set(items.map(itemKey)));
        }
    };

    // ── Exportação ───────────────────────────────────────────────────────────
    const handleExport = async () => {
        const selectedItems = items.filter(it => selected.has(itemKey(it)));
        if (selectedItems.length === 0) return;

        setExporting(true);
        try {
            const payload = selectedItems.map(it => ({
                produto: it.produto,
                quantidade: parseFloat(it.qtd_faturar) || 0,
                descricao_pai: it.descricao,
            }));

            const response = await api.post(
                '/pcp/export',
                payload,
                { responseType: 'arraybuffer' }
            );

            const blob = new Blob([response.data], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const now = new Date();
            const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
            a.href = url;
            a.download = `lista_materiais_${stamp}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            alert('Erro ao gerar exportação. Verifique o console.');
            console.error('[PCPExportTab] Erro export:', err);
        } finally {
            setExporting(false);
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    const selectedCount = selected.size;
    const semEstrutura = items.filter(it => !it.tem_estrutura).length;

    return (
        <div className="space-y-4 pb-24">

            {/* ── FilterBar ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex flex-wrap gap-3 items-end">

                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center mb-0.5">
                            <label className="text-[10px] text-gray-500 font-medium ml-1">Data Início</label>
                            <select
                                value={filters.dateType}
                                onChange={e => setFilters(f => ({ ...f, dateType: e.target.value }))}
                                className="bg-transparent text-[10px] font-bold text-indigo-600 outline-none cursor-pointer p-0"
                            >
                                <option value="entrega">Entrega</option>
                                <option value="pedido">Emissão</option>
                                <option value="nf">NF</option>
                            </select>
                        </div>
                        <input
                            type="date"
                            value={filters.dataInicial}
                            onChange={e => setFilters(f => ({ ...f, dataInicial: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-36"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">Data Fim</label>
                        <input
                            type="date"
                            value={filters.dataFinal}
                            onChange={e => setFilters(f => ({ ...f, dataFinal: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-36"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">Cliente</label>
                        <input
                            type="text"
                            placeholder="Nome..."
                            value={filters.cliente}
                            onChange={e => setFilters(f => ({ ...f, cliente: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-44"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">Pedido</label>
                        <input
                            type="text"
                            placeholder="Nº..."
                            value={filters.pedido}
                            onChange={e => setFilters(f => ({ ...f, pedido: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-28"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">Produto</label>
                        <input
                            type="text"
                            placeholder="Código..."
                            value={filters.produto}
                            onChange={e => setFilters(f => ({ ...f, produto: e.target.value }))}
                            onKeyDown={handleKeyDown}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-32"
                        />
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-gray-500 font-medium ml-1">Estrutura</label>
                        <div className="relative">
                            <select
                                value={filters.estrutura}
                                onChange={e => setFilters(f => ({ ...f, estrutura: e.target.value }))}
                                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-32 bg-white"
                            >
                                <option value="">Todas</option>
                                <option value="com">Com</option>
                                <option value="sem">Sem</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200">
                        <label className="relative inline-flex items-center cursor-pointer scale-90 origin-left">
                            <input
                                type="checkbox"
                                checked={filters.only_active === 'true'}
                                onChange={e => setFilters(f => ({ ...f, only_active: e.target.checked ? 'true' : 'false' }))}
                                className="sr-only peer"
                            />
                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                            <span className="ml-2 text-[10px] font-bold text-gray-600">Pendentes</span>
                        </label>
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={loading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 self-end"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Buscar
                    </button>

                    {searched && (
                        <button
                            onClick={() => {
                                setFilters({
                                    dataInicial: '', dataFinal: '', cliente: '', pedido: '',
                                    produto: '', dateType: 'entrega', only_active: 'true', estrutura: ''
                                });
                                setItems([]);
                                setSelected(new Set());
                                setSearched(false);
                            }}
                            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors self-end"
                        >
                            <X className="h-4 w-4" />
                            Limpar
                        </button>
                    )}

                    <div className="flex-1"></div>

                    <button
                        onClick={() => setShowHelp(true)}
                        className="flex items-center gap-1.5 text-gray-500 hover:text-indigo-600 px-3 py-2 rounded-lg text-sm font-medium transition-colors self-end"
                        title="Como usar esta tela?"
                    >
                        <HelpCircle className="h-4 w-4" />
                        Ajuda
                    </button>
                </div>
            </div>

            {/* ── Erro ──────────────────────────────────────────────── */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {/* ── Estado vazio (não buscou ainda) ───────────────────── */}
            {!searched && !loading && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center py-16 text-gray-400">
                    <Package className="h-12 w-12 mb-3 opacity-40" />
                    <p className="text-sm">Use os filtros acima e clique em <strong>Buscar</strong> para listar os itens.</p>
                </div>
            )}

            {/* ── Tabela ────────────────────────────────────────────── */}
            {searched && !loading && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Cabeçalho da tabela com resumo */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-3 text-sm text-gray-600">
                            <span className="font-medium">{items.length} item(ns) encontrado(s)</span>
                            {semEstrutura > 0 && (
                                <span className="flex items-center gap-1 text-red-500">
                                    <AlertTriangle className="h-4 w-4" />
                                    {semEstrutura} sem estrutura
                                </span>
                            )}
                        </div>
                        {items.length > 0 && (
                            <button
                                onClick={toggleAll}
                                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                                {allSelected ? 'Desmarcar todos' : 'Selecionar todos'}
                            </button>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                            <Search className="h-10 w-10 mb-2 opacity-40" />
                            <p className="text-sm">Nenhum item encontrado com esses filtros.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide">
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                ref={el => { if (el) el.indeterminate = someSelected; }}
                                                onChange={toggleAll}
                                                className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                                            />
                                        </th>
                                        <th className="px-3 py-3 whitespace-nowrap">Data Entrega</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Pedido</th>
                                        <th className="px-3 py-3">Cliente</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Código</th>
                                        <th className="px-3 py-3">Descrição</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-center">Status</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Qtd. Entregue</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-right">Saldo a Faturar</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Quant / Un</th>
                                        <th className="px-3 py-3 whitespace-nowrap text-center">Estrutura</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {items.map((it) => {
                                        const k = itemKey(it);
                                        const isSelected = selected.has(k);
                                        const semEstr = !it.tem_estrutura;

                                        return (
                                            <tr
                                                key={k}
                                                onClick={() => toggleItem(it)}
                                                className={[
                                                    'cursor-pointer transition-colors',
                                                    isSelected
                                                        ? 'bg-indigo-50'
                                                        : semEstr
                                                            ? 'bg-red-50 hover:bg-red-100'
                                                            : 'hover:bg-gray-50',
                                                    semEstr ? 'border-l-4 border-l-red-400' : '',
                                                ].join(' ')}
                                            >
                                                <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleItem(it)}
                                                        className="rounded border-gray-300 text-indigo-600 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">
                                                    {it.data_entrega || '—'}
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-800">
                                                    {it.pedido}
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-700 max-w-[180px] truncate" title={it.cliente}>
                                                    {it.cliente || '—'}
                                                </td>
                                                <td className="px-3 py-2.5 whitespace-nowrap font-mono text-gray-800">
                                                    {it.produto}
                                                </td>
                                                <td className="px-3 py-2.5 text-gray-700 max-w-[220px] truncate" title={it.descricao}>
                                                    {it.descricao || '—'}
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    <span className={[
                                                        'px-2 py-0.5 rounded text-[10px] font-bold border',
                                                        it.status === 'ENTREGUE'
                                                            ? 'bg-green-100 text-green-700 border-green-200'
                                                            : 'bg-orange-100 text-orange-700 border-orange-200'
                                                    ].join(' ')}>
                                                        {it.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 text-right text-gray-600">
                                                    {parseFloat(it.qtd_entreg || 0).toLocaleString('pt-BR')}
                                                </td>
                                                <td className={`px-3 py-2.5 text-right font-medium ${parseFloat(it.qtd_faturar || 0) <= 0 ? 'text-green-600' : 'text-orange-600 font-bold'}`}>
                                                    {parseFloat(it.qtd_faturar || 0).toLocaleString('pt-BR')}
                                                </td>
                                                <td className="px-3 py-2.5 text-right font-medium text-gray-800 whitespace-nowrap">
                                                    {parseFloat(it.quantidade).toLocaleString('pt-BR')} <span className="text-[10px] text-gray-400">{it.unidade}</span>
                                                </td>
                                                <td className="px-3 py-2.5 text-center">
                                                    {it.tem_estrutura ? (
                                                        <CheckCircle className="h-4 w-4 text-green-500 mx-auto" title="Com estrutura" />
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                                                            <AlertTriangle className="h-4 w-4" />
                                                            Sem estrutura
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
            )}

            {/* ── Floating Export Bar ───────────────────────────────── */}
            {selectedCount > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50
                                bg-indigo-700 text-white px-6 py-3 rounded-full shadow-2xl
                                flex items-center gap-5 transition-all animate-in fade-in slide-in-from-bottom-3">
                    <span className="text-sm font-medium">
                        {selectedCount} {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
                    </span>
                    <button
                        onClick={handleExport}
                        disabled={exporting}
                        className="flex items-center gap-2 bg-white text-indigo-700 hover:bg-indigo-50
                                   px-4 py-1.5 rounded-full text-sm font-semibold transition-colors
                                   disabled:opacity-60"
                    >
                        {exporting
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando...</>
                            : <><FileSpreadsheet className="h-4 w-4" /> Gerar Lista de Materiais</>
                        }
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="text-indigo-200 hover:text-white transition-colors"
                        title="Limpar seleção"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* ── Modal de Ajuda ────────────────────────────────────────────── */}
            {showHelp && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gray-50/50">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <HelpCircle className="text-indigo-600 h-6 w-6" />
                                Como Exportar a Lista de Materiais?
                            </h3>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 text-gray-700">
                            <p className="text-sm">
                                Esta ferramenta permite compilar todas as matérias-primas necessárias para produzir uma determinada seleção de itens de pedido, agrupando itens idênticos e somando quantidades.
                            </p>

                            <div className="space-y-4">
                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">1</div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-1">Filtrar Pedidos Pendentes</h4>
                                        <p className="text-sm text-gray-600">
                                            Utilize a barra de filtros no topo para buscar os pedidos. Por padrão, ele lista apenas os pedidos com saldo pendente (chave <strong>Pendentes</strong>). Ao preencher os filtros, clique no botão <strong>Buscar</strong>.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">2</div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-1">Selecionar Itens na Tabela</h4>
                                        <p className="text-sm text-gray-600">
                                            Marque as caixas de seleção na primeira coluna para os produtos que você deseja produzir. Você pode selecionar um por um, ou usar o botão <strong>Selecionar todos</strong> no cabeçalho da tabela.
                                        </p>
                                        <div className="mt-2 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs text-yellow-800 flex items-start gap-2">
                                            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-yellow-600" />
                                            <p>Atenção aos itens destacados em vermelho e com a marcação "Sem estrutura". Itens sem estrutura não gerarão consumo de matéria-prima na exportação, pois a engenharia não cadastrou seus componentes no sistema.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">3</div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-1">Processar e Exportar</h4>
                                        <p className="text-sm text-gray-600">
                                            Assim que enviar pelo menos 1 item, uma barra flutuante azul aparecerá na parte inferior da tela. Clique em <strong>Gerar Lista de Materiais</strong>.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4">
                                    <div className="flex-shrink-0 w-8 h-8 bg-green-100 text-green-700 rounded-full flex items-center justify-center font-bold">4</div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 mb-1">O Resultado Automático (Excel)</h4>
                                        <p className="text-sm text-gray-600">
                                            O sistema fará a "explosão" de toda a árvore de produtos em segundo plano, até o último nível (matéria-prima final). Então fará a multiplicação pela quantidade a faturar do pedido e consolidará todas as matérias-primas unificando pela descrição e código. Um arquivo Excel pronto para envio a compras e ao almoxarifado será baixado automaticamente!
                                        </p>
                                        <div className="mt-2 bg-gray-50 border border-gray-200 p-4 rounded-lg text-sm">
                                            <h5 className="font-bold text-indigo-700 mb-2">💡 Exemplo Prático de Agrupamento</h5>
                                            <p className="text-gray-600 mb-2">Se você selecionou:</p>
                                            <ul className="list-disc list-inside text-gray-600 ml-2 mb-2">
                                                <li>Item A (Qtd: 10) que tem na sua estrutura: 4 Un de Parafuso M6.</li>
                                                <li>Item B (Qtd: 5) que também tem na sua estrutura: 2 Un de Parafuso M6.</li>
                                            </ul>
                                            <p className="text-gray-600">
                                                A planilha listará <strong>apenas uma linha</strong> para "Parafuso M6", com a <strong>quantidade total igual a 50</strong> <span className="text-xs text-gray-400">(10x4 + 5x2)</span>.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setShowHelp(false)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                            >
                                Entendi
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PCPExportTab;
