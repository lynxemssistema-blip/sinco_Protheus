import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, Calendar, Lock, CheckCircle2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { downloadRelatorioTratamentoExcel } from '../../services/api';

export default function RelatorioTratamentoModal({ isOpen, onClose, canViewFinancials }) {
    const [months, setMonths] = useState(5);
    const [includeFinancials, setIncludeFinancials] = useState(false);
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState(null);

    if (!isOpen) return null;

    const handleDownload = async () => {
        setLoading(true);
        setSuccessMessage(null);
        try {
            // Se o usuário não tem permissão, sempre força false
            const withFin = canViewFinancials ? includeFinancials : false;
            await downloadRelatorioTratamentoExcel(months, withFin);
            setSuccessMessage('Relatório Excel gerado e baixado com sucesso!');
            setTimeout(() => {
                setSuccessMessage(null);
                onClose();
            }, 1800);
        } catch (err) {
            alert('Erro ao gerar relatório: ' + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div 
                className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col scale-100 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-tight">Relatório de Envios para Tratamento</h3>
                            <p className="text-xs text-slate-300 mt-0.5">KMI, Suprema e Alfatec (Protheus CFOP 5901)</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 text-slate-700">
                    {/* Period selection */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            Período de Análise
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {[
                                { label: 'Últimos 5 Meses', value: 5, badge: 'Recomendado' },
                                { label: 'Últimos 3 Meses', value: 3 },
                                { label: 'Últimos 6 Meses', value: 6 },
                                { label: 'Últimos 12 Meses', value: 12 },
                                { label: 'Todo o Histórico', value: 0 },
                            ].map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setMonths(opt.value)}
                                    className={`relative p-3 rounded-xl text-left border transition ${
                                        months === opt.value
                                            ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-semibold ring-2 ring-blue-600/20'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                                    }`}
                                >
                                    {opt.badge && (
                                        <span className="absolute -top-2 right-2 px-1.5 py-0.5 bg-blue-600 text-[10px] text-white font-bold rounded-full uppercase tracking-tighter">
                                            {opt.badge}
                                        </span>
                                    )}
                                    <div className="text-xs">{opt.label}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Financial Permission Box */}
                    <div className="rounded-xl border p-4 bg-slate-50 border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                {canViewFinancials ? (
                                    <Sparkles className="w-4 h-4 text-emerald-600" />
                                ) : (
                                    <Lock className="w-4 h-4 text-amber-600" />
                                )}
                                Dados Financeiros (R$)
                            </span>
                            {canViewFinancials ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Permissão Ativa
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    Acesso Restrito
                                </span>
                            )}
                        </div>

                        {canViewFinancials ? (
                            <label className="flex items-start gap-3 cursor-pointer select-none mt-2 p-2.5 bg-white rounded-lg border border-slate-200 hover:border-blue-300 transition">
                                <input
                                    type="checkbox"
                                    checked={includeFinancials}
                                    onChange={(e) => setIncludeFinancials(e.target.checked)}
                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                />
                                <div>
                                    <span className="text-xs font-semibold text-slate-800 block">
                                        Incluir Valores Faturados (R$) e Preço Médio (R$/KG)
                                    </span>
                                    <span className="text-[11px] text-slate-500 leading-tight block mt-0.5">
                                        Adiciona as colunas de valor total de notas, valor unitário e preço médio nas 4 abas da planilha.
                                    </span>
                                </div>
                            </label>
                        ) : (
                            <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs leading-relaxed">
                                <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-semibold">O relatório será gerado sem valores monetários.</p>
                                    <p className="text-[11px] text-amber-700 mt-0.5">
                                        A inclusão de valores financeiros (R$) requer a permissão <strong>"Valores Financeiros"</strong> liberada para o seu usuário pelo Administrador.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Features list */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5 text-xs text-slate-600">
                        <p className="font-semibold text-slate-800 text-[11px] uppercase tracking-wider mb-1">
                            Conteúdo da Planilha Excel (.xlsx):
                        </p>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span><strong>Aba 1: Resumo Mensal (KG)</strong> — Matriz consolidada por fornecedor</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span><strong>Aba 2: Consolidado por Fornecedor</strong> — Totais e quantidade de notas</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span><strong>Aba 3: NFs de Remessa (Saída)</strong> — Relação completa nota a nota</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span><strong>Aba 4: Retornos e Serviços (Entradas)</strong> — Notas de retorno recebidas</span>
                        </div>
                    </div>

                    {successMessage && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            {successMessage}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-100 p-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        onClick={handleDownload}
                        disabled={loading}
                        className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl flex items-center gap-2 shadow-sm shadow-emerald-500/20 transition disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Gerando Planilha...
                            </>
                        ) : (
                            <>
                                <Download className="w-4 h-4" />
                                Baixar Relatório em Excel
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
