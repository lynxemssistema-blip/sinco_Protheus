import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Package, Plus, ArrowDownRight, ArrowUpRight, AlertTriangle, Search, Filter } from 'lucide-react';
import MovimentacaoEstoqueModal from './MovimentacaoEstoqueModal';

const SSTEstoqueTab = ({ epis = [], onAtualizar }) => {
    const [movimentacoes, setMovimentacoes] = useState([]);
    const [modalMovimentacao, setModalMovimentacao] = useState(false);
    const [epiSelecionado, setEpiSelecionado] = useState(null);
    const [busca, setBusca] = useState('');
    const [subAba, setSubAba] = useState('catalogo'); // 'catalogo' ou 'kardex'

    const carregarMovimentacoes = async () => {
        try {
            const res = await api.get('/sst/movimentacoes?limit=50');
            setMovimentacoes(res.data?.movimentacoes || []);
        } catch (e) {
            console.error('Erro ao buscar movimentações:', e);
        }
    };

    useEffect(() => {
        carregarMovimentacoes();
    }, []);

    const episFiltrados = epis.filter(e => 
        e.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
        e.ca_numero?.includes(busca) ||
        e.produto_codigo?.toLowerCase().includes(busca.toLowerCase())
    );

    return (
        <div className="space-y-4">
            {/* Top Bar da Aba de Estoque */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setSubAba('catalogo')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subAba === 'catalogo'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Catálogo & Saldos ({epis.length})
                    </button>
                    <button
                        onClick={() => setSubAba('kardex')}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            subAba === 'kardex'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-slate-400 hover:text-white'
                        }`}
                    >
                        Extrato Kardex ({movimentacoes.length})
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Buscar por descrição, CA ou código..."
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 w-64 focus:outline-none focus:border-blue-500"
                        />
                    </div>

                    <button
                        onClick={() => {
                            setEpiSelecionado(null);
                            setModalMovimentacao(true);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        Nova Entrada / Ajuste
                    </button>
                </div>
            </div>

            {subAba === 'catalogo' ? (
                /* TABELA DE CATÁLOGO & SALDOS */
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800 font-bold">
                            <tr>
                                <th className="p-3.5">Código / Descrição</th>
                                <th className="p-3.5">Nº CA</th>
                                <th className="p-3.5">Validade CA</th>
                                <th className="p-3.5">Categoria</th>
                                <th className="p-3.5 text-right">Saldo Atual</th>
                                <th className="p-3.5 text-right">Mínimo</th>
                                <th className="p-3.5 text-right">Custo Un.</th>
                                <th className="p-3.5 text-center">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                            {episFiltrados.map((epi) => {
                                const isCritico = parseFloat(epi.saldo_atual || 0) <= parseFloat(epi.estoque_minimo || 0);
                                return (
                                    <tr key={epi.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="p-3.5">
                                            <div className="font-bold text-white text-sm">{epi.descricao}</div>
                                            <div className="text-[11px] text-slate-500">{epi.produto_codigo} • {epi.localizacao || 'Sem prateleira'}</div>
                                        </td>
                                        <td className="p-3.5 font-mono font-bold text-blue-400">
                                            {epi.ca_numero}
                                        </td>
                                        <td className="p-3.5">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                epi.ca_status === 'vencido'
                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                    : epi.ca_status === 'vencendo_30_dias'
                                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                            }`}>
                                                {epi.ca_validade ? new Date(epi.ca_validade).toLocaleDateString('pt-BR') : 'Indeterminado'}
                                            </span>
                                        </td>
                                        <td className="p-3.5 text-slate-400 capitalize">
                                            {epi.categoria_protecao?.replace(/_/g, ' ') || 'Geral'}
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <span className={`font-mono text-sm font-black ${
                                                isCritico ? 'text-red-400' : 'text-emerald-400'
                                            }`}>
                                                {parseFloat(epi.saldo_atual || 0)} {epi.unidade}
                                            </span>
                                            {isCritico && (
                                                <div className="text-[10px] text-red-400 font-bold flex items-center justify-end gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Abaixo Mín.
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3.5 text-right font-mono text-slate-400">
                                            {parseFloat(epi.estoque_minimo || 0)} {epi.unidade}
                                        </td>
                                        <td className="p-3.5 text-right font-mono text-slate-300">
                                            R$ {parseFloat(epi.custo_unitario || 0).toFixed(2)}
                                        </td>
                                        <td className="p-3.5 text-center">
                                            <button
                                                onClick={() => {
                                                    setEpiSelecionado(epi);
                                                    setModalMovimentacao(true);
                                                }}
                                                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-semibold border border-slate-700 transition-colors"
                                            >
                                                Movimentar
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* EXTRATO KARDEX */
                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                    <table className="w-full text-left text-xs text-slate-300">
                        <thead className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-800 font-bold">
                            <tr>
                                <th className="p-3.5">Data / Hora</th>
                                <th className="p-3.5">EPI</th>
                                <th className="p-3.5">Tipo Movimentação</th>
                                <th className="p-3.5 text-right">Qtd</th>
                                <th className="p-3.5 text-right">Saldo Ant.</th>
                                <th className="p-3.5 text-right">Novo Saldo</th>
                                <th className="p-3.5">Doc / Ref</th>
                                <th className="p-3.5">Responsável</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 font-mono">
                            {movimentacoes.map((m) => {
                                const isEntrada = m.tipo_movimentacao === 'entrada_compra' || m.tipo_movimentacao === 'devolucao_reaproveitamento';
                                return (
                                    <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                                        <td className="p-3.5 text-slate-400">
                                            {new Date(m.created_at).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-3.5 font-sans font-bold text-white">
                                            {m.epi_nome}
                                        </td>
                                        <td className="p-3.5 font-sans">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                isEntrada
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                            }`}>
                                                {m.tipo_movimentacao.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className={`p-3.5 text-right font-black ${isEntrada ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {isEntrada ? '+' : '-'}{parseFloat(m.quantidade)}
                                        </td>
                                        <td className="p-3.5 text-right text-slate-500">
                                            {parseFloat(m.saldo_anterior)}
                                        </td>
                                        <td className="p-3.5 text-right font-bold text-white">
                                            {parseFloat(m.saldo_novo)}
                                        </td>
                                        <td className="p-3.5 font-sans text-slate-400">
                                            {m.documento_referencia || '-'}
                                        </td>
                                        <td className="p-3.5 font-sans text-slate-300">
                                            {m.usuario_responsavel}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {modalMovimentacao && (
                <MovimentacaoEstoqueModal
                    epis={epis}
                    epiPreselecionado={epiSelecionado}
                    onClose={() => setModalMovimentacao(false)}
                    onMovimentacaoSalva={() => {
                        onAtualizar();
                        carregarMovimentacoes();
                    }}
                />
            )}
        </div>
    );
};

export default SSTEstoqueTab;
