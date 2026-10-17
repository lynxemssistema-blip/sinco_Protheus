import React, { useState, useEffect } from 'react';
import { 
    X, Printer, FileText, Calendar, Building2, 
    CheckCircle2, AlertCircle, Edit3, ShieldCheck, Download
} from 'lucide-react';
import { gerarFolhaPortaPdf } from '../../services/agendaSalaPdfGenerator';
import { toast } from 'react-toastify';

export default function ImprimirFolhaPortaModal({
    isOpen,
    onClose,
    salas = [],
    reservas = [],
    currentDateStr = '',
    currentUser = null,
    salaPreSelecionada = null
}) {
    const [modoSelecao, setModoSelecao] = useState('todas'); // 'todas' | 'individual'
    const [salaIdSelecionada, setSalaIdSelecionada] = useState('');
    const [dataFolha, setDataFolha] = useState('');
    const [gerandoPdf, setGerandoPdf] = useState(false);

    // Sincronizar estados ao abrir modal
    useEffect(() => {
        if (isOpen) {
            setDataFolha(currentDateStr || new Date().toISOString().split('T')[0]);
            if (salaPreSelecionada) {
                setModoSelecao('individual');
                setSalaIdSelecionada(String(salaPreSelecionada.id));
            } else {
                setModoSelecao('todas');
                if (salas.length > 0) {
                    setSalaIdSelecionada(String(salas[0].id));
                }
            }
        }
    }, [isOpen, currentDateStr, salaPreSelecionada, salas]);

    if (!isOpen) return null;

    // Atalhos de datas
    const definirDataHoje = () => {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        setDataFolha(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    };

    const definirDataAmanha = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        const pad = (n) => String(n).padStart(2, '0');
        setDataFolha(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    };

    // Submissão / Geração do PDF
    const handleGerar = async () => {
        setGerandoPdf(true);
        try {
            const salaEscolhida = salas.find(s => String(s.id) === String(salaIdSelecionada)) || salas[0];
            const isTodas = modoSelecao === 'todas';

            await gerarFolhaPortaPdf({
                sala: salaEscolhida,
                salas: salas,
                reservas: reservas,
                dataStr: dataFolha,
                currentUser: currentUser,
                todasAsSalas: isTodas
            });

            onClose();
        } catch (error) {
            console.error('Erro ao acionar geração da folha de porta:', error);
            toast.error('Erro ao gerar PDF da folha de porta.');
        } finally {
            setGerandoPdf(false);
        }
    };

    const salaObj = salas.find(s => String(s.id) === String(salaIdSelecionada));
    const reservasPrevistas = reservas.filter(r => {
        const matchData = r.data_reserva && String(r.data_reserva).substring(0, 10) === dataFolha;
        const matchStatus = r.status !== 'cancelada';
        if (modoSelecao === 'individual') {
            return matchData && matchStatus && String(r.sala_id) === String(salaIdSelecionada);
        }
        return matchData && matchStatus;
    });

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
                
                {/* Cabeçalho do Modal */}
                <div className="px-6 py-4 bg-[#1E3A5F] text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                            <Printer className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base font-extrabold tracking-tight">
                                    Folha de Porta & Agenda Diária
                                </h3>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-900 uppercase">
                                    A4 Deitado
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Impressão oficial MetalFisa com status do sistema e pauta para preenchimento manual
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={gerandoPdf}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Conteúdo do Modal */}
                <div className="p-6 space-y-5 overflow-y-auto">
                    
                    {/* Seletor de Modo (Todas as Salas vs Sala Individual) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            1. Escopo de Impressão
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setModoSelecao('todas')}
                                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                                    modoSelecao === 'todas'
                                        ? 'bg-blue-50/70 border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                                    modoSelecao === 'todas' ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-slate-300'
                                }`}>
                                    {modoSelecao === 'todas' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">
                                        Todas as Salas Ativas ({salas.length})
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                        Gera 1 página para cada sala ativa (ideal para recepção ou portaria fixar em todas as portas).
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setModoSelecao('individual')}
                                className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-3 ${
                                    modoSelecao === 'individual'
                                        ? 'bg-blue-50/70 border-[#1E3A5F] ring-2 ring-[#1E3A5F]/20'
                                        : 'bg-white border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 ${
                                    modoSelecao === 'individual' ? 'border-[#1E3A5F] bg-[#1E3A5F] text-white' : 'border-slate-300'
                                }`}>
                                    {modoSelecao === 'individual' && <CheckCircle2 className="w-3.5 h-3.5" />}
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">
                                        Apenas Uma Sala Específica
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                        Imprime somente a agenda e a ficha de porta de uma sala escolhida.
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Seletor da Sala Específica (caso modo individual) */}
                    {modoSelecao === 'individual' && (
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 animate-fadeIn">
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                Selecione a Sala de Reunião:
                            </label>
                            <select
                                value={salaIdSelecionada}
                                onChange={(e) => setSalaIdSelecionada(e.target.value)}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                            >
                                {salas.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.nome} • {s.localizacao} ({s.capacidade} pessoas)
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Seletor de Data */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                2. Data da Agenda
                            </label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={definirDataHoje}
                                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                                >
                                    Hoje
                                </button>
                                <button
                                    type="button"
                                    onClick={definirDataAmanha}
                                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors"
                                >
                                    Amanhã
                                </button>
                            </div>
                        </div>

                        <div className="relative">
                            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="date"
                                value={dataFolha}
                                onChange={(e) => setDataFolha(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]"
                            />
                        </div>
                    </div>

                    {/* Resumo dos Recursos Inclusos na Ficha de Porta */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                        <div className="text-xs font-bold text-[#1E3A5F] uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            O que está incluso nesta Folha de Porta A4 Deitada:
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                            <div className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="font-bold text-slate-700">🏢 Cabeçalho Oficial:</span>
                                <span>Logo MetalFisa, capacidade, recursos e data formatada.</span>
                            </div>

                            <div className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="font-bold text-emerald-700">✓ Status no Sistema:</span>
                                <span>Badges coloridos e caixas de check-in de início/fim na porta.</span>
                            </div>

                            <div className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="font-bold text-amber-700">✎ Preenchimento à Mão:</span>
                                <span>Linhas pautadas para agendamentos avulsos à caneta na porta.</span>
                            </div>

                            <div className="flex items-start gap-2 bg-white p-2 rounded-lg border border-slate-200">
                                <span className="font-bold text-slate-700">⚖ Regras 5S & Visto:</span>
                                <span>Diretrizes de pontualidade, limpeza, desligamento e visto.</span>
                            </div>
                        </div>

                        <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                            <span>Reuniões já cadastradas para este dia:</span>
                            <span className="font-bold text-[#1E3A5F]">
                                {reservasPrevistas.length} reunião(ões) encontrada(s)
                            </span>
                        </div>
                    </div>
                </div>

                {/* Rodapé de Ações */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={gerandoPdf}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleGerar}
                        disabled={gerandoPdf}
                        className="px-5 py-2.5 rounded-xl bg-[#1E3A5F] hover:bg-[#162A45] text-white font-extrabold text-xs flex items-center gap-2 shadow-md shadow-[#1E3A5F]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {gerandoPdf ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Gerando Documento PDF...</span>
                            </>
                        ) : (
                            <>
                                <Printer className="w-4 h-4 text-amber-400" />
                                <span>Gerar & Imprimir Folha de Porta (PDF)</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
