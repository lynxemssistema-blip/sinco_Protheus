import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Search, Loader2, Check, X, MessageCircleQuestion, ChevronDown, AlertTriangle, PackageSearch, Network, ChevronRight, ShoppingCart, Bot } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
    analisarCadastroIA,
    consultarCadastroIA,
    salvarCorrecaoCadastro,
    getCorrecoesCadastro,
    atualizarStatusCorrecao,
    analisarRedundanciasMp,
    confirmarGrupoIA,
    getGruposMp,
    getOndeEUsado,
    getUltimaCompraBatch
} from '../services/api';

// Lista simplificada de referências (usado na Fase 1 - Tabela)
function OndeEUsadoSimples({ codigo }) {
    const [dados, setDados] = useState(null);
    useEffect(() => {
        getOndeEUsado(codigo).then(setDados).catch(() => {});
    }, [codigo]);

    if (!dados) return <span className="text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /></span>;
    if (dados.total === 0) return <span className="text-slate-500 italic">Sem uso</span>;

    const lista = [];
    Object.values(dados.por_tipo).forEach(itens => itens.forEach(i => lista.push(i.cod_pai)));
    
    return (
        <span className="text-slate-400 leading-tight block">
            {lista.slice(0, 8).join(', ')}
            {lista.length > 8 && <span className="italic text-slate-500"> (+{lista.length - 8})</span>}
        </span>
    );
}

