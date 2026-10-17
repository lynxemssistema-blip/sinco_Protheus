import React, { useState, useEffect } from 'react';
import { X, Search, Code } from 'lucide-react';
import { getProcessList } from '../services/api';

export default function ProcessLegendModal({ onClose, onSelect }) {
    const [processes, setProcesses] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [sql, setSql] = useState(null);
    const [showSql, setShowSql] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const response = await getProcessList();
                if (response.debug_sql) {
                    setProcesses(Array.isArray(response.data) ? response.data : []);
                    setSql(response.debug_sql);
                } else if (Array.isArray(response)) {
                    setProcesses(response);
                } else {
                    // Fallback: try to find an array in data property or default to empty
                    setProcesses(Array.isArray(response.data) ? response.data : []);
                }
            } catch (err) {
                console.error(err);
                alert('Erro ao carregar processos');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const filtered = (Array.isArray(processes) ? processes : []).filter(p =>
        (p.codigo || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.descricao || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="font-bold text-lg text-slate-800">Legenda de Processos</h3>
                    <div className="flex items-center gap-1">
                        {sql && (
                            <button onClick={() => setShowSql(!showSql)} className="p-2 hover:bg-slate-200 rounded-full transition-colors" title="Ver SQL">
                                <Code className="w-5 h-5 text-slate-500" />
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>
                </div>

                {showSql && sql && (
                    <div className="p-4 bg-slate-900 text-green-400 text-xs font-mono overflow-x-auto border-b">
                        <pre>{sql}</pre>
                    </div>
                )}

                <div className="p-4 border-b bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Pesquisar código ou descrição..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <div className="overflow-y-auto p-4 flex-1">
                    {loading ? (
                        <div className="text-center p-8 text-slate-500">Carregando processos...</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-700 font-bold sticky top-0">
                                <tr>
                                    <th className="p-2 border-b">Código</th>
                                    <th className="p-2 border-b">Descrição</th>
                                    <th className="p-2 border-b text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filtered.map((p, idx) => (
                                    <tr key={`${p.codigo}-${idx}`} className="hover:bg-blue-50 transition-colors group cursor-pointer"
                                        onClick={() => onSelect(p.codigo)}>
                                        <td className="p-2 font-mono font-bold text-blue-700">{p.codigo}</td>
                                        <td className="p-2 text-slate-700">{p.descricao || <span className="text-slate-400 italic">Sem descrição</span>}</td>
                                        <td className="p-2 text-right">
                                            <button className="text-xs bg-white border border-slate-300 px-2 py-1 rounded shadow-sm group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all opacity-0 group-hover:opacity-100">
                                                Selecionar
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan="3" className="p-8 text-center text-slate-500">Nenhum processo encontrado.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-3 border-t bg-slate-50 text-xs text-slate-500 text-center rounded-b-xl">
                    Clique em um item para filtrar no painel
                </div>
            </div>
        </div>
    );
}
