import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { UserMinus, Search, AlertTriangle, CheckCircle, Package } from 'lucide-react';

export default function OffboardingRH() {
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userAssets, setUserAssets] = useState([]);
    const [loadingAssets, setLoadingAssets] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const res = await api.get('/users');
            setUsuarios(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSelectUser = async (user) => {
        setSelectedUser(user);
        try {
            setLoadingAssets(true);
            const res = await api.get(`/sgq/assets/employee/${user.idUsuario}`);
            setUserAssets(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAssets(false);
        }
    };

    const filteredUsers = usuarios.filter(u => 
        u.NomeCompleto && u.NomeCompleto.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-100px)] flex flex-col">
            <div className="flex items-center gap-3 mb-6 flex-shrink-0">
                <div className="bg-red-100 p-3 rounded-lg">
                    <UserMinus className="w-6 h-6 text-red-700" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">RH: Offboarding (Desligamento)</h1>
                    <p className="text-sm text-slate-500">Conferência de ativos e ferramentas sob custódia do colaborador</p>
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Coluna Esquerda: Busca de Funcionários */}
                <div className="w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    <div className="p-4 border-b border-slate-200 bg-slate-50">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Buscar colaborador..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2">
                        {loading ? (
                            <div className="flex justify-center p-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center p-8 text-slate-400">Nenhum colaborador encontrado.</div>
                        ) : (
                            <div className="space-y-1">
                                {filteredUsers.map(u => (
                                    <button
                                        key={u.idUsuario}
                                        onClick={() => handleSelectUser(u)}
                                        className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center justify-between group ${selectedUser?.idUsuario === u.idUsuario ? 'bg-indigo-50 border border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                                    >
                                        <span className={`font-medium ${selectedUser?.idUsuario === u.idUsuario ? 'text-indigo-800' : 'text-slate-700'}`}>
                                            {u.NomeCompleto}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Coluna Direita: Análise de Custódia */}
                <div className="w-2/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                    {!selectedUser ? (
                        <div className="flex-1 flex flex-col justify-center items-center text-slate-400 p-8">
                            <UserMinus className="w-16 h-16 text-slate-200 mb-4" />
                            <p className="text-lg font-medium text-slate-500">Selecione um colaborador para iniciar a análise de offboarding.</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-6 border-b border-slate-200 bg-slate-50">
                                <h2 className="text-xl font-bold text-slate-800">{selectedUser.NomeCompleto}</h2>
                                <p className="text-sm text-slate-500">Relatório de Inventário em Custódia</p>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                                {loadingAssets ? (
                                    <div className="flex justify-center p-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                                    </div>
                                ) : userAssets.length === 0 ? (
                                    <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center shadow-sm">
                                        <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                        <h3 className="text-lg font-bold text-green-800">Liberado pelo SGQ</h3>
                                        <p className="text-green-600 mt-1">O colaborador não possui nenhuma ferramenta ou equipamento sob sua custódia.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start gap-4 shadow-sm">
                                            <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0" />
                                            <div>
                                                <h3 className="text-lg font-bold text-red-800">Atenção: Devoluções Pendentes</h3>
                                                <p className="text-red-700 text-sm mt-1">
                                                    O colaborador possui <strong>{userAssets.length}</strong> ativo(s) alocado(s) em sua(s) caixa(s) de ferramentas.
                                                    O processo de desligamento só deve prosseguir após a devolução e baixa desses itens no módulo SGQ.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2">Listagem de Ferramentas Retidas</h4>
                                            {userAssets.map(a => (
                                                <div key={a.id} className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm flex items-center justify-between">
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-lg">{a.name}</div>
                                                        <div className="text-sm text-slate-500 flex gap-4 mt-1">
                                                            <span className="font-mono bg-slate-100 px-1.5 rounded">{a.patrimonio || 'S/N'}</span>
                                                            <span className="flex items-center gap-1"><Package size={14} /> Caixa: {a.toolbox_name}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
