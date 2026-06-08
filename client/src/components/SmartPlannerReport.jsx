import React, { useRef, useState } from 'react';
import { X, Printer, CheckCircle, AlertTriangle, Clock, Cpu, BarChart2, TrendingUp, Sparkles, Loader2, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import api from '../services/api';

export default function SmartPlannerReport({ report, onClose }) {
    const printRef = useRef(null);
    const [aiAnalysis, setAiAnalysis] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [expandedRows, setExpandedRows] = useState(new Set());

    const toggleRow = (i) => setExpandedRows(prev => {
        const next = new Set(prev);
        next.has(i) ? next.delete(i) : next.add(i);
        return next;
    });

    const handleAiAnalyze = async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const res = await api.post('/pcp-refinado/smart-plan/analyze', { report });
            setAiAnalysis(res.data.analise);
        } catch (e) {
            setAiError(e.response?.data?.error || 'Erro ao consultar IA.');
        } finally {
            setAiLoading(false);
        }
    };

    if (!report) return null;

    const formatDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
    const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString('pt-BR') : '-';

    const resumoRecursos = Object.values(report.resumo_recursos || {});
    const decisoes = report.decisoes || [];
    const totalMinutos = resumoRecursos.reduce((s, r) => s + r.total_minutos_alocados, 0);
    const comExcesso = decisoes.filter(d => d.excede_capacidade_dia).length;
    const comMultiplosDias = decisoes.filter(d => d.span_multiplos_dias).length;

    // Barra de capacidade visual
    const CapBar = ({ pct }) => {
        if (pct === null || pct === undefined) return <span className="text-slate-400 text-[9px]">—</span>;
        const capped = Math.min(pct, 200);
        const color = pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-400' : 'bg-emerald-500';
        return (
            <div className="flex items-center gap-1.5">
                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                    <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${(capped / 200) * 100}%` }} />
                </div>
                <span className={`text-[10px] font-bold tabular-nums ${pct > 100 ? 'text-red-600' : pct > 80 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {pct}%
                </span>
            </div>
        );
    };

    const handlePrint = () => {
        const printContent = printRef.current.innerHTML;
        const win = window.open('', '_blank', 'width=1050,height=750');
        win.document.write(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8"/>
                <title>Relatório FCS - MetalFisa</title>
                <style>
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; background: #fff; padding: 16px; }
                    .page { max-width: 1000px; margin: 0 auto; }
                    h1 { font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em; }
                    h2 { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.04em; color: #1e40af; border-bottom: 1px solid #bfdbfe; padding-bottom: 4px; margin: 12px 0 6px; }
                    .header { border-bottom: 2px solid #1e293b; padding-bottom: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; }
                    .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-bottom: 10px; }
                    .kpi { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 6px; text-align: center; }
                    .kpi-val { font-size: 15px; font-weight: bold; color: #1e40af; }
                    .kpi-lbl { font-size: 8px; color: #475569; margin-top: 2px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 8px; }
                    th { background: #1e293b; color: #fff; padding: 4px 5px; text-align: left; text-transform: uppercase; }
                    td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
                    tr.excede td { background: #fff1f2 !important; }
                    tr.ok-row:nth-child(even) td { background: #f8fafc; }
                    .badge-red { background: #fee2e2; color: #991b1b; padding: 1px 5px; border-radius: 8px; font-size: 7px; font-weight: bold; white-space: nowrap; }
                    .badge-amber { background: #fef3c7; color: #92400e; padding: 1px 5px; border-radius: 8px; font-size: 7px; font-weight: bold; white-space: nowrap; }
                    .badge-green { background: #dcfce7; color: #166534; padding: 1px 5px; border-radius: 8px; font-size: 7px; font-weight: bold; white-space: nowrap; }
                    .cap-bar { display: inline-block; width: 50px; height: 6px; background: #e2e8f0; border-radius: 3px; vertical-align: middle; overflow: hidden; }
                    .cap-bar-fill { height: 100%; border-radius: 3px; }
                    .alert-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 4px; padding: 6px 8px; margin-bottom: 4px; }
                    .ok-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 6px 8px; }
                    .footer { margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between; }
                    @media print { body { padding: 0; } @page { margin: 12mm; } }
                </style>
            </head>
            <body>
                <div class="page">${printContent}</div>
                <script>window.onload = () => { window.print(); }<\/script>
            </body>
            </html>
        `);
        win.document.close();
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[95vh] overflow-hidden">

                {/* Toolbar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
                    <div className="flex items-center gap-2 text-slate-700 font-bold">
                        <BarChart2 className="w-5 h-5 text-indigo-600" />
                        Relatório do Agente FCS — Planejamento Inteligente
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleAiAnalyze}
                            disabled={aiLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-lg shadow transition-all active:scale-95"
                        >
                            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {aiLoading ? 'Analisando...' : 'Analisar com IA'}
                        </button>
                        <button onClick={handlePrint}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow transition-all active:scale-95">
                            <Printer className="w-4 h-4" /> Exportar PDF
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Report Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    <div ref={printRef}>

                        {/* === CABEÇALHO METALFISA === */}
                        <div className="border-b-2 border-slate-800 pb-4 mb-5 flex justify-between items-start">
                            <div>
                                <h1 className="text-base font-extrabold uppercase tracking-widest text-slate-900">
                                    Relatório de Planejamento Inteligente FCS
                                </h1>
                                <p className="text-slate-500 text-xs mt-0.5">MetalFisa — Sistema de Gestão da Produção</p>
                                <p className="text-slate-400 text-[10px] mt-0.5">Motor: FCS Determinístico — Algoritmo de Capacidade Finita com Diagnóstico de Gargalos</p>
                            </div>
                            <div className="text-right text-xs text-slate-600">
                                <p className="font-bold">{formatDateTime(report.gerado_em)}</p>
                                <p className="mt-0.5">Planejador: <strong>{report.planejador}</strong></p>
                                <p>Data Base: <strong>{formatDate(report.data_base)}</strong></p>
                            </div>
                        </div>

                        {/* === KPIs === */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {[
                                { val: report.total_ops, lbl: 'OPs Analisadas', color: 'text-slate-800', bg: 'bg-slate-50 border-slate-200' },
                                { val: report.total_operacoes_planejadas, lbl: 'Operações Planejadas', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-100' },
                                { val: `${totalMinutos} min`, lbl: 'Carga Total Alocada', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
                                { val: comExcesso, lbl: 'Excedem Cap. Diária ⚠️', color: comExcesso > 0 ? 'text-red-600' : 'text-slate-400', bg: comExcesso > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200' },
                            ].map((k, i) => (
                                <div key={i} className={`border rounded-xl p-4 text-center shadow-sm ${k.bg}`}>
                                    <div className={`text-2xl font-extrabold ${k.color}`}>{k.val}</div>
                                    <div className="text-xs text-slate-500 mt-1">{k.lbl}</div>
                                </div>
                            ))}
                        </div>

                        {/* === ALERTA DE CAPACIDADE === */}
                        {comExcesso > 0 && (
                            <div className="mb-5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-red-800">
                                    <strong>{comExcesso} operação(ões)</strong> excedem a capacidade diária do recurso e foram distribuídas em múltiplos dias.
                                    As linhas estão destacadas em <span className="bg-red-100 text-red-700 font-bold px-1 rounded">vermelho</span> na tabela abaixo.
                                </div>
                            </div>
                        )}

                        {/* === RESUMO POR RECURSO === */}
                        <div className="mb-5">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-700 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-2">
                                <Cpu className="w-4 h-4" /> Capacidade Diária dos Recursos
                            </h2>
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-800 text-white text-[10px]">
                                        <th className="px-3 py-2">Recurso</th>
                                        <th className="px-3 py-2">Descrição</th>
                                        <th className="px-3 py-2 text-right">Cap. Diária (min)</th>
                                        <th className="px-3 py-2 text-right">Total Alocado (min)</th>
                                        <th className="px-3 py-2 text-right">Dias Equivalentes</th>
                                        <th className="px-3 py-2 text-center">Ocupação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {resumoRecursos.map((r, i) => {
                                        const diasEquiv = r.capacidade_diaria_min > 0
                                            ? (r.total_minutos_alocados / r.capacidade_diaria_min).toFixed(1)
                                            : '—';
                                        const pct = r.capacidade_diaria_min > 0
                                            ? Math.round((r.total_minutos_alocados / r.capacidade_diaria_min) * 100)
                                            : null;
                                        const isGargalo = pct !== null && pct > 100;
                                        return (
                                            <tr key={i} className={isGargalo ? 'bg-red-50' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                                <td className={`px-3 py-2 font-bold font-mono ${isGargalo ? 'text-red-700' : ''}`}>{r.recurso}</td>
                                                <td className="px-3 py-2 text-slate-600">{r.desc_recurso || '—'}</td>
                                                <td className="px-3 py-2 text-right">{r.capacidade_diaria_min} min</td>
                                                <td className={`px-3 py-2 text-right font-bold ${isGargalo ? 'text-red-700' : 'text-indigo-700'}`}>
                                                    {r.total_minutos_alocados} min
                                                </td>
                                                <td className="px-3 py-2 text-right">{diasEquiv} dias</td>
                                                <td className="px-3 py-2">
                                                    <CapBar pct={pct} />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* === TABELA DE DECISÕES === */}
                        <div className="mb-5">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-700 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Decisões do Agente por Operação
                            </h2>
                            <table className="w-full text-left text-[10px] border-collapse">
                                <thead>
                                    <tr className="bg-slate-800 text-white">
                                        <th className="px-2 py-2">OP</th>
                                        <th className="px-2 py-2">Produto</th>
                                        <th className="px-2 py-2">Op.</th>
                                        <th className="px-2 py-2">Recurso / Descrição</th>
                                        <th className="px-2 py-2 text-right">T.Unit (min)</th>
                                        <th className="px-2 py-2 text-right">Qtd</th>
                                        <th className="px-2 py-2 text-right">Total (min)</th>
                                        <th className="px-2 py-2 text-right">Cap/Dia (min)</th>
                                        <th className="px-2 py-2">Ocup.</th>
                                        <th className="px-2 py-2 text-center">Início</th>
                                        <th className="px-2 py-2 text-center">Fim</th>
                                        <th className="px-2 py-2 text-center">Espera (dias)</th>
                                        <th className="px-2 py-2 text-center">Previsão</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {decisoes.map((d, i) => {
                                        const excede = d.excede_capacidade_dia;
                                        const temFatias = Array.isArray(d.fatias_diarias) && d.fatias_diarias.length > 1;
                                        const isExpanded = expandedRows.has(i);
                                        const rowBg = excede
                                            ? 'bg-red-50 border-l-4 border-l-red-400'
                                            : i % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                                        return (
                                            <React.Fragment key={i}>
                                                <tr
                                                    className={`border-b border-slate-100 ${rowBg} ${temFatias ? 'cursor-pointer hover:brightness-95' : ''}`}
                                                    onClick={temFatias ? () => toggleRow(i) : undefined}
                                                    title={temFatias ? 'Clique para ver o fatiamento diário' : undefined}
                                                >
                                                    <td className="px-2 py-2 font-bold font-mono">
                                                        {temFatias && (
                                                            <span className="mr-1 text-indigo-400">{isExpanded ? '▾' : '▸'}</span>
                                                        )}
                                                        {d.op_numero}
                                                    </td>
                                                    <td className="px-2 py-2 font-mono text-[9px] text-slate-600">{d.produto}</td>
                                                    <td className="px-2 py-2 text-center">{d.operacao}</td>
                                                    <td className="px-2 py-2">
                                                        <div className={`font-bold ${excede ? 'text-red-700' : ''}`}>{d.recurso}</div>
                                                        <div className="text-[9px] text-slate-500">{d.desc_recurso || ''}</div>
                                                    </td>
                                                    <td className="px-2 py-2 text-right">{d.tempo_unitario_min} min</td>
                                                    <td className="px-2 py-2 text-right">{d.qtd_pendente}</td>
                                                    <td className={`px-2 py-2 text-right font-bold ${excede ? 'text-red-600' : 'text-indigo-700'}`}>
                                                        {d.total_minutos_necessarios} min
                                                    </td>
                                                    <td className="px-2 py-2 text-right text-slate-500">{d.capacidade_recurso_min_dia} min</td>
                                                    <td className="px-2 py-2">
                                                        <CapBar pct={d.capacity_pct} />
                                                    </td>
                                                    <td className="px-2 py-2 text-center">{formatDate(d.data_inicio)}</td>
                                                    <td className="px-2 py-2 text-center">{formatDate(d.data_fim)}</td>
                                                    <td className="px-2 py-2 text-center font-bold text-amber-600">{d.dias_espera > 0 ? `${d.dias_espera}d` : '-'}</td>
                                                    <td className="px-2 py-2 text-center">
                                                        {excede ? (
                                                            <span className="bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                ⚠️ {d.dias_necessarios}d
                                                            </span>
                                                        ) : (
                                                            <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                ✅ 1 dia
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                                {temFatias && isExpanded && (
                                                    <tr className="bg-indigo-50">
                                                        <td colSpan={13} className="px-6 py-2">
                                                            <div className="flex flex-wrap gap-2">
                                                                {d.fatias_diarias.map((f, fi) => (
                                                                    <div key={fi} className="flex items-center gap-1 bg-white border border-indigo-200 rounded-md px-2 py-1 text-[10px] shadow-sm">
                                                                        <span className="font-bold text-indigo-700">{formatDate(f.data)}</span>
                                                                        <span className="text-slate-500">→</span>
                                                                        <span className="font-bold text-slate-800">{f.qtd} pcs</span>
                                                                        <span className="text-slate-400">({f.minutos} min)</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* === JUSTIFICATIVAS CRÍTICAS === */}
                        <div className="mb-4">
                            <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-700 border-b border-indigo-100 pb-2 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> Diagnóstico de Gargalos e Justificativas
                            </h2>
                            {decisoes.filter(d => d.excede_capacidade_dia).length === 0 ? (
                                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 text-xs">
                                    <CheckCircle className="w-4 h-4" />
                                    Todas as operações foram alocadas dentro da capacidade diária. Nenhum gargalo detectado.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {decisoes.filter(d => d.excede_capacidade_dia).map((d, i) => (
                                        <div key={i} className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs border-l-4 border-l-red-400">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-bold text-red-900">
                                                    OP {d.op_numero} — Operação {d.operacao} | Recurso: {d.recurso} {d.desc_recurso ? `(${d.desc_recurso})` : ''}
                                                </span>
                                                <span className="bg-red-100 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full">
                                                    {d.capacity_pct}% da cap. diária
                                                </span>
                                            </div>
                                            <p className="text-red-800">{d.justificativa}</p>
                                            <p className="text-red-600 text-[10px] mt-1 italic">
                                                Recomendação: Verificar possibilidade de horas extras, redistribuição de carga ou split de lote para reduzir abaixo de {d.capacidade_recurso_min_dia} min/dia.
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* === ANÁLISE GEMINI IA === */}
                        {aiError && (
                            <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {aiError}
                            </div>
                        )}

                        {!aiAnalysis && !aiLoading && (
                            <div className="mb-4 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-xl px-4 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-indigo-500" />
                                    <div>
                                        <div className="text-sm font-bold text-indigo-800">Análise Inteligente com Gemini IA</div>
                                        <div className="text-xs text-indigo-600">Clique em "Analisar com IA" para obter sugestões e diagnósticos avançados baseados no histórico da produção.</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {aiLoading && (
                            <div className="mb-4 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-6 flex flex-col items-center gap-3">
                                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                                <div className="text-sm font-bold text-indigo-700">Consultando Gemini IA...</div>
                                <div className="text-xs text-indigo-500">Analisando capacidade, histórico de 90 dias e padrões de gargalo.</div>
                            </div>
                        )}

                        {aiAnalysis && (
                            <div className="mb-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-700 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4" /> Análise Inteligente — Gemini IA
                                    </h2>
                                    <div className="flex items-center gap-1.5 text-xs">
                                        {aiAnalysis.indicador_confianca === 'ALTO' ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> :
                                         aiAnalysis.indicador_confianca === 'MÉDIO' ? <ShieldQuestion className="w-4 h-4 text-amber-500" /> :
                                         <ShieldAlert className="w-4 h-4 text-red-500" />}
                                        <span className={`font-bold ${
                                            aiAnalysis.indicador_confianca === 'ALTO' ? 'text-emerald-700' :
                                            aiAnalysis.indicador_confianca === 'MÉDIO' ? 'text-amber-700' : 'text-red-700'
                                        }`}>Confiança {aiAnalysis.indicador_confianca}</span>
                                    </div>
                                </div>

                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
                                    <p className="font-semibold text-indigo-800 mb-1">Resumo Executivo</p>
                                    <p>{aiAnalysis.resumo_executivo}</p>
                                </div>

                                {aiAnalysis.analise_capacidade && (
                                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
                                        <p className="font-semibold text-slate-800 mb-1">Análise de Capacidade</p>
                                        <p>{aiAnalysis.analise_capacidade}</p>
                                    </div>
                                )}

                                {aiAnalysis.analise_gargalos && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
                                        <p className="font-semibold mb-1">Gargalos</p>
                                        <p>{aiAnalysis.analise_gargalos}</p>
                                    </div>
                                )}

                                {aiAnalysis.padroes_detectados && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
                                        <p className="font-semibold mb-1">Padrões Detectados</p>
                                        <p>{aiAnalysis.padroes_detectados}</p>
                                    </div>
                                )}

                                {aiAnalysis.sugestoes?.length > 0 && (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-emerald-800 mb-2">💡 Sugestões do Agente</p>
                                        <ul className="space-y-1">
                                            {aiAnalysis.sugestoes.map((s, i) => (
                                                <li key={i} className="text-xs text-emerald-900 flex gap-2">
                                                    <span className="shrink-0 font-bold">{i + 1}.</span> {s}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {aiAnalysis.alertas?.filter(Boolean).length > 0 && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                                        <p className="text-xs font-semibold text-red-800 mb-2">⚠️ Alertas Críticos</p>
                                        <ul className="space-y-1">
                                            {aiAnalysis.alertas.map((a, i) => (
                                                <li key={i} className="text-xs text-red-900">{a}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <p className="text-[10px] text-slate-400 italic">{aiAnalysis.justificativa_confianca}</p>
                            </div>
                        )}

                        {/* === RODAPÉ METALFISA === */}
                        <div className="mt-8 border-t border-slate-200 pt-4 flex justify-between text-[10px] text-slate-400">
                            <span>MetalFisa — Relatório gerado automaticamente pelo Agente de Planejamento FCS</span>
                            <span>{formatDateTime(report.gerado_em)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
