import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, FolderTree, AlertCircle, Calendar, Download, Eye, Lock } from 'lucide-react';
import CompanyFilter from '../../components/CompanyFilter';
import api from '../../services/api';
import { format, startOfYear, endOfMonth } from 'date-fns';
import { useAuth } from '../../contexts/AuthContext';

const Balancete = () => {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    // Filter State
    const [dataInicio, setDataInicio] = useState(format(startOfYear(new Date()), 'yyyy-MM-dd'));
    const [dataFim, setDataFim] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    const [filtroTexto, setFiltroTexto] = useState('');
    const [filial, setFilial] = useState('010');
    const [selectedFiliais, setSelectedFiliais] = useState([]);

    // Data State
    const [contas, setContas] = useState([]);
    const [loading, setLoading] = useState(false);

    // Razonete State
    const [razoneteModalOpen, setRazoneteModalOpen] = useState(false);
    const [razoneteConta, setRazoneteConta] = useState(null);
    const [razonetes, setRazonetes] = useState([]);
    const [loadingRazonete, setLoadingRazonete] = useState(false);

    const fetchBalancete = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/financeiro/balancete', {
                params: { 
                    data_inicio: dataInicio, 
                    data_fim: dataFim, 
                    filial,
                    filiais: selectedFiliais.join(',')
                }
            });
            setContas(data);
        } catch (error) {
            console.error('Erro ao buscar balancete:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalancete();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFiliais]);

    // Formatter
    const formatCurrency = (value) => {
        if (!value) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    };

    const formatDateStr = (yyyymmdd) => {
        if (!yyyymmdd || yyyymmdd.length !== 8) return yyyymmdd;
        return `${yyyymmdd.substring(6, 8)}/${yyyymmdd.substring(4, 6)}/${yyyymmdd.substring(0, 4)}`;
    };

    // Calculate rolled up balances and filter
    const contasProcessadas = useMemo(() => {
        const analiticas = contas.filter(c => String(c.classe) === '2');

        let calculadas = contas.map(conta => {
            let saldoExibicao = conta.saldo_atual || 0;
            const prefix = (conta.codigo || '').trim();

            if (String(conta.classe) === '1') {
                const sumOfChildren = analiticas
                    .filter(a => (a.codigo || '').startsWith(prefix) && (a.codigo || '').trim() !== prefix)
                    .reduce((acc, a) => acc + (a.saldo_atual || 0), 0);
                
                saldoExibicao = sumOfChildren;
            }

            // Estimate tree level by counting dots or just string length / digit pairs 
            // In many protheus, dots are used. If not, length/2 or length/3 could be a proxy, but we'll stick to a simple left margin.
            const levelByDots = (prefix.match(/\./g) || []).length;
            const levelByLength = prefix.length > 0 ? Math.floor(prefix.length / 2) : 0;
            const treeLevel = prefix.includes('.') ? levelByDots : levelByLength;

            return {
                ...conta,
                saldoExibicao,
                treeLevel
            };
        });

        // Aplicar filtro de texto
        if (filtroTexto) {
            const lowerFilter = filtroTexto.toLowerCase();
            calculadas = calculadas.filter(c => 
                (c.codigo || '').toLowerCase().includes(lowerFilter) ||
                (c.descricao || '').toLowerCase().includes(lowerFilter)
            );
        }

        return calculadas;
    }, [contas, filtroTexto]);

    const handleOpenRazonete = async (conta) => {
        setRazoneteConta(conta);
        setRazoneteModalOpen(true);
        setLoadingRazonete(true);
        try {
            const { data } = await api.get('/financeiro/razonete', {
                params: { 
                    conta: conta.codigo, 
                    data_inicio: dataInicio, 
                    data_fim: dataFim, 
                    filial,
                    filiais: selectedFiliais.join(',')
                }
            });
            setRazonetes(data);
        } catch (error) {
            console.error('Erro ao buscar razonete:', error);
            setRazonetes([]);
        } finally {
            setLoadingRazonete(false);
        }
    };

    if (!canViewValues) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-80px)] p-8 text-center">
                <Lock className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Acesso Restrito</h2>
                <p className="text-sm text-gray-500 max-w-md">Você não possui a permissão <strong>valores_financeiros</strong> necessária para visualizar o Balancete Dinâmico.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] space-y-4">
            {/* Header & Filtros */}
            <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-800">Balancete Dinâmico</h1>
                        <p className="text-sm text-slate-500 mt-1">Plano de Contas integrado com Saldos da Movimentação (CT1 + CT2)</p>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 items-end">
                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Empresas</label>
                        <CompanyFilter 
                            selectedFiliais={selectedFiliais} 
                            onChange={setSelectedFiliais} 
                            defaultAll={true} 
                        />
                    </div>
                    
                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Data Início</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                            />
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Data Fim</label>
                        <div className="relative">
                            <input
                                type="date"
                                className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={dataFim}
                                onChange={(e) => setDataFim(e.target.value)}
                            />
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        </div>
                    </div>

                    <div className="flex flex-col flex-1 min-w-[200px]">
                        <label className="text-xs font-semibold text-slate-600 mb-1">Busca Rápida</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filtrar por Conta ou Descrição..."
                                value={filtroTexto}
                                onChange={(e) => setFiltroTexto(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <button
                        onClick={fetchBalancete}
                        disabled={loading}
                        className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                        {loading ? 'Calculando...' : 'Processar Saldos'}
                    </button>
                    
                    <button
                        className="flex items-center px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors"
                        title="Exportar para CSV (Em Breve)"
                        onClick={() => alert("Função em desenvolvimento.")}
                    >
                        <Download size={18} className="mr-2" />
                        Exportar
                    </button>
                </div>
            </div>

            {/* Conteúdo da Tabela */}
            <div className="bg-white border text-left border-slate-200 rounded-lg overflow-hidden flex-1 shadow-sm flex flex-col relative">
                {loading && (
                    <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex items-center justify-center">
                         <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                            <span className="text-sm font-semibold text-slate-600">Calculando Estrutura e Saldos...</span>
                        </div>
                    </div>
                )}
                
                {contasProcessadas.length === 0 && !loading ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
                        <FolderTree size={48} className="mb-4 opacity-20 text-slate-400" />
                        <p className="text-lg">Nenhum registro encontrado no período.</p>
                        <p className="text-sm">Verifique os filtros de datas.</p>
                    </div>
                ) : (
                    <div className="overflow-auto flex-1 h-full relative">
                        <table className="min-w-full divide-y text-left divide-slate-200 border-b">
                            <thead className="bg-slate-50 sticky top-0 shadow-sm z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[25%]">Conta Contábil</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[40%]">Descrição</th>
                                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Saldo (D-C)</th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider w-24">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {contasProcessadas.map((conta) => {
                                    const isSintetica = String(conta.classe) === '1';
                                    const temSaldo = conta.saldoExibicao !== 0;
                                    const valorClasseStr = conta.saldoExibicao >= 0 ? 'text-blue-700' : 'text-red-600';
                                    const bgHoverStr = isSintetica ? 'hover:bg-blue-50' : 'hover:bg-slate-50';
                                    
                                    // Visual indent logic based on tree level
                                    let indentStyle = { paddingLeft: `${1.5 + (conta.treeLevel * 1)}rem` };

                                    return (
                                        <tr key={conta.codigo} className={`${isSintetica ? 'bg-slate-50/50 border-t border-slate-200' : ''} transition-colors ${bgHoverStr}`}>
                                            <td className="py-2.5 pr-6 whitespace-nowrap text-sm text-slate-900 border-l-[3px] border-l-transparent" style={{...indentStyle, borderLeftColor: isSintetica ? '#3b82f6' : 'transparent'}}>
                                                <span className={`${isSintetica ? 'font-bold' : 'font-mono text-slate-600'}`}>{conta.codigo}</span>
                                            </td>
                                            <td className="px-6 py-2.5 text-sm text-slate-700">
                                                <span className={`${isSintetica ? 'font-bold tracking-tight text-slate-900' : ''}`}>{conta.descricao}</span>
                                            </td>
                                            <td className={`px-6 py-2.5 whitespace-nowrap text-right text-sm font-semibold tracking-tight ${valorClasseStr} ${!temSaldo ? 'opacity-40 font-normal grayscale' : ''}`}>
                                                {formatCurrency(conta.saldoExibicao)}
                                            </td>
                                            <td className="px-6 py-2.5 whitespace-nowrap text-center text-sm font-medium">
                                                {!isSintetica && temSaldo && (
                                                    <button 
                                                        onClick={() => handleOpenRazonete(conta)}
                                                        className="inline-flex items-center justify-center p-1.5 text-slate-400 bg-white border border-slate-200 shadow-sm rounded-md hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
                                                        title="Ver Razonete"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                )}
                                                {isSintetica && (
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Sintética</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal Razonete */}
            {razoneteModalOpen && razoneteConta && (
                <div className="fixed inset-0 z-[999] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        {/* Background overlay */}
                        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => setRazoneteModalOpen(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
                        
                        {/* Modal Panel */}
                        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle w-full sm:max-w-5xl">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-200">
                                <div className="sm:flex sm:items-start justify-between">
                                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                                        <h3 className="text-xl leading-6 font-bold text-slate-900" id="modal-title">
                                            Razonete de Movimentação (CT2)
                                        </h3>
                                        <div className="mt-2 flex flex-col sm:flex-row sm:items-center text-sm text-slate-500 gap-x-6 gap-y-2">
                                            <p><span className="font-semibold text-slate-700">Conta:</span> {razoneteConta.codigo} - {razoneteConta.descricao}</p>
                                            <p><span className="font-semibold text-slate-700">Período:</span> {formatDateStr(dataInicio.replace(/-/g,''))} a {formatDateStr(dataFim.replace(/-/g,''))}</p>
                                        </div>
                                    </div>
                                    <button 
                                        type="button" 
                                        className="mt-3 w-full sm:mt-0 sm:ml-3 sm:w-auto inline-flex justify-center rounded-lg border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm"
                                        onClick={() => setRazoneteModalOpen(false)}
                                    >
                                        Fechar
                                    </button>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-6">
                                {loadingRazonete ? (
                                    <div className="py-20 flex flex-col items-center justify-center">
                                        <div className="h-8 w-8 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mb-4" />
                                        <p className="text-slate-500 font-medium">Buscando detalhamento de lançamentos...</p>
                                    </div>
                                ) : razonetes.length === 0 ? (
                                    <div className="py-12 text-center">
                                        <AlertCircle className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                                        <h3 className="text-sm font-medium text-slate-900">Sem lançamentos</h3>
                                        <p className="mt-1 text-sm text-slate-500">Nenhum lançamento foi encontrado para esta conta no período informado.</p>
                                    </div>
                                ) : (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[500px] overflow-y-auto">
                                        <table className="min-w-full divide-y divide-slate-200">
                                            <thead className="bg-slate-100 sticky top-0 shadow-sm z-10">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Data</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Doc.</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Lote</th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Histórico</th>
                                                    <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Valor</th>
                                                    <th scope="col" className="px-6 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">D/C</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-slate-100">
                                                {razonetes.map((lancamento, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500 font-mono">{formatDateStr(lancamento.data_lancamento)}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-900 font-medium">{lancamento.documento}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-slate-500">{lancamento.lote}</td>
                                                        <td className="px-6 py-3 text-sm text-slate-600 max-w-sm truncate" title={lancamento.historico}>{lancamento.historico}</td>
                                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-right font-medium">
                                                            {formatCurrency(lancamento.valor)}
                                                        </td>
                                                        <td className={`px-6 py-3 whitespace-nowrap text-sm text-center font-bold ${lancamento.tipo === 'D' ? 'text-blue-600' : 'text-red-500'}`}>
                                                            {lancamento.tipo}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Balancete;
