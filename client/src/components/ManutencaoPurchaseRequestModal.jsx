import React, { useState } from 'react';
import { X, Send, Mail, CheckCircle, AlertCircle, Loader2, Package, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ManutencaoPurchaseRequestModal = ({ isOpen, onClose, selectedMaterials, onComplete }) => {
    const { user } = useAuth();
    const [emails, setEmails] = useState(['']);
    const [assunto, setAssunto] = useState('Solicitação de Compras - Manutenção');
    const [corpo, setCorpo] = useState('Segue a lista de materiais solicitados pela manutenção para cotação e compra.');
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState(null);

    const [editableMaterials, setEditableMaterials] = useState([]);

    // Initialize editable materials when modal opens
    React.useEffect(() => {
        if (isOpen) {
            setEditableMaterials(selectedMaterials.map(m => ({ ...m, qtde_solicitada: m.quantidade })));
        }
    }, [isOpen, selectedMaterials]);

    if (!isOpen) return null;

    const userName = user?.nome || user?.NomeCompleto || user?.username || 'Usuário';

    const handleQuantityChange = (id, newQtde) => {
        setEditableMaterials(prev => prev.map(m => m.id === id ? { ...m, qtde_solicitada: newQtde } : m));
    };

    const addEmailField = () => setEmails(prev => [...prev, '']);
    const removeEmailField = (idx) => setEmails(prev => prev.filter((_, i) => i !== idx));
    const updateEmail = (idx, value) => setEmails(prev => prev.map((e, i) => i === idx ? value : e));

    const validEmails = emails.filter(e => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));

    const handleSendRequest = async () => {
        if (validEmails.length === 0) {
            setResult({ type: 'error', message: 'Informe ao menos um e-mail válido para envio.' });
            return;
        }

        setIsProcessing(true);
        setResult(null);

        try {
            // Prepare materials array with updated quantities
            const payloadMaterials = editableMaterials.map(m => ({
                id: m.id,
                quantidade: m.qtde_solicitada
            }));

            const toList = validEmails.join(',');

            // 1. Criar solicitação no backend
            const { data: solData } = await api.post('/manutencao/solicitacoes-compras', {
                destinatarios: toList,
                assunto,
                corpo,
                materiais_editados: payloadMaterials, // Changed from materiais_ids to send array of objects
                usuario_nome: userName
            });

            // 2. Preparar o corpo do email em HTML
            let matTableHtml = `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead style="background-color: #f1f5f9;">
                        <tr>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">O.M.</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Material</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Qtd</th>
                            <th style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">Máquina</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            editableMaterials.forEach(m => {
                matTableHtml += `
                    <tr>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">#${m.ordem_id}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">${m.descricao} ${m.codigo ? '(Cód: '+m.codigo+')' : ''}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left; font-weight: bold;">${m.qtde_solicitada} ${m.unidade}</td>
                        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: left;">${m.maquina_tag || m.maquina_nome || '-'}</td>
                    </tr>
                `;
            });

            matTableHtml += `</tbody></table>`;

            const htmlBody = `
                <h2 style="color: #1e3a78; margin-bottom: 5px;">📦 Solicitação de Compras - Manutenção</h2>
                <p>Código da Solicitação: <strong style="color: #3b82f6; font-size: 1.2em;">${solData.numero_solicitacao}</strong></p>
                <p>Solicitante: <strong>${userName}</strong></p>
                <hr style="border: none; border-top: 2px solid #3b82f6; margin: 10px 0 20px;" />
                
                <p style="margin-bottom: 15px; font-size: 14px; color: #334155;">${corpo.replace(/\n/g, '<br/>')}</p>

                ${matTableHtml}

                <p style="font-size: 12px; color: #64748b;">Este é um e-mail automático gerado pelo sistema Lynx (Módulo de Manutenção).</p>
            `;

            // 3. Enviar via endpoint de email padrão
            const formData = new FormData();
            formData.append('to', toList);
            formData.append('subject', `[${solData.numero_solicitacao}] ${assunto}`);
            formData.append('html', htmlBody);
            formData.append('text', `Solicitação de Compras: ${solData.numero_solicitacao}. Solicitação gerada por ${userName}.`);

            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setResult({
                type: 'success',
                message: `Solicitação ${solData.numero_solicitacao} criada e e-mail enviado com sucesso!`
            });

            // Notifica o componente pai após delay
            setTimeout(() => {
                onComplete();
                onClose();
            }, 2000);

        } catch (err) {
            console.error('Erro ao enviar SC:', err);
            setResult({ type: 'error', message: 'Falha ao processar solicitação.' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-white/15 rounded-xl">
                            <Package className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Criar Solicitação de Compras</h3>
                            <p className="text-blue-100 text-sm">{selectedMaterials.length} material(is) selecionado(s)</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                    {/* Top: Email Config */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                        {/* Col 1 */}
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Assunto do E-mail</label>
                                <input
                                    type="text"
                                    value={assunto}
                                    onChange={e => setAssunto(e.target.value)}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white shadow-sm"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5 block">Corpo da Mensagem (Opcional)</label>
                                <textarea
                                    value={corpo}
                                    onChange={e => setCorpo(e.target.value)}
                                    rows={4}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none bg-white shadow-sm"
                                />
                            </div>
                        </div>

                        {/* Col 2 */}
                        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col h-full">
                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-blue-100 rounded-lg">
                                        <Mail className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                                        Destinatários do E-mail
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={addEmailField}
                                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar
                                </button>
                            </div>

                            <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                                {emails.map((email, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input
                                            type="email"
                                            placeholder="compras@empresa.com.br"
                                            value={email}
                                            onChange={e => updateEmail(idx, e.target.value)}
                                            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-slate-50"
                                        />
                                        {emails.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeEmailField(idx)}
                                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {validEmails.length > 0 && (
                                <div className="pt-3 mt-2 border-t border-slate-100">
                                    <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                                        <CheckCircle className="w-3.5 h-3.5" /> {validEmails.length} e-mail(s) válido(s)
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom: Items Table */}
                    <div className="w-full bg-white border border-slate-200 rounded-xl flex flex-col shadow-sm overflow-hidden">
                        <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Package className="w-4 h-4 text-blue-600" />
                                Itens da Solicitação ({editableMaterials.length})
                            </h4>
                            <span className="text-xs font-medium text-slate-500">Revise as quantidades antes do envio</span>
                        </div>
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm border-b border-slate-200">
                                    <tr className="text-[11px] uppercase font-bold text-slate-500">
                                        <th className="py-3 px-5">O.M. / Máquina</th>
                                        <th className="py-3 px-5">Material</th>
                                        <th className="py-3 px-5 w-32 text-center">Qtd Solicitada</th>
                                        <th className="py-3 px-5 w-40 text-center">Qtd p/ Comprar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {editableMaterials.map((m, i) => (
                                        <tr key={m.id} className="border-b border-slate-100 hover:bg-blue-50/30 transition-colors">
                                            <td className="py-3 px-5">
                                                <div className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-xs font-bold text-slate-700">
                                                    O.M. #{m.ordem_id}
                                                </div>
                                                <div className="text-[11px] font-medium text-slate-500 truncate max-w-[200px] mt-1.5" title={m.maquina_tag || m.maquina_nome || 'N/A'}>
                                                    {m.maquina_tag || m.maquina_nome || 'S/ Máquina'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-5">
                                                <div className="text-sm font-bold text-slate-800 line-clamp-2" title={m.descricao}>{m.descricao}</div>
                                                {m.codigo && <div className="text-xs text-blue-600 mt-1 font-medium bg-blue-50 border border-blue-100 inline-block px-1.5 py-0.5 rounded">Cód: {m.codigo}</div>}
                                            </td>
                                            <td className="py-3 px-5 text-center">
                                                <div className="inline-flex items-center justify-center bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                                                    <span className="text-sm font-bold text-slate-600">{m.quantidade}</span>
                                                    <span className="text-[11px] text-slate-400 font-bold ml-1">{m.unidade}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-5">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <input 
                                                        type="number" 
                                                        min="0.1" 
                                                        step="0.1"
                                                        className="w-24 border-2 border-blue-200 rounded-lg px-2 py-1.5 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center bg-blue-50 hover:bg-white transition-colors shadow-inner"
                                                        value={m.qtde_solicitada}
                                                        onChange={(e) => handleQuantityChange(m.id, parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="text-xs font-bold text-slate-400 w-6">{m.unidade}</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {editableMaterials.length === 0 && (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <Package className="w-12 h-12 mb-3 text-slate-300" />
                                    <span className="text-sm font-medium">Nenhum material selecionado.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Result Message */}
                {result && (
                    <div className={`mx-6 mb-4 flex items-start gap-3 p-4 rounded-xl border animate-fadeIn ${
                            result.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        {result.type === 'success'
                            ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                            : <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        }
                        <p className="text-sm font-medium">{result.message}</p>
                    </div>
                )}

                {/* Footer Actions */}
                <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        onClick={handleSendRequest}
                        disabled={isProcessing || validEmails.length === 0}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                    >
                        {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {isProcessing ? 'Enviando...' : 'Enviar Solicitação'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ManutencaoPurchaseRequestModal;
