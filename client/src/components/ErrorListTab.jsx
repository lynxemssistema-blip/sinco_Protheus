import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, XCircle, Trash2, Clock, Check } from 'lucide-react';
import api from '../services/api';

export default function ErrorListTab() {
    const [errors, setErrors] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadErrors = async () => {
        setLoading(true);
        try {
            const res = await api.get('/system-errors');
            setErrors(res.data);
        } catch (err) {
            console.error('Erro ao buscar lista de erros', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadErrors();
    }, []);

    const updateStatus = async (id, status) => {
        try {
            await api.put(`/system-errors/${id}/status`, { status });
            loadErrors();
        } catch (err) {
            alert('Erro ao atualizar status.');
        }
    };

    const deleteError = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir permanentemente este registro de erro?')) return;
        try {
            await api.delete(`/system-errors/${id}`);
            loadErrors();
        } catch (err) {
            alert('Erro ao excluir erro.');
        }
    };

    const getStatusBadge = (status) => {
        if (status === 'Resolvido') return <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Resolvido</span>;
        if (status === 'Cancelado') return <span className="bg-slate-100 text-slate-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><XCircle className="w-3 h-3" /> Cancelado</span>;
        return <span className="bg-amber-100 text-amber-800 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1"><Clock className="w-3 h-3" /> Pendente</span>;
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Carregando histórico de erros...</div>;

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-6 border-b border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <ShieldAlert className="w-6 h-6 text-red-500" />
                    Lista de Erros do Sistema
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                    Histórico de exceções interceptadas pela IA. Analise as falhas, resolva os bugs e atualize o status para manter o sistema robusto.
                </p>
            </div>

            {errors.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                    <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <p>Nenhum erro registrado no momento. O sistema está estável!</p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-xs">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-lg">Data</th>
                                <th className="px-6 py-4">Usuário / Rota</th>
                                <th className="px-6 py-4">Detalhes do Erro</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right rounded-tr-lg">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {errors.map(err => (
                                <tr key={err.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {new Date(err.created_at).toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-slate-900">{err.user_name || `ID: ${err.user_id}`}</div>
                                        <div className="text-xs text-slate-500 mt-1 font-mono bg-slate-100 px-1 py-0.5 rounded inline-block">{err.route}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="max-w-md">
                                            <p className="text-sm text-red-600 font-mono bg-red-50 p-2 rounded border border-red-100 overflow-hidden text-ellipsis line-clamp-3">
                                                {err.error_details}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            {getStatusBadge(err.status)}
                                            {err.resolved_at && (
                                                <span className="text-[10px] text-slate-400 mt-1">
                                                    por {err.resolver_name}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right whitespace-nowrap">
                                        <div className="flex justify-end gap-2">
                                            {err.status === 'Pendente' && (
                                                <>
                                                    <button
                                                        onClick={() => updateStatus(err.id, 'Resolvido')}
                                                        title="Marcar como Resolvido"
                                                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => updateStatus(err.id, 'Cancelado')}
                                                        title="Cancelar (Falso Positivo)"
                                                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                                    >
                                                        <XCircle className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                            {err.status !== 'Pendente' && (
                                                <button
                                                    onClick={() => updateStatus(err.id, 'Pendente')}
                                                    title="Reabrir como Pendente"
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                >
                                                    <Clock className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button
                                                onClick={() => deleteError(err.id)}
                                                title="Excluir Registro"
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors ml-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
