import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layers, Save, Search, RefreshCw, AlertTriangle, ChevronUp, ChevronDown, Users, GripVertical } from 'lucide-react';
import api from '../../services/api';

const sortRecursos = (a, b) => (Number(a.ordem_exibicao) || 0) - (Number(b.ordem_exibicao) || 0) || a.cod_recurso.localeCompare(b.cod_recurso);

export default function CapacidadeRecursos() {
    const [recursos, setRecursos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [dirtyRows, setDirtyRows] = useState({});

    // Drag & Drop state
    const dragItem = useRef(null);       // index being dragged (in filteredRecursos)
    const dragOverItem = useRef(null);   // index being hovered
    const [dragOverIdx, setDragOverIdx] = useState(null);
    const [draggingIdx, setDraggingIdx] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/pcp-refinado/recursos');
            setRecursos((res.data || []).slice().sort(sortRecursos));
            setDirtyRows({});
        } catch (error) {
            console.error('Erro ao buscar recursos:', error);
            alert('Erro ao buscar recursos de capacidade.');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (codigo, field, value) => {
        setRecursos(prev => prev.map(r =>
            r.cod_recurso === codigo ? { ...r, [field]: value } : r
        ));
        setDirtyRows(prev => ({ ...prev, [codigo]: true }));
    };

    const persistRecurso = (recurso) => api.post('/pcp-refinado/recursos', {
        recurso_codigo: recurso.cod_recurso,
        tempo_padrao_minutos: parseFloat(recurso.tempo_padrao_minutos) || 0,
        capacidade_diaria_minutos: parseInt(recurso.capacidade_diaria_minutos) || 0,
        ordem_exibicao: Number(recurso.ordem_exibicao) || 0,
        grupo_paralelo: (recurso.grupo_paralelo || '').trim() || null,
        taxa_setup_min: parseFloat(recurso.taxa_setup_min) || 0,
        taxa_padrao_min: parseFloat(recurso.taxa_padrao_min) || 0
    });

    const handleSave = async (recurso) => {
        if (!dirtyRows[recurso.cod_recurso]) return;

        setSaving(true);
        try {
            await persistRecurso(recurso);
            setDirtyRows(prev => {
                const next = { ...prev };
                delete next[recurso.cod_recurso];
                return next;
            });
        } catch (error) {
            console.error('Erro ao salvar recurso:', error);
            alert(`Erro ao salvar o recurso ${recurso.cod_recurso}`);
        } finally {
            setSaving(false);
        }
    };

    const saveAllDirty = async () => {
        const dirtyRecursos = recursos.filter(r => dirtyRows[r.cod_recurso]);
        if (dirtyRecursos.length === 0) return;

        setSaving(true);
        try {
            await Promise.all(dirtyRecursos.map(persistRecurso));
            setDirtyRows({});
            alert('Todas as alterações foram salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar recursos:', error);
            alert('Erro ao salvar as alterações. Verifique sua conexão e tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    // ─── Reordenação por botões ▲▼ ──────────────────────────────────────────
    const applyReorder = useCallback(async (renumbered) => {
        setRecursos(renumbered);
        setSaving(true);
        try {
            await Promise.all(renumbered.map(persistRecurso));
        } catch (error) {
            console.error('Erro ao reordenar recursos:', error);
            alert('Erro ao salvar a nova ordem.');
        } finally {
            setSaving(false);
        }
    }, []); // eslint-disable-line

    const moveResource = async (codigo, direction) => {
        const sorted = [...recursos].sort(sortRecursos);
        const idx = sorted.findIndex(r => r.cod_recurso === codigo);
        const targetIdx = idx + direction;
        if (idx < 0 || targetIdx < 0 || targetIdx >= sorted.length) return;

        [sorted[idx], sorted[targetIdx]] = [sorted[targetIdx], sorted[idx]];
        const renumbered = sorted.map((r, i) => ({ ...r, ordem_exibicao: i }));
        await applyReorder(renumbered);
    };

    // ─── Drag & Drop handlers ────────────────────────────────────────────────
    const reorderDisabled = search.trim() !== '';

    const handleDragStart = (e, globalIdx) => {
        if (reorderDisabled || saving) { e.preventDefault(); return; }
        dragItem.current = globalIdx;
        setDraggingIdx(globalIdx);
        e.dataTransfer.effectAllowed = 'move';
        // phantom transparent image so the row itself stays visible
        const ghost = document.createElement('div');
        ghost.style.position = 'absolute';
        ghost.style.top = '-9999px';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, 0, 0);
        setTimeout(() => document.body.removeChild(ghost), 0);
    };

    const handleDragEnter = (globalIdx) => {
        if (dragItem.current === null || reorderDisabled) return;
        dragOverItem.current = globalIdx;
        setDragOverIdx(globalIdx);
    };

    const handleDragEnd = async () => {
        const from = dragItem.current;
        const to = dragOverItem.current;

        setDraggingIdx(null);
        setDragOverIdx(null);
        dragItem.current = null;
        dragOverItem.current = null;

        if (from === null || to === null || from === to) return;

        // Work on the globally-sorted list, moving by their global position index
        const sorted = [...recursos].sort(sortRecursos);
        const moved = sorted.splice(from, 1)[0];
        sorted.splice(to, 0, moved);
        const renumbered = sorted.map((r, i) => ({ ...r, ordem_exibicao: i }));
        await applyReorder(renumbered);
    };

    // ─── Filtered view ───────────────────────────────────────────────────────
    const filteredRecursos = recursos.filter(r =>
        r.cod_recurso.toLowerCase().includes(search.toLowerCase()) ||
        r.desc_recurso.toLowerCase().includes(search.toLowerCase())
    );

    // Build a lookup: cod_recurso → global position (1-based) in sorted list
    const globalOrder = [...recursos].sort(sortRecursos);
    const positionMap = {};
    globalOrder.forEach((r, i) => { positionMap[r.cod_recurso] = i; });

    const gruposExistentes = [...new Set(recursos.map(r => (r.grupo_paralelo || '').trim()).filter(Boolean))].sort();

    const hasUnsavedChanges = Object.keys(dirtyRows).length > 0;

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                        <Layers className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-800">Cadastro de Capacidade e Tempos (PCP Refinado)</h1>
                        <p className="text-sm text-slate-500">Defina o tempo padrão, capacidade diária, ordem padrão e grupos paralelos por recurso.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Buscar recurso..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm w-64 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Recarregar"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={saveAllDirty}
                        disabled={!hasUnsavedChanges || saving}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            hasUnsavedChanges && !saving
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>

            {/* Warning if unsaved changes */}
            {hasUnsavedChanges && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center gap-2 text-amber-700 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Você possui alterações não salvas. Lembre-se de clicar em "Salvar Alterações" antes de sair da página.
                </div>
            )}

            <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-2 flex items-center gap-2 text-indigo-700 text-xs font-medium">
                <Users className="w-3.5 h-3.5 shrink-0" />
                A ordem definida aqui é a sequência padrão usada em todo o app (ex: base do Planejamento Sequencial quando a OP ainda não tem ordem própria salva).
                Recursos com o mesmo "Grupo Paralelo" são automaticamente unidos (mesma janela de datas) quando aparecem adjacentes na sequência.
                {!reorderDisabled && <span className="ml-2 text-indigo-400">• Arraste pelo ícone <span className="font-bold">⠿</span> para reordenar.</span>}
                {reorderDisabled && <span className="ml-2 text-amber-500">• Limpe a busca para reordenar.</span>}
            </div>

            {/* Grid/Table Area */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-3 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider w-24" title="Ordem padrão usada como base em todo o app">Ordem</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cód. Recurso</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição (Protheus)</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Tempo consumido por peça/batida nesta operação">Tempo Padrão (Minutos/Peça)</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Tempo total disponível deste recurso por dia (ex: 8h = 480min)">Capacidade Diária (Minutos)</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Custo por minuto de setup desta operação">Taxa Setup (R$/min)</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Custo por minuto de tempo padrão (produção) desta operação">Taxa Padrão (R$/min)</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" title="Recursos com o mesmo grupo compartilham automaticamente a mesma janela de datas no Planejamento Sequencial">Grupo Paralelo</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {loading && recursos.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                                            <p>Carregando recursos e capacidades do banco de dados...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecursos.length === 0 ? (
                                <tr>
                                    <td colSpan="9" className="px-6 py-12 text-center text-slate-500">
                                        Nenhum recurso encontrado com esse termo.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecursos.map((r, filteredIdx) => {
                                    const isDirty = dirtyRows[r.cod_recurso];
                                    // globalIdx = position in the full sorted list (used by drag logic)
                                    const globalIdx = positionMap[r.cod_recurso];
                                    const displayNumber = globalIdx + 1; // 1-based visual index

                                    const isBeingDragged = draggingIdx === globalIdx;
                                    const isDragOver = dragOverIdx === globalIdx && draggingIdx !== globalIdx;

                                    return (
                                        <tr
                                            key={r.cod_recurso}
                                            draggable={!reorderDisabled && !saving}
                                            onDragStart={(e) => handleDragStart(e, globalIdx)}
                                            onDragEnter={() => handleDragEnter(globalIdx)}
                                            onDragOver={(e) => e.preventDefault()}
                                            onDragEnd={handleDragEnd}
                                            style={{
                                                opacity: isBeingDragged ? 0.45 : 1,
                                                transition: 'opacity 0.15s, background-color 0.15s, box-shadow 0.15s',
                                                boxShadow: isDragOver ? 'inset 0 2px 0 #6366f1, inset 0 -1px 0 #e0e7ff' : undefined,
                                                backgroundColor: isDragOver ? '#eef2ff' : isBeingDragged ? '#f8fafc' : undefined,
                                                cursor: reorderDisabled || saving ? 'default' : 'grab',
                                            }}
                                            className="hover:bg-slate-50 transition-colors group"
                                        >
                                            {/* ── Coluna Ordem: índice + drag handle + botões ▲▼ ── */}
                                            <td className="px-3 py-3 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {/* Drag handle */}
                                                    <span
                                                        title={reorderDisabled ? 'Limpe a busca para reordenar' : 'Arrastar para reordenar'}
                                                        className={`transition-colors ${
                                                            reorderDisabled || saving
                                                                ? 'text-slate-200 cursor-not-allowed'
                                                                : 'text-slate-300 hover:text-indigo-500 cursor-grab active:cursor-grabbing'
                                                        }`}
                                                    >
                                                        <GripVertical className="w-3.5 h-3.5" />
                                                    </span>

                                                    {/* Numbered badge */}
                                                    <span
                                                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold select-none ${
                                                            isDragOver
                                                                ? 'bg-indigo-500 text-white'
                                                                : isBeingDragged
                                                                    ? 'bg-indigo-200 text-indigo-700'
                                                                    : 'bg-slate-100 text-slate-500'
                                                        }`}
                                                    >
                                                        {displayNumber}
                                                    </span>

                                                    {/* Arrow buttons */}
                                                    <div className="flex flex-col">
                                                        <button
                                                            onClick={() => moveResource(r.cod_recurso, -1)}
                                                            disabled={reorderDisabled || saving || globalIdx === 0}
                                                            title={reorderDisabled ? 'Limpe a busca para reordenar' : 'Mover para cima'}
                                                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed rounded leading-none"
                                                        >
                                                            <ChevronUp className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => moveResource(r.cod_recurso, 1)}
                                                            disabled={reorderDisabled || saving || globalIdx === recursos.length - 1}
                                                            title={reorderDisabled ? 'Limpe a busca para reordenar' : 'Mover para baixo'}
                                                            className="p-0.5 text-slate-400 hover:text-indigo-600 disabled:opacity-20 disabled:cursor-not-allowed rounded leading-none"
                                                        >
                                                            <ChevronDown className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-slate-700">
                                                {r.cod_recurso}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                                                {r.desc_recurso}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center">
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    min="0"
                                                    className={`w-28 text-center p-1.5 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                                    value={r.tempo_padrao_minutos}
                                                    onChange={(e) => handleInputChange(r.cod_recurso, 'tempo_padrao_minutos', e.target.value)}
                                                    onBlur={() => handleSave(r)}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center">
                                                <input
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    className={`w-28 text-center p-1.5 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                                    value={r.capacidade_diaria_minutos}
                                                    onChange={(e) => handleInputChange(r.cod_recurso, 'capacidade_diaria_minutos', e.target.value)}
                                                    onBlur={() => handleSave(r)}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                                <span className="text-xs text-slate-400 ml-2 w-16 inline-block text-left">
                                                    {(r.capacidade_diaria_minutos / 60).toFixed(1)}h
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className={`w-24 text-center p-1.5 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                                    value={r.taxa_setup_min}
                                                    onChange={(e) => handleInputChange(r.cod_recurso, 'taxa_setup_min', e.target.value)}
                                                    onBlur={() => handleSave(r)}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className={`w-24 text-center p-1.5 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                                    value={r.taxa_padrao_min}
                                                    onChange={(e) => handleInputChange(r.cod_recurso, 'taxa_padrao_min', e.target.value)}
                                                    onBlur={() => handleSave(r)}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap">
                                                <input
                                                    type="text"
                                                    list="grupos-paralelos-existentes"
                                                    placeholder="Sem grupo"
                                                    className={`w-40 p-1.5 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                                    value={r.grupo_paralelo || ''}
                                                    onChange={(e) => handleInputChange(r.cod_recurso, 'grupo_paralelo', e.target.value)}
                                                    onBlur={() => handleSave(r)}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm">
                                                {isDirty ? (
                                                    <span className="text-amber-500 font-medium flex items-center justify-end gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                                                        Não Salvo
                                                    </span>
                                                ) : r.tempo_padrao_minutos > 0 || r.capacidade_diaria_minutos > 0 ? (
                                                    <span className="text-emerald-500 font-medium flex items-center justify-end gap-1">
                                                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                        Configurado
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 font-medium">Padrão</span>
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
            <datalist id="grupos-paralelos-existentes">
                {gruposExistentes.map(g => <option key={g} value={g} />)}
            </datalist>
        </div>
    );
}
