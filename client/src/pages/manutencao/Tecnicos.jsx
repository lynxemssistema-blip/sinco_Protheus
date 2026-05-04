import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, AlertCircle, Search } from 'lucide-react';
import api from '../../services/api';

const Tecnicos = () => {
    const [tecnicos, setTecnicos] = useState([]);
    const [usuariosDisponiveis, setUsuariosDisponiveis] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [formData, setFormData] = useState({
        id_usuario: '',
        especialidade: 'GERAL'
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [resTecnicos, resUsuarios] = await Promise.all([
                api.get('/manutencao/tecnicos'),
                api.get('/manutencao/usuarios_disponiveis')
            ]);
            setTecnicos(resTecnicos.data);
            setUsuariosDisponiveis(resUsuarios.data);
        } catch (error) {
            console.error("Erro ao buscar dados:", error);
            alert("Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.id_usuario) {
            alert("Selecione um usuário para ser técnico.");
            return;
        }

        try {
            await api.post('/manutencao/tecnicos', formData);
            setIsModalOpen(false);
            setFormData({ id_usuario: '', especialidade: 'GERAL' });
            fetchData();
        } catch (error) {
            console.error("Erro ao salvar técnico:", error);
            alert("Erro ao cadastrar técnico.");
        }
    };

    const handleRemove = async (id) => {
        if (!window.confirm("Deseja realmente remover este técnico?")) return;
        try {
            await api.delete(`/manutencao/tecnicos/${id}`);
            fetchData();
        } catch (error) {
            console.error("Erro ao remover técnico:", error);
            alert("Erro ao remover técnico.");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Users className="text-indigo-600" /> Técnicos de Manutenção
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Gerencie a equipe responsável pela execução das ordens de manutenção.</p>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={20} /> Cadastrar Técnico
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div></div>
            ) : tecnicos.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-medium text-slate-700 mb-1">Nenhum técnico cadastrado</h3>
                    <p className="text-slate-500 mb-4">Adicione membros da equipe para que possam executar Ordens de Manutenção.</p>
                    <button onClick={() => setIsModalOpen(true)} className="text-indigo-600 font-semibold hover:underline">
                        Cadastrar primeiro técnico
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="p-4 text-sm font-semibold text-slate-600">Nome do Técnico</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Função Base</th>
                                <th className="p-4 text-sm font-semibold text-slate-600">Especialidade (Manutenção)</th>
                                <th className="p-4 text-sm font-semibold text-slate-600 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {tecnicos.map((t) => (
                                <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            {t.fotoUsuario ? (
                                                <img 
                                                    src={t.fotoUsuario} 
                                                    alt={t.NomeCompleto} 
                                                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold border border-indigo-200">
                                                    {t.NomeCompleto.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="font-semibold text-slate-800">{t.NomeCompleto}</div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-600 text-sm">{t.Funcao || 'N/A'}</td>
                                    <td className="p-4">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {t.especialidade}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button 
                                            onClick={() => handleRemove(t.id)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                                            title="Remover Técnico"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">Cadastrar Técnico</h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        
                        <div className="p-6">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Selecionar Usuário *</label>
                                    <select 
                                        required
                                        value={formData.id_usuario}
                                        onChange={e => setFormData({...formData, id_usuario: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="">Selecione um usuário do sistema...</option>
                                        {usuariosDisponiveis.map(u => (
                                            <option key={u.idUsuario} value={u.idUsuario}>
                                                {u.NomeCompleto} {u.Funcao ? `(${u.Funcao})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Especialidade na Manutenção</label>
                                    <select 
                                        value={formData.especialidade}
                                        onChange={e => setFormData({...formData, especialidade: e.target.value})}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 bg-white"
                                    >
                                        <option value="GERAL">Geral (Mecânica e Elétrica)</option>
                                        <option value="MECANICA">Mecânica</option>
                                        <option value="ELETRICA">Elétrica / Eletrônica</option>
                                        <option value="PREDIAL">Predial</option>
                                        <option value="T.I.">Tecnologia da Informação (T.I.)</option>
                                    </select>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsModalOpen(false)}
                                        className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                                    >
                                        Cadastrar Técnico
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tecnicos;
