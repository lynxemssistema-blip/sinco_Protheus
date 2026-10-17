import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, FolderTree, Table as TableIcon, AlertCircle } from 'lucide-react';
import api from '../services/api';

const PlanoContas = () => {
    const [activeTab, setActiveTab] = useState('tabela'); // 'tabela' or 'estrutural'
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(false);
    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroClasse, setFiltroClasse] = useState('Todas'); // 'Todas', '1', '2'

    const fetchContas = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/financeiro/plano-contas');
            setContas(data);
        } catch (error) {
            console.error('Erro ao buscar plano de contas:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContas();
    }, []);

    // Filtros
    const contasFiltradas = useMemo(() => {
        return contas.filter(conta => {
            const matchTexto = (conta.codigo || '').toLowerCase().includes(filtroTexto.toLowerCase()) ||
                               (conta.descricao || '').toLowerCase().includes(filtroTexto.toLowerCase());
            const matchClasse = filtroClasse === 'Todas' || conta.classe === filtroClasse;
            return matchTexto && matchClasse;
        });
    }, [contas, filtroTexto, filtroClasse]);

    // Arvore
    const arvoreJS = useMemo(() => {
        return contasFiltradas.map(c => {
            const numPontos = (c.codigo.match(/\./g) || []).length;
            return {
                ...c,
                treeLevel: numPontos
            };
        });
    }, [contasFiltradas]);

    const renderChipClasse = (classe) => {
        if (classe === '1') {
            return <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full border border-slate-300">Sintética (1)</span>;
        }
        if (classe === '2') {
            return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full border border-blue-300">Analítica (2)</span>;
        }
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-300">{classe}</span>;
    };

    const renderChipNatureza = (natureza) => {
        if (natureza === '1') {
            return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full border border-red-300">Devedora</span>;
        }
        if (natureza === '2') {
            return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full border border-emerald-300">Credora</span>;
        }
        return <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full border border-gray-300">{natureza}</span>;
    };

    const renderChipStatus = (bloqueio) => {
        if (bloqueio === '1') {
            return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-medium">Bloqueada</span>;
        }
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">Ativa</span>;
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] space-y-4">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Plano de Contas</h1>
                    <p className="text-sm text-slate-500 mt-1">Visão Gerencial e Estrutural das naturezas contábeis (CT1)</p>
                </div>
                <button 
                    onClick={fetchContas}
                    disabled={loading}
                    className="flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar Dados
                </button>
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Pesquisar Conta ou Descrição..." 
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        className="pl-10 pr-4 py-2 w-80 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>
                
                <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setFiltroClasse('Todas')}
                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${filtroClasse === 'Todas' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFiltroClasse('1')}
                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${filtroClasse === '1' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Pai (Sintéticas)
                    </button>
                    <button
                        onClick={() => setFiltroClasse('2')}
                        className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${filtroClasse === '2' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Finais (Analíticas)
                    </button>
                </div>
            </div>

            {/* Conteiner Secundário: Abas e Conteúdo */}
            <div className="flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex-1">
                <div className="flex border-b border-slate-200">
                    <button 
                        onClick={() => setActiveTab('tabela')}
                        className={`flex items-center px-4 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'tabela' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        <TableIcon size={16} className="mr-2" />
                        Visão Tabela Analítica
                    </button>
                    <button 
                        onClick={() => setActiveTab('estrutural')}
                        className={`flex items-center px-4 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === 'estrutural' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        <FolderTree size={16} className="mr-2" />
                        Visão Estrutural (Hierarquia)
                    </button>
                </div>

                <div className="flex-1 overflow-auto bg-slate-50 p-4">
                    {loading && <div className="text-center p-8 text-slate-500">Montando estrutura...</div>}
                    
                    {!loading && contasFiltradas.length === 0 && (
                        <div className="text-center p-12 text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
                            <AlertCircle size={48} className="mx-auto mb-3 opacity-20 text-slate-400" />
                            <p>Nenhuma conta encontrada com os filtros atuais.</p>
                        </div>
                    )}

                    {!loading && contasFiltradas.length > 0 && activeTab === 'tabela' && (
                        <div className="bg-white border text-left border-slate-200 rounded-lg overflow-hidden shrink-0 h-full">
                            <div className="overflow-auto max-h-full">
                                <table className="min-w-full divide-y text-left divide-slate-200">
                                    <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                                        <tr>
                                            <th className="px-6 relative py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Código</th>
                                            <th className="px-6 relative py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descrição da Conta</th>
                                            <th className="px-6 relative py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Classe</th>
                                            <th className="px-6 relative py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Natureza</th>
                                            <th className="px-6 relative py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">N. SPED</th>
                                            <th className="px-6 relative py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-200">
                                        {contasFiltradas.map((conta, idx) => (
                                            <tr key={`${conta.codigo}-${idx}`} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{conta.codigo}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-600">{conta.descricao}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">{renderChipClasse(conta.classe)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">{renderChipNatureza(conta.natureza)}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">{conta.grupo_sped}</td>
                                                <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">{renderChipStatus(conta.bloqueio)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!loading && contasFiltradas.length > 0 && activeTab === 'estrutural' && (
                        <div className="flex flex-col space-y-2 pb-8">
                            {arvoreJS.map((conta, idx) => (<div key={`${conta.codigo}-${idx}`}
                                    style={{ marginLeft: `${conta.treeLevel * 2}rem` }}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                        conta.classe === '1' 
                                        ? 'bg-white border-slate-200 border-l-4 border-l-indigo-500 shadow-sm' 
                                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <div className="flex items-center space-x-3">
                                        <span className={`font-mono text-sm ${conta.classe === '1' ? 'font-bold text-indigo-700' : 'text-slate-600'}`}>
                                            {conta.codigo}
                                        </span>
                                        <span className={`text-sm ${conta.classe === '1' ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                                            {conta.descricao}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        {renderChipClasse(conta.classe)}
                                        {conta.bloqueio === '1' && renderChipStatus(conta.bloqueio)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlanoContas;
