import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    Camera, FileText, ShoppingBag, Send, Clock, CheckCircle2, 
    XCircle, AlertCircle, Lock, ChevronRight, RefreshCw, Upload, Eye, User, ShieldAlert
} from 'lucide-react';

const PortalColaborador = () => {
    const [abaAtiva, setAbaAtiva] = useState('menu'); // 'menu', 'atestado', 'uniforme', 'cesta', 'historico'
    const [solicitacoes, setSolicitacoes] = useState([]);
    const [cestaHistorico, setCestaHistorico] = useState([]);
    const [loading, setLoading] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [sucessoMsg, setSucessoMsg] = useState(null);

    // Form Atestado
    const [formAtestado, setFormAtestado] = useState({
        data_inicio: new Date().toISOString().slice(0, 10),
        dias: 1,
        motivo: '',
        foto_base64: null,
        foto_nome: null
    });

    // Form Uniforme
    const [formUniforme, setFormUniforme] = useState({
        item: 'botina',
        tamanho: '',
        motivo: 'desgaste',
        observacao: '',
        foto_base64: null,
        foto_nome: null
    });

    // Modal de Foto
    const [fotoZoom, setFotoZoom] = useState(null);

    const carregarMinhasSolicitacoes = async () => {
        try {
            setLoading(true);
            const res = await api.get('/rh/autoatendimento/minhas-solicitacoes');
            setSolicitacoes(res.data?.solicitacoes || []);
        } catch (err) {
            console.error('Erro ao carregar solicitações:', err);
        } finally {
            setLoading(false);
        }
    };

    const carregarMinhaCesta = async () => {
        try {
            const res = await api.get('/sst/cesta/minha-situacao');
            setCestaHistorico(res.data?.historico || []);
        } catch (err) {
            console.error('Erro ao carregar cesta:', err);
        }
    };

    useEffect(() => {
        carregarMinhasSolicitacoes();
        carregarMinhaCesta();
    }, []);

    // Conversão de arquivo/câmera para Base64
    const handleFotoUpload = (e, callback) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            callback(ev.target.result, file.name);
        };
        reader.readAsDataURL(file);
    };

    // Enviar Atestado
    const enviarAtestado = async (e) => {
        e.preventDefault();
        if (!formAtestado.foto_base64) {
            alert('Por favor, tire uma foto legível do seu atestado médico!');
            return;
        }

        try {
            setEnviando(true);
            await api.post('/rh/autoatendimento/solicitacoes', {
                tipo_solicitacao: 'atestado',
                dados: {
                    data_inicio: formAtestado.data_inicio,
                    dias_afastamento: formAtestado.dias,
                    motivo: formAtestado.motivo
                },
                foto_nome: formAtestado.foto_nome,
                foto_base64: formAtestado.foto_base64,
                observacao_colaborador: `Afastamento de ${formAtestado.dias} dias a partir de ${formAtestado.data_inicio}. Motivo: ${formAtestado.motivo || 'Consulta médica'}`
            });

            setSucessoMsg('Atestado enviado com sucesso para validação do RH!');
            setFormAtestado({ data_inicio: new Date().toISOString().slice(0, 10), dias: 1, motivo: '', foto_base64: null, foto_nome: null });
            carregarMinhasSolicitacoes();
            setTimeout(() => {
                setSucessoMsg(null);
                setAbaAtiva('historico');
            }, 1800);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao enviar atestado.');
        } finally {
            setEnviando(false);
        }
    };

    // Enviar Pedido de Uniforme / EPI
    const enviarPedidoUniforme = async (e) => {
        e.preventDefault();
        try {
            setEnviando(true);
            await api.post('/rh/autoatendimento/solicitacoes', {
                tipo_solicitacao: 'troca_uniforme',
                dados: {
                    item: formUniforme.item,
                    tamanho: formUniforme.tamanho,
                    motivo: formUniforme.motivo
                },
                foto_nome: formUniforme.foto_nome,
                foto_base64: formUniforme.foto_base64,
                observacao_colaborador: `Solicitação de substituição: ${formUniforme.item.toUpperCase()} (Tamanho: ${formUniforme.tamanho || 'Padrão'}). Motivo: ${formUniforme.motivo}`
            });

            setSucessoMsg('Pedido de uniforme/EPI registrado com sucesso!');
            setFormUniforme({ item: 'botina', tamanho: '', motivo: 'desgaste', observacao: '', foto_base64: null, foto_nome: null });
            carregarMinhasSolicitacoes();
            setTimeout(() => {
                setSucessoMsg(null);
                setAbaAtiva('historico');
            }, 1800);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao enviar pedido.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col max-w-md mx-auto shadow-2xl border-x border-slate-800">
            {/* ── HEADER MOBILE ── */}
            <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-30 flex items-center justify-between">
                <div>
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">Autoatendimento</span>
                    <h1 className="text-lg font-bold text-white leading-tight">Portal do Colaborador</h1>
                </div>
                <button
                    onClick={() => { carregarMinhasSolicitacoes(); carregarMinhaCesta(); }}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
                    title="Atualizar"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Alerta de Sucesso */}
            {sucessoMsg && (
                <div className="m-3 p-3 bg-emerald-950 border border-emerald-700/60 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    <span>{sucessoMsg}</span>
                </div>
            )}

            {/* ── CORPO PRINCIPAL ── */}
            <div className="flex-1 p-4 pb-20 overflow-y-auto">
                {/* TELA INICIAL: CARDS RÁPIDOS */}
                {abaAtiva === 'menu' && (
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-700/30 rounded-2xl p-4">
                            <h2 className="text-sm font-semibold text-white">Serviços Rápidos de RH & SST</h2>
                            <p className="text-xs text-slate-400 mt-0.5">Envie documentos com a câmera do seu celular sem precisar se deslocar até o RH.</p>
                        </div>

                        {/* Card 1: Enviar Atestado */}
                        <button
                            onClick={() => setAbaAtiva('atestado')}
                            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 text-left transition group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-950 border border-blue-700/50 flex items-center justify-center text-blue-400 flex-shrink-0 group-hover:scale-105 transition">
                                <Camera className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-white">Enviar Atestado Médico</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Fotografe seu atestado e envie diretamente para homologação.</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
                        </button>

                        {/* Card 2: Pedido de Troca de EPI / Uniforme */}
                        <button
                            onClick={() => setAbaAtiva('uniforme')}
                            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 text-left transition group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-amber-950 border border-amber-700/50 flex items-center justify-center text-amber-400 flex-shrink-0 group-hover:scale-105 transition">
                                <ShoppingBag className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-white">Solicitar Troca de EPI / Fardamento</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Peça reposição de botina gasta, calça ou camisa rasgada.</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
                        </button>

                        {/* Card 3: Consultar Minha Cesta Básica */}
                        <button
                            onClick={() => setAbaAtiva('cesta')}
                            className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-2xl p-4 flex items-center gap-4 text-left transition group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-emerald-950 border border-emerald-700/50 flex items-center justify-center text-emerald-400 flex-shrink-0 group-hover:scale-105 transition">
                                <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm text-white">Minha Cesta Básica</h3>
                                <p className="text-xs text-slate-400 mt-0.5">Consulte sua elegibilidade e histórico de retiradas mensais.</p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
                        </button>

                        {/* Últimas Solicitações */}
                        <div className="pt-2">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Últimos Pedidos</h3>
                                <button onClick={() => setAbaAtiva('historico')} className="text-xs text-indigo-400 hover:underline">
                                    Ver todos
                                </button>
                            </div>

                            {solicitacoes.length === 0 ? (
                                <p className="text-xs text-slate-500 py-3 text-center bg-slate-900/60 rounded-xl border border-slate-850">
                                    Nenhuma solicitação enviada ainda.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {solicitacoes.slice(0, 3).map((s) => (
                                        <div key={s.id} className="bg-slate-900 border border-slate-850 rounded-xl p-3 flex items-center justify-between text-xs">
                                            <div>
                                                <strong className="text-slate-200 capitalize block">{s.tipo_solicitacao?.replace('_', ' ')}</strong>
                                                <span className="text-slate-500 text-[11px]">{new Date(s.data_solicitacao).toLocaleDateString('pt-BR')}</span>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full font-semibold uppercase text-[10px] ${
                                                s.status === 'aprovado' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                                s.status === 'recusado' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                                'bg-amber-950 text-amber-300 border border-amber-800'
                                            }`}>
                                                {s.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* FORMULÁRIO 1: ENVIAR ATESTADO */}
                {abaAtiva === 'atestado' && (
                    <form onSubmit={enviarAtestado} className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Camera className="w-4 h-4 text-blue-400" />
                                Envio de Atestado Médico
                            </h2>
                            <button type="button" onClick={() => setAbaAtiva('menu')} className="text-xs text-slate-400 hover:text-white">
                                Voltar
                            </button>
                        </div>

                        {/* Área da Câmera / Upload */}
                        <div>
                            <label className="text-xs font-semibold text-slate-300 block mb-1">
                                Foto do Atestado Médico <span className="text-rose-400">*</span>
                            </label>
                            
                            {formAtestado.foto_base64 ? (
                                <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 bg-slate-900">
                                    <img src={formAtestado.foto_base64} alt="Atestado" className="w-full h-56 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setFormAtestado({ ...formAtestado, foto_base64: null, foto_nome: null })}
                                        className="absolute top-2 right-2 px-3 py-1 bg-black/70 hover:bg-black text-white text-xs font-semibold rounded-lg backdrop-blur-sm"
                                    >
                                        Tirar Outra
                                    </button>
                                </div>
                            ) : (
                                <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-750 hover:border-indigo-500 rounded-2xl bg-slate-900/60 cursor-pointer p-4 text-center group transition">
                                    <div className="w-12 h-12 rounded-full bg-indigo-950 text-indigo-400 flex items-center justify-center mb-2 group-hover:scale-110 transition">
                                        <Camera className="w-6 h-6" />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-200">Toque aqui para abrir a Câmera</span>
                                    <span className="text-[11px] text-slate-500 mt-0.5">Capture a foto de forma bem nítida</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={(e) => handleFotoUpload(e, (b64, nome) => {
                                            setFormAtestado({ ...formAtestado, foto_base64: b64, foto_nome: nome });
                                        })}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Início do Afastamento</label>
                                <input
                                    type="date"
                                    required
                                    value={formAtestado.data_inicio}
                                    onChange={(e) => setFormAtestado({ ...formAtestado, data_inicio: e.target.value })}
                                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Quantidade de Dias</label>
                                <input
                                    type="number"
                                    min="1"
                                    required
                                    value={formAtestado.dias}
                                    onChange={(e) => setFormAtestado({ ...formAtestado, dias: parseInt(e.target.value) || 1 })}
                                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 font-medium">Motivo / Informações Adicionais</label>
                            <textarea
                                rows="3"
                                placeholder="Ex: Consulta com ortopedista, repouso devido a entorse..."
                                value={formAtestado.motivo}
                                onChange={(e) => setFormAtestado({ ...formAtestado, motivo: e.target.value })}
                                className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={enviando}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-950 flex items-center justify-center gap-2 transition"
                        >
                            <Send className="w-4 h-4" />
                            {enviando ? 'Enviando ao RH...' : 'Enviar Atestado'}
                        </button>
                    </form>
                )}

                {/* FORMULÁRIO 2: PEDIDO DE UNIFORME / EPI */}
                {abaAtiva === 'uniforme' && (
                    <form onSubmit={enviarPedidoUniforme} className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <ShoppingBag className="w-4 h-4 text-amber-400" />
                                Troca de EPI ou Uniforme
                            </h2>
                            <button type="button" onClick={() => setAbaAtiva('menu')} className="text-xs text-slate-400 hover:text-white">
                                Voltar
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Item Solicitado</label>
                                <select
                                    value={formUniforme.item}
                                    onChange={(e) => setFormUniforme({ ...formUniforme, item: e.target.value })}
                                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                                >
                                    <option value="botina">Botina de Segurança</option>
                                    <option value="camisa">Camisa / Fardamento</option>
                                    <option value="calca">Calça Operacional</option>
                                    <option value="oculos">Óculos de Proteção</option>
                                    <option value="luva">Luvas de Proteção</option>
                                    <option value="protetor_auricular">Protetor Auricular</option>
                                    <option value="outro">Outro Item</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 font-medium">Tamanho / Numeração</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 41, G, M..."
                                    required
                                    value={formUniforme.tamanho}
                                    onChange={(e) => setFormUniforme({ ...formUniforme, tamanho: e.target.value })}
                                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 font-medium">Motivo da Substituição</label>
                            <select
                                value={formUniforme.motivo}
                                onChange={(e) => setFormUniforme({ ...formUniforme, motivo: e.target.value })}
                                className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200"
                            >
                                <option value="desgaste">Desgaste Natural de Uso</option>
                                <option value="rasgado_danificado">Danificado / Rasgado em Serviço</option>
                                <option value="tamanho_inadequado">Tamanho Inadequado</option>
                                <option value="extravio">Perda / Extravio</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-400 font-medium">Foto do Item Gasto (Opcional)</label>
                            {formUniforme.foto_base64 ? (
                                <div className="relative rounded-2xl overflow-hidden border border-amber-500/50 bg-slate-900 mt-1">
                                    <img src={formUniforme.foto_base64} alt="EPI" className="w-full h-44 object-cover" />
                                    <button
                                        type="button"
                                        onClick={() => setFormUniforme({ ...formUniforme, foto_base64: null, foto_nome: null })}
                                        className="absolute top-2 right-2 px-3 py-1 bg-black/70 hover:bg-black text-white text-xs font-semibold rounded-lg backdrop-blur-sm"
                                    >
                                        Remover
                                    </button>
                                </div>
                            ) : (
                                <label className="flex items-center gap-3 p-3 border border-slate-800 hover:border-slate-700 rounded-xl bg-slate-900 cursor-pointer mt-1">
                                    <Camera className="w-5 h-5 text-amber-400 flex-shrink-0" />
                                    <span className="text-xs text-slate-300">Tirar foto do item que precisa de troca</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        onChange={(e) => handleFotoUpload(e, (b64, nome) => {
                                            setFormUniforme({ ...formUniforme, foto_base64: b64, foto_nome: nome });
                                        })}
                                        className="hidden"
                                    />
                                </label>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={enviando}
                            className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-semibold rounded-xl text-sm shadow-lg shadow-amber-950 flex items-center justify-center gap-2 transition"
                        >
                            <Send className="w-4 h-4" />
                            {enviando ? 'Enviando pedido...' : 'Solicitar Reposição'}
                        </button>
                    </form>
                )}

                {/* TELA 3: CONSULTAR CESTA BÁSICA */}
                {abaAtiva === 'cesta' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-400" />
                                Minha Cesta Básica
                            </h2>
                            <button type="button" onClick={() => setAbaAtiva('menu')} className="text-xs text-slate-400 hover:text-white">
                                Voltar
                            </button>
                        </div>

                        {cestaHistorico.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 rounded-2xl border border-slate-800">
                                Nenhum registro de benefício emitido no momento.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cestaHistorico.map((c) => (
                                    <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-mono font-bold text-indigo-400">{c.competencia}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                c.status === 'entregue' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                                c.elegivel === 1 ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                                                'bg-rose-950 text-rose-300 border border-rose-800'
                                            }`}>
                                                {c.status === 'entregue' ? '✓ Já Retirado' : c.elegivel === 1 ? 'Liberado p/ Retirada' : 'Inapto'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-white font-medium mt-2">{c.descricao || 'Cesta de Alimentos Mensal'}</p>

                                        {c.elegivel === 0 && (
                                            <div className="mt-2 p-2 bg-rose-950/40 border border-rose-800/40 rounded-lg text-[11px] text-rose-300 flex items-start gap-1.5">
                                                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                                                <span><strong>Motivo:</strong> {c.motivo_inaptidao || 'Falta injustificada ou afastamento.'}</span>
                                            </div>
                                        )}

                                        {c.status === 'entregue' && (
                                            <div className="mt-3 pt-2 border-t border-slate-850 text-[11px] text-slate-400 space-y-0.5 font-mono">
                                                <p>Retirado em: {new Date(c.data_hora_entrega).toLocaleString('pt-BR')}</p>
                                                <p>Entregador: {c.entregue_por || 'Almoxarifado'}</p>
                                                {c.assinatura_hash && (
                                                    <p className="text-[10px] text-indigo-400 truncate">
                                                        Hash Digital: {c.assinatura_hash}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TELA 4: HISTÓRICO GERAL DE SOLICITAÇÕES */}
                {abaAtiva === 'historico' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                            <h2 className="text-sm font-bold text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-indigo-400" />
                                Minhas Solicitações
                            </h2>
                            <button type="button" onClick={() => setAbaAtiva('menu')} className="text-xs text-slate-400 hover:text-white">
                                Início
                            </button>
                        </div>

                        {solicitacoes.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-xs bg-slate-900 rounded-2xl border border-slate-800">
                                Você ainda não enviou solicitações.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {solicitacoes.map((s) => (
                                    <div key={s.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <strong className="text-xs font-bold text-white uppercase">{s.tipo_solicitacao?.replace('_', ' ')}</strong>
                                                {s.imutavel === 1 && (
                                                    <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono" title="Registro homologado pelo RH">
                                                        <Lock className="w-3 h-3 text-indigo-400" />
                                                        Imutável
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                                s.status === 'aprovado' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                                                s.status === 'recusado' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                                                'bg-amber-950 text-amber-300 border border-amber-800'
                                            }`}>
                                                {s.status}
                                            </span>
                                        </div>

                                        <p className="text-xs text-slate-300 mt-2">{s.observacao_colaborador || '-'}</p>

                                        {s.resposta_rh && (
                                            <div className="mt-2.5 p-2 bg-indigo-950/40 border border-indigo-800/40 rounded-xl text-xs">
                                                <span className="text-[10px] font-bold text-indigo-400 block uppercase">Resposta do RH:</span>
                                                <p className="text-slate-200 mt-0.5">{s.resposta_rh}</p>
                                            </div>
                                        )}

                                        <div className="mt-3 pt-2 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-500">
                                            <span>{new Date(s.data_solicitacao).toLocaleDateString('pt-BR')}</span>
                                            {s.possui_anexo === 1 && (
                                                <span className="text-indigo-400 font-medium">Possui anexo fotográfico</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── BARRA INFERIOR DE NAVEGAÇÃO MOBILE ── */}
            <div className="bg-slate-900 border-t border-slate-800 p-2 fixed bottom-0 max-w-md w-full flex items-center justify-around z-30">
                <button
                    onClick={() => setAbaAtiva('menu')}
                    className={`flex flex-col items-center gap-1 text-[11px] font-medium p-1 transition ${
                        abaAtiva === 'menu' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <User className="w-5 h-5" />
                    Início
                </button>
                <button
                    onClick={() => setAbaAtiva('atestado')}
                    className={`flex flex-col items-center gap-1 text-[11px] font-medium p-1 transition ${
                        abaAtiva === 'atestado' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Camera className="w-5 h-5" />
                    Atestado
                </button>
                <button
                    onClick={() => setAbaAtiva('cesta')}
                    className={`flex flex-col items-center gap-1 text-[11px] font-medium p-1 transition ${
                        abaAtiva === 'cesta' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <ShoppingBag className="w-5 h-5" />
                    Cesta
                </button>
                <button
                    onClick={() => setAbaAtiva('historico')}
                    className={`flex flex-col items-center gap-1 text-[11px] font-medium p-1 transition ${
                        abaAtiva === 'historico' ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                >
                    <Clock className="w-5 h-5" />
                    Histórico
                </button>
            </div>
        </div>
    );
};

export default PortalColaborador;
