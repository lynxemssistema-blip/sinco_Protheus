import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Search, Calendar, Package, ArrowRight, Activity, MapPin } from 'lucide-react';

export default function FornecedorPortal() {
    const navigate = useNavigate();
    const [romaneios, setRomaneios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchRomaneios();
    }, []);

    const fetchRomaneios = async () => {
        try {
            const token = localStorage.getItem('@MetalFisa:token');
            const res = await fetch('/api/romaneios/portal/list', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.status === 401) throw new Error('Sessão expirada ou não autenticado. Faça login novamente.');
            if (res.status === 403) throw new Error('Acesso negado. Esta área é restrita a fornecedores cadastrados.');
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Erro ${res.status}: Falha ao buscar romaneios`);
            }

            const data = await res.json();
            setRomaneios(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const filteredRomaneios = romaneios.filter(r => 
        (r.id?.toString().includes(searchTerm)) || 
        (r.observacao_geral?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="p-4 md:p-8 w-full max-w-[1920px] mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Truck className="h-7 w-7 text-blue-600" />
                        Portal do Fornecedor
                    </h1>
                    <p className="text-gray-500 mt-1">Seus romaneios aguardando processamento e industrialização.</p>
                </div>
                
                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar romaneio..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none shadow-sm"
                    />
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start gap-3">
                    <Activity className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-sm">Erro ao carregar dados</h4>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : filteredRomaneios.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center shadow-sm">
                    <div className="mx-auto h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Nenhum romaneio encontrado</h3>
                    <p className="mt-2 text-gray-500">Você não possui romaneios pendentes ou vinculados ao seu perfil.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredRomaneios.map(romaneio => (
                        <div 
                            key={romaneio.id}
                            onClick={() => navigate(`/fornecedor/romaneio/${romaneio.id}`)}
                            className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group flex flex-col"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="bg-blue-50 text-blue-700 font-bold px-3 py-1 rounded-lg text-lg">
                                    #{romaneio.id}
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                                    romaneio.status === 'Enviado' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    romaneio.status === 'Retornando' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    romaneio.status === 'Concluído' ? 'bg-green-50 text-green-700 border-green-200' :
                                    'bg-gray-50 text-gray-700 border-gray-200'
                                }`}>
                                    {romaneio.status || 'Ativo'}
                                </span>
                            </div>

                            <div className="space-y-3 mb-6 flex-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Calendar className="h-4 w-4 text-gray-400" />
                                    <span>
                                        Enviado em: <strong>{new Date(romaneio.data_liberacao).toLocaleDateString('pt-BR')}</strong>
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Package className="h-4 w-4 text-gray-400" />
                                    <span>
                                        <strong>{romaneio.itens_count}</strong> itens no romaneio
                                    </span>
                                </div>

                                {romaneio.observacao_geral && (
                                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 line-clamp-2">
                                        {romaneio.observacao_geral}
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-50 flex items-center justify-between text-blue-600 group-hover:text-blue-700">
                                <span className="text-sm font-medium">Acessar Detalhes</span>
                                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
