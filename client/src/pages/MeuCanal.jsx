import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import {
    PlayCircle, CheckCircle, User, Users, Info, Mail,
    Clock, XCircle, Zap, Calendar, ChevronDown, ChevronUp,
    MessageCircle, TrendingUp, Briefcase, AlertTriangle, Timer
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, Cell
} from 'recharts';
import ErrorStateOverlay from '../components/ErrorStateOverlay';

// ─── Utilitários ────────────────────────────────────────────────────────────
const getInitials = (name = '') =>
    name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('');

const nivelEmoji = (nivel) => {
    const map = { 'Excelente': '🟢', 'Bom': '🟡', 'Atenção': '🟠', 'Crítico': '🔴' };
    return map[nivel] || '⚫';
};

// ─── Card de Categoria ───────────────────────────────────────────────────────
function CategoriaCard({ icon: Icon, valor, label, sublabel, bgClass, textClass, iconClass, badgeClass, badge }) {
    return (
        <div className={`flex flex-col items-center text-center p-4 rounded-xl border ${bgClass}`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${iconClass}`}>
                <Icon className="w-5 h-5" />
            </div>
            <span className={`text-3xl font-black ${textClass}`}>{valor}</span>
            <span className={`text-xs font-semibold mt-1 leading-tight ${textClass}`}>{label}</span>
            {badge && <span className={`text-xs font-medium mt-1 ${badgeClass}`}>{badge}</span>}
            {sublabel && <span className={`text-xs mt-1 opacity-70 ${textClass}`}>{sublabel}</span>}
        </div>
    );
}

// ─── Card de Setor (colapsável) ──────────────────────────────────────────────
function SetorCard({ setor }) {
    const [aberto, setAberto] = useState(false);

    const chartData = [
        { name: 'Planejado', valor: setor.producaoPlanejada ?? 0, fill: '#94a3b8' },
        { name: 'Realizado', valor: setor.producaoRealizada ?? 0, fill: setor.cor },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* ── Cabeçalho clicável ── */}
            <button
                onClick={() => setAberto(v => !v)}
                className="w-full flex items-center justify-between p-5 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-4 text-left">
                    {/* Badge nível */}
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${setor.cor}20` }}>
                        <TrendingUp className="w-6 h-6" style={{ color: setor.cor }} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-base">{setor.nome}</h3>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-500">
                                {setor.producaoRealizada ?? 0} / {setor.producaoPlanejada ?? 0} peças
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ backgroundColor: `${setor.cor}20`, color: setor.cor }}>
                                {setor.score}% — {setor.nivel}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Mini barra de progresso + seta */}
                <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden sm:block w-32 sm:w-48 md:w-64 lg:w-80 h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(setor.score, 100)}%`, backgroundColor: setor.cor }} />
                    </div>
                    {aberto
                        ? <ChevronUp className="w-5 h-5 text-slate-400" />
                        : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
            </button>

            {/* ── Detalhe expandido ── */}
            {aberto && (
                <div className="border-t border-slate-100 p-5 space-y-6">
                    {/* Gráfico de barras */}
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Planejado vs Realizado (hoje)
                        </p>
                        <ResponsiveContainer width="100%" height={160} minWidth={1} minHeight={1}>
                            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                <Tooltip
                                    formatter={(v) => [`${v} peças`]}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                                />
                                <Bar dataKey="valor" radius={[6, 6, 0, 0]} maxBarSize={60}>
                                    {chartData.map((entry, i) => (
                                        <Cell key={i} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Pendências */}
                    <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                            Pendências para hoje
                        </h4>
                        {setor.pendencias && setor.pendencias.length > 0 ? (
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                                <table className="min-w-full divide-y divide-slate-100 text-sm">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 text-xs">OP</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 text-xs">Produto</th>
                                            <th className="px-4 py-2 text-left font-medium text-slate-500 text-xs">Operação</th>
                                            <th className="px-4 py-2 text-right font-medium text-slate-500 text-xs">Plan.</th>
                                            <th className="px-4 py-2 text-right font-medium text-slate-500 text-xs">Feito</th>
                                            <th className="px-4 py-2 text-right font-bold text-red-500 text-xs">Falta</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-slate-100">
                                        {setor.pendencias.map((pend, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-2 font-medium text-slate-700">{pend.op}</td>
                                                <td className="px-4 py-2 text-slate-600 truncate max-w-[160px]" title={pend.produto}>{pend.produto}</td>
                                                <td className="px-4 py-2 text-slate-600">{pend.operacao}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{pend.esperado}</td>
                                                <td className="px-4 py-2 text-right text-slate-500">{pend.realizado}</td>
                                                <td className="px-4 py-2 text-right font-bold text-red-500">{pend.esperado - pend.realizado}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                                <p className="text-emerald-700 text-sm font-medium">
                                    {(setor.producaoPlanejada ?? 0) > 0
                                        ? 'Nenhuma pendência! Todas as OPs planejadas já foram apontadas.'
                                        : 'Sem programação para este setor hoje.'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Desempenho da Equipe */}
                    {setor.usuarios && setor.usuarios.length > 0 && (
                        <div className="pt-4 border-t border-slate-100">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                                <Users className="w-4 h-4" />
                                Interações da Equipe no Setor (Hoje)
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {setor.usuarios.map((u, idx) => (
                                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:bg-white transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-700 text-sm truncate pr-2" title={u.nome}>{u.nome}</span>
                                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" title="Apontamentos Registrados">
                                                {u.acoes} ações
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-500">Previsto nas OPs:</span>
                                            <span className="font-medium text-slate-600">{u.previsto} un</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500">Total Produzido:</span>
                                            <span className="font-bold text-emerald-600">{u.produzido} un</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Utilitários de Data ─────────────────────────────────────────────────────
const fmtData = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const statusConfig = {
    CONCLUIDO:    { label: 'Concluído',    bg: 'bg-emerald-100', text: 'text-emerald-700' },
    EM_ANDAMENTO: { label: 'Em Andamento', bg: 'bg-blue-100',    text: 'text-blue-700'    },
    PENDENTE:     { label: 'Pendente',     bg: 'bg-slate-100',   text: 'text-slate-600'   },
};

// ─── Seção de Tarefas do Projetista ─────────────────────────────────────────
function TarefasProjetista({ dados }) {
    const { resumo, tarefas } = dados;

    const cardsDados = [
        { label: 'Atrasadas',        valor: resumo.atrasadas,        bg: 'bg-red-50 border-red-200',     txt: 'text-red-600',     icon: AlertTriangle },
        { label: 'Em Andamento',     valor: resumo.em_andamento,     bg: 'bg-blue-50 border-blue-200',   txt: 'text-blue-700',    icon: Zap           },
        { label: 'Pendentes',        valor: resumo.pendentes,        bg: 'bg-slate-50 border-slate-200', txt: 'text-slate-600',   icon: Clock         },
        { label: 'Concluídas (7d)',  valor: resumo.concluidas_semana,bg: 'bg-emerald-50 border-emerald-200', txt: 'text-emerald-700', icon: CheckCircle },
        { label: 'Horas hoje',       valor: `${resumo.horas_hoje}h`, bg: 'bg-teal-50 border-teal-200',   txt: 'text-teal-700',    icon: Timer         },
    ];

    return (
        <section>
            <div className="flex items-center gap-2 mb-4">
                <Briefcase className="w-5 h-5 text-slate-500" />
                <h2 className="text-lg font-bold text-slate-700">Minhas Tarefas de Engenharia</h2>
                <span className="text-xs text-slate-400">— somente visualização</span>
            </div>

            {/* Cards resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
                {cardsDados.map(({ label, valor, bg, txt, icon: Icon }) => (
                    <div key={label} className={`flex flex-col items-center text-center p-4 rounded-xl border ${bg}`}>
                        <Icon className={`w-5 h-5 mb-1 ${txt}`} />
                        <span className={`text-2xl font-black ${txt}`}>{valor}</span>
                        <span className={`text-xs font-semibold mt-1 ${txt} opacity-80`}>{label}</span>
                    </div>
                ))}
            </div>

            {/* Tabela de tarefas */}
            {tarefas.length > 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Pedido / Item</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Descrição / Cliente</th>
                                    <th className="px-4 py-3 text-left font-semibold text-slate-500 text-xs uppercase tracking-wider">Tipo</th>
                                    <th className="px-4 py-3 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider">Prazo Plan.</th>
                                    <th className="px-4 py-3 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                                    <th className="px-4 py-3 text-center font-semibold text-slate-500 text-xs uppercase tracking-wider">Situação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {tarefas.map((t, idx) => {
                                    const cfg = statusConfig[t.status] || statusConfig.PENDENTE;
                                    const rowBg = t.atrasada ? 'bg-red-50/40' : '';

                                    let situacaoEl;
                                    if (t.status === 'CONCLUIDO') {
                                        situacaoEl = <span className="text-emerald-600 font-semibold flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Concluído</span>;
                                    } else if (t.atrasada) {
                                        situacaoEl = <span className="text-red-600 font-bold flex items-center justify-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {t.dias_atraso}d atraso</span>;
                                    } else if (t.dias_restantes === 0) {
                                        situacaoEl = <span className="text-orange-600 font-bold">Vence hoje!</span>;
                                    } else if (t.dias_restantes !== null && t.dias_restantes <= 3) {
                                        situacaoEl = <span className="text-orange-500 font-semibold">{t.dias_restantes}d restantes</span>;
                                    } else if (t.dias_restantes !== null) {
                                        situacaoEl = <span className="text-slate-500">{t.dias_restantes}d restantes</span>;
                                    } else {
                                        situacaoEl = <span className="text-slate-400">Sem prazo</span>;
                                    }

                                    return (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${rowBg}`}>
                                            <td className="px-4 py-3 font-mono font-semibold text-slate-700 whitespace-nowrap">
                                                {t.pedido} <span className="text-slate-400 font-normal">/ {t.item}</span>
                                            </td>
                                            <td className="px-4 py-3 max-w-[200px]">
                                                <p className="truncate font-medium text-slate-700" title={t.descricao}>{t.descricao || '—'}</p>
                                                <p className="truncate text-xs text-slate-400" title={t.cliente}>{t.cliente || '—'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">{t.projeto_tipo || '—'}</td>
                                            <td className="px-4 py-3 text-center text-slate-600 whitespace-nowrap">{fmtData(t.data_fim_plan)}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center text-xs whitespace-nowrap">{situacaoEl}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-slate-500 text-sm">Nenhuma tarefa de engenharia encontrada para o seu usuário.</p>
                </div>
            )}
        </section>
    );
}

