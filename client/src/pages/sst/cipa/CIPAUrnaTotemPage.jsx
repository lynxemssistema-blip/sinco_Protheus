import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Vote, ShieldCheck, Lock, CheckCircle2, AlertTriangle,
    ArrowLeft, Check, X, User, ChevronRight, Sparkles, RefreshCw,
    Send, Smartphone, Mail, Copy
} from 'lucide-react';
import { getCipaGestoes, getCipaUrnaStatus, votarCipaUrna } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';

export default function CIPAUrnaTotemPage() {
    const navigate = useNavigate();
    const { user } = useAuth();

    const [gestoes, setGestoes] = useState([]);
    const [selectedGestaoId, setSelectedGestaoId] = useState('');
    const [urnaData, setUrnaData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Etapas da Cabine: 'autenticacao' | 'cedula' | 'confirmacao' | 'sucesso'
    const [etapa, setEtapa] = useState('cedula');

    // Seleção de Voto
    const [votoSelecionado, setVotoSelecionado] = useState(null); // { tipo: 'valido', candidato } | { tipo: 'branco' } | { tipo: 'nulo' }
    const [votando, setVotando] = useState(false);
    const [comprovante, setComprovante] = useState(null);
    const [votoResultado, setVotoResultado] = useState(null);
    const [countdown, setCountdown] = useState(20);

    // Carregar Gestões
    useEffect(() => {
        getCipaGestoes().then(res => {
            setGestoes(res || []);
            // Encontrar gestão com eleicao aberta
            const aberta = (res || []).find(g => g.status === 'eleicao') || res[0];
            if (aberta) {
                setSelectedGestaoId(aberta.id);
            }
        }).catch(console.error);
    }, []);

    // Carregar Urna
    const loadUrna = async () => {
        if (!selectedGestaoId) return;
        try {
            setLoading(true);
            const data = await getCipaUrnaStatus(selectedGestaoId);
            setUrnaData(data);
            if (data.ja_votou) {
                setEtapa('ja_votou');
            } else {
                setEtapa('cedula');
            }
        } catch (err) {
            console.error('Erro ao carregar urna:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUrna();
    }, [selectedGestaoId]);

    // Timer de reset pós-sucesso
    useEffect(() => {
        let timer;
        if (etapa === 'sucesso' && countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        } else if (etapa === 'sucesso' && countdown === 0) {
            navigate('/sst/cipa');
        }
        return () => clearTimeout(timer);
    }, [etapa, countdown, navigate]);

    // Confirmar Voto Secreto
    const handleConfirmarVoto = async () => {
        try {
            setVotando(true);
            const payload = {
                tipo_voto: votoSelecionado.tipo,
                candidato_id: votoSelecionado.candidato?.id || null
            };
            const res = await votarCipaUrna(selectedGestaoId, payload);
            setComprovante(res.comprovante_voto || res.hash_comprovante);
            setVotoResultado(res);
            setEtapa('sucesso');
            setCountdown(20);
        } catch (err) {
            alert('Erro ao registrar voto: ' + (err.response?.data?.error || err.message));
        } finally {
            setVotando(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-4 sm:p-8 select-none">
            {/* Topbar da Urna */}
            <div className="max-w-4xl w-full mx-auto flex items-center justify-between border-b border-slate-800 pb-4">
                <button
                    type="button"
                    onClick={() => navigate('/sst/cipa')}
                    className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Voltar ao Painel CIPA</span>
                </button>

                <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Urna Eletrônica Blindada NR-05</span>
                </div>

                <div className="text-right text-xs text-slate-400">
                    Eleitor: <strong className="text-white">{user?.NomeCompleto || user?.nome || 'Colaborador'}</strong>
                </div>
            </div>

            {/* Corpo Central da Cabine de Votação */}
            <div className="max-w-4xl w-full mx-auto my-auto py-8">
                {/* 1. SE JÁ VOTOU */}
                {etapa === 'ja_votou' && (
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-3xl p-8 border border-slate-700 text-center max-w-lg mx-auto shadow-2xl">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-black text-white">Voto Já Computado!</h2>
                        <p className="text-slate-300 text-sm mt-2">
                            Seu voto secreto já foi devidamente registrado na urna eletrônica desta gestão.
                            Em conformidade com a NR-05, cada colaborador tem direito a 1 voto individual e irretratável.
                        </p>
                        <div className="mt-6 pt-4 border-t border-slate-700">
                            <button
                                type="button"
                                onClick={() => navigate('/sst/cipa')}
                                className="w-full py-3 bg-[#1F365C] hover:bg-[#162744] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Voltar à Central da CIPA
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. CÉDULA DE VOTAÇÃO (ESCOLHA DO CANDIDATO) */}
                {etapa === 'cedula' && urnaData && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-3">
                                <Vote className="w-8 h-8 text-amber-400" />
                                <span>Cédula Eletrônica Oficial</span>
                            </h2>
                            <p className="text-slate-400 text-xs sm:text-sm mt-1">
                                Selecione abaixo o candidato de sua preferência para representar os empregados na CIPA.
                            </p>
                        </div>

                        {/* Grid de Candidatos */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {(urnaData.candidatos || []).map(cand => (
                                <button
                                    key={cand.id}
                                    type="button"
                                    onClick={() => {
                                        setVotoSelecionado({ tipo: 'valido', candidato: cand });
                                        setEtapa('confirmacao');
                                    }}
                                    className="bg-slate-800/90 hover:bg-slate-750 border-2 border-slate-700 hover:border-amber-400 rounded-2xl p-5 text-left transition-all active:scale-98 cursor-pointer flex items-center gap-4 group shadow-md"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-slate-700 border border-slate-600 overflow-hidden flex items-center justify-center font-bold text-xl text-slate-300 shrink-0">
                                        {cand.foto_url ? (
                                            <img src={cand.foto_url} alt={cand.nome_urna} className="w-full h-full object-cover" />
                                        ) : (
                                            <span>{cand.nome_urna?.substring(0, 2).toUpperCase() || 'CP'}</span>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                            Chapa {cand.numero_chapa}
                                        </span>
                                        <h3 className="text-base font-bold text-white truncate mt-1 group-hover:text-amber-300 transition-colors">
                                            {cand.nome_urna}
                                        </h3>
                                        <p className="text-xs text-slate-400 truncate">{cand.cargo_setor || 'Fábrica'}</p>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Botões Especiais: Voto Branco e Voto Nulo */}
                        <div className="flex items-center justify-center gap-4 pt-4 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => {
                                    setVotoSelecionado({ tipo: 'branco' });
                                    setEtapa('confirmacao');
                                }}
                                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                            >
                                Votar em Branco
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setVotoSelecionado({ tipo: 'nulo' });
                                    setEtapa('confirmacao');
                                }}
                                className="px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer"
                            >
                                Votar Nulo
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. CONFIRMAÇÃO DO VOTO */}
                {etapa === 'confirmacao' && votoSelecionado && (
                    <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl p-8 border border-slate-700 max-w-lg mx-auto shadow-2xl text-center space-y-6">
                        <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto">
                            <Lock className="w-7 h-7" />
                        </div>

                        <div>
                            <h3 className="text-xl font-black text-white">Confirmação de Voto Secreto</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Revise atentamente a sua escolha antes de depositar a cédula na urna eletrônica.
                            </p>
                        </div>

                        {votoSelecionado.tipo === 'valido' && votoSelecionado.candidato && (
                            <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700 flex items-center gap-4 text-left">
                                <div className="w-16 h-16 rounded-xl bg-slate-800 overflow-hidden flex items-center justify-center font-bold text-lg text-slate-300 shrink-0">
                                    {votoSelecionado.candidato.foto_url ? (
                                        <img src={votoSelecionado.candidato.foto_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        <span>{votoSelecionado.candidato.nome_urna?.substring(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                                <div>
                                    <span className="text-xs font-black text-amber-400">CHAPA {votoSelecionado.candidato.numero_chapa}</span>
                                    <h4 className="text-lg font-bold text-white">{votoSelecionado.candidato.nome_urna}</h4>
                                    <p className="text-xs text-slate-400">{votoSelecionado.candidato.cargo_setor}</p>
                                </div>
                            </div>
                        )}

                        {votoSelecionado.tipo === 'branco' && (
                            <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 text-center">
                                <h4 className="text-lg font-bold text-white uppercase tracking-wider">VOTO EM BRANCO</h4>
                                <p className="text-xs text-slate-400 mt-1">Sua cédula será computada sem opção de candidato.</p>
                            </div>
                        )}

                        {votoSelecionado.tipo === 'nulo' && (
                            <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700 text-center">
                                <h4 className="text-lg font-bold text-red-400 uppercase tracking-wider">VOTO NULO</h4>
                                <p className="text-xs text-slate-400 mt-1">Sua cédula será anulada eletronicamente.</p>
                            </div>
                        )}

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setEtapa('cedula')}
                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Corrigir
                            </button>

                            <button
                                type="button"
                                disabled={votando}
                                onClick={handleConfirmarVoto}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                <span>{votando ? 'Depositando...' : 'Confirmar Voto'}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. TELA DE SUCESSO & COMPROVANTE */}
                {etapa === 'sucesso' && (
                    <div className="bg-slate-800/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-emerald-500/40 max-w-lg mx-auto shadow-2xl text-center space-y-5 animate-fade-in">
                        <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
                            <CheckCircle2 className="w-10 h-10 animate-scale-in" />
                        </div>

                        <div>
                            <h2 className="text-2xl font-black text-white">Voto Registrado com Sucesso!</h2>
                            <p className="text-xs text-slate-300 mt-1">
                                Sua cédula anônima foi depositada e criptografada com sigilo inviolável conforme a NR-05.
                            </p>
                        </div>

                        {/* Código Comprovante */}
                        <div className="bg-slate-900/95 p-4 rounded-2xl border border-slate-700 text-left space-y-2">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                <span>CÓDIGO DO COMPROVANTE</span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (comprovante) {
                                            navigator.clipboard.writeText(comprovante);
                                            alert('Código do comprovante copiado!');
                                        }
                                    }}
                                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer font-sans text-xs font-bold"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copiar</span>
                                </button>
                            </div>
                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 break-all select-all font-mono font-bold text-amber-300 text-xs sm:text-sm tracking-wider">
                                {comprovante || 'CIPA-HASH-VERIFICADO'}
                            </div>
                            <p className="text-[10px] text-slate-400">
                                Guarde este código para auditar a autenticidade da sua participação no painel eleitoral.
                            </p>
                        </div>

                        {/* Confirmação de Disparo: WhatsApp & E-mail */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 flex items-center gap-2.5">
                                <Smartphone className="w-4 h-4 text-emerald-400 shrink-0" />
                                <div className="text-[11px] overflow-hidden">
                                    <p className="font-bold text-slate-200">WhatsApp</p>
                                    <p className="text-slate-400 truncate">
                                        {votoResultado?.whatsapp_enviado ? '✅ Enviado ao seu número' : 'Disponível no link abaixo'}
                                    </p>
                                </div>
                            </div>

                            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-700 flex items-center gap-2.5">
                                <Mail className="w-4 h-4 text-sky-400 shrink-0" />
                                <div className="text-[11px] overflow-hidden">
                                    <p className="font-bold text-slate-200">E-mail Pessoal</p>
                                    <p className="text-slate-400 truncate">
                                        {votoResultado?.email_enviado ? '✅ Cópia enviada' : 'Protocolado em tela'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Botão de Envio Direto para WhatsApp */}
                        {votoResultado?.whatsapp_direct_url && (
                            <a
                                href={votoResultado.whatsapp_direct_url}
                                target="_blank"
                                rel="noreferrer"
                                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                <span>Abrir / Enviar Comprovante no WhatsApp</span>
                            </a>
                        )}

                        {/* Notificação de Auditoria do Administrador */}
                        <div className="text-[11px] text-slate-300 bg-slate-900/80 p-3.5 rounded-xl border border-slate-700/80 text-left flex items-start gap-2.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-white">Auditoria & Conferência Oficial Registrada</p>
                                <p className="text-slate-400 mt-0.5">
                                    Conforme solicitado, uma via de conferência de presença eleitoral (com hash seguro e sem revelar seu voto) foi automaticamente protocolada para o Administrador da CIPA / SESMT.
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 pt-1">
                            A cabine será liberada para o próximo eleitor em <strong>{countdown} segundos</strong>...
                        </p>

                        <button
                            type="button"
                            onClick={() => navigate('/sst/cipa')}
                            className="w-full py-3 bg-[#1F365C] hover:bg-[#162744] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                        >
                            Concluir & Liberar Cabine
                        </button>
                    </div>
                )}
            </div>

            {/* Rodapé Seguro */}
            <div className="max-w-4xl w-full mx-auto text-center text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                MetalFisa Industrial Ltda • Sistema de Eleição Eletrônica CIPA • NR-05.5.4 & Lei nº 14.457/2022
            </div>
        </div>
    );
}
