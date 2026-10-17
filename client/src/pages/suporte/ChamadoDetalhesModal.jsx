import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { 
    X, Send, Paperclip, CheckCircle2, Clock, AlertTriangle, 
    MessageSquare, Eye, Shield, ListTodo, Plus, Trash2, User, Terminal
} from 'lucide-react';

const ChamadoDetalhesModal = ({ chamadoId, onClose, onAtualizado }) => {
    const [chamado, setChamado] = useState(null);
    const [mensagens, setMensagens] = useState([]);
    const [anexos, setAnexos] = useState([]);
    const [loading, setLoading] = useState(true);

    const [novaMensagem, setNovaMensagem] = useState('');
    const [enviando, setEnviando] = useState(false);
    const [anexoMsg, setAnexoMsg] = useState(null);

    // Planejamento técnico (para equipe de TI/Suporte)
    const [planejamentoTexto, setPlanejamentoTexto] = useState('');
    const [etapas, setEtapas] = useState([]);
    const [novaEtapa, setNovaEtapa] = useState('');
    const [prazo, setPrazo] = useState('');
    const [salvandoPlanejamento, setSalvandoPlanejamento] = useState(false);

    // Zoom Anexo
    const [previewAnexo, setPreviewAnexo] = useState(null);

    const carregarDetalhes = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/suporte/chamados/${chamadoId}`);
            setChamado(res.data?.chamado || null);
            setMensagens(res.data?.mensagens || []);
            setAnexos(res.data?.anexos || []);

            if (res.data?.chamado) {
                setPlanejamentoTexto(res.data.chamado.planejamento_texto || '');
                setPrazo(res.data.chamado.planejamento_prazo || '');
                try {
                    const parsed = typeof res.data.chamado.planejamento_etapas === 'string'
                        ? JSON.parse(res.data.chamado.planejamento_etapas)
                        : (res.data.chamado.planejamento_etapas || []);
                    setEtapas(Array.isArray(parsed) ? parsed : []);
                } catch {
                    setEtapas([]);
                }
            }
        } catch (err) {
            console.error('Erro ao carregar detalhes do chamado:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarDetalhes();
    }, [chamadoId]);

    // Enviar mensagem no chat
    const enviarMensagem = async (e) => {
        e.preventDefault();
        if (!novaMensagem.trim() && !anexoMsg) return;

        try {
            setEnviando(true);
            const payload = {
                mensagem: novaMensagem,
                anexos: anexoMsg ? [anexoMsg] : []
            };

            await api.post(`/suporte/chamados/${chamadoId}/mensagens`, payload);
            setNovaMensagem('');
            setAnexoMsg(null);
            carregarDetalhes();
            if (onAtualizado) onAtualizado();
        } catch (err) {
            alert('Erro ao enviar mensagem.');
        } finally {
            setEnviando(false);
        }
    };

    // Alterar status
    const mudarStatus = async (novoStatus) => {
        try {
            await api.patch(`/suporte/chamados/${chamadoId}/status`, { status: novoStatus });
            carregarDetalhes();
            if (onAtualizado) onAtualizado();
        } catch (err) {
            alert('Erro ao mudar status do chamado.');
        }
    };

    // Salvar Planejamento Técnico
    const salvarPlanejamento = async () => {
        try {
            setSalvandoPlanejamento(true);
            await api.put(`/suporte/chamados/${chamadoId}/planejamento`, {
                planejamento_texto: planejamentoTexto,
                planejamento_etapas: etapas,
                planejamento_prazo: prazo,
                planejamento_status: 'em_elaboracao'
            });
            alert('Planejamento técnico salvo com sucesso!');
            carregarDetalhes();
        } catch (err) {
            alert('Erro ao salvar planejamento técnico.');
        } finally {
            setSalvandoPlanejamento(false);
        }
    };

    const adicionarEtapa = (e) => {
        e.preventDefault();
        if (!novaEtapa.trim()) return;
        setEtapas([...etapas, { texto: novaEtapa.trim(), concluida: false }]);
        setNovaEtapa('');
    };

    const toggleEtapa = (index) => {
        const copy = [...etapas];
        copy[index].concluida = !copy[index].concluida;
        setEtapas(copy);
    };

    const removerEtapa = (index) => {
        setEtapas(etapas.filter((_, idx) => idx !== index));
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                            {chamado?.codigo || '...'}
                        </span>
                        <div>
                            <h3 className="font-bold text-white text-sm sm:text-base leading-tight">{chamado?.titulo}</h3>
                            <p className="text-xs text-slate-400">
                                Módulo: <strong className="text-slate-300">{chamado?.modulo}</strong> • Solicitante: <strong className="text-slate-300">{chamado?.solicitante_nome} ({chamado?.solicitante_setor})</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Seletor de Status */}
                        <select
                            value={chamado?.status || 'aberto'}
                            onChange={(e) => mudarStatus(e.target.value)}
                            className="bg-slate-900 border border-slate-750 text-xs font-semibold rounded-lg px-2.5 py-1.5 text-slate-200 capitalize"
                        >
                            <option value="aberto">Aberto</option>
                            <option value="em_analise">Em Análise</option>
                            <option value="aguardando_usuario">Aguardando Usuário</option>
                            <option value="em_correcao">Em Correção</option>
                            <option value="resolvido">Resolvido</option>
                            <option value="fechado">Fechado</option>
                        </select>

                        <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Conteúdo com Grid: 2 Colunas */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
                    {/* COLUNA ESQUERDA: TIMELINE E CHAT (7 cols) */}
                    <div className="lg:col-span-7 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-920 overflow-hidden">
                        {/* Descrição Original do Chamado */}
                        <div className="p-4 bg-slate-950/70 border-b border-slate-800 text-xs text-slate-300">
                            <strong className="text-slate-200 block mb-1">Descrição Inicial:</strong>
                            <p className="whitespace-pre-line">{chamado?.descricao}</p>
                            {chamado?.erros_console && (
                                <div className="mt-2 p-2 bg-slate-900 rounded font-mono text-[11px] text-rose-300 border border-slate-800 overflow-x-auto">
                                    <Terminal className="w-3 h-3 inline mr-1 text-slate-400" />
                                    {chamado.erros_console}
                                </div>
                            )}
                        </div>

                        {/* Mensagens / Chat */}
                        <div className="flex-1 p-4 overflow-y-auto space-y-3">
                            {mensagens.map((m) => {
                                const isSuporte = m.is_suporte === 1;
                                const isMudancaStatus = m.tipo === 'mudanca_status';

                                if (isMudancaStatus) {
                                    return (
                                        <div key={m.id} className="text-center my-2">
                                            <span className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1 rounded-full font-mono">
                                                {m.mensagem} • {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    );
                                }

                                return (
                                    <div
                                        key={m.id}
                                        className={`flex flex-col ${isSuporte ? 'items-start' : 'items-end'}`}
                                    >
                                        <div className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-md ${
                                            isSuporte
                                                ? 'bg-indigo-950/80 border border-indigo-800 text-indigo-100 rounded-tl-none'
                                                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tr-none'
                                        }`}>
                                            <div className="flex items-center gap-1.5 mb-1 font-semibold text-[11px]">
                                                {isSuporte ? (
                                                    <span className="text-indigo-400 flex items-center gap-1">
                                                        <Shield className="w-3 h-3" />
                                                        {m.usuario_nome} (Suporte)
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 flex items-center gap-1">
                                                        <User className="w-3 h-3" />
                                                        {m.usuario_nome}
                                                    </span>
                                                )}
                                                <span className="text-slate-500 font-normal text-[10px]">
                                                    {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <p className="whitespace-pre-line">{m.mensagem}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Campo de Envio de Mensagem */}
                        <form onSubmit={enviarMensagem} className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
                            <input
                                type="text"
                                placeholder="Digite sua resposta..."
                                value={novaMensagem}
                                onChange={(e) => setNovaMensagem(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                                type="submit"
                                disabled={enviando}
                                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </form>
                    </div>

                    {/* COLUNA DIREITA: PLANEJAMENTO TÉCNICO & ANEXOS (5 cols) */}
                    <div className="lg:col-span-5 flex flex-col p-4 bg-slate-950 overflow-y-auto space-y-4">
                        {/* 1. Anexos do Chamado */}
                        <div>
                            <h4 className="font-semibold text-xs text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                                Anexos e Prints ({anexos.length})
                            </h4>

                            {anexos.length === 0 ? (
                                <p className="text-xs text-slate-500 bg-slate-900 p-3 rounded-xl border border-slate-850">
                                    Nenhum anexo enviado neste chamado.
                                </p>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {anexos.map((a) => (
                                        <div
                                            key={a.id}
                                            onClick={() => setPreviewAnexo(a)}
                                            className="bg-slate-900 border border-slate-800 rounded-xl p-2 cursor-pointer hover:border-indigo-500 transition group flex flex-col items-center justify-center text-center"
                                        >
                                            {a.mimetype?.startsWith('image/') ? (
                                                <img src={a.dados_base64} alt={a.nome_original} className="w-full h-20 object-cover rounded-lg mb-1" />
                                            ) : (
                                                <Paperclip className="w-8 h-8 text-slate-500 my-4" />
                                            )}
                                            <span className="text-[11px] text-slate-300 font-medium truncate w-full">{a.nome_original}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. Planejamento Técnico da TI */}
                        <div className="pt-2 border-t border-slate-850">
                            <h4 className="font-semibold text-xs text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <ListTodo className="w-3.5 h-3.5 text-indigo-400" />
                                Planejamento Técnico de Resolução
                            </h4>

                            <div>
                                <label className="text-[11px] text-slate-400 font-medium">Notas Técnicas do Desenvolvedor</label>
                                <textarea
                                    rows="3"
                                    placeholder="Instruções internas, causa-raiz, query de ajuste..."
                                    value={planejamentoTexto}
                                    onChange={(e) => setPlanejamentoTexto(e.target.value)}
                                    className="w-full mt-1 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Checklist de Etapas */}
                            <div className="mt-3">
                                <label className="text-[11px] text-slate-400 font-medium block mb-1">Checklist de Tarefas</label>
                                <form onSubmit={adicionarEtapa} className="flex gap-2 mb-2">
                                    <input
                                        type="text"
                                        placeholder="Nova tarefa..."
                                        value={novaEtapa}
                                        onChange={(e) => setNovaEtapa(e.target.value)}
                                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                                    />
                                    <button type="submit" className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </form>

                                <div className="space-y-1">
                                    {etapas.map((et, idx) => (
                                        <div key={idx} className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-slate-850 text-xs">
                                            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={et.concluida}
                                                    onChange={() => toggleEtapa(idx)}
                                                    className="rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                                                />
                                                <span className={`truncate ${et.concluida ? 'line-through text-slate-500' : 'text-slate-300'}`}>
                                                    {et.texto}
                                                </span>
                                            </label>
                                            <button onClick={() => removerEtapa(idx)} className="text-slate-500 hover:text-rose-400 ml-2">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={salvarPlanejamento}
                                disabled={salvandoPlanejamento}
                                className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs transition"
                            >
                                {salvandoPlanejamento ? 'Salvando...' : 'Salvar Planejamento'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de Preview de Anexo */}
            {previewAnexo && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-60 flex items-center justify-center p-4">
                    <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-3xl w-full p-4 flex flex-col max-h-[90vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                            <h4 className="font-semibold text-sm text-white">{previewAnexo.nome_original}</h4>
                            <button onClick={() => setPreviewAnexo(null)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
                            {previewAnexo.mimetype?.startsWith('image/') ? (
                                <img src={previewAnexo.dados_base64} alt={previewAnexo.nome_original} className="max-w-full max-h-[70vh] object-contain rounded-lg" />
                            ) : (
                                <p className="text-xs text-slate-400">Pré-visualização disponível apenas para imagens.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ChamadoDetalhesModal;
