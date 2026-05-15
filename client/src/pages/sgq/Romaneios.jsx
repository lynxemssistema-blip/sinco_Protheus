import React, { useState, useEffect } from 'react';
import { Plus, Eye, Truck, FileCheck2, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import SgqRomaneioForm from '../../components/sgq/SgqRomaneioForm';

export default function SGQRomaneios() {
    const { user } = useAuth();
    const [view, setView] = useState('list'); // list | form
    const [romaneios, setRomaneios] = useState([]);
    const [selectedRomaneioId, setSelectedRomaneioId] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (view === 'list') {
            fetchRomaneios();
        }
    }, [view]);

    const fetchRomaneios = async () => {
        setLoading(true);
        try {
            const res = await api.get('/sgq/romaneios');
            setRomaneios(res.data);
        } catch (err) {
            console.error(err);
            alert('Erro ao carregar romaneios');
        } finally {
            setLoading(false);
        }
    };

    const handleNew = () => {
        setSelectedRomaneioId(null);
        setView('form');
    };

    const handleEdit = (id) => {
        setSelectedRomaneioId(id);
        setView('form');
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir este romaneio inteiro? Isso reverterá os equipamentos para disponíveis.')) return;
        try {
            await api.delete(`/sgq/romaneios/${id}`);
            fetchRomaneios();
        } catch (err) {
            alert('Erro ao excluir romaneio');
        }
    };

    return (
        <div className="space-y-6">
            {view === 'list' && (
                <>
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Truck className="w-6 h-6 text-indigo-600" />
                                Romaneios SGQ
                            </h2>
                            <p className="text-slate-500 text-sm">Controle de envio e retorno individual de equipamentos</p>
                        </div>
                        <button 
                            onClick={handleNew}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 transition"
                        >
                            <Plus className="w-4 h-4" /> Novo Romaneio
                        </button>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-medium">
                                <tr>
                                    <th className="p-4">Número</th>
                                    <th className="p-4">Data Envio</th>
                                    <th className="p-4">Prev. Retorno</th>
                                    <th className="p-4">Fornecedor / Destinatário</th>
                                    <th className="p-4">Responsável</th>
                                    <th className="p-4 text-center">Itens</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading && romaneios.length === 0 ? (
                                    <tr><td colSpan="8" className="p-8 text-center text-slate-400">Carregando...</td></tr>
                                ) : romaneios.length === 0 ? (
                                    <tr><td colSpan="8" className="p-8 text-center text-slate-400">Nenhum romaneio de SGQ encontrado.</td></tr>
                                ) : (
                                    romaneios.map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700">{r.numero}</td>
                                            <td className="p-4">{r.data_envio ? new Date(r.data_envio).toLocaleDateString('pt-BR') : '-'}</td>
                                            <td className="p-4">{r.previsao_retorno ? new Date(r.previsao_retorno).toLocaleDateString('pt-BR') : '-'}</td>
                                            <td className="p-4 font-medium">{r.fornecedor_nome || r.destinatario}</td>
                                            <td className="p-4 text-slate-600">{r.responsavel}</td>
                                            <td className="p-4 text-center font-bold">{r.total_itens}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    r.status === 'aberto' ? 'bg-slate-100 text-slate-800' :
                                                    r.status === 'enviado' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                    {r.status === 'aberto' ? 'Em Edição' : r.status === 'enviado' ? 'Enviado' : 'Concluído'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(r.id)}
                                                    className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition"
                                                    title="Editar / Ver Itens"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(r.id)}
                                                    className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                                                    title="Excluir Romaneio"
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
                </>
            )}

            {view === 'form' && (
                <SgqRomaneioForm 
                    romaneioId={selectedRomaneioId} 
                    onBack={() => setView('list')} 
                    user={user} 
                />
            )}
        </div>
    );
}
