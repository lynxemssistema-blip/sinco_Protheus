import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Link as LinkIcon, Search, Loader2, X, AlertTriangle,
    Plus, Trash2, CheckCircle, ChevronRight, PlusCircle, Edit3
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../services/api';

export default function SetoresRecursos() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const [setores, setSetores]               = useState([]);
    const [selectedSetor, setSelectedSetor]   = useState(null);
    const [recursos, setRecursos]             = useState([]);
    const [loadingSetores, setLoadingSetores] = useState(true);
    const [loadingRecursos, setLoadingRecursos] = useState(false);

    // Modo de adição: 'search' (busca Protheus) | 'manual' (digita código)
    const [addMode, setAddMode]               = useState('search');

    // Busca Protheus
    const [query, setQuery]                   = useState('');
    const [searchResults, setSearchResults]   = useState([]);
    const [searching, setSearching]           = useState(false);
    const debounceRef                         = useRef(null);

    // Entrada manual
    const [manualCodigo, setManualCodigo]     = useState('');
    const [manualNome, setManualNome]         = useState('');
    const [addingManual, setAddingManual]     = useState(false);

    // ── Carrega setores ────────────────────────────────────────────────────────
    const loadSetores = useCallback(async () => {
        setLoadingSetores(true);
        try {
            const res = await api.get('/pcp-setores');
            setSetores(res.data);
            const paramId = searchParams.get('setor');
            if (paramId) {
                const found = res.data.find(s => String(s.id) === paramId);
                if (found) setSelectedSetor(found);
            }
        } catch {
            toast.error('Erro ao carregar setores.');
        } finally {
            setLoadingSetores(false);
        }
    }, []);

    // ── Carrega recursos do setor ──────────────────────────────────────────────
    const loadRecursos = useCallback(async (setorId) => {
        setLoadingRecursos(true);
        try {
            const res = await api.get(`/pcp-setores/recursos/${setorId}`);
            setRecursos(res.data);
        } catch {
            toast.error('Erro ao carregar recursos.');
        } finally {
            setLoadingRecursos(false);
        }
    }, []);

    useEffect(() => { loadSetores(); }, [loadSetores]);
    useEffect(() => {
        if (selectedSetor) {
            loadRecursos(selectedSetor.id);
            setQuery('');
            setSearchResults([]);
            setManualCodigo('');
            setManualNome('');
        }
    }, [selectedSetor, loadRecursos]);

    // ── Busca Protheus com debounce ────────────────────────────────────────────
    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (!query.trim() || !selectedSetor) { setSearchResults([]); return; }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get(`/pcp-setores/protheus-recursos?q=${encodeURIComponent(query)}`);
                setSearchResults(res.data);
            } catch {
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
    }, [query, selectedSetor]);

    // ── Adiciona via busca ─────────────────────────────────────────────────────
    const handleAddFromSearch = async (recurso) => {
        try {
            await api.post('/pcp-setores/recursos', {
                setor_id:      selectedSetor.id,
                recurso_codigo: recurso.codigo,
                recurso_nome:   recurso.nome || recurso.codigo,
            });
            toast.success(`Recurso ${recurso.codigo} adicionado ao setor "${selectedSetor.nome}".`);
            loadRecursos(selectedSetor.id);
            loadSetores();
            setSearchResults(prev => prev.filter(r => r.codigo !== recurso.codigo));
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao adicionar recurso.');
        }
    };

    // ── Adiciona manualmente ───────────────────────────────────────────────────
    const handleAddManual = async (e) => {
        e.preventDefault();
        const cod = manualCodigo.trim().toUpperCase();
        if (!cod) { toast.warning('Informe o código do recurso.'); return; }
        setAddingManual(true);
        try {
            await api.post('/pcp-setores/recursos', {
                setor_id:      selectedSetor.id,
                recurso_codigo: cod,
                recurso_nome:   manualNome.trim() || cod,
            });
            toast.success(`Recurso ${cod} adicionado ao setor "${selectedSetor.nome}".`);
            setManualCodigo('');
            setManualNome('');
            loadRecursos(selectedSetor.id);
            loadSetores();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao adicionar recurso.');
        } finally {
            setAddingManual(false);
        }
    };

    // ── Remove recurso ─────────────────────────────────────────────────────────
    const handleRemove = async (recursoId, recurso_codigo) => {
        try {
            await api.delete(`/pcp-setores/recursos/${recursoId}`);
            toast.success(`Recurso ${recurso_codigo} removido.`);
            loadRecursos(selectedSetor.id);
            loadSetores();
        } catch {
            toast.error('Erro ao remover recurso.');
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="bg-slate-50 min-h-screen p-4 md:p-6 font-sans">
            <div className="max-w-6xl mx-auto space-y-5">

                {/* Header */}
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <LinkIcon className="w-5 h-5 text-blue-600" />
                        Recursos por Setor
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Associe máquinas e centros de custo do Protheus a cada setor produtivo
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                    {/* ── Lista de Setores ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3">
                            <h2 className="text-xs font-black text-slate-600 uppercase tracking-widest">Setores</h2>
                        </div>
                        {loadingSetores ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {setores.map(s => (
                                    <button key={s.id} onClick={() => setSelectedSetor(s)}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${selectedSetor?.id === s.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                                    >
                                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.cor }} />
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-semibold text-sm truncate ${selectedSetor?.id === s.id ? 'text-blue-700' : 'text-slate-800'}`}>
                                                {s.nome}
                                            </div>
                                            <div className="text-[11px] text-slate-400">
                                                {s.qtd_recursos} recurso{s.qtd_recursos !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                        {selectedSetor?.id === s.id && (
                                            <ChevronRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                        )}
                                    </button>
                                ))}
                                {setores.length === 0 && (
                                    <div className="py-8 text-center">
                                        <p className="text-sm text-slate-400">Nenhum setor cadastrado.</p>
                                        <button onClick={() => navigate('/pcp/setores')}
                                            className="mt-2 text-xs text-blue-600 hover:underline">
                                            Criar setor →
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Painel Direito ── */}
                    <div className="lg:col-span-2 space-y-4">
                        {!selectedSetor ? (
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
                                <LinkIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                                <p className="font-semibold text-slate-600">Selecione um setor</p>
                                <p className="text-sm text-slate-400 mt-1">Clique em um setor à esquerda para gerenciar seus recursos.</p>
                            </div>
                        ) : (
                            <>
                                {/* Cabeçalho do setor */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: selectedSetor.cor }} />
                                    <div>
                                        <h2 className="font-black text-slate-800">{selectedSetor.nome}</h2>
                                        {selectedSetor.descricao && (
                                            <p className="text-xs text-slate-500">{selectedSetor.descricao}</p>
                                        )}
                                    </div>
                                </div>

                                {/* ── Adicionar Recurso ── */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    {/* Tabs */}
                                    <div className="flex border-b border-slate-200">
                                        <button
                                            onClick={() => setAddMode('search')}
                                            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-colors ${addMode === 'search' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <Search className="w-3.5 h-3.5" />
                                            Buscar no Protheus
                                        </button>
                                        <button
                                            onClick={() => setAddMode('manual')}
                                            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold transition-colors ${addMode === 'manual' ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" />
                                            Digitar código
                                        </button>
                                    </div>

                                    <div className="p-4">
                                        {/* ─ Aba Busca ─ */}
                                        {addMode === 'search' && (
                                            <>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input
                                                        value={query}
                                                        onChange={e => setQuery(e.target.value)}
                                                        placeholder="Buscar por código ou nome (ex: MO0013, Solda...)"
                                                        className="w-full pl-9 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                        autoFocus
                                                    />
                                                    {query && (
                                                        <button onClick={() => { setQuery(''); setSearchResults([]); }}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                            {searching ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" /> : <X className="w-4 h-4" />}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Resultados */}
                                                {searchResults.length > 0 && (
                                                    <div className="mt-3 border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto divide-y divide-slate-100">
                                                        {searchResults.map(r => {
                                                            const jaVinculado = recursos.some(rv => rv.recurso_codigo === r.codigo);
                                                            return (
                                                                <div key={r.codigo}
                                                                    className={`flex items-center gap-3 px-4 py-3 ${jaVinculado ? 'bg-green-50' : 'bg-white hover:bg-slate-50'} transition-colors`}
                                                                >
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono font-black text-sm text-slate-800">{r.codigo}</span>
                                                                            {r.tipo && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{r.tipo}</span>}
                                                                        </div>
                                                                        {r.nome && <p className="text-xs text-slate-500 mt-0.5 truncate">{r.nome}</p>}
                                                                        {jaVinculado && (
                                                                            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-green-700">
                                                                                <CheckCircle className="w-3 h-3" /> Já vinculado a este setor
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    {!jaVinculado && (
                                                                        <button onClick={() => handleAddFromSearch(r)}
                                                                            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0">
                                                                            <Plus className="w-3.5 h-3.5" /> Adicionar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                {query.trim() && !searching && searchResults.length === 0 && (
                                                    <div className="mt-3 p-4 bg-slate-50 rounded-xl text-center">
                                                        <p className="text-sm text-slate-500">Nenhum recurso encontrado no Protheus.</p>
                                                        <button onClick={() => setAddMode('manual')}
                                                            className="mt-2 text-xs text-blue-600 hover:underline font-semibold">
                                                            Digitar o código manualmente →
                                                        </button>
                                                    </div>
                                                )}
                                                {!query.trim() && (
                                                    <p className="text-xs text-slate-400 mt-2">
                                                        Digite para buscar recursos cadastrados no Protheus (tabela SH1).
                                                    </p>
                                                )}
                                            </>
                                        )}

                                        {/* ─ Aba Manual ─ */}
                                        {addMode === 'manual' && (
                                            <form onSubmit={handleAddManual} className="space-y-3">
                                                <p className="text-xs text-slate-500">
                                                    Digite o código do recurso exatamente como está no Protheus (ex: <strong>MO0013</strong>, <strong>MO0003</strong>).
                                                </p>
                                                <div className="flex gap-2">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                            Código do Recurso *
                                                        </label>
                                                        <input
                                                            value={manualCodigo}
                                                            onChange={e => setManualCodigo(e.target.value.toUpperCase())}
                                                            placeholder="Ex: MO0013"
                                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-mono uppercase focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div className="flex-[2]">
                                                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                                            Descrição (opcional)
                                                        </label>
                                                        <input
                                                            value={manualNome}
                                                            onChange={e => setManualNome(e.target.value)}
                                                            placeholder="Ex: Solda MIG"
                                                            className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                                        />
                                                    </div>
                                                </div>
                                                <button type="submit" disabled={addingManual || !manualCodigo.trim()}
                                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors">
                                                    {addingManual ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                                                    Adicionar Recurso
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </div>

                                {/* ── Recursos Vinculados ── */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                            Recursos Vinculados
                                        </h3>
                                        <span className="text-xs text-slate-400">
                                            {recursos.length} recurso{recursos.length !== 1 ? 's' : ''}
                                        </span>
                                    </div>

                                    {loadingRecursos ? (
                                        <div className="flex items-center justify-center py-8">
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        </div>
                                    ) : recursos.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <LinkIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                                            <p className="text-sm text-slate-400">Nenhum recurso vinculado.</p>
                                            <p className="text-xs text-slate-400 mt-1">Use os campos acima para adicionar recursos.</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {recursos.map(r => (
                                                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group">
                                                    <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-mono font-black text-sm text-slate-800">{r.recurso_codigo}</span>
                                                        {r.recurso_nome && r.recurso_nome !== r.recurso_codigo && (
                                                            <span className="text-xs text-slate-500 ml-2">{r.recurso_nome}</span>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => handleRemove(r.id, r.recurso_codigo)}
                                                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Remover recurso"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
