import React, { useState, useEffect } from 'react';
import { Database, Save, Loader2, RefreshCw, Box } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-toastify';

const ProtheusOverview = () => {
    const [dropdowns, setDropdowns] = useState({ grupos: [], tipos: [], ums: [] });
    const [produtos, setProdutos] = useState([]);
    const [loadingDropdowns, setLoadingDropdowns] = useState(true);
    const [loadingProdutos, setLoadingProdutos] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form states
    const [formData, setFormData] = useState({
        titulo: '',
        codigoDesenho: '',
        revisao: '',
        peso: '',
        grupo: '',
        tipo: '',
        um: ''
    });

    useEffect(() => {
        fetchDropdowns();
        fetchProdutos();
    }, []);

    const fetchDropdowns = async () => {
        try {
            const { data } = await api.get('/protheus/dropdowns');
            // Ordenar ALFABETICAMENTE as arrays para a UX do Combobox ficar perfeita
            setDropdowns({
                grupos: (data.grupos || []).sort((a,b) => a.code.localeCompare(b.code)),
                tipos: (data.tipos || []).sort((a,b) => a.code.localeCompare(b.code)),
                ums: (data.ums || []).sort((a,b) => a.code.localeCompare(b.code))
            });
        } catch (error) {
            toast.error('Erro ao buscar listas Mestre do Protheus');
            console.error(error);
        } finally {
            setLoadingDropdowns(false);
        }
    };

    const fetchProdutos = async () => {
        setLoadingProdutos(true);
        try {
            const { data } = await api.get('/protheus/produtos');
            setProdutos(data);
        } catch (error) {
            toast.error('Erro ao buscar histórico de peças cadastradas do Servidor.');
            console.error(error);
        } finally {
            setLoadingProdutos(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.titulo || !formData.grupo || !formData.tipo || !formData.um) {
            toast.warn('Preencha todos os campos obrigatórios (Título, Grupo, Tipo e UM) para registrar no Protheus.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await api.post('/protheus/produtos/create', formData);
            if (res.data.success) {
                toast.success(`Sucesso Operacional! Código Gerado: ${res.data.codigo}`, { autoClose: 6000 });
                
                // Clear text inputs but keep choices where possible (convenience)
                setFormData({
                    ...formData,
                    titulo: '',
                    codigoDesenho: '',
                    revisao: '',
                    peso: ''
                });

                fetchProdutos(); // Update the historical grid automatically
            }
        } catch (error) {
            toast.error(error.response?.data?.error || 'Exceção na validação interna da Protheus API Oauth2.');
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-8 animate-fadeIn max-w-[1400px] mx-auto">
            
            {/* Header / Titulos */}
            <div className="flex items-center gap-4 py-2 border-b border-slate-200">
                <div className="p-3 bg-indigo-100/70 shadow-sm border border-indigo-200 text-indigo-700 rounded-xl">
                    <Database className="w-8 h-8" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cadastro Expresso (ERP)</h1>
                    <p className="text-slate-500 font-medium">Motor de Criação Dinâmica do Catálogo Integrado Totvs/Protheus</p>
                </div>
            </div>

            {/* Sub-Card de Submissão */}
            <div className="bg-white rounded-xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-200 overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Box className="w-5 h-5 text-indigo-500" />
                        <h2 className="text-lg font-bold tracking-tight text-slate-700">Aceleração de Cadastro de Peças</h2>
                    </div>
                    {/* Alerta de Retorno */}
                    <span className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs px-3 py-1 font-semibold rounded-full shadow-sm">
                        Retorna Automático (B1_COD)
                    </span>
                </div>
                
                <form onSubmit={handleSubmit} className="p-6 md:p-8">
                    {loadingDropdowns ? (
                        <div className="flex flex-col items-center justify-center p-10 gap-3 text-indigo-500 font-medium">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                            <span>Vincando Parâmetros Básicos do Totvs... Aguarde...</span>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Sessao Essenciais */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="col-span-1 md:col-span-2">
                                    <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Título do Desenvolvimento / Peça <span className="text-red-500 text-lg leading-3">*</span></label>
                                    <input 
                                        type="text" 
                                        name="titulo"
                                        value={formData.titulo}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-all bg-slate-50 hover:bg-white focus:bg-white text-slate-700 font-medium"
                                        placeholder="EX: FLANGE CENTRAL FIXADORA"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Cód. Interno Desenho</label>
                                    <input 
                                        type="text" 
                                        name="codigoDesenho"
                                        value={formData.codigoDesenho}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm bg-slate-50 focus:bg-white text-slate-700 font-medium"
                                        placeholder="EX: MT5-28383"
                                    />
                                </div>
                                <div className="col-span-1 grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Revisão</label>
                                        <input 
                                            type="text" 
                                            name="revisao"
                                            value={formData.revisao}
                                            onChange={handleChange}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm bg-slate-50 focus:bg-white text-slate-700 font-medium text-center"
                                            placeholder="Ex: 00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Peso(KG)</label>
                                        <input 
                                            type="number" 
                                            step="0.001"
                                            name="peso"
                                            value={formData.peso}
                                            onChange={handleChange}
                                            className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 shadow-sm bg-slate-50 focus:bg-white text-slate-700 font-medium text-center"
                                            placeholder="25.5"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Sessão Matrizes Totvs */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/70 p-5 border border-indigo-100 rounded-xl relative mt-4 shadow-sm">
                                <div className="absolute -top-[14px] left-6 px-3 bg-white text-[11px] font-extrabold uppercase tracking-widest text-indigo-700 border border-indigo-100 rounded-full shadow-sm">Vínculos Mestres - Tabelas Base</div>
                                
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Macro-Grupo <span className="text-red-500 text-lg leading-3">*</span></label>
                                    <select 
                                        name="grupo"
                                        value={formData.grupo}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 shadow-sm focus:ring-indigo-500 font-medium text-slate-700 bg-white"
                                    >
                                        <option value="">Selecione na Lista (SBM010)</option>
                                        {dropdowns.grupos.map(g => (
                                            <option key={`g-${g.code}`} value={g.code}>{g.code} - {g.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Tipo / Finalidade <span className="text-red-500 text-lg leading-3">*</span></label>
                                    <select 
                                        name="tipo"
                                        value={formData.tipo}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 shadow-sm focus:ring-indigo-500 font-medium text-slate-700 bg-white"
                                    >
                                        <option value="">Filtro Tipo (SX5010 / 02)</option>
                                        {dropdowns.tipos.map(t => (
                                            <option key={`t-${t.code}`} value={t.code}>{t.code} - {t.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[13px] font-bold tracking-wider uppercase text-slate-500 mb-2">Unit. de Medida <span className="text-red-500 text-lg leading-3">*</span></label>
                                    <select 
                                        name="um"
                                        value={formData.um}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 shadow-sm focus:ring-indigo-500 font-medium text-slate-700 bg-white"
                                    >
                                        <option value="">Estoque (SAH010)</option>
                                        {dropdowns.ums.map(u => (
                                            <option key={`u-${u.code}`} value={u.code}>{u.code} - {u.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-8 flex justify-end">
                        <button
                            type="submit"
                            disabled={isSubmitting || loadingDropdowns}
                            className="bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 text-white font-bold py-3.5 px-10 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Inserir & Gerar Código Oficial
                        </button>
                    </div>
                </form>
            </div>

            {/* Listagem Global de Itens Acusados no Postgres */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-6">
                <div className="border-b border-slate-100 bg-white px-6 py-5 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Acervo de Cadastro Geral Protheus (SB1010)</h2>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mt-1">Lendo últimos {produtos.length || 0} Registros do Servidor Replica DB (Metalfisa)</p>
                    </div>
                    <button onClick={fetchProdutos} className="p-2 text-indigo-500 focus:bg-indigo-50 hover:bg-indigo-50 rounded-full transition-colors flex items-center gap-2" title="Recarregar Grid Baseado no SB1010">
                        <span className="text-sm font-semibold hidden md:inline-block">Sync Database</span>
                        <RefreshCw className={`w-5 h-5 ${loadingProdutos ? 'animate-spin' : ''}`}/>
                    </button>
                </div>
                
                <div className="max-h-[600px] overflow-auto border-t border-slate-200/50">
                    <table className="min-w-full text-left text-sm whitespace-nowrap">
                        <thead className="border-b border-slate-200 sticky top-0 bg-slate-50 z-10">
                            <tr>
                                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-slate-600">Código Totvs</th>
                                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-slate-600 w-1/2">Nome / Discriminação Nominal</th>
                                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-slate-600 text-center">Tabela</th>
                                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-slate-600 text-center">Espécie</th>
                                <th className="px-6 py-4 font-bold text-[11px] uppercase tracking-wider text-slate-600 text-center">Un.</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingProdutos ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-10">
                                      <div className="flex flex-col items-center justify-center gap-3">
                                          <div className="w-8 h-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin"></div>
                                          <p className="font-semibold text-slate-400">Puxando dados brutos do sistema legado...</p>
                                      </div>
                                    </td>
                                </tr>
                            ) : produtos.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-slate-500 font-medium">Nenhum produto rastreado pelo query de limite 1000.</td>
                                </tr>
                            ) : (
                                produtos.map((p, i) => (
                                    <tr key={`${p.codigo}-${i}`} className="hover:bg-slate-50 transition-colors group cursor-default">
                                        <td className="px-6 py-3 font-bold text-indigo-700 bg-indigo-50/20">{p.codigo}</td>
                                        <td className="px-6 py-3 text-slate-700 font-medium truncate max-w-sm group-hover:whitespace-normal transition-all" title={p.descricao}>{p.descricao}</td>
                                        <td className="px-6 py-3 text-center">
                                            <span className="bg-slate-100 border border-slate-200 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold inline-block min-w-16 shadow-sm">{p.grupo}</span>
                                        </td>
                                        <td className="px-6 py-3 text-center text-slate-600 font-semibold">{p.tipo}</td>
                                        <td className="px-6 py-3 text-center">
                                          <div className="mx-auto bg-blue-50 text-blue-700 w-8 h-8 flex items-center justify-center rounded-md font-bold text-xs">
                                              {p.um}
                                          </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default ProtheusOverview;
