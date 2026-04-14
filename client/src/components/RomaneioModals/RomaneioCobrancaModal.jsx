import React, { useState, useEffect } from 'react';
import { Mail, Send, X, AlertCircle, List, Plus, Trash2, User } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api';

export default function RomaneioCobrancaModal({ isOpen, onClose, supplierData, items, onFollowupSuccess }) {
    const [customMessage, setCustomMessage] = useState('');
    const [recipients, setRecipients] = useState([]);
    const [newEmail, setNewEmail] = useState('');
    const [sending, setSending] = useState(false);

    // Inicializar destinatários quando o modal abre
    useEffect(() => {
        if (isOpen && supplierData) {
            const initial = [];
            
            // 1. E-mail do Fornecedor (se existir)
            if (supplierData.email) {
                initial.push({ email: supplierData.email.trim().toLowerCase(), label: 'Fornecedor', canDelete: true });
            }

            // 2. E-mail do Usuário Logado (sempre envia cópia para si mesmo por padrão)
            try {
                const userJson = localStorage.getItem('@MetalFisa:user');
                if (userJson) {
                    const user = JSON.parse(userJson);
                    if (user.email) {
                        const email = user.email.trim().toLowerCase();
                        // Evitar duplicidade se o email do usuário for o mesmo do fornecedor
                        if (!initial.find(r => r.email === email)) {
                            initial.push({ email, label: 'Minha Cópia', canDelete: false });
                        }
                    }
                }
            } catch (e) {
                console.warn('Erro ao ler e-mail do usuário do localStorage:', e);
            }

            setRecipients(initial);
            setCustomMessage('');
        }
    }, [isOpen, supplierData]);

    if (!isOpen || !supplierData) return null;

    const addEmail = () => {
        const email = newEmail.trim().toLowerCase();
        if (!email) return;
        if (!email.includes('@')) {
            toast.warning('Informe um e-mail válido.');
            return;
        }
        if (recipients.find(r => r.email === email)) {
            toast.warning('Este e-mail já está na lista.');
            return;
        }

        setRecipients([...recipients, { email, label: 'Adicional', canDelete: true }]);
        setNewEmail('');
    };

    const removeEmail = (email) => {
        setRecipients(recipients.filter(r => r.email !== email));
    };

    const handleSend = async () => {
        const finalEmails = recipients.map(r => r.email);
        if (finalEmails.length === 0) {
            toast.warning('Informe ao menos um destinatário.');
            return;
        }

        try {
            setSending(true);
            const { data } = await api.post('/romaneios/recebimentos/batch-followup', {
                supplierCod: supplierData.codigo,
                supplierLoja: supplierData.loja,
                customMessage,
                recipients: finalEmails,
                items: items
            });

            toast.success(`Cobrança enviada com sucesso para ${finalEmails.length} destinatários.`);
            if (onFollowupSuccess) onFollowupSuccess();
            onClose();
        } catch (error) {
            console.error('Erro ao enviar cobrança:', error);
            const msg = error.response?.data?.error || error.response?.data?.message || 'Erro ao processar envio de e-mail.';
            toast.error(msg);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <Mail className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">Enviar Cobrança de Follow-up</h3>
                            <p className="text-xs text-indigo-100 opacity-90">{supplierData.nome}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-indigo-100 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
                    
                    {/* Destinatários */}
                    <div className="space-y-3">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Destinatários do E-mail (Multi-envio):
                        </label>
                        
                        <div className="flex flex-wrap gap-2 mb-3 min-h-[40px] p-2 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                            {recipients.length === 0 && (
                                <span className="text-slate-400 text-xs italic p-1">Nenhum destinatário adicionado...</span>
                            )}
                            {recipients.map((r, idx) => (
                                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm shadow-sm hover:border-indigo-300 transition-all group">
                                    <div className="flex flex-col">
                                        <span className="text-slate-700 font-medium leading-none">{r.email}</span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">
                                            {r.label}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={() => removeEmail(r.email)}
                                        className="text-slate-400 hover:text-red-500 transition-colors ml-1 p-1 hover:bg-red-50 rounded"
                                        title="Remover"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input
                                    type="email"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addEmail();
                                        }
                                    }}
                                    placeholder="Ex: financeiro@fornecedor.com..."
                                    className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                                />
                                <Plus className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                            </div>
                            <button 
                                onClick={addEmail}
                                className="px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-900 transition-all active:scale-95 shadow-md flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar
                            </button>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    {/* Pending Items List (Preview) */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                            <List className="w-3.5 h-3.5" />
                            Itens inclusos na cobrança ({items.length}):
                        </label>
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <table className="w-full text-[11px] text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2 text-slate-600 font-semibold uppercase">Romaneio</th>
                                        <th className="px-3 py-2 text-slate-600 font-semibold uppercase">Produto</th>
                                        <th className="px-3 py-2 text-slate-600 font-semibold uppercase text-right">Saldo</th>
                                        <th className="px-3 py-2 text-slate-600 font-semibold uppercase text-center">Previsão</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.slice(0, 4).map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-1.5 font-medium text-slate-700">#{item.romaneio_id}</td>
                                            <td className="px-3 py-1.5 text-slate-600 truncate max-w-[150px]">{item.codigo_produto}</td>
                                            <td className="px-3 py-1.5 text-right font-bold text-red-600">{Number(item.saldo_pendente).toLocaleString('pt-BR')}</td>
                                            <td className="px-3 py-1.5 text-center text-slate-400">
                                                {item.data_previsao_retorno ? new Date(item.data_previsao_retorno + 'T12:00:00Z').toLocaleDateString('pt-BR') : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                    {items.length > 4 && (
                                        <tr className="bg-slate-50/50">
                                            <td colSpan="4" className="px-3 py-1 text-center text-slate-400 italic">
                                                ...e mais {items.length - 4} itens pendentes
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Custom Message Field */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Mensagem Adicional (Opcional):
                        </label>
                        <textarea
                            value={customMessage}
                            onChange={(e) => setCustomMessage(e.target.value)}
                            placeholder="Ex: Reforçamos a urgência destes itens para o cronograma da próxima semana..."
                            className="w-full h-24 px-4 py-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none shadow-inner"
                        />
                    </div>

                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div className="text-[11px] text-amber-800 leading-relaxed">
                            <b>Atenção:</b> Ao enviar, uma nova revisão será registrada no histórico de cada romaneio acima, confirmando que a cobrança foi disparada oficialmente.
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={sending}
                        className="px-6 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={sending || recipients.length === 0}
                        className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {sending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Enviar Cobrança Email
                            </>
                        )}
                    </button>
                </div>

            </div>
        </div>
    );
}
