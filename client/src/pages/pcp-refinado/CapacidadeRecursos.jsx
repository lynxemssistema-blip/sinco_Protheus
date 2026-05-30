import React, { useState, useEffect } from 'react';
import { Layers, Save, Search, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../../services/api';

export default function CapacidadeRecursos() {
    const [recursos, setRecursos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [dirtyRows, setDirtyRows] = useState({}); // Track which rows were modified

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/pcp-refinado/recursos');
            setRecursos(res.data || []);
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

    const handleSave = async (recurso) => {
        if (!dirtyRows[recurso.cod_recurso]) return;
        
        setSaving(true);
        try {
            await api.post('/pcp-refinado/recursos', {
                recurso_codigo: recurso.cod_recurso,
                tempo_padrao_minutos: parseFloat(recurso.tempo_padrao_minutos) || 0,
                capacidade_diaria_minutos: parseInt(recurso.capacidade_diaria_minutos) || 0,
                ordem_exibicao: parseInt(recurso.ordem_exibicao) || 0
            });
            
            // Remove from dirty state
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
            await Promise.all(dirtyRecursos.map(r => 
                api.post('/pcp-refinado/recursos', {
                    recurso_codigo: r.cod_recurso,
                    tempo_padrao_minutos: parseFloat(r.tempo_padrao_minutos) || 0,
                    capacidade_diaria_minutos: parseInt(r.capacidade_diaria_minutos) || 0,
                    ordem_exibicao: parseInt(r.ordem_exibicao) || 0
                })
            ));
            
            setDirtyRows({});
            alert('Todas as alterações foram salvas com sucesso!');
        } catch (error) {
            console.error('Erro ao salvar recursos:', error);
            alert('Erro ao salvar as alterações. Verifique sua conexão e tente novamente.');
        } finally {
            setSaving(false);
        }
    };

    const filteredRecursos = recursos.filter(r => 
        r.cod_recurso.toLowerCase().includes(search.toLowerCase()) || 
        r.desc_recurso.toLowerCase().includes(search.toLowerCase())
    );

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
                        <p className="text-sm text-slate-500">Defina o tempo padrão de operação e a capacidade diária por recurso para o cálculo de CRP.</p>
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

            {/* Grid/Table Area */}
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Cód. Recurso</th>
                                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição (Protheus)</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Sequência lógica padrão para exibição/planejamento">Ordem de Exibição</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Tempo consumido por peça/batida nesta operação">Tempo Padrão (Minutos/Peça)</th>
                                <th className="px-6 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider" title="Tempo total disponível deste recurso por dia (ex: 8h = 480min)">Capacidade Diária (Minutos)</th>
                                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {loading && recursos.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                                            <p>Carregando recursos e capacidades do banco de dados...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredRecursos.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        Nenhum recurso encontrado com esse termo.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecursos.map(r => {
                                    const isDirty = dirtyRows[r.cod_recurso];
                                    return (
                                        <tr key={r.cod_recurso} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-slate-700">
                                                {r.cod_recurso}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-600 font-medium">
                                                {r.desc_recurso}
                                            </td>
                                            <td className="px-6 py-3 whitespace-nowrap text-center">
                                                <input 
                                                    type="number"
                                                    step="1"
                                                    min="0"
                                                    className={`w-20 text-center p-1.5 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors ${isDirty ? 'border-amber-400 bg-amber-50' : 'border-slate-300'}`}
                                                    value={r.ordem_exibicao || 0}
                                                    onChange={(e) => handleInputChange(r.cod_recurso, 'ordem_exibicao', e.target.value)}
                                                    onBlur={() => handleSave(r)}
                                                />
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
                                                />
                                                <span className="text-xs text-slate-400 ml-2 w-16 inline-block text-left">
                                                    {(r.capacidade_diaria_minutos / 60).toFixed(1)}h
                                                </span>
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
        </div>
    );
}