// Painel detalhado de onde o produto é usado em estruturas (usado nos Cards da Fase 2)
function OndeEUsadoPanel({ codigo }) {
    const [dados, setDados] = useState(null);
    const [loading, setLoading] = useState(true);
    const [aberto, setAberto] = useState(false);
    const panelRef = useRef(null);

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        getOndeEUsado(codigo)
            .then(res => {
                if (mounted) setDados(res);
            })
            .catch(() => {})
            .finally(() => {
                if (mounted) setLoading(false);
            });
        return () => { mounted = false; };
    }, [codigo]);

    useEffect(() => {
        if (!aberto) return;
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                setAberto(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [aberto]);

    if (loading) {
        return (
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-2 py-0.5">
                <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                <span className="text-[11px]">Estruturas...</span>
            </span>
        );
    }

    if (!dados || dados.total === 0) {
        return (
            <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded px-2 py-0.5" title="Não consta em nenhuma estrutura de produto (BOM)">
                <Network className="w-3 h-3 text-slate-400" />
                Sem uso em estruturas
            </span>
        );
    }

    return (
        <div className="relative inline-block" ref={panelRef}>
            <button
                type="button"
                onClick={() => setAberto(prev => !prev)}
                className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-0.5 transition-colors cursor-pointer"
                title="Clique para ver os produtos que utilizam este componente"
            >
                <Network className="w-3 h-3 text-blue-600" />
                <span>Usado em <strong>{dados.total}</strong> estrutura{dados.total > 1 ? 's' : ''}</span>
                <ChevronDown className={`w-3 h-3 text-blue-500 transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`} />
            </button>

            {aberto && (
                <div className="absolute left-0 top-full mt-1.5 z-30 w-80 bg-white border border-slate-200 rounded-lg shadow-xl p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                            <Network className="w-3.5 h-3.5 text-blue-600" />
                            Onde é Usado ({dados.total})
                        </span>
                        <button
                            type="button"
                            onClick={() => setAberto(false)}
                            className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 divide-y divide-slate-100 pr-1">
                        {dados.por_tipo && Object.entries(dados.por_tipo).map(([tipo, itens]) => (
                            <div key={tipo} className="pt-1.5 first:pt-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                                    Tipo: {tipo} ({itens.length})
                                </div>
                                <ul className="space-y-1.5">
                                    {itens.map((item, idx) => (
                                        <li key={idx} className="flex items-start justify-between gap-2 text-slate-600 hover:bg-slate-50 p-1 rounded">
                                            <div className="min-w-0 flex-1">
                                                <div className="font-mono font-bold text-slate-800 text-[11px]">{item.cod_pai}</div>
                                                <div className="text-[11px] text-slate-500 truncate" title={item.desc_pai}>{item.desc_pai}</div>
                                            </div>
                                            <div className="text-right shrink-0 text-[10px] text-slate-400 font-mono">
                                                qtd: {Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function CandidatoMpCard({ cand, onConfirmar, onIgnorar }) {
    const [ultimasCompras, setUltimasCompras] = useState({});

    useEffect(() => {
        const codigos = (cand.produtos || []).map(p => p.codigo).filter(Boolean);
        if (codigos.length === 0) return;
        getUltimaCompraBatch(codigos)
            .then(mapa => setUltimasCompras(mapa))
            .catch(err => console.error('[UltimaCompra]', err));
    }, [cand._candidato_id]);

    return (
        <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-2 space-y-2">
            
            <div className="overflow-x-auto rounded border border-slate-600/50">
                <table className="w-full text-left text-xs text-slate-300">
                    <thead className="text-[10px] uppercase text-slate-400 bg-slate-800/80 border-b border-slate-600">
                        <tr>
                            <th className="px-2 py-1.5 font-bold whitespace-nowrap">Código</th>
                            <th className="px-2 py-1.5 font-bold">Descrição</th>
                            <th className="px-2 py-1.5 font-bold w-32 whitespace-nowrap"><ShoppingCart className="w-3 h-3 inline mr-1" /> Últ. Compra</th>
                            <th className="px-2 py-1.5 font-bold w-64"><Network className="w-3 h-3 inline mr-1" /> Onde é Usado</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-600/50">
                        {cand.produtos.map(p => (
                            <tr key={p.codigo} className="hover:bg-slate-700/30 transition-colors">
                                <td className="px-2 py-2 font-mono text-amber-300 font-bold whitespace-nowrap align-top">
                                    {p.codigo}
                                    {p.bloqueado === '1' && (
                                        <span className="ml-2 text-[9px] bg-red-900/50 text-red-400 px-1 py-0.5 rounded border border-red-700/50" title="Produto bloqueado no Protheus">
                                            BLOQ
                                        </span>
                                    )}
                                </td>
                                <td className="px-2 py-2 align-top text-slate-200">{p.descricao}</td>
                                <td className="px-2 py-2 align-top">
                                    {ultimasCompras[p.codigo] ? (
                                        <span className="text-emerald-400 block leading-tight">
                                            {ultimasCompras[p.codigo].ultima_data_fmt}
                                            <span className="block text-[10px] text-emerald-500/70 mt-0.5">{Number(ultimasCompras[p.codigo].quantidade).toLocaleString('pt-BR')} un</span>
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 italic">Sem registro</span>
                                    )}
                                </td>
                                <td className="px-2 py-2 align-top break-words max-w-[250px]">
                                    <OndeEUsadoSimples codigo={p.codigo} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {cand.status === 'erro' && (
                <p className="text-xs text-red-400">{cand.erro_msg}</p>
            )}
            <div className="flex gap-2 pt-1">
                <button
                    onClick={() => onConfirmar(cand)}
                    disabled={cand.status === 'confirmando'}
                    className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors shadow-sm"
                >
                    {cand.status === 'confirmando'
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Confirmando...</>
                        : <><Bot className="w-3 h-3" /> Confirmar com IA</>
                    }
                </button>
                <button
                    onClick={() => onIgnorar(cand._candidato_id)}
                    disabled={cand.status === 'confirmando'}
                    className="text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                    Ignorar
                </button>
            </div>
        </div>
    );
}

function GrupoSugeridoCard({ grupo, onSalvar, jaSalvo }) {
    const { hasPermission } = useAuth();
    const canViewValues = hasPermission('valores_financeiros', 'view');
    const [tipo, setTipo] = useState(grupo.tipo === 'equivalente' ? 'equivalente' : 'duplicado');
    const [produtosAtivos, setProdutosAtivos] = useState(grupo.produtos || []);
    const [codigoCorreto, setCodigoCorreto] = useState(grupo.sugestao_codigo_correto || grupo.produtos?.[0]?.codigo);
    const [salvando, setSalvando] = useState(false);
    const [ultimasCompras, setUltimasCompras] = useState({});  // { codigo: { ultima_data_fmt, quantidade, valor_unit } }

    // Carrega última compra de todos os produtos do grupo em uma única chamada
    useEffect(() => {
        const codigos = (grupo.produtos || []).map(p => p.codigo).filter(Boolean);
        if (codigos.length === 0) return;
        getUltimaCompraBatch(codigos)
            .then(mapa => setUltimasCompras(mapa))
            .catch(err => console.error('[UltimaCompra]', err));
    }, [grupo._id]);

    const removerItem = (codigo) => {
        setProdutosAtivos(prev => prev.filter(p => p.codigo !== codigo));
    };

    const handleSalvar = async () => {
        if (produtosAtivos.length < 2) return;
        const itens = produtosAtivos.map(p => ({
            codigo: p.codigo,
            descricao: p.descricao,
            empresa: p.empresa,
            papel: tipo === 'duplicado'
                ? (p.codigo === codigoCorreto ? 'correto' : 'bloquear')
                : 'equivalente'
        }));
        setSalvando(true);
        try {
            await onSalvar({ tipo_relacao: tipo, motivo_ia: grupo.motivo, itens });
        } finally {
            setSalvando(false);
        }
    };

    if (produtosAtivos.length < 2) return null;

    return (
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${tipo === 'duplicado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {tipo === 'duplicado' ? 'Duplicado' : 'Equivalente'}
                    </span>
                    <span className="text-xs text-slate-400">Confiança: {grupo.confianca || 'n/d'}</span>
                </div>
                {!jaSalvo && (
                    <select
                        className="text-xs border rounded px-2 py-1"
                        value={tipo}
                        onChange={e => setTipo(e.target.value)}
                    >
                        <option value="duplicado">Duplicado (bloquear)</option>
                        <option value="equivalente">Equivalente (substituível)</option>
                    </select>
                )}
            </div>
            {grupo.motivo && <p className="text-sm text-slate-600">{grupo.motivo}</p>}
            <div className="space-y-2">
                {produtosAtivos.map(p => (
                    <div key={p.codigo} className="flex flex-col border rounded p-2 gap-1">
                        <div className="flex items-center gap-3">
                            {tipo === 'duplicado' && !jaSalvo && (
                                <input
                                    type="radio"
                                    name={`correto-${grupo._id}`}
                                    checked={codigoCorreto === p.codigo}
                                    onChange={() => setCodigoCorreto(p.codigo)}
                                />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm font-bold truncate">
                                    {p.codigo} <span className="text-xs text-slate-400 font-normal">({p.empresa})</span>
                                </div>
                                <div className="text-xs text-slate-600 truncate">{p.descricao}</div>
                            </div>
                            {tipo === 'duplicado' && (
                                <span className={`text-xs font-bold shrink-0 ${codigoCorreto === p.codigo ? 'text-green-600' : 'text-red-500'}`}>
                                    {codigoCorreto === p.codigo ? 'Manter' : 'Bloquear'}
                                </span>
                            )}
                            {!jaSalvo && (
                                <button
                                    onClick={() => removerItem(p.codigo)}
                                    className="text-slate-300 hover:text-red-500 shrink-0"
                                    title="Remover do grupo (falso positivo)"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        {/* Última compra + Onde é Usado */}
                        <div className="flex flex-wrap items-center gap-3 pt-0.5">
                            {ultimasCompras[p.codigo] ? (
                                <span className="flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                                    <ShoppingCart className="w-3 h-3" />
                                    Últ. compra: <strong>{ultimasCompras[p.codigo].ultima_data_fmt}</strong>
                                    &middot;
                                    {Number(ultimasCompras[p.codigo].quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} uh
                                    {canViewValues && (
                                        <>
                                            &middot;
                                            R$ {Number(ultimasCompras[p.codigo].valor_unit).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/un
                                        </>
                                    )}
                                </span>
                            ) : (
                                <span className="text-xs text-slate-300 italic">sem registro de compra</span>
                            )}
                            <OndeEUsadoPanel codigo={p.codigo} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-end">
                {jaSalvo ? (
                    <span className="text-xs text-green-600 font-bold flex items-center gap-1">
                        <Check className="w-4 h-4" /> Decisão salva
                    </span>
                ) : (
                    <button
                        onClick={handleSalvar}
                        disabled={salvando || produtosAtivos.length < 2}
                        className="bg-blue-600 text-white text-xs font-bold px-4 py-2 rounded-lg disabled:opacity-50 flex items-center gap-2"
                    >
                        {salvando && <Loader2 className="w-3 h-3 animate-spin" />}
                        Salvar decisão
                    </button>
                )}
            </div>
        </div>
    );
}

// Barra de progresso animada com etapas
function ProgressSteps({ etapa }) {
    const steps = [
        { id: 1, label: 'Buscando MPs no Protheus' },
        { id: 2, label: 'Calculando similaridade' },
        { id: 3, label: 'Confirmando com IA (Gemini)' },
    ];
    return (
        <div className="flex flex-col gap-2 py-4">
            {steps.map(s => (
                <div key={s.id} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                        etapa > s.id ? 'bg-green-500 text-white' :
                        etapa === s.id ? 'bg-blue-600 text-white animate-pulse' :
                        'bg-slate-200 text-slate-400'
                    }`}>
                        {etapa > s.id ? <Check className="w-3 h-3" /> : s.id}
                    </div>
                    <span className={`text-sm transition-all ${
                        etapa > s.id ? 'text-green-600 font-medium' :
                        etapa === s.id ? 'text-blue-600 font-bold' :
                        'text-slate-400'
                    }`}>{s.label}</span>
                    {etapa === s.id && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                </div>
            ))}
        </div>
    );
}

// Card de estatísticas
function StatsBar({ stats }) {
    if (!stats) return null;
    return (
        <div className="grid grid-cols-3 gap-3 py-3">
            <div className="bg-slate-50 rounded-lg p-3 text-center border">
                <div className="text-2xl font-bold text-slate-700">{stats.total_mp ?? '-'}</div>
                <div className="text-xs text-slate-500 mt-1">MPs analisados</div>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                <div className="text-2xl font-bold text-amber-600">{stats.candidatos ?? '-'}</div>
                <div className="text-xs text-slate-500 mt-1">Candidatos (pré-filtro)</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                <div className="text-2xl font-bold text-blue-700">{stats.grupos_ia ?? '-'}</div>
                <div className="text-xs text-slate-500 mt-1">Grupos confirmados</div>
            </div>
        </div>
    );
}

export default function CadastroAnaliseTab() {
    const { user } = useAuth();
    const criadoPor = user?.nome || user?.login || 'Usuário Desconhecido';

    // Consulta pontual
    const [pergunta, setPergunta] = useState('');
    const [codigoConsulta, setCodigoConsulta] = useState('');
    const [loadingConsulta, setLoadingConsulta] = useState(false);
    const [respostaConsulta, setRespostaConsulta] = useState('');
    const [gruposConsulta, setGruposConsulta] = useState([]);
    const [erroConsulta, setErroConsulta] = useState(null);

    // Análise em lote
    const [filtros, setFiltros] = useState({ empresa: '', grupo: '', tipo: '', descricao: '', prefixo: '' });
    const [loadingLote, setLoadingLote] = useState(false);
    const [gruposLote, setGruposLote] = useState([]);
    const [erroLote, setErroLote] = useState(null);
    const [buscaLoteFeita, setBuscaLoteFeita] = useState(false);

    // Análise de Redundâncias MP — estado de batching sequencial
    const [gruposMpDisponiveis, setGruposMpDisponiveis] = useState([]);
    const [grupoMpSelecionado, setGrupoMpSelecionado] = useState('');
    const [loadingGruposMp, setLoadingGruposMp] = useState(false);
    const [rodandoMp, setRodandoMp] = useState(false);
    const [candidatosMp, setCandidatosMp] = useState([]);       // Fase 1: candidatos Levenshtein (status: pendente/confirmando/confirmado/ignorado)
    const [gruposMpResultado, setGruposMpResultado] = useState([]); // Fase 2: grupos confirmados pela IA
    const [progressoMp, setProgressoMp] = useState(null);
    const [statsMpTotal, setStatsMpTotal] = useState(null);
    const [erroMp, setErroMp] = useState(null);
    const [concluido, setConcluido] = useState(false);
    const cancelarRef = React.useRef(false);

    // Correções registradas
    const [correcoes, setCorrecoes] = useState([]);
    const [loadingCorrecoes, setLoadingCorrecoes] = useState(false);
    const [gruposSalvos, setGruposSalvos] = useState(new Set());

    useEffect(() => {
        carregarCorrecoes();
        carregarGruposMp();
    }, []);

    const carregarCorrecoes = async () => {
        setLoadingCorrecoes(true);
        try {
            const data = await getCorrecoesCadastro({});
            setCorrecoes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCorrecoes(false);
        }
    };

    const carregarGruposMp = async () => {
        setLoadingGruposMp(true);
        try {
            const data = await getGruposMp();
            setGruposMpDisponiveis(data);
        } catch (err) {
            console.error('[GruposMp]', err);
        } finally {
            setLoadingGruposMp(false);
        }
    };

    const handleConsultar = async () => {
        if (!pergunta.trim() && !codigoConsulta.trim()) return;
        setLoadingConsulta(true);
        setErroConsulta(null);
        setRespostaConsulta('');
        setGruposConsulta([]);
        try {
            const data = await consultarCadastroIA({
                pergunta: pergunta.trim() || undefined,
                codigo: codigoConsulta.trim() || undefined
            });
            setRespostaConsulta(data.resposta || '');
            setGruposConsulta((data.groups || []).map((g, idx) => ({ ...g, _id: `consulta-${idx}-${Date.now()}` })));
        } catch (err) {
            console.error(err);
            setErroConsulta(err?.response?.data?.error || 'Erro ao consultar a IA.');
        } finally {
            setLoadingConsulta(false);
        }
    };

    const handleAnalisarLote = async () => {
        setLoadingLote(true);
        setErroLote(null);
        setBuscaLoteFeita(true);
        setGruposLote([]);
        try {
            const data = await analisarCadastroIA(filtros);
            setGruposLote((data.groups || []).map((g, idx) => ({ ...g, _id: `lote-${idx}-${Date.now()}` })));
        } catch (err) {
            console.error(err);
            setErroLote(err?.response?.data?.error || 'Erro ao analisar cadastro com IA.');
        } finally {
            setLoadingLote(false);
        }
    };

    // FASE 1: Levenshtein scan — rápido, sem IA, sem timeout
    const handleAnalisarRedundanciasMp = async () => {
        cancelarRef.current = false;
        setErroMp(null);
        setCandidatosMp([]);
        setGruposMpResultado([]);
        setStatsMpTotal(null);
        setProgressoMp(null);
        setConcluido(false);
        setRodandoMp(true);

        const LOTE = 150;
        let offset = 0, totalGeral = null, totalMpProcessados = 0, totalCandidatos = 0, batchNum = 0;

        try {
            while (!cancelarRef.current) {
                batchNum++;
                setProgressoMp({ lote: batchNum, atual: offset, total: totalGeral, fase: 'escaneando' });

                const data = await analisarRedundanciasMp({
                    grupo: grupoMpSelecionado || undefined,
                    lote_offset: offset,
                    lote_size: LOTE
                });

                const pag = data.paginacao || {};
                totalGeral = pag.total_geral ?? totalGeral;
                totalMpProcessados += data.stats?.lote_mp || 0;
                totalCandidatos += data.stats?.candidatos || 0;

                const novos = (data.candidatos || []);
                if (novos.length > 0) setCandidatosMp(prev => [...prev, ...novos]);

                setStatsMpTotal({ total_mp: totalMpProcessados, candidatos: totalCandidatos, grupos_ia: 0 });
                setProgressoMp({ lote: batchNum, atual: pag.proximo_offset || (offset + LOTE), total: totalGeral, fase: 'concluido_lote' });

                if (!pag.tem_mais) break;
                offset = pag.proximo_offset || (offset + LOTE);
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (err) {
            console.error('[MP Fase1]', err);
            if (!cancelarRef.current) setErroMp(err?.response?.data?.error || 'Erro ao escanear MPs.');
        } finally {
            setRodandoMp(false);
            setConcluido(true);
        }
    };

    // FASE 2: Confirma 1 candidato com Gemini (~5-8s por chamada)
    const handleConfirmarCandidatoIA = async (candidato) => {
        setCandidatosMp(prev => prev.map(c =>
            c._candidato_id === candidato._candidato_id ? { ...c, status: 'confirmando' } : c
        ));
        try {
            const result = await confirmarGrupoIA(candidato._candidato_id, candidato.produtos);
            if (result.descartado) {
                setCandidatosMp(prev => prev.map(c =>
                    c._candidato_id === candidato._candidato_id ? { ...c, status: 'ignorado', motivo_ia: result.motivo } : c
                ));
            } else {
                const grupoConfirmado = { ...result, _id: `mp-ia-${candidato._candidato_id}`, _candidato_id: candidato._candidato_id };
                setCandidatosMp(prev => prev.map(c =>
                    c._candidato_id === candidato._candidato_id ? { ...c, status: 'confirmado' } : c
                ));
                setGruposMpResultado(prev => prev.find(g => g._candidato_id === candidato._candidato_id) ? prev : [...prev, grupoConfirmado]);
                setStatsMpTotal(prev => prev ? { ...prev, grupos_ia: (prev.grupos_ia || 0) + 1 } : { grupos_ia: 1 });
            }
        } catch (err) {
            console.error('[MP Fase2]', err);
            setCandidatosMp(prev => prev.map(c =>
                c._candidato_id === candidato._candidato_id ? { ...c, status: 'erro', erro_msg: err?.response?.data?.error || 'Erro ao confirmar.' } : c
            ));
        }
    };

    const handleIgnorarCandidato = (candidatoId) => {
        setCandidatosMp(prev => prev.map(c =>
            c._candidato_id === candidatoId ? { ...c, status: 'ignorado' } : c
        ));
    };


    const handlePararMp = () => {
        cancelarRef.current = true;
        setRodandoMp(false);
        setConcluido(true);
    };

    const handleSalvarGrupo = async (grupoId, payload) => {
        try {
            await salvarCorrecaoCadastro({ ...payload, criado_por: criadoPor });
            setGruposSalvos(prev => new Set(prev).add(grupoId));
            carregarCorrecoes();
        } catch (err) {
            console.error(err);
            alert(err?.response?.data?.error || 'Erro ao salvar decisão do grupo.');
        }
    };

    const handleAtualizarStatus = async (grupoUuid, status) => {
        try {
            await atualizarStatusCorrecao(grupoUuid, status);
            carregarCorrecoes();
        } catch (err) {
            console.error(err);
            alert('Erro ao atualizar status.');
        }
    };

    return (
        <div className="space-y-8">
            {/* ================================================== */}
            {/* ANÁLISE DE REDUNDÂNCIAS MP                          */}
            {/* ================================================== */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-5 rounded-xl shadow-lg border border-slate-700 space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-lg">
                        <PackageSearch className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-white flex items-center gap-2">
                            Análise de Redundâncias MP
                            <span className="text-xs font-normal bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full">Empresa 010 · Matriz</span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">Detecta matérias-primas duplicadas ou equivalentes mesmo quando descritas de formas diferentes.</p>
                    </div>
                </div>

                {/* Filtro de Grupo */}
                <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Grupo de Material (opcional)</label>
                        <div className="relative">
                            <select
                                className="w-full bg-slate-700 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                value={grupoMpSelecionado}
                                onChange={e => {
                                    setGrupoMpSelecionado(e.target.value);
                                    setGruposMpResultado([]);
                                    setStatsMpTotal(null);
                                    setProgressoMp(null);
                                    setConcluido(false);
                                    setErroMp(null);
                                }}
                                disabled={loadingGruposMp || rodandoMp}
                            >
                                <option value="">Todos os grupos de MP</option>
                                {gruposMpDisponiveis.map(g => (
                                    <option key={g.grupo} value={g.grupo}>
                                        {g.grupo} ({g.total_mp} MPs)
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                    </div>

                    {!rodandoMp ? (
                        <button
                            onClick={handleAnalisarRedundanciasMp}
                            disabled={rodandoMp}
                            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap transition-colors"
                        >
                            <Sparkles className="w-4 h-4" />
                            {concluido ? 'Nova análise' : 'Analisar Redundâncias MP'}
                        </button>
                    ) : (
                        <button
                            onClick={handlePararMp}
                            className="bg-red-700 hover:bg-red-600 text-white font-bold px-5 py-2 rounded-lg text-sm flex items-center gap-2 whitespace-nowrap transition-colors"
                        >
                            <X className="w-4 h-4" /> Parar análise
                        </button>
                    )}
                </div>

                {/* Progresso em lotes */}
                {(rodandoMp || progressoMp) && (
                    <div className="bg-slate-700/60 rounded-lg p-4 border border-slate-600 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-300 flex items-center gap-1">
                                {rodandoMp && <Loader2 className="w-3 h-3 animate-spin inline" />}
                                {rodandoMp
                                    ? `Escaneando lote ${progressoMp?.lote || 1}...`
                                    : `✓ Scan concluído — ${progressoMp?.lote || '?'} lote(s)`
                                }
                            </span>
                            {progressoMp?.total && (
                                <span className="text-xs text-slate-400">
                                    {Math.min(progressoMp.atual, progressoMp.total)} / {progressoMp.total} MPs
                                </span>
                            )}
                        </div>
                            {/* Barra de progresso */}
                            {progressoMp?.total && (
                                <div className="w-full bg-slate-600 rounded-full h-2">
                                    <div
                                        className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(100, Math.round((progressoMp.atual / progressoMp.total) * 100))}%` }}
                                    />
                                </div>
                            )}
                            {/* Stats em tempo real */}
                            {statsMpTotal && (
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">{statsMpTotal.total_mp}</div>
                                        <div className="text-xs text-slate-400">MPs escaneados</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-amber-400">{statsMpTotal.candidatos}</div>
                                        <div className="text-xs text-slate-400">Candidatos</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-blue-400">{statsMpTotal.grupos_ia}</div>
                                        <div className="text-xs text-slate-400">Confirmados IA</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Erro */}
                    {erroMp && (
                        <div className="flex items-center gap-2 bg-red-900/30 border border-red-700/40 text-red-300 rounded-lg p-3 text-sm">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            {erroMp}
                        </div>
                    )}

                    {/* FASE 1: Candidatos Levenshtein aguardando confirmação IA */}
                    {candidatosMp.filter(c => c.status !== 'ignorado').length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs text-amber-300 font-semibold flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                {candidatosMp.filter(c => c.status === 'pendente').length} candidato(s) aguardando confirmação IA — clique em cada um para validar:
                            </p>
                            {candidatosMp.filter(c => c.status !== 'ignorado' && c.status !== 'confirmado').map(cand => (
                                <CandidatoMpCard
                                    key={cand._candidato_id}
                                    cand={cand}
                                    onConfirmar={handleConfirmarCandidatoIA}
                                    onIgnorar={handleIgnorarCandidato}
                                />
                            ))}
                        </div>
                    )}

                    {/* FASE 2: Grupos confirmados pela IA */}
                    {gruposMpResultado.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-xs text-green-400 font-semibold flex items-center gap-2">
                                <Check className="w-4 h-4" />
                                {gruposMpResultado.length} grupo(s) confirmado(s) pela IA — revise e salve cada decisão:
                            </p>
                            {gruposMpResultado.map(grupo => (
                                <GrupoSugeridoCard
                                    key={grupo._id}
                                    grupo={grupo}
                                    jaSalvo={gruposSalvos.has(grupo._id)}
                                    onSalvar={(payload) => handleSalvarGrupo(grupo._id, payload)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Conclusão sem resultados */}
                    {concluido && !rodandoMp && candidatosMp.length === 0 && gruposMpResultado.length === 0 && !erroMp && (
                        <div className="text-center py-6 text-slate-400">
                            <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
                            <p className="text-sm font-medium text-green-400">Nenhuma redundância encontrada</p>
                            <p className="text-xs mt-1">O cadastro de MP {grupoMpSelecionado ? `do grupo "${grupoMpSelecionado}"` : 'analisado'} parece limpo.</p>
                        </div>
                    )}
                </div>




            {/* ================================================== */}
            {/* CONSULTA PONTUAL                                    */}
            {/* ================================================== */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <MessageCircleQuestion className="w-5 h-5 text-blue-600" />
                    Consulta rápida
                </h2>
                <div className="flex flex-col md:flex-row gap-3">
                    <input
                        type="text"
                        className="flex-1 border rounded p-2 text-sm"
                        placeholder='Ex: "existe equivalente pra chapa aço 1006 4,5mm?"'
                        value={pergunta}
                        onChange={e => setPergunta(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConsultar()}
                    />
                    <input
                        type="text"
                        className="w-full md:w-48 border rounded p-2 text-sm"
                        placeholder="ou código (ex: MTC-0872)"
                        value={codigoConsulta}
                        onChange={e => setCodigoConsulta(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleConsultar()}
                    />
                    <button
                        onClick={handleConsultar}
                        disabled={loadingConsulta || (!pergunta.trim() && !codigoConsulta.trim())}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 whitespace-nowrap"
                    >
                        {loadingConsulta ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Perguntar à IA
                    </button>
                </div>
                {erroConsulta && <p className="text-xs text-red-600">{erroConsulta}</p>}
                {respostaConsulta && (
                    <div className="bg-blue-50 border border-blue-100 rounded p-3 text-sm text-slate-700">{respostaConsulta}</div>
                )}
                {gruposConsulta.length > 0 && (
                    <div className="space-y-3 pt-2">
                        {gruposConsulta.map(grupo => (
                            <GrupoSugeridoCard
                                key={grupo._id}
                                grupo={grupo}
                                jaSalvo={gruposSalvos.has(grupo._id)}
                                onSalvar={(payload) => handleSalvarGrupo(grupo._id, payload)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ================================================== */}
            {/* ANÁLISE EM LOTE (FILTRO GENÉRICO)                  */}
            {/* ================================================== */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
                <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    Análise em lote por filtro
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Empresa</label>
                        <select
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.empresa}
                            onChange={e => setFiltros({ ...filtros, empresa: e.target.value })}
                        >
                            <option value="">Todas</option>
                            <option value="010">010 - Matriz</option>
                            <option value="990">990 - Filial</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Grupo</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.grupo}
                            onChange={e => setFiltros({ ...filtros, grupo: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Prefixo (Ex: MTC)</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.prefixo}
                            onChange={e => setFiltros({ ...filtros, prefixo: e.target.value })}
                            placeholder="Prefixo do Código"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Tipo</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.tipo}
                            onChange={e => setFiltros({ ...filtros, tipo: e.target.value })}
                            placeholder="Ex: MP, PA"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Descrição</label>
                        <input
                            type="text"
                            className="w-full border rounded p-2 text-sm"
                            value={filtros.descricao}
                            onChange={e => setFiltros({ ...filtros, descricao: e.target.value })}
                            placeholder="Contém..."
                        />
                    </div>
                </div>
                <p className="text-xs text-slate-400">Recomendado filtrar por grupo e/ou tipo para manter o recorte pequeno e a análise precisa.</p>
                <div className="flex justify-end">
                    <button
                        onClick={handleAnalisarLote}
                        disabled={loadingLote}
                        className="bg-slate-800 text-white px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                        {loadingLote ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        Analisar com IA
                    </button>
                </div>
                {erroLote && <p className="text-xs text-red-600">{erroLote}</p>}
                {buscaLoteFeita && !loadingLote && !erroLote && gruposLote.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhum grupo de duplicata/equivalência encontrado nesse recorte.</p>
                )}
                {gruposLote.length > 0 && (
                    <div className="space-y-3 pt-2">
                        {gruposLote.map(grupo => (
                            <GrupoSugeridoCard
                                key={grupo._id}
                                grupo={grupo}
                                jaSalvo={gruposSalvos.has(grupo._id)}
                                onSalvar={(payload) => handleSalvarGrupo(grupo._id, payload)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* ================================================== */}
            {/* CORREÇÕES REGISTRADAS                               */}
            {/* ================================================== */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
                <h2 className="text-sm font-bold text-slate-700">Correções registradas</h2>
                {loadingCorrecoes ? (
                    <p className="text-sm text-slate-400 text-center py-4">Carregando...</p>
                ) : correcoes.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">Nenhuma correção registrada ainda.</p>
                ) : (
                    <div className="space-y-3">
                        {correcoes.map(grupo => (
                            <div key={grupo.grupo_uuid} className="border rounded-lg p-3 space-y-2">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${grupo.tipo_relacao === 'duplicado' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {grupo.tipo_relacao === 'duplicado' ? 'Duplicado' : 'Equivalente'}
                                        </span>
                                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                                            grupo.status === 'aplicado' ? 'bg-green-100 text-green-700' :
                                            grupo.status === 'ignorado' ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                            {grupo.status === 'aplicado'
                                                ? (grupo.tipo_relacao === 'duplicado' ? 'Bloqueado no Protheus' : 'Confirmado')
                                                : grupo.status === 'ignorado' ? 'Ignorado' : 'Pendente'}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            por {grupo.criado_por} em {new Date(grupo.criado_em).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                    {grupo.status === 'pendente' && (
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleAtualizarStatus(grupo.grupo_uuid, 'aplicado')}
                                                className="text-xs font-bold text-green-700 hover:underline"
                                            >
                                                Marcar como aplicado
                                            </button>
                                            <button
                                                onClick={() => handleAtualizarStatus(grupo.grupo_uuid, 'ignorado')}
                                                className="text-xs font-bold text-slate-400 hover:underline"
                                            >
                                                Ignorar
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {grupo.itens.map(item => (
                                        <span
                                            key={item.id}
                                            className={`text-xs font-mono px-2 py-1 rounded border ${
                                                item.papel === 'correto' ? 'border-green-300 bg-green-50 text-green-700' :
                                                item.papel === 'bloquear' ? 'border-red-300 bg-red-50 text-red-700 line-through' :
                                                'border-blue-300 bg-blue-50 text-blue-700'
                                            }`}
                                            title={item.descricao}
                                        >
                                            {item.codigo}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
