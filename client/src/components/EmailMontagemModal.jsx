import React, { useState, useEffect } from 'react';
import { X, Send, Plus, Trash2, Mail } from 'lucide-react';
import { api } from '../services/api';
import { toast } from 'react-toastify';

export default function EmailMontagemModal({ isOpen, onClose, pdfBlob, fileName, defaultSubject }) {
    const [emails, setEmails] = useState(['']);
    const [subject, setSubject] = useState(defaultSubject || 'Relatório de Pendências da Montagem');
    const [observacao, setObservacao] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (isOpen) {
            const savedEmails = localStorage.getItem('metalfisa_montagem_emails');
            if (savedEmails) {
                try {
                    const parsed = JSON.parse(savedEmails);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setEmails(parsed);
                    } else {
                        setEmails(['']);
                    }
                } catch {
                    setEmails(['']);
                }
            } else {
                setEmails(['']);
            }
            setSubject(defaultSubject || 'Relatório de Pendências da Montagem');
            setObservacao('');
        }
    }, [isOpen, defaultSubject]);

    if (!isOpen) return null;

    const addEmailField = () => setEmails(prev => [...prev, '']);
    
    const removeEmailField = (index) => {
        setEmails(prev => prev.filter((_, i) => i !== index));
    };

    const handleEmailChange = (index, value) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
    };

    const handleSend = async () => {
        const validEmails = emails.filter(e => e.trim().length > 3 && e.includes('@'));
        if (validEmails.length === 0) {
            return toast.error('Adicione pelo menos um e-mail válido.');
        }

        setIsProcessing(true);
        try {
            const toList = validEmails.join(',');

            let htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                    <h2 style="color: #4f46e5; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                        Relatório de Pendências de Montagem
                    </h2>
                    <p>Olá,</p>
                    <p>Segue em anexo o relatório de pendências atualizado do setor de montagem.</p>
            `;

            if (observacao.trim()) {
                htmlBody += `
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 18px; border-radius: 4px; margin: 20px 0;">
                        <p style="margin: 0; color: #334155; font-weight: bold; font-size: 14px;">
                            📝 Observações:
                        </p>
                        <p style="margin: 5px 0 0; color: #475569; font-size: 13px; white-space: pre-wrap;">${observacao.trim()}</p>
                    </div>
                `;
            }

            htmlBody += `
                    <p style="color: #64748b; font-size: 12px; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 10px;">
                        E-mail gerado automaticamente pelo sistema Lynx Anty.
                    </p>
                </div>
            `;

            const formData = new FormData();
            formData.append('to', toList);
            formData.append('subject', subject);
            formData.append('html', htmlBody);
            formData.append('text', `Segue em anexo o relatório de pendências atualizado. ${observacao.trim()}`);
            formData.append('attachments', pdfBlob, fileName);

            await api.post('/email/send', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 90000,
                validateStatus: (s) => s === 200 || s === 202,
            });

            // Save valid emails for next time
            localStorage.setItem('metalfisa_montagem_emails', JSON.stringify(validEmails));

            toast.success('Relatório enviado com sucesso!');
            onClose();
        } catch (err) {
            console.error('Erro ao enviar e-mail:', err);
            toast.error('Erro ao enviar o e-mail. Tente novamente mais tarde.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Mail className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-white font-bold text-lg">Enviar Relatório por E-mail</h2>
                    </div>
                    <button onClick={onClose} disabled={isProcessing} className="text-white/70 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Destinatários</label>
                        <div className="space-y-2">
                            {emails.map((email, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <input
                                        type="email"
                                        placeholder="exemplo@lynxems.com.br"
                                        value={email}
                                        onChange={(e) => handleEmailChange(idx, e.target.value)}
                                        className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {emails.length > 1 && (
                                        <button
                                            onClick={() => removeEmailField(idx)}
                                            className="px-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addEmailField}
                            className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Adicionar e-mail
                        </button>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Assunto</label>
                        <input
                            type="text"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Observações no corpo do e-mail (Opcional)</label>
                        <textarea
                            rows={4}
                            value={observacao}
                            onChange={(e) => setObservacao(e.target.value)}
                            placeholder="Avisos sobre o relatório..."
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                    </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isProcessing}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isProcessing ? 'Enviando...' : (
                            <>
                                <Send className="w-4 h-4" /> Enviar E-mail
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