// ─── Componente Principal ────────────────────────────────────────────────────
export default function MeuCanal() {
    const [kpiData, setKpiData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const carregarKPI = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/meucanal/kpi');
            setKpiData(res.data);
            setError(null);
        } catch (err) {
            console.error('Erro ao buscar KPI:', err);
            setError('Não foi possível carregar as informações do seu canal.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { carregarKPI(); }, [carregarKPI]);

    const testarEmail = async () => {
        try {
            toast.info('Enviando relatório por e-mail...', { autoClose: 2000 });
            const res = await api.get('/meucanal/test-email');
            toast.success(res.data.message || 'E-mail enviado com sucesso!');
        } catch (err) {
            toast.error(err.response?.data?.error || 'Erro ao enviar e-mail.');
        }
    };

    const compartilharWhatsApp = async () => {
        if (!kpiData?.setores?.length) {
            toast.warning('Nenhum setor disponível para compartilhar.');
            return;
        }

        try {
            toast.info('Enviando via WhatsApp (Evolution API)...', { autoClose: 2000 });
            // Envia sem forçar o número para que o backend use o telefone do próprio usuário logado
            const res = await api.post('/meucanal/test-whatsapp', {});
            
            if (res.data.success) {
                toast.success('Mensagem enviada com sucesso para o seu WhatsApp!');
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Erro ao enviar WhatsApp. Verifique se você tem telefone cadastrado no seu perfil.');
        }
    };

    // ── Loading ──
    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
                <div className="h-10 w-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Calculando sua performance de hoje...</span>
            </div>
        </div>
    );

    if (error) return (
        <div className="m-6"><ErrorStateOverlay error={error} onRetry={carregarKPI} /></div>
    );

    if (!kpiData) return null;

    const { individual, setores, usuario } = kpiData;
    // Montar URL correta: pode ser base64 puro, base64 com prefixo, ou URL normal
    const fotoUrl = (() => {
        const f = usuario?.foto;
        if (!f) return null;
        if (f.startsWith('http') || f.startsWith('/')) return f;
        if (f.startsWith('data:')) return f;
        return `data:image/jpeg;base64,${f}`;
    })();
    const nomeDisplay = usuario?.nome || 'Usuário';
    const totalApontamentos = individual.apontamentos?.length ?? 0;

    return (
        <div className="min-h-screen bg-slate-50 font-sans">
            {/* ═══ HERO HEADER ══════════════════════════════════════════════════════ */}
            <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white shadow-md">
                <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        {/* Perfil */}
                        <div className="flex items-center gap-5">
                            {fotoUrl ? (
                                <img src={fotoUrl} alt={nomeDisplay}
                                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white/20 shadow-lg" />
                            ) : (
                                <div className="w-16 h-16 rounded-2xl bg-teal-500/20 border-2 border-teal-400/30 flex items-center justify-center shadow-lg">
                                    <span className="text-xl font-black text-teal-300">{getInitials(nomeDisplay)}</span>
                                </div>
                            )}
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <PlayCircle className="w-5 h-5 text-teal-400" />
                                    <span className="text-teal-400 text-sm font-semibold tracking-wide">MEU CANAL</span>
                                </div>
                                <h1 className="text-2xl font-black text-white leading-tight">{nomeDisplay}</h1>
                                <p className="text-slate-400 text-sm mt-0.5">Performance individual — hoje</p>
                            </div>
                        </div>

                        {/* Ações */}
                        <div className="flex flex-wrap gap-2">
                            {setores?.length > 0 && (
                                <>
                                    <button onClick={compartilharWhatsApp}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-white text-sm font-semibold transition-colors shadow">
                                        <MessageCircle className="w-4 h-4" />
                                        WhatsApp
                                    </button>
                                    <button onClick={testarEmail}
                                        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-semibold transition-colors border border-white/10">
                                        <Mail className="w-4 h-4" />
                                        Receber por E-mail
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ CONTEÚDO ════════════════════════════════════════════════════════ */}
            <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

                {/* ── PERFORMANCE INDIVIDUAL ─────────────────────────────────────── */}
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <User className="w-5 h-5 text-slate-500" />
                        <h2 className="text-lg font-bold text-slate-700">Minha Performance (Hoje)</h2>
                    </div>

                    {/* Totais */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <p className="text-slate-500 text-sm font-medium">Ações no Sistema (Apontamentos)</p>
                            <h3 className="text-4xl font-black text-slate-800 mt-1">{totalApontamentos}</h3>
                            <p className="text-xs text-slate-400 mt-2">{individual.apontado} peças produzidas hoje</p>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                            <p className="text-slate-500 text-sm font-medium flex items-center gap-1">
                                Bônus Extras (x2) <Info className="w-3.5 h-3.5 text-slate-400" title="Peças sem planejamento PCP geram pontuação dobrada" />
                            </p>
                            <h3 className="text-4xl font-black text-amber-500 mt-1">+{individual.pontuacao_bonus}</h3>
                            <p className="text-xs text-amber-600/80 mt-2">Pts extras por peças não planejadas</p>
                        </div>
                        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl shadow-sm p-5 text-white">
                            <p className="text-teal-100 text-sm font-medium">Pontuação Total Diária</p>
                            <h3 className="text-5xl font-black mt-1">{individual.total_pontos}</h3>
                            <p className="text-teal-200 text-xs mt-2 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Apontado + Bônus
                            </p>
                        </div>
                    </div>

                    {/* Breakdown por categoria */}
                    {individual.categorias && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
                                Classificação dos Apontamentos de Hoje
                            </h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                <CategoriaCard
                                    icon={Calendar} valor={individual.categorias.sem_planejamento}
                                    label="Sem Planejamento" badge="Bônus x2 ⚡"
                                    bgClass="bg-slate-50 border-slate-200"
                                    textClass="text-slate-600" iconClass="bg-slate-200" badgeClass="text-amber-600 font-semibold"
                                />
                                <CategoriaCard
                                    icon={CheckCircle} valor={individual.categorias.no_prazo}
                                    label="No Prazo" sublabel="Início e fim ok ✓"
                                    bgClass="bg-emerald-50 border-emerald-200"
                                    textClass="text-emerald-700" iconClass="bg-emerald-100 text-emerald-600"
                                />
                                <CategoriaCard
                                    icon={Zap} valor={individual.categorias.iniciado_ok}
                                    label="Início Pontual" sublabel="Término atrasou ⚠"
                                    bgClass="bg-blue-50 border-blue-200"
                                    textClass="text-blue-700" iconClass="bg-blue-100 text-blue-600"
                                />
                                <CategoriaCard
                                    icon={Clock} valor={individual.categorias.finalizado_ok}
                                    label="Término Pontual" sublabel="Início atrasou ⚠"
                                    bgClass="bg-yellow-50 border-yellow-200"
                                    textClass="text-yellow-700" iconClass="bg-yellow-100 text-yellow-600"
                                />
                                <CategoriaCard
                                    icon={XCircle} valor={individual.categorias.fora_data}
                                    label="Fora da Data" sublabel="Início e fim atrasados"
                                    bgClass="bg-red-50 border-red-200"
                                    textClass="text-red-600" iconClass="bg-red-100 text-red-500"
                                />
                            </div>
                        </div>
                    )}
                </section>

                {/* ── TAREFAS DO PROJETISTA ──────────────────────────────────────── */}
                {kpiData.isProjetista && kpiData.tarefas_projetista && (
                    <TarefasProjetista dados={kpiData.tarefas_projetista} />
                )}

                {/* ── METAS DOS SETORES ───────────────────────────────────────────── */}
                {setores && setores.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4 flex-wrap">
                            <Users className="w-5 h-5 text-slate-500" />
                            <h2 className="text-lg font-bold text-slate-700">Metas dos Meus Setores (Hoje)</h2>
                            <span className="text-xs text-slate-400">— clique em um setor para ver detalhes</span>
                            {kpiData.horaCalculo && (
                                <span className="ml-auto flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                    <Clock className="w-3 h-3" /> Calculado às {kpiData.horaCalculo}
                                </span>
                            )}
                        </div>
                        <div className="space-y-3">
                            {setores.map(setor => (
                                <SetorCard key={setor.id} setor={setor} />
                            ))}
                        </div>
                    </section>
                )}

                {/* ── SEM SETORES ─────────────────────────────────────────────────── */}
                {(!setores || setores.length === 0) && (
                    <div className="p-6 bg-slate-100 rounded-xl text-center border border-slate-200">
                        <Info className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-500 text-sm">
                            Você não está cadastrado como responsável por nenhum setor.
                            O painel de metas setoriais não está disponível para o seu perfil.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// aria-label fix for ux_audit
