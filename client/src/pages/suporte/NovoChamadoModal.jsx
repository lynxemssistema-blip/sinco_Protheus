import React, { useState } from 'react';
import { api } from '../../services/api';
import { X, Send, AlertTriangle, Paperclip, Terminal, HelpCircle } from 'lucide-react';

const NovoChamadoModal = ({ onClose, onChamadoCriado }) => {
    const [titulo, setTitulo] = useState('');
    const [modulo, setModulo] = useState('PCP / Produção');
    const [tipoSolicitacao, setTipoSolicitacao] = useState('problema');
    const [prioridade, setPrioridade] = useState('media');
    const [descricao, setDescricao] = useState('');
    const [errosConsole, setErrosConsole] = useState('');
    const [anexos, setAnexos] = useState([]);
    const [salvando, setSalvando] = useState(false);

    // Upload de print ou anexo
    const handleAnexoUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setAnexos(prev => [...prev, {
                    nome: file.name,
                    mimetype: file.type,
                    tamanho: file.size,
                    dados_base64: ev.target.result
                }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!titulo || !descricao) {
            alert('Por favor, preencha o título e a descrição detalhada do chamado.');
            return;
        }

        try {
            setSalvando(true);
            const res = await api.post('/suporte/chamados', {
                titulo,
                modulo,
                tipo_solicitacao: tipoSolicitacao,
                prioridade,
                descricao,
                erros_console: errosConsole,
                anexos
            });

            alert(`Chamado ${res.data?.codigo || ''} aberto com sucesso!`);
            onChamadoCriado();
            onClose();
        } catch (err) {
            console.error('Erro ao abrir chamado:', err);
            alert(err.response?.data?.error || 'Erro ao registrar chamado de suporte.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-indigo-400" />
                        <h3 className="font-semibold text-white text-base">Abrir Novo Chamado de Suporte TI</h3>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1">
                    <div>
                        <label className="text-xs text-slate-300 font-medium">Título Resumido do Problema ou Dúvida *</label>
                        <input
                            type="text"
                            required
                            placeholder="Ex: Falha ao sincronizar apontamento na etapa de dobra"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="text-xs text-slate-300 font-medium">Módulo Afetado</label>
                            <select
                                value={modulo}
                                onChange={(e) => setModulo(e.target.value)}
                                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
                            >
                                <option value="PCP / Produção">PCP / Produção</option>
                                <option value="SST / Segurança">SST / Segurança (NR-06)</option>
                                <option value="RH / Gestão">RH / Gestão de Pessoas</option>
                                <option value="Salas de Reunião">Salas & Totem</option>
                                <option value="Cesta Básica">Cesta Básica & Benefícios</option>
                                <option value="Comercial / Vendas">Comercial / Vendas</option>
                                <option value="Expedição / Romaneios">Expedição / Romaneios</option>
                                <option value="SGQ / Qualidade">SGQ / Qualidade</option>
                                <option value="Infraestrutura / Acesso">Infraestrutura / Acesso</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-300 font-medium">Tipo</label>
                            <select
                                value={tipoSolicitacao}
                                onChange={(e) => setTipoSolicitacao(e.target.value)}
                                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
                            >
                                <option value="problema">Bug / Erro do Sistema</option>
                                <option value="duvida">Dúvida Operacional</option>
                                <option value="melhoria">Sugestão de Melhoria</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs text-slate-300 font-medium">Prioridade</label>
                            <select
                                value={prioridade}
                                onChange={(e) => setPrioridade(e.target.value)}
                                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200"
                            >
                                <option value="baixa">Baixa (Pode aguardar)</option>
                                <option value="media">Média (Impacto rotineiro)</option>
                                <option value="alta">Alta (Bloqueia processo)</option>
                                <option value="critica">Crítica (Fábrica parada)</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-slate-300 font-medium">Descrição Detalhada do Ocorrido *</label>
                        <textarea
                            required
                            rows="4"
                            placeholder="Descreva passo a passo o que você estava fazendo quando o problema aconteceu..."
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                            className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <Terminal className="w-3.5 h-3.5 text-slate-400" />
                            <label className="text-xs text-slate-400 font-medium">Texto de Erro ou Mensagem do Console (Opcional)</label>
                        </div>
                        <textarea
                            rows="2"
                            placeholder="Cole aqui eventuais mensagens de erro da tela..."
                            value={errosConsole}
                            onChange={(e) => setErrosConsole(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-rose-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-slate-300 font-medium block mb-1">Prints e Anexos (Base64 no MySQL)</label>
                        <input
                            type="file"
                            multiple
                            accept="image/*,.pdf,.txt"
                            onChange={handleAnexoUpload}
                            className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-800 file:text-slate-300 hover:file:bg-slate-750"
                        />
                        {anexos.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {anexos.map((a, idx) => (
                                    <span key={idx} className="text-[11px] bg-slate-800 text-slate-300 px-2 py-1 rounded flex items-center gap-1 border border-slate-700">
                                        <Paperclip className="w-3 h-3 text-indigo-400" />
                                        {a.nome}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-sm">
                            Cancelar
                        </button>
                        <button type="submit" disabled={salvando} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white font-semibold rounded-lg text-sm flex items-center gap-2">
                            <Send className="w-4 h-4" />
                            {salvando ? 'Abrindo Chamado...' : 'Registrar Chamado'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default NovoChamadoModal;
