import React, { useState, useEffect, useMemo } from 'react';
import {
    Play, Search, CheckCircle2, AlertTriangle, RefreshCw,
    Layers, Scissors, ShieldAlert, CheckSquare, Square,
    Filter, Database, ArrowRight, UserCheck, Info, Sparkles,
    Check, X, ChevronRight, Hash, Wrench, Clock, Truck, Factory, Tag
} from 'lucide-react';
import { toast } from 'react-toastify';
import { previewAjusteApontamento, executarAjusteApontamento, getRecursosAjusteApontamento } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

// Recursos de fallback caso a requisição inicial esteja carregando
const RECURSOS_FALLBACK = [
    { codigo: 'MO0013', nome: 'LASER', categoria: 'INTERNO', qtd_usos: 13982 },
    { codigo: 'MO0003', nome: 'VIRADEIRA', categoria: 'INTERNO', qtd_usos: 11038 },
    { codigo: 'MO0012', nome: 'EMBALAGEM', categoria: 'INTERNO', qtd_usos: 5925 },
    { codigo: 'MO0020', nome: 'SOLDA MIG/TIG', categoria: 'INTERNO', qtd_usos: 5220 },
    { codigo: 'MO0008', nome: 'ACABAMENTO', categoria: 'INTERNO', qtd_usos: 4934 },
    { codigo: 'MO0010', nome: 'PINTURA', categoria: 'INTERNO', qtd_usos: 3144 },
    { codigo: 'MO0011', nome: 'MONTAGEM', categoria: 'INTERNO', qtd_usos: 2263 },
    { codigo: 'MO0002', nome: 'PUNCIONADEIRA', categoria: 'INTERNO', qtd_usos: 1913 },
    { codigo: 'MO0001', nome: 'GUILHOTINA', categoria: 'INTERNO', qtd_usos: 1843 }
];

