import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    Shield, Package, AlertTriangle, FileText, Plus, 
    Download, Search, Clock, CheckCircle2, UserCheck, ArrowRightLeft, Filter 
} from 'lucide-react';
import SSTEstoqueTab from './SSTEstoqueTab';
import NovaEntregaEpiModal from './NovaEntregaEpiModal';
import { gerarFichaEpiPdf } from '../../services/sstPdfGenerator';

const SSTCentral = () => {
    const [epis, setEpis] = useState([]);
    const [fichas, setFichas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [abaAtiva, setAbaAtiva] = useState('fichas'); // 'fichas', 'estoque', 'alertas'
    const [buscaColab, setBuscaColab] = useState('');
    const [modalEntrega, setModalEntrega] = useState(false);
    const [colaboradorSelecionado, setColaboradorSelecionado] = useState(null);

    // Carregar dados
    const carregarDados = async () => {
        try {
            setLoading(true);
            const [episRes, fichasRes] = await Promise.all([
                api.get('/sst/epis'),
                api.get('/sst/fichas')
            ]);
            setEpis(episRes.data?.epis || []);
            setFichas(fichasRes.data?.fichas || []);
        } catch (err) {
            console.error('Erro ao carregar dados SST:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDados();
    }, []);

    // KPIs calculados
    const totalEpis = epis.length;
    const casVencendo = epis.filter(e => e.ca_status === 'vencendo_30_dias' || e.ca_status === 'vencido').length;
    const estoqueCritico = epis.filter(e => e.estoque_critico === 1).length;
    const totalEmUso = fichas.reduce((acc, f) => acc + parseInt(f.total_epis_em_uso || 0), 0);

    const fichasFiltradas = fichas.filter(f =>
        f.NomeCompleto?.toLowerCase().includes(buscaColab.toLowerCase()) ||
        f.Setor?.toLowerCase().includes(buscaColab.toLowerCase()) ||
        f.Funcao?.toLowerCase().includes(buscaColab.toLowerCase())
    );

    // Emitir PDF da Ficha de EPI
    const handleGerarPdf = async (usuarioId) => {
        try {
            const res = await api.get(`/sst/fichas/${usuarioId}`);
            gerarFichaEpiPdf(res.data.colaborador, res.data.ficha, res.data.entregas);
        } catch (err) {
            alert('Erro ao gerar PDF da Ficha de EPI.');
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-100 tracking-tight flex items-center gap-3">
                        <Shield className="w-8 h-8 text-emerald-500" />
                        SST - Segurança e Saúde do Trabalho (NR-06)
                    </h1>
                    <p className="text-sm text-slate-400">
                        Catálogo de EPIs, controle de CA, termo digital de entrega, motor Kardex e periodicidade de trocas preventivas.
                    </p>
                </div>
            </div>

            {/* Cards de Indicadores (KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                        <Package className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">EPIs Cadastrados</div>
                        <div className="text-2xl font-black text-white">{totalEpis} itens</div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">CAs Vencendo / Vencidos</div>
                        <div className="text-2xl font-black text-amber-400">{casVencendo} CAs</div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Estoque Abaixo Mínimo</div>
                        <div className="text-2xl font-black text-red-400">{estoqueCritico} itens</div>
                    </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
                        <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">EPIs em Uso na Fábrica</div>
                        <div className="text-2xl font-black text-emerald-400">{totalEmUso} unidades</div>
                    </div>
                </div>
            </div>

            {/* Navegação por Abas */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-1">
                <button
                    onClick={() => setAbaAtiva('fichas')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        abaAtiva === 'fichas'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    <FileText className="w-4 h-4" />
                    Fichas Digitais de Colaboradores ({fichas.length})
                </button>

                <button
                    onClick={() => setAbaAtiva('estoque')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
                        abaAtiva === 'estoque'
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                >
                    <Package className="w-4 h-4" />
                    Catálogo de EPIs & Motor Kardex
                </button>
            </div>

            {/* Conteúdo da Aba */}
            {abaAtiva === 'fichas' ? (
                <div className="space-y-4">
                    {/* Barra de Busca de Colaboradores */}
                    <div className="flex items-center justify-between">
                        <div className="relative w-80">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Buscar colaborador por nome, setor ou função..."
                                value={buscaColab}
                                onChange={(e) => setBuscaColab(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 w-full focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    {/* Tabela de Fichas */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800 font-bold">
                                <tr>
                                    <th className="p-3.5">Colaborador</th>
                                    <th className="p-3.5">Setor / Função</th>
                                    <th className="p-3.5 text-center">EPIs em Posse</th>
                                    <th className="p-3.5 text-center">Próxima Troca</th>
                                    <th className="p-3.5 text-center">Status Ficha</th>
                                    <th className="p-3.5 text-center">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {fichasFiltradas.map((colab) => (
                                    <tr key={colab.idUsuario} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-bold text-white text-sm">{colab.NomeCompleto}</div>
                                            <div className="text-[11px] text-slate-500">{colab.email || 'Sem e-mail'}</div>
                                        </td>
                                        <td className="p-3.5">
                                            <div className="text-slate-200">{colab.Setor || 'Geral'}</div>
                                            <div className="text-[11px] text-slate-500">{colab.Funcao || 'Operador'}</div>
                                        </td>
                                        <td className="p-3.5 text-center font-mono font-bold text-sm text-emerald-400">
                                            {colab.total_epis_em_uso || 0} itens
                                        </td>
                                        <td className="p-3.5 text-center font-mono text-slate-300">
                                            {colab.proxima_troca_data
                                                ? new Date(colab.proxima_troca_data).toLocaleDateString('pt-BR')
                                                : '-'}
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                NR-06 REGULAR
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setColaboradorSelecionado(colab);
                                                        setModalEntrega(true);
                                                    }}
                                                    className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 rounded-lg text-xs font-bold border border-emerald-500/30 transition-colors flex items-center gap-1"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Entregar EPI
                                                </button>

                                                <button
                                                    onClick={() => handleGerarPdf(colab.idUsuario)}
                                                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1"
                                                    title="Imprimir Ficha Oficial NR-06"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    Ficha PDF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <SSTEstoqueTab epis={epis} onAtualizar={carregarDados} />
            )}

            {/* Modal de Entrega */}
            {modalEntrega && (
                <NovaEntregaEpiModal
                    fichaId={colaboradorSelecionado?.ficha_id || 1}
                    colaboradorNome={colaboradorSelecionado?.NomeCompleto}
                    epis={epis}
                    onClose={() => setModalEntrega(false)}
                    onEntregaRealizada={carregarDados}
                />
            )}
        </div>
    );
};

export default SSTCentral;
