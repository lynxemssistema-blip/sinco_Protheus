import React, { useState, useEffect, useMemo } from 'react';
import { Package, Search, Calendar, FileText, ChevronRight, ChevronDown, Filter, DownloadCloud, History, FileDown, RefreshCw, Layers, Mail } from 'lucide-react';
import api, { getFileUrl } from '../services/api';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

import RecebimentoModal from '../components/RecebimentoModal';
import RecebimentoHistoricoModal from '../components/RecebimentoHistoricoModal';
import RomaneioCobrancaModal from '../components/RomaneioModals/RomaneioCobrancaModal';
import useStickyState from '../hooks/useStickyState';

export default function RecebimentoRomaneios() {
    const [itens, setItens] = useState([]);
    const [tiposRomaneio, setTiposRomaneio] = useState([]);
    const [loading, setLoading] = useState(true);
    const [groupBy, setGroupBy] = useStickyState('none', '@metalfisa:romaneio_rec_groupby'); // 'none' | 'padrao' | 'data' | 'produto' | 'pedido'

    // Filtros
    const [filters, setFilters] = useStickyState({
        search: '',
        fornecedor: '',
        romaneioId: '',
        tipoRomaneio: '',
        pedido: '',
        viewMode: 'pendentes' // 'pendentes' | 'todos'
    }, '@metalfisa:romaneio_rec_filters');

    // Modais
    const [modalRecebimentoOpen, setModalRecebimentoOpen] = useState(false);
    const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false);
    const [modalCobrancaOpen, setModalCobrancaOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [selectedSupplierForCobranca, setSelectedSupplierForCobranca] = useState(null);
    const [cobrancaItems, setCobrancaItems] = useState([]);

    // Estados de Edição Inline
    const [editingDateId, setEditingDateId] = useState(null);
    const [tempDate, setTempDate] = useState('');

    useEffect(() => {
        carregarTipos();
    }, []);

    const carregarTipos = async () => {
        try {
            const { data } = await api.get('/romaneios/types');
            setTiposRomaneio(data);
        } catch (error) {
            console.error('Erro ao buscar tipos:', error);
        }
    };

    useEffect(() => {
        carregarItens();
    }, [filters.viewMode]); // Recarrega automaticamente ao mudar a aba de viewMode

    const carregarItens = async () => {
        // Removido bloqueio de performance conforme solicitação do usuário
        // para permitir visualização da lista completa inicialmente.

        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.fornecedor) params.append('fornecedor', filters.fornecedor);
            if (filters.romaneioId) params.append('romaneioId', filters.romaneioId);
            if (filters.tipoRomaneio) params.append('tipoRomaneio', filters.tipoRomaneio);
            if (filters.pedido) params.append('pedido', filters.pedido);
            params.append('viewMode', filters.viewMode);

            const { data } = await api.get(`/romaneios/recebimentos/pendentes?${params.toString()}`);
            setItens(data);
        } catch (error) {
            console.error('Erro ao buscar itens:', error);
            toast.error('Erro ao buscar itens pendentes de retorno.');
        } finally {
            setLoading(false);
        }
    };

    const carregarItensSilencioso = async () => {
        // Removido bloqueio de performance

        try {
            const params = new URLSearchParams();
            if (filters.search) params.append('search', filters.search);
            if (filters.fornecedor) params.append('fornecedor', filters.fornecedor);
            if (filters.romaneioId) params.append('romaneioId', filters.romaneioId);
            if (filters.tipoRomaneio) params.append('tipoRomaneio', filters.tipoRomaneio);
            if (filters.pedido) params.append('pedido', filters.pedido);
            params.append('viewMode', filters.viewMode);

            const { data } = await api.get(`/romaneios/recebimentos/pendentes?${params.toString()}`);
            setItens(data);
        } catch (error) {
            console.error('Erro ao recarregar itens em background:', error);
        }
    };

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (!filters.search && !filters.fornecedor && !filters.romaneioId && !filters.pedido) {
            toast.warning('Por favor, informe um Fornecedor, Produto, Romaneio ou Pedido para realizar a busca.');
            return;
        }
        carregarItens();
    };

    const handleClearFilters = () => {
        setFilters({ search: '', fornecedor: '', romaneioId: '', tipoRomaneio: '', pedido: '', viewMode: 'pendentes' });
        // O useEffect não vai pegar o reset de texto, então forçamos carregarItens sem params textuais:
        setTimeout(() => carregarItens(), 100);
    };

    const openRecebimentoModal = (item) => {
        setSelectedItem(item);
        setModalRecebimentoOpen(true);
    };

    const openCobrancaModal = (fornecedorNome, items) => {
        // Encontrar os dados do fornecedor a partir de um dos itens (já temos cod/loja/nome neles)
        const first = items[0];
        setSelectedSupplierForCobranca({
            nome: first.fornecedor_nome,
            codigo: first.fornecedor_cod,
            loja: '01', // Padrão
            email: '' // O backend vai carregar, mas mostraremos que será enviado
        });
        setCobrancaItems(items);
        setModalCobrancaOpen(true);
    };

    const handleDateUpdate = async (romaneioId, newDate) => {
        try {
            await api.patch(`/romaneios/${romaneioId}/forecast-date`, { data_previsao_retorno: newDate });
            toast.success('Data de previsão atualizada!');
            carregarItensSilencioso();
            setEditingDateId(null);
        } catch (error) {
            console.error('Erro ao atualizar data:', error);
            toast.error('Erro ao salvar nova data de previsão.');
        }
    };

    const exportToExcel = () => {
        if (itens.length === 0) {
            toast.warning("Não há itens para exportar.");
            return;
        }

        const dataToExport = itens.map(item => {
            const recebidos = Number(item.quantidade_recebida);
            const enviado = Number(item.quantidade_enviada);
            const pendente = Number(item.saldo_pendente);

            return {
                "Romaneio": item.romaneio_id,
                "Tipo": item.romaneio_tipo || 'Sem Tipo',
                "Data Liberação": item.data_liberacao ? new Date(item.data_liberacao).toLocaleDateString('pt-BR') : '-',
                "Previsão Retorno": item.data_previsao_retorno ? new Date(item.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-',
                "Fornecedor": item.fornecedor_nome,
                "Loja": item.fornecedor_cod,
                "Pedido": item.pedido || '-',
                "Item Pedido": item.item_pedido || '-',
                "Código Produto": item.codigo_produto,
                "Descrição": item.descricao_produto,
                "Qtd. Enviada": enviado,
                "Qtd. Recebida": recebidos,
                "Saldo Pendente": pendente,
                "Status": pendente <= 0 ? "Concluído" : "Pendente"
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Recebimentos");

        // Ajustar largura das colunas
        const colWidths = [
            { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
            { wch: 35 }, { wch: 10 }, { wch: 15 }, { wch: 15 },
            { wch: 20 }, { wch: 40 }, { wch: 12 }, { wch: 12 },
            { wch: 15 }, { wch: 15 }
        ];
        worksheet["!cols"] = colWidths;

        XLSX.writeFile(workbook, `Controle_Retorno_Romaneios_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const groupedData = useMemo(() => {
        if (groupBy === 'none') return null;

        return itens.reduce((acc, item) => {
            if (groupBy === 'padrao') {
                const fornecedor = item.fornecedor_nome || 'Sem Fornecedor';
                const romaneio = `Romaneio #${item.romaneio_id}`;
                const pedido = item.pedido ? `Pedido ${item.pedido}` : 'Sem Pedido';

                if (!acc[fornecedor]) acc[fornecedor] = {};
                if (!acc[fornecedor][romaneio]) acc[fornecedor][romaneio] = {};
                if (!acc[fornecedor][romaneio][pedido]) acc[fornecedor][romaneio][pedido] = [];

                acc[fornecedor][romaneio][pedido].push(item);
            } else if (groupBy === 'data') {
                const dataLib = item.data_liberacao ? new Date(item.data_liberacao).toLocaleDateString('pt-BR') : 'Sem Data';
                if (!acc[dataLib]) acc[dataLib] = [];
                acc[dataLib].push(item);
            } else if (groupBy === 'produto') {
                const prod = `${item.codigo_produto} - ${item.descricao_produto}`;
                if (!acc[prod]) acc[prod] = [];
                acc[prod].push(item);
            } else if (groupBy === 'pedido') {
                const ped = item.pedido ? `Pedido ${item.pedido}` : 'Sem Pedido';
                if (!acc[ped]) acc[ped] = [];
                acc[ped].push(item);
            }
            return acc;
        }, {});
    }, [itens, groupBy]);

    const renderItemRow = (item, isGroupedView = false) => {
        const recebidos = Number(item.quantidade_recebida);
        const enviado = Number(item.quantidade_enviada);
        const pendente = Number(item.saldo_pendente);
        const concluido = pendente <= 0;

        return (
            <tr key={item.item_id} className={`hover:bg-slate-50 transition-colors ${concluido ? 'bg-green-50/30' : ''}`}>
                <td className={`px-3 py-2 ${isGroupedView ? 'pl-10 text-slate-500' : ''}`}>
                    <div className="font-semibold text-slate-800">#{item.romaneio_id}</div>
                    <div className="text-[11px] text-slate-500">{item.romaneio_tipo || 'Sem Tipo'}</div>
                </td>
                <td className="px-3 py-2 text-center text-xs text-slate-600">
                    {item.data_liberacao ? new Date(item.data_liberacao).toLocaleDateString('pt-BR') : '-'}
                </td>
                <td className="px-3 py-2 text-center text-xs text-slate-600 font-medium">
                    {editingDateId === item.romaneio_id ? (
                        <input
                            type="date"
                            autoFocus
                            value={tempDate || ''}
                            onChange={(e) => setTempDate(e.target.value)}
                            onBlur={() => handleDateUpdate(item.romaneio_id, tempDate)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleDateUpdate(item.romaneio_id, tempDate);
                                if (e.key === 'Escape') setEditingDateId(null);
                            }}
                            className="w-full px-1 py-0.5 border border-indigo-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none text-[11px]"
                        />
                    ) : (
                        <div 
                            className="cursor-pointer hover:text-indigo-600 hover:bg-slate-100 px-2 py-1 rounded transition-colors flex items-center justify-center gap-1 group"
                            onClick={() => {
                                setEditingDateId(item.romaneio_id);
                                setTempDate(item.data_previsao_retorno ? item.data_previsao_retorno : '');
                            }}
                        >
                            {item.data_previsao_retorno ? new Date(item.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Definir'}
                            <Calendar className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                    )}
                </td>
                <td className="px-3 py-2">
                    <div className="text-slate-800 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={item.fornecedor_nome}>
                        {item.fornecedor_nome}
                    </div>
                </td>
                <td className="px-3 py-2">
                    <div className="font-medium text-slate-700">{item.pedido || '-'}</div>
                    <div className="text-xs text-slate-500">Item: {item.item_pedido || '-'}</div>
                </td>
                <td className="px-3 py-2">
                    <div className="font-medium text-slate-800">{item.codigo_produto}</div>
                    <div className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={item.descricao_produto}>
                        {item.descricao_produto}
                    </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
                    {enviado.toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-indigo-600 font-semibold bg-indigo-50/50">
                    {recebidos.toLocaleString('pt-BR')}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                    {concluido ? (
                        <div className="flex flex-col items-end">
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-800 border border-green-200 mb-1">
                                CONCLUÍDO
                            </span>
                            {item.data_ultimo_recebimento && (
                                <div className="text-[10px] text-slate-500 whitespace-nowrap" title="Data do último recebimento">
                                    {new Date(item.data_ultimo_recebimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </div>
                            )}
                            {item.ultimo_usuario && (
                                <div className="text-[9px] font-semibold text-slate-400 truncate max-w-[80px] uppercase" title={`Recebido por: ${item.ultimo_usuario}`}>
                                    {item.ultimo_usuario.split(' ')[0]}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="font-bold text-red-600">{pendente.toLocaleString('pt-BR')}</span>
                    )}
                </td>
                <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                        <button
                            onClick={() => handlePdfClick(item)}
                            title={item.has_docs ? "Visualizar PDF da Peça" : "Sem documentos"}
                            className={`p-1.5 rounded transition-all ${item.has_docs ? 'text-red-500 bg-red-50 hover:bg-red-100 ring-1 ring-red-200/50' : 'text-gray-300 hover:text-red-500 hover:bg-red-50'}`}
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => openHistoricoModal(item)}
                            title="Ver Histórico de Recebimentos"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                        >
                            <History className="w-4 h-4" />
                        </button>
                        {!concluido && (
                            <button
                                onClick={() => openRecebimentoModal(item)}
                                title="Registrar Novo Recebimento"
                                className="p-1.5 text-green-600 bg-green-50 hover:bg-green-100 hover:text-green-700 rounded transition-colors"
                            >
                                <DownloadCloud className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    const openHistoricoModal = (item) => {
        setSelectedItem(item);
        setModalHistoricoOpen(true);
    };

    const handlePdfClick = (item) => {
        if (item.has_drawing && item.drawing_url) {
            window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.drawing_url)}`), '_blank');
        } else if (item.docs_count === 1 && item.first_doc) {
            window.open(getFileUrl(`/api/docs/view?path=${encodeURIComponent(item.first_doc)}`), '_blank');
        } else if (item.has_docs) {
            toast.info("O item possui múltiplos anexos sem um desenho principal definido. Verifique na engenharia.");
        } else {
            toast.warning("Nenhum documento anexado a esta peça.");
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 space-y-4">

            {/* Header / Título */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                        <DownloadCloud className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Recebimento de Retornos</h1>
                        <p className="text-sm text-slate-500">Controle de peças que voltaram dos fornecedores (Romaneios)</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="relative group">
                        <select
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                            className={`appearance-none flex items-center gap-2 pl-9 pr-8 py-2 border rounded-lg font-medium transition-colors outline-none cursor-pointer ${groupBy !== 'none'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                                }`}
                            title="Opções de Agrupamento"
                        >
                            <option value="none">Sem Agrupamento</option>
                            <option value="padrao">Padrão (Fornecedor {'>'} Romaneio)</option>
                            <option value="data">Data de Liberação</option>
                            <option value="produto">Produto</option>
                            <option value="pedido">Pedido</option>
                        </select>
                        <Layers className={`w-4 h-4 absolute left-3 top-2.5 ${groupBy !== 'none' ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <ChevronDown className={`w-4 h-4 absolute right-3 top-2.5 pointer-events-none ${groupBy !== 'none' ? 'text-indigo-600' : 'text-slate-400'}`} />
                    </div>
                    <button
                        onClick={exportToExcel}
                        disabled={itens.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Exportar listagem atual para Excel"
                    >
                        <FileDown className="w-4 h-4" />
                        Exportar
                    </button>
                    <button
                        onClick={carregarItens}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <form onSubmit={handleSearch} className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Fornecedor</label>
                        <div className="relative">
                            <input
                                type="text"
                                name="fornecedor"
                                value={filters.fornecedor}
                                onChange={handleFilterChange}
                                placeholder="Nome ou Código..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                            />
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Produto</label>
                        <input
                            type="text"
                            name="search"
                            value={filters.search}
                            onChange={handleFilterChange}
                            placeholder="Código ou Descrição..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Ped / Item</label>
                        <input
                            type="text"
                            name="pedido"
                            value={filters.pedido || ''}
                            onChange={handleFilterChange}
                            placeholder="Ex: 123456"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Romaneio Nº</label>
                        <input
                            type="text"
                            name="romaneioId"
                            value={filters.romaneioId}
                            onChange={handleFilterChange}
                            placeholder="Ex: 123"
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div className="w-40">
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Tipo</label>
                        <select
                            name="tipoRomaneio"
                            value={filters.tipoRomaneio}
                            onChange={handleFilterChange}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">Todos</option>
                            {tiposRomaneio.map(t => (
                                <option key={t.id} value={t.id}>{t.description}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Exibição</label>
                        <select
                            name="viewMode"
                            value={filters.viewMode}
                            onChange={(e) => {
                                handleFilterChange(e);
                            }}
                            className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                            <option value="pendentes">Só Pendentes</option>
                            <option value="todos">Todos os Itens</option>
                        </select>
                    </div>

                    <div className="flex gap-2 h-[38px]">
                        <button
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                            Buscar
                        </button>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                        >
                            Limpar
                        </button>
                    </div>
                </form>
            </div>

            {/* Tabela / DataGrid */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-600 tracking-wider">
                                <th className="px-3 py-3 font-semibold uppercase">Romaneio</th>
                                <th className="px-3 py-3 font-semibold uppercase text-center">Data Lib.</th>
                                <th className="px-3 py-3 font-semibold uppercase text-center">Prev. Ret.</th>
                                <th className="px-3 py-3 font-semibold uppercase">Fornecedor</th>
                                <th className="px-3 py-3 font-semibold uppercase">Ped / Item</th>
                                <th className="px-3 py-3 font-semibold uppercase">Produto / Código</th>
                                <th className="px-3 py-3 font-semibold uppercase text-right">Qtd Env.</th>
                                <th className="px-3 py-3 font-semibold uppercase text-right text-indigo-600">Reais</th>
                                <th className="px-3 py-3 font-semibold uppercase text-right text-red-600">Pend.</th>
                                <th className="px-3 py-3 font-semibold uppercase text-center w-32">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="11" className="px-4 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                                            <span>Buscando itens...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : itens.length === 0 ? (
                                <tr>
                                    <td colSpan="11" className="px-4 py-12 text-center text-slate-500">
                                        <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <p className="text-base font-medium">Nenhum item pendente encontrado</p>
                                        <p className="text-sm mt-1">Verifique se há filtros aplicados ou se todos os itens já foram recebidos.</p>
                                    </td>
                                </tr>
                            ) : groupBy !== 'none' && groupedData ? (
                                groupBy === 'padrao' ? (
                                    Object.entries(groupedData).map(([fornecedor, romaneios]) => (
                                        <React.Fragment key={fornecedor}>
                                            <tr className="bg-slate-200/70 border-y border-slate-300">
                                                <td colSpan="11" className="px-4 py-2.5 font-bold text-slate-800 uppercase tracking-wide">
                                                    <div className="flex justify-between items-center w-full">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                            {fornecedor}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                // Coletar todos os itens PENDENTES desse fornecedor
                                                                const pendingGroupItems = Object.values(romaneios).flatMap(p => Object.values(p).flat()).filter(i => Number(i.saldo_pendente) > 0);
                                                                if (pendingGroupItems.length === 0) {
                                                                    toast.info("Não há itens pendentes para este fornecedor.");
                                                                    return;
                                                                }
                                                                openCobrancaModal(fornecedor, pendingGroupItems);
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-1 bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
                                                        >
                                                            <Mail className="w-3.5 h-3.5" />
                                                            Enviar Cobrança
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                            {Object.entries(romaneios).map(([romaneio, pedidos]) => (
                                                <React.Fragment key={`${fornecedor}-${romaneio}`}>
                                                    <tr className="bg-slate-100 border-y border-slate-200">
                                                        <td colSpan="11" className="px-6 py-2 font-semibold text-slate-700 flex items-center gap-2">
                                                            <ChevronRight className="w-4 h-4 text-slate-400" />
                                                            {romaneio}
                                                        </td>
                                                    </tr>
                                                    {Object.entries(pedidos).map(([pedido, itemsInPedido]) => (
                                                        <React.Fragment key={`${fornecedor}-${romaneio}-${pedido}`}>
                                                            <tr className="bg-white border-y border-slate-100">
                                                                <td colSpan="11" className="px-8 py-1.5 font-medium text-slate-600 text-xs flex items-center gap-2">
                                                                    <Package className="w-3.5 h-3.5 text-slate-400" />
                                                                    {pedido}
                                                                </td>
                                                            </tr>
                                                            {itemsInPedido.map(item => renderItemRow(item, true))}
                                                        </React.Fragment>
                                                    ))}
                                                </React.Fragment>
                                            ))}
                                        </React.Fragment>
                                    ))
                                ) : (
                                    // 1-Level Grouping Rendering
                                    Object.entries(groupedData).map(([groupName, itemsInGroup]) => (
                                        <React.Fragment key={groupName}>
                                            <tr className="bg-slate-100 border-y border-slate-200">
                                                <td colSpan="11" className="px-4 py-2.5 font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2 bg-indigo-50/50">
                                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                    {groupName}
                                                    <span className="text-xs text-slate-500 font-normal ml-2 lowercase bg-white px-2 py-0.5 rounded-full border border-slate-200">
                                                        {itemsInGroup.length} ite{itemsInGroup.length !== 1 ? 'ns' : 'm'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {itemsInGroup.map(item => renderItemRow(item, true))}
                                        </React.Fragment>
                                    ))
                                )
                            ) : (
                                itens.map(item => renderItemRow(item, false))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <RecebimentoModal
                isOpen={modalRecebimentoOpen}
                onClose={() => setModalRecebimentoOpen(false)}
                selectedItem={selectedItem}
                onSaveSuccess={carregarItensSilencioso}
            />

            <RecebimentoHistoricoModal
                isOpen={modalHistoricoOpen}
                onClose={() => setModalHistoricoOpen(false)}
                selectedItem={selectedItem}
            />

            <RomaneioCobrancaModal
                isOpen={modalCobrancaOpen}
                onClose={() => setModalCobrancaOpen(false)}
                supplierData={selectedSupplierForCobranca}
                items={cobrancaItems}
                onFollowupSuccess={carregarItensSilencioso}
            />

        </div>
    );
}