export default function AjusteApontamentoTab() {
    const { user } = useAuth();

    // Filtros e Parâmetros de Busca
    const [pedidosInput, setPedidosInput] = useState('');
    const [selectedRecursos, setSelectedRecursos] = useState(['MO0001', 'MO0002', 'MO0013']);
    const [modoApontamento, setModoApontamento] = useState('FALTANTE_TOTAL'); // 'FALTANTE_TOTAL' | 'PROTHEUS_QUJE'
    const [usuarioApontamento, setUsuarioApontamento] = useState('Sistema Automatico SINCO');
    const [observacaoCustom, setObservacaoCustom] = useState('[AJUSTE EM LOTE] Apontamento automático complementar PCP');

    // Estados de Execução & Dados
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [loadingExecucao, setLoadingExecucao] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [selectedItemsKeys, setSelectedItemsKeys] = useState(new Set());
    const [filterStatusTabela, setFilterStatusTabela] = useState('TODOS'); // 'TODOS' | 'PENDENTES' | 'CONCLUIDOS'
    const [searchTable, setSearchTable] = useState('');
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Lista Completa de Recursos do Protheus / SH1010
    const [allRecursos, setAllRecursos] = useState(RECURSOS_FALLBACK);
    const [loadingRecursos, setLoadingRecursos] = useState(true);
    const [tabCategoriaRecurso, setTabCategoriaRecurso] = useState('TODOS'); // 'TODOS' | 'INTERNO' | 'TERCEIRO' | 'DESTAQUE'
    const [searchRecurso, setSearchRecurso] = useState('');

    useEffect(() => {
        setLoadingRecursos(true);
        getRecursosAjusteApontamento()
            .then(res => {
                if (Array.isArray(res) && res.length > 0) {
                    setAllRecursos(res);
                }
            })
            .catch(err => {
                console.warn('Erro ao carregar lista completa de recursos do Protheus:', err);
            })
            .finally(() => {
                setLoadingRecursos(false);
            });
    }, []);

    // Alternar seleção de recurso individual
    const toggleRecurso = (codigo) => {
        setSelectedRecursos(prev => {
            const next = new Set(prev);
            if (next.has(codigo)) next.delete(codigo);
            else next.add(codigo);
            return Array.from(next);
        });
    };

    // Botões de Ação Rápida de Seleção
    const handleSelectDestaquesCorte = () => {
        setSelectedRecursos(['MO0001', 'MO0002', 'MO0013']);
    };

    const handleSelectTodosInternos = () => {
        const internos = allRecursos.filter(r => r.categoria === 'INTERNO' || r.codigo.startsWith('MO')).map(r => r.codigo);
        setSelectedRecursos(internos);
    };

    const handleSelectTodosTerceiros = () => {
        const terceiros = allRecursos.filter(r => r.categoria === 'TERCEIRO' || r.codigo.startsWith('ST')).map(r => r.codigo);
        setSelectedRecursos(terceiros);
    };

    const handleSelectTodos = () => {
        setSelectedRecursos(allRecursos.map(r => r.codigo));
    };

    const handleLimparRecursos = () => {
        setSelectedRecursos([]);
    };

    // Filtragem dos recursos para exibição na grade
    const filteredRecursos = useMemo(() => {
        return allRecursos.filter(rec => {
            // Filtro por Categoria
            if (tabCategoriaRecurso === 'INTERNO' && rec.categoria !== 'INTERNO') return false;
            if (tabCategoriaRecurso === 'TERCEIRO' && rec.categoria !== 'TERCEIRO') return false;
            if (tabCategoriaRecurso === 'DESTAQUE') {
                const destaques = ['MO0013', 'MO0001', 'MO0002', 'MO0003', 'MO0020', 'MO0008', 'MO0010', 'MO0011', 'MO0012'];
                if (!destaques.includes(rec.codigo)) return false;
            }

            // Filtro por Texto de Busca
            if (searchRecurso && searchRecurso.trim().length > 0) {
                const s = searchRecurso.toLowerCase();
                const matchCod = rec.codigo.toLowerCase().includes(s);
                const matchNome = rec.nome.toLowerCase().includes(s);
                return matchCod || matchNome;
            }
            return true;
        });
    }, [allRecursos, tabCategoriaRecurso, searchRecurso]);

    // Contadores de Categorias
    const countInternos = useMemo(() => allRecursos.filter(r => r.categoria === 'INTERNO').length, [allRecursos]);
    const countTerceiros = useMemo(() => allRecursos.filter(r => r.categoria === 'TERCEIRO').length, [allRecursos]);

    // 1. Executar Simulação / Preview
    const handleSimular = async (e) => {
        if (e) e.preventDefault();

        if (!pedidosInput || pedidosInput.trim().length === 0) {
            toast.warn('Informe ao menos um número de pedido de venda.');
            return;
        }

        setLoadingPreview(true);
        try {
            const res = await previewAjusteApontamento({
                pedidos: pedidosInput,
                recursos: selectedRecursos,
                modo: modoApontamento
            });

            setPreviewData(res);

            // Marca automaticamente apenas os itens pendentes
            const pendentesKeys = new Set(
                (res.items || [])
                    .filter(it => it.status === 'PENDENTE' && it.saldo_faltante > 0.001)
                    .map(it => `${it.op_completa}-${it.operacao_codigo}`)
            );
            setSelectedItemsKeys(pendentesKeys);

            if (res.items.length === 0) {
                toast.info('Nenhuma operação encontrada para os parâmetros informados.');
            } else if (res.totals.pendentes === 0) {
                toast.success(`Todas as ${res.totals.total_ops} operações dos pedidos informados já estão 100% apontadas!`);
            } else {
                toast.info(`Simulação concluída: ${res.totals.pendentes} operações com saldo pendente de apontamento.`);
            }
        } catch (error) {
            console.error('Erro na simulação:', error);
            toast.error(error.response?.data?.error || 'Erro ao realizar simulação de apontamentos.');
        } finally {
            setLoadingPreview(false);
        }
    };

    // Alternar seleção de itens na tabela de preview
    const toggleItemSelection = (key) => {
        setSelectedItemsKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleSelectAllTable = () => {
        if (!previewData?.items) return;
        const pendentes = previewData.items.filter(it => it.status === 'PENDENTE' && it.saldo_faltante > 0.001);
        if (selectedItemsKeys.size === pendentes.length) {
            setSelectedItemsKeys(new Set());
        } else {
            setSelectedItemsKeys(new Set(pendentes.map(it => `${it.op_completa}-${it.operacao_codigo}`)));
        }
    };

    // 2. Executar Gravação em Lote
    const handleConfirmarExecucao = async () => {
        if (!previewData?.items) return;

        const itemsToAppoint = previewData.items.filter(it => {
            const key = `${it.op_completa}-${it.operacao_codigo}`;
            return selectedItemsKeys.has(key) && it.saldo_faltante > 0.001;
        });

        if (itemsToAppoint.length === 0) {
            toast.warn('Nenhum item com saldo pendente selecionado para gravação.');
            setShowConfirmModal(false);
            return;
        }

        setLoadingExecucao(true);
        try {
            const res = await executarAjusteApontamento({
                items: itemsToAppoint,
                usuario: usuarioApontamento || user?.nome || 'Sistema Automatico SINCO',
                observacao: observacaoCustom
            });

            toast.success(res.message || `${res.total_inseridos} apontamentos gravados com sucesso!`);
            setShowConfirmModal(false);

            // Atualiza a simulação após a gravação
            handleSimular();
        } catch (error) {
            console.error('Erro na execução do apontamento em lote:', error);
            toast.error(error.response?.data?.error || 'Falha ao executar apontamento em lote.');
        } finally {
            setLoadingExecucao(false);
        }
    };

    // Itens filtrados para exibição na tabela
    const displayedItems = (previewData?.items || []).filter(it => {
        if (filterStatusTabela === 'PENDENTES' && it.status !== 'PENDENTE') return false;
        if (filterStatusTabela === 'CONCLUIDOS' && it.status !== 'CONCLUIDO') return false;

        if (searchTable && searchTable.trim().length > 0) {
            const s = searchTable.toLowerCase();
            const matchOp = it.op_completa?.toLowerCase().includes(s);
            const matchPedido = it.pedido?.toLowerCase().includes(s);
            const matchProduto = it.produto?.toLowerCase().includes(s);
            const matchDesc = it.descricao?.toLowerCase().includes(s);
            const matchRecurso = it.recurso_codigo?.toLowerCase().includes(s) || it.recurso_nome?.toLowerCase().includes(s);
            return matchOp || matchPedido || matchProduto || matchDesc || matchRecurso;
        }
        return true;
    });

    const totalSelectedPecas = (previewData?.items || [])
        .filter(it => selectedItemsKeys.has(`${it.op_completa}-${it.operacao_codigo}`))
        .reduce((acc, it) => acc + parseFloat(it.saldo_faltante || 0), 0);

    return (
        <div className="space-y-6">
            {/* Header & Explicação */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center shadow-md">
                            <Play className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-slate-900">Ajustando o Apontamento de Produção</h2>
                                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    PCP & Lote
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 mt-0.5">
                                Simule e aplique apontamentos em lote para regularizar filas verticais por Pedido de Venda e Centro de Trabalho.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <ShieldAlert className="w-4 h-4 text-emerald-600" />
                            Trava Anti-Superapontamento Ativa
                        </span>
                    </div>
                </div>

                {/* Banner de Regras */}
                <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 grid sm:grid-cols-3 gap-3">
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-slate-800 font-bold block">1. Simulação Prévia (Dry-Run):</strong>
                            O sistema busca todas as OPs no Protheus e cruza com os apontamentos existentes sem alterar o banco de dados.
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-slate-800 font-bold block">2. Quantidade Faltante Exata:</strong>
                            Aponta apenas a diferença restante da OP, respeitando rigorosamente o limite de peças planejadas.
                        </div>
                    </div>
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="text-slate-800 font-bold block">3. Atualização em Tempo Real:</strong>
                            Ao confirmar, as filas verticais do chão de fábrica e os lotes de corte associados são atualizados imediatamente.
                        </div>
                    </div>
                </div>
            </div>

            {/* Formulário de Configuração de Busca */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Filter className="w-4 h-4 text-blue-600" />
                    Parâmetros de Ajuste em Lote
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Campo de Pedidos */}
                    <div className="lg:col-span-4 space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Números de Pedido de Venda:
                        </label>
                        <textarea
                            value={pedidosInput}
                            onChange={(e) => setPedidosInput(e.target.value)}
                            placeholder="Digite um ou múltiplos pedidos (ex: 004618, 004145, 005382)..."
                            rows={3}
                            className="w-full p-3 text-sm font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-slate-50 transition-all placeholder:text-slate-400 font-bold text-slate-800"
                        />
                        <p className="text-[11px] text-slate-400 leading-tight">
                            Aceita pedidos com ou sem zeros à esquerda, separados por vírgula, espaço ou quebra de linha.
                        </p>
                    </div>

                    {/* Modo de Apontamento & Operador */}
                    <div className="lg:col-span-4 space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                Regra de Quantidade a Apontar:
                            </label>
                            <div className="space-y-1.5">
                                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                    modoApontamento === 'FALTANTE_TOTAL'
                                        ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                    <input
                                        type="radio"
                                        name="modoApontamento"
                                        value="FALTANTE_TOTAL"
                                        checked={modoApontamento === 'FALTANTE_TOTAL'}
                                        onChange={() => setModoApontamento('FALTANTE_TOTAL')}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="text-xs">
                                        <div>Zerar Saldo Total da OP (100% Concluído)</div>
                                        <div className="text-[10px] font-normal text-slate-500">Aponta até a quantidade total planejada na OP (C2_QUANT)</div>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                    modoApontamento === 'PROTHEUS_QUJE'
                                        ? 'bg-blue-50/70 border-blue-300 text-blue-900 font-bold shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}>
                                    <input
                                        type="radio"
                                        name="modoApontamento"
                                        value="PROTHEUS_QUJE"
                                        checked={modoApontamento === 'PROTHEUS_QUJE'}
                                        onChange={() => setModoApontamento('PROTHEUS_QUJE')}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                                    />
                                    <div className="text-xs">
                                        <div>Espelhar Produção Real do Protheus (C2_QUJE)</div>
                                        <div className="text-[10px] font-normal text-slate-500">Aponta somente até a quantidade já apontada no ERP Protheus</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Operador & Observação */}
                    <div className="lg:col-span-4 space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Nome do Usuário Responsável:
                            </label>
                            <input
                                type="text"
                                value={usuarioApontamento}
                                onChange={(e) => setUsuarioApontamento(e.target.value)}
                                className="w-full p-2.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 text-slate-800"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Observação do Registro:
                            </label>
                            <input
                                type="text"
                                value={observacaoCustom}
                                onChange={(e) => setObservacaoCustom(e.target.value)}
                                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 bg-slate-50 focus:ring-2 focus:ring-blue-500 text-slate-700"
                            />
                        </div>
                    </div>
                </div>

                {/* ─────────────────────────────────────────────────────────────────────────────
                    SELEÇÃO EXPANDIDA DE RECURSOS / CENTROS DE TRABALHO DO PROTHEUS
                ───────────────────────────────────────────────────────────────────────────── */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                <Layers className="w-4 h-4 text-indigo-600" />
                                Recursos / Postos de Trabalho Selecionados:
                            </label>
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                {selectedRecursos.length} selecionado{selectedRecursos.length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Botões de Ação Rápida */}
                        <div className="flex items-center flex-wrap gap-1.5">
                            <button
                                type="button"
                                onClick={handleSelectDestaquesCorte}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors border border-indigo-200"
                            >
                                Apenas Laser / Punc / Guilhotina
                            </button>
                            <button
                                type="button"
                                onClick={handleSelectTodosInternos}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
                            >
                                Todos Internos (MO)
                            </button>
                            <button
                                type="button"
                                onClick={handleSelectTodosTerceiros}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200"
                            >
                                Todos Terceiros (ST)
                            </button>
                            <button
                                type="button"
                                onClick={handleSelectTodos}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
                            >
                                Selecionar Todos ({allRecursos.length})
                            </button>
                            <button
                                type="button"
                                onClick={handleLimparRecursos}
                                className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                            >
                                Limpar
                            </button>
                        </div>
                    </div>

                    {/* Chips de Recursos Selecionados (Visualização Rápida) */}
                    {selectedRecursos.length > 0 && (
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap gap-1.5 items-center max-h-24 overflow-y-auto">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">Ativos:</span>
                            {selectedRecursos.map(code => {
                                const recObj = allRecursos.find(r => r.codigo === code);
                                return (
                                    <span
                                        key={code}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-[11px] font-mono shadow-2xs font-bold"
                                    >
                                        <span>{code}</span>
                                        {recObj && <span className="text-[10px] text-slate-500 font-sans font-normal truncate max-w-[120px]">({recObj.nome})</span>}
                                        <button
                                            type="button"
                                            onClick={() => toggleRecurso(code)}
                                            className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}

                    {/* Barra de Filtro de Categoria e Busca de Recursos */}
                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                        {/* Tabs de Categoria */}
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setTabCategoriaRecurso('TODOS')}
                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    tabCategoriaRecurso === 'TODOS'
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Todos os Recursos ({allRecursos.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTabCategoriaRecurso('DESTAQUE')}
                                className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    tabCategoriaRecurso === 'DESTAQUE'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                }`}
                            >
                                <Sparkles className="w-3 h-3" />
                                Mais Utilizados (9)
                            </button>
                            <button
                                type="button"
                                onClick={() => setTabCategoriaRecurso('INTERNO')}
                                className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    tabCategoriaRecurso === 'INTERNO'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                }`}
                            >
                                <Factory className="w-3 h-3" />
                                Fábrica / MO ({countInternos})
                            </button>
                            <button
                                type="button"
                                onClick={() => setTabCategoriaRecurso('TERCEIRO')}
                                className={`flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    tabCategoriaRecurso === 'TERCEIRO'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                }`}
                            >
                                <Truck className="w-3 h-3" />
                                Terceiros / ST ({countTerceiros})
                            </button>
                        </div>

                        {/* Campo de Busca de Recursos */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchRecurso}
                                onChange={(e) => setSearchRecurso(e.target.value)}
                                placeholder="Filtrar por código ou nome (ex: viradeira, MO0003, zinco)..."
                                className="pl-8 pr-3 py-1 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 w-72 bg-slate-50"
                            />
                            {searchRecurso && (
                                <button
                                    type="button"
                                    onClick={() => setSearchRecurso('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Grade Completa e Scrollável de Recursos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-60 overflow-y-auto p-1 bg-slate-50/50 rounded-xl border border-slate-200">
                        {filteredRecursos.map(rec => {
                            const isSelected = selectedRecursos.includes(rec.codigo);
                            const isInterno = rec.codigo.startsWith('MO');

                            return (
                                <button
                                    key={rec.codigo}
                                    type="button"
                                    onClick={() => toggleRecurso(rec.codigo)}
                                    className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all relative ${
                                        isSelected
                                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100/80 hover:border-slate-300'
                                    }`}
                                >
                                    <div className="flex-1 min-w-0 pr-1">
                                        <div className="flex items-center gap-1">
                                            <span className={`font-mono text-xs font-black ${isSelected ? 'text-emerald-400' : isInterno ? 'text-blue-600' : 'text-amber-600'}`}>
                                                {rec.codigo}
                                            </span>
                                            {rec.qtd_usos > 0 && (
                                                <span className={`text-[9px] px-1 rounded font-mono ${
                                                    isSelected ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
                                                }`}>
                                                    {rec.qtd_usos >= 1000 ? `${(rec.qtd_usos / 1000).toFixed(1)}k` : rec.qtd_usos}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] font-bold leading-tight block truncate mt-0.5" title={rec.nome}>
                                            {rec.nome}
                                        </span>
                                    </div>
                                    <div className="shrink-0 mt-0.5">
                                        {isSelected ? (
                                            <div className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </div>
                                        ) : (
                                            <div className="w-4 h-4 rounded border border-slate-300 bg-slate-50" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Botão de Disparo da Simulação */}
                <div className="flex justify-end pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={handleSimular}
                        disabled={loadingPreview}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
                    >
                        {loadingPreview ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Consultando Protheus & SINCO...
                            </>
                        ) : (
                            <>
                                <Search className="w-4 h-4" />
                                1. Simular / Buscar Pendências (Preview)
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Painel de Resultados da Simulação */}
            {previewData && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5 animate-fade-in">
                    {/* Sumário de Totais */}
                    <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-100 pb-4">
                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                Resultado da Simulação de Apontamentos
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Total de {previewData.totals.total_ops} operações mapeadas nos pedidos informados.
                            </p>
                        </div>

                        {previewData.totals.pendentes > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(true)}
                                disabled={selectedItemsKeys.size === 0}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all disabled:opacity-50"
                            >
                                <Play className="w-4 h-4 fill-current" />
                                2. Executar Apontamento em Lote ({selectedItemsKeys.size} OPs / {totalSelectedPecas} un)
                            </button>
                        )}
                    </div>

                    {/* Cards de Métricas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Operações</span>
                            <span className="text-2xl font-black text-slate-900">{previewData.totals.total_ops}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider block">100% Concluídas</span>
                            <span className="text-2xl font-black text-emerald-700">{previewData.totals.concluidas}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-center">
                            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider block">Com Pendências</span>
                            <span className="text-2xl font-black text-amber-700">{previewData.totals.pendentes}</span>
                        </div>
                        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                            <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider block">Peças a Apontar</span>
                            <span className="text-2xl font-black text-indigo-700">{previewData.totals.total_pecas_faltantes} un</span>
                        </div>
                    </div>

                    {/* Filtros da Tabela de Preview */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Filtrar:</span>
                            <button
                                type="button"
                                onClick={() => setFilterStatusTabela('TODOS')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    filterStatusTabela === 'TODOS'
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                Todos ({previewData.items.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatusTabela('PENDENTES')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    filterStatusTabela === 'PENDENTES'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                                }`}
                            >
                                Pendentes ({previewData.totals.pendentes})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterStatusTabela('CONCLUIDOS')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors ${
                                    filterStatusTabela === 'CONCLUIDOS'
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                }`}
                            >
                                Concluídos ({previewData.totals.concluidas})
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchTable}
                                    onChange={(e) => setSearchTable(e.target.value)}
                                    placeholder="Buscar OP, produto ou recurso..."
                                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 w-64 bg-slate-50"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleSelectAllTable}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                                Marcar/Desmarcar Pendentes
                            </button>
                        </div>
                    </div>

                    {/* Tabela de OPs e Operações */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-[500px] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200">
                                <tr>
                                    <th className="p-3 w-10 text-center">
                                        <input
                                            type="checkbox"
                                            checked={
                                                selectedItemsKeys.size > 0 &&
                                                selectedItemsKeys.size === previewData.items.filter(it => it.status === 'PENDENTE' && it.saldo_faltante > 0.001).length
                                            }
                                            onChange={handleSelectAllTable}
                                            className="rounded text-blue-600 focus:ring-blue-500"
                                        />
                                    </th>
                                    <th className="p-3">Pedido / Item</th>
                                    <th className="p-3">OP / Sequência</th>
                                    <th className="p-3">Produto / Descrição</th>
                                    <th className="p-3 text-center">Recurso / Operação</th>
                                    <th className="p-3 text-right">Qtd OP</th>
                                    <th className="p-3 text-right">Já Apontado</th>
                                    <th className="p-3 text-right text-indigo-700 font-black">Saldo a Apontar</th>
                                    <th className="p-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                                {displayedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-slate-400 italic">
                                            Nenhum item corresponde ao filtro selecionado.
                                        </td>
                                    </tr>
                                ) : (
                                    displayedItems.map(it => {
                                        const key = `${it.op_completa}-${it.operacao_codigo}`;
                                        const isSelected = selectedItemsKeys.has(key);
                                        const isPendente = it.status === 'PENDENTE' && it.saldo_faltante > 0.001;

                                        return (
                                            <tr
                                                key={key}
                                                onClick={() => isPendente && toggleItemSelection(key)}
                                                className={`transition-colors ${
                                                    !isPendente
                                                        ? 'bg-slate-50/60 opacity-70'
                                                        : isSelected
                                                        ? 'bg-blue-50/80 hover:bg-blue-100/80 cursor-pointer'
                                                        : 'hover:bg-slate-50 cursor-pointer'
                                                }`}
                                            >
                                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                    {isPendente ? (
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleItemSelection(key)}
                                                            className="rounded text-blue-600 focus:ring-blue-500"
                                                        />
                                                    ) : (
                                                        <Check className="w-4 h-4 text-emerald-600 mx-auto" />
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <span className="font-bold text-slate-800">{it.pedido}</span>
                                                    {it.item_pedido && <span className="text-slate-400 text-[10px] ml-1">({it.item_pedido})</span>}
                                                </td>
                                                <td className="p-3 font-mono font-bold text-slate-700">
                                                    {it.op_completa}
                                                </td>
                                                <td className="p-3 max-w-[240px]">
                                                    <div className="font-mono text-blue-600 font-bold truncate">{it.produto}</div>
                                                    <div className="text-[11px] text-slate-500 truncate" title={it.descricao}>{it.descricao}</div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                                        {it.recurso_codigo}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 block mt-0.5">Op: {it.operacao_codigo}</span>
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-700">
                                                    {it.qtd_op}
                                                </td>
                                                <td className="p-3 text-right font-mono text-slate-600">
                                                    {it.qtd_apontada}
                                                </td>
                                                <td className="p-3 text-right font-mono font-black text-indigo-700">
                                                    {it.saldo_faltante > 0.001 ? `+${it.saldo_faltante} un` : '0 un'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    {it.status === 'CONCLUIDO' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            100% OK
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                            <Clock className="w-3 h-3 text-amber-600" />
                                                            Pendente
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Confirmação de Execução */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-scale-in">
                        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <Play className="w-5 h-5 fill-current" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-slate-900">Confirmar Apontamento em Lote</h3>
                                <p className="text-xs text-slate-500">Esta ação irá gravar os registros no banco de produção do SINCO.</p>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-semibold">Total de Operações Selecionadas:</span>
                                <span className="font-bold text-slate-900">{selectedItemsKeys.size} operações</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-semibold">Total de Peças a Gravar:</span>
                                <span className="font-black text-indigo-700">{totalSelectedPecas} peças</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-semibold">Usuário Registrado:</span>
                                <span className="font-bold text-slate-800">{usuarioApontamento}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-500 font-semibold">Regra de Quantidade:</span>
                                <span className="font-bold text-slate-800">
                                    {modoApontamento === 'FALTANTE_TOTAL' ? 'Zerar Saldo Total da OP' : 'Espelhar Protheus (C2_QUJE)'}
                                </span>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                            * Os apontamentos serão gravados com status de conferência aprovado (OK) e refletirão instantaneamente nas filas de produção e nos relatórios.
                        </p>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={loadingExecucao}
                                className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmarExecucao}
                                disabled={loadingExecucao}
                                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all disabled:opacity-50"
                            >
                                {loadingExecucao ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Gravando Apontamentos...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Confirmar e Gravar no Banco
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
